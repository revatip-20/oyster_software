from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


class RawMaterialCreate(BaseModel):
    material_name: str | None = Field(default=None, max_length=150)
    unit: str | None = Field(default=None, max_length=30)
    hsn_code: str | None = Field(default=None, max_length=20)
    rate: Decimal | None = Field(default=Decimal("0"), ge=0)
    discount_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    cgst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    igst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)

    @field_validator("material_name", "unit", "hsn_code", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class RawMaterialUpdate(BaseModel):
    material_name: str | None = Field(default=None, max_length=150)
    unit: str | None = Field(default=None, max_length=30)
    hsn_code: str | None = Field(default=None, max_length=20)
    rate: Decimal | None = Field(default=None, ge=0)
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    cgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    igst_percent: Decimal | None = Field(default=None, ge=0, le=100)

    model_config = ConfigDict(extra="ignore")

    @field_validator("material_name", "unit", "hsn_code", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class RawMaterialRead(BaseModel):
    id: int
    code: str
    material_name: str | None = None
    unit: str | None = None
    hsn_code: str | None = None
    rate: Decimal | None = None
    discount_percent: Decimal | None = None
    cgst_percent: Decimal | None = None
    ut_sgst_percent: Decimal | None = None
    igst_percent: Decimal | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)