# Story 93 — Optional Docker Packaging (PROD-4) (Story: SUPPORTOS-119)

## Prerequisites

- **Stories 88, 91 and 92 (`PROD-1`/`PROD-2`/`PROD-3`) are complete and committed** (`3da9f28`, `f164c78`, `698fa25`). This is the **last story in EPIC 17**, and the only one of the four that adds no runtime behaviour to the application at all — it packages what the other three hardened. Nothing in `apps/` or `frontend/src/` changes.
- **Scope confirmed with the user this session: a dev-parity Compose stack only.** One `docker-compose.yml` that runs *the same commands developers already run locally* inside containers, as a drop-in alternative to the manual PostgreSQL/Redis/Python/Node setup in `README.md` §§ 1-6. **No production Compose file, no nginx, no reverse proxy, no TLS story, no `config.settings.prod` container.** That was offered and declined, and the reason it is the right call is recorded in `## Story Goal` — a production topology would require this repo to make several architectural decisions (static-file serving under `DEBUG=False`, SSL-redirect policy behind a plain-HTTP proxy, a `NUM_PROXIES` value) that it has never made and that nothing in this story can verify.
- **Verified live: Celery is load-bearing, not optional.** `grep -rln "\.delay(\|shared_task" backend/apps` returns **15 modules** — `accounts/tasks.py` (invite + password-reset email), `sla/tasks.py`, `notifications/tasks.py`+`services.py`, `ai/tasks.py`+`chatbot.py`, `integrations/tasks.py`+`webhook_dispatch.py`, `agents/tasks.py`, plus six view/serializer modules that dispatch them. `README.md` § 6 still calls Celery *"optional"* and says *"Nothing in this project dispatches a real background task yet"* — **that sentence is stale**, and a Compose stack claiming parity that omitted the worker and beat would silently break invite emails, SLA escalation, auto-assignment, notifications, AI jobs, and webhook delivery. The worker and beat are services in this stack, not extras. Task 6 fixes the stale README sentence.
- **Verified live, and it is the hardest constraint in this story: the backend service must never be scaled beyond one replica.** `config/settings/base.py:508-512` sets `CHANNEL_LAYERS` to `channels.layers.InMemoryChannelLayer`, and the comment at 502-506 says so deliberately: *"InMemoryChannelLayer is single-process only — a deliberate scope limit… CHANNEL_LAYERS does not (yet) reuse [Redis]."* Two backend replicas means a WebSocket broadcast reaches only the clients connected to the replica that produced it — live chat (COMM-3) and notification push (SLA-4) would half-work with no error anywhere. **`docker compose up --scale backend=2` is a broken configuration**, and `## Edge Cases` plus `CONVENTIONS.md` § 37 both say so explicitly.
- **Verified live: environment precedence makes this design safe.** `django-environ`'s `read_env()` docstring (`environ/environ.py:1064-1066`) states *"Existing environment variables take precedent and are NOT overwritten by the file content"*, and its missing-file branch (`:1104-1108`) logs and returns rather than raising. `config/settings/base.py:22` calls `environ.Env.read_env(BASE_DIR / ".env")` where `BASE_DIR` is `backend/`. So: Compose's `environment:`/`env_file:` values become real OS environment variables before Python starts and **always win**, while a bind-mounted `backend/.env` (if the developer already has one from the non-Docker path) harmlessly supplies anything Compose does not set, and its absence is a no-op rather than a crash. This is what lets the Docker path be self-contained *without* forbidding a coexisting `.env`.
- **Verified live: `manage.py runserver` is this project's intended ASGI entrypoint, so the container uses it too.** `config/settings/base.py:35-37` puts `"daphne"` first in `DJANGO_APPS` with the comment *"Must precede django.contrib.staticfiles — Channels' own documented setup requirement — **so manage.py runserver becomes ASGI/WebSocket-aware**."* The container therefore runs the identical `python manage.py runserver` the README already documents — not a bare `daphne config.asgi:application` invocation, which would additionally lose the static-file serving `/admin/` and `/api/docs/` depend on (Django's DEBUG static-serving is a `runserver` feature, not an ASGI-application feature). Using the same command is both simpler and the literal definition of parity.
- **Verified live: no Docker artifact exists to conflict with.** `find . -maxdepth 2 -iname "*docker*"` returns nothing. `README.md:887-891` currently states *"No `Dockerfile` or compose file ships with this repository today"* — task 6 rewrites that section, and it is the one existing claim this story makes false.
- **Docker Desktop is installed on this machine but its daemon was not running during planning** (`docker --version` → 20.10.22, `docker compose version` → v2.15.1, `docker info` → *"the docker daemon is not running"*). **Nothing in this plan was boot-tested.** Every claim below is verified against real source — this project's settings, `django-environ`, DRF, Channels, Vite's documented dev-server behaviour — and `## Verification Steps` is written for the executor to run for real. Do not read any statement here as "already observed working end to end"; that is exactly what step 1-12 exist to establish.
- **Compose feature-compatibility matters here.** The CLI on this machine is **v2.15.1**, which predates `depends_on: condition: service_completed_successfully` (added in Compose v2.17.0). This plan therefore **does not use a one-shot `migrate` init service**, and instead gates the worker and beat on the backend's own healthcheck — a pattern supported far further back. See task 3.

---

## Story Goal

Give a developer a second, entirely optional way to run SupportOS — `docker compose up` — that starts the same six processes the README already describes, with **zero changes to application code, settings modules, or the non-Docker instructions**:

1. **`postgres` and `redis` as containers**, replacing README §§ 1-2's manual PostgreSQL install and § 6's Redis install for anyone who would rather not install them. The official `postgres` image creates the database and role from `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` on first start, which is exactly the `CREATE ROLE`/`CREATE DATABASE` SQL at `README.md:114-120`, automated.
2. **`backend`, `worker` and `beat`** running `manage.py runserver`, `celery -A config worker` and `celery -A config beat` — the same three commands from `README.md:246` and `:300`.
3. **`frontend`** running `npm run dev`, the same command as `README.md:247`.
4. **Both paths run side by side without collision.** Every host port is deliberately offset (`5433`, `6380`, `8001`, `5174`) so a developer with a local PostgreSQL, Redis, `runserver` and Vite already running can start the Docker stack without stopping any of them. **`8001` and `5174` are not arbitrary — they are the exact alternate ports `README.md:252-255` already documents** for the "if a port is taken" case.
5. **Live code reload is preserved**, because bind-mounted source is what makes this parity rather than a slower, worse way to develop.
6. **The documentation stops lying.** `README.md` § Docker currently says no compose file ships; § 6 currently says Celery is optional and nothing dispatches tasks. Both are now false.

### Why there is no production Compose file

`README.md`'s own framing — *"If container files are added later they are strictly an optional convenience"* — and the backlog's *"must not become required for local dev; local (non-Docker) path stays first-class"* both describe a convenience, not a deployment architecture. Building a production stack now would mean inventing, unverified, three decisions this repo has deliberately never made:

- **Static files under `DEBUG=False` are currently served by nothing.** There is no `whitenoise` (verified: absent from `requirements.txt`), no `staticfiles_urlpatterns()` in `config/urls.py` (verified: it contains only `admin/` and `api/`), and Django's DEBUG static-serving is a `runserver` feature that a direct ASGI invocation does not get. `/admin/` and `/api/docs/` would render unstyled. Fixing that means either a new dependency or an nginx volume-sharing design.
- **`config/settings/prod.py:11` sets `SECURE_SSL_REDIRECT` to `True` by default.** Behind a plain-HTTP local nginx that never sets `X-Forwarded-Proto: https`, that is an immediate redirect loop, so a production Compose file would need a `DJANGO_SECURE_SSL_REDIRECT=False` override that only makes sense for a fake, TLS-less "production."
- **`PROD-3` made `DJANGO_NUM_PROXIES` load-bearing for every rate limit** (`CONVENTIONS.md` § 36). A reverse proxy in front of Django means it must become `1` — a value that is only correct for that one topology and silently wrong for any other.

None of those are hard problems. They are simply **a different story**, with decisions that deserve to be made on purpose rather than smuggled in under "optional packaging."

### What this story does not do

- **No production/staging Compose file, Dockerfile stage, nginx config, or TLS.** See above.
- **No `config.settings.prod` container.** The stack runs `config.settings.dev`, unchanged, because that is what parity with local development means.
- **No application code changes.** Not one file under `backend/apps/`, `backend/config/`, or `frontend/src/`. `getWebSocketUrl` (`frontend/src/shared/lib/ws.ts`) keeps working untouched precisely because the topology stays cross-origin — see `## Edge Cases`.
- **No new Python or npm dependency.** Nothing is added to `requirements.txt` or `package.json`.
- **No change to `backend/.env.example` or `frontend/.env.example`.** The Docker path gets its own `.env.docker.example`; the non-Docker contract is untouched.
- **No CI integration.** `.github/workflows/lint.yml` is not modified to build images.
- **No image publishing, registry, tagging, or multi-arch build strategy.** This is a local convenience.
- **No `docker compose --scale`.** Structurally unsafe here (`InMemoryChannelLayer`), and documented as such rather than left to be discovered.

---

## Context — Read These Files First

