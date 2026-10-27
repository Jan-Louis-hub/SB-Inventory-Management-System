from flask import request
from sqlalchemy import func, select

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.api.validation import integer_value
from app.extensions import db
from app.models import Supplier


FIELDS = {
    "name",
    "contact_person",
    "email",
    "phone",
    "address",
    "city",
    "lead_days",
    "categories",
}


def _error(message, status=400):
    return {"error": message}, status


def _serialize(supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "contact_person": supplier.contact_person,
        "email": supplier.email,
        "phone": supplier.phone,
        "address": supplier.address,
        "city": supplier.city,
        "lead_days": supplier.lead_days,
        "categories": supplier.categories,
        "created_at": supplier.created_at.isoformat(),
        "updated_at": supplier.updated_at.isoformat(),
    }


def _authorized():
    if authenticated_user_from_request() is None:
        return _error("Authentication required", 401)
    return None


def _payload():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None
    unknown = set(payload) - FIELDS
    if unknown:
        return None
    return payload


def _validate(payload, partial=False):
    if not payload or (not partial and not payload.get("name")):
        return "name is required"
    if "name" in payload and (
        not isinstance(payload["name"], str)
        or not payload["name"].strip()
        or len(payload["name"].strip()) > 160
    ):
        return "name must contain 1 to 160 characters"
    limits = {
        "contact_person": 120,
        "email": 255,
        "phone": 40,
        "city": 80,
        "categories": 255,
    }
    for field, max_length in limits.items():
        value = payload.get(field)
        if value is not None and (
            not isinstance(value, str) or len(value) > max_length
        ):
            return f"{field} must be a string of at most {max_length} characters or null"
    if payload.get("address") is not None and not isinstance(payload["address"], str):
        return "address must be a string or null"
    if "lead_days" in payload:
        try:
            integer_value(payload["lead_days"], "lead_days")
        except ValueError as error:
            return str(error)
    return None


@api.get("/suppliers")
def list_suppliers():
    suppliers = db.session.scalars(
        select(Supplier).order_by(func.lower(Supplier.name), Supplier.id)
    ).all()
    return {"suppliers": [_serialize(supplier) for supplier in suppliers]}, 200


@api.post("/suppliers")
def create_supplier():
    error = _authorized()
    if error:
        return error
    payload = _payload()
    if payload is None:
        return _error("A JSON object with supported supplier fields is required")
    validation_error = _validate(payload)
    if validation_error:
        return _error(validation_error)
    supplier = Supplier(
        **{
            field: value.strip() if isinstance(value, str) else value
            for field, value in payload.items()
        }
    )
    db.session.add(supplier)
    db.session.commit()
    return {"supplier": _serialize(supplier)}, 201


@api.patch("/suppliers/<int:supplier_id>")
def update_supplier(supplier_id):
    error = _authorized()
    if error:
        return error
    payload = _payload()
    if payload is None:
        return _error("A JSON object with supported supplier fields is required")
    validation_error = _validate(payload, partial=True)
    if validation_error:
        return _error(validation_error)
    supplier = db.session.get(Supplier, supplier_id)
    if supplier is None:
        return _error("Supplier not found", 404)
    for field, value in payload.items():
        setattr(supplier, field, value.strip() if isinstance(value, str) else value)
    db.session.commit()
    return {"supplier": _serialize(supplier)}, 200