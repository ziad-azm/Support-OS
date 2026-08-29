# Story 50 — (DSN-4) Comprehensive Visual Redesign of Built Screens (Story: SUPPORTOS-94)

## Prerequisites

- **`DSN-0` (Story 35) and `DSN-1` (Story 36) are complete** — the intake's own dependency line. `CONVENTIONS.md` § 25 (lines 1472-1621) holds the full `DSN` spec; Story 36 already retinted `--primary`/`--secondary`/`--destructive`/`--font-sans` and the modal radius. This story is explicitly framed by its own intake as going *past* that token swap: *"DSN-1 only swapped color/font/radius tokens... Screens still read as unstyled shadcn defaults: uniform-gray status/priority badges with no semantic color, no iconography, no density/hierarchy polish."*
- **`DSN-2` (Story 37) and `DSN-3` (Story 38) are also complete**, unblocking nothing for this story directly but leaving two reusable facts this plan depends on: `CardTitle` already supports `asChild` (Story 37, task 1) and every page-level `<h1>`/section `<h2>` this story must **not** re-touch is already real heading markup, not a styled `<div>`.
- **DSN's own generated design system has no semantic status-color palette — verified, not assumed.** `design-system/supportos/MASTER.md`'s Color Palette table (lines 19-36) defines exactly six roles: Primary, Secondary, Accent/CTA, Background/Foreground/Card, Muted, Border, Destructive, Ring — no Success/Warning/Info. Grepped the `ui-ux-pro-max` skill's own data catalogs (`colors.csv`, `ui-reasoning.csv`, `styles.csv`) for "success"/"warning"/"info"/"semantic" — no per-role hex exists anywhere for this project's category ("Knowledge Base/Documentation", `CONVENTIONS.md` § 25 line 1500-1502). This is the same category of gap `DSN-3` (Story 38) hit for chart palettes and resolved by an independent, cited, verified decision rather than forcing a nonexistent DSN value — task 1 below does the same for badge semantics.
- **The intake's own task list names four data categories to color-code — "ticket status, priority, notification kind, and task state" — not every `Badge` usage in the app.** A full-tree audit (this session) found **41** `<Badge` call sites across `frontend/src/features/`; only **~13** are one of those four categories. The rest (message/timeline `direction`, `channel`, `category`, mention names, `activity_kind`, `role.is_system`, `user.is_active`, article `draft`/`published` status) are **explicitly out of scope** — see `## Story Goal`.
- **`Notification.kind` is never rendered through a `Badge` anywhere today — verified by reading every file in `frontend/src/features/notifications/`.** `NotificationBell.tsx`'s only `Badge` (line 75-80) shows the unread **count**, not the per-notification `kind`; the dropdown list (lines 96-109) renders plain text with no kind indicator at all. So "notification kind... render with distinct colors" has no existing gray pill to recolor — task 4 adds a small icon-per-kind indicator (new content, not a recolor), which is also literally the intake's "iconography pass" task landing on the same gap.
- **Backend enum sources, read directly, not inferred from frontend copy:**
  - `backend/apps/tickets/models.py:34-38` — `Ticket.Status`: `open`, `in_progress`, `resolved`, `closed`.
  - `backend/apps/tickets/models.py:40-44` — `Ticket.Priority`: `low`, `medium`, `high`, `urgent`.
  - `frontend/src/features/tickets/types/ticketSla.ts:1` — `SlaDimensionStatus = 'met' | 'breached' | 'pending'` (**no** `at_risk` value exists — `pending` means "due date not yet passed, not yet marked met," not "at risk"; task 3 does not color it as a warning for exactly this reason).
  - `frontend/src/features/tasks/types/task.ts` — `Task` has no status enum, only `completed_at: string | null`; `TaskListPage.tsx:95` already derives a two-state pending/completed badge from it.
- **WCAG contrast for the three new badge colors was computed, not guessed** — same rigor Story 36 used for the token retint. Using the standard relative-luminance formula (verified against Story 36's own three published values first, as a self-check: my implementation reproduces `#2563EB → oklch(0.546 0.215 262.881)`, `#DC2626 → oklch(0.577 0.215 27.325)`, `#64748B → oklch(0.554 0.041 257.417)` exactly):

  | Candidate | vs. white text | vs. black text |
  |---|---|---|
  | `#16A34A` (success) | 3.30:1 — fails | **6.37:1** |
  | `#D97706` (warning) | 3.19:1 — fails | **6.59:1** |
  | `#0284C7` (info) | 4.10:1 — fails | **5.13:1** |

  None of the three clears 4.5:1 with white text; all three clear it comfortably with black. Task 1 therefore pairs all three new badge backgrounds with **pure black** foreground text (`oklch(0 0 0)`), not a reused `--foreground` (which is a slightly lighter near-black and was not worth the imprecision of an approximate OKLCH→sRGB back-conversion when an exact, zero-ambiguity value was available).
- **Color sourcing for the three new hexes, cited, not invented:** `#16A34A` is the exact "success"/"operational" green MASTER.md's own generator data (`colors.csv`) repeats across seven different product-type rows (rows 3, 21, 24, 35, 47, 79, 166) — the single most consistent semantic-green choice in the entire dataset, including row 166 ("Status Page / Incident Management": *"Operational green + incident red + maintenance amber"*, the closest analog to this app's own status semantics). `#D97706` (Tailwind `amber-600`) is the standard warning amber that row's own "maintenance amber" text names by hue family, with no exact hex given anywhere in the dataset. `#0284C7` (Tailwind `sky-600`) is deliberately **not** the same hue as `--primary`'s `#2563EB` — reusing a hex across two different semantic roles (CTA vs. informational status) is exactly the reasoning `CONVENTIONS.md` § 25 already rejected for `--accent` in Story 36 (*"reusing #2563EB a second time... would give one hex two different UI meanings"*).
- **`lucide-react@^1.34.0`** (`frontend/package.json:24`) is already a direct dependency, already used in 11 files (all `shared/ui/*` primitives plus `NotificationBell.tsx`) — confirmed zero feature-level component (`tickets`, `tasks`, `customers`, `accounts`, `knowledge-base`) imports it today. Every icon name this plan adds (`Contact`, `Ticket`, `Inbox`, `ListTodo`, `BookOpen`, `FileText`, `Search`, `UserCog`, `ShieldCheck`, `Plus`, `Clock`, `TriangleAlert`, `UserPlus`, `AtSign`) was verified to exist in the installed package (`grep "^declare const <Name>:" frontend/node_modules/lucide-react/dist/lucide-react.d.ts`) before being written into this plan — `AlertTriangle` does **not** exist in this version (renamed upstream to `TriangleAlert`, confirmed present).
- **The intake's QA-pass instruction — "same list as DSN-1's Verification Steps" — is stale and is superseded here, verified not assumed.** Story 36's own route list (`frontend/src/app/router.tsx`, 16 routes) predates `knowledge-base`, `users`, `roles`, and the entire `portal/*` tree, all added by later stories. `## Verification Steps` below uses the **current** full route list (34 routes across two route trees, read fresh from `frontend/src/app/router.tsx` for this plan), not the 2026-vintage 16-route list the intake's text points at.
- **No backend change, no migration** — this entire story is `frontend/` plus `CONVENTIONS.md`.

