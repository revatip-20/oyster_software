from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.daily_dispatch import DailyDispatch
from models.daily_input import DailyInput
from models.product import Product
from models.user import User
from routes.user import require_roles
from schemas.daily_dispatch_schema import (
    DailyDispatchBulkDelete,
    DailyDispatchCreate,
    DailyDispatchRead,
    DailyDispatchUpdate,
)
from services.code_generator import get_next_resource_code

router = APIRouter(prefix="/daily-dispatch", tags=["daily dispatch"])
permissions = [Depends(require_roles("admin", "supervisor"))]


@router.get("/", response_model=list[DailyDispatchRead], dependencies=permissions)
async def get_daily_dispatches(db: Session = Depends(get_db)):
    return db.scalars(
        select(DailyDispatch)
        .where(DailyDispatch.deleted_at.is_(None))
        .order_by(DailyDispatch.id)
    ).all()


@router.post("/", response_model=DailyDispatchRead, status_code=status.HTTP_201_CREATED)
async def add_daily_dispatch(
    entry: DailyDispatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    data = entry.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id

    if data.get("daily_input_id"):
        di = db.query(DailyInput).filter(DailyInput.id == data["daily_input_id"]).first()
        if di:
            if not data.get("item"):
                data["item"] = di.item
            if not data.get("po_batch_no"):
                data["po_batch_no"] = di.po_batch_no or (di.other_details or {}).get("po_batch_no")
            if not data.get("zach_code"):
                data["zach_code"] = di.zach_code or (di.other_details or {}).get("zach_code")
            if not data.get("sach_code"):
                data["sach_code"] = di.sach_code or (di.other_details or {}).get("sach_code")
            if not data.get("ls"):
                data["ls"] = di.ls or (di.other_details or {}).get("ls")
            if not data.get("bin"):
                data["bin"] = di.bin or (di.other_details or {}).get("bin")
            if not data.get("boxes"):
                data["boxes"] = di.boxes or (di.other_details or {}).get("boxes")
            if not data.get("unit"):
                data["unit"] = di.unit
            if not data.get("hsn_code"):
                data["hsn_code"] = di.hsn_code
            if data.get("quantity") is None:
                data["quantity"] = di.quantity
            if not data.get("dc_no"):
                data["dc_no"] = di.dc_no
            if not data.get("dc_date"):
                data["dc_date"] = di.dc_date
            if not data.get("bill_no"):
                data["bill_no"] = di.bill_no
            if not data.get("bill_date"):
                data["bill_date"] = di.bill_date
            if not data.get("supplier_id"):
                data["supplier_id"] = di.supplier_id
            if not data.get("product_id"):
                data["product_id"] = di.product_id

    if data.get("product_id") and not data.get("item"):
        prd = db.query(Product).filter(Product.id == data["product_id"]).first()
        if prd:
            data["item"] = prd.name

    try:
        code = get_next_resource_code(db, DailyDispatch, DailyDispatch.code, "DD")
    except Exception:
        code = None

    new_record = DailyDispatch(code=code, **data)
    db.add(new_record)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Failed to save daily dispatch record") from error
    db.refresh(new_record)
    return new_record


@router.patch("/{dispatch_id}", response_model=DailyDispatchRead, dependencies=permissions)
async def edit_daily_dispatch(
    dispatch_id: int,
    update: DailyDispatchUpdate,
    db: Session = Depends(get_db),
):
    record = db.query(DailyDispatch).filter(
        DailyDispatch.id == dispatch_id,
        DailyDispatch.deleted_at.is_(None),
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Daily dispatch record not found")

    changes = update.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(record, field, value)
    record.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Failed to update daily dispatch record") from error
    db.refresh(record)
    return record


@router.delete("/{dispatch_id}", status_code=status.HTTP_200_OK, dependencies=permissions)
async def delete_daily_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    record = db.query(DailyDispatch).filter(
        DailyDispatch.id == dispatch_id,
        DailyDispatch.deleted_at.is_(None),
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Daily dispatch record not found")

    record.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Daily dispatch record deleted", "id": dispatch_id}


@router.delete("/", status_code=status.HTTP_200_OK, dependencies=permissions)
async def bulk_delete_daily_dispatches(
    payload: DailyDispatchBulkDelete,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    records = db.query(DailyDispatch).filter(
        DailyDispatch.id.in_(payload.ids),
        DailyDispatch.deleted_at.is_(None),
    ).all()
    for rec in records:
        rec.deleted_at = now
    db.commit()
    return {"deleted_count": len(records), "deleted_ids": [r.id for r in records]}

