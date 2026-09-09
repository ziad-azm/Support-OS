# SupportOS — QA, Security & UI/UX Review

**Reviewer:** Senior QA / UX pass
**Date:** 2026-09-09
**Commit:** `640a6d9` (branch `develop`)
**Scope:** Full stack — Django 5.2 + DRF backend (254 Python files), React 19 + Vite + Tailwind v4 frontend (572 TS/TSX files)

---

## 1. Verdict

SupportOS is a **well-engineered codebase** with unusually strong architectural discipline — the envelope contract, permission model, caching, throttling and i18n are all better than typical for a product at this stage. Static quality gates are green across the board.

The problems are **not** in the plumbing. They are in three places:

1. **One confirmed cross-tenant data leak** (a portal customer can read every ticket subject in the system).
2. **A silent role/permission drift** that has already left the top role in this deployment unable to reach six admin screens.
3. **A near-total absence of automated tests** — which is *why* 1 and 2 went unnoticed.

On the UI side, the design-token work is excellent, but the **default link colour fails WCAG AA in dark mode**, and the **management dashboard chart is visibly broken** (first label clipped, chart occupies half its container).

| Area | Result |
|---|---|
| TypeScript (`tsc -b`) | ✅ Clean |
| Lint (`oxlint`) | ✅ 1 warning |
| Format (`ruff format`) | ✅ 177 files clean |
| Lint (`ruff check`) | ✅ All checks passed |
| Django `check` | ✅ 0 issues |
| Migration drift | ✅ No changes detected |
| Production build | ✅ 3.14 s, 80 lazy chunks |
| RTL check | ✅ No physical direction utilities |
| i18n parity (en↔ar) | ✅ 1007 keys, complete |
| API envelope contract | ✅ Consistent on 200/401/404 |
| SQL / ordering injection | ✅ Not exploitable |
| Login brute-force throttle | ✅ 429 after 8 attempts |
| User enumeration (password reset) | ✅ Not possible |
| N+1 queries | ✅ 4 queries for 25 rows |
| **Authorization (object level)** | ❌ **1 confirmed leak** |
| **Role permission integrity** | ❌ **8 permissions missing from top role** |
| **Automated test coverage** | ❌ **~0%** |
| **Dark-mode link contrast** | ❌ **Fails WCAG AA** |
| **Management dashboard chart** | ❌ **Rendering defects** |

---

## 2. What was tested, and how

Everything below was executed against a live stack (Django dev server on `:8009`, PostgreSQL `supportos`) — not read-only inspection.

```bash
# Static gates
cd frontend && npx tsc -b && npx oxlint && node scripts/check-rtl.mjs && npx vite build
cd backend  && python -m ruff check . && python -m ruff format --check .
python manage.py check && python manage.py makemigrations --check --dry-run
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy

# Runtime probes (throwaway accounts, cleaned up afterwards)
python manage.py runserver 8009 --noreload
```

Runtime probes covered: envelope shape on success/401/404, pagination clamping, `?ordering=` injection, `?search=` injection, invalid scope filters, login throttling, password-reset enumeration, per-endpoint query counts, and a portal-customer authorization sweep across 12 admin endpoints.

All test fixtures created during this review were deleted afterwards. **One pre-existing data problem was found and deliberately left in place** (Finding F-2) — it needs a decision, not a silent fix.

---

## 3. Findings

### 🔴 CRITICAL

#### F-1 — Portal customers can read every ticket subject in the system (IDOR)

**Confirmed live.** `TaskViewSet` requires only `IsAuthenticated`, and `TaskSerializer.ticket` is a DRF auto-generated relation whose queryset is `Ticket.objects.all()`. `ticket_subject` is then echoed straight back on create.

- `backend/apps/agents/views.py:31` — `permission_classes = [IsAuthenticated]`
- `backend/apps/agents/serializers.py:13` — `ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")`

**Reproduction** (portal customer holding only `portal.access` + `knowledge_base.view`):

```
GET  /api/tickets/143/         -> 403   ✅ correctly denied
GET  /api/portal/tickets/143/  -> 404   ✅ correctly denied
POST /api/tasks/  {"title":"x","ticket":143,"due_at":"2030-01-01T00:00:00Z"}
  -> 201 {"ticket": 143, "ticket_subject": "Requesting a refund for last month"}   ❌ LEAKED
```

