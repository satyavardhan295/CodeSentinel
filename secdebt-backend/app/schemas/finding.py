from typing import Literal

from pydantic import Field

from app.models.finding import Finding
from app.schemas.base import CamelModel, UtcDatetime

FindingStatusLiteral = Literal["Open", "In progress", "Fixed", "Ignored"]


class AiFix(CamelModel):
    before: str
    after: str
    explanation: str


class FindingOut(CamelModel):
    id: str
    scan_id: str
    title: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    category: str
    cwe: str
    owasp: str
    file_path: str
    line_start: int
    line_end: int
    code_snippet: str
    description: str
    attack_scenario: str
    ai_fix: AiFix
    points_gained_if_fixed: int
    status: FindingStatusLiteral
    detected_at: UtcDatetime
    notes: str

    @classmethod
    def from_orm_finding(cls, f: Finding) -> "FindingOut":
        return cls(
            id=f.id,
            scan_id=f.scan_id,
            title=f.title,
            severity=f.severity.value,
            category=f.category,
            cwe=f.cwe,
            owasp=f.owasp,
            file_path=f.file_path,
            line_start=f.line_start,
            line_end=f.line_end,
            code_snippet=f.code_snippet,
            description=f.description,
            attack_scenario=f.attack_scenario,
            ai_fix=AiFix(
                before=f.fix_before, after=f.fix_after, explanation=f.fix_explanation
            ),
            points_gained_if_fixed=f.points_if_fixed,
            status=f.status.value,
            detected_at=f.detected_at,
            notes=f.notes or "",
        )


class FindingUpdate(CamelModel):
    status: FindingStatusLiteral | None = None
    notes: str | None = None


class ChatRequest(CamelModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatReply(CamelModel):
    reply: str
