from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.database import get_db
from models.product import Product, ProductRawMaterial
from models.raw_material import RawMaterial
from routes.user import require_roles
from schemas.product_schema import ProductCreate, ProductRead, ProductUpdate
from services.code_generator import get_next_resource_code

router = APIRouter(tags=["products"])


def _populate_product_read(p: Product, db: Session) -> ProductRead:
    item = ProductRead.model_validate(p)
    raw_material_items = []

    # 1. From relationship product_raw_materials
    if p.product_raw_materials:
        for prm in p.product_raw_materials:
            rm = prm.raw_material or db.query(RawMaterial).filter(RawMaterial.id == prm.raw_material_id).first()
            if rm:
                qty_val = float(prm.quantity) if prm.quantity is not None else 1.0
                raw_material_items.append({
                    "raw_material_id": rm.id,
                    "quantity": qty_val,
                    "material_name": rm.material_name,
                    "code": rm.code,
                    "unit": rm.unit,
                })
    # 2. Or from raw_material_ids JSON
    elif p.raw_material_ids and isinstance(p.raw_material_ids, list):
        rms = db.query(RawMaterial).filter(RawMaterial.id.in_(p.raw_material_ids)).all()
        rm_map = {rm.id: rm for rm in rms}
        for rid in p.raw_material_ids:
            if rid in rm_map:
                rm = rm_map[rid]
                raw_material_items.append({
                    "raw_material_id": rm.id,
                    "quantity": 1.0,
                    "material_name": rm.material_name,
                    "code": rm.code,
                    "unit": rm.unit,
                })
    # 3. Or fallback to raw_material
    elif p.raw_material:
        rm = p.raw_material
        raw_material_items.append({
            "raw_material_id": rm.id,
            "quantity": 1.0,
            "material_name": rm.material_name,
            "code": rm.code,
            "unit": rm.unit,
        })

    item.raw_materials = raw_material_items
    item.raw_material_ids = [it["raw_material_id"] for it in raw_material_items]
    item.raw_material_names = [it["material_name"] for it in raw_material_items if it.get("material_name")]

    # Formatted description with each raw material's quantity & unit
    # e.g., "Wire (2 mtrs), Core (1 num)"
    formatted_labels = []
    for it in raw_material_items:
        mname = it.get("material_name") or f"Material #{it['raw_material_id']}"
        qty = it.get("quantity")
        unit = it.get("unit") or ""
        if qty is not None:
            qty_str = f"{qty:g}"
            formatted_labels.append(f"{mname} ({qty_str} {unit})".strip())
        else:
            formatted_labels.append(f"{mname} ({unit})".strip() if unit else mname)

    item.raw_material_name = ", ".join(formatted_labels) if formatted_labels else (
        p.raw_material.material_name if p.raw_material else None
    )
    if not item.raw_material_id and item.raw_material_ids:
        item.raw_material_id = item.raw_material_ids[0]

    # Resolve element and welded_element
    if p.element_id:
        el = p.element or db.query(Product).filter(Product.id == p.element_id).first()
        if el:
            item.element_id = el.id
            item.element_name = el.name
            item.element_code = el.code
    if p.welded_element_id:
        we = p.welded_element or db.query(Product).filter(Product.id == p.welded_element_id).first()
        if we:
            item.welded_element_id = we.id
            item.welded_element_name = we.name
            item.welded_element_code = we.code

    prd_type = str(p.type or "").strip().lower()
    if prd_type == "welded element" and item.element_name:
        item.component_name = f"Element: {item.element_name}"
    elif prd_type == "capacitor" and item.welded_element_name:
        item.component_name = f"Welded Element: {item.welded_element_name}"
    else:
        item.component_name = None

    if p.has_zach_code or p.zach_code:
        item.has_zach_code = True
        item.zach_code = p.zach_code
        item.component_name = None

    return item