1. `.squad/stories/production-readiness/SUPPORTOS-119/intake.md` — one description line, no acceptance criteria, empty `attachments/`. `SupportOs backlog.MD:967-969` (`STORY (PROD-4)`) is the same text, including the two constraints that decide this story's whole shape: *"must not become required for local dev; local (non-Docker) path stays first-class."*
2. `README.md` **lines 240-260** (§ 5 "Run both apps together") — the two-terminal table (`python manage.py runserver` → `:8000`, `npm run dev` → `:5173`) and the **"If a port is taken" block at 252-255 that already names `8001` and `5174`**. The Compose host ports are those, not new numbers. Read `:257-258` too: *"Changing the backend port means updating `VITE_API_BASE_URL`… to match"* — that is exactly what the `frontend` service's `environment:` does.
3. `README.md` **lines 262-313** (§ 6 "Run Celery (optional, SLA-0)") — the worker/beat commands at `:300`, the **`--pool=solo` Windows note**, and the now-stale opening claim that nothing dispatches real tasks. Task 3 reuses the commands; task 6 fixes the claim. **The `--pool=solo` flag must NOT be copied into the container** — see `## Edge Cases`.
4. `README.md` **lines 104-127** (§ 2 "Create the database and role") — the `CREATE ROLE`/`CREATE DATABASE`/`ALTER ROLE` SQL the `postgres` image's own `POSTGRES_*` env vars replace, and the note at `:124-126` that `supportos` as a password is *"a local-only convenience"*. `.env.docker.example` takes the same posture, for the same reason.
5. `README.md` **lines 887-891** (§ "Docker (optional, future)") — the section task 6 rewrites. Its current text is the one factual claim this story invalidates.
6. `README.md` **lines 46-61** (Prerequisites) — the version table (PostgreSQL 16, Python 3.12, Node 20) that fixes the image tags, and line 61's *"Docker is not required"* pointer, which must survive this story intact.
7. `backend/config/settings/base.py` **line 22** (`environ.Env.read_env(BASE_DIR / ".env")`) and **line 19** (`BASE_DIR = Path(__file__).resolve().parents[2]`, i.e. `backend/`) — together these are why a bind-mounted `backend/.env` is visible at `/app/.env` inside the container, and why that is harmless.
8. `backend/config/settings/base.py` **lines 122-132** (`DATABASES`) — `POSTGRES_HOST` defaults to `localhost` (`:128`), which is wrong inside the Compose network and is therefore one of the keys the `backend` service must override. Note `NAME`/`USER`/`PASSWORD` (`:125-127`) have **no defaults** and fail loudly if unset.
9. `backend/config/settings/base.py` **line 26** (`SECRET_KEY = env("DJANGO_SECRET_KEY")`, no default) — the container crashes at import with a clear error if this is missing, which is why `.env.docker.example` ships the key with the same generation guidance `backend/.env.example` uses.
10. `backend/config/settings/base.py` **lines 534-545** (Celery: `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` from `REDIS_URL`, `CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"`) and **line 559** (`REDIS_CACHE_URL`, PROD-2, Redis **database 1**). Three facts follow: both Redis URLs must be overridden to the `redis` service name; beat needs the **database**, not just Redis, so it must start after migrations; and the two Redis databases stay separate exactly as `CONVENTIONS.md` § 35 requires.
11. `backend/config/settings/base.py` **lines 501-512** (`ASGI_APPLICATION`, `CHANNEL_LAYERS = InMemoryChannelLayer`) — **read the comment at 502-506 before writing the compose file.** This is the single-replica constraint.
12. `backend/config/settings/base.py` **lines 168-184** (`STATIC_ROOT`, and `MEDIA_ROOT` with its comment at 171-183) — note the comment's explicit *"No MEDIA_URL: attachments are served exclusively through `AttachmentViewSet.download` (permission-gated), never through Django's own unguarded static/media serving."* **Media therefore needs a volume for persistence but no serving story at all**, which removes the single most common Django-in-Docker complication.
13. `backend/config/settings/dev.py` (all 21 lines) — `DEBUG` defaults `True` (`:6`), `ALLOWED_HOSTS` defaults `["localhost","127.0.0.1"]` (`:7`, a **non-empty** list, so Django's "any host when DEBUG and empty" special case does not apply — but the check strips the port, so `localhost` covers `localhost:8001`), and `EMAIL_BACKEND` (`:17-21`) falls back to the console backend when `EMAIL_HOST` is blank, so the stack sends no real mail by default.
14. `backend/config/settings/base.py` **lines 213-232** (`CORS_ALLOWED_ORIGINS`, defaulting to `:5173`) and **line 244** (`FRONTEND_URL`, same default) — both must be overridden to `:5174` for the Dockerized frontend, or the browser blocks every API call and invite emails link to the wrong port.
15. `frontend/src/shared/lib/ws.ts` (all 13 lines) — `getWebSocketUrl` derives `ws://…` by string-replacing `^http` on `VITE_API_BASE_URL`. **This is why `VITE_API_BASE_URL` must stay an absolute `http://…` URL in the Compose stack** and must not be shortened to a relative `/api`: a relative value yields a schemeless string that `new WebSocket()` rejects. See `## Edge Cases`.
16. `frontend/vite.config.ts` (all 15 lines) — no `server.host` setting, so Vite's dev server binds to localhost only and is unreachable through a published container port without `--host`. The compose `command:` supplies the flag; **do not edit this file.**
17. `frontend/package.json` **lines 7-14** (`scripts`) — `dev`, `build`, `lint`. Only `dev` is used here. Note `oxlint` in `devDependencies`: a Rust binary resolved per-platform at install time, which is one concrete reason `node_modules` must be built inside the Linux container rather than bind-mounted from the host.
18. `backend/requirements.txt` (all 20 lines) — `psycopg[binary]` (a self-contained wheel: **no `libpq-dev` needed in the image**), plus `channels`/`daphne`/`celery`/`sentry-sdk`. All are pure-Python or ship manylinux wheels, so `python:3.12-slim` needs no compiler for an x86_64 build. See `## Edge Cases` for the arm64 caveat.
19. `.gitignore` **lines 14-29** — `.venv/`, `backend/staticfiles/`, `backend/media/`, `node_modules/`, `frontend/dist/`, and `.env` / `.env.*` with `!.env.example`. **Two consequences:** the `.dockerignore` files in task 1 mirror this list, and `.env.docker` is already gitignored by the `.env.*` rule while `.env.docker.example` is already un-ignored by the `!.env.example` exception — verify that second claim in task 5 rather than assuming it.
20. `CONVENTIONS.md` § 34, § 35 and § 36 (lines 2310, 2400, 2503) — the three prior PROD sections § 37 sits beside, and the model for recording constraints and negative results plainly. § 36's `DJANGO_NUM_PROXIES` rule is the reason this story leaves that value at its `0` default: **the Compose stack puts no proxy in front of Django.**

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Docker is never required to run SupportOS.** | Intake ("must not become required for local dev") | No README step above § Docker mentions containers; `README.md:61`'s "Docker is not required" line survives verbatim. |
| **The local, non-Docker path stays first-class.** | Intake | No file under `backend/apps/`, `backend/config/`, `frontend/src/`, `backend/.env.example` or `frontend/.env.example` changes. |
| **Both paths run simultaneously without collision.** | The above, made concrete | Host ports `5433`/`6380`/`8001`/`5174`, none of which is a default the non-Docker path uses. |
| **The container runs the same commands as the README.** | Intake ("for parity") | `manage.py runserver`, `celery -A config worker`, `celery -A config beat`, `npm run dev` — no new entrypoint abstraction. |
| **Editing code still takes effect immediately.** | "Parity" — anything less is worse than local | Bind-mounted `./backend` and `./frontend`, with `node_modules` masked by a named volume. |
| **The Docker path is self-contained.** | It is an alternative, not an add-on | `.env.docker.example` carries every key with no safe default; a `backend/.env` may exist but is never required. |
| **Container-network values always beat file values.** | `read_env()` precedence, verified | `POSTGRES_HOST`, both Redis URLs, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `DJANGO_ALLOWED_HOSTS` are set in each service's `environment:`, which outranks both `env_file:` and a bind-mounted `.env`. |
| **The backend never runs more than one replica.** | `InMemoryChannelLayer`, verified | Documented in the compose file, `README.md` and `CONVENTIONS.md` § 37. |
| **Uploaded attachments survive `docker compose down`.** | Data loss is not a convenience | Named volume at `MEDIA_ROOT`. |

---

## Implementation tasks

### 1 — `.dockerignore` files

**Create file: `backend/.dockerignore`:**

```
.venv/
__pycache__/
*.py[cod]
.ruff_cache/
staticfiles/
media/
.env
.env.*
!.env.example
db.sqlite3
```

**Create file: `frontend/.dockerignore`:**

```
node_modules/
dist/
.env
.env.*
!.env.example
```

Both mirror `.gitignore:14-29`. **`.venv/` and `node_modules/` are the two that matter**: without them the build context includes a host-built virtualenv and a host-built `node_modules` — hundreds of megabytes of the wrong platform's binaries, slowing every build and risking them landing in the image.

### 2 — The two Dockerfiles

**Create file: `backend/Dockerfile`:**

```dockerfile
# Dev-parity image for the optional Compose stack — PROD-4 (Story 93).
# Docker is NEVER required to run SupportOS; see README § Docker.
#
# Python 3.12 matches README's Prerequisites table. `-slim` floats within the
# minor version rather than pinning a Debian codename: this is a local
# convenience image, not a supply-chain-pinned production artifact.
FROM python:3.12-slim

# Unbuffered so `manage.py`/Celery logs reach `docker compose logs` immediately
# rather than sitting in a pipe buffer — PROD-1's whole access log depends on
# it being visible. No .pyc files: the source is bind-mounted and rebuilt
# constantly, so they are pure noise.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Requirements first, so `pip install` is cached and does not re-run on every
# source edit. `psycopg[binary]` ships its own libpq, so no libpq-dev / no
# compiler is needed for an x86_64 build — see `## Edge Cases` for arm64.
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# The real source arrives via the bind mount in docker-compose.yml; this COPY
# only makes the image runnable on its own.
COPY . .

EXPOSE 8000

# Overridden per service in docker-compose.yml (runserver / worker / beat).
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

`requirements-dev.txt` rather than `requirements.txt` — it is `-r requirements.txt` plus `ruff`, and having the linter in the image means `docker compose exec backend ruff check .` works, which is the point of a dev-parity image.

**Create file: `frontend/Dockerfile`:**

```dockerfile
# Dev-parity image for the optional Compose stack — PROD-4 (Story 93).
# Runs the Vite DEV server; this image builds no production bundle.
FROM node:20-slim

WORKDIR /app

# `npm ci` from the committed lockfile, and only after copying the manifests,
# so a source edit does not invalidate the dependency layer. This install MUST
# happen inside the image: several devDependencies (oxlint, esbuild) resolve a
# platform-specific binary, so a host-built node_modules is the wrong platform.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# `--host 0.0.0.0` is required: vite.config.ts sets no `server.host`, so Vite
# binds to localhost and a published port would refuse every connection.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### 3 — `docker-compose.yml`

**Create file: `docker-compose.yml`** at the repository root — it spans both subprojects, so it belongs to neither.

```yaml
# Optional dev-parity stack — PROD-4 (Story 93).
#
# Docker is NEVER required to run SupportOS. This file is a drop-in
# alternative to README §§ 1-6 for developers who would rather not install
# PostgreSQL, Redis, Python and Node locally. It runs the SAME commands the
# README documents, against the SAME `config.settings.dev`.
#
# Every host port is offset from the non-Docker defaults (8001 vs 8000, 5174
# vs 5173, 5433 vs 5432, 6380 vs 6379) so this stack can run ALONGSIDE a
# local setup without stopping anything. 8001/5174 are the same alternates
# README § 5 already documents.
#
# DO NOT `--scale backend`: CHANNEL_LAYERS is InMemoryChannelLayer
# (config/settings/base.py:508-512), so a second replica silently breaks
# WebSocket delivery. See CONVENTIONS.md § 37.

services:
  postgres:
    image: postgres:16-alpine
    environment:
      # The official image runs CREATE ROLE / CREATE DATABASE from these on
      # first start — README § 2's SQL, automated.
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
    # No volume on purpose: this Redis is a broker and a cache, both of which
    # a local dev install also treats as disposable.

  backend:
    build: ./backend
    env_file: [.env.docker]
    environment: &backend_env
      # These six MUST be set here, not in .env.docker: they are the values
      # that differ inside the Compose network, and `environment:` outranks
      # both `env_file:` and the bind-mounted backend/.env that
      # `read_env()` would otherwise supply (environ.py:1064-1066).
      POSTGRES_HOST: postgres
      REDIS_URL: redis://redis:6379/0
      REDIS_CACHE_URL: redis://redis:6379/1
      DJANGO_ALLOWED_HOSTS: localhost,127.0.0.1,backend
      CORS_ALLOWED_ORIGINS: http://localhost:5174,http://127.0.0.1:5174
      FRONTEND_URL: http://localhost:5174
    volumes:
      - ./backend:/app
      - backend_media:/app/media
    ports:
      - "8001:8000"
    depends_on:
      postgres: {condition: service_healthy}
      redis: {condition: service_healthy}
    # migrate then serve, in one command: this is the ONLY service that
    # migrates, so worker/beat cannot race it. They wait on the healthcheck
    # below, which cannot pass until runserver is up, which cannot happen
    # until migrate has finished.
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py runserver 0.0.0.0:8000"
    healthcheck:
      # urllib, not curl: python:3.12-slim ships no curl and this project
      # does not add a package for a healthcheck. /api/health/ is public and
      # throttle-exempt (PROD-3), so it is safe to poll.
      test: ["CMD", "python", "-c",
             "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/')"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  worker:
    build: ./backend
    env_file: [.env.docker]
    environment: *backend_env
    volumes:
      - ./backend:/app
      - backend_media:/app/media
    depends_on:
      backend: {condition: service_healthy}
    # NO --pool=solo. README § 6's solo-pool note is a WINDOWS HOST
    # workaround for the missing fork(); this container is Linux regardless
    # of host OS, so the default prefork pool is correct and faster.
    command: celery -A config worker -l info

  beat:
    build: ./backend
    env_file: [.env.docker]
    environment: *backend_env
    volumes:
      - ./backend:/app
    depends_on:
      backend: {condition: service_healthy}
    # DatabaseScheduler (base.py:545) reads the schedule from PostgreSQL, so
    # beat needs migrations applied — hence the same healthcheck gate.
    command: celery -A config beat -l info

  frontend:
    build: ./frontend
    environment:
      # Absolute, and pointing at the HOST-published backend port: the
      # browser runs on the host, not inside the Compose network, so
      # `backend:8000` would be unresolvable. It must also stay absolute so
      # `getWebSocketUrl` (src/shared/lib/ws.ts) can derive ws:// from it.
      VITE_API_BASE_URL: http://localhost:8001/api
    volumes:
      - ./frontend:/app
      # Masks the bind mount above so the container keeps its own
      # Linux-built node_modules instead of the host's.
      - /app/node_modules
    ports:
      - "5174:5173"

volumes:
  postgres_data:
  backend_media:
```

**Three details that are load-bearing, not stylistic:**

- **`$${POSTGRES_USER}` in the healthcheck is doubled on purpose.** A single `$` is interpolated by Compose on the host; `$$` escapes it so the variable is expanded by the shell *inside* the container, where the `postgres` image has already set it.
- **`- /app/node_modules` with no host path** is an anonymous volume that shadows `./frontend:/app` at that one subpath. Without it, the host's `node_modules` (Windows/macOS binaries) hides the image's Linux build and Vite fails to start.
- **The `&backend_env` anchor / `*backend_env` alias** keeps the three backend services' overrides in one place. If they drift, `worker` talks to a different database than `backend` and the failure is confusing.

### 4 — `.env.docker.example`

**Create file: `.env.docker.example`** at the repository root:

```
# Copy to .env.docker, then `docker compose up`. Never commit .env.docker.
#
# This file is the Docker path's OWN contract — it does not read
# backend/.env, and the Docker path never requires you to have completed
# the non-Docker setup first. If backend/.env does happen to exist it is
# bind-mounted into the container and fills in anything below that you
# leave blank (AI keys, SMTP settings), because django-environ never
# overwrites a variable Compose has already set.
#
# Generate a secret key:
#   python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
DJANGO_SECRET_KEY=

# Settings module: the Compose stack runs the SAME dev settings as the
# local path. There is deliberately no production Compose file — see
# CONVENTIONS.md § 37.
DJANGO_SETTINGS_MODULE=config.settings.dev
DJANGO_DEBUG=True
DJANGO_TIME_ZONE=UTC

# The postgres service creates this database and role on first start.
# `supportos` is a local-only convenience, exactly as README § 2 says of
# the same password in the non-Docker path. Never reuse it anywhere shared.
POSTGRES_DB=supportos
POSTGRES_USER=supportos
POSTGRES_PASSWORD=supportos

# POSTGRES_HOST, REDIS_URL, REDIS_CACHE_URL, DJANGO_ALLOWED_HOSTS,
# CORS_ALLOWED_ORIGINS and FRONTEND_URL are set in docker-compose.yml
# itself — they are network topology, not developer configuration, and
# overriding them here has no effect.

JWT_SIGNING_KEY=
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

DRF_PAGE_SIZE=25
DRF_MAX_PAGE_SIZE=100

DJANGO_LOG_LEVEL=INFO
DJANGO_LOG_FORMAT=text

# PROD-3: no proxy sits in front of Django in this stack, so 0 is correct.
# See CONVENTIONS.md § 36 before changing it.
DJANGO_NUM_PROXIES=0
API_DOCS_PUBLIC=True

# Blank = disabled, same as the non-Docker default.
SENTRY_DSN=
SENTRY_ENVIRONMENT=docker
SENTRY_TRACES_SAMPLE_RATE=0.0

# Blank EMAIL_HOST keeps dev.py's console backend, so no mail is ever sent.
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=support@example.com
EMAIL_INBOUND_LOCAL_PART=support
EMAIL_INBOUND_DOMAIN=support.example.com
EMAIL_INBOUND_WEBHOOK_TOKEN=

AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-5
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
```

**Confirm `.env.docker` is already ignored and `.env.docker.example` is not** — `.gitignore:27-29` is `.env`, `.env.*`, `!.env.example`. The negation names `.env.example` exactly, **not** `*.env.example`, so `.env.docker.example` is very likely still ignored by the `.env.*` rule. Verify with `git check-ignore -v .env.docker.example` (task 5) and, if it is ignored, add a second negation line `!.env.docker.example` to `.gitignore`. **Do not skip this check** — a silently untracked example file is a broken contract for the next developer.

### 5 — `.gitignore`

Run the check above. If `.env.docker.example` is ignored, append to `.gitignore` beside the existing env rules:

```
!.env.docker.example
```

Nothing else in `.gitignore` changes — `.env.docker` is correctly caught by the existing `.env.*` rule.

### 6 — Documentation

**File: `README.md`** — replace § "Docker (optional, future)" (lines 887-891) with a § "Docker (optional)" that keeps the same promise and adds the how-to:

- Lead with the unchanged commitment: **Docker is not required**; §§ 1-6 remain the supported path; this is a convenience for developers who would rather not install PostgreSQL, Redis, Python and Node.
- Quickstart: `cp .env.docker.example .env.docker`, fill `DJANGO_SECRET_KEY`, `docker compose up --build`.
- A port table making the offsets explicit, and stating both stacks can run at once:

  | Service | Container | Host | Non-Docker equivalent |
  |---|---|---|---|
  | frontend | 5173 | **5174** | 5173 |
  | backend | 8000 | **8001** | 8000 |
  | postgres | 5432 | **5433** | 5432 |
  | redis | 6379 | **6380** | 6379 |

- The everyday commands: `docker compose logs -f backend`, `docker compose exec backend python manage.py createsuperuser`, `docker compose exec backend python manage.py test`, `docker compose down` (keeps volumes) vs `docker compose down -v` (**destroys the database and uploaded attachments**).
- **Never `--scale backend`**, with the `InMemoryChannelLayer` reason in one sentence.
- Note that `docker compose up` needs a rebuild (`--build`) after a dependency change, but not after a source edit — bind mounts plus `runserver`/Vite reload handle those.

**Same file, § 6 "Run Celery" (lines 262-313)** — fix the stale opening. It currently says *"Nothing in this project dispatches a real background task yet — skip this section until a feature needs it."* Replace with the verified truth: 15 modules dispatch tasks, and without a worker, invite and password-reset email, SLA escalation, auto-assignment, notifications, AI jobs and webhook delivery all silently do not run. **Leave the `--pool=solo` Windows guidance intact** — it is correct for the non-Docker path on Windows and wrong only inside the container.

**Same file, Prerequisites (lines 46-61)** — add a row noting Docker Desktop / Docker Engine + Compose v2 as *optional*, needed only for the § Docker path. Line 61's *"Docker is not required"* stays.

**Same file, Repository layout (lines 20-42)** — add `docker-compose.yml` and `.env.docker.example` to the tree, and `Dockerfile` under both `backend/` and `frontend/`.

**File: `CONVENTIONS.md`** — append **§ 37**. Renumber nothing. It records:

- **Docker is optional and must stay optional.** The non-Docker path in `README.md` §§ 1-6 is the supported one; a future change that makes a container required contradicts `SupportOs backlog.MD:969` and this section.
- **The Compose stack is dev-parity, not a deployment.** It runs `config.settings.dev` and the same commands as the README. **There is deliberately no production Compose file**, and the three unmade decisions that would be required first (static files under `DEBUG=False`, `SECURE_SSL_REDIRECT` behind plain-HTTP nginx, `DJANGO_NUM_PROXIES` behind a proxy) are listed so the next author starts from them.
- **Never scale the backend service.** `CHANNEL_LAYERS` is `InMemoryChannelLayer` (`base.py:508-512`), so a second replica breaks WebSocket delivery silently. Switching to `channels_redis` is a prerequisite for any multi-replica topology, and is its own story.
- **Container-network values belong in `docker-compose.yml`, not `.env.docker`.** `POSTGRES_HOST`, both Redis URLs, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`. Compose's `environment:` outranks `env_file:` and outranks a bind-mounted `backend/.env`, because `django-environ` never overwrites an existing OS variable (`environ.py:1064-1066`).
- **`VITE_API_BASE_URL` must stay an absolute `http://` URL.** `getWebSocketUrl` derives `ws://` by replacing the scheme; a relative `/api` produces a schemeless string the `WebSocket` constructor rejects.
- **`--pool=solo` is a Windows-host workaround and must never appear in the container's Celery command.**
- **Host ports are offset by design** so both stacks coexist. Changing them means changing `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` together.
- **`docker compose down -v` destroys the database and every uploaded attachment.** `backend_media` is a named volume for exactly that reason.

---

## Edge Cases & Failure Modes

- **`docker compose up --scale backend=2` half-breaks WebSockets with no error.** `InMemoryChannelLayer` is per-process, so a message broadcast by replica A never reaches a client connected to replica B. Live chat (COMM-3) and notification push (SLA-4) appear to work — messages send, they just do not arrive for some users. **The only correct fix is switching `CHANNEL_LAYERS` to `channels_redis`, which is out of scope.** Documented in the compose file itself, `README.md`, and `CONVENTIONS.md` § 37.
- **A relative `VITE_API_BASE_URL` breaks WebSockets, not REST.** With `/api`, `getWebSocketUrl` computes `'/api'.replace(/\/api$/,'')` → `''`, then `''.replace(/^http/,'ws')` → `''`, yielding `/ws/notifications/`. Axios resolves that fine against the page origin, so **REST keeps working and only the WebSocket fails** — `new WebSocket()` rejects a URL whose resolved scheme is not `ws:`/`wss:`. The absolute `http://localhost:8001/api` avoids it entirely. This is the trap that would follow from "just make it same-origin."
- **The host's `node_modules` shadows the container's.** Without the anonymous `- /app/node_modules` volume, the `./frontend:/app` bind mount overlays a host-built tree. `oxlint` and `esbuild` resolve platform-specific binaries at install time, so a Windows or macOS `node_modules` produces an exec-format error the moment Vite starts. Same class of problem as bind-mounting `.venv`, which is why the backend installs into the container's system Python instead of a virtualenv.
- **A stale `node_modules` volume survives a `package.json` change.** The anonymous volume is populated once, from the image, and Docker will not refresh it just because the image was rebuilt. After changing dependencies, `docker compose down -v` (or `docker volume rm` for that one volume) then `docker compose up --build`, or the container runs the old dependency set while the image has the new one.
- **`docker compose down -v` destroys the database and every uploaded attachment.** `postgres_data` and `backend_media` are named volumes; `-v` removes them. Plain `docker compose down` keeps both. The README must say this in the same breath as the command.
- **`backend/.env` is bind-mounted whether or not you want it.** `./backend:/app` includes the developer's real `.env` if it exists, and `base.py:22` will read it. This is safe for every key Compose sets (Compose wins, verified), and helpful for keys it does not (a real `ANTHROPIC_API_KEY` carries over). It is only a hazard if that file sets something Compose does not and the container-appropriate value differs — the six network keys are precisely that set, which is why all six are in `environment:`.
- **`DJANGO_SECRET_KEY` unset crashes the container immediately.** `base.py:26` has no default, so the traceback is `ImproperlyConfigured` at import, before anything serves. That is the intended loud failure, and `.env.docker.example` ships the key with generation guidance so it is a one-line fix rather than a mystery.
- **A wrong `POSTGRES_HOST` fails slowly, not loudly.** If the `backend` service's `environment:` override were dropped, `base.py:128` defaults to `localhost`, which inside the container is the container itself — nothing is listening, so `migrate` hangs then fails on connection refused. The symptom points at PostgreSQL; the cause is the missing override.
- **The healthcheck gate is what orders migrations.** `worker` and `beat` wait on `backend: service_healthy`, which cannot pass until `runserver` answers `/api/health/`, which cannot happen until `migrate` has completed in the same `command`. If someone later moves `migrate` out of that command, or starts `worker` with `docker compose up worker` alone (which still honours `depends_on`, so this stays safe), the ordering guarantee comes from the healthcheck rather than from a comment.
- **`start_period: 30s` on the backend exists for the first run.** The first `docker compose up` runs every migration against an empty database; until `start_period` elapses, failing healthchecks do not count toward `retries`. Too short a value marks the backend unhealthy on a cold start and `worker`/`beat` never start.
- **`--pool=solo` inside the container would silently halve throughput.** README § 6 correctly tells Windows developers to use it because Windows lacks `fork()`. The container is Linux even on a Windows host (Docker Desktop runs a Linux VM), so the default prefork pool works and `solo` would restrict the worker to one concurrent task for no reason.
- **`postgres:16-alpine` only honours `POSTGRES_*` on an empty data directory.** Changing `POSTGRES_PASSWORD` in `.env.docker` after first start does nothing — the role already exists with the old password, and the backend then fails to authenticate. The fix is `docker compose down -v` (destroying data) or an `ALTER ROLE` inside the container.
- **`pip install` may need a compiler on arm64.** Every dependency in `requirements.txt` ships manylinux x86_64 wheels, and `psycopg[binary]` bundles its own libpq, so no build tools are needed there. On an Apple Silicon host Docker builds `linux/arm64` by default; these packages publish aarch64 wheels today, but if a future version range resolves to a sdist-only release the build fails with a missing-compiler error. Fix: add `RUN apt-get update && apt-get install -y --no-install-recommends build-essential` before `pip install`, or build with `--platform linux/amd64`. Not added pre-emptively — an unused compiler layer in every image is a real cost for a hypothetical.
- **Host ports can still collide with something other than SupportOS.** `5433`, `6380`, `8001` and `5174` avoid this project's own defaults, not every other process on the machine. A collision surfaces as `bind: address already in use` at `docker compose up`. Changing a port means changing it in three coupled places — `ports:`, `VITE_API_BASE_URL`, and `CORS_ALLOWED_ORIGINS`/`FRONTEND_URL`.
- **Vite HMR through a published port may fall back to full reloads.** The client connects its HMR socket to the page's origin (`localhost:5174`), which is published, so this normally works. If a future `vite.config.ts` sets a fixed `server.hmr.port`, it must match the published port or HMR silently degrades. Nothing in this story changes `vite.config.ts`.
- **`manage.py test` inside the container needs permission to create a test database.** `POSTGRES_USER` owns `POSTGRES_DB` (the image grants that) but is not a superuser; Django creates `test_<name>` as the same role, which Postgres permits by default for a role with `CREATEDB`. The official image grants `CREATEDB` to the `POSTGRES_USER` it creates, so `docker compose exec backend python manage.py test` works — verification step 9 proves it rather than assuming.
- **File-watching reload can be unreliable on bind mounts.** `runserver`'s autoreloader and Vite both watch the filesystem; on Docker Desktop for Windows/macOS, inotify events for host-bind-mounted files are proxied and occasionally missed for large trees. If reload stops firing, restart the service. This is a known Docker Desktop characteristic, not something this stack can fix.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16 — *"no new test file is added anywhere in the repo"*). No test file is added, changed, or removed.

**No existing test can regress, and that is structural rather than lucky:** this story changes no Python, no TypeScript, and no settings module. The 54 backend tests run against the host's own environment via `manage.py test`, reading `backend/.env` and the settings defaults exactly as they do today — Compose's `environment:` values exist only inside containers and are invisible to a host-side test run. In particular `config/tests/test_settings.py`'s CORS assertion still sees `http://localhost:5173`, because the `:5174` override lives in `docker-compose.yml` and nowhere else.

Verification is `## Verification Steps`, which is where a packaging story's correctness actually lives.

---

## Migration / Rollback

**No database migration, no model change, no dependency change, and no application code change.** `makemigrations --check --dry-run` must still report `No changes detected` — if it does not, something outside this story's scope was edited.

**Every file this story adds is new**, except three documentation edits (`README.md` § Docker, § 6's stale sentence, Prerequisites/layout) and a possible one-line `.gitignore` negation. There is no behaviour to roll back for anyone not running `docker compose`.

**Rollback is deletion.** `docker compose down -v`, then remove `docker-compose.yml`, `.env.docker.example`, `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, and revert the documentation. The non-Docker path is untouched throughout and needs no restoration.

**Half-applied states:**

- **Compose file present, `.env.docker` absent** → `docker compose up` fails immediately on the unset `POSTGRES_PASSWORD`/`DJANGO_SECRET_KEY` interpolation. Loud, immediate, and fixed by copying the example.
- **Dockerfiles present, compose file absent** → nothing happens. The images are buildable but nothing runs them.
- **README updated, files absent** → the worst state, because the docs promise a stack that is not there. Ship task 6 last.

---

## Verification Steps

**Every step below must be run by the executor. Nothing in this plan was boot-tested** — the Docker daemon was not running during planning (see `## Prerequisites`).

1. **Backend gates still pass, proving no application change leaked in:** from `backend/` — `ruff format --check .`, `ruff check .`, `python manage.py check`, `python manage.py makemigrations --check --dry-run` (→ `No changes detected`), `python manage.py test` (→ **54 passing**). Run these on the **host**, not in a container: the point is that the non-Docker path is untouched.
2. **Frontend gates still pass, on the host:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl`. All exit 0.
3. **Nothing outside the intended set changed:** `git status --short` shows only the new Docker files plus `README.md`, `CONVENTIONS.md`, and possibly `.gitignore`. **No file under `backend/apps/`, `backend/config/`, or `frontend/src/`, and neither `.env.example`.**
4. **The example env file is tracked:** `git check-ignore -v .env.docker.example` must print **nothing**. If it prints a matching `.gitignore` rule, task 5's negation line is missing. Then confirm the real one is ignored: `git check-ignore -v .env.docker` **must** match `.env.*`.
5. **The stack builds and starts from a clean slate:**
   ```bash
   cp .env.docker.example .env.docker
   # fill DJANGO_SECRET_KEY, then:
   docker compose up --build -d
   docker compose ps
   ```
   All six services reach `running`; `postgres`, `redis` and `backend` report `healthy`. If `worker`/`beat` sit in `Created`, the backend healthcheck never passed — read `docker compose logs backend` before touching anything else.
6. **Migrations ran exactly once, in the backend:** `docker compose logs backend | grep -i "Applying\|No migrations"` shows the migration output; `docker compose logs worker beat | grep -ci "Applying"` returns `0`. This is the ordering guarantee, observed rather than assumed.
7. **The API answers on the offset port:** `curl -s http://localhost:8001/api/health/` returns `{"success":true,"data":{"status":"ok","database":"ok"},...}`. `"database":"ok"` is the proof that `POSTGRES_HOST: postgres` took effect over the `localhost` default.
8. **The frontend serves and talks to the backend:** open `http://localhost:5174/`. The page loads, and the browser console shows PROD-1's boot line `[SupportOS] API base URL: http://localhost:8001/api`. Create a superuser (`docker compose exec backend python manage.py createsuperuser`) and log in — **a successful login proves CORS, JWT and the database path all work together**, since the login request is cross-origin from `:5174` to `:8001`.
9. **The test suite runs inside the container too:** `docker compose exec backend python manage.py test` → 54 passing. This is what proves `POSTGRES_USER` can create the `test_supportos` database.
10. **Celery is actually processing, not merely running:** `docker compose exec backend python manage.py shell -c "from config.celery import debug_task; debug_task.delay()"`, then `docker compose logs worker | tail`. The worker logs `debug_task ran` with its `celery_task_id` — PROD-1's structured line. Confirm `beat` logged its startup with no traceback: `docker compose logs beat | tail`.
11. **WebSockets work, which is the whole reason `daphne` is in `DJANGO_APPS`:** with the app open at `:5174`, confirm the notification socket connects — DevTools → Network → WS shows `ws://localhost:8001/ws/notifications/` in state `101 Switching Protocols`. **A `SyntaxError` in the console instead means `VITE_API_BASE_URL` lost its scheme.**
12. **Both stacks genuinely coexist:** with Compose still up, start the non-Docker path in two host terminals (`python manage.py runserver` on `:8000`, `npm run dev` on `:5173`). Both start with no `address already in use`, and `http://localhost:5173/` and `http://localhost:5174/` both work, against their own backends. **This is the story's central constraint, and this is the step that proves it.**
13. **Live reload still works, or this is not parity:** edit a string in `frontend/src/app/HomePage.tsx` and confirm the browser at `:5174` updates without a manual refresh; add a `logger.info(...)` line to a backend view and confirm `docker compose logs -f backend` shows the autoreloader restarting. **Revert both edits afterwards.**
14. **Uploaded data survives a restart, and only `-v` destroys it:** upload a customer attachment through the UI, then `docker compose restart backend` and confirm it still downloads. Then `docker compose down && docker compose up -d` and confirm it *still* downloads (named volumes survive `down`). Only then, if you want a clean slate, `docker compose down -v`.
15. **The documentation matches reality:** re-read `README.md` § Docker against the running stack — every command in it has now been executed above, and the port table matches `docker compose ps`.

---

## Done Criteria

- [ ] `docker-compose.yml`, `.env.docker.example`, `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile` and `frontend/.dockerignore` exist; **nothing under `backend/apps/`, `backend/config/`, or `frontend/src/` changed, and neither `.env.example` changed.**
- [ ] `docker compose up --build` starts six services from a clean checkout plus a filled-in `.env.docker`, with `postgres`, `redis` and `backend` reporting `healthy`.
- [ ] `curl http://localhost:8001/api/health/` returns `"database":"ok"`, and `http://localhost:5174/` loads and can log in — cross-origin, with CORS and JWT working.
- [ ] Migrations run in the `backend` service only; `worker` and `beat` start after it and never migrate.
- [ ] `debug_task.delay()` is executed by the worker, and `beat` starts clean — Celery is proven working, not merely present.
- [ ] The notification WebSocket reaches `101 Switching Protocols` at `ws://localhost:8001/ws/notifications/`.
- [ ] `docker compose exec backend python manage.py test` reports **54 passing**, and the same command on the host also reports **54 passing**.
- [ ] **The Docker stack and the non-Docker stack run at the same time**, on `5173`/`8000` and `5174`/`8001`, with no port collision.
- [ ] A frontend edit hot-reloads and a backend edit triggers the autoreloader, both through the bind mounts.
- [ ] An uploaded attachment survives `docker compose restart` and `docker compose down` + `up`; `down -v` is documented as destructive.
- [ ] `git check-ignore -v .env.docker.example` prints nothing while `.env.docker` is ignored.
- [ ] `README.md` § Docker documents the quickstart, the port table, the everyday commands, the `down -v` warning and the never-scale rule; **line 61's "Docker is not required" survives**; § 6's stale "nothing dispatches a real background task yet" is corrected; Prerequisites and Repository layout include the new files.
- [ ] `CONVENTIONS.md` § 37 records: Docker stays optional; the stack is dev-parity with **no production Compose file** and the three unmade decisions that would precede one; never scale the backend (`InMemoryChannelLayer`); network values belong in `docker-compose.yml` because Compose outranks `read_env()`; `VITE_API_BASE_URL` must stay absolute; `--pool=solo` is host-only; ports are offset by design; `down -v` destroys data.
- [ ] All gates pass on the host: `ruff format --check .`, `ruff check .`, `manage.py check`, `manage.py makemigrations --check --dry-run`, `manage.py test`; `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl`.

**EPIC 17 (Production Readiness) is complete with this story. Report to the user and stop — there is no Story 94 in this epic.**
