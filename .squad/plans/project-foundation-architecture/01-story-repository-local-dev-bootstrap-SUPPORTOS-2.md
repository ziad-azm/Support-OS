# Story 01 — Repository & Local Dev Bootstrap (Story: SUPPORTOS-2)

## Prerequisites

- None. This is the first story in the repository and the first story of **EPIC 0 — Project Foundation & Architecture**.
- The working tree is **not yet a git repository** (`e:\Work\AZM\SupportOS` has no `.git/`). Creating it is part of this story — see task 6.
- Existing files that must survive this story untouched in content: `SupportOs backlog.MD`, `.squad/**`, `.claude/**`, and the squad-kit managed block inside `.gitignore`.
- Verified local toolchain on the dev machine: `git 2.54.0.windows.1`, `python 3.12.6` (invocable as `python` and `py`), `node v24.15.0`, `npm 11.12.1`. **`pnpm` is not installed and `psql`/`createdb` are not on `PATH`** — both facts drive decisions below.

---

## Story Goal

Produce a monorepo that a developer can clone and run **entirely without Docker**, using a locally installed PostgreSQL.

1. `backend/` holds a runnable Django project whose settings are split `base`/`dev`/`prod` and read **all** configuration from environment variables.
2. `frontend/` holds a runnable Vite + React + TypeScript app that reads its API base URL from `VITE_API_BASE_URL`.
3. A root `README.md` gives the exact, copy-pasteable local-run sequence: install PostgreSQL, create the database and role, create a virtualenv, install dependencies, copy `.env.example` → `.env`, run migrations, start both servers.
4. `.env.example` files exist for both apps; no real secret is ever committed.
5. The repository is initialised with `main` and `develop` branches.

**Explicitly out of scope** (each is owned by a later story — do **not** pre-empt them):

- Django **domain apps** (`customers`, `tickets`, `communications`, …), the shared `core` app, DRF installation, the response envelope, the global exception handler, and `GET /api/health/` → **FND-2** (`SupportOs backlog.MD` lines 61–85).
- Frontend **feature-based folder structure**, React Router, Axios instance, TanStack Query, error/loading/empty patterns → **FND-3** (`SupportOs backlog.MD` lines 87–111).
- Tailwind CSS, shadcn/ui, i18next → **EPIC 1** (`SupportOs backlog.MD` lines 141–219).
- `djangorestframework-simplejwt` itself → **AUTH-1** (`SupportOs backlog.MD` lines 228–246). This story only stages the JWT **env contract** so AUTH-1 introduces no new config plumbing.
- Lint/format/test-runner conventions (ruff, prettier, eslint rules, pytest vs Django runner, vitest) → **FND-4 / `CONV`** (`SupportOs backlog.MD` lines 113–139). Use Django's built-in test runner here; **do not** add pytest, vitest, ruff, or black.
- Any `Dockerfile` or `compose.yaml`. Do not create them. The README documents Docker as optional/future instead.

---

## Context — Read These Files First

1. `.squad/stories/project-foundation-architecture/SUPPORTOS-2/intake.md` — the source story. Read the fenced **Description** block: it enumerates the two tasks (`ARCH` scaffold, `ENV`) and their constraints verbatim. There are **no attachments** ("Attachments: None.") and **no acceptance criteria** in the intake — the Done Criteria below are derived from the task **Outcome** lines.
2. `SupportOs backlog.MD` — lines 1–33: the `Shared Specs` ID table (`ARCH`, `CONV`, `ENV`, `API`, …) and the global **token-efficiency rule** (lines 25–31). Every task in this story is written against those IDs. Lines 41–59: the FND-1 story this plan implements. Lines 61–111: FND-2 and FND-3, so you can see exactly where the scope line is drawn.
3. `.gitignore` — currently **only** the squad-kit managed block (lines 1–8), delimited by `# Managed by squad-kit — do not edit this block` and `# End squad-kit block`. All new ignore rules go **below** `# End squad-kit block`. **Do not** touch lines 1–8.
4. `.squad/config.yaml` — `project.primaryLanguage: typescript`, `tracker.type: jira`, `naming.globalSequence: true`. Confirms this story is `NN = 01` in the global sequence.
5. `.squad/plans/project-foundation-architecture/00-overview.md` — the feature overview table you must update (task 7).
6. `.squad/plans/00-index.md` — the feature index; `project-foundation-architecture` has no row yet (task 7).

