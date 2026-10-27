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
            "business_settings",
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


def _api_auth_headers(client):
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Inventory Staff",
            "email": "inventory.staff@example.test",
            "password": "correct-horse-battery",
        },
    )
    assert registration.status_code == 201
    return {"Authorization": f"Bearer {registration.json['token']}"}


def test_product_and_category_apis_preserve_initial_stock_history(client):
    headers = _api_auth_headers(client)
    category_response = client.post(
        "/api/categories",
        headers=headers,
        json={"name": "Clothing", "description": "Wearables"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json["category"]["id"]
    duplicate_category = client.post(
        "/api/categories",
        headers=headers,
        json={"name": "CLOTHING"},
    )
    assert duplicate_category.status_code == 409

    product_response = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "TEE-001",
            "name": "Basic Tee",
            "category_id": category_id,
            "cost_price": "4.50",
            "selling_price": "9.99",
            "quantity": 5,
        },
    )
    assert product_response.status_code == 201
    product = product_response.json["product"]
    assert product["cost_price"] == "4.50"
    assert product["selling_price"] == "9.99"
    assert product["quantity"] == 5
    duplicate_sku = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "tee-001",
            "name": "Duplicate Tee",
            "cost_price": "1.00",
            "selling_price": "2.00",
        },
    )
    assert duplicate_sku.status_code == 409
    invalid_price = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "TEE-002",
            "name": "Invalid Tee",
            "cost_price": "1.005",
            "selling_price": "2.00",
        },
    )
    assert invalid_price.status_code == 400

    with client.application.app_context():
        movement = StockMovement.query.one()
        assert movement.movement_type == "receipt"
        assert movement.quantity_change == 5
        assert movement.user_id == 1

    listing = client.get("/api/products?search=tee&category_id=1&per_page=1")
    assert listing.status_code == 200
    assert listing.json["pagination"] == {
        "page": 1,
        "per_page": 1,
        "total": 1,
        "pages": 1,
    }
    assert listing.json["products"][0]["id"] == product["id"]

    quantity_update = client.patch(
        f"/api/products/{product['id']}",
        headers=headers,
        json={"quantity": 4},
    )
    assert quantity_update.status_code == 400

    updated_category = client.patch(
        f"/api/categories/{category_id}",
        headers=headers,
        json={"name": "Apparel"},
    )
    assert updated_category.status_code == 200
    assert updated_category.json["category"]["product_count"] == 1
    assert client.get(f"/api/products/{product['id']}").json["product"]["category"]["name"] == "Apparel"
    archived = client.post(
        f"/api/products/{product['id']}/archive",
        headers=headers,
    )
    assert archived.status_code == 200
    assert archived.json["product"]["is_active"] is False
    assert client.delete(f"/api/products/{product['id']}").status_code == 405
    with client.application.app_context():
        assert StockMovement.query.filter_by(product_id=product["id"]).count() == 1


def test_stock_movement_api_is_atomic_and_prevents_negative_stock(client):
    headers = _api_auth_headers(client)
    created = client.post(
        "/api/products",
        headers=headers,
        json={
            "sku": "STOCK-001",
            "name": "Stock Test",
            "cost_price": "1.00",
            "selling_price": "2.00",
            "quantity": 3,
        },
    )
    product_id = created.json["product"]["id"]

    insufficient = client.post(
        "/api/stock-movements",
        headers=headers,
        json={
            "product_id": product_id,
            "movement_type": "stock_out",
            "quantity": 4,
            "reason": "Attempted oversell",
        },
    )
    assert insufficient.status_code == 409

    adjustment = client.post(
        "/api/stock-movements",
        headers=headers,
        json={
            "product_id": product_id,
            "movement_type": "adjustment",
            "quantity_change": -1,
            "reason": "Count correction",
        },
    )
    assert adjustment.status_code == 201
    assert adjustment.json["stock_movement"]["quantity_change"] == -1

    with client.application.app_context():
        product = db.session.get(Product, product_id)
        movements = StockMovement.query.filter_by(product_id=product_id).all()
        assert product.quantity == 2
        assert [movement.quantity_change for movement in movements] == [3, -1]

    history = client.get(f"/api/stock-movements?product_id={product_id}")
    assert history.status_code == 200
    assert history.json["pagination"]["total"] == 2
    assert history.json["stock_movements"][0]["actor"] == "Inventory Staff"

    unauthenticated = client.post(
        "/api/stock-movements",
        json={
            "product_id": product_id,
            "movement_type": "stock_in",
            "quantity": 1,
            "reason": "Unattributed",
        },
    )
    assert unauthenticated.status_code == 401
