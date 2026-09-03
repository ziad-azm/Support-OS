# Story 88 — Observability & Logging (PROD-1) (Story: SUPPORTOS-116)

## Prerequisites

- **Every prior epic is complete.** `SupportOs backlog.MD:952` — "**Depends on:** all prior epics." This is the first story of **EPIC 17 — Production Readiness** (`SupportOs backlog.MD:950-971`) and the first story in `.squad/plans/production-readiness/`, whose `00-overview.md` currently has no rows.
- **`CONV` (Story 03, `project-foundation-architecture`) wrote `CONVENTIONS.md` § 10 "Logging" (lines 144-165).** That section is a *policy* — logger names, the five levels, "never log secrets". This story is the task the backlog names as "Implement the `CONV` logging strategy end-to-end" (`SupportOs backlog.MD:957`): the policy exists and is followed at 19 backend modules and 2 frontend modules, but nothing behind it is production-grade. **Verified live** — the current state is:
  - `backend/config/settings/base.py:301-337` emits **plain text** (`"{asctime} {levelname} {name} {message}"`), so no field is machine-parseable.
  - **Nothing correlates a log line to a request.** No middleware module exists at all: `find backend/apps -name "middleware*.py"` returns nothing, and `grep -rn "request_id\|X-Request-ID" backend/apps backend/config` returns nothing.
  - **One live § 10 violation:** `backend/config/celery.py:40` calls `print(f"Request: {self.request!r}")`. It is the only `print()` in `apps/`+`config/` (verified: the other four `grep "print("` hits are `password_fingerprint` substring matches).
  - **No error monitoring of any kind.** `grep -rn -i "sentry"` across the repo (excluding `.venv`/`node_modules`) returns **zero** hits; `backend/.venv/Lib/site-packages/` has no sentry package.
  - `frontend/src/shared/lib/logger.ts` says in its own docstring: *"Not a logging service — when one is added it goes behind this module, and no call site changes."* This story is the one that puts a service behind it.
- **Decision confirmed with the user this session: Sentry, DSN-gated — not an in-house `ErrorEvent` table.** `sentry-sdk[django]` on the backend and `@sentry/react` on the frontend, both **inert when the DSN is empty**, which is the default in `.env.example` and therefore in every existing clone. This is a deliberate, discussed exception to the "reach for stdlib first" posture Story 83 recorded (`urllib.request` over `requests`) and to `CONVENTIONS.md` § 17's "check whether an existing one already does the job": **nothing in this dependency set does error aggregation, deduplication, alerting, or release tracking**, and the backlog task text names "error monitoring" / "error tracking" explicitly. The cost is stated plainly and accepted: with a DSN configured, exception context (request path, user id, stack frames — **never** bodies, headers, or emails) leaves the box to a third-party SaaS. Task 6's `before_send` and `send_default_pii=False` are what keep § 10's "never log secrets" true across that boundary.
- **Scope confirmed with the user this session: format + correlation only.** This story rewrites *how* records are emitted and *what context* rides on them. It does **not** re-audit the 19 existing `logging.getLogger` call sites (`apps/ai/client.py`, `apps/integrations/*`, `apps/notifications/services.py`, …) — they keep their current messages, levels, and interpolation. The one exception is `config/celery.py:40`, because it is an outright § 10 violation, not a style preference.
- **Verified live, and it constrains the whole design: the error envelope may not grow a top-level key.** `backend/apps/core/tests/test_exceptions.py:28-34` asserts `set(response.data) == {"success","data","error","meta"}` on **every** error-mapping test, and `backend/apps/core/tests/test_health.py:30` asserts `body["meta"] is None` on a *success* response. So `request_id` cannot go at the top level and cannot go in `meta`. It goes **inside `error`**, conditionally, exactly the way `debug` already does — and `test_envelope.py:61` / `test_exceptions.py:98` only ever assert `assertNotIn("debug", …)`, never the full key set of `error`, so the addition is safe. See `## Migration / Rollback`.
- **Verified live: `corsheaders.middleware.CorsMiddleware` must stay at `MIDDLEWARE[0]`.** `backend/config/tests/test_settings.py:96-99` pins it (`test_cors_middleware_is_first`). The two new middleware go at index **1** and **2**, not 0.
- **Verified live against the installed DRF (`rest_framework/request.py:235-246`): `Request.user`'s setter writes the authenticated user back onto the underlying `HttpRequest`** — its own docstring says *"we also set the user on Django's underlying `HttpRequest` instance, ensuring that it is available to any middleware in the stack."* This is the single fact that makes task 3's access log able to record `user_id` at all: JWT authentication happens inside the DRF view, long after middleware's request phase, so `user_id` must be read in the **response** phase.
- **This project authors no automated tests** (`CONVENTIONS.md` § 16). The 54 existing backend tests are kept and must still pass; no new test file is added. See `## Test Plan`.

---

## Story Goal

Make a production incident diagnosable from the log line up, without changing how any of the 21 existing logging call sites are written:

1. **Every backend log record is machine-parseable JSON in production** — one object per line, with `ts`, `level`, `logger`, `msg`, and whatever structured `extra` the call site passed. Text stays the default in dev, because a human reads that stream.
2. **Every log record carries the request that produced it.** A new `X-Request-ID` correlates the browser's fetch, the Django request, the access-log line, the exception traceback, the Celery task it spawned, and the Sentry event — one id, end to end.
3. **A user can read that id off the screen.** A 500 renders "Reference: `3f9c1a7e…`" in `ErrorState`, so a support report and a log query meet at the same string.
4. **Every request is logged once with its outcome** — method, path, status, duration, user id — at INFO, with `/api/health/` excluded so a load-balancer probe cannot drown the stream.
5. **Unhandled exceptions reach an error tracker** on both sides — Django views, Celery tasks, React render crashes, and route-loader crashes — whenever a DSN is configured, and are a silent no-op when it is not.
6. **§ 10's "never log secrets" is enforced mechanically, not by discipline.** A key-name scrubber runs over structured `extra` and over every Sentry event, `?token=`-style query strings never reach a log line, and request bodies are never sent anywhere.

### What this story does not do

- **No log shipping, no aggregation backend, no dashboard.** JSON on stdout is the contract; whatever collects stdout (systemd-journald, a container runtime, a future `PROD-4` Docker log driver) is deployment, not application code.
- **No metrics, tracing spans, or APM.** `traces_sample_rate` is wired to an env var and **defaults to `0.0`** — error monitoring only. Performance work is `PROD-2` (`SupportOs backlog.MD:959-961`), a separate story.
- **No `ErrorEvent` model, no `/settings/errors` screen, no new permission, no migration.** This story adds **zero** database tables and zero model changes — deliberately, per the confirmed decision above.
- **No re-audit of the 19 existing `getLogger` modules.** Confirmed out of scope with the user.
- **No log level changes for existing loggers.** `DJANGO_LOG_LEVEL` keeps its meaning and its `INFO` default.
- **No WebSocket/Channels correlation.** HTTP middleware never runs for a `ws://` connection; `apps/communications`' consumers log with an empty `request_id`. Stated explicitly in `## Edge Cases & Failure Modes` rather than half-solved.

---

## Context — Read These Files First

