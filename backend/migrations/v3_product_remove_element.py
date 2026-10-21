"""
Migration v3:
- Create product table with id, code, name, type ('element', 'welded element', 'capacitor'), raw_material_id, quantity
- Create product_code_seq sequence and set_next_product_code trigger
- Update daily_input to reference product_id
- Drop element table and its triggers/constraints

Usage:
    python backend/migrations/v3_product_remove_element.py
    # or from backend directory:
    python migrations/v3_product_remove_element.py
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
        "create product_code_seq",
        "CREATE SEQUENCE IF NOT EXISTS product_code_seq START WITH 1;",
    ),
    (
        "create product table",
        """
        CREATE TABLE IF NOT EXISTS product (
            id SERIAL PRIMARY KEY,
            code VARCHAR(80) UNIQUE,
            name VARCHAR(150),
            type VARCHAR(50),
            raw_material_id INTEGER REFERENCES raw_material(id) ON DELETE SET NULL,
            raw_material_ids JSONB,
            quantity NUMERIC(12, 2) DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT product_type_check CHECK (
                type IS NULL OR type IN (
                    'element', 'welded element', 'capacitor',
                    'Element', 'Welded Element', 'Capacitor'
                )
            )
        );
        ALTER TABLE product ADD COLUMN IF NOT EXISTS raw_material_ids JSONB;
        ALTER TABLE product ADD COLUMN IF NOT EXISTS element_id INTEGER REFERENCES product(id) ON DELETE SET NULL;
        ALTER TABLE product ADD COLUMN IF NOT EXISTS welded_element_id INTEGER REFERENCES product(id) ON DELETE SET NULL;
        CREATE TABLE IF NOT EXISTS product_raw_material (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            raw_material_id INTEGER NOT NULL REFERENCES raw_material(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_product_raw_material UNIQUE (product_id, raw_material_id)
        );
        ALTER TABLE product_raw_material ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 4) DEFAULT 1;
        """,
    ),
    (
        "create trigger_set_product_code",
        """
        CREATE OR REPLACE FUNCTION set_next_product_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM product
                WHERE code ~ '^P[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'P' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_set_product_code ON product;
        CREATE TRIGGER trigger_set_product_code
        BEFORE INSERT ON product
        FOR EACH ROW EXECUTE FUNCTION set_next_product_code();
        """,
    ),
    (
        "update daily_input table with product_id and drop element foreign key",
        """
        ALTER TABLE daily_input DROP CONSTRAINT IF EXISTS daily_input_element_id_fkey;
        ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES product(id) ON DELETE SET NULL;
        ALTER TABLE daily_input DROP CONSTRAINT IF EXISTS daily_input_type_check;
        ALTER TABLE daily_input ADD CONSTRAINT daily_input_type_check CHECK (type IS NULL OR type IN ('raw_material', 'product', 'element', 'other'));
        """,
    ),
    (
        "drop element table",
        """
        DROP TABLE IF EXISTS element CASCADE;
        """,
    ),
]


def run_migration():
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        for desc, sql in MIGRATION_STEPS:
            print(f"Running: {desc}...")
            conn.execute(text(sql))
    print("Product migration v3 completed successfully.")


if __name__ == "__main__":
    run_migration()
