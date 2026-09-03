# Story 91 — Performance & Caching (PROD-2) (Story: SUPPORTOS-117)

## Prerequisites

- **Story 88 (`PROD-1`, `SUPPORTOS-116`) is complete and committed** (`3da9f28`) — [88-story-observability-logging-SUPPORTOS-116.md](88-story-observability-logging-SUPPORTOS-116.md). Two things it shipped are load-bearing here: `AccessLogMiddleware`'s per-request **`duration_ms`** field is the production evidence source this story's follow-up tuning must be driven by, and `X-Request-ID` is how a slow request in the access log is tied to its Sentry event. **This story adds no new observability** — it consumes `PROD-1`'s.
- **This story's own `00-overview.md` said to plan `PROD-2` only after `PROD-1` had produced evidence.** That ordering is honoured differently than written: rather than wait for production traffic, the evidence below was produced **by direct measurement against a seeded 250,000-row throwaway database**, using the exact query shapes the viewsets issue. Every number in `## Measured baseline` is reproducible with the SQL in `## Verification Steps`. Nothing in this plan is proposed on intuition.
- **Verified live — there is no cache backend of any kind.** `grep -rn "CACHES\|from django.core.cache" backend/config backend/apps` returns **zero** hits, so Django is silently running its default `LocMemCache`: per-process, per-worker, never shared, and wiped on every reload. Any caching this story adds therefore starts by choosing a backend.
- **Verified live: caching needs no new dependency, unlike `PROD-1`'s Sentry decision.** Django is **5.2.17**, whose built-in `django.core.cache.backends.redis.RedisCache` was confirmed importable, and `redis` **5.3.1** is already installed (`requirements.txt`, there for Celery since `SLA-0`). `CONVENTIONS.md` § 17's "check whether an existing one already does the job" is satisfied outright — **do not add `django-redis`**.
- **Verified live: `pg_trgm` is available in this PostgreSQL install.** `CREATE EXTENSION IF NOT EXISTS pg_trgm` succeeded in the test database, and the GIN index built on it produced the 37x measured below. It is a stock contrib module, not a third-party package.
- **Verified live, and it removes the largest slice of this story's expected scope: there is no N+1 anywhere in the API.** 28 endpoints — every list, the ticket detail/`history`/`context`/`sla` actions, `customers/<id>/timeline`, and all eight report endpoints — were measured with `CaptureQueriesContext` at 1 row and at 25 rows. **Every single one has a query count that is completely flat.** The `select_related`/`prefetch_related` discipline across the 23 modules that use it, and the `Subquery` batching in `apps/reports/sla.py` and `apps/reports/agents.py`, are already doing their job. **This story adds no `select_related`, no `prefetch_related`, and rewrites no serializer.** Chasing N+1 here would be exactly the "premature tuning" the intake forbids.
- **Verified live: nothing overrides pagination.** `grep -rn "pagination_class" backend/apps` returns zero hits, so every list endpoint already runs through `DefaultPageNumberPagination`. The "pagination review" the intake asks for therefore has one finding, and it is not a missing page limit — it is the `COUNT(*)` that pagination itself issues.
- **Verified live: the `count` field cannot be removed from the envelope.** `frontend/src/shared/ui/data-table/DataTablePagination.tsx:31` renders the row total and `:59` renders `num_pages`; `frontend/src/app/HomePage.tsx:137,144` reads `pagination.count` directly for two KPI tiles. Switching to cursor pagination would break all four call sites and the `meta.pagination` contract (`README.md` § API conventions). The count must be made **cheap**, not removed.
- **Verified live, and it is the security constraint that governs report caching:** `apps/core/scoping.py`'s module docstring draws the line explicitly — `apply_scope_filters` (used by the reports, `apps/reports/tickets.py:17`) scopes by **what the caller asked for in the query string**, while `CustomerScopedModelViewSet` scopes by **who is calling**. Report endpoints are staff-only (`BaseReportView.permission_classes = [IsAuthenticated, HasPermission]`, `apps/reports/views.py:48`) and take their department/branch narrowing from `?department=`/`?branch=`. **The full query string therefore determines the result set, so a path+query cache key is sufficient and leaks nothing across departments or branches.** The identity-scoped portal tree (`apps/portal/`) is **not** cached by this story, for exactly this reason.

---

## Measured baseline

All figures below were produced against a **throwaway test database** (`create_test_db`) seeded with **250,000 customers and 250,000 tickets**, on local PostgreSQL, warm cache, `ANALYZE`d. The ticket status distribution is deliberately skewed — `closed` 97%, `open`/`pending`/`resolved` ~1% each — because a real aged support queue is skewed, and uniform test data would have produced a misleading answer for the index question below.

### End-to-end, through the real API (`APIClient`, warmed, second call timed)

| Endpoint | Queries | ms | Verdict |
|---|---:|---:|---|
| `/api/reports/sla/trend/?bucket=day` | 3 | **468.6** | Worst measured. Cache. |
| `/api/reports/dashboard/kpis/` | 7 | **406.3** | Second worst — **and it is the home page**. Cache. |
| `/api/reports/sla/breach-rate/?bucket=day` | 3 | **365.7** | Cache. |
| `/api/customers/?search=…` | 1 | **213.7** | `ILIKE '%…%'`. Trigram index. |
| `/api/customers/?page_size=25` | 2 | **110.0** | Unindexed `ORDER BY name` + `COUNT`. Index + count cache. |
| `/api/tickets/?page_size=25` | 2 | **43.5** | Dominated by `COUNT`. Count cache. |
| `/api/reports/tickets/volume/?bucket=day` | 1 | 13.3 | Acceptable. Cached anyway (same layer, free). |
| `/api/reports/tickets/breakdown/?dimension=status` | 1 | 9.6 | Acceptable. |
| `/api/reports/agents/performance/?metric=handled` | 1 | 2.5 | Already fast — `Subquery` batching works. |
| `/api/reports/csat/trend/?bucket=day` | 1 | 1.4 | Already fast. |

### `EXPLAIN (ANALYZE)` on the individual query shapes

