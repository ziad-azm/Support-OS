# SupportOS

SupportOS is an all-in-one customer support platform: customers, tickets, multi-channel
communications, agent workspace, SLAs, knowledge base, and reporting in one system. This
repository is a monorepo holding the Django API and the React web client side by side.

**Frontend:** React · Vite · TypeScript · Tailwind CSS · shadcn/ui · React Router · TanStack Query · React Hook Form · Zod · Axios · i18next
**Backend:** Django · Django REST Framework · PostgreSQL (locally installed; **Docker optional, not required**)

> Some of the libraries listed above arrive in later stories. What is wired up **today** is the
> monorepo layout, the environment/config strategy, a runnable Django project, and a runnable
> Vite app. See `SupportOs backlog.MD` for the full roadmap.

---

## Repository layout

```text
.
├── backend/                Django project (API). Settings split base/dev/prod, all config from env.
│   ├── config/             Django project package: settings/, urls.py, wsgi.py, asgi.py, tests/
│   ├── .env.example        Backend environment contract — copy to backend/.env
│   ├── manage.py           Django CLI entry point
│   └── requirements.txt    Python runtime dependencies
├── frontend/               React + Vite + TypeScript web client
│   ├── src/config/env.ts   The only module that reads import.meta.env
│   └── .env.example        Frontend environment contract — copy to frontend/.env
├── .squad/                 squad-kit: story intakes, implementation plans, project config
├── SupportOs backlog.MD    Full product backlog (epics → stories → tasks) and shared specs
└── README.md               This file — the only document needed to run the project locally
```

---

## Prerequisites

Install these before you start. Versions below are the minimums; the versions in brackets are
what the project is verified against.

| Tool | Minimum | Verified |
|---|---|---|
| PostgreSQL | 16 | 16 / 17 |
| Python | 3.12 | 3.12.6 |
| Node.js | 20 | 24.15.0 |
| npm | 10 | 11.12.1 |
| git | 2.40 | 2.54.0 |

*`pnpm` is not used in this repo — all frontend commands use `npm`.*

