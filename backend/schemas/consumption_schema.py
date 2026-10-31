from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConsumptionBulkDelete(BaseModel):
    ids: list[int]
