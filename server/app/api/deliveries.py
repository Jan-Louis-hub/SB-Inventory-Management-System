from datetime import datetime, timezone

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    money_value,
    parse_collection_args,
    require_auth,
)
from app.models import PurchaseOrder, PurchaseOrderItem

# Frontend delivery statuses derived from purchase-order state + expected date.
DELIVERY_STATUSES = frozenset({"scheduled", "arrived", "delayed", "received"})

ROLE_DELIVERY_STATUSES = {
    "admin": frozenset({"scheduled", "arrived", "delayed", "received"}),
    "manager": frozenset({"scheduled", "arrived", "delayed", "received"}),
    "stock_controller": frozenset({"scheduled", "arrived", "delayed"}),
    "staff": frozenset({"scheduled", "arrived"}),
    "cashier": frozenset({"scheduled", "arrived"}),
}


def _delivery_date(order):
    if order.status == "received" and order.received_at is not None:
        received = order.received_at
        if isinstance(received, datetime):
            return received.date()
        return received
    if order.expected_date is not None:
        return order.expected_date
    return order.order_date


def delivery_status_for(order, today=None):
    """Map a purchase order to a calendar delivery status."""
    if today is None:
        today = datetime.now(timezone.utc).date()
    if order.status == "received":
        return "received"
    if order.status not in {"ordered", "partial"}:
        return None

    due = _delivery_date(order)
    if due < today:
        return "delayed"
    if due == today or order.status == "partial":
        return "arrived"
    return "scheduled"


def _items_summary(order):
    lines = (
        PurchaseOrderItem.query.filter_by(purchase_order_id=order.id)
        .order_by(PurchaseOrderItem.id)
        .all()
    )
    parts = []
    for line in lines:
        name = line.product.name if line.product is not None else f"product {line.product_id}"
        remaining = line.quantity_ordered - line.quantity_received
        qty = line.quantity_ordered if order.status == "received" else max(remaining, 0)
        if qty <= 0 and order.status != "received":
            qty = line.quantity_ordered
        parts.append(f"{qty} {name}")
    return ", ".join(parts) if parts else "No line items"


def serialize_delivery(order, user, today=None):
    status = delivery_status_for(order, today=today)
    payload = {
        "id": order.purchase_number,
        "purchase_order_id": order.id,
        "supplier_id": order.supplier_id,
        "supplier": order.supplier.name if order.supplier is not None else None,
        "items": _items_summary(order),
        "date": _delivery_date(order).isoformat(),
        "status": status,
        "order_status": order.status,
    }
    if user.role in MANAGER_ROLES:
        payload["value"] = money_value(order.total_amount)
    return payload


@api.get("/deliveries")
@require_auth
def list_deliveries(user):
    params, error = parse_collection_args(
        allowed_sorts={"date", "id", "status"},
        default_sort="date",
        allowed_filters={"status"},
    )
    if error:
        return error

    allowed = ROLE_DELIVERY_STATUSES.get(user.role, frozenset())
    status_filter = params["filters"].get("status")
    if status_filter is not None:
        if status_filter not in DELIVERY_STATUSES:
            return {"error": "status is not allowed"}, 400
        if status_filter not in allowed:
            return {"error": "Insufficient permissions for this status"}, 403
        wanted = frozenset({status_filter})
    else:
        wanted = allowed

    today = datetime.now(timezone.utc).date()
    # Candidates: placed orders that can appear on the delivery calendar.
    candidates = (
        PurchaseOrder.query.filter(
            PurchaseOrder.status.in_(("ordered", "partial", "received"))
        )
        .order_by(PurchaseOrder.id)
        .all()
    )

    deliveries = []
    for order in candidates:
        status = delivery_status_for(order, today=today)
        if status in wanted:
            deliveries.append(serialize_delivery(order, user, today=today))

    sort = params["sort"]
    reverse = params["direction"] == "desc"
    if sort == "date":
        deliveries.sort(key=lambda item: item["date"], reverse=reverse)
    elif sort == "status":
        deliveries.sort(key=lambda item: item["status"], reverse=reverse)
    else:
        deliveries.sort(key=lambda item: item["purchase_order_id"], reverse=reverse)

    page = params["page"]
    per_page = params["per_page"]
    total = len(deliveries)
    start = (page - 1) * per_page
    end = start + per_page
    pages = (total + per_page - 1) // per_page if total else 0

    return {
        "items": deliveries[start:end],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": pages,
        },
    }, 200


@api.get("/deliveries/<purchase_number>")
@require_auth
def get_delivery(user, purchase_number):
    if not isinstance(purchase_number, str) or not purchase_number.strip():
        return {"error": "Delivery not found"}, 404

    order = PurchaseOrder.query.filter_by(
        purchase_number=purchase_number.strip()
    ).one_or_none()
    if order is None:
        return {"error": "Delivery not found"}, 404

    status = delivery_status_for(order)
    allowed = ROLE_DELIVERY_STATUSES.get(user.role, frozenset())
    if status is None or status not in allowed:
        return {"error": "Delivery not found"}, 404

    return serialize_delivery(order, user), 200
