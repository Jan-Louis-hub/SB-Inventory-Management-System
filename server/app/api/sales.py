from decimal import Decimal
from uuid import UUID, uuid4

from flask import request
from sqlalchemy import select

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.extensions import db
from app.models import Sale, SaleItem
from app.services.inventory import InventoryOperationError, create_sale


def _error(message, status=400):
    return {"error": message}, status


def _serialize(sale):
    items = db.session.scalars(
        select(SaleItem).where(SaleItem.sale_id == sale.id).order_by(SaleItem.id)
    ).all()
    return {
        "id": sale.id,
        "sale_number": sale.sale_number,
        "status": sale.status,
        "subtotal": format(sale.subtotal, ".2f"),
        "discount_amount": format(sale.discount_amount, ".2f"),
        "tax_amount": format(sale.tax_amount, ".2f"),
        "total_amount": format(sale.total_amount, ".2f"),
        "sold_at": sale.sold_at.isoformat(),
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product.name,
                "sku": item.product.sku,
                "quantity": item.quantity,
                "unit_price": format(item.unit_price, ".2f"),
                "line_total": format(item.line_total, ".2f"),
            }
            for item in items
        ],
    }


@api.get("/sales")
def list_sales():
    if authenticated_user_from_request() is None:
        return _error("Authentication required", 401)
    sales = db.session.scalars(
        select(Sale).order_by(Sale.sold_at.desc(), Sale.id.desc()).limit(100)
    ).all()
    return {"sales": [_serialize(sale) for sale in sales]}, 200


@api.post("/sales")
def record_sale():
    user = authenticated_user_from_request()
    if user is None:
        return _error("Authentication required", 401)
    if user.role not in {"admin", "manager", "cashier"}:
        return _error("Sales access required", 403)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or set(payload) - {
        "items",
        "discount_amount",
        "tax_rate",
        "idempotency_key",
    }:
        return _error("A JSON object with supported sale fields is required")
    items = payload.get("items")
    if not isinstance(items, list):
        return _error("items must be a list")
    normalized_items = []
    for item in items:
        if not isinstance(item, dict) or set(item) != {"product_id", "quantity"}:
            return _error("Each sale item requires product_id and quantity")
        normalized_items.append((item["product_id"], item["quantity"]))
    try:
        idempotency_key = payload.get("idempotency_key")
        if idempotency_key is not None:
            idempotency_key = UUID(idempotency_key)
        sale = create_sale(
            sale_number=f"SALE-{uuid4().hex[:12].upper()}",
            user_id=user.id,
            items=normalized_items,
            discount_amount=payload.get("discount_amount", Decimal("0.00")),
            tax_rate=payload.get("tax_rate", Decimal("0.00")),
            idempotency_key=idempotency_key,
        )
        db.session.commit()
    except (InventoryOperationError, ValueError, TypeError, AttributeError) as error:
        db.session.rollback()
        return _error(str(error), 409)
    return {"sale": _serialize(sale)}, 201
