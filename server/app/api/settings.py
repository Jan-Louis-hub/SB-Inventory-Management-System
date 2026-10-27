import re

from flask import request
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.auth import authenticated_user_from_request
from app.extensions import db
from app.models import BusinessSettings
from app.api.validation import integer_value


DEFAULTS = {
    "name": "",
    "address": "",
    "phone": "",
    "email": "",
    "currency": "South African Rand (ZAR)",
    "default_min": 0,
    "low_stock_alerts": True,
    "order_alerts": True,
    "weekly_summary": False,
}
TEXT_LIMITS = {
    "name": 160,
    "address": 10000,
    "phone": 40,
    "email": 255,
    "currency": 80,
}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _error(message, status=400):
    return {"error": message}, status


def _manager():
    user = authenticated_user_from_request()
    if user is None:
        return None, _error("Authentication required", 401)
    if user.role not in {"admin", "manager"}:
        return None, _error("Manager access required", 403)
    return user, None


def _serialize(settings):
    if settings is None:
        return dict(DEFAULTS)
    return {
        field: getattr(settings, field)
        for field in DEFAULTS
    }


@api.get("/settings")
def get_settings():
    _, error = _manager()
    if error:
        return error
    settings = db.session.get(BusinessSettings, 1)
    return {"settings": _serialize(settings)}, 200


@api.patch("/settings")
def update_settings():
    _, error = _manager()
    if error:
        return error
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not payload:
        return _error("A non-empty JSON settings object is required")
    unknown = set(payload) - set(DEFAULTS)
    if unknown:
        return _error("Unknown settings: " + ", ".join(sorted(unknown)))

    values = {}
    for field, max_length in TEXT_LIMITS.items():
        if field not in payload:
            continue
        value = payload[field]
        if not isinstance(value, str) or len(value.strip()) > max_length:
            return _error(f"{field} must be a string of at most {max_length} characters")
        value = value.strip()
        if field == "name" and not value:
            return _error("Business name cannot be empty")
        if field == "currency" and not value:
            return _error("currency cannot be empty")
        if field == "email" and value and not EMAIL_PATTERN.fullmatch(value):
            return _error("email must be a valid email address")
        values[field] = value

    if "default_min" in payload:
        try:
            values["default_min"] = integer_value(
                payload["default_min"], "default_min", 0
            )
        except ValueError as error:
            return _error(str(error))

    for field in ("low_stock_alerts", "order_alerts", "weekly_summary"):
        if field in payload:
            if not isinstance(payload[field], bool):
                return _error(f"{field} must be a boolean")
            values[field] = payload[field]

    settings = db.session.get(BusinessSettings, 1)
    if settings is None:
        settings = BusinessSettings(id=1, **DEFAULTS)
        db.session.add(settings)
    for field, value in values.items():
        setattr(settings, field, value)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("Settings changed concurrently; reload and try again", 409)
    return {"settings": _serialize(settings)}, 200
