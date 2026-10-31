from pydantic import Field

from app.schemas.base import CamelModel, UtcDatetime


class GitHubConnectRequest(CamelModel):
    token: str = Field(min_length=1, max_length=512)


class GitHubConnectionOut(CamelModel):
    connected: bool
    username: str | None = None
    name: str | None = None
    avatar_url: str | None = None
    profile_url: str | None = None
    scopes: list[str] = []
    connected_at: UtcDatetime | None = None


class GitHubRepoOut(CamelModel):
    full_name: str
    name: str
    owner: str
    private: bool
    default_branch: str
    html_url: str
    description: str | None = None
    updated_at: str | None = None
