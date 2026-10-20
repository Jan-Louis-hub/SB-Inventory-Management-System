"""Add case-insensitive uniqueness, constraints, and query indexes.

Revision ID: 6e24b30a9d5f
Revises: e8a0a7372b82
"""
from alembic import op
import sqlalchemy as sa


revision = "6e24b30a9d5f"
down_revision = "e8a0a7372b82"
branch_labels = None
depends_on = None


def _replace_delete_action(table, column, referred_table, action):
    constraint_name = f"fk_{table}_{column}_{referred_table}"
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        convention = {
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"
        }
        with op.batch_alter_table(table, naming_convention=convention) as batch_op:
            batch_op.drop_constraint(constraint_name, type_="foreignkey")
            batch_op.create_foreign_key(
                constraint_name,
                referred_table,
                [column],
                ["id"],
                ondelete=action,
            )
        return

    existing = next(
        foreign_key
        for foreign_key in sa.inspect(bind).get_foreign_keys(table)
        if foreign_key["constrained_columns"] == [column]
    )
    op.drop_constraint(existing["name"], table, type_="foreignkey")
    op.create_foreign_key(
        constraint_name,
        table,
        referred_table,
        [column],
        ["id"],
        ondelete=action,
    )


def upgrade():
    _replace_delete_action(
        "sale_items", "sale_id", "sales", "RESTRICT"
    )
    _replace_delete_action(
        "purchase_order_items",
        "purchase_order_id",
        "purchase_orders",
        "RESTRICT",
    )

    with op.batch_alter_table("users") as batch_op:
        batch_op.create_check_constraint(
            "ck_users_role",
            "role IN ('admin', 'manager', 'staff', 'cashier', 'stock_controller')",
        )

    with op.batch_alter_table("stock_movements") as batch_op:
        batch_op.drop_constraint("ck_stock_movements_type", type_="check")
        batch_op.create_check_constraint(
            "ck_stock_movements_type",
            "movement_type IN ('receipt', 'sale', 'adjustment', 'return', 'damage')",
        )
        batch_op.create_check_constraint(
            "ck_stock_movements_quantity_nonzero", "quantity_change <> 0"
        )
        batch_op.create_check_constraint(
            "ck_stock_movements_direction",
            "(movement_type IN ('receipt', 'return') AND quantity_change > 0) "
            "OR (movement_type IN ('sale', 'damage') AND quantity_change < 0) "
            "OR movement_type = 'adjustment'",
        )
        batch_op.create_check_constraint(
            "ck_stock_movements_reference_pair",
            "reference_id IS NULL OR reference_type IS NOT NULL",
        )

    with op.batch_alter_table("sales") as batch_op:
        batch_op.add_column(
            sa.Column("idempotency_key", sa.Uuid(as_uuid=True), nullable=True)
        )
        batch_op.create_unique_constraint(
            "uq_sales_idempotency_key", ["idempotency_key"]
        )
        batch_op.create_check_constraint(
            "ck_sales_status",
            "status IN ('pending', 'completed', 'refunded', 'cancelled')",
        )

    with op.batch_alter_table("purchase_orders") as batch_op:
        batch_op.create_check_constraint(
            "ck_purchase_orders_status",
            "status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')",
        )
        batch_op.create_check_constraint(
            "ck_purchase_orders_received_consistent",
            "(status = 'received') = (received_at IS NOT NULL)",
        )

    op.create_index(
        "uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True
    )
    op.create_index(
        "uq_categories_name_lower",
        "categories",
        [sa.text("lower(name)")],
        unique=True,
    )
    op.create_index(
        "uq_products_sku_lower", "products", [sa.text("lower(sku)")], unique=True
    )
    op.create_index("ix_products_category_id", "products", ["category_id"])
    op.create_index("ix_products_is_active", "products", ["is_active"])
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index(
        "ix_stock_movements_product_created",
        "stock_movements",
        ["product_id", "created_at"],
    )
    op.create_index("ix_stock_movements_user_id", "stock_movements", ["user_id"])
    op.create_index("ix_sales_sold_at", "sales", ["sold_at"])
    op.create_index("ix_sales_status", "sales", ["status"])
    op.create_index("ix_sales_user_id", "sales", ["user_id"])
    op.create_index("ix_sale_items_sale_id", "sale_items", ["sale_id"])
    op.create_index("ix_sale_items_product_id", "sale_items", ["product_id"])
    op.create_index(
        "ix_purchase_orders_order_date", "purchase_orders", ["order_date"]
    )
    op.create_index("ix_purchase_orders_status", "purchase_orders", ["status"])
    op.create_index(
        "ix_purchase_orders_supplier_id", "purchase_orders", ["supplier_id"]
    )
    op.create_index("ix_purchase_orders_user_id", "purchase_orders", ["user_id"])
    op.create_index(
        "ix_purchase_order_items_order_id",
        "purchase_order_items",
        ["purchase_order_id"],
    )
    op.create_index(
        "ix_purchase_order_items_product_id",
        "purchase_order_items",
        ["product_id"],
    )


def downgrade():
    _replace_delete_action("sale_items", "sale_id", "sales", "CASCADE")
    _replace_delete_action(
        "purchase_order_items",
        "purchase_order_id",
        "purchase_orders",
        "CASCADE",
    )

    for index_name, table_name in (
        ("ix_purchase_order_items_product_id", "purchase_order_items"),
        ("ix_purchase_order_items_order_id", "purchase_order_items"),
        ("ix_purchase_orders_user_id", "purchase_orders"),
        ("ix_purchase_orders_supplier_id", "purchase_orders"),
        ("ix_purchase_orders_status", "purchase_orders"),
        ("ix_purchase_orders_order_date", "purchase_orders"),
        ("ix_sale_items_product_id", "sale_items"),
        ("ix_sale_items_sale_id", "sale_items"),
        ("ix_sales_user_id", "sales"),
        ("ix_sales_status", "sales"),
        ("ix_sales_sold_at", "sales"),
        ("ix_stock_movements_user_id", "stock_movements"),
        ("ix_stock_movements_product_created", "stock_movements"),
        ("ix_products_name", "products"),
        ("ix_products_is_active", "products"),
        ("ix_products_category_id", "products"),
        ("uq_products_sku_lower", "products"),
        ("uq_categories_name_lower", "categories"),
        ("uq_users_email_lower", "users"),
    ):
        op.drop_index(index_name, table_name=table_name)

    with op.batch_alter_table("purchase_orders") as batch_op:
        batch_op.drop_constraint(
            "ck_purchase_orders_received_consistent", type_="check"
        )
        batch_op.drop_constraint("ck_purchase_orders_status", type_="check")

    with op.batch_alter_table("sales") as batch_op:
        batch_op.drop_constraint("ck_sales_status", type_="check")
        batch_op.drop_constraint("uq_sales_idempotency_key", type_="unique")
        batch_op.drop_column("idempotency_key")

    with op.batch_alter_table("stock_movements") as batch_op:
        batch_op.drop_constraint(
            "ck_stock_movements_reference_pair", type_="check"
        )
        batch_op.drop_constraint(
            "ck_stock_movements_quantity_nonzero", type_="check"
        )
        batch_op.drop_constraint("ck_stock_movements_direction", type_="check")
        batch_op.drop_constraint("ck_stock_movements_type", type_="check")
        batch_op.create_check_constraint(
            "ck_stock_movements_type",
            "movement_type IN ('receipt', 'sale', 'adjustment', 'return')",
        )

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("ck_users_role", type_="check")
