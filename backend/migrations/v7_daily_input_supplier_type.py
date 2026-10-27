"""
Migration v7:
- Add supplier_type VARCHAR(50) DEFAULT 'supplier' to daily_input table
- Add cgst_percent NUMERIC(5, 2) DEFAULT 0 to daily_input table
- Add ut_sgst_percent NUMERIC(5, 2) DEFAULT 0 to daily_input table
- Add igst_percent NUMERIC(5, 2) DEFAULT 0 to daily_input table

Usage:
    python backend/migrations/v7_daily_input_supplier_type.py
    # or from backend directory:
    python migrations/v7_daily_input_supplier_type.py
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
        "add supplier_type to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(50) DEFAULT 'supplier';",
    ),
    (
        "add cgst_percent to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "add ut_sgst_percent to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "add igst_percent to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "add supplier_company_name to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_company_name VARCHAR(150);",
    ),
    (
        "add supplier_contact_person to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_contact_person VARCHAR(150);",
    ),
    (
        "add supplier_phone to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_phone VARCHAR(50);",
    ),
    (
        "add supplier_email to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_email VARCHAR(150);",
    ),
    (
        "add supplier_address to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_address TEXT;",
    ),
    (
        "add supplier_city to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_city VARCHAR(100);",
    ),
    (
        "add supplier_state to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_state VARCHAR(100);",
    ),
    (
        "add supplier_pincode to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_pincode VARCHAR(20);",
    ),
    (
        "add supplier_gst_number to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_gst_number VARCHAR(80);",
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
    print("\nMigration v7 completed successfully!")


if __name__ == "__main__":
    run_migration()
