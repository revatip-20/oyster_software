from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(
        text(
            "ALTER TABLE raw_material "
            "ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);"
        )
    )
