from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


class SupplierCreate(BaseModel):
    company_name: str | None = Field(default=None, max_length=150)
    contact_person: str | None = Field(default=None, max_length=150)
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    gst_number: str | None = Field(default=None, max_length=80)

    @field_validator(
        "company_name",
        "contact_person",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "gst_number",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class SupplierUpdate(BaseModel):
    company_name: str | None = Field(default=None, max_length=150)
    contact_person: str | None = Field(default=None, max_length=150)
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    gst_number: str | None = Field(default=None, max_length=80)

    model_config = ConfigDict(extra="ignore")

    @field_validator(
        "company_name",
        "contact_person",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "gst_number",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class SupplierRead(BaseModel):
    id: int
    code: str
    company_name: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    gst_number: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)