from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RawMaterialCreate(BaseModel):
    material_name: str = Field(min_length=1, max_length=150)
    unit: str = Field(min_length=1, max_length=30)
    rate: Decimal = Field(default=Decimal("0"), ge=0)
    cgst_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    ut_sgst_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    igst_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class RawMaterialUpdate(BaseModel):
    material_name: str | None = Field(default=None, min_length=1, max_length=150)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    rate: Decimal | None = Field(default=None, ge=0)
    cgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    igst_percent: Decimal | None = Field(default=None, ge=0, le=100)

    model_config = ConfigDict(extra="forbid")


class RawMaterialRead(RawMaterialCreate):
    id: int
    code: str
    created_at: datetime
    updated_at: datetime
    material_name: str
    unit: str | None = None
    rate: Decimal
    cgst_percent: Decimal
    ut_sgst_percent: Decimal
    igst_percent: Decimal
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)