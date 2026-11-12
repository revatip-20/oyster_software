from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.purchase_order_received import PurchaseOrderReceived
from models.user import User
from routes.user import require_roles
from schemas.purchase_order_received_schema import (
    PurchaseOrderReceivedBulkDelete,
    PurchaseOrderReceivedCreate,
    PurchaseOrderReceivedRead,
    PurchaseOrderReceivedUpdate,
)
from services.code_generator import get_next_resource_code

router = APIRouter(prefix="/purchase-orders-received", tags=["purchase order received"])
read_permissions = [Depends(require_roles("admin", "supervisor", "employee"))]
permissions = [Depends(require_roles("admin", "supervisor"))]


@router.get("/", response_model=list[PurchaseOrderReceivedRead], dependencies=read_permissions)
def get_purchase_orders_received(db: Session = Depends(get_db)):
    return db.scalars(
        select(PurchaseOrderReceived)
        .where(PurchaseOrderReceived.deleted_at.is_(None))
        .order_by(PurchaseOrderReceived.id)
    ).all()


@router.post("/", response_model=PurchaseOrderReceivedRead, status_code=status.HTTP_201_CREATED)
def add_purchase_order_received(
    entry: PurchaseOrderReceivedCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    data = entry.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id

    try:
        code = get_next_resource_code(db, PurchaseOrderReceived, PurchaseOrderReceived.code, "POR")
    except Exception:
        code = None

    new_record = PurchaseOrderReceived(code=code, **data)
    db.add(new_record)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save purchase order received record",
        ) from error
    db.refresh(new_record)
    return new_record


@router.patch("/{po_id}", response_model=PurchaseOrderReceivedRead, dependencies=permissions)
def edit_purchase_order_received(
    po_id: int,
    update: PurchaseOrderReceivedUpdate,
    db: Session = Depends(get_db),
):
    record = db.query(PurchaseOrderReceived).filter(
        PurchaseOrderReceived.id == po_id,
        PurchaseOrderReceived.deleted_at.is_(None),
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Purchase order received record not found")

    changes = update.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(record, field, value)
    record.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to update purchase order received record",
        ) from error
    db.refresh(record)
    return record


@router.delete("/{po_id}", status_code=status.HTTP_200_OK, dependencies=permissions)
def delete_purchase_order_received(po_id: int, db: Session = Depends(get_db)):
    record = db.query(PurchaseOrderReceived).filter(
        PurchaseOrderReceived.id == po_id,
        PurchaseOrderReceived.deleted_at.is_(None),
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Purchase order received record not found")

    now = datetime.now(timezone.utc)
    record.deleted_at = now
    record.updated_at = now
    db.commit()
    return {"message": "Purchase order received record deleted", "id": po_id}


@router.delete("/", status_code=status.HTTP_200_OK, dependencies=permissions)
def bulk_delete_purchase_orders_received(
    payload: PurchaseOrderReceivedBulkDelete,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    records = db.query(PurchaseOrderReceived).filter(
        PurchaseOrderReceived.id.in_(payload.ids),
        PurchaseOrderReceived.deleted_at.is_(None),
    ).all()
    for rec in records:
        rec.deleted_at = now
        rec.updated_at = now
    db.commit()
    return {"deleted_count": len(records), "deleted_ids": [r.id for r in records]}

