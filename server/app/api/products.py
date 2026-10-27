from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    STOCK_ROLES,
    inventory_error_response,
    json_object,
    json_object_subset,
    money_value,
    paginate_query,
    parse_collection_args,
    require_auth,
    require_roles,
)
from app.extensions import db
from app.models import Category, Product, Supplier
from app.services.inventory import InventoryOperationError, adjust_product_stock


def _can_see_cost(user):
    return user.role in MANAGER_ROLES


def serialize_product(product, user):
    payload = {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "category_id": product.category_id,
        "category": product.category.name if product.category is not None else None,
        "supplier_id": product.supplier_id,
        "supplier": product.supplier.name if product.supplier is not None else None,
        "location": product.location,
        "unit": product.unit,
        "selling_price": money_value(product.selling_price),
        "quantity": product.quantity,
        "reorder_level": product.reorder_level,
        "is_active": product.is_active,
    }
    if _can_see_cost(user):
        payload["cost_price"] = money_value(product.cost_price)
    return payload


def _parse_money(value, field):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, f"{field} must be a valid amount"
    if not amount.is_finite() or amount < 0:
        return None, f"{field} must be non-negative"
    return amount.quantize(Decimal("0.01")), None


@api.get("/products")
@require_auth
def list_products(user):
    params, error = parse_collection_args(
        allowed_sorts={"name", "sku", "quantity", "id"},
        default_sort="name",
        allowed_filters={"category_id", "location", "supplier_id", "is_active", "q"},
    )
    if error:
        return error

    query = Product.query
    filters = params["filters"]
    if "category_id" in filters:
        try:
            category_id = int(filters["category_id"])
        except (TypeError, ValueError):
            return {"error": "category_id must be an integer"}, 400
        query = query.filter_by(category_id=category_id)
    if "supplier_id" in filters:
        try:
            supplier_id = int(filters["supplier_id"])
        except (TypeError, ValueError):
            return {"error": "supplier_id must be an integer"}, 400
        query = query.filter_by(supplier_id=supplier_id)
    if "location" in filters:
        query = query.filter(Product.location == filters["location"])
    if "is_active" in filters:
        if filters["is_active"] not in {"true", "false"}:
            return {"error": "is_active must be true or false"}, 400
        query = query.filter_by(is_active=filters["is_active"] == "true")
    if "q" in filters:
        term = filters["q"].strip()
        if term:
            pattern = f"%{term}%"
            query = query.filter(
                (Product.name.ilike(pattern)) | (Product.sku.ilike(pattern))
            )

    result = paginate_query(
        query,
        Product,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {
            "name": Product.name,
            "sku": Product.sku,
            "quantity": Product.quantity,
            "id": Product.id,
        },
    )
    return {
        "items": [serialize_product(item, user) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/products")
@require_roles(*MANAGER_ROLES)
def create_product(user):
    payload, error = json_object(
        {
            "sku",
            "name",
            "description",
            "category_id",
            "supplier_id",
            "location",
            "unit",
            "cost_price",
            "selling_price",
            "quantity",
            "reorder_level",
            "is_active",
        }
    )
    if error:
        return error

    sku = payload["sku"]
    name = payload["name"]
    if not isinstance(sku, str) or not sku.strip() or len(sku.strip()) > 64:
        return {"error": "sku must contain 1 to 64 characters"}, 400
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 160:
        return {"error": "name must contain 1 to 160 characters"}, 400

    description = payload["description"]
    if description is not None and (
        not isinstance(description, str) or len(description) > 2000
    ):
        return {"error": "description must be a string of at most 2000 characters"}, 400

    category_id = payload["category_id"]
    if category_id is not None:
        if isinstance(category_id, bool) or not isinstance(category_id, int):
            return {"error": "category_id must be an integer or null"}, 400
        if db.session.get(Category, category_id) is None:
            return {"error": "category_id was not found"}, 400

    supplier_id = payload["supplier_id"]
    if supplier_id is not None:
        if isinstance(supplier_id, bool) or not isinstance(supplier_id, int):
            return {"error": "supplier_id must be an integer or null"}, 400
        if db.session.get(Supplier, supplier_id) is None:
            return {"error": "supplier_id was not found"}, 400

    location = payload["location"]
    if location is not None:
        if not isinstance(location, str) or len(location.strip()) > 80:
            return {"error": "location must be a string of at most 80 characters"}, 400
        location = location.strip() or None

    unit = payload["unit"]
    if not isinstance(unit, str) or not unit.strip() or len(unit.strip()) > 40:
        return {"error": "unit must contain 1 to 40 characters"}, 400

    cost_price, cost_error = _parse_money(payload["cost_price"], "cost_price")
    if cost_error:
        return {"error": cost_error}, 400
    selling_price, selling_error = _parse_money(
        payload["selling_price"], "selling_price"
    )
    if selling_error:
        return {"error": selling_error}, 400

    quantity = payload["quantity"]
    reorder_level = payload["reorder_level"]
    is_active = payload["is_active"]
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 0:
        return {"error": "quantity must be a non-negative integer"}, 400
    if (
        isinstance(reorder_level, bool)
        or not isinstance(reorder_level, int)
        or reorder_level < 0
    ):
        return {"error": "reorder_level must be a non-negative integer"}, 400
    if not isinstance(is_active, bool):
        return {"error": "is_active must be a boolean"}, 400

    normalized_sku = sku.strip()
    existing = db.session.scalar(
        select(Product.id).where(func.lower(Product.sku) == normalized_sku.lower())
    )
    if existing is not None:
        return {"error": "SKU already exists"}, 409

    product = Product(
        sku=normalized_sku,
        name=name.strip(),
        description=description.strip() if isinstance(description, str) else None,
        category_id=category_id,
        supplier_id=supplier_id,
        location=location,
        unit=unit.strip(),
        cost_price=cost_price,
        selling_price=selling_price,
        quantity=quantity,
        reorder_level=reorder_level,
        is_active=is_active,
    )
    db.session.add(product)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "SKU already exists"}, 409
    return serialize_product(product, user), 201


@api.get("/products/<int:product_id>")
@require_auth
def get_product(user, product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return {"error": "Product not found"}, 404
    return serialize_product(product, user), 200


@api.patch("/products/<int:product_id>")
@require_roles(*MANAGER_ROLES)
def update_product(user, product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return {"error": "Product not found"}, 404

    payload, error = json_object_subset(
        {
            "sku",
            "name",
            "description",
            "category_id",
            "supplier_id",
            "location",
            "unit",
            "cost_price",
            "selling_price",
            "reorder_level",
            "is_active",
        }
    )
    if error:
        return error

    if "sku" in payload:
        sku = payload["sku"]
        if not isinstance(sku, str) or not sku.strip() or len(sku.strip()) > 64:
            return {"error": "sku must contain 1 to 64 characters"}, 400
        normalized_sku = sku.strip()
        existing = db.session.scalar(
            select(Product.id).where(
                func.lower(Product.sku) == normalized_sku.lower(),
                Product.id != product_id,
            )
        )
        if existing is not None:
            return {"error": "SKU already exists"}, 409
        product.sku = normalized_sku
    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 160:
            return {"error": "name must contain 1 to 160 characters"}, 400
        product.name = name.strip()
    if "description" in payload:
        description = payload["description"]
        if description is not None and (
            not isinstance(description, str) or len(description) > 2000
        ):
            return {
                "error": "description must be a string of at most 2000 characters"
            }, 400
        product.description = (
            description.strip() if isinstance(description, str) else None
        )
    if "category_id" in payload:
        category_id = payload["category_id"]
        if category_id is not None:
            if isinstance(category_id, bool) or not isinstance(category_id, int):
                return {"error": "category_id must be an integer or null"}, 400
            if db.session.get(Category, category_id) is None:
                return {"error": "category_id was not found"}, 400
        product.category_id = category_id
    if "supplier_id" in payload:
        supplier_id = payload["supplier_id"]
        if supplier_id is not None:
            if isinstance(supplier_id, bool) or not isinstance(supplier_id, int):
                return {"error": "supplier_id must be an integer or null"}, 400
            if db.session.get(Supplier, supplier_id) is None:
                return {"error": "supplier_id was not found"}, 400
        product.supplier_id = supplier_id
    if "location" in payload:
        location = payload["location"]
        if location is not None:
            if not isinstance(location, str) or len(location.strip()) > 80:
                return {
                    "error": "location must be a string of at most 80 characters"
                }, 400
            location = location.strip() or None
        product.location = location
    if "unit" in payload:
        unit = payload["unit"]
        if not isinstance(unit, str) or not unit.strip() or len(unit.strip()) > 40:
            return {"error": "unit must contain 1 to 40 characters"}, 400
        product.unit = unit.strip()
    if "cost_price" in payload:
        cost_price, cost_error = _parse_money(payload["cost_price"], "cost_price")
        if cost_error:
            return {"error": cost_error}, 400
        product.cost_price = cost_price
    if "selling_price" in payload:
        selling_price, selling_error = _parse_money(
            payload["selling_price"], "selling_price"
        )
        if selling_error:
            return {"error": selling_error}, 400
        product.selling_price = selling_price
    if "reorder_level" in payload:
        reorder_level = payload["reorder_level"]
        if (
            isinstance(reorder_level, bool)
            or not isinstance(reorder_level, int)
            or reorder_level < 0
        ):
            return {"error": "reorder_level must be a non-negative integer"}, 400
        product.reorder_level = reorder_level
    if "is_active" in payload:
        if not isinstance(payload["is_active"], bool):
            return {"error": "is_active must be a boolean"}, 400
        product.is_active = payload["is_active"]

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "SKU already exists"}, 409
    return serialize_product(product, user), 200


@api.post("/products/<int:product_id>/adjustments")
@require_roles(*STOCK_ROLES)
def adjust_stock(user, product_id):
    payload, error = json_object({"quantity_change", "reason"})
    if error:
        return error

    try:
        product, movement = adjust_product_stock(
            product_id=product_id,
            quantity_change=payload["quantity_change"],
            user_id=user.id,
            reason=payload["reason"],
        )
        db.session.commit()
    except InventoryOperationError as exc:
        db.session.rollback()
        return inventory_error_response(exc)

    return {
        "product": serialize_product(product, user),
        "movement": {
            "id": movement.id,
            "product_id": movement.product_id,
            "movement_type": movement.movement_type,
            "quantity_change": movement.quantity_change,
            "reason": movement.reason,
            "created_at": movement.created_at.isoformat(),
        },
    }, 200
