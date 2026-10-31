"""Dependency vulnerability lookup against the OSV database (https://osv.dev)."""

import asyncio
import json
import logging
import math
import re
from dataclasses import dataclass
from pathlib import PurePosixPath

import httpx
from packaging.requirements import InvalidRequirement, Requirement
from packaging.version import InvalidVersion, Version

from app.services.file_handler import CodeFile

log = logging.getLogger(__name__)

OSV_URL = "https://api.osv.dev/v1/query"
MAX_CONCURRENCY = 8


@dataclass
class DependencyIssueData:
    package: str
    current_version: str
    fixed_version: str
    cve: str
    severity: str  # Critical | High | Medium | Low
    description: str


@dataclass(frozen=True)
class Dependency:
    name: str
    version: str
    ecosystem: str  # "npm" | "PyPI"


# ── Manifest parsing ─────────────────────────────────────────────

NPM_VERSION_RE = re.compile(r"(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?)")


def _npm_version(spec: str) -> str | None:
    """Turn "^4.17.20" / "~1.2" / ">=2.0.0 <3" into a concrete version to check."""
    spec = spec.strip()
    if not spec or spec in ("*", "latest") or spec.startswith(
        ("git", "http", "file:", "link:", "workspace:", "npm:", "github:")
    ) or "/" in spec:
        return None
    m = NPM_VERSION_RE.search(spec)
    if not m:
        return None
    parts = m.group(1).split("-")[0].split(".")
    while len(parts) < 3:
        parts.append("0")
    suffix = m.group(1)[len(m.group(1).split("-")[0]):]
    return ".".join(parts) + suffix


def parse_package_json(content: str) -> list[Dependency]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return []
    deps: list[Dependency] = []
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        for name, spec in (data.get(section) or {}).items():
            if isinstance(spec, str) and (version := _npm_version(spec)):
                deps.append(Dependency(name, version, "npm"))
    return deps


def parse_requirements_txt(content: str) -> list[Dependency]:
    deps: list[Dependency] = []
    for raw in content.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or line.startswith(("-", "git+", "http")):
            continue
        try:
            req = Requirement(line)
        except InvalidRequirement:
            continue
        # Use the pinned (==) or lower-bound (>=, ~=) version
        version = None
        for spec in req.specifier:
            if spec.operator in ("==", "===", ">=", "~="):
                version = spec.version.rstrip(".*")
                if spec.operator in ("==", "==="):
                    break
        if version:
            deps.append(Dependency(req.name.lower(), version, "PyPI"))
    return deps


def collect_dependencies(files: list[CodeFile]) -> list[Dependency]:
    seen: set[Dependency] = set()
    out: list[Dependency] = []
    for f in files:
        name = PurePosixPath(f.path).name.lower()
        if name == "package.json":
            parsed = parse_package_json(f.content)
        elif name == "requirements.txt" or (name.startswith("requirements") and name.endswith(".txt")):
            parsed = parse_requirements_txt(f.content)
        else:
            continue
        for d in parsed:
            if d not in seen:
                seen.add(d)
                out.append(d)
    return out


# ── Severity ─────────────────────────────────────────────────────

_CVSS3_WEIGHTS = {
    "AV": {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.2},
    "AC": {"L": 0.77, "H": 0.44},
    "UI": {"N": 0.85, "R": 0.62},
    "C": {"H": 0.56, "L": 0.22, "N": 0.0},
    "I": {"H": 0.56, "L": 0.22, "N": 0.0},
    "A": {"H": 0.56, "L": 0.22, "N": 0.0},
}


def _roundup(x: float) -> float:
    i = round(x * 100000)
    return i / 100000.0 if i % 10000 == 0 else (math.floor(i / 10000) + 1) / 10.0