| Shape | Before | After | Change |
|---|---:|---:|---|
| `customers ORDER BY name LIMIT 25` @50k | 14.5 ms (`Sort`) | 0.1 ms (`Index Scan`) | **233x** |
| `customers WHERE name ILIKE '%…%'` @50k | 41.2 ms (`Sort`) | 1.1 ms (GIN trgm) | **37x** |
| same, @250k | — | 3.0 ms | stays sub-5ms |
| `tickets WHERE status='open'` (**1%** of rows) | 0.6 ms | 0.1 ms | **5.2x** |
| same, @250k with composite | — | 0.1 ms | flat with row count |
| `tickets WHERE status='open'` (**25%** of rows) | 7.5 ms | 5.7 ms | **no change — within noise** |
| `SELECT COUNT(*) FROM tickets_ticket` @50k | 4.3 ms (`Seq Scan`) | — | no index helps |
| `SELECT COUNT(*) FROM tickets_ticket` @250k | **96.1 ms** (`Parallel Seq Scan`) | — | **grows linearly, forever** |

### What the numbers decided

1. **`COUNT(*)` is the single worst scaling property in this API.** 4.3 ms at 50k, **96.1 ms at 250k** — roughly linear, on **every paginated list request**, and no index can fix it because it reads every row by definition. At 1M rows it is ~400 ms added to every list page. `HomePage`'s two KPI tiles request `page_size=1` (`HomePage.tsx:107,110`), so for those two requests the `COUNT` **is the entire cost**. This is task 2.
2. **The `(status, -created_at)` composite index is worth adding, but not for the reason one would assume.** At uniform 25% selectivity it bought **nothing** — Postgres correctly preferred a backward scan of the existing `created_at` index, because `LIMIT 25` makes scan-and-filter cheap. It only paid off (5.2x) once the data was realistically skewed and `?status=open` matched ~1% of rows. **The index is justified by queue skew, not by the presence of a filter**, and this distinction is the difference between evidence and folklore. Recorded in `CONVENTIONS.md` § 35 so a later story does not add composite indexes reflexively.
3. **Every `?search=` in this API is a sequential scan today.** DRF's `SearchFilter` compiles to `ILIKE '%term%'`, which **no btree index can serve** — the `varchar_pattern_ops` indexes Django already created help only anchored `LIKE 'term%'`. 15 viewsets declare `search_fields`; the two on unbounded, user-facing tables (`apps/tickets/views.py:91`, `apps/customers/views.py:73`) get trigram indexes. This is task 4.
4. **Unindexed default ordering is a real cost only on tables that grow.** `Customer.Meta.ordering = ("name",)` (`apps/customers/models.py:80`) costs a 14.5 ms sort at 50k that a plain btree erases entirely. The same class of gap exists on `Role.name`, `QuickReply.title`, `FAQ.order`, `EscalationRule.kind`, and `SLAPolicy.category__name` — **and this story deliberately leaves all of those alone**, because they are configuration tables holding tens of rows, where an index is pure maintenance cost. That is the "no premature tuning" constraint applied honestly rather than recited.

---

## Story Goal

Make the API stay responsive as the ticket and customer tables grow, changing only what measurement proved was slow:

1. **A real, shared cache backend.** Redis via Django's built-in `RedisCache` — a separate Redis database from Celery's, configured by one new env var, degrading to no-cache (never to a 500) when Redis is unreachable.
2. **`COUNT(*)` stops being paid on every list request.** A short-TTL cached count behind `DefaultPageNumberPagination`, applied only above a row threshold where the cache is actually worth a round-trip.
3. **Six btree indexes and two trigram indexes**, each traceable to a measured number in the table above.
4. **The three expensive report endpoints stop recomputing on every load** — including `/api/reports/dashboard/kpis/`, which the home page hits on every visit at 406 ms.
5. **The reasoning is written down** (`CONVENTIONS.md` § 35), so the next performance story starts from this story's evidence instead of re-deriving it — most importantly the two *negative* results: there is no N+1 to chase, and a filter does not automatically justify a composite index.

### What this story does not do

- **No `select_related`/`prefetch_related` changes, and no serializer rewrites.** Measured: zero N+1 across 28 endpoints. There is nothing to fix.
- **No cursor pagination, and no change to the `meta.pagination` contract.** `count` and `num_pages` have four live frontend call sites.
- **No caching of any identity-scoped endpoint.** The `apps/portal/` tree scopes by *who is calling* (`apps/core/scoping.py` docstring); caching it on a path+query key would serve one customer's data to another. Explicitly out of scope, and § 35 says why.
- **No indexes on configuration tables** (`Role`, `QuickReply`, `FAQ`, `SLAPolicy`, `AssignmentRule`, `EscalationRule`, `WebhookSubscription`, `Category`). Tens of rows; an index there is cost without benefit.
- **No `select_for_update`, connection pooling, `CONN_MAX_AGE` change, or query-plan hinting.** `POSTGRES_CONN_MAX_AGE` is already an env knob (`README.md` env table) and nothing measured implicated connection setup.
- **No frontend changes at all.** `staleTime: 30_000` (`queryClient.ts:51`) and `HomePage`'s `page_size=1` tiles are already correct; the 30s TTL chosen in task 2 is chosen to *match* that existing 30s staleness window.
- **No new management command or benchmark harness.** The measurement scripts were throwaway; `## Verification Steps` carries the SQL to recreate them, and `PROD-1`'s `duration_ms` access log is the durable production evidence source.

---

## Context — Read These Files First

