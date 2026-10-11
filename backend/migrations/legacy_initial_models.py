from sqlalchemy import CheckConstraint, Column, Date, DateTime, DECIMAL, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import relationship

from db.database import Base


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        CheckConstraint("status IN ('present', 'absent')", name="attendance_status_check"),
        UniqueConstraint("user_id", "date", name="uq_attendance_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    punch_in = Column(Time, nullable=True)
    punch_out = Column(Time, nullable=True)
    status = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")


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