from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.element import Element
from routes.user import require_roles
from schemas.element_schema import ElementCreate, ElementRead, ElementUpdate
from services.daily_input_sync import sync_daily_inputs_for_element
from sqlalchemy import select

router = APIRouter(tags=["elements"])


@router.get(
    "/get-elements",
    response_model=list[ElementRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def get_elements(db: Session = Depends(get_db)):
    return db.scalars(
        select(Element)
        .where(Element.deleted_at.is_(None))
        .order_by(Element.id)
    ).all()


@router.post(
    "/elements/",
    response_model=ElementRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def add_element(element: ElementCreate, db: Session = Depends(get_db)):
    new_element = Element(**element.model_dump())
    db.add(new_element)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save element",
        ) from error
    db.refresh(new_element)
    return new_element


@router.patch(
    "/elements/{element_id}",
    response_model=ElementRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def edit_element(element_id: int, update: ElementUpdate, db: Session = Depends(get_db)):
    element = db.query(Element).filter(
        Element.id == element_id,
        Element.deleted_at.is_(None),
    ).first()
    if element is None:
        raise HTTPException(status_code=404, detail="Element not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")
    if "element_name" in changes and changes["element_name"] is None:
        raise HTTPException(status_code=422, detail="Required fields cannot be null")

    for field, value in changes.items():
        setattr(element, field, value)
    element.updated_at = datetime.now(timezone.utc)
    sync_daily_inputs_for_element(db, element)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save element",
        ) from error
    db.refresh(element)
    return element


@router.delete(
    "/elements/{element_id}",
    response_model=ElementRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def delete_element(element_id: int, db: Session = Depends(get_db)):
    element = db.query(Element).filter(
        Element.id == element_id,
        Element.deleted_at.is_(None),
    ).first()
    if element is None:
        raise HTTPException(status_code=404, detail="Element not found")

    now = datetime.now(timezone.utc)
    element.deleted_at = now
    element.updated_at = now
    db.commit()
    db.refresh(element)
    return element