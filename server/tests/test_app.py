from datetime import date, datetime, timedelta, timezone
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
    OAuthIdentity,
    OAuthLoginCode,
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


def test_oauth_requires_provider_configuration(client):
    client.application.config["GOOGLE_CLIENT_ID"] = None
    client.application.config["GOOGLE_CLIENT_SECRET"] = None
    response = client.get("/api/auth/oauth/google")

    assert response.status_code == 503
    assert response.json == {"error": "Google sign-in is not configured"}


def test_apple_client_secret_is_generated_from_signing_key(client):
    import jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    from app.api.auth import _oauth_client_secret

    private_key = ec.generate_private_key(ec.SECP256R1())
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    client.application.config.update(
        APPLE_TEAM_ID="test-team",
        APPLE_KEY_ID="test-key",
        APPLE_PRIVATE_KEY=private_key_pem.replace("\n", "\\n"),
    )

    with client.application.app_context():
        client_secret = _oauth_client_secret("apple", "com.example.inventory")

    claims = jwt.decode(
        client_secret,
        private_key.public_key(),
        algorithms=["ES256"],
        audience="https://appleid.apple.com",
    )
    assert claims["iss"] == "test-team"
    assert claims["sub"] == "com.example.inventory"
    assert claims["exp"] - claims["iat"] == 300


def test_oauth_session_cookie_supports_apple_form_post(client):
    assert client.application.config["SESSION_COOKIE_SAMESITE"] == "None"
    assert client.application.config["SESSION_COOKIE_SECURE"] is True


def test_oauth_identity_persists_verified_profile_and_links_email(client):
    from app.api.auth import _save_oauth_user

    with client.application.app_context():
        existing_user = User(
            name="Existing Staff",
            email="staff@example.test",
            password_hash="unused-hash",
            role="staff",
        )
        db.session.add(existing_user)
        db.session.commit()

        user = _save_oauth_user(
            "google",
            {
                "sub": "google-subject-1",
                "email": "staff@example.test",
                "email_verified": True,
                "name": "Shop Staff",
            },
        )
        db.session.commit()

        assert user.id == existing_user.id
        assert user.name == "Existing Staff"
        assert user.email == "staff@example.test"
        assert user.role == "staff"
        assert db.session.query(User).count() == 1
        identity = OAuthIdentity.query.one()
        assert identity.provider == "google"
        assert identity.subject == "google-subject-1"
        assert identity.user_id == user.id


def test_oauth_callback_saves_provider_user_and_exchanges_session(client, monkeypatch):
    from urllib.parse import parse_qs, urlparse

    from app.api import auth

    class ProviderClient:
        def authorize_access_token(self):
            return {
                "userinfo": {
                    "sub": "google-subject-2",
                    "email": "new.staff@example.test",
                    "email_verified": True,
                    "name": "New Staff",
                }
            }

    monkeypatch.setattr(auth, "_oauth_client", lambda _provider: ProviderClient())
    callback = client.get("/api/auth/oauth/google/callback")

    assert callback.status_code == 303
    assert callback.location.startswith(
        "http://localhost:3000/api/auth/oauth/exchange?code="
    )
    code = parse_qs(urlparse(callback.location).query)["code"][0]
    exchange = client.post("/api/auth/oauth/exchange", json={"code": code})

    assert exchange.status_code == 200
    assert exchange.json["user"]["email"] == "new.staff@example.test"
    with client.application.app_context():
        assert db.session.query(User).count() == 1
        assert OAuthIdentity.query.one().subject == "google-subject-2"


def test_apple_form_post_callback_uses_first_login_name(client, monkeypatch):
    import json
    from urllib.parse import parse_qs, urlparse

    from app.api import auth

    class ProviderClient:
        def authorize_access_token(self):
            return {
                "userinfo": {
                    "sub": "apple-subject-1",
                    "email": "new.apple@example.test",
                    "email_verified": "true",
                }
            }

    monkeypatch.setattr(auth, "_oauth_client", lambda _provider: ProviderClient())
    callback = client.post(
        "/api/auth/oauth/apple/callback",
        data={
            "code": "provider-code",
            "state": "provider-state",
            "user": json.dumps({"name": {"firstName": "Apple", "lastName": "Staff"}}),
        },
    )

    assert callback.status_code == 303
    code = parse_qs(urlparse(callback.location).query)["code"][0]
    exchange = client.post("/api/auth/oauth/exchange", json={"code": code})

    assert exchange.status_code == 200
    assert exchange.json["user"]["name"] == "Apple Staff"


