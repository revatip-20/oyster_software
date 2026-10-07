from sqlalchemy import Column, DateTime, DECIMAL, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.database import Base


class RawMaterial(Base):
    __tablename__ = "raw_material"

    id = Column(Integer, primary_key=True, index=True)
    material_name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=True)
    unit = Column(String(30), nullable=False)
    quantity = Column(DECIMAL(12, 3), nullable=False, default=0)
    supplier_id = Column(Integer, ForeignKey("supplier.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    supplier = relationship("Supplier")