1. `.squad/stories/production-readiness/SUPPORTOS-117/intake.md` — one description line, no acceptance criteria, empty `attachments/`. `SupportOs backlog.MD:959-961` (`STORY (PROD-2)`) is the same text, including the two constraints that shape this whole plan: *"optimize by evidence, no premature tuning."*
2. [88-story-observability-logging-SUPPORTOS-116.md](88-story-observability-logging-SUPPORTOS-116.md) `## Prerequisites` and `## Edge Cases & Failure Modes` — the precedent for how this epic states an accepted cost and a negative result in the plan rather than burying it. Its `AccessLogMiddleware` (`backend/apps/core/middleware.py:59-108`) emits the `duration_ms` field task 6 points future tuning at.
3. `backend/apps/core/pagination.py` (all 82 lines) — `DefaultPageNumberPagination`. Note it sets **no** `page_size` (line 15-17 comment: it comes from `REST_FRAMEWORK["PAGE_SIZE"]`, one source of truth) and that `get_paginated_response` (lines 23-38) reads `self.page.paginator.count` — **that attribute access is the `COUNT(*)` query**, and it is the exact seam task 2 replaces. `get_paginated_response_schema` (lines 40-82) documents the same block for drf-spectacular and needs no change.
4. `backend/config/settings/base.py` **lines 477-494** (`# --- Background jobs (SLA-0) ---`) — `CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")` at line 482. **Celery owns database 0**; task 1's cache must not share it, or a `FLUSHDB` on either side wipes the other.
5. `backend/config/settings/base.py` **lines 247-306** (`# --- DRF ---`) — where `DRF_PAGE_SIZE` (line 252) and `DEFAULT_PAGINATION_CLASS` are set. Task 2's two new constants sit beside them, not in the cache block, because they tune pagination rather than the cache.
6. `backend/apps/reports/views.py` **lines 47-66** (`BaseReportView`) — `permission_classes` at line 48, `csv_columns`/`csv_filename` at 52-55, the abstract `get_report` at 56-57, and `get()` at 59-66. `get()` is the single funnel every one of the eight report endpoints passes through, including the `?export=csv` branch (line 63) — task 5 wraps exactly this method, which is why one edit covers all eight.
7. `backend/apps/reports/sla.py` **lines 1-20** (module docstring) and `backend/apps/reports/agents.py` **lines 1-14** — read both to understand *why* the reports are already 1-3 queries: Story 57/58 replaced what would have been `2N+1` with `Subquery` annotations. **The remaining 400 ms is aggregation over a date range, not an N+1**, which is why task 5 caches rather than rewrites.
8. `backend/apps/core/scoping.py` **lines 1-27** (module docstring) and `apply_scope_filters` at lines 53-70 — the query-param-vs-caller distinction that makes report caching safe. Read this before writing task 5's cache key.
9. `backend/apps/tickets/views.py` **lines 114-157** (`TicketViewSet.get_queryset`) — the `category`/`priority`/`status`/`assigned_to_me` filters, all optional, all validated. `search_fields` at line 91 (`subject`, `description`, `customer__name`) is what task 4's trigram indexes serve. `Ticket.Meta.ordering = ("-created_at",)` is `backend/apps/tickets/models.py:140`.
10. `backend/apps/customers/views.py` **line 45** (`queryset = Customer.objects.select_related("branch").all()`) and **line 73** (`search_fields = ("name", "email", "company")`); `backend/apps/customers/models.py` **line 80** (`ordering = ("name",)`) — the single most expensive unindexed sort measured, and the 233x fix.
11. `backend/apps/core/models.py` **lines 9-15** (`TimeStampedModel`) — `created_at` carries **`db_index=True`** at line 10. This is why every `-created_at` default ordering in the project is already covered and why task 3 adds **no** `created_at` index; verify this before assuming a timestamp column needs one.
12. `backend/apps/agents/models.py` **lines 51-56** (`Task.Meta`, `ordering = ("due_at",)`) and `backend/apps/integrations/models.py` **line 239** (`ErpOrder`, `ordering = ("-placed_at", "-id")`) and **line 301** (`ErpSyncRun`, `ordering = ("-started_at",)`) — the three other growing tables with an unindexed default sort.
13. `backend/apps/notifications/views.py` **lines 42-43** (`unread_count`) — `.count()` on a `read_at__isnull=True` filter, called by the notification bell. Read it to confirm task 2 does **not** cover it (it is a bare `.count()`, not paginator-driven) and to see why `## Edge Cases` leaves it alone.
14. `frontend/src/shared/lib/api/queryClient.ts` **line 51** (`staleTime: 30_000`) — the number task 2's TTL is deliberately matched to. A backend count cached longer than the frontend's own staleness window would be visible as a stuck total; matched, it is not.
15. `frontend/src/shared/ui/data-table/DataTablePagination.tsx` **lines 31 and 59**, and `frontend/src/app/HomePage.tsx` **lines 106-121** — the four call sites that make `count`/`num_pages` non-removable, and the `page_size=1` KPI tiles whose entire cost is the `COUNT`.
16. `backend/config/settings/base.py` **lines 309-380** (the `PROD-1` `LOGGING` block) — the structural template task 1's `CACHES` block follows for placement and comment style, and the precedent for a settings block whose default is deliberately the safe/off one.
17. `CONVENTIONS.md` § 34 (lines 2310-end, `PROD-1`) — the section this story's § 35 sits beside, and the model for recording a mechanism plus the rules it establishes. § 17 (dependencies) is what task 1 satisfies by using the stdlib/built-in path.
18. `README.md` **§ Environment variables** (backend table, `DJANGO_LOG_FORMAT`/`SENTRY_*` rows added by Story 88) — task 6 adds two rows in the same place, and `backend/.env.example`'s `# --- Redis / Celery (SLA-0) ---` block is where the new variable goes.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Every optimisation traces to a measured number.** | Intake ("optimize by evidence") | `## Measured baseline`; every index in task 3/4 names its own row in that table. |
| **No optimisation without a measurement, including "obvious" ones.** | Intake ("no premature tuning") | Config tables get no indexes; no `select_related` is added; the 25%-selectivity negative result is recorded in § 35. |
| **A cache miss and a cache outage are both non-events.** | Operational safety; the same posture `TicketViewSet.perform_create` takes for a Celery queue failure | `try/except` around every cache read and write; Redis down = uncached, never a 500. |
| **A cached count may be stale; a cached page may never be wrong.** | `count` is a display number, page contents are data | Only the `COUNT` is cached. The page query itself is never cached. |
| **A cache key must fully determine the response it stores.** | `apps/core/scoping.py`'s query-param-scoping contract | Report key = path + sorted query string + language. Identity-scoped endpoints are not cached at all. |
| **Cached staleness never exceeds what the frontend already tolerates.** | `queryClient.ts:51` `staleTime: 30_000` | `COUNT_CACHE_TTL_SECONDS = 30`. |
| **Celery's Redis database is not shared with the cache.** | A cache flush must not drop queued jobs | `REDIS_CACHE_URL`, defaulting to db `1`; `REDIS_URL` (db `0`) is left untouched. |

---

## Backend Tasks

### 1 — A real cache backend

**File: `backend/config/settings/base.py`** — add a new block immediately after the `# --- Background jobs (SLA-0) ---` block (which ends at line 494), so the two Redis consumers read adjacently:

