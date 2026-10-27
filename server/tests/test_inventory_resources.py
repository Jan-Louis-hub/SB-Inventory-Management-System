from decimal import Decimal

from app import create_app
from app.api.auth import create_access_token
from app.extensions import db
from app.models import Product, StockMovement, User


def test_initial_manager_can_be_provisioned_without_sample_data():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "testing",
            "SECRET_KEY": "test-only-key-that-is-at-least-32-bytes-long",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    migration = app.test_cli_runner().invoke(args=["db", "upgrade"])
    assert migration.exit_code == 0, migration.output

    created = app.test_cli_runner().invoke(
        args=["create-manager", "--email", "first@example.test"],
        input="First Manager\ncorrect-horse-battery\ncorrect-horse-battery\n",
    )
    assert created.exit_code == 0, created.output
    with app.app_context():
        assert db.session.query(Product).count() == 0
        assert db.session.query(User).one().role == "manager"

    duplicate_manager = app.test_cli_runner().invoke(
        args=["create-manager", "--email", "second@example.test"],
        input="Second Manager\ncorrect-horse-battery\ncorrect-horse-battery\n",
    )
    assert duplicate_manager.exit_code != 0
    assert "A manager account already exists" in duplicate_manager.output
    invalid_email = app.test_cli_runner().invoke(
        args=["create-manager", "--email", "not-an-email"],
        input="Another Manager\ncorrect-horse-battery\ncorrect-horse-battery\n",
    )
    assert invalid_email.exit_code != 0
    assert "valid email address is required" in invalid_email.output

    login = app.test_client().post(
        "/api/auth/login",
        json={"email": "first@example.test", "password": "correct-horse-battery"},
    )
    assert login.status_code == 200
    assert login.json["user"]["role"] == "inventory_manager"


