# Story 27 — Background Jobs Foundation (Story: SUPPORTOS-49)

## Prerequisites

- **FND-2 (Backend Foundation, Django + DRF) completed** — the intake names it (`Dependencies: FND-2`). It is Story 02 (`project-foundation-architecture`, `EPIC 0`, complete). `backend/requirements.txt` (10 lines), `config/settings/{base,dev,prod}.py`, and `apps.sla` (an empty scaffold app already registered in `LOCAL_APPS`, `base.py` line 63 — `apps/sla/models.py`/`views.py`/`admin.py` are all bare, no migrations beyond `__init__.py`) all exist and are the surfaces this story touches or deliberately leaves untouched.
- **This story is pure infrastructure — no domain model, no API endpoint, no frontend.** The intake has exactly **one** task (*"Celery + scheduler setup"*), unlike every other story planned this session. `apps.sla` (which owns "SLA policies, timers, breach detection, escalation rules" per `backend/apps/README.md` line 66) gets **no new code** here — `SLA-1` is the first story to put a real model there. This story's entire deliverable is the shared Celery application instance, its settings, and the local-broker documentation every later `SLA-*`/`AGENT-3`/`AI-*`/`INT-*` story will build `@shared_task`s on top of.
- **The Celery application instance lives in `config/`, not `apps/core/`.** `apps/README.md`'s own decision rule ("needed by two or more apps → `apps/core`") governs *domain/business-logic code*; the Celery app object is project *bootstrapping/wiring*, the same category `config/asgi.py` (Channels' ASGI entrypoint) and `config/wsgi.py` already occupy, sitting outside `apps/` entirely. `config/celery.py` (task 1) is the direct structural sibling of `config/asgi.py`, not a new precedent.
- **"Must remain runnable locally without Docker (document local broker option)" (intake) is read as: pick Redis, install it as a local service — the same shape PostgreSQL already has, not a Docker requirement.** Verified: no `Dockerfile`/`docker-compose.yml` exists anywhere in this repo (`README.md` line 592, "Docker (optional, future)"), and `CHANNEL_LAYERS`'s own comment (`base.py` lines 345-346) says *"no Redis dependency in this project"* — a claim this story makes **false** and must correct in the same comment (task 3), not leave stale. Redis is the standard, production-grade Celery broker/result-backend pairing, installed exactly like PostgreSQL already is (`README.md` § 1) — a new locally-installed service, never a container. A zero-dependency alternative (Kombu's `filesystem://` transport) was considered and rejected: Celery's own docs mark it experimental/local-testing-only, and this project's "install the real service locally" precedent (PostgreSQL) is the one to extend, not diverge from.
- **`django-celery-beat` is the scheduler**, storing periodic-task schedules in the database (editable via `/admin/`, per its own bundled admin registration — no admin code to write) rather than a hardcoded `beat_schedule` dict in `celery.py`. This is what lets a future story (`SLA-3`'s escalation-evaluation job, `SLA-2`'s auto-assignment) add a periodic task through a migration-free admin edit, not a settings deploy. It ships its **own** bundled migrations; `python manage.py migrate` applies them once it is in `INSTALLED_APPS` — this story writes no migration file by hand, the same way adding any third-party app never requires one.
- **`config.celery.debug_task` is Celery's own official Django-integration smoke test**, kept permanently (not a throwaway), the same pattern every Celery+Django getting-started guide ships — it is what `## Verification Steps` dispatches to prove the worker/broker/result-backend chain works end to end, and what any future story can copy as the shape of "a task exists and runs."
- **Celery's default `prefork` worker pool does not work on native Windows** (no `fork()`) — verified against Celery's own documented Windows limitation. `celery -A config worker` on Windows must pass `--pool=solo` (or `--pool=threads`); macOS/Linux keep the default pool. This is documented explicitly in `## Backend Tasks` task 5 and `README.md` (task 6) — the single most likely way a Windows contributor's first Celery run silently hangs.
- **No new permission constant, no new model, no new migration to hand-write, no frontend change.** This story's entire surface is `requirements.txt`, `config/`, `config/settings/base.py`, `README.md`, `.env.example`, `apps/README.md`, and `CONVENTIONS.md`.

---

## Story Goal

