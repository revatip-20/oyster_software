from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RawMaterialCreate(BaseModel):
    material_name: str = Field(min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=100)
    unit: str = Field(min_length=1, max_length=30)
    quantity: Decimal = Field(default=Decimal("0"), ge=0)
    supplier_id: int | None = None


class RawMaterialUpdate(BaseModel):
    material_name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    quantity: Decimal | None = Field(default=None, ge=0)
    supplier_id: int | None = None

    model_config = ConfigDict(extra="forbid")


class RawMaterialRead(RawMaterialCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)