```python
# --- Cache (PROD-2) -------------------------------------------------------
# Django's default is LocMemCache: per-process, per-worker, never shared, and
# wiped on reload — useless for a count shared across gunicorn/daphne workers.
#
# Built-in RedisCache, NOT django-redis: Django 5.2 ships the backend and
# `redis` is already a dependency (SLA-0's broker), so CONVENTIONS.md § 17's
# "check whether an existing one already does the job" is satisfied with no
# new package. Contrast PROD-1, which had to add one.
#
# Database 1, deliberately NOT the 0 that CELERY_BROKER_URL uses above: a
# cache is flushable by definition, and a FLUSHDB that also dropped queued
# jobs would be a genuinely bad afternoon.
REDIS_CACHE_URL = env("REDIS_CACHE_URL", default="redis://localhost:6379/1")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
        "KEY_PREFIX": "supportos",
    }
}

# PROD-2 tuning knobs. Plain constants, not ENV vars — the same
# internal-tuning-knob reasoning `DEFAULT_THROTTLE_RATES` (SEC-7) and
# `RESET_TOKEN_MAX_AGE_SECONDS` already document for themselves.
#
# 30s matches the frontend's own `staleTime: 30_000`
# (frontend/src/shared/lib/api/queryClient.ts:51): a count cached longer than
# the window the client already treats data as fresh would be visible as a
# stuck total; matched, it is invisible.
COUNT_CACHE_TTL_SECONDS = 30
# Below this, COUNT(*) is sub-millisecond (measured: 4.3 ms at 50,000 rows,
# and it falls off linearly), so a Redis round-trip would cost more than the
# query it replaces. Caching starts where the evidence says it starts.
COUNT_CACHE_MIN_ROWS = 1_000
# Reports are date-range aggregations over data that is minutes-stale by
# nature; 5 minutes is well inside what a trend chart means.
REPORT_CACHE_TTL_SECONDS = 300
```

**`KEY_PREFIX`** is what keeps this safe if a future environment ever points `REDIS_CACHE_URL` at a shared instance.

### 2 — Stop paying `COUNT(*)` on every list request

**Create file: `backend/apps/core/cache.py`** — one small module, so the `try/except` discipline lives in exactly one place rather than being restated at each call site:

```python
"""Cache access that can never take a request down. PROD-2 (Story 91).

Every read and write goes through here. A Redis outage must degrade to
"uncached", never to a 500 — the same posture
`TicketViewSet.perform_create` already takes for a Celery queue failure
(apps/tickets/views.py). See CONVENTIONS.md § 35.
"""

import hashlib
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


def cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        # Redis unreachable, timing out, or misconfigured. Not fatal: the
        # caller recomputes. Logged at WARNING, not ERROR — the request
        # still succeeds, so this is "worth noticing", CONVENTIONS.md § 10.
        logger.warning("Cache read failed for %s", key, exc_info=True)
        return None


def cache_set(key, value, ttl):
    try:
        cache.set(key, value, ttl)
    except Exception:
        logger.warning("Cache write failed for %s", key, exc_info=True)


def cache_delete(key):
    try:
        cache.delete(key)
    except Exception:
        logger.warning("Cache delete failed for %s", key, exc_info=True)


def digest(*parts: str) -> str:
    """Stable, bounded key fragment. The raw SQL of a filtered queryset is
    unbounded and contains characters memcached-style backends reject, so it
    is never used as a key directly.
    """
    joined = "\x1f".join(parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:32]
```

**File: `backend/apps/core/pagination.py`** — add a `Paginator` subclass above `DefaultPageNumberPagination` and point the pagination class at it. `Paginator.count` is a `cached_property` in Django, which is precisely the seam:

```python
from django.core.paginator import Paginator
from django.utils.functional import cached_property

from .cache import cache_delete, cache_get, cache_set, digest


class CachedCountPaginator(Paginator):
    """A Paginator whose `count` may come from the cache.

    `COUNT(*)` is the worst-scaling query in this API — measured at 4.3 ms
    over 50,000 rows and 96.1 ms over 250,000 (a Parallel Seq Scan; no index
    can help, since counting reads every row by definition). It is issued on
    EVERY paginated response, including `HomePage`'s two `page_size=1` KPI
    tiles, where it is the entire cost of the request.

    Only the count is cached. The page of rows itself is always a live query.
    """

    cache_key = None

    @cached_property
    def count(self):
        if self.cache_key is None:
            return super().count
        cached = cache_get(self.cache_key)
        if cached is not None:
            return cached
        value = super().count
        # Only worth a round-trip above the threshold — below it the COUNT is
        # faster than the cache lookup that would replace it.
        if value >= settings.COUNT_CACHE_MIN_ROWS:
            cache_set(self.cache_key, value, settings.COUNT_CACHE_TTL_SECONDS)
        return value
```

and on `DefaultPageNumberPagination`:

