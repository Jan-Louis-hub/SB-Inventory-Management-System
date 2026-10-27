# Small Business Inventory Management System

A full-stack inventory management application for small businesses.

**Stack:** Next.js, React, Flask, SQLAlchemy, and PostgreSQL

## Prerequisites

Install the following before setting up the project:

- [Git](https://git-scm.com/)
- [Node.js LTS](https://nodejs.org/) (includes npm)
- [Python 3.10 or newer](https://www.python.org/downloads/)
- [PostgreSQL](https://www.postgresql.org/download/)

Make sure PostgreSQL is running and you know the username and password for a
role that can connect to the server and create tables in your development
database.

## 1. Get the project

Clone the repository, then open a terminal in the newly created project folder:

```bash
git clone <repository-url>
cd SB-Inventory-Management-System
```

Replace `<repository-url>` with the repository's clone URL. If you downloaded
the repository as a ZIP instead, extract it and open a terminal in the
extracted folder.

## 2. Set up PostgreSQL and backend configuration

Create an empty PostgreSQL database for local development (for example,
`inventory_db`). Use a dedicated local role, or another PostgreSQL role with
permission to connect to this database and create tables.

Create the backend environment file from the example:

**Windows PowerShell**

```powershell
Copy-Item server\.env.example server\.env
```

**macOS or Linux**

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set `DEVELOPMENT_DATABASE_URL` to your database
connection details. For example:

```dotenv
APP_ENV=development
SECRET_KEY=<a-long-random-secret>
DEVELOPMENT_DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
```

Replace each placeholder with your local values and remove the angle brackets.
URL-encode special characters in the username or password. Generate a private
secret key with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the printed value into `SECRET_KEY`. Keep `server/.env` private; it is
ignored by Git. The app uses `DEVELOPMENT_DATABASE_URL` for local development,
not `DATABASE_URL`.

## 3. Install dependencies

Create a Python virtual environment and install the backend dependencies.

**Windows PowerShell**

```powershell
python -m venv server\venv
server\venv\Scripts\python.exe -m pip install -r server\requirements.txt
```

**macOS or Linux**

```bash
python3 -m venv server/venv
server/venv/bin/python -m pip install -r server/requirements.txt
```

Install the root development runner and frontend dependencies:

```bash
npm install
npm --prefix client install
```

If `npm` is not recognized in PowerShell, use `npm.cmd` in place of `npm`.

## 4. Configure and initialize the database

Create the frontend environment file:

**Windows PowerShell**

```powershell
Copy-Item client\.env.example client\.env.local
```

**macOS or Linux**

```bash
cp client/.env.example client/.env.local
```

The example config points the frontend at the local backend on port 8000; leave
it as-is for local development unless you have changed the backend address.




## 5. Run the frontend and backend

With the environment active, start both services from the repository root:

Open: a new Cmd Terminal
```bash
npm run dev
```

Open:

- Frontend: http://localhost:3000
- Backend health check: http://localhost:8000/api/health

Keep the terminal running while you use the app. Press `Ctrl+C` to stop both
services. PostgreSQL must also remain running. Login and registration require
the backend to be available.

## Optional: run backend tests

The tests use an isolated in-memory SQLite database and do not connect to your
development PostgreSQL database. Run these commands from the `server`
directory.

**Windows PowerShell**

```powershell
.\venv\Scripts\python.exe -m pytest
```

**macOS or Linux**

```bash
./venv/bin/python -m pytest
```

## Troubleshooting

- **Port 3000 or 8000 is already in use:** Stop the other process using that
  port, then run `npm run dev` again.
- **Backend cannot connect to PostgreSQL:** Check that PostgreSQL is running,
  the database has been created, and `DEVELOPMENT_DATABASE_URL` in
  `server/.env` is correct.
- **Python or npm command is not found:** Install the prerequisite and reopen
  the terminal so its PATH is refreshed. On Windows PowerShell, try `npm.cmd`
  if `npm` is blocked by the script execution policy.
- **Login accounts:** Follow the first-manager setup instructions above.

For more detail, see
[`backlog/DATABASE_SETUP_AND_TESTING.md`](backlog/DATABASE_SETUP_AND_TESTING.md)
for database setup and tests, and [`server/API_CONVENTIONS.md`](server/API_CONVENTIONS.md)
for API conventions.
