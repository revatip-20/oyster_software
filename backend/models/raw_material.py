from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, text, Numeric

from db.database import Base


class RawMaterial(Base):
    __tablename__ = "raw_material"
    __table_args__ = (UniqueConstraint("code", name="uq_raw_material_code"),)

    id = Column(Integer, primary_key=True, index=True)
    code = Column(
        String(80),
        nullable=False,
        server_default=text("format_resource_code('R', nextval('raw_material_code_seq'))"),
    )
    rate = Column(Numeric(12, 2), nullable=False, server_default=text("0"))
    cgst_percent = Column(Numeric(5, 2), nullable=False, server_default=text("0"))
    ut_sgst_percent = Column(Numeric(5, 2), nullable=False, server_default=text("0"))
    igst_percent = Column(Numeric(5, 2), nullable=False, server_default=text("0"))

    material_name = Column(String(150), nullable=False)
    unit = Column(String(30), nullable=False)
    hsn_code = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