1. `.squad/stories/production-readiness/SUPPORTOS-116/intake.md` — one description line, no acceptance criteria, `attachments/` is empty. `SupportOs backlog.MD:955-957` (`STORY (PROD-1)`) is the same text plus the epic's "depends on: all prior epics".
2. `CONVENTIONS.md` **lines 144-165** (§ 10 "Logging") — the level table, the `getLogger(__name__)` rule, the frontend `logger` rule, and the "**Never log secrets** … including inside an exception traceback you're about to log" paragraph at lines 161-165. **This story implements this section; it does not rewrite it.** Task 19 appends a new § 33 that records the mechanism.
3. `CONVENTIONS.md` **lines 132-142** (§ 9 "Environment & config") — the "`import.meta.env` is read in exactly these files" list. **Verified: this story does not change that list.** The new frontend monitoring module reads `env` from `config/env.ts`, never `import.meta.env` directly. The same holds for `frontend/src/README.md` line 162, which restates it.
4. `CONVENTIONS.md` § 16 (lines 251-260) and § 17 (lines 262-270) — the no-new-tests rule and the range-pin dependency rule both new dependencies follow.
5. `backend/config/settings/base.py` **lines 296-337** — the current `# --- Logging ---` block in full: `DJANGO_LOG_LEVEL` (line 299), the single `verbose` formatter, the single `console` handler, and the four logger entries (`root`, `apps`, `django`, `django.request`). Task 5 rewrites this block; note the existing comment at 297-298 explaining *why* it exists, and keep that reasoning.
6. `backend/config/settings/base.py` **lines 77-90** (`MIDDLEWARE`) — note the two ordering comments already there (CORS above `CommonMiddleware`; `LocaleMiddleware` after `SessionMiddleware`). Task 4 inserts two entries at index 1-2.
7. `backend/config/settings/base.py` **lines 207-225** (`# --- CORS ---`) — `CORS_ALLOW_HEADERS` is an explicit list at lines 217-225 (django-cors-headers' defaults **plus** `accept-language`); there is no `CORS_EXPOSE_HEADERS` today. Task 4 extends the first and adds the second.
8. `backend/apps/core/exceptions.py` **lines 98-112** (`_internal_error_response`) — the one place an unhandled 500 is logged today (`logger.exception("Unhandled exception at %s", …, exc_info=exc)`, lines 100-102) and the one place `debug` is conditionally added to the error body (103-108). Task 8 extends it. Read `envelope_exception_handler` (lines 29-50) too, so you can see that **every** error response — 400, 401, 403, 404, 500 — funnels through `error_envelope`.
9. `backend/apps/core/envelope.py` **lines 32-41** (`error_envelope`) — the `if debug is not None: error["debug"] = debug` shape at lines 39-40 is **the literal template** for task 7's conditional `request_id`.
10. `backend/apps/core/renderers.py` (all 47 lines) — `EnvelopeJSONRenderer.render` returns `b""` for 204/304. Relevant to task 3: an access-log line must not assume a body exists.
11. `backend/apps/core/views.py` **lines 65-87** (`HealthView`) — `authentication_classes = []`, `permission_classes = [AllowAny]`, and a `connection.ensure_connection()` probe. Its URL, `/api/health/` (registered in `backend/apps/core/urls.py`), is the path task 3 excludes from the access log.
12. `backend/apps/core/apps.py` (all 6 lines, `CoreConfig`) — deliberately bare. **Do not** initialise Sentry here; task 6 explains why `settings/base.py` is the correct place and `apps/integrations/apps.py::ready()` (Story 80's `from . import authentication`) is the precedent that does **not** apply.
13. `backend/config/celery.py` **lines 33-40** (`debug_task`) — the `print(f"Request: {self.request!r}")` at line 40 that task 9 replaces. Note `self.request` is a Celery `Context`; `!r` on it dumps **task args**, which is why this is a § 10 secrets problem and not just a style one.
14. `backend/config/settings/base.py` **lines 408-424** (`# --- Background jobs (SLA-0) ---`) — the `CELERY_*` block task 5's new `celery` logger entry sits beside conceptually. No change to this block.
15. `backend/apps/core/tests/test_exceptions.py` **lines 17, 28-34** and `backend/apps/core/tests/test_health.py` **lines 14, 30** — the two assertions that fix `request_id`'s position inside `error`. Read them before touching `envelope.py`, and re-read `## Migration / Rollback`.
16. `backend/config/tests/test_settings.py` **lines 96-99** (`test_cors_middleware_is_first`) — pins `MIDDLEWARE[0]`.
17. `backend/pyproject.toml` — `line-length = 100`, `target-version = "py312"`, ruff `select` includes `E,F,I,N,UP,B,DJ`. Every new backend file must pass `ruff format --check` and `ruff check` at those settings; `known-first-party = ["apps", "config"]` governs import order.
18. `frontend/src/shared/lib/logger.ts` (all 26 lines) — the module whose own docstring promises this story's frontend half. `debug`/`info` gated on `import.meta.env.DEV`; `warn`/`error` always emit. Task 12 keeps every signature identical.
19. `frontend/.oxlintrc.json` — `"no-console": "error"` globally, with a single `overrides` entry turning it off for `**/shared/lib/logger.ts`. **The new `shared/lib/monitoring.ts` must not call `console.*`**, or lint fails; it calls nothing but the Sentry SDK.
20. `frontend/src/config/env.ts` (all 22 lines) — `requireEnv` **throws** on a missing/blank variable. Task 10 adds an `optionalEnv` beside it, because an absent DSN is the normal case, not a boot failure.
21. `frontend/src/vite-env.d.ts` (all 9 lines) — `ImportMetaEnv` currently declares exactly one key. Task 10 adds two, both optional.
22. `frontend/src/shared/lib/api/client.ts` — **lines 47-57** (the request interceptor that already sets `Authorization` and `Accept-Language`; task 13 adds one more header there), **lines 62-93** (the 401-refresh interceptor — note the retry replays `config`, so the replayed call must reuse the *same* request id), and **lines 95-98** (the error-normalising interceptor that calls `toApiRequestError`).
23. `frontend/src/shared/lib/api/errors.ts` — **lines 10-60** (`ApiRequestError`: four `readonly` fields, the constructor at 16-29, and the `isValidation`/`isAuth`/`isForbidden`/`isTransport` getters) and **lines 71-116** (`toApiRequestError`'s four branches: timeout, no-response, envelope body, non-envelope body). Task 14 adds one field and reads one header.
24. `frontend/src/shared/lib/api/types.ts` **lines 34-41** (`ApiErrorBody`) — the mirror of `backend/apps/core/envelope.py`, with `debug?` already optional at line 40. `request_id?` goes beside it, same optionality, same reason.
25. `frontend/src/shared/ui/ErrorState.tsx` (all 48 lines) — the `error.debug ? … : null` block at lines 32-45 is the template for task 15's reference-id block, including the `dir="ltr"` treatment (a hex id is code, and bidi reordering mangles it in Arabic — the same reasoning the existing comment at 39-40 gives for a stack trace).
26. `frontend/src/shared/ui/AppErrorBoundary.tsx` (all 49 lines) — `componentDidCatch` at lines 40-42 already calls `logger.error(...)`. Task 16 adds one `captureError` call beside it, and **does not** change the fallback UI.
27. `frontend/src/app/RouteErrorBoundary.tsx` (all 47 lines) — three branches: `ApiRequestError`, `isRouteErrorResponse`, and the unknown fallback. Only the third is a real crash worth reporting.
28. `frontend/src/shared/lib/api/queryClient.ts` **lines 24-56** (`createQueryClient`) — the `handle` closure at 25-34 is the one place a query/mutation error becomes a toast. Task 17 reports from there, filtered.
29. `frontend/src/shared/auth/AuthProvider.tsx` — **lines 16-45** (the boot effect, `setUser(me)` at 33), **lines 47-65** (`login`, `setUser(me)` at 57), **lines 67-80** (`logout`, `setUser(null)` at 71). Three call sites, one added line each (task 18). `frontend/src/shared/auth/types.ts` shows `AuthUser` carries `id`, `email`, `role`, `permissions` — **send only `id`**.
30. `frontend/src/main.tsx` (all 28 lines) — note the side-effect import block at lines 5-13 and its ordering comment, and `logger.info('API base URL:', env.apiBaseUrl)` at line 20. Task 11 adds `initMonitoring()` immediately before that line.
31. `frontend/src/shared/i18n/locales/en/common.json` — has `debug: { details: "Debug details" }` and `states.error.{generic,render,route}`. Task 15's new key goes under `debug`, **not** in `errors.json` (which is strictly a map of API error codes — verified: all 16 keys are codes from `types.ts`'s `API_ERROR_CODES`/`CLIENT_ERROR_CODES`).
32. [`../integrations/83-story-outbound-webhooks-SUPPORTOS-92.md`](../integrations/83-story-outbound-webhooks-SUPPORTOS-92.md) `## Prerequisites` — the most recent precedent for *how this project states an accepted cost in the plan rather than hiding it*, and for the `CONVENTIONS.md` §-append pattern task 19 follows (§ 32 is the current last section, ending at line 2194).
33. `README.md` **lines 631-681** (the backend env-var table; `DJANGO_LOG_LEVEL` is at line 660) and **lines 680-685** (the frontend table, currently one row). `CONVENTIONS.md` § 9 makes updating both, plus the two `.env.example` files, part of this change — not a follow-up.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Production log output is structured; dev output stays human-readable.** | Intake ("Structured logging"), § 10 | `DJANGO_LOG_FORMAT` env, default `text`; `config/settings/prod.py` re-reads it with default `json`. |
| **Every log record emitted during a request carries that request's id.** | Intake outcome ("diagnosable production issues") | `apps.core.logging.ContextFilter`, attached to the one `console` **handler** — so `apps`, `django`, `config`, and `celery` all inherit it. |
| **A client may propose a request id; the server decides whether to trust it.** | Standard correlation practice; § 12 ("the backend owns validation") | `RequestIDMiddleware._incoming` validates against `ID_RE` and otherwise generates a fresh UUID4. |
| **The id is visible to the caller on every response, and to the user on a failure.** | Intake outcome | `X-Request-ID` response header (always) + `error.request_id` in the envelope (when set) + `ErrorState`'s reference line (when present). |
| **Every request produces exactly one outcome log line.** | Intake ("Structured logging … end-to-end") | `AccessLogMiddleware.__call__`; `/api/health/` excluded via `SKIP_PATHS`. |
| **Unhandled exceptions are reported to an error tracker when one is configured, and nothing happens when one is not.** | Intake ("error monitoring", "error tracking") | `if SENTRY_DSN:` in `settings/base.py`; `if (!env.sentryDsn) return` in `initMonitoring()`. |
| **No secret, credential, token, request body, or query string ever reaches a log line or a Sentry event.** | § 10 lines 161-165 | `scrub()` over structured `extra`; `request.path` (never `get_full_path()`); `before_send` + `send_default_pii=False` + `max_request_body_size="never"`; `sendDefaultPii: false` on the client. |
| **Adding all of this changes no existing logging call site.** | Confirmed scope decision | Filter + formatter + handler only. The 19 `getLogger` modules are untouched. |

---

## Backend Tasks

### 1 — The logging core

**Create file: `backend/apps/core/logging.py`.**

This module is imported by `logging.config.dictConfig` **during `django.setup()`, before the app registry is ready**. It must therefore import nothing from `django.conf`, nothing from any `models.py`, and nothing from `config/celery.py` at module scope — any of those raises `AppRegistryNotReady` or an import cycle at boot. Celery is reached through a **function-local** import inside the filter.

```python
"""Structured logging plumbing: request correlation, JSON output, scrubbing.

Imported by `logging.config.dictConfig` during `django.setup()` — BEFORE the
app registry is populated. Nothing here may import `django.conf.settings`, a
models module, or `config.celery` at module scope. `current_task` is imported
inside `ContextFilter.filter` for exactly that reason.

CONVENTIONS.md § 10 is the policy this module makes mechanical.
"""

import json
import logging
import re
import uuid
from contextvars import ContextVar

# Set by apps.core.middleware.RequestIDMiddleware, read by ContextFilter.
# A ContextVar rather than a thread-local: this project serves ASGI (daphne,
# COMM-3), where one thread can interleave requests.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_var: ContextVar[int | None] = ContextVar("user_id", default=None)

# A client-proposed id must look like this or it is replaced. Unvalidated
# header text in a log line is log injection — CONVENTIONS.md § 10.
ID_RE = re.compile(r"\A[A-Za-z0-9._-]{8,64}\Z")

# CONVENTIONS.md § 10 lines 161-165, made mechanical. Matched against the
# KEY NAME in a structured `extra`, case-insensitively, as a substring.
SENSITIVE_KEY_RE = re.compile(
    r"password|passwd|secret|token|api[_-]?key|authorization|credential|cookie|session",
    re.IGNORECASE,
)
REDACTED = "[redacted]"

# Everything `logging` puts on a LogRecord itself. Anything NOT here came from
# a call site's `extra=`, and is what we serialise as structured fields.
RESERVED = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "stacklevel", "thread", "threadName",
        "taskName", "request_id", "user_id", "celery_task_id", "celery_task",
    }
)


def new_request_id() -> str:
    return uuid.uuid4().hex


def get_request_id() -> str:
    return request_id_var.get()


def scrub(value):
    """Redact by key name, recursively. Values are never inspected — a
    scrubber that guesses at value shapes both over- and under-redacts."""
    if isinstance(value, dict):
        return {
            key: (REDACTED if SENSITIVE_KEY_RE.search(str(key)) else scrub(item))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [scrub(item) for item in value]
    return value


class ContextFilter(logging.Filter):
    """Attach request/task correlation to every record.

    Registered on the HANDLER, not on a logger: that way `apps.*`, `django.*`,
    `config.*` and `celery.*` all get it without four separate declarations.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.user_id = user_id_var.get()
        record.celery_task_id = None
        record.celery_task = None
        try:
            # Function-local: see the module docstring.
            from celery import current_task

            if current_task is not None and getattr(current_task, "request", None):
                record.celery_task_id = current_task.request.id
                record.celery_task = current_task.name
        except Exception:
            # Correlation must never suppress the line it was decorating.
            pass
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line. There is no JSON formatter in the stdlib."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("request_id", "user_id", "celery_task_id", "celery_task"):
            value = getattr(record, key, None)
            if value:
                payload[key] = value
        for key, value in record.__dict__.items():
            if key not in RESERVED and not key.startswith("_"):
                payload[key] = scrub(value)
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__
            payload["exc"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)
        # default=str: a UUID, Decimal, or datetime in `extra` must not turn a
        # log call into a TypeError raised from inside the logging machinery.
        return json.dumps(payload, default=str, ensure_ascii=False)
```

**`ensure_ascii=False` is deliberate** — this app is bilingual (`CONVENTIONS.md` § 18) and an Arabic ticket subject in a log message must stay readable, not become `\uXXXX` escapes.

### 2 — Request correlation middleware

**Create file: `backend/apps/core/middleware.py`.**

```python
"""Request correlation and access logging. See CONVENTIONS.md § 33."""

import logging
import time

from .logging import ID_RE, new_request_id, request_id_var, user_id_var

logger = logging.getLogger(__name__)

HEADER = "X-Request-ID"
# A load-balancer liveness probe hits this on a timer forever. One line per
# probe buries every line that matters. apps/core/views.py::HealthView.
SKIP_PATHS = frozenset({"/api/health/"})


class RequestIDMiddleware:
    """Resolve one id per request, publish it to the ContextVar, echo it back.

    Sits at MIDDLEWARE[1] — immediately after CorsMiddleware, which
    config/tests/test_settings.py:96-99 pins at index 0. Everything below
    this point, including SecurityMiddleware's SSL redirect, is correlated.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = self._incoming(request) or new_request_id()
        request.request_id = request_id
        token = request_id_var.set(request_id)
        user_token = user_id_var.set(None)
        try:
            response = self.get_response(request)
            response[HEADER] = request_id
            return response
        finally:
            # Always reset: a ContextVar leaking across requests would
            # mislabel the NEXT request's logs, which is worse than no id
            # because the log then looks correct.
            request_id_var.reset(token)
            user_id_var.reset(user_token)

    @staticmethod
    def _incoming(request) -> str | None:
        candidate = request.headers.get(HEADER, "")
        return candidate if ID_RE.fullmatch(candidate) else None
```

**Never trust the header unvalidated.** `ID_RE` bounds it to 8-64 characters of `[A-Za-z0-9._-]` — no newline, so a caller cannot forge a second log line, and no unbounded string, so a caller cannot inflate every log record.

### 3 — Access logging middleware

**Same file: `backend/apps/core/middleware.py`**, appended below `RequestIDMiddleware`:

```python
class AccessLogMiddleware:
    """One INFO line per request, with its outcome. Sits at MIDDLEWARE[2],
    inside RequestIDMiddleware, so every line it writes is already correlated.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in SKIP_PATHS:
            return self.get_response(request)

        started = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - started) * 1000, 1)

        # DRF assigns the authenticated user back onto the underlying
        # HttpRequest (rest_framework/request.py:235-246), so this is the
        # first point in the stack where a JWT-authenticated user is known.
        user = getattr(request, "user", None)
        user_id = user.pk if getattr(user, "is_authenticated", False) else None
        user_id_var.set(user_id)

        status = response.status_code
        level = logging.WARNING if status >= 500 else logging.INFO
        logger.log(
            level,
            "%s %s %s",
            request.method,
            request.path,
            status,
            extra={
                # request.path, NOT request.get_full_path(): a query string can
                # carry a credential — EMAIL_INBOUND_WEBHOOK_TOKEN travels as
                # `?token=` (apps/communications, COMM-1). CONVENTIONS.md § 10.
                "http_method": request.method,
                "http_path": request.path,
                "http_status": status,
                "duration_ms": duration_ms,
                "req_user_id": user_id,
            },
        )
        return response
```

**`request.path`, never `request.get_full_path()`** — this is the single most important line in the task. The inbound-email webhook (COMM-1) authenticates with `?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>`; logging full paths would write that shared secret to stdout on every delivery.

`extra` uses **`req_user_id`**, not `user_id`: `user_id` is a reserved name `ContextFilter` already writes onto the record, and a colliding `extra` key raises `KeyError: "Attempt to overwrite 'user_id' in LogRecord"` from inside the logging machinery.

### 4 — Register the middleware and open the header through CORS

**File: `backend/config/settings/base.py`** — in `MIDDLEWARE` (lines 77-90), insert two entries directly after `corsheaders.middleware.CorsMiddleware`:

```python
MIDDLEWARE = [
    # Must sit above CommonMiddleware so preflight responses are not rewritten.
    "corsheaders.middleware.CorsMiddleware",
    # PROD-1: as high as possible so every line logged below is correlated —
    # but NOT above CorsMiddleware, which config/tests/test_settings.py:96-99
    # pins at index 0.
    "apps.core.middleware.RequestIDMiddleware",
    "apps.core.middleware.AccessLogMiddleware",
    "django.middleware.security.SecurityMiddleware",
    ...
]
```

**Same file, lines 217-225** — add one entry to `CORS_ALLOW_HEADERS` and add `CORS_EXPOSE_HEADERS` after it:

```python
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-language",
    "authorization",
    "content-type",
    "user-agent",
    "x-csrftoken",
    "x-request-id",
    "x-requested-with",
]

# PROD-1: without this the browser hides X-Request-ID from JS on every
# cross-origin response, so the frontend could never read back the id the
# server actually used. Response headers are opt-in; request headers are not.
CORS_EXPOSE_HEADERS = ["x-request-id"]
```

**Both halves are required and they are not symmetrical.** `CORS_ALLOW_HEADERS` lets the browser *send* the header; `CORS_EXPOSE_HEADERS` lets JavaScript *read* it back. Omit the second and `client.ts` silently reads `undefined` for every cross-origin response — which is every response in dev, where Vite is on `:5173` and Django on `:8000`.

### 5 — Rewrite the LOGGING block

**File: `backend/config/settings/base.py`** — replace lines **296-337** (`# --- Logging ---` through the close of `LOGGING`) with:

```python
# --- Logging (PROD-1) ----------------------------------------------------
# Without this, `apps.*` loggers have no handler and fall through to Python's
# lastResort handler: WARNING+ only, no timestamp, no level, no logger name.
#
# Two formatters, one handler. `text` is the dev default because a human reads
# that stream; `json` is the prod default (set in prod.py) because a collector
# reads that one. ContextFilter is on the HANDLER, so every logger below
# inherits request correlation without declaring it.
DJANGO_LOG_LEVEL = env("DJANGO_LOG_LEVEL", default="INFO")
DJANGO_LOG_FORMAT = env("DJANGO_LOG_FORMAT", default="text")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "context": {"()": "apps.core.logging.ContextFilter"},
    },
    "formatters": {
        "text": {
            "format": "{asctime} {levelname} {name} [{request_id}] {message}",
            "style": "{",
        },
        "json": {
            "()": "apps.core.logging.JsonFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "filters": ["context"],
            "formatter": DJANGO_LOG_FORMAT,
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        # Our own code. `apps.core.exceptions` logs every unhandled 500 here,
        # and `apps.core.middleware` logs every request here.
        "apps": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
        # PROD-1: `config.celery` lives outside the `apps` tree, so without
        # this entry it falls through to root (WARNING) and its INFO lines
        # are silently dropped.
        "config": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # 4xx/5xx raised by Django itself; ERROR keeps normal 404 noise out.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        # SLA-0's worker. Routed here so a task's log line is formatted and
        # correlated (celery_task_id) the same way a request's is.
        "celery": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
    },
}
```

The `text` format string gains `[{request_id}]`. **This only works because `ContextFilter` runs on the handler and sets `record.request_id` unconditionally** — a `{...}`-style format referencing an attribute no record carries raises `ValueError: Formatting field not found in record` on *every* line. That is why `ContextFilter.filter` assigns all four attributes even when they are empty, and why the filter is registered on the handler rather than on individual loggers.

**File: `backend/config/settings/prod.py`** — append after the `EMAIL_BACKEND` line:

```python
# PROD-1: structured by default in production. Still overridable — an
# operator debugging a live container may want the text stream back.
LOGGING["handlers"]["console"]["formatter"] = env("DJANGO_LOG_FORMAT", default="json")
```

`prod.py` already does `from .base import *` and `from .base import env`, so both `LOGGING` and `env` are in scope, and its ruff per-file-ignores (`pyproject.toml`: `"config/settings/prod.py" = ["F403", "F405"]`) already cover the star-import reference.

### 6 — Sentry

**File: `backend/requirements.txt`** — add one line, keeping the file's range-pin convention (`CONVENTIONS.md` § 17). Put it after `drf-spectacular`:

```
sentry-sdk[django]>=2.68,<3
```

**File: `backend/config/settings/base.py`** — append a new block at the end of the file (after `SPECTACULAR_SETTINGS`, currently ending at line 491):

```python
# --- Error monitoring (PROD-1) -------------------------------------------
# Entirely inert with SENTRY_DSN unset, which is the default in .env.example
# and therefore in every existing clone: no network call, no import beyond
# this module, no behaviour change.
#
# Initialised HERE and not in apps/core/apps.py::ready(), unlike Story 80's
# `from . import authentication`: that pattern exists to make a decorator
# register, and `ready()` runs after the app registry is built. Sentry must be
# armed before that, or an exception raised while Django is still loading apps
# — a bad migration import, a broken settings-dependent module — is exactly
# the failure it never sees.
SENTRY_DSN = env("SENTRY_DSN", default="")
SENTRY_ENVIRONMENT = env("SENTRY_ENVIRONMENT", default="local")
# Errors only. Performance tracing is PROD-2's decision, not this story's.
SENTRY_TRACES_SAMPLE_RATE = env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0)

if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    from apps.core.monitoring import before_send

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            # ERROR+ becomes an event; INFO+ becomes a breadcrumb. This is what
            # makes the access log show up as context on a 500.
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        # CONVENTIONS.md § 10: no emails, no usernames, no IPs, no bodies.
        send_default_pii=False,
        max_request_body_size="never",
        before_send=before_send,
    )
```

`import logging` must be added to the imports at the top of `base.py` (it currently imports only `timedelta`, `Path`, and `environ`) — ruff's `I` rule puts `logging` in the stdlib group above `from datetime import timedelta`.

**Create file: `backend/apps/core/monitoring.py`:**

```python
"""Sentry event hygiene. Imported from settings — keep it dependency-free
beyond this package's own `logging` module (see that module's docstring for
why nothing Django-app-level may be imported at settings time).
"""

from .logging import REDACTED, SENSITIVE_KEY_RE, get_request_id, scrub


def before_send(event, hint):
    """Last gate before an event leaves the process.

    `send_default_pii=False` and `max_request_body_size="never"` already stop
    the common leaks; this closes the two they do not: a header dict the Django
    integration still attaches, and anything a call site put in `extra`. Tag
    every event with the request id so a Sentry issue and a log line are one
    query apart.
    """
    request_id = get_request_id()
    if request_id:
        event.setdefault("tags", {})["request_id"] = request_id

    request = event.get("request")
    if isinstance(request, dict):
        request.pop("data", None)
        request.pop("cookies", None)
        # Same `?token=` reason AccessLogMiddleware logs `path`, not full path.
        request.pop("query_string", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                key: (REDACTED if SENSITIVE_KEY_RE.search(str(key)) else value)
                for key, value in headers.items()
            }

    extra = event.get("extra")
    if isinstance(extra, dict):
        event["extra"] = scrub(extra)

    return event
```

### 7 — Put the request id in the error envelope

**File: `backend/apps/core/envelope.py`** — `error_envelope` (lines 32-41). Add the id **inside `error`**, conditionally, mirroring the existing `debug` line at 39-40:

```python
def error_envelope(
    code: str,
    message: str,
    fields: dict[str, list[str]] | None = None,
    debug: dict | None = None,
) -> Envelope:
    error: dict[str, Any] = {"code": code, "message": message, "fields": fields or {}}
    # PROD-1: the one string that ties a user's screenshot to a log line and a
    # Sentry issue. Inside `error`, not at the top level and not in `meta` —
    # apps/core/tests/test_exceptions.py:30 pins the four top-level keys, and
    # test_health.py:30 pins `meta` to None on a success. Conditional for the
    # same reason `debug` is: outside a request there is no id to report.
    request_id = get_request_id()
    if request_id:
        error["request_id"] = request_id
    if debug is not None:
        error["debug"] = debug
    return Envelope(success=False, data=None, error=error, meta=None)
```

Add `from .logging import get_request_id` to the imports. **`envelope.py` must not be imported by `logging.py`** — the dependency runs one way only, or `dictConfig` pulls in the envelope module at `django.setup()` time.

This one edit covers **every** error response in the API, not just 500s: `envelope_exception_handler` (`exceptions.py:29-50`) routes 400/401/403/404/405/429 through the same function.

### 8 — Enrich the unhandled-500 log line

**File: `backend/apps/core/exceptions.py`** — `_internal_error_response`, lines 98-112. Replace the `logger.exception(...)` call at lines 100-102:

```python
def _internal_error_response(exc, context):
    request = context.get("request")
    logger.exception(
        "Unhandled exception at %s",
        getattr(request, "path", "<unknown>"),
        exc_info=exc,
        extra={
            "http_path": getattr(request, "path", None),
            "http_method": getattr(request, "method", None),
            "exc_class": type(exc).__name__,
        },
    )
```

The rest of the function (the `settings.DEBUG` block at 103-108 and the `Response(...)` at 109-112) is unchanged — `error_envelope` picks up `request_id` on its own from task 7.

`getattr(request, "path", None)` and not `request.path`: `context.get("request")` can be `None` when the handler is called directly, which is exactly what `apps/core/tests/test_exceptions.py` does.

### 9 — Remove the last `print()`

**File: `backend/config/celery.py`** — line 40. Add `import logging` above `import os`, a module-scope logger below the `from celery import Celery` import, and replace the `print`:

```python
logger = logging.getLogger(__name__)
```

```python
@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Celery's own standard Django-integration smoke test — dispatch it
    from a shell (`debug_task.delay()`) with the worker running to prove
    the app→broker→worker→result chain works end to end. See Story 27
    `## Verification Steps`.
    """
    # Was `print(f"Request: {self.request!r}")` until PROD-1. Two problems:
    # `print` is a CONVENTIONS.md § 10 violation, and `self.request!r` dumps
    # the task's own args — a § 10 secrets leak for any task that carries one.
    # The task id alone proves the chain, which is all this task is for.
    logger.info("debug_task ran", extra={"celery_task_id": self.request.id})
```

**This is the reason task 5 adds the `config` logger entry.** `__name__` here is `config.celery`, outside the `apps` tree; without that entry the line falls to `root` at WARNING and never prints — turning "fixed the print" into a silent regression of the SLA-0 smoke test.

---

## Frontend Tasks

### 10 — Env plumbing

**File: `frontend/src/config/env.ts`** — add an `optionalEnv` helper beside `requireEnv` and two fields on `AppEnv`:

```ts
type AppEnv = {
  readonly apiBaseUrl: string
  /** Empty string = error monitoring disabled. The normal local default. */
  readonly sentryDsn: string
  readonly sentryEnvironment: string
}

function optionalEnv(name: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : fallback
}

export const env: AppEnv = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL'),
  sentryDsn: optionalEnv('VITE_SENTRY_DSN'),
  sentryEnvironment: optionalEnv('VITE_SENTRY_ENVIRONMENT', 'local'),
}
```

`optionalEnv`, not `requireEnv`: `requireEnv` throws at boot on a blank value, and a blank DSN is the *expected* state in dev. Booting the app must never depend on having an error tracker.

**File: `frontend/src/vite-env.d.ts`** — add both keys as optional:

```ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
}
```

**`?`, not `string`** — `.env.example` ships them blank, and a non-optional declaration would be a lie the type checker propagates into `optionalEnv`.

**This keeps `CONVENTIONS.md` § 9 true unchanged.** `import.meta.env` is still read in exactly four files; `monitoring.ts` imports `env`, like every other module.

### 11 — The monitoring module

**File: `frontend/package.json`** — add to `dependencies`:

```json
"@sentry/react": "^10.73.0"
```

**Create file: `frontend/src/shared/lib/monitoring.ts`:**

```ts
/**
 * Error monitoring. Entirely inert without VITE_SENTRY_DSN — every export is
 * a no-op, so no call site needs a guard and dev is unaffected.
 *
 * This is the "logging service" `shared/lib/logger.ts` promised would go
 * behind it. `logger` calls into this module; this module never calls
 * `logger`, and never touches `console` (oxlint `no-console` is on for every
 * file except logger.ts itself).
 */
import * as Sentry from '@sentry/react'

import { env } from '@/config/env'

let enabled = false

export function initMonitoring(): void {
  if (!env.sentryDsn) return
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    // Errors only — performance tracing is PROD-2's call, not this story's.
    integrations: [],
    tracesSampleRate: 0,
    // CONVENTIONS.md § 10: no emails, no IPs, no request bodies. The only
    // identity this app ever sends is the numeric user id (setMonitoringUser).
    sendDefaultPii: false,
  })
  enabled = true
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function addMonitoringBreadcrumb(level: 'warning' | 'error', message: string): void {
  if (!enabled) return
  Sentry.addBreadcrumb({ level, message })
}

/** `null` on logout. Never send email, name, or role — id only. */
export function setMonitoringUser(id: number | null): void {
  if (!enabled) return
  Sentry.setUser(id === null ? null : { id: String(id) })
}
```

**File: `frontend/src/main.tsx`** — call it immediately before the existing `logger.info` at line 20, importing it beside the other `./shared/...` imports:

```ts
import { initMonitoring } from './shared/lib/monitoring'

initMonitoring()
logger.info('API base URL:', env.apiBaseUrl)
```

**Before `createRoot`, and before `logger.info`** — `logger` forwards to `addMonitoringBreadcrumb` after task 12, and a breadcrumb recorded before `init` is dropped.

### 12 — Route the logger into it

**File: `frontend/src/shared/lib/logger.ts`** — keep all four signatures byte-identical; add a breadcrumb on the two levels that always emit:

```ts
import { addMonitoringBreadcrumb } from './monitoring'

...
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args)
    addMonitoringBreadcrumb('warning', args.map(String).join(' '))
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args)
    addMonitoringBreadcrumb('error', args.map(String).join(' '))
  },
```

Update the module docstring: *"Not a logging service — when one is added it goes behind this module, and no call site changes"* becomes a statement of fact, not a promise. **`debug` and `info` stay breadcrumb-free** — they are already stripped outside dev, so forwarding them would send nothing in production and add cost in dev for no reason.

### 13 — Send a request id with every call

**File: `frontend/src/shared/lib/api/client.ts`** — in the request interceptor at lines 47-57, after the `Accept-Language` block:

```ts
  // PROD-1: one id per logical call. The 401-refresh interceptor below
  // replays the SAME `config` object, so a refreshed retry keeps the id it
  // was first issued — the retry and the 401 that caused it correlate.
  if (!config.headers.has('X-Request-ID')) {
    config.headers.set('X-Request-ID', newRequestId())
  }
```

and above the interceptor:

```ts
function newRequestId(): string {
  // crypto.randomUUID is undefined on a non-localhost plain-HTTP origin (it
  // requires a secure context). The fallback keeps the header valid rather
  // than sending "undefined" — which the backend rejects against its own
  // ID_RE and silently replaces, losing the client/server link.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
}
```

The generated form (32 hex chars) satisfies the backend's `ID_RE` (`[A-Za-z0-9._-]{8,64}`), so the server adopts the client's id rather than minting its own — which is the whole point: the id in the browser's network tab is the id in the server log.

### 14 — Carry the id onto the error

**File: `frontend/src/shared/lib/api/types.ts`** — one field on `ApiErrorBody` (lines 34-41), beside `debug`:

```ts
  /** Correlation id — present on any error raised inside a request. */
  request_id?: string
```

**File: `frontend/src/shared/lib/api/errors.ts`** — one `readonly` field on `ApiRequestError` (lines 10-29), assigned in the constructor, and read in `toApiRequestError` (lines 71-116):

```ts
  readonly requestId: string | null
```

```ts
    this.requestId = init.requestId ?? null
```

In the envelope branch of `toApiRequestError` (the `isApiErrorBody(body.error)` case) and in the non-envelope branch below it:

```ts
      requestId:
        apiError.request_id ?? (error.response.headers?.['x-request-id'] as string) ?? null,
```

**The header fallback matters more than the body.** A gateway 502, an HTML error page from outside the `/api/` tree, or a 204 has no envelope to read `request_id` out of — but the response header is still there whenever the request reached Django. Axios lowercases response header keys, so `'x-request-id'` is the correct lookup. It resolves to `undefined` unless task 4's `CORS_EXPOSE_HEADERS` is in place.

The `timeout` and no-response branches leave `requestId` as `null` — correctly: the request never got an answer, so there is no server-side id to show. The client-side id it *sent* is still in the browser's network tab.

### 15 — Show it to the user

**File: `frontend/src/shared/ui/ErrorState.tsx`** — add a reference line below the retry button, above the `error.debug` block at lines 32-45:

```tsx
        {error.requestId ? (
          <p className="mt-2 text-xs opacity-70">
            {t('debug.reference')}{' '}
            {/* An id is code: bidi reordering makes it unreadable — and
                unusable to paste into a log query — in an RTL document. Same
                reasoning as the stack-trace block below. */}
            <code dir="ltr">{error.requestId}</code>
          </p>
        ) : null}
```

**File: `frontend/src/shared/i18n/locales/en/common.json`** — extend the existing `debug` object:

```json
"debug": { "details": "Debug details", "reference": "Reference:" }
```

**File: `frontend/src/shared/i18n/locales/ar/common.json`** — the same key:

```json
"reference": "المرجع:"
```

`common`, not `errors` — verified: every one of `errors.json`'s 16 keys is an API error code from `types.ts`'s `API_ERROR_CODES`/`CLIENT_ERROR_CODES`, and `ErrorState` looks that namespace up **by `error.code`**. A non-code key there would be a shape violation, and `ErrorState` already reads `debug.details` from `common`.

### 16 — Report render and route crashes

**File: `frontend/src/shared/ui/AppErrorBoundary.tsx`** — `componentDidCatch`, lines 40-42:

```tsx
  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Unhandled render error:', error, info.componentStack)
    captureError(error, { componentStack: info.componentStack })
  }
```

The fallback UI is unchanged.

**File: `frontend/src/app/RouteErrorBoundary.tsx`** — report only the **third** branch (the unknown fallback), from a `useEffect` so a re-render cannot report twice:

```tsx
  useEffect(() => {
    if (error instanceof ApiRequestError || isRouteErrorResponse(error)) return
    captureError(error, { source: 'route' })
  }, [error])
```

**Do not report the first two branches.** An `ApiRequestError` is already a logged server-side event with its own `request_id`; reporting it again from the client duplicates every 500 and turns every user's flaky wifi into a Sentry issue. An `isRouteErrorResponse` is a router 404 — navigation, not a crash.

### 17 — Report unexpected query/mutation failures

**File: `frontend/src/shared/lib/api/queryClient.ts`** — in `handle` (lines 25-34), report before toasting:

```ts
  const handle = (error: unknown) => {
    // Report only what a user cannot fix and the backend may not have seen: a
    // 5xx (the frontend half of a server error) and a non-ApiRequestError (a
    // bug in our own code path). NOT 4xx — a validation error or a 403 is the
    // system working. NOT isTransport — that is the user's network, and it
    // would make every subway ride an incident.
    if (!(error instanceof ApiRequestError)) {
      captureError(error, { source: 'query' })
    } else if (error.status !== null && error.status >= 500) {
      captureError(error, { source: 'query', requestId: error.requestId, code: error.code })
    }
    onError(...)
  }
```

The rest of `createQueryClient` — `shouldRetry`, `staleTime`, the `MutationCache`/`QueryCache` wiring at lines 47-55 — is unchanged.

### 18 — Attach the user id

**File: `frontend/src/shared/auth/AuthProvider.tsx`** — three one-line additions, each immediately after the existing `setUser` call:

- boot effect, after `setUser(me)` at line 33 → `setMonitoringUser(me.id)`
- `login`, after `setUser(me)` at line 57 → `setMonitoringUser(me.id)`
- `logout`, after `setUser(null)` at line 71 → `setMonitoringUser(null)`

**Only `me.id`.** `AuthUser` also carries `email`, `first_name`, `last_name`, `role`, and `permissions` (`shared/auth/types.ts`) — none of it goes to Sentry. That is what `sendDefaultPii: false` promises and what § 10 requires; the id alone is enough to join against the backend's own `user_id` log field.

---

## Documentation Tasks

### 19 — `.env.example`, README, CONVENTIONS

**File: `backend/.env.example`** — extend the existing `# --- Logging ---` block and add a new one:

```
# --- Logging ---
DJANGO_LOG_LEVEL=INFO
# "text" (human-readable, the dev default) or "json" (one object per line).
# config/settings/prod.py defaults this to "json".
DJANGO_LOG_FORMAT=text

# --- Error monitoring (PROD-1) ---
# Leave SENTRY_DSN blank to disable error monitoring entirely — no network
# call, no behaviour change. That is the correct local default.
SENTRY_DSN=
SENTRY_ENVIRONMENT=local
SENTRY_TRACES_SAMPLE_RATE=0.0
```

**File: `frontend/.env.example`** — append:

```
# Leave blank to disable browser error monitoring (the local default).
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=local
```

**File: `README.md`** — four rows in the backend table (after `DJANGO_LOG_LEVEL`, line 660) and two in the frontend table (after `VITE_API_BASE_URL`, line 684):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DJANGO_LOG_FORMAT` | no | `text` (`json` in prod) | Log output format: `text` for humans, `json` for a collector. See `CONVENTIONS.md` § 33. |
| `SENTRY_DSN` | no | *(empty — error monitoring disabled)* | Sentry project DSN. Blank means no SDK init and no network call. |
| `SENTRY_ENVIRONMENT` | no | `local` | Environment tag on every Sentry event. |
| `SENTRY_TRACES_SAMPLE_RATE` | no | `0.0` | Performance-trace sampling. `0.0` = errors only; raising it is `PROD-2`'s call. |
| `VITE_SENTRY_DSN` | no | *(empty — disabled)* | Browser Sentry DSN. **Public by design** — a DSN is not a secret, but it is bundled into the shipped JS. |
| `VITE_SENTRY_ENVIRONMENT` | no | `local` | Environment tag on browser events. |

Also add `X-Request-ID` to **README § API conventions** (lines 353-400), after the "Error" example, as a short subsection: every response carries an `X-Request-ID` header; every **error** body additionally carries `error.request_id`; a client may propose its own id and the server adopts it when it matches `[A-Za-z0-9._-]{8,64}`.

**File: `CONVENTIONS.md`** — append **§ 33** after § 32's last line (2194). Renumber nothing. It records:

- The three-layer mechanism: `ContextVar` (`apps/core/logging.py`) → handler-level `ContextFilter` → `JsonFormatter`. **A new logger declaration needs no correlation code**, because the filter is on the handler.
- **`text` for humans, `json` for collectors**, and where each default is set.
- **`request.path`, never `request.get_full_path()`, in any log call** — with the `EMAIL_INBOUND_WEBHOOK_TOKEN` `?token=` case named as the reason. This is § 10's rule made specific.
- **`extra=` keys are scrubbed by name, not by value**, and `user_id`/`request_id`/`celery_task_id`/`celery_task` are reserved — a call site that passes one raises inside the logging machinery.
- **`request_id` lives inside `error`**, not at the top level and not in `meta`, and the two existing tests that fix it there.
- **Sentry is DSN-gated and errors-only.** No breadcrumb, event, tag, or user field ever carries an email, a body, a header value matching `SENSITIVE_KEY_RE`, or a query string. A future story raising `traces_sample_rate` is making a `PROD-2` decision, not a `PROD-1` one.
- **`print()` is now genuinely absent from `apps/` and `config/`** — with the `grep` that proves it, so a reviewer can re-run it.

---

## Edge Cases & Failure Modes

- **`ContextVar` not reset → the next request inherits the previous id.** `RequestIDMiddleware.__call__`'s `finally` block resets both vars unconditionally, including when `get_response` raises. Without it, a worker thread reused across requests mislabels every subsequent line — worse than having no id, because the log *looks* correct. Enforced at `apps/core/middleware.py`, `RequestIDMiddleware.__call__`.
- **A `{}`-style format string referencing a missing record attribute raises on every log line.** The new `text` format uses `[{request_id}]`. `ContextFilter.filter` therefore sets `request_id` (and the other three) on **every** record it sees, empty string included, and is registered on the **handler** so no logger can bypass it. If the filter is ever moved to a logger, `django.request`'s own records lose the attribute and logging breaks globally — a `ValueError` raised from inside `logging`, which surfaces as garbage on stderr rather than as an exception.
- **`extra` key collision with a reserved `LogRecord` attribute.** `logging` raises `KeyError: "Attempt to overwrite 'user_id' in LogRecord"` for any `extra` key that already exists on the record. `AccessLogMiddleware` therefore passes `req_user_id`, not `user_id`. Any future call site adding `extra={"name": ...}`, `{"module": ...}`, or `{"args": ...}` hits the same wall — the reserved set is listed in `apps/core/logging.py::RESERVED`.
- **A non-JSON-serialisable value in `extra`.** A `UUID`, `Decimal`, `datetime`, or model instance would raise `TypeError` inside `json.dumps` — from inside the logging machinery, where it becomes a silent stderr dump, not an exception a developer sees. `JsonFormatter.format` passes `default=str`. Handled at `apps/core/logging.py::JsonFormatter.format`.
- **A hostile or malformed `X-Request-ID` header.** A caller sending an embedded newline would forge log lines; a 10 KB string would inflate every record. `RequestIDMiddleware._incoming` accepts only `ID_RE` (`[A-Za-z0-9._-]{8,64}`, `fullmatch`) and otherwise generates a fresh UUID4 hex, silently. There is no error response for a bad id — it is a hint, not input.
- **A query string carrying a credential.** `/api/communications/email/inbound/?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>` (COMM-1) is authenticated by query parameter. `AccessLogMiddleware` logs `request.path` only, and `before_send` pops `request["query_string"]` from every Sentry event. This is the concrete § 10 failure this story exists to prevent.
- **`request.user` is not yet authenticated during the middleware request phase.** JWT authentication runs inside the DRF view. `AccessLogMiddleware` reads the user in the **response** phase, which works because DRF's `Request.user` setter writes back to the underlying `HttpRequest` (`rest_framework/request.py:235-246`, verified live). A user id read in the request phase would be `None` for every authenticated API call.
- **Evaluating `request.user` forces the lazy object.** `AuthenticationMiddleware` installs a `SimpleLazyObject`; `getattr(user, "is_authenticated", False)` evaluates it. For the `/api/` tree there is no session cookie, so it resolves to `AnonymousUser` with no query. For `/admin/` it costs the session lookup the admin was about to do anyway. Accepted, and stated rather than hidden.
- **WebSocket connections are not correlated.** Django's HTTP middleware chain never runs for an ASGI `websocket` scope, so `apps/communications`' Channels consumers (COMM-3) log with `request_id` empty. Deliberately out of scope — Channels correlation needs its own middleware in `config/asgi.py`, a different mechanism rather than a variation of this one.
- **Celery tasks have no request id, only a task id.** A task queued by a request runs in a different process; the `ContextVar` does not travel with it. `ContextFilter` reads `celery.current_task` and emits `celery_task_id`/`celery_task` instead, so a task's lines correlate **to each other**. Joining a task back to the request that queued it would mean passing the id as a task argument at every `.delay()` call site — a change across `apps/{sla,tickets,accounts,notifications,ai,integrations}/tasks.py` callers that this story does not make.
- **`current_task` import at settings time.** Importing `celery` in `apps/core/logging.py` at module scope would run during `dictConfig`, before the app registry exists, and can cycle with `config/celery.py`. The import is **function-local** inside `ContextFilter.filter`, wrapped in `try/except Exception` — a correlation failure must never suppress the log line it was decorating.
- **`SENTRY_DSN` set to a malformed value.** `sentry_sdk.init` raises `BadDsn` at settings import, so the app fails to start with a clear message rather than running blind. Correct: a DSN that was deliberately configured and is wrong is a deployment error, not something to swallow. An **empty** DSN is the supported "off" state and is never an error.
- **`crypto.randomUUID` is undefined outside a secure context.** Serving the frontend over plain HTTP from a non-`localhost` host makes it `undefined`, and the header would go out as the string `"undefined"` — which fails the backend's `ID_RE`, gets silently replaced, and breaks the client↔server link with no visible symptom. `newRequestId()` feature-detects and falls back to a timestamp+random hex string that still satisfies `ID_RE`. Handled in `client.ts::newRequestId`.
- **`CORS_EXPOSE_HEADERS` missing → `error.requestId` is silently `null` for every non-envelope failure.** The browser hides unlisted response headers from JS with no console warning. This is the failure most likely to be mistaken for "the backend isn't sending the header" — check the raw response in the network tab before touching `middleware.py`. Verification step 6 exists to catch it.
- **The 401-refresh retry.** `client.ts`'s refresh interceptor (lines 62-93) replays the original `config`. Because task 13 guards with `if (!config.headers.has('X-Request-ID'))`, the replay reuses the first id — so the 401 and the successful retry share one id in the server log. That is the intent; a fresh id per attempt would split one user action across two unrelated log queries.
- **Access-log volume.** One INFO line per request, minus `/api/health/`. At this project's scale that is not a concern; if it becomes one, `DJANGO_LOG_LEVEL=WARNING` suppresses access lines while keeping every 5xx (which `AccessLogMiddleware` logs at `WARNING`). That level split is deliberate.
- **Errors raised inside a middleware above `AccessLogMiddleware`.** `CorsMiddleware` sits above both new entries; an exception there produces no access-log line. Accepted — that is one third-party middleware, and Django's own `django.request` logger still records it.
- **The two new dependencies must not become required.** Neither `sentry-sdk` nor `@sentry/react` is imported at module scope on the backend (`import sentry_sdk` sits **inside** `if SENTRY_DSN:`), but `@sentry/react` **is** a static import in `monitoring.ts` and therefore ships in the bundle regardless of DSN. That is a real, accepted cost: roughly 30 KB gzipped on every load for a feature that may be off. Do **not** make it a dynamic import — `init` must complete before the first render for a boot-time crash to be captured at all, which is the case it most needs to cover.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16 — *"no new test file is added anywhere in the repo"*). No test file is added, changed, or removed.

The 54 existing backend tests **must still pass unchanged**, and three are directly load-bearing for this story's design — run them first and read them if they fail:

1. `backend/apps/core/tests/test_exceptions.py` — `assertEnvelope` (lines 28-34) pins the four top-level envelope keys on every error path. It passes only because task 7 puts `request_id` **inside `error`**. A failure here means the id was added at the top level or to `meta`.
2. `backend/apps/core/tests/test_envelope.py:61` and `test_exceptions.py:98` — `assertNotIn("debug", …)`. These call `error_envelope` outside any request, where `get_request_id()` returns `""`, so `request_id` is correctly absent too. A failure here means the `if request_id:` guard was dropped and the key is written unconditionally.
3. `backend/config/tests/test_settings.py:96-99` — `test_cors_middleware_is_first`. A failure here means task 4 inserted a middleware at index 0 instead of index 1.

Verification is otherwise the lint/build gates plus the manual walkthrough in `## Verification Steps`.

---

## Migration / Rollback

**No database migration.** This story adds no model, no field, and no table; `python manage.py makemigrations --check --dry-run` must still report no changes (also asserted by `config/tests/test_settings.py::MigrationStateTests`).

**The API contract change is additive and optional.** `error.request_id` appears only when a request produced the error. `frontend/src/shared/lib/api/types.ts` declares it `request_id?`, so an older frontend against a newer backend ignores an unknown key, and a newer frontend against an older backend falls through to the `x-request-id` header and then to `null` — `ErrorState` renders nothing when `requestId` is `null`. **No coordinated deploy is required in either direction.**

**Rollback, in order:**

1. `SENTRY_DSN=` / `VITE_SENTRY_DSN=` (blank) turns off all error reporting with no code change. Do this first — it is the whole of the "external SaaS" concern.
2. `DJANGO_LOG_FORMAT=text` in production reverts the output format alone, keeping correlation. Use this if a log collector chokes on the JSON shape.
3. Removing the two `apps.core.middleware.*` entries from `MIDDLEWARE` reverts correlation and access logging. **`error_envelope` and the `text` formatter both stay correct**: `get_request_id()` returns `""`, so the key is omitted and `[{request_id}]` renders as `[]`.
4. Full revert is a clean file-level revert: two new backend files, one new frontend file, and edits that are all additive.

**Half-applied states to watch for:**

- **Middleware registered but `apps/core/logging.py` absent** → `django.setup()` fails at `dictConfig` with `ValueError: Unable to configure filter 'context'`. The app does not start; there is no silent-failure window.
- **`text` formatter shipped without `ContextFilter` on the handler** → `ValueError: Formatting field not found in record: 'request_id'` on **every** log line, printed to stderr by the logging machinery rather than raised. The app appears to run and logs nothing useful. Check `LOGGING["handlers"]["console"]["filters"]` first.
- **Backend deployed, frontend not** → the server mints its own id per request. Everything works; the id just is not the one in the browser's network tab.
- **Frontend deployed, backend not** → the extra `X-Request-ID` request header is rejected by CORS preflight (it is not in the old `CORS_ALLOW_HEADERS`) and **every cross-origin API call fails**. This is the one ordering that breaks: **deploy the backend first.**

---

## Verification Steps

1. **Backend lints and formats:** from `backend/` — `ruff format --check .` then `ruff check .`. Both exit 0. `ruff check` is what catches the import-order slip in `settings/base.py` (stdlib `logging` above `from datetime import timedelta`) and any unused import left in `celery.py`.
2. **Backend boots and the config is valid:** from `backend/` — `python manage.py check`. A typo in the `LOGGING` dict fails here with `ValueError: Unable to configure …`, not at first request.
3. **Existing tests still pass:** from `backend/` — `python manage.py test`. Expect **54 passing, 0 failures**. Then `python manage.py makemigrations --check --dry-run` → `No changes detected`.
4. **Text logging with correlation:** from `backend/` with `DJANGO_LOG_FORMAT=text` — `python manage.py runserver`, then `curl -i http://localhost:8000/api/customers/`. Confirm the server log shows one line like `2026-09-03 … INFO apps.core.middleware [a3f9…] GET /api/customers/ 401`, and that `curl -i`'s response headers include `X-Request-ID: a3f9…` **with the same value**.
5. **JSON logging:** restart with `DJANGO_LOG_FORMAT=json` and repeat. Confirm each captured line parses — `python -c "import sys,json; [json.loads(l) for l in sys.stdin if l.strip()]"` fed from the captured output exits 0 — and that one object contains `ts`, `level`, `logger`, `msg`, `request_id`, `http_method`, `http_path`, `http_status`, `duration_ms`.
6. **The client id is adopted; a bad one is not:**
   ```bash
   curl -s -D- -o/dev/null -H "X-Request-ID: abcdef0123456789" http://localhost:8000/api/customers/
   curl -s -D- -o/dev/null -H "X-Request-ID: short" http://localhost:8000/api/customers/
   ```
   The first response's `X-Request-ID` echoes `abcdef0123456789` exactly, and that string appears on the access-log line. The second (5 chars, below `ID_RE`'s minimum of 8) echoes a fresh 32-hex-char id instead.
7. **The health probe is not access-logged:** `curl http://localhost:8000/api/health/` five times. Confirm **zero** `apps.core.middleware` lines appear, while five calls to `/api/customers/` produce five. This is `SKIP_PATHS` working.
8. **No credential in a log line:** `curl "http://localhost:8000/api/communications/email/inbound/?token=SUPERSECRET"`. Confirm `SUPERSECRET` appears **nowhere** in the server output — `grep SUPERSECRET` over the captured log returns nothing. This is the § 10 check that matters most.
9. **A 500 is correlated end to end:** temporarily `raise RuntimeError("boom")` from any DRF view, call it, and confirm (a) the response body is `{"success": false, …, "error": {"code": "internal_error", …, "request_id": "<id>"}}`, (b) the response header `X-Request-ID` is the **same** `<id>`, (c) the traceback log line carries that `request_id`, and (d) `exc_type` is `RuntimeError` in the JSON line. **Remove the raise afterwards.**
10. **Celery correlation and the `print` removal:** from `backend/` with Redis running — `celery -A config worker -l info` in one terminal, then `python manage.py shell -c "from config.celery import debug_task; debug_task.delay()"`. Confirm the worker logs `debug_task ran` **through the configured handler** (JSON when `DJANGO_LOG_FORMAT=json`) with `celery_task_id` populated, and that no raw `Request: <Context …>` line appears. Then prove the class of bug is gone: `grep -rn "print(" backend/apps backend/config --include="*.py" | grep -v fingerprint` returns nothing.
11. **Sentry off is genuinely off:** with `SENTRY_DSN` blank, run `python manage.py shell -c "import sys; print('sentry_sdk' in sys.modules)"` and confirm it prints `False`, and that `python manage.py check` makes no outbound connection.
12. **Sentry on:** set `SENTRY_DSN` to a real project DSN, repeat step 9, and confirm the issue appears in Sentry tagged `request_id=<id>`, with **no** `data`, `cookies`, or `query_string` on the request, no email anywhere, and any `Authorization` header shown as `[redacted]`.
13. **Frontend builds and lints:** from `frontend/` — `npm install`, then `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl`. All exit 0. `npm run lint` catches a `console.*` slip in `monitoring.ts` (the `no-console` override covers only `logger.ts`); `npm run build` catches a missing `VITE_SENTRY_DSN` entry in `vite-env.d.ts`.
14. **The browser sends and reads the id:** from `frontend/` — `npm run dev`, open DevTools → Network, sign in, and inspect any `/api/` call. Confirm the **request** carries `X-Request-ID: <32 hex>` and the **response** carries the identical `X-Request-ID`. Then grep the Django terminal for that exact string and confirm it appears on the access-log line.
15. **The user sees the reference:** with the temporary 500 from step 9 in place, trigger it from the UI. Confirm `ErrorState` renders "Reference: `<id>`" and that the id matches the network tab. Switch to العربية and confirm the label is Arabic, the id itself stays left-to-right and selectable, and no horizontal scrollbar appears.
16. **Refresh-retry shares one id:** let an access token expire (or clear it from memory), then trigger any authenticated call. Confirm in the network tab that the 401 and the replayed 200 carry the **same** `X-Request-ID`.
17. **Reporting is filtered, not indiscriminate:** with `VITE_SENTRY_DSN` set — (a) submit a form that fails validation → confirm **no** Sentry event; (b) stop the backend and trigger a call → confirm **no** Sentry event (transport failure); (c) trigger the step-9 500 → confirm **one** event with `source: "query"` and the `requestId` in its extras; (d) throw from a component's render → confirm **one** event with `componentStack`.
18. **Only the id is sent as identity:** in Sentry, open any event from step 17 and confirm `user` is `{"id": "<number>"}` — **no** email, username, name, role, or IP.
19. **Regression — nothing else moved:** sign in, list and open a ticket, send a reply, open `/settings/webhooks` and `/settings/roles`, switch language, toggle theme. Everything behaves exactly as before. Then confirm the pre-commit gates pass whole-tree: `ruff format --check .` / `ruff check .` (backend) and `oxlint` / `prettier --check .` (frontend), since `.githooks` runs them on every commit.

---

## Done Criteria

- [ ] `backend/apps/core/logging.py` exists with `request_id_var`, `user_id_var`, `ID_RE`, `SENSITIVE_KEY_RE`, `RESERVED`, `new_request_id`, `get_request_id`, `scrub`, `ContextFilter`, and `JsonFormatter`, and imports nothing from `django.conf`, any `models.py`, or `config.celery` at module scope.
- [ ] `backend/apps/core/middleware.py` exists with `RequestIDMiddleware` and `AccessLogMiddleware`, registered at `MIDDLEWARE[1]` and `MIDDLEWARE[2]`, with `corsheaders.middleware.CorsMiddleware` still at index 0.
- [ ] `DJANGO_LOG_FORMAT=json` produces one parseable JSON object per line carrying `ts`, `level`, `logger`, `msg`, and `request_id`; `DJANGO_LOG_FORMAT=text` produces the human format with `[{request_id}]`. `config/settings/prod.py` defaults it to `json`.
- [ ] Every response carries an `X-Request-ID` header; a client-supplied id matching `[A-Za-z0-9._-]{8,64}` is adopted verbatim, and anything else is silently replaced with a fresh one.
- [ ] Exactly one access-log line per request, with method, path, status, `duration_ms`, and `req_user_id`; `/api/health/` produces none; a 5xx logs at `WARNING`.
- [ ] `error.request_id` is present on error envelopes raised inside a request and absent otherwise — and `python manage.py test` still reports **54 passing, 0 failures**.
- [ ] `grep -rn "print(" backend/apps backend/config --include="*.py"` returns no real `print` call; `config/celery.py::debug_task` logs through the `config` logger with `celery_task_id`.
- [ ] `sentry-sdk[django]>=2.68,<3` is in `backend/requirements.txt` and `@sentry/react` in `frontend/package.json`; both are **completely inert** with a blank DSN, and `sentry_sdk` is not even imported in that state.
- [ ] With a DSN set: an unhandled 500, a React render crash, a route-loader crash, and a 5xx query failure each produce exactly one Sentry event; a 4xx and a transport failure produce none.
- [ ] No Sentry event, breadcrumb, tag, or user field carries an email, a name, a role, a request body, a cookie, a query string, or a header matching `SENSITIVE_KEY_RE`; `user` is `{"id": "<number>"}` or absent.
- [ ] `ErrorState` renders a copyable, `dir="ltr"` reference id whenever `error.requestId` is set, labelled from `common:debug.reference` in both `en` and `ar`.
- [ ] A 401 and its replayed retry share one `X-Request-ID`.
- [ ] `CONVENTIONS.md` § 33 exists and records the mechanism, the `request.path` rule, the reserved `extra` key names, the `request_id`-inside-`error` placement, and the DSN-gated errors-only posture. `CONVENTIONS.md` § 9's four-file `import.meta.env` list is **unchanged and still true**.
- [ ] `backend/.env.example`, `frontend/.env.example`, and both `README.md` env tables list all six new variables; README § API conventions documents `X-Request-ID` and `error.request_id`.
- [ ] No migration is produced: `python manage.py makemigrations --check --dry-run` reports `No changes detected`.
- [ ] All gates pass: `ruff format --check .`, `ruff check .`, `python manage.py check`, `python manage.py test` (backend); `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` (frontend).

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 89 (`PROD-2` — Performance & Caching).**
