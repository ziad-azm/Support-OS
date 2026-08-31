# Story 61 — (DSN-6) Full UI/UX Audit & Issue Register (Story: SUPPORTOS-97)

## Prerequisites

- **`DSN-0` (Story 35), `DSN-4` (Story 50), `DSN-5` (Story 51) are all complete** (`SupportOs backlog.MD:562`, `Dependencies: DSN-0, DSN-4, DSN-5`). `CONVENTIONS.md` § 25 documents all three as done — `DSN-5`'s own subsection ("App shell: sidebar navigation & primitive polish," `CONVENTIONS.md` lines 1689-1699) is written in completed past tense and `git log --oneline -- frontend/src/app` confirms `bc60bd3 feat: Implement sidebar navigation and theme backgrounds for app shell (DSN-5)` and a follow-up polish commit `ae0b621`. **`.squad/plans/design-intelligence-ui-ux-system/00-overview.md` line 30 is stale** — it still reads "Story 51 (`DSN-5`...) is planned, not yet implemented." Correct that line when this story updates the overview (task 3 below); do not treat the stale overview as blocking.
- **`DSN-2` (Story 37) already ran a full accessibility audit-and-fix pass.** Do **not** re-flag any of the following as new findings — they are fixed or confirmed compliant, cited in `CONVENTIONS.md` § 25's "UX & accessibility guidance" subsection (lines ~1618-1660): heading hierarchy (`CardTitle` `asChild` → real `<h1>`/`<h2>`), form-level error announcement (`FormErrorSummary`, `role="alert"`), `cursor-pointer` on all buttons, login `autoComplete`, truncated-text `title` tooltips (3 sites), toast `role="alert"` on error tone, `prefers-reduced-motion` for dialog/select entrance-exit, alt text (no `<img>` anywhere), icon-only button `aria-label`s, no bare `div`/`span onClick`, RTL (`check-rtl.mjs`, CI-wired, zero violations), sortable table `aria-sort`, field `aria-describedby`/`aria-invalid`, touch target size. **Named exceptions `DSN-2` explicitly deferred** — these ARE fair game for this audit if still unresolved: bulk row actions (Low severity, list screens) and 6 standalone `SelectTrigger` usages outside `SelectField` (`TicketAssigneeControl.tsx`, `TicketStatusControl.tsx`, filter selects in `TicketListPage.tsx`/`MyTicketsPage.tsx`/`TaskListPage.tsx`, the quick-reply picker in `TicketConversation.tsx`).
- **The app grew substantially after `DSN-4`/`DSN-5` shipped, and those two stories' own verification passes predate several routes that exist today.** By commit order (`git log --oneline`, oldest of this group first): `c065fca` (`DSN-4`, PageHeader/badges/icons) → `bc60bd3`/`ae0b621` (`DSN-5`, sidebar) → `590c56e` (audit log) → `9a62bbd` (org settings) → `3e7a6ac` (`PublicLayout` split + Login/WebForm UI) → `9686588` (category management UI, Story 54) → `fad3cca`/`71df524`/`8de8499`/`9f1b9ad`/`b261b5c` (all 5 reports pages, Stories 55-60). Verified via `grep -rl PageHeader frontend/src/features` and `grep -rl lucide-react frontend/src/features/reports`: audit-log, settings, categories, roles, users, and all 5 reports pages already **do** use the shared `PageHeader`/icon pattern `DSN-4` established — so this is not a blanket gap, but these routes were never named in any `DSN` story's own checklist and must still be walked fresh for every other category (interaction states, responsive behavior, form UX, IA placement, content/bilingual copy).
- **This is a catalogue-only story** (`SupportOs backlog.MD:564`, "Constraints: catalogue only — no code changes here beyond trivially obvious one-liners"). The deliverable is the register; do not implement fixes. See `## Edge Cases` for what counts as a "trivially obvious one-liner."

---

## Story Goal

Produce **`design-system/supportos/UX-AUDIT.md`** — one authoritative, ID'd register of UX/consistency findings covering every currently built route, that `DSN-7` through `DSN-13` (all already planned in `SupportOs backlog.MD:566-630`, not yet turned into `.squad/plans/` stories) will consume without re-scanning the app.

