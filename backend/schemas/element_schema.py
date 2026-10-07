from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ElementCreate(BaseModel):
    element_name: str = Field(min_length=1, max_length=150)
    element_code: str = Field(min_length=1, max_length=80)
    description: str | None = None
    unit: str | None = Field(default=None, max_length=30)
    supplier_id: int | None = None
    raw_material_id: int | None = None


class ElementUpdate(BaseModel):
    element_name: str | None = Field(default=None, min_length=1, max_length=150)
    element_code: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    unit: str | None = Field(default=None, max_length=30)
    supplier_id: int | None = None
    raw_material_id: int | None = None

    model_config = ConfigDict(extra="forbid")


class ElementRead(ElementCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)