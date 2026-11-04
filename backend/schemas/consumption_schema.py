from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _parse_date_or_none(value):
    val = _empty_to_none(value)
    if val is None:
        return None
    if isinstance(val, str):
        v = val.strip()
        if not v:
            return None
        parts = v.replace("-", "/").split("/")
        if len(parts) == 3 and len(parts[0]) <= 2 and len(parts[2]) == 4:
            try:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                return date(y, m, d)
            except Exception:
                pass
        return v
    return val


class ConsumptionRawMaterialItem(BaseModel):
    raw_material_id: int
    material_name: Optional[str] = None
    code: Optional[str] = None
    quantity: Optional[Decimal] = Decimal("1")
    unit: Optional[str] = None


class ConsumptionCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = Field(default=None, max_length=150)
    product_code: Optional[str] = Field(default=None, max_length=80)
    raw_materials: Optional[list[Any]] = None
    raw_material_ids: Optional[list[int]] = None
    date: Optional[date] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    remarks: Optional[str] = None
    user_id: Optional[int] = None

    @field_validator("date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)


class ConsumptionUpdate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = Field(default=None, max_length=150)
    product_code: Optional[str] = Field(default=None, max_length=80)
    raw_materials: Optional[list[Any]] = None
    raw_material_ids: Optional[list[int]] = None
    date: Optional[date] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    remarks: Optional[str] = None
    user_id: Optional[int] = None

    @field_validator("date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)


class ConsumptionRead(BaseModel):
    id: int
    code: Optional[str] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    raw_materials: Optional[list[Any]] = None
    raw_material_ids: Optional[list[int]] = None
    raw_material_summary: Optional[str] = None
    date: Optional[date] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    remarks: Optional[str] = None
    user_id: Optional[int] = None

    @field_validator("date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConsumptionBulkDelete(BaseModel):
    ids: list[int]
