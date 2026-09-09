> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `jira` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/bugs/qa-report-1/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** QA Remediation — Security, Permission Integrity & UI/UX Defects
- **Feature slug (folder under `plans/`):** `bugs`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Bug`
- **Status:** ``
- **Assignee:** ``
- **Labels:** `qa`, `security`, `accessibility`, `ui-ux`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
qa-report-1 — Full-stack QA pass: cross-tenant leak, role-grant drift, and dashboard/contrast defects
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Umbrella remediation ticket for a full-stack senior-QA + UI/UX review carried out
against commit 640a6d9 on `develop`. The complete review — evidence, measured
numbers, reproduction steps and suggested fixes for all 20 findings — is in
`attachments/QA-REPORT-1.md`. READ THAT FILE FIRST; this description only
summarises what must change and why.

The review ran against a LIVE stack (Django dev server on :8009 against the
`supportos` Postgres), not a static read. Every finding below was reproduced,
not inferred.

## Context: what is already healthy (do NOT "fix" these)

All static gates are green and must stay green: `tsc -b`, `oxlint` (1 warning),
`ruff check`, `ruff format`, `manage.py check`, `makemigrations --check`,
`check:rtl`, and the production build (3.14 s, 80 lazy chunks). Runtime probes
confirmed there is NO SQL/ordering injection, pagination clamps correctly at
DRF_MAX_PAGE_SIZE=100, login throttling returns 429 after 8 bad attempts,
password reset does not leak user existence, and there is NO N+1 anywhere
(measured: 4 queries for 25 rows on tickets/customers/users/categories/
audit-logs). `check --deploy` under prod settings reports ZERO security
warnings. i18n is at full en/ar parity (1007 keys, correct Arabic plural forms).

Any plan that regresses one of those baselines is wrong. The query-count
baseline in particular is a regression gate for F-9 below.

## In scope — the defects

### F-1 (CRITICAL) — Cross-tenant IDOR: portal customers can read every ticket subject

`TaskViewSet` (`backend/apps/agents/views.py:31`) is `permission_classes =
[IsAuthenticated]` only, and `TaskSerializer.ticket` is a DRF auto-generated
relation over `Ticket.objects.all()`. `ticket_subject`
(`backend/apps/agents/serializers.py:13`) is echoed back on create.

Reproduced live with a portal customer holding ONLY `portal.access` +
`knowledge_base.view`:

    GET  /api/tickets/143/         -> 403   (correctly denied)
    GET  /api/portal/tickets/143/  -> 404   (correctly denied)
    POST /api/tasks/  {"title":"x","ticket":143,"due_at":"2030-01-01T00:00:00Z"}
      -> 201 {"ticket":143,"ticket_subject":"Requesting a refund for last month"}

Ticket 143 belongs to customer 107, not the caller. Looping `ticket` over 1..N
enumerates every ticket subject for every customer. Subjects routinely carry
names, invoice numbers and account references.

The existing code comment ("No extra permission check on this field — see Story
32") shows this was a deliberate deferral. It is now a live cross-tenant leak.

Note for the planner: this is a SINGLE-FIELD defect, not a systemic one. The
same sweep confirmed the portal customer correctly received 403 on /customers/,
/audit-logs/, /users/, /internal-notes/, /quick-replies/,
/webhooks/subscriptions/, /api-keys/ and /settings/. `NotificationViewSet` is
the only other `IsAuthenticated`-only viewset and is correctly owner-scoped with
no cross-object writable relation. Do not re-architect the permission system.

### F-2 (HIGH) — Every permission-grant migration silently no-ops; top role missing 8 permissions

`backend/apps/accounts/migrations/0003_seed_roles.py:11` seeds a role with slug
`admin`. All five later grant migrations (0006 audit_log, 0008 api_keys, 0009
integrations, 0010 communications, 0011 webhooks) target that same slug and do:

    role = Role.objects.filter(slug=slug).first()
    if role is None:
        continue          # <- silent no-op

This database has NO `admin` role. The live top role is slug `super_admin`,
name "Super Admin", `is_system=True` — a slug that appears in no migration at
all (only in a passing code comment at `backend/apps/portal/views.py:84`). All
five migrations show [X] applied and granted nothing.

Measured missing permissions vs ALL_PERMISSIONS:
  - Super Admin  13/21 — missing api_keys.manage, branches.manage,
    branches.view, communications.manage, departments.manage,
    departments.view, integrations.manage, webhooks.manage
  - Manager      10/21 — missing 11 incl. audit_log.view, settings.manage
  - Agent         5/21 — missing 16
  - Customer      2/21 — correct (portal role), leave alone

User-visible impact, confirmed live as admin@supportos.local (Super Admin):
    GET /api/departments/ -> 403
    GET /api/branches/    -> 403
…while `Sidebar.tsx` still renders Departments, Branches, ERP Sync and Channels
as links. Six admin screens are dead for the highest role in the product.

Three parts, all required:
  (a) A repair migration that reconciles by role IDENTITY, not by a hardcoded
      slug that has already drifted once.
  (b) Grant migrations must FAIL LOUDLY when the target role is absent, never
      `continue`. A no-op permission migration is indistinguishable from a
      successful one — that is exactly how this survived five releases.
  (c) A reconciliation management command. There is currently NO manage.py
      command anywhere in the backend (`find apps -path "*management*"` returns
      nothing). `sync_role_permissions --check` diffing every system role
      against ALL_PERMISSIONS and exiting non-zero turns this class of bug into
      a CI failure.

### F-4 (HIGH) — DEFAULT_PERMISSION_CLASSES is AllowAny (fail-open)

`backend/config/settings/base.py:291`. Every view today sets
`permission_classes` explicitly, so there is NO live exposure — but the default
points the wrong way, and any new view added without it is public with nothing
in CI to catch it. Flip to `IsAuthenticated`; the ~10 genuinely public views
(health, branding, landing content, inbound webhooks, web form, live-chat start)
already declare `AllowAny` explicitly, so the change is inert today and
protective tomorrow.

### F-5 (MEDIUM) — Default link colour fails WCAG AA in dark mode

`frontend/src/index.css:109` defines `--primary` identically in both themes.
It is used as TEXT (`text-primary`) in 34 places — every DataTable link,
"Forgot password?", every auth link (`shared/ui/data-table/TableLink.tsx`).

Measured (AA body text needs 4.5:1):
  #2563EB on dark --background #0A1018 -> 3.69:1  FAIL
  #2563EB on dark --card       #171D26 -> 3.28:1  FAIL
  #2563EB on light --background        -> 4.94:1  pass
  #2563EB on light --card              -> 5.17:1  pass
  --secondary #64748B as text on dark card -> 3.56:1 FAIL

The token was verified for its BUTTON FILL use (white on blue ~8.6:1) but never
for its TEXT use. Dark mode is the default in all four shipped screenshots.

### F-6 (MEDIUM) — Org brand colours contrast-checked for buttons but not links

`frontend/src/shared/branding/contrast.ts` is good work: `foregroundFor()` picks
black or white so any admin-entered `primary_color` yields a legible button
LABEL. But `--primary` is also used as link text on the page background, and
that direction is unchecked. Measured, brand colour as link text:
  Navy   #1E3A8A -> 1.81:1 dark FAIL / 9.90:1 light pass
  Maroon #7A1F2B -> 1.84:1 dark FAIL / 9.75:1 light pass
  Forest #14532D -> 2.06:1 dark FAIL / 8.71:1 light pass
  Pink   #E879F9 -> 7.61:1 dark pass / 2.35:1 light FAIL  (currently shipped)

A corporate navy — the likeliest colour an enterprise enters — renders links at
1.81:1 in dark mode. F-5 and F-6 share one fix: a `--primary-text` token derived
per theme, not the raw button fill.

### F-7 (MEDIUM) — Management dashboard chart is visibly broken

Three defects in `frontend/src/shared/ui/chart/GaugeChart.tsx`, all visible in
`docs/screenshots/management-dashboard.png`:
  (a) GaugeChart.tsx:86 draws each label at y={y - 4}. For gauge index 0, y=0,
      so the baseline is -4 — above the SVG viewport and CLIPPED. Every
      remaining label then falls in the gap above its own bar and reads as
      belonging to the bar above it. Screenshot shows bar 1 unlabelled and the
      final bar (72.2%) with no label.
  (b) GaugeChart.tsx:3 fixes WIDTH=600 while the element is `w-full` with a
      pixel `height`. Under the default preserveAspectRatio="xMidYMid meet" the
      uniform scale is min(1160/600, 132/132) = 1, so the chart draws at 1:1
      centred in an ~1160px container — ~280px of dead space on EACH side. That
      is the large empty region in the screenshot.
  (c) GaugeChart.tsx:137 places the value at xFor(value)+4. At 100% that is
      user-x 604, past the 600-unit viewBox, so "100%" detaches from its bar and
      collides with the card edge.
  (d) No legend: the three zones (green <=10%, amber <=25%, red >25%) and the
      white target tick are never explained on screen.

### F-8 (MEDIUM) — Ticket list has no Status filter, though the backend has one

`backend/apps/tickets/views.py:141-145` implements AND validates `?status=`
(verified live: `?status=bogus` -> 400, `?status=open` -> filtered). The
frontend never sends it: `TicketListPage.tsx:56-58` declares category, priority,
department and branch only. "Show me the open tickets" is the most common query
in any helpdesk and it is the one filter missing. Backend work is already done —
this mirrors the existing `priorityFilter` select.

### F-9 (MEDIUM) — SLA status invisible from the ticket queue

`compute_sla_status` is reachable only via the per-ticket detail action
(`backend/apps/tickets/views.py:309`, GET /tickets/{id}/sla/). It is NOT on
`TicketSerializer`, so the list cannot expose it and the table has no SLA
column. The management dashboard reports a 100% SLA breach rate while an agent
has no way to find WHICH tickets are breaching short of opening each one.

Add a lightweight `sla_status` (ok / at_risk / breached / null) to
`TicketSerializer`, computed over the already-select_related rows, then surface
it as a sortable, filterable column. THE 4-QUERY BASELINE MUST HOLD.

### F-10 (MEDIUM) — OpenAPI schema substantially incomplete (38 warnings)

`check --deploy` reports 38 drf_spectacular issues (and zero security warnings):
  - 26x W002: plain APIViews with no serializer_class, so the generator OMITS
    the view entirely — every report endpoint, every auth endpoint (MeView,
    LogoutView, ChangePasswordView, password reset), every inbound webhook,
    plus branding, settings, landing content. A generated client gets none.
  - 5x W001: `apps.tickets.serializers.CategorySerializer` and
    `apps.knowledge_base.serializers.CategorySerializer` both claim the
    component name "Category" — spectacular warns this "will very likely result
    in an incorrect schema".
  - 1x enum collision: `status` resolved to "Status6f2Enum".

### F-11..F-20 (LOW / polish)

Full detail with file:line for each is in section 3 of the attachment. Summary:
  F-11 ChartFrame `action` documented "next to the title" but is a block child
       of CardHeader, so Export CSV stretches full width (ChartFrame.tsx:58)
  F-12 Duplicate dashboard title rendered twice (ManagementDashboardPage.tsx:55, :90)
  F-13 KPI drill-down links use variant="ghost" — read as caption, not nav (:129)
  F-14 Date-range presets have no selected state; inputs start empty
  F-15 <input type="date"> renders mm/dd/yyyy regardless of locale
  F-16 Sidebar brand truncates to "Organization Supp..." with no title attribute
  F-17 Invalid ?ordering= is silently ignored (200, unsorted) — contradicts the
       project's own rule in apps/core/scoping.py that a typo'd filter must 400
  F-18 oxlint: ref accessed during render (LiveChatWidget.tsx:178)
  F-19 tabIndex={0} on an SVG <rect role="img"> — invisible tab stop (GaugeChart.tsx:122)
  F-20 Chunk "reportKeys-*.js" is 381 kB — actually Recharts, misleadingly named

## Explicitly NOT in this story

F-3 (no automated tests for any domain logic — 4 backend test files, all
infrastructure; 0 frontend) is the review's root-cause finding and is recorded
in the attachment, but writing a test suite is a separate decision for the team.
See "Out of scope" below.

## UI/UX findings

Section 4 of the attachment carries 21 numbered UI/UX observations across the
four shipped screenshots (home, tickets, management dashboard, customers) —
card-type ambiguity, badge overload, missing bulk actions, inconsistent search
widths and empty-cell treatment, sidebar scale, untuned tablet range. Those are
design decisions, not defects; they are listed for the planner's awareness and
should be triaged separately rather than folded into this remediation.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
Security & authorization

- [ ] F-1: A portal customer POSTing /api/tasks/ with a `ticket` id belonging to
      another customer receives 400 (validation), NOT 201 — and no
      `ticket_subject` for that ticket appears in any response body.
- [ ] F-1: A portal customer can still create a task linked to one of their OWN
      tickets, and a task with no ticket at all.
- [ ] F-1: Agent/manager/admin behaviour on /api/tasks/ is unchanged.
- [ ] F-4: `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated`. Every currently
      public endpoint (health, branding, landing content, inbound email/whatsapp/
      sms webhooks, web form, live-chat start) still returns its present status
      code for an anonymous caller — verified endpoint by endpoint, not assumed.

Permission integrity

- [ ] F-2a: After migrating, the top role (whatever its slug) holds all 21
      strings in `ALL_PERMISSIONS`. `GET /api/departments/` and
      `GET /api/branches/` return 200 for admin@supportos.local.
- [ ] F-2b: A grant migration whose target role is absent RAISES rather than
      passing silently. Demonstrated by a test or by an explicit code path — a
      `continue` anywhere in a grant migration is a failed AC.
- [ ] F-2c: `manage.py sync_role_permissions --check` exists, prints the per-role
      diff against `ALL_PERMISSIONS`, and exits non-zero when any system role has
      drifted. Exits zero on a healthy database.
- [ ] The `customer` role is NOT widened — it keeps exactly `portal.access`
      (+ whatever the portal genuinely requires) and gains nothing from the
      repair migration.

Accessibility / design tokens

- [ ] F-5: A `--primary-text` (or equivalently named) token exists, is defined
      separately for light and dark, and every `text-primary` link site uses it.
- [ ] F-5: Link text measures >= 4.5:1 against BOTH `--background` and `--card`
      in BOTH themes, with the measured ratios recorded in the token comment —
      matching the existing convention in index.css.
- [ ] F-6: An org-supplied `primary_color` of #1E3A8A (navy) yields link text at
      >= 4.5:1 in dark mode, and #E879F9 (pink) yields >= 4.5:1 in light mode.
- [ ] F-6: Organization Settings warns the admin when their chosen colour cannot
      reach 4.5:1, and `primary_color` is validated server-side.
- [ ] Button-label contrast (the existing `foregroundFor()` behaviour) is
      unchanged and still correct.

Management dashboard

- [ ] F-7a: The FIRST gauge's label is fully visible; every label is
      unambiguously associated with its own bar.
- [ ] F-7b: The chart fills the width of its card — no dead space on either side
      at 1440px, 1024px and 768px.
- [ ] F-7c: A 100% value renders its label inside the chart area, not past the
      viewBox or over the card edge.
- [ ] F-7d: A legend explains the three zones and the target marker.
- [ ] F-11: The Export CSV button is right-aligned in the card header, not
      full-width.
- [ ] F-12: The dashboard title renders once.
- [ ] F-13: The four KPI drill-down links read as interactive controls.
- [ ] F-14: A default range is applied on load and the active preset is visibly
      selected.
- [ ] F-19: The gauge rect either gains a visible focus ring or drops tabIndex;
      no invisible tab stop remains.

Ticket queue

- [ ] F-8: The ticket list has a Status filter that sends `?status=`, follows the
      existing `'all'` sentinel convention, resets to page 1 on change, and is
      fully translated in en + ar.
- [ ] F-9: `TicketSerializer` exposes `sla_status`; the list table shows it as a
      column; the value matches what GET /tickets/{id}/sla/ reports for the same
      ticket.
- [ ] F-9 REGRESSION GATE: GET /api/tickets/?page_size=25 still issues 4 queries.

API schema

- [ ] F-10: `manage.py check --deploy` reports zero W002 (unguessable
      serializer) and zero component-name collisions. Remaining warnings, if
      any, are listed with a justification.
- [ ] F-10: The report, auth, webhook, branding, settings and landing-content
      endpoints all appear in the generated schema.

Baselines that must not regress

- [ ] `tsc -b`, `oxlint`, `ruff check`, `ruff format --check`, `manage.py check`,
      `makemigrations --check --dry-run`, `npm run check:rtl` and the production
      build all still pass.
- [ ] `check --deploy` still reports ZERO security warnings.
- [ ] en/ar locale parity holds — every new key exists in both files.
- [ ] No new physical-direction utilities (check:rtl stays clean).
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/QA-REPORT-1.md` | **Primary source.** Full senior-QA + UI/UX review of commit `640a6d9`: verdict table of every gate run, method, all 20 findings (F-1..F-20) with file:line evidence, measured contrast ratios, measured query counts, live reproduction transcripts, suggested fixes with code, 21 numbered UI/UX observations across the four shipped screenshots, 16 prioritised enhancements, and the commands to reproduce the whole review. Read this before planning. |