There is no prior plan file in `.squad/plans/` to follow as precedent — this is story `01`. Match the structure of **this** file for subsequent stories.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| Running the app **must not require Docker**. | Intake, task 1 constraints | `README.md` run steps reference only local Postgres, `python`, and `npm`. No Docker file is created. |
| Docker files, if ever added, are **optional/future**. | Intake, task 1 constraints | `README.md` § "Docker (optional, future)" states no compose file ships and none is needed. |
| **No secrets committed.** | Intake, task 2 constraints | `.gitignore` ignores `.env` and `.env.*` while **un-ignoring** `.env.example`; `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD` are blank in both `.env.example` files. |
| Local Postgres is the **default**. | Intake, task 2 constraints | `POSTGRES_HOST` defaults to `localhost`, `POSTGRES_PORT` to `5432` in `backend/config/settings/base.py`. |
| Both apps read **all** config from env. | Intake, task 2 outcome | Backend: `django-environ` in `base.py`. Frontend: `frontend/src/config/env.ts`, the single read point for `import.meta.env`. |
| A fresh clone runs both apps following the README **only**. | Intake, task 1 outcome | Verification Steps below are executed from a clean clone. |

---

## Implementation tasks

### 1 — Root scaffold: directories, ignore rules, README

**Create directory: `backend/`**
**Create directory: `frontend/`**

Both are created by the scaffolding commands in tasks 2 and 4; do not hand-create empty placeholders.

**File: `.gitignore`**

Append the following **below** the existing `# End squad-kit block` line. Leave the managed block byte-for-byte unchanged.

```gitignore

# --- Python / Django (backend) ---
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
backend/staticfiles/
backend/media/
*.sqlite3

# --- Node / Vite (frontend) ---
node_modules/
frontend/dist/
frontend/.vite/
npm-debug.log*

# --- Environment files: never commit real values ---
.env
.env.*
!.env.example

# --- Editors / OS ---
.vscode/
.idea/
.DS_Store
Thumbs.db
```

The `!.env.example` negation **must** come after the `.env.*` pattern or git will ignore the example files and the story's outcome fails.

**Create file: `README.md`** (repository root)

Sections, in this order. Every command block must be runnable as written on Windows PowerShell **and** have a POSIX equivalent shown, because the primary dev machine is Windows 11 but the stack is cross-platform.

1. `# SupportOS` — one-paragraph description plus the stack line (`React · Vite · TypeScript` / `Django · DRF · PostgreSQL`), copied from `SupportOs backlog.MD` lines 5–6.
2. `## Repository layout` — a fenced tree showing `backend/`, `frontend/`, `.squad/`, `SupportOs backlog.MD`, with a one-line purpose per entry.
3. `## Prerequisites` — pinned minimums verified on the dev machine: **PostgreSQL 16 or newer**, **Python 3.12+**, **Node.js 20+ (24.x verified)**, **npm 10+ (11.12.1 verified)**, **git 2.40+**. Add the note: *`pnpm` is not used in this repo — all frontend commands use `npm`.*
4. `## 1. Install and start PostgreSQL locally` — Windows: the EDB installer, and the explicit warning that **`psql` is not added to `PATH` by default**; give the fix:

   ```powershell
   $env:Path += ";C:\Program Files\PostgreSQL\17\bin"
   ```

   with the note to add it permanently via *System Properties → Environment Variables*. macOS: `brew install postgresql@16 && brew services start postgresql@16`. Debian/Ubuntu: `sudo apt install postgresql`.
5. `## 2. Create the database and role` — exact SQL, run as the `postgres` superuser:

   ```sql
   CREATE ROLE supportos WITH LOGIN PASSWORD 'supportos';
   CREATE DATABASE supportos OWNER supportos;
   ALTER ROLE supportos SET client_encoding TO 'utf8';
   ALTER ROLE supportos SET default_transaction_isolation TO 'read committed';
   ALTER ROLE supportos SET timezone TO 'UTC';
   ```

   Preceded by `psql -U postgres` (Windows) / `sudo -u postgres psql` (Linux). State that `supportos` as the dev password is a **local-only convenience** and must differ in any shared environment.
