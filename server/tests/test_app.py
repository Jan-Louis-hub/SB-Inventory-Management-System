from decimal import Decimal

import pytest
from sqlalchemy import inspect
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.extensions import db
from app.services.inventory import (
    DuplicateSaleSubmission,
    InventoryOperationError,
    create_sale,
    receive_purchase_order_item,
)
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

TEST_SECRET_KEY = "test-only-key-that-is-at-least-32-bytes-long"


@pytest.fixture
def client():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "testing",
            "SECRET_KEY": TEST_SECRET_KEY,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    migration_result = app.test_cli_runner().invoke(args=["db", "upgrade"])
    assert migration_result.exit_code == 0, migration_result.output
    return app.test_client()


def test_health_endpoint(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json == {"status": "ok"}


def test_registration_login_and_authenticated_profile(client):
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Shop Staff",
            "email": "staff@example.test",
            "password": "correct-horse-battery",
        },
    )

    assert registration.status_code == 201
    assert registration.json["user"] == {
        "id": 1,
        "name": "Shop Staff",
        "email": "staff@example.test",
        "role": "staff_member",
    }
    assert "token" in registration.json
    with client.application.app_context():
        user = User.query.one()
        assert user.role == "staff"
        assert user.password_hash != "correct-horse-battery"

    login = client.post(
        "/api/auth/login",
        json={
            "email": "STAFF@example.test",
            "password": "correct-horse-battery",
        },
    )
    assert login.status_code == 200
    assert login.json["user"]["id"] == registration.json["user"]["id"]

    profile = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {login.json['token']}"},
    )
    assert profile.status_code == 200
    assert profile.json["user"] == registration.json["user"]


def test_registration_rejects_privilege_escalation_and_duplicate_email(client):
    payload = {
        "name": "Shop Owner",
        "email": "owner@example.test",
        "password": "correct-horse-battery",
    }
    privileged = client.post(
        "/api/auth/register",
        json={**payload, "role": "admin"},
    )
    assert privileged.status_code == 400

    first = client.post("/api/auth/register", json=payload)
    duplicate = client.post(
        "/api/auth/register",
        json={**payload, "email": "OWNER@example.test"},
    )
    assert first.status_code == 201
    assert duplicate.status_code == 409


def test_login_does_not_disclose_whether_email_exists(client):
    unknown = client.post(
        "/api/auth/login",
        json={"email": "unknown@example.test", "password": "not-the-password"},
    )
    assert unknown.status_code == 401
    assert unknown.json == {"error": "Email or password is incorrect"}

    client.post(
        "/api/auth/register",
        json={
            "name": "Shop Staff",
            "email": "staff@example.test",
            "password": "correct-horse-battery",
        },
    )
    wrong_password = client.post(
        "/api/auth/login",
        json={"email": "staff@example.test", "password": "not-the-password"},
    )
    assert wrong_password.status_code == 401
    assert wrong_password.json == unknown.json


def test_inactive_user_cannot_log_in_or_use_existing_token(client):
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Shop Staff",
            "email": "staff@example.test",
            "password": "correct-horse-battery",
        },
    )
    with client.application.app_context():
        user = User.query.one()
        user.is_active = False
        db.session.commit()

    login = client.post(
        "/api/auth/login",
        json={
            "email": "staff@example.test",
            "password": "correct-horse-battery",
        },
    )
    profile = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {registration.json['token']}"},
    )
    assert login.status_code == 401
    assert profile.status_code == 401


def test_profile_requires_a_valid_bearer_token(client):
    missing = client.get("/api/auth/me")
    invalid = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401


