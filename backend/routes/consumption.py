from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.consumption import Consumption, ConsumptionRawMaterial
from models.product import Product
from models.raw_material import RawMaterial
from models.user import User
from routes.user import require_roles
from schemas.consumption_schema import (
    ConsumptionBulkDelete,
    ConsumptionCreate,
    ConsumptionRead,
    ConsumptionUpdate,
)
from services.code_generator import get_next_resource_code

router = APIRouter(prefix="/consumption", tags=["consumption"])
permissions = [Depends(require_roles("admin", "supervisor"))]


def _build_raw_materials_list(raw_materials_input, db: Session):
    """
    Normalizes a list of raw material inputs:
    [{ "raw_material_id": 1, "quantity": 2.5 }, ...] or IDs,
    queries the database for canonical names/units/codes, and returns
    (items_for_json, items_for_junction, raw_material_ids).
    """
    if not raw_materials_input or not isinstance(raw_materials_input, list):
        return [], [], []

    raw_items = []
    junction_items = []
    raw_material_ids = []

    for item in raw_materials_input:
        if not item:
            continue
        if isinstance(item, dict):
            rm_id = item.get("raw_material_id") or item.get("id")
            qty = item.get("quantity")
        else:
            rm_id = item
            qty = 1.0

        try:
            rm_id = int(rm_id)
        except (ValueError, TypeError):
            continue

        try:
            qty_val = float(qty) if qty is not None and str(qty).strip() != "" else 1.0
        except (ValueError, TypeError):
            qty_val = 1.0

        rm = db.query(RawMaterial).filter(RawMaterial.id == rm_id).first()
        mat_name = rm.material_name if rm else (item.get("material_name") if isinstance(item, dict) else f"Raw Material #{rm_id}")
        code = rm.code if rm else (item.get("code") if isinstance(item, dict) else "")
        unit = rm.unit if rm else (item.get("unit") if isinstance(item, dict) else "")

        raw_items.append({
            "raw_material_id": rm_id,
            "quantity": qty_val,
            "material_name": mat_name,
            "code": code,
            "unit": unit,
        })
        junction_items.append((rm_id, Decimal(str(qty_val))))
        raw_material_ids.append(rm_id)

    return raw_items, junction_items, raw_material_ids


def _build_summary(raw_materials_list: list) -> str:
    if not raw_materials_list:
        return "—"
    parts = []
    for it in raw_materials_list:
        name = it.get("material_name") or f"RM #{it.get('raw_material_id')}"
        qty = it.get("quantity")
        unit = it.get("unit")
        unit_str = f" {unit}" if unit else ""
        if qty is not None and str(qty).strip() != "":
            parts.append(f"{name} ({qty}{unit_str})")
        else:
            parts.append(name)
    return ", ".join(parts) if parts else "—"


def _populate_consumption_read(c: Consumption, db: Session) -> ConsumptionRead:
    raw_items = []
    if c.consumption_raw_materials:
        for crm in c.consumption_raw_materials:
            rm = crm.raw_material or db.query(RawMaterial).filter(RawMaterial.id == crm.raw_material_id).first()
            qty_val = float(crm.quantity) if crm.quantity is not None else 1.0
            raw_items.append({
                "raw_material_id": crm.raw_material_id,
                "quantity": qty_val,
                "material_name": rm.material_name if rm else f"RM #{crm.raw_material_id}",
                "code": rm.code if rm else "",
                "unit": rm.unit if rm else "",
            })
    elif c.raw_materials and isinstance(c.raw_materials, list):
        for it in c.raw_materials:
            if isinstance(it, dict):
                raw_items.append(it)
            elif isinstance(it, (int, str)):
                rm = db.query(RawMaterial).filter(RawMaterial.id == int(it)).first()
                if rm:
                    raw_items.append({
                        "raw_material_id": rm.id,
                        "quantity": 1.0,
                        "material_name": rm.material_name,
                        "code": rm.code,
                        "unit": rm.unit,
                    })

    p_name = c.product_name
    p_code = c.product_code
    if c.product_id and (not p_name or not p_code):
        prod = db.query(Product).filter(Product.id == c.product_id).first()
        if prod:
            if not p_name:
                p_name = prod.name
            if not p_code:
                p_code = prod.code

    return ConsumptionRead(
        id=c.id,
        code=c.code,
        date=c.date,
        product_id=c.product_id,
        product_name=p_name,
        product_code=p_code,
        quantity=c.quantity,
        unit=c.unit,
        raw_materials=raw_items,
        raw_material_ids=c.raw_material_ids or [it["raw_material_id"] for it in raw_items if "raw_material_id" in it],
        raw_material_summary=_build_summary(raw_items),
        remarks=c.remarks,
        user_id=c.user_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
        deleted_at=c.deleted_at,
    )


