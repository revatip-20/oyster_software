import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/oyster_db",
)

engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=30,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _ensure_sequences_and_functions(connection) -> None:
    for sequence_name in (
        "product_code_seq",
        "element_code_seq",
        "raw_material_code_seq",
        "employee_code_seq",
        "supplier_code_seq",
        "customer_code_seq",
        "cost_data_code_seq",
    ):
        connection.execute(
            text(f"CREATE SEQUENCE IF NOT EXISTS {sequence_name} START WITH 1")
        )

    connection.execute(
        text(
            "CREATE OR REPLACE FUNCTION format_resource_code("
            "code_prefix TEXT, sequence_value BIGINT) "
            "RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$ "
            "SELECT code_prefix || LPAD(sequence_value::TEXT, "
            "GREATEST(4, LENGTH(sequence_value::TEXT)), '0') $$"
        )
    )


def _ensure_table_triggers(connection) -> None:
    # Trigger for raw_material
    try:
        connection.execute(
            text(
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
                """
            )
        )
    except Exception:
        pass

    # Trigger for product
    try:
        connection.execute(
            text(
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
                """
            )
        )
    except Exception:
        pass

    # Trigger for supplier
    try:
        connection.execute(
            text(
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
                """
            )
        )
    except Exception:
        pass

    # Trigger for customer
    try:
        connection.execute(
            text(
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
                """
            )
        )
    except Exception:
        pass

    # Trigger for users (employee)
    try:
        connection.execute(
            text(
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
                """
            )
        )
    except Exception:
        pass

    # Trigger for cost_data
    try:
        connection.execute(
            text(
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
                """
            )
        )
    except Exception:
        pass


