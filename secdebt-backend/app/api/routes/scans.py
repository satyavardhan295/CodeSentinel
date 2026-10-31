import asyncio
import json
import os
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ConfigurationIssue,
    DependencyIssue,
    Finding,
    GitHubConnection,
    Scan,
    ScanSource,
    ScanStatus,
    SecretFinding,
)
from app.schemas import (
    ConfigurationIssueOut,
    DependencyIssueOut,
    FindingOut,
    ReportOut,
    ScanCreated,
    ScanOut,
    SecretFindingOut,
)
from app.services import file_handler, github
from app.services.data import delete_scans
from app.services.scanner import run_scan

router = APIRouter(tags=["scans"])

VALID_SCAN_TYPES = {"code", "secrets", "dependencies", "config", "ai-code"}
DEFAULT_SCAN_TYPES = ["code", "secrets", "dependencies", "config"]


def _parse_scan_types(raw: str | None) -> list[str]:
    if not raw:
        return DEFAULT_SCAN_TYPES
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        # Tolerate "code,secrets" and shells that strip the quotes: [code,secrets]
        value = [s.strip(" '\"") for s in raw.strip().strip("[]").split(",") if s.strip(" '\"")]
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise HTTPException(400, "scan_types must be a JSON array of strings")
    unknown = set(value) - VALID_SCAN_TYPES
    if unknown:
        raise HTTPException(
            400, f"Unknown scan type(s): {', '.join(sorted(unknown))}. "
            f"Valid types: {', '.join(sorted(VALID_SCAN_TYPES))}"
        )
    if not value:
        raise HTTPException(400, "Select at least one scan type")
    return value


async def _get_scan(session: AsyncSession, scan_id: str, user_id: str) -> Scan:
    scan = await session.get(Scan, scan_id)
    # Other users' scans look exactly like missing ones
    if scan is None or scan.user_id != user_id:
        raise HTTPException(404, "Scan not found")
    return scan


@router.post("/scans", response_model=ScanCreated)
async def create_scan(
    background: BackgroundTasks,
    session: SessionDep,
    user: CurrentUser,
    source: Annotated[str, Form()],
    repo_url: Annotated[str | None, Form()] = None,
    branch: Annotated[str, Form()] = "main",
    token: Annotated[str | None, Form()] = None,
    scan_types: Annotated[str | None, Form()] = None,
    files: Annotated[list[UploadFile] | None, File()] = None,
):
    if source not in ("upload", "github"):
        raise HTTPException(400, "source must be 'upload' or 'github'")
    types = _parse_scan_types(scan_types)
    branch = (branch or "main").strip() or "main"
    token = (token or "").strip() or None

    # Fall back to the GitHub account connected in Settings (gives private repo access)
    using_saved_token = False
    if source == "github" and token is None:
        conn = await session.get(GitHubConnection, user.id)
        if conn is not None:
            token, using_saved_token = conn.token, True

    if source == "github":
        if not repo_url:
            raise HTTPException(400, "repo_url is required when source is 'github'")
        owner, repo_name = github.parse_github_url(repo_url)
        repo_key = f"github:{owner}/{repo_name}".lower()
    else:
        if not files:
            raise HTTPException(400, "Upload at least one file or ZIP archive")
        first = (files[0].filename or "upload").replace("\\", "/")
        top = first.split("/")[0] if "/" in first else os.path.splitext(first)[0]
        repo_name = top or "uploaded-archive"
        repo_key = f"upload:{repo_name}".lower()

    scan = Scan(
        user_id=user.id,
        repo_name=repo_name,
        repo_key=repo_key,
        source=ScanSource(source),
        branch=branch,
        status=ScanStatus.queued,
        progress_step="Queued",
        languages=[],
    )
    session.add(scan)
    await session.commit()

    # Fetch the code up front (still inside the request) so bad URLs, auth
    # failures and oversize uploads come back as immediate, readable errors.
    try:
        if source == "github":
            code_files = await asyncio.to_thread(github.fetch_repo, repo_url, branch, token, scan.id)
        else:
            code_files = await file_handler.extract_upload(files, scan.id)
    except Exception as exc:
        # The caller gets the error directly; don't leave a dead scan in history
        await session.delete(scan)
        await session.commit()
        cleanup = github.cleanup_repo if source == "github" else file_handler.cleanup_upload
        await asyncio.to_thread(cleanup, scan.id)
        if using_saved_token and isinstance(exc, HTTPException) and exc.status_code == 401:
            raise HTTPException(
                401, "Your connected GitHub token is no longer valid. Reconnect it in Settings."
            )
        raise

    background.add_task(run_scan, scan.id, code_files, types, source)
    return ScanCreated(scan_id=scan.id)


@router.get("/scans", response_model=list[ScanOut])
async def list_scans(session: SessionDep, user: CurrentUser):
    result = await session.execute(
        select(Scan).where(Scan.user_id == user.id).order_by(Scan.started_at.desc())
    )
    return [ScanOut.model_validate(s) for s in result.scalars()]


@router.delete("/scans/{scan_id}", status_code=204)
async def delete_scan(scan_id: str, session: SessionDep, user: CurrentUser):
    scan = await _get_scan(session, scan_id, user.id)
    if scan.status in (ScanStatus.queued, ScanStatus.scanning):
        raise HTTPException(409, "This scan is still running. Wait for it to finish before deleting it.")
    await delete_scans(session, [scan_id])
    await session.commit()
    return Response(status_code=204)


@router.get("/scans/{scan_id}/status", response_model=ScanOut)
async def scan_status(scan_id: str, session: SessionDep, user: CurrentUser):
    return ScanOut.model_validate(await _get_scan(session, scan_id, user.id))


@router.get("/scans/{scan_id}/report", response_model=ReportOut)
async def scan_report(scan_id: str, session: SessionDep, user: CurrentUser):
    scan = await _get_scan(session, scan_id, user.id)
    if scan.status == ScanStatus.failed:
        raise HTTPException(400, f"Scan failed: {scan.error_message or 'unknown error'}")
    if scan.status != ScanStatus.complete:
        raise HTTPException(400, "Scan is not complete yet")

    async def rows(model):
        result = await session.execute(select(model).where(model.scan_id == scan_id))
        return list(result.scalars())

    severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    findings = sorted(await rows(Finding), key=lambda f: (severity_order[f.severity.value], f.file_path))
    return ReportOut(
        scan=ScanOut.model_validate(scan),
        findings=[FindingOut.from_orm_finding(f) for f in findings],
        dependencies=[DependencyIssueOut.model_validate(d) for d in await rows(DependencyIssue)],
        secrets=[SecretFindingOut.model_validate(s) for s in await rows(SecretFinding)],
        configurations=[ConfigurationIssueOut.model_validate(c) for c in await rows(ConfigurationIssue)],
    )
