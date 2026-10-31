import re

from pydantic import Field, field_validator

from app.schemas.base import CamelModel, UtcDatetime

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8


def _check_password(v: str) -> str:
    if len(v) < MIN_PASSWORD:
        raise ValueError(f"Password must be at least {MIN_PASSWORD} characters")
    if v.isdigit() or v.isalpha():
        raise ValueError("Password must mix letters with numbers or symbols")
    return v


class SignupRequest(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=320)
    password: str = Field(max_length=200)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Enter your name")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return _check_password(v)


class LoginRequest(CamelModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()


class ChangePasswordRequest(CamelModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)

    @field_validator("new_password")
    @classmethod
    def _password(cls, v: str) -> str:
        return _check_password(v)


class DeleteAccountRequest(CamelModel):
    password: str = Field(max_length=200)


class UserOut(CamelModel):
    id: str
    name: str
    email: str
    created_at: UtcDatetime


class AuthConfigOut(CamelModel):
    allow_signups: bool
