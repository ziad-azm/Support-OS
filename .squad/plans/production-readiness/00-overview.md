# production-readiness — plan overview

Entry point for the **production-readiness** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 88 | [88-story-observability-logging-SUPPORTOS-116.md](88-story-observability-logging-SUPPORTOS-116.md) | Observability & Logging (`PROD-1`) | SUPPORTOS-116 | All prior epics (EPIC 0–16). Directly: Story 03 (`CONV`, `CONVENTIONS.md` § 10), Story 02 (`API` envelope, `apps/core/`), Story 27 (`SLA-0`, `config/celery.py`) |
| 91 | [91-story-performance-caching-SUPPORTOS-117.md](91-story-performance-caching-SUPPORTOS-117.md) | Performance & Caching (`PROD-2`) | SUPPORTOS-117 | Story 88 (consumes its `duration_ms` access log as the production evidence source); Story 27 (`SLA-0`, the existing `redis` dependency and `REDIS_URL` contract) |
| 92 | [92-story-security-hardening-SUPPORTOS-118.md](92-story-security-hardening-SUPPORTOS-118.md) | Security Hardening (`PROD-3`) | SUPPORTOS-118 | **Story 91 — hard dependency**: DRF throttling is backed by `django.core.cache`, so rate limiting is per-worker and unreliable without `PROD-2`'s Redis. Also Story 88 (429s observable in the access log; § 34's secret scrubbing is what this story audits) |

**EPIC 17 status.** Story 88 (`PROD-1`) is **implemented and committed** (`3da9f28`, `CONVENTIONS.md` § 34). Story 91 (`PROD-2`) is **implemented and committed** (`f164c78`, § 35). Story 92 (`PROD-3`) is planned, not yet implemented. `PROD-4` (Optional Docker Packaging) — `SupportOs backlog.MD:967-971` — is not yet planned.

## Dependency notes

This feature maps to **EPIC 17 — Production Readiness** in `SupportOs backlog.MD` (lines 950-971). The epic's own stated dependency is **"all prior epics"** (line 952): it hardens what the other sixteen built rather than adding a domain capability, so every story here reaches across the whole tree instead of into one app.

`PROD-1` (Story 88) → `PROD-2` (Story 91) → `PROD-3` (Story 92) → `PROD-4` in backlog order, and **the first two orderings are hard, not editorial**. `PROD-2` needs `PROD-1`'s `duration_ms` evidence; `PROD-3` needs `PROD-2`'s Redis cache, because DRF's rate limiting is backed by `django.core.cache` (`rest_framework/throttling.py:6,62`) — on the `LocMemCache` default every throttle is per-worker, so N workers allow N× the configured rate. A rate limit added before a shared cache exists is not a rate limit. The first ordering is real and was honoured: `PROD-2` is *"optimize by evidence, no premature tuning"* (`SupportOs backlog.MD:961`), and `PROD-1`'s per-request `duration_ms` access log is the durable production evidence source it consumes. Story 91 did not wait for production traffic to accumulate — it produced its evidence by direct measurement against a seeded 250,000-row throwaway database instead, and `PROD-1`'s access log remains the mechanism for driving the *next* round of tuning.

### Contracts Story 88 sets for the rest of this epic

- **`X-Request-ID` is the correlation primitive.** One id spans the browser fetch, the Django request, the access log, the exception traceback, the Celery task, and the Sentry event. Any later story adding an async hop, a cache layer, or a proxy must carry it through rather than invent a second id.
- **`request_id` lives *inside* the envelope's `error` object** — not at the top level and not in `meta`. Fixed by two existing tests (`apps/core/tests/test_exceptions.py:28-34` pins the four top-level keys; `test_health.py:30` pins `meta` to `None` on a success). This is a hard constraint on any future envelope change, not a preference.
- **Correlation is handler-level, so it is free for new code.** `ContextFilter` is registered on the `console` handler, not on individual loggers, so a new `logging.getLogger(__name__)` anywhere under `apps.*`/`config.*`/`celery.*` is correlated with no extra code. A later story must not move that filter onto a logger.
- **`request.path`, never `request.get_full_path()`, in any log call.** The inbound-email webhook (COMM-1) authenticates via `?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>`; logging full paths would write that shared secret to stdout on every delivery. Recorded as `CONVENTIONS.md` § 34.
- **Silencing a logger needs an explicit `NullHandler`.** A logger with `handlers: []` and `propagate: False` falls through to `logging.lastResort`, a WARNING-level stderr handler that prints the bare message unformatted. Story 88 hit this while silencing `django.channels.server`.

### Contracts Story 91 sets for the rest of this epic

