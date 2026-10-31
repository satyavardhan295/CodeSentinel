"""Background scan pipeline: secrets → dependencies → config → AI analysis → score."""

import asyncio
import logging
import time
from collections import Counter

from app.database import SessionLocal
from app.models import (
    ConfigurationIssue,
    DependencyIssue,
    Finding,
    Scan,
    ScanSource,
    ScanStatus,
    SecretFinding,
    SecretSeverity,
    Severity,
)
from app.services import config_scanner, dep_scanner, gemini, scorer, secret_scanner
from app.services.file_handler import CodeFile, cleanup_upload
from app.services.github import cleanup_repo

log = logging.getLogger(__name__)

AI_CONCURRENCY = 2  # parallel Gemini calls; free-tier keys allow only a few requests/minute
AI_PCT_START, AI_PCT_END = 55, 88
NON_LANGUAGES = {"JSON", "YAML", "TOML", "Env", "Other"}


async def _update(scan_id: str, **fields) -> None:
    async with SessionLocal() as session:
        scan = await session.get(Scan, scan_id)
        if scan is None:
            return
        for k, v in fields.items():
            setattr(scan, k, v)
        await session.commit()


async def _save(rows: list) -> None:
    if not rows:
        return
    async with SessionLocal() as session:
        session.add_all(rows)
        await session.commit()


def _languages(files: list[CodeFile]) -> list[str]:
    counts = Counter(f.language for f in files if f.language not in NON_LANGUAGES)
    return [lang for lang, _ in counts.most_common()]


def _lines_of_code(files: list[CodeFile]) -> int:
    return sum(1 for f in files for line in f.content.splitlines() if line.strip())


async def _run_ai_analysis(scan_id: str, files: list[CodeFile]) -> list[gemini.RawFinding]:
    chunks = gemini.build_chunks(files)
    if not chunks:
        return []
    log.info("Scan %s: AI analysis over %d chunk(s)", scan_id, len(chunks))

    sem = asyncio.Semaphore(AI_CONCURRENCY)
    done = 0
    errors: list[Exception] = []
    lock = asyncio.Lock()

    async def run(chunk: str, paths: list[str]) -> list[gemini.RawFinding]:
        nonlocal done
        async with sem:
            try:
                found = await gemini.analyse_code_chunk(chunk, paths)
            except gemini.GeminiError:
                raise  # bad key / unknown model: no point continuing
            except Exception as exc:
                log.exception("Gemini batch failed for %s", paths)
                errors.append(exc)
                found = []
        async with lock:
            done += 1
            pct = AI_PCT_START + int((AI_PCT_END - AI_PCT_START) * done / len(chunks))
            await _update(
                scan_id,
                progress_pct=pct,
                progress_step=f"Running AI analysis ({done}/{len(chunks)} batches)",
            )
        return found

    results = await asyncio.gather(*(run(c, p) for c, p in chunks))
    if errors and len(errors) == len(chunks):
        raise RuntimeError(f"AI analysis failed for every batch: {errors[-1]}")
    return [f for batch in results for f in batch]


async def run_scan(
    scan_id: str, files: list[CodeFile], scan_types: list[str], source: str = ScanSource.upload.value
) -> None:
    started = time.monotonic()
    try:
        await _update(
            scan_id,
            status=ScanStatus.scanning,
            progress_step="Parsing files",
            progress_pct=10,
            lines_of_code=_lines_of_code(files),
            languages=_languages(files),
        )

        if "secrets" in scan_types:
            await _update(scan_id, progress_step="Scanning for secrets", progress_pct=25)
            secrets = await asyncio.to_thread(secret_scanner.scan_for_secrets, files)
            await _save(
                [
                    SecretFinding(scan_id=scan_id, **{**vars(s), "severity": SecretSeverity(s.severity)})
                    for s in secrets
                ]
            )

        if "dependencies" in scan_types:
            await _update(scan_id, progress_step="Checking dependencies", progress_pct=40)
            deps = await dep_scanner.scan_dependencies(files)
            await _save([DependencyIssue(scan_id=scan_id, **vars(d)) for d in deps])

        if "config" in scan_types:
            await _update(scan_id, progress_step="Checking configuration", progress_pct=50)
            configs = config_scanner.scan_configurations(files)
            await _save([ConfigurationIssue(scan_id=scan_id, **vars(c)) for c in configs])

        raw_findings: list[gemini.RawFinding] = []
        if "code" in scan_types or "ai-code" in scan_types:
            await _update(scan_id, progress_step="Running AI analysis", progress_pct=AI_PCT_START)
            raw_findings = await _run_ai_analysis(scan_id, files)
            await _save(
                [
                    Finding(
                        scan_id=scan_id,
                        title=f.title,
                        severity=Severity(f.severity),
                        category=f.category,
                        cwe=f.cwe,
                        owasp=f.owasp,
                        file_path=f.file_path,
                        line_start=f.line_start,
                        line_end=f.line_end,
                        code_snippet=f.code_snippet,
                        description=f.description,
                        attack_scenario=f.attack_scenario,
                        fix_before=f.fix_before,
                        fix_after=f.fix_after,
                        fix_explanation=f.fix_explanation,
                        effort_hours=f.effort_hours,
                        points_if_fixed=scorer.points_if_fixed(f.severity, f.points_if_fixed),
                    )
                    for f in raw_findings
                ]
            )

        await _update(scan_id, progress_step="Calculating score", progress_pct=90)
        result = scorer.calculate_score(raw_findings)
        await _update(
            scan_id,
            status=ScanStatus.complete,
            score=result.score,
            grade=result.grade,
            debt_hours=result.debt_hours,
            risk_level=result.risk_level,
            duration_seconds=int(time.monotonic() - started),
            progress_step="Complete",
            progress_pct=100,
        )
        log.info("Scan %s complete: score %d (%s)", scan_id, result.score, result.grade)
    except Exception as exc:
        log.exception("Scan %s failed", scan_id)
        try:
            await _update(
                scan_id,
                status=ScanStatus.failed,
                error_message=str(exc) or type(exc).__name__,
                progress_step="Failed",
                duration_seconds=int(time.monotonic() - started),
            )
        except Exception:
            log.exception("Could not record failure for scan %s", scan_id)
    finally:
        try:
            if source == ScanSource.github.value:
                await asyncio.to_thread(cleanup_repo, scan_id)
            else:
                await asyncio.to_thread(cleanup_upload, scan_id)
        except Exception:
            log.exception("Cleanup failed for scan %s", scan_id)
