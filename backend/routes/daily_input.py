from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.daily_input import DailyInput
from models.product import Product
from models.raw_material import RawMaterial
from models.user import User
from routes.user import require_roles
from schemas.daily_input_schema import (
    DailyInputBulkDelete,
    DailyInputCreate,
    DailyInputRead,
    DailyInputUpdate,
)

router = APIRouter(prefix="/daily-inputs", tags=["daily inputs"])
permissions = [Depends(require_roles("admin", "supervisor"))]


@router.get("/", response_model=list[DailyInputRead], dependencies=permissions)
def get_daily_inputs(db: Session = Depends(get_db)):
    return db.scalars(
        select(DailyInput)
        .where(DailyInput.deleted_at.is_(None))
        .order_by(DailyInput.id)
    ).all()


@router.post("/", response_model=DailyInputRead, status_code=status.HTTP_201_CREATED)
def add_daily_input(
    entry: DailyInputCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    data = entry.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id
    if not data.get("type"):
        raise HTTPException(status_code=422, detail="Type is required")
    if data.get("quantity") is None or data.get("quantity") <= 0:
        raise HTTPException(status_code=422, detail="Quantity is required and must be greater than 0")
    if data.get("type") == "raw_material" and not data.get("raw_material_id"):
        if data.get("item"):
            matched_rm = db.query(RawMaterial).filter(
                RawMaterial.material_name.ilike(str(data["item"]).strip()),
                RawMaterial.deleted_at.is_(None),
            ).first()
            if matched_rm:
                data["raw_material_id"] = matched_rm.id
        if not data.get("raw_material_id"):
            raise HTTPException(status_code=422, detail="Raw material is required")
    if data.get("type") in ("product", "element") and not (data.get("product_id") or data.get("element_id")):
        if data.get("item"):
            matched_prd = db.query(Product).filter(
                Product.name.ilike(str(data["item"]).strip()),
                Product.deleted_at.is_(None),
            ).first()
            if matched_prd:
                data["product_id"] = matched_prd.id
                data["element_id"] = matched_prd.id
        if not (data.get("product_id") or data.get("element_id")):
            raise HTTPException(status_code=422, detail="Product is required")
    if data.get("type") == "other":
        if not data.get("item"):
            raise HTTPException(status_code=422, detail="Material / item name is required")

    if data.get("type") == "raw_material":
        data["customer_id"] = None
        data["product_id"] = None
        data["element_id"] = None
        if data.get("raw_material_id"):
            rm = db.query(RawMaterial).filter(RawMaterial.id == data["raw_material_id"]).first()
            if rm:
                if not data.get("item"):
                    data["item"] = rm.material_name
                if not data.get("unit"):
                    data["unit"] = rm.unit
                if not data.get("hsn_code"):
                    data["hsn_code"] = rm.hsn_code
                if data.get("rate") is None and rm.rate is not None:
                    data["rate"] = rm.rate
                elif data.get("rate") is not None:
                    rm.rate = data["rate"]
                    rm.updated_at = datetime.now(timezone.utc)
                if data.get("discount_percent") is None and rm.discount_percent is not None:
                    data["discount_percent"] = rm.discount_percent
    elif data.get("type") in ("product", "element"):
        data["raw_material_id"] = None
        target_id = data.get("product_id") or data.get("element_id")
        data["product_id"] = target_id
        data["element_id"] = target_id
        if target_id:
            prd = db.query(Product).filter(Product.id == target_id).first()
            if prd:
                if not data.get("item"):
                    data["item"] = prd.name
    elif data.get("type") == "other":
        data["customer_id"] = None
        data["supplier_id"] = None
        data["raw_material_id"] = None
        data["product_id"] = None
        data["element_id"] = None
        if data.get("other_details") is None:
            data["other_details"] = {}
        od = data["other_details"]
        if "material_name" not in od and data.get("item"):
            od["material_name"] = data["item"]
        if "unit" not in od and data.get("unit"):
            od["unit"] = data["unit"]
        if "rate" not in od and data.get("rate") is not None:
            od["rate"] = float(data["rate"])

    new_entry = DailyInput(**data)
    db.add(new_entry)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unknown customer_id, supplier_id, raw_material_id, element_id or user_id",
        ) from error
    db.refresh(new_entry)
    return new_entry


