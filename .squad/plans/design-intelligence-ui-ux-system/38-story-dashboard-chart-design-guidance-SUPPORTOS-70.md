# Story 38 — (DSN-3) Dashboard Chart Design Guidance (Story: SUPPORTOS-70)

## Prerequisites

- **`DSN-0` (Story 35) is complete.** `CONVENTIONS.md` § 25's token reconciliation table (line 1447) already flags `--chart-1`…`--chart-5` as **"Defer to DSN-3"** — this story resolves that row. `DSN-1`/`DSN-2` (Stories 36-37) are unrelated to this story's scope and already complete; neither is a dependency (`SupportOs backlog.MD:522`, `Dependencies: DSN-0` only).
- **This is a documentation-only, foundation story — the same shape as `DSN-0` (Story 35), not `DSN-1`/`DSN-2`.** `Reports & Analytics` (`EPIC 11`, `SupportOs backlog.MD:600-637`) is entirely unbuilt: `grep -rn "recharts\|chart.js\|apexcharts\|d3" frontend/package.json` returns nothing, and no `apps/reports`-equivalent exists in `backend/apps/`. There is no chart wrapper, no report screen, no report API to attach a chart-type decision to yet. This story's entire deliverable — per the intake's own words, "**Record** the skill's chart-type recommendations... **for** the shared chart wrapper built later" — is the recorded guidance itself, in `CONVENTIONS.md` § 25, that `RPT-0` (Reporting Foundation, unplanned) will read and implement against. **No frontend or backend file changes.**
- **The five reports this guidance must cover are fixed and enumerated, not invented:** `SupportOs backlog.MD:605-633` — `RPT-0` (Reporting Foundation, the chart wrapper itself), `RPT-1` (Ticket Reports — "Volume/trends by status/category/channel/time"), `RPT-2` (SLA Performance — "Response/resolution times, breach rates", depends on `SLA-1`), `RPT-3` (Agent Performance — "Handled/resolution time/CSAT per agent"), `RPT-4` (Customer Satisfaction — "Aggregate satisfaction trends", depends on `PORTAL-5`), `RPT-5` (Management Dashboards — "Open tickets, SLA health, CSAT, agent load in one dashboard reusing RPT-0 charts", depends on `RPT-1..4`).
- **Every chart-type recommendation below is a fresh, verified query result from `.claude/skills/ui-ux-pro-max/data/charts.csv`** (via `scripts/search.py --domain chart`), run against each report's actual data shape from the backlog line above — not carried over unverified from Story 35's placeholder table (`CONVENTIONS.md` lines 1509-1526, which this story replaces), and not invented.
- **Pie/Donut was queried and explicitly rejected for the one part-to-whole report (CSAT breakdown, `RPT-4`).** `charts.csv` rates Pie/Donut **`risk:high`** for accessibility ("unlabeled color-only slices are inaccessible... offer a non-pie fallback") versus Waffle Chart's **`risk:low`** for the same part-to-whole use case (≤5 categories, same as this report's satisfied/neutral/dissatisfied breakdown) — Waffle is the recommendation, matching `ux-guidelines.csv` row 37 ("Color Only," already cited in `CONVENTIONS.md` § 25's UX guidance).
- **`--chart-1`…`--chart-5` are resolved as "keep current," not reassigned** — reasoning recorded below (task 2) rather than left as a further "Defer." `design-system/supportos/MASTER.md` generates no 5-swatch categorical palette (confirmed already in Story 35's own finding, `CONVENTIONS.md` line 1447), and no single `charts.csv` row supplies one either — each row gives colors for its *own* chart's specific semantic roles (e.g. Bullet's red/yellow/green target zones), not a general-purpose "5 distinguishable series colors" set. Inventing 5 new hex values with no source would be exactly the "generic guess" Story 35 declined to make. The current shadcn defaults (`frontend/src/index.css` lines 29-33/67-71) are already a five-hue, mutually-distinguishable, widely-used qualitative palette, untouched by `DSN-1`'s retint — reusing them is the grounded choice, not a punt.

---

## Story Goal

**`CONVENTIONS.md` § 25 gains a complete, per-report chart-type guidance table** (replacing Story 35's four-row placeholder, `CONVENTIONS.md` lines 1509-1526) covering all eight distinct chart needs across the five `RPT-*` reports, each with: the exact chart type, the library recommendations `charts.csv` itself names, the accessibility floor (data-table fallback, never color-alone), and the specific color values `charts.csv` supplies for that chart's own semantic roles (target-zone colors, series colors, etc.).

**The token reconciliation table's `--chart-1`…`--chart-5` row is resolved** from "Defer to DSN-3" to a recorded "keep current" decision, with the semantic status-zone colors (bullet/gauge red/yellow/green, target marker) documented as *separate*, chart-specific guidance — not forced into the five generic slots, since they serve a different role (a bounded 3-zone status scale, not an open-ended multi-series palette).

**Not in scope** (per the intake's own "for the shared chart wrapper built later" framing): choosing or installing a chart library, writing any chart component, adding any new CSS custom property, or touching `frontend/src/index.css` — `RPT-0` does that when it exists, reading this guidance.

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-70/intake.md` — one task, no attachments, no acceptance criteria.
2. `SupportOs backlog.MD` lines 600-637 (`EPIC 11 — Reports & Analytics`) — the five `RPT-*` stories and their exact data-shape wording this story's table is built from; line 796 (Foundation Map: `DSN design system + chart guidance (DSN-0, DSN-3) → EPIC 8`).
3. `CONVENTIONS.md` lines 1395-1526 (`## 25. Design intelligence`) — specifically line 1447 (the `--chart-1..5` "Defer to DSN-3" row task 2 resolves) and lines 1509-1526 (the placeholder "Chart-type guidance" subsection task 1 replaces in full).
4. `frontend/src/index.css` lines 29-33 (`:root`'s `--chart-1`…`--chart-5`) and lines 67-71 (`.dark`'s) — the current shadcn defaults task 2's "keep current" decision applies to; confirm they are untouched since Story 36 (which explicitly left them alone per its own `## Story Goal`).
5. `.claude/skills/ui-ux-pro-max/data/charts.csv` — the source catalog every row in task 1's table cites; confirm the "Best Chart Type," "Color Guidance," "Accessibility Risk," and "Library Recommendation" columns exist exactly as quoted (already verified once for this plan via `scripts/search.py --domain chart` against each report's real data shape — task 1 records those verified results, it does not re-derive them).
6. `design-system/supportos/MASTER.md` (214 lines, full file) — confirm it contains no chart-specific section (its Component Specs cover buttons/cards/inputs/modals only, `CONVENTIONS.md` lines 1413-1417 area) — i.e. `charts.csv` is the only source for this story, not MASTER.md.

---

## Documentation Task

### 1 — Replace the "Chart-type guidance" subsection

**File: `CONVENTIONS.md`** — replace lines 1509-1526 in full:

```markdown
### Chart-type guidance (for `RPT-0`)

Recorded by `DSN-3` (Story 38, `SupportOs backlog.MD:520`) against each
`RPT-*` report's actual data shape (`SupportOs backlog.MD:600-633`), queried
fresh from `charts.csv` — not a generic chart-type list. `RPT-0`
(Reporting Foundation, unplanned) implements its shared chart wrapper
against this table; no chart library, component, or token exists yet.

| Report | Data shape | Chart type | Library options | Color guidance |
|---|---|---|---|---|
| `RPT-1` Ticket Reports — trend over time | Trend Over Time | Line Chart (Area as secondary) | Chart.js, Recharts, ApexCharts | Primary `#0080FF`; multi-series needs distinct color **and** distinct line style (solid/dashed/dotted), never hue alone |
| `RPT-1` Ticket Reports — by status/category/channel | Compare Categories | Bar Chart, horizontal or vertical | Chart.js, Recharts, D3.js | One distinct color per bar (from `--chart-1..5`, see below); always sort descending by value |
| `RPT-2` SLA Performance — response/resolution time trend | Trend Over Time | Line Chart | Chart.js, Recharts, ApexCharts | Same as `RPT-1`'s trend row |
| `RPT-2` SLA Performance — breach rate vs. target | Performance vs Target | Gauge Chart (single KPI) or Bullet Chart (3+ KPIs in a grid) | D3.js, ApexCharts, Custom SVG | Qualitative zones `#FFCDD2`/`#FFF9C4`/`#C8E6C9` (bad/ok/good); performance bar `#1976D2`; target marker a black 3px line — zones must carry a text label, never color alone |
| `RPT-3` Agent Performance — handled/resolution/CSAT per agent | Compare Categories (ranked) | Horizontal Bar Chart | Chart.js, Recharts, D3.js | Same as `RPT-1`'s category row; ≤15 agents before switching to a paginated table |
| `RPT-4` Customer Satisfaction — trend over time | Trend Over Time | Line Chart | Chart.js, Recharts, ApexCharts | Same as `RPT-1`'s trend row |
| `RPT-4` Customer Satisfaction — satisfied/neutral/dissatisfied breakdown | Part-to-Whole (≤5 categories) | Waffle Chart — **not** Pie/Donut (`charts.csv` rates Pie/Donut `risk:high` for accessibility vs. Waffle's `risk:low` for the same use case) | D3.js, React-Waffle, Custom CSS Grid | Distinct accessible color pair per category, always labeled with percentage text; 10×10 grid standard |
| `RPT-5` Management Dashboards — combined KPIs (open tickets, SLA health, CSAT, agent load) | Performance vs Target (Compact), 4 KPIs | Bullet Chart grid (`charts.csv`'s own "ideal for 3-10 bullet charts in a grid" range) | D3.js, Plotly, Custom SVG | Same qualitative-zone + target-marker colors as `RPT-2`'s breach-rate row — `RPT-5` reuses `RPT-0`'s charts (`SupportOs backlog.MD:633`), not a new chart type |

**Accessibility floor, every row (`charts.csv`, all `risk:low` except Waffle
which is also `risk:low`):** a visible data table or text summary fallback;
color always paired with a text label, distinct line style, or shape — never
color alone. Keyboard: focus reveals the same detail hover does; sortable
headers expose `aria-sort`.

**`--chart-1`…`--chart-5` (`frontend/src/index.css` lines 29-33, 67-71):
kept as the current shadcn defaults**, used for the Line/Bar rows' multi-series
and multi-category color needs above. No `DSN`-sourced 5-swatch categorical
palette exists to adopt instead (`design-system/supportos/MASTER.md` has none;
no single `charts.csv` row supplies a general-purpose set). The Bullet/Gauge
qualitative zones (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) and Waffle's category pairs
are a **separate**, bounded, chart-specific color need — not `--chart-1..5`
slots — and are recorded in the table above for `RPT-0` to name as its own
tokens when it exists.
```

---

### 2 — Resolve the `--chart-1..5` token reconciliation row

**File: `CONVENTIONS.md`** line 1447 — replace the row:

```markdown
| `--chart-1` … `--chart-5` (lines 29-33) | five achromatic-to-hued shadcn defaults | Not in MASTER.md — chart *type* guidance only (see "Chart-type guidance" below); no fixed 5-color chart palette was generated | **Defer to DSN-3** | `DSN-3`'s own task is picking chart types per report first (line/bar/bullet, below); assigning `--chart-1..5` hex values is that story's job, not a generic guess here. |
```

with:

```markdown
| `--chart-1` … `--chart-5` (lines 29-33) | five achromatic-to-hued shadcn defaults | Not in MASTER.md — no fixed 5-color chart palette exists anywhere in `DSN` (confirmed by `DSN-3`, Story 38) | **Resolved (Story 38) — keep current** | Already a mutually-distinguishable five-hue qualitative palette, untouched by Story 36's retint; no `DSN`-sourced alternative exists to adopt instead. See "Chart-type guidance" below for the separate, bounded status-zone colors (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) Bullet/Gauge charts need, which are not `--chart-1..5` slots. |
```

---

## Edge Cases & Failure Modes

- **A future `RPT-0` implementer skips this table and picks chart types ad hoc.** This story's whole point (intake: "chart choices are justified up front, not picked ad hoc") is defeated only if `RPT-0`'s plan doesn't cite `CONVENTIONS.md` § 25 — flag this explicitly when `RPT-0` is eventually planned, the same way this story's own `## Context` cites `SupportOs backlog.MD` line numbers instead of re-deriving them.
- **`RPT-0` needs a 6th or 9th chart type not in this table** (e.g. a future report with a genuinely new data shape). The table is scoped to the five reports named in `EPIC 11` today (`SupportOs backlog.MD:600-633`) — a new report added later queries `charts.csv` fresh via the installed `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max/`, still installed from Story 35) rather than forcing an ill-fitting row from this table.
- **A future story reassigns `--chart-1..5` without reading this story's "keep current" reasoning** — the resolved reconciliation-table row (task 2) and this subsection's own explicit callout are the two places that reasoning now lives; both must be updated together if a real `DSN`-sourced palette becomes available later (e.g. a re-run of `search.py --design-system` with a narrower, dashboard-specific product description).
- **The Bullet/Gauge qualitative-zone colors (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) get hand-copied into `--chart-1..5` by mistake** when `RPT-0` is built — this story explicitly separates the two (task 1's closing paragraph) precisely to prevent that; `RPT-0`'s own plan should name new tokens for them (e.g. a status-zone scale), not overload the categorical `--chart-*` slots.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added — this story changes only `CONVENTIONS.md`.

1. No frontend impact: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) are unaffected — zero files under `frontend/` change. Re-run once to confirm.
2. No backend impact: `python manage.py test` (from `backend/`) is unaffected.

---

## Verification Steps

1. **`CONVENTIONS.md` renders cleanly:** the replaced "Chart-type guidance" subsection (task 1) and the resolved `--chart-1..5` row (task 2) both read correctly — no broken table formatting, no dangling reference to "Defer to DSN-3" left anywhere in § 25.
2. **Every chart-type claim traces to a real `charts.csv` row:** spot-check 2-3 rows of the new table against a fresh `python .claude/skills/ui-ux-pro-max/scripts/search.py "<report's data shape>" --domain chart --full` query — the "Best Chart Type" and "Color Guidance" fields match what's recorded.
3. **No code changed:** `git diff --stat` shows only `CONVENTIONS.md`.
4. **Backend/frontend unaffected:** `python manage.py test` (backend) and `npm run build` (frontend) both still pass, confirming this was a pure documentation change.

---

## Done Criteria

- [ ] `CONVENTIONS.md` § 25's "Chart-type guidance" subsection replaced with the full 8-row, five-report table (task 1), including the accessibility-floor paragraph and the `--chart-1..5` "keep current" callout.
- [ ] `CONVENTIONS.md` § 25's token reconciliation table row for `--chart-1..5` (line 1447) changed from "Defer to DSN-3" to "Resolved (Story 38) — keep current" (task 2).
- [ ] No file under `frontend/` or `backend/` changed — `git diff --stat` confirms `CONVENTIONS.md` only.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** This is the last unplanned story in `EPIC 8 — Design Intelligence & UI/UX System` (`SupportOs backlog.MD:496-524`) — `DSN-0` through `DSN-3` are all planned (and `DSN-0`/`DSN-1`/`DSN-2` implemented) once this lands. `EPIC 9 — Knowledge Base` (`SupportOs backlog.MD:529-541`) is next in sequence and depends on `DSN` (`SupportOs backlog.MD:531-532`) — it is unplanned and needs its own intake.
