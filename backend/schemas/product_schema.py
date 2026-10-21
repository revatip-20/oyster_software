from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


VALID_TYPES = ("element", "welded element", "capacitor")


class ProductRawMaterialItem(BaseModel):
    raw_material_id: int
    quantity: Decimal | float | None = 1
    material_name: str | None = None
    code: str | None = None
    unit: str | None = None


class ProductBase(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    type: str | None = Field(default=None, max_length=50)
    zach_code: str | None = Field(default=None, max_length=150)
    has_zach_code: bool | None = Field(default=False)
    raw_material_id: int | None = Field(default=None)
    raw_material_ids: list[int] | None = Field(default=None)
    raw_materials: list[dict] | list[ProductRawMaterialItem] | None = Field(default=None)
    element_id: int | None = Field(default=None)
    welded_element_id: int | None = Field(default=None)
    quantity: Decimal | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)

    @field_validator("zach_code", mode="before")
    @classmethod
    def blank_zach_code_to_none(cls, value):
        return _empty_to_none(value)

    @field_validator("has_zach_code", mode="before")
    @classmethod
    def parse_has_zach_code(cls, value):
        if value is None:
            return False
        if isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes", "with_zach_code")
        return bool(value)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, value):
        val = _empty_to_none(value)
        if val is None:
            return None
        val_str = str(val).strip().lower()
        if val_str in VALID_TYPES:
            return val_str
        return str(val).strip()

    @field_validator("raw_material_id", "element_id", "welded_element_id", mode="before")
    @classmethod
    def parse_optional_id(cls, value):
        val = _empty_to_none(value)
        if val is None:
            return None
        try:
            return int(val)
        except Exception:
            return None

    @field_validator("raw_material_ids", mode="before")
    @classmethod
    def parse_raw_material_ids(cls, value):
        val = _empty_to_none(value)
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return [int(val)]
        if isinstance(val, str):
            val = [x.strip() for x in val.split(",") if x.strip()]
        if isinstance(val, (list, tuple, set)):
            result = []
            for item in val:
                try:
                    ival = int(item)
                    if ival not in result:
                        result.append(ival)
                except Exception:
                    continue
            return result
        return None

    @field_validator("raw_materials", mode="before")
    @classmethod
    def parse_raw_materials(cls, value):
        val = _empty_to_none(value)
        if val is None:
            return None
        if isinstance(val, (list, tuple)):
            items = []
            for item in val:
                if isinstance(item, dict):
                    rm_id = item.get("raw_material_id") or item.get("id")
                    if rm_id is not None:
                        try:
                            qty = item.get("quantity")
                            qty_val = Decimal(str(qty)) if qty is not None and str(qty).strip() != "" else Decimal("1")
                        except Exception:
                            qty_val = Decimal("1")
                        items.append({
                            "raw_material_id": int(rm_id),
                            "quantity": qty_val,
                            "material_name": item.get("material_name"),
                            "code": item.get("code"),
                            "unit": item.get("unit"),
                        })
                elif isinstance(item, (int, str)):
                    try:
                        items.append({"raw_material_id": int(item), "quantity": Decimal("1")})
                    except Exception:
                        pass
            return items
        return None

    @field_validator("quantity", mode="before")
    @classmethod
    def parse_quantity(cls, value):
        val = _empty_to_none(value)
        if val is None:
            return None
        try:
            return Decimal(str(val))
        except Exception:
            return None


class ProductCreate(ProductBase):
    name: str = Field(..., max_length=150)
    type: str = Field(..., max_length=50)


class ProductUpdate(ProductBase):
    model_config = ConfigDict(extra="ignore")


class ProductRead(ProductBase):
    id: int
    code: str | None = None
    raw_material_id: int | None = None
    raw_materials: list[ProductRawMaterialItem] = Field(default_factory=list)
    raw_material_ids: list[int] = Field(default_factory=list)
    raw_material_name: str | None = None
    raw_material_names: list[str] = Field(default_factory=list)
    element_id: int | None = None
    element_name: str | None = None
    element_code: str | None = None
    welded_element_id: int | None = None
    welded_element_name: str | None = None
    welded_element_code: str | None = None
    component_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
