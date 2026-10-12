# schemas/invoice.py

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class InvoiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    daily_input_ids: list[int] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class InvoiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    daily_input_ids: list[int] | None = None

    model_config = ConfigDict(extra="forbid")


class InvoiceRead(BaseModel):
    id: int
    name: str
    daily_input_ids: list[int]
    daily_input_data: list[Any] = Field(default_factory=list)
    invoice_path: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class GenerateInvoiceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    daily_input_ids: list[int] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")
