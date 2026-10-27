from sqlalchemy import CheckConstraint, Index, Numeric, Uuid, func, text

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="staff")
    area = db.Column(db.String(80))
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


class BusinessSettings(db.Model):
    __tablename__ = "business_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_business_settings_singleton"),
        CheckConstraint(
            "default_min >= 0 AND default_min <= 2147483647",
            name="ck_business_settings_default_min_range",
        ),
    )

    id = db.Column(db.Integer, primary_key=True, default=1)
    name = db.Column(db.String(160), nullable=False, default="")
    address = db.Column(db.Text, nullable=False, default="")
    phone = db.Column(db.String(40), nullable=False, default="")
    email = db.Column(db.String(255), nullable=False, default="")
    currency = db.Column(
        db.String(80),
        nullable=False,
        default="South African Rand (ZAR)",
        server_default=text("'South African Rand (ZAR)'"),
    )
    default_min = db.Column(db.Integer, nullable=False, default=0)
    low_stock_alerts = db.Column(db.Boolean, nullable=False, default=True)
    order_alerts = db.Column(db.Boolean, nullable=False, default=True)
    weekly_summary = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
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
        Index("ix_products_supplier_id", "supplier_id"),
        Index("ix_products_is_active", "is_active"),
        Index("ix_products_name", "name"),
        Index("ix_products_location", "location"),
    )

    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(64), nullable=False, unique=True)
    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"))
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id", ondelete="SET NULL"))
    location = db.Column(db.String(80))
    unit = db.Column(db.String(40), nullable=False, default="units", server_default=text("'units'"))
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
    supplier = db.relationship("Supplier")


class Supplier(db.Model):
    __tablename__ = "suppliers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    contact_person = db.Column(db.String(120))
    email = db.Column(db.String(255))
    phone = db.Column(db.String(40))
    address = db.Column(db.Text)
    city = db.Column(db.String(80))
    lead_days = db.Column(db.Integer, nullable=False, default=0, server_default=text("0"))
    categories = db.Column(db.String(255))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    __table_args__ = (
        CheckConstraint("lead_days >= 0", name="ck_suppliers_lead_days_nonnegative"),
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


class StockCount(db.Model):
    __tablename__ = "stock_counts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled', 'in_progress', 'completed')",
            name="ck_stock_counts_status",
        ),
        Index("ix_stock_counts_status", "status"),
        Index("ix_stock_counts_owner_user_id", "owner_user_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    count_number = db.Column(db.String(40), nullable=False, unique=True)
    area = db.Column(db.String(80), nullable=False)
    location = db.Column(db.String(80), nullable=False)
    due_label = db.Column(db.String(40), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="scheduled")
    owner_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_by_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at = db.Column(db.DateTime(timezone=True))

    owner = db.relationship("User", foreign_keys=[owner_user_id])
    created_by = db.relationship("User", foreign_keys=[created_by_user_id])
    lines = db.relationship(
        "StockCountLine",
        back_populates="stock_count",
        cascade="all, delete-orphan",
        order_by="StockCountLine.id",
    )


class StockCountLine(db.Model):
    __tablename__ = "stock_count_lines"
    __table_args__ = (
        CheckConstraint(
            "expected_quantity >= 0",
            name="ck_stock_count_lines_expected_nonnegative",
        ),
        CheckConstraint(
            "counted_quantity IS NULL OR counted_quantity >= 0",
            name="ck_stock_count_lines_counted_nonnegative",
        ),
        db.UniqueConstraint(
            "stock_count_id", "product_id", name="uq_stock_count_lines_count_product"
        ),
        Index("ix_stock_count_lines_stock_count_id", "stock_count_id"),
        Index("ix_stock_count_lines_product_id", "product_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    stock_count_id = db.Column(
        db.Integer,
        db.ForeignKey("stock_counts.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    expected_quantity = db.Column(db.Integer, nullable=False)
    counted_quantity = db.Column(db.Integer)

    stock_count = db.relationship("StockCount", back_populates="lines")
    product = db.relationship("Product")


class StockRequest(db.Model):
    __tablename__ = "stock_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'declined', 'fulfilled')",
            name="ck_stock_requests_status",
        ),
        CheckConstraint("quantity > 0", name="ck_stock_requests_quantity_positive"),
        Index("ix_stock_requests_status", "status"),
        Index("ix_stock_requests_requester_user_id", "requester_user_id"),
        Index("ix_stock_requests_product_id", "product_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    request_number = db.Column(db.String(40), nullable=False, unique=True)
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity = db.Column(db.Integer, nullable=False)
    note = db.Column(db.String(255), nullable=False, default="", server_default=text("''"))
    status = db.Column(db.String(20), nullable=False, default="pending")
    requester_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at = db.Column(db.DateTime(timezone=True))

    product = db.relationship("Product")
    requester = db.relationship("User")