```python
    django_paginator_class = CachedCountPaginator

    def paginate_queryset(self, queryset, request, view=None):
        # The key must identify this exact filtered/scoped queryset, so that
        # `?status=open` and `?status=closed` never share a count. `str(
        # queryset.query)` is the compiled SQL including every filter the
        # viewset applied; it is hashed because it is unbounded in length.
        self._count_cache_key = "count:" + digest(queryset.db, str(queryset.query))
        try:
            return super().paginate_queryset(queryset, request, view)
        except NotFound:
            # A stale cached count can make `num_pages` larger than the table
            # now is, so DRF 404s a page that would exist if the count were
            # fresh. Drop the key and retry ONCE against a live count.
            cache_delete(self._count_cache_key)
            self._retrying = True
            return super().paginate_queryset(queryset, request, view)
```

with `django_paginator_class` wired so the instance receives the key — set `paginator.cache_key` in the overridden `paginate_queryset` before `super()` runs, via DRF's `django_paginator_class(queryset, page_size)` construction. **The executor must confirm the exact hook against the installed DRF's `PageNumberPagination.paginate_queryset`** — it constructs the paginator inline, so the key is passed by overriding `django_paginator_class` with a small factory closure or by assigning `self.paginator_instance`. Whichever shape the installed version supports, **the retry-on-`NotFound` behaviour above is mandatory**, not optional.

`get_paginated_response` (lines 23-38) and `get_paginated_response_schema` (40-82) are **unchanged** — the envelope shape does not move.

### 3 — Btree indexes, one per measured row

**Four migrations, one per app.** Every index below is a `Meta.indexes` entry (`models.Index`), not `db_index=True`, because these are named, reviewable, and two of them are composite. **This project currently has zero `Meta.indexes` entries anywhere** — verified — so these are the first.

**File: `backend/apps/customers/models.py`** — `Customer.Meta` (lines 77-80):

```python
    class Meta:
        verbose_name = _("customer")
        verbose_name_plural = _("customers")
        ordering = ("name",)
        # PROD-2: `ordering` above means EVERY customer list sorts on `name`,
        # and it had no index. Measured at 50,000 rows: 14.5 ms Sort -> 0.1 ms
        # Index Scan. The largest single win in this story.
        indexes = [models.Index(fields=["name"], name="customer_name_idx")]
```

**File: `backend/apps/tickets/models.py`** — `Ticket.Meta` (lines 137-140):

```python
        # PROD-2: `?status=` / `?priority=` are TicketViewSet's two most-used
        # filters (views.py:126-145), always combined with the `-created_at`
        # default ordering. Justified by QUEUE SKEW, not by the mere presence
        # of a filter: measured at 25% selectivity these bought NOTHING
        # (Postgres rightly preferred a backward scan of the existing
        # created_at index under LIMIT 25), and at a realistic ~1% `open`
        # share they bought 5.2x. See CONVENTIONS.md § 35 before adding a
        # composite index anywhere else.
        indexes = [
            models.Index(fields=["status", "-created_at"], name="ticket_status_created_idx"),
            models.Index(fields=["priority", "-created_at"], name="ticket_priority_created_idx"),
        ]
```

**File: `backend/apps/agents/models.py`** — `Task.Meta` (lines 51-56), `ordering = ("due_at",)`:

```python
        indexes = [models.Index(fields=["due_at"], name="task_due_at_idx")]
```

**File: `backend/apps/integrations/models.py`** — `ErpOrder.Meta` (line 239, `ordering = ("-placed_at", "-id")`) and `ErpSyncRun.Meta` (line 301, `ordering = ("-started_at",)`):

```python
        indexes = [models.Index(fields=["-placed_at", "-id"], name="erporder_placed_idx")]
```
```python
        indexes = [models.Index(fields=["-started_at"], name="erpsyncrun_started_idx")]
```

Then `python manage.py makemigrations customers tickets agents integrations`. **Do not hand-write these migrations** — the autodetector produces them correctly, and `config/tests/test_settings.py::MigrationStateTests` fails the build if a model change ships without one.

**Explicitly NOT indexed, and this is a decision, not an oversight:** `accounts.Role.name`, `agents.QuickReply.title`, `knowledge_base.FAQ.order`/`question`, `sla.EscalationRule.kind`/`threshold_minutes`, `sla.SLAPolicy.category__name`, `integrations.WebhookSubscription.name`, `customers.ContactDetail.channel`. All are configuration tables holding tens of rows, or (for `ContactDetail`) always reached behind a required `?customer=` filter that narrows to a handful of rows first. An index on any of them is write cost and migration surface for an unmeasurable read gain.

### 4 — Trigram indexes for `?search=`

DRF's `SearchFilter` compiles `search_fields` to `ILIKE '%term%'`. **No btree index can serve a leading-wildcard match** — the `varchar_pattern_ops` indexes Django already created serve only anchored `LIKE 'term%'`. A GIN index over `pg_trgm` is the only fix, and it was measured at **37x** (41.2 ms → 1.1 ms at 50k; 3.0 ms at 250k).

**Create file: `backend/apps/customers/migrations/00XX_trigram_search.py`:**

```python
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """PROD-2. `?search=` is ILIKE '%term%' (DRF SearchFilter), which no btree
    index can serve — measured 213.7 ms end-to-end at 250,000 customers.
    pg_trgm is a stock PostgreSQL contrib module, not a new dependency;
    verified available in this install.
    """

    dependencies = [("customers", "00XX_previous")]

    operations = [
        TrigramExtension(),
        migrations.AddIndex(
            model_name="customer",
            index=GinIndex(
                fields=["name"], name="customer_name_trgm", opclasses=["gin_trgm_ops"]
            ),
        ),
    ]
```

Add the equivalent `GinIndex` on **`Ticket.subject`** in a `tickets` migration (its `search_fields` at `views.py:91` are `subject`, `description`, `customer__name`; `subject` is the selective one — `description` is long-form text whose trigram index would be large for little gain, and `customer__name` is served by the `Customer` index above through the join).

**`TrigramExtension()` requires database superuser rights on first run.** If the deploy role lacks `CREATE EXTENSION`, a DBA runs `CREATE EXTENSION pg_trgm;` once by hand and the operation becomes a no-op. This is called out in `## Migration / Rollback`.

**Only these two tables.** The other 13 `search_fields` declarations are on configuration or low-volume tables.

### 5 — Cache the three expensive reports

**File: `backend/apps/reports/views.py`** — wrap `BaseReportView.get` (lines 59-66). One edit covers all eight report endpoints, because every one of them funnels through it:

```python
    # PROD-2: measured at 250,000 tickets — sla/trend 468.6 ms,
    # dashboard/kpis 406.3 ms (and that one is the HOME PAGE), sla/breach-rate
    # 365.7 ms. These are date-range aggregations, NOT an N+1: Stories 57/58
    # already reduced them to 1-3 queries with Subquery batching, so there is
    # nothing left to rewrite — only to avoid recomputing.
    #
    # The key is path + sorted query string + language, and that is SUFFICIENT
    # and SAFE: report scoping is by query param (`?department=`/`?branch=`,
    # apps/reports/tickets.py), never by caller identity — see
    # apps/core/scoping.py's own docstring for that distinction. Language is
    # in the key because CSV headers and some labels are translated (§ 18).
    # `?export=csv` is part of the query string, so a CSV and a JSON response
    # can never share an entry.
    def get(self, request):
        key = "report:" + digest(
            request.path,
            urlencode(sorted(request.query_params.items())),
            get_language() or "",
        )
        cached = cache_get(key)
        if cached is not None:
            return Response(cached)

        start, end = parse_date_range(request.query_params)
        bucket = parse_bucket(request.query_params)
        rows = self.get_report(request, start=start, end=end, bucket=bucket)
        if request.query_params.get(EXPORT_PARAM) == EXPORT_CSV:
            # Not cached: a CSV response is a streaming file attachment, not a
            # JSON body, and caching it would mean caching headers too.
            return csv_response(rows, columns=self.csv_columns, filename=self.csv_filename)
        cache_set(key, rows, settings.REPORT_CACHE_TTL_SECONDS)
        return Response(rows)
```

**The cache read happens before `parse_date_range`/`parse_bucket`.** That is deliberate for speed but has a real consequence: a request with **invalid** parameters that has never been cached still 400s correctly (nothing is cached under it), while a *valid* cached key skips revalidation. Since the key is derived from the same parameters that validation reads, a key can only exist if those parameters already validated once. Stated in `## Edge Cases`.

### 6 — Env, README, CONVENTIONS

**File: `backend/.env.example`** — extend the existing `# --- Redis / Celery (SLA-0) ---` block:

```
# --- Redis / Celery (SLA-0) ---
REDIS_URL=redis://localhost:6379/0

# --- Cache (PROD-2) ---
# A DIFFERENT Redis database from REDIS_URL above: the cache is flushable by
# definition, and a flush must never drop queued Celery jobs.
REDIS_CACHE_URL=redis://localhost:6379/1
```

**File: `README.md`** — one row in the backend env table, after `REDIS_URL`:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `REDIS_CACHE_URL` | no | `redis://localhost:6379/1` | Redis connection for the Django cache (`PROD-2`). **Must be a different database number from `REDIS_URL`** — the cache is flushable, Celery's queue is not. |

Also add a short **§ Performance** note to `README.md` recording that the app degrades to uncached (not to an error) when Redis is unreachable, and that `pg_trgm` is required for `?search=` performance.

**File: `CONVENTIONS.md`** — append **§ 35** after § 34's last line. Renumber nothing. It records:

- **The measured baseline table**, so the next story starts from numbers rather than re-deriving them.
- **The two negative results, stated as prominently as the positive ones**: there is no N+1 in this API (28 endpoints measured flat), and a composite index on a filtered column is **not** automatically justified — at 25% selectivity it bought nothing, and only realistic queue skew made it pay. **Measure selectivity before adding a composite index.**
- **`COUNT(*)` is the API's worst scaling property**, why no index fixes it, and that `count`/`num_pages` cannot be dropped because four frontend call sites read them.
- **Every cache read and write goes through `apps/core/cache.py`**, and a Redis outage degrades to uncached, never to a 500.
- **A cache key must fully determine its response.** Report caching is safe *only* because report scoping is by query param; the identity-scoped `apps/portal/` tree is never cached on a path+query key. This is the rule most likely to be violated by a later story.
- **Configuration tables are deliberately unindexed**, with the list, so a future reader does not "fix" them.
- **`TimeStampedModel.created_at` already carries `db_index=True`** — never add a redundant `created_at` index.

---

## Edge Cases & Failure Modes

- **Redis is down or unreachable.** Every list request would 500 if the cache raised. `apps/core/cache.py`'s `cache_get`/`cache_set`/`cache_delete` swallow every exception and log at WARNING, so the count falls back to a live `COUNT(*)` and reports recompute. **This is the single most important behaviour in the story** — a cache is an optimisation, and an optimisation that can take the site down is a downgrade. Enforced in `apps/core/cache.py`; verification step 9 pulls the plug and checks.
- **A stale cached count makes `num_pages` too large.** The user clicks page 40, rows were deleted, DRF raises `NotFound` for an out-of-range page. `paginate_queryset` deletes the key and retries once against a live count. Without that retry a shrinking table produces intermittent 404s on the last page for up to 30 s. Enforced in `apps/core/pagination.py`.
- **A stale cached count makes `num_pages` too small.** Rows were added; the last page is briefly unreachable and the displayed total is briefly low. **Accepted, not fixed** — it self-corrects within `COUNT_CACHE_TTL_SECONDS` (30 s), which is exactly the window the frontend's own `staleTime: 30_000` already treats as fresh.
- **Two different filters colliding on one cache key.** `?status=open` and `?status=closed` must never share a count. The key is `sha256(queryset.db + str(queryset.query))`, and `str(queryset.query)` is the fully compiled SQL including every filter, scope, and search term the viewset applied. Truncated to 32 hex chars — 128 bits, far beyond collision risk at this key volume.
- **`str(queryset.query)` can raise.** On a queryset with certain unresolvable parameters, compiling to string can raise rather than return. If it does, the count must simply not be cached, never 500 — wrap the key construction itself, not only the cache call.
- **The identity-scoped portal tree must never be cached on a path+query key.** `apps/portal/` uses `CustomerScopedModelViewSet`, which filters by `request.user`'s linked customer. Two customers hitting the identical URL must get different rows. **Task 2 is safe there anyway** — the count key includes `str(queryset.query)`, which contains the already-applied customer filter — but **task 5's report key is not** identity-derived, which is exactly why no portal endpoint is cached. A later story adding a cache to any identity-scoped view must put the user id in the key.
- **`?export=csv` must not be served from, or written to, the JSON report cache.** `EXPORT_PARAM` is part of the query string and therefore part of the key, so the two can never collide; additionally the CSV branch returns before `cache_set`, because a CSV is a file response with its own headers.
- **Report cache read precedes parameter validation.** A key can only exist if those exact parameters already passed validation on a previous request, so a cached hit cannot mask a 400. An uncached invalid request still 400s normally.
- **`TrigramExtension()` needs `CREATE EXTENSION` privilege.** On a managed database whose app role is not superuser, the migration fails. A DBA runs `CREATE EXTENSION pg_trgm;` once; `TrigramExtension` is then a no-op and the migration succeeds. See `## Migration / Rollback`.
- **Building indexes locks the table.** `AddIndex` takes an `ACCESS EXCLUSIVE`-blocking `SHARE` lock for the duration of the build — on a large `tickets_ticket` this blocks writes. For a production table of meaningful size, run these with `CREATE INDEX CONCURRENTLY` outside the migration (or via `AddIndexConcurrently`) during a low-traffic window. Called out in `## Migration / Rollback`; **not** switched to `AddIndexConcurrently` in the plan because that operation cannot run inside a transaction and requires `atomic = False` on the migration, which is a deployment-shape decision this story leaves to whoever runs it.
- **Two trigram indexes add write cost.** GIN indexes are more expensive to update than btree. `Customer.name` and `Ticket.subject` are written once per row creation and rarely updated, so the trade is strongly favourable — but a future story adding a trigram index to a high-churn column should measure the write side too.
- **`notifications.unread_count` (`views.py:42-43`) is a bare `.count()`, not paginator-driven, so task 2 does not cover it.** Deliberately left alone: it is already filtered to one recipient by an indexed FK (`recipient_id`) plus `read_at__isnull=True`, and the bell fetches it on open with a 30 s `staleTime` and a WebSocket push (`NotificationBell.tsx:52`) rather than polling. Nothing measured implicates it.
- **`COUNT_CACHE_MIN_ROWS` means small tenants never populate the cache.** Intended: below 1,000 rows the `COUNT` is faster than the Redis round-trip that would replace it. It also means the count cache shows no effect at all on a fresh install — verification step 6 seeds past the threshold rather than concluding it is broken.
- **`KEY_PREFIX` collisions across environments.** Two deployments pointed at one Redis database would share cache entries. `KEY_PREFIX = "supportos"` separates SupportOS from other apps but not staging from production — those must use different `REDIS_CACHE_URL` database numbers or instances.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16 — *"no new test file is added anywhere in the repo"*). No test file is added, changed, or removed.

