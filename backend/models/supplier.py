from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint, text

from db.database import Base


class Supplier(Base):
    __tablename__ = "supplier"
    __table_args__ = (UniqueConstraint("code", name="uq_supplier_code"),)

    id = Column(Integer, primary_key=True, index=True)
    code = Column(
        String(80),
        nullable=True,
    )
    company_name = Column(String(150), nullable=True)
    contact_person = Column(String(150), nullable=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    gst_number = Column(String(80), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