Referenced by the report but living in the repo (not copied here):
`docs/screenshots/home.png`, `docs/screenshots/tickets.png`,
`docs/screenshots/management-dashboard.png`, `docs/screenshots/customers.png`.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:**
  - AUTH-2 (Roles, Permissions & Authorization) — F-1/F-2/F-4 all operate on the `HasPermission` / `permission_map` / `ALL_PERMISSIONS` vocabulary that story established. Reuse it; do not reimplement.
  - SUPPORTOS-123 (AUTH-3, Role-Based Post-Login Landing) — overlaps in subject matter (portal-account surface area) and its own notes describe the `customer` role being edited directly in the database. That direct edit is the same class of drift F-2 formalises; keep the two consistent.
  - ORG-1 / ORG-2 (Departments, Branches) — F-2's missing `departments.*` / `branches.*` grants are precisely what makes those screens unreachable today.
  - RPT-2 / RPT-5 (Reports) — `GaugeChart` is shared by the management dashboard and the SLA/agent report pages, so F-7's fix must be verified on every consumer, not just the dashboard.
  - INT-1 (API schema / drf-spectacular) — F-10 continues that story's work.

## Extra notes (optional)

- **This is an umbrella ticket and probably should be split.** Suggested slicing, in dependency order: (1) F-1 + F-4 — security, ship first and alone; (2) F-2 — permission integrity + the new management command; (3) F-5 + F-6 — contrast tokens; (4) F-7 + F-11..F-14 + F-19 — the dashboard screen; (5) F-8 + F-9 — ticket queue; (6) F-10 — schema; (7) F-15..F-18 + F-20 — polish. The planner may treat this intake as one plan with phased tasks, but the phases above are the natural boundaries.
- **A dev-database side effect from the review:** obtaining a JWT required setting a known password on `admin@supportos.local` (to `ProbePass!2345`) in the local `supportos` database. All other probe fixtures (a throwaway portal user, its Customer row and its tasks) were deleted. That password has NOT been reset — do that before this database is shared or promoted.
- **F-2's data problem is still present in the dev database** and was deliberately left in place so the repair migration can be verified against a genuinely broken state. Do not hand-fix the role before writing the migration.
- The review found no evidence of a systemic authorization failure. Nineteen of twenty endpoints in the portal-customer sweep behaved correctly. Resist any plan that proposes rebuilding the permission layer.
- Per project convention this repo has no automated test suite; see "Out of scope".

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- `backend/apps/agents/serializers.py:13` — `TaskSerializer.ticket_subject`; the writable `ticket` relation is DRF-auto-generated over `Ticket.objects.all()`. The narrowing pattern to copy already exists in the same repo: `InternalNoteSerializer.mentioned_users` uses an explicit `queryset=assignable_agents()` for exactly this reason, and documents why.
- `backend/apps/agents/views.py:18-45` — `TaskViewSet`, `permission_classes = [IsAuthenticated]`, owner-scoped via `get_queryset`. `apps/core/permissions.py:HasPermission.has_object_permission` already implements the "tighten only for a caller with a `customer_profile`" pattern and explains the `customer_field` opt-in.
- `backend/apps/accounts/migrations/0003_seed_roles.py:11` (slug `admin`) and `0006` / `0008` / `0009` / `0010` / `0011` (the five silent-skip grants). `apps/core/permissions.py:ALL_PERMISSIONS` is the reconciliation target.
- `backend/config/settings/base.py:291` — `DEFAULT_PERMISSION_CLASSES`; line 269 is the `DEFAULT_FILTER_BACKENDS` block behind F-17.
- `backend/apps/tickets/views.py:141-145` — the existing, working `?status=` filter. `:309` — the `sla` detail action wrapping `apps.sla.policy.compute_sla_status`.
- `frontend/src/index.css:109` — dark `--primary`, currently identical to `:root`. Existing token comments record verified ratios (e.g. `--success-foreground: 6.37:1, verified`); follow that convention for any new token.
- `frontend/src/shared/branding/contrast.ts` — `foregroundFor()`, the existing WCAG luminance helper. `branding.ts:52-69` is the only place `--primary` / `--primary-foreground` are written; `config.ts:19-20` names the tokens.
- `frontend/src/shared/ui/data-table/TableLink.tsx` — the shared `text-primary` link; the same class string is used by `buttonVariants`' `link` variant, so both need the new token.
- `frontend/src/shared/ui/chart/GaugeChart.tsx` — `WIDTH` (:3), `height` (:52), label `y={y - 4}` (:86), `tabIndex` (:122), value label x (:137). It flips coordinates for RTL via `xFor()`; any layout change must preserve that and stay `check:rtl`-clean.
- `frontend/src/shared/ui/chart/ChartFrame.tsx:58` — the misplaced `action` child.
- `frontend/src/features/reports/components/ManagementDashboardPage.tsx:55, :90, :129` — duplicate title and the ghost-variant drill-down links.
- `frontend/src/features/tickets/components/TicketListPage.tsx:56-58` — the four existing filters; `priorityFilter` is the exact shape a `statusFilter` should copy, including the `'all'` sentinel convention (Radix Select cannot take an empty value) documented in CONVENTIONS.md §19 and mirrored backend-side by `apps/core/scoping.py:UNSCOPED`.
- `frontend/src/shared/ui/data-table/types.ts` — `ColumnDef.priority: 'sm'` is the existing responsive-column mechanism; an SLA column should declare one.
- No `manage.py` command exists anywhere yet (`find backend/apps -path "*management*"` is empty), so F-2c creates the first `management/commands/` package in the project.

