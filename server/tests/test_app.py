from decimal import Decimal

import pytest
from sqlalchemy import inspect

from app import create_app
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


@pytest.fixture
def client():
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-only-key",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    return app.test_client()


def test_health_endpoint(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json == {"status": "ok"}


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
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="SECRET_KEY, DATABASE_URL"):
        create_app()


def test_production_config_requires_secret_and_database(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="SECRET_KEY, DATABASE_URL"):
        create_app({"APP_ENV": "production"})


def test_environment_variables_configure_app(monkeypatch):
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("SECRET_KEY", "environment-test-key")
    monkeypatch.setenv("DATABASE_URL", "postgres://user:password@localhost/inventory")

    app = create_app()

    assert app.config["APP_ENV"] == "testing"
    assert app.config["SECRET_KEY"] == "environment-test-key"
    assert app.config["SQLALCHEMY_DATABASE_URI"] == (
        "postgresql+psycopg2://user:password@localhost/inventory"
    )


def test_init_db_creates_all_inventory_tables(client):
    runner = client.application.test_cli_runner()
    result = runner.invoke(args=["init-db"])

    assert result.exit_code == 0
    with client.application.app_context():
        assert set(inspect(db.engine).get_table_names()) == {
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
            "SECRET_KEY": "test-only-key",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    result = app.test_cli_runner().invoke(args=["seed-demo"])

    assert isinstance(result.exception, RuntimeError)
    assert str(result.exception) == "Demo data cannot be seeded in production"
