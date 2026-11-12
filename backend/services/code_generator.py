import re
from datetime import date, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session


def get_next_resource_code(
    db: Session,
    model,
    code_column,
    prefix: str,
    padding: int = 4,
) -> str:
    """
    Checks the previous code values in the database for the given model and prefix,
    finds the highest numeric suffix, and generates the next one.
    For example:
        If previous code is R0002, the next generated code is R0003.
        If table has no matching codes, starts at R0001.
    """
    codes = db.scalars(
        select(code_column).where(code_column.isnot(None))
    ).all()

    max_num = 0
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    for code in codes:
        if not code:
            continue
        match = pattern.match(str(code).strip())
        if match:
            try:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass

    next_num = max_num + 1
    while True:
        candidate_code = f"{prefix}{next_num:0{padding}d}"
        exists = db.query(model.id).filter(code_column == candidate_code).first()
        if not exists:
            return candidate_code
        next_num += 1


def get_next_out_dc_no(db: Session, target_date=None) -> str:
    """
    Generates an incremental Out DC number in the format:
    YY-(YY+1)/<counter>, e.g. 26-27/42.
    In the next year (e.g. Jan 2027), starts from 27-28/1.
    """
    from models.daily_dispatch import DailyDispatch

    d = date.today()
    if target_date is not None:
        if isinstance(target_date, str):
            try:
                d = datetime.fromisoformat(target_date.strip()).date()
            except Exception:
                try:
                    parts = target_date.strip().replace("-", "/").split("/")
                    if len(parts) == 3:
                        if len(parts[2]) == 4:
                            d = date(int(parts[2]), int(parts[1]), int(parts[0]))
                        elif len(parts[0]) == 4:
                            d = date(int(parts[0]), int(parts[1]), int(parts[2]))
                except Exception:
                    d = date.today()
        elif isinstance(target_date, datetime):
            d = target_date.date()
        elif isinstance(target_date, date):
            d = target_date

    year = d.year
    yy = f"{year % 100:02d}"
    next_yy = f"{(year + 1) % 100:02d}"
    output_prefix = f"{yy}-{next_yy}/"

    records = db.scalars(
        select(DailyDispatch.out_dc_no).where(
            DailyDispatch.deleted_at.is_(None),
            DailyDispatch.out_dc_no.isnot(None),
        )
    ).all()

    pattern = re.compile(
        rf"^(?:20)?{yy}-(?:20)?{next_yy}/(\d+)$",
        re.IGNORECASE,
    )
    max_num = 0
    for dc_no in records:
        if not dc_no:
            continue
        m = pattern.match(str(dc_no).strip())
        if m:
            try:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass

    return f"{output_prefix}{max_num + 1}"

