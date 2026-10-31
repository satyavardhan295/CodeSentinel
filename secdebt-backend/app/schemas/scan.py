from typing import Annotated, Literal

from pydantic import BeforeValidator

from app.schemas.base import CamelModel, UtcDatetime, enum_value
from app.schemas.config_issue import ConfigurationIssueOut
from app.schemas.dependency import DependencyIssueOut
from app.schemas.finding import FindingOut
from app.schemas.secret import SecretFindingOut


class ScanOut(CamelModel):
    id: str
    repo_name: str
    repo_key: str | None = None
    source: Annotated[Literal["upload", "github"], BeforeValidator(enum_value)]
    branch: str
    status: Annotated[
        Literal["queued", "scanning", "complete", "failed"], BeforeValidator(enum_value)
    ]
    score: int | None = None
    grade: str | None = None
    risk_level: str | None = None
    started_at: UtcDatetime
    duration_seconds: int | None = None
    lines_of_code: int | None = None
    languages: list[str] = []
    progress_step: str | None = None
    progress_pct: int = 0
    error_message: str | None = None


class ScanCreated(CamelModel):
    scan_id: str


class ReportOut(CamelModel):
    scan: ScanOut
    findings: list[FindingOut]
    dependencies: list[DependencyIssueOut]
    secrets: list[SecretFindingOut]
    configurations: list[ConfigurationIssueOut]
