from decimal import Decimal, InvalidOperation

from flask import request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.api.validation import integer_value
from app.extensions import db
from app.models import Category, Product, StockMovement, Supplier


PRODUCT_FIELDS = {
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
EDITABLE_FIELDS = PRODUCT_FIELDS - {"quantity"}
SORT_FIELDS = {
    "sku": Product.sku,
    "name": Product.name,
    "quantity": Product.quantity,
    "cost_price": Product.cost_price,
    "selling_price": Product.selling_price,
    "reorder_level": Product.reorder_level,
    "location": Product.location,
    "created_at": Product.created_at,
    "updated_at": Product.updated_at,
}


def _error(message, status=400):
    return {"error": message}, status


def _json_object():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None
    return payload


def _money(value, field):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError(f"{field} must be a valid non-negative amount") from error
    if not amount.is_finite() or amount < 0:
        raise ValueError(f"{field} must be a valid non-negative amount")
    try:
        normalized = amount.quantize(Decimal("0.01"))
    except InvalidOperation as error:
        raise ValueError(f"{field} is outside the supported range") from error
    if normalized != amount or normalized > Decimal("9999999999.99"):
        raise ValueError(f"{field} must have at most 2 decimal places and fit the supported range")
    return normalized


def serialize_product(product):
    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "category_id": product.category_id,
        "supplier_id": product.supplier_id,
        "category": (
            {"id": product.category.id, "name": product.category.name}
            if product.category
            else None
        ),
        "cost_price": format(product.cost_price, ".2f"),
        "selling_price": format(product.selling_price, ".2f"),
        "quantity": product.quantity,
        "location": product.location,
        "unit": product.unit,
        "reorder_level": product.reorder_level,
        "is_active": product.is_active,
        "created_at": product.created_at.isoformat(),
        "updated_at": product.updated_at.isoformat(),
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


def _authorized_user():
    user = authenticated_user_from_request()
    if user is None:
        return None, _error("Authentication required", 401)
    return user, None


@api.get("/products")
def list_products():
    pagination, error = _pagination()
    if error:
        return _error(error)
    page, per_page = pagination # type: ignore

    statement = select(Product).options(selectinload(Product.category)) # type: ignore
    search = request.args.get("search", request.args.get("q", "")).strip()
    if search:
        pattern = f"%{search}%"
        statement = statement.where(
            or_(Product.name.ilike(pattern), Product.sku.ilike(pattern))
        )

    category_id = request.args.get("category_id")
    if category_id is not None:
        try:
            statement = statement.where(
                Product.category_id == integer_value(category_id, "category_id", 1)
            )
        except ValueError as error:
            return _error(str(error))

    active = request.args.get("is_active")
    if active is not None:
        if active.lower() not in {"true", "false"}:
            return _error("is_active must be true or false")
        statement = statement.where(Product.is_active.is_(active.lower() == "true"))

    low_stock = request.args.get("low_stock")
    if low_stock is not None:
        if low_stock.lower() not in {"true", "false"}:
            return _error("low_stock must be true or false")
        if low_stock.lower() == "true":
            statement = statement.where(Product.quantity <= Product.reorder_level)
        else:
            statement = statement.where(Product.quantity > Product.reorder_level)

    sort_by = request.args.get("sort_by", "name")
    sort_column = SORT_FIELDS.get(sort_by)
    if sort_column is None:
        return _error(f"sort_by must be one of: {', '.join(SORT_FIELDS)}")
    order = request.args.get("order", "asc").lower()
    if order not in {"asc", "desc"}:
        return _error("order must be asc or desc")
    statement = statement.order_by(
        sort_column.desc() if order == "desc" else sort_column.asc(),
        Product.id.asc(),
    )

    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = db.session.scalar(count_statement)
    products = db.session.scalars(
        statement.offset((page - 1) * per_page).limit(per_page)
    ).all()
    return {
        "products": [serialize_product(product) for product in products],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page, # type: ignore
        },
    }, 200