- **Every cache read and write goes through `apps/core/cache.py`**, which swallows every exception. A Redis outage degrades to uncached, **never** to a 500. A later story must not call `django.core.cache` directly.
- **A cache key must fully determine the response it stores.** Report caching is safe only because report scoping is by *query param* (`apply_scope_filters`), not by caller identity. The identity-scoped `apps/portal/` tree is **never** cached on a path+query key — see `apps/core/scoping.py`'s own docstring for the distinction the whole rule rests on.
- **Celery's Redis database (`REDIS_URL`, db 0) is never shared with the cache** (`REDIS_CACHE_URL`, db 1). A cache flush must not drop queued jobs.
- **`count`/`num_pages` cannot leave the `meta.pagination` envelope** — four frontend call sites read them (`DataTablePagination.tsx:31,59`, `HomePage.tsx:137,144`). `COUNT(*)` must be made cheap, never removed.

### Verified findings that shaped Story 88

- **The envelope cannot grow a top-level key.** `assertEnvelope` (`apps/core/tests/test_exceptions.py:28-34`) asserts the exact four-key set on **every** error-mapping test, and `test_health.py:30` asserts `meta is None` on a success — so neither the top level nor `meta` was available for `request_id`. `error_envelope`'s existing conditional `debug` key became the literal template instead.
- **DRF writes the authenticated user back onto the underlying `HttpRequest`.** `rest_framework/request.py:235-246`, whose own docstring says it does this *"ensuring that it is available to any middleware in the stack."* This is the only reason the access log can record a `user_id` — JWT authentication happens inside the view, so the read must happen on the way out.
- **Django logs its own 4xx/5xx *outside* the middleware chain.** `django/core/handlers/base.py:140-143` runs the chain and then calls `log_response`, after the request-id ContextVar has been reset — so `django.request` lines carry no id, by design. Not worth "fixing" by dropping the reset: a ContextVar surviving a request would mislabel a later one.
- **Channels' runserver access log printed the full path including the query string**, leaking `?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>` to stdout on every inbound-email delivery. Found by Story 88's own verification step 8; silenced with a `NullHandler`.
- **CORS needs both halves, and they are not symmetrical.** `CORS_ALLOW_HEADERS` lets the browser *send* `X-Request-ID`; `CORS_EXPOSE_HEADERS` lets JavaScript *read* it back. Omitting the second fails silently.

### Verified findings that shaped Story 91 — all measured, none assumed

Measured against a throwaway test database seeded with **250,000 customers and 250,000 tickets**, with a realistic skewed status distribution (97% `closed`). Reproducible via the harness in the story's `## Verification Steps`.

- **There is no N+1 anywhere in this API — the largest expected slice of `PROD-2` turned out to be already done.** 28 endpoints (every list, the ticket detail/`history`/`context`/`sla` actions, `customers/<id>/timeline`, all eight reports) were measured with `CaptureQueriesContext` at 1 row and 25 rows. **Every query count is flat.** The existing `select_related` discipline across 23 modules and the `Subquery` batching in `apps/reports/sla.py`/`agents.py` (Stories 57/58) already work. Story 91 therefore adds **no** `select_related` and rewrites **no** serializer.
- **`COUNT(*)` is the worst scaling property in the API, and no index can fix it.** 4.3 ms at 50k rows → **96.1 ms at 250k** (`Parallel Seq Scan`), on *every* paginated request. `HomePage`'s two KPI tiles use `page_size=1`, so for them the `COUNT` **is** the entire request. This drove the count-cache design.
- **A filter does not justify a composite index — selectivity does.** `(status, -created_at)` on `tickets_ticket` bought **nothing** at a uniform 25% status distribution (Postgres correctly preferred a backward scan of the existing `created_at` index under `LIMIT 25`), and **5.2x** once the data was realistically skewed to ~1% `open`. Uniform test data would have produced the wrong answer in either direction. **Measure selectivity before adding a composite index.**
- **Unindexed default ordering on a growing table is the cheapest large win available.** `Customer.Meta.ordering = ("name",)` with no index: 14.5 ms `Sort` → 0.1 ms `Index Scan` — **233x** — at only 50k rows.
- **Every `?search=` in the API is a sequential scan.** DRF's `SearchFilter` compiles to `ILIKE '%term%'`, which no btree can serve; the `varchar_pattern_ops` indexes Django already created help only anchored `LIKE 'term%'`. A `pg_trgm` GIN index gave **37x** (41.2 ms → 1.1 ms).
- **`TimeStampedModel.created_at` already carries `db_index=True`** (`apps/core/models.py:10`), which is why every `-created_at` default ordering is already covered. Never add a redundant `created_at` index.
- **Caching needs no new dependency** — Django 5.2.17 ships `RedisCache` and `redis` 5.3.1 is already installed for Celery. A clean contrast with Story 88, which had to add Sentry and said so.
- **Report scoping is by query param, not caller identity** (`apps/core/scoping.py` docstring), which is the single fact that makes a path+query report cache key safe rather than a cross-department data leak.
- **This project had zero explicit `Meta.indexes` entries and zero cache configuration** before Story 91.

