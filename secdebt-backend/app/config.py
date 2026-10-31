from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # utf-8-sig tolerates the BOM that Windows editors like to add
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8-sig", extra="ignore"
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    database_url: str = "sqlite+aiosqlite:///./codesentinel.db"
    frontend_origin: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    repo_dir: str = "repos"
    max_file_size_mb: int = 50
    max_repo_size_mb: int = 200
    code_extensions: str = (
        ".js,.ts,.jsx,.tsx,.py,.java,.go,.rb,.php,.cs,.cpp,.c,.h,"
        ".env,.yml,.yaml,.json,.toml,.tf"
    )

    # Built frontend (`npm run build` output). Served at / when the folder exists.
    frontend_dist: str = str(BASE_DIR.parent / "dist")
    # Set to false to stop new sign-ups (existing accounts can still sign in)
    allow_signups: bool = True
    # How long a sign-in lasts
    session_days: int = 30

    @property
    def allowed_origins(self) -> list[str]:
        """FRONTEND_ORIGIN may list several origins, comma-separated."""
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def frontend_dist_path(self) -> Path:
        return _resolve(self.frontend_dist)

    @property
    def code_extension_set(self) -> set[str]:
        return {e.strip().lower() for e in self.code_extensions.split(",") if e.strip()}

    @property
    def upload_path(self) -> Path:
        return _resolve(self.upload_dir)

    @property
    def repo_path(self) -> Path:
        return _resolve(self.repo_dir)


def _resolve(p: str) -> Path:
    path = Path(p)
    return path if path.is_absolute() else BASE_DIR / path


settings = Settings()
