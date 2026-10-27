import re

import click
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import User


password_hash = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def register_commands(app):
    @app.cli.command("create-manager")
    @click.option(
        "--email",
        required=True,
        help="Email for the initial manager account.",
    )
    @click.option("--name", prompt=True, help="Manager's full name.")
    @click.option(
        "--password",
        prompt=True,
        hide_input=True,
        confirmation_prompt=True,
        help="Choose a password with at least 8 characters.",
    )
    def create_manager(email, name, password):
        """Create the first manager account using real credentials."""
        normalized_email = email.strip().lower()
        if len(normalized_email) > 255 or not EMAIL_PATTERN.fullmatch(normalized_email):
            raise click.ClickException("A valid email address is required")
        if db.session.scalar(
            select(User.id).where(User.role.in_(("admin", "manager"))).limit(1)
        ):
            raise click.ClickException("A manager account already exists")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
            raise click.ClickException("Name must contain 1 to 120 characters")
        if not isinstance(password, str) or len(password) < 8:
            raise click.ClickException("Password must contain at least 8 characters")
        if db.session.scalar(
            select(User.id).where(func.lower(User.email) == normalized_email)
        ):
            raise click.ClickException("An account with this email already exists")
        db.session.add(
            User(
                name=name.strip(), # type: ignore
                email=normalized_email, # type: ignore
                password_hash=password_hash.hash(password), # type: ignore
                role="manager", # type: ignore
            )
        )
        try:
            db.session.commit()
        except IntegrityError as error:
            db.session.rollback()
            raise click.ClickException(
                "A manager account or account with this email already exists"
            ) from error
        click.echo("Manager account created.")
