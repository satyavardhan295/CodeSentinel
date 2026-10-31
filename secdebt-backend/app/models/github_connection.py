from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._types import utcnow


class GitHubConnection(Base):
    """A user's GitHub account, connected in Settings via a personal access token.

    The token is never returned by the API. It is stored in plain text in the
    database, so protect the database file like the .env file.
    """

    __tablename__ = "github_connection"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    token: Mapped[str] = mapped_column(String(512))
    username: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    profile_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    scopes: Mapped[str] = mapped_column(String(512), default="")
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
