from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._types import new_id


class DependencyIssue(Base):
    __tablename__ = "dependency_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    package: Mapped[str] = mapped_column(String(255))
    current_version: Mapped[str] = mapped_column(String(64))
    fixed_version: Mapped[str] = mapped_column(String(64))
    cve: Mapped[str] = mapped_column(String(128))
    severity: Mapped[str] = mapped_column(String(16))
    description: Mapped[str] = mapped_column(Text, default="")
