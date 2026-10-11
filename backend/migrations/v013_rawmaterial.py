
from sqlalchemy import text


def upgrade(connection) -> None:
    # Add rate and GST percentage fields to raw_material
    connection.execute(
        text(
            "ALTER TABLE raw_material "
            "ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS ut_sgst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;"
        )
    )

    # Add amount, GST amount, total amount, and invoice path to daily_input
    connection.execute(
        text(
            "ALTER TABLE daily_input "
            "ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS ut_sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "ADD COLUMN IF NOT EXISTS invoice_path VARCHAR(500);"
        )
    )