def _drop_not_null_constraints(connection) -> None:
    ddl_statements = [
        "ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL",
        "ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL",
        "ALTER TABLE users ALTER COLUMN email DROP NOT NULL",
        "ALTER TABLE users ALTER COLUMN phone DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN company_name DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN contact_person DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN email DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN phone DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN address DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN city DROP NOT NULL",
        "ALTER TABLE customer ALTER COLUMN state DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN company_name DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN contact_person DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN email DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN phone DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN address DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN city DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN state DROP NOT NULL",
        "ALTER TABLE supplier ALTER COLUMN gst_number DROP NOT NULL",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) DEFAULT 0",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE raw_material ALTER COLUMN material_name DROP NOT NULL",
        "ALTER TABLE raw_material ALTER COLUMN unit DROP NOT NULL",
        "ALTER TABLE raw_material ALTER COLUMN rate DROP NOT NULL",
        "ALTER TABLE raw_material ALTER COLUMN discount_percent DROP NOT NULL",
        "ALTER TABLE raw_material ALTER COLUMN cgst_percent DROP NOT NULL",
        "ALTER TABLE raw_material ALTER COLUMN ut_sgst_percent DROP NOT NULL",
        "ALTER TABLE raw_material ALTER COLUMN igst_percent DROP NOT NULL",
        "ALTER TABLE daily_input DROP CONSTRAINT IF EXISTS daily_input_element_id_fkey",
        "DROP TABLE IF EXISTS element CASCADE",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES product(id) ON DELETE SET NULL",
        'ALTER TABLE daily_input ALTER COLUMN "DC_no" DROP NOT NULL',
        'ALTER TABLE daily_input ALTER COLUMN "DC_date" DROP NOT NULL',
        "ALTER TABLE daily_input ALTER COLUMN bill_no DROP NOT NULL",
        "ALTER TABLE daily_input ALTER COLUMN quantity DROP NOT NULL",
        "ALTER TABLE daily_input ALTER COLUMN type DROP NOT NULL",
        "ALTER TABLE daily_input ALTER COLUMN amount DROP NOT NULL",
        "ALTER TABLE daily_input ALTER COLUMN cgst_amount DROP NOT NULL",
        "ALTER TABLE daily_input ALTER COLUMN ut_sgst_amount DROP NOT NULL",
        "ALTER TABLE daily_input ALTER COLUMN igst_amount DROP NOT NULL",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS unit VARCHAR(30)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE daily_input ALTER COLUMN discount_percent DROP NOT NULL",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS other_details JSONB",
        "ALTER TABLE daily_input DROP CONSTRAINT IF EXISTS daily_input_type_check",
        "ALTER TABLE daily_input ADD CONSTRAINT daily_input_type_check CHECK (type IS NULL OR type IN ('raw_material', 'product', 'element', 'other'))",
        "ALTER TABLE cost_data ALTER COLUMN wound_cap_basic_value DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN mpp_film_width DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN mpp_film_thickness DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN core_od DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN film_free_margin DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN winding_stagger DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN wound_capacitor_od DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN turns_to_be_wound DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN active_width DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN band_length DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN wt_of_capacitor DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN wound_cap_element_value DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN pp_film_width DROP NOT NULL",
        "ALTER TABLE cost_data ALTER COLUMN pp_film_thickness DROP NOT NULL",
        "ALTER TABLE cost_data ADD COLUMN IF NOT EXISTS type VARCHAR(50)",
        "ALTER TABLE cost_data ALTER COLUMN type DROP NOT NULL",
        "ALTER TABLE cost_data DROP CONSTRAINT IF EXISTS cost_data_type_check",
        "ALTER TABLE product DROP CONSTRAINT IF EXISTS product_type_check",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS raw_material_ids JSONB",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS element_id INTEGER REFERENCES product(id) ON DELETE SET NULL",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS welded_element_id INTEGER REFERENCES product(id) ON DELETE SET NULL",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS has_zach_code BOOLEAN DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS po_batch_no VARCHAR(100)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS ls VARCHAR(100)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS sach_code VARCHAR(100)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS bin VARCHAR(100)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS boxes VARCHAR(100)",
        "CREATE TABLE IF NOT EXISTS product_raw_material (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE, raw_material_id INTEGER NOT NULL REFERENCES raw_material(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT uq_product_raw_material UNIQUE (product_id, raw_material_id))",
        "ALTER TABLE product_raw_material ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 4) DEFAULT 1",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS remarks TEXT",
        "ALTER TABLE supplier ADD COLUMN IF NOT EXISTS pincode VARCHAR(20)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS basic_value NUMERIC(12, 2) DEFAULT 0",
        "ALTER TABLE daily_input ALTER COLUMN quantity TYPE NUMERIC(12, 4)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(50) DEFAULT 'supplier'",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_company_name VARCHAR(150)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_contact_person VARCHAR(150)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_phone VARCHAR(50)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_email VARCHAR(150)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_address TEXT",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_city VARCHAR(100)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_state VARCHAR(100)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_pincode VARCHAR(20)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS supplier_gst_number VARCHAR(80)",
        "ALTER TABLE daily_input ALTER COLUMN hsn_code TYPE VARCHAR(50)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS po_batch_no VARCHAR(100)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS ls VARCHAR(100)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS sach_code VARCHAR(100)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS bin VARCHAR(100)",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS boxes VARCHAR(100)",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150)",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS has_zach_code BOOLEAN DEFAULT FALSE",
        "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS details TEXT",
        "ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150)",
        "UPDATE daily_input SET zach_code = rm.zach_code FROM raw_material rm WHERE daily_input.raw_material_id = rm.id AND (daily_input.zach_code IS NULL OR daily_input.zach_code = '') AND rm.zach_code IS NOT NULL AND rm.zach_code <> ''",
        "UPDATE daily_input SET zach_code = rm.zach_code FROM raw_material rm WHERE daily_input.raw_material_id IS NULL AND daily_input.type = 'raw_material' AND LOWER(TRIM(daily_input.item)) = LOWER(TRIM(rm.material_name)) AND (daily_input.zach_code IS NULL OR daily_input.zach_code = '') AND rm.zach_code IS NOT NULL AND rm.zach_code <> ''",
        """
        CREATE TABLE IF NOT EXISTS daily_dispatch (
            id SERIAL PRIMARY KEY,
            code VARCHAR(20) UNIQUE,
            type VARCHAR(50),
            "DC_no" VARCHAR(50),
            "DC_date" DATE,
            bill_no VARCHAR(50),
            bill_date DATE,
            item VARCHAR(150),
            zach_code VARCHAR(150),
            po_batch_no VARCHAR(100),
            sach_code VARCHAR(100),
            ls VARCHAR(100),
            quantity NUMERIC(12, 4),
            bin VARCHAR(100),
            boxes VARCHAR(100),
            unit VARCHAR(30),
            hsn_code VARCHAR(50),
            rate NUMERIC(12, 2) DEFAULT 0,
            basic_value NUMERIC(12, 2) DEFAULT 0,
            discount_percent NUMERIC(5, 2) DEFAULT 0,
            discount_amount NUMERIC(12, 2) DEFAULT 0,
            amount NUMERIC(12, 2) DEFAULT 0,
            cgst_percent NUMERIC(5, 2) DEFAULT 0,
            ut_sgst_percent NUMERIC(5, 2) DEFAULT 0,
            igst_percent NUMERIC(5, 2) DEFAULT 0,
            cgst_amount NUMERIC(12, 2) DEFAULT 0,
            ut_sgst_amount NUMERIC(12, 2) DEFAULT 0,
            igst_amount NUMERIC(12, 2) DEFAULT 0,
            total_amount NUMERIC(12, 2) DEFAULT 0,
            remarks TEXT,
            other_details JSONB,
            daily_input_id INTEGER REFERENCES daily_input(id) ON DELETE SET NULL,
            product_id INTEGER REFERENCES product(id) ON DELETE SET NULL,
            customer_id INTEGER REFERENCES customer(id) ON DELETE SET NULL,
            supplier_id INTEGER REFERENCES supplier(id) ON DELETE SET NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ NULL
        )
        """,
        "ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS out_dc_no VARCHAR(50)",
        "ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS out_dc_date DATE",
        "ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS out_quantity NUMERIC(12, 4)",
        "ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS ok NUMERIC(12, 4)",
        "ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS reject NUMERIC(12, 4)",
    ]
    for stmt in ddl_statements:
        try:
            connection.execute(text(stmt))
        except Exception:
            pass


