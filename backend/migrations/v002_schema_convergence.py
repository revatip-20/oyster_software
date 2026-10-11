from sqlalchemy import text


def upgrade(connection) -> None:
    connection.execute(text("DROP INDEX IF EXISTS idx_daily_consumption_employee"))
    connection.execute(
        text("ALTER TABLE daily_consumption DROP CONSTRAINT IF EXISTS daily_consumption_employee_id_fkey")
    )
    connection.execute(text("ALTER TABLE daily_consumption DROP COLUMN IF EXISTS employee_id"))
    connection.execute(text("DROP TABLE IF EXISTS employee"))
    connection.execute(text("ALTER TABLE raw_material DROP COLUMN IF EXISTS reorder_level"))

    for table_name, old_name, new_name in (
        ("customer", "customer_name", "company_name"),
        ("customer", "country", "state"),
        ("supplier", "supplier_name", "company_name"),
        ("element", "element_code", "code"),
    ):
        connection.execute(
            text(
                "DO $$ BEGIN "
                f"IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() "
                f"AND table_name = '{table_name}' AND column_name = '{old_name}') "
                "AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() "
                f"AND table_name = '{table_name}' AND column_name = '{new_name}') THEN "
                f"ALTER TABLE {table_name} RENAME COLUMN {old_name} TO {new_name}; "
                "END IF; END $$"
            )
        )

    for table_name, column_definition in (
        ("element", "code VARCHAR(80)"),
        ("raw_material", "code VARCHAR(80)"),
        ("users", "code VARCHAR(80)"),
        ("supplier", "code VARCHAR(80)"),
        ("customer", "code VARCHAR(80)"),
        ("users", "first_name VARCHAR(100)"),
        ("users", "last_name VARCHAR(100)"),
        ("users", "phone VARCHAR(30)"),
        ("users", "password_hash TEXT"),
        ("users", "joining_date DATE"),
        ("supplier", "city VARCHAR(100)"),
        ("supplier", "state VARCHAR(100)"),
        ("customer", "city VARCHAR(100)"),
        ("customer", "state VARCHAR(100)"),
    ):
        column_name = column_definition.split()[0]
        connection.execute(
            text(
                f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "
                f"{column_definition}"
            )
        )

    connection.execute(
        text(
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() "
            "AND table_name = 'users' AND column_name = 'full_name') THEN "
            "UPDATE users SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')), "
            "last_name = COALESCE(last_name, NULLIF(substring(full_name from position(' ' in full_name) + 1), '')); "
            "ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL; "
            "END IF; "
            "IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() "
            "AND table_name = 'users' AND column_name = 'username') THEN "
            "ALTER TABLE users ALTER COLUMN username DROP NOT NULL; "
            "END IF; END $$"
        )
    )
    connection.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
    connection.execute(
        text(
            "UPDATE users SET first_name = COALESCE(first_name, 'Admin'), "
            "last_name = COALESCE(last_name, 'User'), phone = COALESCE(phone, ''), "
            "role = COALESCE(role, 'admin')"
        )
    )
    connection.execute(text("UPDATE users SET password_hash = NULL WHERE role = 'employee'"))
    connection.execute(
        text("UPDATE users SET password_hash = '' WHERE password_hash IS NULL AND role <> 'employee'")
    )
    connection.execute(text("ALTER TABLE users ALTER COLUMN first_name SET NOT NULL"))
    connection.execute(text("ALTER TABLE users ALTER COLUMN last_name SET NOT NULL"))
    connection.execute(text("ALTER TABLE users ALTER COLUMN phone SET NOT NULL"))
    connection.execute(text("ALTER TABLE users ALTER COLUMN role SET NOT NULL"))

    code_definitions = (
        ("element", "element_code_seq", "E", 2),
        ("raw_material", "raw_material_code_seq", "R", 2),
        ("supplier", "supplier_code_seq", "S", 2),
        ("customer", "customer_code_seq", "CUST", 5),
    )
    for table_name, sequence_name, prefix, suffix_start in code_definitions:
        connection.execute(
            text(
                f"ALTER TABLE {table_name} ALTER COLUMN code SET DEFAULT "
                f"format_resource_code('{prefix}', nextval('{sequence_name}'))"
            )
        )
        connection.execute(
            text(
                f"SELECT setval('{sequence_name}', GREATEST(" 
                f"COALESCE((SELECT MAX(NULLIF(substring(code FROM {suffix_start}), '')::BIGINT) "
                f"FROM {table_name} WHERE code ~ '^{prefix}[0-9]+$'), 0) + 1, "
                f"(SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM {sequence_name})" 
                "), false)"
            )
        )
        connection.execute(
            text(
                f"UPDATE {table_name} SET code = format_resource_code('{prefix}', "
                f"nextval('{sequence_name}')) WHERE code IS NULL"
            )
        )
        connection.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN code SET NOT NULL"))
        connection.execute(
            text(f"CREATE UNIQUE INDEX IF NOT EXISTS uq_{table_name}_code ON {table_name}(code)")
        )

    connection.execute(
        text(
            "CREATE OR REPLACE FUNCTION set_employee_code() RETURNS TRIGGER AS $$ "
            "BEGIN IF NEW.role = 'employee' AND NEW.code IS NULL THEN "
            "NEW.code := format_resource_code('EMP', nextval('employee_code_seq')); "
            "END IF; RETURN NEW; END; $$ LANGUAGE plpgsql"
        )
    )
    connection.execute(text("DROP TRIGGER IF EXISTS users_set_employee_code ON users"))
    connection.execute(
        text(
            "CREATE TRIGGER users_set_employee_code BEFORE INSERT ON users "
            "FOR EACH ROW EXECUTE FUNCTION set_employee_code()"
        )
    )
    connection.execute(
        text(
            "SELECT setval('employee_code_seq', GREATEST(" 
            "COALESCE((SELECT MAX(NULLIF(substring(code FROM 4), '')::BIGINT) "
            "FROM users WHERE code ~ '^EMP[0-9]+$'), 0) + 1, "
            "(SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM employee_code_seq)" 
            "), false)"
        )
    )
    connection.execute(
        text(
            "UPDATE users SET code = format_resource_code('EMP', nextval('employee_code_seq')) "
            "WHERE role = 'employee' AND code IS NULL"
        )
    )
    connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_code ON users(code)"))