@api.post("/products")
def create_product():
    user, error = _authorized_user()
    if error:
        return error
    payload = _json_object()
    if payload is None:
        return _error("A JSON object is required")
    unknown = set(payload) - PRODUCT_FIELDS
    missing = {"sku", "name", "cost_price", "selling_price"} - set(payload)
    if unknown:
        return _error("Unknown product fields: " + ", ".join(sorted(unknown)))
    if missing:
        return _error("Required fields are missing: " + ", ".join(sorted(missing)))

    values = {}
    for field, max_length in (("sku", 64), ("name", 160)):
        value = payload[field]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > max_length:
            return _error(f"{field} must contain 1 to {max_length} characters")
        values[field] = value.strip()
    description = payload.get("description")
    if description is not None and not isinstance(description, str):
        return _error("description must be a string or null")
    if description is not None and len(description) > 10000:
        return _error("description cannot exceed 10000 characters")
    values["description"] = description
    try:
        values["cost_price"] = _money(payload["cost_price"], "cost_price")
        values["selling_price"] = _money(payload["selling_price"], "selling_price")
        values["quantity"] = integer_value(payload.get("quantity", 0), "quantity")
        values["reorder_level"] = integer_value(
            payload.get("reorder_level", 0), "reorder_level"
        )
    except ValueError as error:
        return _error(str(error))

    category_id = payload.get("category_id")
    if category_id is not None:
        try:
            category_id = integer_value(category_id, "category_id", 1)
        except ValueError as error:
            return _error(str(error))
        if db.session.get(Category, category_id) is None:
            return _error("category_id does not reference an existing category")
    values["category_id"] = category_id
    supplier_id = payload.get("supplier_id")
    if supplier_id is not None:
        try:
            supplier_id = integer_value(supplier_id, "supplier_id", 1)
        except ValueError as error:
            return _error(str(error))
        if db.session.get(Supplier, supplier_id) is None:
            return _error("supplier_id does not reference an existing supplier")
    values["supplier_id"] = supplier_id
    for field, max_length in (("location", 80), ("unit", 40)):
        value = payload.get(field, "units" if field == "unit" else None)
        if (field == "unit" and value is None) or (
            value is not None and (
            not isinstance(value, str) or not value.strip() or len(value.strip()) > max_length
            )
        ):
            nullable = " or null" if field == "location" else ""
            return _error(f"{field} must contain 1 to {max_length} characters{nullable}")
        values[field] = value.strip() if isinstance(value, str) else value
    is_active = payload.get("is_active", True)
    if not isinstance(is_active, bool):
        return _error("is_active must be a boolean")
    values["is_active"] = is_active

    product = Product(**values)
    db.session.add(product)
    try:
        db.session.flush()
        if product.quantity:
            db.session.add(
                StockMovement(
                    product_id=product.id, # type: ignore
                    user_id=user.id, # type: ignore
                    movement_type="receipt", # type: ignore
                    quantity_change=product.quantity, # type: ignore
                    reason="Initial stock", # type: ignore
                )
            )
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("A product with this SKU already exists", 409)
    return {"product": serialize_product(product)}, 201


@api.get("/products/<int:product_id>")
def get_product(product_id):
    product = db.session.scalar(
        select(Product)
        .options(selectinload(Product.category)) # type: ignore
        .where(Product.id == product_id)
    )
    if product is None:
        return _error("Product not found", 404)
    return {"product": serialize_product(product)}, 200


@api.route("/products/<int:product_id>", methods=["PUT", "PATCH"])
def update_product(product_id):
    _, error = _authorized_user()
    if error:
        return error
    payload = _json_object()
    if payload is None:
        return _error("A JSON object is required")
    unknown = set(payload) - EDITABLE_FIELDS
    if unknown:
        return _error("Unknown or non-editable product fields: " + ", ".join(sorted(unknown)))
    if not payload:
        return _error("At least one editable field is required")

    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Product not found", 404)
    if "sku" in payload:
        value = payload["sku"]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 64:
            return _error("sku must contain 1 to 64 characters")
        product.sku = value.strip()
    if "name" in payload:
        value = payload["name"]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 160:
            return _error("name must contain 1 to 160 characters")
        product.name = value.strip()
    if "description" in payload:
        value = payload["description"]
        if value is not None and (not isinstance(value, str) or len(value) > 10000):
            return _error("description must be a string of at most 10000 characters or null")
        product.description = value
    if "category_id" in payload:
        category_id = payload["category_id"]
        if category_id is not None:
            try:
                category_id = integer_value(category_id, "category_id", 1)
            except ValueError as error:
                return _error(str(error))
            if db.session.get(Category, category_id) is None:
                return _error("category_id does not reference an existing category")
        product.category_id = category_id
    if "supplier_id" in payload:
        supplier_id = payload["supplier_id"]
        if supplier_id is not None:
            try:
                supplier_id = integer_value(supplier_id, "supplier_id", 1)
            except ValueError as error:
                return _error(str(error))
            if db.session.get(Supplier, supplier_id) is None:
                return _error("supplier_id does not reference an existing supplier")
        product.supplier_id = supplier_id
    for field, max_length in (("location", 80), ("unit", 40)):
        if field in payload:
            value = payload[field]
            if (field == "unit" and value is None) or (
                value is not None and (
                not isinstance(value, str)
                or not value.strip()
                or len(value.strip()) > max_length
                )
            ):
                nullable = " or null" if field == "location" else ""
                return _error(f"{field} must contain 1 to {max_length} characters{nullable}")
            setattr(product, field, value.strip() if isinstance(value, str) else value)
    for field in ("cost_price", "selling_price"):
        if field in payload:
            try:
                setattr(product, field, _money(payload[field], field))
            except ValueError as error:
                return _error(str(error))
    if "reorder_level" in payload:
        try:
            product.reorder_level = integer_value(
                payload["reorder_level"], "reorder_level"
            )
        except ValueError as error:
            return _error(str(error))
    if "is_active" in payload:
        if not isinstance(payload["is_active"], bool):
            return _error("is_active must be a boolean")
        product.is_active = payload["is_active"]

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("A product with this SKU already exists", 409)
    return {"product": serialize_product(product)}, 200


@api.post("/products/<int:product_id>/archive")
def archive_product(product_id):
    _, error = _authorized_user()
    if error:
        return error
    product = db.session.get(Product, product_id)
    if product is None:
        return _error("Product not found", 404)
    product.is_active = False
    db.session.commit()
    return {"product": serialize_product(product)}, 200
