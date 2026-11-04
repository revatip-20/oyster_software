import calendar
from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.orm import Session


def get_current_and_next_month(dt: date | None = None) -> tuple[str, str, bool]:
    """
    Returns (current_month_str, next_month_str, is_near_month_end).
    End of month is considered to be the 28th or later (e.g. 28th-31st).
    """
    if dt is None:
        dt = date.today()
    current_month_str = dt.strftime("%Y-%m")
    _, last_day = calendar.monthrange(dt.year, dt.month)
    is_near_month_end = dt.day >= min(28, last_day)

    if dt.month == 12:
        next_month_str = f"{dt.year + 1}-01"
    else:
        next_month_str = f"{dt.year}-{dt.month + 1:02d}"

    return current_month_str, next_month_str, is_near_month_end


def check_month_end_status(db: Session) -> dict:
    today = date.today()
    current_month_str, next_month_str, is_near_month_end = get_current_and_next_month(today)

    latest_rm = db.execute(
        text("SELECT MAX(balance_month) FROM raw_material WHERE deleted_at IS NULL")
    ).scalar()
    latest_prd = db.execute(
        text("SELECT MAX(balance_month) FROM product WHERE deleted_at IS NULL")
    ).scalar()

    latest_month = latest_rm or latest_prd

    if not latest_month:
        try:
            db.execute(
                text("UPDATE raw_material SET balance_month = :m WHERE balance_month IS NULL"),
                {"m": current_month_str},
            )
            db.execute(
                text("UPDATE product SET balance_month = :m WHERE balance_month IS NULL"),
                {"m": current_month_str},
            )
            db.commit()
        except Exception:
            db.rollback()
        latest_month = current_month_str

    if latest_month < current_month_str:
        return {
            "needs_processing": True,
            "is_end_of_month": True,
            "current_balance_month": latest_month,
            "target_month": current_month_str,
            "today_date": today.strftime("%d/%m/%Y"),
            "message": f"Previous month ({latest_month}) data is pending month-end processing for {current_month_str}. Do you want to process the stock balance data now?",
        }

    if is_near_month_end and latest_month == current_month_str:
        return {
            "needs_processing": True,
            "is_end_of_month": True,
            "current_balance_month": current_month_str,
            "target_month": next_month_str,
            "today_date": today.strftime("%d/%m/%Y"),
            "message": f"It is the end of the month ({today.strftime('%d/%m/%Y')}). Do you want to process the stock balance data for next month ({next_month_str})?",
        }

    return {
        "needs_processing": False,
        "is_end_of_month": is_near_month_end,
        "current_balance_month": latest_month,
        "target_month": next_month_str if is_near_month_end else current_month_str,
        "today_date": today.strftime("%d/%m/%Y"),
        "message": "Stock balance data is up to date.",
    }


def execute_month_end_rollover(
    db: Session,
    target_month: str | None = None,
    section: str | None = None,
    item_ids: list[int] | None = None,
) -> dict:
    today = date.today()
    current_month_str, next_month_str, is_near_month_end = get_current_and_next_month(today)

    if not target_month:
        target_month = next_month_str if is_near_month_end else current_month_str

    should_process_rm = section is None or section.lower() in [
        "all", "both", "raw_material", "rawmaterials", "raw_materials"
    ]
    should_process_prd = section is None or section.lower() in [
        "all", "both", "product", "products"
    ]

    try:
        rm_count = 0
        prd_count = 0

        valid_ids = [int(i) for i in item_ids if str(i).isdigit()] if item_ids else []

        if should_process_rm:
            if valid_ids and section and section.lower() in ["raw_material", "rawmaterials", "raw_materials"]:
                rm_res = db.execute(
                    text(
                        """
                        UPDATE raw_material
                        SET open_balance = COALESCE(close_balance, 0),
                            received = 0,
                            consumption = 0,
                            close_balance = COALESCE(close_balance, 0),
                            balance_month = :target_month,
                            updated_at = NOW()
                        WHERE deleted_at IS NULL AND id = ANY(:item_ids);
                        """
                    ),
                    {"target_month": target_month, "item_ids": valid_ids},
                )
            else:
                rm_res = db.execute(
                    text(
                        """
                        UPDATE raw_material
                        SET open_balance = COALESCE(close_balance, 0),
                            received = 0,
                            consumption = 0,
                            close_balance = COALESCE(close_balance, 0),
                            balance_month = :target_month,
                            updated_at = NOW()
                        WHERE deleted_at IS NULL;
                        """
                    ),
                    {"target_month": target_month},
                )
            rm_count = rm_res.rowcount if hasattr(rm_res, "rowcount") else 0

        if should_process_prd:
            if valid_ids and section and section.lower() in ["product", "products"]:
                prd_res = db.execute(
                    text(
                        """
                        UPDATE product
                        SET open_balance = COALESCE(close_balance, 0),
                            received = 0,
                            consumption = 0,
                            close_balance = COALESCE(close_balance, 0),
                            balance_month = :target_month,
                            updated_at = NOW()
                        WHERE deleted_at IS NULL AND id = ANY(:item_ids);
                        """
                    ),
                    {"target_month": target_month, "item_ids": valid_ids},
                )
            else:
                prd_res = db.execute(
                    text(
                        """
                        UPDATE product
                        SET open_balance = COALESCE(close_balance, 0),
                            received = 0,
                            consumption = 0,
                            close_balance = COALESCE(close_balance, 0),
                            balance_month = :target_month,
                            updated_at = NOW()
                        WHERE deleted_at IS NULL;
                        """
                    ),
                    {"target_month": target_month},
                )
            prd_count = prd_res.rowcount if hasattr(prd_res, "rowcount") else 0

        db.commit()

        target_name = (
            "Raw Materials and Products" if should_process_rm and should_process_prd
            else "Raw Materials" if should_process_rm
            else "Products"
        )
        return {
            "ok": True,
            "target_month": target_month,
            "section": section or "all",
            "raw_materials_count": rm_count,
            "products_count": prd_count,
            "message": f"Successfully processed stock balances for {target_name}. Close balance has replaced Open balance.",
        }
    except Exception as e:
        db.rollback()
        raise e


# Backwards compatibility alias
rollover_monthly_balances = execute_month_end_rollover
