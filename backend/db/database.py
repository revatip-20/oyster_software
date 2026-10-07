import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/oyster_db",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def initialize_database():
    from models import Attendance, Customer, DailyConsumption, Element, RawMaterial, Supplier, User
    from security import hash_password

    admin_password = os.getenv("ADMIN_PASSWORD", "")
    jwt_secret = os.getenv("JWT_SECRET_KEY", "")
    if len(admin_password) < 8:
        raise RuntimeError("Set ADMIN_PASSWORD to at least 8 characters in .env")
    if len(jwt_secret) < 32:
        raise RuntimeError("Set JWT_SECRET_KEY to at least 32 characters in .env")

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE daily_consumption DROP CONSTRAINT IF EXISTS daily_consumption_employee_id_fkey")
        )
        connection.execute(text("DROP INDEX IF EXISTS idx_daily_consumption_employee"))
        connection.execute(text("ALTER TABLE daily_consumption DROP COLUMN IF EXISTS employee_id"))
        connection.execute(text("DROP TABLE IF EXISTS employee"))
        connection.execute(text("ALTER TABLE raw_material DROP COLUMN IF EXISTS reorder_level"))

        customer_columns = {
            column["name"] for column in inspect(connection).get_columns("customer")
        }
        if "customer_name" in customer_columns and "company_name" not in customer_columns:
            connection.execute(text("ALTER TABLE customer RENAME COLUMN customer_name TO company_name"))
        if "country" in customer_columns and "state" not in customer_columns:
            connection.execute(text("ALTER TABLE customer RENAME COLUMN country TO state"))

        supplier_columns = {
            column["name"] for column in inspect(connection).get_columns("supplier")
        }
        if "supplier_name" in supplier_columns and "company_name" not in supplier_columns:
            connection.execute(text("ALTER TABLE supplier RENAME COLUMN supplier_name TO company_name"))
        connection.execute(text("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS city VARCHAR(100)"))
        connection.execute(text("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS state VARCHAR(100)"))

        columns = {column["name"] for column in inspect(connection).get_columns("users")}
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE"))

        if "full_name" in columns:
            connection.execute(
                text(
                    "UPDATE users SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')), "
                    "last_name = COALESCE(last_name, NULLIF(substring(full_name from position(' ' in full_name) + 1), ''))"
                )
            )

        for column_name in ("username", "full_name"):
            if column_name in columns:
                connection.execute(text(f"ALTER TABLE users ALTER COLUMN {column_name} DROP NOT NULL"))

        connection.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
        connection.execute(
            text(
                "UPDATE users SET first_name = COALESCE(first_name, 'Admin'), "
                "last_name = COALESCE(last_name, 'User'), phone = COALESCE(phone, ''), "
                "role = COALESCE(role, 'admin')"
            )
        )
        connection.execute(text("UPDATE users SET password_hash = NULL WHERE role = 'employee'"))
        connection.execute(
            text("UPDATE users SET password_hash = '' WHERE password_hash IS NULL AND role <> 'employee'")
        )

        connection.execute(text("ALTER TABLE users ALTER COLUMN first_name SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN last_name SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN phone SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN role SET NOT NULL"))

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
    with SessionLocal() as session:
        yield session
