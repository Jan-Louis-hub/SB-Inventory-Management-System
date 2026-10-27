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
from app.models import Product, StockMovement, StockRequest


MANAGER_ROLES = {"admin", "manager"}


def _error(message, status=400):
    return {"error": message}, status


def _serialize(item):
    return {
        "id": item.id,
        "request_number": item.request_number,
        "product_id": item.product_id,
        "sku": item.product.sku,
        "product": item.product.name,
        "quantity": item.quantity,
        "note": item.note,
        "status": item.status,
        "requester_user_id": item.requester_user_id,
        "requester": item.requester.name,
        "created_at": item.created_at.isoformat(),
        "resolved_at": item.resolved_at.isoformat() if item.resolved_at else None,
    }


def _authorized():
    user = authenticated_user_from_request()
    if user is None:
        return None, _error("Authentication required", 401)
    return user, None


def _get_request(request_id, lock=False):
    statement = (
        select(StockRequest)
        .options(
            selectinload(StockRequest.product),
            selectinload(StockRequest.requester),
        )
        .where(StockRequest.id == request_id)
    )
    if lock:
        statement = statement.with_for_update()
    return db.session.scalar(statement)


@api.get("/stock-requests")
def list_stock_requests():
    user, error = _authorized()
    if error:
        return error
    statement = (
        select(StockRequest)
        .options(
            selectinload(StockRequest.product),
            selectinload(StockRequest.requester),
        )
        .order_by(StockRequest.created_at.desc(), StockRequest.id.desc())
        .limit(100)
    )
    if user.role not in MANAGER_ROLES:
        statement = statement.where(StockRequest.requester_user_id == user.id)
    status = request.args.get("status")
    if status:
        if status not in {"pending", "approved", "declined", "fulfilled"}:
            return _error("Invalid stock request status")
        statement = statement.where(StockRequest.status == status)
    rows = db.session.scalars(statement).all()
    return {"stock_requests": [_serialize(row) for row in rows]}, 200


@api.post("/stock-requests")
def create_stock_request():
    user, error = _authorized()
    if error:
        return error
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or set(payload) - {
        "product_id",
        "quantity",
        "note",
    }:
        return _error("A JSON object with supported stock request fields is required")
    try:
        product_id = integer_value(payload.get("product_id"), "product_id", 1)
        quantity = integer_value(payload.get("quantity"), "quantity", 1)
    except ValueError as error:
        return _error(str(error))
    note = payload.get("note", "")
    if not isinstance(note, str) or len(note.strip()) > 255:
        return _error("note must be a string of at most 255 characters")
    product = db.session.get(Product, product_id)
    if product is None or not product.is_active:
        return _error("Active product not found", 404)
    item = StockRequest(
        request_number=f"REQ-{uuid4().hex[:12].upper()}",
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
        return _error("Stock request could not be saved", 409)
    return {"stock_request": _serialize(_get_request(item.id))}, 201


@api.post("/stock-requests/<int:request_id>/approve")
def approve_stock_request(request_id):
    user, error = _authorized()
    if error:
        return error
    if user.role not in MANAGER_ROLES:
        return _error("Manager access required", 403)
    item = _get_request(request_id, lock=True)
    if item is None:
        return _error("Stock request not found", 404)
    if item.status != "pending":
        return _error("Only pending requests can be approved", 409)
    item.status = "approved"
    item.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return {"stock_request": _serialize(_get_request(request_id))}, 200


@api.post("/stock-requests/<int:request_id>/decline")
def decline_stock_request(request_id):
    user, error = _authorized()
    if error:
        return error
    if user.role not in MANAGER_ROLES:
        return _error("Manager access required", 403)
    item = _get_request(request_id, lock=True)
    if item is None:
        return _error("Stock request not found", 404)
    if item.status != "pending":
        return _error("Only pending requests can be declined", 409)
    item.status = "declined"
    item.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return {"stock_request": _serialize(_get_request(request_id))}, 200


@api.post("/stock-requests/<int:request_id>/fulfill")
def fulfill_stock_request(request_id):
    user, error = _authorized()
    if error:
        return error
    if user.role not in MANAGER_ROLES | {"stock_controller"}:
        return _error("Stock controller access required", 403)
    item = _get_request(request_id, lock=True)
    if item is None:
        return _error("Stock request not found", 404)
    if item.status != "approved":
        return _error("Only approved requests can be fulfilled", 409)
    product = db.session.scalar(
        select(Product)
        .where(Product.id == item.product_id)
        .with_for_update()
    )
    if product is None or not product.is_active:
        return _error("Requested product is no longer active", 409)
    if product.quantity + item.quantity > MAX_INTEGER:
        return _error("Fulfilled quantity exceeds the supported stock range", 409)
    product.quantity += item.quantity
    item.status = "fulfilled"
    item.resolved_at = datetime.now(timezone.utc)
    db.session.add(
        StockMovement(
            product_id=product.id,
            user_id=user.id,
            movement_type="receipt",
            quantity_change=item.quantity,
            reason=f"Fulfilled stock request {item.request_number}",
            reference_type="stock_request",
            reference_id=item.id,
        )
    )
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("Stock request could not be fulfilled", 409)
    return {"stock_request": _serialize(_get_request(request_id))}, 200


@api.delete("/stock-requests/<int:request_id>")
def withdraw_stock_request(request_id):
    user, error = _authorized()
    if error:
        return error
    item = _get_request(request_id, lock=True)
    if item is None:
        return _error("Stock request not found", 404)
    if user.role not in MANAGER_ROLES and item.requester_user_id != user.id:
        return _error("Insufficient permissions", 403)
    if item.status != "pending":
        return _error("Only pending requests can be withdrawn", 409)
    db.session.delete(item)
    db.session.commit()
    return "", 204
