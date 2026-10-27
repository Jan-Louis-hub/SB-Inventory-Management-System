import re

from app.api import api
from app.api.helpers import (
    MANAGER_ROLES,
    json_object,
    json_object_subset,
    paginate_query,
    parse_collection_args,
    require_auth,
    require_roles,
)
from app.extensions import db
from app.models import Supplier

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def serialize_supplier(supplier):
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
    }


def _optional_string(value, field, maximum, allow_empty=True):
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, (f"{field} must be a string", 400)
    stripped = value.strip()
    if not allow_empty and not stripped:
        return None, (f"{field} must not be empty", 400)
    if len(stripped) > maximum:
        return None, (f"{field} must be at most {maximum} characters", 400)
    return (stripped or None), None


@api.get("/suppliers")
@require_auth
def list_suppliers(user):
    params, error = parse_collection_args(
        allowed_sorts={"name", "id", "lead_days"},
        default_sort="name",
    )
    if error:
        return error

    result = paginate_query(
        Supplier.query,
        Supplier,
        params["page"],
        params["per_page"],
        params["sort"],
        params["direction"],
        {
            "name": Supplier.name,
            "id": Supplier.id,
            "lead_days": Supplier.lead_days,
        },
    )
    return {
        "items": [serialize_supplier(item) for item in result["items"]],
        "pagination": result["pagination"],
    }, 200


@api.post("/suppliers")
@require_roles(*MANAGER_ROLES)
def create_supplier(user):
    payload, error = json_object(
        {
            "name",
            "contact_person",
            "email",
            "phone",
            "address",
            "city",
            "lead_days",
            "categories",
        }
    )
    if error:
        return error

    name, name_error = _optional_string(payload["name"], "name", 160, allow_empty=False)
    if name_error:
        return {"error": name_error[0]}, name_error[1]

    contact, contact_error = _optional_string(
        payload["contact_person"], "contact_person", 120
    )
    if contact_error:
        return {"error": contact_error[0]}, contact_error[1]

    email = payload["email"]
    if email is not None:
        if not isinstance(email, str) or len(email.strip()) > 255:
            return {"error": "email must be a valid email address"}, 400
        if email.strip() and not EMAIL_PATTERN.fullmatch(email.strip()):
            return {"error": "email must be a valid email address"}, 400
        email = email.strip().lower() or None

    phone, phone_error = _optional_string(payload["phone"], "phone", 40)
    if phone_error:
        return {"error": phone_error[0]}, phone_error[1]
    address, address_error = _optional_string(payload["address"], "address", 2000)
    if address_error:
        return {"error": address_error[0]}, address_error[1]
    city, city_error = _optional_string(payload["city"], "city", 80)
    if city_error:
        return {"error": city_error[0]}, city_error[1]
    categories, categories_error = _optional_string(
        payload["categories"], "categories", 255
    )
    if categories_error:
        return {"error": categories_error[0]}, categories_error[1]

    lead_days = payload["lead_days"]
    if isinstance(lead_days, bool) or not isinstance(lead_days, int) or lead_days < 0:
        return {"error": "lead_days must be a non-negative integer"}, 400

    supplier = Supplier(
        name=name,
        contact_person=contact,
        email=email,
        phone=phone,
        address=address,
        city=city,
        lead_days=lead_days,
        categories=categories,
    )
    db.session.add(supplier)
    db.session.commit()
    return serialize_supplier(supplier), 201


@api.get("/suppliers/<int:supplier_id>")
@require_auth
def get_supplier(user, supplier_id):
    supplier = db.session.get(Supplier, supplier_id)
    if supplier is None:
        return {"error": "Supplier not found"}, 404
    return serialize_supplier(supplier), 200


@api.patch("/suppliers/<int:supplier_id>")
@require_roles(*MANAGER_ROLES)
def update_supplier(user, supplier_id):
    supplier = db.session.get(Supplier, supplier_id)
    if supplier is None:
        return {"error": "Supplier not found"}, 404

    payload, error = json_object_subset(
        {
            "name",
            "contact_person",
            "email",
            "phone",
            "address",
            "city",
            "lead_days",
            "categories",
        }
    )
    if error:
        return error

    if "name" in payload:
        name, name_error = _optional_string(
            payload["name"], "name", 160, allow_empty=False
        )
        if name_error:
            return {"error": name_error[0]}, name_error[1]
        supplier.name = name
    if "contact_person" in payload:
        contact, contact_error = _optional_string(
            payload["contact_person"], "contact_person", 120
        )
        if contact_error:
            return {"error": contact_error[0]}, contact_error[1]
        supplier.contact_person = contact
    if "email" in payload:
        email = payload["email"]
        if email is not None:
            if not isinstance(email, str) or len(email.strip()) > 255:
                return {"error": "email must be a valid email address"}, 400
            if email.strip() and not EMAIL_PATTERN.fullmatch(email.strip()):
                return {"error": "email must be a valid email address"}, 400
            email = email.strip().lower() or None
        supplier.email = email
    if "phone" in payload:
        phone, phone_error = _optional_string(payload["phone"], "phone", 40)
        if phone_error:
            return {"error": phone_error[0]}, phone_error[1]
        supplier.phone = phone
    if "address" in payload:
        address, address_error = _optional_string(payload["address"], "address", 2000)
        if address_error:
            return {"error": address_error[0]}, address_error[1]
        supplier.address = address
    if "city" in payload:
        city, city_error = _optional_string(payload["city"], "city", 80)
        if city_error:
            return {"error": city_error[0]}, city_error[1]
        supplier.city = city
    if "categories" in payload:
        categories, categories_error = _optional_string(
            payload["categories"], "categories", 255
        )
        if categories_error:
            return {"error": categories_error[0]}, categories_error[1]
        supplier.categories = categories
    if "lead_days" in payload:
        lead_days = payload["lead_days"]
        if (
            isinstance(lead_days, bool)
            or not isinstance(lead_days, int)
            or lead_days < 0
        ):
            return {"error": "lead_days must be a non-negative integer"}, 400
        supplier.lead_days = lead_days

    db.session.commit()
    return serialize_supplier(supplier), 200
