from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(
        text(
            "ALTER TABLE daily_input "
            "ADD COLUMN IF NOT EXISTS unit VARCHAR(30);"
        )
    )
    connection.execute(
        text(
            "UPDATE daily_input di "
            "SET unit = rm.unit "
            "FROM raw_material rm "
            "WHERE di.raw_material_id = rm.id AND di.unit IS NULL;"
        )
    )
    connection.execute(
        text(
            "UPDATE daily_input di "
            "SET unit = e.unit "
            "FROM element e "
            "WHERE di.element_id = e.id AND di.unit IS NULL;"
        )
    )
