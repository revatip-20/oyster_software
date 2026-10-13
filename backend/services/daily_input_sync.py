from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from models.daily_input import DailyInput


TWOPLACES = Decimal("0.01")


def _as_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def recalculate_amounts(
    entry: DailyInput,
    *,
    rate,
    cgst_percent,
    ut_sgst_percent,
    igst_percent,
) -> None:
    quantity = _as_decimal(entry.quantity)
    amount = (quantity * _as_decimal(rate)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    cgst_amount = (amount * _as_decimal(cgst_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    ut_sgst_amount = (amount * _as_decimal(ut_sgst_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    igst_amount = (amount * _as_decimal(igst_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    total_amount = (amount + cgst_amount + ut_sgst_amount + igst_amount).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )

    entry.amount = amount
    entry.cgst_amount = cgst_amount
    entry.ut_sgst_amount = ut_sgst_amount
    entry.igst_amount = igst_amount
    entry.total_amount = total_amount


def sync_daily_inputs_for_raw_material(db: Session, material) -> int:
    entries = (
        db.query(DailyInput)
        .filter(
            DailyInput.raw_material_id == material.id,
            DailyInput.deleted_at.is_(None),
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.item = material.material_name
        if hasattr(entry, "unit"):
            entry.unit = material.unit
        recalculate_amounts(
            entry,
            rate=material.rate,
            cgst_percent=material.cgst_percent,
            ut_sgst_percent=material.ut_sgst_percent,
            igst_percent=material.igst_percent,
        )
        entry.updated_at = now
    return len(entries)


def sync_daily_inputs_for_element(db: Session, element) -> int:
    entries = (
        db.query(DailyInput)
        .filter(
            DailyInput.element_id == element.id,
            DailyInput.deleted_at.is_(None),
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.item = element.element_name
        if hasattr(entry, "unit"):
            entry.unit = element.unit
        entry.updated_at = now
    return len(entries)