Ticket 143 belongs to customer 107, not the caller. Looping `ticket` from 1..N enumerates **every ticket subject across every customer** — subjects routinely carry names, invoice numbers and account references.

The existing code comment ("No extra permission check on this field — see Story 32") shows this was a deliberate deferral. It is now a live cross-tenant leak.

**Fix** — constrain the relation to tickets the caller may actually see:

```python
# backend/apps/agents/serializers.py
class TaskSerializer(BaseModelSerializer):
    ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        customer = getattr(getattr(request, "user", None), "customer_profile", None)
        if customer is not None:
            # A portal customer may only link their OWN tickets.
            fields["ticket"].queryset = Ticket.objects.filter(customer=customer)
        return fields
```

Better still: `TaskViewSet` is an *agent* feature. Gate the whole viewset so portal customers cannot reach it at all — either declare a `permission_map` requiring a `tickets.*` grant, or deny outright when `request.user.customer_profile` exists.

> **Context from the rest of the sweep:** every other endpoint behaved correctly. The portal customer received `403` on `/customers/`, `/audit-logs/`, `/users/`, `/internal-notes/`, `/quick-replies/`, `/webhooks/subscriptions/`, `/api-keys/` and `/settings/`. `/tasks/` and `/notifications/` are the only two `IsAuthenticated`-only viewsets, and `NotificationViewSet` is correctly owner-scoped with no cross-object writable relation. **This is a single-field defect, not a systemic one.**

---

### 🟠 HIGH

#### F-2 — Every permission-grant migration silently no-ops; the top role is missing 8 permissions

The seed migration creates a role with **slug `admin`**:

- `backend/apps/accounts/migrations/0003_seed_roles.py:11` — `"slug": "admin", "name": "Admin"`

Every subsequent grant migration targets that same slug and **skips silently when it is absent**:

- `0006_grant_audit_log_permission.py`, `0008_grant_api_keys_permission.py`, `0009_grant_integrations_permission.py`, `0010_grant_communications_permission.py`, `0011_grant_webhooks_permission.py:17`

```python
role = Role.objects.filter(slug=slug).first()
if role is None:
    continue          # ← silent no-op
```

**In this database there is no `admin` role at all.** The live top role is `slug='super_admin'`, `name='Super Admin'`, `is_system=True` — a slug that appears **nowhere in any migration** (only in a passing code comment at `backend/apps/portal/views.py:84`). All five grant migrations show as `[X]` applied and granted nothing.

**Measured — permissions missing from each role versus `ALL_PERMISSIONS`:**

| Role | Has | Missing |
|---|---|---|
| **Super Admin** | 13/21 | `api_keys.manage`, `branches.manage`, `branches.view`, `communications.manage`, `departments.manage`, `departments.view`, `integrations.manage`, `webhooks.manage` |
| Manager | 10/21 | 11, incl. `audit_log.view`, `settings.manage` |
| Agent | 5/21 | 16 |
| Customer | 2/21 | 19 (correct — portal role) |

**User-visible impact, confirmed live** as `admin@supportos.local` (Super Admin):

```
GET /api/departments/ -> 403
GET /api/branches/    -> 403
```

Yet the sidebar renders **Departments, Branches, ERP Sync and Channels** as links (see `docs/screenshots/home.png`). A "Super Admin" clicking them gets a permission error on their own system. Six admin screens are effectively dead.

**Fix — three parts, all needed:**

**1. Repair the data.** Reconcile by role *identity*, not by a hardcoded slug that has already drifted once:

```python
# backend/apps/accounts/migrations/00XX_repair_admin_grants.py
from django.db import migrations
from apps.core.permissions import ALL_PERMISSIONS

def repair(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    role = Role.objects.filter(slug__in=["admin", "super_admin"]).order_by("slug").last()
    if role is None:
        raise RuntimeError("No admin/super_admin role found — refusing to no-op silently.")
    role.permissions = sorted(ALL_PERMISSIONS)
    role.save(update_fields=["permissions"])
```

**2. Stop the silent skip.** A grant migration that finds no target role should **fail loudly**, not `continue`. A no-op permission migration is indistinguishable from a successful one — which is exactly how this survived five releases.

**3. Add a reconciliation command.** There is currently no `manage.py` command anywhere in the backend (`find apps -path "*management*"` returns nothing). A `sync_role_permissions --check` that diffs every system role against `ALL_PERMISSIONS` and exits non-zero on drift turns this whole class of bug into a CI failure.

