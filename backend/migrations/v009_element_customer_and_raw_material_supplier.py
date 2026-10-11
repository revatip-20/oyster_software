from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(
        text(
            "ALTER TABLE element DROP CONSTRAINT IF EXISTS element_supplier_id_fkey;"
        )
    )
    connection.execute(
        text(
            "DROP INDEX IF EXISTS idx_element_supplier;"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE element DROP COLUMN IF EXISTS supplier_id CASCADE;"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE element ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customer(id);"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_element_customer ON element(customer_id);"
        )
    )

    connection.execute(
        text(
            "ALTER TABLE raw_material ADD COLUMN IF NOT EXISTS supplier_id INT REFERENCES supplier(id);"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_raw_material_supplier ON raw_material(supplier_id);"
        )
    )
