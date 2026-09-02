# Story 84 — Role-Based Post-Login Landing (Story: SUPPORTOS-123)

## Prerequisites

- **Story 09 completed:** [09-story-roles-permissions-authorization-SUPPORTOS-27.md](09-story-roles-permissions-authorization-SUPPORTOS-27.md). Verified landed and unchanged by this story: `AuthUser.permissions: string[]` (`frontend/src/shared/auth/types.ts:15-17`, "flat, already resolved by the backend — includes the superuser bypass"), `hasPermission(user, permission)` (`frontend/src/shared/auth/permissions.ts:11-14`), `RequireAuth`/`RequirePermission`/`Can`/`useAuth` all exported from the `frontend/src/shared/auth/index.ts` barrel.
- **Story 42 completed:** [../customer-portal/42-story-portal-access-customer-auth-SUPPORTOS-55.md](../customer-portal/42-story-portal-access-customer-auth-SUPPORTOS-55.md). Verified landed: the `/portal` route tree is a second, sibling top-level object in `frontend/src/app/router.tsx` (its own `RequireAuth` at line 567, its own `RequirePermission permission="portal.access"` at line 570), independent of the `/` (`RootLayout`) tree — confirmed by reading `router.tsx:64-664` in full. This story does not touch the `/portal` tree at all.
- **Superseded planning session on this same intake.** A prior pass at this ticket ran against an empty-description Jira fetch and produced a narrower plan (a role-name badge on `HomePage`, no redirect). The intake (`.squad/stories/authentication-authorization/SUPPORTOS-123/intake.md`) has since been filled in with the real scope — a post-login landing redirect — matching `SupportOs backlog.MD` STORY (AUTH-3) — Role-Based Post-Login Landing. This plan replaces that earlier one in full; nothing from it survives.
- **Backend requires no change.** `apps.core.permissions.permissions_for` (`backend/apps/core/permissions.py:52-67`) already resolves a superuser to `ALL_PERMISSIONS` (includes `portal.access` plus everything else) and a `customer`-role user to exactly `{'portal.access'}` (verified live in the local dev database: `Role.objects.get(slug='customer').permissions == ['portal.access']`). This story is a pure frontend routing fix built on data the client already receives via `/api/auth/me/`.

---

## Story Goal

Today, `frontend/src/app/router.tsx`'s `/` route (`RootLayout` + `Sidebar`, index route renders `HomePage`) is reachable by **any** authenticated account — the only gate is `RequireAuth` (`router.tsx:70`), which checks `status === 'authenticated'` and nothing else (`frontend/src/shared/auth/RequireAuth.tsx:11-19`). An account whose only permission is `portal.access` (the seeded `customer` role) therefore lands on the staff shell after login, not on `/portal` — the customer-only route tree that already exists and is correctly gated.

This story makes `/` mean the right thing for a `portal.access`-only account: **redirect it to `/portal` instead of rendering `HomePage`**. Every other account (any role holding at least one non-portal permission, or a superuser) is unaffected — `/` renders exactly as it does today.

**In scope:**
1. A portal-only account hitting `/` — whether via the post-login redirect or a direct URL — lands on `/portal`, not the staff shell.
2. `Sidebar.tsx`'s `/tasks` link (the one nav entry not wrapped in `<Can permission="...">`) gets a documented reason for staying ungated, since after (1) ships it is never reachable by a portal-only account regardless.