---

#### F-3 — No automated tests for any domain logic

```
backend:  4 test files — all in apps/core/ (envelope, exceptions, health, pagination)
frontend: 0 test files
```

There is **not one test** for tickets, SLA computation, status transitions, assignment, escalation, permissions, portal isolation, reports, ERP sync, webhooks or authentication. `apps/tickets/status.py` implements a state-transition graph and `apps/sla/policy.py` computes breach status; neither is covered.

This is the root cause of F-1 and F-2 — both are exactly the kind of defect a single authorization test and a single role-integrity test would have caught on the day they were introduced.

**Recommendation** — you do not need broad coverage, you need *these four*:

1. **Authorization matrix**: for each role × each endpoint, assert the expected status code. ~60 lines; permanently closes the entire F-1 class.
2. **Portal isolation**: customer A must never reach customer B's data through *any* endpoint, writable relations included.
3. **Role integrity**: every system role's permissions ⊆ `ALL_PERMISSIONS`, and the admin role == `ALL_PERMISSIONS`.
4. **Ticket status transitions** against `is_valid_transition`.

---

#### F-4 — `DEFAULT_PERMISSION_CLASSES` is `AllowAny` (fail-open)

`backend/config/settings/base.py:291`

```python
"DEFAULT_PERMISSION_CLASSES": [
    "rest_framework.permissions.AllowAny",
],
```

The in-code comment acknowledges this ("the API stays open by default — any endpoint that must be protected sets `permission_classes` explicitly"). Today every view does set it explicitly, so **there is no live exposure** — but the default points the wrong way. Any new view added without `permission_classes` is public, and nothing in CI would catch it.

**Fix:** flip the default to `IsAuthenticated` and let the ~10 genuinely public views (health, branding, landing content, inbound webhooks, web form, live-chat start) keep their explicit `AllowAny`. They already declare it, so the change is inert today and protective tomorrow.

---

### 🟡 MEDIUM

#### F-5 — Default link colour fails WCAG AA in dark mode

`--primary` is defined identically in both themes:

- `frontend/src/index.css:109` — `--primary: oklch(0.546 0.215 262.881); /* same as :root */`

It is used as **text** (`text-primary`) in 34 places — every data-table link, "Forgot password?", every auth link (`frontend/src/shared/ui/data-table/TableLink.tsx`).

**Measured contrast (WCAG 2.x; AA body text requires 4.5:1):**

| `--primary` #2563EB as text on | Ratio | Result |
|---|---|---|
| dark `--background` #0A1018 | **3.69:1** | ❌ FAIL |
| dark `--card` #171D26 | **3.28:1** | ❌ FAIL |
| light `--background` #F8FAFC | 4.94:1 | ✅ PASS |
| light `--card` #FFFFFF | 5.17:1 | ✅ PASS |

The token was verified for its *button background* use (white on blue ≈ 8.6:1) but never for its *text* use. Dark mode is the default in all four shipped screenshots.

`--secondary` #64748B as text on a dark card measures **3.56:1** — also failing.

**Fix:** add a dedicated link token that lightens in dark mode instead of reusing the button fill:

```css
:root { --primary-text: var(--primary); }            /* 4.94:1 — OK */
.dark { --primary-text: oklch(0.72 0.15 262.881); }  /* ≈ #7FA5F5, ~6.5:1 */
```

…then point `TableLink` and the `link` button variant at `text-(--primary-text)`. This also fixes the branded case below.

---

#### F-6 — Org brand colours are contrast-checked for buttons, but not for links

`frontend/src/shared/branding/contrast.ts` is genuinely good work — `foregroundFor()` picks black or white so any admin-entered `primary_color` yields a legible **button label**. But `--primary` is *also* used as link text on the page background, and that direction is unchecked.

**Measured — brand colour used as link text:**

| Brand `primary_color` | on dark bg | on light bg |
|---|---|---|
| Navy `#1E3A8A` | **1.81:1** ❌ | 9.90:1 ✅ |
| Maroon `#7A1F2B` | **1.84:1** ❌ | 9.75:1 ✅ |
| Forest `#14532D` | **2.06:1** ❌ | 8.71:1 ✅ |
| Pink `#E879F9` (as shipped in screenshots) | 7.61:1 ✅ | **2.35:1** ❌ |

