import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Enum


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    # SQLite has no timezone support; store naive UTC and add "Z" on output
    return datetime.now(timezone.utc).replace(tzinfo=None)


def str_enum(enum_cls: type[enum.Enum]) -> Enum:
    """Store the enum's *value* (e.g. "In progress"), not its member name."""
    return Enum(
        enum_cls,
        values_callable=lambda e: [m.value for m in e],
        native_enum=False,
        validate_strings=True,
        length=32,
    )
