# API conventions

All API routes live under `/api` and use lowercase, plural resource names (for
example, `/api/products`). Requests and responses use JSON. Route handlers
validate request bodies, enforce authentication and roles, and call service
functions for any operation that changes product quantities.

## Implemented endpoints

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/health` | `200 {"status": "ok"}` |
| `POST` | `/api/auth/register` | `201` with the staff user and access token |
| `POST` | `/api/auth/login` | `200` with the user and access token |
| `GET` | `/api/auth/me` | `200` with the authenticated user |
| `GET` | `/api/auth/oauth/{google,apple}` | Redirect to the identity provider |
| `GET/POST` | `/api/auth/oauth/{provider}/callback` | Verify provider identity and persist the user |
| `POST` | `/api/auth/oauth/exchange` | Exchange a short-lived, single-use code for a session token |
| `GET` | `/api/categories` | Paginated categories |
| `POST` | `/api/categories` | `201` category (`admin`/`manager`) |
| `GET` | `/api/categories/{id}` | Category detail |
| `PATCH` | `/api/categories/{id}` | Update category (`admin`/`manager`) |
| `GET` | `/api/products` | Paginated products |
| `POST` | `/api/products` | `201` product (`admin`/`manager`) |
| `GET` | `/api/products/{id}` | Product detail |
| `PATCH` | `/api/products/{id}` | Update product metadata (`admin`/`manager`) |
| `POST` | `/api/products/{id}/adjustments` | Adjust stock via service (`admin`/`manager`/`stock_controller`) |
| `GET` | `/api/suppliers` | Paginated suppliers |
| `POST` | `/api/suppliers` | `201` supplier (`admin`/`manager`) |
| `GET` | `/api/suppliers/{id}` | Supplier detail |
| `PATCH` | `/api/suppliers/{id}` | Update supplier (`admin`/`manager`) |
| `GET` | `/api/deliveries` | Paginated deliveries derived from purchase orders |
| `GET` | `/api/deliveries/{purchase_number}` | Delivery detail for a purchase order |
| `GET` | `/api/purchase-orders` | Paginated purchase orders |
| `POST` | `/api/purchase-orders` | `201` purchase order (`admin`/`manager`) |
| `GET` | `/api/purchase-orders/{id}` | Purchase order with line items |
| `POST` | `/api/purchase-orders/{id}/place` | Draft → ordered (`admin`/`manager`) |
| `POST` | `/api/purchase-orders/{id}/cancel` | Cancel draft/ordered with no receipts (`admin`/`manager`) |
| `POST` | `/api/purchase-orders/items/{id}/receive` | Receive stock via service (`admin`/`manager`/`stock_controller`) |
| `GET` | `/api/sales` | Paginated sales (`admin`/`manager`/`stock_controller`) |
| `POST` | `/api/sales` | `201` sale via service (`admin`/`manager`/`stock_controller`) |
| `GET` | `/api/sales/{id}` | Sale with line items |
| `GET` | `/api/stock-movements` | Paginated stock movements |
| `GET` | `/api/stock-counts` | Paginated stock counts |
| `POST` | `/api/stock-counts` | `201` count with lines for a location |
| `GET` | `/api/stock-counts/{id}` | Count with lines |
| `POST` | `/api/stock-counts/{id}/start` | scheduled → in_progress |
| `PATCH` | `/api/stock-counts/{id}/lines/{line_id}` | Record counted quantity |
| `POST` | `/api/stock-counts/{id}/complete` | Complete a fully counted count |
| `GET` | `/api/stock-requests` | Paginated stock requests |
| `POST` | `/api/stock-requests` | `201` request |
| `GET` | `/api/stock-requests/{id}` | Request detail |
| `POST` | `/api/stock-requests/{id}/approve` | Approve (`admin`/`manager`) |
| `POST` | `/api/stock-requests/{id}/decline` | Decline (`admin`/`manager`) |
| `POST` | `/api/stock-requests/{id}/fulfill` | Fulfill approved request (`admin`/`manager`) |
| `DELETE` | `/api/stock-requests/{id}` | Withdraw pending request (`204`) |
| `GET` | `/api/users` | Paginated team members (`admin`/`manager`) |
| `POST` | `/api/users` | `201` team member (`admin`/`manager`) |
| `GET` | `/api/users/{id}` | Team member detail |
| `PATCH` | `/api/users/{id}` | Update team member |
| `GET` | `/api/shop-settings` | Shop profile and alert flags |
| `PATCH` | `/api/shop-settings` | Update shop settings (`admin`/`manager`) |

Registration accepts only `name`, `email`, and `password`; new self-registered
accounts always receive the `staff` role. Passwords must be at least 8
characters and are stored as password hashes. Login failures use the same
generic response whether the email is unknown, the password is incorrect, or
the account is inactive. The profile endpoint requires a valid bearer token.

Authenticated user payloads expose frontend roles: `admin`/`manager` →
`inventory_manager`, `stock_controller` → `stock_controller`, and other roles →
`staff_member`. Cost prices on products are included only for
`admin`/`manager` callers.

The Next.js frontend proxies login and registration through same-origin
`/api/auth/*` routes and keeps the backend access token in an HTTP-only,
SameSite=Lax cookie. Do not move that token into `localStorage` or expose it to
browser JavaScript. Configure the Next.js server's `BACKEND_API_URL` to reach
Flask; it defaults to `http://localhost:8000` for local development. Add
request rate limiting and account recovery before exposing authentication to
the public internet.

Google and Apple sign-in use OpenID Connect. Set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` from a Google OAuth web client. Set `APPLE_CLIENT_ID` to
the Apple Services ID. For Apple, either set `APPLE_CLIENT_SECRET` to a valid
Sign in with Apple client-secret JWT, or provide `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
and `APPLE_PRIVATE_KEY` from an Apple Sign in with Apple key; the server creates
a short-lived client-secret JWT for each provider request. Set a PEM private
key in `APPLE_PRIVATE_KEY`, escaping newlines as `\n` when needed. Register
`<OAUTH_BACKEND_URL>/api/auth/oauth/google/callback` and
`<OAUTH_BACKEND_URL>/api/auth/oauth/apple/callback` with the providers.
`OAUTH_BACKEND_URL` must be reachable by the user's browser and defaults to
`http://localhost:8000`; `OAUTH_FRONTEND_URL` defaults to
`http://localhost:3000`. Apple web sign-in must allow the `email` and `name`
scopes and POST back to its callback. Configure all credentials in the private
`server/.env` file. Set both `BACKEND_API_URL` and `NEXT_PUBLIC_AUTH_API_URL` in
`client/.env.local` so the latter is the same browser-reachable origin as
`OAUTH_BACKEND_URL` in `server/.env`. Keep the host identical (including
`localhost` versus `127.0.0.1`) so the OAuth state cookie survives the callback.
OAuth identities are stored in `oauth_identities`; verified
provider email addresses are matched to existing accounts, and new users are
created with the staff role. The temporary code used to hand the session to
Next.js is stored only as a hash and can be exchanged once.

## Resource response examples

Create requests validate every supplied field, reject unknown or missing
fields, and validate types, lengths, ranges, and domain rules on the server.

```http
POST /api/products
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "sku": "MUG-BLUE-01",
  "name": "Blue mug",
  "description": null,
  "category_id": 1,
  "supplier_id": null,
  "location": "Back room",
  "unit": "units",
  "cost_price": 4.5,
  "selling_price": 8.5,
  "quantity": 24,
  "reorder_level": 6,
  "is_active": true
}
```

Successful creation returns `201` with the created resource. Validation and
domain errors use the same JSON shape, for example
`400 {"error": "quantity must be a non-negative integer"}` or
`409 {"error": "SKU already exists"}`. Do not include exception details,
credentials, or stack traces in client responses.

## Status codes

Use `200` for successful reads and updates, `201` for creation, and `204` for a
successful deletion with no response body. Use `400` for malformed JSON or
invalid fields, `401` for unauthenticated requests, `403` for insufficient
permissions, `404` for missing resources, `409` for uniqueness or state
conflicts, and `500` for unexpected server errors. Error bodies use
`{"error": "message"}`.

## Collection queries

Collection endpoints accept `page` (default `1`), `per_page` (default `20`,
maximum `100`), `sort` (a field explicitly allowlisted by that endpoint), and
`direction` (`asc` or `desc`). Filters are named per resource and must also be
allowlisted; reject invalid pagination values, sort fields, directions, and
filter names with `400`. Never interpolate client-provided column names into
SQL.

Example: `GET /api/products?page=2&per_page=20&sort=name&direction=asc&location=Window`

```json
{
  "items": [],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 0,
    "pages": 0
  }
}
```

## Configuration and operations

`APP_ENV` selects `development`, `testing`, or `production`. Configure
`DEVELOPMENT_DATABASE_URL`, `TEST_DATABASE_URL`, and
`PRODUCTION_DATABASE_URL` separately. Production also requires `SECRET_KEY`.
The application does not use a generic `DATABASE_URL`. Local `.env` files,
credentials, database dumps, and production records must never be committed.
Product SKUs are globally unique, and emails and category names are
case-insensitive unique.

Use `flask --app main db upgrade` to create or upgrade the schema. Generate
reviewable revisions with `flask --app main db migrate -m "description"`;
do not use `db.create_all()` as a substitute for migrations.

Transactional service functions for sales, stock adjustments, purchase-order
creation, and purchase-order receiving update stock and append stock movements
together; route handlers must call them rather than changing product quantities
directly. A route that has already started a database transaction must commit
after the service succeeds and roll back if it fails. Completed-sale refunds
and cancellations are not implemented: do not change a completed sale's status
without a refund workflow that records returned stock and preserves the
original sale and price snapshots. Purchase-order cancellation must not remove
stock already received.
Logs are emitted as JSON, and unexpected errors are logged server-side while
clients receive only a generic `500` response.
