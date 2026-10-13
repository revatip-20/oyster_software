from sqlalchemy import text

from migrations.v001_initial_schema import upgrade as create_initial_schema
from migrations.v002_schema_convergence import upgrade as converge_existing_schema
from migrations.v003_daily_input_tables import upgrade as create_daily_input_tables
from migrations.v004_remove_legacy_tables_and_columns import upgrade as remove_legacy_schema
from migrations.v005_optional_daily_input_codes_required_contacts import upgrade as update_field_requirements
from migrations.v006_integer_daily_input_quantity import upgrade as convert_daily_input_quantities
from migrations.v007_unified_daily_input import upgrade as create_unified_daily_input
from migrations.v008_daily_input_element_and_raw_material import (
    upgrade as add_element_and_raw_material_to_daily_input,
)
from migrations.v009_element_customer_and_raw_material_supplier import (
    upgrade as update_element_and_raw_material_relations,
)
from migrations.v010_element_supplier_and_daily_input_user import (
    upgrade as add_supplier_to_element_and_user_to_daily_input,
)
from migrations.v011_remove_element_relations_and_raw_material_supplier import (
    upgrade as remove_element_relations_and_raw_material_supplier,
)
from migrations.v012_daily_input_unit import (
    upgrade as add_unit_to_daily_input,
)
from migrations.v013_rawmaterial import (
    upgrade as add_rate_and_gst_to_raw_material_and_daily_input,
)
from migrations.v014_invoice import (
    upgrade as add_invoice,
)
from migrations.v015_raw_material_hsn_code import (
    upgrade as add_hsn_code_to_raw_material,
)
from migrations.v016_drop_invoices import (
    upgrade as drop_invoices,
)

MIGRATIONS = (
    ("001_initial_schema", create_initial_schema),
    ("002_schema_convergence", converge_existing_schema),
    ("003_daily_input_tables", create_daily_input_tables),
    ("004_remove_legacy_tables_and_columns", remove_legacy_schema),
    ("005_optional_daily_input_codes_required_contacts", update_field_requirements),
    ("006_integer_daily_input_quantity", convert_daily_input_quantities),
    ("007_unified_daily_input", create_unified_daily_input),
    ("008_daily_input_element_and_raw_material", add_element_and_raw_material_to_daily_input),
    ("009_element_customer_and_raw_material_supplier", update_element_and_raw_material_relations),
    ("010_element_supplier_and_daily_input_user", add_supplier_to_element_and_user_to_daily_input),
    ("011_remove_element_relations_and_raw_material_supplier", remove_element_relations_and_raw_material_supplier),
    ("012_daily_input_unit", add_unit_to_daily_input),
    ("013_rawmaterial", add_rate_and_gst_to_raw_material_and_daily_input),
    ("014_invoice", add_invoice),
    ("015_raw_material_hsn_code", add_hsn_code_to_raw_material),
    ("016_drop_invoices", drop_invoices),
)


def run_migrations(engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version VARCHAR(100) PRIMARY KEY, "
                "applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
            )
        )
        connection.execute(text("SELECT pg_advisory_xact_lock(846192753)"))

        for version, upgrade in MIGRATIONS:
            already_applied = connection.execute(
                text("SELECT 1 FROM schema_migrations WHERE version = :version"),
                {"version": version},
            ).first()
            if already_applied:
                continue

            upgrade(connection)
            connection.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                {"version": version},
            )