### Contracts Story 92 sets for the rest of this epic

- **Throttle identity depends on `DJANGO_NUM_PROXIES` being correct.** With it unset, DRF keys throttles on the entire client-supplied `X-Forwarded-For` (`rest_framework/throttling.py:40`), making every IP-keyed limit bypassable by rotating one header. Any future story that adds a throttle inherits this dependency.
- **A view's own `throttle_classes` replaces `DEFAULT_THROTTLE_CLASSES`; it does not stack.** A sensitive endpoint must declare its tight scope itself and thereby loses the baseline — so a scope typo silently removes all throttling rather than falling back.
- **`/api/health/` and the `/api/` 404 catch-all are permanently throttle-exempt.** Throttling a liveness probe turns a traffic burst into a reported outage. A future global throttle mixin must preserve these exemptions.
- **Throttling fails open, never closed.** A Redis outage must not 500 a throttled endpoint — a security control that converts a cache blip into a total outage gets switched off, and then there is no control.
- **Uploads are allowlisted by extension, never denylisted**, and `download`'s `as_attachment=True` is what makes that defense-in-depth rather than an XSS fix. **Do not remove `as_attachment=True`.**
- **`permission_map` coverage is enforced by a system check** (`core.W001`, `apps/core/checks.py`), so the zero-gap result below cannot silently regress. Its `EXEMPT` set requires a written reason per entry.

### Verified findings that shaped Story 92 — three of the intake's four axes came back clean

Audited by enumerating all 121 `/api/` routes from `get_resolver()`, instantiating all 45 serializers, and running `manage.py check --deploy` against production settings.

- **Authz coverage was already complete — zero real gaps across 121 routes.** The first pass reported 19 apparent `permission_map` gaps; **every one is a false positive**, because the router binds a route for a verb the view already drops via `http_method_names`, which 405s at Django's dispatch *before* `HasPermission` runs (`AuditLogViewSet` does this deliberately for immutability). Story 92 therefore adds a regression guard, not a fix.
- **Secret handling was already clean.** 16 credential-named serializer fields; the only 5 readable on output are `has_*` **booleans** ("is this configured?"), never values. Every stored credential is `write_only`; `ApiKey` stores `sha256` only.
- **`manage.py check --deploy` reports zero security warnings** on `config.settings.prod`. All 36 reported issues are `drf_spectacular.W002` schema noise. Story 92 adds **no** `SECURE_*` setting because there is nothing left to add.
- **Rate limiting was the one real gap: exactly ONE throttled endpoint in the entire API.** Login (`/api/auth/token/`) was completely unthrottled, as were the four other credential endpoints, both anonymous `Customer`+`Ticket` creators, all three inbound webhooks, and every AI endpoint that spends real money on a provider call.
- **And the existing throttle was bypassable.** `NUM_PROXIES` unset means the throttle key is the client-controlled `X-Forwarded-For` — so `SEC-7`'s password-reset limit could be defeated by rotating a header, on top of being per-worker pre-`PROD-2`.
- **The frontend already handles 429 end to end** — `throttled` is in `API_ERROR_CODES` and translated in both languages, and DRF's `Throttled.default_code` flows through `envelope_exception_handler` unchanged. Story 92 changes **no** frontend file.
- **Input validation was solid**: Django's own body-size defaults are in effect, the anonymous endpoints validate lengths and email explicitly, the chatbot caps input at 2000 chars, and path traversal on upload is already prevented by Django's `validate_file_name`. The one real gap was a missing file-**type** allowlist (size was already capped at 10 MB).

**Note on testing:** per standing project policy (`CONVENTIONS.md` § 16) this project authors no automated tests. None of these stories adds any. Story 88's checks were the backend and frontend gates plus a 19-step manual walkthrough; Story 91's are the same gates plus a reproducible seed-and-`EXPLAIN` harness, because a performance claim cannot be verified any other way; Story 92's are the same gates plus loop-until-429 probes and two re-runnable audit scripts, because a security claim cannot be verified by reading either. All three must keep the 54 existing backend tests green — Story 91's most load-bearing are `apps/core/tests/test_pagination.py` (the `meta.pagination` shape must not move) and `config/tests/test_settings.py::MigrationStateTests`; Story 92's is `apps/core/tests/test_health.py`, the closest thing the repo has to a guard on the health-check throttle exemption. **Story 92 also ships the project's first durable authz guard as a Django system check**, which is how "enforce authz coverage" becomes permanent without a test file.
