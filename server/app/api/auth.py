from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import re
from urllib.parse import quote

import jwt
from authlib.integrations.base_client import OAuthError
from authlib.integrations.flask_client import OAuth
from authlib.jose.errors import JoseError
from flask import current_app, jsonify, redirect, request
from pwdlib import PasswordHash
from requests.exceptions import RequestException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.extensions import db
from app.models import OAuthIdentity, OAuthLoginCode, User

password_hash = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_LIFETIME = timedelta(hours=12)
OAUTH_CODE_LIFETIME = timedelta(minutes=2)
OAUTH_PROVIDERS = {
    "google": {
        "client_id": "GOOGLE_CLIENT_ID",
        "client_secret": "GOOGLE_CLIENT_SECRET",
        "metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
        "scope": "openid email profile",
    },
    "apple": {
        "client_id": "APPLE_CLIENT_ID",
        "client_secret": "APPLE_CLIENT_SECRET",
        "metadata_url": "https://appleid.apple.com/.well-known/openid-configuration",
        "scope": "openid email name",
    },
}


def _oauth_client_secret(provider, client_id):
    settings = OAUTH_PROVIDERS[provider]
    if provider != "apple":
        return current_app.config.get(settings["client_secret"])

    team_id = current_app.config.get("APPLE_TEAM_ID")
    key_id = current_app.config.get("APPLE_KEY_ID")
    private_key = current_app.config.get("APPLE_PRIVATE_KEY")
    if team_id and key_id and private_key:
        now = datetime.now(timezone.utc)
        return jwt.encode(
            {
                "iss": team_id,
                "iat": now,
                "exp": now + timedelta(minutes=5),
                "aud": "https://appleid.apple.com",
                "sub": client_id,
            },
            private_key.replace("\\n", "\n"),
            algorithm="ES256",
            headers={"kid": key_id},
        )
    return current_app.config.get(settings["client_secret"])


def serialize_user(user):
    if user.role in {"admin", "manager"}:
        frontend_role = "inventory_manager"
    elif user.role == "stock_controller":
        frontend_role = "stock_controller"
    else:
        frontend_role = "staff_member"
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": frontend_role,
    }


def create_access_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user.id),
            "iat": now,
            "exp": now + TOKEN_LIFETIME,
            "type": "access",
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def _json_object(required_fields):
    payload = request.get_json()
    if not isinstance(payload, dict):
        return None, (jsonify(error="A JSON object is required"), 400)
    if set(payload) != required_fields:
        return None, (jsonify(error="Request fields are missing or unknown"), 400)
    return payload, None


def _oauth_client(provider):
    settings = OAUTH_PROVIDERS[provider]
    client_id = current_app.config.get(settings["client_id"])
    client_secret = _oauth_client_secret(provider, client_id)
    if not client_id or not client_secret:
        raise ValueError(f"{provider.title()} sign-in is not configured")

    oauth = OAuth(current_app)
    return oauth.register(
        name=provider,
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url=settings["metadata_url"],
        client_kwargs={
            "scope": settings["scope"],
            **({"response_mode": "form_post"} if provider == "apple" else {}),
        },
    )


def _oauth_login_failure():
    return redirect(
        f"{current_app.config['OAUTH_FRONTEND_URL']}/login?oauth=failed",
        code=303,
    )


def _save_oauth_user(provider, claims):
    subject = claims.get("sub")
    email = claims.get("email")
    email_verified = claims.get("email_verified")
    if (
        not isinstance(subject, str)
        or not subject
        or len(subject) > 255
        or not isinstance(email, str)
        or len(email.strip()) > 255
        or not EMAIL_PATTERN.fullmatch(email.strip())
        or not (email_verified is True or email_verified == "true")
    ):
        return None

    normalized_email = email.strip().lower()
    identity = db.session.scalar(
        select(OAuthIdentity).where(
            OAuthIdentity.provider == provider,
            OAuthIdentity.subject == subject,
        )
    )
    if identity is not None:
        if not identity.user.is_active:
            return None
        return identity.user

    user = db.session.scalar(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    if user is not None and not user.is_active:
        return None

    if user is None:
        name = claims.get("name")
        if not isinstance(name, str) or not name.strip():
            name = normalized_email.split("@", 1)[0]
        name = name.strip()[:120]
        user = User(
            name=name,
            email=normalized_email,
            password_hash=password_hash.hash(secrets.token_urlsafe(48)),
            role="staff",
        )
        db.session.add(user)
        db.session.flush()

    db.session.add(
        OAuthIdentity(provider=provider, subject=subject, user_id=user.id)
    )
    return user


@api.post("/auth/register")
def register():
    payload, error = _json_object({"name", "email", "password"})
    if error:
        return error

    name = payload["name"]
    email = payload["email"]
    password = payload["password"]
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        return {"error": "name must contain 1 to 120 characters"}, 400
    if (
        not isinstance(email, str)
        or len(email) > 255
        or not EMAIL_PATTERN.fullmatch(email.strip())
    ):
        return {"error": "a valid email address is required"}, 400
    if not isinstance(password, str) or not 8 <= len(password) <= 1024:
        return {"error": "password must contain at least 8 characters"}, 400

    normalized_email = email.strip().lower()
    existing_user = db.session.scalar(
        select(User.id).where(func.lower(User.email) == normalized_email)
    )
    if existing_user is not None:
        return {"error": "An account with this email already exists"}, 409

    user = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=password_hash.hash(password),
        role="staff",
    )
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "An account with this email already exists"}, 409

    return {
        "token": create_access_token(user),
        "user": serialize_user(user),
    }, 201


