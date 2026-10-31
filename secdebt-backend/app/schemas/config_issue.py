from typing import Literal

from app.schemas.base import CamelModel


class ConfigurationIssueOut(CamelModel):
    id: str
    scan_id: str
    issue: str
    file_path: str
    rule: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    status: Literal["Open", "Fixed", "Ignored"]


class ConfigurationIssueUpdate(CamelModel):
    status: Literal["Open", "Fixed", "Ignored"]
