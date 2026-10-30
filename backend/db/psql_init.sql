CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS element_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS raw_material_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS supplier_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION format_resource_code(code_prefix TEXT, sequence_value BIGINT)
RETURNS TEXT AS $$
    SELECT code_prefix || LPAD(
        sequence_value::TEXT,
        GREATEST(4, LENGTH(sequence_value::TEXT)),
        '0'
    );
$$ LANGUAGE SQL IMMUTABLE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    code VARCHAR(80),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30) NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    joining_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_users_code UNIQUE (code)
);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS customer (
    id SERIAL PRIMARY KEY,
    code VARCHAR(80) NOT NULL DEFAULT format_resource_code('CUST', nextval('customer_code_seq')),
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_customer_code UNIQUE (code)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'customer' AND column_name = 'customer_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'customer' AND column_name = 'company_name'
    ) THEN
        ALTER TABLE customer RENAME COLUMN customer_name TO company_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'customer' AND column_name = 'country'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'customer' AND column_name = 'state'
    ) THEN
        ALTER TABLE customer RENAME COLUMN country TO state;
    END IF;
END $$;

CREATE TRIGGER customer_set_updated_at
BEFORE UPDATE ON customer
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS supplier (
    id SERIAL PRIMARY KEY,
    code VARCHAR(80) NOT NULL DEFAULT format_resource_code('S', nextval('supplier_code_seq')),
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    gst_number VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_supplier_code UNIQUE (code)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'supplier' AND column_name = 'supplier_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'supplier' AND column_name = 'company_name'
    ) THEN
        ALTER TABLE supplier RENAME COLUMN supplier_name TO company_name;
    END IF;
END $$;

ALTER TABLE supplier ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS state VARCHAR(100);

CREATE TRIGGER supplier_set_updated_at
BEFORE UPDATE ON supplier
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS daily_input (
    id SERIAL PRIMARY KEY,
    material_name VARCHAR(150) NOT NULL,
    "DC_date" DATE NOT NULL,
    unit VARCHAR(30) NOT NULL,
    bill_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('raw_material', 'element')),
    customer_id INT REFERENCES customer(id),
    supplier_id INT REFERENCES supplier(id),

ALTER TABLE raw_material DROP COLUMN IF EXISTS reorder_level;

CREATE TRIGGER raw_material_set_updated_at
BEFORE UPDATE ON raw_material
CREATE TRIGGER daily_input_set_updated_at
BEFORE UPDATE ON daily_input

ALTER TABLE raw_material DROP COLUMN IF EXISTS category;
ALTER TABLE raw_material DROP COLUMN IF EXISTS quantity;
DO $$
BEGIN
    IF to_regclass('daily_input_element') IS NOT NULL THEN
        INSERT INTO daily_input (
            "DC_no", "DC_date", bill_no, bill_date, item, quantity, type,
            customer_id, supplier_id, created_at, updated_at, deleted_at
        )
        SELECT old."DC_no", old.in_date, old.bill_no, NULL, old.item, old.quantity, 'element',
               customer.id, supplier.id, old.created_at, old.updated_at, old.deleted_at
        FROM daily_input_element AS old
        LEFT JOIN customer ON customer.code = old.customer_code
        LEFT JOIN supplier ON supplier.code = old.supplier_code;
        DROP TABLE daily_input_element;
    END IF;

    IF to_regclass('daily_input_raw_material') IS NOT NULL THEN
        INSERT INTO daily_input (
            "DC_no", "DC_date", bill_no, bill_date, item, quantity, type,
            customer_id, supplier_id, created_at, updated_at, deleted_at
        )
        SELECT old."DC_no", old.in_date, old.bill_no, NULL, old.item, old.quantity, 'raw_material',
               customer.id, supplier.id, old.created_at, old.updated_at, old.deleted_at
        FROM daily_input_raw_material AS old
        LEFT JOIN customer ON customer.code = old.customer_code
        LEFT JOIN supplier ON supplier.code = old.supplier_code;
        DROP TABLE daily_input_raw_material;
    END IF;
