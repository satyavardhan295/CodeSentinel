import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._types import new_id, str_enum, utcnow


class ScanSource(str, enum.Enum):
    upload = "upload"
    github = "github"


class ScanStatus(str, enum.Enum):
    queued = "queued"
    scanning = "scanning"
    complete = "complete"
    failed = "failed"


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    # Owner. Nullable only for scans created before accounts existed.
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    repo_name: Mapped[str] = mapped_column(String(255))
    # Stable identity of the scanned repository ("github:owner/repo" or "upload:name"),
    # so history only compares scans of the same code base
    repo_key: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    source: Mapped[ScanSource] = mapped_column(str_enum(ScanSource))
    branch: Mapped[str] = mapped_column(String(255), default="main")
    status: Mapped[ScanStatus] = mapped_column(str_enum(ScanStatus), default=ScanStatus.queued)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    grade: Mapped[str | None] = mapped_column(String(1), nullable=True)
    debt_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lines_of_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    languages: Mapped[list[str]] = mapped_column(JSON, default=list)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    progress_step: Mapped[str | None] = mapped_column(String(255), nullable=True)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)

    findings = relationship("Finding", cascade="all, delete-orphan", back_populates="scan")
    dependencies = relationship("DependencyIssue", cascade="all, delete-orphan")
    secrets = relationship("SecretFinding", cascade="all, delete-orphan")
    configurations = relationship("ConfigurationIssue", cascade="all, delete-orphan")