---

## Story Goal

Take every already-built screen from "unstyled shadcn defaults" to "actually looks designed," inside the existing shadcn/ui + Tailwind v4 primitive set, with every fix landing at a **shared-component level** so every consuming screen inherits it — matching the intake's own constraint on all four of its tasks.

1. **Semantic status/priority color-coding** — three new `Badge` variants (`success`/`warning`/`info`, alongside the existing `default`/`secondary`/`destructive`/`outline`/`ghost`/`link`), backed by three new design tokens, applied to ticket status, ticket priority, task completion state, one SLA dimension, ticket escalation, and (via a new icon, since no badge exists) notification kind.
2. **Iconography pass** — every list page's primary "New X" action, every `RootLayout` nav link, and (via a shared component) every empty state gains a `lucide-react` icon — the one icon set already in this codebase, no new library.
3. **Spacing, density & hierarchy polish** — a new shared `PageHeader` component replaces ~13 duplicated, flat (`text-lg`, no visual weight above section titles) page-header blocks with a clear two-level type hierarchy; `DataTable`'s cell padding gets a modest, cited density bump; `Card`/`FormItem` spacing is **audited and confirmed already DSN-compliant**, not changed.
4. **Full-app visual QA pass** — every one of the 34 current routes, in both themes and both languages, confirming the refresh landed with no straggler screen.

### What "shared-component-level changes only" resolves to, concretely