A corporate navy — the single most likely colour an enterprise will enter — renders links at **1.81:1** in dark mode: effectively invisible. The pink currently in the screenshots fails in *light* mode.

**Fix:** apply the F-5 `--primary-text` token and derive it from the brand colour by clamping lightness per theme rather than using the raw hex. Also validate `primary_color` server-side in `apps/organization` and warn the admin in Organization Settings when their colour cannot reach 4.5:1 in either theme.

---

#### F-7 — The management dashboard chart is visibly broken

Three defects in `frontend/src/shared/ui/chart/GaugeChart.tsx`, all visible in `docs/screenshots/management-dashboard.png`:

**(a) The first gauge's label is clipped away entirely.**
`GaugeChart.tsx:86` draws each label at `y={y - 4}`. For gauge index 0, `y = 0`, so the baseline sits at `-4` — above the SVG viewport and clipped. Every remaining label then falls in the gap *above* its own bar, reading as though it belongs to the bar above. The screenshot shows exactly that: bar 1 unlabelled, "SLA breach rate" floating beneath it, and the final bar (72.2%) with no label at all.

**(b) The chart renders at roughly half the width of its container.**
`GaugeChart.tsx:3` fixes `const WIDTH = 600`, while the element is `className="w-full"` with `style={{ height }}` in raw pixels. Under the default `preserveAspectRatio="xMidYMid meet"` the uniform scale becomes `min(1160/600, 132/132) = 1`, so the 600-unit chart draws at 1:1 and is **centred inside an ~1160 px container, leaving ~280 px of dead space on each side.** That is the large empty region on the left of the screenshot.

**(c) The value label can render outside the chart area.**
`GaugeChart.tsx:137` places the percentage at `xFor(value) + 4`. At 100 % that is user-x `604` — past the 600-unit viewBox — which is why "100%" sits detached from its bar and collides with the card edge.

**Fix:**

```tsx
const LABEL_HEIGHT = 18
const height = gauges.length * (BAR_HEIGHT + GAP) + LABEL_HEIGHT   // room for row 0's label

<svg
  viewBox={`0 0 ${WIDTH} ${height}`}
  preserveAspectRatio="none"        // (b) let it fill the container
  className="w-full"
  style={{ height }}
  role="img"
>
```

…offset every `y` by `LABEL_HEIGHT` for (a); for (c), flip the value label inside the bar when it runs long:

```tsx
const inside = gauge.value > 0.9
x={inside ? xFor(gauge.value) - 4 : xFor(gauge.value) + 4}
textAnchor={inside ? 'end' : 'start'}
```

> `preserveAspectRatio="none"` will stretch text horizontally. The cleaner alternative is to measure `WIDTH` with a `ResizeObserver`, or to render these horizontal bars as CSS flex `div`s — there is no real reason for them to be SVG at all.

**(d) No legend.** The three qualitative zones (green ≤10 %, amber ≤25 %, red >25 %) and the white target tick are never explained on screen. A reader cannot tell whether red is the track or the value. Add a small legend row beneath the chart.

---

#### F-8 — The ticket list has no Status filter, though the backend supports one

`backend/apps/tickets/views.py:141-145` implements and validates `?status=`:

```python
status = self.request.query_params.get("status")
if status:
    if status not in Ticket.Status.values:
        raise ValidationError({"status": [_("Must be a valid status.")]})
    queryset = queryset.filter(status=status)
```

Verified live: `?status=bogus` → `400`; `?status=open` → filtered. **The frontend never sends it.** `frontend/src/features/tickets/components/TicketListPage.tsx:56-58` declares filters for category, priority, department and branch — and the filter bar in `docs/screenshots/tickets.png` shows exactly four selects plus an "Only my tickets" toggle.

"Show me the open tickets" is the most common query in any helpdesk, and it is the one filter missing. The backend work is already done; this is a ~15-line frontend change mirroring the existing `priorityFilter` select.

---

#### F-9 — SLA status is invisible from the ticket queue

`compute_sla_status` is reachable only through a per-ticket detail action (`backend/apps/tickets/views.py:309`, `GET /tickets/{id}/sla/`). It is **not on `TicketSerializer`**, so the list endpoint cannot expose it and the ticket table has no SLA column (columns are: subject, customer, category, department, branch, assignee, status, priority, created_at).

The consequence is a genuine workflow hole: the management dashboard reports an SLA breach rate of **100 %**, but an agent has no way to find *which* tickets are breaching short of opening all 36 one at a time.

