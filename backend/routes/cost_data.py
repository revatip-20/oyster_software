import math
from datetime import datetime, timezone
from decimal import Decimal

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


def compute_basic_cost_data(data: dict) -> dict:
    cost_type = data.get("type") or "Basic"
    if str(cost_type).strip().lower() != "basic":
        return data

    def to_float(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    film_width = to_float(data.get("mpp_film_width"))
    free_margin = to_float(data.get("film_free_margin")) or 0.0
    stagger = to_float(data.get("winding_stagger")) or 0.0
    basic_val = to_float(data.get("wound_cap_basic_value"))
    film_thickness = to_float(data.get("mpp_film_thickness"))
    core_od = to_float(data.get("core_od")) or 0.0

    # 1. Active width in mm = MPP film width - (2 * film free margin + winding stagger)
    if data.get("active_width") is None and film_width is not None and film_width > 0:
        calc_active_width = film_width - (2.0 * free_margin + stagger)
        data["active_width"] = Decimal(str(round(max(calc_active_width, 0.0), 2)))

    active_width = to_float(data.get("active_width"))

    # 2. Band length Mtrs = ((wound cap basic value * mpp film thickness * 10000) / (3.845 * active width in mm)) / 100
    if data.get("band_length") is None and basic_val and film_thickness and active_width and active_width > 0:
        calc_band_length = ((basic_val * film_thickness * 10000.0) / (3.845 * active_width)) / 100.0
        data["band_length"] = Decimal(str(round(calc_band_length, 2)))

    band_length = to_float(data.get("band_length"))

    # 3. Wound capacitor OD = (sqrt(band length mtrs * 100 * 2 * MPP film thickness) / (25 * (22 / 7))) + (Core OD + core OD)
    if data.get("wound_capacitor_od") is None and band_length and film_thickness:
        sqrt_term = math.sqrt(band_length * 100.0 * 2.0 * film_thickness)
        pi_term = 25.0 * (22.0 / 7.0)
        calc_od = (sqrt_term / pi_term) + (core_od + core_od)
        data["wound_capacitor_od"] = Decimal(str(round(calc_od, 2)))

    wound_cap_od = to_float(data.get("wound_capacitor_od"))

    # 4. Turns to be wound = (250 * (wound capacitor OD - core OD)) / MPP film thickness
    if data.get("turns_to_be_wound") is None and wound_cap_od and film_thickness and film_thickness > 0:
        calc_turns = (250.0 * (wound_cap_od - core_od)) / film_thickness
        data["turns_to_be_wound"] = Decimal(str(round(calc_turns, 2)))

    # 5. Wt of capacitor gms = (2 * band length mtrs * MPP film width in mm * MPP film thickness in mm * 0.9) / 1000
    if data.get("wt_of_capacitor") is None and band_length and film_width and film_thickness:
        calc_wt = (2.0 * band_length * film_width * film_thickness * 0.9) / 1000.0
        data["wt_of_capacitor"] = Decimal(str(round(calc_wt, 2)))

    return data


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
    data = compute_basic_cost_data(data)
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

    merged_data = {
        "type": changes.get("type", cost_data.type),
        "wound_cap_basic_value": changes.get("wound_cap_basic_value", cost_data.wound_cap_basic_value),
        "mpp_film_width": changes.get("mpp_film_width", cost_data.mpp_film_width),
        "mpp_film_thickness": changes.get("mpp_film_thickness", cost_data.mpp_film_thickness),
        "core_od": changes.get("core_od", cost_data.core_od),
        "film_free_margin": changes.get("film_free_margin", cost_data.film_free_margin),
        "winding_stagger": changes.get("winding_stagger", cost_data.winding_stagger),
        "active_width": changes.get("active_width", cost_data.active_width),
        "band_length": changes.get("band_length", cost_data.band_length),
        "wound_capacitor_od": changes.get("wound_capacitor_od", cost_data.wound_capacitor_od),
        "turns_to_be_wound": changes.get("turns_to_be_wound", cost_data.turns_to_be_wound),
        "wt_of_capacitor": changes.get("wt_of_capacitor", cost_data.wt_of_capacitor),
    }
    computed = compute_basic_cost_data(merged_data)
    for field in ["active_width", "band_length", "wound_capacitor_od", "turns_to_be_wound", "wt_of_capacitor"]:
        if field in changes:
            continue
        if computed.get(field) is not None and getattr(cost_data, field) is None:
            changes[field] = computed[field]

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
