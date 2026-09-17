from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError

from alembic import command
from alembic.config import Config
from app.config import settings


@pytest.mark.integration
def test_postgis_migration_creates_polygon_geometry_column():
    if not settings.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        pytest.skip("PostGIS integration requires a PostgreSQL DATABASE_URL")

    engine = create_engine(settings.database_url)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        pytest.skip(f"PostGIS database unavailable: {exc}")

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")

    columns = {column["name"]: column for column in inspect(engine).get_columns("sites")}
    assert "geometry" in columns
    assert "POLYGON" in str(columns["geometry"]["type"]).upper()
