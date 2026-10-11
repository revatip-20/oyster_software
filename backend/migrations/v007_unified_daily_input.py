from sqlalchemy import inspect, text


def upgrade(connection) -> None:
    from db.database import Base
    from models.daily_input import DailyInput

    Base.metadata.create_all(bind=connection, tables=[DailyInput.__table__])

    existing_tables = set(inspect(connection).get_table_names())
    legacy_tables = (
        ("daily_input_element", "element"),
        ("daily_input_raw_material", "raw_material"),
    )
    for table_name, input_type in legacy_tables:
        if table_name not in existing_tables:
            continue

        connection.execute(
            text(
                f'INSERT INTO daily_input '
                '(dc_no, dc_date, bill_no, bill_date, item, quantity, type, '
                'customer_id, supplier_id, created_at, updated_at, deleted_at) '
                f'SELECT old."DC_no", old.in_date, old.bill_no, NULL, old.item, '
                f"old.quantity, '{input_type}', customer.id, supplier.id, "
                'old.created_at, old.updated_at, old.deleted_at '
                f'FROM {table_name} AS old '
                'LEFT JOIN customer ON customer.code = old.customer_code '
                'LEFT JOIN supplier ON supplier.code = old.supplier_code'
            )
        )
        connection.execute(text(f"DROP TABLE {table_name}"))