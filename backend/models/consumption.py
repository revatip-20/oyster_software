from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, text, JSON, Date
from sqlalchemy.orm import relationship

from db.database import Base


class ConsumptionRawMaterial(Base):
    __tablename__ = "consumption_raw_material"

    id = Column(Integer, primary_key=True, index=True)
    consumption_id = Column(Integer, ForeignKey("consumption.id", ondelete="CASCADE"), nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_material.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(12, 4), nullable=True, server_default=text("1"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")

    consumption = relationship("Consumption", back_populates="consumption_raw_materials")
    raw_material = relationship("RawMaterial")


class Consumption(Base):
    __tablename__ = "consumption"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(80), nullable=True, unique=True)
    date = Column(Date, nullable=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(150), nullable=True)
    product_code = Column(String(80), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=True, server_default=text("1"))
    unit = Column(String(30), nullable=True, server_default="num")
    raw_materials = Column(JSON, nullable=True)
    raw_material_ids = Column(JSON, nullable=True)
    remarks = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product")
    user = relationship("User")
    consumption_raw_materials = relationship(
        "ConsumptionRawMaterial",
        back_populates="consumption",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

