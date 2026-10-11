from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Numeric
from sqlalchemy.orm import relationship

from db.database import Base


class DailyInput(Base):
    __tablename__ = "daily_input"
    __table_args__ = (
        CheckConstraint("type IN ('raw_material', 'element')", name="daily_input_type_check"),
    )

    id = Column(Integer, primary_key=True, index=True)
    dc_no = Column("DC_no", String(50), nullable=False)
    dc_date = Column("DC_date", Date, nullable=False)
    bill_no = Column(String(50), nullable=False)
    bill_date = Column(Date, nullable=True)
    item = Column(String(150), nullable=True)
    quantity = Column(Integer, nullable=False)
    type = Column(String(20), nullable=False)

     # Amount and GST fields
    amount = Column(Numeric(12, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    ut_sgst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    igst_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)

    # Invoice attachment path
    invoice_path = Column(String(500), nullable=True)

    customer_id = Column(Integer, ForeignKey("customer.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("supplier.id"), nullable=True)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id"), nullable=True)
    element_id = Column(Integer, ForeignKey("element.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer")
    supplier = relationship("Supplier")
    raw_material = relationship("RawMaterial")
    element = relationship("Element")
    user = relationship("User")
