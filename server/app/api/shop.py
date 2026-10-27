import re

from app.api import api
from app.api.helpers import MANAGER_ROLES, json_object_subset, require_auth, require_roles
from app.extensions import db
from app.models import ShopSettings

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def serialize_shop(settings):
    return {
        "name": settings.name,
        "address": settings.address,
        "phone": settings.phone,
        "email": settings.email,
        "currency": settings.currency,
        "default_reorder_level": settings.default_reorder_level,
        "low_stock_alerts": settings.low_stock_alerts,
        "order_emails": settings.order_emails,
        "weekly_summary": settings.weekly_summary,
    }


def _get_or_create_settings():
    settings = db.session.get(ShopSettings, 1)
    if settings is None:
        settings = ShopSettings(id=1)
        db.session.add(settings)
        db.session.commit()
    return settings


@api.get("/shop-settings")
@require_auth
def get_shop_settings(user):
    return serialize_shop(_get_or_create_settings()), 200


@api.patch("/shop-settings")
@require_roles(*MANAGER_ROLES)
def update_shop_settings(user):
    settings = _get_or_create_settings()
    payload, error = json_object_subset(
        {
            "name",
            "address",
            "phone",
            "email",
            "currency",
            "default_reorder_level",
            "low_stock_alerts",
            "order_emails",
            "weekly_summary",
        }
    )
    if error:
        return error

    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or len(name.strip()) > 160:
            return {"error": "name must be a string of at most 160 characters"}, 400
        settings.name = name.strip()
    if "address" in payload:
        address = payload["address"]
        if address is not None and (
            not isinstance(address, str) or len(address) > 2000
        ):
            return {"error": "address must be a string of at most 2000 characters"}, 400
        settings.address = address.strip() if isinstance(address, str) else None
    if "phone" in payload:
        phone = payload["phone"]
        if phone is not None and (
            not isinstance(phone, str) or len(phone.strip()) > 40
        ):
            return {"error": "phone must be a string of at most 40 characters"}, 400
        settings.phone = phone.strip() if isinstance(phone, str) and phone.strip() else None
    if "email" in payload:
        email = payload["email"]
        if email is not None:
            if not isinstance(email, str) or len(email.strip()) > 255:
                return {"error": "email must be a valid email address"}, 400
            if email.strip() and not EMAIL_PATTERN.fullmatch(email.strip()):
                return {"error": "email must be a valid email address"}, 400
            email = email.strip().lower() or None
        settings.email = email
    if "currency" in payload:
        currency = payload["currency"]
        if (
            not isinstance(currency, str)
            or not currency.strip()
            or len(currency.strip()) > 80
        ):
            return {"error": "currency must contain 1 to 80 characters"}, 400
        settings.currency = currency.strip()
    if "default_reorder_level" in payload:
        value = payload["default_reorder_level"]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            return {"error": "default_reorder_level must be a non-negative integer"}, 400
        settings.default_reorder_level = value
    if "low_stock_alerts" in payload:
        if not isinstance(payload["low_stock_alerts"], bool):
            return {"error": "low_stock_alerts must be a boolean"}, 400
        settings.low_stock_alerts = payload["low_stock_alerts"]
    if "order_emails" in payload:
        if not isinstance(payload["order_emails"], bool):
            return {"error": "order_emails must be a boolean"}, 400
        settings.order_emails = payload["order_emails"]
    if "weekly_summary" in payload:
        if not isinstance(payload["weekly_summary"], bool):
            return {"error": "weekly_summary must be a boolean"}, 400
        settings.weekly_summary = payload["weekly_summary"]

    db.session.commit()
    return serialize_shop(settings), 200
