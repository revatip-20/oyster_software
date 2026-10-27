from datetime import date, datetime
from typing import Literal
from decimal import Decimal
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


class DailyInputFields(BaseModel):
    dc_date: date | None = Field(
        default=None,
        validation_alias=AliasChoices("DC_date", "dc_date"),
        serialization_alias="DC_date",
    )
    dc_no: str | None = Field(
        default=None,
        max_length=50,
        validation_alias=AliasChoices("DC_no", "dc_no"),
        serialization_alias="DC_no",
    )
    bill_no: str | None = Field(default=None, max_length=50)
    bill_date: date | None = None
    item: str | None = Field(default=None, max_length=150)
    quantity: Decimal | None = None
    unit: str | None = Field(default=None, max_length=30)
    rate: Decimal | None = Field(default=None, ge=0)
    basic_value: Decimal | None = Field(default=Decimal("0"), ge=0)
    discount_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    hsn_code: str | None = Field(default=None, max_length=20)
    type: Literal["raw_material", "product", "element", "other"] | None = "raw_material"
    supplier_type: Literal["supplier", "general"] | str | None = "supplier"
    discount_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    cgst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    igst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    cgst_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    ut_sgst_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    igst_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    total_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    invoice_path: str | None = None
    remarks: str | None = None
    other_details: dict | None = None
    # Supplier details for general supplier type
    supplier_company_name: str | None = Field(default=None, max_length=150)
    supplier_contact_person: str | None = Field(default=None, max_length=150)
    supplier_phone: str | None = Field(default=None, max_length=50)
    supplier_email: str | None = Field(default=None, max_length=150)
    supplier_address: str | None = None
    supplier_city: str | None = Field(default=None, max_length=100)
    supplier_state: str | None = Field(default=None, max_length=100)
    supplier_pincode: str | None = Field(default=None, max_length=20)
    supplier_gst_number: str | None = Field(default=None, max_length=80)

    customer_id: int | None = None
    supplier_id: int | None = None
    raw_material_id: int | None = None
    product_id: int | None = None
    element_id: int | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @field_validator(
        "dc_no", "bill_no", "item", "unit", "hsn_code", "invoice_path", "remarks", "supplier_type",
        "supplier_company_name", "supplier_contact_person", "supplier_phone", "supplier_email",
        "supplier_address", "supplier_city", "supplier_state", "supplier_pincode", "supplier_gst_number",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class DailyInputCreate(DailyInputFields):
    type: Literal["raw_material", "product", "element", "other"] = "raw_material"
    quantity: Decimal = Field(..., gt=0)


class DailyInputUpdate(BaseModel):
    dc_date: date | None = Field(
        default=None,
        validation_alias=AliasChoices("DC_date", "dc_date"),
        serialization_alias="DC_date",
    )
    dc_no: str | None = Field(
        default=None,
        max_length=50,
        validation_alias=AliasChoices("DC_no", "dc_no"),
        serialization_alias="DC_no",
    )
    bill_no: str | None = Field(default=None, max_length=50)
    bill_date: date | None = None
    item: str | None = Field(default=None, max_length=150)
    quantity: Decimal | None = None
    unit: str | None = Field(default=None, max_length=30)
    rate: Decimal | None = Field(default=None, ge=0)
    basic_value: Decimal | None = Field(default=None, ge=0)
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    hsn_code: str | None = Field(default=None, max_length=20)
    type: Literal["raw_material", "product", "element", "other"] | None = None
    supplier_type: Literal["supplier", "general"] | str | None = None
    discount_amount: Decimal | None = Field(default=None, ge=0)
    cgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    igst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    amount: Decimal | None = Field(default=None, ge=0)
    cgst_amount: Decimal | None = Field(default=None, ge=0)
    ut_sgst_amount: Decimal | None = Field(default=None, ge=0)
    igst_amount: Decimal | None = Field(default=None, ge=0)
    total_amount: Decimal | None = Field(default=None, ge=0)
    invoice_path: str | None = None
    remarks: str | None = None
    # Supplier details for general supplier type
    supplier_company_name: str | None = Field(default=None, max_length=150)
    supplier_contact_person: str | None = Field(default=None, max_length=150)
    supplier_phone: str | None = Field(default=None, max_length=50)
    supplier_email: str | None = Field(default=None, max_length=150)
    supplier_address: str | None = None
    supplier_city: str | None = Field(default=None, max_length=100)
    supplier_state: str | None = Field(default=None, max_length=100)
    supplier_pincode: str | None = Field(default=None, max_length=20)
    supplier_gst_number: str | None = Field(default=None, max_length=80)

    other_details: dict | None = None
    customer_id: int | None = None
    supplier_id: int | None = None
    raw_material_id: int | None = None
    product_id: int | None = None
    element_id: int | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @field_validator(
        "dc_no", "bill_no", "item", "unit", "hsn_code", "invoice_path", "remarks", "supplier_type",
        "supplier_company_name", "supplier_contact_person", "supplier_phone", "supplier_email",
        "supplier_address", "supplier_city", "supplier_state", "supplier_pincode", "supplier_gst_number",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class DailyInputRead(BaseModel):
    id: int
    dc_no: str | None = Field(default=None, validation_alias=AliasChoices("DC_no", "dc_no"), serialization_alias="DC_no")
    dc_date: date | None = Field(default=None, validation_alias=AliasChoices("DC_date", "dc_date"), serialization_alias="DC_date")
    bill_no: str | None = None
    bill_date: date | None = None
    item: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    basic_value: Decimal | None = None
    discount_percent: Decimal | None = None
    hsn_code: str | None = None
    type: Literal["raw_material", "product", "element", "other"] | None = None
    supplier_type: str | None = "supplier"
    discount_amount: Decimal | None = None
    cgst_percent: Decimal | None = None
    ut_sgst_percent: Decimal | None = None
    igst_percent: Decimal | None = None
    amount: Decimal | None = None
    cgst_amount: Decimal | None = None
    ut_sgst_amount: Decimal | None = None
    igst_amount: Decimal | None = None
    total_amount: Decimal | None = None
    invoice_path: str | None = None
    remarks: str | None = None
    supplier_company_name: str | None = None
    supplier_contact_person: str | None = None
    supplier_phone: str | None = None
    supplier_email: str | None = None
    supplier_address: str | None = None
    supplier_city: str | None = None
    supplier_state: str | None = None
    supplier_pincode: str | None = None
    supplier_gst_number: str | None = None
    other_details: dict | None = None
    customer_id: int | None = None
    supplier_id: int | None = None
    raw_material_id: int | None = None
    product_id: int | None = None
    element_id: int | None = None
    user_id: int | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DailyInputBulkDelete(BaseModel):
    ids: list[int] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")