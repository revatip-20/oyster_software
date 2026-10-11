from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint, text

from db.database import Base


class Customer(Base):
    __tablename__ = "customer"
    __table_args__ = (UniqueConstraint("code", name="uq_customer_code"),)

    id = Column(Integer, primary_key=True, index=True)
    code = Column(
        String(80),
        nullable=False,
        server_default=text("format_resource_code('CUST', nextval('customer_code_seq'))"),
    )
    company_name = Column(String(150), nullable=False)
    contact_person = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(30), nullable=False)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
