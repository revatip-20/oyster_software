"""
Migration v1:
- Add 'rate' column to daily_input if not present
- Make all fields non-compulsory by dropping NOT NULL constraints across tables:
    - daily_input (DC_no, DC_date, bill_no, quantity, type, amount, cgst_amount, ut_sgst_amount, igst_amount, total_amount)
    - users (first_name, last_name, email, phone)
    - customer (company_name, contact_person, email, phone, address, city, state)
    - supplier (company_name, contact_person, email, phone, address, city, state, gst_number)
    - raw_material (material_name, unit, rate, cgst_percent, ut_sgst_percent, igst_percent)
    - element (element_name)
- Update daily_input_type_check constraint to allow NULL type
- Add BEFORE INSERT triggers to check previous code in DB and generate the next sequential code (e.g. R0002 -> R0003) for raw_material, element, supplier, customer, and employees

Usage:
    python backend/migrations/v1.py
    # or from the backend folder:
    python migrations/v1.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Locate .env from script location or parent directories
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

if not ENV_PATH.exists():
    # Check current directory
    ENV_PATH = Path(".env").resolve()

load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(f"DATABASE_URL not found in environment or at {ENV_PATH}")


MIGRATION_STEPS = [
    # -------------------------------------------------------------------------
    # 1. daily_input table
    # -------------------------------------------------------------------------
    (
        "daily_input: add 'unit' column if not exists",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS unit VARCHAR(30);",
    ),
    (
        "daily_input: add 'rate' column if not exists",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2);",
    ),
    (
        "daily_input: add 'hsn_code' column if not exists",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);",
    ),
    (
        "daily_input: add 'discount_percent' column if not exists",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "daily_input: drop NOT NULL on discount_percent",
        "ALTER TABLE daily_input ALTER COLUMN discount_percent DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on DC_no",
        'ALTER TABLE daily_input ALTER COLUMN "DC_no" DROP NOT NULL;',
    ),
    (
        "daily_input: drop NOT NULL on DC_date",
        'ALTER TABLE daily_input ALTER COLUMN "DC_date" DROP NOT NULL;',
    ),
    (
        "daily_input: drop NOT NULL on bill_no",
        "ALTER TABLE daily_input ALTER COLUMN bill_no DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on quantity",
        "ALTER TABLE daily_input ALTER COLUMN quantity DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on type",
        "ALTER TABLE daily_input ALTER COLUMN type DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on amount",
        "ALTER TABLE daily_input ALTER COLUMN amount DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on cgst_amount",
        "ALTER TABLE daily_input ALTER COLUMN cgst_amount DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on ut_sgst_amount",
        "ALTER TABLE daily_input ALTER COLUMN ut_sgst_amount DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on igst_amount",
        "ALTER TABLE daily_input ALTER COLUMN igst_amount DROP NOT NULL;",
    ),
    (
        "daily_input: drop NOT NULL on total_amount",
        "ALTER TABLE daily_input ALTER COLUMN total_amount DROP NOT NULL;",
    ),
    (
        "daily_input: add 'other_details' JSONB column if not exists",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS other_details JSONB;",
    ),
    (
        "daily_input: update type check constraint to allow NULL, 'raw_material', 'element', 'other'",
        """
        DO $$
        BEGIN
            ALTER TABLE daily_input DROP CONSTRAINT IF EXISTS daily_input_type_check;
            ALTER TABLE daily_input ADD CONSTRAINT daily_input_type_check
                CHECK (type IS NULL OR type IN ('raw_material', 'element', 'other'));
        END $$;
        """,
    ),
    # -------------------------------------------------------------------------
    # 2. users table (supervisors / employees / admin)
    # -------------------------------------------------------------------------
    (
        "users: drop NOT NULL on first_name",
        "ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;",
    ),
    (
        "users: drop NOT NULL on last_name",
        "ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;",
    ),
    (
        "users: drop NOT NULL on email",
        "ALTER TABLE users ALTER COLUMN email DROP NOT NULL;",
    ),
    (
        "users: drop NOT NULL on phone",
        "ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;",
    ),
    # -------------------------------------------------------------------------
    # 3. customer table
    # -------------------------------------------------------------------------
    (
        "customer: drop NOT NULL on company_name",
        "ALTER TABLE customer ALTER COLUMN company_name DROP NOT NULL;",
    ),
    (
        "customer: drop NOT NULL on contact_person",
        "ALTER TABLE customer ALTER COLUMN contact_person DROP NOT NULL;",
    ),
    (
        "customer: drop NOT NULL on email",
        "ALTER TABLE customer ALTER COLUMN email DROP NOT NULL;",
    ),
    (
        "customer: drop NOT NULL on phone",
        "ALTER TABLE customer ALTER COLUMN phone DROP NOT NULL;",
    ),
    (
        "customer: drop NOT NULL on address",
        "ALTER TABLE customer ALTER COLUMN address DROP NOT NULL;",
    ),
    (
        "customer: drop NOT NULL on city",
        "ALTER TABLE customer ALTER COLUMN city DROP NOT NULL;",
    ),
    (
        "customer: drop NOT NULL on state",
        "ALTER TABLE customer ALTER COLUMN state DROP NOT NULL;",
    ),
    # -------------------------------------------------------------------------
    # 4. supplier table
    # -------------------------------------------------------------------------
    (
        "supplier: drop NOT NULL on company_name",
        "ALTER TABLE supplier ALTER COLUMN company_name DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on contact_person",
        "ALTER TABLE supplier ALTER COLUMN contact_person DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on email",
        "ALTER TABLE supplier ALTER COLUMN email DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on phone",
        "ALTER TABLE supplier ALTER COLUMN phone DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on address",
        "ALTER TABLE supplier ALTER COLUMN address DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on city",
        "ALTER TABLE supplier ALTER COLUMN city DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on state",
        "ALTER TABLE supplier ALTER COLUMN state DROP NOT NULL;",
    ),
    (
        "supplier: drop NOT NULL on gst_number",
        "ALTER TABLE supplier ALTER COLUMN gst_number DROP NOT NULL;",
    ),
    # -------------------------------------------------------------------------
    # 5. raw_material table
    # -------------------------------------------------------------------------
    (
        "raw_material: add 'hsn_code' column if not exists",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);",
    ),
    (
        "raw_material: add 'rate' column if not exists",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) DEFAULT 0;",
    ),
    (
        "raw_material: add 'discount_percent' column if not exists",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "raw_material: drop NOT NULL on discount_percent",
        "ALTER TABLE raw_material ALTER COLUMN discount_percent DROP NOT NULL;",
    ),
    (
        "raw_material: add 'cgst_percent' column if not exists",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "raw_material: add 'ut_sgst_percent' column if not exists",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "raw_material: add 'igst_percent' column if not exists",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "raw_material: drop NOT NULL on material_name",
        "ALTER TABLE raw_material ALTER COLUMN material_name DROP NOT NULL;",
    ),
    (
        "raw_material: drop NOT NULL on unit",
        "ALTER TABLE raw_material ALTER COLUMN unit DROP NOT NULL;",
    ),
    (
        "raw_material: drop NOT NULL on rate",
        "ALTER TABLE raw_material ALTER COLUMN rate DROP NOT NULL;",
    ),
    (
        "raw_material: drop NOT NULL on cgst_percent",
        "ALTER TABLE raw_material ALTER COLUMN cgst_percent DROP NOT NULL;",
    ),
    (
        "raw_material: drop NOT NULL on ut_sgst_percent",
        "ALTER TABLE raw_material ALTER COLUMN ut_sgst_percent DROP NOT NULL;",
    ),
    (
        "raw_material: drop NOT NULL on igst_percent",
        "ALTER TABLE raw_material ALTER COLUMN igst_percent DROP NOT NULL;",
    ),
    # -------------------------------------------------------------------------
    # 6. element table
    # -------------------------------------------------------------------------
    (
        "element: drop NOT NULL on element_name",
        "ALTER TABLE element ALTER COLUMN element_name DROP NOT NULL;",
    ),
    (
        "element: add 'hsn_code' column if not exists",
        "ALTER TABLE element ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);",
    ),
    (
        "element: add 'rate' column if not exists",
        "ALTER TABLE element ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) DEFAULT 0;",
    ),
    (
        "element: add 'cgst_percent' column if not exists",
        "ALTER TABLE element ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "element: add 'ut_sgst_percent' column if not exists",
        "ALTER TABLE element ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    (
        "element: add 'igst_percent' column if not exists",
        "ALTER TABLE element ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0;",
    ),
    # -------------------------------------------------------------------------
    # 7. Sequential code generation triggers (checks previous code in DB)
    # -------------------------------------------------------------------------
    (
        "raw_material: trigger to check previous code in DB and generate next (e.g. R0002 -> R0003)",
        """
        CREATE OR REPLACE FUNCTION set_next_raw_material_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM raw_material
                WHERE code ~ '^R[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'R' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_set_raw_material_code ON raw_material;
        CREATE TRIGGER trigger_set_raw_material_code
        BEFORE INSERT ON raw_material
        FOR EACH ROW EXECUTE FUNCTION set_next_raw_material_code();
        """,
    ),
    (
        "element: trigger to check previous code in DB and generate next (e.g. E0002 -> E0003)",
        """
        CREATE OR REPLACE FUNCTION set_next_element_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM element
                WHERE code ~ '^E[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'E' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_set_element_code ON element;
        CREATE TRIGGER trigger_set_element_code
        BEFORE INSERT ON element
        FOR EACH ROW EXECUTE FUNCTION set_next_element_code();
        """,
    ),
    (
        "supplier: trigger to check previous code in DB and generate next (e.g. S0002 -> S0003)",
        """
        CREATE OR REPLACE FUNCTION set_next_supplier_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM supplier
                WHERE code ~ '^S[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'S' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_set_supplier_code ON supplier;
        CREATE TRIGGER trigger_set_supplier_code
        BEFORE INSERT ON supplier
        FOR EACH ROW EXECUTE FUNCTION set_next_supplier_code();
        """,
    ),
    (
        "customer: trigger to check previous code in DB and generate next (e.g. CUST0002 -> CUST0003)",
        """
        CREATE OR REPLACE FUNCTION set_next_customer_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM customer
                WHERE code ~ '^CUST[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'CUST' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_set_customer_code ON customer;
        CREATE TRIGGER trigger_set_customer_code
        BEFORE INSERT ON customer
        FOR EACH ROW EXECUTE FUNCTION set_next_customer_code();
        """,
    ),
    (
        "users: trigger to check previous code in DB and generate next for employee (e.g. EMP0002 -> EMP0003)",
        """
        CREATE OR REPLACE FUNCTION set_employee_code() RETURNS TRIGGER AS $$
        DECLARE
            max_num BIGINT;
            next_num BIGINT;
        BEGIN
            IF NEW.role = 'employee' AND (NEW.code IS NULL OR TRIM(NEW.code) = '') THEN
                SELECT COALESCE(MAX(SUBSTRING(code FROM '([0-9]+)$')::BIGINT), 0)
                INTO max_num
                FROM users
                WHERE code ~ '^EMP[0-9]+$';

                next_num := max_num + 1;
                NEW.code := 'EMP' || LPAD(next_num::TEXT, GREATEST(4, LENGTH(next_num::TEXT)), '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS users_set_employee_code ON users;
        CREATE TRIGGER users_set_employee_code BEFORE INSERT ON users
        FOR EACH ROW EXECUTE FUNCTION set_employee_code();
        """,
    ),
]


def run_migration():
    print(f"Connecting to database using URL from: {ENV_PATH}")
    # Mask password for display
    display_url = DATABASE_URL
    if "@" in display_url and ":" in display_url:
        prefix, rest = display_url.split("://", 1)
        creds, host_part = rest.split("@", 1)
        if ":" in creds:
            user = creds.split(":", 1)[0]
            display_url = f"{prefix}://{user}:*****@{host_part}"
    print(f"Target database: {display_url}")

    engine = create_engine(DATABASE_URL)

    success_count = 0
    failure_count = 0

    with engine.connect() as connection:
        for description, query in MIGRATION_STEPS:
            try:
                connection.execute(text(query))
                connection.commit()
                print(f" [OK] {description}")
                success_count += 1
            except Exception as e:
                connection.rollback()
                print(f" [SKIP/WARN] {description} -> {e}")
                failure_count += 1

    print("\n--------------------------------------------------")
    print(f"Migration v1 finished: {success_count} succeeded, {failure_count} skipped/warnings.")
    print("All table columns are now non-compulsory (nullable), and daily_input has 'rate'.")
    print("--------------------------------------------------")


if __name__ == "__main__":
    try:
        run_migration()
    except Exception as exc:
        print(f"\n[ERROR] Migration failed: {exc}", file=sys.stderr)
        sys.exit(1)
