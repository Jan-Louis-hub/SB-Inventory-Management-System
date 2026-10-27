from flask import request

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    paginate_query,
    parse_collection_args,
    require_auth,
)
from app.models import StockMovement


def serialize_movement(movement):
    return {
        "id": movement.id,
        "product_id": movement.product_id,
        "sku": movement.product.sku if movement.product is not None else None,
        "product": movement.product.name if movement.product is not None else None,
        "user_id": movement.user_id,
        "user": movement.user.name if movement.user is not None else None,
        "movement_type": movement.movement_type,
        "quantity_change": movement.quantity_change,
        "reason": movement.reason,
        "reference_type": movement.reference_type,
        "reference_id": movement.reference_id,
        "created_at": movement.created_at.isoformat()
        if movement.created_at is not None
        else None,
    }


@api.get("/stock-movements")
@require_auth
def list_stock_movements(user):
    params, error = parse_collection_args(
        allowed_sorts={"created_at", "id"},
        default_sort="created_at",
        allowed_filters={"product_id", "movement_type", "user_id"},
    )
    if error:
        return error

    query = StockMovement.query
    filters = params["filters"]
    if "product_id" in filters:
        try:
            product_id = int(filters["product_id"])
        except (TypeError, ValueError):
            return {"error": "product_id must be an integer"}, 400
        query = query.filter_by(product_id=product_id)
    if "movement_type" in filters:
        query = query.filter_by(movement_type=filters["movement_type"])
    if "user_id" in filters:
        try:
            user_id = int(filters["user_id"])
        except (TypeError, ValueError):
            return {"error": "user_id must be an integer"}, 400
        query = query.filter_by(user_id=user_id)

    if user.role not in MANAGER_ROLES and user.role != "stock_controller":
        query = query.filter_by(user_id=user.id)

    direction = params["direction"]
    if params["sort"] == "created_at" and "direction" not in request.args:
        direction = "desc"

    result = paginate_query(
        query,
        StockMovement,
        params["page"],
        params["per_page"],
        params["sort"],
        direction,
        {"created_at": StockMovement.created_at, "id": StockMovement.id},
    )
    return {
        "items": [serialize_movement(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200
