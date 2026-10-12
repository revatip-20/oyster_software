# models/invoice.py

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String

from db.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    name = Column(String(255), nullable=False)

    daily_input_ids = Column(
        JSON,
        nullable=False,
        default=list,
    )

    daily_input_data = Column(
        JSON,
        nullable=False,
        default=list,
    )

    invoice_path = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
