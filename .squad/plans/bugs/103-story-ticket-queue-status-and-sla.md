# Story 103 — Ticket Queue: Status Filter and SLA Visibility

## Prerequisites

- **Stories 99-102 implemented.** Independent of all four; ships after them to keep diffs separate.
- **Story 28 (`SLA-1`) implemented:** `apps/sla/policy.py` — `resolve_policy`, `compute_sla_status`, `dimension_status`. **Read that module's `## Prerequisites` point 13**, which flagged the per-ticket N+1 and deferred batching to "a future story… worth its own design pass." This is that story.
- **Story 57 (`RPT-2`) implemented:** `apps/reports/sla.py` — **already contains the batching strategy** (`_bulk_target_resolver`, `_annotated_tickets`). See `## What discovery changed` item 1.
- **Story 98 (`ORG-4`) implemented:** [../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md](../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md) — last touched `TicketListPage`'s filter block and established the `'all'`/`'none'` sentinel convention any new filter must follow.
- **Intake:** `.squad/stories/bugs/qa-report-1/intake.md`; **attachment:** `QA-REPORT-1.md` (F-8, F-9).

---

## What discovery changed

### 1. The batching strategy already exists — do not write a third one

`apps/reports/sla.py`'s module docstring is explicit:

> *Computes response/resolution status in BULK, not by calling `apps.sla.policy.compute_sla_status` per ticket — that function does two extra queries per call… This module is that batching strategy: two `Subquery` annotations plus one bulk `SLAPolicy`/`OrganizationSettings` fetch, replacing what would otherwise be `2N+1` queries with exactly 3. Classification itself still goes through the shared `apps.sla.policy.dimension_status`, so this can never silently disagree with the single-ticket `TicketViewSet.sla` action.*

That reasoning applies verbatim to the ticket list. The batching pieces are **private** (`_bulk_target_resolver`, `_target_resolver`, `_annotated_tickets`) in a *reports* module, but they encode **SLA domain knowledge**, not reporting knowledge — `_bulk_target_resolver`'s docstring says it "mirrors `apps.sla.policy.resolve_policy`'s exact two-tier lookup."

**Move them to `apps/sla/policy.py` and have both consumers import them.** A third copy is exactly the "silently disagree" failure the existing docstrings were written to prevent.

### 2. The honest query cost is 4 → 6, constant — not 4

Measured composition of the per-request cost:

| Piece | Queries |
|---|---|
| Two `Subquery` annotations (`first_response_at`, `resolved_at`) | **0** — they compile into the existing SELECT |
| `SLAPolicy.objects.all()` (bulk policy dict) | **+1** |
| `OrganizationSettings.load()` — `get_or_create(pk=1)`, **not cached** | **+1** |

So the ticket list goes from **4 to 6 queries, and stays at 6 for any page size**. The intake's "must hold the 4-query baseline" is not achievable without denormalising SLA onto `Ticket`, which would need a migration, backfill and invalidation on every policy edit — disproportionate for a queue column.

**The real gate is that the count does not scale with rows.** Verify at `page_size=1` and `page_size=25` and require the same number, exactly as Story 101's gate was framed.

### 3. `sla_status` must reuse the existing vocabulary, not invent one

The attachment proposed `ok` / `at_risk` / `breached`. The domain already has `dimension_status`, returning **`met` / `breached` / `pending`**, and it is deliberately shared so the single-ticket action and the bulk report path cannot disagree. Introducing a second three-value vocabulary would create precisely the drift those docstrings guard against — and `at_risk` has no computable definition here, because nothing in the codebase defines an "approaching breach" threshold.

**Expose the existing values.** `sla_status` is the worse of the two dimensions:

- `"breached"` if either dimension is breached
- else `"pending"` if either is pending
- else `"met"`
- `null` when no policy resolves (SLA tracking is opt-in — `resolve_policy` returns `None`, and most tickets in a fresh install have no policy)

### 4. F-8 is genuinely small — the backend has been ready the whole time

`apps/tickets/views.py:141-145` implements and validates `?status=`; `?status=bogus` returns 400 and `?status=open` filters. `TicketListPage` declares `categoryFilter`, `priorityFilter`, `departmentFilter`, `branchFilter` and never a status one. This is a copy of the existing `priorityFilter` block with a different option list.

---

## Story Goal

Let an agent answer the two questions a support queue exists for: *what is open?* and *what is breaching?*

1. The ticket list filters by status, using the backend filter that already exists.
2. The list shows each ticket's SLA status, without N+1.
3. The batching strategy lives in `apps.sla` and is used by both consumers — no third implementation.

**Not in scope:** SLA business hours and clock pause (backlog `SLA-5`/`SLA-6`, which is why the current breach rate reads 100%), and sorting/filtering *by* `sla_status` — it is computed, not a column, so ordering on it needs its own design pass. Say so in a comment rather than leaving it looking forgotten.

---

## Context — Read These Files First

