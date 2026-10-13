from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

RawMaterialUnit = Literal["num", "kg", "litre"]


class RawMaterialCreate(BaseModel):
    material_name: str = Field(min_length=1, max_length=150)
    unit: RawMaterialUnit
    hsn_code: str | None = Field(default=None, max_length=20)
    rate: Decimal = Field(default=Decimal("0"), ge=0)
    cgst_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    ut_sgst_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    igst_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)

    @field_validator("hsn_code", mode="before")
    @classmethod
    def blank_hsn_to_none(cls, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None


class RawMaterialUpdate(BaseModel):
    material_name: str | None = Field(default=None, min_length=1, max_length=150)
    unit: RawMaterialUnit | None = None
    hsn_code: str | None = Field(default=None, max_length=20)
    rate: Decimal | None = Field(default=None, ge=0)
    cgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    igst_percent: Decimal | None = Field(default=None, ge=0, le=100)

    model_config = ConfigDict(extra="ignore")

    @field_validator("hsn_code", mode="before")
    @classmethod
    def blank_hsn_to_none(cls, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None


class RawMaterialRead(RawMaterialCreate):
    id: int
    code: str
    created_at: datetime
    updated_at: datetime
    material_name: str
    unit: str | None = None
    hsn_code: str | None = None
    rate: Decimal
    cgst_percent: Decimal
    ut_sgst_percent: Decimal
    igst_percent: Decimal
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)