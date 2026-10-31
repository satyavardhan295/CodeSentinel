import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.models import ConfigurationIssue, Finding, FindingStatus, Scan
from app.schemas import (
    ChatReply,
    ChatRequest,
    ConfigurationIssueOut,
    ConfigurationIssueUpdate,
    FindingOut,
    FindingUpdate,
)
from app.services import gemini

log = logging.getLogger(__name__)
router = APIRouter(tags=["findings"])


async def _get_finding(session: AsyncSession, finding_id: str, user_id: str) -> Finding:
    finding = await session.get(Finding, finding_id)
    scan = await session.get(Scan, finding.scan_id) if finding else None
    if finding is None or scan is None or scan.user_id != user_id:
        raise HTTPException(404, "Finding not found")
    return finding


@router.patch("/findings/{finding_id}", response_model=FindingOut)
async def update_finding(finding_id: str, patch: FindingUpdate, session: SessionDep, user: CurrentUser):
    finding = await _get_finding(session, finding_id, user.id)
    if patch.status is not None:
        finding.status = FindingStatus(patch.status)
    if patch.notes is not None:
        finding.notes = patch.notes
    await session.commit()
    return FindingOut.from_orm_finding(finding)


@router.patch("/configurations/{configuration_id}", response_model=ConfigurationIssueOut)
async def update_configuration(
    configuration_id: str, patch: ConfigurationIssueUpdate, session: SessionDep, user: CurrentUser
):
    issue = await session.get(ConfigurationIssue, configuration_id)
    scan = await session.get(Scan, issue.scan_id) if issue else None
    # Other users' issues look exactly like missing ones
    if issue is None or scan is None or scan.user_id != user.id:
        raise HTTPException(404, "Configuration issue not found")
    issue.status = patch.status
    await session.commit()
    return ConfigurationIssueOut.model_validate(issue)


@router.post("/findings/{finding_id}/chat", response_model=ChatReply)
async def chat_about_finding(finding_id: str, body: ChatRequest, session: SessionDep, user: CurrentUser):
    f = await _get_finding(session, finding_id, user.id)
    context = gemini.FindingContext(
        title=f.title,
        severity=f.severity.value,
        cwe=f.cwe,
        file_path=f"{f.file_path} (lines {f.line_start}-{f.line_end})",
        code_snippet=f.code_snippet,
        description=f.description,
        extra={
            "Category": f.category,
            "OWASP": f.owasp,
            "Attack scenario": f.attack_scenario,
            "Suggested fix": f.fix_after,
        },
    )
    try:
        reply = await gemini.chat_about_finding(context, body.message)
    except gemini.GeminiError as exc:
        raise HTTPException(502, str(exc))
    except Exception:
        log.exception("Gemini chat failed for finding %s", finding_id)
        raise HTTPException(502, "The AI assistant is unavailable right now. Please try again.")
    return ChatReply(reply=reply)
