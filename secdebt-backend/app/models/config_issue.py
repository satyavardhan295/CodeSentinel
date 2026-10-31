from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._types import new_id


class ConfigurationIssue(Base):
    """Misconfiguration found by rule-based checks (the frontend's "Configurations" tab)."""

    __tablename__ = "configuration_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    issue: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(1024))
    rule: Mapped[str] = mapped_column(String(128))
    severity: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="Open")
