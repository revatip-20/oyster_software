from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(
        text(
            "ALTER TABLE daily_input "
            "ADD COLUMN IF NOT EXISTS raw_material_id INT REFERENCES raw_material(id), "
            "ADD COLUMN IF NOT EXISTS element_id INT REFERENCES element(id);"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE daily_input "
            "ALTER COLUMN item DROP NOT NULL;"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_daily_input_raw_material ON daily_input(raw_material_id);"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_daily_input_element ON daily_input(element_id);"
        )
    )
