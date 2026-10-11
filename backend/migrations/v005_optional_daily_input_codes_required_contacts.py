from sqlalchemy import text


def upgrade(connection) -> None:
    for table_name in ("daily_input_element", "daily_input_raw_material"):
        connection.execute(
            text(f"ALTER TABLE {table_name} ALTER COLUMN customer_code DROP NOT NULL")
        )
        connection.execute(
            text(f"ALTER TABLE {table_name} ALTER COLUMN supplier_code DROP NOT NULL")
        )

    required_fields = {
        "supplier": (
            "contact_person",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "gst_number",
        ),
        "customer": (
            "contact_person",
            "email",
            "phone",
            "address",
            "city",
            "state",
        ),
    }
    for table_name, columns in required_fields.items():
        for column_name in columns:
            connection.execute(
                text(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET NOT NULL")
            )