@router.get("/", response_model=list[ConsumptionRead], dependencies=permissions)
async def get_consumptions(db: Session = Depends(get_db)):
    records = db.scalars(
        select(Consumption)
        .where(Consumption.deleted_at.is_(None))
        .order_by(Consumption.id.desc())
    ).all()
    return [_populate_consumption_read(r, db) for r in records]


@router.post("/", response_model=ConsumptionRead, status_code=status.HTTP_201_CREATED)
async def add_consumption(
    entry: ConsumptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    data = entry.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id

    # Lookup product details if product_id is provided
    if data.get("product_id"):
        prod = db.query(Product).filter(Product.id == data["product_id"]).first()
        if prod:
            if not data.get("product_name"):
                data["product_name"] = prod.name
            if not data.get("product_code"):
                data["product_code"] = prod.code

    # Build raw materials list and junction records
    raw_materials_input = data.pop("raw_materials", None)
    raw_material_ids_input = data.pop("raw_material_ids", None)
    effective_rm_input = raw_materials_input if raw_materials_input is not None else raw_material_ids_input

    raw_items, junction_items, rm_ids = _build_raw_materials_list(effective_rm_input, db)
    data["raw_materials"] = raw_items
    data["raw_material_ids"] = rm_ids

    # Generate sequential code
    try:
        code = get_next_resource_code(db, Consumption, Consumption.code, "CN")
    except Exception:
        code = None

    new_record = Consumption(code=code, **data)
    db.add(new_record)
    db.flush()

    # Create junction table rows
    for rm_id, qty in junction_items:
        db.add(ConsumptionRawMaterial(
            consumption_id=new_record.id,
            raw_material_id=rm_id,
            quantity=qty,
        ))

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Failed to save consumption record") from error

    db.refresh(new_record)
    return _populate_consumption_read(new_record, db)


@router.patch("/{consumption_id}", response_model=ConsumptionRead, dependencies=permissions)
async def edit_consumption(
    consumption_id: int,
    update: ConsumptionUpdate,
    db: Session = Depends(get_db),
):
    record = db.query(Consumption).filter(
        Consumption.id == consumption_id,
        Consumption.deleted_at.is_(None),
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Consumption record not found")

    changes = update.model_dump(exclude_unset=True)

    if "product_id" in changes and changes["product_id"]:
        prod = db.query(Product).filter(Product.id == changes["product_id"]).first()
        if prod:
            changes["product_name"] = prod.name
            changes["product_code"] = prod.code

    if "raw_materials" in changes or "raw_material_ids" in changes:
        effective_rm_input = changes.pop("raw_materials", None)
        if effective_rm_input is None:
            effective_rm_input = changes.pop("raw_material_ids", None)
        else:
            changes.pop("raw_material_ids", None)

        raw_items, junction_items, rm_ids = _build_raw_materials_list(effective_rm_input, db)
        changes["raw_materials"] = raw_items
        changes["raw_material_ids"] = rm_ids

        # Update junction table entries
        db.query(ConsumptionRawMaterial).filter(
            ConsumptionRawMaterial.consumption_id == record.id
        ).delete()
        for rm_id, qty in junction_items:
            db.add(ConsumptionRawMaterial(
                consumption_id=record.id,
                raw_material_id=rm_id,
                quantity=qty,
            ))

    for field, value in changes.items():
        setattr(record, field, value)

    record.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Failed to update consumption record") from error

    db.refresh(record)
    return _populate_consumption_read(record, db)


def _soft_delete_consumptions(ids: list[int], db: Session):
    if not ids:
        raise HTTPException(status_code=400, detail="No consumption IDs provided")

    records = db.query(Consumption).filter(
        Consumption.id.in_(ids),
        Consumption.deleted_at.is_(None),
    ).all()

    if not records:
        raise HTTPException(status_code=404, detail="No active consumption records found")

    now = datetime.now(timezone.utc)
    for r in records:
        r.deleted_at = now
        r.updated_at = now

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete consumption records")

    return {
        "message": "Selected consumption records deleted successfully",
        "deleted_count": len(records),
        "deleted_ids": [r.id for r in records],
    }


@router.delete("/{consumption_id}", dependencies=permissions)
async def delete_consumption(consumption_id: int, db: Session = Depends(get_db)):
    return _soft_delete_consumptions([consumption_id], db)


@router.delete("/", dependencies=permissions)
async def delete_consumptions(
    payload: ConsumptionBulkDelete,
    db: Session = Depends(get_db),
):
    return _soft_delete_consumptions(payload.ids, db)