1. **Celery application + scheduler**: `config/celery.py` defines the shared `Celery` app (`app = Celery("supportos")`), configured from Django settings (`CELERY_*` namespace) and auto-discovering `tasks.py` in every installed app; `config/__init__.py` imports it so Django loading registers it. `django-celery-beat` supplies the database-backed periodic-task scheduler.
2. **Local broker, documented, no Docker**: Redis, installed as a local service exactly like PostgreSQL (`README.md` task 4), configured via one new `REDIS_URL` environment variable used as both `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND`.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `config/celery.py`, `config/__init__.py` import | "Celery + scheduler setup" (intake) — the shared app instance every later task-adding story imports `@shared_task` against. |
| `CELERY_*` settings, `REDIS_URL` | "local broker documented in ENV" (intake). |
| `django-celery-beat` in `THIRD_PARTY_APPS`, `CELERY_BEAT_SCHEDULER` | "scheduler setup" (intake) — the periodic-task half, DB-backed so later stories configure schedules without a settings deploy. |
| README §6, `.env.example`, `apps/README.md` note, `CONVENTIONS.md` §24 | "must remain runnable locally without Docker (document...)" (intake) — the documentation *is* part of the deliverable, not an afterthought. |

**Not here, and why:**

- **No `apps.sla` model, serializer, view, or API.** This story's one task is infrastructure; `SLAPolicy` (`SLA-1`) is the first domain model in that app.
- **No actual scheduled/periodic task.** `django-celery-beat`'s schedule starts empty — the first real periodic task (e.g. `SLA-3`'s escalation-evaluation job) is a future story's `PeriodicTask` row, not this one's.
- **No replacement of `MessageViewSet.perform_create`'s synchronous `adapter.send()` call** (`apps/communications/views.py` lines 70-77) with a Celery task. That call site becoming async is a real, separate change with its own failure-mode analysis (a queued send can now fail *after* the request already returned 201) — explicitly out of scope, a candidate for a future `COMM-*` or `SLA-*` follow-up, not smuggled into an infrastructure story.
- **No Flower or any Celery monitoring UI.** Not named in the intake; `celery -A config worker -l info`'s own stdout is the whole of this story's observability.
- **No production broker/deployment configuration** (managed Redis, TLS `rediss://`, connection pooling tuning). `config/settings/prod.py` needs no override — `REDIS_URL` is read the same way in every environment, the same pattern `POSTGRES_*`/`DJANGO_SECRET_KEY` already use.

---

## Context — Read These Files First

