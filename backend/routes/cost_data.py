from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.database import get_db
from models.cost_data import CostData
from routes.user import require_roles
from schemas.cost_data_schema import CostDataCreate, CostDataRead, CostDataUpdate
from services.code_generator import get_next_resource_code

router = APIRouter(tags=["cost_data"])


@router.get(
    "/get-cost-data",
    response_model=list[CostDataRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
async def get_cost_data_list(db: Session = Depends(get_db)):
    return db.scalars(
        select(CostData)
        .where(CostData.deleted_at.is_(None))
        .order_by(CostData.id)
    ).all()


@router.post(
    "/cost-data/",
    response_model=CostDataRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
async def add_cost_data(cost_data_in: CostDataCreate, db: Session = Depends(get_db)):
    data = cost_data_in.model_dump()
    code = get_next_resource_code(db, CostData, CostData.code, "CD")
    new_cost_data = CostData(code=code, **data)
    db.add(new_cost_data)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save cost data",
        ) from error
    db.refresh(new_cost_data)
    return new_cost_data


@router.patch(
    "/cost-data/{cost_data_id}",
    response_model=CostDataRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
async def edit_cost_data(cost_data_id: int, update: CostDataUpdate, db: Session = Depends(get_db)):
    cost_data = db.query(CostData).filter(
        CostData.id == cost_data_id,
        CostData.deleted_at.is_(None),
    ).first()
    if cost_data is None:
        raise HTTPException(status_code=404, detail="Cost data not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")
    for field, value in changes.items():
        setattr(cost_data, field, value)
    cost_data.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save cost data",
        ) from error
    db.refresh(cost_data)
    return cost_data


@router.delete(
    "/cost-data/{cost_data_id}",
    response_model=CostDataRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
async def delete_cost_data(cost_data_id: int, db: Session = Depends(get_db)):
    cost_data = db.query(CostData).filter(
        CostData.id == cost_data_id,
        CostData.deleted_at.is_(None),
    ).first()
    if cost_data is None:
        raise HTTPException(status_code=404, detail="Cost data not found")

    now = datetime.now(timezone.utc)
    cost_data.deleted_at = now
    cost_data.updated_at = now
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(cost_data)
    return cost_data
