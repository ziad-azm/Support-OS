# customer-portal — plan overview

Entry point for the **customer-portal** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 42 | [42-story-portal-access-customer-auth-SUPPORTOS-55.md](42-story-portal-access-customer-auth-SUPPORTOS-55.md) | Portal Access & Customer Auth | SUPPORTOS-55 | EPIC 2 (`AUTHZ`, stories 08–09); EPIC 1 (`I18N`/`UI`, stories 05–06); CUST-1 (story 10); TKT-1 (story 12) |
| 43 | [43-story-submit-tickets-SUPPORTOS-56.md](43-story-submit-tickets-SUPPORTOS-56.md) | Submit Tickets | SUPPORTOS-56 | Story 42 (`PORTAL-0`); TKT-1 (story 12) |
| 44 | [44-story-track-requests-SUPPORTOS-57.md](44-story-track-requests-SUPPORTOS-57.md) | Track Requests | SUPPORTOS-57 | Story 42 (`PORTAL-0`); Story 43 (`PORTAL-1`, extended rather than re-built) |
| 45 | [45-story-view-history-SUPPORTOS-58.md](45-story-view-history-SUPPORTOS-58.md) | View History | SUPPORTOS-58 | Story 44 (`PORTAL-2`) — frontend-only, no backend change |

## Dependency notes

This feature maps to **EPIC 10 — Customer Portal** in `SupportOs backlog.MD` (lines 556–594). It depends on EPIC 2 (`AUTHZ`) and EPIC 1 (`UI`/`I18N`) being complete, which they are — see [`../authentication-authorization/00-overview.md`](../authentication-authorization/00-overview.md) and [`../internationalization-design-system/00-overview.md`](../internationalization-design-system/00-overview.md).

`PORTAL-0` (story 42) is the prerequisite for every other story in this epic: `PORTAL-1` (Submit Tickets), `PORTAL-2` (Track Requests), `PORTAL-3` (View History), `PORTAL-4` (Access FAQs), `PORTAL-5` (Submit Feedback/CSAT) all depend on it directly or transitively.

**Shared spec produced here:**

| Spec | Established by | What it fixes |
|---|---|---|
| Customer portal identity & scoping (`CONVENTIONS.md` §26) | Story 42 | `Customer.user` (nullable 1:1 to `accounts.User`); the seeded `customer` role holding `portal.access`; `CustomerScopedModelViewSet` (`apps/core/views.py`) as the base every portal viewset scopes its queryset through; `HasPermission.has_object_permission` as the row-level defense-in-depth layer; the portal frontend route tree as a **sibling** of `RootLayout`'s (not nested inside it), gated by the existing `RequireAuth`/`RequirePermission`. |

**Verified findings that shaped story 42:**

- **`RootLayout` is the top-level route element for the entire SPA, not just authenticated staff routes** — nesting `/portal` under it would wrap every customer-facing page in the staff header/nav/`NotificationBell`. Story 42 adds `/portal` as a second, sibling top-level route in `frontend/src/app/router.tsx` instead.
- **No second auth system was needed.** A customer is simply a `User` row with `role = customer` (one new seeded role, one new permission, `portal.access`) — the existing JWT endpoints, `AuthProvider`, `useAuth()`, `RequireAuth`, and `RequirePermission` all work unmodified.
- **`get_queryset()` scoping, not `has_object_permission`, is what actually protects `list`.** DRF never calls `has_object_permission` per row for a list action. `CustomerScopedModelViewSet.get_queryset()` is the primary defence for every standard action; `HasPermission.has_object_permission` is a secondary layer that only matters for a custom `@action` fetching an object outside `get_object()`.
- **`apps/portal/` stays an empty scaffold.** No real endpoint exists for a portal customer to call yet — this story ships the mechanism (auth + scoping + shell), and PORTAL-1 is the first feature story to actually subclass `CustomerScopedModelViewSet`.

**Known gap carried out of story 42:** `PortalHomePage` is a placeholder with no real content — the same "ships ahead of its UI consumer" pattern `AUTHZ`'s `can()`/`<Can>`/`RequirePermission` and `DataTable` (`UI-1`) already carried before their first feature story landed. **Closed by story 43.**

**Verified findings that shaped story 43:**

