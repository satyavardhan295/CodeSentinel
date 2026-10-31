"""All Gemini API calls: code analysis and per-finding chat."""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import PurePosixPath

import google.generativeai as genai
from google.api_core import exceptions as gexc

from app.config import settings
from app.services.file_handler import CodeFile, file_extension
from app.services.secret_scanner import redact_secrets

log = logging.getLogger(__name__)

genai.configure(api_key=settings.gemini_api_key)

ANALYSIS_SYSTEM = (
    "You are a senior application security engineer performing a code review. "
    "Analyse the provided code for security vulnerabilities. Be specific: "
    "name the exact file, line numbers, and code involved. Do not report "
    "issues you are not confident about. Return ONLY valid JSON, no markdown, "
    "no explanation outside the JSON."
)

ANALYSIS_PROMPT = (
    "Analyse this code for security vulnerabilities and return a JSON array.\n"
    "Each object must have exactly these keys:\n"
    "  title, severity (Critical|High|Medium|Low), category, cwe, owasp,\n"
    "  file_path, line_start, line_end, code_snippet, description,\n"
    "  attack_scenario, fix_before, fix_after, fix_explanation,\n"
    "  points_if_fixed (integer 1-20)\n"
    "Each line of code below is prefixed with its line number and ' | '. Use those numbers "
    "for line_start/line_end, but do NOT include the prefixes in code_snippet, fix_before or "
    "fix_after. file_path must be copied exactly from the 'File:' header. "
    "If there are no vulnerabilities, return [].\n"
    "Code:\n"
)

STRICT_SUFFIX = (
    "\n\nIMPORTANT: Your previous answer was not valid JSON. Respond with a single JSON array "
    "of objects and nothing else — no markdown fences, no prose, no trailing commas."
)

CHAT_SYSTEM = (
    "You are a security expert helping a developer understand a specific "
    "vulnerability in their code. Be practical and direct. "
    # The UI shows replies as plain text in a small chat panel
    "Reply in plain text without Markdown (no #, **, or ``` fences), in a few short "
    "paragraphs or a short numbered list. Keep it under 200 words unless asked for more. "
    "When showing code, put it on its own lines, indented with two spaces."
)

# Chunking limits
MAX_FILES_PER_CHUNK = 5
MAX_TOKENS_PER_CHUNK = 15_000
CHARS_PER_TOKEN = 4  # rough estimate for code
MAX_CHUNK_CHARS = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN

# Files with nothing worth an LLM review
SKIP_AI_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "composer.lock"}
MAX_JSON_BYTES = 20_000
HASH_COMMENT_EXTS = {".py", ".rb", ".yml", ".yaml", ".toml", ".tf", ".env"}

SEVERITIES = {"critical": "Critical", "high": "High", "medium": "Medium", "moderate": "Medium", "low": "Low"}


class GeminiError(Exception):
    """Gemini could not be used at all (bad key, model missing, quota gone)."""


@dataclass
class RawFinding:
    title: str
    severity: str
    category: str = ""
    cwe: str = ""
    owasp: str = ""
    file_path: str = ""
    line_start: int = 0
    line_end: int = 0
    code_snippet: str = ""
    description: str = ""
    attack_scenario: str = ""
    fix_before: str = ""
    fix_after: str = ""
    fix_explanation: str = ""
    effort_hours: float = 1.0
    points_if_fixed: int | None = None


@dataclass
class FindingContext:
    title: str
    severity: str
    cwe: str
    file_path: str
    code_snippet: str
    description: str
    extra: dict[str, str] = field(default_factory=dict)


# ── Chunking ─────────────────────────────────────────────────────

def is_ai_candidate(f: CodeFile) -> bool:
    name = PurePosixPath(f.path).name.lower()
    if name in SKIP_AI_FILES or name.endswith((".min.js", ".map")):
        return False
    if file_extension(name) == ".env":  # pure secrets; the secret scanner covers these
        return False
    if file_extension(name) == ".json" and len(f.content) > MAX_JSON_BYTES:
        return False
    return bool(f.content.strip())


