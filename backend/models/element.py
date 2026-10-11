from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, text

from db.database import Base


class Element(Base):
    __tablename__ = "element"
    __table_args__ = (UniqueConstraint("code", name="uq_element_code"),)

    id = Column(Integer, primary_key=True, index=True)
    element_name = Column(String(150), nullable=False)
    code = Column(
        String(80),
        nullable=False,
        server_default=text("format_resource_code('E', nextval('element_code_seq'))"),
    )
    unit = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