- **`TicketSerializer.customer` is writable and required — the exact field a portal endpoint must not expose.** Reusing `TicketSerializer` unmodified for ticket creation would let a customer's request body set an arbitrary `customer` id; `CustomerScopedModelViewSet.get_queryset()` only scopes reads, not a writable field on `create`. `PortalTicketCreateSerializer` (a thin subclass) marks `customer` read-only; `PortalTicketViewSet.perform_create` is what actually sets it, from `request.user.customer_profile`.
- **`apps/portal/` gets its first real content.** `serializers.py`, `views.py`, `urls.py` all created fresh; `config/api_urls.py` gains its first `apps.portal.urls` include.
- **No new permission, migration, or `Role` was needed.** Story 43 reuses `Permissions.PORTAL_ACCESS` and the `customer` role from story 42 verbatim — the first real proof of PORTAL-0's "reused by all portal stories" promise.
- **A plain `path()`, not a router, is what keeps `PortalTicketViewSet` create-only.** The class itself (via `CustomerScopedModelViewSet` → `BaseModelViewSet` → `ModelViewSet`) has `list`/`retrieve`/`update`/`destroy` methods, but only `create` is ever routed. **Verified correction to the plan's own original assumption:** DRF's permission check runs *before* HTTP-method dispatch, so `GET /api/portal/tickets/` with no token returns `401` (the auth gate fires first), and only a request from a valid customer token reaches the real `405 method_not_allowed` — never a plain 404. Never assume an unmapped method on a routed path produces a 404 without checking the auth/permission ordering first.
- **`features/portal/` cannot import from `features/tickets/`** (`no-restricted-imports`, `frontend/.oxlintrc.json`) — the frontend write/response types are self-contained and deliberately narrower than `features/tickets/types/ticket.ts`'s `Ticket`/`TicketInput`.

**Known gap carried out of story 43:** no way for a customer to see the ticket they just submitted beyond a success toast — no `list`/`retrieve` route exists for `PortalTicketViewSet` yet. **PORTAL-2 (Track Requests)** is the story that adds it. **Closed by story 44.**

**Verified findings that shaped story 44:**

- **`PortalTicketViewSet` was extended, not replaced.** `list`/`retrieve` were added to the same class PORTAL-1 built (`permission_map` gains two entries, `queryset` gains `select_related`, `get_queryset` gains a `status` filter) — no second viewset, no duplicated scoping logic.
- **`PortalTicketCreateSerializer` renamed `PortalTicketSerializer`** — its class body is unchanged from PORTAL-1; only the name (and docstring) changed, since it now serves two read-only actions in addition to `create`.
- **Scoping protects `retrieve` the same way it already protected `list`.** Requesting another customer's ticket id 404s (the row is excluded from `get_queryset()` before the pk lookup runs), never 403 — the same "scoping, not an object-permission check, is the primary defence" finding PORTAL-0 established for `list`, now verified for `retrieve` too.
- **PORTAL-1's own code comment predicted this story exactly.** `usePortalTicketMutations.ts`'s docstring said PORTAL-2 would add `queryClient.invalidateQueries` once a portal ticket list existed — story 44 is that change, verified live: a ticket submitted via `/portal/tickets/new` appears in `/portal/tickets` with no manual reload.
- **`features/portal/` keeps redefining types locally rather than importing from `features/tickets/`.** `PortalTicket`/`PORTAL_TICKET_STATUSES`/`PORTAL_TICKET_PRIORITIES` duplicate `features/tickets/types/ticket.ts`'s `Ticket`/`TICKET_STATUSES`/`TICKET_PRIORITIES` — the accepted, unavoidable cost of `no-restricted-imports`' feature-boundary rule, the same tradeoff PORTAL-1's `PortalTicketInput` already made.

**Known gap carried out of story 44:** the list shows every one of the customer's tickets regardless of status, with no distinction between active and historical/closed ones, and no text search. **PORTAL-3 (View History)** is the story that addresses the first; search remains a forward note with no story currently asking for it. **Closed (the history half) by story 45.**

**Verified findings that shaped story 45:**

- **Zero backend changes were needed.** PORTAL-2's `PortalTicketViewSet.get_queryset` already validated and applied `?status=` generically — `closed` was already a legal value the day PORTAL-2 shipped. Verified live against the running dev server before writing any frontend code, rather than assumed. This is the cleanest "reuse" story in the epic so far: one new frontend page, two small cross-link edits, one route, no `apps/portal/` file touched at all.
- **"Extend the scoped list with closed tickets" was read as additive, not restrictive.** `PortalTicketListPage` (PORTAL-2) already shows every ticket regardless of status — story 45 does not change that default or split it into "active"/"history" tabs; it adds a second, complementary, purpose-built archive page instead, so PORTAL-2's already-verified behavior stays intact.
- **`updated_at`, not a new `closed_at` field, is what the history view shows — honestly labelled "Last updated."** `Ticket` has no dedicated closed-at timestamp, and `updated_at` can move for reasons unrelated to closing (a later `escalate` toggle, verified against `apps/tickets/views.py`). Adding a real `closed_at` field is a schema decision with its own backfill question that no story has asked for.
- **`resolved` was deliberately excluded from "history."** `TICKET_STATUS_TRANSITIONS.resolved` still allows a move to `in_progress` or `closed` — only `closed` (`transitions: []`) is truly terminal, matching "past-request" in a way `resolved` does not yet.
