"""GitHub API calls for the account connected in Settings."""

import logging

import httpx
from fastapi import HTTPException

log = logging.getLogger(__name__)

API = "https://api.github.com"
MAX_REPOS = 300  # 3 pages; plenty for a picker


def _headers(token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _raise_for_github(resp: httpx.Response) -> None:
    if resp.status_code == 401:
        raise HTTPException(401, "GitHub rejected this token. Check that it is correct and not expired.")
    if resp.status_code == 403 and resp.headers.get("x-ratelimit-remaining") == "0":
        raise HTTPException(429, "GitHub rate limit reached. Try again in a few minutes.")
    if resp.status_code >= 400:
        raise HTTPException(502, f"GitHub returned an error ({resp.status_code}). Try again later.")


async def fetch_user(token: str) -> tuple[dict, list[str]]:
    """Validate a token. Returns the GitHub user and the token's classic scopes (empty for fine-grained tokens)."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{API}/user", headers=_headers(token))
    except httpx.HTTPError as exc:
        log.warning("GitHub /user request failed: %s", exc)
        raise HTTPException(502, "Couldn't reach GitHub. Check your internet connection.")
    _raise_for_github(resp)
    scopes = [s.strip() for s in resp.headers.get("x-oauth-scopes", "").split(",") if s.strip()]
    return resp.json(), scopes


async def list_repos(token: str) -> list[dict]:
    """Repos the token can access (owned, collaborator, org member), most recently updated first."""
    repos: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            page = 1
            while len(repos) < MAX_REPOS:
                resp = await client.get(
                    f"{API}/user/repos",
                    headers=_headers(token),
                    params={"per_page": 100, "page": page, "sort": "updated"},
                )
                _raise_for_github(resp)
                batch = resp.json()
                repos.extend(batch)
                if len(batch) < 100:
                    break
                page += 1
    except httpx.HTTPError as exc:
        log.warning("GitHub /user/repos request failed: %s", exc)
        raise HTTPException(502, "Couldn't reach GitHub. Check your internet connection.")
    return repos[:MAX_REPOS]
