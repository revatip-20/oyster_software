from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from models.raw_material import RawMaterial
from models.product import Product, ProductRawMaterial
from models.daily_input import DailyInput
from models.daily_dispatch import DailyDispatch
from models.consumption import Consumption, ConsumptionRawMaterial


def get_product_bom_raw_materials(
    product_id: int,
    db: Session,
    visited: set | None = None,
    prod_lookup: dict[int, Product] | None = None,
    prms_by_product: dict[int, list[ProductRawMaterial]] | None = None,
) -> dict[int, float]:
    """
    Returns a dictionary mapping raw_material_id -> required_qty_per_unit_of_product,
    recursing through welded_element and element sub-components.
    Optional in-memory lookups (prod_lookup, prms_by_product) prevent N+1 queries.
    """
    if visited is None:
        visited = set()
    if product_id in visited:
        return {}
    visited.add(product_id)

    if prod_lookup is not None:
        prod = prod_lookup.get(product_id)
    else:
        prod = db.query(Product).filter(Product.id == product_id, Product.deleted_at.is_(None)).first()
    if not prod:
        return {}

    rm_map: dict[int, float] = {}

    # 1. Direct raw materials configured on this product
    if prms_by_product is not None:
        direct_prms = prms_by_product.get(prod.id, [])
    else:
        direct_prms = db.query(ProductRawMaterial).filter(ProductRawMaterial.product_id == prod.id).all()

    if direct_prms:
        for prm in direct_prms:
            qty = float(prm.quantity or 1.0)
            rm_map[prm.raw_material_id] = rm_map.get(prm.raw_material_id, 0.0) + qty
    elif prod.raw_material_ids and isinstance(prod.raw_material_ids, list):
        for rid in prod.raw_material_ids:
            try:
                rid_int = int(rid)
                rm_map[rid_int] = rm_map.get(rid_int, 0.0) + 1.0
            except (ValueError, TypeError):
                continue
    elif prod.raw_material_id:
        rm_map[prod.raw_material_id] = rm_map.get(prod.raw_material_id, 0.0) + 1.0

    # 2. Check welded_element component (for capacitor)
    if prod.welded_element_id and prod.welded_element_id not in visited:
        welded_map = get_product_bom_raw_materials(
            prod.welded_element_id, db, visited, prod_lookup, prms_by_product
        )
        for rm_id, qty in welded_map.items():
            rm_map[rm_id] = rm_map.get(rm_id, 0.0) + qty

    # 3. Check element component (for welded element or capacitor)
    if prod.element_id and prod.element_id not in visited:
        element_map = get_product_bom_raw_materials(
            prod.element_id, db, visited, prod_lookup, prms_by_product
        )
        for rm_id, qty in element_map.items():
            rm_map[rm_id] = rm_map.get(rm_id, 0.0) + qty

    return rm_map


def update_raw_material_balance(rm: RawMaterial):
    ob = float(rm.open_balance or 0.0)
    rc = float(rm.received or 0.0)
    cn = float(rm.consumption or 0.0)
    rm.close_balance = round(ob + rc - cn, 4)
    rm.updated_at = datetime.now(timezone.utc)


def update_product_balance(prod: Product):
    ob = float(prod.open_balance or 0.0)
    rc = float(prod.received or 0.0)
    cn = float(prod.consumption or 0.0)
    prod.close_balance = round(ob + rc - cn, 4)
    prod.updated_at = datetime.now(timezone.utc)


def handle_daily_input_received(entry: DailyInput, db: Session, qty_delta: float | None = None):
    """
    When Daily Input is added/updated/deleted:
    Add (or adjust) quantity in received for the corresponding raw material or product.
    """
    qty = qty_delta if qty_delta is not None else float(entry.quantity or 0.0)
    if qty == 0.0:
        return

    # Check if Raw Material
    if entry.type == "raw_material" or entry.raw_material_id:
        rm = None
        if entry.raw_material_id:
            rm = db.query(RawMaterial).filter(RawMaterial.id == entry.raw_material_id).first()
        elif entry.item:
            rm = db.query(RawMaterial).filter(
                RawMaterial.material_name.ilike(str(entry.item).strip()),
                RawMaterial.deleted_at.is_(None),
            ).first()
        if rm:
            rm.received = round(float(rm.received or 0.0) + qty, 4)
            update_raw_material_balance(rm)
            return

    # Check if Product / Element
    if entry.type in ("product", "element") or entry.product_id or entry.element_id:
        target_id = entry.product_id or entry.element_id
        prod = None
        if target_id:
            prod = db.query(Product).filter(Product.id == target_id).first()
        elif entry.item:
            prod = db.query(Product).filter(
                Product.name.ilike(str(entry.item).strip()),
                Product.deleted_at.is_(None),
            ).first()
        if prod:
            prod.received = round(float(prod.received or 0.0) + qty, 4)
            update_product_balance(prod)
            return


