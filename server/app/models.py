from sqlalchemy import CheckConstraint, Index, Numeric, Uuid, func, text

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="staff")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'manager', 'staff', 'cashier', 'stock_controller')",
            name="ck_users_role",
        ),
        Index("uq_users_email_lower", func.lower(email), unique=True),
    )


class OAuthIdentity(db.Model):
    __tablename__ = "oauth_identities"
    __table_args__ = (
        db.UniqueConstraint("provider", "subject", name="uq_oauth_identity_provider_subject"),
        db.UniqueConstraint("provider", "user_id", name="uq_oauth_identity_provider_user"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = db.Column(db.String(20), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    user = db.relationship("User")


class OAuthLoginCode(db.Model):
    __tablename__ = "oauth_login_codes"
    __table_args__ = (Index("ix_oauth_login_codes_expires_at", "expires_at"),)

    id = db.Column(db.Integer, primary_key=True)
    code_hash = db.Column(db.String(64), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)

    user = db.relationship("User")


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    __table_args__ = (
        Index("uq_categories_name_lower", func.lower(name), unique=True),
    )


class Product(db.Model):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("cost_price >= 0", name="ck_products_cost_price_nonnegative"),
        CheckConstraint("selling_price >= 0", name="ck_products_selling_price_nonnegative"),
        CheckConstraint("quantity >= 0", name="ck_products_quantity_nonnegative"),
        CheckConstraint("reorder_level >= 0", name="ck_products_reorder_level_nonnegative"),
        Index("uq_products_sku_lower", text("lower(sku)"), unique=True),
        Index("ix_products_category_id", "category_id"),
        Index("ix_products_is_active", "is_active"),
        Index("ix_products_name", "name"),
    )

    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(64), nullable=False, unique=True)
    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"))
    cost_price = db.Column(Numeric(12, 2), nullable=False)
    selling_price = db.Column(Numeric(12, 2), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    reorder_level = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    category = db.relationship("Category")


class Supplier(db.Model):
    __tablename__ = "suppliers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    contact_person = db.Column(db.String(120))
    email = db.Column(db.String(255))
    phone = db.Column(db.String(40))
    address = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class StockMovement(db.Model):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint(
            "movement_type IN ('receipt', 'sale', 'adjustment', 'return', 'damage')",
            name="ck_stock_movements_type",
        ),
        CheckConstraint(
            "quantity_change <> 0", name="ck_stock_movements_quantity_nonzero"
        ),
        CheckConstraint(
            "(movement_type IN ('receipt', 'return') AND quantity_change > 0) "
            "OR (movement_type IN ('sale', 'damage') AND quantity_change < 0) "
            "OR movement_type = 'adjustment'",
            name="ck_stock_movements_direction",
        ),
        CheckConstraint(
            "reference_id IS NULL OR reference_type IS NOT NULL",
            name="ck_stock_movements_reference_pair",
        ),
        Index("ix_stock_movements_product_created", "product_id", "created_at"),
        Index("ix_stock_movements_user_id", "user_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    movement_type = db.Column(db.String(20), nullable=False)
    quantity_change = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    reference_type = db.Column(db.String(40))
    reference_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    product = db.relationship("Product")
    user = db.relationship("User")


class Sale(db.Model):
    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'completed', 'refunded', 'cancelled')",
            name="ck_sales_status",
        ),
        CheckConstraint(
            "subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 "
            "AND total_amount >= 0",
            name="ck_sales_amounts_nonnegative",
        ),
        Index("ix_sales_sold_at", "sold_at"),
        Index("ix_sales_status", "status"),
        Index("ix_sales_user_id", "user_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    sale_number = db.Column(db.String(40), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="completed")
    subtotal = db.Column(Numeric(12, 2), nullable=False)
    discount_amount = db.Column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    tax_amount = db.Column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    total_amount = db.Column(Numeric(12, 2), nullable=False)
    sold_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    idempotency_key = db.Column(Uuid(as_uuid=True), unique=True)

    user = db.relationship("User")


class SaleItem(db.Model):
    __tablename__ = "sale_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_items_quantity_positive"),
        CheckConstraint(
            "unit_price >= 0 AND unit_cost >= 0 AND line_total >= 0",
            name="ck_sale_items_amounts_nonnegative",
        ),
        Index("ix_sale_items_sale_id", "sale_id"),
        Index("ix_sale_items_product_id", "product_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "sales.id",
            ondelete="RESTRICT",
            name="fk_sale_items_sale_id_sales",
        ),
        nullable=False,
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(Numeric(12, 2), nullable=False)
    unit_cost = db.Column(Numeric(12, 2), nullable=False)
    line_total = db.Column(Numeric(12, 2), nullable=False)

    sale = db.relationship("Sale")
    product = db.relationship("Product")


class PurchaseOrder(db.Model):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')",
            name="ck_purchase_orders_status",
        ),
        CheckConstraint("total_amount >= 0", name="ck_purchase_orders_total_nonnegative"),
        CheckConstraint(
            "(status = 'received') = (received_at IS NOT NULL)",
            name="ck_purchase_orders_received_consistent",
        ),
        Index("ix_purchase_orders_order_date", "order_date"),
        Index("ix_purchase_orders_status", "status"),
        Index("ix_purchase_orders_supplier_id", "supplier_id"),
        Index("ix_purchase_orders_user_id", "user_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    purchase_number = db.Column(db.String(40), nullable=False, unique=True)
    supplier_id = db.Column(
        db.Integer, db.ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="draft")
    order_date = db.Column(db.Date, nullable=False)
    expected_date = db.Column(db.Date)
    received_at = db.Column(db.DateTime(timezone=True))
    total_amount = db.Column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    supplier = db.relationship("Supplier")
    user = db.relationship("User")


class PurchaseOrderItem(db.Model):
    __tablename__ = "purchase_order_items"
    __table_args__ = (
        CheckConstraint("quantity_ordered > 0", name="ck_purchase_order_items_ordered_positive"),
        CheckConstraint(
            "quantity_received >= 0 AND quantity_received <= quantity_ordered",
            name="ck_purchase_order_items_received_range",
        ),
        CheckConstraint(
            "unit_cost >= 0 AND line_total >= 0",
            name="ck_purchase_order_items_amounts_nonnegative",
        ),
        Index("ix_purchase_order_items_order_id", "purchase_order_id"),
        Index("ix_purchase_order_items_product_id", "product_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "purchase_orders.id",
            ondelete="RESTRICT",
            name="fk_purchase_order_items_purchase_order_id_purchase_orders",
        ),
        nullable=False,
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_ordered = db.Column(db.Integer, nullable=False)
    quantity_received = db.Column(db.Integer, nullable=False, default=0)
    unit_cost = db.Column(Numeric(12, 2), nullable=False)
    line_total = db.Column(Numeric(12, 2), nullable=False)

    purchase_order = db.relationship("PurchaseOrder")
    product = db.relationship("Product")
