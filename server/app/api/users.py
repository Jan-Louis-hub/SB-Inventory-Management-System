import re

from flask import request
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.extensions import db
from app.models import User


password_hash = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLES = {"staff", "stock_controller", "manager"}


def _error(message, status=400):
    return {"error": message}, status


def _manager():
    user = authenticated_user_from_request()
    if user is None:
        return None, _error("Authentication required", 401)
    if user.role not in {"admin", "manager"}:
        return None, _error("Manager access required", 403)
    return user, None


def _serialize(user):
    role = (
        "inventory_manager"
        if user.role in {"admin", "manager"}
        else "stock_controller"
        if user.role == "stock_controller"
        else "staff_member"
    )
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": role,
        "is_active": user.is_active,
        "area": user.area,
    }


@api.get("/users")
def list_users():
    _, error = _manager()
    if error:
        return error
    users = db.session.scalars(
        select(User).order_by(func.lower(User.name), User.id)
    ).all()
    return {"users": [_serialize(user) for user in users]}, 200


@api.post("/users")
def create_user():
    _, error = _manager()
    if error:
        return error
    payload = request.get_json(silent=True)
    required = {"name", "email", "password", "role"}
    if (
        not isinstance(payload, dict)
        or not required.issubset(payload)
        or set(payload) - required - {"area"}
    ):
        return _error("name, email, password and role are required")
    name = payload["name"]
    email = payload["email"]
    password = payload["password"]
    role = payload["role"]
    area = payload.get("area")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        return _error("name must contain 1 to 120 characters")
    if (
        not isinstance(email, str)
        or len(email) > 255
        or not EMAIL_PATTERN.fullmatch(email.strip())
    ):
        return _error("A valid email address is required")
    if not isinstance(password, str) or not 8 <= len(password) <= 1024:
        return _error("password must contain 8 to 1024 characters")
    if not isinstance(role, str) or role not in ROLES:
        return _error("role must be staff, stock_controller, or manager")
    if area is not None and (
        not isinstance(area, str) or len(area.strip()) > 80
    ):
        return _error("area must be a string of at most 80 characters or null")
    normalized_email = email.strip().lower()
    if db.session.scalar(
        select(User.id).where(func.lower(User.email) == normalized_email)
    ):
        return _error("An account with this email already exists", 409)
    user = User(
        name=name.strip(), # type: ignore
        email=normalized_email, # type: ignore
        password_hash=password_hash.hash(password), # type: ignore
        role=role, # type: ignore
        area=area.strip() if isinstance(area, str) and area.strip() else None,
    )
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("An account with this email already exists", 409)
    return {"user": _serialize(user)}, 201


@api.patch("/users/<int:user_id>")
def update_user(user_id):
    actor, error = _manager()
    if error:
        return error
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not payload or set(payload) - {"is_active", "area"}:
        return _error("Only is_active and area can be updated")
    if "is_active" in payload and not isinstance(payload["is_active"], bool):
        return _error("is_active must be a boolean")
    if "area" in payload and payload["area"] is not None and (
        not isinstance(payload["area"], str) or len(payload["area"].strip()) > 80
    ):
        return _error("area must be a string of at most 80 characters or null")
    user = db.session.get(User, user_id)
    if user is None:
        return _error("User not found", 404)
    if user.id == actor.id and payload.get("is_active") is False: # type: ignore
        return _error("You cannot deactivate your own account", 409)
    if "is_active" in payload:
        user.is_active = payload["is_active"]
    if "area" in payload:
        user.area = payload["area"].strip() if isinstance(payload["area"], str) and payload["area"].strip() else None
    db.session.commit()
    return {"user": _serialize(user)}, 200
