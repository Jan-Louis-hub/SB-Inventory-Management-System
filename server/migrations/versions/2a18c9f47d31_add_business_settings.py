"""Add persistent business settings.

Revision ID: 2a18c9f47d31
Revises: c41d8e7a2b90
"""
from alembic import op
import sqlalchemy as sa


revision = "2a18c9f47d31"
down_revision = "c41d8e7a2b90"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "business_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), server_default="", nullable=False),
        sa.Column("address", sa.Text(), server_default="", nullable=False),
        sa.Column("phone", sa.String(length=40), server_default="", nullable=False),
        sa.Column("email", sa.String(length=255), server_default="", nullable=False),
        sa.Column(
            "currency",
            sa.String(length=80),
            server_default="South African Rand (ZAR)",
            nullable=False,
        ),
        sa.Column("default_min", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "low_stock_alerts", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
        sa.Column(
            "order_alerts", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
        sa.Column(
            "weekly_summary", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("id = 1", name="ck_business_settings_singleton"),
        sa.CheckConstraint(
            "default_min >= 0 AND default_min <= 2147483647",
            name="ck_business_settings_default_min_range",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("business_settings")
