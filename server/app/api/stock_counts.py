from datetime import datetime, timezone
from uuid import uuid4

from flask import request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.api.validation import MAX_INTEGER, integer_value
from app.extensions import db
from app.models import Product, StockCount, StockCountLine, StockMovement, User


COUNT_ROLES = {"admin", "manager", "stock_controller"}


def _error(message, status=400):
    return {"error": message}, status


def _actor(roles=COUNT_ROLES):
    user = authenticated_user_from_request()
    if user is None:
        return None, _error("Authentication required", 401)
    if user.role not in roles:
        return None, _error("Stock count access required", 403)
    return user, None


def _serialize(count, include_lines=False):
    result = {
        "id": count.id,
        "count_number": count.count_number,
        "area": count.area,
        "location": count.location,
        "due_label": count.due_label,
        "status": count.status,
        "owner_user_id": count.owner_user_id,
        "owner": count.owner.name if count.owner else None,
        "created_by_user_id": count.created_by_user_id,
        "created_at": count.created_at.isoformat(),
        "completed_at": count.completed_at.isoformat() if count.completed_at else None,
    }
    if include_lines:
        result["lines"] = [
            {
                "id": line.id,
                "product_id": line.product_id,
                "sku": line.product.sku,
                "name": line.product.name,
                "expected_quantity": line.expected_quantity,
                "counted_quantity": line.counted_quantity,
            }
            for line in count.lines
        ]
    return result


def _get_count(count_id, with_lines=False):
    statement = select(StockCount).where(StockCount.id == count_id)
    if with_lines:
        statement = statement.options(
            selectinload(StockCount.lines).selectinload(StockCountLine.product),
            selectinload(StockCount.owner),
        )
    return db.session.scalar(statement)


@api.get("/stock-counts")
def list_stock_counts():
    user, error = _actor()
    if error:
        return error
    counts = db.session.scalars(
        select(StockCount)
        .options(selectinload(StockCount.owner))
        .order_by(StockCount.created_at.desc(), StockCount.id.desc())
        .limit(100)
    ).all()
    return {"stock_counts": [_serialize(count) for count in counts]}, 200


@api.post("/stock-counts")
def create_stock_count():
    user, error = _actor()
    if error:
        return error
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or set(payload) - {
        "area",
        "location",
        "due_label",
        "owner_user_id",
    }:
        return _error("A JSON object with supported stock count fields is required")
    values = {}
    for field, max_length in (("area", 80), ("location", 80), ("due_label", 40)):
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > max_length:
            return _error(f"{field} must contain 1 to {max_length} characters")
        values[field] = value.strip()
    owner_id = user.id
    if "owner_user_id" in payload:
        try:
            owner_id = integer_value(payload["owner_user_id"], "owner_user_id", 1)
        except ValueError as error:
            return _error(str(error))
    owner = db.session.get(User, owner_id)
    if owner is None or not owner.is_active:
        return _error("An active count owner is required")

    products = db.session.scalars(
        select(Product)
        .where(
            Product.is_active.is_(True),
            Product.location == values["location"],
        )
        .order_by(Product.id)
        .with_for_update()
    ).all()
    if not products:
        return _error("No active products are assigned to this location", 409)
    count = StockCount(
        count_number=f"COUNT-{uuid4().hex[:12].upper()}",
        status="scheduled",
        owner_user_id=owner.id,
        created_by_user_id=user.id,
        **values,
    )
    db.session.add(count)
    try:
        db.session.flush()
        db.session.add_all(
            [
                StockCountLine(
                    stock_count_id=count.id,
                    product_id=product.id,
                    expected_quantity=product.quantity,
                )
                for product in products
            ]
        )
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("Stock count could not be created", 409)
    return {"stock_count": _serialize(_get_count(count.id, True), True)}, 201


@api.get("/stock-counts/<int:count_id>")
def get_stock_count(count_id):
    _, error = _actor()
    if error:
        return error
    count = _get_count(count_id, True)
    if count is None:
        return _error("Stock count not found", 404)
    return {"stock_count": _serialize(count, True)}, 200


@api.post("/stock-counts/<int:count_id>/start")
def start_stock_count(count_id):
    _, error = _actor()
    if error:
        return error
    count = db.session.scalar(
        select(StockCount).where(StockCount.id == count_id).with_for_update()
    )
    if count is None:
        return _error("Stock count not found", 404)
    if count.status != "scheduled":
        return _error("Only scheduled counts can be started", 409)
    count.status = "in_progress"
    db.session.commit()
    return {"stock_count": _serialize(_get_count(count_id, True), True)}, 200


@api.patch("/stock-counts/<int:count_id>/lines/<int:line_id>")
def update_stock_count_line(count_id, line_id):
    _, error = _actor()
    if error:
        return error
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or set(payload) != {"counted_quantity"}:
        return _error("counted_quantity is required")
    quantity = payload["counted_quantity"]
    if quantity is not None:
        try:
            quantity = integer_value(quantity, "counted_quantity")
        except ValueError as error:
            return _error(str(error))
    count = db.session.scalar(
        select(StockCount).where(StockCount.id == count_id).with_for_update()
    )
    if count is None:
        return _error("Stock count not found", 404)
    if count.status not in {"scheduled", "in_progress"}:
        return _error("Completed counts cannot be edited", 409)
    line = db.session.get(StockCountLine, line_id)
    if line is None or line.stock_count_id != count_id:
        return _error("Stock count line not found", 404)
    count.status = "in_progress"
    line.counted_quantity = quantity
    db.session.commit()
    return {"stock_count": _serialize(_get_count(count_id, True), True)}, 200


@api.post("/stock-counts/<int:count_id>/complete")
def complete_stock_count(count_id):
    user, error = _actor()
    if error:
        return error
    count = db.session.scalar(
        select(StockCount).where(StockCount.id == count_id).with_for_update()
    )
    if count is None:
        return _error("Stock count not found", 404)
    if count.status not in {"scheduled", "in_progress"}:
        return _error("Count is already completed", 409)
    lines = db.session.scalars(
        select(StockCountLine)
        .where(StockCountLine.stock_count_id == count_id)
        .order_by(StockCountLine.product_id)
        .with_for_update()
    ).all()
    if any(line.counted_quantity is None for line in lines):
        return _error("All products must be counted before completing", 400)
    products = {
        product.id: product
        for product in db.session.scalars(
            select(Product)
            .where(Product.id.in_([line.product_id for line in lines]))
            .order_by(Product.id)
            .with_for_update()
        ).all()
    } if lines else {}
    for line in lines:
        product = products.get(line.product_id)
        if product is None:
            db.session.rollback()
            return _error("A counted product no longer exists", 409)
        change = line.counted_quantity - product.quantity
        if change:
            if abs(change) > MAX_INTEGER:
                db.session.rollback()
                return _error("Count adjustment exceeds the supported range", 409)
            product.quantity = line.counted_quantity
            db.session.add(
                StockMovement(
                    product_id=product.id,
                    user_id=user.id,
                    movement_type="adjustment",
                    quantity_change=change,
                    reason=f"Physical stock count {count.count_number}",
                    reference_type="stock_count",
                    reference_id=count.id,
                )
            )
    count.status = "completed"
    count.completed_at = datetime.now(timezone.utc)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("Count adjustments could not be saved", 409)
    return {"stock_count": _serialize(_get_count(count_id, True), True)}, 200
