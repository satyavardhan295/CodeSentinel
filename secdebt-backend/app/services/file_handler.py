import logging
import os
import shutil
import stat
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

import aiofiles
from fastapi import HTTPException, UploadFile

from app.config import settings

log = logging.getLogger(__name__)

SKIP_DIRS = {"node_modules", ".git", "__pycache__", "dist", "build", ".venv", "venv"}
MAX_SINGLE_FILE_BYTES = 2 * 1024 * 1024  # skip giant generated/minified files

LANGUAGE_BY_EXT = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".py": "Python",
    ".java": "Java",
    ".go": "Go",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C",
    ".env": "Env",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".json": "JSON",
    ".toml": "TOML",
    ".tf": "Terraform",
}


@dataclass
class CodeFile:
    path: str  # relative path for display
    content: str  # full text content
    language: str  # inferred from extension


def file_extension(name: str) -> str:
    """Extension used for filtering. Dotfiles like `.env` / `.env.local` count as `.env`."""
    lower = name.lower()
    if lower == ".env" or lower.startswith(".env."):
        return ".env"
    return os.path.splitext(lower)[1]


def language_for(name: str) -> str:
    return LANGUAGE_BY_EXT.get(file_extension(name), "Other")


def collect_code_files(root: Path) -> list[CodeFile]:
    """Walk `root` and return text files whose extension is in CODE_EXTENSIONS."""
    allowed = settings.code_extension_set
    files: list[CodeFile] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if file_extension(name) not in allowed:
                continue
            full = Path(dirpath) / name
            try:
                if full.is_symlink() or full.stat().st_size > MAX_SINGLE_FILE_BYTES:
                    continue
                raw = full.read_bytes()
            except OSError:
                continue
            if b"\x00" in raw[:8192]:  # binary
                continue
            rel = full.relative_to(root).as_posix()
            files.append(
                CodeFile(path=rel, content=raw.decode("utf-8", errors="replace"), language=language_for(name))
            )
    files.sort(key=lambda f: f.path)
    return files


def _limit_bytes() -> int:
    return settings.max_file_size_mb * 1024 * 1024


def _too_large() -> HTTPException:
    return HTTPException(413, f"Upload exceeds the {settings.max_file_size_mb} MB limit")


def _safe_extract_zip(zip_path: Path, dest: Path, budget: int) -> int:
    """Extract a ZIP, guarding against path traversal and zip bombs. Returns bytes written."""
    written = 0
    dest_resolved = dest.resolve()
    try:
        with zipfile.ZipFile(zip_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                target = (dest / info.filename).resolve()
                if not target.is_relative_to(dest_resolved):
                    log.warning("Skipping unsafe zip entry %s", info.filename)
                    continue
                written += info.file_size
                if written > budget:
                    raise _too_large()
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
    except zipfile.BadZipFile:
        raise HTTPException(400, f"'{zip_path.name}' is not a valid ZIP archive")
    return written


async def extract_upload(files: list[UploadFile], scan_id: str) -> list[CodeFile]:
    root = settings.upload_path / scan_id
    root.mkdir(parents=True, exist_ok=True)
    limit = _limit_bytes()
    total = 0

    for upload in files:
        # Keep folder structure from directory uploads, but never escape `root`
        name = PurePosixPath((upload.filename or "upload").replace("\\", "/"))
        parts = [p for p in name.parts if p not in ("", ".", "..", "/")]
        if not parts:
            parts = ["upload"]
        dest = root.joinpath(*parts)
        dest.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(dest, "wb") as out:
            while chunk := await upload.read(1024 * 1024):
                total += len(chunk)
                if total > limit:
                    raise _too_large()
                await out.write(chunk)

        if dest.suffix.lower() == ".zip":
            # Extract next to the archive so paths read like the project tree
            total += _safe_extract_zip(dest, dest.parent, limit - total)
            dest.unlink(missing_ok=True)

    code_files = collect_code_files(root)
    if not code_files:
        raise HTTPException(400, "No code files found in the uploaded content")
    return code_files


def _force_remove(func, path, _exc):
    # Git pack files are read-only on Windows; clear the flag and retry
    os.chmod(path, stat.S_IWRITE)
    func(path)


def remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path, onerror=_force_remove)


def cleanup_upload(scan_id: str) -> None:
    remove_tree(settings.upload_path / scan_id)
