from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError

from app.api.deps import SESSION_COOKIE, CurrentUser, SessionDep
from app.config import settings
from app.models import GitHubConnection, Scan, ScanStatus, User, UserSession
from app.models._types import utcnow
from app.schemas import (
    AuthConfigOut,
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    SignupRequest,
    UserOut,
)
from app.services import rate_limit
from app.services.data import delete_scans
from app.services.security import hash_password, hash_token, new_session_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Same message for unknown email and wrong password, so accounts can't be enumerated
BAD_LOGIN = "Incorrect email or password."
# Verified against for unknown emails so both paths take the same time
_DUMMY_HASH = hash_password("not-a-real-password-1")


def _out(user: User) -> UserOut:
    return UserOut(id=user.id, name=user.name, email=user.email, created_at=user.created_at)


async def _start_session(session: SessionDep, request: Request, response: Response, user: User) -> None:
    token = new_session_token()
    now = utcnow()
    # Drop this user's expired sessions while we're here
    await session.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at <= now)
    )
    session.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            created_at=now,
            expires_at=now + timedelta(days=settings.session_days),
        )
    )
    await session.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,  # not readable from JavaScript
        samesite="lax",  # not sent on cross-site POSTs (CSRF protection)
        secure=request.url.scheme == "https",
        path="/",
    )


def _rate_key(request: Request, email: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{client}|{email}"


@router.get("/config", response_model=AuthConfigOut)
async def auth_config():
    return AuthConfigOut(allow_signups=settings.allow_signups)


@router.post("/signup", response_model=UserOut, status_code=201)
async def signup(body: SignupRequest, request: Request, response: Response, session: SessionDep):
    if not settings.allow_signups:
        raise HTTPException(403, "New sign-ups are closed on this CodeSentinel server.")
    existing = await session.scalar(select(User).where(User.email == body.email))
    if existing is not None:
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")

    is_first_user = (await session.scalar(select(func.count()).select_from(User))) == 0
    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password))
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")

    # Scans made before accounts existed belong to whoever sets the server up
    if is_first_user:
        await session.execute(update(Scan).where(Scan.user_id.is_(None)).values(user_id=user.id))

    await _start_session(session, request, response, user)
    return _out(user)


@router.post("/login", response_model=UserOut)
async def login(body: LoginRequest, request: Request, response: Response, session: SessionDep):
    key = _rate_key(request, body.email)
    wait = rate_limit.retry_after(key)
    if wait:
        raise HTTPException(
            429, f"Too many failed attempts. Try again in {max(1, wait // 60)} minute(s)."
        )

    user = await session.scalar(select(User).where(User.email == body.email))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not ok:
        rate_limit.record_failure(key)
        raise HTTPException(401, BAD_LOGIN)

    rate_limit.reset(key)
    await _start_session(session, request, response, user)
    return _out(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, session: SessionDep):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await session.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
        await session.commit()
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return _out(user)


@router.post("/change-password", status_code=204)
async def change_password(body: ChangePasswordRequest, request: Request, user: CurrentUser, session: SessionDep):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    # Sign out every other browser; keep this one
    current = hash_token(request.cookies.get(SESSION_COOKIE, ""))
    await session.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.token_hash != current)
    )
    await session.commit()
    return Response(status_code=204)


@router.delete("/account", status_code=204)
async def delete_account(body: DeleteAccountRequest, user: CurrentUser, session: SessionDep):
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(400, "Your password is incorrect.")
    running = await session.scalar(
        select(func.count())
        .select_from(Scan)
        .where(Scan.user_id == user.id, Scan.status.in_([ScanStatus.queued, ScanStatus.scanning]))
    )
    if running:
        raise HTTPException(409, "A scan is still running. Wait for it to finish, then try again.")

    scan_ids = list(await session.scalars(select(Scan.id).where(Scan.user_id == user.id)))
    await delete_scans(session, scan_ids)
    await session.execute(delete(GitHubConnection).where(GitHubConnection.user_id == user.id))
    await session.execute(delete(UserSession).where(UserSession.user_id == user.id))
    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()

    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response
