"""Create the Phase 3 users, projects, and sites schema.

Revision ID: 20260917_0001
Revises:
"""

import sqlalchemy as sa
from geoalchemy2 import Geometry

from alembic import op

revision = "20260917_0001"
down_revision = None
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    geometry_type = (
        Geometry(geometry_type="POLYGON", srid=4326)
        if bind.dialect.name == "postgresql"
        else sa.Text()
    )

    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("email"),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=False)

    if "projects" not in tables:
        op.create_table(
            "projects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        )
        op.create_index("ix_projects_owner_id", "projects", ["owner_id"], unique=False)

    if "sites" not in tables:
        op.create_table(
            "sites",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("geometry_json", sa.Text(), nullable=False),
            sa.Column("geometry", geometry_type, nullable=True),
            sa.Column("area_hectares", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        )
        op.create_index("ix_sites_project_id", "sites", ["project_id"], unique=False)
        return

    columns = {column["name"] for column in sa.inspect(bind).get_columns("sites")}
    if "name" not in columns:
        op.add_column(
            "sites",
            sa.Column("name", sa.String(length=120), nullable=False, server_default="Unnamed site"),
        )
    if "geometry" not in columns:
        op.add_column("sites", sa.Column("geometry", geometry_type, nullable=True))


def downgrade() -> None:
    # The initial migration is intentionally non-destructive for compatibility.
    pass