## Out of scope

- What this story explicitly does **not** cover:
- **F-3 — writing an automated test suite.** The review names this as the root cause of F-1 and F-2 and recommends four specific tests (authorization matrix, portal isolation, role integrity, ticket status transitions), but this repo carries a standing "no test cases" convention. The recommendation stays recorded in the attachment; acting on it is a separate decision for the team, not this story.
- The 21 UI/UX observations in section 4 of the attachment (card-type ambiguity on Home, badge overload and missing bulk actions on Tickets, inconsistent search-field widths, empty-cell treatment, sidebar information architecture, untuned 640–1024px tablet range, the palm-tree chat launcher). These are design decisions requiring product input, not defects — triage separately.
- The 16 product-level enhancements in section 5 of the attachment (bulk ticket actions, saved views/filter presets, replacing the Home nav cards with operational signal, a ⌘K command palette, status/priority visual rebalance).
- Any rework of the permission MODEL itself — `HasPermission`, `permission_map`, `CustomerScopedModelViewSet` and `ScopedQuerysetMixin` are sound and were verified working. F-1 is one field; F-4 is one settings line.
- Any change to the caching, throttling, pagination or envelope layers — all verified correct under live probing.
- Recharts replacement or a charting-library migration. F-7 is a bug fix in the existing hand-rolled SVG `GaugeChart`.
- Resetting the `admin@supportos.local` dev password (noted above as an operational follow-up, not a code change).
