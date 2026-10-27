from flask import Blueprint

api = Blueprint("api", __name__)

from app.api import (
    auth,
    categories,
    products,
    stock_counts,
    stock_movements,
    stock_requests,
)


@api.get("/health")
def health():
    return {"status": "ok"}, 200