The **54 existing backend tests must still pass**, and two are directly load-bearing:

1. `backend/apps/core/tests/test_pagination.py` — asserts the pagination block lands under `meta` with the exact `PAGINATION_KEYS` set (`:40`) and checks its values (`:49-60`). Task 2 changes *how `count` is obtained*, never the response shape; if this fails, the envelope moved and the change is wrong.
2. `backend/config/tests/test_settings.py::MigrationStateTests` — fails if any model change in task 3 ships without its migration.

Verification is otherwise the gates plus the reproducible measurement in `## Verification Steps`, which is the only way to check a performance claim.

---

## Migration / Rollback

**Five migrations**: four `AddIndex`-only (customers, tickets, agents, integrations) and one `TrigramExtension` + `GinIndex`. **No schema change, no column added or dropped, no data migrated.** Every one is reversible with `migrate <app> <previous>`, which issues `DROP INDEX`.

**Deployment order and locking.** On a table of production size, `AddIndex` blocks writes for the duration of the build. Either run the migrations in a low-traffic window, or create the indexes out-of-band first:

```sql
CREATE INDEX CONCURRENTLY customer_name_idx ON customers_customer (name);
-- …then `migrate --fake` the corresponding migration.
```

**`pg_trgm` privilege.** If the app's database role cannot `CREATE EXTENSION`, migration 4 fails with `permission denied to create extension "pg_trgm"`. Fix: a superuser runs `CREATE EXTENSION pg_trgm;` once against the database; re-running the migration then succeeds because `TrigramExtension` is `IF NOT EXISTS`.

