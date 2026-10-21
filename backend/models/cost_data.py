from sqlalchemy import CheckConstraint, Column, DateTime, Integer, Numeric, String, UniqueConstraint, text

from db.database import Base


class CostData(Base):
    __tablename__ = "cost_data"
    __table_args__ = (
        UniqueConstraint("code", name="uq_cost_data_code"),
        CheckConstraint(
            "type IS NULL OR type IN ('Basic', 'Element', 'basic', 'element')",
            name="cost_data_type_check",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(80), nullable=True)
    type = Column(String(50), nullable=True)

    # 14 technical and costing parameters
    wound_cap_basic_value = Column(Numeric, nullable=True)
    mpp_film_width = Column(Numeric, nullable=True)
    mpp_film_thickness = Column(Numeric, nullable=True)
    core_od = Column(Numeric, nullable=True)
    film_free_margin = Column(Numeric, nullable=True)
    winding_stagger = Column(Numeric, nullable=True)
    wound_capacitor_od = Column(Numeric, nullable=True)
    turns_to_be_wound = Column(Numeric, nullable=True)
    active_width = Column(Numeric, nullable=True)
    band_length = Column(Numeric, nullable=True)
    wt_of_capacitor = Column(Numeric, nullable=True)
    wound_cap_element_value = Column(Numeric, nullable=True)
    pp_film_width = Column(Numeric, nullable=True)
    pp_film_thickness = Column(Numeric, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
