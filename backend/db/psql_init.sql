CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30) NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    joining_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    punch_in TIME,
    punch_out TIME,
    status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE (user_id, date)
);

CREATE TRIGGER attendance_set_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS customer (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(30),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
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
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(30),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    gst_number VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
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

CREATE TABLE IF NOT EXISTS raw_material (
    id SERIAL PRIMARY KEY,
    material_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(30) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    supplier_id INT REFERENCES supplier(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

ALTER TABLE raw_material DROP COLUMN IF EXISTS reorder_level;

CREATE TRIGGER raw_material_set_updated_at
BEFORE UPDATE ON raw_material
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS element (
    id SERIAL PRIMARY KEY,
    element_name VARCHAR(150) NOT NULL,
    element_code VARCHAR(80) UNIQUE NOT NULL,
    description TEXT,
    unit VARCHAR(30),
    supplier_id INT REFERENCES supplier(id),
    raw_material_id INT REFERENCES raw_material(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER element_set_updated_at
BEFORE UPDATE ON element
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS daily_consumption (
    id SERIAL PRIMARY KEY,
    raw_material_id INT REFERENCES raw_material(id),
    element_id INT REFERENCES element(id),
    quantity DECIMAL(12,3) NOT NULL,
    consumption_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER daily_consumption_set_updated_at
BEFORE UPDATE ON daily_consumption
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP INDEX IF EXISTS idx_daily_consumption_employee;
ALTER TABLE daily_consumption DROP CONSTRAINT IF EXISTS daily_consumption_employee_id_fkey;
ALTER TABLE daily_consumption DROP COLUMN IF EXISTS employee_id;
DROP TABLE IF EXISTS employee;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_customer_email ON customer(email);
CREATE INDEX IF NOT EXISTS idx_supplier_email ON supplier(email);
CREATE INDEX IF NOT EXISTS idx_raw_material_supplier ON raw_material(supplier_id);
CREATE INDEX IF NOT EXISTS idx_element_supplier ON element(supplier_id);
CREATE INDEX IF NOT EXISTS idx_element_raw_material ON element(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_daily_consumption_material ON daily_consumption(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
