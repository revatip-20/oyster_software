from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.database import Base


class Element(Base):
    __tablename__ = "element"

    id = Column(Integer, primary_key=True, index=True)
    element_name = Column(String(150), nullable=False)
    element_code = Column(String(80), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    unit = Column(String(30), nullable=True)
    supplier_id = Column(Integer, ForeignKey("supplier.id"), nullable=True)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    supplier = relationship("Supplier")
    raw_material = relationship("RawMaterial")
