# SupportOS

SupportOS is an all-in-one customer support platform: customers, tickets, multi-channel
communications, agent workspace, SLAs, knowledge base, and reporting in one system. This
repository is a monorepo holding the Django API and the React web client side by side.

**Frontend:** React · Vite · TypeScript · Tailwind CSS · shadcn/ui · React Router · TanStack Query · React Hook Form · Zod · Axios · i18next
**Backend:** Django · Django REST Framework · PostgreSQL (locally installed; **Docker optional, not required**)

> Some of the libraries listed above arrive in later stories. What is wired up **today** is the
> monorepo layout, the environment/config strategy, a runnable Django project, and a runnable
> Vite app. See `SupportOs backlog.MD` for the full roadmap.

Before writing new code, read [`CONVENTIONS.md`](CONVENTIONS.md) — the single source of truth
for folder structure, naming, API conventions, logging, linting, and more. Cite it instead of
re-deriving a standard.

---

## Repository layout

```text
.
├── backend/                Django project (API). Settings split base/dev/prod, all config from env.
│   ├── apps/               Domain apps, one per business area — see apps/README.md for the rule.
│   │   ├── core/           Cross-cutting: response envelope, exception handler, pagination, health.
│   │   └── …               customers, tickets, communications, agents, sla, knowledge_base, …
│   ├── config/             Django project package: settings/, urls.py, api_urls.py, wsgi.py, tests/
│   ├── .env.example        Backend environment contract — copy to backend/.env
│   ├── manage.py           Django CLI entry point
│   └── requirements.txt    Python runtime dependencies
├── frontend/               React + Vite + TypeScript web client
│   ├── src/app/            Router, providers, root shell
│   ├── src/features/       One folder per feature — see src/README.md for the rule
│   ├── src/shared/         Cross-feature ui/, lib/api/ (the one Axios instance), hooks/
│   ├── src/config/env.ts   The only module that reads import.meta.env
│   └── .env.example        Frontend environment contract — copy to frontend/.env
├── .squad/                 squad-kit: story intakes, implementation plans, project config
├── SupportOs backlog.MD    Full product backlog (epics → stories → tasks) and shared specs
├── CONVENTIONS.md          The CONV spec — single source of truth, reference-based
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

### Migrations

```powershell
python manage.py makemigrations                     # after changing any models.py
python manage.py migrate                            # apply to local PostgreSQL
python manage.py makemigrations --check --dry-run    # CI guard: fails if a model change has no migration
python manage.py showmigrations                      # what is applied
python manage.py migrate <app> <number>              # roll one app back
```

**Commit a migration in the same commit as the model change that caused it.** A model change
without its migration is a broken tree for everyone else; `makemigrations --check --dry-run` is the
guard, and there is a test enforcing it (`config/tests/test_settings.py`,
`MigrationStateTests`).

The domain apps have no models yet, so `makemigrations` correctly reports **`No changes
detected`**. `apps.core.models.TimeStampedModel` is abstract and produces no migration either. Do
**not** hand-write an empty initial migration to make the tree look complete — the first real
migration arrives with the first domain model.

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

## Enable the pre-commit hook

Run once per clone:

```powershell
git config core.hooksPath .githooks
```

This runs `ruff format --check` / `ruff check` (backend) and `oxlint` / `prettier --check`
(frontend) before every commit, whole-tree, using only `--check` variants — it never rewrites
files for you. It skips a language's checks gracefully if that app hasn't been set up yet
(`backend/.venv` or `frontend/node_modules` missing), so a fresh clone's first commit is never
blocked before setup.

**The hook is per-clone, not committed** — git does not let a repository configure its own hooks
path, so a new clone has no hook until this command is run. The real gate is CI
(`.github/workflows/lint.yml`), which runs on every push regardless. `git commit --no-verify`
skips the hook once; that should be rare.

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

## 6. Run Celery (optional, SLA-0)

Nothing in this project dispatches a real background task yet — skip this
section until a feature needs it. `config.celery.debug_task` exists purely
as a wiring smoke test.

### Install and start Redis locally

**Windows** — install [Memurai Developer](https://www.memurai.com/get-memurai)
(a free, Redis-protocol-compatible Windows service) or install Redis itself
inside WSL2 and follow the Debian/Ubuntu instructions below. Either way, you
end up with something answering on `localhost:6379`.

**macOS**

```bash
brew install redis
brew services start redis
```

**Debian / Ubuntu**

```bash
sudo apt install redis-server
sudo systemctl enable --now redis-server
```

Confirm it answers before moving on:

```powershell
redis-cli ping   # expect PONG
```

### Run the worker and the scheduler

Two more terminals, backend venv active in both, from `backend/`:

| Terminal | Command | Purpose |
|---|---|---|
| Worker | `celery -A config worker -l info` | Executes tasks. **Windows:** append `--pool=solo` — Celery's default `prefork` pool needs `fork()`, which Windows does not have; the worker otherwise hangs or errors on startup. |
| Beat | `celery -A config beat -l info` | Dispatches scheduled/periodic tasks, read from the database (`django-celery-beat`). Starts cleanly with an empty schedule — nothing is scheduled yet. |

Prove the whole chain works:

```powershell
python manage.py shell -c "from config.celery import debug_task; debug_task.delay()"
```

The worker terminal should log the task being received and executed within a
second or two.

---

## Languages

SupportOS supports **English** and **Arabic**. Switch languages with the selector rendered at
the top of the app; the choice persists across reloads, and layout direction (`ltr`/`rtl`)
follows the active language automatically — no per-page or per-component work is needed.

Backend error messages localise through the `Accept-Language` header, which the frontend sends
automatically. See `CONVENTIONS.md` § 18 for the full internationalization rules, including how
to add a translation namespace for a new feature.

---

## Design system

SupportOS uses Tailwind CSS v4 and shadcn/ui. Add a new primitive with `npx shadcn@latest add
<name>` from `frontend/` — the CLI writes into `frontend/src/shared/ui/primitives/` per
`frontend/components.json`. After every `shadcn add`, run `npm run check:rtl`: shadcn's generated
components are not RTL-clean, and this script is the CI gate that catches a physical (left/right)
CSS property before it ships.

A light/dark/system theme toggle sits next to the language switcher; the choice persists across
reloads with no flash, the same way the language choice does. See `CONVENTIONS.md` § 19 for the
full design-system rules, including why `@tanstack/react-table` and `sonner` are deliberately not
installed.

Forms are React Hook Form + Zod, composed from the shared field components in
`frontend/src/shared/ui/form/` via the single `useAppForm` entry point. Validation messages are
localised through an i18next namespace backed by Zod's own translated locale as a fallback, so a
form reads like product copy in both English and Arabic rather than Zod's developer-facing
defaults. See `CONVENTIONS.md` § 20 for the full rules and a worked example.

`DSN` — an AI-generated design system tailored to SupportOS's own product description, produced
by the `ui-ux-pro-max` Claude Code skill (`.claude/skills/ui-ux-pro-max/`) — lives at
`design-system/supportos/MASTER.md`, with the token-by-token reconciliation against the `UI`
tokens above in `CONVENTIONS.md` § 25.

---

## API conventions

Every response from the `/api/` tree — success or failure — has the same four top-level keys.
All four are always present, so a client discriminates on `success` without probing for optional
keys.

### Success

`GET /api/health/`:

```json
{
  "success": true,
  "data": { "status": "ok", "database": "ok" },
  "error": null,
  "meta": null
}
```

### Error

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "validation_error",
    "message": "The submitted data is invalid.",
    "fields": { "email": ["Enter a valid email address."] }
  },
  "meta": null
}
```

