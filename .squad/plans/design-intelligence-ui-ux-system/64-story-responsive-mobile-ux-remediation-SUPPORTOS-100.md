# Story 64 — (DSN-9) Responsive & Mobile UX Remediation (Story: SUPPORTOS-100)

## Prerequisites

- **`DSN-5` (Story 51) and `DSN-6` (Story 61) are complete.** `design-system/supportos/UX-AUDIT.md` exists with 66 rows; this story consumes the 5 rows whose **Category** column is `responsive` (fixed mapping: `responsive`→`DSN-9`): `UX-008, UX-014, UX-021, UX-064, UX-065`.
- **Two gaps beyond the register's 5 rows are verified during planning and logged as new findings** (`UX-067`, `UX-068`), matching the precedent `DSN-7`'s `UX-066` and `DSN-8`'s `useBlocker` fix set — the intake's own two named tasks ("shared DataTable small-screen presentation," "fix page-shell overflow") are broader than what `DSN-6`'s original walk caught:
  - **`UX-067` (new): the staff shell has no mobile-aware default.** `frontend/src/app/RootLayout.tsx` renders `<Sidebar />` as a fixed-width flex sibling of `<main className="flex-1 overflow-x-hidden ...">`; `Sidebar.tsx`'s `readCollapsed()` (lines 36-42) defaults to `false` (expanded, `w-56` = 224px) whenever `localStorage` has no stored preference — i.e., every first-time visit, on every device. At a 375px viewport this leaves `main` roughly 119px wide after its own `px-4` padding — genuinely unusable, not just cramped. This was not in `DSN-6`'s original 66-row walk (no audit agent checked the shell's *default* state on first load, only its general structure).
  - **`UX-068` (new): `DataTable` has no small-screen column strategy beyond the already-compliant horizontal scroll.** `table.tsx:10`'s `overflow-x-auto` wrapper is genuinely compliant per `DSN-2`'s prior audit (`CONVENTIONS.md:1586`, "Wide tables get a horizontal-scroll wrapper... on mobile") — this is not reopened or reversed. But the intake's own Task 1 asks for more: "a small-screen presentation (stacked/card **or prioritized columns**)." No `ColumnDef` mechanism exists today to hide lower-priority columns at narrow widths, which the intake names as an acceptable alternative to a full card rewrite.
- **`UX-021`'s literal recommended fix is corrected during planning, not implemented as written.** The register says "standardize on one detail-list component/pattern (`grid-cols-1 sm:grid-cols-2`) reused by all three" (`TicketDetailPage.tsx:89`, `TicketSlaSection.tsx:40`, `CustomerContextPanel.tsx`). Verified via `TicketDetailPage.tsx:80`: the page is `grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start` — `TicketDetailPage.tsx:89`'s own `dl` and `TicketSlaSection` (rendered at `TicketDetailPage.tsx:194`) both sit in the **wide** `2fr` first column, but `CustomerContextPanel` (rendered at `TicketDetailPage.tsx:199`) is the **narrow** `minmax(280px,1fr)` side column — its own file comment (`CustomerContextPanel.tsx:127`, "keeps a long reply from dominating the narrow panel") confirms it. Tailwind's `sm:` breakpoint is viewport-width-based, not container-width-based — applying `sm:grid-cols-2` to `CustomerContextPanel`'s `dl` would switch it to 2 columns at any ≥640px **viewport**, even though its own container can be as narrow as 280px, actively cramping it. `CustomerContextPanel.tsx`'s existing `flex flex-col` (always stacked) is correct for its context and is **not** touched. Only the two main-column `dl`s are converged.
- **Dialog/alert-dialog primitives are already responsive — verified, not assumed.** `frontend/src/shared/ui/primitives/dialog.tsx:65`: `w-full max-w-[calc(100%-2rem)] ... sm:max-w-lg` — always fits within the viewport minus a 2rem margin on any screen size. No register finding flags a dialog gap; none is added.
- **Touch-target sizing is already verified compliant by `DSN-2`.** `CONVENTIONS.md:1617`: "touch target size (`icon-xs` = 24px, meets WCAG 2.2's minimum exactly)." No new gap found during this story's own re-check of `button.tsx`'s size scale; no primitive touched.
- **No chart-responsive gap exists.** `grep -rn "width:|height:|w-\[|h-\[" frontend/src/shared/ui/chart` returns nothing — no hardcoded pixel width/height anywhere in the chart wrapper components. Intake Task 2's "chart placeholders" phrase names a category to check, not a confirmed defect; none was found.

---

## Story Goal

Resolve the 5 `responsive`-category register rows, plus 2 newly-discovered gaps (`UX-067`, `UX-068`) that directly implement the intake's own two named tasks. Every fix lands at the shared-component or single-file level per the `DSN-6`–`DSN-13` guardrail (frontend-only, styling/layout only, no data-flow changes).

**Disposition table:**

| ID | Severity | Disposition |
|---|---|---|
| `UX-008` | major | Fixed — `ChatPane`'s fixed `32rem` height replaced with a viewport-relative cap |
| `UX-014` | minor | Fixed — `CustomerProfilePage`'s `dl` stacks below `sm:` |
| `UX-021` | minor | Fixed with a corrected scope — `TicketDetailPage`/`TicketSlaSection` `dl`s stack below `sm:`; `CustomerContextPanel` deliberately left unchanged (already correct for its narrow-panel context) |
| `UX-064` | minor | Fixed — `PortalMarkdownPreview`'s rendered markdown tables get an `overflow-x-auto` wrapper |
| `UX-065` | minor | Fixed — `PortalTicketDetailPage`'s `dl` stacks below `sm:` |
| `UX-067` (new) | major | Fixed — `Sidebar` defaults to collapsed (icon-only) on first visit at narrow viewports; an explicit user preference is never overridden |
| `UX-068` (new) | major | Fixed — `ColumnDef` gains an opt-in `priority: 'sm'` field; `DataTable` hides those columns below `sm:`; applied to the 5 densest/most mobile-relevant list screens |

**Scope decision on `UX-068` (recorded, not silently narrowed):** the `priority` mechanism is implemented as a shared, opt-in `DataTable`/`ColumnDef` capability — every list screen inherits the capability, per the intake's "shared-pattern level so all lists inherit it." It is applied concretely to 5 of the 13 `DataTable` consumers: `TicketListPage` (7 columns), `MyTicketsPage` (6), `CustomerListPage` (5), `PortalTicketListPage` (6), `PortalTicketHistoryPage` (6) — the densest staff tables and the portal's ticket lists (the portal is independently confirmed the surface most likely used on a phone, per `UX-065`'s own reasoning). The remaining 7 consumers (`RoleListPage`, `CategoryListPage`, `UserListPage`, `AuditLogListPage`, `FaqListPage`, `ArticleListPage`, `TaskListPage`) keep the existing, already-compliant horizontal-scroll fallback — none is left broken, and any of them can adopt `priority` later with no further shared-component work.

**Not in scope:** anything outside these 7 rows; a full card/stacked-row `DataTable` rewrite (the intake itself offers "prioritized columns" as an equally valid alternative, chosen here as the lower-risk, more surgical option); any backend/API change.

---

## Context — Read These Files First

1. `design-system/supportos/UX-AUDIT.md` — the 5 `responsive` rows this story implements, plus this story's own task 7 adds `UX-067`/`UX-068`.
2. `SupportOs backlog.MD` lines 556, 584-590 (guardrail + `DSN-9` story text).
3. `frontend/src/app/RootLayout.tsx` (16 lines, full file) and `frontend/src/app/Sidebar.tsx` lines 34-42 (`readCollapsed`) — task 1's edit site.
4. `frontend/src/shared/ui/data-table/types.ts` (25 lines, full file) and `frontend/src/shared/ui/data-table/DataTable.tsx` (174 lines, full file, specifically lines 75-80's header-cell `className` and lines 156-162's body-cell `className`) — task 2's edit site.
5. `frontend/src/features/tickets/components/TicketListPage.tsx` lines 76-129 (`columns`), `frontend/src/features/tickets/components/MyTicketsPage.tsx` lines 60-101, `frontend/src/features/customers/components/CustomerListPage.tsx` lines 52-83, `frontend/src/features/portal/components/PortalTicketListPage.tsx` lines 54-97, `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx` lines 39-77 — tasks 3-7's 5 edit sites.
6. `frontend/src/features/live-chat/components/LiveChatWidget.tsx` line 182 (`ChatPane`'s `Card`) and `frontend/src/app/PublicLayout.tsx` (confirm its container doesn't already scroll) — task 8's edit site.
7. `frontend/src/features/customers/components/CustomerProfilePage.tsx` line 61 — task 9's edit site.
8. `frontend/src/features/tickets/components/TicketDetailPage.tsx` lines 80, 89 and `frontend/src/features/tickets/components/TicketSlaSection.tsx` line 40 — task 10's two edit sites; `frontend/src/features/tickets/components/CustomerContextPanel.tsx` lines 23-57 (confirms the narrow-side-panel context that keeps it unchanged).
9. `frontend/src/features/portal/components/PortalMarkdownPreview.tsx` (confirm exact structure before wrapping) — task 11's edit site.
10. `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` line 45 — task 12's edit site.

---

## Frontend Tasks

### 1 — `Sidebar` defaults to collapsed on a narrow first visit (`UX-067`)

**File: `frontend/src/app/Sidebar.tsx`** lines 36-42 — `readCollapsed()` currently returns `false` whenever nothing is stored. Only fall back to a viewport check when there is genuinely no stored preference — an explicit prior choice (expanded or collapsed) is never overridden:

```tsx
function readCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (stored !== null) return stored === 'true'
  } catch {
    // Fall through to the viewport check below.
  }
  // No stored preference yet (first visit, or storage blocked) — default to
  // collapsed on narrow viewports so the sidebar doesn't eat most of a
  // phone's width before the user ever gets to toggle it themselves.
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
}
```

No change to `toggleCollapsed()`, `SidebarLink`, or any other part of the file — once collapsed (by this default or a manual toggle), every existing `collapsed ? ... : ...` branch (icon-only width, hidden labels, `aria-label`/`title` on links) already behaves correctly; this task only changes the *initial* value.

---

### 2 — `ColumnDef` gains an opt-in `priority` field; `DataTable` hides low-priority columns below `sm:` (`UX-068`)

**File: `frontend/src/shared/ui/data-table/types.ts`** — add one optional field to `ColumnDef`:

```ts
export type ColumnDef<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortable?: boolean
  align?: 'start' | 'end'
  /** Hide this column below the `sm` breakpoint (640px). Omit (default:
   *  always visible) for columns essential at every width. Purely a
   *  presentation hint — the column's data is still in `query.data`,
   *  still exportable, still reachable via the row's own detail page. */
  priority?: 'always' | 'sm'
}
```

**File: `frontend/src/shared/ui/data-table/DataTable.tsx`** — apply the same conditional class to both the header cell (lines ~75-80) and the body cell (lines ~156-162):

```tsx
<TableHead
  key={column.id}
  aria-sort={column.sortable ? sortAria(column.id, sort) : undefined}
  className={cn(
    column.align === 'end' && 'text-end',
    column.priority === 'sm' && 'hidden sm:table-cell',
  )}
>
```

```tsx
<TableCell
  key={column.id}
  className={cn(
    column.align === 'end' && 'text-end',
    column.priority === 'sm' && 'hidden sm:table-cell',
  )}
>
```

Import `cn` from `@/shared/lib/cn` (not currently imported in `DataTable.tsx` — check before adding a duplicate import) and replace the existing `className={column.align === 'end' ? 'text-end' : undefined}` ternaries with the `cn(...)` calls above. `hidden sm:table-cell` uses no physical-direction utility — `npm run check:rtl` must still report zero violations.

---

### 3 — `TicketListPage` column priority

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`** lines 76-129 — add `priority: 'sm'` to the `category_name` (lines 90-97) and `created_at` (lines 123-128) column definitions. `subject`, `customer_name`, `assigned_agent_name`, `status`, `priority` stay always-visible — the core triage fields.

---

### 4 — `MyTicketsPage` column priority

**File: `frontend/src/features/tickets/components/MyTicketsPage.tsx`** lines 60-101 — add `priority: 'sm'` to `category_name` and `created_at`. `subject`, `customer_name`, `status`, `priority` stay always-visible.

---

### 5 — `CustomerListPage` column priority

**File: `frontend/src/features/customers/components/CustomerListPage.tsx`** lines 52-83 — add `priority: 'sm'` to `company` and `created_at`. `name`, `email`, `phone` stay always-visible.

---

### 6 — `PortalTicketListPage` column priority

**File: `frontend/src/features/portal/components/PortalTicketListPage.tsx`** lines 54-97 — add `priority: 'sm'` to `category_name` and `assigned_agent_name`. `subject`, `status`, `priority`, `created_at` stay always-visible.

---

### 7 — `PortalTicketHistoryPage` column priority

**File: `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx`** lines 39-77 — add `priority: 'sm'` to `category_name` and `assigned_agent_name`. `subject`, `priority`, `created_at`, `updated_at` stay always-visible.

---

### 8 — `ChatPane`'s fixed height becomes viewport-relative (`UX-008`)

**File: `frontend/src/features/live-chat/components/LiveChatWidget.tsx`** line 182 — replace the hardcoded inline style:

```diff
- <Card className="flex w-full max-w-sm flex-col" style={{ height: '32rem' }}>
+ <Card className="flex h-[min(32rem,calc(100dvh-3rem))] w-full max-w-sm flex-col">
```

Caps the card at `32rem` on tall viewports (unchanged from today) but shrinks to fit on short ones (`100dvh` minus a `3rem` margin), so the card never exceeds the visible viewport height. No change to `PublicLayout.tsx` — the card now fits inside its existing centered container at any height.

---

### 9 — `CustomerProfilePage`'s field `dl` stacks on narrow viewports (`UX-014`)

**File: `frontend/src/features/customers/components/CustomerProfilePage.tsx`** line 61:

```diff
- <dl className="grid grid-cols-2 gap-4">
+ <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

---

### 10 — `TicketDetailPage`/`TicketSlaSection` field `dl`s stack on narrow viewports (`UX-021`, corrected scope)

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** line 89:

```diff
- <dl className="grid grid-cols-2 gap-4">
+ <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

**File: `frontend/src/features/tickets/components/TicketSlaSection.tsx`** line 40 — identical change.

**`CustomerContextPanel.tsx` is not touched** — see `## Prerequisites`.

---

### 11 — Markdown tables in the portal article reader scroll instead of overflowing (`UX-064`)

**File: `frontend/src/features/portal/components/PortalMarkdownPreview.tsx`** — read the file's current structure first; wrap the rendered output in an `overflow-x-auto` container so a wide markdown table scrolls within its own bounds rather than overflowing the 375px viewport:

```tsx
<div className="prose prose-sm overflow-x-auto">
  <Markdown>{children}</Markdown>
</div>
```

Adjust to match the file's actual current wrapper element and prop names (confirmed via `## Context` before editing) — the fix is adding `overflow-x-auto` to whatever element already carries `prose prose-sm`, not introducing a new wrapper element if one already exists.

---

### 12 — `PortalTicketDetailPage`'s field `dl` stacks on narrow viewports (`UX-065`)

**File: `frontend/src/features/portal/components/PortalTicketDetailPage.tsx`** line 45:

```diff
- <dl className="grid grid-cols-2 gap-4">
+ <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

---

### 13 — Register bookkeeping

**File: `design-system/supportos/UX-AUDIT.md`** — set Status for the 5 existing `responsive` rows to `Resolved (Story 64)` (`UX-021` gets the note "corrected scope — `CustomerContextPanel.tsx` deliberately unchanged, see reasoning" appended to its Finding column). Append two new rows after `UX-066`:

```markdown
| UX-067 | Shell — `frontend/src/app/RootLayout.tsx` + `Sidebar.tsx:36-42` | responsive | major | Discovered during Story 64 (`DSN-9`) planning, not by `DSN-6`'s original walk: `readCollapsed()` defaults to `false` (expanded, `w-56`/224px) whenever no preference is stored — every first-time visit on every device. At 375px this leaves `main` ~119px wide after padding. | Default to collapsed on narrow viewports (`matchMedia('(max-width: 639px)')`) only when no stored preference exists; never override an explicit user choice. | DSN-9 | Resolved (Story 64) |
| UX-068 | Shell — `frontend/src/shared/ui/data-table/{types,DataTable}.tsx` | responsive | major | Discovered during Story 64 (`DSN-9`) planning: `table.tsx`'s `overflow-x-auto` (confirmed compliant by `DSN-2`) is the only small-screen behavior `DataTable` has — no column-priority/stacking mechanism exists, which the `DSN-9` intake's own Task 1 names as an acceptable alternative to a full card rewrite. | Add an opt-in `ColumnDef.priority: 'sm'` field; `DataTable` hides those columns below `sm:`. Applied to `TicketListPage`/`MyTicketsPage`/`CustomerListPage`/`PortalTicketListPage`/`PortalTicketHistoryPage`; the other 7 `DataTable` consumers keep the existing horizontal-scroll fallback. | DSN-9 | Resolved (Story 64) |
```

Update the header summary (`**Totals: 66 findings**...`) to `**Totals: 68 findings**` with the new severity/owning-story tallies (`DSN-9` goes from 5 to 7; 2 more `major`), and add a `**Story 64 (DSN-9)...**` line matching `DSN-7`/`DSN-8`'s own summary-line format.

---

## Edge Cases & Failure Modes

- **`UX-067`'s `matchMedia` call runs during React's initial render (inside `useState(readCollapsed)`), not an effect** — this is intentional (avoids a flash of the wrong sidebar width on mount) but means `readCollapsed()` must stay synchronous and side-effect-free beyond the `try`/`catch` it already has; do not convert it to an async check.
- **A viewport genuinely between 640px and, say, 900px (a small tablet)** — `UX-067`'s `639px` threshold matches Tailwind's own `sm` breakpoint (used everywhere else in this story, `UX-014`/`UX-021`/`UX-065`'s `sm:grid-cols-2`) for consistency; a tablet just above that line still gets the full expanded sidebar by default, which is correct — `DSN-5`'s sidebar was designed as a desktop/tablet-width pattern, only the sub-640px phone case is broken today.
- **`UX-068`'s hidden columns are still present in the DOM (`display:none` via `hidden`), not removed** — `DataTable`'s existing skeleton-row/empty-row `colSpan={columns.length}` logic (`DataTable.tsx` lines ~136, ~146) counts ALL columns including hidden ones; this is correct as-is (a `colSpan` wider than the visible columns just spans slightly more of a hidden area, no visual bug) — do not attempt to compute a "visible column count" for `colSpan`, that would be solving a problem that doesn't exist.
- **A future list page adds a column with `priority: 'sm'` but that column is also `sortable`** — verified no conflict: `DataTable.tsx`'s sort-button rendering (lines ~81-104) is inside the same `<TableHead>` this task's `className` change wraps: when the column is hidden, the whole header cell (button included) is hidden too, so there's no orphaned interactive element still reachable by keyboard while visually hidden.
- **`UX-008`'s `h-[min(32rem,calc(100dvh-3rem))]` depends on `dvh` unit support** — already used elsewhere in this codebase (`Sidebar.tsx:109`, `h-dvh`) and by every browser this project targets per its existing usage; not a new dependency.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend impact — every task is frontend-only or a documentation edit (`UX-AUDIT.md`). `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — `check:rtl` matters specifically for tasks 2-7 and 9-12 (new `hidden`/`grid-cols-*` utilities, all logical/breakpoint-based, no physical-direction risk, but worth the same automated check every prior `DSN` story ran).
3. Manual verification only beyond that, per `## Verification Steps` below — responsive behavior cannot be meaningfully verified by a static check alone.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Sidebar mobile default:** clear `localStorage`, open the app in DevTools' responsive mode at 375px width — the sidebar starts icon-only (64px), not the full 224px. Manually expand it — the choice persists across a reload at the same width. Widen the viewport to 1024px+ — a fresh (no stored preference) load there starts expanded.
3. **Table column priority:** at 375px, open `/tickets`, `/tickets/my-tickets`, `/customers`, `/portal/tickets`, `/portal/tickets/history` — each shows fewer columns than at desktop width, with the specific columns named in tasks 3-7 hidden; widen past 640px — all columns reappear. Confirm in `ar`/RTL: column order and hiding read correctly with no physical-direction artifacts.
4. **Chat card height:** at a short viewport (e.g. 375×600px, or a browser window resized short), open `/chat` and start a session — the chat card fits within the visible viewport with no vertical overflow/clipping; at a tall viewport it's still capped at `32rem` as before.
5. **Detail-page field grids:** at 375px, open `/customers/:id`, `/tickets/:id`, and `/portal/tickets/:id` — each screen's top field summary stacks to one column; widen past 640px — it becomes two columns. On `/tickets/:id` specifically, confirm the right-hand `CustomerContextPanel` still always stacks (one column), regardless of viewport width — this is intentional, not a regression.
6. **Portal article markdown table:** find or create an article with a markdown table in its body, view it at 375px on `/portal/articles/:id` — the table scrolls horizontally within its own bounds; the rest of the article content is unaffected.
7. **`UX-AUDIT.md` register:** the 5 original `responsive` rows show `Resolved (Story 64)`; `UX-067`/`UX-068` are present as new rows; the header summary reflects 68 total findings.

---

## Done Criteria

- [ ] `Sidebar.tsx` — `readCollapsed()` defaults to collapsed on narrow viewports only when no preference is stored.
- [ ] `data-table/types.ts` — `ColumnDef` gains `priority?: 'always' | 'sm'`; `DataTable.tsx` hides `priority: 'sm'` columns below `sm:` in both header and body cells.
- [ ] `TicketListPage.tsx`, `MyTicketsPage.tsx`, `CustomerListPage.tsx`, `PortalTicketListPage.tsx`, `PortalTicketHistoryPage.tsx` — each has the 2 columns named in tasks 3-7 marked `priority: 'sm'`.
- [ ] `LiveChatWidget.tsx` — `ChatPane`'s `Card` height is viewport-relative, capped at `32rem`.
- [ ] `CustomerProfilePage.tsx`, `TicketDetailPage.tsx`, `TicketSlaSection.tsx`, `PortalTicketDetailPage.tsx` — each named `dl` stacks below `sm:`; `CustomerContextPanel.tsx` confirmed unchanged.
- [ ] `PortalMarkdownPreview.tsx` — rendered markdown tables scroll horizontally within their own container.
- [ ] `design-system/supportos/UX-AUDIT.md` — all 5 original `responsive` rows `Resolved (Story 64)`; `UX-067`/`UX-068` added; header summary updated to 68 total findings.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `design-system/supportos/UX-AUDIT.md` only (plus this plan's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-6, in both `en`/LTR and `ar`/RTL.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-10` through `DSN-13` (`SupportOs backlog.MD:592-630`) remain unplanned — each consumes a different category of `UX-AUDIT.md` findings and needs its own intake.
