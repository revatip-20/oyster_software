from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.database import get_db
from models.supplier import Supplier
from routes.user import require_roles
from schemas.supplier_schema import SupplierCreate, SupplierRead, SupplierUpdate
from services.code_generator import get_next_resource_code
from sqlalchemy import select

router = APIRouter(tags=["suppliers"])


@router.get(
    "/get-suppliers",
    response_model=list[SupplierRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def get_suppliers(db: Session = Depends(get_db)):
    return db.scalars(
        select(Supplier)
        .where(Supplier.deleted_at.is_(None))
        .order_by(Supplier.id)
    ).all()


@router.post(
    "/suppliers/",
    response_model=SupplierRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def add_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    data = supplier.model_dump()
    code = get_next_resource_code(db, Supplier, Supplier.code, "S")
    new_supplier = Supplier(code=code, **data)
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return new_supplier


@router.patch(
    "/suppliers/{supplier_id}",
    response_model=SupplierRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def edit_supplier(supplier_id: int, update: SupplierUpdate, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.deleted_at.is_(None),
    ).first()
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")

    for field, value in changes.items():
        setattr(supplier, field, value)
    supplier.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete(
    "/suppliers/{supplier_id}",
    response_model=SupplierRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.deleted_at.is_(None),
    ).first()
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    now = datetime.now(timezone.utc)
    supplier.deleted_at = now
    supplier.updated_at = now
    db.commit()
    db.refresh(supplier)
    return supplier