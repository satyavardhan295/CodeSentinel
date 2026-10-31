import logging
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings

# google-generativeai prints a deprecation banner on import; it's documented in the README
warnings.filterwarnings("ignore", message=r"(?s).*google\.generativeai", category=FutureWarning)

from app.api.routes import auth, findings, github, scans  # noqa: E402
from app.database import create_all_tables  # noqa: E402

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("codesentinel")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.repo_path.mkdir(parents=True, exist_ok=True)
    await create_all_tables()
    if not settings.gemini_api_key:
        log.warning("GEMINI_API_KEY is not set; AI analysis and chat will fail")
    if settings.allow_signups:
        log.info("Sign-ups are open (set ALLOW_SIGNUPS=false to close them)")
    if (settings.frontend_dist_path / "index.html").exists():
        log.info("Serving the frontend from %s", settings.frontend_dist_path)
    yield


app = FastAPI(title="CodeSentinel API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")  # no clickjacking via iframes
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")  # private per-user data
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )
    # This handler runs outside CORSMiddleware, so without these headers the
    # browser hides the 500 from the frontend as a generic network error
    origin = request.headers.get("origin", "").rstrip("/")
    if origin in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


app.include_router(auth.router, prefix="/api")
app.include_router(scans.router, prefix="/api")
app.include_router(findings.router, prefix="/api")
app.include_router(github.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Frontend (single-page app) ───────────────────────────────────
# Registered last so it never shadows the API. Any non-API path that isn't a
# real file gets index.html, letting React Router handle /dashboard etc.
@app.get("/{full_path:path}", include_in_schema=False)
async def frontend(full_path: str):
    if full_path == "api" or full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    dist = settings.frontend_dist_path.resolve()
    index = dist / "index.html"
    if not index.exists():
        return JSONResponse(
            {"detail": "Frontend not built. Run `npm run build` in the project root, or use `npm run dev`."},
            status_code=404,
        )

    candidate = (dist / full_path).resolve()
    if full_path and candidate.is_file() and candidate.is_relative_to(dist):
        # Hashed build assets never change, so let browsers cache them
        cache = "public, max-age=31536000, immutable" if full_path.startswith("assets/") else "no-cache"
        return FileResponse(candidate, headers={"Cache-Control": cache})
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
