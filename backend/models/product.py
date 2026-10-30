from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, text, JSON
from sqlalchemy.orm import relationship

from db.database import Base


class ProductRawMaterial(Base):
    __tablename__ = "product_raw_material"
    __table_args__ = (
        UniqueConstraint("product_id", "raw_material_id", name="uq_product_raw_material"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(12, 4), nullable=True, server_default=text("1"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")

    product = relationship("Product", back_populates="product_raw_materials")
    raw_material = relationship("RawMaterial")


class Product(Base):
    __tablename__ = "product"
    __table_args__ = (
        UniqueConstraint("code", name="uq_product_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(80), nullable=True)
    name = Column(String(150), nullable=True)
    type = Column(String(50), nullable=True)
    zach_code = Column(String(150), nullable=True)
    has_zach_code = Column(Boolean, nullable=True, default=False, server_default=text("false"))
    po_batch_no = Column(String(100), nullable=True)
    ls = Column(String(100), nullable=True)
    hsn_code = Column(String(50), nullable=True)
    sach_code = Column(String(100), nullable=True)
    bin = Column(String(100), nullable=True)
    boxes = Column(String(100), nullable=True)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id"), nullable=True)
    raw_material_ids = Column(JSON, nullable=True)
    element_id = Column(Integer, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    welded_element_id = Column(Integer, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True, server_default=text("0"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    raw_material = relationship("RawMaterial")
    element = relationship("Product", foreign_keys=[element_id], remote_side=[id])
    welded_element = relationship("Product", foreign_keys=[welded_element_id], remote_side=[id])
    product_raw_materials = relationship(
        "ProductRawMaterial",
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
