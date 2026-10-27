from datetime import date
from decimal import Decimal
from uuid import uuid4

from flask import request
from sqlalchemy import select

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.api.validation import integer_value
from app.extensions import db
from app.models import Product, PurchaseOrder, PurchaseOrderItem, Supplier
from app.services.inventory import (
    MAX_INTEGER,
    MAX_MONEY,
    InventoryOperationError,
    receive_purchase_order_item,
)


def _error(message, status=400):
    return {"error": message}, status


def _serialize(order):
    items = db.session.scalars(
        select(PurchaseOrderItem)
        .where(PurchaseOrderItem.purchase_order_id == order.id)
        .order_by(PurchaseOrderItem.id)
    ).all()
    return {
        "id": order.id,
        "purchase_number": order.purchase_number,
        "supplier_id": order.supplier_id,
        "supplier": order.supplier.name,
        "status": order.status,
        "order_date": order.order_date.isoformat(),
        "expected_date": order.expected_date.isoformat() if order.expected_date else None,
        "total_amount": format(order.total_amount, ".2f"),
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "sku": item.product.sku,
                "product_name": item.product.name,
                "quantity_ordered": item.quantity_ordered,
                "quantity_received": item.quantity_received,
                "unit_cost": format(item.unit_cost, ".2f"),
                "line_total": format(item.line_total, ".2f"),
            }
            for item in items
        ],
    }


@api.get("/purchase-orders")
def list_purchase_orders():
    if authenticated_user_from_request() is None:
        return _error("Authentication required", 401)
    orders = db.session.scalars(
        select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
    ).all()
    return {"purchase_orders": [_serialize(order) for order in orders]}, 200


@api.post("/purchase-orders")
def create_purchase_order():
    user = authenticated_user_from_request()
    if user is None:
        return _error("Authentication required", 401)
    if user.role not in {"admin", "manager"}:
        return _error("Manager access required", 403)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or set(payload) - {"supplier_id", "expected_date", "items"}:
        return _error("A JSON object with supplier_id, expected_date and items is required")
    try:
        supplier_id = integer_value(payload.get("supplier_id"), "supplier_id", 1)
    except ValueError as error:
        return _error(str(error))
    supplier = db.session.get(Supplier, supplier_id)
    if supplier is None:
        return _error("Supplier not found", 404)

    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        return _error("items must contain at least one product")
    quantities = {}
    for entry in raw_items:
        if not isinstance(entry, dict) or set(entry) != {"product_id", "quantity_ordered"}:
            return _error("Each item requires product_id and quantity_ordered")
        try:
            product_id = integer_value(entry["product_id"], "product_id", 1)
            quantity = integer_value(entry["quantity_ordered"], "quantity_ordered", 1)
        except ValueError as error:
            return _error(str(error))
        quantities[product_id] = quantities.get(product_id, 0) + quantity
        if quantities[product_id] > MAX_INTEGER:
            return _error("combined ordered quantity exceeds the supported range")
    products = db.session.scalars(
        select(Product).where(Product.id.in_(quantities)).order_by(Product.id)
    ).all()
    if len(products) != len(quantities) or any(not product.is_active for product in products):
        return _error("One or more products are missing or archived")
    total = sum(
        (product.cost_price * quantities[product.id] for product in products),
        Decimal("0.00"),
    )
    if total > MAX_MONEY:
        return _error("purchase order total exceeds the supported range")

    expected_date = payload.get("expected_date")
    if expected_date is not None:
        if not isinstance(expected_date, str):
            return _error("expected_date must be an ISO date or null")
        try:
            expected_date = date.fromisoformat(expected_date)
        except ValueError:
            return _error("expected_date must be an ISO date or null")
    order = PurchaseOrder(
        purchase_number=f"PO-{uuid4().hex[:12].upper()}", # type: ignore
        supplier_id=supplier.id, # type: ignore
        user_id=user.id, # type: ignore
        status="ordered", # type: ignore
        order_date=date.today(), # type: ignore
        expected_date=expected_date, # type: ignore
        total_amount=total, # type: ignore
    )
    db.session.add(order)
    db.session.flush()
    for product in products:
        quantity = quantities[product.id]
        line_total = product.cost_price * quantity
        db.session.add(
            PurchaseOrderItem(
                purchase_order_id=order.id, # type: ignore
                product_id=product.id, # type: ignore
                quantity_ordered=quantity, # type: ignore
                quantity_received=0, # type: ignore
                unit_cost=product.cost_price, # type: ignore
                line_total=line_total, # type: ignore
            )
        )
    db.session.commit()
    return {"purchase_order": _serialize(order)}, 201


@api.post("/purchase-orders/<int:order_id>/items/<int:item_id>/receive")
def receive_purchase_order_line(order_id, item_id):
    user = authenticated_user_from_request()
    if user is None:
        return _error("Authentication required", 401)
    if user.role not in {"admin", "manager", "stock_controller"}:
        return _error("Stock controller access required", 403)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or set(payload) != {"quantity"}:
        return _error("quantity is required")
    try:
        quantity = integer_value(payload["quantity"], "quantity", 1)
    except ValueError as error:
        return _error(str(error))
    item = db.session.get(PurchaseOrderItem, item_id)
    if item is None or item.purchase_order_id != order_id:
        return _error("Purchase order item not found", 404)
    try:
        order = receive_purchase_order_item(
            item_id=item_id,
            quantity=quantity,
            user_id=user.id,
        )
        db.session.commit()
    except InventoryOperationError as error:
        db.session.rollback()
        return _error(str(error), 409)
    return {"purchase_order": _serialize(order)}, 200