def cvss3_base_score(vector: str) -> float | None:
    """Compute a CVSS v3.x base score from its vector string."""
    try:
        metrics = dict(part.split(":", 1) for part in vector.split("/")[1:])
        scope_changed = metrics["S"] == "C"
        pr = {"N": 0.85, "L": 0.68 if scope_changed else 0.62, "H": 0.5 if scope_changed else 0.27}[metrics["PR"]]
        w = _CVSS3_WEIGHTS
        iss = 1 - (1 - w["C"][metrics["C"]]) * (1 - w["I"][metrics["I"]]) * (1 - w["A"][metrics["A"]])
        impact = 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 if scope_changed else 6.42 * iss
        exploit = 8.22 * w["AV"][metrics["AV"]] * w["AC"][metrics["AC"]] * pr * w["UI"][metrics["UI"]]
        if impact <= 0:
            return 0.0
        raw = 1.08 * (impact + exploit) if scope_changed else impact + exploit
        return _roundup(min(raw, 10))
    except (KeyError, ValueError):
        return None


def _bucket(score: float) -> str:
    if score >= 9.0:
        return "Critical"
    if score >= 7.0:
        return "High"
    if score >= 4.0:
        return "Medium"
    return "Low"


def vuln_severity(vuln: dict) -> str:
    for sev in vuln.get("severity") or []:
        if sev.get("type") == "CVSS_V3" and (score := cvss3_base_score(sev.get("score", ""))) is not None:
            return _bucket(score)
    label = str((vuln.get("database_specific") or {}).get("severity", "")).upper()
    return {"CRITICAL": "Critical", "HIGH": "High", "MODERATE": "Medium", "MEDIUM": "Medium", "LOW": "Low"}.get(
        label, "Medium"
    )


# ── OSV lookups ──────────────────────────────────────────────────

def _parse_version(v: str) -> Version | None:
    try:
        return Version(v)
    except InvalidVersion:
        return None


def fixed_version_for(vuln: dict, dep: Dependency) -> str:
    """Smallest 'fixed' version above the current one, across matching affected ranges."""
    current = _parse_version(dep.version)
    candidates: list[str] = []
    for affected in vuln.get("affected") or []:
        pkg = affected.get("package") or {}
        if pkg.get("name", "").lower() != dep.name.lower():
            continue
        for rng in affected.get("ranges") or []:
            for event in rng.get("events") or []:
                if fixed := event.get("fixed"):
                    candidates.append(fixed)
    parsed = [(v, _parse_version(v)) for v in candidates]
    newer = [(raw, pv) for raw, pv in parsed if pv and (current is None or pv > current)]
    if newer:
        return min(newer, key=lambda t: t[1])[0]
    return candidates[0] if candidates else "No fix available"


def vuln_id(vuln: dict) -> str:
    cves = [a for a in vuln.get("aliases") or [] if a.startswith("CVE-")]
    return cves[0] if cves else vuln.get("id", "")


async def _query(client: httpx.AsyncClient, sem: asyncio.Semaphore, dep: Dependency) -> list[DependencyIssueData]:
    payload = {"package": {"name": dep.name, "ecosystem": dep.ecosystem}, "version": dep.version}
    async with sem:
        try:
            resp = await client.post(OSV_URL, json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("OSV lookup failed for %s@%s: %s", dep.name, dep.version, exc)
            return []
    issues: list[DependencyIssueData] = []
    for vuln in resp.json().get("vulns") or []:
        if vuln.get("withdrawn"):
            continue
        description = (vuln.get("summary") or vuln.get("details") or "").strip()
        if len(description) > 1000:
            description = description[:997] + "..."
        issues.append(
            DependencyIssueData(
                package=dep.name,
                current_version=dep.version,
                fixed_version=fixed_version_for(vuln, dep),
                cve=vuln_id(vuln),
                severity=vuln_severity(vuln),
                description=description,
            )
        )
    return issues


async def scan_dependencies(files: list[CodeFile]) -> list[DependencyIssueData]:
    deps = collect_dependencies(files)
    if not deps:
        return []
    sem = asyncio.Semaphore(MAX_CONCURRENCY)
    async with httpx.AsyncClient(timeout=20) as client:
        results = await asyncio.gather(*(_query(client, sem, d) for d in deps))

    # Same advisory can come back under several package.json files
    seen: set[tuple[str, str, str]] = set()
    issues: list[DependencyIssueData] = []
    for issue in (i for batch in results for i in batch):
        key = (issue.package, issue.current_version, issue.cve)
        if key not in seen:
            seen.add(key)
            issues.append(issue)
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    issues.sort(key=lambda i: (order.get(i.severity, 4), i.package))
    return issues
