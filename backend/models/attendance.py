from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Time, UniqueConstraint
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