from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from routes.user import require_roles
from services.balance_service import check_month_end_status, execute_month_end_rollover

router = APIRouter(prefix="/stock-balance", tags=["stock balance"])


class ProcessBalanceRequest(BaseModel):
    target_month: Optional[str] = None
    section: Optional[str] = None
    item_ids: Optional[list[int]] = None


@router.get(
    "/status",
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
async def get_balance_status(db: Session = Depends(get_db)):
    try:
        return check_month_end_status(db)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@router.post(
    "/process",
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
async def process_month_end_balance(
    payload: Optional[ProcessBalanceRequest] = None,
    db: Session = Depends(get_db),
):
    try:
        target_month = payload.target_month if payload else None
        section = payload.section if payload else None
        item_ids = payload.item_ids if payload else None
        return execute_month_end_rollover(
            db, target_month=target_month, section=section, item_ids=item_ids
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

