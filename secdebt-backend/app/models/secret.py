import enum

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._types import new_id, str_enum


class SecretSeverity(str, enum.Enum):
    Critical = "Critical"
    High = "High"


class SecretFinding(Base):
    __tablename__ = "secret_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(128))
    file_path: Mapped[str] = mapped_column(String(1024))
    line: Mapped[int] = mapped_column(Integer)
    masked_value: Mapped[str] = mapped_column(String(255))
    severity: Mapped[SecretSeverity] = mapped_column(str_enum(SecretSeverity))
    rotate_url: Mapped[str] = mapped_column(String(512), default="")
