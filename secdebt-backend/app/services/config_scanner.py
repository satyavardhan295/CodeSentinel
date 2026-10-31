"""Rule-based misconfiguration checks for the "config" scan type."""

import re
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.services.file_handler import CodeFile, file_extension


@dataclass
class ConfigIssueData:
    issue: str
    file_path: str
    rule: str
    severity: str


@dataclass(frozen=True)
class Rule:
    id: str
    severity: str
    message: str
    pattern: re.Pattern[str]
    extensions: frozenset[str]


def _rule(id: str, severity: str, message: str, pattern: str, exts: str) -> Rule:
    return Rule(id, severity, message, re.compile(pattern, re.I), frozenset(exts.split(",")))


CODE = ".js,.jsx,.ts,.tsx,.py,.rb,.php,.go,.java,.cs"
YAML = ".yml,.yaml"

RULES: list[Rule] = [
    _rule("TLS_VERIFY_DISABLED", "High", "TLS certificate verification is disabled",
          r"rejectUnauthorized\s*:\s*false|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0",
          CODE + ",.env"),
    _rule("DEBUG_ENABLED", "Medium", "Debug mode is enabled",
          r"^\s*DEBUG\s*=\s*True\b|\.run\([^)]*debug\s*=\s*True|^\s*debug\s*:\s*true\b|^\s*APP_DEBUG\s*=\s*true",
          ".py,.env" + "," + YAML),
    _rule("CORS_WILDCARD", "Medium", "CORS allows any origin (*)",
          r"Access-Control-Allow-Origin['\"]?\s*,\s*['\"]\*|origin\s*:\s*['\"]\*['\"]|allow_origins\s*=\s*\[\s*['\"]\*",
          CODE),
    _rule("COOKIE_NOT_SECURE", "Medium", "Session cookie is sent without the Secure flag",
          r"\bsecure\s*:\s*false|SESSION_COOKIE_SECURE\s*=\s*False", CODE),
    _rule("COOKIE_NOT_HTTPONLY", "Medium", "Cookie is readable from JavaScript (HttpOnly disabled)",
          r"httpOnly\s*:\s*false|SESSION_COOKIE_HTTPONLY\s*=\s*False", CODE),
    _rule("K8S_PRIVILEGED", "High", "Container runs in privileged mode",
          r"^\s*privileged\s*:\s*true", YAML),
    _rule("K8S_ROOT", "Medium", "Container is allowed to run as root",
          r"runAsNonRoot\s*:\s*false|runAsUser\s*:\s*0\b", YAML),
    _rule("GHA_PR_TARGET", "Medium", "Workflow uses pull_request_target, which exposes secrets to forks",
          r"^\s*pull_request_target\s*:", YAML),
    _rule("TF_PUBLIC_ACL", "High", "Storage bucket is publicly readable",
          r"acl\s*=\s*\"public-read(-write)?\"", ".tf"),
    _rule("TF_OPEN_INGRESS", "High", "Security group allows traffic from 0.0.0.0/0",
          r"cidr_blocks\s*=\s*\[[^\]]*\"0\.0\.0\.0/0\"", ".tf"),
    _rule("TF_UNENCRYPTED", "Medium", "Storage is not encrypted at rest",
          r"(?:encrypted|storage_encrypted)\s*=\s*false", ".tf"),
    _rule("DB_PUBLIC", "High", "Database instance is publicly accessible",
          r"publicly_accessible\s*=\s*true", ".tf"),
]


def scan_configurations(files: list[CodeFile]) -> list[ConfigIssueData]:
    issues: list[ConfigIssueData] = []
    for f in files:
        ext = file_extension(PurePosixPath(f.path).name)
        rules = [r for r in RULES if ext in r.extensions]
        if not rules:
            continue
        for lineno, line in enumerate(f.content.splitlines(), start=1):
            if len(line) > 1000:
                continue
            for r in rules:
                if r.pattern.search(line):
                    issues.append(
                        ConfigIssueData(f"{r.message} (line {lineno})", f.path, r.id, r.severity)
                    )
    return issues
