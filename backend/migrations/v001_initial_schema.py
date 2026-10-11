from sqlalchemy import text


def upgrade(connection) -> None:
    for sequence_name in (
        "element_code_seq",
        "raw_material_code_seq",
        "employee_code_seq",
        "supplier_code_seq",
        "customer_code_seq",
    ):
        connection.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {sequence_name} START WITH 1"))

    connection.execute(
        text(
            "CREATE OR REPLACE FUNCTION format_resource_code(code_prefix TEXT, sequence_value BIGINT) "
            "RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$ "
            "SELECT code_prefix || LPAD(sequence_value::TEXT, "
            "GREATEST(4, LENGTH(sequence_value::TEXT)), '0') $$"
        )
    )

    from db.database import Base
    from models import Customer, Element, RawMaterial, Supplier, User
    from migrations.legacy_initial_models import Attendance, DailyConsumption

    Base.metadata.create_all(bind=connection)