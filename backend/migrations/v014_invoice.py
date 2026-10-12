from sqlalchemy import text


def upgrade(connection) -> None:
    # Create invoices table with Daily Input IDs, snapshot data, and PDF path
    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                daily_input_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
                daily_input_data JSONB NOT NULL DEFAULT '[]'::jsonb,
                invoice_path VARCHAR(500) NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE NULL
            );
            """
        )
    )

    # Support databases where an earlier invoices table already exists
    connection.execute(
        text(
            """
            ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS daily_input_data JSONB NOT NULL DEFAULT '[]'::jsonb;
            """
        )
    )
    connection.execute(
        text(
            """
            ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS invoice_path VARCHAR(500) NULL;
            """
        )
    )


def downgrade(connection) -> None:
    connection.execute(text("DROP TABLE IF EXISTS invoices;"))
