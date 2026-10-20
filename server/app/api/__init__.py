from flask import Blueprint

api = Blueprint("api", __name__)


@api.get("/health")
def health():
    return {"status": "ok"}, 200