END $$;
        WHERE table_schema = current_schema() AND table_name = 'element' AND column_name = 'element_code'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'element' AND column_name = 'code'
    ) THEN
        ALTER TABLE element RENAME COLUMN element_code TO code;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS daily_input (
    id SERIAL PRIMARY KEY,
    "DC_no" VARCHAR(50) NOT NULL,
    "DC_date" DATE NOT NULL,
    bill_no VARCHAR(50) NOT NULL,
    bill_date DATE,
    item VARCHAR(150),
    quantity INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('raw_material', 'element')),
    customer_id INT REFERENCES customer(id),
    supplier_id INT REFERENCES supplier(id),
    raw_material_id INT REFERENCES raw_material(id),
    element_id INT REFERENCES element(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER daily_input_set_updated_at
BEFORE UPDATE ON daily_input
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DO $$
BEGIN
    IF to_regclass('daily_input_element') IS NOT NULL THEN
        INSERT INTO daily_input (
            "DC_no", "DC_date", bill_no, bill_date, item, quantity, type,
            customer_id, supplier_id, created_at, updated_at, deleted_at
        )
        SELECT old."DC_no", old.in_date, old.bill_no, NULL, old.item, old.quantity, 'element',
               customer.id, supplier.id, old.created_at, old.updated_at, old.deleted_at
        FROM daily_input_element AS old
        LEFT JOIN customer ON customer.code = old.customer_code
        LEFT JOIN supplier ON supplier.code = old.supplier_code;
        DROP TABLE daily_input_element;
    END IF;

    IF to_regclass('daily_input_raw_material') IS NOT NULL THEN
        INSERT INTO daily_input (
            "DC_no", "DC_date", bill_no, bill_date, item, quantity, type,
            customer_id, supplier_id, created_at, updated_at, deleted_at
        )
        SELECT old."DC_no", old.in_date, old.bill_no, NULL, old.item, old.quantity, 'raw_material',
               customer.id, supplier.id, old.created_at, old.updated_at, old.deleted_at
        FROM daily_input_raw_material AS old
        LEFT JOIN customer ON customer.code = old.customer_code
        LEFT JOIN supplier ON supplier.code = old.supplier_code;
        DROP TABLE daily_input_raw_material;
    END IF;
END $$;

ALTER TABLE customer ALTER COLUMN contact_person SET NOT NULL;
ALTER TABLE customer ALTER COLUMN email SET NOT NULL;
ALTER TABLE customer ALTER COLUMN phone SET NOT NULL;
ALTER TABLE customer ALTER COLUMN address SET NOT NULL;
ALTER TABLE customer ALTER COLUMN city SET NOT NULL;
ALTER TABLE customer ALTER COLUMN state SET NOT NULL;

ALTER TABLE supplier ALTER COLUMN contact_person SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN email SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN phone SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN address SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN city SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN state SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN gst_number SET NOT NULL;

DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS daily_consumption;
DROP TABLE IF EXISTS employee;

ALTER TABLE element ADD COLUMN IF NOT EXISTS code VARCHAR(80);
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS code VARCHAR(80);
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS code VARCHAR(80);
ALTER TABLE customer ADD COLUMN IF NOT EXISTS code VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS code VARCHAR(80);

ALTER TABLE element ALTER COLUMN code SET DEFAULT format_resource_code('E', nextval('element_code_seq'));
ALTER TABLE raw_material ALTER COLUMN code SET DEFAULT format_resource_code('R', nextval('raw_material_code_seq'));
ALTER TABLE supplier ALTER COLUMN code SET DEFAULT format_resource_code('S', nextval('supplier_code_seq'));
ALTER TABLE customer ALTER COLUMN code SET DEFAULT format_resource_code('CUST', nextval('customer_code_seq'));

SELECT setval(
    'element_code_seq',
    COALESCE((SELECT MAX(NULLIF(substring(code FROM 2), '')::BIGINT) FROM element WHERE code ~ '^E[0-9]+$'), 0) + 1,
    false
);
SELECT setval(
    'raw_material_code_seq',
    COALESCE((SELECT MAX(NULLIF(substring(code FROM 2), '')::BIGINT) FROM raw_material WHERE code ~ '^R[0-9]+$'), 0) + 1,
    false
);
SELECT setval(
    'supplier_code_seq',
    COALESCE((SELECT MAX(NULLIF(substring(code FROM 2), '')::BIGINT) FROM supplier WHERE code ~ '^S[0-9]+$'), 0) + 1,
    false
);
SELECT setval(
    'customer_code_seq',
    COALESCE((SELECT MAX(NULLIF(substring(code FROM 5), '')::BIGINT) FROM customer WHERE code ~ '^CUST[0-9]+$'), 0) + 1,
    false
);
SELECT setval(
    'employee_code_seq',
    COALESCE((SELECT MAX(NULLIF(substring(code FROM 4), '')::BIGINT) FROM users WHERE code ~ '^EMP[0-9]+$'), 0) + 1,
    false
);

UPDATE element SET code = format_resource_code('E', nextval('element_code_seq')) WHERE code IS NULL;
UPDATE raw_material SET code = format_resource_code('R', nextval('raw_material_code_seq')) WHERE code IS NULL;
UPDATE supplier SET code = format_resource_code('S', nextval('supplier_code_seq')) WHERE code IS NULL;
UPDATE customer SET code = format_resource_code('CUST', nextval('customer_code_seq')) WHERE code IS NULL;
UPDATE users SET code = format_resource_code('EMP', nextval('employee_code_seq'))
WHERE role = 'employee' AND code IS NULL;

ALTER TABLE element ALTER COLUMN code SET NOT NULL;
ALTER TABLE raw_material ALTER COLUMN code SET NOT NULL;
ALTER TABLE supplier ALTER COLUMN code SET NOT NULL;
ALTER TABLE customer ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_element_code ON element(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_material_code ON raw_material(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_code ON supplier(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_code ON customer(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_code ON users(code);

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

CREATE OR REPLACE FUNCTION set_employee_code()
RETURNS TRIGGER AS $$
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
CREATE TRIGGER users_set_employee_code
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_employee_code();

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_customer_email ON customer(email);
CREATE INDEX IF NOT EXISTS idx_supplier_email ON supplier(email);
CREATE INDEX IF NOT EXISTS idx_element_customer ON element(customer_id);
CREATE INDEX IF NOT EXISTS idx_raw_material_supplier ON raw_material(supplier_id);
CREATE INDEX IF NOT EXISTS idx_daily_input_dc_date ON daily_input("DC_date");
CREATE INDEX IF NOT EXISTS idx_daily_input_raw_material ON daily_input(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_daily_input_element ON daily_input(element_id);

-- Make all fields non-compulsory across all tables
ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE customer ALTER COLUMN company_name DROP NOT NULL;
ALTER TABLE customer ALTER COLUMN contact_person DROP NOT NULL;
ALTER TABLE customer ALTER COLUMN email DROP NOT NULL;
ALTER TABLE customer ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE customer ALTER COLUMN address DROP NOT NULL;
ALTER TABLE customer ALTER COLUMN city DROP NOT NULL;
ALTER TABLE customer ALTER COLUMN state DROP NOT NULL;

ALTER TABLE supplier ALTER COLUMN company_name DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN contact_person DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN email DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN address DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN city DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN state DROP NOT NULL;
ALTER TABLE supplier ALTER COLUMN gst_number DROP NOT NULL;

ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE raw_material ALTER COLUMN material_name DROP NOT NULL;
ALTER TABLE raw_material ALTER COLUMN unit DROP NOT NULL;
ALTER TABLE raw_material ALTER COLUMN rate DROP NOT NULL;
ALTER TABLE raw_material ALTER COLUMN discount_percent DROP NOT NULL;
ALTER TABLE raw_material ALTER COLUMN cgst_percent DROP NOT NULL;
ALTER TABLE raw_material ALTER COLUMN ut_sgst_percent DROP NOT NULL;
ALTER TABLE raw_material ALTER COLUMN igst_percent DROP NOT NULL;

ALTER TABLE element ALTER COLUMN element_name DROP NOT NULL;
ALTER TABLE element ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
ALTER TABLE element ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE element ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE element ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE element ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) DEFAULT 0;

ALTER TABLE daily_input ALTER COLUMN "DC_no" DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN "DC_date" DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN bill_no DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN type DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN cgst_amount DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN ut_sgst_amount DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN igst_amount DROP NOT NULL;
ALTER TABLE daily_input ALTER COLUMN total_amount DROP NOT NULL;
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS unit VARCHAR(30);
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2);
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE daily_input ALTER COLUMN discount_percent DROP NOT NULL;
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS other_details JSONB;
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE daily_input DROP CONSTRAINT IF EXISTS daily_input_type_check;
ALTER TABLE daily_input ADD CONSTRAINT daily_input_type_check CHECK (type IS NULL OR type IN ('raw_material', 'element', 'other'));

ALTER TABLE product ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150);
ALTER TABLE product ADD COLUMN IF NOT EXISTS has_zach_code BOOLEAN DEFAULT FALSE;
ALTER TABLE product DROP CONSTRAINT IF EXISTS product_type_check;
ALTER TABLE cost_data DROP CONSTRAINT IF EXISTS cost_data_type_check;

ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150);
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS has_zach_code BOOLEAN DEFAULT FALSE;
ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS zach_code VARCHAR(150);

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
);

ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS out_dc_no VARCHAR(50);
ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS out_dc_date DATE;
ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS out_quantity NUMERIC(12, 4);
ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS ok NUMERIC(12, 4);
ALTER TABLE daily_dispatch ADD COLUMN IF NOT EXISTS reject NUMERIC(12, 4);
