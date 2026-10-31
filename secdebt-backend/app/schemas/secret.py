from typing import Annotated, Literal

from pydantic import BeforeValidator

from app.schemas.base import CamelModel, enum_value


class SecretFindingOut(CamelModel):
    id: str
    scan_id: str
    type: str
    file_path: str
    line: int
    masked_value: str
    severity: Annotated[Literal["Critical", "High"], BeforeValidator(enum_value)]
    rotate_url: str
