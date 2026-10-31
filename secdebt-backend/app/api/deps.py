from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User, UserSession
from app.models._types import utcnow
from app.services.security import hash_token

SESSION_COOKIE = "cs_session"

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(request: Request, session: SessionDep) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        row = await session.get(UserSession, hash_token(token))
        if row is not None and row.expires_at > utcnow():
            user = await session.get(User, row.user_id)
            if user is not None:
                return user
    raise HTTPException(401, "Please sign in to continue.")


CurrentUser = Annotated[User, Depends(get_current_user)]
