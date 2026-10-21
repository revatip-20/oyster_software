from datetime import datetime
from decimal import Decimal
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _parse_numeric(value):
    if value is None:
        return None
    if isinstance(value, str):
        val = value.strip()
        if not val:
            return None
        # Try direct conversion first
        try:
            return Decimal(val)
        except Exception:
            # Extract leading number if unit or non-numeric suffix was typed (e.g. "37.5 mm", "4.0 MFD")
            match = re.match(r"^[-+]?\d*\.?\d+", val)
            if match:
                try:
                    return Decimal(match.group(0))
                except Exception:
                    pass
            return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


class CostDataBase(BaseModel):
    type: str | None = Field(default=None, max_length=50)
    wound_cap_basic_value: Decimal | None = Field(default=None)
    mpp_film_width: Decimal | None = Field(default=None)
    mpp_film_thickness: Decimal | None = Field(default=None)
    core_od: Decimal | None = Field(default=None)
    film_free_margin: Decimal | None = Field(default=None)
    winding_stagger: Decimal | None = Field(default=None)
    wound_capacitor_od: Decimal | None = Field(default=None)
    turns_to_be_wound: Decimal | None = Field(default=None)
    active_width: Decimal | None = Field(default=None)
    band_length: Decimal | None = Field(default=None)
    wt_of_capacitor: Decimal | None = Field(default=None)
    wound_cap_element_value: Decimal | None = Field(default=None)
    pp_film_width: Decimal | None = Field(default=None)
    pp_film_thickness: Decimal | None = Field(default=None)

    @field_validator("type", mode="before")
    @classmethod
    def clean_type(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            val = value.strip()
            if not val:
                return None
            if val.lower() == "basic":
                return "Basic"
            if val.lower() == "element":
                return "Element"
            return val
        return value

    @field_validator(
        "wound_cap_basic_value",
        "mpp_film_width",
        "mpp_film_thickness",
        "core_od",
        "film_free_margin",
        "winding_stagger",
        "wound_capacitor_od",
        "turns_to_be_wound",
        "active_width",
        "band_length",
        "wt_of_capacitor",
        "wound_cap_element_value",
        "pp_film_width",
        "pp_film_thickness",
        mode="before",
    )
    @classmethod
    def clean_numeric(cls, value):
        return _parse_numeric(value)


class CostDataCreate(CostDataBase):
    pass


class CostDataUpdate(CostDataBase):
    model_config = ConfigDict(extra="ignore")


class CostDataRead(CostDataBase):
    id: int
    code: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
