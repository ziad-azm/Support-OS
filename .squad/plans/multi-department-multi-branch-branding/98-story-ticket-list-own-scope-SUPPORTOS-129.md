# Story 98 — Ticket List Scoped to the Caller's Own Department/Branch (Story: SUPPORTOS-129)

## Prerequisites

- **Story 87 (`ORG-1`) implemented:** [87-story-multi-department-SUPPORTOS-112.md](87-story-multi-department-SUPPORTOS-112.md). Verified landed: `apps/core/scoping.py` (`ScopeFilter`, `apply_scope_filters`, `ScopedQuerysetMixin`, `UNSCOPED = "none"`) and `DepartmentQueuePage.tsx`.
- **Story 89 (`ORG-2`) implemented:** [89-story-multi-branch-SUPPORTOS-113.md](89-story-multi-branch-SUPPORTOS-113.md). Verified landed: `TicketViewSet.scope_filters` carries **both** scopes (`backend/apps/tickets/views.py:98-101`) and `BranchQueuePage.tsx`.
- **`TicketListPage` already has department and branch filter `Select`s** — verified, and it changes this story's shape entirely. See `## What discovery changed`.
- **No backend change of any kind.** `ScopeFilter`'s AND-composition already does everything this story needs. `makemigrations --check` must still report "No changes detected".

---

## What discovery changed

Four things were verified against the running code and the seed database before this plan was written. Two of them change what gets built.

### 1. The intake's motivating numbers are exactly right

Verified by querying the dev database directly. `agent1@supportos.local` holds `department_id=6` and `branch_id=6`:

| Scope | Ticket count |
|---|---|
| Department alone | **12** |
| Branch alone | **17** |
| Both (the intersection) | **6** |
| Total tickets in the system | 36 |

The intake's "12 / 17 / 6" is confirmed, not assumed. `DepartmentQueuePage` shows this agent 12 rows, `BranchQueuePage` shows 17, and neither shows the 6 that are actually theirs.

### 2. `TicketListPage` already has the filter UI — so "auto-scope" is a *default*, not a new mechanism

`frontend/src/features/tickets/components/TicketListPage.tsx:61-63` already declares:

```tsx
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
```

…both wired into `useTickets` at lines 85-86 and backed by real `Select`s populated from `useDepartments()`/`useBranches()`. **The page can already send `?department=&branch=` together.** What it cannot do is *start* scoped.

So Task 2 is not "add filtering" — it is **changing two `useState` initial values**. That is the whole implementation, and it lands the intake's option (a) exactly: the params stay available and unrestricted, only the default view changes, and the agent can still widen the filter back to "All departments" through UI that already exists.

### 3. `MyTicketsPage` must NOT be auto-scoped — Task 2 and Task 4 conflict, and Task 4 wins

The intake's Task 2 says to scope *both* lists. Its Task 4 says *"a ticket assigned to an agent is never invisible to them"* and instructs: *"read `apps/sla/tasks.py`/`apps/sla/models.py` before assuming a mismatch does or does not already exist — verify, do not guess."*

Verified, and the intake's own premise for Task 4 is **false in a way that makes the risk worse, not better**. Task 4 states that assignment logic *"already reason[s] about an agent's department/branch when routing a new ticket to them."* It does not. The full path:

- `auto_assign_ticket` (`apps/sla/tasks.py:20-44`) → `resolve_rule` → `pick_agent` → `apply_assignment`.
- `resolve_rule` (`apps/sla/assignment_rules.py:16-28`) matches on **category only**.
- `pick_agent` (`assignment_rules.py:62-80`) intersects `assignable_agents()` with `rule.agents`.
- `assignable_agents()` (`apps/tickets/assignment.py:22-42`) filters on `is_active=True` and holding `tickets.manage`. **Nothing more.**
- `AssignmentRule` (`apps/sla/models.py:79-138`) has fields `category`, `strategy`, `agents`, `last_assigned_agent`, `enabled`. **There is no department or branch field anywhere on it.**

**Assignment is entirely department- and branch-blind.** So an out-of-scope assignment is not a rare drift case that needs `department` to change after the fact — it is the *ordinary* outcome. Auto-scoping "My Tickets" would therefore hide work that is explicitly, deliberately the agent's own, which is precisely the outcome Task 4 forbids.