1. `backend/apps/reports/sla.py` lines 1-100 — the module docstring (the whole rationale), `_bulk_target_resolver` (41-60), `_annotated_tickets` (62-87), `_target_resolver` (89-99). These move.
2. `backend/apps/sla/policy.py` — `resolve_policy` (24-40), `_org_default_policy` (43-61), `dimension_status` (64-77), `compute_sla_status` (81-122). The new helpers join this module; **`compute_sla_status` stays** — `TicketViewSet.sla` still uses it for the detail view.
3. `backend/apps/tickets/views.py` lines 88-150 — `ordering_fields`, `search_fields`, and `get_queryset`'s hand-parsed `priority` / `status` filters. Line 309 is the `sla` detail action.
4. `backend/apps/tickets/serializers.py` — `TicketSerializer`; note it is a `BaseModelSerializer` and how the existing `*_name` read-only fields are declared.
5. `frontend/src/features/tickets/components/TicketListPage.tsx` lines 52-110 — the five existing filters. `priorityFilter` (57) is the exact shape to copy, including the `'all'` sentinel and the `useEffect` that resets to page 1 on filter change (92-96).
6. `frontend/src/features/tickets/types/` — `TICKET_STATUSES` / `TicketStatus` already exist for the status column and badge.
7. `frontend/src/features/tickets/lib/statusBadge.ts` — `ticketStatusVariant`; the SLA column needs the same treatment for its own three values.

---

## Backend Tasks

### 1 — Move the batching strategy into `apps.sla`

**File: `backend/apps/sla/policy.py`** — add, keeping every existing function:

```python
def bulk_target_resolver():
    """`(priority, category_id) -> (response_minutes, resolution_minutes) | None`
    for a whole page of tickets, in TWO queries instead of `resolve_policy`'s
    two per ticket. Mirrors `resolve_policy`'s exact two-tier lookup."""

def annotate_sla_facts(queryset):
    """Annotates `first_response_at` and `resolved_at` via `Subquery` — the
    same two facts `compute_sla_status` reads per ticket, fetched for the
    whole queryset at no extra query cost."""

def status_from_facts(created_at, priority, category_id, first_response_at, resolved_at, resolve, now):
    """The worse of the two dimensions, in `dimension_status`'s own
    vocabulary. `None` when no policy resolves."""
```

`status_from_facts` **must** call `dimension_status` for the classification — never re-implement the comparison.

**File: `backend/apps/reports/sla.py`** — delete `_bulk_target_resolver`, `_target_resolver` and the annotation body; import from `apps.sla.policy` instead. Keep the module docstring but update it to say the strategy now lives in `apps.sla` and is shared. **RPT-2's output must not change** — verify via the report endpoints, not by reading.

### 2 — `sla_status` on the ticket list

**File: `backend/apps/tickets/views.py`** — in `get_queryset`, apply `annotate_sla_facts`. Build the resolver **once per request** and pass it through `get_serializer_context`, so it is not rebuilt per row.

**File: `backend/apps/tickets/serializers.py`** — add a `SerializerMethodField`:

```python
sla_status = serializers.SerializerMethodField()

def get_sla_status(self, obj) -> str | None:
    """`met` / `breached` / `pending`, or `None` when no policy applies —
    `dimension_status`'s own vocabulary, deliberately not a new one.

    Reads the `first_response_at`/`resolved_at` annotations and the
    per-request resolver from context; falls back to `None` when either is
    absent (a serializer used outside the list path, e.g. a detail write
    response) rather than triggering the per-ticket N+1 this story exists
    to avoid.
    """
```

**The fallback matters.** `TicketSerializer` is also used for `create`/`update`/`retrieve`, where the queryset is not annotated. Returning `None` there is correct and cheap; calling `compute_sla_status` would reintroduce N+1 through the back door. Document that the detail SLA view is `GET /tickets/{id}/sla/`.

**Do not add `sla_status` to `ordering_fields`.** It is computed, not a column; ordering needs its own design pass. Leave a comment saying so.

---

## Frontend Tasks