@api.get("/auth/oauth/<provider>")
def start_oauth(provider):
    if provider not in OAUTH_PROVIDERS:
        return {"error": "Unsupported sign-in provider"}, 404
    try:
        oauth_client = _oauth_client(provider)
    except (jwt.PyJWTError, TypeError, ValueError):
        current_app.logger.warning("%s sign-in configuration is incomplete or invalid", provider)
        return {"error": f"{provider.title()} sign-in is not configured"}, 503

    redirect_uri = (
        f"{current_app.config['OAUTH_BACKEND_URL']}/api/auth/oauth/"
        f"{provider}/callback"
    )
    return oauth_client.authorize_redirect(redirect_uri)


@api.route("/auth/oauth/<provider>/callback", methods=["GET", "POST"])
def oauth_callback(provider):
    if provider not in OAUTH_PROVIDERS:
        return {"error": "Unsupported sign-in provider"}, 404
    if request.args.get("error"):
        return _oauth_login_failure()

    try:
        token = _oauth_client(provider).authorize_access_token()
    except (OAuthError, JoseError, RequestException, ValueError):
        return _oauth_login_failure()
    claims = token.get("userinfo")
    if not claims:
        return _oauth_login_failure()
    profile = dict(claims)
    if provider == "apple":
        apple_user = request.values.get("user")
        if apple_user:
            try:
                apple_profile = current_app.json.loads(apple_user)
            except ValueError:
                apple_profile = {}
            if isinstance(apple_profile, dict) and isinstance(
                apple_profile.get("name"), dict
            ):
                name = apple_profile["name"]
                profile["name"] = " ".join(
                    part
                    for part in (name.get("firstName"), name.get("lastName"))
                    if isinstance(part, str) and part.strip()
                )

    user = _save_oauth_user(provider, profile)
    if user is None:
        db.session.rollback()
        return _oauth_login_failure()

    code = secrets.token_urlsafe(32)
    db.session.add(
        OAuthLoginCode(
            code_hash=hashlib.sha256(code.encode("utf-8")).hexdigest(),
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + OAUTH_CODE_LIFETIME,
        )
    )
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _oauth_login_failure()

    return redirect(
        f"{current_app.config['OAUTH_FRONTEND_URL']}/api/auth/oauth/exchange"
        f"?code={quote(code)}",
        code=303,
    )


@api.post("/auth/oauth/exchange")
def exchange_oauth_code():
    payload, error = _json_object({"code"})
    if error:
        return error
    code = payload["code"]
    if not isinstance(code, str) or not code or len(code) > 128:
        return {"error": "Invalid or expired sign-in code"}, 400

    now = datetime.now(timezone.utc)
    user_id = db.session.execute(
        delete(OAuthLoginCode)
        .where(
            OAuthLoginCode.code_hash
            == hashlib.sha256(code.encode("utf-8")).hexdigest(),
            OAuthLoginCode.expires_at > now,
        )
        .returning(OAuthLoginCode.user_id)
    ).scalar_one_or_none()
    if user_id is None:
        db.session.rollback()
        return {"error": "Invalid or expired sign-in code"}, 401

    user = db.session.get(User, user_id)
    if user is None or not user.is_active:
        db.session.rollback()
        return {"error": "Invalid or expired sign-in code"}, 401
    db.session.commit()
    return {"token": create_access_token(user), "user": serialize_user(user)}, 200


@api.post("/auth/login")
def login():
    payload, error = _json_object({"email", "password"})
    if error:
        return error

    email = payload["email"]
    password = payload["password"]
    if (
        not isinstance(email, str)
        or len(email) > 255
        or not isinstance(password, str)
        or not password
        or len(password) > 1024
    ):
        return {"error": "Email or password is incorrect"}, 401

    user = db.session.scalar(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )
    if (
        user is None
        or not user.is_active
        or not password_hash.verify(password, user.password_hash)
    ):
        return {"error": "Email or password is incorrect"}, 401

    return {
        "token": create_access_token(user),
        "user": serialize_user(user),
    }, 200


@api.get("/auth/me")
def current_user():
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return {"error": "Authentication required"}, 401

    try:
        claims = jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub", "type"]},
        )
        if claims["type"] != "access":
            raise jwt.InvalidTokenError("Unexpected token type")
        user_id = int(claims["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return {"error": "Authentication required"}, 401

    user = db.session.get(User, user_id)
    if user is None or not user.is_active:
        return {"error": "Authentication required"}, 401
    return {"user": serialize_user(user)}, 200