def handle_daily_dispatch_consumption(entry: DailyDispatch, db: Session, qty_delta: float | None = None):
    """
    When Daily Dispatch is added/updated/deleted:
    Add (or adjust) quantity in consumption for the sent product or raw material.
    """
    if qty_delta is not None:
        qty = qty_delta
    else:
        out_q = float(entry.out_quantity or 0.0)
        q = float(entry.quantity or 0.0)
        ok_rej = float(entry.ok or 0.0) + float(entry.reject or 0.0)
        qty = out_q if out_q > 0 else (ok_rej if ok_rej > 0 else q)

    if qty == 0.0:
        return

    # 1. Check daily_input_id link if present
    di = db.query(DailyInput).filter(DailyInput.id == entry.daily_input_id).first() if entry.daily_input_id else None
    type_str = str(entry.type or "").strip().lower()

    # If explicitly typed as element/welded element/capacitor or has product_id, match product first
    if type_str in ("element", "welded element", "capacitor") or entry.product_id:
        target_prod_id = entry.product_id or (di.product_id or di.element_id if di else None)
        prod = None
        if target_prod_id:
            prod = db.query(Product).filter(Product.id == target_prod_id).first()
        elif entry.item:
            prod = db.query(Product).filter(
                Product.name.ilike(str(entry.item).strip()),
                Product.deleted_at.is_(None),
            ).first()
        if prod:
            prod.consumption = round(float(prod.consumption or 0.0) + qty, 4)
            update_product_balance(prod)
            return

    # Check if Raw Material
    is_rm = False
    rm = None
    if di and (di.type == "raw_material" or di.raw_material_id):
        is_rm = True
        rm = db.query(RawMaterial).filter(RawMaterial.id == di.raw_material_id).first() if di.raw_material_id else None
    elif type_str == "raw_material":
        is_rm = True
        if entry.item:
            rm = db.query(RawMaterial).filter(
                RawMaterial.material_name.ilike(str(entry.item).strip()),
                RawMaterial.deleted_at.is_(None),
            ).first()
    elif entry.item:
        rm_match = db.query(RawMaterial).filter(
            RawMaterial.material_name.ilike(str(entry.item).strip()),
            RawMaterial.deleted_at.is_(None),
        ).first()
        if rm_match and not (entry.product_id or (di and (di.product_id or di.element_id))):
            is_rm = True
            rm = rm_match

    if is_rm and rm:
        rm.consumption = round(float(rm.consumption or 0.0) + qty, 4)
        update_raw_material_balance(rm)
        return

    # Fallback to Product if not matched above
    target_prod_id = entry.product_id or (di.product_id or di.element_id if di else None)
    prod = None
    if target_prod_id:
        prod = db.query(Product).filter(Product.id == target_prod_id).first()
    elif entry.item:
        prod = db.query(Product).filter(
            Product.name.ilike(str(entry.item).strip()),
            Product.deleted_at.is_(None),
        ).first()

    if prod:
        prod.consumption = round(float(prod.consumption or 0.0) + qty, 4)
        update_product_balance(prod)
        return


def handle_consumption_stock_update(
    entry: Consumption,
    db: Session,
    raw_materials_list: list[dict] | None = None,
    is_delete: bool = False,
):
    """
    When Daily Consumption is recorded:
    1. If product_id / product_name / product_code: product.consumption += prod_qty
    2. For each raw material required for that element/welded element/capacitor:
       raw_material.consumption += (prod_qty * required_qty_per_unit)
    """
    multiplier = -1.0 if is_delete else 1.0
    prod_qty = float(entry.quantity or 1.0) * multiplier

    effective_rm_list = raw_materials_list
    if effective_rm_list is None:
        if entry.id:
            crms = db.query(ConsumptionRawMaterial).filter(ConsumptionRawMaterial.consumption_id == entry.id).all()
            if crms:
                effective_rm_list = [{"raw_material_id": crm.raw_material_id, "quantity": float(crm.quantity or 1.0)} for crm in crms]
        if not effective_rm_list and entry.raw_materials and isinstance(entry.raw_materials, list):
            effective_rm_list = entry.raw_materials

    target_prod = None
    if entry.product_id:
        target_prod = db.query(Product).filter(Product.id == entry.product_id).first()
    elif entry.product_name:
        target_prod = db.query(Product).filter(
            Product.name.ilike(str(entry.product_name).strip()),
            Product.deleted_at.is_(None),
        ).first()
    elif entry.product_code:
        target_prod = db.query(Product).filter(
            Product.code.ilike(str(entry.product_code).strip()),
            Product.deleted_at.is_(None),
        ).first()

    if target_prod:
        target_prod.consumption = round(float(target_prod.consumption or 0.0) + prod_qty, 4)
        update_product_balance(target_prod)

        # Get all BOM required raw materials for this element, welded element, or capacitor
        bom_map = get_product_bom_raw_materials(target_prod.id, db)

        items_to_use = dict(bom_map)
        if effective_rm_list:
            for item in effective_rm_list:
                if not item:
                    continue
                rm_id = int(item.get("raw_material_id") or item.get("id") or 0)
                if rm_id > 0:
                    q = float(item.get("quantity") or 1.0)
                    items_to_use[rm_id] = q

        # Update each required raw material's consumption
        for rm_id, qty_per_unit in items_to_use.items():
            rm = db.query(RawMaterial).filter(RawMaterial.id == rm_id).first()
            if rm:
                consumed_rm_qty = prod_qty * qty_per_unit
                rm.consumption = round(float(rm.consumption or 0.0) + consumed_rm_qty, 4)
                update_raw_material_balance(rm)
        return

    # If no product found, but raw materials directly in consumption entry
    if effective_rm_list:
        for item in effective_rm_list:
            if not item:
                continue
            rm_id = int(item.get("raw_material_id") or item.get("id") or 0)
            if rm_id > 0:
                q = float(item.get("quantity") or 1.0) * multiplier
                rm = db.query(RawMaterial).filter(RawMaterial.id == rm_id).first()
                if rm:
                    rm.consumption = round(float(rm.consumption or 0.0) + q, 4)
                    update_raw_material_balance(rm)
