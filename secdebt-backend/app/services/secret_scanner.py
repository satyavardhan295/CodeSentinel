"""Hardcoded secret detection: detect-secrets plugins plus extra regexes."""

import logging
import math
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from detect_secrets import SecretsCollection
from detect_secrets.settings import default_settings

from app.services.file_handler import CodeFile, file_extension

log = logging.getLogger(__name__)

# Lock files are full of integrity hashes that look like secrets
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "composer.lock"}


@dataclass
class SecretFindingData:
    type: str
    file_path: str
    line: int
    masked_value: str
    severity: str  # Critical | High
    rotate_url: str


# Map normalised secret type → (display name, severity, rotate URL)
CLOUD = "Critical"
OTHER = "High"
TYPE_INFO: dict[str, tuple[str, str, str]] = {
    "aws": ("AWS Access Key", CLOUD, "https://console.aws.amazon.com/iam/home#/security_credentials"),
    "aws_secret": ("AWS Secret Key", CLOUD, "https://console.aws.amazon.com/iam/home#/security_credentials"),
    "gcp": ("Google Cloud API Key", CLOUD, "https://console.cloud.google.com/apis/credentials"),
    "azure": ("Azure Storage Key", CLOUD, "https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Storage%2FStorageAccounts"),
    "ibm": ("IBM Cloud Key", CLOUD, "https://cloud.ibm.com/iam/apikeys"),
    "stripe": ("Stripe Secret Key", OTHER, "https://dashboard.stripe.com/apikeys"),
    "sendgrid": ("SendGrid API Key", OTHER, "https://app.sendgrid.com/settings/api_keys"),
    "github": ("GitHub Token", OTHER, "https://github.com/settings/tokens"),
    "slack": ("Slack Token", OTHER, "https://api.slack.com/apps"),
    "twilio": ("Twilio API Key", OTHER, "https://console.twilio.com/us1/account/keys-credentials/api-keys"),
    "mailchimp": ("Mailchimp API Key", OTHER, "https://admin.mailchimp.com/account/api/"),
    "npm": ("NPM Token", OTHER, "https://www.npmjs.com/settings/~/tokens"),
    "openai": ("OpenAI API Key", OTHER, "https://platform.openai.com/api-keys"),
    "jwt": ("JSON Web Token", OTHER, ""),
    "private_key": ("Private Key", OTHER, ""),
    "basic_auth": ("Credentials in URL", OTHER, ""),
    "password": ("Hardcoded Password", OTHER, ""),
    "env": ("Secret in .env file", OTHER, ""),
    "generic": ("High-Entropy Secret", OTHER, ""),
}

# detect-secrets plugin names → our type keys
DETECT_SECRETS_TYPES = {
    "AWS Access Key": "aws",
    "Azure Storage Account access key": "azure",
    "IBM Cloud IAM Key": "ibm",
    "IBM COS HMAC Credentials": "ibm",
    "Stripe Access Key": "stripe",
    "SendGrid API Key": "sendgrid",
    "GitHub Token": "github",
    "Slack Token": "slack",
    "Twilio API Key": "twilio",
    "Mailchimp Access Key": "mailchimp",
    "NPM tokens": "npm",
    "OpenAI Token": "openai",
    "JSON Web Token": "jwt",
    "Private Key": "private_key",
    "Basic Auth Credentials": "basic_auth",
    "Secret Keyword": "password",
    "Base64 High Entropy String": "generic",
    "Hex High Entropy String": "generic",
}

SECRET_KEY_NAMES = r"(?:secret|token|passw(?:or)?d|pwd|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth)"

