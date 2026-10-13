from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(text("DROP TABLE IF EXISTS invoices;"))