`error.fields` is **always an object** — empty for errors that are not field-scoped, and
`{"non_field_errors": [...]}` when a validation error has no field to attach to. Client code never
needs a null check on it.

### Paginated

```json
{
  "success": true,
  "data": [ { "id": 1 }, { "id": 2 } ],
  "error": null,
  "meta": {
    "pagination": {
      "count": 137,
      "page": 2,
      "page_size": 25,
      "num_pages": 6,
      "next": "http://localhost:8000/api/tickets/?page=3",
      "previous": "http://localhost:8000/api/tickets/?page=1"
    }
  }
}
```

The pagination block lives under `meta`, **not** at the top level — DRF's default flat
`{count, next, previous, results}` shape is deliberately replaced. `?page_size=` is accepted up to
`DRF_MAX_PAGE_SIZE`; larger values are clamped, not rejected.

### Error codes

| `error.code` | HTTP |
|---|---|
| `validation_error` | 400 |
| `parse_error` | 400 |
| `not_authenticated` | 401 |
| `authentication_failed` | 401 |
| `token_not_valid` | 401 |
| `permission_denied` | 403 |
| `not_found` | 404 |
| `method_not_allowed` | 405 |
| `not_acceptable` | 406 |
| `unsupported_media_type` | 415 |
| `throttled` | 429 |
| `internal_error` | 500 |

