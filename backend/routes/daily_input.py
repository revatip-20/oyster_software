from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.daily_input import DailyInput
from models.element import Element
from models.raw_material import RawMaterial
from models.user import User
from routes.user import require_roles
from schemas.daily_input_schema import DailyInputCreate, DailyInputRead, DailyInputUpdate

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
    if data.get("type") == "raw_material":
        data["customer_id"] = None
        data["element_id"] = None
        if not data.get("item") and data.get("raw_material_id"):
            rm = db.query(RawMaterial).filter(RawMaterial.id == data["raw_material_id"]).first()
            if rm:
                data["item"] = rm.material_name
    elif data.get("type") == "element":
        data["raw_material_id"] = None
        if not data.get("item") and data.get("element_id"):
            el = db.query(Element).filter(Element.id == data["element_id"]).first()
            if el:
                data["item"] = el.element_name

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

    for field, value in changes.items():
        if value is None and field not in {
            "customer_id",
            "supplier_id",
            "raw_material_id",
            "element_id",
            "user_id",
            "item",
            "bill_date",
        }:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        setattr(entry, field, value)

    if entry.type == "raw_material":
        entry.customer_id = None
        entry.element_id = None
        if not entry.item and entry.raw_material_id:
            rm = db.query(RawMaterial).filter(RawMaterial.id == entry.raw_material_id).first()
            if rm:
                entry.item = rm.material_name
    elif entry.type == "element":
        entry.raw_material_id = None
        if not entry.item and entry.element_id:
            el = db.query(Element).filter(Element.id == entry.element_id).first()
            if el:
                entry.item = el.element_name

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


@router.delete("/", dependencies=permissions)
def delete_daily_inputs(
    entry_ids: list[int] = Body(...),
    db: Session = Depends(get_db),
):
    entries = (
        db.query(DailyInput)
        .filter(
            DailyInput.id.in_(entry_ids),
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

        return {
            "message": "Selected Daily Input records deleted successfully",
            "deleted_count": len(entries),
            "deleted_ids": [entry.id for entry in entries],
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete selected Daily Input records",
        )