# customer-portal — plan overview

Entry point for the **customer-portal** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 42 | [42-story-portal-access-customer-auth-SUPPORTOS-55.md](42-story-portal-access-customer-auth-SUPPORTOS-55.md) | Portal Access & Customer Auth | SUPPORTOS-55 | EPIC 2 (`AUTHZ`, stories 08–09); EPIC 1 (`I18N`/`UI`, stories 05–06); CUST-1 (story 10); TKT-1 (story 12) |

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

**Known gap carried out of story 42:** `PortalHomePage` is a placeholder with no real content — the same "ships ahead of its UI consumer" pattern `AUTHZ`'s `can()`/`<Can>`/`RequirePermission` and `DataTable` (`UI-1`) already carried before their first feature story landed.
