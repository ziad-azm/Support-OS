# multi-department-multi-branch-branding — plan overview

Entry point for the **multi-department-multi-branch-branding** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 87 | [87-story-multi-department-SUPPORTOS-112.md](87-story-multi-department-SUPPORTOS-112.md) | Multi-Department (`ORG-1`) | SUPPORTOS-112 | Story 53 (`SEC-4`, `../security-administration/`), Story 18 (`TKT-2`, `../ticket-management/`), Story 48 (`SEC-1`, `../security-administration/`), Story 56 (`RPT-1`, `../reports-analytics/`) |

## Dependency notes

This feature maps to **EPIC 16 — Multi-Department / Multi-Branch / Branding** (`SupportOs backlog.MD` lines 923-946): `ORG-1` Multi-Department, `ORG-2` Multi-Branch, `ORG-3` Custom Branding. The epic's own `Depends on` line reads *"Ticket Management, SEC-4"* — both are complete.

**`ORG-1` → `ORG-2` is a strict sequence**, per `ORG-2`'s own backlog dependency line. `ORG-3` depends only on `SEC-4` and is independent of both.

- **Story 87 (`ORG-1`, `SUPPORTOS-112`, this one)** — promotes `OrganizationSettings.departments` (a `JSONField` string list SEC-4 shipped as an explicit placeholder) into the real `organization.Department` model, adds nullable `SET_NULL` FKs from `accounts.User` and `tickets.Ticket`, and ships the 🔑 reusable scoping mechanism `apps/core/scoping.py` that the rest of the epic consumes.
- **`ORG-2` Multi-Branch** — not yet planned. It promotes the *other* half of the same JSON pair (`OrganizationSettings.branches`) using Story 87's migration sequence as its template, adds `Branch` FKs to users/customers/tickets, and reuses `apps/core/scoping.py` by appending one `ScopeFilter(param="branch", field="branch")` per viewset — no new filter code.
- **`ORG-3` Custom Branding** — not yet planned. Builds on `OrganizationSettings.name`/`logo_url` (already shipped by SEC-4) plus `DSN` design tokens; touches neither `Department` nor the scoping module.

## Cross-story contracts established by Story 87

These are the shapes `ORG-2` must follow rather than re-invent:

1. **`apps/core/scoping.py` is the only place a `?<param>=` scope filter is parsed.** `ScopeFilter(param, field)` declares one; `apply_scope_filters()` applies a tuple of them to any queryset; `ScopedQuerysetMixin` (mixed in **before** `BaseModelViewSet`, on a viewset with a real `queryset` attribute) wires it into `list`. Plain `APIView`s — every `BaseReportView` subclass — call the function directly.
2. **The param contract is fixed:** absent/empty → no filter; a numeric id → filter by id; the literal `"none"` (`scoping.UNSCOPED`) → `__isnull=True`; anything else → **400**. Never a silently-unfiltered list.
3. **`CustomerScopedModelViewSet` is untouched and is not interchangeable with this.** It scopes by *who is calling* and is a security boundary; `ScopedQuerysetMixin` scopes by *what the caller asked for* and authorizes nothing. `CONVENTIONS.md` §33 states the split.
4. **Frontend option lists that more than one feature needs live in `src/shared/<domain>/`,** not in a feature — `no-restricted-imports` (§15) forbids cross-feature imports. `src/shared/departments/` (types + `departmentKeys` + `getDepartments` + `useDepartments`) is the worked example; `features/organization` owns only the management screens and the write path, and its mutations invalidate the *shared* key prefix so every picker refreshes.
5. **Both new FKs are nullable `SET_NULL`** — deleting a scope row nulls its links and deletes nothing. `Branch` follows suit.
6. **A permission pair, not a reuse of `settings.manage`:** `departments.view` (`admin`/`manager`/`agent` — an agent must be able to populate a picker) and `departments.manage` (`admin` only). `ORG-2` adds `branches.view`/`branches.manage` the same way.

## Known follow-ups left open by Story 87

- **Only the two RPT-1 report endpoints honour `?department=`.** `SlaTrendReportView`, `SlaBreachRateReportView`, `AgentPerformanceReportView`, both CSAT views, and `DashboardKpiReportView` keep pre-ORG-1 behaviour — their querysets live in `apps/reports/{sla,agents,dashboard}.py` and CSAT reaches a ticket through `Feedback.ticket`, so each needs its own traversal. Mechanical, but out of Story 87's scope; worth folding into `ORG-2`, which will need the same five edits for `branch` anyway.
- **Auto-assignment is not department-aware.** `AssignmentRule`/`auto_assign_ticket` (SLA-2) are unmodified. Routing a new ticket to its department's agents is a change to that rule engine's own matching and round-robin semantics, and belongs in an SLA story rather than here.
- **`OrganizationSettings.branches` is still a `JSONField` string list.** Until `ORG-2` promotes it, **no code may add a second consumer of that column** — that constraint is written into `CONVENTIONS.md` §33.