The intake's spacing/density task explicitly scopes itself to shared components "so every consuming screen inherits the fix." Read literally for headers, that is impossible today — there is no shared page-header component, only 13 copies of the same JSX shape. This story's own resolution (task 8) is the same move Story 37 made for the 11 duplicated `formErrors` blocks: **extract the duplicated pattern into one new shared component**, then swap every call site to it. A one-line-per-page swap-in is not "re-architecture of data flow or logic" (the intake's own boundary) — no page's data, state, or behavior changes, only which component renders its title row.

### Explicitly out of scope

- **Article `draft`/`published` status badges** (`ArticleListPage.tsx:57`, `ArticleBrowsePage.tsx:55`, `ArticleReaderPage.tsx:41`, `SearchPage.tsx:74`, `PortalArticleListPage.tsx:49`'s own explicit non-render of drafts). Not one of the intake's four named categories.
- **Every other non-named `Badge` site**: message/timeline `direction` (7 sites), `channel` (5 sites), `category_name`/mention-name/`activity_kind` labels (6 sites), `Role.is_system` (`RoleListPage.tsx:61`), `User.is_active` (`UserListPage.tsx:75`). All stay on their current `default`/`secondary`/`outline` variant, unchanged.
- **`CardTitle`-driven detail-page `<h1>`s** (`TicketDetailPage.tsx:83-86`, `CustomerProfilePage.tsx:54-59`, `PortalTicketDetailPage.tsx:37-42`, `WebFormPage.tsx`, `LiveChatWidget.tsx`) — Story 37 already made these real headings; this story's `PageHeader` component is for the **list-page** flat-header pattern only, a different shape (a bare flex row, not a `Card`), and touching the `CardTitle` sites would duplicate Story 37's work for no gain.
- **Icons on Save/Cancel/Delete form buttons.** The intake names "primary actions" — read here as the one primary action every list page repeats (a "New X" create button), not every button in every form. Icon-ing ~15 forms' Save buttons would multiply this story's file count for a much smaller design payoff than the list-page create actions, and risks exactly the "re-architecture" scope creep the intake itself warns against.
- **A "select all"/bulk-action bar.** Unrelated to visual redesign; `CONVENTIONS.md` § 25 already names this a separate, unimplemented, Low-severity item (Story 37's own scoping).
- **New chart components, new color library, new icon library.** Explicit intake constraint: *"staying inside the existing shadcn/ui + Tailwind v4 primitive set... no new component library."*

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-94/intake.md` — four task blocks, no attachments, no acceptance criteria.
2. `CONVENTIONS.md` § 25 (lines 1472-1621, full) — especially the token reconciliation table (1512-1527, the pattern task 1's three new rows follow) and the "naming quirk... resolved here" precedent (1490-1497, the same posture task 1 takes toward DSN's missing semantic palette).
3. `design-system/supportos/MASTER.md` lines 17-38 (Color Palette table — confirms no Success/Warning/Info role exists) and lines 52-62 (Spacing Variables — the `--space-xs`…`--space-3xl` scale task 9's Context item cites).
4. `frontend/src/index.css` (159 lines, full) — `:root` lines 10-49 and `.dark` lines 51-83 (the two blocks task 1 adds three token pairs to) and `@theme inline` lines 85-125 (the mapping block task 1 extends). Confirm `--chart-1..5`, `--accent`, `--font-arabic` are still untouched — not this story's concern.
5. `frontend/src/shared/ui/primitives/badge.tsx` (46 lines, full) — `badgeVariants`' exact six-entry `variants.variant` object (lines 10-20), the shape task 2's three new entries match, including the `destructive` variant's `dark:bg-destructive/60` opacity treatment (line 15) — **not** mirrored for the three new variants (see task 2's own note on why).
6. `frontend/src/shared/ui/data-table/DataTable.tsx` (174 lines, full) and `DataTablePagination.tsx` (66 lines, full) — both already use `lucide-react` icons (`ChevronUpIcon`/`ChevronDownIcon` for sort, RTL-aware `ChevronLeftIcon`/`ChevronRightIcon` for pagination) — confirms the DataTable's own iconography is **already done**; nothing in this story touches either file except `table.tsx`'s cell padding (task 9).
7. `frontend/src/shared/ui/primitives/table.tsx` (94 lines, full) — `TableHead` (57-68) and `TableCell` (70-81), both `px-2` (8px) today — the two lines task 9 edits.
8. `frontend/src/shared/ui/primitives/card.tsx` (82 lines, full) — `Card`'s `gap-6`/`py-6` and `CardContent`/`CardHeader`/`CardFooter`'s `px-6` (all 24px) — **verified already an exact match** to `MASTER.md`'s 24px "Section padding" (`--space-lg`). No change.
9. `frontend/src/shared/ui/primitives/form.tsx` (155 lines, full) — `FormItem`'s `grid gap-2` (line 79, 8px) — **verified already an exact match** to `--space-sm` ("Icon gaps, inline spacing"). No change.
10. `frontend/src/shared/ui/Empty.tsx` (30 lines, full) — `title`/`description`/`action` props, no icon slot today. Task 7 adds one.
11. `frontend/src/app/RootLayout.tsx` (87 lines, full) — the 9-link `<nav>` (lines 28-66, spanning Story 06 through Story 49) task 6 adds an icon to each `<Link>`'s existing text.
12. `frontend/src/app/router.tsx` (358 lines, full) — the **current**, complete route tree (two `createBrowserRouter` roots: the main `RootLayout` tree and the sibling `portal` tree) — see `## Verification Steps` for the full enumerated list this supersedes the intake's stale reference with.
13. Ticket/task/portal Badge call sites, exact lines, verified by direct read (not the enum values alone):
    - `frontend/src/features/tickets/components/TicketListPage.tsx:106,112` (status, priority)
    - `frontend/src/features/tickets/components/MyTicketsPage.tsx:79,85` (status, priority)
    - `frontend/src/features/tickets/components/TicketDetailPage.tsx:127` (status fallback inside `<Can permission="tickets.manage" fallback={...}>`, lines 122-130), `:138,140` (escalation true/false), `:160` (priority)
    - `frontend/src/features/tickets/components/TicketSlaSection.tsx:11-15` (`badgeVariant()` helper — the **only** existing status→variant mapping function in the codebase)
    - `frontend/src/features/tasks/components/TaskListPage.tsx:95` (task state ternary)
    - `frontend/src/features/portal/components/PortalTicketListPage.tsx:72,78` (status, priority)
    - `frontend/src/features/portal/components/PortalTicketDetailPage.tsx:50,58` (status, priority)
    - `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx:58` (priority **only** — this page shows no status column)
14. `frontend/src/features/tickets/types/ticket.ts:1-6` (`TICKET_STATUSES`, `TICKET_PRIORITIES`) and `frontend/src/features/portal/types/portalTicket.ts:20-30` — the **existing, explicit** precedent for duplicating a ticket-domain type into `portal/` rather than importing it: *"Duplicated from `features/tickets/types/ticket.ts`'s `Ticket`/`TicketStatus`/`TicketPriority` rather than imported — `no-restricted-imports` (`frontend/.oxlintrc.json`) forbids a cross-feature import."* Task 3's two `statusBadge.ts` files (one in `tickets/`, one in `portal/`) follow this exact, already-established precedent.
15. `frontend/.oxlintrc.json:8-18` — the `no-restricted-imports` rule text itself (`"@/features/*"` pattern, message pointing at `CONVENTIONS.md` § 15) — the rule task 3's file split obeys.
16. `frontend/src/features/notifications/components/NotificationBell.tsx` (115 lines, full) — the dropdown item block (lines 96-109) task 4 adds an icon to; `frontend/src/features/notifications/types/notification.ts:1-7` (`NOTIFICATION_KINDS`: `ticket_assigned`, `ticket_escalated`, `task_due`, `mentioned`).
17. All 13 page-header call sites for task 8 (title + optional action, the flat non-`Card` pattern): `CustomerListPage.tsx:85-92`, `TicketListPage.tsx:124-131`, `MyTicketsPage.tsx:95-97` (title only, no button), `TaskListPage.tsx:123-129`, `UserListPage.tsx:84-91`, `RoleListPage.tsx:79-86`, `FaqListPage.tsx:62-67`, `ArticleListPage.tsx:81-86`, `PortalTicketListPage.tsx:90-95`, `PortalTicketHistoryPage.tsx:75-80`, `SearchPage.tsx:34-41` (title only), `PortalFaqPage.tsx:26-32` (secondary nav button, not a create action), `PortalArticleListPage.tsx:26-32` (secondary nav button), `FaqBrowsePage.tsx:22-31` (two secondary nav buttons), `ArticleBrowsePage.tsx:23-29` (one secondary nav button).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Reuse the existing `badge.tsx` primitive and DSN tokens; no per-feature badge reimplementation.** | Intake, task 1 constraints | Three new variants added to the one `badgeVariants` `cva()` call; every consumer still imports `Badge` from `@/shared/ui/primitives/badge`. |
| **Reuse one icon set consistently; no mixed icon libraries.** | Intake, task 2 constraints | Every new icon is a named `lucide-react` import, verified to exist in the installed package before being written into this plan. |
| **Shared-component-level changes only, so every consuming screen inherits the fix.** | Intake, task 3 constraints | `PageHeader.tsx` (new), `table.tsx` (edited), `Empty.tsx` (edited) — three files, ~15 call-site swaps that change no logic. |
| **No new component library, no re-architecture of data flow or logic.** | Intake description | Every task is a class-string/JSX-wrapping/new-tiny-file change; no state, query, or route logic changes anywhere in this plan. |
| **A feature never imports from another feature.** | § 15, `frontend/.oxlintrc.json:8-18` | Task 3's ticket-status color mapping is duplicated into `features/portal/lib/statusBadge.ts`, not imported from `features/tickets/`. |
| Config from `ENV`; no new secrets, no new dependency. | Story 01 `ENV` contract | `lucide-react` is already installed; this story adds no `package.json` entry. |

---

## Implementation Tasks

### 1 — Three new design tokens

**File: `frontend/src/index.css`** — add to `:root` (after `--destructive`, line 26) and, with the identical values, to `.dark` (after `--destructive`, line 66) — same value in both blocks, the same chromatic-token-parity choice Story 36 made for `--primary`/`--secondary`/`--destructive`:

```css
  --success: oklch(0.627 0.170 149.214); /* #16A34A — no DSN role; see ## Prerequisites for sourcing */
  --success-foreground: oklch(0 0 0); /* #000000 — 6.37:1, verified; white text fails at 3.30:1 */
  --warning: oklch(0.666 0.157 58.318); /* #D97706 */
  --warning-foreground: oklch(0 0 0); /* 6.59:1, verified */
  --info: oklch(0.588 0.139 241.966); /* #0284C7 — deliberately distinct hue from --primary's #2563EB */
  --info-foreground: oklch(0 0 0); /* 5.13:1, verified */
```

**In `@theme inline`** (after `--color-destructive`, line 100):

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
```

Do **not** touch `--accent`, `--chart-1..5`, or `--font-arabic` — all three remain "Keep current"/"Defer" per § 25, unaffected by this story.

---

### 2 — Three new `Badge` variants

**File: `frontend/src/shared/ui/primitives/badge.tsx`** — add to the `variants.variant` object (line 10-20), after `destructive`:

```tsx
        success: 'border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90',
        warning: 'border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90',
        info: 'border-transparent bg-info text-info-foreground [a&]:hover:bg-info/90',
```

**No `dark:bg-*/60` opacity treatment**, unlike `destructive` (line 15). That treatment exists on `destructive` because pure `#DC2626` reads as visually too intense against the dark theme's near-black background — a stylistic call from whenever that variant last shipped, not a contrast requirement (Story 36 verified the *un*-blended value already clears contrast in dark mode too). Re-deriving three more alpha-blend contrast checks for a stylistic parity with no compliance requirement behind it is out of this story's scope; ship the three new variants at full opacity in both themes and revisit only if a visual QA pass (task 10) finds them genuinely too intense.

---

### 3 — Ticket status, priority, and SLA color mapping

**Create file: `frontend/src/features/tickets/lib/statusBadge.ts`**

```ts
import type { TicketPriority, TicketStatus } from '../types/ticket'

/** New→worked→done→archived, the same left-to-right severity/attention ramp
 * common ticketing tools use: open (needs attention) is info-blue,
 * in_progress (actively worked, don't let it stall) is warning-amber,
 * resolved is success-green, closed is neutral. No DSN source for these
 * exact hues — see the plan's `## Prerequisites` for where each one comes
 * from. */
export function ticketStatusVariant(
  status: TicketStatus,
): 'info' | 'warning' | 'success' | 'outline' {
  switch (status) {
    case 'open':
      return 'info'
    case 'in_progress':
      return 'warning'
    case 'resolved':
      return 'success'
    case 'closed':
      return 'outline'
  }
}

/** Escalating attention ramp: low is the least visually prominent variant
 * this app has, urgent reuses the existing `destructive` red. */
export function ticketPriorityVariant(
  priority: TicketPriority,
): 'outline' | 'secondary' | 'warning' | 'destructive' {
  switch (priority) {
    case 'low':
      return 'outline'
    case 'medium':
      return 'secondary'
    case 'high':
      return 'warning'
    case 'urgent':
      return 'destructive'
  }
}
```

**3 call sites in `features/tickets/`** — replace the hardcoded `variant="secondary"` with the helper, keep everything else (translation key, column shape) unchanged:

- `TicketListPage.tsx:106` → `<Badge variant={ticketStatusVariant(row.status)}>{t(\`statuses.${row.status}\`)}</Badge>`; `:112` → `<Badge variant={ticketPriorityVariant(row.priority)}>{t(\`priorities.${row.priority}\`)}</Badge>`
- `MyTicketsPage.tsx:79,85` — identical shape, same two functions
- `TicketDetailPage.tsx:127` (inside the `<Can permission="tickets.manage" fallback={...}>` at lines 122-130 — only the `fallback` Badge changes; the `<TicketStatusControl>` the permitted branch renders is untouched) and `:160` — identical shape

Add the import (`import { ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'`) to each of the three files.

**Create file: `frontend/src/features/portal/lib/statusBadge.ts`** — the identical two functions, duplicated rather than imported (see `## Context` item 14 for the exact, already-established precedent this follows), reading from `../types/portalTicket`'s `PortalTicketStatus`/`PortalTicketPriority` instead:

```ts
import type { PortalTicketPriority, PortalTicketStatus } from '../types/portalTicket'

// Duplicated from features/tickets/lib/statusBadge.ts rather than imported —
// no-restricted-imports (frontend/.oxlintrc.json:8-18) forbids a
// cross-feature import, the same boundary portalTicket.ts's own types
// already work within. Keep both files' mapping logic identical if either
// changes.
export function ticketStatusVariant(
  status: PortalTicketStatus,
): 'info' | 'warning' | 'success' | 'outline' {
  switch (status) {
    case 'open':
      return 'info'
    case 'in_progress':
      return 'warning'
    case 'resolved':
      return 'success'
    case 'closed':
      return 'outline'
  }
}

export function ticketPriorityVariant(
  priority: PortalTicketPriority,
): 'outline' | 'secondary' | 'warning' | 'destructive' {
  switch (priority) {
    case 'low':
      return 'outline'
    case 'medium':
      return 'secondary'
    case 'high':
      return 'warning'
    case 'urgent':
      return 'destructive'
  }
}
```

**3 call sites in `features/portal/`**, same replacement shape:
- `PortalTicketListPage.tsx:72,78`
- `PortalTicketDetailPage.tsx:50,58`
- `PortalTicketHistoryPage.tsx:58` (priority only — no status column on this page)

**`TicketSlaSection.tsx:11-15`** — upgrade the one-line-changed existing helper:

```ts
function badgeVariant(status: SlaDimensionStatus): 'success' | 'secondary' | 'destructive' {
  if (status === 'met') return 'success'
  if (status === 'breached') return 'destructive'
  return 'secondary'
}
```

**`pending` stays `secondary`, deliberately not `warning`.** `SlaDimensionStatus` has no `at_risk` value (`## Prerequisites`) — `pending` means "due date hasn't passed and it isn't marked met yet," which is not the same claim as "at risk." Coloring it amber would assert a warning the data doesn't support.

**`TicketDetailPage.tsx:138,140`** — escalation flag, upgrade the "not escalated" case only (`escalated: true` already correctly reads `destructive`, unchanged):

```tsx
{ticket.escalated ? (
  <Badge variant="destructive">{t('escalation.escalated')}</Badge>
) : (
  <Badge variant="success">{t('escalation.notEscalated')}</Badge>
)}
```

**`TaskListPage.tsx:95`** — task state, upgrade both branches:

```tsx
<Badge variant={row.completed_at === null ? 'warning' : 'success'}>
  {t(row.completed_at === null ? 'statuses.pending' : 'statuses.completed')}
</Badge>
```

---

### 4 — Notification kind icon (new content, not a recolor)

**File: `frontend/src/features/notifications/components/NotificationBell.tsx`** — add a small kind-to-icon lookup and render it beside each dropdown row's title (lines 102-107):

```tsx
import { AtSignIcon, BellIcon, ClockIcon, TriangleAlertIcon, UserPlusIcon } from 'lucide-react'
```

```tsx
const NOTIFICATION_KIND_ICON: Record<Notification['kind'], typeof UserPlusIcon> = {
  ticket_assigned: UserPlusIcon,
  ticket_escalated: TriangleAlertIcon,
  task_due: ClockIcon,
  mentioned: AtSignIcon,
}

const NOTIFICATION_KIND_COLOR: Record<Notification['kind'], string> = {
  ticket_assigned: 'text-info',
  ticket_escalated: 'text-destructive',
  task_due: 'text-warning',
  mentioned: 'text-info',
}
```

In the row (replace lines 102-107):

```tsx
<div className="flex w-full items-start gap-2">
  {(() => {
    const KindIcon = NOTIFICATION_KIND_ICON[notification.kind]
    return <KindIcon className={cn('mt-0.5 size-4 shrink-0', NOTIFICATION_KIND_COLOR[notification.kind])} />
  })()}
  <div className="flex flex-col gap-0.5">
    <span>{notification.title}</span>
    <span className="text-xs text-muted-foreground">{dateTime(notification.created_at)}</span>
  </div>
</div>
```

Add `import { cn } from '@/shared/lib/cn'`. `ticket_escalated` reuses the existing `text-destructive` token rather than the new `--warning`/`--info` — an escalation is exactly the same severity `Badge variant="destructive"` already asserts on `TicketDetailPage`'s escalation badge (task 3), so the two should read as the same color, not a fourth distinct one.

---

### 5 — Icons on primary "New X" actions

**8 files** — add a leading `<PlusIcon />` to the one create-action button each already has. `button.tsx`'s existing base classes already size any un-classed `<svg>` child to 16px (`[&_svg:not([class*='size-'])]:size-4`, verified present, unchanged) — no extra sizing class needed on the icon itself.

```tsx
// Before
<Button asChild>
  <Link to="/customers/new">{t('new')}</Link>
</Button>

// After
<Button asChild>
  <Link to="/customers/new">
    <PlusIcon />
    {t('new')}
  </Link>
</Button>
```

Add `import { PlusIcon } from 'lucide-react'` to each: `CustomerListPage.tsx`, `TicketListPage.tsx`, `TaskListPage.tsx`, `UserListPage.tsx`, `RoleListPage.tsx`, `FaqListPage.tsx`, `ArticleListPage.tsx`, `PortalTicketListPage.tsx`.

**Not** applied to Save/Cancel/Delete buttons in any form (see `## Story Goal`, out of scope), and **not** applied to the secondary nav-style buttons on `PortalFaqPage`/`PortalArticleListPage`/`FaqBrowsePage`/`ArticleBrowsePage` (those navigate, they don't create — a `+` there would be actively misleading).

---

### 6 — Icons on `RootLayout` nav links

**File: `frontend/src/app/RootLayout.tsx`** — one icon per existing `<Link>`, added the same way, inside the existing `<Button asChild variant="ghost" size="sm">` wrapper (lines 29-65):

| Link (line) | Icon |
|---|---|
| `/customers` (31) | `Contact` |
| `/tickets` (36) | `Ticket` |
| `/tickets/my-tickets` (39) | `Inbox` |
| `/tasks` (43) | `ListTodo` |
| `/knowledge-base` (47) | `BookOpen` |
| `/knowledge-base/articles` (50) | `FileText` |
| `/knowledge-base/search` (53) | `Search` |
| `/users` (58) | `UserCog` |
| `/roles` (63) | `ShieldCheck` |

```tsx
<Can permission="customers.view">
  <Button asChild variant="ghost" size="sm">
    <Link to="/customers">
      <ContactIcon />
      {t('customers:title')}
    </Link>
  </Button>
</Can>
```

Add one import line: `import { BookOpenIcon, ContactIcon, FileTextIcon, InboxIcon, ListTodoIcon, SearchIcon, ShieldCheckIcon, TicketIcon, UserCogIcon } from 'lucide-react'`. All nine names verified to exist in the installed `lucide-react` version (`## Prerequisites`).

---

### 7 — `Empty` gains an icon slot

**File: `frontend/src/shared/ui/Empty.tsx`** — add an optional `icon` prop with a generic default, rendered above the title:

```tsx
import { InboxIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/shared/ui/primitives/card'

export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Card role="status">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-muted-foreground">{icon ?? <InboxIcon className="size-8" />}</span>
        <p className="font-medium">{title ?? t('states.empty.title')}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action}
      </CardContent>
    </Card>
  )
}
```

**Every consuming screen inherits a default icon with zero per-call-site change** — the exact "shared-component-level, so every consuming screen inherits the fix" shape the intake's own constraint asks for. A screen that wants a more specific icon (e.g. a search-result empty state using `SearchIcon`) can pass `icon={<SearchIcon className="size-8" />}` — optional, not required by this story.

---

### 8 — `PageHeader`, and its adoption across list/browse pages

**Create file: `frontend/src/shared/ui/PageHeader.tsx`**

```tsx
import type { ReactNode } from 'react'

/**
 * The one page-level header shape every list/browse screen composes from —
 * replaces 13 duplicated `<div className="flex items-center justify-between
 * gap-4"><h1 className="text-lg font-semibold">…` blocks (Story 50, `DSN-4`).
 * `text-2xl` (up from the prior flat `text-lg`) gives page titles real
 * visual weight above `CardTitle`'s `text-lg` section headings — a genuine
 * two-level type hierarchy where every heading previously read at the same
 * size. Purely presentational: no permission check, no data fetching —
 * `action` is whatever the caller already wraps in `<Can>` or leaves bare.
 */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  )
}
```

**13 call sites**, each replacing its own header block with `<PageHeader title={t('...')} action={...} />` — the `action` value is exactly whatever JSX (a bare `<Button>`, a `<Can>`-wrapped one, or two secondary nav buttons wrapped in a fragment) the site already rendered beside its `<h1>`:

- **`title` + `<Can>`-wrapped create button**: `CustomerListPage.tsx:85-92`, `TicketListPage.tsx:124-131`, `UserListPage.tsx:84-91`, `RoleListPage.tsx:79-86`
- **`title` + bare create button (no `<Can>`)**: `TaskListPage.tsx:123-129`, `FaqListPage.tsx:62-67`, `ArticleListPage.tsx:81-86`, `PortalTicketListPage.tsx:90-95`
- **`title` + a `<Link>`-as-text secondary action**: `PortalTicketHistoryPage.tsx:75-80` (the "view active" link becomes the `action`)
- **`title` only, no action**: `MyTicketsPage.tsx:95-97`, `SearchPage.tsx:34-41` (34-35 only — the `<Input>` that follows stays outside `PageHeader`)
- **`title` + secondary nav button(s)**: `PortalFaqPage.tsx:26-32`, `PortalArticleListPage.tsx:26-32`, `FaqBrowsePage.tsx:22-31` (two buttons — pass a `<>...</>` fragment as `action`), `ArticleBrowsePage.tsx:23-29`

Example (`CustomerListPage.tsx`, combining task 5's icon):

```tsx
// Before (lines 85-92)
<div className="flex items-center justify-between gap-4">
  <h1 className="text-lg font-semibold">{t('title')}</h1>
  <Can permission="customers.manage">
    <Button asChild>
      <Link to="/customers/new">{t('new')}</Link>
    </Button>
  </Can>
</div>

// After
<PageHeader
  title={t('title')}
  action={
    <Can permission="customers.manage">
      <Button asChild>
        <Link to="/customers/new">
          <PlusIcon />
          {t('new')}
        </Link>
      </Button>
    </Can>
  }
/>
```

Add `import { PageHeader } from '@/shared/ui/PageHeader'` to all 13 files.

**Not** applied to `TicketDetailPage`/`CustomerProfilePage`/`PortalTicketDetailPage`/`WebFormPage`/`LiveChatWidget` — all five use the `Card`/`CardHeader`/`CardTitle asChild` pattern Story 37 already gave real heading semantics; that is a structurally different shape (a card, not a bare flex row) and is not this task's concern (see `## Story Goal`).

---

### 9 — `DataTable` cell density

**File: `frontend/src/shared/ui/primitives/table.tsx`** — `TableHead` (line 62) and `TableCell` (line 75): `px-2` → `px-3` (8px → 12px horizontal padding; vertical padding/row height unchanged).

No DSN source gives an exact table-padding value (`MASTER.md`'s Component Specs section covers only buttons/cards/inputs/modals — the same gap Story 36 already found and left `alert.tsx`/`tabs.tsx` alone for). This is a bounded, cited judgment call, the same posture Story 38 used for the Waffle-chart decision: a small, deliberate step toward MASTER.md's "spacious" Swiss-style keyword without abandoning the tight, information-dense table a "dashboards... professional tools" `Style` ("Best For" list, `MASTER.md` line 171) calls for.

---

### 10 — Record this story in `CONVENTIONS.md` § 25

**File: `CONVENTIONS.md`** — append to the token reconciliation table (after the `--font-sans` row, before `--radius`, so the new rows sit with the other adopted-not-deferred ones):

```markdown
| `--success`/`--success-foreground`, `--warning`/`--warning-foreground`, `--info`/`--info-foreground` (new) | *(did not exist)* | *(none — `MASTER.md`'s Color Palette table has no semantic-status role)* | **Adopted (Story 50)** | No DSN source exists for badge semantics; `#16A34A`/`#D97706`/`#0284C7` sourced from the `ui-ux-pro-max` skill's own `colors.csv` (the most-repeated "success green" across the dataset; amber and a `--primary`-distinct blue chosen by hue-family convention, no exact hex available). All three pair with **black**, not white, text — verified 6.37:1/6.59:1/5.13:1; white text fails 4.5:1 on all three. |
```

Append a new subsection after "Chart-type guidance":

```markdown
### Badge semantics, iconography, and page-header hierarchy (`DSN-4`, Story 50)

`success`/`warning`/`info` variants added to `badge.tsx` (§ above) — applied to
ticket status (`open`→info, `in_progress`→warning, `resolved`→success,
`closed`→outline), ticket priority (`low`→outline, `medium`→secondary,
`high`→warning, `urgent`→destructive), task completion state
(pending→warning, completed→success), one SLA dimension (`met`→success;
`breached` stays `destructive`; `pending` stays `secondary` — no `at_risk`
value exists in `SlaDimensionStatus` to justify a warning), and ticket
escalation (`false`→success, `true` stays `destructive`). Deliberately
**not** applied to article draft/published status or any `direction`/
`channel`/`category`/mention/`activity_kind`/`is_system`/`is_active` badge —
not one of the intake's four named categories.

The ticket-status/priority mapping is duplicated in
`features/tickets/lib/statusBadge.ts` and `features/portal/lib/statusBadge.ts`
rather than shared — `no-restricted-imports` forbids the cross-feature
import, the same boundary `features/portal/types/portalTicket.ts` already
documents for its own duplicated `TicketStatus`/`TicketPriority` types.

`lucide-react` icons added to: every list page's "New X" action, every
`RootLayout` nav link, and (via `Empty.tsx`'s new optional `icon` prop, a
generic `InboxIcon` default) every empty state. `Notification.kind` gained
its first-ever visual indicator (an icon, not a badge — no badge existed to
recolor) in `NotificationBell.tsx`'s dropdown rows.

`PageHeader` (`shared/ui/PageHeader.tsx`) replaces 13 duplicated list-page
header blocks, establishing the first real two-level heading hierarchy
(`text-2xl` page titles above `CardTitle`'s `text-lg` section titles,
Story 37) — everything previously read at one flat size. `Card`/`FormItem`
spacing was audited and found already exactly matching `MASTER.md`'s
24px/8px spacing scale — no change. `table.tsx`'s cell padding moved from
8px to 12px horizontal, a bounded judgment call — no DSN table spec exists
to size against precisely.
```

---

## Edge Cases & Failure Modes

- **A `PageHeader` action slot rendering nothing** (e.g. `MyTicketsPage`/`SearchPage`, no create button) must not leave a layout gap — `action?: ReactNode` defaulting to `undefined` renders nothing extra; `justify-between` on a single child still lays out correctly (verified: Flexbox `justify-content: space-between` with one child places it at the start, no phantom gap).
- **`ticketStatusVariant`/`ticketPriorityVariant` are plain `switch` statements with no `default` case** — TypeScript's exhaustiveness checking over the four-member `TicketStatus`/`TicketPriority` union types means an unhandled case is a **build-time** type error, not a runtime fallback silently mapping to `undefined`. If a fifth status/priority value is ever added to the backend enum and mirrored into `TICKET_STATUSES`/`TICKET_PRIORITIES` without updating these two functions, `npm run build` fails loudly — the correct failure mode for a switch over a fixed domain.
- **The two `statusBadge.ts` files can drift** — both are hand-copies, not generated from one source, because `no-restricted-imports` forbids the alternative. Each file's own top comment cross-references the other; nothing enforces the two staying identical beyond that comment and code review. Accepted, matching the exact same accepted risk `portalTicket.ts`'s own duplicated types already carry.
- **`--success`/`--warning`/`--info` at 60-70% lightness look nearly identical to some users with certain color-vision deficiencies** (deuteranopia in particular can compress green/amber together). Every status/priority badge in this app already pairs its color with a text label (the translated status/priority name is always inside the badge, never a bare color swatch) — the same "color always paired with a text label" accessibility floor `CONVENTIONS.md` § 25's chart-guidance table already states for a different UI (line 1605-1609). No additional icon-per-status is added inside badges themselves; the text label is the accessible signal.
- **`NotificationBell`'s new per-kind icon color reuses `text-destructive` for `ticket_escalated`, not a new token** — deliberate, not an oversight: an escalation is the same severity level `TicketDetailPage`'s own escalation `Badge variant="destructive"` already asserts (task 3); a fourth distinct hue for the "same" severity would contradict the "distinct, *meaningful*" instruction in the intake, not fulfill it.
- **`table.tsx`'s `px-3` change affects every `<TableHead>`/`<TableCell>` in the app** — the shared-primitive lever this task deliberately reaches for. No page-level table has a local override to conflict with (verified: no `className` override on any `TableHead`/`TableCell` instance touches horizontal padding — the few that do override anything only set `text-end` for numeric alignment, which composes with the padding change with no conflict).
- **`Empty.tsx`'s default `InboxIcon` may read oddly for an error-adjacent empty state** (e.g. "no search results") — this is a `role="status"`, not `role="alert"`, empty state either way (unchanged from before this story), and a generic inbox icon reads fine as "nothing here" in every current usage; a screen with a more specific need can override `icon` (task 7's own note).
- **`Contact`, `Ticket`, `Inbox`, `ListTodo`, `BookOpen`, `FileText`, `Search`, `UserCog`, `ShieldCheck` are nine distinct icons for nine distinct nav destinations** — verified no two nav links share an icon, so nav scannability actually improves rather than becoming ambiguous.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or removed.

1. No backend impact: this story touches only `frontend/` and `CONVENTIONS.md` — `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass. `check:rtl` matters specifically here — task 4/5/6's new icon-plus-text JSX and task 8's 13 rewritten header blocks are exactly the kind of change that could accidentally introduce a physical-direction class.
3. `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` still returns matches only in `index.css` — the same standing check Story 36 established, re-run here because this story adds three brand-new colors and must add them only as tokens, never inline.
4. Manual visual verification, per `## Verification Steps` below — this story's actual "test."

---

## Verification Steps

1. **Static checks:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) all exit 0; `python manage.py test` (from `backend/`) still reports its existing count unaffected.
2. **No stray hardcoded color:** `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` returns matches only in `frontend/src/index.css`.
3. **Contrast spot-check in the running app:** a `success`, `warning`, and `info` badge (e.g. a resolved ticket, an in-progress ticket, an open ticket in `TicketListPage`) — inspect each with a browser contrast checker and confirm the black text reads ≥4.5:1 against its pill, matching `## Prerequisites`' computed 6.37:1/6.59:1/5.13:1.
4. **Ticket status/priority color-coding, both list and detail:** `/tickets`, `/tickets/my-tickets`, a ticket detail page, `/portal/tickets`, a portal ticket detail page, `/portal/tickets/history` — every status pill and every priority pill renders in its mapped color (open=info-blue, in_progress=warning-amber, resolved=success-green, closed=outline; low=outline, medium=secondary, high=warning, urgent=destructive), consistently between the staff and portal versions of the same data.
5. **SLA and escalation:** open a ticket with an `SLAPolicy` configured for its priority/category — the response/resolution badges read success (met) or destructive (breached), never the old default-blue for "met." Toggle a ticket's escalation on/off — the badge flips destructive/success, not destructive/secondary.
6. **Task state:** `/tasks` — a pending task's badge is warning-amber, a completed one is success-green.
7. **Notification kind icons:** trigger at least one of each of the four notification kinds (or seed them via `manage.py shell` if none occur naturally in the current session) and open the bell dropdown — each row shows a distinct icon (`UserPlusIcon`/`TriangleAlertIcon`/`ClockIcon`/`AtSignIcon`) in the mapped color.
8. **Iconography:** every "New X" button (customers, tickets, tasks, users, roles, FAQs, articles, portal tickets) shows a leading `+`; every `RootLayout` nav link shows its mapped icon, all nine visually distinct from each other; an empty list (e.g. a fresh search with no results, or any list page after deleting its only row) shows the default inbox icon above its message.
9. **Page-header hierarchy:** every page using `PageHeader` shows a visibly larger, bolder title than any `CardTitle`-driven `<h2>` section heading on a detail page (e.g. compare `/customers`'s "Customers" title against `TicketDetailPage`'s section headings) — confirms the two-level hierarchy actually reads as two levels, not the same size.
10. **DataTable density:** any table (e.g. `/tickets`) shows visibly more horizontal breathing room per cell than before this story, without rows wrapping or the table overflowing its container differently than before.
11. **Full-app QA pass, every current route, both themes, both languages.** The intake's own referenced list (DSN-1's Verification Steps) is stale — walk the **current** route list instead, read fresh from `frontend/src/app/router.tsx` for this plan:

    **Main tree:** `/login`, `/chat`, `/contact`, `/` (`HealthPage`), `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/tickets`, `/tickets/new`, `/tickets/my-tickets`, `/tickets/:id`, `/tickets/:id/edit`, `/knowledge-base/manage`, `/knowledge-base/manage/new`, `/knowledge-base/manage/:id/edit`, `/knowledge-base/articles/manage`, `/knowledge-base/articles/manage/new`, `/knowledge-base/articles/manage/:id/edit`, `/knowledge-base`, `/knowledge-base/articles`, `/knowledge-base/articles/:id`, `/knowledge-base/search`, `/users`, `/users/new`, `/users/:id/edit`, `/roles`, `/roles/new`, `/roles/:id/edit`, `/tasks`, `/tasks/new`, `/tasks/:id/edit`, and `*` (`NotFoundPage`).

    **Portal tree:** `/portal` (`PortalHomePage`), `/portal/faqs`, `/portal/articles`, `/portal/articles/:id`, `/portal/tickets`, `/portal/tickets/history`, `/portal/tickets/new`, `/portal/tickets/:id`, `/portal/tickets/:id/feedback`.

    For each: confirm the refresh landed (colored badges where applicable, icons where applicable, the new page-header type scale where applicable) and confirm **no visual regression** — log and fix any straggler screen found, per the intake's own task 4 wording. Repeat the pass in dark theme and in Arabic (RTL layout, icons must not mirror incorrectly — verify via `check:rtl`'s own class-level guarantee plus a visual spot-check that icon-then-text order flips correctly with `dir="rtl"`).
12. **No regression outside scope:** `git diff --stat` confined to `frontend/src/index.css`, `frontend/src/shared/ui/primitives/badge.tsx`, `frontend/src/shared/ui/primitives/table.tsx`, `frontend/src/shared/ui/Empty.tsx`, `frontend/src/shared/ui/PageHeader.tsx` (new), `frontend/src/app/RootLayout.tsx`, `frontend/src/features/tickets/lib/statusBadge.ts` (new), `frontend/src/features/portal/lib/statusBadge.ts` (new), the ~13+8 feature-page files task 3/5/8 touch, `frontend/src/features/notifications/components/NotificationBell.tsx`, and `CONVENTIONS.md` — nothing under `backend/`, no route/query/mutation logic changed anywhere.

---

## Done Criteria

- [ ] `frontend/src/index.css` — `--success`/`--warning`/`--info` and their `-foreground` pairs added to `:root`, `.dark`, and `@theme inline`; all three foregrounds are pure black, verified ≥4.5:1 against their own background (6.37:1/6.59:1/5.13:1); `--accent`/`--chart-*`/`--font-arabic` untouched.
- [ ] `badge.tsx` — `success`/`warning`/`info` variants added, matching the existing five-variant shape; no `dark:/60` opacity treatment added (documented reason).
- [ ] `features/tickets/lib/statusBadge.ts` and `features/portal/lib/statusBadge.ts` both exist, both exports are exhaustive `switch` statements over the full status/priority union (no `default` case, so a future enum addition is a build error), and both files' mappings are identical.
- [ ] Ticket status/priority colored at all 6 call sites (`TicketListPage`, `MyTicketsPage`, `TicketDetailPage` ×2 for tickets; `PortalTicketListPage`, `PortalTicketDetailPage`, `PortalTicketHistoryPage` for portal — the last one priority-only).
- [ ] `TicketSlaSection.tsx`'s `badgeVariant()` — `met`→`success`; `breached`/`pending` unchanged (`destructive`/`secondary`).
- [ ] `TicketDetailPage.tsx`'s escalation badge — `false`→`success`; `true` unchanged (`destructive`).
- [ ] `TaskListPage.tsx`'s task-state badge — `pending`→`warning`, `completed`→`success`.
- [ ] Article status, and every `direction`/`channel`/`category`/mention/`activity_kind`/`is_system`/`is_active` badge, are **unchanged** — verified by `git diff` showing no edit to those lines.
- [ ] `NotificationBell.tsx` — a per-kind icon renders in each dropdown row, in the mapped color; no `Badge` was added for kind (none existed to recolor).
- [ ] `PlusIcon` added to all 8 named "New X" buttons; no icon added to any Save/Cancel/Delete button or any secondary nav-style button.
- [ ] `RootLayout.tsx` — all 9 nav links carry a distinct icon.
- [ ] `Empty.tsx` — optional `icon` prop added, `InboxIcon` default; existing `title`/`description`/`action` props and behavior unchanged.
- [ ] `shared/ui/PageHeader.tsx` created (`text-2xl font-semibold tracking-tight` title); all 13 named call sites adopt it; the 5 `CardTitle`-driven detail-page headers are **untouched**.
- [ ] `table.tsx` — `TableHead`/`TableCell` `px-2` → `px-3`; no other primitive's padding changed.
- [ ] `Card`/`FormItem` spacing confirmed unchanged (already DSN-compliant, documented in task 10, not edited in code).
- [ ] `CONVENTIONS.md` § 25 — three new token-reconciliation rows added, and the new "Badge semantics, iconography, and page-header hierarchy" subsection appended after "Chart-type guidance."
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` matches only `index.css`.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0; `python manage.py test` unaffected.
- [ ] Full visual QA pass complete across all 34 current routes (main tree + portal tree, `## Verification Steps` item 11's full list), in both themes and both languages, with no straggler screen left unstyled.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** This is the last currently-intake'd `DSN` story — `EPIC 8` has no further planned work beyond this one unless a new intake is written.