### The rule for view authors

**Return plain payloads. Never build an envelope in a view.**

`apps.core.renderers.EnvelopeJSONRenderer` wraps every success and
`apps.core.exceptions.envelope_exception_handler` wraps every error, so a hand-built envelope is
passed straight through and the shape drifts. Raise DRF exceptions
(`NotFound`, `ValidationError`, `PermissionDenied`) rather than returning hand-made error bodies.
`apps/core/views.py::HealthView` is the reference implementation.

Two more notes:

- **`error.debug` appears only when `DEBUG` is true.** It carries the exception repr and traceback
  for unhandled server errors so a developer is not left guessing. Client code must never depend on
  it — it is absent in production by design.
- **The envelope covers the `/api/` tree, not the whole app.** Failures raised outside a DRF view —
  in middleware, in `/admin/`, or in a plain Django view — return Django's normal HTML error page,
  because DRF's exception handler is never consulted there. Unmatched paths *under* `/api/` are
  handled: `config/api_urls.py` routes them through `ApiNotFoundView` so a typo'd endpoint still
  answers with an enveloped 404 rather than HTML.

### The public API, API keys, and OpenAPI docs (INT-1)

The whole `/api/` tree is the public API. There is no second, "external" surface — an outside
system calls the same endpoints the frontend does, and sees the same envelope.

| URL | What it is |
|---|---|
| `/api/schema/` | The OpenAPI 3 document (YAML). `?format=json` for JSON. |
| `/api/docs/` | Swagger UI, with an **Authorize** button for both auth schemes. |
| `/api/redoc/` | ReDoc, for reading rather than trying calls. |

All three are public by default. Set `API_DOCS_PUBLIC=False` to narrow them to authenticated
callers.

**Two ways to authenticate, one authorization model.**

```
Authorization: Bearer <JWT access token>     # a signed-in staff user (POST /api/auth/token/)
Authorization: Api-Key <key>                 # an external system
```

An API key resolves to the `accounts.User` it was issued for, and **inherits exactly that user's
role permissions** — including portal customer scoping, if the user is a portal identity. To narrow
what a key may do, issue it against a narrowly-roled user; there are no per-key scopes.

**Issuing a key** (requires `api_keys.manage`, held by `admin`):

```
POST /api/api-keys/
{"name": "Acme ERP", "user": 7, "expires_at": null}
```

The response's `data.key` is the plaintext, e.g. `sos_3f9a1c04.7b2e…`. **It is returned exactly
once** — only `prefix` and a SHA-256 digest are stored, so a lost key is replaced, never recovered.

**Revoking** is `DELETE /api/api-keys/<id>/`, which sets `is_active` to false rather than deleting
the row, so `last_used_at` and the issue date stay auditable. `PATCH {"is_active": true}` reverses
it. An expired (`expires_at` in the past) or revoked key returns `401 authentication_failed`.

### ERP sync (INT-2)