@router.patch("/{entry_id}", response_model=DailyInputRead, dependencies=permissions)
@router.put("/{entry_id}", response_model=DailyInputRead, dependencies=permissions)
def edit_daily_input(entry_id: int, update: DailyInputUpdate, db: Session = Depends(get_db)):
    entry = db.query(DailyInput).filter(
        DailyInput.id == entry_id,
        DailyInput.deleted_at.is_(None),
    ).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Daily input not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")

    effective_type = changes.get("type") or entry.type
    effective_rm_id = changes.get("raw_material_id") or entry.raw_material_id
    effective_prd_id = changes.get("product_id") or changes.get("element_id") or entry.product_id or entry.element_id
    effective_qty = changes.get("quantity") or entry.quantity
    effective_item = changes.get("item") or entry.item

    if not effective_type:
        raise HTTPException(status_code=422, detail="Type is required")
    if effective_qty is None or effective_qty <= 0:
        raise HTTPException(status_code=422, detail="Quantity is required and must be greater than 0")
    if effective_type == "raw_material" and not effective_rm_id:
        if effective_item:
            matched_rm = db.query(RawMaterial).filter(
                RawMaterial.material_name.ilike(str(effective_item).strip()),
                RawMaterial.deleted_at.is_(None),
            ).first()
            if matched_rm:
                effective_rm_id = matched_rm.id
                entry.raw_material_id = matched_rm.id
        if not effective_rm_id:
            raise HTTPException(status_code=422, detail="Raw material is required")
    if effective_type in ("product", "element") and not effective_prd_id:
        if effective_item:
            matched_prd = db.query(Product).filter(
                Product.name.ilike(str(effective_item).strip()),
                Product.deleted_at.is_(None),
            ).first()
            if matched_prd:
                effective_prd_id = matched_prd.id
                entry.product_id = matched_prd.id
                entry.element_id = matched_prd.id
        if not effective_prd_id:
            raise HTTPException(status_code=422, detail="Product is required")
    if effective_type == "other" and not effective_item:
        raise HTTPException(status_code=422, detail="Material / item name is required")

    if effective_type == "raw_material" and effective_rm_id:
        changes["raw_material_id"] = effective_rm_id
        changes["type"] = "raw_material"
    elif effective_type in ("product", "element") and effective_prd_id:
        changes["product_id"] = effective_prd_id
        changes["element_id"] = effective_prd_id
        changes["type"] = effective_type

    for field, value in changes.items():
        setattr(entry, field, value)

    if entry.type == "raw_material":
        entry.customer_id = None
        entry.product_id = None
        entry.element_id = None
        if entry.raw_material_id:
            rm = db.query(RawMaterial).filter(RawMaterial.id == entry.raw_material_id).first()
            if rm:
                if not entry.item:
                    entry.item = rm.material_name
                if not entry.unit:
                    entry.unit = rm.unit
                if not entry.hsn_code:
                    entry.hsn_code = rm.hsn_code
                # Save rate in raw material for that material if provided
                if "rate" in changes and changes["rate"] is not None:
                    rm.rate = changes["rate"]
                    rm.updated_at = datetime.now(timezone.utc)
                elif entry.rate is None and rm.rate is not None:
                    entry.rate = rm.rate
                if "discount_percent" not in changes and entry.discount_percent is None and rm.discount_percent is not None:
                    entry.discount_percent = rm.discount_percent
    elif entry.type in ("product", "element"):
        entry.raw_material_id = None
        target_id = changes.get("product_id", changes.get("element_id", entry.product_id or entry.element_id))
        entry.product_id = target_id
        entry.element_id = target_id
        if target_id:
            prd = db.query(Product).filter(Product.id == target_id).first()
            if prd:
                if not entry.item:
                    entry.item = prd.name
    elif entry.type == "other":
        entry.raw_material_id = None
        entry.product_id = None
        entry.element_id = None
        entry.customer_id = None
        entry.supplier_id = None
        if "other_details" in changes and changes["other_details"]:
            entry.other_details = changes["other_details"]

    entry.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unknown customer_id, supplier_id, raw_material_id, element_id or user_id",
        ) from error
    db.refresh(entry)
    return entry


def _soft_delete_daily_inputs(entry_ids: list[int], db: Session):
    unique_ids = list(dict.fromkeys(entry_ids))
    entries = (
        db.query(DailyInput)
        .filter(
            DailyInput.id.in_(unique_ids),
            DailyInput.deleted_at.is_(None),
        )
        .all()
    )
    if not entries:
        raise HTTPException(
            status_code=404,
            detail="No active Daily Input records found",
        )

    now = datetime.now(timezone.utc)
    try:
        for entry in entries:
            entry.deleted_at = now
            entry.updated_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete selected Daily Input records",
        )

    return {
        "message": "Selected Daily Input records deleted successfully",
        "deleted_count": len(entries),
        "deleted_ids": [entry.id for entry in entries],
    }


@router.delete("/{entry_id}", dependencies=permissions)
def delete_daily_input(entry_id: int, db: Session = Depends(get_db)):
    return _soft_delete_daily_inputs([entry_id], db)


@router.delete("/", dependencies=permissions)
def delete_daily_inputs(
    payload: DailyInputBulkDelete,
    db: Session = Depends(get_db),
):
    return _soft_delete_daily_inputs(payload.ids, db)