REGEXES: list[tuple[str, re.Pattern[str]]] = [
    ("aws", re.compile(r"\b((?:AKIA|ASIA)[0-9A-Z]{16})\b")),
    ("aws_secret", re.compile(r"(?i)aws.{0,20}?secret.{0,20}?['\"]([A-Za-z0-9/+=]{40})['\"]")),
    ("gcp", re.compile(r"\b(AIza[0-9A-Za-z_-]{35})\b")),
    ("stripe", re.compile(r"\b((?:sk|rk)_live_[0-9a-zA-Z]{24,})\b")),
    ("sendgrid", re.compile(r"\b(SG\.[a-zA-Z0-9_-]{22,}\.[a-zA-Z0-9_-]{22,})\b")),
    ("github", re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b")),
    ("slack", re.compile(r"\b(xox[baprs]-[0-9A-Za-z-]{10,})\b")),
    ("private_key", re.compile(r"(-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----)")),
    # Password-ish name assigned a non-trivial literal
    (
        "password",
        re.compile(r"(?i)(?:passw(?:or)?d|pwd)[A-Za-z0-9_]*['\"]?\s*[:=]\s*['\"]([^'\"\s]{8,})['\"]"),
    ),
    # Generic: secret-ish name assigned a long high-entropy literal
    (
        "generic",
        re.compile(
            rf"(?i){SECRET_KEY_NAMES}[A-Za-z0-9_]*['\"]?\s*[:=]\s*['\"]([^'\"\s]{{16,}})['\"]"
        ),
    ),
]

# Values may contain '#'; an inline comment needs whitespace before it
ENV_LINE_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['\"]?([^'\"\s]+)")
PLACEHOLDER_RE = re.compile(
    r"(?i)^(?:x+|\*+|changeme|change_me|example|sample|dummy|test|todo|none|null|true|false|"
    r"your[_-].*|<.*>|\$\{.*\}|\{\{.*\}\}|.*placeholder.*|.*example.*|localhost|password|secret)$"
)


def mask(value: str) -> str:
    value = value.strip()
    if len(value) <= 4:
        return "*" * len(value)
    return "*" * min(len(value) - 4, 16) + value[-4:]


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = Counter(s)
    return -sum(c / len(s) * math.log2(c / len(s)) for c in counts.values())


def looks_real(value: str) -> bool:
    v = value.strip()
    if len(v) < 8 or PLACEHOLDER_RE.match(v):
        return False
    if v.startswith(("http://", "https://", "/", "./")) and "@" not in v:
        return False
    return shannon_entropy(v) >= 3.0


def _make(key: str, path: str, line: int, value: str) -> SecretFindingData:
    name, severity, url = TYPE_INFO[key]
    return SecretFindingData(name, path, line, mask(value), severity, url)


def _scan_regex(f: CodeFile) -> list[SecretFindingData]:
    out: list[SecretFindingData] = []
    is_env = file_extension(Path(f.path).name) == ".env"
    for lineno, line in enumerate(f.content.splitlines(), start=1):
        if len(line) > 2000:  # minified blob
            continue
        for key, pattern in REGEXES:
            for m in pattern.finditer(line):
                value = m.group(1)
                if key in ("generic", "password") and not looks_real(value):
                    continue
                out.append(_make(key, f.path, lineno, value))
        if is_env:
            m = ENV_LINE_RE.match(line)
            if m and re.search(SECRET_KEY_NAMES, m.group(1), re.I) and looks_real(m.group(2)):
                out.append(_make("env", f.path, lineno, m.group(2)))
    return out


def _scan_detect_secrets(files: list[CodeFile]) -> list[SecretFindingData]:
    """Run detect-secrets' default plugins and heuristic filters over the files."""
    out: list[SecretFindingData] = []
    with tempfile.TemporaryDirectory(prefix="codesentinel-secrets-") as tmp:
        tmp_root = Path(tmp)
        by_tmp: dict[str, CodeFile] = {}
        for i, f in enumerate(files):
            # Keep the original filename: some filters look at the extension
            p = tmp_root / str(i) / Path(f.path).name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(f.content, encoding="utf-8", errors="replace")
            by_tmp[str(p)] = f

        collection = SecretsCollection()
        with default_settings():
            for tmp_path in by_tmp:
                try:
                    collection.scan_file(tmp_path)
                except Exception:  # one bad file shouldn't sink the scan
                    log.exception("detect-secrets failed on %s", by_tmp[tmp_path].path)

        for filename, secret in collection:
            f = by_tmp.get(filename) or by_tmp.get(str(Path(filename)))
            if f is None:
                continue
            key = DETECT_SECRETS_TYPES.get(secret.type, "generic")
            value = secret.secret_value or ""
            if key == "generic":
                # Entropy plugins are noisy; only keep hits in a secret-looking assignment
                line_text = _line(f.content, secret.line_number)
                if not re.search(SECRET_KEY_NAMES, line_text, re.I) or not looks_real(value):
                    continue
            out.append(_make(key, f.path, secret.line_number, value))
    return out


def _line(content: str, lineno: int) -> str:
    lines = content.splitlines()
    return lines[lineno - 1] if 0 < lineno <= len(lines) else ""


PASSWORD_ASSIGN_RE = re.compile(
    rf"(?i)({SECRET_KEY_NAMES}[A-Za-z0-9_]*['\"]?\s*[:=]\s*['\"])([^'\"\n]{{4,}})(['\"])"
)


def redact_secrets(content: str) -> str:
    """Replace credential-looking values so they are never sent to the LLM."""
    for _key, pattern in REGEXES:
        content = pattern.sub(lambda m: m.group(0).replace(m.group(1), "<REDACTED>"), content)
    return PASSWORD_ASSIGN_RE.sub(lambda m: f"{m.group(1)}<REDACTED>{m.group(3)}", content)


def scan_for_secrets(files: list[CodeFile]) -> list[SecretFindingData]:
    targets = [f for f in files if Path(f.path).name.lower() not in SKIP_FILES]
    results = _scan_regex_all(targets)
    try:
        results += _scan_detect_secrets(targets)
    except Exception:
        log.exception("detect-secrets scan failed; continuing with regex results only")

    # Dedupe: one finding per (file, line); prefer the most specific type
    best: dict[tuple[str, int], SecretFindingData] = {}
    rank = {"High-Entropy Secret": 0, "Hardcoded Password": 1, "Secret in .env file": 1}
    for r in results:
        k = (r.file_path, r.line)
        cur = best.get(k)
        if cur is None or rank.get(r.type, 2) > rank.get(cur.type, 2):
            best[k] = r
    return sorted(best.values(), key=lambda r: (r.severity != "Critical", r.file_path, r.line))


def _scan_regex_all(files: list[CodeFile]) -> list[SecretFindingData]:
    out: list[SecretFindingData] = []
    for f in files:
        out += _scan_regex(f)
    return out
