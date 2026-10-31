import logging
import os
import re
import shutil
from pathlib import Path

# Find Git for Windows even if it was installed after this shell's PATH was set,
# and don't crash at import when git is missing (only GitHub scans need it).
_WIN_GIT = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "cmd" / "git.exe"
if shutil.which("git") is None and _WIN_GIT.exists():
    os.environ.setdefault("GIT_PYTHON_GIT_EXECUTABLE", str(_WIN_GIT))
os.environ.setdefault("GIT_PYTHON_REFRESH", "quiet")

import git  # noqa: E402
import httpx  # noqa: E402
from fastapi import HTTPException

from app.config import settings
from app.services.file_handler import CodeFile, collect_code_files, remove_tree

log = logging.getLogger(__name__)

GITHUB_URL_RE = re.compile(
    r"^https?://(?:www\.)?github\.com/(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?/?$"
)


def parse_github_url(repo_url: str) -> tuple[str, str]:
    m = GITHUB_URL_RE.match((repo_url or "").strip())
    if not m:
        raise HTTPException(
            400, "Invalid GitHub URL. Use the form https://github.com/owner/repo"
        )
    return m.group("owner"), m.group("repo")


def _scrub(text: str, token: str | None) -> str:
    return text.replace(token, "***") if token else text


def _check_repo_metadata(owner: str, repo: str, token: str | None) -> str | None:
    """Use the GitHub API for fast, clear errors (auth/404/size) before cloning.

    Returns the repo's default branch when known. Unauthenticated calls are rate
    limited (60/hour); if we get rate limited we skip the pre-check and let the
    clone itself report problems.
    """
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = httpx.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers, timeout=15)
    except httpx.HTTPError as exc:
        log.warning("GitHub API pre-check failed: %s", exc)
        return None

    if resp.status_code == 401:
        raise HTTPException(401, "GitHub authentication failed. Check your access token.")
    if resp.status_code == 404:
        if token:
            raise HTTPException(
                404, "Repository not found, or your token does not have access to it."
            )
        raise HTTPException(
            404,
            "Repository not found. If it is private, connect your GitHub account in Settings.",
        )
    if resp.status_code != 200:
        return None
    meta = resp.json()
    size_mb = meta.get("size", 0) / 1024  # API reports KB
    if size_mb > settings.max_repo_size_mb:
        raise HTTPException(
            413,
            f"Repository is {size_mb:.0f} MB, which exceeds the "
            f"{settings.max_repo_size_mb} MB limit",
        )
    return meta.get("default_branch")


def _dir_size(path: Path) -> int:
    total = 0
    for dirpath, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(dirpath, f))
            except OSError:
                pass
    return total


def fetch_repo(repo_url: str, branch: str, token: str | None, scan_id: str) -> list[CodeFile]:
    """Shallow-clone a GitHub repo into repos/<scan_id>/ and return its code files.

    Blocking (network + disk) — call it via a thread from async code.
    """
    owner, repo = parse_github_url(repo_url)
    default_branch = _check_repo_metadata(owner, repo, token)
    # The UI defaults to "main"; fall back to the real default for master-based repos
    if branch == "main" and default_branch and default_branch != "main":
        log.info("Branch 'main' requested; using default branch '%s'", default_branch)
        branch = default_branch

    dest = settings.repo_path / scan_id
    remove_tree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    clone_url = (
        f"https://{token}@github.com/{owner}/{repo}.git"
        if token
        else f"https://github.com/{owner}/{repo}.git"
    )
    env = {
        "GIT_TERMINAL_PROMPT": "0",  # never hang waiting for a password
        "GCM_INTERACTIVE": "never",  # no Git Credential Manager pop-ups
        # Equivalent of `-c credential.helper=` (GitPython rejects -c as unsafe):
        # don't consult or store the machine's saved credentials
        "GIT_CONFIG_COUNT": "1",
        "GIT_CONFIG_KEY_0": "credential.helper",
        "GIT_CONFIG_VALUE_0": "",
    }
    try:
        git.Repo.clone_from(
            clone_url,
            dest,
            branch=branch or None,
            depth=1,
            single_branch=True,
            env=env,
        )
    except git.exc.GitCommandNotFound:
        raise HTTPException(500, "git is not installed on the server")
    except git.GitCommandError as exc:
        remove_tree(dest)
        stderr = _scrub(str(exc.stderr or exc), token).lower()
        log.warning("git clone failed: %s", stderr)
        if "authentication failed" in stderr or "could not read username" in stderr:
            if token:
                raise HTTPException(401, "GitHub authentication failed. Check your access token.")
            # Without a token GitHub asks for credentials for missing *and* private repos
            raise HTTPException(
                404,
                f"Repository {owner}/{repo} was not found. If it is private, "
                "connect your GitHub account in Settings.",
            )
        if "remote branch" in stderr and "not found" in stderr:
            raise HTTPException(404, f"Branch '{branch}' was not found in {owner}/{repo}")
        if "not found" in stderr or "does not exist" in stderr:
            raise HTTPException(404, f"Repository {owner}/{repo} was not found")
        raise HTTPException(502, "Failed to clone the repository from GitHub")

    if _dir_size(dest) > settings.max_repo_size_mb * 1024 * 1024:
        remove_tree(dest)
        raise HTTPException(
            413, f"Repository exceeds the {settings.max_repo_size_mb} MB limit"
        )

    files = collect_code_files(dest)
    if not files:
        remove_tree(dest)
        raise HTTPException(400, "No code files found in the repository")
    return files


def cleanup_repo(scan_id: str) -> None:
    remove_tree(settings.repo_path / scan_id)