6. `## 3. Backend setup` — the full sequence:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1        # POSIX: source .venv/bin/activate
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   Copy-Item .env.example .env          # POSIX: cp .env.example .env
   ```

   Then: *edit `backend/.env` and set `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`*, with the key generator inline:

   ```powershell
   python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
   ```

   Then migrations and the server:

   ```powershell
   python manage.py migrate
   python manage.py runserver
   ```

   State the expected result: Django's default "The install worked successfully!" page at `http://127.0.0.1:8000/`, and that `migrate` applies Django's own `auth`/`contenttypes`/`sessions`/`admin` migrations — **proof that the local Postgres connection works**.
7. `## 4. Frontend setup`:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env          # POSIX: cp .env.example .env
   npm run dev
   ```

   Expected result: Vite serves on `http://localhost:5173/`.
8. `## 5. Run both apps together` — two terminals, one per app; note the ports (`8000` backend, `5173` frontend) and that `frontend/.env`'s `VITE_API_BASE_URL` must match the backend port.
9. `## Environment variables` — two tables (backend, frontend): variable name, required?, default, purpose. Must list every key present in the two `.env.example` files (task 3). Add the rule: **`.env` is git-ignored; `.env.example` is the contract — when you add a variable, add it to `.env.example` and to this table in the same commit.**
10. `## Branches` — `main` = released/stable, `develop` = integration; feature work branches off `develop`.
11. `## Troubleshooting` — one bullet per failure mode listed in **Edge Cases & Failure Modes** below, each with the exact error text and the fix.
12. `## Docker (optional, future)` — verbatim intent: *Docker is **not** required to run SupportOS. No `Dockerfile` or compose file ships with the repository today. If container files are added later they are strictly optional convenience; the local-Postgres steps above remain the supported path.*

---

### 2 — Scaffold the Django project

Run from the repository root:

```powershell
mkdir backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install "Django>=5.2,<5.3" "psycopg[binary]>=3.2,<4" "django-environ>=0.12,<1"
django-admin startproject config .
```

`django-admin startproject config .` (note the trailing dot) produces exactly `backend/manage.py` and `backend/config/{__init__.py,settings.py,urls.py,wsgi.py,asgi.py}`. Do **not** use `startproject config backend` — it nests an extra directory.

**Create file: `backend/requirements.txt`**

```text
# Runtime dependencies. Version ranges, not exact pins: FND-4 (CONV) decides the
# lockfile strategy. Docker is deliberately absent — see README § Docker.
Django>=5.2,<5.3
psycopg[binary]>=3.2,<4
django-environ>=0.12,<1
```

Use `psycopg[binary]` (psycopg 3), **not** `psycopg2-binary`: it needs no local PostgreSQL client build tooling, which matters because `psql` is not on `PATH` on the dev machine. `django.db.backends.postgresql` supports psycopg 3 natively on Django 5.2.

Do **not** add `djangorestframework`, `django-cors-headers`, or `djangorestframework-simplejwt` — FND-2 and AUTH-1 own those.

**File: `backend/manage.py`**

Change the settings default on the `os.environ.setdefault(...)` line inside `main()`:

```python
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
```

**File: `backend/config/wsgi.py`**
**File: `backend/config/asgi.py`**

Apply the same one-line change in each — default to `config.settings.dev`. Production sets `DJANGO_SETTINGS_MODULE=config.settings.prod` explicitly in its own environment; **do not** hardcode `prod` in these files, or a developer who forgets to export the variable gets a confusing `ALLOWED_HOSTS` failure instead of a working dev server.

**File: `backend/config/urls.py`**

Leave the generated `admin/` route as-is. **No API routes in this story** — `GET /api/health/` belongs to FND-2.

---

### 3 — Settings split and the `ENV` contract

**Delete file: `backend/config/settings.py`** (the single generated module)
**Create file: `backend/config/settings/__init__.py`** — empty.

**Create file: `backend/config/settings/base.py`**

Move the generated settings here, then apply the changes below. `BASE_DIR` must be re-derived because the module moved one level deeper:

```python
from pathlib import Path

import environ

# base.py lives at <repo>/backend/config/settings/base.py, so parents[2] == <repo>/backend
BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

# No default: a missing key must fail loudly at import time, not silently start
# the app with a throwaway secret.
SECRET_KEY = env("DJANGO_SECRET_KEY")

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Domain apps are added by FND-2. Do not add them here.
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env.int("POSTGRES_PORT", default=5432),
        "CONN_MAX_AGE": env.int("POSTGRES_CONN_MAX_AGE", default=0),
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("DJANGO_TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# JWT env contract, staged here so AUTH-1 (djangorestframework-simplejwt) adds a
# package and a SIMPLE_JWT mapping — never new config plumbing. Nothing reads
# these values yet; that is intentional.
JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", default=SECRET_KEY)
JWT_ACCESS_TOKEN_LIFETIME_MINUTES = env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=15)
JWT_REFRESH_TOKEN_LIFETIME_DAYS = env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)
```

