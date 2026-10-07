from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.raw_material import RawMaterial
from routes.user import require_roles
from schemas.raw_material_schema import RawMaterialCreate, RawMaterialRead, RawMaterialUpdate
from sqlalchemy import select

router = APIRouter(tags=["raw materials"])


@router.get(
    "/get-raw-material",
    response_model=list[RawMaterialRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def get_raw_materials(db: Session = Depends(get_db)):
    return db.scalars(
        select(RawMaterial)
        .where(RawMaterial.deleted_at.is_(None))
        .order_by(RawMaterial.id)
    ).all()


@router.post(
    "/raw-materials/",
    response_model=RawMaterialRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def add_raw_material(material: RawMaterialCreate, db: Session = Depends(get_db)):
    new_material = RawMaterial(**material.model_dump())
    db.add(new_material)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invalid supplier_id") from error
    db.refresh(new_material)
    return new_material


@router.patch(
    "/raw-materials/{material_id}",
    response_model=RawMaterialRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def edit_raw_material(
    material_id: int,
    update: RawMaterialUpdate,
    db: Session = Depends(get_db),
):
    material = db.query(RawMaterial).filter(
        RawMaterial.id == material_id,
        RawMaterial.deleted_at.is_(None),
    ).first()
    if material is None:
        raise HTTPException(status_code=404, detail="Raw material not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")
    if any(changes.get(field) is None for field in ("material_name", "unit", "quantity") if field in changes):
        raise HTTPException(status_code=422, detail="Required fields cannot be null")

    for field, value in changes.items():
        setattr(material, field, value)
    material.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invalid supplier_id") from error
    db.refresh(material)
    return material


@router.delete(
    "/raw-materials/{material_id}",
    response_model=RawMaterialRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def delete_raw_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(RawMaterial).filter(
        RawMaterial.id == material_id,
        RawMaterial.deleted_at.is_(None),
    ).first()
    if material is None:
        raise HTTPException(status_code=404, detail="Raw material not found")

    now = datetime.now(timezone.utc)
    material.deleted_at = now
    material.updated_at = now
    db.commit()
    db.refresh(material)
    return material