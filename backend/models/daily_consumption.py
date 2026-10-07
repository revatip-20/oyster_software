from sqlalchemy import Column, Date, DateTime, DECIMAL, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from db.database import Base


class DailyConsumption(Base):
    __tablename__ = "daily_consumption"

    id = Column(Integer, primary_key=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id"), nullable=True)
    element_id = Column(Integer, ForeignKey("element.id"), nullable=True)
    quantity = Column(DECIMAL(12, 3), nullable=False)
    consumption_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    raw_material = relationship("RawMaterial")
    element = relationship("Element")