The seed database does not currently demonstrate the failure only by coincidence: all 7 assigned tickets belong to `ziad@email.com`, who has `department=None, branch=None` and would be unscoped anyway. But the shape is right there in the data — ticket #113 carries `department_id=7`, so assigning it to `agent1` (department 6) would make it vanish from their own queue under an auto-scoped My Tickets.

**Resolution: `MyTicketsPage` is left alone.** "Assigned to me" is already the tightest possible scope — the assignee *is* the filter. Intersecting it with department/branch can only ever subtract the agent's own work, never help them find it. `TicketListPage` — the browse-everything list — is where a sensible default belongs, and it is the list the intake's 12/17/6 evidence is actually about.

### 4. Nothing else links to the two routes being deleted

`grep -rn "tickets/department\|tickets/branch\|DepartmentQueuePage\|BranchQueuePage" frontend/src` returns exactly: the two component files themselves, their two lazy route entries (`router.tsx:191-205`), their two sidebar links (`Sidebar.tsx:254-272`), and two stale docstring references in `shared/auth/types.ts:28,32`. **No other page, redirect, or test links to either route.** The intake's "confirm nothing else links to either route before deleting it" is satisfied — and the two `types.ts` comments must be corrected, not just the code deleted.

---

## The scoping-policy decision (Task 1)

This is the story's key task, and the intake demands an explicit answer rather than one baked silently into a default.

### Option (a) is adopted. This is a default, not an access boundary.

**What ships:** `TicketListPage` initialises its existing `departmentFilter`/`branchFilter` state to the caller's own department/branch id when the caller has that field set. Everything else about the filter is unchanged — the `Select`s still render, still offer "All departments"/"All branches", and still accept any other value.

**What this explicitly is NOT:** an access restriction. Verified: the backend is untouched, `ScopeFilter` remains opt-in, and **any staff account with `tickets.view` can still list every ticket** by clearing the filter in the UI, or by calling `GET /api/tickets/` with no params from anywhere. CONVENTIONS.md § 33's existing line — *"A scope filter is not an access boundary… `?department=`/`?branch=` narrow a list the caller was already authorized to read in full"* — stays true, word for word, after this story.

Option (b) — promoting this to a real access boundary — is **rejected**, for reasons that are worth recording rather than leaving implicit:

1. **It would need backend enforcement, which is a different story.** A frontend default is not a boundary no matter how it is described; making it one means filtering in `TicketViewSet.get_queryset` by `request.user`, which § 33 itself already scopes out: *"Restricting what a staff account may see to its own org unit… needs its own story and its own audit of every report, export, and queue."*
2. **The audit surface is real and unaudited.** Reports (`apps/reports/`), exports, the assignable-agents picker, and every `DataTable` consumer would each need a decision. None has one today.
3. **It would break assignment.** Per finding 3 above, agents are routinely assigned out-of-scope tickets. A hard boundary would make those tickets un-openable, not merely un-listed.

### Who gets the default: **every staff caller who has the field set.** No role check.

The rule is uniform and stated as a single sentence: *if the caller has a department, the department filter starts on it; if the caller has a branch, the branch filter starts on it; otherwise that filter starts on "all".*

Rejected alternative — restricting the default to the `agent` role and exempting `manager`/`super_admin`. Rejected because:

- **A role check would be a second, competing scoping concept** on top of the one § 33 already documents, and this story's whole premise is reusing the existing mechanism rather than adding logic.
- **It is unnecessary in practice.** Verified in seed data: `manager@supportos.local` and `admin@supportos.local` both have `department=None, branch=None`, so they get the unscoped list *from the uniform rule itself*, with no special-casing. An organisation that *does* put its manager in a department has thereby said that manager belongs to it — and the manager can still widen the filter in one click.
- **The oversight concern is fully answered by the filter staying live.** A manager checking another team's queue changes a `Select`; nothing is taken away from them.

Record all of the above in CONVENTIONS.md § 33 (Task 5), which is where every other scoping decision in this codebase already lives.

---

## Story Goal

