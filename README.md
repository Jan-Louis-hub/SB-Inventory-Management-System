# Small Business Inventory Management System

A full-stack inventory management system for small businesses.

**Stack:** Next.js, shadcn/ui, Flask (Python), PostgreSQL

**Group members:** Vuyisile Nqono, Franco van Rooyen, Jedidiah Tshiteya, Jan-Louie Fourie, Olaotse Phuti

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Python](https://www.python.org/downloads/) 3.10 or newer
- [PostgreSQL](https://www.postgresql.org/download/)

## Setup Backend

```bash
cd server
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

The backend tests use an isolated in-memory SQLite database and exercise the
migrations; they do not connect to a development or production database:

```bash
.\venv\Scripts\python.exe -m pytest
```

Create your environment file:

```bash
copy .env.example .env
```

Set `APP_ENV` and the matching database URL in `server/.env` (copied from the
example). Use a different database for each environment:

| Environment | Setting |
| --- | --- |
| Development | `DEVELOPMENT_DATABASE_URL` |
| Testing | `TEST_DATABASE_URL` |
| Production | `PRODUCTION_DATABASE_URL` and `SECRET_KEY` |

Never point tests at a development or production database. URL-encode special
characters in PostgreSQL usernames and passwords. The old `DATABASE_URL` name
is not used; configure the environment-specific name instead. Production
startup fails unless both production settings are present.

### Initialize and migrate the database

Run these commands from `server` with its virtual environment active. For a
new, empty database, apply the checked-in migrations:

```bash
.\venv\Scripts\python.exe -m flask --app main db upgrade
```

The initial migration creates the users, categories, products, suppliers,
stock movements, sales, sale items, purchase orders, and purchase order items
tables. Migrations also add integrity constraints and indexes. For optional
clothing-shop sample data, run `flask --app main seed-demo` after upgrading.
Demo seeding is refused in production.

If you previously created tables using the old `init-db`/`create_all` command,
**back up the database first**. Verify that its schema matches the initial
migration before marking it as migrated; stamping records a version and does
not create or validate tables:

```bash
.\venv\Scripts\python.exe -m flask --app main db stamp e8a0a7372b82
.\venv\Scripts\python.exe -m flask --app main db upgrade
```

Do not run `db stamp` on an empty or mismatched database. Check migration
status with `flask --app main db current` and `flask --app main db heads`.
Before upgrading existing data, check for values that differ only by letter
case in user emails, product SKUs, and category names; the migration adds
case-insensitive uniqueness and will fail rather than merge records.
Create and review each schema change before deployment:

```bash
.\venv\Scripts\python.exe -m flask --app main db migrate -m "describe the schema change"
.\venv\Scripts\python.exe -m flask --app main db upgrade
```

Review generated migrations for data conversion, constraint changes, and
indexes; Alembic autogeneration does not capture every database-level change.
Use `EXPLAIN ANALYZE` with representative data before adding more indexes. Test
upgrades on a copy of production data before deployment. Avoid downgrades in
production unless the migration's data-loss implications are understood.

### Backups and recovery

Use PostgreSQL's `pg_dump` custom format and store backups outside the
repository in access-controlled storage. For example, in PowerShell:

```powershell
pg_dump --format=custom --no-owner --file=inventory-backup.dump --dbname="$env:PRODUCTION_DATABASE_URL"
```

Schedule backups according to the business's recovery-point and retention
needs. Periodically restore a backup into a **separate, non-production**
database, then verify the restored schema and representative records before
relying on the backup. Keep restore credentials and backup files out of source
control. For a restore test, first create an empty database and set
`RESTORE_DATABASE_URL` to that database's private connection string, then run:

```powershell
pg_restore --no-owner --dbname="$env:RESTORE_DATABASE_URL" inventory-backup.dump
```

### Run the backend

From the `server` directory with the virtual environment active:

```bash
.\venv\Scripts\python.exe -m flask --app main run --debug --port 8000
```

- Health endpoint: http://localhost:8000/api/health
- API conventions and example payloads: `server/API_CONVENTIONS.md`
- Demo login accounts and backend run instructions: `server/RUN_BACKEND.md`
- Database setup, migration, connectivity, and testing guide:
  `server/DATABASE_SETUP_AND_TESTING.md`

## Setup Frontend

```bash
cd client
npm install
copy .env.example .env.local
npm run dev
```

The app runs at http://localhost:3000. `BACKEND_API_URL` in `client/.env.local`
configures the Next.js server-to-server connection to Flask; it defaults to
`http://127.0.0.1:8000`. Start Flask in a separate terminal before using the
login or registration forms.

## Adding shadcn/ui Components

The frontend uses [shadcn/ui](https://ui.shadcn.com/docs). Components are added one at a time from inside the `client` folder:

```bash
cd client
npx shadcn@latest add button
```

You can add several at once:

```bash
npx shadcn@latest add button card input table dialog
```

Components are copied into `client/components/ui`, so you can edit them directly.

- [shadcn/ui documentation](https://ui.shadcn.com/docs)
- [Browse all components](https://ui.shadcn.com/docs/components)
- [Next.js installation guide](https://ui.shadcn.com/docs/installation/next)

## Running the Full Project

Use two terminals:

| Terminal | Folder | Command |
|----------|--------|---------|
| 1 | `server` | `.\venv\Scripts\python.exe -m flask --app main run --debug --port 8000` |
| 2 | `client` | `npm run dev` |

## Git Workflow

```bash
git pull
git add .
git commit -m "Describe your change"
git push
```

Never commit `.env` files, credentials, database dumps, or production data. Use `.env.example` only for variable names and non-secret placeholders.
