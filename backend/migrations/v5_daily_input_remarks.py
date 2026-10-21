"""
Migration v5:
- Add remarks TEXT to daily_input table

Usage:
    python backend/migrations/v5_daily_input_remarks.py
    # or from backend directory:
    python migrations/v5_daily_input_remarks.py
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
        "add remarks to daily_input",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS remarks TEXT;",
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
    print("\nMigration v5 completed successfully!")


if __name__ == "__main__":
    run_migration()