1. `.squad/stories/sla-automation/SUPPORTOS-49/intake.md` — one task, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 450-460 (`EPIC 7 — SLA & Automation`, `STORY (SLA-0) — Background Jobs Foundation`) — its own `🔑` marks the task as reused by `SLA-1`/`SLA-2`/`SLA-3`/`SLA-4` (lines 462-489) and `AGENT-3` (`SupportOs backlog.MD:427`, "Tasks & Reminders... depends on... SLA-4").
3. `backend/requirements.txt` (10 lines) — the exact range-pin style ("Version ranges, not exact pins: FND-4 (CONV) decides the lockfile strategy") task 1's three new lines follow.
4. `backend/config/settings/base.py` (369 lines) — `INSTALLED_APPS`/`THIRD_PARTY_APPS`/`LOCAL_APPS` (lines 33-70, `apps.sla` already at line 63), `env = environ.Env()` (line 19) and its no-default/fail-loud pattern (`SECRET_KEY`, line 24), `TIME_ZONE` (line 152, read from `DJANGO_TIME_ZONE`) which task 3's `CELERY_TIMEZONE` reuses, and `CHANNEL_LAYERS`'s comment (lines 344-353, *"no Redis dependency in this project"*) which task 3 corrects.
5. `backend/config/asgi.py` (22 lines) — the exact structural precedent for `config/celery.py`: a small `config/`-level file wiring a third-party async framework into Django, imported once at process start, not living in any `apps/` package.
6. `backend/config/__init__.py` — currently **empty**; task 2 adds the Celery-app import Celery's own official Django integration guide specifies (ensures `@shared_task`-decorated functions register correctly at Django startup).
7. `backend/apps/README.md` (94 lines) — the "where new code goes" decision list (lines 13-27) that places `config/celery.py` outside its scope, and the apps table (lines 58-71, `sla` at line 66) — task 6 adds one clarifying line, not a new row.
8. `README.md` — § 1 "Install and start PostgreSQL locally" (lines 65-101, the three-OS structure task 4's new Redis section mirrors), § 5 "Run both apps together" (lines 240-260, after which task 5 appends a new § 6), § "Environment variables" backend table (lines 449-493, the exact `| Variable | Required | Default | Purpose |` row format task 4 extends), § "Troubleshooting" (lines 527-587, the exact bullet format task 4 adds two entries to).
9. `backend/.env.example` (48 lines) — the `# --- Section (STORY-ID) ---` comment-header convention task 4's new `REDIS_URL` line follows.
10. `backend/config/tests/test_settings.py` lines 105-125 (`MigrationStateTests.test_no_pending_migrations`) — confirms this test diffs Django's own model *state* against committed migrations project-wide; `django-celery-beat`'s bundled migrations already match its own bundled models, so installing it introduces no drift here.
11. `CONVENTIONS.md` (line count after Story 26's edit) — no existing numbered section on background jobs; task 7 adds a new `## 24. Background jobs (Celery, SLA-0)`, the first new top-level section since `## 23`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Celery + scheduler setup, reusable by later stories.** | Intake, sole task | `config/celery.py`; `django-celery-beat` in `THIRD_PARTY_APPS`. |
| **Must remain runnable locally without Docker; local broker documented in ENV.** | Intake, sole task | `REDIS_URL`, README § 6, `.env.example`. |
| **Every environment-differing value is read from the environment, never hardcoded.** | Established project rule (`base.py`'s own module docstring) | `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` both read `REDIS_URL` via `env(...)`. |
| **A stale comment claiming a dependency does not exist must be corrected the moment it becomes false.** | This story's own discovery | `CHANNEL_LAYERS`'s "no Redis dependency" comment, corrected in the same change that introduces one. |
| **The scheduler's data (what runs, when) lives in the database, not source code.** | This story's design, for the sake of every future `SLA-*` consumer | `CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"`. |
| No new permission constant, no new dependency beyond the three named packages. | §17 | `celery`, `redis`, `django-celery-beat` only. |

---

## Backend Tasks

### 1 — Dependencies

**File: `backend/requirements.txt`** — append three lines, after `daphne`:

```
celery>=5.4,<6
redis>=5.0,<6
django-celery-beat>=2.7,<3
```

`redis` here is the Python client Celery's `redis://` transport needs — not a new *service* dependency by itself; task 4 documents installing the actual Redis server.

---

### 2 — The Celery application

**Create file: `backend/config/celery.py`**

```python
"""Celery application instance — SLA-0's shared background-job foundation.

Reused by SLA (escalation evaluation), automatic assignment, notifications,
AI, and integrations (SupportOs backlog.MD:460) — this file and its ENV
contract (`REDIS_URL`, README § 6) are the only things those future stories
need to add a `@shared_task`, not a new Celery app each.

Lives in `config/`, not `apps/core/`: this is project bootstrapping/wiring,
the same category `config/asgi.py` (Channels) already occupies — not
domain code, so `apps/README.md`'s "needed by two or more apps → apps/core"
rule does not apply. See Story 27 `## Prerequisites`.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("supportos")

# Reads every CELERY_* setting from Django's settings module — one
# configuration surface, not two. namespace="CELERY" is what maps
# `CELERY_BROKER_URL` (a Django setting) to `app.conf.broker_url`.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscovers a `tasks.py` in every app listed in INSTALLED_APPS. A
# future story adds e.g. `apps/sla/tasks.py` with `@shared_task` and needs
# no further wiring here.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Celery's own standard Django-integration smoke test — dispatch it
    from a shell (`debug_task.delay()`) with the worker running to prove
    the app→broker→worker→result chain works end to end. See Story 27
    `## Verification Steps`.
    """
    print(f"Request: {self.request!r}")
```

**File: `backend/config/__init__.py`** — currently empty; add the standard Celery+Django startup import:

```python
"""Ensures the Celery app (`config/celery.py`) is loaded when Django
starts, so `@shared_task`-decorated functions register correctly —
Celery's own documented Django integration pattern.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
```

---

### 3 — Settings

**File: `backend/config/settings/base.py`** — add `"django_celery_beat"` to `THIRD_PARTY_APPS`, after `"channels"` (line 51):

```python
THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt.token_blacklist",
    "channels",
    "django_celery_beat",
]
```

Correct the now-stale `CHANNEL_LAYERS` comment (lines 344-346) — replace:

```python
# Django Channels' ASGI entrypoint and channel layer. InMemoryChannelLayer is
# single-process only — a deliberate scope limit, no Redis dependency in this
# project. See Story 16 `## Prerequisites`.
```

with:

```python
# Django Channels' ASGI entrypoint and channel layer. InMemoryChannelLayer is
# single-process only — a deliberate scope limit, unrelated to Celery's own
# Redis broker (below, SLA-0): Redis entered this project through Celery,
# and CHANNEL_LAYERS does not (yet) reuse it. See Story 16 `## Prerequisites`
# and Story 27 `## Prerequisites`.
```

Append a new settings block at the end of the file, after the `SMS_WEBHOOK_URL` line:

```python

# --- Background jobs (SLA-0) -------------------------------------------------
# The shared async/scheduled-job foundation SLA, escalation, notifications,
# AI, and integrations all build on (SupportOs backlog.MD:460). Redis is
# both broker and result backend — one new locally-installed service,
# documented in README § 6 exactly like PostgreSQL (§ 1), never Docker.
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
# django-celery-beat: the periodic-task schedule lives in the database,
# editable via /admin/ (PeriodicTask, IntervalSchedule, CrontabSchedule —
# all registered by the package itself, no admin code to write here), not a
# hardcoded `beat_schedule` dict — so a future scheduled job (e.g. SLA-3's
# escalation evaluation) is configured without a settings deploy.
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
```

**Migration:** none to hand-write. `python manage.py migrate` applies `django-celery-beat`'s own bundled migrations once it is in `INSTALLED_APPS` — the same as any third-party app.

---

## Documentation Tasks

### 4 — README

**File: `README.md`** — extend the backend environment-variable table (after `POSTGRES_CONN_MAX_AGE`, before `JWT_SIGNING_KEY`):

```markdown
| `REDIS_URL` | no | `redis://localhost:6379/0` | Redis connection string — Celery's broker and result backend (SLA-0). |
```

Add a new section after "## 5. Run both apps together" (before "## Languages"):

````markdown
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
````

Add two entries to "## Troubleshooting" (after the CORS entry, before "An `/api/` request..."):

```markdown
**The Celery worker hangs or exits immediately on Windows**
Missing `--pool=solo`. Celery's default `prefork` pool requires `fork()`,
which Windows does not provide. See [§ 6](#6-run-celery-optional-sla-0).

**`redis.exceptions.ConnectionError: Error connecting to localhost:6379`**
Redis is not installed or not running locally. See
[§ 6](#6-run-celery-optional-sla-0) — confirm `redis-cli ping` answers `PONG`
first.
```

---

### 5 — `.env.example`

**File: `backend/.env.example`** — add a new section, after the PostgreSQL block and before the JWT block:

```
# --- Redis / Celery (SLA-0) ---
REDIS_URL=redis://localhost:6379/0
```

---

### 6 — `apps/README.md`

**File: `backend/apps/README.md`** — add one sentence to the end of the "Where new code goes" section (after the four-item list, before "## What `core` is for"), naming the one category of file that sits outside this decision tree entirely:

```markdown
Project-wide bootstrapping/wiring (the ASGI/WSGI entrypoints, URL roots, the
Celery application instance) lives in `config/`, not in any app — it answers
"how does the process start," not "which business area owns this," so the
list above does not apply to it. `config/celery.py` (Story 27, `SLA-0`) is
the newest example, alongside the existing `config/asgi.py`/`wsgi.py`.
```

---

### 7 — Conventions

**File: `CONVENTIONS.md`** — add a new top-level section, `## 24. Background jobs (Celery, SLA-0)`, after the end of `## 23. Feature module conventions`:

```markdown
## 24. Background jobs (Celery, SLA-0)

The shared Celery application instance is `config/celery.py` — project
bootstrapping/wiring, the same category as `config/asgi.py`/`wsgi.py`, not a
domain app (`apps/README.md`'s "needed by two or more apps → `apps/core`"
rule governs business logic, not process wiring). A feature story that
needs a background task adds `apps/<app>/tasks.py` with `@shared_task`
functions — `app.autodiscover_tasks()` (`config/celery.py`) finds it with no
further wiring.

**Redis is the broker and result backend, installed as a local service —
never Docker, never a hardcoded default that silently degrades.**
`REDIS_URL` is read the same way every other environment-differing value
in this project is (`env(...)`, `README.md` § "Environment variables"), and
Redis is installed locally exactly like PostgreSQL (`README.md` § 1 vs § 6)
— this project's `Docker (optional, future)` stance extends to Celery's
infrastructure too, not just the web/database stack.

**The periodic-task schedule lives in the database
(`django-celery-beat`'s `DatabaseScheduler`), never a hardcoded
`beat_schedule` dict.** A new scheduled job is a `PeriodicTask` row (added
via `/admin/`, a data migration, or a management command), not a settings
deploy — the same "vocabulary is code, mapping is data" split
`CONVENTIONS.md` § 22 already establishes for permissions.

**Celery's default worker pool does not run on native Windows** (no
`fork()`) — `celery -A config worker --pool=solo` is required there;
macOS/Linux use the default pool. Any story documenting a Celery command
for local dev must carry this caveat, the same way `README.md` § 6 does.
```

---

## Edge Cases & Failure Modes

- **A developer who never installs Redis is completely unaffected** until they try to run `celery -A config worker`/`beat` — nothing in `manage.py runserver`, `migrate`, or `test` touches Celery at import time beyond registering the app object (`config/__init__.py`), which requires no live broker connection.
- **`celery -A config worker` on Windows with the default pool** hangs or raises immediately (Celery's own documented limitation, no `fork()`) — `--pool=solo` is required; see README § 6 and Troubleshooting.
- **The worker or beat process cannot reach Redis** (`redis.exceptions.ConnectionError`) — a clear, actionable error naming the host/port it tried, not a silent hang; the fix is starting the locally-installed Redis service, same failure shape as `django.db.utils.OperationalError` when PostgreSQL is not running.
- **`django-celery-beat`'s bundled migrations run once, on the first `migrate` after this story lands** — normal third-party-app-adoption behaviour, the same as `rest_framework_simplejwt.token_blacklist`'s own migrations when JWT auth was added; no special handling needed.
- **An empty Beat schedule is the correct, non-error state** for this story — `celery -A config beat` starts and logs normally with zero `PeriodicTask` rows; it is not supposed to dispatch anything until a future story adds one.
- **`debug_task.delay()` called with no worker running** queues the message in Redis and returns immediately (the call is non-blocking) — the task simply waits until a worker starts and drains it; this is expected Celery behaviour, not a bug to chase.
- **`CELERY_TIMEZONE` follows `DJANGO_TIME_ZONE`/`TIME_ZONE`**, not a separate independently-configured value — a periodic task's "9am" means the same 9am the rest of the Django app already uses, avoiding a second timezone setting to keep in sync.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` — must pass with `django_celery_beat` newly installed.
2. `python manage.py migrate` — applies `django-celery-beat`'s bundled migrations cleanly.
3. `python manage.py test` — the existing **54** must still pass, including `MigrationStateTests.test_no_pending_migrations` (`config/tests/test_settings.py` lines 105-125), confirming the new third-party app introduces no undetected model drift.
4. `ruff format --check .` / `ruff check .` over the two new/changed Python files (`config/celery.py`, `config/__init__.py`, `config/settings/base.py`).
5. Real local verification: Redis installed and answering `PING`; `celery -A config worker` (with `--pool=solo` on Windows) starts and connects; `celery -A config beat` starts cleanly against an empty schedule; `debug_task.delay()` is picked up and executed by the running worker — `## Verification Steps`.
6. No frontend changes — `npm run lint`/`format:check`/`check:rtl`/`build` are not affected by this story and need no re-run beyond confirming (once) that nothing in `frontend/` was touched.

---

## Migration / Rollback

**No hand-written migration.** `django-celery-beat` ships its own; `python manage.py migrate` applies them the moment the app is installed, like any third-party app.

**Rollback of the code:** revert the commits (`requirements.txt`, `config/celery.py`, `config/__init__.py`, `config/settings/base.py`, docs). If `django-celery-beat`'s tables must also be removed locally: `python manage.py migrate django_celery_beat zero`, then remove it from `INSTALLED_APPS`.

**Half-applied states to avoid:**

- **`django_celery_beat` added to `INSTALLED_APPS` without running `migrate`.** `manage.py check`/`runserver` still work, but `/admin/` breaks the moment someone opens the "Periodic tasks" section (missing tables) — always `migrate` in the same step as the `INSTALLED_APPS` change.
- **`config/celery.py` created but `config/__init__.py`'s import omitted.** The app object exists and can even be imported manually, but `@shared_task` autodiscovery/registration at Django startup silently does not happen the way Celery's own docs describe — a task defined in a future story's `apps/<app>/tasks.py` would appear to "not exist" to the worker.
- **`CHANNEL_LAYERS`'s stale "no Redis dependency" comment left uncorrected.** Not a functional bug, but a self-contradicting comment sitting a few lines above a setting block that reads `REDIS_URL` — exactly the kind of drift `## Prerequisites` flags as something this story must fix, not introduce.
- **Windows `--pool=solo` omitted from the documented command.** The worker appears to hang with no error, which reads as "Celery is broken" rather than "wrong pool for this OS" — the single most likely support question this story's own documentation must pre-empt.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `pip install -r requirements.txt` (installs `celery`/`redis`/`django-celery-beat`), `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration applies cleanly:** `python manage.py migrate` — `django_celery_beat`'s tables (`django_celery_beat_periodictask`, `intervalschedule`, `crontabschedule`, etc.) are created; `python manage.py showmigrations django_celery_beat` shows all applied.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Redis installed and running locally, no Docker.** `redis-cli ping` → `PONG`.
5. **The worker starts and connects to Redis.** From `backend/`: `celery -A config worker -l info` (Windows: `--pool=solo`) — log output shows `[tasks]` listing `config.celery.debug_task`, and `connected to redis://...` (or equivalent transport-ready line), with no traceback.
6. **Beat starts cleanly with an empty schedule.** In a second terminal: `celery -A config beat -l info` — starts, logs its own startup banner, and does not error or exit; confirm no `PeriodicTask` rows exist yet (`python manage.py shell -c "from django_celery_beat.models import PeriodicTask; print(PeriodicTask.objects.count())"` → `0`).
7. **`debug_task` round-trips end to end.** With the worker from step 5 still running: `python manage.py shell -c "from config.celery import debug_task; debug_task.delay()"` — the worker terminal logs the task being received and succeeding within a few seconds.
8. **Stop the worker and beat processes** (Ctrl+C in each terminal) and confirm the backend still runs normally without them: `python manage.py runserver` starts and `GET /api/health/` still returns `200`, proving Celery is additive, not load-bearing for the existing app.
9. **No frontend regression:** confirm via `git status`/diff that nothing under `frontend/` changed; frontend gates are unaffected by this story.

---

## Done Criteria

- [ ] `requirements.txt` gains `celery`, `redis`, `django-celery-beat` (range pins, matching the file's existing style).
- [ ] `config/celery.py` — `Celery("supportos")` app, `config_from_object(..., namespace="CELERY")`, `autodiscover_tasks()`, `debug_task`.
- [ ] `config/__init__.py` — imports and re-exports `celery_app`.
- [ ] `config/settings/base.py` — `"django_celery_beat"` in `THIRD_PARTY_APPS`; `CHANNEL_LAYERS`'s stale "no Redis dependency" comment corrected; new `CELERY_*` settings block (`CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` both from `REDIS_URL`, `CELERY_TIMEZONE = TIME_ZONE`, `CELERY_BEAT_SCHEDULER` set to the database scheduler).
- [ ] **No hand-written migration; no new permission constant; no `apps.sla` code; no frontend change.**
- [ ] `README.md` — `REDIS_URL` in the environment-variable table; new "## 6. Run Celery (optional, SLA-0)" section (Redis install per OS, worker/beat commands, Windows `--pool=solo` callout, `debug_task` smoke test); two new Troubleshooting entries.
- [ ] `backend/.env.example` — `REDIS_URL` added under a new `# --- Redis / Celery (SLA-0) ---` header.
- [ ] `backend/apps/README.md` — one sentence noting `config/` as where project wiring (including `celery.py`) lives, outside the app-placement decision list.
- [ ] `CONVENTIONS.md` — new `## 24. Background jobs (Celery, SLA-0)` section.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified live and locally, no Docker: Redis running (`PONG`), worker connects and lists `debug_task`, beat starts cleanly with zero scheduled tasks, `debug_task.delay()` executes successfully on the running worker, and the app runs normally with both processes stopped afterward.
- [ ] `.squad/plans/sla-automation/00-overview.md` updated with this story's row.
- [ ] `.squad/plans/00-index.md` gains a new `sla-automation` row.

**STOP HERE. Report to the user and wait for confirmation.** This unblocks `SLA-1` (Response & Resolution Targets, depends only on `TKT-2`, complete), `SLA-2` (Automatic Assignment, depends on `TKT-3` + this story), `SLA-3` (Escalation Rules, depends on `SLA-1` + this story), and `SLA-4` (Alerts & Notifications, depends only on this story) — `SLA-4` is also the named blocker on `agent-workspace`'s own `AGENT-3` (Tasks & Reminders), which is why this story was sequenced ahead of it.
