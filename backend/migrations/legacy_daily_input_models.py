from sqlalchemy import Column, Date, DateTime, DECIMAL, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.database import Base


class DailyInputElement(Base):
    __tablename__ = "daily_input_element"

    id = Column(Integer, primary_key=True, index=True)
    in_date = Column(Date, nullable=False)
    dc_no = Column("DC_no", String(50), nullable=False)
    bill_no = Column(String(50), nullable=False)
    item = Column(String(150), nullable=False)
    quantity = Column(DECIMAL(12, 3), nullable=False)
    for_ = Column("for", String(150), nullable=False)
    customer_code = Column(String(80), ForeignKey("customer.code"), nullable=False)
    supplier_code = Column(String(80), ForeignKey("supplier.code"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer")
    supplier = relationship("Supplier")


class DailyInputRawMaterial(Base):
    __tablename__ = "daily_input_raw_material"

    id = Column(Integer, primary_key=True, index=True)
    in_date = Column(Date, nullable=False)
    dc_no = Column("DC_no", String(50), nullable=False)
    bill_no = Column(String(50), nullable=False)
    item = Column(String(150), nullable=False)
    quantity = Column(DECIMAL(12, 3), nullable=False)
    for_ = Column("for", String(150), nullable=False)
    customer_code = Column(String(80), ForeignKey("customer.code"), nullable=False)
    supplier_code = Column(String(80), ForeignKey("supplier.code"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer")
    supplier = relationship("Supplier")