**Docker is not required.** See [Docker (optional, future)](#docker-optional-future).

---

## 1. Install and start PostgreSQL locally

**Windows** — install from the [EDB installer](https://www.postgresql.org/download/windows/).
Accept the defaults; the installer creates a `postgres` superuser with the password you choose
and registers a `postgresql-x64-17` service that starts automatically.

The installer does **not** add PostgreSQL's `bin` directory to `PATH`, so `psql` will not be
found in a fresh terminal. Add it for the current session:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
```

To make it permanent, add `C:\Program Files\PostgreSQL\17\bin` to your user `Path` via
*System Properties → Advanced → Environment Variables → Path → Edit*, then open a new terminal.
Adjust `17` to your installed major version.

**macOS**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Debian / Ubuntu**

```bash
sudo apt install postgresql
sudo systemctl enable --now postgresql
```

Confirm the server answers before moving on:

```powershell
psql --version
```

---

## 2. Create the database and role

Connect as the `postgres` superuser:

```powershell
psql -U postgres          # Linux: sudo -u postgres psql
```

Then run:

```sql
CREATE ROLE supportos WITH LOGIN PASSWORD 'supportos';
CREATE DATABASE supportos OWNER supportos;
ALTER ROLE supportos SET client_encoding TO 'utf8';
ALTER ROLE supportos SET default_transaction_isolation TO 'read committed';
ALTER ROLE supportos SET timezone TO 'UTC';
```

Exit with `\q`.

`supportos` as the password is a **local-only convenience** so this README stays copy-pasteable.
Any shared, staging, or production database must use a different password, supplied through the
environment — never committed.

---

## 3. Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # POSIX: source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env          # POSIX: cp .env.example .env
```

Now **edit `backend/.env`** and fill the two blank values that matter for local development:

- `DJANGO_SECRET_KEY` — generate one:

  ```powershell
  python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
  ```

- `POSTGRES_PASSWORD` — the password you used in step 2 (`supportos` if you followed it verbatim).

`backend/.env` is git-ignored and stays on your machine. There is **no fallback secret key**: if
`DJANGO_SECRET_KEY` is unset, Django refuses to start rather than booting insecurely.

Apply migrations and start the server:

```powershell
python manage.py migrate
python manage.py runserver
```

`migrate` applies Django's own `contenttypes`, `auth`, `admin`, and `sessions` migrations. Seeing
them succeed is the proof that your local PostgreSQL connection works — there is no SQLite
fallback in this project.

Open <http://127.0.0.1:8000/> and you should see Django's *"The install worked successfully!"*
page. <http://127.0.0.1:8000/admin/> shows the admin login form.

Create an admin user if you want to log in:

```powershell
python manage.py createsuperuser
```

---

## 4. Frontend setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env          # POSIX: cp .env.example .env
npm run dev
```

Vite serves the app on <http://localhost:5173/>. The browser console logs the resolved API base
URL at boot:

```text
[SupportOS] API base URL: http://localhost:8000/api
```

**Vite watches `.env` and restarts the dev server when it changes** (verified on Vite 8 — the
terminal prints `.env changed, restarting server...`). The restart is a full server restart, not
HMR, so reload the browser tab to pick up the new value. If your Vite version does not restart
automatically, stop the server (Ctrl+C) and start it again.

---

## 5. Run both apps together

Use two terminals. Neither app depends on the other's process, but the frontend's
`VITE_API_BASE_URL` must point at wherever the backend is listening.

| Terminal | Directory | Command | URL |
|---|---|---|---|
| 1 | `backend/` | `python manage.py runserver` (venv active) | <http://127.0.0.1:8000/> |
| 2 | `frontend/` | `npm run dev` | <http://localhost:5173/> |

If a port is taken:

```powershell
python manage.py runserver 8001     # backend on a different port
npm run dev -- --port 5174          # frontend on a different port
```

Changing the **backend** port means updating `VITE_API_BASE_URL` in `frontend/.env` to match, then
restarting the Vite dev server.

---

## Environment variables

`.env` files are git-ignored. **`.env.example` is the contract:** when you add a variable, add it
to the matching `.env.example` **and** to the table below in the same commit. That is how the next
developer discovers it.

### Backend — `backend/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DJANGO_SETTINGS_MODULE` | no | `config.settings.dev` | Which settings module to load: `config.settings.dev` or `config.settings.prod`. |
| `DJANGO_SECRET_KEY` | **yes** | — | Django cryptographic signing key. No fallback: startup fails if unset. |
| `DJANGO_DEBUG` | no | `True` on dev | Django debug mode. Forced to `False` in `prod`. |
| `DJANGO_ALLOWED_HOSTS` | no on dev, **yes** on prod | `localhost,127.0.0.1` on dev | Comma-separated hostnames Django will serve. |
| `DJANGO_TIME_ZONE` | no | `UTC` | Server time zone. |
| `POSTGRES_DB` | **yes** | — | Database name. |
| `POSTGRES_USER` | **yes** | — | Database role. |
| `POSTGRES_PASSWORD` | **yes** | — | Database role password. |
| `POSTGRES_HOST` | no | `localhost` | Database host — local install by default. |
| `POSTGRES_PORT` | no | `5432` | Database port. |
| `POSTGRES_CONN_MAX_AGE` | no | `0` | Seconds to reuse a connection. `0` closes it after each request. |
| `JWT_SIGNING_KEY` | no | `DJANGO_SECRET_KEY` | JWT signing key. Read now, consumed once JWT auth lands. |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | no | `15` | Access-token lifetime. |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | no | `7` | Refresh-token lifetime. |
| `DJANGO_SECURE_SSL_REDIRECT` | no | `True` | **Prod only.** Redirect HTTP to HTTPS. |
| `DJANGO_SECURE_HSTS_SECONDS` | no | `31536000` | **Prod only.** HSTS max-age. |

### Frontend — `frontend/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | **yes** | — | Base URL of the SupportOS API. Read once in `src/config/env.ts`; a trailing slash is stripped. |

Only variables prefixed `VITE_` are exposed to client code by Vite. **Never put a secret in a
`VITE_` variable** — everything with that prefix is bundled into the JavaScript shipped to the
browser.

Two formatting rules for `.env` files:

- **Do not wrap values in quotes** unless the quotes are part of the value — `django-environ`
  strips matched surrounding quotes.
- A variable already exported in your shell **wins** over the same key in `.env`; `read_env()`
  does not overwrite existing environment entries. A stale `DJANGO_SETTINGS_MODULE` export is a
  common cause of "my settings change did nothing".

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Released / stable. |
| `develop` | Integration branch — where feature work lands. |

Branch feature work off `develop` and merge back into it. `main` advances from `develop` at
release points.

---

## Troubleshooting

**`psql : The term 'psql' is not recognized...`**
PostgreSQL's `bin` directory is not on `PATH`. See [step 1](#1-install-and-start-postgresql-locally).

**`django.db.utils.OperationalError: connection failed: ... could not connect to server`**
The PostgreSQL server is not running. Windows: `Get-Service postgresql*` then
`Start-Service postgresql-x64-17`. macOS: `brew services start postgresql@16`.
Linux: `sudo systemctl start postgresql`.

**`django.core.exceptions.ImproperlyConfigured: Set the DJANGO_SECRET_KEY environment variable`**
`backend/.env` is missing or `DJANGO_SECRET_KEY` is unset. This failure is intentional — there is
no insecure fallback. Re-do the `Copy-Item .env.example .env` step and generate a key
([step 3](#3-backend-setup)).

**Django starts but sessions/logins behave oddly**
`DJANGO_SECRET_KEY=` (present but empty) is read as an empty string rather than raising. Generate
a real key.

**`FATAL: password authentication failed for user "supportos"`**
`POSTGRES_PASSWORD` in `backend/.env` does not match the role's password. Fix the file, or reset
the password: `ALTER ROLE supportos WITH PASSWORD 'supportos';`.

**`FATAL: database "supportos" does not exist`**
Step 2 was skipped or targeted a different server. Re-run the SQL in
[step 2](#2-create-the-database-and-role).

**A password containing `@`, `:`, `/`, or `#` breaks the connection**
It should not — the backend uses discrete `POSTGRES_*` variables rather than a single
`DATABASE_URL`, so no percent-encoding is needed. Do not switch this to `DATABASE_URL`.

**`Uncaught Error: Missing required environment variable "VITE_API_BASE_URL"` in the browser**
`frontend/.env` is missing or the variable is blank. Copy the example file and restart
`npm run dev`.

**Editing `frontend/.env` changes nothing in the browser**
Vite restarts the dev server on `.env` change, but the already-loaded page keeps the old value.
Reload the tab. If the terminal never printed `.env changed, restarting server...`, restart the
dev server manually.

**`Error: That port is already in use.` / Vite quietly starts on 5174**
Another process holds `8000` or `5173`. See [step 5](#5-run-both-apps-together).

**`.squad/` files appear to be missing from git**
Intentional. `.squad/secrets.yaml`, `.squad/runs/`, `.squad/.trash/`, and story `attachments/`
are excluded by the squad-kit managed block at the top of `.gitignore`. Do not "fix" this.

---

## Docker (optional, future)

Docker is **not** required to run SupportOS. No `Dockerfile` or compose file ships with this
repository today, and none of the steps above needs one. If container files are added later they
are strictly an optional convenience — the local-PostgreSQL steps above remain the supported path
for local development.