**Rollback, in order — each step is independent:**

1. **Cache off, no code change:** point `REDIS_CACHE_URL` at an unreachable host. `apps/core/cache.py` swallows the failure and everything recomputes live. This is also the accidental-outage path, which is why it is safe.
2. **Report cache only:** set `REPORT_CACHE_TTL_SECONDS = 0`.
3. **Count cache only:** set `COUNT_CACHE_MIN_ROWS` above any real table size; every count then goes live.
4. **Indexes:** `migrate <app> <previous>` per app. Dropping an index is instant and never loses data.

**Half-applied states:**

- **`CACHES` configured but Redis not running** → every request still succeeds, with a WARNING per cache attempt. Noisy, not broken. Watch for `Cache read failed` in the `PROD-1` access log.
- **Indexes applied, cache not** → pure win, no downside. This is a safe intermediate state to deploy on its own, and the recommended first step.
- **Cache applied, indexes not** → also safe; the count cache is independent of every index.
- **`pg_trgm` extension created but the GIN index missing** → `?search=` behaves exactly as it does today. No error.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `ruff format --check .`, `ruff check .`, `python manage.py check`, `python manage.py test`. All pass; **54 tests, 0 failures**.
2. **Migrations are complete and reversible:** `python manage.py makemigrations --check --dry-run` → `No changes detected`. Then `python manage.py migrate`, and confirm the indexes exist:
   ```bash
   python manage.py shell -c "
   from django.db import connection
   with connection.cursor() as c:
       c.execute(\"SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_idx' OR indexname LIKE '%_trgm'\")
       print([r[0] for r in c.fetchall()])"
   ```
   Expect `customer_name_idx`, `ticket_status_created_idx`, `ticket_priority_created_idx`, `task_due_at_idx`, `erporder_placed_idx`, `erpsyncrun_started_idx`, `customer_name_trgm`, `ticket_subject_trgm`.
3. **Cache backend is real and shared:** `python manage.py shell -c "from django.core.cache import cache; cache.set('k',1,10); print(cache.get('k'))"` prints `1`, and `redis-cli -n 1 KEYS 'supportos*'` shows the key — proving it landed in **database 1**, not Celery's 0. Then `redis-cli -n 0 DBSIZE` before and after a `cache.clear()` to confirm the Celery database is untouched.
4. **Reproduce the baseline.** Create a throwaway database and seed it — this is the harness every number in `## Measured baseline` came from:
   ```python
   from django.db import connection
   from django.test.utils import setup_test_environment
   setup_test_environment(); old = connection.creation.create_test_db(verbosity=0, autoclobber=True)
   with connection.cursor() as c:
       c.execute("""
   INSERT INTO customers_customer (name, email, phone, company, created_at, updated_at)
   SELECT 'Cust '||g, 'c'||g||'@example.com', '', '', now()-(g||' minutes')::interval, now()
   FROM generate_series(1,250000) g;
   INSERT INTO tickets_ticket (subject,description,status,priority,escalated,escalated_at,
                               customer_id,created_at,updated_at)
   SELECT 'Ticket '||g,'body',
     CASE WHEN g%100=0 THEN 'open' WHEN g%100=1 THEN 'pending'
          WHEN g%100=2 THEN 'resolved' ELSE 'closed' END,
     (ARRAY['low','medium','high','urgent'])[1+(g%4)], false, NULL,
     (SELECT MIN(id) FROM customers_customer)+(g%250000),
     now()-(g||' minutes')::interval, now() FROM generate_series(1,250000) g;""")
       c.execute("ANALYZE customers_customer; ANALYZE tickets_ticket;")
   ```
   **The 97/1/1/1 status skew is not decoration** — it is what makes the composite-index result meaningful. Uniform data produces the misleading "no benefit" answer documented in `## Measured baseline`.
