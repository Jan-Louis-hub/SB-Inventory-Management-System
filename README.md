# Small Business Inventory Management System

A full-stack inventory management system for small businesses.

**Stack:** Next.js, shadcn/ui, FastAPI (Python), PostgreSQL

**Group members:** Vuyisile Nqono, Franco van Rooyen, Jedidiah Tshiteya, Jan-Louie Fourie, Olaotse Phuti

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Python](https://www.python.org/downloads/) 3.10 or newer
- [PostgreSQL](https://www.postgresql.org/download/)

## Setup Backend

```bash
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create your environment file:

```bash
copy .env.example .env
```

Open `.env` and set your database connection:

```
DATABASE_URL=postgresql+psycopg2://postgres:yourpassword@localhost:5432/sb_inventory
```

Create the `sb_inventory` database in PostgreSQL (via pgAdmin or psql) before starting the server.

### Run the backend

Make sure the virtual environment is active, then:

```bash
uvicorn main:app --reload --port 8000
```

- API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs

## Setup Frontend

```bash
cd client
npm install
npm run dev
```

The app runs at http://localhost:3000.

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
| 1 | `server` | `venv\Scripts\activate` then `uvicorn main:app --reload --port 8000` |
| 2 | `client` | `npm run dev` |

## Git Workflow

```bash
git pull
git add .
git commit -m "Describe your change"
git push
```

Never commit your `.env` file. Use `.env.example` to share the variable names.
