from flask import Blueprint

api = Blueprint("api", __name__)

from app.api import (  # noqa: E402,F401
    auth,
    categories,
    deliveries,
    products,
    purchase_orders,
    sales,
    shop,
    stock_counts,
    stock_movements,
    stock_requests,
    suppliers,
    users,
)


@api.get("/health")
def health():
    return {"status": "ok"}, 200
