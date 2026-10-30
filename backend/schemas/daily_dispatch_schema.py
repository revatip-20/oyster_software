from datetime import date, datetime
from decimal import Decimal
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


class DailyDispatchFields(BaseModel):
    type: str | None = Field(default="Job work", max_length=50)
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
    zach_code: str | None = Field(default=None, max_length=150)
    po_batch_no: str | None = Field(default=None, max_length=100)
    sach_code: str | None = Field(default=None, max_length=100)
    ls: str | None = Field(default=None, max_length=100)
    quantity: Decimal | None = None
    bin: str | None = Field(default=None, max_length=100)
    boxes: str | None = Field(default=None, max_length=100)
    out_dc_no: str | None = Field(default=None, max_length=50)
    out_dc_date: date | None = None
    out_quantity: Decimal | None = None
    ok: Decimal | None = None
    reject: Decimal | None = None
    unit: str | None = Field(default=None, max_length=30)
    hsn_code: str | None = Field(default=None, max_length=50)
    rate: Decimal | None = Field(default=Decimal("0"), ge=0)
    basic_value: Decimal | None = Field(default=Decimal("0"), ge=0)
    discount_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    discount_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    cgst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    ut_sgst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    igst_percent: Decimal | None = Field(default=Decimal("0"), ge=0, le=100)
    cgst_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    ut_sgst_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    igst_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    total_amount: Decimal | None = Field(default=Decimal("0"), ge=0)
    remarks: str | None = None
    other_details: dict | None = None

    daily_input_id: int | None = None
    product_id: int | None = None
    customer_id: int | None = None
    supplier_id: int | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator(
        "type", "dc_no", "bill_no", "item", "zach_code", "po_batch_no",
        "sach_code", "ls", "bin", "boxes", "out_dc_no", "unit", "hsn_code", "remarks",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)

    @field_validator(
        "dc_date", "bill_date", "out_dc_date", "quantity", "out_quantity", "ok", "reject",
        mode="before",
    )
    @classmethod
    def blank_numeric_or_date_to_none(cls, value):
        return _empty_to_none(value)


class DailyDispatchCreate(DailyDispatchFields):
    pass


class DailyDispatchUpdate(DailyDispatchFields):
    type: str | None = None
    rate: Decimal | None = None
    basic_value: Decimal | None = None
    discount_percent: Decimal | None = None
    discount_amount: Decimal | None = None
    amount: Decimal | None = None
    cgst_percent: Decimal | None = None
    ut_sgst_percent: Decimal | None = None
    igst_percent: Decimal | None = None
    cgst_amount: Decimal | None = None
    ut_sgst_amount: Decimal | None = None
    igst_amount: Decimal | None = None
    total_amount: Decimal | None = None


class DailyDispatchRead(DailyDispatchFields):
    id: int
    code: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DailyDispatchBulkDelete(BaseModel):
    ids: list[int] = Field(..., min_length=1)

