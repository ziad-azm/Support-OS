# ticket-management — plan overview

Entry point for the **ticket-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 12 | [12-story-create-track-tickets-SUPPORTOS-32.md](12-story-create-track-tickets-SUPPORTOS-32.md) | Create & Track Tickets | SUPPORTOS-32 | Story 10 (`CUST-1`), Story 09 (`AUTH-2`) |

## Dependency notes

This feature maps to **EPIC 4 — Ticket Management** in `SupportOs backlog.MD` (lines 308-350). It depends on customer-management's `CUST-1` (Story 10) and authentication-authorization's `AUTH-2` (Story 09), both complete — see [`../customer-management/00-overview.md`](../customer-management/00-overview.md) and [`../authentication-authorization/00-overview.md`](../authentication-authorization/00-overview.md).

`TKT-1` (story 12) → `TKT-2` (Categories & Priorities) / `TKT-3` (Assignment) / `TKT-4` (Status & Escalation) → `TKT-5` (Ticket History). TKT-2, TKT-3, and TKT-4 each depend only on TKT-1 and can be sequenced in any order; TKT-5 is the natural last piece (a reusable activity-log pattern other epics can reuse).

**Story 12 is the second feature domain in the project**, after customer-management, and the first to cross a feature boundary: its ticket form needs read-only customer data, which `CONVENTIONS.md` §15's `no-restricted-imports` rule forbids importing from `features/customers` directly. It resolves this by calling the `/customers/` backend endpoint directly from its own `api/` layer with a minimal local type (`CustomerOption`) — documented as the worked example in `CONVENTIONS.md` §23 and `frontend/src/README.md`.

**Scope boundary inside EPIC 4.** Four sibling stories own most of what a "ticket" eventually needs, and story 12's model is deliberately the CRUD core plus two placeholder fields only:

| Owned by | What |
|---|---|
| TKT-2 (line 322) | `Category` model, real priority management, category/priority filters |
| TKT-3 (line 329) | `assigned_agent`, assign/reassign, "my tickets" |
| TKT-4 (line 336) | Status-transition validation, escalation level/flag, the status-control UI |
| TKT-5 (line 343) | `TicketActivity` log, history timeline |

So story 12's `Ticket` has `status`/`priority` as bare placeholder fields (no transition rules, no management API) and **no status-changing UI at all** — TKT-4 owns that surface, and building a throwaway one now would be immediately superseded.

**A verified forward decision from Story 10, now resolved.** Story 10's own plan named `Ticket.customer`'s `on_delete=PROTECT` as the reason `Customer` needs no soft-delete flag. Story 12 implements that FK and, as a direct consequence, discovers and fixes a real gap: `apps/core/exceptions.py` had no handling for Django's `ProtectedError`, which would otherwise make `DELETE /api/customers/<id>/` 500 on any customer with tickets. Fixed in the **shared** exception handler, not ticket-specific code — verified live against the project's other `PROTECT` relation (`accounts.Role`/`User.role`) before this story, which had never exercised the gap because no API deletes a `Role`.

**Router collision, also resolved.** `apps.customers.urls` already mounts a `DefaultRouter` at the API root (`/api/`, established by Story 10). A second `DefaultRouter` for tickets at the same mount point would silently shadow part of it. `apps/tickets/urls.py` uses `SimpleRouter` instead, which generates no root view — Story 10's own plan named this as the documented alternative, for a different original reason (keeping the enveloped 404 at `/api/`).

**Note on testing:** per standing project policy this project authors no automated tests. Story 12 adds none. Its checks are the backend's `manage.py check`/`test`/`ruff`, the frontend's `lint`/`format:check`/`check:rtl`/`build`, an `en`/`ar` key-set comparison, real HTTP across four verbs × three permission states (including the `ProtectedError` fix in both directions), and a bilingual walkthrough of the list, detail, and form.
