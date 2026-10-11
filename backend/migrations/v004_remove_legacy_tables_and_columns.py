from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(text("DROP TABLE IF EXISTS attendance"))
    connection.execute(text("DROP TABLE IF EXISTS daily_consumption"))

    connection.execute(text("DROP INDEX IF EXISTS idx_element_raw_material"))
    connection.execute(text("ALTER TABLE element DROP COLUMN IF EXISTS raw_material_id"))
    connection.execute(text("ALTER TABLE element DROP COLUMN IF EXISTS description"))

    connection.execute(text("DROP INDEX IF EXISTS idx_raw_material_supplier"))
    connection.execute(text("ALTER TABLE raw_material DROP COLUMN IF EXISTS category"))
    connection.execute(text("ALTER TABLE raw_material DROP COLUMN IF EXISTS quantity"))
    connection.execute(text("ALTER TABLE raw_material DROP COLUMN IF EXISTS supplier_id"))