**Fix:** add a lightweight `sla_status` field (`ok` / `at_risk` / `breached` / `null`) to `TicketSerializer`, computed over the already-`select_related`ed rows, then surface it as a sortable, filterable column. Confirm the query count stays at 4 — the current N+1 hygiene is excellent and must not regress.

---

#### F-10 — The OpenAPI schema is substantially incomplete (38 warnings)

`manage.py check --deploy` under prod settings reports 38 `drf_spectacular` issues — and, to its credit, **zero security warnings**, so the production hardening itself is properly done. The 38 fall into three groups:

- **26 × W002** — plain `APIView`s with no `serializer_class`, so the generator gives up and **omits the view from the schema entirely.** This covers every report endpoint, every auth endpoint (`MeView`, `LogoutView`, `ChangePasswordView`, password reset), every inbound webhook, plus branding, settings and landing content. Anyone generating a client from this schema gets none of them.
- **5 × W001 (component collision)** — `apps.tickets.serializers.CategorySerializer` and `apps.knowledge_base.serializers.CategorySerializer` both claim the name `Category`. The tool warns this "will very likely result in an incorrect schema."
- **1 × enum collision** — `status` resolved to the generated name `Status6f2Enum`.

**Fix:** add `@extend_schema(request=..., responses=...)` to the APIViews (the report views share `BaseReportView`, which can carry most of it), rename one `CategorySerializer` (e.g. `ArticleCategorySerializer`), and add an `ENUM_NAME_OVERRIDES` entry for `status`.

---

### 🔵 LOW / POLISH

| # | Finding | Location |
|---|---|---|
| F-11 | `ChartFrame`'s `action` prop is documented "Rendered next to the title" but is a plain block child of `CardHeader`, so the Export CSV button **stretches full width** below the description (clearly visible in the dashboard screenshot). Wrap the header in a flex row and right-align the action. | `frontend/src/shared/ui/chart/ChartFrame.tsx:58` |
| F-12 | Duplicate page title — `PageHeader title={t('dashboard.title')}` and `ChartFrame title={t('dashboard.title')}` render the same string twice, stacked. | `ManagementDashboardPage.tsx:55` and `:90` |
| F-13 | The four KPI drill-down links use `variant="ghost"`, so they render as unstyled plain text with no border, background or hover affordance — they read as a caption, not navigation. Use `variant="outline"`, or style them as tabs. | `ManagementDashboardPage.tsx:129` |
| F-14 | Date-range presets ("Last 7 days" / "Last 30 days" / "This month") have **no selected state**, so the user cannot tell which range is applied; the date inputs also start empty, leaving the initial period ambiguous. Default to "Last 30 days" and mark it active. | `DateRangePresets.tsx` |
| F-15 | `<input type="date">` renders `mm/dd/yyyy` — the browser's US format, not the user's locale. For an Arabic/Gulf product this is wrong and cannot be fixed via `lang`. Consider a locale-aware date picker. | `ManagementDashboardPage.tsx:64,76` |
| F-16 | The sidebar brand renders as "Organization Supp…" with no `title` attribute, so the truncated org name is unrecoverable on hover — `BrandMark` already holds the full string. | `frontend/src/shared/branding/BrandMark.tsx` |
| F-17 | An invalid `?ordering=` is **silently ignored** (200, unsorted). This contradicts the project's own rule in `apps/core/scoping.py`: *"NEVER a silent no-op: a typo'd filter that quietly returns everything is the harder bug to find."* Invalid `?department=` correctly 400s; `?ordering=` should too. | `backend/config/settings/base.py:269` |
| F-18 | `oxlint`: ref accessed during render. | `LiveChatWidget.tsx:178` |
| F-19 | `tabIndex={0}` on an SVG `<rect role="img">` creates a focusable element with no visible focus ring — an invisible tab stop for keyboard users. | `GaugeChart.tsx:122` |
| F-20 | The chunk named `reportKeys-*.js` is 381 kB (110 kB gzip) — it is really Recharts, named after an arbitrary module. Correctly lazy-loaded, so no runtime cost, but it makes bundle analysis misleading. Add a `manualChunks` entry naming it `recharts`. | `frontend/vite.config.ts` |

---

## 4. UI/UX review

Reviewed against the four shipped screenshots in `docs/screenshots/`, plus component source.

### What is genuinely good

