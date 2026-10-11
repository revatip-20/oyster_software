from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(
        text(
            "ALTER TABLE element "
            "ADD COLUMN IF NOT EXISTS supplier_id INT REFERENCES supplier(id);"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_element_supplier ON element(supplier_id);"
        )
    )

    connection.execute(
        text(
            "ALTER TABLE daily_input "
            "ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_daily_input_user ON daily_input(user_id);"
        )
    )
