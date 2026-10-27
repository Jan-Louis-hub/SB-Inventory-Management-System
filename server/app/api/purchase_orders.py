from datetime import date

from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    STOCK_ROLES,
    inventory_error_response,
    json_object,
    money_value,
    paginate_query,
    parse_collection_args,
    require_auth,
    require_roles,
)
from app.extensions import db
from app.models import PurchaseOrder, PurchaseOrderItem
from app.services.inventory import (
    InventoryOperationError,
    create_purchase_order,
    receive_purchase_order_item,
)


def serialize_purchase_order(order, include_items=False):
    payload = {
        "id": order.id,
        "purchase_number": order.purchase_number,
        "supplier_id": order.supplier_id,
        "supplier": order.supplier.name if order.supplier is not None else None,
        "user_id": order.user_id,
        "status": order.status,
        "order_date": order.order_date.isoformat(),
        "expected_date": (
            order.expected_date.isoformat() if order.expected_date is not None else None
        ),
        "received_at": (
            order.received_at.isoformat() if order.received_at is not None else None
        ),
        "total_amount": money_value(order.total_amount),
    }
    if include_items:
        items = (
            PurchaseOrderItem.query.filter_by(purchase_order_id=order.id)
            .order_by(PurchaseOrderItem.id)
            .all()
        )
        payload["items"] = [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product": item.product.name if item.product is not None else None,
                "sku": item.product.sku if item.product is not None else None,
                "quantity_ordered": item.quantity_ordered,
                "quantity_received": item.quantity_received,
                "unit_cost": money_value(item.unit_cost),
                "line_total": money_value(item.line_total),
            }
            for item in items
        ]
    return payload


def _parse_date(value, field, required=True):
    if value is None:
        if required:
            return None, f"{field} is required"
        return None, None
    if not isinstance(value, str):
        return None, f"{field} must be an ISO date string"
    try:
        return date.fromisoformat(value), None
    except ValueError:
        return None, f"{field} must be an ISO date string"


@api.get("/purchase-orders")
@require_auth
def list_purchase_orders(user):
    params, error = parse_collection_args(
        allowed_sorts={"order_date", "id", "status", "purchase_number"},
        default_sort="order_date",
        allowed_filters={"status", "supplier_id"},
    )
    if error:
        return error

    query = PurchaseOrder.query
    filters = params["filters"]
    if "status" in filters:
        query = query.filter_by(status=filters["status"])
    if "supplier_id" in filters:
        try:
            supplier_id = int(filters["supplier_id"])
        except (TypeError, ValueError):
            return {"error": "supplier_id must be an integer"}, 400
        query = query.filter_by(supplier_id=supplier_id)

    # Staff see only ordered/partial/received; managers and controllers see all
    if user.role not in STOCK_ROLES:
        query = query.filter(
            PurchaseOrder.status.in_(("ordered", "partial", "received"))
        )

    result = paginate_query(
        query,
        PurchaseOrder,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {
            "order_date": PurchaseOrder.order_date,
            "id": PurchaseOrder.id,
            "status": PurchaseOrder.status,
            "purchase_number": PurchaseOrder.purchase_number,
        },
    )
    return {
        "items": [serialize_purchase_order(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/purchase-orders")
@require_roles(*MANAGER_ROLES)
def create_order(user):
    payload, error = json_object(
        {
            "purchase_number",
            "supplier_id",
            "order_date",
            "expected_date",
            "status",
            "items",
        }
    )
    if error:
        return error

    order_date, order_date_error = _parse_date(payload["order_date"], "order_date")
    if order_date_error:
        return {"error": order_date_error}, 400
    expected_date, expected_date_error = _parse_date(
        payload["expected_date"], "expected_date", required=False
    )
    if expected_date_error:
        return {"error": expected_date_error}, 400

    try:
        order = create_purchase_order(
            purchase_number=payload["purchase_number"],
            supplier_id=payload["supplier_id"],
            user_id=user.id,
            order_date=order_date,
            expected_date=expected_date,
            items=payload["items"],
            status=payload["status"],
        )
        db.session.commit()
    except InventoryOperationError as exc:
        db.session.rollback()
        return inventory_error_response(exc)
    except IntegrityError:
        db.session.rollback()
        return {"error": "purchase_number already exists"}, 409

    return serialize_purchase_order(order, include_items=True), 201


@api.get("/purchase-orders/<int:order_id>")
@require_auth
def get_purchase_order(user, order_id):
    order = db.session.get(PurchaseOrder, order_id)
    if order is None:
        return {"error": "Purchase order not found"}, 404
    if user.role not in STOCK_ROLES and order.status not in {
        "ordered",
        "partial",
        "received",
    }:
        return {"error": "Purchase order not found"}, 404
    return serialize_purchase_order(order, include_items=True), 200


@api.post("/purchase-orders/<int:order_id>/place")
@require_roles(*MANAGER_ROLES)
def place_purchase_order(user, order_id):
    order = db.session.get(PurchaseOrder, order_id)
    if order is None:
        return {"error": "Purchase order not found"}, 404
    if order.status != "draft":
        return {"error": "Only draft purchase orders can be placed"}, 409
    order.status = "ordered"
    db.session.commit()
    return serialize_purchase_order(order, include_items=True), 200


@api.post("/purchase-orders/<int:order_id>/cancel")
@require_roles(*MANAGER_ROLES)
def cancel_purchase_order(user, order_id):
    order = db.session.get(PurchaseOrder, order_id)
    if order is None:
        return {"error": "Purchase order not found"}, 404
    if order.status not in {"draft", "ordered"}:
        return {
            "error": "Only draft or ordered purchase orders with no receipts can be cancelled"
        }, 409

    received = (
        PurchaseOrderItem.query.filter(
            PurchaseOrderItem.purchase_order_id == order.id,
            PurchaseOrderItem.quantity_received > 0,
        )
        .limit(1)
        .first()
    )
    if received is not None:
        return {
            "error": "Purchase orders with received stock cannot be cancelled"
        }, 409

    order.status = "cancelled"
    db.session.commit()
    return serialize_purchase_order(order, include_items=True), 200


@api.post("/purchase-orders/items/<int:item_id>/receive")
@require_roles(*STOCK_ROLES)
def receive_item(user, item_id):
    payload, error = json_object({"quantity"})
    if error:
        return error

    try:
        order = receive_purchase_order_item(
            item_id=item_id,
            quantity=payload["quantity"],
            user_id=user.id,
        )
        db.session.commit()
    except InventoryOperationError as exc:
        db.session.rollback()
        return inventory_error_response(exc)

    return serialize_purchase_order(order, include_items=True), 200
