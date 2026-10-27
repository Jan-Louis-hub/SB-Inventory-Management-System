from datetime import datetime, timezone

from flask import request
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    json_object,
    paginate_query,
    parse_collection_args,
    require_auth,
    require_roles,
)
from app.extensions import db
from app.models import Product, StockRequest


def serialize_request(item):
    return {
        "id": item.id,
        "request_number": item.request_number,
        "product_id": item.product_id,
        "sku": item.product.sku if item.product is not None else None,
        "product": item.product.name if item.product is not None else None,
        "quantity": item.quantity,
        "note": item.note,
        "status": item.status,
        "requester_user_id": item.requester_user_id,
        "requester": item.requester.name if item.requester is not None else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "resolved_at": (
            item.resolved_at.isoformat() if item.resolved_at is not None else None
        ),
    }


@api.get("/stock-requests")
@require_auth
def list_stock_requests(user):
    params, error = parse_collection_args(
        allowed_sorts={"id", "created_at", "status"},
        default_sort="created_at",
        allowed_filters={"status", "mine"},
    )
    if error:
        return error

    query = StockRequest.query
    filters = params["filters"]
    if "status" in filters:
        query = query.filter_by(status=filters["status"])
    if filters.get("mine") == "true" or user.role not in MANAGER_ROLES:
        query = query.filter_by(requester_user_id=user.id)

    direction = params["direction"]
    if params["sort"] == "created_at" and "direction" not in request.args:
        direction = "desc"

    result = paginate_query(
        query,
        StockRequest,
        params["page"],
        params["per_page"],
        params["sort"],
        direction,
        {
            "id": StockRequest.id,
            "created_at": StockRequest.created_at,
            "status": StockRequest.status,
        },
    )
    return {
        "items": [serialize_request(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/stock-requests")
@require_auth
def create_stock_request(user):
    payload, error = json_object(
        {"request_number", "product_id", "quantity", "note"}
    )
    if error:
        return error

    request_number = payload["request_number"]
    product_id = payload["product_id"]
    quantity = payload["quantity"]
    note = payload["note"]

    if (
        not isinstance(request_number, str)
        or not request_number.strip()
        or len(request_number.strip()) > 40
    ):
        return {"error": "request_number must contain 1 to 40 characters"}, 400
    if (
        isinstance(product_id, bool)
        or not isinstance(product_id, int)
        or product_id <= 0
    ):
        return {"error": "product_id must be a positive integer"}, 400
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        return {"error": "quantity must be a positive integer"}, 400
    if not isinstance(note, str) or len(note) > 255:
        return {"error": "note must be a string of at most 255 characters"}, 400

    product = db.session.get(Product, product_id)
    if product is None or not product.is_active:
        return {"error": "product_id was not found"}, 400

    item = StockRequest(
        request_number=request_number.strip(),
        product_id=product_id,
        quantity=quantity,
        note=note.strip(),
        status="pending",
        requester_user_id=user.id,
    )
    db.session.add(item)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "request_number already exists"}, 409
    return serialize_request(item), 201


@api.get("/stock-requests/<int:request_id>")
@require_auth
def get_stock_request(user, request_id):
    item = db.session.get(StockRequest, request_id)
    if item is None:
        return {"error": "Stock request not found"}, 404
    if user.role not in MANAGER_ROLES and item.requester_user_id != user.id:
        return {"error": "Stock request not found"}, 404
    return serialize_request(item), 200


@api.post("/stock-requests/<int:request_id>/approve")
@require_roles(*MANAGER_ROLES)
def approve_stock_request(user, request_id):
    item = db.session.get(StockRequest, request_id)
    if item is None:
        return {"error": "Stock request not found"}, 404
    if item.status != "pending":
        return {"error": "Only pending requests can be approved"}, 409
    item.status = "approved"
    item.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return serialize_request(item), 200


@api.post("/stock-requests/<int:request_id>/decline")
@require_roles(*MANAGER_ROLES)
def decline_stock_request(user, request_id):
    item = db.session.get(StockRequest, request_id)
    if item is None:
        return {"error": "Stock request not found"}, 404
    if item.status != "pending":
        return {"error": "Only pending requests can be declined"}, 409
    item.status = "declined"
    item.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return serialize_request(item), 200


@api.post("/stock-requests/<int:request_id>/fulfill")
@require_roles(*MANAGER_ROLES)
def fulfill_stock_request(user, request_id):
    item = db.session.get(StockRequest, request_id)
    if item is None:
        return {"error": "Stock request not found"}, 404
    if item.status != "approved":
        return {"error": "Only approved requests can be fulfilled"}, 409
    item.status = "fulfilled"
    item.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return serialize_request(item), 200


@api.delete("/stock-requests/<int:request_id>")
@require_auth
def withdraw_stock_request(user, request_id):
    item = db.session.get(StockRequest, request_id)
    if item is None:
        return {"error": "Stock request not found"}, 404
    if item.requester_user_id != user.id and user.role not in MANAGER_ROLES:
        return {"error": "Insufficient permissions"}, 403
    if item.status != "pending":
        return {"error": "Only pending requests can be withdrawn"}, 409
    db.session.delete(item)
    db.session.commit()
    return "", 204
