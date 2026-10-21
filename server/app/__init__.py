import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from werkzeug.exceptions import HTTPException

import app.models
from app.api import api
from app.config import CONFIGS
from app.extensions import db
from app.logging_config import configure_logging
from app.seed import seed_demo_data


def create_app(config=None):
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    configure_logging()

    app = Flask(__name__)
    configured_environment = (
        config.get("APP_ENV")
        if isinstance(config, dict)
        else getattr(config, "APP_ENV", None)
    )
    environment = (
        configured_environment or os.getenv("APP_ENV", "development")
    ).lower()
    if environment not in CONFIGS:
        raise ValueError("APP_ENV must be development, production, or testing")
    app.config.from_object(CONFIGS[environment])
    app.config["APP_ENV"] = environment

    secret_key = os.getenv("SECRET_KEY")
    if secret_key:
        app.config["SECRET_KEY"] = secret_key
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://", "postgresql+psycopg2://", 1
            )
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://", "postgresql+psycopg2://", 1
            )
        app.config["SQLALCHEMY_DATABASE_URI"] = database_url

    if config is not None:
        if isinstance(config, dict):
            app.config.update(config)
        else:
            app.config.from_object(config)

    environment = app.config.get("APP_ENV", environment).lower()
    if environment not in CONFIGS:
        raise ValueError("APP_ENV must be development, production, or testing")
    app.config["APP_ENV"] = environment

    if environment == "production":
        missing = [
            name
            for name, value in (
                ("SECRET_KEY", app.config.get("SECRET_KEY")),
                ("DATABASE_URL", app.config.get("SQLALCHEMY_DATABASE_URI")),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Missing required production configuration: " + ", ".join(missing)
            )
    db.init_app(app)
    app.register_blueprint(api, url_prefix="/api")
    register_error_handlers(app)
    register_database_commands(app)
    return app


def register_database_commands(app):
    @app.cli.command("init-db")
    def init_db():
        """Create the inventory database tables."""
        db.create_all()
        app.logger.info("Database tables created")

    @app.cli.command("seed-demo")
    def seed_demo():
        """Add sample clothing-store inventory and transactions."""
        if app.config["APP_ENV"] == "production":
            raise RuntimeError("Demo data cannot be seeded in production")
        db.create_all()
        if seed_demo_data():
            app.logger.info("Demo data added")
        else:
            app.logger.info("Demo data already exists; no changes made")


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        response = error.get_response()
        response.set_data(app.json.dumps({"error": error.description}))
        response.content_type = app.json.mimetype
        return response

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Unhandled application error")
        return {"error": "Internal server error"}, 500
