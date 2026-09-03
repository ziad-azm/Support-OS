# production-readiness — plan overview

Entry point for the **production-readiness** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 88 | [88-story-observability-logging-SUPPORTOS-116.md](88-story-observability-logging-SUPPORTOS-116.md) | Observability & Logging (`PROD-1`) | SUPPORTOS-116 | All prior epics (EPIC 0–16). Directly: Story 03 (`CONV`, `CONVENTIONS.md` § 10), Story 02 (`API` envelope, `apps/core/`), Story 27 (`SLA-0`, `config/celery.py`) |

**EPIC 17 is partially planned.** Story 88 (`PROD-1`) is planned, not yet implemented. `PROD-2` (Performance & Caching), `PROD-3` (Security Hardening), and `PROD-4` (Optional Docker Packaging) — `SupportOs backlog.MD:959-971` — are not yet planned.

## Dependency notes

This feature maps to **EPIC 17 — Production Readiness** in `SupportOs backlog.MD` (lines 950-971). The epic's own stated dependency is **"all prior epics"** (line 952): it hardens what the other sixteen built rather than adding a domain capability, so every story here reaches across the whole tree instead of into one app.

`PROD-1` (Story 88) → `PROD-2` → `PROD-3` → `PROD-4` in backlog order, but only the first is planned. The ordering is real for the first two: `PROD-2` is *"optimize by evidence, no premature tuning"* (`SupportOs backlog.MD:961`), and Story 88's per-request `duration_ms` access log is the cheapest evidence this project has for what is actually slow. **Plan `PROD-2` after `PROD-1` has been running long enough to produce that evidence**, not before.

### Contracts Story 88 sets for the rest of this epic

- **`X-Request-ID` is the correlation primitive.** One id spans the browser fetch, the Django request, the access log, the exception traceback, the Celery task, and the Sentry event. Any later story adding an async hop, a cache layer, or a proxy must carry it through rather than invent a second id.
- **`request_id` lives *inside* the envelope's `error` object** — not at the top level and not in `meta`. Fixed by two existing tests (`apps/core/tests/test_exceptions.py:28-34` pins the four top-level keys; `test_health.py:30` pins `meta` to `None` on a success). This is a hard constraint on any future envelope change, not a preference.
- **Correlation is handler-level, so it is free for new code.** `ContextFilter` is registered on the `console` handler, not on individual loggers, so a new `logging.getLogger(__name__)` anywhere under `apps.*`/`config.*`/`celery.*` is correlated with no extra code. A later story must not move that filter onto a logger.
- **`request.path`, never `request.get_full_path()`, in any log call.** The inbound-email webhook (COMM-1) authenticates via `?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>`; logging full paths would write that shared secret to stdout on every delivery. Recorded as `CONVENTIONS.md` § 33.
- **`traces_sample_rate` defaults to `0.0` and stays there until `PROD-2`.** Story 88 is error monitoring only. Turning on performance tracing is a `PROD-2` decision with its own cost/benefit, deliberately not smuggled in here.

### Decisions confirmed with the user during Story 88's planning

- **Sentry, DSN-gated — not an in-house `ErrorEvent` table.** Two new dependencies (`sentry-sdk[django]`, `@sentry/react`), both inert with a blank DSN, which is the default in `.env.example` and therefore in every existing clone. A deliberate exception to `CONVENTIONS.md` § 17 and to the stdlib-first posture Story 83 recorded (`urllib.request` over `requests`): nothing already in this dependency set does error aggregation, deduplication, or alerting. The accepted cost — with a DSN configured, exception context leaves the box to a third-party SaaS — is stated in the story's `## Prerequisites` rather than buried.
- **Format and correlation only; no re-audit of existing call sites.** The 19 backend modules holding a `logging.getLogger` keep their current messages, levels, and interpolation. The single exception is `config/celery.py:40`'s `print(f"Request: {self.request!r}")`, which is an outright § 10 violation (and leaks task args), not a style preference.

### Verified findings that shaped Story 88

- **The envelope cannot grow a top-level key.** `assertEnvelope` (`apps/core/tests/test_exceptions.py:28-34`) asserts the exact four-key set on **every** error-mapping test, and `test_health.py:30` asserts `meta is None` on a success — so neither the top level nor `meta` was available for `request_id`. `error_envelope`'s existing conditional `debug` key (`apps/core/envelope.py:39-40`) became the literal template instead.
- **DRF writes the authenticated user back onto the underlying `HttpRequest`.** `rest_framework/request.py:235-246`, whose own docstring says it does this *"ensuring that it is available to any middleware in the stack."* Verified against the installed version. This is the only reason the access log can record a `user_id` at all — JWT authentication happens inside the view, long after middleware's request phase, so the read must happen on the way out.
- **`CorsMiddleware` is pinned at `MIDDLEWARE[0]`** by `config/tests/test_settings.py:96-99`, so the two new middleware take indices 1 and 2, not 0.
- **CORS needs both halves, and they are not symmetrical.** `CORS_ALLOW_HEADERS` lets the browser *send* `X-Request-ID`; `CORS_EXPOSE_HEADERS` (which this project did not have at all) lets JavaScript *read* it back. Omitting the second fails silently — the browser hides the header with no console warning, which reads exactly like "the backend isn't sending it".
- **`config.celery` was outside the configured logger tree.** Only `apps`, `django`, and `django.request` had handlers, so replacing the `print()` with a `logger.info` would have silently dropped the line to `root` at WARNING — turning a fix into a regression of the SLA-0 smoke test. Story 88 adds `config` and `celery` logger entries for that reason.
- **This project has no `print()` problem beyond that one line.** `grep -rn "print("` across `apps/` and `config/` returns five hits; four are `password_fingerprint` substring matches. `CONVENTIONS.md` § 10's "never `print()`" rule was already being followed everywhere else.
- **`CONVENTIONS.md` § 9's "`import.meta.env` is read in exactly four files" rule survives untouched.** The new `shared/lib/monitoring.ts` imports `env` from `config/env.ts` like every other module, so neither § 9 nor `frontend/src/README.md` line 162 needs editing.

**Note on testing:** per standing project policy (`CONVENTIONS.md` § 16) this project authors no automated tests. Story 88 adds none. Its checks are the backend gates (`ruff format --check`, `ruff check`, `manage.py check`, `manage.py test` — the 54 existing tests must stay green), the frontend gates (`npm run build`/`lint`/`format:check`/`check:rtl`), and a 19-step manual walkthrough that includes the two checks a static gate cannot make: that a credential in a query string never reaches a log line, and that one request id survives end to end from the browser's network tab to the server log to the Sentry event.
