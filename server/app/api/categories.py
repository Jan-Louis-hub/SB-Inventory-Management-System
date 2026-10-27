from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    json_object,
    json_object_subset,
    paginate_query,
    parse_collection_args,
    require_auth,
    require_roles,
)
from app.extensions import db
from app.models import Category


def serialize_category(category):
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
    }


@api.get("/categories")
@require_auth
def list_categories(user):
    params, error = parse_collection_args(
        allowed_sorts={"name", "id"},
        default_sort="name",
    )
    if error:
        return error

    query = Category.query
    result = paginate_query(
        query,
        Category,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {"name": Category.name, "id": Category.id},
    )
    return {
        "items": [serialize_category(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/categories")
@require_roles(*MANAGER_ROLES)
def create_category(user):
    payload, error = json_object({"name", "description"})
    if error:
        return error

    name = payload["name"]
    description = payload["description"]
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        return {"error": "name must contain 1 to 100 characters"}, 400
    if description is not None and (
        not isinstance(description, str) or len(description) > 2000
    ):
        return {"error": "description must be a string of at most 2000 characters"}, 400

    normalized = name.strip()
    existing = db.session.scalar(
        select(Category.id).where(func.lower(Category.name) == normalized.lower())
    )
    if existing is not None:
        return {"error": "Category name already exists"}, 409

    category = Category(
        name=normalized,
        description=description.strip() if isinstance(description, str) else None,
    )
    db.session.add(category)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "Category name already exists"}, 409
    return serialize_category(category), 201


@api.get("/categories/<int:category_id>")
@require_auth
def get_category(user, category_id):
    category = db.session.get(Category, category_id)
    if category is None:
        return {"error": "Category not found"}, 404
    return serialize_category(category), 200


@api.patch("/categories/<int:category_id>")
@require_roles(*MANAGER_ROLES)
def update_category(user, category_id):
    category = db.session.get(Category, category_id)
    if category is None:
        return {"error": "Category not found"}, 404

    payload, error = json_object_subset({"name", "description"})
    if error:
        return error

    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
            return {"error": "name must contain 1 to 100 characters"}, 400
        normalized = name.strip()
        existing = db.session.scalar(
            select(Category.id).where(
                func.lower(Category.name) == normalized.lower(),
                Category.id != category_id,
            )
        )
        if existing is not None:
            return {"error": "Category name already exists"}, 409
        category.name = normalized

    if "description" in payload:
        description = payload["description"]
        if description is not None and (
            not isinstance(description, str) or len(description) > 2000
        ):
            return {
                "error": "description must be a string of at most 2000 characters"
            }, 400
        category.description = (
            description.strip() if isinstance(description, str) else None
        )

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "Category name already exists"}, 409
    return serialize_category(category), 200
