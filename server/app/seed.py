from datetime import date, datetime, timezone
from decimal import Decimal
from secrets import token_urlsafe

from pwdlib import PasswordHash
from sqlalchemy import func

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

DEMO_ADMIN_EMAIL = "owner@threadandneedle.test"
DEMO_ACCOUNTS = (
    {
        "name": "Demo Manager",
        "email": "manager@demo.example.test",
        "password": "ManagerDemo123!",
        "role": "manager",
    },
    {
        "name": "Demo Controller",
        "email": "controller@demo.example.test",
        "password": "ControllerDemo123!",
        "role": "stock_controller",
    },
)
password_hash = PasswordHash.recommended()


def seed_demo_accounts():
    existing_users = {
        user.email.lower(): user
        for user in db.session.query(User)
        .filter(
            func.lower(User.email).in_(
                [account["email"] for account in DEMO_ACCOUNTS]
            )
        )
        .all()
    }
    new_users = []

    for account in DEMO_ACCOUNTS:
        existing = existing_users.get(account["email"])
        if existing is not None:
            if (
                existing.role != account["role"]
                or not existing.is_active
                or not password_hash.verify(
                    account["password"], existing.password_hash
                )
            ):
                raise RuntimeError(
                    f"Demo account {account['email']} already exists with "
                    "different credentials or role; it was not changed"
                )
            continue

        new_users.append(
            User(
                name=account["name"],
                email=account["email"],
                password_hash=password_hash.hash(account["password"]),
                role=account["role"],
            )
        )

    if not new_users:
        return False

    db.session.add_all(new_users)
    db.session.commit()
    return True


def seed_demo_data():
    if db.session.query(User.id).filter_by(email=DEMO_ADMIN_EMAIL).first():
        return False

    admin = User(
        name="Alex Mokoena",
        email=DEMO_ADMIN_EMAIL,
        password_hash=password_hash.hash(token_urlsafe(32)),
        role="admin",
    )
    db.session.add(admin)

    tops = Category(name="Tops", description="T-shirts, shirts, and knitwear")
    bottoms = Category(name="Bottoms", description="Jeans, trousers, and skirts")
    accessories = Category(name="Accessories", description="Small clothing accessories")
    supplier = Supplier(
        name="Cape Garment Wholesale",
        contact_person="Lerato Jacobs",
        email="orders@capegarment.example",
        phone="+27 21 555 0142",
        address="Cape Town, Western Cape",
    )
    db.session.add_all([tops, bottoms, accessories, supplier])
    db.session.flush()

    product_details = [
        ("TEE-BLK-M", "Classic Cotton T-Shirt - Black / M", tops, "8.50", "29.99", 30, 8),
        ("TEE-WHT-L", "Classic Cotton T-Shirt - White / L", tops, "8.50", "29.99", 21, 8),
        ("JNS-BLU-32", "Straight-Leg Denim Jeans - Blue / 32", bottoms, "22.00", "59.99", 15, 5),
        ("HOD-GRY-M", "Fleece Hoodie - Grey / M", tops, "28.00", "69.99", 10, 4),
        ("CAP-LOGO-OS", "Embroidered Logo Cap - One Size", accessories, "5.00", "14.99", 12, 4),
    ]
    products = [
        Product(
            sku=sku,
            name=name,
            category_id=category.id,
            cost_price=Decimal(cost),
            selling_price=Decimal(price),
            quantity=quantity,
            reorder_level=reorder_level,
            is_active=True,
        )
        for sku, name, category, cost, price, quantity, reorder_level in product_details
    ]
    db.session.add_all(products)
    db.session.flush()

    purchase = PurchaseOrder(
        purchase_number="PO-DEMO-0001",
        supplier_id=supplier.id,
        user_id=admin.id,
        status="received",
        order_date=date(2026, 9, 10),
        expected_date=date(2026, 9, 17),
        received_at=datetime(2026, 9, 16, 10, 0, tzinfo=timezone.utc),
        total_amount=Decimal("414.00"),
    )
    sale = Sale(
        sale_number="SALE-DEMO-0001",
        user_id=admin.id,
        status="completed",
        subtotal=Decimal("89.98"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("89.98"),
        sold_at=datetime(2026, 10, 5, 12, 30, tzinfo=timezone.utc),
    )
    db.session.add_all([purchase, sale])
    db.session.flush()

    purchase_receipts = [
        (products[0], 12),
        (products[1], 8),
        (products[2], 6),
        (products[3], 4),
    ]
    for product, quantity in purchase_receipts:
        unit_cost = product.cost_price
        db.session.add(
            PurchaseOrderItem(
                purchase_order_id=purchase.id,
                product_id=product.id,
                quantity_ordered=quantity,
                quantity_received=quantity,
                unit_cost=unit_cost,
                line_total=unit_cost * quantity,
            )
        )
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=admin.id,
                movement_type="receipt",
                quantity_change=quantity,
                reason="Received demo purchase order",
                reference_type="purchase_order",
                reference_id=purchase.id,
            )
        )

    opening_stock = [
        (products[0], 19),
        (products[1], 13),
        (products[2], 10),
        (products[3], 6),
        (products[4], 12),
    ]
    for product, quantity in opening_stock:
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=admin.id,
                movement_type="adjustment",
                quantity_change=quantity,
                reason="Opening stock",
                reference_type="opening_balance",
            )
        )

    sale_lines = [
        (products[0], 1),
        (products[2], 1),
    ]
    for product, quantity in sale_lines:
        db.session.add(
            SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=product.selling_price,
                unit_cost=product.cost_price,
                line_total=product.selling_price * quantity,
            )
        )
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=admin.id,
                movement_type="sale",
                quantity_change=-quantity,
                reason="Demo retail sale",
                reference_type="sale",
                reference_id=sale.id,
            )
        )

    db.session.commit()
    return True
