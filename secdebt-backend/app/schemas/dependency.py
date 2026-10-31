from app.schemas.base import CamelModel


class DependencyIssueOut(CamelModel):
    id: str
    scan_id: str
    package: str
    current_version: str
    fixed_version: str
    cve: str
    severity: str
    description: str
