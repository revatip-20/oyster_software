from sqlalchemy import Column, DateTime, Integer, String, Text

from db.database import Base


class Customer(Base):
    __tablename__ = "customer"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(150), nullable=False)
    contact_person = Column(String(150), nullable=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