def test_real_inventory_supplier_order_sale_and_user_apis():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "testing",
            "SECRET_KEY": "test-only-key-that-is-at-least-32-bytes-long",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    migration = app.test_cli_runner().invoke(args=["db", "upgrade"])
    assert migration.exit_code == 0, migration.output

    with app.app_context():
        manager = User(
            name="Inventory Manager",
            email="manager@example.test",
            password_hash="unused",
            role="manager",
        )
        db.session.add(manager)
        db.session.commit()
        token = create_access_token(manager)
        manager_id = manager.id
    client = app.test_client()
    headers = {"Authorization": f"Bearer {token}"}

    category = client.post(
        "/api/categories",
        headers=headers,
        json={"name": "Office supplies"},
    )
    assert category.status_code == 201
    supplier = client.post(
        "/api/suppliers",
        headers=headers,
        json={"name": "Local supplier", "email": "orders@example.test"},
    )
    assert supplier.status_code == 201
    user = client.post(
        "/api/users",
        headers=headers,
        json={
            "name": "Stock Controller",
            "email": "controller@example.test",
            "password": "a-secure-test-password",
            "role": "stock_controller",
        },
    )
    assert user.status_code == 201
    assert user.json["user"]["role"] == "stock_controller"

    product = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "OFFICE-001",
            "name": "Notebook",
            "category_id": category.json["category"]["id"],
            "cost_price": "2.50",
            "selling_price": "5.00",
            "quantity": 4,
            "reorder_level": 1,
        },
    )
    assert product.status_code == 201
    product_id = product.json["product"]["id"]
    expensive_product = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "OFFICE-002",
            "name": "High-value item",
            "cost_price": "9999999999.99",
            "selling_price": "9999999999.99",
            "quantity": 3,
        },
    )
    assert expensive_product.status_code == 201
    excessive_order = client.post(
        "/api/purchase-orders",
        headers=headers,
        json={
            "supplier_id": supplier.json["supplier"]["id"],
            "items": [
                {
                    "product_id": expensive_product.json["product"]["id"],
                    "quantity_ordered": 2,
                }
            ],
        },
    )
    assert excessive_order.status_code == 400
    excessive_sale = client.post(
        "/api/sales",
        headers=headers,
        json={
            "items": [
                {"product_id": expensive_product.json["product"]["id"], "quantity": 2}
            ]
        },
    )
    assert excessive_sale.status_code == 409
    with app.app_context():
        assert db.session.get(Product, expensive_product.json["product"]["id"]).quantity == 3

    full_stock_product = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "OFFICE-003",
            "name": "Full stock item",
            "cost_price": "1.00",
            "selling_price": "2.00",
            "quantity": 2147483647,
        },
    )
    assert full_stock_product.status_code == 201
    overflow_order = client.post(
        "/api/purchase-orders",
        headers=headers,
        json={
            "supplier_id": supplier.json["supplier"]["id"],
            "items": [
                {
                    "product_id": full_stock_product.json["product"]["id"],
                    "quantity_ordered": 1,
                }
            ],
        },
    )
    overflow_line = overflow_order.json["purchase_order"]["items"][0]
    overflow_receipt = client.post(
        f"/api/purchase-orders/{overflow_order.json['purchase_order']['id']}/items/{overflow_line['id']}/receive",
        headers=headers,
        json={"quantity": 1},
    )
    assert overflow_receipt.status_code == 409
    with app.app_context():
        assert (
            db.session.get(Product, full_stock_product.json["product"]["id"]).quantity
            == 2147483647
        )

    order = client.post(
        "/api/purchase-orders",
        headers=headers,
        json={
            "supplier_id": supplier.json["supplier"]["id"],
            "items": [{"product_id": product_id, "quantity_ordered": 3}],
        },
    )
    assert order.status_code == 201
    line = order.json["purchase_order"]["items"][0]
    received = client.post(
        f"/api/purchase-orders/{order.json['purchase_order']['id']}/items/{line['id']}/receive",
        headers=headers,
        json={"quantity": 3},
    )
    assert received.status_code == 200
    assert received.json["purchase_order"]["status"] == "received"

    sale = client.post(
        "/api/sales",
        headers=headers,
        json={"items": [{"product_id": product_id, "quantity": 2}]},
    )
    assert sale.status_code == 201
    assert sale.json["sale"]["subtotal"] == "10.00"
    assert client.get("/api/purchase-orders", headers=headers).json["purchase_orders"]
    assert client.get("/api/sales", headers=headers).json["sales"]

    with app.app_context():
        assert db.session.get(Product, product_id).quantity == 5
        assert db.session.query(StockMovement).count() == 5
        assert db.session.get(User, manager_id).role == "manager"
        assert (
            db.session.query(Product)
            .filter_by(sku="OFFICE-001")
            .one()
            .cost_price
            == Decimal("2.50")
        )


def test_business_settings_are_persistent_and_manager_only():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "testing",
            "SECRET_KEY": "test-only-key-that-is-at-least-32-bytes-long",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    migration = app.test_cli_runner().invoke(args=["db", "upgrade"])
    assert migration.exit_code == 0, migration.output
    with app.app_context():
        manager = User(
            name="Business Manager",
            email="manager@example.test",
            password_hash="unused",
            role="manager",
        )
        staff = User(
            name="Business Staff",
            email="staff@example.test",
            password_hash="unused",
            role="staff",
        )
        db.session.add_all([manager, staff])
        db.session.commit()
        manager_token = create_access_token(manager)
        staff_token = create_access_token(staff)

    client = app.test_client()
    assert client.get("/api/settings").status_code == 401
    assert client.get(
        "/api/settings", headers={"Authorization": f"Bearer {staff_token}"}
    ).status_code == 403
    headers = {"Authorization": f"Bearer {manager_token}"}
    initial = client.get("/api/settings", headers=headers)
    assert initial.status_code == 200
    assert initial.json["settings"]["name"] == ""
    assert initial.json["settings"]["default_min"] == 0

    updated = client.patch(
        "/api/settings",
        headers=headers,
        json={
            "name": "Acme Supplies",
            "email": "hello@acme.example",
            "address": "1 Market Street",
            "phone": "+27123456789",
            "default_min": 7,
            "low_stock_alerts": False,
            "order_alerts": True,
            "weekly_summary": True,
        },
    )
    assert updated.status_code == 200
    assert updated.json["settings"]["default_min"] == 7
    assert updated.json["settings"]["low_stock_alerts"] is False
    assert client.get("/api/settings", headers=headers).json == updated.json

    for invalid in (
        {"email": "not-an-email"},
        {"default_min": -1},
        {"weekly_summary": "yes"},
        {"unknown": "value"},
    ):
        response = client.patch("/api/settings", headers=headers, json=invalid)
        assert response.status_code == 400


