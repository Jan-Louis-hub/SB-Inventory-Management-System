from datetime import datetime, timedelta, timezone
import re

import jwt
from flask import current_app, jsonify, request
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.extensions import db
from app.models import User

password_hash = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_LIFETIME = timedelta(hours=12)


def serialize_user(user):
    if user.role in {"admin", "manager"}:
        frontend_role = "inventory_manager"
    elif user.role == "stock_controller":
        frontend_role = "stock_controller"
    else:
        frontend_role = "staff_member"
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": frontend_role,
    }


def create_access_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user.id),
            "iat": now,
            "exp": now + TOKEN_LIFETIME,
            "type": "access",
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def _json_object(required_fields):
    payload = request.get_json()
    if not isinstance(payload, dict):
        return None, (jsonify(error="A JSON object is required"), 400)
    if set(payload) != required_fields:
        return None, (jsonify(error="Request fields are missing or unknown"), 400)
    return payload, None


@api.post("/auth/register")
def register():
    payload, error = _json_object({"name", "email", "password"})
    if error:
        return error

    name = payload["name"]
    email = payload["email"]
    password = payload["password"]
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        return {"error": "name must contain 1 to 120 characters"}, 400
    if (
        not isinstance(email, str)
        or len(email) > 255
        or not EMAIL_PATTERN.fullmatch(email.strip())
    ):
        return {"error": "a valid email address is required"}, 400
    if not isinstance(password, str) or not 8 <= len(password) <= 1024:
        return {"error": "password must contain at least 8 characters"}, 400

    normalized_email = email.strip().lower()
    existing_user = db.session.scalar(
        select(User.id).where(func.lower(User.email) == normalized_email)
    )
    if existing_user is not None:
        return {"error": "An account with this email already exists"}, 409

    user = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=password_hash.hash(password),
        role="staff",
    )
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "An account with this email already exists"}, 409

    return {
        "token": create_access_token(user),
        "user": serialize_user(user),
    }, 201


@api.post("/auth/login")
def login():
    payload, error = _json_object({"email", "password"})
    if error:
        return error

    email = payload["email"]
    password = payload["password"]
    if (
        not isinstance(email, str)
        or len(email) > 255
        or not isinstance(password, str)
        or not password
        or len(password) > 1024
    ):
        return {"error": "Email or password is incorrect"}, 401

    user = db.session.scalar(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )
    if (
        user is None
        or not user.is_active
        or not password_hash.verify(password, user.password_hash)
    ):
        return {"error": "Email or password is incorrect"}, 401

    return {
        "token": create_access_token(user),
        "user": serialize_user(user),
    }, 200


@api.get("/auth/me")
def current_user():
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return {"error": "Authentication required"}, 401

    try:
        claims = jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub", "type"]},
        )
        if claims["type"] != "access":
            raise jwt.InvalidTokenError("Unexpected token type")
        user_id = int(claims["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return {"error": "Authentication required"}, 401

    user = db.session.get(User, user_id)
    if user is None or not user.is_active:
        return {"error": "Authentication required"}, 401
    return {"user": serialize_user(user)}, 200