def initialize_database():
    from security import hash_password

    admin_password = os.getenv("ADMIN_PASSWORD", "")
    jwt_secret = os.getenv("JWT_SECRET_KEY", "")
    if len(admin_password) < 8:
        raise RuntimeError("Set ADMIN_PASSWORD to at least 8 characters in .env")
    if len(jwt_secret) < 32:
        raise RuntimeError("Set JWT_SECRET_KEY to at least 32 characters in .env")

    # Import models so Base.metadata is populated before create_all.
    from models import CostData, Customer, DailyDispatch, DailyInput, Product, ProductRawMaterial, RawMaterial, Supplier, User  # noqa: F401

    with engine.begin() as connection:
        _ensure_sequences_and_functions(connection)
        Base.metadata.create_all(bind=connection)
        _drop_not_null_constraints(connection)
        _ensure_table_triggers(connection)

    admin_id = int(os.environ["ADMIN_ID"])
    if admin_id < 1:
        raise ValueError("ADMIN_ID must be a positive integer")

    admin_values = {
        "first_name": os.environ["ADMIN_FIRST_NAME"],
        "last_name": os.environ["ADMIN_LAST_NAME"],
        "email": os.environ["ADMIN_EMAIL"],
        "phone": os.environ["ADMIN_PHONE"],
        "password_hash": hash_password(admin_password),
        "role": os.environ["ADMIN_ROLE"],
    }

    with SessionLocal.begin() as session:
        session.execute(text("SELECT pg_advisory_xact_lock(724193801)"))
        if session.query(User.id).first() is None:
            session.add(User(id=admin_id, **admin_values))
            session.flush()
            session.execute(
                text(
                    "SELECT setval(pg_get_serial_sequence('users', 'id'), "
                    "(SELECT MAX(id) FROM users))"
                )
            )
        else:
            existing_admin = session.query(User).filter(User.id == admin_id).first()
            if existing_admin and not existing_admin.password_hash:
                existing_admin.password_hash = admin_values["password_hash"]


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