Keep the generated `MIDDLEWARE`, `TEMPLATES`, and `AUTH_PASSWORD_VALIDATORS` blocks unchanged. **Remove** the generated SQLite `DATABASES` block and the hardcoded `SECRET_KEY = "django-insecure-..."` line — leaving that literal in the file would commit a secret-shaped value and violate the story's constraint.

**Create file: `backend/config/settings/dev.py`**

```python
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
```

**Create file: `backend/config/settings/prod.py`**

```python
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# No default: production must declare its hosts explicitly.
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

The `from .base import env` line in both files is **required** in addition to the star import — it keeps `env` resolvable for linters and readers regardless of how `__all__` evolves.

**Create file: `backend/.env.example`**

```dotenv
# Copy to backend/.env and fill in the blanks. Never commit backend/.env.
# Generate a secret key:
#   python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"

DJANGO_SETTINGS_MODULE=config.settings.dev
DJANGO_SECRET_KEY=
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_TIME_ZONE=UTC

# --- Local PostgreSQL (no Docker required) ---
POSTGRES_DB=supportos
POSTGRES_USER=supportos
POSTGRES_PASSWORD=
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_CONN_MAX_AGE=0

# --- JWT (consumed from AUTH-1 onward; values live here now) ---
JWT_SIGNING_KEY=
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

`DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, and `JWT_SIGNING_KEY` are **intentionally blank**. Because `SECRET_KEY = env("DJANGO_SECRET_KEY")` has no default, a developer who copies the example and skips the edit gets an immediate, explanatory failure rather than an insecure running app.

---

### 4 — Scaffold the Vite + React + TypeScript app

Run from the repository root:

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Keep the generated template as-is (`src/App.tsx`, `src/main.tsx`, the demo counter). Trimming the demo content and introducing `src/features/**` + `src/shared/**` is **FND-3's** scaffold task — leaving it alone here keeps the diff for this story reviewable.

**Create file: `frontend/.env.example`**

```dotenv
# Copy to frontend/.env and adjust if your backend runs elsewhere.
# Vite only exposes variables prefixed with VITE_ to client code.
VITE_API_BASE_URL=http://localhost:8000/api
```

**File: `frontend/src/vite-env.d.ts`**

Replace the generated single-line reference with a typed env surface, so a missing or misspelled variable is a **compile-time** error:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Create file: `frontend/src/config/env.ts`**

The single place in the app that touches `import.meta.env`. FND-3's Axios instance imports `env.apiBaseUrl` from here.

```ts
/**
 * The only module that reads `import.meta.env`. Everything else imports `env`
 * from here so a missing variable fails once, at boot, with a fixable message.
 */
type AppEnv = {
  readonly apiBaseUrl: string;
};

function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy frontend/.env.example to frontend/.env and fill it in.',
    );
  }
  return value.trim().replace(/\/+$/, '');
}

export const env: AppEnv = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL'),
};
```

The trailing-slash strip (`replace(/\/+$/, '')`) prevents `http://localhost:8000/api/` + `/tickets` from producing a double slash once FND-3 builds URLs on top of this value.

**File: `frontend/src/main.tsx`**

Add `import { env } from './config/env';` and, immediately after the existing imports, a single boot-time log so the value is verifiable from the browser console:

```tsx
if (import.meta.env.DEV) {
  console.info('[SupportOS] API base URL:', env.apiBaseUrl);
}
```

This import is what makes the missing-variable check actually run at boot. **Do not** wire an Axios client, router, or query provider here — FND-3.

---

### 5 — No other application changes

- **No database schema of our own.** `python manage.py migrate` applies only Django's built-in migrations. The first project migration arrives with FND-2's domain apps.
- **No API endpoints.** `backend/config/urls.py` keeps only `admin/`.
- **No frontend routes or data fetching.**

---

### 6 — Initialise git with `main` and `develop`

Run from the repository root. The directory is **not empty** — `.squad/`, `.claude/`, `.gitignore`, and `SupportOs backlog.MD` already exist and must all be part of the initial commit (except what `.gitignore` excludes).

