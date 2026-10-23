"""Add OAuth identities and one-time login codes.

Revision ID: ab41c76f2d09
Revises: 6e24b30a9d5f
"""
from alembic import op
import sqlalchemy as sa


revision = "ab41c76f2d09"
down_revision = "6e24b30a9d5f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "oauth_identities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider", "subject", name="uq_oauth_identity_provider_subject"
        ),
        sa.UniqueConstraint(
            "provider", "user_id", name="uq_oauth_identity_provider_user"
        ),
    )
    op.create_table(
        "oauth_login_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_index(
        "ix_oauth_login_codes_expires_at",
        "oauth_login_codes",
        ["expires_at"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_oauth_login_codes_expires_at", table_name="oauth_login_codes")
    op.drop_table("oauth_login_codes")
    op.drop_table("oauth_identities")
