# API conventions

All API routes live under `/api` and use lowercase, plural resource names (for
example, `/api/items`). Requests and responses use JSON. The application
currently implements only `GET /api/health`; inventory routes should follow the
contracts below when their data models and authorization rules are added.

## Implemented endpoint

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/health` | `200 {"status": "ok"}` |

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

`APP_ENV` selects `development`, `testing`, or `production`. Set `SECRET_KEY`
and `DATABASE_URL` through the environment; production startup fails if either
is missing. `.env` is for local development only and is ignored by git. Logs
are emitted as JSON, and unexpected errors are logged server-side while
clients receive only a generic `500` response.