def _render(path: str, lines: list[str], first_line: int) -> str:
    comment = "#" if file_extension(PurePosixPath(path).name) in HASH_COMMENT_EXTS else "//"
    body = "\n".join(f"{n} | {line}" for n, line in enumerate(lines, start=first_line))
    return f"{comment} File: {path}\n{body}\n"


def build_chunks(files: list[CodeFile]) -> list[tuple[str, list[str]]]:
    """Group files into prompts of ≤5 files and ≤~15k tokens. Oversized files are split by line."""
    pieces: list[tuple[str, str]] = []  # (path, rendered text)
    for f in files:
        if not is_ai_candidate(f):
            continue
        # Never ship credentials to the LLM (it also tends to refuse when it sees them)
        lines = redact_secrets(f.content).splitlines()
        start, buf, size = 1, [], 0
        for i, line in enumerate(lines, start=1):
            if size + len(line) + 8 > MAX_CHUNK_CHARS and buf:
                pieces.append((f.path, _render(f.path, buf, start)))
                start, buf, size = i, [], 0
            buf.append(line[:2000])  # cap minified lines
            size += min(len(line), 2000) + 8
        if buf:
            pieces.append((f.path, _render(f.path, buf, start)))

    chunks: list[tuple[str, list[str]]] = []
    cur_text: list[str] = []
    cur_paths: list[str] = []
    cur_size = 0
    for path, text in pieces:
        if cur_text and (len(cur_text) >= MAX_FILES_PER_CHUNK or cur_size + len(text) > MAX_CHUNK_CHARS):
            chunks.append(("\n".join(cur_text), cur_paths))
            cur_text, cur_paths, cur_size = [], [], 0
        cur_text.append(text)
        if path not in cur_paths:
            cur_paths.append(path)
        cur_size += len(text)
    if cur_text:
        chunks.append(("\n".join(cur_text), cur_paths))
    return chunks


# ── Gemini calls ─────────────────────────────────────────────────

_RETRYABLE = (gexc.ResourceExhausted, gexc.ServiceUnavailable, gexc.InternalServerError, gexc.DeadlineExceeded)
_FATAL = (gexc.PermissionDenied, gexc.Unauthenticated, gexc.NotFound)


def _model(system_instruction: str, json_mode: bool) -> genai.GenerativeModel:
    config = {"temperature": 0.2}
    if json_mode:
        config["response_mime_type"] = "application/json"
    return genai.GenerativeModel(
        settings.gemini_model, system_instruction=system_instruction, generation_config=config
    )


_RETRY_IN_RE = re.compile(r"retry in (\d+(?:\.\d+)?)s")


async def _generate(model: genai.GenerativeModel, prompt: str, attempts: int = 5) -> str:
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not set. Add it to the backend .env file.")
    delay = 5.0
    for attempt in range(1, attempts + 1):
        try:
            resp = await model.generate_content_async(prompt, request_options={"timeout": 180})
            return resp.text
        except _FATAL as exc:
            raise GeminiError(f"Gemini API error: {getattr(exc, 'message', exc)}") from exc
        except gexc.InvalidArgument as exc:
            if "api key" in str(exc).lower():
                raise GeminiError("Gemini rejected the API key. Check GEMINI_API_KEY.") from exc
            raise
        except _RETRYABLE as exc:
            message = str(exc)
            if isinstance(exc, gexc.ResourceExhausted) and "per day" in message.lower():
                raise GeminiError(
                    f"Gemini daily quota exhausted for model {settings.gemini_model}. "
                    "Try again tomorrow, switch GEMINI_MODEL, or enable billing on your Gemini API key."
                ) from exc
            if attempt == attempts:
                raise
            # Per-minute limits tell us how long to wait
            m = _RETRY_IN_RE.search(message)
            wait = min(float(m.group(1)) + 1, 65) if m else delay
            log.warning(
                "Gemini %s (attempt %d/%d); retrying in %.0fs",
                type(exc).__name__, attempt, attempts, wait,
            )
            await asyncio.sleep(wait)
            delay *= 2
        except ValueError:
            # resp.text raises ValueError when the response was blocked / empty
            return ""
    return ""


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fall back to the outermost [...] block
        start, end = text.find("["), text.rfind("]")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _is_refusal(text: str) -> bool:
    head = text.lstrip()[:200].lower()
    return head.startswith(("sorry", "i cannot", "i can't", "i'm unable", "i am unable"))