### 3 — Status filter

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`**

Copy the `priorityFilter` block exactly: `useState('all')`, a `Select` with an "All statuses" option plus `TICKET_STATUSES`, spread `...(statusFilter !== 'all' ? { status: statusFilter } : {})` into the query params, and add `statusFilter` to the page-reset `useEffect` dependency list — **omitting it there is the likely bug**, leaving the user on page 7 of a now-3-page result.

Place it **before** priority in the filter row: status is the more frequently used of the two.

Locale keys in `en` **and** `ar`.

### 4 — SLA column

Add a column rendering `sla_status` as a `Badge`, `—` when `null`. Map to existing variants via a helper beside `ticketStatusVariant`: `breached` → `destructive`, `pending` → `warning`, `met` → `success`.

Give it `priority: 'sm'` so it drops on mobile like the other secondary columns, and **not** `sortable` — the backend cannot order by it.

Locale keys for the header and the three values, in both languages.

---

## Edge Cases & Failure Modes

- **No SLA policy configured** (a fresh install, and most rows today). `resolve_policy` returns `None` → `sla_status` is `null` → the column shows `—`. Must not render an empty badge or "None".
- **`sla_status` on create/update responses.** The queryset is unannotated there; the serializer returns `None` via the guard. Confirm a `POST /tickets/` still returns 201 with `sla_status: null` and issues no extra query.
- **A ticket resolved before any outbound reply.** `first_response_at` is `null` and `resolved_at` is set — `dimension_status` already handles it (`response` breaches once due passes). No new branch.
- **Org default policy with only one of the two minutes set.** `_org_default_policy` returns `None` unless **both** are set; `bulk_target_resolver` must reproduce that exactly, not treat a half-configured org as valid.
- **`?status=` and `?assigned_to_me=true` together.** Both are `.filter()` chains, so they AND — the same composition `ORG-4` documented for department+branch. No special case.
- **An invalid status typed into the URL.** Backend returns 400 (already true). The frontend never sends one because the `Select` is a fixed list; do not add client-side validation that could drift from `Ticket.Status`.
- **Query count regression.** The single most likely failure is building the resolver inside `get_sla_status` instead of once per request — that is `2N` queries and would look correct in every functional test. **Verification step 6 is the gate.**
- **RPT-2 regression.** `apps/reports/sla.py` is being edited. Its endpoints must return identical data before and after — verify against the live endpoints.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md §16. **No test file is added, modified, or removed.** Verification is below.

---

## Migration / Rollback

**No model change, no migration.** `sla_status` is computed on read; nothing is persisted. `makemigrations --check` must still report "No changes detected".

**Deploy ordering is unconstrained** — `sla_status` is an added response field, and an old frontend ignores it.

**Rollback is `git revert`.** The only subtlety is that the revert must restore `apps/reports/sla.py`'s private helpers together with the `apps/sla/policy.py` additions; they move in one commit, so a whole-commit revert is consistent and a partial one is not.

---

## Verification Steps

1. **Gates:** backend — `ruff check`, `ruff format --check`, `manage.py check`, `makemigrations --check --dry-run`. Frontend — `tsc -b`, `lint`, `check:rtl`, `format:check`, `vite build`.
2. **Locale parity:** every new key in `en` and `ar`; flattened set-difference empty both ways.
3. **F-8 works end to end.** On `/tickets`, selecting a status narrows the list; the request carries `?status=`; "All statuses" removes it. Changing status **resets to page 1** — set page 3 first, then change status, and confirm.
4. **F-9 shows real values.** With at least one `SLAPolicy` configured, the SLA column shows `met`/`breached`/`pending` badges, and `—` for tickets with no policy.
5. **The two paths agree.** For a given ticket, the list's `sla_status` matches the worse dimension of `GET /api/tickets/{id}/sla/`. This is the check that proves no second vocabulary was introduced.
6. **THE GATE — query count is constant.** `settings.DEBUG=True`, Django test `Client` with a JWT:
   - `GET /api/tickets/?page_size=1` and `?page_size=25` issue the **same** number of queries.
   - That number is **6** (4 before + bulk `SLAPolicy` + `OrganizationSettings`). A different constant is acceptable if explained; **any growth with page size fails the story.**
7. **Detail paths unaffected.** `GET /api/tickets/{id}/` returns `sla_status: null` (unannotated path) and `GET /api/tickets/{id}/sla/` returns the full detail payload unchanged.
8. **RPT-2 did not regress.** `GET /api/reports/sla/trend/` and `/api/reports/sla/breach-rate/` return the same payloads as before the change, for the same date range.
9. **Portal boundary.** Re-run Story 99's sweep: a portal customer still gets 403 on `/api/tickets/` and sees no SLA data.
10. **Mobile + RTL.** The SLA column drops below `sm`; the status `Select` and SLA badges render correctly in Arabic.

---

## Done Criteria

- [ ] `/tickets` has a status filter that sends `?status=`, follows the `'all'` sentinel convention, and resets to page 1 on change.
- [ ] The list shows an SLA column using `met`/`breached`/`pending` — **`dimension_status`'s existing vocabulary**, no new one — and `—` when no policy applies.
- [ ] The list's value agrees with `GET /tickets/{id}/sla/` for the same ticket.
- [ ] The batching helpers live in `apps/sla/policy.py`; `apps/reports/sla.py` imports them and has **no private copy**; classification still goes through `dimension_status`.
- [ ] `GET /api/tickets/` issues the **same** query count at `page_size=1` and `page_size=25`.
- [ ] `TicketSerializer` returns `None` for `sla_status` on unannotated paths and never calls `compute_sla_status` per row.
- [ ] `sla_status` is **not** in `ordering_fields`, with a comment saying why.
- [ ] RPT-2's two SLA report endpoints return unchanged payloads.
- [ ] No migration; `makemigrations --check` clean.
- [ ] Locale parity holds; all gates pass.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md §16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 104.**
