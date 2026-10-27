from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.helpers import (
    STOCK_ROLES,
    json_object,
    paginate_query,
    parse_collection_args,
    require_roles,
)
from app.extensions import db
from app.models import Product, StockCount, StockCountLine, User


def serialize_count(count, include_lines=False):
    payload = {
        "id": count.id,
        "count_number": count.count_number,
        "area": count.area,
        "location": count.location,
        "due_label": count.due_label,
        "status": count.status,
        "owner_user_id": count.owner_user_id,
        "owner": count.owner.name if count.owner is not None else None,
        "created_by_user_id": count.created_by_user_id,
        "created_at": count.created_at.isoformat() if count.created_at else None,
        "completed_at": (
            count.completed_at.isoformat() if count.completed_at is not None else None
        ),
    }
    if include_lines:
        lines = (
            StockCountLine.query.filter_by(stock_count_id=count.id)
            .order_by(StockCountLine.id)
            .all()
        )
        payload["lines"] = [
            {
                "id": line.id,
                "product_id": line.product_id,
                "sku": line.product.sku if line.product is not None else None,
                "name": line.product.name if line.product is not None else None,
                "category": (
                    line.product.category.name
                    if line.product is not None and line.product.category is not None
                    else None
                ),
                "expected_quantity": line.expected_quantity,
                "counted_quantity": line.counted_quantity,
            }
            for line in lines
        ]
    return payload


@api.get("/stock-counts")
@require_roles(*STOCK_ROLES)
def list_stock_counts(user):
    params, error = parse_collection_args(
        allowed_sorts={"id", "status", "created_at"},
        default_sort="id",
        allowed_filters={"status"},
    )
    if error:
        return error

    query = StockCount.query
    if "status" in params["filters"]:
        query = query.filter_by(status=params["filters"]["status"])

    result = paginate_query(
        query,
        StockCount,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {
            "id": StockCount.id,
            "status": StockCount.status,
            "created_at": StockCount.created_at,
        },
    )
    return {
        "items": [serialize_count(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/stock-counts")
@require_roles(*STOCK_ROLES)
def create_stock_count(user):
    payload, error = json_object(
        {"count_number", "area", "location", "due_label", "owner_user_id"}
    )
    if error:
        return error

    count_number = payload["count_number"]
    area = payload["area"]
    location = payload["location"]
    due_label = payload["due_label"]
    owner_user_id = payload["owner_user_id"]

    if (
        not isinstance(count_number, str)
        or not count_number.strip()
        or len(count_number.strip()) > 40
    ):
        return {"error": "count_number must contain 1 to 40 characters"}, 400
    if not isinstance(area, str) or not area.strip() or len(area.strip()) > 80:
        return {"error": "area must contain 1 to 80 characters"}, 400
    if (
        not isinstance(location, str)
        or not location.strip()
        or len(location.strip()) > 80
    ):
        return {"error": "location must contain 1 to 80 characters"}, 400
    if (
        not isinstance(due_label, str)
        or not due_label.strip()
        or len(due_label.strip()) > 40
    ):
        return {"error": "due_label must contain 1 to 40 characters"}, 400
    if (
        isinstance(owner_user_id, bool)
        or not isinstance(owner_user_id, int)
        or owner_user_id <= 0
    ):
        return {"error": "owner_user_id must be a positive integer"}, 400

    owner = db.session.get(User, owner_user_id)
    if owner is None or not owner.is_active:
        return {"error": "owner_user_id was not found"}, 400

    products = (
        Product.query.filter_by(location=location.strip(), is_active=True)
        .order_by(Product.name)
        .all()
    )

    count = StockCount(
        count_number=count_number.strip(),
        area=area.strip(),
        location=location.strip(),
        due_label=due_label.strip(),
        status="scheduled",
        owner_user_id=owner_user_id,
        created_by_user_id=user.id,
    )
    db.session.add(count)
    try:
        db.session.flush()
        for product in products:
            db.session.add(
                StockCountLine(
                    stock_count_id=count.id,
                    product_id=product.id,
                    expected_quantity=product.quantity,
                    counted_quantity=None,
                )
            )
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "count_number already exists"}, 409

    return serialize_count(count, include_lines=True), 201


@api.get("/stock-counts/<int:count_id>")
@require_roles(*STOCK_ROLES)
def get_stock_count(user, count_id):
    count = db.session.get(StockCount, count_id)
    if count is None:
        return {"error": "Stock count not found"}, 404
    return serialize_count(count, include_lines=True), 200


@api.post("/stock-counts/<int:count_id>/start")
@require_roles(*STOCK_ROLES)
def start_stock_count(user, count_id):
    count = db.session.get(StockCount, count_id)
    if count is None:
        return {"error": "Stock count not found"}, 404
    if count.status != "scheduled":
        return {"error": "Only scheduled counts can be started"}, 409
    count.status = "in_progress"
    db.session.commit()
    return serialize_count(count, include_lines=True), 200


@api.patch("/stock-counts/<int:count_id>/lines/<int:line_id>")
@require_roles(*STOCK_ROLES)
def update_count_line(user, count_id, line_id):
    count = db.session.get(StockCount, count_id)
    if count is None:
        return {"error": "Stock count not found"}, 404
    if count.status not in {"scheduled", "in_progress"}:
        return {"error": "Completed counts cannot be edited"}, 409

    line = db.session.get(StockCountLine, line_id)
    if line is None or line.stock_count_id != count_id:
        return {"error": "Stock count line not found"}, 404

    payload, error = json_object({"counted_quantity"})
    if error:
        return error

    counted = payload["counted_quantity"]
    if counted is not None and (
        isinstance(counted, bool) or not isinstance(counted, int) or counted < 0
    ):
        return {"error": "counted_quantity must be a non-negative integer or null"}, 400

    if count.status == "scheduled":
        count.status = "in_progress"
    line.counted_quantity = counted
    db.session.commit()
    return serialize_count(count, include_lines=True), 200


@api.post("/stock-counts/<int:count_id>/complete")
@require_roles(*STOCK_ROLES)
def complete_stock_count(user, count_id):
    count = db.session.get(StockCount, count_id)
    if count is None:
        return {"error": "Stock count not found"}, 404
    if count.status not in {"scheduled", "in_progress"}:
        return {"error": "Count is already completed"}, 409

    open_line = (
        StockCountLine.query.filter_by(stock_count_id=count.id, counted_quantity=None)
        .limit(1)
        .first()
    )
    if open_line is not None:
        return {"error": "All lines must be counted before completing"}, 400

    count.status = "completed"
    count.completed_at = datetime.now(timezone.utc)
    db.session.commit()
    return serialize_count(count, include_lines=True), 200
