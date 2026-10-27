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
    cgst_percent=0,
    ut_sgst_percent=0,
    igst_percent=0,
    discount_percent=0,
) -> None:
    quantity = _as_decimal(entry.quantity)
    gross_amount = (quantity * _as_decimal(rate)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    discount_amount = (
        gross_amount * _as_decimal(discount_percent) / Decimal("100")
    ).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    amount = (gross_amount - discount_amount).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    cgst_amount = (amount * _as_decimal(cgst_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    ut_sgst_amount = (amount * _as_decimal(ut_sgst_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    igst_amount = (amount * _as_decimal(igst_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    total_amount = (
        amount + cgst_amount + ut_sgst_amount + igst_amount
    ).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    entry.basic_value = gross_amount
    entry.discount_amount = discount_amount
    entry.amount = amount
    entry.cgst_amount = cgst_amount
    entry.ut_sgst_amount = ut_sgst_amount
    entry.igst_amount = igst_amount
    entry.total_amount = total_amount
    if hasattr(entry, "discount_percent"):
        entry.discount_percent = _as_decimal(discount_percent)


def sync_daily_inputs_for_raw_material(db: Session, material) -> int:
    # Changing master raw material fields should not affect added daily inputs
    return 0


def sync_daily_inputs_for_product(db: Session, product) -> int:
    # Changing master product fields should not affect added daily inputs
    return 0


def sync_daily_inputs_for_element(db: Session, element) -> int:
    return 0
