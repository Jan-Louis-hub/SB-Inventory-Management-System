import re

from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
    ASSIGNABLE_ROLES,
    MANAGER_ROLES,
    json_object,
    json_object_subset,
    paginate_query,
    parse_collection_args,
    require_roles,
    serialize_auth_user,
)
from app.extensions import db
from app.models import User

password_hash = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def serialize_team_member(user):
    payload = serialize_auth_user(user)
    payload["area"] = user.area
    payload["is_active"] = user.is_active
    payload["backend_role"] = user.role
    return payload


@api.get("/users")
@require_roles(*MANAGER_ROLES)
def list_users(user):
    params, error = parse_collection_args(
        allowed_sorts={"name", "id", "email"},
        default_sort="name",
        allowed_filters={"role", "is_active"},
    )
    if error:
        return error

    query = User.query
    filters = params["filters"]
    if "role" in filters:
        query = query.filter_by(role=filters["role"])
    if "is_active" in filters:
        if filters["is_active"] not in {"true", "false"}:
            return {"error": "is_active must be true or false"}, 400
        query = query.filter_by(is_active=filters["is_active"] == "true")

    result = paginate_query(
        query,
        User,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {"name": User.name, "id": User.id, "email": User.email},
    )
    return {
        "items": [serialize_team_member(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/users")
@require_roles(*MANAGER_ROLES)
def create_user(user):
    payload, error = json_object(
        {"name", "email", "password", "role", "area", "is_active"}
    )
    if error:
        return error

    name = payload["name"]
    email = payload["email"]
    password = payload["password"]
    role = payload["role"]
    area = payload["area"]
    is_active = payload["is_active"]

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
    if role not in ASSIGNABLE_ROLES:
        return {"error": "role is not assignable"}, 400
    if area is not None and (
        not isinstance(area, str) or len(area.strip()) > 80
    ):
        return {"error": "area must be a string of at most 80 characters"}, 400
    if not isinstance(is_active, bool):
        return {"error": "is_active must be a boolean"}, 400

    normalized_email = email.strip().lower()
    existing = db.session.scalar(
        select(User.id).where(func.lower(User.email) == normalized_email)
    )
    if existing is not None:
        return {"error": "An account with this email already exists"}, 409

    member = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=password_hash.hash(password),
        role=role,
        area=area.strip() if isinstance(area, str) and area.strip() else None,
        is_active=is_active,
    )
    db.session.add(member)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "An account with this email already exists"}, 409
    return serialize_team_member(member), 201


@api.get("/users/<int:user_id>")
@require_roles(*MANAGER_ROLES)
def get_user(user, user_id):
    member = db.session.get(User, user_id)
    if member is None:
        return {"error": "User not found"}, 404
    return serialize_team_member(member), 200


@api.patch("/users/<int:user_id>")
@require_roles(*MANAGER_ROLES)
def update_user(user, user_id):
    member = db.session.get(User, user_id)
    if member is None:
        return {"error": "User not found"}, 404

    payload, error = json_object_subset(
        {"name", "email", "password", "role", "area", "is_active"}
    )
    if error:
        return error

    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
            return {"error": "name must contain 1 to 120 characters"}, 400
        member.name = name.strip()
    if "email" in payload:
        email = payload["email"]
        if (
            not isinstance(email, str)
            or len(email) > 255
            or not EMAIL_PATTERN.fullmatch(email.strip())
        ):
            return {"error": "a valid email address is required"}, 400
        normalized_email = email.strip().lower()
        existing = db.session.scalar(
            select(User.id).where(
                func.lower(User.email) == normalized_email,
                User.id != user_id,
            )
        )
        if existing is not None:
            return {"error": "An account with this email already exists"}, 409
        member.email = normalized_email
    if "password" in payload:
        password = payload["password"]
        if not isinstance(password, str) or not 8 <= len(password) <= 1024:
            return {"error": "password must contain at least 8 characters"}, 400
        member.password_hash = password_hash.hash(password)
    if "role" in payload:
        role = payload["role"]
        if role not in ASSIGNABLE_ROLES:
            return {"error": "role is not assignable"}, 400
        member.role = role
    if "area" in payload:
        area = payload["area"]
        if area is not None and (
            not isinstance(area, str) or len(area.strip()) > 80
        ):
            return {"error": "area must be a string of at most 80 characters"}, 400
        member.area = (
            area.strip() if isinstance(area, str) and area.strip() else None
        )
    if "is_active" in payload:
        if not isinstance(payload["is_active"], bool):
            return {"error": "is_active must be a boolean"}, 400
        if member.id == user.id and payload["is_active"] is False:
            return {"error": "You cannot deactivate your own account"}, 400
        member.is_active = payload["is_active"]

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "An account with this email already exists"}, 409
    return serialize_team_member(member), 200