def _as_int(v, default: int = 0) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _as_float(v, default: float = 1.0) -> float:
    try:
        return max(0.0, float(v))
    except (TypeError, ValueError):
        return default


def _normalise(item: dict, file_paths: list[str]) -> RawFinding | None:
    if not isinstance(item, dict) or not item.get("title"):
        return None
    severity = SEVERITIES.get(str(item.get("severity", "")).strip().lower())
    if not severity:
        return None
    path = str(item.get("file_path") or "").strip().removeprefix("./")
    if path not in file_paths:
        # Gemini sometimes trims or prefixes the path; match by suffix
        match = next((p for p in file_paths if p.endswith(path) or path.endswith(p)), None) if path else None
        path = match or (file_paths[0] if len(file_paths) == 1 else path)
    line_start = max(0, _as_int(item.get("line_start")))
    line_end = max(line_start, _as_int(item.get("line_end"), line_start))
    points = _as_int(item.get("points_if_fixed"), 0)
    return RawFinding(
        title=str(item["title"]).strip()[:500],
        severity=severity,
        category=str(item.get("category") or "").strip(),
        cwe=str(item.get("cwe") or "").strip(),
        owasp=str(item.get("owasp") or "").strip(),
        file_path=path,
        line_start=line_start,
        line_end=line_end,
        code_snippet=str(item.get("code_snippet") or ""),
        description=str(item.get("description") or ""),
        attack_scenario=str(item.get("attack_scenario") or ""),
        fix_before=str(item.get("fix_before") or ""),
        fix_after=str(item.get("fix_after") or ""),
        fix_explanation=str(item.get("fix_explanation") or ""),
        effort_hours=_as_float(item.get("effort_hours")),
        points_if_fixed=min(points, 20) if points > 0 else None,
    )


async def analyse_code_chunk(chunk: str, file_paths: list[str]) -> list[RawFinding]:
    model = _model(ANALYSIS_SYSTEM, json_mode=True)
    prompt = ANALYSIS_PROMPT + chunk
    for attempt in (1, 2):
        text = await _generate(model, prompt if attempt == 1 else prompt + STRICT_SUFFIX)
        if not text.strip():
            return []
        if _is_refusal(text):
            log.warning("Gemini declined to analyse %s: %s", file_paths, text[:200])
            return []
        try:
            data = _extract_json(text)
        except json.JSONDecodeError:
            log.warning("Gemini returned invalid JSON for %s (attempt %d)", file_paths, attempt)
            continue
        if isinstance(data, dict) and "error" in data and len(data) == 1:
            log.warning("Gemini declined to analyse %s: %s", file_paths, data["error"])
            return []
        if isinstance(data, dict):
            # Accept {"findings": [...]} or a single finding object
            data = data.get("findings", data.get("vulnerabilities", [data]))
        if not isinstance(data, list):
            continue
        return [f for f in (_normalise(item, file_paths) for item in data) if f]
    log.error("Giving up on Gemini analysis for %s after a JSON retry", file_paths)
    return []


async def chat_about_finding(finding: FindingContext, message: str) -> str:
    model = _model(CHAT_SYSTEM, json_mode=False)
    context = (
        "Here is the vulnerability the developer is asking about.\n"
        f"Title: {finding.title}\n"
        f"Severity: {finding.severity}\n"
        f"CWE: {finding.cwe}\n"
        f"File: {finding.file_path}\n"
        f"Description: {finding.description}\n"
    )
    for label, value in finding.extra.items():
        if value:
            context += f"{label}: {value}\n"
    context += f"Code snippet:\n```\n{finding.code_snippet}\n```\n\n"
    prompt = context + f"Developer's question: {message}"
    reply = await _generate(model, prompt)
    return reply.strip() or "Sorry, I couldn't generate an answer for that question. Try rephrasing it."
