"""Allow all currently supported user roles.

Revision ID: c41d8e7a2b90
Revises: ab41c76f2d09
"""
from alembic import op
import sqlalchemy as sa


revision = "c41d8e7a2b90"
down_revision = "ab41c76f2d09"
branch_labels = None
depends_on = None


ROLE_CHECK = (
    "role IN ('admin', 'manager', 'staff', 'cashier', 'stock_controller')"
)


def upgrade():
    bind = op.get_bind()
    role_checks = [
        constraint
        for constraint in sa.inspect(bind).get_check_constraints("users")
        if "role" in (constraint.get("sqltext") or "").lower()
    ]

    if bind.dialect.name == "sqlite":
        email_index_exists = (
            bind.exec_driver_sql(
                "SELECT 1 FROM sqlite_master "
                "WHERE type = 'index' AND name = 'uq_users_email_lower'"
            ).scalar()
            is not None
        )
        if email_index_exists:
            op.drop_index("uq_users_email_lower", table_name="users")
        with op.batch_alter_table("users") as batch_op:
            for constraint in role_checks:
                if constraint["name"]:
                    batch_op.drop_constraint(constraint["name"], type_="check")
            batch_op.create_check_constraint("ck_users_role", ROLE_CHECK)
        if email_index_exists:
            op.create_index(
                "uq_users_email_lower",
                "users",
                [sa.text("lower(email)")],
                unique=True,
            )
        return

    for constraint in role_checks:
        if constraint["name"]:
            op.drop_constraint(constraint["name"], "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", ROLE_CHECK)


def downgrade():
    bind = op.get_bind()
    role_checks = [
        constraint
        for constraint in sa.inspect(bind).get_check_constraints("users")
        if "role" in (constraint.get("sqltext") or "").lower()
    ]

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("users") as batch_op:
            for constraint in role_checks:
                if constraint["name"]:
                    batch_op.drop_constraint(constraint["name"], type_="check")
            batch_op.create_check_constraint(
                "users_role_check",
                "role IN ('admin', 'manager', 'staff', 'cashier')",
            )
        return

    for constraint in role_checks:
        if constraint["name"]:
            op.drop_constraint(constraint["name"], "users", type_="check")
    op.create_check_constraint(
        "users_role_check",
        "users",
        "role IN ('admin', 'manager', 'staff', 'cashier')",
    )
