# Run the Flask backend locally

This guide sets up the Flask API on your computer for local development. It
assumes you have cloned the repository and are running commands from its root
folder unless a step says otherwise.

## Requirements

- Python 3.10 or newer
- PostgreSQL installed and running
- Git

## 1. Create and activate a Python environment

In PowerShell:

```powershell
cd server
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell says script execution is disabled, either allow activation for
the current terminal with
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, or skip
activation and use `.\venv\Scripts\python.exe` instead of `python` in the
commands below.

On macOS or Linux, use:

```bash
cd server
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 2. Create demo login accounts

From `server`, create the manager and stock-controller accounts:

```powershell
python -m flask --app main seed-demo-accounts
```

Use these credentials to sign in through the frontend:

| Role       | Email                          | Password             |
| ---------- | ------------------------------ | -------------------- |
| Manager    | `manager@demo.example.test`    | `ManagerDemo123!`    |
| Controller | `controller@demo.example.test` | `ControllerDemo123!` |

These are development-only demo credentials. The command refuses to run in
production, and it does not overwrite an existing account if its credentials
or role differ. Do not use these passwords for real accounts.

## 3. Start the backend

From `server`:

```powershell
python -m flask --app main run --debug --port 8000
```

Leave this terminal open while using the application. The API is available at
`http://localhost:8000`. Check that it is responding by opening
`http://localhost:8000/api/health` or, in another PowerShell window, running:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

The expected response is `{"status": "ok"}`. The health endpoint confirms the
Flask server is running; it does not verify the database connection.

## Run backend tests

From `server`, run:

```powershell
python -m pytest -q
```

The tests use an isolated in-memory SQLite database and do not require the
local PostgreSQL database.

## Troubleshooting

- **Missing `DEVELOPMENT_DATABASE_URL` or `SECRET_KEY`:** Check that
  `server/.env` exists and contains both values. `SECRET_KEY` must be at least
  32 bytes.
- **Connection refused:** Start PostgreSQL and confirm the host and port in
  `DEVELOPMENT_DATABASE_URL` (normally `localhost:5432`).
- **Database does not exist:** Create the database named in the URL, then run
  the migration command again.
- **Authentication failed:** Check the PostgreSQL username/password and
  confirm that the role can connect to the database.
- **Command uses the wrong Python or Flask is missing:** Activate the `venv`
  from `server`, or run commands with `.\venv\Scripts\python.exe` on Windows.
- **Port 8000 is already in use:** Stop the other process using that port, or
  start Flask on a different port and update the frontend's
  `BACKEND_API_URL` to match.

For detailed database setup, migration, and connectivity instructions, see
[DATABASE_SETUP_AND_TESTING.md](DATABASE_SETUP_AND_TESTING.md). For the
project's overall setup, see the repository's [README](../README.md).
