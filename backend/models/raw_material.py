from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint, text, Numeric

from db.database import Base


class RawMaterial(Base):
    __tablename__ = "raw_material"
    __table_args__ = (UniqueConstraint("code", name="uq_raw_material_code"),)

    id = Column(Integer, primary_key=True, index=True)
    code = Column(
        String(80),
        nullable=True,
    )
    rate = Column(Numeric(12, 2), nullable=True, server_default=text("0"))
    discount_percent = Column(Numeric(5, 2), nullable=True, server_default=text("0"))
    cgst_percent = Column(Numeric(5, 2), nullable=True, server_default=text("0"))
    ut_sgst_percent = Column(Numeric(5, 2), nullable=True, server_default=text("0"))
    igst_percent = Column(Numeric(5, 2), nullable=True, server_default=text("0"))

    material_name = Column(String(150), nullable=True)
    zach_code = Column(String(150), nullable=True)
    has_zach_code = Column(Boolean, nullable=True, default=False, server_default=text("false"))
    details = Column(Text, nullable=True)
    unit = Column(String(30), nullable=True)
    hsn_code = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
