from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Numeric, JSON, Text
from sqlalchemy.orm import relationship

from db.database import Base


class DailyInput(Base):
    __tablename__ = "daily_input"
    __table_args__ = (
        CheckConstraint(
            "type IS NULL OR type IN ('raw_material', 'product', 'element', 'other')",
            name="daily_input_type_check",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    dc_no = Column("DC_no", String(50), nullable=True)
    dc_date = Column("DC_date", Date, nullable=True)
    bill_no = Column(String(50), nullable=True)
    bill_date = Column(Date, nullable=True)
    item = Column(String(150), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=True)
    unit = Column(String(30), nullable=True)
    rate = Column(Numeric(12, 2), nullable=True)
    basic_value = Column(Numeric(12, 2), nullable=True, default=0)
    discount_percent = Column(Numeric(5, 2), nullable=True, default=0)
    hsn_code = Column(String(20), nullable=True)
    type = Column(String(20), nullable=True)
    supplier_type = Column(String(50), nullable=True, default="supplier")

    # Amount and GST fields
    discount_amount = Column(Numeric(12, 2), nullable=True, default=0)
    cgst_percent = Column(Numeric(5, 2), nullable=True, default=0)
    ut_sgst_percent = Column(Numeric(5, 2), nullable=True, default=0)
    igst_percent = Column(Numeric(5, 2), nullable=True, default=0)
    amount = Column(Numeric(12, 2), nullable=True, default=0)
    cgst_amount = Column(Numeric(12, 2), nullable=True, default=0)
    ut_sgst_amount = Column(Numeric(12, 2), nullable=True, default=0)
    igst_amount = Column(Numeric(12, 2), nullable=True, default=0)
    total_amount = Column(Numeric(12, 2), nullable=True, default=0)

    # Invoice attachment path
    invoice_path = Column(String(500), nullable=True)

    # Remarks
    remarks = Column(Text, nullable=True)

    # Supplier details for general supplier type
    supplier_company_name = Column(String(150), nullable=True)
    supplier_contact_person = Column(String(150), nullable=True)
    supplier_phone = Column(String(50), nullable=True)
    supplier_email = Column(String(150), nullable=True)
    supplier_address = Column(Text, nullable=True)
    supplier_city = Column(String(100), nullable=True)
    supplier_state = Column(String(100), nullable=True)
    supplier_pincode = Column(String(20), nullable=True)
    supplier_gst_number = Column(String(80), nullable=True)

    # Other details stored as JSON
    other_details = Column(JSON, nullable=True)

    customer_id = Column(Integer, ForeignKey("customer.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("supplier.id"), nullable=True)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("product.id"), nullable=True)
    element_id = Column(Integer, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer")
    supplier = relationship("Supplier")
    raw_material = relationship("RawMaterial")
    product = relationship("Product")
    user = relationship("User")
