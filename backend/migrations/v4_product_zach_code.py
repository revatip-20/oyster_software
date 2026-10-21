"""
Migration v4:
- Add zach_code VARCHAR(150) to product table
- Add has_zach_code BOOLEAN DEFAULT FALSE to product table

Usage:
    python backend/migrations/v4_product_zach_code.py
    # or from backend directory:
    python migrations/v4_product_zach_code.py
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
        "add zach_code to product",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150);",
    ),
    (
        "add has_zach_code to product",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS has_zach_code BOOLEAN DEFAULT FALSE;",
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
    print("\nMigration v4 completed successfully!")


if __name__ == "__main__":
    run_migration()
