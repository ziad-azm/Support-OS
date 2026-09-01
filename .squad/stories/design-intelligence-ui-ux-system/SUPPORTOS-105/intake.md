> **Fetched from jira:** [SUPPORTOS-105](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-105)  
> *Fetched 2026-09-01T12:08:46.608Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-14) — Post-Sign-off UX Findings  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a product team, we want a running home for UI/UX issues users report after DSN-13's sign-off, so that real-world feedback keeps improving the baseline instead of needing a new story per finding. Description: Reported by users once the app was in real use, after DSN-6–DSN-13's audit→fix→verify thread had already closed — not part of the original DSN-6 register. Each distinct finding is its own Task below, added as it comes in; this story accumulates rather than closing after one pass. Dependencies: DSN-13.

	Task: Fix sidebar scroll visibility on long pages — Implement: reported via screenshot of /tickets/:id (staff ticket detail), dark theme — scrolling down a long page's content scrolls the sidebar (app/Sidebar.tsx, rendered inside RootLayout.tsx) out of view along with it, instead of the sidebar staying pinned to the viewport while only <main> scrolls. Confirm the actual current scroll structure of RootLayout.tsx/Sidebar.tsx against the reported symptom first — Sidebar.tsx's <aside> is h-dvh with an internal overflow-y-auto <nav>, which reads as intended to stay viewport-pinned, so whether RootLayout.tsx (or a shared ancestor) actually isolates scroll to <main> or lets the whole page scroll as one unit isn't yet diagnosed. Not yet confirmed whether this reproduces on other long staff pages (/customers/:id, /knowledge-base/articles/:id/edit, etc.) or only on ticket detail. Constraints: layout/CSS-only, no route or permission-gate changes; verify across the same route set DSN-9/DSN-13 already covered. Outcome: the sidebar stays reachable no matter how far the page is scrolled.

	Task: Strengthen action-button affordance app-wide (icon + color, not just Roles) — Implement: originally reported via screenshot of /roles (Roles list) — a deletable role's Actions cell renders RoleListPage.tsx's existing <Button size="sm" variant="ghost"> delete action with no visible border/background, reading ambiguously next to a system role's bordered "System" Badge in the same column. Broadened by a second screenshot, a different list's Actions column showing 8 rows that each just read "Delete" in plain bold ghost-button text with zero visual differentiation row-to-row and no badge/color/icon at all — user's own direction: "make it with color or have also bin icon." Verified against current code — every DataTable "Delete"/destructive action across the app (RoleListPage.tsx, CategoryListPage.tsx, TaskListPage.tsx, FaqListPage.tsx, ArticleListPage.tsx, and others) uses the identical {{<Button size="sm" variant="ghost">
{t('...actions.delete')}
</Button>}} pattern — not broken, but uniformly low-affordance app-wide, not a Roles-specific gap. Give destructive row actions a real affordance via the shared Button/DataTable pattern — e.g. a trash/bin icon (lucide-react's Trash2Icon, already the icon set this app standardizes on per DSN-4) and/or a destructive-tone color treatment, not just plain text — applied once at the shared level so every DataTable consumer inherits it, not a one-off per screen. Constraints: shared-component level; no new component library; preserve existing useConfirm() gating on every delete action untouched. Outcome: every destructive row action is visually distinct and unambiguous at a glance, app-wide.

	Task: Re-evaluate reports/charts on a real charting library — Implement: reported via screenshot of /reports/tickets (Ticket Reports, "Ticket volume over time") — user's own words: "all reports not good want to use best lib to charts and reports". Verified against current code: every chart in the app (LineChart, BarChart, GaugeChart, WaffleChart, ChartDataTable, all under frontend/src/shared/ui/chart/) is hand-built inline SVG with no charting library dependency at all (frontend/package.json has no recharts/chart.js/visx/d3/nivo or similar) — DSN-3's chart-type guidance (CONVENTIONS.md § 25) picked chart types per report but never evaluated adopting a real charting library for the implementation. This is a genuine "no new dependency" decision, the same category UX-018 (Story 65) deferred rather than assumed — needs a product decision on which library (e.g. recharts, visx, chart.js) before a rebuild is planned, weighed against a possible narrower fix (polish the existing hand-built LineChart's rendering — e.g. /reports/tickets's "Last 30 days" default currently plots ~28 zero-value points before a 2-point spike, which reads as broken/empty at a glance) if a full library swap turns out to be disproportionate. Outcome: a scoped decision — adopt a charting library (and which one) or polish current charts — recorded before any rebuild starts, not silently assumed.

	Task: Shrink the sidebar footer and move theme/language into a real settings surface — Implement: reported via screenshot of the Sidebar.tsx footer block (RootLayout.tsx's sidebar, bottom section) — user wants the notification-bell/email/language/theme/logout block made visually smaller, and wants a dedicated settings page to host the dark-mode toggle and language switcher instead of the sidebar footer, which should then drop them. Verified against current code: the footer (Sidebar.tsx lines 285-311) is 3 stacked rows (NotificationBell + email; LanguageSwitcher + ThemeToggle; the Log out button), each with its own gap-3/p-3 padding — the visual bulk the screenshot shows. Constraint that must be resolved before implementing, not assumed: the only existing /settings route (features/organization/components/SettingsPage.tsx) is an org-admin form (name/logo/departments/branches/SLA targets) gated behind settings.manage — most staff users can't reach it, so moving a personal preference like theme/language there as-is would make it unreachable for non-admins. This needs either a new, ungated user-preferences page (or a tab/section within a broader settings area open to every authenticated user, separate from the admin-only org config) — not simply appending fields to the existing gated form. Constraints: preserve the theme/language state mechanism already in place (ThemeToggle/LanguageSwitcher, i18n/local storage), only relocate + restyle; no permission-gate regression (the new surface must stay open to every authenticated user, unlike /settings). Outcome: a visually lighter sidebar footer (bell, email, logout only) and a real, universally-reachable place for personal display preferences.

	Task: Audit Badge/tag color usage app-wide for consistency — Implement: user's own direction: "see all colors in tags please add comments with realted task" — a request to review every Badge usage across the app, not a specific defect reported yet. Verified against current code (not yet a full audit): the shared badge.tsx primitive (frontend/src/shared/ui/primitives/badge.tsx) declares 9 variants — default, secondary, destructive, success, warning, info, outline, ghost, link — added incrementally across DSN-4 (semantic status/priority color-coding) and later stories; no single pass has re-walked every current Badge call site (ticket status/priority, task state, article draft/published, role "System", audit-log action, SLA breach state, etc.) to confirm each still picks the semantically correct variant and that no two unrelated meanings share the same color by coincidence. Walk every <Badge variant="..."> call site app-wide and confirm/correct variant choice against its actual semantic meaning (success = positive/resolved, warning = at-risk, destructive = breached/error, etc.), consistently. Constraints: shared-component level where a systemic mismatch is found; no new badge variant unless a real semantic gap is proven, matching DSN-4's own original bar. Outcome: every tag/badge color in the app is semantically correct and consistent, confirmed by an actual walk of every call site, not assumed.

	Task: Style primary-column table links so they read as links — Implement: reported via screenshot of /categories (Category list), "Name" column — "Account Access", "Billing", "Bug Report", "Feature Request" render as plain white text with no color/underline; user's own words: "this is link but as ui ux i dont know that so can make it color or anything". Verified against current code: CategoryListPage.tsx:48 renders {{<Link to=
{...}
>

{row.name}
</Link>}} with no className at all — Tailwind's Preflight reset strips the browser's default link underline/color, so with nothing added back it's visually indistinguishable from static text. Confirmed app-wide, not category-specific: the identical bare, unstyled {{<Link to=...>