def test_oauth_rejects_unverified_email_without_creating_user(client):
    from app.api.auth import _save_oauth_user

    with client.application.app_context():
        user = _save_oauth_user(
            "apple",
            {
                "sub": "apple-subject-1",
                "email": "staff@example.test",
                "email_verified": False,
            },
        )

        assert user is None
        assert db.session.query(User).count() == 0
        assert db.session.query(OAuthIdentity).count() == 0


def test_oauth_exchange_code_is_single_use(client):
    import hashlib
    from datetime import datetime, timedelta, timezone

    code = "single-use-test-code"
    with client.application.app_context():
        user = User(
            name="Shop Staff",
            email="staff@example.test",
            password_hash="unused-hash",
            role="staff",
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(
            OAuthLoginCode(
                code_hash=hashlib.sha256(code.encode("utf-8")).hexdigest(),
                user_id=user.id,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=2),
            )
        )
        db.session.commit()

    first = client.post("/api/auth/oauth/exchange", json={"code": code})
    replay = client.post("/api/auth/oauth/exchange", json={"code": code})

    assert first.status_code == 200
    assert "token" in first.json
    assert replay.status_code == 401


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
            "oauth_identities",
            "oauth_login_codes",
            "shop_settings",
            "stock_counts",
            "stock_count_lines",
            "stock_requests",
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