def test_not_found_response_is_json(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert "error" in response.json


def test_method_not_allowed_response_is_json_and_preserves_headers(client):
    response = client.post("/api/health")

    assert response.status_code == 405
    assert "GET" in response.headers["Allow"]
    assert "error" in response.json


def test_unexpected_error_is_generic_json(client):
    def fail():
        raise RuntimeError("private implementation detail")

    client.application.add_url_rule("/api/failure", view_func=fail)
    response = client.get("/api/failure")

    assert response.status_code == 500
    assert response.json == {"error": "Internal server error"}
    assert "private implementation detail" not in response.get_data(as_text=True)


def test_production_requires_secret_and_database(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("PRODUCTION_DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="SECRET_KEY, PRODUCTION_DATABASE_URL"):
        create_app()


def test_production_config_requires_secret_and_database(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("PRODUCTION_DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="SECRET_KEY, PRODUCTION_DATABASE_URL"):
        create_app({"APP_ENV": "production"})


def test_development_requires_database(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("DEVELOPMENT_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="DEVELOPMENT_DATABASE_URL"):
        create_app(
            {
                "APP_ENV": "development",
                "SECRET_KEY": TEST_SECRET_KEY,
                "SQLALCHEMY_DATABASE_URI": None,
            }
        )


def test_environment_variables_configure_app(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("SECRET_KEY", TEST_SECRET_KEY)
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///test-env.db")

    app = create_app()

    assert app.config["APP_ENV"] == "testing"
    assert app.config["SECRET_KEY"] == TEST_SECRET_KEY
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///test-env.db"


def test_testing_never_uses_the_legacy_database_url(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///legacy.db")
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)

    app = create_app()

    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///:memory:"


def test_development_uses_its_own_database_url(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.setenv("DEVELOPMENT_DATABASE_URL", "sqlite:///development.db")
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///testing.db")
    monkeypatch.setenv("PRODUCTION_DATABASE_URL", "sqlite:///production.db")

    app = create_app(
        {
            "APP_ENV": "development",
            "SECRET_KEY": TEST_SECRET_KEY,
        }
    )

    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///development.db"


def test_production_uses_its_own_database_url(monkeypatch):
    monkeypatch.setattr("app.load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.setenv("PRODUCTION_DATABASE_URL", "sqlite:///production.db")
    monkeypatch.setenv("SECRET_KEY", TEST_SECRET_KEY)

    app = create_app({"APP_ENV": "production"})

    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///production.db"


def test_short_secret_key_is_rejected():
    with pytest.raises(RuntimeError, match="SECRET_KEY must be at least 32 bytes"):
        create_app(
            {
                "APP_ENV": "testing",
                "SECRET_KEY": "too-short",
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            }
        )


def test_migrations_create_all_inventory_tables(client):
    check = client.application.test_cli_runner().invoke(args=["db", "check"])
    assert check.exit_code == 0, check.output
    with client.application.app_context():
        assert set(inspect(db.engine).get_table_names()) == {
            "alembic_version",
            "users",
            "categories",
            "products",
            "suppliers",
            "stock_movements",
            "sales",
            "sale_items",
            "purchase_orders",
            "purchase_order_items",
        }
        index_names = set(
            db.session.execute(
                text(
                    "SELECT name FROM sqlite_master "
                    "WHERE type = 'index' AND tbl_name = 'products'"
                )
            ).scalars()
        )
        assert {
            "uq_products_sku_lower",
            "ix_products_category_id",
            "ix_products_name",
        } <= index_names


def test_migration_upgrades_from_initial_revision():
    app = create_app(
        {
            "APP_ENV": "testing",
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    runner = app.test_cli_runner()

    initial = runner.invoke(args=["db", "upgrade", "e8a0a7372b82"])
    assert initial.exit_code == 0, initial.output
    with app.app_context():
        assert "idempotency_key" not in {
            column["name"] for column in inspect(db.engine).get_columns("sales")
        }

    upgraded = runner.invoke(args=["db", "upgrade"])
    assert upgraded.exit_code == 0, upgraded.output
    with app.app_context():
        assert "idempotency_key" in {
            column["name"] for column in inspect(db.engine).get_columns("sales")
        }


def test_email_sku_and_category_uniqueness_is_case_insensitive(client):
    with client.application.app_context():
        db.session.add(Category(name="Shirts"))
        db.session.commit()

        with pytest.raises(IntegrityError):
            db.session.add(Category(name="SHIRTS"))
            db.session.commit()
        db.session.rollback()

        db.session.add(
            User(name="Test", email="staff@example.test", password_hash="hash")
        )
        db.session.commit()
        with pytest.raises(IntegrityError):
            db.session.add(
                User(name="Test", email="STAFF@example.test", password_hash="hash")
            )
            db.session.commit()
        db.session.rollback()

        db.session.add(
            Product(
                sku="TEE-BLK-M",
                name="Black T-shirt",
                cost_price=Decimal("1.00"),
                selling_price=Decimal("2.00"),
            )
        )
        db.session.commit()
        with pytest.raises(IntegrityError):
            db.session.add(
                Product(
                    sku="tee-blk-m",
                    name="Duplicate SKU",
                    cost_price=Decimal("1.00"),
                    selling_price=Decimal("2.00"),
                )
            )
            db.session.commit()
        db.session.rollback()


def test_sale_and_purchase_history_cannot_be_deleted_with_line_items(client):
    result = client.application.test_cli_runner().invoke(args=["seed-demo"])
    assert result.exit_code == 0

    with client.application.app_context():
        sale = Sale.query.one()
        db.session.delete(sale)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        assert Sale.query.count() == 1

        order = PurchaseOrder.query.one()
        db.session.delete(order)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        assert PurchaseOrder.query.count() == 1


def test_seed_demo_creates_consistent_clothing_inventory_and_is_idempotent(client):
    runner = client.application.test_cli_runner()

    first_result = runner.invoke(args=["seed-demo"])
    second_result = runner.invoke(args=["seed-demo"])

    assert first_result.exit_code == 0
    assert second_result.exit_code == 0
    with client.application.app_context():
        assert db.session.query(User).count() == 1
        assert db.session.query(Category).count() == 3
        assert db.session.query(Product).count() == 5
        assert db.session.query(Supplier).count() == 1
        assert db.session.query(PurchaseOrder).count() == 1
        assert db.session.query(PurchaseOrderItem).count() == 4
        assert db.session.query(Sale).count() == 1
        assert db.session.query(SaleItem).count() == 2
        assert db.session.query(StockMovement).count() == 11
        products = {product.sku: product.quantity for product in Product.query.all()}
        assert products == {
            "TEE-BLK-M": 30,
            "TEE-WHT-L": 21,
            "JNS-BLU-32": 15,
            "HOD-GRY-M": 10,
            "CAP-LOGO-OS": 12,
        }
        assert PurchaseOrder.query.one().total_amount == Decimal("414.00")
        assert Sale.query.one().total_amount == Decimal("89.98")
        movement_totals = dict(
            db.session.query(Product.sku, db.func.sum(StockMovement.quantity_change))
            .join(StockMovement)
            .group_by(Product.sku)
            .all()
        )
        assert movement_totals == products


def test_demo_seed_is_rejected_in_production():
    app = create_app(
        {
            "TESTING": True,
            "APP_ENV": "production",
            "SECRET_KEY": TEST_SECRET_KEY,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    result = app.test_cli_runner().invoke(args=["seed-demo"])

    assert isinstance(result.exception, RuntimeError)
    assert str(result.exception) == "Demo data cannot be seeded in production"


def test_create_sale_records_stock_changes_and_price_snapshots(client):
    result = client.application.test_cli_runner().invoke(args=["seed-demo"])
    assert result.exit_code == 0

    with client.application.app_context():
        user = User.query.one()
        product = Product.query.filter_by(sku="TEE-BLK-M").one()
        quantity_before = product.quantity

        sale = create_sale(
            sale_number="SALE-TEST-0001",
            user_id=user.id,
            items=[(product.id, 2)],
            discount_amount=Decimal("1.00"),
            tax_rate=Decimal("0.08"),
        )

        assert sale.subtotal == Decimal("59.98")
        assert sale.tax_amount == Decimal("4.72")
        assert sale.total_amount == Decimal("63.70")
        assert db.session.get(Product, product.id).quantity == quantity_before - 2
        sale_item = SaleItem.query.filter_by(sale_id=sale.id).one()
        assert sale_item.unit_price == Decimal("29.99")
        assert sale_item.unit_cost == Decimal("8.50")
        movement = StockMovement.query.filter_by(reference_id=sale.id).one()
        assert movement.movement_type == "sale"
        assert movement.quantity_change == -2


def test_create_sale_rolls_back_on_insufficient_stock(client):
    result = client.application.test_cli_runner().invoke(args=["seed-demo"])
    assert result.exit_code == 0

    with client.application.app_context():
        user = User.query.one()
        product = Product.query.filter_by(sku="TEE-BLK-M").one()
        quantity_before = product.quantity

        with pytest.raises(InventoryOperationError, match="insufficient stock"):
            create_sale(
                sale_number="SALE-TEST-0002",
                user_id=user.id,
                items=[(product.id, quantity_before + 1)],
            )

        assert Sale.query.filter_by(sale_number="SALE-TEST-0002").first() is None
        assert db.session.get(Product, product.id).quantity == quantity_before


def test_create_sale_rejects_duplicate_idempotency_key(client):
    from uuid import uuid4

    result = client.application.test_cli_runner().invoke(args=["seed-demo"])
    assert result.exit_code == 0

    with client.application.app_context():
        user = User.query.one()
        product = Product.query.filter_by(sku="TEE-BLK-M").one()
        key = uuid4()
        create_sale(
            sale_number="SALE-TEST-0003",
            user_id=user.id,
            items=[(product.id, 1)],
            idempotency_key=key,
        )

        with pytest.raises(DuplicateSaleSubmission):
            create_sale(
                sale_number="SALE-TEST-0004",
                user_id=user.id,
                items=[(product.id, 1)],
                idempotency_key=key,
            )

        assert Sale.query.filter(Sale.idempotency_key == key).count() == 1


def test_receive_purchase_order_item_updates_stock_and_order(client):
    result = client.application.test_cli_runner().invoke(args=["seed-demo"])
    assert result.exit_code == 0

    with client.application.app_context():
        user = User.query.one()
        supplier = Supplier.query.one()
        product = Product.query.filter_by(sku="TEE-BLK-M").one()
        quantity_before = product.quantity
        order = PurchaseOrder(
            purchase_number="PO-TEST-0001",
            supplier_id=supplier.id,
            user_id=user.id,
            status="ordered",
            order_date=PurchaseOrder.query.one().order_date,
            total_amount=Decimal("17.00"),
        )
        db.session.add(order)
        db.session.flush()
        item = PurchaseOrderItem(
            purchase_order_id=order.id,
            product_id=product.id,
            quantity_ordered=2,
            unit_cost=Decimal("8.50"),
            line_total=Decimal("17.00"),
        )
        db.session.add(item)
        db.session.commit()

        received_order = receive_purchase_order_item(
            item_id=item.id,
            quantity=2,
            user_id=user.id,
        )

        assert received_order.status == "received"
        assert received_order.received_at is not None
        assert db.session.get(Product, product.id).quantity == quantity_before + 2
        movement = StockMovement.query.filter_by(
            reference_type="purchase_order",
            reference_id=order.id,
        ).order_by(StockMovement.id.desc()).first()
        assert movement.quantity_change == 2


def test_receive_purchase_order_item_rejects_zero_quantity(client):
    with client.application.app_context():
        with pytest.raises(InventoryOperationError, match="positive integer"):
            receive_purchase_order_item(item_id=1, quantity=0, user_id=1)