@router.get(
    "/get-products",
    response_model=list[ProductRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def get_products(db: Session = Depends(get_db)):
    products = db.scalars(
        select(Product)
        .where(Product.deleted_at.is_(None))
        .order_by(Product.id)
    ).all()
    return [_populate_product_read(p, db) for p in products]


@router.post(
    "/products/",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def add_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    data = product_in.model_dump()
    raw_materials_input = data.pop("raw_materials", None)
    raw_material_ids = data.pop("raw_material_ids", None) or []

    has_zach = bool(data.get("has_zach_code") or (data.get("zach_code") and str(data.get("zach_code")).strip()))
    items_to_save = []

    if has_zach:
        data["has_zach_code"] = True
        data["element_id"] = None
        data["welded_element_id"] = None
    else:
        data["has_zach_code"] = False
        data["zach_code"] = None

        prd_type = str(data.get("type") or "").strip().lower()
        if prd_type == "element":
            data["element_id"] = None
            data["welded_element_id"] = None
        elif prd_type == "welded element":
            data["welded_element_id"] = None
        elif prd_type == "capacitor":
            data["element_id"] = None

    if raw_materials_input and isinstance(raw_materials_input, list):
        for it in raw_materials_input:
            if isinstance(it, dict) and (it.get("raw_material_id") or it.get("id")):
                rid = int(it.get("raw_material_id") or it.get("id"))
                qty = it.get("quantity")
                try:
                    qty = float(qty) if qty is not None and str(qty).strip() != "" else 1.0
                except (ValueError, TypeError):
                    qty = 1.0
                items_to_save.append((rid, qty))
            elif isinstance(it, (int, str)):
                items_to_save.append((int(it), 1.0))
    elif raw_material_ids and isinstance(raw_material_ids, list):
        for rid in raw_material_ids:
            items_to_save.append((int(rid), 1.0))
    elif data.get("raw_material_id"):
        items_to_save.append((int(data["raw_material_id"]), 1.0))

    data["raw_material_ids"] = [rid for rid, _ in items_to_save]
    if data["raw_material_ids"]:
        data["raw_material_id"] = data["raw_material_ids"][0]
    else:
        data["raw_material_id"] = None

    code = get_next_resource_code(db, Product, Product.code, "P")
    new_product = Product(code=code, **data)
    db.add(new_product)
    db.flush()

    for rm_id, qty in items_to_save:
        db.add(ProductRawMaterial(product_id=new_product.id, raw_material_id=rm_id, quantity=qty))

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save product",
        ) from error
    db.refresh(new_product)
    return _populate_product_read(new_product, db)


@router.patch(
    "/products/{product_id}",
    response_model=ProductRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def edit_product(product_id: int, update: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.deleted_at.is_(None),
    ).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")

    has_zach_key_present = "has_zach_code" in changes or "zach_code" in changes
    if has_zach_key_present:
        has_zach = changes.get("has_zach_code")
        if has_zach is None:
            has_zach = bool(changes.get("zach_code") and str(changes.get("zach_code")).strip())
        else:
            has_zach = bool(has_zach)
    else:
        has_zach = bool(product.has_zach_code or (product.zach_code and str(product.zach_code).strip()))

    raw_materials_changed = False
    items_to_save = []

    raw_materials_input = changes.pop("raw_materials", None)
    raw_material_ids_input = changes.pop("raw_material_ids", None)

    if has_zach:
        changes["has_zach_code"] = True
        changes["element_id"] = None
        changes["welded_element_id"] = None
    else:
        if has_zach_key_present:
            changes["has_zach_code"] = False
            changes["zach_code"] = None

        current_type = str(changes.get("type") or product.type or "").strip().lower()
        if current_type == "element":
            changes["element_id"] = None
            changes["welded_element_id"] = None
        elif current_type == "welded element":
            changes["welded_element_id"] = None
        elif current_type == "capacitor":
            changes["element_id"] = None

    if raw_materials_input is not None:
        raw_materials_changed = True
        for it in raw_materials_input:
            if isinstance(it, dict) and (it.get("raw_material_id") or it.get("id")):
                rid = int(it.get("raw_material_id") or it.get("id"))
                qty = it.get("quantity")
                try:
                    qty = float(qty) if qty is not None and str(qty).strip() != "" else 1.0
                except (ValueError, TypeError):
                    qty = 1.0
                items_to_save.append((rid, qty))
            elif isinstance(it, (int, str)):
                items_to_save.append((int(it), 1.0))
    elif raw_material_ids_input is not None:
        raw_materials_changed = True
        for rid in raw_material_ids_input:
            items_to_save.append((int(rid), 1.0))
    elif "raw_material_id" in changes:
        raw_materials_changed = True
        rm_id = changes.get("raw_material_id")
        if rm_id:
            items_to_save.append((int(rm_id), 1.0))

    if raw_materials_changed:
        changes["raw_material_ids"] = [rid for rid, _ in items_to_save]
        changes["raw_material_id"] = changes["raw_material_ids"][0] if changes["raw_material_ids"] else None

    for field, value in changes.items():
        setattr(product, field, value)
    product.updated_at = datetime.now(timezone.utc)

    if raw_materials_changed:
        db.query(ProductRawMaterial).filter(ProductRawMaterial.product_id == product.id).delete()
        for rm_id, qty in items_to_save:
            db.add(ProductRawMaterial(product_id=product.id, raw_material_id=rm_id, quantity=qty))

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Failed to save product",
        ) from error
    db.refresh(product)
    return _populate_product_read(product, db)


@router.delete(
    "/products/{product_id}",
    response_model=ProductRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.deleted_at.is_(None),
    ).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.now(timezone.utc)
    product.deleted_at = now
    product.updated_at = now
    db.commit()
    db.refresh(product)
    return _populate_product_read(product, db)
