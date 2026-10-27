from flask import request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.extensions import db
from app.models import Category, Product


def _error(message, status=400):
    return {"error": message}, status


def _payload():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else None


def _serialize(category):
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "product_count": db.session.scalar(
            select(func.count(Product.id)).where(Product.category_id == category.id)
        ),
        "created_at": category.created_at.isoformat(),
        "updated_at": category.updated_at.isoformat(),
    }


def _authorized():
    if authenticated_user_from_request() is None:
        return _error("Authentication required", 401)
    return None


@api.get("/categories")
def list_categories():
    categories = db.session.scalars(select(Category).order_by(func.lower(Category.name), Category.id)).all()
    return {"categories": [_serialize(category) for category in categories]}, 200


@api.post("/categories")
def create_category():
    error = _authorized()
    if error:
        return error
    payload = _payload()
    if payload is None:
        return _error("A JSON object is required")
    if set(payload) - {"name", "description"}:
        return _error("Only name and description are accepted")
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        return _error("name must contain 1 to 100 characters")
    description = payload.get("description")
    if description is not None and (
        not isinstance(description, str) or len(description) > 10000
    ):
        return _error("description must be a string of at most 10000 characters or null")
    normalized_name = name.strip()
    if db.session.scalar(
        select(Category.id).where(func.lower(Category.name) == normalized_name.lower())
    ):
        return _error("A category with this name already exists", 409)

    category = Category(name=normalized_name, description=description) # type: ignore
    db.session.add(category)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("A category with this name already exists", 409)
    return {"category": _serialize(category)}, 201


@api.get("/categories/<int:category_id>")
def get_category(category_id):
    category = db.session.get(Category, category_id)
    if category is None:
        return _error("Category not found", 404)
    return {"category": _serialize(category)}, 200


@api.patch("/categories/<int:category_id>")
def update_category(category_id):
    error = _authorized()
    if error:
        return error
    payload = _payload()
    if payload is None:
        return _error("A JSON object is required")
    if not payload or set(payload) - {"name", "description"}:
        return _error("Provide name and/or description only")
    category = db.session.get(Category, category_id)
    if category is None:
        return _error("Category not found", 404)
    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
            return _error("name must contain 1 to 100 characters")
        category.name = name.strip()
    if "description" in payload:
        description = payload["description"]
        if description is not None and (
            not isinstance(description, str) or len(description) > 10000
        ):
            return _error("description must be a string of at most 10000 characters or null")
        category.description = description
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("A category with this name already exists", 409)
    return {"category": _serialize(category)}, 200
