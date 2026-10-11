def upgrade(connection) -> None:
    from migrations.legacy_daily_input_models import DailyInputElement, DailyInputRawMaterial

    from db.database import Base

    Base.metadata.create_all(
        bind=connection,
        tables=[DailyInputElement.__table__, DailyInputRawMaterial.__table__],
    )