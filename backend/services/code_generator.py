import re
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
