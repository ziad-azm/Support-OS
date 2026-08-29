# Story 51 — (DSN-5) App Shell Redesign: Sidebar Navigation & Theme Backgrounds (Story: SUPPORTOS-95)

## Prerequisites

- **`DSN-0` (Story 35) is complete** — the intake's own dependency line. `CONVENTIONS.md` § 25 (lines 1472-1655, after Story 50's appended subsection) holds the full `DSN` spec.
- **`DSN-4` (Story 50) is implemented** (not just planned — verified by reading the current file state, not the plan). `frontend/src/app/RootLayout.tsx`'s top `<nav>` already carries a `lucide-react` icon on every link (`ContactIcon`, `TicketIcon`, `InboxIcon`, `ListTodoIcon`, `BookOpenIcon`, `FileTextIcon`, `SearchIcon`, `UserCogIcon`, `ShieldCheckIcon`) — this story's sidebar conversion **reuses every one of these icons as-is**, it does not choose new ones. `frontend/src/index.css` already carries Story 50's `--success`/`--warning`/`--info` tokens (added after `--destructive`) — this story's token edits land **after** those, untouched.
- **The intake explicitly frames this as the one non-token-only `DSN` story** — *"converting the nav from a header to a sidebar is a deliberate layout restructuring, done carefully to preserve every existing permission gate, i18n label, and route unchanged."* Verified: `RootLayout.tsx` today has exactly 9 nav links (6 always-visible-when-permitted single links, one ungated `/tasks` link, and two multi-link `<Can>` blocks for `tickets.view`/`knowledge_base.view`), each already `asChild`-wrapped in a `Button` around a `Link` — the structural unit this story's sidebar item repeats, unchanged in its permission/i18n logic.
- **`design-system/supportos/MASTER.md`'s Color Palette table (lines 19-36) gives exact light-mode hexes for every surface token the intake names** — `Background #F8FAFC`, `Foreground #1E293B`, `Card #FFFFFF`, `Muted #EAEFF3`, `Muted Foreground #475569`, `Border #E2E8F0`, and (not named by the intake's task list, but present in the same table and picked up by task 3 below) `Ring #475569`. Unlike Story 50's badge-semantics gap, this story's surface tokens are **fully specified by DSN** — no independent sourcing needed for light mode.
- **MASTER.md gives no dark-mode palette at all** — its Color Palette table is a single set of values, no `.dark` row anywhere in the generated output. Dark-mode surface values below are this story's own derivation (same posture Story 36 used for chromatic tokens with no dark-specific DSN guidance), computed and contrast-verified, not guessed.
- **Every oklch value below was computed with the same conversion this project has already used and self-verified twice** (Story 36, Story 50): the sRGB→OKLab→OKLCH forward transform and its OKLCH→sRGB inverse were round-tripped against Story 36's own published `#2563EB → oklch(0.546 0.215 262.881)` and reproduced it exactly, and the inverse was separately round-tripped back to `#2563EB`. All contrast ratios below use the standard WCAG relative-luminance formula against real sRGB, not an OKLCH-lightness approximation.

  **Light mode (`:root`) — directly from MASTER.md's table:**

  | Token | Hex | oklch | Contrast |
  |---|---|---|---|
  | `--background` | `#F8FAFC` | `oklch(0.984 0.003 247.858)` | — |
  | `--foreground` | `#1E293B` | `oklch(0.279 0.037 260.031)` | vs. new `--background`: **13.98:1**; vs. new `--card`: **14.63:1** |
  | `--card` | `#FFFFFF` | `oklch(1 0 0)` (unchanged value — but now genuinely distinct from the new `--background`, which is the actual fix; today both are pure white, so light mode has **zero** depth between page and card) | — |
  | `--muted` | `#EAEFF3` | `oklch(0.949 0.008 241.666)` | — |
  | `--muted-foreground` | `#475569` | `oklch(0.446 0.037 257.281)` | vs. new `--muted`: **6.55:1**; vs. new `--background`: **7.24:1** |
  | `--border` | `#E2E8F0` | `oklch(0.929 0.013 255.508)` | — (borders are not text; no WCAG text-contrast requirement applies) |

  **Dark mode (`.dark`) — independently derived, no DSN source exists.** Same hue family (~257°, the blue-slate cast MASTER.md's own "Color Notes: Neutral grey + link blue" describes) at dark-appropriate lightness, preserving the same background-darker-than-card depth relationship the light palette establishes:

  | Token | oklch | Hex (for reference) | Contrast |
  |---|---|---|---|
  | `--background` | `oklch(0.17 0.02 257)` | `#0A1018` | — |
  | `--foreground` | `oklch(0.96 0.005 257)` | `#F0F2F5` | vs. new `--background`: **17.02:1**; vs. new `--card`: **15.1:1** |
  | `--card` | `oklch(0.23 0.02 257)` | `#171D26` | — |
  | `--muted` | `oklch(0.28 0.02 257)` | `#232933` | — |
  | `--muted-foreground` | `oklch(0.72 0.02 257)` | `#9DA5B1` | vs. new `--muted`: **5.88:1**; vs. new `--background`: **7.68:1** |

  All eight text-contrast pairs clear 4.5:1 comfortably (minimum computed: 5.88:1).

- **`--ring` was never evaluated by any prior `DSN` story — verified.** Story 36's token reconciliation table (`CONVENTIONS.md` § 25) covers `--primary`, `--secondary`, `--accent`, `--destructive`, `--chart-1..5`, `--font-sans`, `--font-arabic`, `--radius` — no `--ring` row exists anywhere in it. `MASTER.md`'s own table has a `Ring | #475569` row that has sat unadopted since `DSN-0`. The intake's task 3 ("hover/focus/active states" for buttons/inputs) is where this story picks it up — not task 2 (surface tokens), since a focus ring is a state indicator, not a surface. Light `--ring` becomes `#475569` (identical hex to `--muted-foreground`, verified **7.24:1** against the new light `--background` — WCAG 2.4.11's non-text 3:1 minimum, cleared with large margin). **Dark `--ring` is left unchanged** (`oklch(0.556 0 0)`, the current shadcn default) — verified **4.03:1** against the *new* dark `--background` and **3.57:1** against the new dark `--card`, both still clearing the 3:1 floor, so retinting it is not needed and this story does not invent an unverified dark-mode ring color.
- **`--input` and `--popover` are not named by the intake, but are provably tied to tokens that are, in the code as it exists today.** Verified: `frontend/src/index.css`'s current `:root` has `--input: oklch(0.922 0 0)` — **identical** to the current `--border: oklch(0.922 0 0)`. `.dark` has `--popover: oklch(0.205 0 0)` — **identical** to the current `--card: oklch(0.205 0 0)`. Retinting `--border`/`--card` without carrying `--input`/`--popover` along would silently break an equality this codebase's own current values establish, producing a visible mismatch (an input's border would no longer match a card's border; a dropdown menu would no longer match a card's fill) that nothing asked for and nothing would explain later. Task 2 keeps both equalities intact — the same "read real code before applying a generic spec" resolution Story 36 used for the `--secondary` conflict.
- **No backend change, no migration** — this entire story is `frontend/` plus `CONVENTIONS.md`.

---

## Story Goal

Replace the top-bar shell with a real app shell: a collapsible, icon-plus-label sidebar carrying every nav link, notification bell, user identity, logout, language switcher, and theme toggle that `RootLayout`'s header carries today — with **zero** change to which links exist, what permission gates them, or what route they point at. Alongside it, retint the base surface tokens so light and dark mode both have genuine depth instead of a single flat grey, and polish the shared `Button`/`Input`/`Select`/form-field primitives so every screen inherits considered hover/focus/active states with no per-feature change.

1. **Sidebar navigation shell** — `frontend/src/app/RootLayout.tsx`'s `<header>`/top `<nav>` becomes a new `frontend/src/app/Sidebar.tsx` (a `<aside>`, one new file — this app shell has exactly one consumer, so it does not belong in `shared/ui/`, the same reasoning `CONVENTIONS.md` § 23 already applies to single-consumer components), rendered on the document's logical **start** side by ordinary DOM order in a `flex` row — no `start-*`/manual RTL branching needed, since a plain `flex` row already reverses visually under `dir="rtl"` while staying first in markup. Collapsible to an icon-only rail; state persisted to `localStorage`, the same "remembered per-viewer preference" pattern `shared/theme/theme.ts` already established for the theme choice.
2. **Light/dark surface retint** — `--background`/`--foreground`/`--card`/`--muted`/`--muted-foreground`/`--border` (plus the tied `--input`/`--popover`) in both `:root` and `.dark`, per the computed values in `## Prerequisites`.
3. **Button/Input/Select/form-field primitive polish** — component-level only: `font-semibold` on buttons (MASTER's 600 weight), a small shadow + `-translate-y-px` hover lift + `active:translate-y-0` press-back on filled button variants, `border-color` added to `input.tsx`/`select.tsx`'s transition-property list (currently silently excluded — a real, verified anti-pattern hit per MASTER's own "instant state changes" rule), and the `--ring` retint from `## Prerequisites`. No shared field component in `shared/ui/form/` needs its own edit — all of them render through `Input`/`Select`/`Button`, so the primitive-level fix is inherited automatically.
4. **Full-app QA pass** — every one of the 34 current routes (the same list Story 50's own Verification Steps enumerated, still current — no route changed between that story and this one), in both languages/directions and both color modes, confirming every permission-gated link still shows/hides correctly inside the new sidebar and no screen is left half-migrated.

### Explicitly out of scope

- **`frontend/src/features/portal/components/PortalLayout.tsx`.** The intake names `RootLayout.tsx` only. The portal shell is a deliberately separate, simpler customer-facing top nav (Story 42's own *"a customer-facing shell must not render inside the staff `RootLayout`"* boundary) — this story does not touch it, does not give it a sidebar, and does not retint anything portal-specific beyond what the shared `index.css` tokens already propagate everywhere by nature of being tokens.
- **A mobile / off-canvas variant of the sidebar.** Verified: this codebase has no established responsive-breakpoint navigation pattern anywhere today (grepped for `sm:`/`md:`/`lg:`/`xl:` Tailwind prefixes across `frontend/src` — 5 hits total, all either shadcn-default leftovers on `dialog.tsx`/`input.tsx`/`textarea.tsx` or one deliberate content-grid breakpoint on `TicketDetailPage.tsx`; none is a mobile-nav pattern). Building a Sheet-based mobile fallback here would be inventing a responsive strategy this app has never had, for a screen size the intake does not mention — the same "no speculative UI" restraint `CustomerListPage`'s own Story 10 already established as precedent.
- **The official shadcn `sidebar` CLI component** (`SidebarProvider`, cookie-persisted SSR-aware state, `useIsMobile`, keyboard shortcut, `SidebarRail`, etc.). This is a client-only Vite SPA with no SSR, so the cookie-based state-hydration machinery that component solves for is solving a problem this app does not have. A plain `<aside>` with `useState` + `localStorage`, built the same way `CustomerListPage`'s existing `<Card>`/`<Table>` composition already is, is the right amount of machinery — not a new component library, still built from the same already-installed `radix-ui` package every other primitive uses.
- **`--accent`/`--accent-foreground`, `--chart-1..5`, `--font-sans`/`--font-arabic`, `--radius`, `--sidebar-*` tokens.** All either already resolved (Story 36/38) or "Keep current" with standing reasoning that still applies — this story adds no new reason to revisit any of them. (The pre-existing `--sidebar*` tokens in `index.css`, unused since `shadcn init`, are **not** reused by this story's hand-built sidebar — see task 2's own note.)
- **Field-level changes inside `shared/ui/form/*.tsx`.** Every field component (`TextField`, `SelectField`, `CheckboxField`, `SwitchField`, `RadioGroupField`, `TextareaField`, `FileField`) composes `Input`/`Select`/`Checkbox`/`Switch`/`RadioGroup`/`Textarea` primitives directly with no styling of its own beyond layout (`FormItem`'s `grid gap-2`, confirmed unchanged and still DSN-compliant per Story 50's own audit) — the primitive-level fix in task 3 propagates to all seven with zero additional edits.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-95/intake.md` — four task blocks, no attachments, no acceptance criteria.
2. `CONVENTIONS.md` § 25 (lines 1472-1655) — the full `DSN` spec including Story 50's appended subsection; task 5 below appends one more.
3. `design-system/supportos/MASTER.md` lines 17-38 (Color Palette table — the source of every light-mode value in `## Prerequisites`) and lines 165-183 (Style Guidelines — "Minimalism & Swiss Style," "clear type hierarchy," the framing this story's depth/contrast fix serves).
4. `frontend/src/index.css` (current state, post-Story-50 — 187 lines) — `:root` lines 10-58 and `.dark` lines 61-98 (the exact blocks task 2 edits; `--success`/`--warning`/`--info`, added by Story 50 immediately after `--destructive`, are the anchor to insert nothing before and edit nothing of). `@theme inline` lines 100-146 already maps every `--color-*` name used here — **no mapping change needed**, only values.
5. `frontend/src/app/RootLayout.tsx` (current state, post-Story-50 — 125 lines, full) — the file task 1 restructures. Read the exact 9-link nav (lines 40-103) and the `ms-auto` utility cluster (lines 105-117) — every `<Can>` wrapper, every `t(...)` call, every `Link to=` target in this file is preserved verbatim in the new sidebar, only the surrounding container changes.
6. `frontend/src/shared/theme/theme.ts` and `config.ts` (full) — the `getTheme`/`setTheme`/`subscribeTheme` + `THEME_STORAGE_KEY` pattern task 1's sidebar-collapse persistence mirrors in spirit (plain `localStorage`, not a full external-store — collapse state has exactly one consumer, `Sidebar.tsx` itself, unlike theme which many components read).
7. `frontend/src/shared/i18n/useDirection.ts` (full, 30 lines) — confirms the one existing "read direction in React" hook, subscribed to the same i18next event `direction.ts` uses. Not needed for the sidebar's own side placement (plain DOM order handles that), but is what task 1 uses if any chevron/collapse-toggle icon needs to visually flip.
8. `frontend/src/shared/ui/primitives/button.tsx` (63 lines, full), `input.tsx` (22 lines, full), `select.tsx` (179 lines, full, especially `SelectTrigger`'s `transition-[color,box-shadow]` at the line inside its class string) — the three files task 3 edits.
9. `frontend/src/shared/ui/ThemeToggle.tsx` (51 lines, full) and `LanguageSwitcher.tsx` (44 lines, full) — both move into the sidebar footer unmodified; both already own their own `DropdownMenu`/`Select` positioning, and Radix's own collision-avoidance (verified: `DropdownMenuContent`'s existing `data-[side=...]` styling in `dropdown-menu.tsx` already covers all four flip directions) repositions them automatically if the sidebar-footer trigger is near a viewport edge — no prop change needed on either component.
10. `frontend/src/features/notifications/components/NotificationBell.tsx` (post-Story-50 state, 127 lines) — moves into the sidebar footer unmodified, same reasoning.
11. `frontend/src/app/router.tsx` (358 lines, full) — confirms the current, complete 34-route tree (unchanged since Story 50) that `## Verification Steps` walks; also confirms `RootLayout` and `PortalLayout` are two separate route-tree roots, the structural fact behind this story's portal-layout exclusion.
12. `frontend/index.html` — the anti-FOUC `<script>` for theme (task 1's sidebar-collapse state needs no equivalent: it affects layout width, not page-wide color, so a one-frame default-expanded flash before `localStorage` resolves is not a FOUC-class problem worth a second inline script for).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Preserve every existing permission gate, i18n label, and route unchanged.** | Intake, task 1 | Every `<Can permission="...">`, every `t('...')` call, every `Link to="..."` in `RootLayout.tsx` moves into `Sidebar.tsx` verbatim — no key renamed, no permission string changed, no route changed. |
| **Sidebar sits on the logical start side, flipping with direction.** | Intake, task 1 | Plain DOM order in a `flex` row container — no `start-*`/`end-*` positioning class, no direction branch. Verified pattern: this is exactly how a `flex-row` container already behaves under `dir="rtl"` with no JS. |
| **Surface retint covers `background`/`foreground`/`card`/`muted`/`border`, both themes.** | Intake, task 2 | `frontend/src/index.css`, both `:root` and `.dark`. `--input`/`--popover` also updated (not named, but tied by an existing equality in the current code — see `## Prerequisites`). |
| **Primitive-level only; no per-feature override.** | Intake, task 3 constraints | `button.tsx`/`input.tsx`/`select.tsx` are the only files task 3 edits; zero feature files touched, zero `shared/ui/form/*` field components touched. |
| **No new component library.** | Intake description (echoing Story 50's own standing constraint) | The sidebar is a hand-built `<aside>` on the already-installed `radix-ui` package, not a new dependency; no `sidebar`/`sheet`/`tooltip` CLI primitive is added unless task 1 itself needs one (it does not — see `## Story Goal`). |
| Config from `ENV`; no new secrets, no new dependency. | Story 01 `ENV` contract | This story adds no environment variable and no new `package.json` entry. |

---

## Implementation Tasks

### 1 — Sidebar navigation shell

**Create file: `frontend/src/app/Sidebar.tsx`** — the nav content, collapse state, and localStorage persistence, extracted so `RootLayout.tsx` stays a thin shell wrapper (mirrors why `TicketConversation` lives with its one consumer rather than in `shared/`, per `CONVENTIONS.md` § 23 — this component has exactly one consumer, `RootLayout`, and does not belong in `shared/ui/` either).

```tsx
import { useState } from 'react'
import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import {
  BookOpenIcon,
  ContactIcon,
  FileTextIcon,
  InboxIcon,
  ListTodoIcon,
  SearchIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserCogIcon,
} from 'lucide-react'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { Can, useAuth } from '@/shared/auth'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/primitives/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

const COLLAPSE_STORAGE_KEY = 'supportos.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Every nav link, exactly as `RootLayout.tsx` rendered it before this story —
 * same `<Can>` gates, same `t(...)` keys, same `Link to`. Only the wrapper
 * (`SidebarLink` below) and the container (`<aside>` in `RootLayout.tsx`)
 * changed. See Story 51 `## Story Goal`.
 */
function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  icon: typeof ContactIcon
  label: string
  collapsed: boolean
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn('justify-start gap-2', collapsed && 'justify-center px-0')}
    >
      <Link to={to} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}>
        <Icon />
        {collapsed ? null : label}
      </Link>
    </Button>
  )
}

export function Sidebar() {
  const { t } = useTranslation([
    'common',
    'customers',
    'tickets',
    'tasks',
    'knowledgeBase',
    'accounts',
  ])
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next))
      } catch {
        // Per-viewer convenience only — a private window or blocked storage
        // just means the preference doesn't persist, not a broken sidebar.
      }
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex h-dvh flex-col border-e bg-card transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-3">
        {collapsed ? null : <span className="flex-1 truncate font-semibold">{t('app.name')}</span>}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleCollapsed}
          aria-label={t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}
        >
          {collapsed ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
        </Button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <Can permission="customers.view">
          <SidebarLink
            to="/customers"
            icon={ContactIcon}
            label={t('customers:title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="tickets.view">
          <SidebarLink to="/tickets" icon={TicketIcon} label={t('tickets:title')} collapsed={collapsed} />
          <SidebarLink
            to="/tickets/my-tickets"
            icon={InboxIcon}
            label={t('tickets:myQueue.title')}
            collapsed={collapsed}
          />
        </Can>
        <SidebarLink to="/tasks" icon={ListTodoIcon} label={t('tasks:title')} collapsed={collapsed} />
        <Can permission="knowledge_base.view">
          <SidebarLink
            to="/knowledge-base"
            icon={BookOpenIcon}
            label={t('knowledgeBase:title')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/knowledge-base/articles"
            icon={FileTextIcon}
            label={t('knowledgeBase:articles.title')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/knowledge-base/search"
            icon={SearchIcon}
            label={t('knowledgeBase:search.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="users.view">
          <SidebarLink
            to="/users"
            icon={UserCogIcon}
            label={t('accounts:users.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="roles.manage">
          <SidebarLink
            to="/roles"
            icon={ShieldCheckIcon}
            label={t('accounts:roles.title')}
            collapsed={collapsed}
          />
        </Can>
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t p-2">
        {user ? (
          <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
            <NotificationBell />
            {collapsed ? null : (
              <span className="flex-1 truncate text-sm text-muted-foreground">{user.email}</span>
            )}
          </div>
        ) : null}
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : '')}>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        {user ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn('justify-start', collapsed && 'justify-center px-0')}
            onClick={() => void logout()}
          >
            {collapsed ? null : t('actions.logout')}
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
```

**Why plain DOM order, not a `start-0`/direction class:** a `flex` row container with the sidebar as its first child already renders the sidebar visually on the left in `dir="ltr"` and on the right in `dir="rtl"` — this is standard CSS flexbox bidi behavior, not a SupportOS-specific mechanism, and it means **no** `useDirection()` call or `rtl:` variant is needed anywhere in `Sidebar.tsx` for placement itself. The one place direction *does* matter is purely cosmetic (`border-e`, already a logical property — flips automatically, no extra work).

**`ChevronsLeftIcon`/`ChevronsRightIcon` are static, not RTL-swapped**, unlike `DataTablePagination`'s prev/next chevrons. Those represent "previous page"/"next page," a *directional* concept that must flip with reading direction. "Collapse the sidebar toward its own edge" is not directional in the same sense — the icon means "make the sidebar narrower," and a static per-collapsed-state icon (pointing away from the sidebar when expanded, toward it when collapsed) reads correctly in both directions without a `dir` branch. Verify this reads naturally in the live QA pass (task 4) rather than assuming it.

**File: `frontend/src/app/RootLayout.tsx`** — replace the `<header>` and its contents with the new `Sidebar`, inside a `flex` row:

```tsx
import { Outlet } from 'react-router'

import { Sidebar } from './Sidebar'

export function RootLayout() {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

Every import this file used only for the header (`Link`, `useTranslation`, `NotificationBell`, `Can`, `useAuth`, `Button`, `LanguageSwitcher`, `ThemeToggle`, all 9 icon imports) moves to `Sidebar.tsx` and is removed from `RootLayout.tsx` — `RootLayout.tsx` no longer needs any of them.

**File: `frontend/src/features/accounts/locales/en.json`/`ar.json`** — add two new keys under a new `sidebar` object (a namespace that does not exist yet under `accounts`; place it in the already-registered `common` namespace instead, since the collapse toggle is app-shell chrome, not an accounts-domain string): **File: `frontend/src/shared/i18n/locales/en/common.json`/`ar/common.json`** — add:

```json
{
  "sidebar": {
    "collapse": "Collapse sidebar",
    "expand": "Expand sidebar"
  }
}
```

(alongside the existing `app`/`actions`/`states`/`table` top-level keys — both languages, matching key set.)

---

### 2 — Surface token retint

**File: `frontend/src/index.css`** — replace the named lines in `:root` (currently, post-Story-50: `--background` line ~12, `--foreground` line ~13, `--card`/`--card-foreground` lines ~14-15, `--muted`/`--muted-foreground` lines ~22-23, `--border` line ~37, `--input` line ~38) with the computed light values from `## Prerequisites`:

```css
  --background: oklch(0.984 0.003 247.858); /* #F8FAFC — MASTER.md Background */
  --foreground: oklch(0.279 0.037 260.031); /* #1E293B — MASTER.md Foreground */
  --card: oklch(1 0 0); /* #FFFFFF — MASTER.md Card; unchanged value, now genuinely distinct from --background */
  --card-foreground: oklch(0.279 0.037 260.031); /* mirrors --foreground */
  --popover: oklch(1 0 0); /* unchanged — already mirrors --card in both themes */
  --popover-foreground: oklch(0.279 0.037 260.031);
  /* ...--primary/--secondary/--accent/--destructive/--success/--warning/--info unchanged (Story 36/50)... */
  --muted: oklch(0.949 0.008 241.666); /* #EAEFF3 — MASTER.md Muted */
  --muted-foreground: oklch(0.446 0.037 257.281); /* #475569 — MASTER.md Muted Foreground */
  --border: oklch(0.929 0.013 255.508); /* #E2E8F0 — MASTER.md Border */
  --input: oklch(0.929 0.013 255.508); /* mirrors new --border — preserves the equality verified in current code */
  --ring: oklch(0.446 0.037 257.281); /* #475569 — MASTER.md Ring, adopted here (task 3's focus-state concern, see ## Prerequisites) */
```

And in `.dark`:

```css
  --background: oklch(0.17 0.02 257); /* independently derived — see ## Prerequisites */
  --foreground: oklch(0.96 0.005 257);
  --card: oklch(0.23 0.02 257);
  --card-foreground: oklch(0.96 0.005 257);
  --popover: oklch(0.23 0.02 257); /* mirrors new --card — preserves the equality verified in current code */
  --popover-foreground: oklch(0.96 0.005 257);
  --muted: oklch(0.28 0.02 257);
  --muted-foreground: oklch(0.72 0.02 257);
  /* --border and --input are UNCHANGED: oklch(1 0 0 / 10%) and oklch(1 0 0 / 15%).
     Both are alpha-over-background overlays, not fixed hues — they already
     recompose correctly against the new, darker --background with no edit.
     --ring is also UNCHANGED (oklch(0.556 0 0)) — verified 4.03:1 against
     the new --background and 3.57:1 against the new --card, both still
     clearing WCAG 2.4.11's 3:1 floor. See ## Prerequisites. */
```

Do **not** touch `--accent`/`--accent-foreground`, `--chart-1..5`, `--success`/`--warning`/`--info`, `--sidebar-*`, `--font-sans`/`--font-arabic`, or `--radius` in either block.

**The pre-existing `--sidebar*` tokens are not reused.** `index.css` already carries `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` — shipped by the original `shadcn init` for the official CLI `sidebar` component this story deliberately does not adopt (see `## Story Goal`). Task 1's hand-built `<aside>` uses `bg-card`/`border-e` (the ordinary surface tokens, now retinted by this task) instead — leaving the unused `--sidebar*` tokens exactly as they are, still unused, not a dead-code concern this story is scoped to clean up.

---

### 3 — Button, Input, Select primitive polish

**File: `frontend/src/shared/ui/primitives/button.tsx`** — three changes to `buttonVariants`:

1. Base class string (line 8): `font-medium` → `font-semibold` (MASTER's button spec: `font-weight: 600`).
2. Base class string: add `duration-200` next to the existing `transition-all` (MASTER: `transition: all 200ms ease` — Tailwind's unstated default is 150ms).
3. `default`/`secondary`/`destructive` variants (the three *filled* variants — not `outline`/`ghost`/`link`, which have no fill to lift off): add `shadow-xs hover:-translate-y-px active:translate-y-0` to each variant's class string. `shadow-xs` is Tailwind v4's built-in small-shadow utility (`0 1px 2px 0 rgb(0 0 0 / 0.05)`) — an **exact** match to MASTER's own `--shadow-sm` value, already used elsewhere in this codebase (`input.tsx`, `select.tsx`'s `SelectTrigger`) for the same weight of shadow, so no new value is introduced. `-translate-y-px` is Tailwind's `1px` spacing step — an exact match to MASTER's `hover: transform: translateY(-1px)`. `active:translate-y-0` (this story's own addition, no DSN source — MASTER's button spec has no `:active` state) gives a tactile "pressed" cancel-the-lift on click, the natural complement to the added hover lift.

```tsx
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:-translate-y-px active:translate-y-0',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:-translate-y-px active:translate-y-0 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:-translate-y-px active:translate-y-0',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // size block unchanged
    },
    // defaultVariants unchanged
  },
)
```

`outline` keeps its existing `shadow-xs` (already there today) but gets **no** hover-lift — it has no fill to lift, and MASTER's own component spec only defines `.btn-primary`'s hover lift, not a bordered/transparent button's. `ghost`/`link` get neither shadow nor lift — both are already visually minimal by design (no background, no border), and adding a shadow to a transparent button would be adding a visible box around something meant to look chromeless.

**File: `frontend/src/shared/ui/primitives/input.tsx`** — the transition-property list at line 11 excludes `border-color`, so the `focus-visible:border-ring` color change happens with **no** transition today — a real, verified instance of MASTER's own "instant state changes" anti-pattern, not a guess:

```tsx
'transition-[color,box-shadow,border-color] duration-200',
```

(replaces `'transition-[color,box-shadow]'`; `duration-200` added for the same MASTER-cited 200ms this story applies to buttons — Tailwind's arbitrary-property transition has no implicit duration otherwise).

**File: `frontend/src/shared/ui/primitives/select.tsx`** — `SelectTrigger`'s class string has the identical gap (`transition-[color,box-shadow]`, no `border-color`, no explicit duration) — same fix:

```tsx
'transition-[color,box-shadow,border-color] duration-200',
```

**No radius change to any of the three files** — `button.tsx`/`input.tsx` both already use `rounded-md` (8px), an exact match to MASTER's button/input radius target, verified newly in this story (Story 36 verified `input.tsx`'s radius but never explicitly checked `button.tsx`'s, which happens to already match). **No sizing/height change** — `button.tsx`'s `h-9`/`h-8`/`h-10` scale intentionally stays aligned with `input.tsx`'s `h-9` and `select.tsx`'s `data-[size=default]:h-9`/`data-[size=sm]:h-8`, so buttons and inputs continue to sit flush in the same row; MASTER's literal `padding: 12px 24px` is **not** applied verbatim, because doing so would either overflow the fixed height or force removing it, breaking that alignment for a generic recommendation that has no visibility into this project's own established component-height invariant. This is the same class of judgment call as Story 36's `--radius` resolution ("component-level, not token-scale").

---

### 4 — Full-app QA pass

Every one of the 34 routes Story 50's own `## Verification Steps` enumerated (unchanged since — no route added or removed between that story and this one):

**Main tree:** `/login`, `/chat`, `/contact`, `/` (`HealthPage`), `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/tickets`, `/tickets/new`, `/tickets/my-tickets`, `/tickets/:id`, `/tickets/:id/edit`, `/knowledge-base/manage`, `/knowledge-base/manage/new`, `/knowledge-base/manage/:id/edit`, `/knowledge-base/articles/manage`, `/knowledge-base/articles/manage/new`, `/knowledge-base/articles/manage/:id/edit`, `/knowledge-base`, `/knowledge-base/articles`, `/knowledge-base/articles/:id`, `/knowledge-base/search`, `/users`, `/users/new`, `/users/:id/edit`, `/roles`, `/roles/new`, `/roles/:id/edit`, `/tasks`, `/tasks/new`, `/tasks/:id/edit`, and `*` (`NotFoundPage`).

**Portal tree (unaffected by this story — walked only to confirm it, verifying zero regression, not to re-test it):** `/portal`, `/portal/faqs`, `/portal/articles`, `/portal/articles/:id`, `/portal/tickets`, `/portal/tickets/history`, `/portal/tickets/new`, `/portal/tickets/:id`, `/portal/tickets/:id/feedback`.

For each main-tree route: confirm the sidebar renders instead of the old header, the page content sits beside it (not underneath), and no layout is broken. Toggle collapse/expand once per session and confirm it persists across a page navigation (not a full reload — `localStorage` read happens once at `Sidebar` mount, so a client-side route change must **not** reset it, since `Sidebar` does not remount on navigation within `RootLayout`). Repeat the full pass in dark theme, then in Arabic (confirming the sidebar renders on the visual right with no separate code path), then both together.

---

## Documentation Tasks

### 5 — Record this story in `CONVENTIONS.md` § 25

**File: `CONVENTIONS.md`** — append one more token-reconciliation row (after Story 50's `--success`/`--warning`/`--info` row) and one new subsection after Story 50's:

```markdown
| `--background`/`--foreground`/`--card`/`--card-foreground`/`--muted`/`--muted-foreground`/`--border` (surface tokens), plus tied `--input`/`--popover` | shadcn's untouched greyscale defaults | `MASTER.md`'s Color Palette table, directly (light mode only — no dark-mode row exists in the generated output) | **Adopted (Story 51)** | Light-mode values are MASTER.md's own hexes, converted and contrast-verified (13.98:1–7.24:1 across all text pairs). Dark-mode values have no DSN source — independently derived at the same ~257° hue family, contrast-verified (17.02:1–5.88:1). `--input`/`--popover` follow `--border`/`--card` respectively, preserving an equality already present in the pre-Story-51 code. |
| `--ring` (new) | shadcn default, `oklch(0.708 0 0)` / `oklch(0.556 0 0)` | `#475569` (MASTER.md's own "Ring" row — never adopted by any prior story) | **Adopted (Story 51), light only** | Verified 7.24:1 against the new light `--background` (WCAG 2.4.11 non-text minimum is 3:1). Dark `--ring` is unchanged — verified 4.03:1/3.57:1 against the new dark `--background`/`--card`, still clearing 3:1, so no dark-mode value was invented. |
```

```markdown
### App shell: sidebar navigation & primitive polish (`DSN-5`, Story 51)

`RootLayout.tsx`'s top `<nav>` became `app/Sidebar.tsx` — a hand-built `<aside>`
(not the official shadcn CLI `sidebar` component, which solves an SSR-cookie
hydration problem this client-only SPA does not have), collapsible to an
icon-only rail via `useState` + `localStorage`
(`supportos.sidebar.collapsed`), positioned by plain DOM order in a `flex`
row rather than a direction-branched class — flexbox already reverses
visually under `dir="rtl"` with the sidebar first in markup. Every
`<Can>`-gated link, `t(...)` key, and route from the prior top nav moved
across unchanged. `PortalLayout.tsx` (the customer-facing shell) is
untouched — a deliberately separate, simpler top nav since Story 42.

`button.tsx`/`input.tsx`/`select.tsx` gained MASTER-guided polish:
`font-semibold` and a `shadow-xs` + `-translate-y-px` hover lift (with an
`active:translate-y-0` press-back, this story's own addition — MASTER
defines no `:active` state) on the three filled button variants;
`border-color` added to `input.tsx`/`select.tsx`'s transition-property list,
fixing a real, verified "instant state change" on focus (the property was
silently excluded before this story); `duration-200` added throughout,
matching MASTER's 200ms. No height/padding/radius change — this project's
existing button/input/select height-alignment invariant (`h-9` shared
across all three) is verified compliant with MASTER's radius target already
and takes precedence over MASTER's literal padding numbers, which would
have broken that alignment.
```

Do not renumber § 0-§ 25's own internal subsections; both additions land inside the existing § 25 body, after Story 50's.

No change to root `README.md` or `frontend/src/README.md` — no new environment variable, no new dependency, and the app-shell change is internal layout, not a documented API surface either file currently describes.

---

## Edge Cases & Failure Modes

- **`localStorage` throwing (private browsing, blocked storage) must not break the sidebar.** Both `readCollapsed()` and the setter in `toggleCollapsed()` are wrapped in `try`/`catch` — a blocked read defaults to expanded (`false`), a blocked write just means the preference does not persist, not a crash. Mirrors the same defensive posture `shared/theme/theme.ts` already uses for its own `localStorage` calls.
- **Collapsed state loses every link's visible text — the `aria-label`/`title` pair on `SidebarLink` is what keeps it accessible**, not decorative. Without it, a collapsed icon-only `<Link>` has no accessible name at all (its only child, the icon `<svg>`, is not text) — a regression Story 37's own icon-only-button audit would have flagged had it existed at Story 37's time.
- **The sidebar's own collapse toggle button needs its own `aria-label` in both states** (`sidebar.collapse`/`sidebar.expand`, task 1's new locale keys) — a plain icon button with no visible text, the same pattern every other icon-only `Button` in this app already follows (`NotificationBell`, `ThemeToggle`, `DataTablePagination`'s prev/next).
- **`Sidebar` must not remount when the route changes**, or `useState(readCollapsed)`'s lazy initializer re-reads `localStorage` every navigation — harmless functionally (same value comes back) but wasteful, and a sign something is wrong if a future refactor causes it. `RootLayout`'s `<Outlet />` is what changes per route, not `<Sidebar />` itself; verify this holds by confirming (React DevTools or a `console.log` in `Sidebar`'s body, removed before committing) that `Sidebar` renders exactly once across several client-side navigations in the QA pass.
- **`ChevronsLeftIcon`/`ChevronsRightIcon`'s "point away from the sidebar" mapping needs a live look in RTL**, not just a code-level assumption — verify in task 4's QA pass that the icon direction still reads as "collapse"/"expand" naturally when the sidebar has flipped to the right side of the screen, adjusting the icon-per-state mapping if it reads backwards (a genuinely open call this plan does not pre-resolve, since it depends on how the icon looks against a mirrored layout, not on anything computable in advance).
- **`h-dvh` on the sidebar, `min-h-dvh` on the outer container** — the outer wrapper must allow content taller than the viewport to scroll (`main`'s content, e.g. a long ticket detail page), while the sidebar itself stays pinned to the full viewport height regardless of `main`'s scroll position. Verify a long page's scroll does not drag the sidebar with it.
- **A future `shadcn add sidebar` must not silently overwrite `Sidebar.tsx`.** It would not — `Sidebar.tsx` lives in `app/`, not `shared/ui/primitives/`, so it is not CLI-managed and no `shadcn add` command touches it. Worth stating explicitly since every other primitive this project has customized (`table.tsx`, `form.tsx`, `select.tsx`) carries a "Modified from the shadcn registry" comment warning about exactly this — `Sidebar.tsx` needs no such comment because it was never CLI-generated in the first place.
- **The `--ring` retint changes the visible focus-ring color on every focusable element in the app, not just the sidebar** — expected and correct (it is a single shared token), but worth confirming in the QA pass that a keyboard-focused button/input/select still shows a clearly visible ring in both light and dark mode, not just computing the contrast number in the abstract.
- **Card/Muted/Border retint changes the visible appearance of every `<Card>`, table row hover (`hover:bg-muted/50`), and `<Table>` border in the entire app** — this is the intended, single-token-source blast radius (`CONVENTIONS.md` § 19's own "no per-page color" rule is what makes this possible with zero feature-file edits), not a regression to chase down file-by-file — the QA pass (task 4) is what confirms it landed everywhere, not a targeted diff review.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or removed.

1. No backend impact: this story touches only `frontend/` and `CONVENTIONS.md` — `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass. `check:rtl` matters specifically here — a hand-built sidebar with a collapse toggle is exactly the kind of new layout code that could accidentally introduce a physical-direction class (`left-`/`right-`/`pl-`/`pr-`) instead of a logical one.
3. `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` must still return matches only in `index.css` — the standing check every prior token story has re-run.
4. Manual visual verification, per `## Verification Steps` below — this story's actual "test," same as every prior `DSN` story.

---

## Verification Steps

1. **Static checks:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) all exit 0; `python manage.py test` (from `backend/`) still reports its existing count unaffected.
2. **No stray hardcoded color:** `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` returns matches only in `frontend/src/index.css`.
3. **Contrast spot-check in the running app:** DevTools' own contrast-ratio readout on body text (foreground/background), a card's text, a muted caption, and a focused input's ring — each should read at or above the numbers computed in `## Prerequisites`, in both light and dark mode.
4. **Sidebar renders and every link behaves identically to before.** Sign in as a superuser: all 9 links visible, in the same order, each still navigating to its existing route. Sign in as an account missing `roles.manage` (e.g. `mgr@supportos.local`): the `/roles` link is absent, exactly as it was in the top-bar version. Sign in as an account missing every optional permission (e.g. `agent@supportos.local` without `customers.view`): only `/tasks` (ungated) remains, alongside whatever the account's own permissions grant.
5. **Collapse/expand.** Click the toggle: the sidebar narrows to icon-only, every link's icon remains visible, hovering (or focusing) a link shows its label as a native tooltip via `title`. Navigate to a different route via a collapsed-state link click: the sidebar stays collapsed (state persisted). Reload the page: the sidebar remains in whatever state it was left in (confirms `localStorage` round-trips, not just in-memory state).
6. **RTL.** Switch to Arabic: the sidebar renders on the right edge of the screen with no code branch (confirms the plain-flex-order claim), `border-e` renders on the correct physical edge, and the collapse-toggle icon still reads as "collapse toward the sidebar's own edge" (adjust the icon-per-state mapping now if it reads backwards — see `## Edge Cases`).
7. **Dark mode.** Toggle dark theme with the sidebar both expanded and collapsed: the sidebar's `bg-card` is visibly distinct from the main content area's `bg-background`, matching the same depth relationship confirmed in light mode.
8. **Notification bell, language switcher, theme toggle, logout — all still work from inside the sidebar footer**, including each one's own dropdown/select opening in a sensible direction (not clipped off-screen) when the sidebar is near the bottom of a short viewport.
9. **Full-app QA pass, every current route, both themes, both languages** — the full 34-route main-tree list plus the 9-route portal-tree spot-check in `## Story Goal`'s task 4. Log and fix any straggler screen that still shows the old flat surface or a broken layout next to the new sidebar.
10. **Button/input/select polish, live.** Hover a filled (`default`/`secondary`/`destructive`) button: it lifts 1px with a visible small shadow; click-and-hold: it settles back to baseline while held. Hover `outline`/`ghost`/`link` buttons: no lift, no new shadow (only their existing hover background/underline). Focus a text input or a select trigger via keyboard: the border-color change is now visibly animated (not instant) over the input's `duration-200` transition.
11. **No regression outside scope:** `git diff --stat` confined to `frontend/src/app/RootLayout.tsx`, `frontend/src/app/Sidebar.tsx` (new), `frontend/src/index.css`, `frontend/src/shared/ui/primitives/button.tsx`, `input.tsx`, `select.tsx`, `frontend/src/shared/i18n/locales/{en,ar}/common.json`, and `CONVENTIONS.md` — nothing under `backend/`, nothing under `frontend/src/features/portal/`, no `shared/ui/form/*` field component, no route/query/mutation logic changed anywhere.

---

## Done Criteria

- [ ] `frontend/src/app/Sidebar.tsx` created — all 9 nav links present with their exact prior `<Can>` gate, `t(...)` key, and `Link to`; notification bell, user email, language switcher, theme toggle, and logout all present in the footer.
- [ ] `frontend/src/app/RootLayout.tsx` reduced to a thin `flex` wrapper around `<Sidebar />` and `<main><Outlet /></main>`; no permission/i18n/route logic remains in this file (all moved to `Sidebar.tsx`).
- [ ] Sidebar collapse toggles between full width and icon-only rail; state persists via `localStorage` (`supportos.sidebar.collapsed`) across navigation and reload; every link keeps an accessible name (`aria-label`/`title`) when collapsed.
- [ ] Sidebar renders on the logical start side via plain DOM order — no `start-*`/`end-*` positioning class, no `useDirection()` branch for placement.
- [ ] `frontend/src/shared/i18n/locales/en/common.json` and `ar/common.json` both gain a `sidebar.collapse`/`sidebar.expand` key pair, in step.
- [ ] `frontend/src/index.css` — `--background`/`--foreground`/`--card`/`--card-foreground`/`--muted`/`--muted-foreground`/`--border`/`--input`/`--popover`/`--popover-foreground` updated in `:root`; `--background`/`--foreground`/`--card`/`--card-foreground`/`--muted`/`--muted-foreground`/`--popover`/`--popover-foreground` updated in `.dark` (`--border`/`--input` explicitly unchanged there); `--ring` updated in `:root` only. `--accent`, `--chart-*`, `--success`/`--warning`/`--info`, `--sidebar-*`, `--font-*`, `--radius` all untouched in both blocks.
- [ ] `button.tsx` — `font-semibold`, `duration-200` on the base class; `shadow-xs hover:-translate-y-px active:translate-y-0` added to `default`/`secondary`/`destructive` only, not `outline`/`ghost`/`link`.
- [ ] `input.tsx` and `select.tsx`'s `SelectTrigger` — `border-color` added to the transition-property list; `duration-200` added.
- [ ] No height, padding, or radius change to `button.tsx`/`input.tsx`/`select.tsx`; no edit to any file under `shared/ui/form/`.
- [ ] `frontend/src/features/portal/components/PortalLayout.tsx` and everything under `frontend/src/features/portal/` — untouched.
- [ ] `CONVENTIONS.md` § 25 gains one token-reconciliation row (surface tokens) and one appended subsection (app shell) — appended, § 0-§ 25's internal subsection numbering unchanged.
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` matches only `index.css`.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0; `python manage.py test` unaffected.
- [ ] Full visual QA pass complete across all 34 main-tree routes plus the 9-route portal-tree spot-check, in both themes and both languages/directions, with every permission-gated link still showing/hiding correctly inside the new sidebar.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** This is the last currently-intake'd `DSN` story — `EPIC 8` has no further planned work beyond this one and Story 50 (`DSN-4`) unless a new intake is written.