def test_migration_replaces_legacy_user_role_constraint():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    app = create_app(
        {
            "APP_ENV": "testing",
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    runner = app.test_cli_runner()
    initial = runner.invoke(args=["db", "upgrade", "ab41c76f2d09"])
    assert initial.exit_code == 0, initial.output

    with app.app_context():
        with db.engine.begin() as connection:
            operations = Operations(MigrationContext.configure(connection))
            with operations.batch_alter_table("users") as batch_op:
                batch_op.drop_constraint("ck_users_role", type_="check")
                batch_op.create_check_constraint(
                    "users_role_check",
                    "role IN ('admin', 'manager', 'staff', 'cashier')",
                )
            connection.exec_driver_sql(
                "CREATE UNIQUE INDEX uq_users_email_lower "
                "ON users (lower(email))"
            )

    upgraded = runner.invoke(args=["db", "upgrade"])
    assert upgraded.exit_code == 0, upgraded.output
    with app.app_context():
        user = User(
            name="Demo Controller",
            email="controller@example.test",
            password_hash="unused-hash",
            role="stock_controller",
        )
        db.session.add(user)
        db.session.commit()
        assert (
            db.session.execute(
                text(
                    "SELECT 1 FROM sqlite_master "
                    "WHERE type = 'index' AND name = 'uq_users_email_lower'"
                )
            ).scalar()
            == 1
        )


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


def test_seed_demo_accounts_create_manager_and_controller_logins(client):
    runner = client.application.test_cli_runner()

    first_result = runner.invoke(args=["seed-demo-accounts"])
    second_result = runner.invoke(args=["seed-demo-accounts"])

    assert first_result.exit_code == 0, first_result.output
    assert second_result.exit_code == 0, second_result.output
    for email, password, role in (
        ("manager@demo.example.test", "ManagerDemo123!", "inventory_manager"),
        (
            "controller@demo.example.test",
            "ControllerDemo123!",
            "stock_controller",
        ),
    ):
        response = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert response.status_code == 200
        assert response.json["user"]["role"] == role


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

    account_result = app.test_cli_runner().invoke(args=["seed-demo-accounts"])
    assert isinstance(account_result.exception, RuntimeError)
    assert str(account_result.exception) == (
        "Demo accounts cannot be created in production"
    )


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


def _register(client, *, name="Shop Staff", email="staff@example.test", password="correct-horse-battery"):
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json["token"], response.json["user"]


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_inventory_routes_require_authentication(client):
    assert client.get("/api/products").status_code == 401
    assert client.get("/api/suppliers").status_code == 401
    assert client.get("/api/categories").status_code == 401


def test_staff_can_list_products_without_cost(client):
    token, _ = _register(client)
    with client.application.app_context():
        category = Category(name="Tops")
        db.session.add(category)
        db.session.flush()
        db.session.add(
            Product(
                sku="TEE-001",
                name="Black Tee",
                category_id=category.id,
                cost_price=Decimal("10.00"),
                selling_price=Decimal("25.00"),
                quantity=12,
                reorder_level=4,
                location="Women's floor",
                unit="units",
            )
        )
        db.session.commit()

    response = client.get("/api/products", headers=_auth_header(token))
    assert response.status_code == 200
    assert response.json["pagination"]["total"] == 1
    item = response.json["items"][0]
    assert item["sku"] == "TEE-001"
    assert "cost_price" not in item
    assert item["selling_price"] == 25.0


def test_manager_can_create_supplier_and_product(client):
    token, user = _register(client, email="manager-create@example.test")
    with client.application.app_context():
        member = db.session.get(User, user["id"])
        member.role = "manager"
        db.session.commit()

    supplier = client.post(
        "/api/suppliers",
        headers=_auth_header(token),
        json={
            "name": "Cape Cloth Co.",
            "contact_person": "Nomsa",
            "email": "orders@capecloth.test",
            "phone": "+27 21 000 0000",
            "address": "Cape Town",
            "city": "Cape Town",
            "lead_days": 7,
            "categories": "Tops",
        },
    )
    assert supplier.status_code == 201

    category = client.post(
        "/api/categories",
        headers=_auth_header(token),
        json={"name": "Tops", "description": "Shirts"},
    )
    assert category.status_code == 201

    product = client.post(
        "/api/products",
        headers=_auth_header(token),
        json={
            "sku": "TOP-100",
            "name": "Linen Shirt",
            "description": None,
            "category_id": category.json["id"],
            "supplier_id": supplier.json["id"],
            "location": "Men's floor",
            "unit": "units",
            "cost_price": 120.5,
            "selling_price": 249.99,
            "quantity": 8,
            "reorder_level": 3,
            "is_active": True,
        },
    )
    assert product.status_code == 201
    assert product.json["cost_price"] == 120.5
    assert product.json["supplier"] == "Cape Cloth Co."


def test_stock_controller_can_adjust_stock(client):
    token, user = _register(client, email="controller@example.test")
    with client.application.app_context():
        member = db.session.get(User, user["id"])
        member.role = "stock_controller"
        db.session.add(
            Product(
                sku="ADJ-001",
                name="Adjustable",
                cost_price=Decimal("5.00"),
                selling_price=Decimal("10.00"),
                quantity=5,
                reorder_level=1,
            )
        )
        db.session.commit()
        product_id = Product.query.filter_by(sku="ADJ-001").one().id

    response = client.post(
        f"/api/products/{product_id}/adjustments",
        headers=_auth_header(token),
        json={"quantity_change": -2, "reason": "Damaged on floor"},
    )
    assert response.status_code == 200
    assert response.json["product"]["quantity"] == 3
    assert response.json["movement"]["movement_type"] == "adjustment"


def test_staff_cannot_manage_users(client):
    token, _ = _register(client, email="staff-users@example.test")
    response = client.get("/api/users", headers=_auth_header(token))
    assert response.status_code == 403


def test_shop_settings_round_trip(client):
    token, user = _register(client, email="manager-shop@example.test")
    with client.application.app_context():
        member = db.session.get(User, user["id"])
        member.role = "manager"
        db.session.commit()

    current = client.get("/api/shop-settings", headers=_auth_header(token))
    assert current.status_code == 200
    assert current.json["name"] == ""

    updated = client.patch(
        "/api/shop-settings",
        headers=_auth_header(token),
        json={"name": "Harbour Lane", "default_reorder_level": 8},
    )
    assert updated.status_code == 200
    assert updated.json["name"] == "Harbour Lane"
    assert updated.json["default_reorder_level"] == 8


def test_stock_request_lifecycle(client):
    staff_token, staff = _register(client, email="requester@example.test")
    manager_token, manager = _register(
        client, name="Manager", email="approver@example.test"
    )
    with client.application.app_context():
        member = db.session.get(User, manager["id"])
        member.role = "manager"
        db.session.add(
            Product(
                sku="REQ-001",
                name="Requested Tee",
                cost_price=Decimal("5.00"),
                selling_price=Decimal("15.00"),
                quantity=2,
                reorder_level=4,
            )
        )
        db.session.commit()
        product_id = Product.query.filter_by(sku="REQ-001").one().id

    created = client.post(
        "/api/stock-requests",
        headers=_auth_header(staff_token),
        json={
            "request_number": "REQ-100",
            "product_id": product_id,
            "quantity": 6,
            "note": "Customers asking",
        },
    )
    assert created.status_code == 201
    request_id = created.json["id"]

    approved = client.post(
        f"/api/stock-requests/{request_id}/approve",
        headers=_auth_header(manager_token),
    )
    assert approved.status_code == 200
    assert approved.json["status"] == "approved"


def test_deliveries_are_derived_from_purchase_orders_by_role(client):
    staff_token, _ = _register(client, email="delivery-staff@example.test")
    manager_token, manager = _register(
        client, name="Delivery Manager", email="delivery-manager@example.test"
    )
    with client.application.app_context():
        member = db.session.get(User, manager["id"])
        member.role = "manager"
        supplier = Supplier(name="Cape Cloth Co.")
        product = Product(
            sku="DEL-001",
            name="Ivory Blouse",
            cost_price=Decimal("20.00"),
            selling_price=Decimal("50.00"),
            quantity=10,
            reorder_level=2,
        )
        db.session.add_all([supplier, product, member])
        db.session.flush()
        today = date.today()
        upcoming = PurchaseOrder(
            purchase_number="PO-DEL-1",
            supplier_id=supplier.id,
            user_id=manager["id"],
            status="ordered",
            order_date=today,
            expected_date=today + timedelta(days=3),
            total_amount=Decimal("100.00"),
        )
        overdue = PurchaseOrder(
            purchase_number="PO-DEL-2",
            supplier_id=supplier.id,
            user_id=manager["id"],
            status="ordered",
            order_date=today - timedelta(days=5),
            expected_date=today - timedelta(days=2),
            total_amount=Decimal("200.00"),
        )
        received = PurchaseOrder(
            purchase_number="PO-DEL-3",
            supplier_id=supplier.id,
            user_id=manager["id"],
            status="received",
            order_date=today - timedelta(days=10),
            expected_date=today - timedelta(days=7),
            received_at=datetime.now(timezone.utc) - timedelta(days=6),
            total_amount=Decimal("50.00"),
        )
        db.session.add_all([upcoming, overdue, received])
        db.session.flush()
        for order, qty, cost in (
            (upcoming, 2, Decimal("50.00")),
            (overdue, 4, Decimal("50.00")),
            (received, 1, Decimal("50.00")),
        ):
            db.session.add(
                PurchaseOrderItem(
                    purchase_order_id=order.id,
                    product_id=product.id,
                    quantity_ordered=qty,
                    quantity_received=qty if order.status == "received" else 0,
                    unit_cost=cost,
                    line_total=cost * qty,
                )
            )
        db.session.commit()

    manager_list = client.get("/api/deliveries", headers=_auth_header(manager_token))
    assert manager_list.status_code == 200
    manager_statuses = {item["status"] for item in manager_list.json["items"]}
    assert manager_statuses == {"scheduled", "delayed", "received"}
    valued = next(
        item for item in manager_list.json["items"] if item["id"] == "PO-DEL-1"
    )
    assert valued["value"] == 100.0
    assert "Ivory Blouse" in valued["items"]

    staff_list = client.get("/api/deliveries", headers=_auth_header(staff_token))
    assert staff_list.status_code == 200
    staff_statuses = {item["status"] for item in staff_list.json["items"]}
    assert staff_statuses == {"scheduled"}
    assert all("value" not in item for item in staff_list.json["items"])
