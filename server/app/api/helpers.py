from decimal import Decimal
from functools import wraps
from math import ceil

import jwt
from flask import current_app, jsonify, request
from sqlalchemy import asc, desc

from app.extensions import db
from app.models import User

MANAGER_ROLES = frozenset({"admin", "manager"})
STOCK_ROLES = frozenset({"admin", "manager", "stock_controller"})
ASSIGNABLE_ROLES = frozenset(
    {"admin", "manager", "staff", "cashier", "stock_controller"}
)


def frontend_role(role):
    if role in MANAGER_ROLES:
        return "inventory_manager"
    if role == "stock_controller":
        return "stock_controller"
    return "staff_member"


def serialize_auth_user(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": frontend_role(user.role),
    }


def json_object(required_fields):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, (jsonify(error="A JSON object is required"), 400)
    if set(payload) != required_fields:
        return None, (jsonify(error="Request fields are missing or unknown"), 400)
    return payload, None


def json_object_subset(allowed_fields):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, (jsonify(error="A JSON object is required"), 400)
    if not payload:
        return None, (jsonify(error="At least one field is required"), 400)
    if not set(payload) <= allowed_fields:
        return None, (jsonify(error="Request fields are missing or unknown"), 400)
    return payload, None


def money_value(value):
    if isinstance(value, Decimal):
        return float(value)
    return float(Decimal(str(value)))


def get_bearer_user():
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None, (jsonify(error="Authentication required"), 401)

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
        return None, (jsonify(error="Authentication required"), 401)

    user = db.session.get(User, user_id)
    if user is None or not user.is_active:
        return None, (jsonify(error="Authentication required"), 401)
    return user, None


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user, error = get_bearer_user()
        if error:
            return error
        return view(user, *args, **kwargs)

    return wrapped


def require_roles(*roles):
    allowed = frozenset(roles)

    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user, error = get_bearer_user()
            if error:
                return error
            if user.role not in allowed:
                return jsonify(error="Insufficient permissions"), 403
            return view(user, *args, **kwargs)

        return wrapped

    return decorator


def parse_collection_args(allowed_sorts, default_sort, allowed_filters=frozenset()):
    args = request.args
    unknown = set(args) - (
        {"page", "per_page", "sort", "direction"} | set(allowed_filters)
    )
    if unknown:
        return None, (jsonify(error="Unknown query parameter"), 400)

    try:
        page = int(args.get("page", 1))
        per_page = int(args.get("per_page", 20))
    except (TypeError, ValueError):
        return None, (jsonify(error="page and per_page must be integers"), 400)
    if page < 1 or per_page < 1 or per_page > 100:
        return None, (
            jsonify(error="page must be >= 1 and per_page must be between 1 and 100"),
            400,
        )

    sort = args.get("sort", default_sort)
    if sort not in allowed_sorts:
        return None, (jsonify(error="sort field is not allowed"), 400)
    direction = args.get("direction", "asc").lower()
    if direction not in {"asc", "desc"}:
        return None, (jsonify(error="direction must be asc or desc"), 400)

    filters = {name: args.get(name) for name in allowed_filters if name in args}
    return {
        "page": page,
        "per_page": per_page,
        "sort": sort,
        "direction": direction,
        "filters": filters,
    }, None


def paginate_query(query, model, page, per_page, sort, direction, sort_columns):
    column = sort_columns[sort]
    order = asc(column) if direction == "asc" else desc(column)
    total = query.order_by(None).count()
    items = (
        query.order_by(order)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "items": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": ceil(total / per_page) if total else 0,
        },
    }


def inventory_error_response(error):
    from app.services.inventory import DuplicateSaleSubmission, InventoryOperationError

    if isinstance(error, DuplicateSaleSubmission):
        return jsonify(error=str(error)), 409
    if isinstance(error, InventoryOperationError):
        return jsonify(error=str(error)), 400
    raise error
