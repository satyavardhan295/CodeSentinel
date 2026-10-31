import enum
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._types import new_id, str_enum, utcnow


class Severity(str, enum.Enum):
    Critical = "Critical"
    High = "High"
    Medium = "Medium"
    Low = "Low"


class FindingStatus(str, enum.Enum):
    Open = "Open"
    InProgress = "In progress"
    Fixed = "Fixed"
    Ignored = "Ignored"


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    severity: Mapped[Severity] = mapped_column(str_enum(Severity))
    category: Mapped[str] = mapped_column(String(255), default="")
    cwe: Mapped[str] = mapped_column(String(64), default="")
    owasp: Mapped[str] = mapped_column(String(64), default="")
    file_path: Mapped[str] = mapped_column(String(1024), default="")
    line_start: Mapped[int] = mapped_column(Integer, default=0)
    line_end: Mapped[int] = mapped_column(Integer, default=0)
    code_snippet: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    attack_scenario: Mapped[str] = mapped_column(Text, default="")
    fix_before: Mapped[str] = mapped_column(Text, default="")
    fix_after: Mapped[str] = mapped_column(Text, default="")
    fix_explanation: Mapped[str] = mapped_column(Text, default="")
    effort_hours: Mapped[float] = mapped_column(Float, default=0.0)
    points_if_fixed: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[FindingStatus] = mapped_column(
        str_enum(FindingStatus), default=FindingStatus.Open
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str] = mapped_column(Text, default="")

    scan = relationship("Scan", back_populates="findings")
