from datetime import datetime

from flask import request
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.api.validation import MAX_INTEGER, integer_value
from app.extensions import db
from app.models import Product, StockMovement


MOVEMENT_TYPES = {
    "stock_in": ("receipt", 1),
    "receipt": ("receipt", 1),
    "return": ("return", 1),
    "stock_out": ("sale", -1),
    "sale": ("sale", -1),
    "damage": ("damage", -1),
}


def _error(message, status=400):
    return {"error": message}, status


def _serialize(movement):
    return {
        "id": movement.id,
        "product_id": movement.product_id,
        "product_name": movement.product.name,
        "user_id": movement.user_id,
        "actor": movement.user.name if movement.user else None,
        "movement_type": movement.movement_type,
        "quantity_change": movement.quantity_change,
        "reason": movement.reason,
        "reference_type": movement.reference_type,
        "reference_id": movement.reference_id,
        "created_at": movement.created_at.isoformat(),
    }


def _pagination():
    try:
        page = integer_value(request.args.get("page", "1"), "page", 1)
        per_page = integer_value(request.args.get("per_page", "20"), "per_page", 1)
    except ValueError as error:
        return None, str(error)
    if per_page > 100:
        return None, "per_page cannot exceed 100"
    return (page, per_page), None


@api.get("/stock-movements")
def list_stock_movements():
    pagination, error = _pagination()
    if error:
        return _error(error)
    page, per_page = pagination # type: ignore
    statement = select(StockMovement).join(Product)
    product_id = request.args.get("product_id")
    if product_id is not None:
        try:
            statement = statement.where(
                StockMovement.product_id == integer_value(product_id, "product_id", 1)
            )
        except ValueError as error:
            return _error(str(error))
    user_id = request.args.get("user_id")
    if user_id is not None:
        try:
            statement = statement.where(
                StockMovement.user_id == integer_value(user_id, "user_id", 1)
            )
        except ValueError as error:
            return _error(str(error))
    movement_type = request.args.get("movement_type")
    if movement_type is not None:
        stored_type = {
            "stock_in": "receipt",
            "stock_out": "sale",
        }.get(movement_type, movement_type)
        if stored_type not in {"receipt", "sale", "adjustment", "return", "damage"}:
            return _error("Invalid movement_type")
        statement = statement.where(StockMovement.movement_type == stored_type)
    for param, column in (
        ("from", StockMovement.created_at),
        ("to", StockMovement.created_at),
    ):
        value = request.args.get(param)
        if value:
            try:
                bound = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return _error(f"{param} must be an ISO 8601 datetime")
            statement = statement.where(column >= bound if param == "from" else column <= bound)

    total = db.session.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    )
    movements = db.session.scalars(
        statement.order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()
    return {
        "stock_movements": [_serialize(movement) for movement in movements],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page, # type: ignore
        },
    }, 200


@api.post("/stock-movements")
def create_stock_movement():
    user = authenticated_user_from_request()
    if user is None:
        return _error("Authentication required", 401)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _error("A JSON object is required")
    allowed = {"product_id", "movement_type", "quantity", "quantity_change", "reason"}
    if set(payload) - allowed:
        return _error("Unknown stock movement fields")
    movement_type = payload.get("movement_type")
    if not isinstance(movement_type, str):
        return _error("movement_type is required")
    movement_type = movement_type.lower()
    try:
        product_id = integer_value(payload.get("product_id"), "product_id", 1)
    except ValueError as error:
        return _error(str(error))

    if movement_type == "adjustment":
        if "quantity_change" not in payload or "quantity" in payload:
            return _error("adjustment requires a non-zero signed quantity_change")
        change = payload["quantity_change"]
        if (
            isinstance(change, bool)
            or not isinstance(change, int)
            or change == 0
            or abs(change) > MAX_INTEGER
        ):
            return _error("quantity_change must be a non-zero integer")
    elif movement_type in MOVEMENT_TYPES:
        if "quantity" not in payload or "quantity_change" in payload:
            return _error("stock-in and stock-out movements require quantity")
        try:
            quantity = integer_value(payload["quantity"], "quantity", 1)
        except ValueError as error:
            return _error(str(error))
        stored_type, direction = MOVEMENT_TYPES[movement_type]
        change = quantity * direction
    else:
        return _error("movement_type must be stock_in, stock_out, or adjustment")

    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 255:
        return _error("reason must contain 1 to 255 characters")
    if movement_type == "adjustment":
        stored_type = "adjustment"

    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Product not found", 404)
    if not product.is_active:
        return _error("Cannot move stock for an archived product", 409)

    result = db.session.execute(
        update(Product)
        .where(
            Product.id == product_id,
            Product.quantity + change >= 0,
            Product.quantity + change <= MAX_INTEGER,
        )
        .values(quantity=Product.quantity + change)
    )
    if result.rowcount != 1: # type: ignore
        db.session.rollback()
        return _error(
            "Stock movement would result in negative inventory or exceed the supported quantity range",
            409,
        )

    movement = StockMovement(
        product_id=product_id, # type: ignore
        user_id=user.id, # type: ignore
        movement_type=stored_type, # type: ignore
        quantity_change=change, # type: ignore
        reason=reason.strip(), # type: ignore
    )
    db.session.add(movement)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("Stock movement could not be recorded", 409)
    return {"stock_movement": _serialize(movement)}, 201
