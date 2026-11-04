from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from db.database import Base


class PurchaseOrderReceived(Base):
    __tablename__ = "purchase_order_received"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(80), unique=True, nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    item = Column(String(150), nullable=True)
    zach_code = Column(String(150), nullable=True)
    sach_code = Column(String(100), nullable=True)
    po_no = Column(String(100), nullable=True)
    po_date = Column(Date, nullable=True)
    qty_ord = Column(Numeric(12, 4), nullable=True, default=0)
    qty_dis = Column(Numeric(12, 4), nullable=True, default=0)
    qty_bal = Column(Numeric(12, 4), nullable=True, default=0)
    price = Column(Numeric(12, 2), nullable=True, default=0)
    remarks = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer")
    product = relationship("Product")
    user = relationship("User")