5. **Customer list sort — expect ~233x.** `EXPLAIN (ANALYZE) SELECT * FROM customers_customer ORDER BY name LIMIT 25;` must show `Index Scan using customer_name_idx`, **not** `Sort`. Baseline was 14.5 ms at 50k; expect sub-millisecond.
6. **Count cache — expect the second call to skip the `COUNT`.** With the seeded database (250k rows, well over `COUNT_CACHE_MIN_ROWS`), call `/api/tickets/?page_size=25` twice under `CaptureQueriesContext`. First call: 2 queries. **Second call within 30 s: 1 query** — the `COUNT` is gone. After 30 s it returns to 2. Then confirm `redis-cli -n 1 KEYS 'supportos:*count*'` is non-empty.
7. **Filters do not share a count.** Call `/api/tickets/?status=open` and `/api/tickets/?status=closed` and confirm `meta.pagination.count` differs and matches `SELECT COUNT(*) … WHERE status=…` for each. A shared key would show identical totals — the single worst way this task could be wrong.
8. **Report cache — expect ~406 ms → single-digit ms.** Time `/api/reports/dashboard/kpis/` twice. Second call should be dramatically faster and issue **zero** database queries. Then confirm `?department=1` and `?department=2` return **different** payloads (proving the query string is in the key) and that `?export=csv` still streams a CSV rather than JSON.
9. **Redis outage degrades, never breaks.** Stop Redis (`redis-cli SHUTDOWN NOSAVE`, or point `REDIS_CACHE_URL` at `redis://localhost:6399/1`). Then load `/api/tickets/`, `/api/customers/`, and `/api/reports/dashboard/kpis/`. **All three must return 200.** The `PROD-1` access log should show `Cache read failed` at WARNING with the request id attached — and **no** 500, and no `ERROR` from `apps.core.exceptions`. Restart Redis and confirm caching resumes. **This step is the one that must not be skipped.**
10. **Trigram search — expect ~37x.** `EXPLAIN (ANALYZE) SELECT * FROM customers_customer WHERE name ILIKE '%Cust 424242%' ORDER BY name LIMIT 25;` must show a `Bitmap Index Scan on customer_name_trgm`. Baseline 41.2 ms at 50k / 213.7 ms end-to-end at 250k; expect low single-digit ms.
11. **Composite index is actually used for a selective status.** `EXPLAIN (ANALYZE) SELECT * FROM tickets_ticket WHERE status='open' ORDER BY created_at DESC LIMIT 25;` must show `Index Scan using ticket_status_created_idx`. If it still shows the `created_at` backward scan, the seeded data was not skewed — re-read step 4.
12. **No N+1 regression.** Re-run the query-count check on `/api/tickets/`, `/api/customers/`, `/api/tickets/<id>/history/`, and `/api/customers/<id>/timeline/` at 1 row and 25 rows. Counts must stay **flat** — this story must not have introduced what it verified was absent.
13. **Regression walkthrough:** from `frontend/` — `npm run dev`. Page through the ticket list past page 1, filter by status and priority, search customers, open a ticket, load `/reports` and the home dashboard, switch to العربية and reload a report (confirming the language is in the cache key and Arabic labels are not served from the English entry). Everything behaves as before, faster.
14. **Frontend gates unchanged:** `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0. **This story changes no frontend file**, so these are pure regression checks.

---

## Done Criteria

- [ ] `CACHES` is configured with Django's built-in `RedisCache` on a **different Redis database from `CELERY_BROKER_URL`**, with `KEY_PREFIX = "supportos"`, and **no new package** appears in `requirements.txt`.
- [ ] `backend/apps/core/cache.py` exists, and **every** cache read, write, and delete in the codebase goes through it — `grep -rn "from django.core.cache" backend/apps` returns only `apps/core/cache.py`.
- [ ] With Redis stopped, `/api/tickets/`, `/api/customers/` and `/api/reports/dashboard/kpis/` all return **200**, logging `Cache read failed` at WARNING and no 500.
- [ ] A second identical list request within 30 s issues **one fewer query** than the first (the `COUNT` is served from cache), and `?status=open` vs `?status=closed` return different, correct totals.
- [ ] An out-of-range page caused by a stale count deletes the key and retries once, rather than 404ing.
- [ ] `meta.pagination` still carries `count`, `page`, `page_size`, `num_pages`, `next`, `previous` — `apps/core/tests/test_pagination.py` passes untouched, and `DataTablePagination` still renders the row total and page count.
- [ ] Eight indexes exist and are **used by the planner**, each confirmed by an `EXPLAIN (ANALYZE)` in `## Verification Steps`: `customer_name_idx`, `ticket_status_created_idx`, `ticket_priority_created_idx`, `task_due_at_idx`, `erporder_placed_idx`, `erpsyncrun_started_idx`, `customer_name_trgm`, `ticket_subject_trgm`.
- [ ] **No index was added to a configuration table** (`Role`, `QuickReply`, `FAQ`, `SLAPolicy`, `AssignmentRule`, `EscalationRule`, `WebhookSubscription`, `Category`, `ContactDetail`), and **no redundant `created_at` index** was added anywhere.
- [ ] `/api/reports/dashboard/kpis/` served from cache issues **zero** database queries; `?department=1` and `?department=2` return different payloads; `?export=csv` still returns a CSV and is never cached.
- [ ] **No identity-scoped endpoint is cached.** `apps/portal/` is untouched.
- [ ] **No `select_related`, `prefetch_related`, or serializer was changed** — the measured absence of N+1 is preserved, and re-measuring 4 endpoints at N=1 vs N=25 still shows flat query counts.
- [ ] `python manage.py makemigrations --check --dry-run` reports `No changes detected`; every new migration reverses cleanly with `migrate <app> <previous>`.
- [ ] `backend/.env.example` and the `README.md` backend env table both carry `REDIS_CACHE_URL`, with the "must differ from `REDIS_URL`" warning.
- [ ] `CONVENTIONS.md` § 35 records the measured baseline, **both negative results** (no N+1 in this API; a filter does not justify a composite index without checking selectivity), the `COUNT(*)` finding, the cache-key-must-determine-the-response rule, and the deliberately-unindexed configuration tables.
- [ ] All gates pass: `ruff format --check .`, `ruff check .`, `manage.py check`, `manage.py test` (54 passing); `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 92 (`PROD-3` — Security Hardening).**
