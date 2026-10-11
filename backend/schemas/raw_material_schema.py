from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RawMaterialCreate(BaseModel):
    material_name: str = Field(min_length=1, max_length=150)
    unit: str = Field(min_length=1, max_length=30)


class RawMaterialUpdate(BaseModel):
    material_name: str | None = Field(default=None, min_length=1, max_length=150)
    unit: str | None = Field(default=None, min_length=1, max_length=30)

    model_config = ConfigDict(extra="forbid")


class RawMaterialRead(RawMaterialCreate):
    id: int
    code: str
    created_at: datetime
    updated_at: datetime
    material_name: str
    unit: str | None = None
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)