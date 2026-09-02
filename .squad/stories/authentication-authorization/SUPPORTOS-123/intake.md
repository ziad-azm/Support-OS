> **Fetched from jira:** [SUPPORTOS-123](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-123)  
> *Fetched 2026-09-02T20:51:35.235Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (AUTH-3) — Role-Based Post-Login Landing  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

*(tracker returned an empty description)*

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/authentication-authorization/SUPPORTOS-123/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Role-Based Post-Login Landing
- **Feature slug (folder under `plans/`):** `authentication-authorization`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-123` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(AUTH-3) — Role-Based Post-Login Landing
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a customer, I want to land on the customer portal right after logging in, so
that I never see the staff application shell I have no business in.

Confirmed live in this codebase: `RootLayout.tsx`'s `/` route (`router.tsx`,
index route under `RequireAuth`) has no role/permission check at all beyond
"is this user authenticated." A `portal.access`-only account (the seeded
`customer` role) therefore lands on the staff `Sidebar` + `HomePage` after
login instead of `/portal` — the customer-only route tree that already exists
and is correctly gated by `<RequirePermission permission="portal.access" />`
(`router.tsx:570`).

Two sidebar items were observed leaking through for a `customer`-role account
before this was reported, though neither is a data-exposure risk on its own:
- `/tasks` — the ONLY link in `Sidebar.tsx` not wrapped in `<Can
  permission="...">` (every other entry is). `TaskViewSet` is scoped to
  `request.user`'s own rows, so a customer just sees an empty list — but the
  link/page has no business appearing in a customer's view at all.
- The "Knowledge base" section, which appeared because the `customer` role
  previously carried `knowledge_base.view` in addition to `portal.access`.
  That extra permission has since been removed from the role directly in the
  database (verified: no portal endpoint requires `knowledge_base.view`; it
  had no functional purpose for a customer and its only real effect was this
  leak) — so this item is resolved and NOT part of this story's remaining
  scope. Listed here only as background for why it was seen during testing.

The remaining, in-scope problem is purely the missing landing redirect plus
the one inconsistently-gated sidebar link.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- [ ] After logging in with an account whose only permission is
      `portal.access`, the user lands on `/portal` (the existing
      `PortalHomePage`), never on `/` (staff `RootLayout`/`HomePage`).
- [ ] Directly navigating to `/` while signed in as a `portal.access`-only
      account also redirects to `/portal` — not just the post-login flow.
- [ ] A staff account (any role with at least one non-portal permission)
      is unaffected: still lands on `/` and sees `RootLayout`/`HomePage` as
      today.
- [ ] `Sidebar.tsx`'s `/tasks` link either gets the same `<Can
      permission="...">` convention every other entry uses, or a one-line
      comment explains why it is deliberately exempt (e.g. "personal,
      user-scoped, safe for any authenticated account") — reviewer's call,
      but it must be a deliberate, documented decision, not silence.
- [ ] No existing route/permission behavior for staff roles regresses
      (`customers.view`, `tickets.view`, `knowledge_base.view`, etc. sidebar
      gating unchanged).
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** AUTH-2 (Roles, Permissions & Authorization — `useAuth()`'s `can()`/`user` and the `RequirePermission` component this story reuses, not reimplements).

## Extra notes (optional)

- `SupportOs backlog.MD` STORY (AUTH-3) — Role-Based Post-Login Landing is the source backlog entry this ticket was cut from; keep this intake in sync with it if either changes.
- A separate, already-planned story, STORY (CUST-5) — Portal Access Management, covers letting staff grant/revoke a customer's portal login from the UI. Not this story's concern — this story only fixes where an *existing* portal account lands after login.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- `frontend/src/app/router.tsx` — `/` (index route, line ~73) renders `HomePage` under `RootLayout`, gated only by `<RequireAuth />`, no permission check. `/portal` (line ~570) is already gated by `<RequirePermission permission="portal.access" />` and has its own `PortalLayout`/`PortalHomePage`.
- `frontend/src/app/RootLayout.tsx` — the staff shell (`Sidebar` + `Outlet`), currently rendered for literally any authenticated user.
- `frontend/src/shared/auth/useAuth.tsx` (or wherever `useAuth()` lives) — exposes `can(permission)` and the current `user`; the redirect decision ("does this account have exactly `portal.access` and nothing else") is a `can()`-based check, not a new backend field.
- `frontend/src/app/Sidebar.tsx` — the `/tasks` `SidebarLink` (around line 203) is the one entry with no `<Can permission="...">` wrapper; every other link in the file follows that pattern.
- `frontend/src/features/auth/components/LoginPage.tsx` — `navigate(from, { replace: true })` on success; `from` defaults to `/` when there's no prior location, which is the second place (besides a direct URL hit) that needs the redirect to land correctly.

## Out of scope

- What this story explicitly does **not** cover:
- Any backend/permission-model change — `portal.access` and the rest of the permission set are unchanged.
- Granting or revoking a customer's portal login from the UI (that is STORY (CUST-5) — Portal Access Management, separately planned).
- Any other per-role landing page beyond "portal-only → `/portal`, everyone else → `/` unchanged" — no bespoke landing screen per staff role.
- Removing or redesigning `/tasks` itself — only its sidebar gating consistency is in scope.
