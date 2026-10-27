"""Add shop-floor fields, stock counts, and stock requests.

Revision ID: f7a8b9c0d1e2
Revises: 2a18c9f47d31
"""
from alembic import op
import sqlalchemy as sa


revision = "f7a8b9c0d1e2"
down_revision = "2a18c9f47d31"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_index("uq_products_sku_lower", table_name="products")

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("area", sa.String(length=80), nullable=True))

    with op.batch_alter_table("suppliers") as batch_op:
        batch_op.add_column(sa.Column("city", sa.String(length=80), nullable=True))
        batch_op.add_column(
            sa.Column(
                "lead_days",
                sa.Integer(),
                server_default="0",
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column("categories", sa.String(length=255), nullable=True)
        )
        batch_op.create_check_constraint(
            "ck_suppliers_lead_days_nonnegative", "lead_days >= 0"
        )

    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("supplier_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("location", sa.String(length=80), nullable=True))
        batch_op.add_column(
            sa.Column(
                "unit",
                sa.String(length=40),
                server_default="units",
                nullable=False,
            )
        )
        batch_op.create_foreign_key(
            "fk_products_supplier_id_suppliers",
            "suppliers",
            ["supplier_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_products_supplier_id", ["supplier_id"])
        batch_op.create_index("ix_products_location", ["location"])

    op.create_table(
        "stock_counts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("count_number", sa.String(length=40), nullable=False),
        sa.Column("area", sa.String(length=80), nullable=False),
        sa.Column("location", sa.String(length=80), nullable=False),
        sa.Column("due_label", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('scheduled', 'in_progress', 'completed')",
            name="ck_stock_counts_status",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("count_number"),
    )
    op.create_index("ix_stock_counts_status", "stock_counts", ["status"])
    op.create_index(
        "ix_stock_counts_owner_user_id", "stock_counts", ["owner_user_id"]
    )

    op.create_table(
        "stock_count_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stock_count_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("expected_quantity", sa.Integer(), nullable=False),
        sa.Column("counted_quantity", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "expected_quantity >= 0",
            name="ck_stock_count_lines_expected_nonnegative",
        ),
        sa.CheckConstraint(
            "counted_quantity IS NULL OR counted_quantity >= 0",
            name="ck_stock_count_lines_counted_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["stock_count_id"], ["stock_counts.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "stock_count_id",
            "product_id",
            name="uq_stock_count_lines_count_product",
        ),
    )
    op.create_index(
        "ix_stock_count_lines_stock_count_id",
        "stock_count_lines",
        ["stock_count_id"],
    )
    op.create_index(
        "ix_stock_count_lines_product_id", "stock_count_lines", ["product_id"]
    )

    op.create_table(
        "stock_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("request_number", sa.String(length=40), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=255), server_default="", nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'declined', 'fulfilled')",
            name="ck_stock_requests_status",
        ),
        sa.CheckConstraint(
            "quantity > 0", name="ck_stock_requests_quantity_positive"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["requester_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_number"),
    )
    op.create_index("ix_stock_requests_status", "stock_requests", ["status"])
    op.create_index(
        "ix_stock_requests_requester_user_id",
        "stock_requests",
        ["requester_user_id"],
    )
    op.create_index(
        "ix_stock_requests_product_id", "stock_requests", ["product_id"]
    )
    op.create_index(
        "uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True
    )
    op.create_index(
        "uq_products_sku_lower", "products", [sa.text("lower(sku)")], unique=True
    )


def downgrade():
    op.drop_index("uq_products_sku_lower", table_name="products")
    op.drop_index("uq_users_email_lower", table_name="users")

    op.drop_table("stock_requests")
    op.drop_table("stock_count_lines")
    op.drop_table("stock_counts")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_index("ix_products_location")
        batch_op.drop_index("ix_products_supplier_id")
        batch_op.drop_constraint(
            "fk_products_supplier_id_suppliers", type_="foreignkey"
        )
        batch_op.drop_column("unit")
        batch_op.drop_column("location")
        batch_op.drop_column("supplier_id")

    with op.batch_alter_table("suppliers") as batch_op:
        batch_op.drop_constraint(
            "ck_suppliers_lead_days_nonnegative", type_="check"
        )
        batch_op.drop_column("categories")
        batch_op.drop_column("lead_days")
        batch_op.drop_column("city")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("area")

    op.create_index(
        "uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True
    )
    op.create_index(
        "uq_products_sku_lower", "products", [sa.text("lower(sku)")], unique=True
    )