- **Design tokens are exemplary.** Every colour is a token, each annotated with its source and a *verified contrast ratio* (`--success-foreground: /* 6.37:1, verified; white text fails at 3.30:1 */`). Motion is tokenised to a documented 150/200/300 ms scale with a reduced-motion policy. This is better than most production design systems.
- **RTL is real, not retrofitted.** A CI script (`check:rtl`) rejects physical direction utilities outright, and `GaugeChart` flips its coordinate mapping algebraically for RTL. Arabic parity is complete: 1007 keys, correct plural forms (`_zero/_one/_two/_few/_many`), with only brand names (Facebook, WhatsApp) left untranslated — which is right.
- **Accessibility fundamentals are handled.** `aria-sort` on sortable headers, `sr-only` labels on every icon-only button, a visually-hidden `<caption>` required on every table, `alt` on all images, `rel="noreferrer"` on external links, no `onClick` on non-interactive elements, and charts never rely on colour alone (every gauge prints its own percentage).
- **The responsive strategy is deliberate.** `DataTable` supports per-column `priority: 'sm'` (4 of 9 ticket columns drop on mobile), the table container is `overflow-x-auto`, and the sidebar auto-collapses below 640 px on first visit.
- **Error / loading / empty states are systematised** via `QueryBoundary`, `ErrorState`, `Empty`, `Loading` and skeletons — no ad-hoc spinners anywhere.
- **The Customers screen is the strongest page**: clear hierarchy, a result count ("12 results"), working pagination, sort affordance on the active column.

### Issues, by screen

**Home / dashboard** (`home.png`)

1. **Card-type ambiguity.** Row 1 holds three KPI *statistics*; rows 2–3 hold six *navigation shortcuts*. All nine use identical styling and size, so nothing signals which are clickable. Differentiate the KPI tiles (larger numeral, no hover) from the nav cards (hover/press state, chevron).
2. **The six nav cards duplicate the sidebar exactly** — My Tickets, Tasks, Customers, Knowledge base and Users all appear twice on screen. They consume the entire first fold and add no information. Replace with something only a dashboard can give: tickets breaching SLA, oldest unassigned, today's volume.
3. **"Tasks due soon" occupies a ~300 px card to show one line of empty-state text**, while "Your recent tickets" beside it is dense. Let the empty card shrink.
4. **Zero-value KPIs render with a slashed-zero glyph** that reads as "∅ / null" rather than the number 0, and looks inconsistent beside the plain "3". Use `font-variant-numeric: tabular-nums lining-nums`.
5. **Recent-ticket rows have no link affordance** — subjects are plain foreground text with no colour, underline or hover cue, though they are the primary action on that card.

**Tickets** (`tickets.png`)

6. **No Status filter** — see F-8. The highest-value filter is the missing one.
7. **Badge overload.** Status *and* Priority both render as saturated filled pills on every row. Eighteen rows × two coloured pills, plus pink links, produces a rainbow that defeats scanning. Convention: make one low-emphasis (a coloured dot + text for priority) and keep the badge for status.
8. **Priority treatment is inconsistent** — Urgent/High/Medium get filled badges, but **Low renders as plain text with no badge at all**, so the column has no consistent shape to scan down.
9. **No SLA column** — see F-9. For a support queue this is the most conspicuous omission.
10. **No bulk actions.** No row selection, so an agent cannot bulk-assign, bulk-close or bulk-reprioritise. For a queue tool this is a significant daily-workflow gap.
11. **Search field inconsistency**: full-width (~1170 px) on Tickets, ~400 px on Customers, for the same control. Pick one.
12. **No result count above the fold** on Tickets (Customers shows "12 results"). With 18+ rows visible and pagination below, the user cannot tell how large the filtered set is.
13. **Sortability is invisible until used** — only the active column shows a chevron. Add a low-opacity affordance on hover for every sortable header.
14. **"Resolved" vs "Closed" overlap semantically** and is not self-evident to users. Either explain it in a tooltip or collapse to one terminal state.

**Management dashboard** (`management-dashboard.png`)

15. See F-7 (clipped label, half-width rendering, overflowing value label, no legend), F-11 (full-width Export button), F-12 (duplicate title), F-13 (unstyled drill-down links), F-14/F-15 (date-range UX). **This is the weakest screen in the product, and the one most likely to be shown to a buyer.** It should be prioritised.
16. **The lower ~50 % of the viewport is empty.** With four KPIs there is room for the trend sparkline each one drills into.

