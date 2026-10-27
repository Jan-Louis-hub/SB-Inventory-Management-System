from datetime import date, datetime, timezone
from decimal import Decimal
from secrets import token_urlsafe

from pwdlib import PasswordHash

import app as app_module
from app.extensions import db
from app.models import (
    Category,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    Sale,
    SaleItem,
    StockMovement,
    Supplier,
    User,
)


_create_app = app_module.create_app
_password_hash = PasswordHash.recommended()


def _seed_test_data():
    if User.query.filter_by(email="owner@threadandneedle.test").first():
        return False

    owner = User(
        name="Test Inventory Owner",
        email="owner@threadandneedle.test",
        password_hash=_password_hash.hash(token_urlsafe(32)),
        role="admin",
    )
    categories = [
        Category(name="Tops", description="Test category"),
        Category(name="Bottoms", description="Test category"),
        Category(name="Accessories", description="Test category"),
    ]
    supplier = Supplier(name="Test Wholesale")
    db.session.add_all([owner, *categories, supplier])
    db.session.flush()

    details = [
        ("TEE-BLK-M", "Test Tee", 0, "8.50", "29.99", 30),
        ("TEE-WHT-L", "Test Shirt", 0, "8.50", "29.99", 21),
        ("JNS-BLU-32", "Test Jeans", 1, "22.00", "59.99", 15),
        ("HOD-GRY-M", "Test Hoodie", 1, "28.00", "69.99", 10),
        ("CAP-LOGO-OS", "Test Cap", 2, "5.00", "14.99", 12),
    ]
    products = [
        Product(
            sku=sku,
            name=name,
            category_id=categories[category].id,
            cost_price=Decimal(cost),
            selling_price=Decimal(price),
            quantity=quantity,
            reorder_level=1,
        )
        for sku, name, category, cost, price, quantity in details
    ]
    db.session.add_all(products)
    db.session.flush()

    purchase = PurchaseOrder(
        purchase_number="PO-TEST-SEED-0001",
        supplier_id=supplier.id,
        user_id=owner.id,
        status="received",
        order_date=date(2026, 9, 10),
        expected_date=date(2026, 9, 17),
        received_at=datetime(2026, 9, 16, 10, 0, tzinfo=timezone.utc),
        total_amount=Decimal("414.00"),
    )
    sale = Sale(
        sale_number="SALE-TEST-SEED-0001",
        user_id=owner.id,
        status="completed",
        subtotal=Decimal("89.98"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("89.98"),
        sold_at=datetime(2026, 10, 5, 12, 30, tzinfo=timezone.utc),
    )
    db.session.add_all([purchase, sale])
    db.session.flush()

    for product, quantity in zip(products[:4], [12, 8, 6, 4]):
        db.session.add(
            PurchaseOrderItem(
                purchase_order_id=purchase.id,
                product_id=product.id,
                quantity_ordered=quantity,
                quantity_received=quantity,
                unit_cost=product.cost_price,
                line_total=product.cost_price * quantity,
            )
        )
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=owner.id,
                movement_type="receipt",
                quantity_change=quantity,
                reason="Test purchase receipt",
                reference_type="purchase_order",
                reference_id=purchase.id,
            )
        )
    for product, quantity in zip(products, [19, 13, 10, 6, 12]):
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=owner.id,
                movement_type="adjustment",
                quantity_change=quantity,
                reason="Test opening balance",
                reference_type="opening_balance",
            )
        )
    for product in (products[0], products[2]):
        db.session.add(
            SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=1,
                unit_price=product.selling_price,
                unit_cost=product.cost_price,
                line_total=product.selling_price,
            )
        )
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=owner.id,
                movement_type="sale",
                quantity_change=-1,
                reason="Test sale",
                reference_type="sale",
                reference_id=sale.id,
            )
        )
    db.session.commit()
    return True


def _seed_test_accounts():
    accounts = [
        ("Test Manager", "manager@demo.example.test", "ManagerDemo123!", "manager"),
        (
            "Test Controller",
            "controller@demo.example.test",
            "ControllerDemo123!",
            "stock_controller",
        ),
    ]
    created = False
    for name, email, password, role in accounts:
        if User.query.filter_by(email=email).first():
            continue
        db.session.add(
            User(
                name=name,
                email=email,
                password_hash=_password_hash.hash(password),
                role=role,
            )
        )
        created = True
    if created:
        db.session.commit()
    return created


def _create_test_app(config=None):
    app = _create_app(config)
    if not app.config.get("TESTING"):
        return app

    @app.cli.command("seed-demo")
    def seed_demo_test_data():
        if app.config["APP_ENV"] == "production":
            raise RuntimeError("Demo data cannot be seeded in production")
        _seed_test_data()

    @app.cli.command("seed-demo-accounts")
    def seed_demo_test_accounts():
        if app.config["APP_ENV"] == "production":
            raise RuntimeError("Demo accounts cannot be created in production")
        _seed_test_accounts()

    return app


app_module.create_app = _create_test_app