1. **`TicketListPage` opens pre-filtered to the caller's own department and branch** — the intersection, via `ScopeFilter`'s existing AND-composition. An agent with both set sees **6** rows on first load, not 12 and not 17.
2. **The filter remains fully usable.** "All departments"/"All branches" are one click away, for anyone.
3. **`MyTicketsPage` is unchanged** — deliberately, per `## What discovery changed` finding 3.
4. **`DepartmentQueuePage` and `BranchQueuePage` are deleted** along with their routes, sidebar links and locale keys.
5. **The decision is written down** in CONVENTIONS.md § 33.

**Explicitly out of scope:**

- **Any backend change.** No model, no migration, no serializer, no viewset, no permission. `ScopeFilter` already composes with AND.
- **Auto-scoping `MyTicketsPage`.** See finding 3 — this is a deliberate reversal of the intake's Task 2, and the reason is recorded.
- **Making scoping a real access boundary.** Option (b), rejected above with reasons.
- **Adding department/branch awareness to assignment.** Finding 3 establishes it is absent; fixing that is a genuine gap but a separate story (`AssignmentRule` would need new fields, a migration, and an admin UI). Named here so it is not mistaken for something this story did.
- **Persisting the filter choice** across sessions or in the URL. The default is computed per mount from `useAuth()`.

---

## Context — Read These Files First