def test_stock_requests_are_authorized_and_fulfillment_updates_inventory():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "testing",
            "SECRET_KEY": "test-only-key-that-is-at-least-32-bytes-long",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    migration = app.test_cli_runner().invoke(args=["db", "upgrade"])
    assert migration.exit_code == 0, migration.output
    with app.app_context():
        manager = User(name="Manager", email="manager@example.test", password_hash="x", role="manager")
        staff = User(name="Staff", email="staff@example.test", password_hash="x", role="staff")
        db.session.add_all([manager, staff])
        db.session.flush()
        product = Product(
            sku="REQ-001",
            name="Request product",
            cost_price=Decimal("2.00"),
            selling_price=Decimal("4.00"),
            quantity=2,
        )
        db.session.add(product)
        db.session.commit()
        product_id = product.id
        manager_token = create_access_token(manager)
        staff_token = create_access_token(staff)

    client = app.test_client()
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    created = client.post(
        "/api/stock-requests",
        headers=staff_headers,
        json={"product_id": product_id, "quantity": 3, "note": "Replenish"},
    )
    assert created.status_code == 201
    request_id = created.json["stock_request"]["id"]
    assert client.get("/api/stock-requests", headers=staff_headers).json["stock_requests"][0]["id"] == request_id
    assert client.post(
        f"/api/stock-requests/{request_id}/approve", headers=staff_headers
    ).status_code == 403
    assert client.post(
        f"/api/stock-requests/{request_id}/approve", headers=manager_headers
    ).status_code == 200
    fulfilled = client.post(
        f"/api/stock-requests/{request_id}/fulfill", headers=manager_headers
    )
    assert fulfilled.status_code == 200
    assert fulfilled.json["stock_request"]["status"] == "fulfilled"
    assert client.post(
        f"/api/stock-requests/{request_id}/fulfill", headers=manager_headers
    ).status_code == 409
    with app.app_context():
        assert db.session.get(Product, product_id).quantity == 5
        movement = StockMovement.query.filter_by(reference_type="stock_request").one()
        assert movement.quantity_change == 3


def test_stock_count_completion_reconciles_stock_once():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "testing",
            "SECRET_KEY": "test-only-key-that-is-at-least-32-bytes-long",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    migration = app.test_cli_runner().invoke(args=["db", "upgrade"])
    assert migration.exit_code == 0, migration.output
    with app.app_context():
        manager = User(name="Manager", email="manager@example.test", password_hash="x", role="manager")
        db.session.add(manager)
        db.session.flush()
        product = Product(
            sku="COUNT-001",
            name="Count product",
            cost_price=Decimal("2.00"),
            selling_price=Decimal("4.00"),
            quantity=5,
            location="Shelf A",
        )
        db.session.add(product)
        db.session.commit()
        product_id = product.id
        token = create_access_token(manager)

    client = app.test_client()
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/stock-counts",
        headers=headers,
        json={"area": "Floor", "location": "Shelf A", "due_label": "Today"},
    )
    assert created.status_code == 201
    count = created.json["stock_count"]
    line = count["lines"][0]
    assert line["expected_quantity"] == 5
    incomplete = client.post(
        f"/api/stock-counts/{count['id']}/complete", headers=headers
    )
    assert incomplete.status_code == 400
    update = client.patch(
        f"/api/stock-counts/{count['id']}/lines/{line['id']}",
        headers=headers,
        json={"counted_quantity": 3},
    )
    assert update.status_code == 200
    completed = client.post(
        f"/api/stock-counts/{count['id']}/complete", headers=headers
    )
    assert completed.status_code == 200
    assert completed.json["stock_count"]["status"] == "completed"
    assert client.post(
        f"/api/stock-counts/{count['id']}/complete", headers=headers
    ).status_code == 409
    with app.app_context():
        assert db.session.get(Product, product_id).quantity == 3
        movement = StockMovement.query.filter_by(reference_type="stock_count").one()
        assert movement.quantity_change == -2
