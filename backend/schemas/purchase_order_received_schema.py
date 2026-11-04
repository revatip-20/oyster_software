from datetime import date, datetime
from decimal import Decimal
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


class PurchaseOrderReceivedFields(BaseModel):
    customer_id: int | None = None
    product_id: int | None = None
    item: str | None = Field(default=None, max_length=150)
    zach_code: str | None = Field(default=None, max_length=150)
    sach_code: str | None = Field(default=None, max_length=100)
    po_no: str | None = Field(default=None, max_length=100)
    po_date: date | None = None
    qty_ord: Decimal | None = Field(default=Decimal("0"))
    qty_dis: Decimal | None = Field(default=Decimal("0"))
    qty_bal: Decimal | None = Field(default=Decimal("0"))
    price: Decimal | None = Field(default=Decimal("0"))
    remarks: str | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator("item", "zach_code", "sach_code", "po_no", "remarks", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)

    @field_validator("po_date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)


class PurchaseOrderReceivedCreate(PurchaseOrderReceivedFields):
    pass


class PurchaseOrderReceivedUpdate(BaseModel):
    customer_id: int | None = None
    product_id: int | None = None
    item: str | None = Field(default=None, max_length=150)
    zach_code: str | None = Field(default=None, max_length=150)
    sach_code: str | None = Field(default=None, max_length=100)
    po_no: str | None = Field(default=None, max_length=100)
    po_date: date | None = None
    qty_ord: Decimal | None = None
    qty_dis: Decimal | None = None
    qty_bal: Decimal | None = None
    price: Decimal | None = None
    remarks: str | None = None
    user_id: int | None = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator("item", "zach_code", "sach_code", "po_no", "remarks", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)

    @field_validator("po_date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)


class PurchaseOrderReceivedRead(PurchaseOrderReceivedFields):
    id: int
    code: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PurchaseOrderReceivedBulkDelete(BaseModel):
    ids: list[int]

