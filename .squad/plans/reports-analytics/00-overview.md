# reports-analytics — plan overview

Entry point for the **reports-analytics** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 55 | [55-story-reporting-foundation-SUPPORTOS-76.md](55-story-reporting-foundation-SUPPORTOS-76.md) | Reporting Foundation | SUPPORTOS-76 | Story 38 (`DSN-3`, chart guidance) |

## Dependency notes

This feature maps to **EPIC 11 — Reports & Analytics** in `SupportOs backlog.MD` (lines 628-663). The epic's own header declares it depends on Ticket Management (EPIC 4, complete), SLA (EPIC 7, complete), and Portal CSAT (`PORTAL-5`, complete) — all three of the data sources its reports aggregate already exist and are populated.

`RPT-0` (story 55) is the 🔑 foundation every other story in the epic builds on: `RPT-1` (Ticket Reports), `RPT-2` (SLA Performance, also depends on `SLA-1`), `RPT-3` (Agent Performance), and `RPT-4` (Customer Satisfaction, also depends on `PORTAL-5`) each add one report on top of it, and `RPT-5` (Management Dashboards) depends on `RPT-1..4` and explicitly reuses `RPT-0`'s charts rather than adding a chart type (`SupportOs backlog.MD:663`).

**Its design input already exists and is not re-derived.** `CONVENTIONS.md` § 25's "Chart-type guidance (for `RPT-0`)" (lines 1619-1652) was written by Story 38 (`DSN-3`) specifically for this story — a seven-row table naming the chart type, library options, and color guidance for each `RPT-*` data shape, plus an accessibility floor (a data-table or text-summary fallback for every chart; color always paired with a label, line style, or shape; keyboard focus revealing what hover reveals). Story 55 implements against that table rather than choosing chart types itself. See [`../design-intelligence-ui-ux-system/00-overview.md`](../design-intelligence-ui-ux-system/00-overview.md).

**Story 55 ships infrastructure and no domain surface** — the same shape Story 27 (`SLA-0`) took for background jobs (see [`../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md`](../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md)). Four things a reader would expect it to add are deliberately deferred to `RPT-1`, each forced by an explicit project rule rather than by preference:

| Deferred to `RPT-1` | The rule that forces it |
|---|---|
| `Permissions.REPORTS_VIEW` + its grant migration | `apps/core/permissions.py:5-7` — *"a permission that no view declares must not be grantable"*, and lines 22-24, constants land *"in the same change as the viewset that declares them"*. |
| `apps/reports/urls.py` + the `config/api_urls.py` line | `backend/apps/README.md:52-56` — *"an app gets a `urls.py` when it has a route… an empty file is a promise the codebase has not made yet"*. |
| `features/reports/`, its route, sidebar link, and i18n namespace | Story 55 ships no screen; its frontend surface is `shared/ui/chart/` plus a `chart` block in the existing `common` namespace. |
| Bullet/Gauge and Waffle charts | § 25 assigns them to `RPT-2`/`RPT-5` and `RPT-4`; each has exactly one first consumer and needs chart-specific colors § 25 says are *"not `--chart-1..5` slots"*. They are built **inside** `ChartFrame` by those stories — which is what makes `ChartFrame` the reusable wrapper the intake asked for. |

Line and Bar charts are the exception and **do** ship in story 55, for a structural reason rather than a stylistic one: `no-restricted-imports` (`frontend/.oxlintrc.json:8-18`) forbids one feature importing another's code, so a Line chart built inside `RPT-1` could never be reused by `RPT-2` or `RPT-4`. `shared/ui/` is the only place they can live, and `RPT-0` is the only story that can put them there.

**Three findings from story 55 that later stories inherit rather than rediscover:**

- **The export query parameter is `?export=csv`, never `?format=csv`.** DRF's `DefaultContentNegotiation` reads `?format=` as a renderer override and raises `Http404` when no renderer matches (`rest_framework/negotiation.py:41-45, 80-89`); this project registers exactly one renderer, format `"json"`. Worse, `APIView.initial()` negotiates *before* it checks permissions (`rest_framework/views.py:404-420`), so `?format=csv` would 404 before any view body or permission check ran, with no way for a subclass to intervene. `BaseReportView` names the parameter `export` and records why in a comment.
- **A CSV response is a plain `HttpResponse`, not a DRF `Response`** — that is what bypasses `EnvelopeJSONRenderer`. Verified against `finalize_response`, which attaches a renderer only to a DRF `Response` (`rest_framework/views.py:434`), and already relied on once by `AttachmentViewSet.download` (Story 21). No `CsvRenderer` is added alongside `PlainTextRenderer`.
- **No chart library, decided once for the whole epic.** Two of the four chart types EPIC 11 needs (Bullet, Waffle) have no mainstream React library implementation, and § 25 lists only D3/Plotly/Custom SVG/Custom CSS Grid for them — so no single library covers the epic, and adopting one would mean two rendering paradigms plus custom work anyway to satisfy § 25's accessibility floor and this project's RTL discipline. Recharts was the alternative considered and rejected. Same call Story 51 made against the shadcn `sidebar` component and Story 18 made against `django-filter`.

**Gap-filling is the non-obvious core of the aggregation half.** A trend series with a missing bucket draws a straight line across a real zero and silently lies; `bucketed_counts` therefore returns every bucket in range, `value: 0` included. Two related quiet-failure modes are pinned down in the plan's own edge cases and verification: Django's `TruncWeek` truncates to **Monday** (a spine that steps in 7-day increments from an arbitrary start matches nothing and renders the whole series as zeros), and a default `Meta.ordering` — `Ticket`'s is `("-created_at",)` — joins itself into the `GROUP BY` and fragments an aggregate into one row per record unless `.order_by()` is called explicitly.

**Note on testing:** per standing project policy this project authors no automated tests. Story 55 adds none. Its checks are `manage.py check`/`makemigrations --check`/`ruff`, direct `manage.py shell` exercise of every helper against real seeded data (including a `sum == count` assertion that catches aggregate fragmentation and a Monday assertion that catches the week spine), an Arabic CSV opened in Excel to prove the UTF-8 BOM, the frontend's `lint`/`format:check`/`check:rtl`/`build`, an `en`/`ar` key-set diff, and a bilingual visual pass over the charts including a greyscale check that the line dash patterns — not the hues — carry the series distinction.