`/settings/erp` (permission `integrations.manage`) configures one ERP connection: base URL,
bearer token, and two **field maps** translating the ERP's field names to SupportOS ones. Nothing
is contacted until **Enabled** is on and a base URL is set.

| Endpoint | What it does |
|---|---|
| `GET`/`PATCH` `/api/erp/connection/` | The singleton config. `auth_token` is write-only — send `""` (or omit it) to keep the stored one. |
| `POST /api/erp/sync/` | Enqueues a sync (`{"direction": "import"｜"export"}`); returns `202`. |
| `GET /api/erp/sync-runs/` | Run history with per-entity counters. |
| `GET /api/erp/orders/?customer=<id>` | The read-only order mirror. |

**Direction.** Import pulls ERP customers onto `customers.Customer` (upserted by
`Customer.external_id`) and ERP orders onto `integrations.ErpOrder`. Export pushes SupportOS
customers that have no `external_id` yet and stores the id the ERP returns. **Orders are never
exported** — the ERP owns them, and nothing in SupportOS creates one.

**The assumed ERP contract** is `GET /customers`, `GET /orders`, `POST /customers`, bearer auth,
each response either a bare JSON array or `{"results": [...]}`. Different field names are
configuration; different paths or auth mean editing `apps/integrations/erp_client.py`.

**Schedule.** `apps/integrations/migrations/0003_seed_erp_sync_schedule.py` seeds an hourly,
enabled `PeriodicTask` for the import. It is inert until the connection is configured. Change the
interval in `/admin/` (`django-celery-beat`), never in settings — `CONVENTIONS.md` § 24. **A
Celery worker must be running** for any sync to happen (`README.md` § 6; on Windows,
`celery -A config worker --pool=solo`).

### Messaging provider config (INT-3)

`/settings/channels` (permission `communications.manage`) configures the three outbound
messaging providers `EmailAdapter`/`WhatsAppAdapter`/`SMSAdapter` send through — one screen, three
independent config rows.

| Endpoint | Provider |
|---|---|
| `GET`/`PATCH` `/api/providers/email/` | SMTP host/port/user/password, TLS, from address. |
| `GET`/`PATCH` `/api/providers/whatsapp/` | Meta WhatsApp Business (Cloud) API base URL, phone number id, access token. |
| `GET`/`PATCH` `/api/providers/sms/` | Twilio API base URL, Account SID, Auth Token, from number. |

Each credential field (`host_password`, `access_token`, `auth_token`) is write-only — the API
never returns it, only a `has_*` boolean. Sending `""` or omitting the field on `PATCH` leaves the
stored credential untouched.

**Scope, deliberately:** this config is read only by the three channel adapters' `send()` methods
— not by invite/password-reset email (`apps.accounts.tasks`) or notification email
(`apps.notifications.tasks`), which continue reading the `EMAIL_*` environment variables below
unchanged. An operator using the same SMTP account for both configures it in two places today; see
`CONVENTIONS.md` § 31.

**One coupling worth knowing:** Twilio's Auth Token is dual-purpose — `SmsProviderConfig.auth_token`
is used both by `SMSAdapter.send()` (outbound Basic Auth) and by `SMSInboundWebhookView` (inbound
`X-Twilio-Signature` verification). Rotating it in the UI takes effect for both immediately.

### Consuming the API from the frontend

**The rule:** features call `api.get` / `api.post` / `api.put` / `api.patch` / `api.delete` /
`api.getPage` from `@/shared/lib/api/client`. Never `httpClient` directly, never `fetch`, never a
second `axios.create` anywhere in `src/`. That module is the only place the frontend talks to the
network — see `frontend/src/README.md` for the full placement rule.

**Errors.** Every failure — an envelope error, an HTTP error whose body is not an envelope, a
network failure, a timeout, or a malformed 200 — reaches the caller as one `ApiRequestError`
(`code`, `status`, `fields`, `message`). Four codes are client-only and never sent by the backend:

