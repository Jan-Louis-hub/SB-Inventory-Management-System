# API conventions

All API routes live under `/api` and use lowercase, plural resource names (for
example, `/api/items`). Requests and responses use JSON. The application
currently implements only `GET /api/health`; inventory routes should follow the
contracts below when their data models and authorization rules are added.

## Implemented endpoints

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/health` | `200 {"status": "ok"}` |
| `POST` | `/api/auth/register` | `201` with the staff user and access token |
| `POST` | `/api/auth/login` | `200` with the user and access token |
| `GET` | `/api/auth/me` | `200` with the authenticated user |

Registration accepts only `name`, `email`, and `password`; new self-registered
accounts always receive the `staff` role. Passwords must be at least 8
characters and are stored as password hashes. Login failures use the same
generic response whether the email is unknown, the password is incorrect, or
the account is inactive. The profile endpoint requires a valid bearer token.

The Next.js frontend proxies login and registration through same-origin
`/api/auth/*` routes and keeps the backend access token in an HTTP-only,
SameSite=Lax cookie. Do not move that token into `localStorage` or expose it to
browser JavaScript. Configure the Next.js server's `BACKEND_API_URL` to reach
Flask; it defaults to `http://127.0.0.1:8000` for local development. Add
request rate limiting and account recovery before exposing authentication to
the public internet.

## Resource response examples

Create requests validate every supplied field, reject unknown or missing
fields, and validate types, lengths, ranges, and domain rules on the server.

```http
POST /api/items
Content-Type: application/json
```

```json
{
  "sku": "MUG-BLUE-01",
  "name": "Blue mug",
  "quantity": 24,
  "unit_price": 8.5
}
```

Successful creation returns `201` with the created resource:

```json
{
  "id": 42,
  "sku": "MUG-BLUE-01",
  "name": "Blue mug",
  "quantity": 24,
  "unit_price": 8.5
}
```

Validation and domain errors use the same JSON shape, for example
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

Example: `GET /api/items?page=2&per_page=20&sort=name&direction=asc&category=drinkware`

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

The current API implements only the health check. Transactional service
functions for sales and purchase-order receiving update stock and append stock
movements together; future route handlers must call them rather than changing
product quantities directly. A route that has already started a database
transaction must commit after the service succeeds and roll back if it fails.
Completed-sale refunds and cancellations are not implemented: do not change a
completed sale's status without a refund workflow that records returned stock
and preserves the original sale and price snapshots. Purchase-order
cancellation must not remove stock already received.
Logs are emitted as JSON, and unexpected errors are logged server-side while
clients receive only a generic `500` response.