```powershell
git init --initial-branch=main
git add -A
git status --short          # confirm no .env, no .venv/, no node_modules/ staged
git commit -m "chore: bootstrap monorepo with Django backend and Vite frontend"
git branch develop
```

Run `git status --short` **before** committing and confirm the staged list contains `backend/.env.example` and `frontend/.env.example` but **not** `backend/.env`, `frontend/.env`, `backend/.venv/`, or `frontend/node_modules/`. If `.env` appears, the `!.env.example` ordering in `.gitignore` is wrong — fix task 1 before committing.

Leave `main` checked out; do **not** add a remote or push (no remote has been specified for this project).

---

### 7 — Update the plan index and overview

**File: `.squad/plans/project-foundation-architecture/00-overview.md`** — replace the `_add rows as stories are planned_` placeholder row with the story row, and fill the **Dependency notes** section with the EPIC 0 sequence (FND-1 → FND-2 → FND-3 → FND-4) and the shared-spec IDs this story establishes (`ARCH` scaffold, `ENV`).

**File: `.squad/plans/00-index.md`** — replace the `_add rows per feature_` placeholder with a `project-foundation-architecture` row.

Both edits are applied as part of planning; verify them rather than re-writing them.

---

## Edge Cases & Failure Modes

- **`psql` / `createdb` not on `PATH`.** Verified true on this dev machine. Trigger: step 2 of the README. Symptom: `psql : The term 'psql' is not recognized`. Expected behaviour: the README § "1. Install and start PostgreSQL locally" gives the `$env:Path += ";C:\Program Files\PostgreSQL\17\bin"` fix and the permanent-PATH instruction. Enforced in `README.md` § 1 and § Troubleshooting.
- **PostgreSQL service not running.** Trigger: `python manage.py migrate`. Symptom: `django.db.utils.OperationalError: connection failed: ... could not connect to server`. Fix in README § Troubleshooting: `Get-Service postgresql*` / `Start-Service postgresql-x64-17` on Windows, `brew services start postgresql@16` on macOS.
- **`backend/.env` missing.** Trigger: `python manage.py migrate` immediately after clone. Symptom: `django.core.exceptions.ImproperlyConfigured: Set the DJANGO_SECRET_KEY environment variable`, raised by `env("DJANGO_SECRET_KEY")` in `backend/config/settings/base.py`. This is the **intended** behaviour — fail fast, never fall back to a default secret. Covered by test 2 in the Test Plan.
- **`DJANGO_SECRET_KEY` present but empty.** `django-environ` returns `""` for a bare `KEY=` line rather than raising. Django then boots with an empty signing key. Mitigation: README § 3 makes the `get_random_secret_key()` step explicit and mandatory, and the `.env.example` comment carries the generator command. Covered by test 3.
- **Wrong Postgres credentials or role missing.** Symptom: `FATAL: password authentication failed for user "supportos"` or `FATAL: database "supportos" does not exist`. Fix in README § Troubleshooting: re-run the § 2 SQL.
- **Password containing `@`, `:`, `/`, or `#`.** Handled by construction: the DB config uses **discrete** `POSTGRES_*` variables, not a `DATABASE_URL`, so no percent-encoding is needed and no character breaks parsing. Do **not** replace this with `env.db()` / `DATABASE_URL`.
- **Non-ASCII or quoted values in `.env`.** `django-environ` strips matched surrounding quotes and reads the file as UTF-8. Document in README § Environment variables: values must **not** be wrapped in quotes unless the quotes are part of the value.
- **`frontend/.env` missing or `VITE_API_BASE_URL` blank.** Trigger: `npm run dev` then loading the page. Expected behaviour: `requireEnv` in `frontend/src/config/env.ts` throws `Missing required environment variable "VITE_API_BASE_URL". Copy frontend/.env.example to frontend/.env and fill it in.` in the browser console at boot. Covered by test 8.
- **Frontend env changed while the dev server runs.** Vite reads `.env` only at server start; edits do **not** hot-reload. Expected behaviour: README § 4 states that `.env` changes require restarting `npm run dev`.
- **Port already in use.** `8000` (Django) or `5173` (Vite). Symptom: `Error: That port is already in use.` / Vite silently selecting `5174`. Expected behaviour: README § 5 documents `python manage.py runserver 8001` and `npm run dev -- --port 5174`, and warns that changing the backend port requires updating `VITE_API_BASE_URL` in `frontend/.env`.
- **`pnpm` not installed.** Verified true on this machine. Every frontend command in the README uses `npm`; no `pnpm-lock.yaml` is created. `frontend/package-lock.json` **is** committed.
- **`.env` accidentally staged.** Trigger: `!.env.example` placed before `.env.*` in `.gitignore`, so git ignores the examples and (with a stale index) can stage a real `.env`. Guard: the mandatory `git status --short` check in task 6.
- **`git init` in a non-empty directory.** `.squad/stories/**/attachments/`, `.squad/runs/`, and `.squad/secrets.yaml` are excluded by the squad-kit managed block (`.gitignore` lines 1–8). This is correct and must not be "fixed" — those paths are intentionally local-only.
- **Settings module resolved from the wrong place.** If `DJANGO_SETTINGS_MODULE` is exported in the shell **and** set in `backend/.env`, the shell wins — `read_env` does not overwrite pre-existing `os.environ` entries. Document in README § Environment variables so a stale shell export is a known suspect.
- **`BASE_DIR` off by one.** `Path(__file__).resolve().parents[2]` is correct **only** while `base.py` sits at `backend/config/settings/base.py`. Moving the settings package breaks both `read_env` and `STATIC_ROOT`. Covered by test 1.

---

## Test Plan

Use Django's **built-in** test runner. Do **not** add pytest, pytest-django, or vitest — FND-4 (`CONV`) owns the testing-convention decision (`SupportOs backlog.MD` lines 113–139).

**Create file: `backend/config/tests/__init__.py`** — empty.
**Create file: `backend/config/tests/test_settings.py`**

1. **Unit — `test_base_dir_points_at_backend_root`**: assert `settings.BASE_DIR.name == "backend"` and `(settings.BASE_DIR / "manage.py").exists()`. Catches the `parents[2]` off-by-one described above.
2. **Unit — `test_secret_key_is_required`**: with `mock.patch.dict(os.environ, {}, clear=True)`, call `environ.Env()("DJANGO_SECRET_KEY")` and assert it raises `django.core.exceptions.ImproperlyConfigured`. Proves the no-default contract holds.
3. **Unit — `test_secret_key_is_not_blank`**: assert `settings.SECRET_KEY.strip() != ""` and that it does **not** start with `"django-insecure-"`. Fails if the generated placeholder was left in `base.py` or the developer skipped the generator step.
4. **Unit — `test_database_reads_env_vars`**: assert `settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"`, that `NAME`/`USER` equal the current `POSTGRES_DB`/`POSTGRES_USER` env values, that `HOST` defaults to `"localhost"`, and that `PORT` is an `int`. Guards against the SQLite default surviving the edit and against `PORT` being a string.
5. **Unit — `test_jwt_settings_present`**: assert `settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES == 15` and `settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS == 7` with the `.env.example` values, and that both are `int`. Locks the env contract AUTH-1 will consume.
6. **Integration — `test_dev_settings_debug_true` / `test_prod_settings_debug_false`**: import `config.settings.dev` and `config.settings.prod` via `importlib` and assert `DEBUG` is `True` / `False` respectively, and that `prod` sets `SESSION_COOKIE_SECURE is True`. The `prod` import needs `DJANGO_ALLOWED_HOSTS` in the environment — set it inside the test with `mock.patch.dict`.
7. **Integration — database connectivity**: no test file; covered by `python manage.py migrate` in Verification Step 3, which fails loudly if local Postgres is unreachable. This is the story's actual "local Postgres connects on dev" outcome.
8. **Smoke (manual) — frontend env is read**: run `npm run dev` in `frontend/`, open `http://localhost:5173/`, and confirm the console logs `[SupportOS] API base URL: http://localhost:8000/api`. Then rename `frontend/.env` away, restart the dev server, reload, and confirm the `Missing required environment variable "VITE_API_BASE_URL"` error appears. Restore `.env` afterwards. Record both results in the story hand-off; an automated version lands with FND-3's test setup.
9. **Smoke (manual) — clean-clone reproducibility**: `git clone` the repository into a scratch directory and follow `README.md` top to bottom with no other knowledge. Both servers must start. Any step that needs a command not in the README is a **README bug** to fix in this story, not a note for later.

---

## Migration / Rollback

This story creates no application schema, but it does two irreversible-feeling things.

**Database.** `python manage.py migrate` creates Django's built-in tables (`auth_*`, `django_migrations`, `django_content_type`, `django_session`, `django_admin_log`) in the `supportos` database. Rollback: `DROP DATABASE supportos;` then re-run the § 2 SQL. Half-applied state: Django wraps each migration in a transaction, so `django_migrations` stays consistent if `migrate` fails partway — re-running `migrate` resumes correctly. No manual repair needed.

**Git history.** `git init` + first commit + `git branch develop`. Rollback before any push: delete `.git/` and re-run task 6. **Verify the commit contents before creating `develop`** — a secret committed in the first commit cannot be removed by a later commit, and rewriting the root commit means starting over. This is why the `git status --short` gate in task 6 is mandatory rather than advisory.

**What could go wrong on a half-applied state.** If `backend/` is scaffolded but `.gitignore` was not extended first, `git add -A` stages `backend/.venv/` (thousands of files) and possibly `backend/.env`. Order matters: **complete task 1's `.gitignore` edit before task 6**.

---

## Verification Steps

1. **Backend installs:** from `backend/` with the venv active — `pip install -r requirements.txt` — completes with no build errors (psycopg ships a wheel; no PostgreSQL client headers required).
2. **Backend builds:** from `backend/` — `python manage.py check` — reports `System check identified no issues (0 silenced).`
3. **Local Postgres connects and migrations apply:** from `backend/` — `python manage.py migrate` — prints `Applying contenttypes.0001_initial... OK` through the built-in migration set with no `OperationalError`. Re-running it prints `No migrations to apply.`
4. **Backend tests pass:** from `backend/` — `python manage.py test config` — all tests from the Test Plan green.
5. **Backend runs:** from `backend/` — `python manage.py runserver` — `http://127.0.0.1:8000/` shows Django's "The install worked successfully!" page and `http://127.0.0.1:8000/admin/` shows the login form.
6. **Frontend builds:** from `frontend/` — `npm run build` — exits 0 with no TypeScript errors (proves `ImportMetaEnv` and `src/config/env.ts` typecheck).
7. **Frontend runs:** from `frontend/` — `npm run dev` — `http://localhost:5173/` renders the Vite page and the console logs `[SupportOS] API base URL: http://localhost:8000/api`.
8. **Regression — no secrets tracked:** from the repository root — `git ls-files | Select-String -Pattern "\.env$"` returns nothing, and `git ls-files "*.env.example"` lists `backend/.env.example` and `frontend/.env.example`.
9. **Regression — branches exist:** `git branch --list` shows `develop` and `* main`.
10. **Regression — pre-existing files intact:** `git ls-files "SupportOs backlog.MD" ".squad/config.yaml"` lists both, and `Get-Content .gitignore -TotalCount 8` still matches the original squad-kit managed block.

---

## Done Criteria

- [ ] `backend/` contains a runnable Django project: `manage.py`, `config/urls.py`, `config/wsgi.py`, `config/asgi.py`, and a `config/settings/` package with `base.py`, `dev.py`, `prod.py`.
- [ ] `frontend/` contains a runnable Vite + React + TypeScript app with a committed `package-lock.json`.
- [ ] Root `README.md` documents the full local-run sequence — install Postgres, create DB and role, venv, install deps, copy `.env.example`, run migrations, start both servers — with **no Docker step**, and a § "Docker (optional, future)" note stating Docker is not required.
- [ ] `backend/.env.example` defines `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `DJANGO_SECRET_KEY`, and the three `JWT_*` keys, with secret-bearing values blank.
- [ ] `frontend/.env.example` defines `VITE_API_BASE_URL`.
- [ ] No hardcoded `django-insecure-` secret survives anywhere under `backend/`; `git ls-files` lists no `.env` file.
- [ ] `.gitignore` ignores `.env`, `.venv/`, `node_modules/`, and build output, un-ignores `.env.example`, and its first 8 lines (the squad-kit managed block) are unchanged.
- [ ] `python manage.py migrate` succeeds against local PostgreSQL from a clean `supportos` database (Verification Step 3).
- [ ] `python manage.py test config` is green (Verification Step 4).
- [ ] `npm run build` succeeds with no TypeScript errors (Verification Step 6).
- [ ] `git branch --list` shows both `main` and `develop`.
- [ ] A clean clone runs both apps following `README.md` only (Test Plan step 9).
- [ ] `00-overview.md` and `00-index.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 02 (FND-2 — Backend Foundation).**
