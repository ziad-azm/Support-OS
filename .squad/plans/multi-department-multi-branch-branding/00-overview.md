# multi-department-multi-branch-branding — plan overview

Entry point for the **multi-department-multi-branch-branding** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 87 | [87-story-multi-department-SUPPORTOS-112.md](87-story-multi-department-SUPPORTOS-112.md) | Multi-Department (`ORG-1`) | SUPPORTOS-112 | Story 53 (`SEC-4`, `../security-administration/`), Story 18 (`TKT-2`, `../ticket-management/`), Story 48 (`SEC-1`, `../security-administration/`), Story 56 (`RPT-1`, `../reports-analytics/`) |
| 89 | [89-story-multi-branch-SUPPORTOS-113.md](89-story-multi-branch-SUPPORTOS-113.md) | Multi-Branch (`ORG-2`) | SUPPORTOS-113 | **Story 87 (`ORG-1`, this feature) — implemented, strict prerequisite**, Story 10 (`CUST-1`, `../customer-management/`), Story 43 (`PORTAL-1`, `../customer-portal/`), Story 56 (`RPT-1`, `../reports-analytics/`) |

## Dependency notes

This feature maps to **EPIC 16 — Multi-Department / Multi-Branch / Branding** (`SupportOs backlog.MD` lines 923-946): `ORG-1` Multi-Department, `ORG-2` Multi-Branch, `ORG-3` Custom Branding. The epic's own `Depends on` line reads *"Ticket Management, SEC-4"* — both are complete.

**`ORG-1` → `ORG-2` is a strict sequence**, per `ORG-2`'s own backlog dependency line (*"Dependencies: ORG-1"*). That prerequisite is **satisfied** — Story 87 is implemented in the working tree (`organization/0003`–`0006`, `accounts/0013`, `tickets/0008`, `apps/core/scoping.py`, `shared/departments/`), so Story 89 is executable now. `ORG-3` depends only on `SEC-4` and is independent of both.

- **Story 87 (`ORG-1`, `SUPPORTOS-112`)** — **implemented.** Promotes `OrganizationSettings.departments` (a `JSONField` string list SEC-4 shipped as an explicit placeholder) into the real `organization.Department` model, adds nullable `SET_NULL` FKs from `accounts.User` and `tickets.Ticket`, and ships the 🔑 reusable scoping mechanism `apps/core/scoping.py` that the rest of the epic consumes.
- **Story 89 (`ORG-2`, `SUPPORTOS-113`)** — **planned, not yet implemented.** Promotes the *other* half of the same JSON pair (`OrganizationSettings.branches`) using Story 87's four-migration sequence as its template, adds `Branch` FKs to users/**customers**/tickets, and reuses `apps/core/scoping.py` by appending one `ScopeFilter(param="branch", field="branch")` per viewset — **no new filter code; `apps/core/scoping.py` is not edited at all**, and the plan makes an empty `git diff` on that file a done-criterion. It also removes the **last** JSON list column from `OrganizationSettings`, so both dead `_validate_string_list` helpers and the frontend's now-consumerless `StringListField` go with it.
- **`ORG-3` Custom Branding** — not yet planned. Builds on `OrganizationSettings.name`/`logo_url` (already shipped by SEC-4) plus `DSN` design tokens; touches neither `Department`, nor `Branch`, nor the scoping module. It is the only story left that still edits `SettingsPage`, which by then edits scalars only.

## Cross-story contracts established by Story 87

These are the shapes `ORG-2` must follow rather than re-invent:

1. **`apps/core/scoping.py` is the only place a `?<param>=` scope filter is parsed.** `ScopeFilter(param, field)` declares one; `apply_scope_filters()` applies a tuple of them to any queryset; `ScopedQuerysetMixin` (mixed in **before** `BaseModelViewSet`, on a viewset with a real `queryset` attribute) wires it into `list`. Plain `APIView`s — every `BaseReportView` subclass — call the function directly.
2. **The param contract is fixed:** absent/empty → no filter; a numeric id → filter by id; the literal `"none"` (`scoping.UNSCOPED`) → `__isnull=True`; anything else → **400**. Never a silently-unfiltered list.
3. **`CustomerScopedModelViewSet` is untouched and is not interchangeable with this.** It scopes by *who is calling* and is a security boundary; `ScopedQuerysetMixin` scopes by *what the caller asked for* and authorizes nothing. `CONVENTIONS.md` §33 states the split.
4. **Frontend option lists that more than one feature needs live in `src/shared/<domain>/`,** not in a feature — `no-restricted-imports` (§15) forbids cross-feature imports. `src/shared/departments/` (types + `departmentKeys` + `getDepartments` + `useDepartments`) is the worked example; `features/organization` owns only the management screens and the write path, and its mutations invalidate the *shared* key prefix so every picker refreshes.
5. **Both new FKs are nullable `SET_NULL`** — deleting a scope row nulls its links and deletes nothing. `Branch` follows suit.
6. **A permission pair, not a reuse of `settings.manage`:** `departments.view` (`admin`/`manager`/`agent` — an agent must be able to populate a picker) and `departments.manage` (`admin` only). `ORG-2` adds `branches.view`/`branches.manage` the same way.

## Cross-story contracts confirmed by Story 89

Story 89 is the test of everything in the list above, and it passes. Recorded because it changes what a future story may assume:

1. **A new scope costs one tuple entry.** `TicketViewSet`, `UserViewSet`, `CustomerViewSet`, and `apps/reports/tickets.py::TICKET_SCOPES` each gain `ScopeFilter(param="branch", field="branch")` and nothing else. `apps/core/scoping.py` is unmodified — the plan's Verification Step 15 asserts an empty diff on it. A third org unit would cost the same.
2. **Multiple scopes compose with AND.** `apply_scope_filters` chains `.filter()` calls, so `?department=3&branch=7` narrows on both and a no-overlap combination returns an empty page — not a 400, not an OR. Story 89 pins this as a product rule so it does not drift.
3. **`ScopedQuerysetMixin` on a viewset with no `get_queryset` override** (`CustomerViewSet`) is the simplest possible application: change the bases, add the tuple. The MRO trap is unchanged and still silent — the mixin placed *after* `BaseModelViewSet` filters nothing and raises nothing.
4. **`PortalTicketSerializer` inherits `TicketSerializer.Meta.fields`**, so every field added to the staff ticket serializer lands on the portal automatically and must be considered for `read_only_fields` in the same change. ORG-1 missed this for `department`; Story 89 task 19 closes it for both org units.
5. **`OrganizationSettings` holds only scalars after Story 89.** No JSON list column remains, and neither `_validate_string_list` helper survives. A future story wanting a list of things on that model should create a model, not a column — that is now the established answer, twice over.

## Known follow-ups left open by Stories 87 and 89

- **Only the two RPT-1 report endpoints honour `?department=`/`?branch=`.** `SlaTrendReportView`, `SlaBreachRateReportView`, `AgentPerformanceReportView`, both CSAT views, and `DashboardKpiReportView` keep pre-ORG-1 behaviour. Story 87 suggested folding this into `ORG-2`; **Story 89 explicitly declined**, and the reason is concrete: `sla_trend`/`sla_breach_rate` (`apps/reports/sla.py:102,152`), `agent_performance` (`apps/reports/agents.py:73`), and `dashboard_kpis` (`apps/reports/dashboard.py:40`) all take `(start, end, …)` and build their querysets **internally**, so honouring a scope means threading `query_params` through five signatures across three modules — and they are not uniform (the CSAT views query `Feedback.objects` and need a `ticket__<field>` traversal; `agent_performance` groups by agent, not by ticket). This is an `RPT` story of its own, not a mechanical repeat.
- **Neither `?department=` nor `?branch=` has a filter UI on the users list.** Both are live on `UserViewSet`; `UserListParams` (`getUsers.ts:7`) is `ServerTableParams & { search?: string }` and neither screen offers a picker. Story 89 adds the `branch_name` column only, deliberately, to avoid a screen with one org-unit filter and not the other. Adding both together is a small SEC-1 follow-up.
- **Auto-assignment is aware of neither org unit.** `AssignmentRule`/`auto_assign_ticket` (SLA-2) are unmodified by both stories. Routing a new ticket to its department's or branch's agents is a change to that rule engine's own matching and round-robin semantics, and belongs in an SLA story.
- **Nothing validates a department/branch pair.** A ticket, user, or customer may hold any combination of the two, including a department that operates in no such branch. This codebase models no hierarchy between them and neither intake asks for one; if a real containment rule appears, it is a new model relationship plus cross-field validation, not a serializer tweak.
