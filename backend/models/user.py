from sqlalchemy import Column, Date, DateTime, Integer, String, Text

from db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(30), nullable=False)
    password_hash = Column(Text, nullable=True)
    role = Column(String(50), nullable=False, default="admin")
    joining_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