**Explicitly out of scope** (per the intake's own "Out of scope" section):
- Any backend or permission-model change — `portal.access` and `permissions_for` are unchanged.
- Granting or revoking a customer's portal login from the UI — that is the separate, already-planned [../customer-management/85-story-portal-access-management-SUPPORTOS-122.md](../customer-management/85-story-portal-access-management-SUPPORTOS-122.md).
- A bespoke landing screen per staff role. Only the binary "portal-only → `/portal`, everyone else → `/` unchanged" split.
- Removing or redesigning `/tasks` itself.

---

## Context — Read These Files First

1. `frontend/src/app/router.tsx` — read lines 64-83 (the `/` tree's `RequireAuth` wrapping the `index: true` `HomePage` route, then the first `RequirePermission permission="customers.view"` sibling at line 80) and lines 556-579 (the sibling `/portal` tree: its own `RequireAuth` at 567, `RequirePermission permission="portal.access"` at 570). The index route (72-78) is the only node this story's router change touches.
2. `frontend/src/shared/auth/RequirePermission.tsx` — all 31 lines. This is the shape to copy: a path-less layout route element that re-checks `status` defensively (docstring: "safe standalone" even though nested inside `RequireAuth`), then either `<Navigate>`s or renders `<Outlet/>`. A permission-miss here redirects to `/` (line 29) — this story's new component is the mirror case, redirecting a portal-only miss on `/` itself to `/portal`.
3. `frontend/src/shared/auth/RequireAuth.tsx` — all 20 lines. Confirms `status`'s three values (`'loading' | 'authenticated' | 'unauthenticated'`) and the `<Loading/>`/`<Navigate to="/login">` pattern this story's new component reuses.
4. `frontend/src/shared/auth/types.ts` — all 17 lines shown for `AuthUser`. `permissions: string[]` (line 17) is "flat, already resolved by the backend — includes the superuser bypass. Never derive permissions from `role` on the client." This story reads `user.permissions` directly, the same way `hasPermission` does — never `user.role`.
5. `frontend/src/shared/auth/permissions.ts` — all 15 lines. `hasPermission(user, permission)` is `user.permissions.includes(permission)`. This story does not call it — it needs "is this the *only* permission," not "is this *a* permission" — but matches its `user: AuthUser | null` null-check style.
6. `frontend/src/shared/auth/index.ts` — all 24 lines. The barrel that `router.tsx:6` imports `RequireAuth`/`RequirePermission` from. This story adds one new named export here.
7. `frontend/src/features/auth/components/LoginPage.tsx` — lines 32 and 36. `from = (location.state as ...)?.from?.pathname ?? '/'`, then `onSuccess: () => navigate(from, { replace: true })`. Unchanged by this story: a portal-only account's post-login `navigate('/', ...)` still fires exactly as today; the new router guard is what turns that landing on `/` into a further redirect to `/portal`. No change needed here — verified by reading the whole file.
8. `frontend/src/app/Sidebar.tsx` — lines 179-209 (the `/tasks` `SidebarLink`, lines 203-208, is the only entry in this `NavSection` — and the only one in the whole file — with no `<Can permission="...">` wrapper) and line 210 (`<Can permission="knowledge_base.view">` immediately after, for contrast). Read the whole 368-line file once to confirm no other ungated permission-worthy link exists (the only other unwrapped link is `/preferences` at line 336-341, a personal-settings page with no permission concept, out of this story's scope).
9. `backend/apps/core/permissions.py` — lines 45-67 (`ALL_PERMISSIONS`, `permissions_for`). Confirms a superuser's resolved `permissions` list always contains `portal.access` **plus every other permission**, so the "exactly one permission and it is `portal.access`" check this story adds can never misfire on a superuser.

---

## Frontend Tasks

### 1 — New guard: redirect a portal-only account away from `/`

**Create file: `frontend/src/shared/auth/RedirectPortalOnly.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * Wraps ONLY the `/` index route (`app/router.tsx`'s `HomePage` entry) — not
 * the whole staff route tree. An account whose entire resolved permission
 * set is `['portal.access']` (the seeded `customer` role — see
 * `backend/apps/core/permissions.py::permissions_for`) is sent to `/portal`
 * instead of rendering `HomePage`.
 *
 * Deliberately scoped to the index route alone: every other `/` child route
 * is already gated by its own `RequirePermission`, and a permission miss
 * there redirects back to `/` (`RequirePermission.tsx:29`) — which this
 * component then forwards on to `/portal`. No loop: `/portal`'s own
 * `RequireAuth` + `RequirePermission permission="portal.access"`
 * (`router.tsx:567,570`) then passes and stops there.
 *
 * A superuser's resolved `permissions` always includes `portal.access`
 * PLUS every other permission (`permissions_for`'s `ALL_PERMISSIONS`
 * branch), so `permissions.length === 1` never matches a superuser.
 */
export function RedirectPortalOnly() {
  const { status, user } = useAuth()

  if (status === 'loading') return <Loading />

  const isPortalOnly =
    !!user && user.permissions.length === 1 && user.permissions[0] === 'portal.access'
  if (isPortalOnly) return <Navigate to="/portal" replace />

  return <Outlet />
}
```

**File: `frontend/src/shared/auth/index.ts`**

Add one export line after `export { RequirePermission } from './RequirePermission'` (line 22):

```ts
export { RedirectPortalOnly } from './RedirectPortalOnly'
```

**File: `frontend/src/app/router.tsx`**

Import `RedirectPortalOnly` alongside the existing named imports on line 6 (`import { RequireAuth, RequirePermission } from '@/shared/auth'` becomes `import { RedirectPortalOnly, RequireAuth, RequirePermission } from '@/shared/auth'`).

Wrap the index route (lines 72-78) in a new layout node, nested inside the existing `RequireAuth` (line 70) and as a sibling of the `RequirePermission permission="customers.view"` node (line 80) — do not touch that node or anything after it:

Before (lines 71-78):

```tsx
        children: [
          {
            index: true,
            lazy: async () => {
              const { HomePage } = await import('@/app/HomePage')
              return { element: <HomePage /> }
            },
          },
```

After:

```tsx
        children: [
          {
            element: <RedirectPortalOnly />,
            children: [
              {
                index: true,
                lazy: async () => {
                  const { HomePage } = await import('@/app/HomePage')
                  return { element: <HomePage /> }
                },
              },
            ],
          },
```

### 2 — Document why `/tasks` stays ungated in `Sidebar.tsx`

**File: `frontend/src/app/Sidebar.tsx`**

Add a one-line comment directly above the `/tasks` `SidebarLink` (before line 203), explaining the decision rather than leaving the omission silent:

```tsx
          {/* Deliberately ungated, unlike every other link in this file:
              TaskViewSet scopes to request.user's own rows (personal, safe
              for any staff account), and after Story 84 a portal-only
              account never reaches this sidebar at all — RedirectPortalOnly
              sends it to /portal before RootLayout ever renders. */}
          <SidebarLink
            to="/tasks"
            icon={ListTodoIcon}
            label={t('tasks:title')}
            collapsed={collapsed}
          />
```

No functional change in this task — comment only. `/preferences` (line 336-341) needs no equivalent comment: it is a personal-settings page with no permission concept at all, not an omission from the `<Can>` pattern.

**No backend changes required.**

---

## Edge Cases & Failure Modes

- **`status === 'loading'` while `RedirectPortalOnly` is evaluated.** Handled identically to `RequireAuth`/`RequirePermission`: render `<Loading/>` and re-render once `status` settles — no flash of `HomePage` before the redirect decision is known.
- **`user` is `null` while `status` is `'authenticated'`.** Cannot happen per `AuthProvider`'s own contract (the same one `RequirePermission` relies on without re-verifying), but the `!!user &&` guard makes `isPortalOnly` `false` rather than throwing if it ever did — matching `hasPermission`'s own `if (!user) return false` defensiveness (`permissions.ts:12`).
- **A future role is seeded with `permissions: ['portal.access', 'some_other.permission']`.** `isPortalOnly` requires `permissions.length === 1`, so any additional permission — however unrelated to staff features — keeps the account on `/`. This is the correct, conservative default: this story only ever redirects an account that holds **nothing but** portal access.
- **A `portal.access`-only account manually types a staff URL, e.g. `/customers`.** `RequirePermission permission="customers.view"` (`router.tsx:80`) already redirects it to `/` (its own existing behavior, `RequirePermission.tsx:29`) — which `RedirectPortalOnly` then forwards to `/portal`. Two hops, no loop, verified by tracing both components' `<Navigate>` targets.
- **A superuser (`role: null`, `is_superuser: true`).** `permissions_for` resolves to `ALL_PERMISSIONS` (`backend/apps/core/permissions.py:62-63`), a large frozenset that always contains far more than just `portal.access` — `permissions.length === 1` is never true, so `/` renders `HomePage` unchanged.
- **RTL / language switch.** `RedirectPortalOnly` renders no visible UI of its own (`<Navigate>` or `<Outlet/>` only) — no RTL-specific behavior to verify beyond the existing `HomePage`/`PortalHomePage` screens this story does not modify.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, changed, or removed. Verification is the build/lint gates plus the manual walkthrough in `## Verification Steps`.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build`. Confirms `RedirectPortalOnly` typechecks against `AuthContextValue`/`AuthUser` with no changes needed to either type.
2. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`. Both exit 0.
3. **Manual — portal-only account:** with the backend running (`python manage.py runserver` from `backend/`, plus Postgres/Redis up) and `npm run dev` from `frontend/`:
   - Log in with an account whose role is `customer` (permissions `['portal.access']` only — e.g. a test account created via `manage.py shell` with `role=Role.objects.get(slug='customer')`).
   - Confirm the browser lands on `/portal` (`PortalHomePage`), not `/`.
   - While still signed in, navigate the browser directly to `http://localhost:5173/` — confirm it redirects to `/portal` again, not `HomePage`.
4. **Manual — staff account unaffected:** log in with an existing staff account (e.g. `ziad.hosny@azm.com`, role `agent`). Confirm it lands on `/` and `HomePage`/`Sidebar` render exactly as before this story (ticket/customer/knowledge-base cards still gated the same way by `<Can>`).
5. **Manual — superuser unaffected:** log in with the superuser account (`role: null`, `is_superuser: true`). Confirm it lands on `/` and sees the full `Sidebar` (all sections, since a superuser holds every permission).
6. **Manual — cross-check the two-hop redirect:** while signed in as the portal-only account from step 3, navigate directly to `http://localhost:5173/customers`. Confirm the end result is landing on `/portal` (via `/` → `RequirePermission` miss → `RedirectPortalOnly` → `/portal`), not a blank page or a redirect loop (watch the Network/URL bar for more than two redirect hops).
7. **Regression:** for the staff account in step 4, confirm every other `Sidebar.tsx` link (`/customers`, `/tickets`, `/knowledge-base`, `/reports`, `/tasks`, `/preferences`) still navigates correctly and the `showAdministration` section (`Sidebar.tsx:129-136`) still shows/hides per that account's actual permissions, unchanged from before this story.

---

## Done Criteria

- [ ] `frontend/src/shared/auth/RedirectPortalOnly.tsx` exists, exported from `frontend/src/shared/auth/index.ts`.
- [ ] `frontend/src/app/router.tsx`'s `/` index route is nested under `<RedirectPortalOnly />`, inside the existing `<RequireAuth />`; no other route in the file is touched.
- [ ] A `portal.access`-only account lands on `/portal` both immediately after login and on a direct hit of `/`.
- [ ] A staff account with at least one non-portal permission, and a superuser, both still land on `/` and see `HomePage`/`Sidebar` exactly as before this story.
- [ ] `Sidebar.tsx`'s `/tasks` link carries the new explanatory comment; no functional change to that link.
- [ ] `npm run build`, `npm run lint`, `npm run format:check` all exit 0 from `frontend/`.
- [ ] `00-overview.md` (this feature) updated with this story's corrected scope.
- [ ] `SupportOs backlog.MD` STORY (AUTH-3) checked against this plan's final scope — update it if the two drift (they matched at the time this plan was written).
