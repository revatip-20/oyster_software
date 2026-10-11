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

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def initialize_database():
    from security import hash_password
    from migrations.runner import run_migrations

    admin_password = os.getenv("ADMIN_PASSWORD", "")
    jwt_secret = os.getenv("JWT_SECRET_KEY", "")
    if len(admin_password) < 8:
        raise RuntimeError("Set ADMIN_PASSWORD to at least 8 characters in .env")
    if len(jwt_secret) < 32:
        raise RuntimeError("Set JWT_SECRET_KEY to at least 32 characters in .env")

    run_migrations(engine)

    from models.user import User

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
