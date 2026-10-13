from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ElementCreate(BaseModel):
    element_name: str = Field(min_length=1, max_length=150)
    unit: str | None = Field(default=None, max_length=30)


class ElementUpdate(BaseModel):
    element_name: str | None = Field(default=None, min_length=1, max_length=150)
    unit: str | None = Field(default=None, max_length=30)

    model_config = ConfigDict(extra="ignore")


class ElementRead(ElementCreate):
    id: int
    code: str
    element_name: str
    unit: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)