1. `frontend/src/features/tickets/components/TicketListPage.tsx` — **the only page this story modifies.** Read lines 51-64 (the `useState` block: `searchInput`, `search`, `categoryFilter`, `priorityFilter`, then **`departmentFilter`/`branchFilter` at 61-63** with their two-sentinel comment, and `onlyMine`), lines 66-67 (`useDepartments()`/`useBranches()`), line 78 (the `setPage(1)` effect's dependency array — it already lists both filters), and lines 80-88 (the `useTickets` call, with `department`/`branch` spread in conditionally at 85-86 **only when the value is not `'all'`**). Note the comment at 58-60: `'none'` is passed through verbatim as the backend's `UNSCOPED` sentinel and needs no client-side translation.
2. `frontend/src/shared/auth/types.ts` — read lines 26-35. `AuthUser.department: AuthDepartment | null` and `AuthUser.branch: AuthBranch | null`. **Both docstrings currently say "Drives `/tickets/department`" / "Drives `/tickets/branch` and the sidebar link to it"** — those routes cease to exist in Task 3, so both comments are corrected there.
3. `backend/apps/core/scoping.py` — all ~110 lines. `apply_scope_filters` (lines ~57-80) loops the scopes and chains `.filter()` per param — **that chaining is the AND-composition this story relies on and is why no backend change is needed.** Note the contract: absent/empty → no filter; numeric → `filter(<field>_id=…)`; `"none"` → `filter(<field>__isnull=True)`; anything else → 400.
4. `backend/apps/tickets/views.py` — read lines 98-101 (`scope_filters` carrying **both** `ScopeFilter(param="department", …)` and `ScopeFilter(param="branch", …)`) and lines 152-156 (`assigned_to_me` parsing → `queryset.filter(assigned_agent=self.request.user)`). **Read only; nothing in this file changes.**
5. `backend/apps/sla/assignment_rules.py` — all ~80 lines. `resolve_rule` (category only) and `pick_agent` (`assignable_agents()` ∩ `rule.agents`). **This is the file that proves finding 3** — read it before touching `MyTicketsPage`, and you will not touch `MyTicketsPage`.
6. `backend/apps/tickets/assignment.py` — read lines 22-42 (`assignable_agents()`: `is_active=True` + holds `tickets.manage`, and nothing else). The second half of finding 3's proof.
7. `backend/apps/sla/models.py` — read lines 79-138 (`AssignmentRule`). Confirm for yourself that `category`/`strategy`/`agents`/`last_assigned_agent`/`enabled` is the entire field list and **there is no department or branch**.
8. `frontend/src/features/tickets/components/DepartmentQueuePage.tsx` (~170 lines) and `BranchQueuePage.tsx` — **both deleted in Task 3.** Read `DepartmentQueuePage`'s docstring (lines 26-33) and its `enabled: departmentId !== undefined` guard (line ~64) to understand what capability is being retired: a single-dimension list that fires no query when the caller has no department.
9. `frontend/src/features/tickets/components/MyTicketsPage.tsx` — read lines 37-59 (the `useTickets` call with `assigned_to_me: 'true'` fixed, plus status/priority). **Read to confirm you are leaving it alone.** Note its docstring at 26-35 explaining `assigned_to_me` is fixed here, not a toggle.
10. `frontend/src/app/router.tsx` — read lines 188-207: the two lazy route entries for `tickets/department` and `tickets/branch`, including the comment at ~199-200 about declaration order relative to `tickets/department`. Both entries are removed in Task 3.
11. `frontend/src/app/Sidebar.tsx` — read lines 248-273: `/tickets/my-tickets` (stays), then the `{user?.department ? … }` block for `/tickets/department` and the `{user?.branch ? … }` block for `/tickets/branch`, including the comment at ~263-265 explaining why `MapPinIcon` differs from `Building2Icon`. Both conditional blocks are removed. **Check afterwards whether `Building2Icon`/`MapPinIcon` are still used elsewhere in the file before removing their imports.**
12. `frontend/src/features/tickets/locales/en.json` and `ar.json` — the `departmentQueue` block (keys: `title`, `empty`, `emptyDescription`, `noDepartment`, `noDepartmentDescription`) and the `branchQueue` block (`title`, `empty`, `emptyDescription`, `noBranch`, `noBranchDescription`). **Both blocks are deleted.** The `filters` block (`department`, `branch`, `allDepartments`, `allBranches`, …) and the `myQueue` block **stay** — they belong to `TicketListPage`/`MyTicketsPage`.
13. `CONVENTIONS.md` — § 33 at line 2313. Read to its end at ~2394, especially the closing paragraph **"A scope filter is not an access boundary"** (lines 2388-2394), which this story must leave true and must explicitly reaffirm. The new subsection goes after it, before `## 34.` at line 2397. Also § 16 (**this project does not author automated tests**).
14. `frontend/src/shared/departments/` and `frontend/src/shared/branches/` — the `useDepartments()`/`useBranches()` hooks `TicketListPage` already calls. **No change**; read only to confirm the option lists the `Select`s render are independent of this story's default.

---

## Frontend Tasks

### 1 — Default `TicketListPage`'s two filters to the caller's own scope

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`**

Add `useAuth` to the imports (`import { useAuth } from '@/shared/auth'` — check the existing import block first; `TicketListPage` does **not** import it today, unlike `DepartmentQueuePage`).

Replace the two `useState` declarations at lines 61-63 with initialisers derived from the caller:

```tsx
  const { user } = useAuth()
  // ORG-4: these two filters START on the caller's own department/branch
  // instead of 'all', so the default view is the INTERSECTION of both —
  // `apply_scope_filters` chains a `.filter()` per param, so sending both
  // ANDs them (CONVENTIONS.md §33). An agent holding department 6 and
  // branch 6 sees the 6 tickets that are actually theirs, not the 12 in
  // their department or the 17 in their branch.
  //
  // A DEFAULT, NOT A BOUNDARY. The `Select`s below still offer "All
  // departments"/"All branches", and the backend is untouched — any
  // caller with `tickets.view` can still list everything, exactly as
  // §33's "a scope filter is not an access boundary" paragraph says.
  // Uniform across roles by design: a manager with no department set
  // gets 'all' from this same rule, with no role check. See §33's
  // "Default list scope (ORG-4)" subsection for the full decision.
  const [departmentFilter, setDepartmentFilter] = useState(
    user?.department ? String(user.department.id) : 'all',
  )
  const [branchFilter, setBranchFilter] = useState(user?.branch ? String(user.branch.id) : 'all',)
```

> Format that last line as Prettier wants it — run `npm run format` and let it decide; do not hand-wrap.

**Nothing else in this file changes.** Specifically:

- The `useTickets` call at 80-88 is **untouched** — it already spreads `department`/`branch` in whenever the value is not `'all'`, so a non-`'all'` initial value flows through with no edit.
- The `setPage(1)` effect at line 78 is **untouched** — it already depends on both filters.
- The `Select`s are **untouched** — they render `value={departmentFilter}` and will simply open showing the caller's own department.

**Why `useState` initialiser and not `useEffect`:** the value is known on first render (`useAuth()` is synchronous from context), so an effect would render one frame of the unscoped list and then refetch — a visible flash and a wasted request.

### 2 — `MyTicketsPage`: no change, and say why

**File: `frontend/src/features/tickets/components/MyTicketsPage.tsx`**

**Do not add department/branch scoping.** Add one paragraph to the existing docstring recording the decision, so the next reader does not "finish the job":

```
 * DELIBERATELY NOT scoped to the caller's own department/branch (ORG-4,
 * Story 98). "Assigned to me" is already the tightest scope there is —
 * the assignee IS the filter — so intersecting it with department/branch
 * could only ever subtract the agent's own work. And it would: assignment
 * is entirely department/branch-blind (`apps/sla/assignment_rules.py`
 * matches on category, then `assignable_agents()` filters on
 * `tickets.manage` alone — `AssignmentRule` has no department or branch
 * field at all), so an agent is routinely assigned tickets outside their
 * own org units. Scoping this list would make that work invisible on the
 * one screen whose entire job is to show it.