Each register row has: a **stable ID** (`UX-###`, sequential, assigned once, never renumbered), **screen** (route + component file), **category** (exactly one of `consistency` / `interaction` / `responsive` / `form` / `IA` / `content` / `bilingual`), **severity** (`critical` / `major` / `minor`), a **recommended fix**, and an **owning DSN story**. The category-to-owning-story mapping is fixed by the backlog itself (`SupportOs backlog.MD:566-630`), not invented here:

| Category | Owning story | Backlog line |
|---|---|---|
| `consistency` | `DSN-7` | `SupportOs backlog.MD:566` |
| `interaction` | `DSN-8` | `SupportOs backlog.MD:579` |
| `responsive` | `DSN-9` | `SupportOs backlog.MD:588` |
| `form` | `DSN-10` | `SupportOs backlog.MD:597` |
| `IA` | `DSN-11` | `SupportOs backlog.MD:606` |
| `content` | `DSN-12` | `SupportOs backlog.MD:615` |
| `bilingual` | `DSN-12` | `SupportOs backlog.MD:615` (same story owns both `content` and `bilingual`) |

The walk is graded against the intake's 6-item heuristic checklist (a Nielsen-heuristic subset, `SupportOs backlog.MD:564`) — **consistency**, **feedback** (visibility of system status), **error prevention**, **recognition-over-recall**, **minimalism**, **match to real workflow** — plus two checks the register's own category list requires that aren't in that 6-item list: a **responsive** pass (resize to mobile/tablet width per screen) and a **bilingual** pass (switch to `ar`/RTL, check terminology/copy parity — not physical-direction CSS, which `DSN-2`'s `check-rtl.mjs` already covers structurally). When a finding could fit more than one heuristic, categorize by **where the fix would land** (which shared component/foundation owns it), per the thread guardrail at `SupportOs backlog.MD:556`: "Fixes land at the shared-component/foundation level wherever possible so every consuming screen inherits them." That guardrail also constrains every finding's *scope*: flag issues fixable at the shared-component/foundation level; a one-off screen-specific oddity with no shared-component root cause is still loggable, but note in the recommended fix that it has no natural foundation-level home.

