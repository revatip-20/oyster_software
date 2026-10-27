"""
Migration v6:
- Add pincode VARCHAR(20) to supplier table
- Add discount_amount NUMERIC(12, 2) to daily_input table

Usage:
    python backend/migrations/v6_supplier_pincode_discount_amount.py
    # or from backend directory:
    python migrations/v6_supplier_pincode_discount_amount.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

if not ENV_PATH.exists():
    ENV_PATH = Path(".env").resolve()

load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(f"DATABASE_URL not found in environment or at {ENV_PATH}")

MIGRATION_STEPS = [
    (
        "add pincode to supplier",
        "ALTER TABLE supplier ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);",
    ),
    (
        "add discount_amount to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0;",
    ),
    (
        "add basic_value to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS basic_value NUMERIC(12, 2) DEFAULT 0;",
    ),
    (
        "alter daily_input quantity to numeric",
        "ALTER TABLE daily_input ALTER COLUMN quantity TYPE NUMERIC(12, 4);",
    ),
]


def run_migration():
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        for desc, sql in MIGRATION_STEPS:
            print(f"Executing: {desc} ...", end=" ")
            try:
                conn.execute(text(sql))
                print("DONE")
            except Exception as e:
                print(f"SKIPPED/ERROR: {e}")
    print("\nMigration v6 completed successfully!")


if __name__ == "__main__":
    run_migration()