```

### 3 — Delete both queue pages and everything that reaches them

**Delete:**
- `frontend/src/features/tickets/components/DepartmentQueuePage.tsx`
- `frontend/src/features/tickets/components/BranchQueuePage.tsx`

**File: `frontend/src/app/router.tsx`** — remove both lazy route entries (`tickets/department` at ~191-197 and `tickets/branch` at ~198-206), including the comment above `tickets/branch` that only exists to explain its ordering relative to the route being deleted alongside it.

**File: `frontend/src/app/Sidebar.tsx`** — remove both `{user?.department ? … }` and `{user?.branch ? … }` blocks (lines ~254-272), including the `MapPinIcon` explanatory comment between them. Then **check whether `Building2Icon` and `MapPinIcon` are still referenced elsewhere in the file** — `Building2Icon` is also used by the `/settings/departments` link and `MapPinIcon` by `/settings/branches`, so both imports most likely stay. Verify by grep rather than deleting on assumption; `tsc -b` catches an unused import as an error under this project's config.

**Files: `frontend/src/features/tickets/locales/{en,ar}.json`** — delete the whole `departmentQueue` and `branchQueue` blocks from both. **Keep `myQueue`** and **keep the entire `filters` block** (`department`, `branch`, `allDepartments`, `allBranches` are `TicketListPage`'s, not the queue pages').

**File: `frontend/src/shared/auth/types.ts`** — correct both now-false docstrings at lines ~26-35. `department` no longer "Drives `/tickets/department` and the sidebar link to it"; it now drives `TicketListPage`'s default department filter (ORG-4). Same for `branch`.

**Then verify nothing dangles:** `grep -rn "tickets/department\|tickets/branch\|DepartmentQueuePage\|BranchQueuePage\|departmentQueue\|branchQueue" frontend/src` must return **zero** hits.

---

## Documentation Task

### 4 — Record the decision in CONVENTIONS.md § 33

**File: `CONVENTIONS.md`**

Add a `### Default list scope (ORG-4, Story 98)` subsection at the end of § 33 — **after** the existing "A scope filter is not an access boundary" paragraph (lines 2388-2394) and before `## 34.` (line 2397). Placing it after that paragraph is deliberate: the new text must read as a refinement of that rule, never as a replacement for it.

Cover, one short paragraph each:

- **The rule.** `TicketListPage` initialises its department/branch filters to the caller's own values when set, otherwise `'all'`. Uniform across every staff role — no role check — because a caller with no department/branch gets `'all'` from the same rule, which is why `manager`/`super_admin` (neither has org units set in seed) need no special case.
- **It is a default, not a boundary.** State plainly that the backend is unchanged, `ScopeFilter` remains opt-in, the `Select`s still offer "All", and any `tickets.view` holder can still list everything. **Explicitly reaffirm** that the preceding paragraph's rule still holds in full.
- **Why option (b) was rejected** — a real boundary needs backend enforcement plus an audit of every report, export and queue, which § 33 already scopes to its own story; and it would make routinely out-of-scope *assigned* tickets un-openable.
- **Why `MyTicketsPage` is exempt** — with the verified fact that assignment is department/branch-blind (`AssignmentRule` has no such fields; `assignable_agents()` filters on `tickets.manage` alone), so scoping it would hide the agent's own assigned work.
- **The retired screens** — `DepartmentQueuePage`/`BranchQueuePage` are gone; they could only ever show a single dimension (12 or 17 of this seed's tickets), never the intersection (6).

---

## Edge Cases & Failure Modes

- **Caller has neither department nor branch** (`agent2@supportos.local`, `manager@`, `admin@` in seed). Both filters initialise to `'all'`, `useTickets` spreads neither param, and the list is **exactly today's unscoped list** — the intake's stated requirement for this case, satisfied by construction rather than by a branch.
- **Caller has only a department** (or only a branch). Only that filter initialises to an id; the other stays `'all'` and its param is not sent. Scoped by one dimension, as required.
- **Caller's department was deleted after assignment.** `User.department` is `SET_NULL` (§ 33), so `user.department` becomes `null` and the filter falls back to `'all'`. The list widens rather than breaking — no `?department=undefined` is ever sent, because the initialiser tests `user?.department` before reading `.id`.
- **`useAuth()` returns `user === null`** — possible for one render during `AuthProvider`'s boot. `user?.department` short-circuits to `'all'`, so the first query is unscoped. **This is a real, visible behaviour**: on a cold load the list can paint unscoped for one frame before `user` resolves. Verified acceptable because `TicketListPage` sits behind `RequireAuth`, which renders `<Loading />` until `status !== 'loading'` — so the page does not mount until `user` is populated. **Confirm this at Verification step 6** rather than trusting it.
- **The agent widens the filter to "All departments".** Fully supported and intended — that is what makes this a default rather than a boundary. The `Select` already handles it; no code path is special-cased.
- **The agent picks "No department" (`'none'`).** Already supported: `'none'` is passed through verbatim as `apply_scope_filters`'s `UNSCOPED` sentinel (the comment at `TicketListPage.tsx:58-60` records this), yielding `department__isnull=True`. Unchanged by this story.
- **A ticket assigned to the agent falls outside their department/branch.** It disappears from `TicketListPage`'s *default* view — correct and intended, that list is a browse surface — but remains fully visible on **My Tickets**, which this story deliberately leaves unscoped, and remains openable at `/tickets/:id`, which is never scoped (`ScopedQuerysetMixin.scoped_actions = ("list",)` — detail routes are explicitly excluded). **This is the exact guarantee Task 4 asks for**, and it holds because of what this story does *not* do.
- **A deleted route is still bookmarked** (`/tickets/department`). Falls through to the router's existing `path: '*'` catch-all → `NotFoundPage`. No redirect is added: these were role-conditional links that only ever appeared in the sidebar, and a redirect to a list that now defaults to the same scope would be indistinguishable from the 404 for anyone who did not bookmark it.
- **Deleting the locale blocks breaks an `en`/`ar` parity check.** Both blocks must be removed from **both** files in the same change (CONVENTIONS.md § 18). Verification step 5 checks parity by flattened set-difference.
- **An unused icon import after the sidebar edit.** `tsc -b` fails the build on it under this project's config — compile-time-caught, not a runtime risk. Both icons are expected to survive (used by the `/settings/*` links); verify by grep, do not delete on assumption.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md § 16: *"Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."*

**No test file is added, modified, or removed.** Verification is `## Verification Steps` below.

---

## Migration / Rollback

**No backend change, so no migration and no deploy ordering.** `makemigrations --check` must report "No changes detected" — Verification step 1. This ships as one frontend bundle with no API contract change; the backend is bit-identical before and after.

**Rollback is `git revert` of the single commit.** Nothing is persisted: the filter default is computed per mount from `useAuth()`, not stored in `localStorage`, the URL, or the database. Reverting restores the unscoped default and both deleted pages with no data migration.

**The one destructive item is the two deleted screens.** `DepartmentQueuePage.tsx` and `BranchQueuePage.tsx` are removed outright, not deprecated. That is deliberate — leaving them would keep two screens that, by this story's own evidence, can only ever show an agent the wrong count. A revert restores both files, their routes, their sidebar links and their locale keys together, since all four live in the same commit.

---

## Verification Steps

1. **Backend untouched:** `git status --short backend/` is empty, and in `backend/`, `python manage.py makemigrations --check --dry-run` reports **"No changes detected"**.
2. **Frontend gates:** in `frontend/`, `npx tsc -b` (the project has **no** `typecheck` script — `build` runs `tsc -b`), `npm run lint`, `npm run check:rtl`, `npm run format:check`, and `npx vite build` all pass.
3. **Nothing dangles:** `grep -rn "tickets/department\|tickets/branch\|DepartmentQueuePage\|BranchQueuePage\|departmentQueue\|branchQueue" frontend/src` returns **zero** hits.
4. **The two files are gone:** `ls frontend/src/features/tickets/components/` shows neither `DepartmentQueuePage.tsx` nor `BranchQueuePage.tsx`.
5. **Locale parity:** the `departmentQueue`/`branchQueue` blocks are absent from **both** `en.json` and `ar.json`, `myQueue` and the whole `filters` block survive in both, and a flattened set-difference of the two files is empty in both directions.
6. **The headline behaviour — the 12/17/6 check.** Sign in as `agent1@supportos.local` (department 6, branch 6) and open `/tickets`. The department `Select` shows that agent's own department, the branch `Select` shows their own branch, and **the table shows 6 rows** — not 12, not 17. Confirm in DevTools' Network tab that the very first `/api/tickets/` request already carries **both** `department=` and `branch=`; there must be **no** initial unscoped request followed by a scoped one.
7. **The filter still widens.** On the same page, set the department `Select` to "All departments" — the count rises to 17 (branch-only). Set branch to "All branches" too — it rises to 36 (everything). This is the proof that the default is not a boundary.
8. **The unscoped caller is unaffected.** Sign in as `manager@supportos.local` (no department, no branch). `/tickets` opens with both `Select`s on "All", the first request carries neither param, and all 36 tickets list — byte-for-byte today's behaviour.
9. **Assigned tickets stay visible — Task 4's guarantee.** Assign a ticket whose department is **not** the agent's (seed ticket #113 has `department_id=7`) to `agent1`, then sign in as `agent1`: it does **not** appear in `/tickets`'s default view (correct — that list is scoped), it **does** appear in `/tickets/my-tickets` (the list this story deliberately left unscoped), and `/tickets/113` opens normally. All three must hold.
10. **Sidebar and routes:** the sidebar shows "Tickets" and "My Tickets" and **no** "Department queue"/"Branch queue" entries for any account. Navigating directly to `/tickets/department` renders the 404 page, not a crash.
11. **RTL and the untouched page:** switch to Arabic — `/tickets` renders correctly with the pre-set filters, and `/tickets/my-tickets` is visually and behaviourally identical to before this story.
12. **The decision is discoverable:** `grep -n "Default list scope" CONVENTIONS.md` returns a hit, and § 33's original "A scope filter is not an access boundary" paragraph is **still present and unedited**.

---

## Done Criteria

- [ ] `TicketListPage` opens with its existing department/branch `Select`s pre-set to the caller's own values, sending both params on the **first** request; an agent with both set sees the **intersection** (6 in seed), never 12 or 17.
- [ ] A caller with only one field set is scoped by that one; a caller with neither gets today's unscoped list, unchanged.
- [ ] The filters remain fully changeable — "All departments"/"All branches" still work for every role, and **the backend is byte-identical** (no model, migration, serializer, viewset or permission change).
- [ ] **`MyTicketsPage` is unchanged apart from a docstring**, and the reason — assignment is verifiably department/branch-blind, so scoping it would hide the agent's own assigned work — is recorded in that docstring and in § 33.
- [ ] A ticket assigned to an agent is visible to them on **My Tickets** and at `/tickets/:id` regardless of its department/branch — Task 4's stated outcome, verified with a real out-of-scope assignment.
- [ ] `DepartmentQueuePage.tsx`, `BranchQueuePage.tsx`, their two routes, their two sidebar links, and their `departmentQueue`/`branchQueue` locale blocks are all deleted; `grep` for any of them returns zero hits; `myQueue` and `filters` survive.
- [ ] The two now-false `AuthUser.department`/`AuthUser.branch` docstrings in `shared/auth/types.ts` are corrected.
- [ ] CONVENTIONS.md § 33 gains a "Default list scope (ORG-4)" subsection recording: the uniform no-role-check rule, that this is a **default and not an access boundary**, why option (b) was rejected, why `MyTicketsPage` is exempt, and what the two retired screens could never do. The existing "A scope filter is not an access boundary" paragraph is left **intact**.
- [ ] Every `en` key has an `ar` counterpart after the deletions, verified by flattened set-difference.
- [ ] `npx tsc -b`, `npm run lint`, `npm run check:rtl`, `npm run format:check`, `npx vite build`, and `makemigrations --check` all pass.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md § 16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to the next story.**
