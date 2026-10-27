# PostgreSQL setup, migrations, and backend testing

This guide explains the database changes in this project, how to configure
PostgreSQL without committing credentials, and how to verify the backend can
connect to the database.

## What changed

- Flask reads a different database URL for each environment:
  `DEVELOPMENT_DATABASE_URL`, `TEST_DATABASE_URL`, or
  `PRODUCTION_DATABASE_URL`. Development and production require a private
  `SECRET_KEY` containing at least 32 bytes; short keys are rejected to prevent
  weak JWT signing.
- `Flask-Migrate` and Alembic manage schema changes. The supported setup
  command is `flask --app main db upgrade`; `db.create_all()` is not a
  substitute for migrations.
- Migrations define the clothing-shop tables and add integrity checks,
  case-insensitive unique indexes for email, SKU, and category name, and
  indexes for common joins and inventory queries.
- Sales and purchase-order receiving have transaction-safe service functions.
  Each operation keeps the stock quantity, sale or purchase records, and stock
  movement history in one transaction.
- The tests use an in-memory SQLite database and never need to connect to the
  development or production database.

## Configure a local database

Open PowerShell in the repository and change to `server`:

```powershell
cd server
```

If you have not set up the Python environment yet:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create a local signing key and store it in the ignored `server\.env` file as
`SECRET_KEY=<generated value>`. Generate one with:

```powershell
.\venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Keep the generated value private and do not commit it. Replacing it invalidates
existing login tokens, so users will need to sign in again.

Use the virtual-environment interpreter for all backend commands below.
If pip prints `Defaulting to user installation`, you ran a global `pip`
instead; from this directory, use the explicit
`.\venv\Scripts\python.exe -m pip ...` form shown above. This keeps backend
packages separate from unrelated Python applications installed for your
Windows user.

Create the local environment file if it does not already exist:

```powershell
Copy-Item .env.example .env
```

Edit `server\.env` locally. Set `APP_ENV=development` and replace the
development URL with the connection details for your PostgreSQL database:

```dotenv
APP_ENV=development
DEVELOPMENT_DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
```

The angle-bracketed values above are placeholders; replace them, and do not
include the brackets. URL-encode special characters in a username or password.
Keep `.env` private; it is ignored by Git. Do not paste real credentials into
`.env.example`, source code, tickets, or commits. The app does not use a
generic `DATABASE_URL`.

Before running the application, ensure that the PostgreSQL service is running
and that the named database already exists. The configured PostgreSQL role
must be allowed to connect and create or update tables in that database.

## Initialize or upgrade the schema

Run this from the `server` directory, with the local virtual environment
active:

```powershell
.\venv\Scripts\python.exe -m flask --app main db upgrade
```

This applies all pending migrations, creating the database tables on an empty
database. Check the applied version and the available migration head with:

```powershell
.\venv\Scripts\python.exe -m flask --app main db current
.\venv\Scripts\python.exe -m flask --app main db heads
```

To add optional clothing-shop demo data to a development or testing database:

```powershell
.\venv\Scripts\python.exe -m flask --app main seed-demo
```

The demo seed is idempotent and is disabled in production. Do not seed demo
data into a database containing real business records.

### If the database already has tables

Do **not** run `db upgrade` blindly against tables created earlier with
`init-db`, `create_all()`, or a manually run SQL script. First take a backup
and inspect the schema. Alembic's `db stamp` only records a migration version;
it does not create, validate, or convert tables. Stamp the initial revision
only after verifying that the existing schema exactly matches that migration,
then upgrade:

```powershell
.\venv\Scripts\python.exe -m flask --app main db stamp e8a0a7372b82
.\venv\Scripts\python.exe -m flask --app main db upgrade
```

If the existing schema differs, do not stamp it or drop the database. Prepare
a migration that safely reconciles the actual schema and data, and test it on
a backup or a separate database first. The integrity migration adds
case-insensitive uniqueness, so resolve any email, SKU, or category names
that differ only by letter case before applying it.

## Verify PostgreSQL connectivity

After setting `DEVELOPMENT_DATABASE_URL`, upgrading the schema, and with the
current directory still set to `server`, run this read-only connection check:

```powershell
.\venv\Scripts\python.exe -c "from app import create_app; from app.extensions import db; from sqlalchemy import inspect, text; app=create_app(); app.app_context().push(); print('SELECT 1:', db.session.execute(text('SELECT 1')).scalar_one()); print('Tables:', ', '.join(inspect(db.engine).get_table_names()))"
```

A successful connection prints `SELECT 1: 1` and the migrated table names.
If it fails, check that the PostgreSQL service is running, the database and
role exist, the role has permission, and the URL in `server\.env` is correct.
Do not share the URL or the resulting error if it includes credentials.

## Run the automated tests

Tests create and migrate a fresh in-memory SQLite database; they do not
exercise your live PostgreSQL server. From `server`:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

The tests cover environment-specific configuration, clean migrations,
upgrading from the initial revision, constraints, demo-data isolation,
transactional sales, stock receipts, and rollback on invalid operations.
Authentication endpoint tests also cover password hashing, duplicate
registration, staff-only self-registration, login, and bearer-token profile
access.

## Run the backend and check it

From `server`, start Flask:

```powershell
.\venv\Scripts\python.exe -m flask --app main run --debug --port 8000
```

In another PowerShell window, check the health endpoint:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

The expected response is:

```text
status
------
ok
```

**The health endpoint only checks that Flask is responding; it does not query
PostgreSQL.** Use the connection check above or `flask --app main db current`
to verify database connectivity.

## Make and test future schema changes

Update the SQLAlchemy models, generate a migration, review the generated file,
then apply it to a development database:

```powershell
.\venv\Scripts\python.exe -m flask --app main db migrate -m "describe the schema change"
.\venv\Scripts\python.exe -m flask --app main db upgrade
.\venv\Scripts\python.exe -m pytest -q
```

Review generated migrations for data conversions, constraint changes, and
indexes. Test upgrades on a separate database or a restored backup before
deploying to production. Store database dumps outside the repository, restrict
access to them, and periodically test restoring one into a separate database.
