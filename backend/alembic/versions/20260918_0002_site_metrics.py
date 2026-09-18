"""Add site analytics metrics.

Revision ID: 20260918_0002
Revises: 20260917_0001
"""

import sqlalchemy as sa

from alembic import op

revision = "20260918_0002"
down_revision = "20260917_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "site_metrics" not in tables:
        op.create_table(
            "site_metrics",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("site_id", sa.Integer(), nullable=False),
            sa.Column("period", sa.Date(), nullable=False),
            sa.Column("carbon_tonnes_co2e", sa.Float(), nullable=True),
            sa.Column("biodiversity_score", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("site_id", "period", name="uq_site_metrics_site_period"),
        )

    index_names = {index["name"] for index in inspector.get_indexes("site_metrics")}
    if "ix_site_metrics_site_id" not in index_names:
        op.create_index("ix_site_metrics_site_id", "site_metrics", ["site_id"])
    if "ix_site_metrics_period" not in index_names:
        op.create_index("ix_site_metrics_period", "site_metrics", ["period"])


def downgrade() -> None:
    op.drop_index("ix_site_metrics_period", table_name="site_metrics")
    op.drop_index("ix_site_metrics_site_id", table_name="site_metrics")
    op.drop_table("site_metrics")