**Not in scope:** implementing any fix (that is `DSN-7`–`DSN-13`'s job); backend/API/route changes (the guardrail forbids these for the whole `DSN-6`–`DSN-13` thread); re-flagging anything `DSN-2` already fixed or confirmed compliant; auditing `frontend/src/features/live-chat` and `frontend/src/features/web-form` public-embed styling choices beyond the same 6-item + responsive + bilingual checklist every other screen gets (no special treatment).

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-97/intake.md` — one task, no attachments, no acceptance criteria.
2. `SupportOs backlog.MD` lines 504-630 (`EPIC 8` in full) — the `DSN-6` task text (line 564) this story implements, the thread guardrail (line 556), and all seven `DSN-7`–`DSN-13` story descriptions the owning-story mapping above is drawn from verbatim; line 901 (Foundation Map: `UX issue register (design-system/supportos/UX-AUDIT.md) → EPIC 8 (DSN-6); consumed by DSN-7–DSN-13`).
3. `CONVENTIONS.md` § 25 (`## 25. Design intelligence`, starts ~line 1395) in full — read every subsection (token reconciliation, UX & accessibility guidance, chart-type guidance, badge/icon/PageHeader, sidebar/primitive polish) so no already-resolved `DSN-0`/`DSN-1`/`DSN-2`/`DSN-3`/`DSN-4`/`DSN-5` decision gets re-flagged as a new finding.
4. `frontend/src/app/router.tsx` (full file, 533 lines) — the authoritative route list task 2 walks; already cross-checked against the live `frontend/src/features/**/components/*.tsx` tree for this plan (see the route inventory in task 2 below — every path in it was verified to exist).
5. `frontend/src/app/Sidebar.tsx` (full file, 274 lines), `frontend/src/app/RootLayout.tsx` (16 lines), `frontend/src/features/portal/components/PortalLayout.tsx` (68 lines), `frontend/src/app/PublicLayout.tsx` — the four shell components every screen inherits; task 2's seeded findings (`UX-001`–`UX-003`) come from these.
6. `.claude/skills/ui-ux-pro-max/data/ux-guidelines.csv` — columns `No,Category,Issue,Platform,Description,Do,Don't,Code Example Good,Code Example Bad,Severity` (`Severity` is `Critical`/`High`/`Medium`/`Low`); query it per screen via `python .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain ux -n <N>` (Windows: `python`, not `python3`, per `.claude/skills/ui-ux-pro-max/SKILL.md:335`). Map its severity to the register's 3-level scale: `Critical`→`critical`, `High`→`major`, `Medium`→`major` if it blocks a primary workflow else `minor`, `Low`→`minor`.
7. `design-system/supportos/MASTER.md` (214 lines) — the generated design-system source `CONVENTIONS.md` § 25 curates from; consult its Pre-Delivery Checklist and Component Specs when a finding needs a concrete target to cite (spacing scale, radius, contrast) rather than a vague "looks off."

---

## Documentation Task

### 1 — Create the register file with its ID/category/severity scheme

**Create file: `design-system/supportos/UX-AUDIT.md`**, starting with a header block (fixed content, write verbatim) before the findings table:

```markdown
# UX Issue Register

Produced by `DSN-6` (Story 61, `SupportOs backlog.MD:558`) — one systematic
walk of every already-built route (`frontend/src/app/router.tsx`) against a
Nielsen-heuristic checklist (consistency, feedback, error prevention,
recognition-over-recall, minimalism, match to real workflow) plus a
responsive and a bilingual pass. This is the "identify" half of the
`DSN-6`–`DSN-13` thread — `DSN-7`–`DSN-12` fix by category below, `DSN-13`
verifies. See `CONVENTIONS.md` § 25 for prior `DSN` decisions this register
does not restate.

**ID:** `UX-###`, sequential, assigned once in walk order — never renumbered
or reused, even if a finding is later closed as a duplicate.

**Category → owning story** (fixed by `SupportOs backlog.MD:566-630`, not a
per-finding judgment call beyond picking the right category):

| Category | Owning story |
|---|---|
| `consistency` | `DSN-7` |
| `interaction` | `DSN-8` |
| `responsive` | `DSN-9` |
| `form` | `DSN-10` |
| `IA` | `DSN-11` |
| `content` | `DSN-12` |
| `bilingual` | `DSN-12` |

**Severity:** `critical` (blocks or corrupts a core workflow, or an
accessibility floor `DSN-2` didn't already cover), `major` (clearly wrong or
inconsistent, workable around), `minor` (polish).

| ID | Screen | Category | Severity | Finding | Recommended fix | Owning story |
|---|---|---|---|---|---|---|
```

### 2 — Walk every route and append findings

Append one table row per finding to the table started in task 1, in the walk order below. **Verified route inventory** (every path checked against a live `router.tsx` read and a `Glob` of `frontend/src/features/**/components/*.tsx` — no invented paths):

**Shells (audit once, apply to every screen they wrap):**
- `frontend/src/app/RootLayout.tsx` + `frontend/src/app/Sidebar.tsx` — staff shell.
- `frontend/src/app/PublicLayout.tsx` — wraps `/login`, `/chat`, `/contact`.
- `frontend/src/features/portal/components/PortalLayout.tsx` — customer portal shell.

**Public routes** (under `PublicLayout`): `/login` → `features/auth/components/LoginPage.tsx`; `/chat` → `features/live-chat/components/LiveChatWidget.tsx`; `/contact` → `features/web-form/components/WebFormPage.tsx`.

**Staff routes** (under `RootLayout`, `RequireAuth`), grouped by feature folder:
- Health: `/` → `features/health/components/HealthPage.tsx`.
- Customers (`customers.view`): `/customers` → `CustomerListPage.tsx`; `/customers/new` + `/customers/:id/edit` → `CustomerFormPage.tsx`; `/customers/:id` → `CustomerProfilePage.tsx` (and its sections: `ContactDetailsSection.tsx`, `AttachmentsSection.tsx`, `NotesSection.tsx`, `InteractionTimelineSection.tsx`).
- Tickets (`tickets.view`): `/tickets` → `TicketListPage.tsx`; `/tickets/new` + `/tickets/:id/edit` → `TicketFormPage.tsx`; `/tickets/my-tickets` → `MyTicketsPage.tsx`; `/tickets/:id` → `TicketDetailPage.tsx` (and sections: `TicketConversation.tsx`, `TicketHistorySection.tsx`, `TicketSlaSection.tsx`, `InternalNotesSection.tsx`, `CustomerContextPanel.tsx`, `TicketAssigneeControl.tsx`, `TicketStatusControl.tsx`).
- Knowledge base — manage (`knowledge_base.manage`): `/knowledge-base/manage` → `FaqListPage.tsx`; `/knowledge-base/manage/new` + `/:id/edit` → `FaqFormPage.tsx`; `/knowledge-base/articles/manage` → `ArticleListPage.tsx`; `/knowledge-base/articles/manage/new` + `/:id/edit` → `ArticleFormPage.tsx` (uses `MarkdownField.tsx`/`MarkdownPreview.tsx`).
- Knowledge base — browse (`knowledge_base.view`): `/knowledge-base` → `FaqBrowsePage.tsx`; `/knowledge-base/articles` → `ArticleBrowsePage.tsx`; `/knowledge-base/articles/:id` → `ArticleReaderPage.tsx`; `/knowledge-base/search` → `SearchPage.tsx`.
- Accounts (`users.view` / `roles.manage`): `/users` → `UserListPage.tsx`; `/users/new` + `/users/:id/edit` → `UserFormPage.tsx`; `/roles` → `RoleListPage.tsx`; `/roles/new` + `/roles/:id/edit` → `RoleFormPage.tsx`.
- Categories (`tickets.manage`): `/categories` → `CategoryListPage.tsx`; `/categories/new` + `/categories/:id/edit` → `CategoryFormPage.tsx`.
- Reports (`reports.view`): `/reports/tickets` → `TicketReportsPage.tsx`; `/reports/sla` → `SlaReportsPage.tsx`; `/reports/agents` → `AgentReportsPage.tsx`; `/reports/csat` → `CsatReportsPage.tsx`; `/reports/dashboard` → `ManagementDashboardPage.tsx`.
- Audit log (`audit_log.view`): `/audit-log` → `AuditLogListPage.tsx`.
- Settings (`settings.manage`): `/settings` → `SettingsPage.tsx`.
- Tasks (unguarded, any authenticated staff): `/tasks` → `TaskListPage.tsx`; `/tasks/new` + `/tasks/:id/edit` → `TaskFormPage.tsx`.
- `*` (404): `./NotFoundPage.tsx` (`frontend/src/app/`) — audit as a real screen, not skipped; also check `frontend/src/app/RouteErrorBoundary.tsx`, the crash fallback.

**Portal routes** (under `PortalLayout`, `RequireAuth` + `portal.access`): `/portal` → `PortalHomePage.tsx`; `/portal/faqs` → `PortalFaqPage.tsx`; `/portal/articles` → `PortalArticleListPage.tsx`; `/portal/articles/:id` → `PortalArticleReaderPage.tsx` (uses `PortalMarkdownPreview.tsx`); `/portal/tickets` → `PortalTicketListPage.tsx`; `/portal/tickets/history` → `PortalTicketHistoryPage.tsx`; `/portal/tickets/new` → `PortalTicketFormPage.tsx`; `/portal/tickets/:id` → `PortalTicketDetailPage.tsx`; `/portal/tickets/:id/feedback` → `PortalFeedbackFormPage.tsx`.

**3 findings already verified during planning — write these as the register's first three rows, do not re-derive them:**

```markdown
| UX-001 | Shell — `Sidebar.tsx` (staff) and `PortalLayout.tsx` (portal) | IA | major | Neither nav uses `NavLink`/`aria-current` or any current-path check — `SidebarLink` (`Sidebar.tsx:46-74`) and every `<Link>` in `PortalLayout.tsx:30-47` render identically regardless of the active route. A user has no visual confirmation of where they are in either shell. | Swap `Link` for `NavLink` (or add a `useLocation` pathname check) in both `SidebarLink` and `PortalLayout`'s nav buttons; apply a distinct active style and `aria-current="page"`. Shared-component-level (`SidebarLink`, one `PortalLayout` block) — matches the guardrail. | DSN-11 |
| UX-002 | Shell — `Sidebar.tsx` nav | IA | minor | The nav (`Sidebar.tsx:122-243`) is one flat, unlabeled list — the Knowledge Base (3 links, lines 159-178) and Reports (5 links, lines 195-226) sub-groups have no section heading separating them from single-link items like Customers or Tasks. | Add a labeled `<div role="group" aria-label="...">`-style section wrapper (or a small heading) around each multi-link group, matching `SupportOs backlog.MD:606`'s "group/label sidebar items." | DSN-11 |
| UX-003 | Shell — `Sidebar.tsx` Reports links | consistency | minor | All 5 Reports sidebar links (`Sidebar.tsx:195-226`) share the identical `ChartNoAxesColumnIcon` — no per-report visual differentiation the way every other feature group uses a distinct icon per link. The first link's label key also breaks its own siblings' naming convention: `t('reports:title')` (line 199) vs. `sidebarSla`/`sidebarAgents`/`sidebarCsat`/`sidebarDashboard` (lines 205/211/217/223) — one generic "section title" key mixed into 4 consistently-named sibling keys. | Give each report link a distinct `lucide-react` icon (matching the one-icon-per-destination pattern every other nav group already follows); rename the `reports:title`-keyed link's translation key to `sidebarTickets` (or similar) to match its 4 siblings. | DSN-7 |
```

**For every remaining screen in the inventory above**, apply the 6-item heuristic checklist plus the responsive and bilingual passes (`## Story Goal`), cross-checking `CONVENTIONS.md` § 25 so nothing `DSN-2`/`DSN-4`/`DSN-5` already resolved gets re-flagged. For each genuine finding, append a row using the same table shape as `UX-001`–`UX-003`, incrementing the ID. Where a specific `ux-guidelines.csv` row applies, cite it in the Finding column (`"..." (ux-guidelines.csv row N)`) the same way `CONVENTIONS.md` § 25 already does for `DSN-2`/`DSN-3`.

### 3 — Update the feature overview

**File: `.squad/plans/design-intelligence-ui-ux-system/00-overview.md`** — add a row for Story 61 to the table (after the Story 51 row) and a new "Story 61 (`DSN-6`)..." paragraph in "Dependency notes" (matching the existing prose style for Stories 35-51), stating: the register's total finding count, its severity breakdown, and that it corrects the stale "Story 51... is planned, not yet implemented" line (flagged in `## Prerequisites` above) to reflect Story 51's actual completed state.

---

## Edge Cases & Failure Modes

- **"Trivially obvious one-liner" (`SupportOs backlog.MD:564`) is a narrow exception, not a fix budget.** Only apply it for something like a stray typo in a translation string encountered while reading a file for the audit — never for anything touching JSX structure, a shared component, or more than one file. Anything even mildly ambiguous goes in the register instead; `DSN-7`–`DSN-12` own all real fixes.
- **A route requires a permission the auditor's account lacks** (`audit_log.view`, `settings.manage`, `roles.manage`, `users.view`, `reports.view`, `tickets.manage`, `knowledge_base.manage` are all `RequirePermission`-gated in `router.tsx`). No seeded admin/demo account exists in this repo (confirmed: no `Role.objects.get_or_create`/fixture in `backend/`, only `python manage.py createsuperuser` in `README.md:171`). Create a superuser, then grant it a role with every permission slug via `RoleFormPage` (`/roles/new`) before starting the walk, so every gated route is actually reachable — do not skip a screen because it 403s.
- **A finding spans two categories** (e.g., a table with no responsive stacked view on mobile *and* an inconsistent column order vs. a sibling table) — split into two rows with two IDs; never conflate two owning stories into one register row.
- **A component is shared across multiple routes** (e.g., `TicketFormPage.tsx` serves both `/tickets/new` and `/tickets/:id/edit`) — audit once, but check both states (empty/create vs. pre-filled/edit) since heading text, button labels, and validation-on-load behavior can differ; log under one screen entry naming both routes if the finding applies to both, or split if only one state is affected.
- **A finding already exists in `CONVENTIONS.md` § 25 as "deferred," not "fixed"** (the 6 standalone `SelectTrigger` sites and bulk row actions, per `## Prerequisites` above) — these are legitimately in scope for this register; log them with a fresh `UX-###` ID rather than pointing back at the old `DSN-2` mention, so `DSN-7`–`DSN-12` have one place to look.
- **The `ux-guidelines.csv` severity scale (`Critical`/`High`/`Medium`/`Low`) doesn't map cleanly to the register's 3-level scale for a borderline `Medium` row** — default to `minor` unless the finding blocks a primary workflow (ticket creation, customer lookup, login) or an accessibility floor, in which case use `major`. Never invent a 4th severity value.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added — this story only creates `design-system/supportos/UX-AUDIT.md` and edits `00-overview.md`.

1. No backend impact: `python manage.py test` (from `backend/`) is unaffected. Re-run once to confirm no drift.
2. No frontend code changes beyond, at most, the rare "trivially obvious one-liner" from `## Edge Cases`: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must still all pass.
3. Manual verification only, per `## Verification Steps` below — this story's real "test" is the completeness and accuracy of the register itself.

---

## Verification Steps

1. **Every route in the inventory has at least one register entry or an explicit "no findings" note.** Cross-check `design-system/supportos/UX-AUDIT.md`'s Screen column against the full route list in task 2 — no route silently skipped.
2. **No `DSN-2`-resolved item re-appears as a new finding.** Spot-check the register for heading hierarchy, form-error announcement, `cursor-pointer`, login autocomplete, truncation tooltips, toast roles, reduced motion, alt text, icon-button labels, RTL, wide tables, sortable headers, ARIA wiring, touch target size — none of these should have a fresh `UX-###` row.
3. **Every row's category matches its owning story** per the fixed table in `## Story Goal` — no `IA` row pointing at `DSN-9`, no `bilingual` row pointing anywhere but `DSN-12`, etc.
4. **`UX-001`–`UX-003` are present verbatim** (or refined with the same file/line citations) as the register's first three rows.
5. **IDs are sequential with no gaps or reuse**, `git diff --stat` shows only `design-system/supportos/UX-AUDIT.md` (new file) and `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` (edited) — no `frontend/`/`backend/` file changed except a rare, individually-justified one-liner.
6. **Backend/frontend unaffected:** `python manage.py test` (backend) and `npm run lint && npm run build` (frontend) both still pass.

---

## Done Criteria

- [ ] `design-system/supportos/UX-AUDIT.md` created with the header block (task 1) and a findings table covering every route in the task 2 inventory.
- [ ] `UX-001`, `UX-002`, `UX-003` present as the first three rows (Sidebar/PortalLayout active-state, Sidebar nav grouping, Sidebar Reports icon/label consistency).
- [ ] Every finding has a stable `UX-###` ID, a screen citation, one of the 7 fixed categories, one of the 3 fixed severities, a recommended fix, and an owning story from the fixed category-to-story mapping.
- [ ] No `DSN-2`-resolved or confirmed-compliant item re-appears as a new finding.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated: new Story 61 row in the table, a new dependency-notes paragraph, and the stale Story 51 "planned, not yet implemented" line corrected.
- [ ] `git diff --stat` confined to `design-system/supportos/UX-AUDIT.md` and `00-overview.md`, plus at most a handful of individually-justified one-line fixes.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) and `python manage.py test` (backend) all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-7` through `DSN-13` (`SupportOs backlog.MD:566-630`) are all still unplanned — each needs its own intake once this register exists for them to consume.
