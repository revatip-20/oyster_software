from datetime import date, datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class DailyInputFields(BaseModel):
    dc_date: date = Field(
        validation_alias=AliasChoices("DC_date", "dc_date"),
        serialization_alias="DC_date",
    )
    dc_no: str = Field(
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("DC_no", "dc_no"),
        serialization_alias="DC_no",
    )
    bill_no: str = Field(min_length=1, max_length=50)
    bill_date: date
    item: str | None = Field(default=None, max_length=150)
    quantity: int = Field(ge=1)
    type: Literal["raw_material", "element"]
    customer_id: int | None = None
    supplier_id: int | None = None
    raw_material_id: int | None = None
    element_id: int | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class DailyInputCreate(DailyInputFields):
    pass


class DailyInputUpdate(BaseModel):
    dc_date: date | None = Field(
        default=None,
        validation_alias=AliasChoices("DC_date", "dc_date"),
        serialization_alias="DC_date",
    )
    dc_no: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("DC_no", "dc_no"),
        serialization_alias="DC_no",
    )
    bill_no: str | None = Field(default=None, min_length=1, max_length=50)
    bill_date: date | None = None
    item: str | None = Field(default=None, max_length=150)
    quantity: int | None = Field(default=None, ge=1)
    type: Literal["raw_material", "element"] | None = None
    customer_id: int | None = None
    supplier_id: int | None = None
    raw_material_id: int | None = None
    element_id: int | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class DailyInputRead(BaseModel):
    id: int
    dc_no: str = Field(validation_alias=AliasChoices("DC_no", "dc_no"), serialization_alias="DC_no")
    dc_date: date = Field(validation_alias=AliasChoices("DC_date", "dc_date"), serialization_alias="DC_date")
    bill_no: str
    bill_date: date | None
    item: str | None = None
    quantity: int
    type: Literal["raw_material", "element"]
    customer_id: int | None = None
    supplier_id: int | None = None
    raw_material_id: int | None = None
    element_id: int | None = None
    user_id: int | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class DailyInputBulkDelete(BaseModel):
    ids: list[int] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")