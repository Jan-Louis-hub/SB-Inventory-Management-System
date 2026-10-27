from decimal import Decimal, InvalidOperation
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
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
from app.models import Sale, SaleItem
from app.services.inventory import InventoryOperationError, create_sale


def serialize_sale(sale, include_items=False):
    payload = {
        "id": sale.id,
        "sale_number": sale.sale_number,
        "user_id": sale.user_id,
        "status": sale.status,
        "subtotal": money_value(sale.subtotal),
        "discount_amount": money_value(sale.discount_amount),
        "tax_amount": money_value(sale.tax_amount),
        "total_amount": money_value(sale.total_amount),
        "sold_at": sale.sold_at.isoformat() if sale.sold_at is not None else None,
        "idempotency_key": (
            str(sale.idempotency_key) if sale.idempotency_key is not None else None
        ),
    }
    if include_items:
        items = (
            SaleItem.query.filter_by(sale_id=sale.id).order_by(SaleItem.id).all()
        )
        payload["items"] = [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product": item.product.name if item.product is not None else None,
                "sku": item.product.sku if item.product is not None else None,
                "quantity": item.quantity,
                "unit_price": money_value(item.unit_price),
                "unit_cost": money_value(item.unit_cost),
                "line_total": money_value(item.line_total),
            }
            for item in items
        ]
    return payload


@api.get("/sales")
@require_roles(*STOCK_ROLES)
def list_sales(user):
    params, error = parse_collection_args(
        allowed_sorts={"sold_at", "id", "sale_number"},
        default_sort="sold_at",
        allowed_filters={"status"},
    )
    if error:
        return error

    query = Sale.query
    if "status" in params["filters"]:
        query = query.filter_by(status=params["filters"]["status"])

    result = paginate_query(
        query,
        Sale,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {
            "sold_at": Sale.sold_at,
            "id": Sale.id,
            "sale_number": Sale.sale_number,
        },
    )
    return {
        "items": [serialize_sale(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/sales")
@require_roles(*STOCK_ROLES)
def create_sale_route(user):
    payload, error = json_object(
        {
            "sale_number",
            "items",
            "discount_amount",
            "tax_rate",
            "idempotency_key",
        }
    )
    if error:
        return error

    items = payload["items"]
    if not isinstance(items, list) or not items:
        return {"error": "items must contain at least one product"}, 400
    prepared = []
    for item in items:
        if not isinstance(item, dict) or set(item) != {"product_id", "quantity"}:
            return {
                "error": "each item must contain product_id and quantity only"
            }, 400
        prepared.append((item["product_id"], item["quantity"]))

    idempotency_key = payload["idempotency_key"]
    if idempotency_key is not None:
        if not isinstance(idempotency_key, str):
            return {"error": "idempotency_key must be a UUID string or null"}, 400
        try:
            idempotency_key = UUID(idempotency_key)
        except ValueError:
            return {"error": "idempotency_key must be a UUID string or null"}, 400

    try:
        sale = create_sale(
            sale_number=payload["sale_number"],
            user_id=user.id,
            items=prepared,
            discount_amount=Decimal(str(payload["discount_amount"])),
            tax_rate=Decimal(str(payload["tax_rate"])),
            idempotency_key=idempotency_key,
        )
        db.session.commit()
    except InventoryOperationError as exc:
        db.session.rollback()
        return inventory_error_response(exc)
    except (InvalidOperation, TypeError, ValueError):
        db.session.rollback()
        return {"error": "discount_amount and tax_rate must be valid numbers"}, 400
    except IntegrityError:
        db.session.rollback()
        return {"error": "sale_number or idempotency_key already exists"}, 409

    return serialize_sale(sale, include_items=True), 201


@api.get("/sales/<int:sale_id>")
@require_roles(*STOCK_ROLES)
def get_sale(user, sale_id):
    sale = db.session.get(Sale, sale_id)
    if sale is None:
        return {"error": "Sale not found"}, 404
    return serialize_sale(sale, include_items=True), 200
