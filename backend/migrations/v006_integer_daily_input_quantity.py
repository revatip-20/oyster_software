from sqlalchemy import text


def upgrade(connection) -> None:
    for table_name in ("daily_input_element", "daily_input_raw_material"):
        connection.execute(
            text(
                f"ALTER TABLE {table_name} ALTER COLUMN quantity TYPE INTEGER "
                "USING quantity::INTEGER"
            )
        )