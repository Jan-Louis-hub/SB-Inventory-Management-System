from flask import Blueprint

api = Blueprint("api", __name__)

from app.api import auth


@api.get("/health")
def health():
    return {"status": "ok"}, 200