{row.field}
</Link>}} pattern (in a DataTable primary-column cell) also exists in TaskListPage.tsx, FaqListPage.tsx, PortalTicketHistoryPage.tsx, PortalTicketListPage.tsx, CustomerListPage.tsx, MyTicketsPage.tsx, TicketListPage.tsx, RoleListPage.tsx, UserListPage.tsx (a literal grep match — likely not fully exhaustive; ArticleListPage.tsx's multi-line variant of the same pattern wasn't caught by the grep but should be checked too). Give every DataTable primary-column link a real, consistent link affordance (e.g. text-primary + hover:underline, or an underline by default) at the shared level — ideally a small shared style/class applied once, not 10+ per-file edits — so every consuming list inherits it. Constraints: shared-component/CSS-utility level preferred; preserve every existing to/route target exactly; verify contrast holds in both light/dark. Outcome: every clickable table-cell link is visually recognizable as a link, everywhere in the app, from one change.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-105/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-105` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-14) — Post-Sign-off UX Findings
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a product team, we want a running home for UI/UX issues users report after DSN-13's sign-off, so that real-world feedback keeps improving the baseline instead of needing a new story per finding. Description: Reported by users once the app was in real use, after DSN-6–DSN-13's audit→fix→verify thread had already closed — not part of the original DSN-6 register. Each distinct finding is its own Task below, added as it comes in; this story accumulates rather than closing after one pass. Dependencies: DSN-13.

	Task: Fix sidebar scroll visibility on long pages — Implement: reported via screenshot of /tickets/:id (staff ticket detail), dark theme — scrolling down a long page's content scrolls the sidebar (app/Sidebar.tsx, rendered inside RootLayout.tsx) out of view along with it, instead of the sidebar staying pinned to the viewport while only <main> scrolls. Confirm the actual current scroll structure of RootLayout.tsx/Sidebar.tsx against the reported symptom first — Sidebar.tsx's <aside> is h-dvh with an internal overflow-y-auto <nav>, which reads as intended to stay viewport-pinned, so whether RootLayout.tsx (or a shared ancestor) actually isolates scroll to <main> or lets the whole page scroll as one unit isn't yet diagnosed. Not yet confirmed whether this reproduces on other long staff pages (/customers/:id, /knowledge-base/articles/:id/edit, etc.) or only on ticket detail. Constraints: layout/CSS-only, no route or permission-gate changes; verify across the same route set DSN-9/DSN-13 already covered. Outcome: the sidebar stays reachable no matter how far the page is scrolled.

	Task: Strengthen action-button affordance app-wide (icon + color, not just Roles) — Implement: originally reported via screenshot of /roles (Roles list) — a deletable role's Actions cell renders RoleListPage.tsx's existing <Button size="sm" variant="ghost"> delete action with no visible border/background, reading ambiguously next to a system role's bordered "System" Badge in the same column. Broadened by a second screenshot, a different list's Actions column showing 8 rows that each just read "Delete" in plain bold ghost-button text with zero visual differentiation row-to-row and no badge/color/icon at all — user's own direction: "make it with color or have also bin icon." Verified against current code — every DataTable "Delete"/destructive action across the app (RoleListPage.tsx, CategoryListPage.tsx, TaskListPage.tsx, FaqListPage.tsx, ArticleListPage.tsx, and others) uses the identical { {<Button size="sm" variant="ghost">
{t('...actions.delete')}
</Button>}} pattern — not broken, but uniformly low-affordance app-wide, not a Roles-specific gap. Give destructive row actions a real affordance via the shared Button/DataTable pattern — e.g. a trash/bin icon (lucide-react's Trash2Icon, already the icon set this app standardizes on per DSN-4) and/or a destructive-tone color treatment, not just plain text — applied once at the shared level so every DataTable consumer inherits it, not a one-off per screen. Constraints: shared-component level; no new component library; preserve existing useConfirm() gating on every delete action untouched. Outcome: every destructive row action is visually distinct and unambiguous at a glance, app-wide.

	Task: Re-evaluate reports/charts on a real charting library — Implement: reported via screenshot of /reports/tickets (Ticket Reports, "Ticket volume over time") — user's own words: "all reports not good want to use best lib to charts and reports". Verified against current code: every chart in the app (LineChart, BarChart, GaugeChart, WaffleChart, ChartDataTable, all under frontend/src/shared/ui/chart/) is hand-built inline SVG with no charting library dependency at all (frontend/package.json has no recharts/chart.js/visx/d3/nivo or similar) — DSN-3's chart-type guidance (CONVENTIONS.md § 25) picked chart types per report but never evaluated adopting a real charting library for the implementation. This is a genuine "no new dependency" decision, the same category UX-018 (Story 65) deferred rather than assumed — needs a product decision on which library (e.g. recharts, visx, chart.js) before a rebuild is planned, weighed against a possible narrower fix (polish the existing hand-built LineChart's rendering — e.g. /reports/tickets's "Last 30 days" default currently plots ~28 zero-value points before a 2-point spike, which reads as broken/empty at a glance) if a full library swap turns out to be disproportionate. Outcome: a scoped decision — adopt a charting library (and which one) or polish current charts — recorded before any rebuild starts, not silently assumed.

	Task: Shrink the sidebar footer and move theme/language into a real settings surface — Implement: reported via screenshot of the Sidebar.tsx footer block (RootLayout.tsx's sidebar, bottom section) — user wants the notification-bell/email/language/theme/logout block made visually smaller, and wants a dedicated settings page to host the dark-mode toggle and language switcher instead of the sidebar footer, which should then drop them. Verified against current code: the footer (Sidebar.tsx lines 285-311) is 3 stacked rows (NotificationBell + email; LanguageSwitcher + ThemeToggle; the Log out button), each with its own gap-3/p-3 padding — the visual bulk the screenshot shows. Constraint that must be resolved before implementing, not assumed: the only existing /settings route (features/organization/components/SettingsPage.tsx) is an org-admin form (name/logo/departments/branches/SLA targets) gated behind settings.manage — most staff users can't reach it, so moving a personal preference like theme/language there as-is would make it unreachable for non-admins. This needs either a new, ungated user-preferences page (or a tab/section within a broader settings area open to every authenticated user, separate from the admin-only org config) — not simply appending fields to the existing gated form. Constraints: preserve the theme/language state mechanism already in place (ThemeToggle/LanguageSwitcher, i18n/local storage), only relocate + restyle; no permission-gate regression (the new surface must stay open to every authenticated user, unlike /settings). Outcome: a visually lighter sidebar footer (bell, email, logout only) and a real, universally-reachable place for personal display preferences.

	Task: Audit Badge/tag color usage app-wide for consistency — Implement: user's own direction: "see all colors in tags please add comments with realted task" — a request to review every Badge usage across the app, not a specific defect reported yet. Verified against current code (not yet a full audit): the shared badge.tsx primitive (frontend/src/shared/ui/primitives/badge.tsx) declares 9 variants — default, secondary, destructive, success, warning, info, outline, ghost, link — added incrementally across DSN-4 (semantic status/priority color-coding) and later stories; no single pass has re-walked every current Badge call site (ticket status/priority, task state, article draft/published, role "System", audit-log action, SLA breach state, etc.) to confirm each still picks the semantically correct variant and that no two unrelated meanings share the same color by coincidence. Walk every <Badge variant="..."> call site app-wide and confirm/correct variant choice against its actual semantic meaning (success = positive/resolved, warning = at-risk, destructive = breached/error, etc.), consistently. Constraints: shared-component level where a systemic mismatch is found; no new badge variant unless a real semantic gap is proven, matching DSN-4's own original bar. Outcome: every tag/badge color in the app is semantically correct and consistent, confirmed by an actual walk of every call site, not assumed.

	Task: Style primary-column table links so they read as links — Implement: reported via screenshot of /categories (Category list), "Name" column — "Account Access", "Billing", "Bug Report", "Feature Request" render as plain white text with no color/underline; user's own words: "this is link but as ui ux i dont know that so can make it color or anything". Verified against current code: CategoryListPage.tsx:48 renders { {<Link to=
{...}
>

{row.name}
</Link>}} with no className at all — Tailwind's Preflight reset strips the browser's default link underline/color, so with nothing added back it's visually indistinguishable from static text. Confirmed app-wide, not category-specific: the identical bare, unstyled { {<Link to=...>

{row.field}
</Link>}} pattern (in a DataTable primary-column cell) also exists in TaskListPage.tsx, FaqListPage.tsx, PortalTicketHistoryPage.tsx, PortalTicketListPage.tsx, CustomerListPage.tsx, MyTicketsPage.tsx, TicketListPage.tsx, RoleListPage.tsx, UserListPage.tsx (a literal grep match — likely not fully exhaustive; ArticleListPage.tsx's multi-line variant of the same pattern wasn't caught by the grep but should be checked too). Give every DataTable primary-column link a real, consistent link affordance (e.g. text-primary + hover:underline, or an underline by default) at the shared level — ideally a small shared style/class applied once, not 10+ per-file edits — so every consuming list inherits it. Constraints: shared-component/CSS-utility level preferred; preserve every existing to/route target exactly; verify contrast holds in both light/dark. Outcome: every clickable table-cell link is visually recognizable as a link, everywhere in the app, from one change.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

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

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
