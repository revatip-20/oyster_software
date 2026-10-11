from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(
        text(
            "ALTER TABLE element DROP CONSTRAINT IF EXISTS element_customer_id_fkey;"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE element DROP CONSTRAINT IF EXISTS element_supplier_id_fkey;"
        )
    )
    connection.execute(
        text(
            "DROP INDEX IF EXISTS idx_element_customer;"
        )
    )
    connection.execute(
        text(
            "DROP INDEX IF EXISTS idx_element_supplier;"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE element DROP COLUMN IF EXISTS customer_id CASCADE;"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE element DROP COLUMN IF EXISTS supplier_id CASCADE;"
        )
    )

    connection.execute(
        text(
            "ALTER TABLE raw_material DROP CONSTRAINT IF EXISTS raw_material_supplier_id_fkey;"
        )
    )
    connection.execute(
        text(
            "DROP INDEX IF EXISTS idx_raw_material_supplier;"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE raw_material DROP COLUMN IF EXISTS supplier_id CASCADE;"
        )
    )