| Code | Meaning |
|---|---|
| `network_error` | No response reached the client at all. |
| `timeout` | The request exceeded its timeout. |
| `invalid_envelope` | A `200` whose body is not `{success, data, error, meta}` — most often a misconfigured `VITE_API_BASE_URL` pointing at something that isn't this API. |
| `unknown_error` | An HTTP error whose body is not an envelope (e.g. a proxy's HTML page). |

**Rendering.** Wrap query results in `<QueryBoundary query={...}>{data => ...}</QueryBoundary>`
(`@/shared/ui/QueryBoundary`). It renders `Loading`, `ErrorState`, or `Empty` consistently — do not
hand-roll `isPending`/`isError` branches in a feature.

**Toasts.** Mutations toast on error automatically. Queries render inline via `QueryBoundary` and
only toast when they opt in with `meta: { toastOnError: true }` on the `useQuery` call. A
user-initiated mutation that fails silently reads as success, which is why mutations always toast;
a toast per query error would be noise for anything already rendering inline.

**Retries.** Transport failures (`network_error`, `timeout`) and `5xx` responses retry up to twice.
A `4xx` never retries — a `404` or a validation error will not become true by asking again.

**Query keys.** `[feature, resource, ...discriminators]`, built with `featureKey('feature')` from
`@/shared/lib/api/queryKeys`, so a feature's whole cache can be invalidated as a unit.

**Mutations & invalidation.** Every mutation invalidates its feature's whole key prefix
(`featureKey('feature').all`) on success — never an individual page or detail key. A create changes
which rows land on which page, an edit can change sort position, and a delete shifts every later
page, so invalidating one cache entry would leave the others stale. See
`frontend/src/features/customers/api/useCustomerMutations.ts` for the pattern. Edits use `api.patch`,
not `api.put`: DRF drops an absent optional field from `validated_data` on either method, so a PUT
cannot clear a value by omission — PATCH's "only what I sent" semantics are what an edit form
actually means, and a field is cleared by sending its value explicitly (`null` or `''`), never by
leaving the key out. **Exception:** a non-paginated child resource scoped to one parent (e.g. a
customer's contact channels) may invalidate only its own scoped key instead of the whole feature
prefix, when a write cannot affect a sibling query — see
`frontend/src/features/customers/api/useContactDetailMutations.ts`.

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
| `REDIS_URL` | no | `redis://localhost:6379/0` | Redis connection string — Celery's broker and result backend (SLA-0). |
| `JWT_SIGNING_KEY` | no | `DJANGO_SECRET_KEY` | JWT signing key. Read now, consumed once JWT auth lands. |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | no | `15` | Access-token lifetime. |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | no | `7` | Refresh-token lifetime. |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | Origins allowed to call the API from a browser. |
| `CORS_ALLOW_CREDENTIALS` | no | `True` | Allow cookies/auth headers on cross-origin requests. |
| `DRF_PAGE_SIZE` | no | `25` | Default page size for list endpoints. |
| `DRF_MAX_PAGE_SIZE` | no | `100` | Ceiling for the `?page_size=` query parameter. |
| `DJANGO_LOG_LEVEL` | no | `INFO` | Level for the `apps.*` logger tree. See `CONVENTIONS.md` § Logging. |
| `DJANGO_SECURE_SSL_REDIRECT` | no | `True` | **Prod only.** Redirect HTTP to HTTPS. |
| `DJANGO_SECURE_HSTS_SECONDS` | no | `31536000` | **Prod only.** HSTS max-age. |
| `EMAIL_HOST` | no | *(empty)* | SMTP host. Ignored in dev (console backend); needed in prod for real delivery. System email only (invite, password reset, notifications) — ticket-reply email now reads its own DB-stored config (INT-3). |
| `EMAIL_PORT` | no | `587` | SMTP port. System email only — see `EMAIL_HOST` row. |
| `EMAIL_HOST_USER` | no | *(empty)* | SMTP auth username. System email only — see `EMAIL_HOST` row. |
| `EMAIL_HOST_PASSWORD` | no | *(empty)* | SMTP auth password. System email only — see `EMAIL_HOST` row. |
| `EMAIL_USE_TLS` | no | `True` | Use STARTTLS for SMTP. System email only — see `EMAIL_HOST` row. |
| `DEFAULT_FROM_EMAIL` | no | `support@example.com` | `From` address for outbound email. System email only — see `EMAIL_HOST` row. |
| `EMAIL_INBOUND_LOCAL_PART` | no | `support` | Local-part of the inbound routing address, before the `+<ticket id>` tag. |
| `EMAIL_INBOUND_DOMAIN` | no | `support.example.com` | Domain of the inbound routing address a reply-to uses. |
| `EMAIL_INBOUND_WEBHOOK_TOKEN` | no | *(empty — endpoint rejects every request until set)* | Shared secret `EmailInboundWebhookView` requires as `?token=`. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | no | *(empty — verification handshake rejects every request until set)* | Shared secret Meta's `GET` webhook-verification handshake checks against `hub.verify_token`. |
| `WHATSAPP_APP_SECRET` | no | *(empty — inbound webhook rejects every request until set)* | Meta App Secret used to verify the `X-Hub-Signature-256` header on every inbound `POST`. |
| `SMS_WEBHOOK_URL` | no | *(empty — inbound webhook rejects every request until set)* | The exact URL configured in the Twilio console for the inbound SMS webhook — used, not reconstructed, because Twilio's signature depends on it. |
| `MEDIA_ROOT` | no | `<repo>/backend/media` | Filesystem path where uploaded `Attachment` files are stored. No `MEDIA_URL` — files are served only through the permission-gated `AttachmentViewSet.download` action. |
| `ANTHROPIC_API_KEY` | no | *(empty — AI features refuse to run until set)* | API key for Anthropic's Claude API — the one AI provider integration point (AI-0). |
| `AI_MODEL` | no | `claude-opus-5` | Claude model id `apps.ai.client.generate_completion` uses by default. |
| `API_DOCS_PUBLIC` | no | `True` | Whether `/api/schema/`, `/api/docs/`, `/api/redoc/` are reachable without credentials. `False` narrows all three to `IsAuthenticated` (INT-1). |

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

**`ModuleNotFoundError: No module named 'customers'` (or any other app name) at startup**
That app's `apps.py` still has `startapp`'s generated `name = "customers"`. Because the apps live
under the `apps` package it must be `name = "apps.customers"`. See `backend/apps/README.md`.

**A request from the browser fails with a CORS error but `curl` works fine**
`corsheaders.middleware.CorsMiddleware` must be the **first** entry in `MIDDLEWARE`. Below
`CommonMiddleware` it still boots and still passes the backend tests, then fails only in a real
browser. Add the calling origin to `CORS_ALLOWED_ORIGINS` if it is not `localhost:5173`.

**The Celery worker hangs or exits immediately on Windows**
Missing `--pool=solo`. Celery's default `prefork` pool requires `fork()`,
which Windows does not provide. See [§ 6](#6-run-celery-optional-sla-0).

**`redis.exceptions.ConnectionError: Error connecting to localhost:6379`**
Redis is not installed or not running locally. See
[§ 6](#6-run-celery-optional-sla-0) — confirm `redis-cli ping` answers `PONG`
first.

**An `/api/` request returns HTML instead of JSON**
Unmatched paths under `/api/` are routed through `ApiNotFoundView` and answer with an enveloped
404, so HTML means the failure happened outside a DRF view — middleware, `/admin/`, or a plain
Django view. That is expected; see § API conventions.

**`.squad/` files appear to be missing from git**
Intentional. `.squad/secrets.yaml`, `.squad/runs/`, `.squad/.trash/`, and story `attachments/`
are excluded by the squad-kit managed block at the top of `.gitignore`. Do not "fix" this.

---

## Docker (optional, future)

Docker is **not** required to run SupportOS. No `Dockerfile` or compose file ships with this
repository today, and none of the steps above needs one. If container files are added later they
are strictly an optional convenience — the local-PostgreSQL steps above remain the supported path
for local development.
