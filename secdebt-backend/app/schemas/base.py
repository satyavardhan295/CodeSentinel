from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


def _iso_z(dt: datetime) -> str:
    """Render as ISO 8601 UTC with a trailing Z, e.g. 2024-11-14T09:22:01Z."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.replace(microsecond=0).isoformat() + "Z"


UtcDatetime = Annotated[datetime, PlainSerializer(_iso_z, return_type=str)]


def enum_value(v: Any) -> Any:
    """Unwrap ORM enum members to their plain string value before validation."""
    return v.value if isinstance(v, Enum) else v


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )
