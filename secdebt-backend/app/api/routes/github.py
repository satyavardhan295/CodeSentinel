from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models import GitHubConnection
from app.models._types import utcnow
from app.schemas import GitHubConnectionOut, GitHubConnectRequest, GitHubRepoOut
from app.services import github_account

router = APIRouter(prefix="/github", tags=["github"])


def _out(conn: GitHubConnection | None) -> GitHubConnectionOut:
    if conn is None:
        return GitHubConnectionOut(connected=False)
    return GitHubConnectionOut(
        connected=True,
        username=conn.username,
        name=conn.name,
        avatar_url=conn.avatar_url,
        profile_url=conn.profile_url,
        scopes=[s for s in conn.scopes.split(",") if s],
        connected_at=conn.connected_at,
    )


@router.get("/connection", response_model=GitHubConnectionOut)
async def connection_status(session: SessionDep, user: CurrentUser):
    return _out(await session.get(GitHubConnection, user.id))


@router.post("/connection", response_model=GitHubConnectionOut)
async def connect(body: GitHubConnectRequest, session: SessionDep, user: CurrentUser):
    token = body.token.strip()
    gh_user, scopes = await github_account.fetch_user(token)  # raises 401 for a bad token

    conn = await session.get(GitHubConnection, user.id) or GitHubConnection(user_id=user.id)
    conn.token = token
    conn.username = gh_user["login"]
    conn.name = gh_user.get("name")
    conn.avatar_url = gh_user.get("avatar_url")
    conn.profile_url = gh_user.get("html_url")
    conn.scopes = ",".join(scopes)
    conn.connected_at = utcnow()
    session.add(conn)
    await session.commit()
    return _out(conn)


@router.delete("/connection", response_model=GitHubConnectionOut)
async def disconnect(session: SessionDep, user: CurrentUser):
    conn = await session.get(GitHubConnection, user.id)
    if conn is not None:
        await session.delete(conn)
        await session.commit()
    return _out(None)


@router.get("/repos", response_model=list[GitHubRepoOut])
async def repos(session: SessionDep, user: CurrentUser):
    conn = await session.get(GitHubConnection, user.id)
    if conn is None:
        raise HTTPException(400, "Connect your GitHub account in Settings first.")
    try:
        raw = await github_account.list_repos(conn.token)
    except HTTPException as exc:
        if exc.status_code == 401:
            raise HTTPException(
                401, "Your connected GitHub token is no longer valid. Reconnect it in Settings."
            )
        raise
    return [
        GitHubRepoOut(
            full_name=r["full_name"],
            name=r["name"],
            owner=r["owner"]["login"],
            private=r["private"],
            default_branch=r.get("default_branch") or "main",
            html_url=r["html_url"],
            description=r.get("description"),
            updated_at=r.get("updated_at"),
        )
        for r in raw
    ]
