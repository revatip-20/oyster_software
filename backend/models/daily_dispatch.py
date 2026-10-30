from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from db.database import Base


class DailyDispatch(Base):
    __tablename__ = "daily_dispatch"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=True, index=True)
    type = Column(String(50), nullable=True)  # 'Job work', 'Element', 'Capacitor', 'welded element'
    dc_no = Column("DC_no", String(50), nullable=True)
    dc_date = Column("DC_date", Date, nullable=True)
    bill_no = Column(String(50), nullable=True)
    bill_date = Column(Date, nullable=True)
    item = Column(String(150), nullable=True)
    zach_code = Column(String(150), nullable=True)
    po_batch_no = Column(String(100), nullable=True)
    sach_code = Column(String(100), nullable=True)
    ls = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=True)
    bin = Column(String(100), nullable=True)
    boxes = Column(String(100), nullable=True)
    out_dc_no = Column(String(50), nullable=True)
    out_dc_date = Column(Date, nullable=True)
    out_quantity = Column(Numeric(12, 4), nullable=True)
    ok = Column(Numeric(12, 4), nullable=True)
    reject = Column(Numeric(12, 4), nullable=True)
    unit = Column(String(30), nullable=True)
    hsn_code = Column(String(50), nullable=True)
    rate = Column(Numeric(12, 2), nullable=True, default=0)
    basic_value = Column(Numeric(12, 2), nullable=True, default=0)
    discount_percent = Column(Numeric(5, 2), nullable=True, default=0)
    discount_amount = Column(Numeric(12, 2), nullable=True, default=0)
    amount = Column(Numeric(12, 2), nullable=True, default=0)
    cgst_percent = Column(Numeric(5, 2), nullable=True, default=0)
    ut_sgst_percent = Column(Numeric(5, 2), nullable=True, default=0)
    igst_percent = Column(Numeric(5, 2), nullable=True, default=0)
    cgst_amount = Column(Numeric(12, 2), nullable=True, default=0)
    ut_sgst_amount = Column(Numeric(12, 2), nullable=True, default=0)
    igst_amount = Column(Numeric(12, 2), nullable=True, default=0)
    total_amount = Column(Numeric(12, 2), nullable=True, default=0)
    remarks = Column(Text, nullable=True)
    other_details = Column(JSON, nullable=True)

    daily_input_id = Column(Integer, ForeignKey("daily_input.id", ondelete="SET NULL"), nullable=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("supplier.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    daily_input = relationship("DailyInput")
    product = relationship("Product")
    customer = relationship("Customer")
    supplier = relationship("Supplier")
    user = relationship("User")

