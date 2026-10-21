"""
Migration v2:
- Create cost_data table if not exists with all 14 specification/cost parameter fields
- Create cost_data_code_seq sequence
- Create trigger for auto-generating sequential cost data code (e.g. CD0001, CD0002)

Usage:
    python backend/migrations/v2_cost_data.py
    # or from backend directory:
    python migrations/v2_cost_data.py
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
        "create cost_data table",
        """
        CREATE TABLE IF NOT EXISTS cost_data (
            id SERIAL PRIMARY KEY,
            code VARCHAR(80) UNIQUE,
            type VARCHAR(50),
            wound_cap_basic_value NUMERIC,
            mpp_film_width NUMERIC,
            mpp_film_thickness NUMERIC,
            core_od NUMERIC,
            film_free_margin NUMERIC,
            winding_stagger NUMERIC,
            wound_capacitor_od NUMERIC,
            turns_to_be_wound NUMERIC,
            active_width NUMERIC,
            band_length NUMERIC,
            wt_of_capacitor NUMERIC,
            wound_cap_element_value NUMERIC,
            pp_film_width NUMERIC,
            pp_film_thickness NUMERIC,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );
        ALTER TABLE cost_data ADD COLUMN IF NOT EXISTS type VARCHAR(50);
        """,
    ),
    (
        "create cost_data_code_seq",
        "CREATE SEQUENCE IF NOT EXISTS cost_data_code_seq START WITH 1;",
    ),
    (
        "create trigger_set_cost_data_code",
        """
        CREATE OR REPLACE FUNCTION set_next_cost_data_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM cost_data
                WHERE code ~ '^CD[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'CD' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_set_cost_data_code ON cost_data;
        CREATE TRIGGER trigger_set_cost_data_code
        BEFORE INSERT ON cost_data
        FOR EACH ROW EXECUTE FUNCTION set_next_cost_data_code();
        """,
    ),
]


def run_migration():
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        for desc, sql in MIGRATION_STEPS:
            print(f"Running: {desc}...")
            conn.execute(text(sql))
    print("Cost Data migration v2 completed successfully.")


if __name__ == "__main__":
    run_migration()