**Cross-cutting**

17. **Brand colour and semantic colour do not harmonise.** With `primary` set to pink, links and primary buttons are pink while "Open" stays blue, "In progress" amber, "Resolved" green and "Urgent" red — five competing hues in one table. Either derive status hues from the brand, or desaturate status badges to neutral chips with a coloured indicator.
18. **Empty-cell treatment is inconsistent.** Tickets renders "No department" / "No branch" as literal text; Customers leaves empty Company cells blank. Standardise on a muted em-dash.
19. **The floating chat widget uses a photographic palm-tree emoji** as its launcher, overlapping table content bottom-right on every screen. It reads as a misplaced avatar rather than a support control — use the brand mark or a chat glyph.
20. **The sidebar carries ~20 flat items across three sections** and already scrolls at a 900 px viewport height; Administration alone holds 10. Worth a nested / secondary-navigation pass before more features land.
21. **The tablet range (640–1024 px) is untuned.** Across all 572 files there are only 35 `sm:`, 3 `md:`, 13 `lg:` and 1 `xl:` utilities. Below `sm` the column-priority system works well, but between `sm` and `lg` all nine ticket columns render in a cramped width with no intermediate tier. Add a `priority: 'lg'` tier.

---

## 5. Recommended enhancements

Ordered by value-to-effort.

### Ship first (small, high impact)

1. **Close F-1** — constrain `TaskSerializer.ticket` to the caller's own tickets. ~8 lines; closes a live data leak.
2. **Repair and guard the role grants (F-2)** — reconciliation migration, plus make grant migrations fail loudly on a missing role. Restores six admin screens.
3. **Add the Status filter (F-8)** — the backend is done; mirror the existing priority select. ~15 lines.
4. **Fix the dashboard chart (F-7 a–c)** — label offset, `preserveAspectRatio`, value-label flip. ~20 lines, transforms the worst screen in the product.
5. **Add `--primary-text` (F-5)** — one token, two declarations; fixes 34 failing link instances in dark mode.
6. **Flip `DEFAULT_PERMISSION_CLASSES` to `IsAuthenticated` (F-4)** — inert today, protective forever.

### Next

7. **Authorization matrix + portal isolation + role integrity tests (F-3).** Roughly 150 lines total, permanently closing the two classes of bug found in this review. The highest-leverage engineering work available in the repo right now.
8. **`manage.py sync_role_permissions --check`** wired into CI — turns permission drift into a build failure.
9. **`sla_status` on the ticket list (F-9)**, plus column and filter. Closes the queue → SLA workflow gap.
10. **Complete the OpenAPI schema (F-10)** — 26 endpoints are currently missing from any generated client.
11. **Contrast-validate org brand colours (F-6)** server-side, and warn in Organization Settings.

### Product-level

12. **Bulk actions on the ticket queue** (select → assign / status / priority). The largest single agent-productivity win available.
13. **Saved views / filter presets** ("My open urgent", "Unassigned breaching") — the filter primitives already exist; only persistence is missing.
14. **Replace the six duplicate nav cards on Home** with real operational signal (SLA-breaching, unassigned backlog, today's volume).
15. **Global command palette (⌘K)** for ticket and customer lookup — with 20 sidebar items, navigation is the friction point.
16. **Status/priority visual rebalance** — one badge, one dot. An immediate improvement to queue scannability.

---

## 6. Reproducing this review

```bash
# Static gates
cd frontend && npx tsc -b && npx oxlint && node scripts/check-rtl.mjs && npx vite build
cd ../backend && python -m ruff check . && python -m ruff format --check .
python manage.py check
python manage.py makemigrations --check --dry-run
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy

# Role integrity — reproduces F-2
python manage.py shell -c "
from apps.accounts.models import Role
from apps.core.permissions import ALL_PERMISSIONS
for r in Role.objects.all():
    print(r.slug, r.name, sorted(ALL_PERMISSIONS - set(r.permissions)))
"
```

**F-1** requires a portal-customer JWT: create a `User` holding the `customer` role with a linked `Customer`, then `POST /api/tasks/` with any `ticket` id that does not belong to them.

**Query-count / N+1 check**: enable `settings.DEBUG`, drive the list endpoints through Django's test `Client` with a JWT, and read `len(connection.queries)`. Current baseline — tickets 4, customers 4, users 4, categories 4, audit-logs 4.
