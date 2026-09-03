# Story 89 — Multi-Branch (Story: SUPPORTOS-113)

## Prerequisites

- **ORG-1 completed and implemented:** [87-story-multi-department-SUPPORTOS-112.md](87-story-multi-department-SUPPORTOS-112.md). Verified against the working tree, not just the plan: `apps/organization/models.py:15-48` (`Department`), migrations `organization/0003`–`0006`, `accounts/0013_user_department`, `tickets/0008_ticket_department`, `apps/core/scoping.py` (108 lines), `Permissions.DEPARTMENTS_VIEW`/`DEPARTMENTS_MANAGE` (`apps/core/permissions.py:38-39`), `frontend/src/shared/departments/` (5 files), `features/organization/api/*Department*.ts` (8 files), `DepartmentListPage.tsx`/`DepartmentFormPage.tsx`, `DepartmentQueuePage.tsx`, and `CONVENTIONS.md` §33 all exist. **This story is ORG-1 applied a second time, to the other half of the same JSON pair.** Nearly every shape below is already justified in Story 87 — quote its reasoning, do not re-derive it.
- **SEC-4 completed:** [../security-administration/53-story-system-configuration-SUPPORTOS-75.md](../security-administration/53-story-system-configuration-SUPPORTOS-75.md). It shipped `OrganizationSettings` with `departments` **and** `branches` as `JSONField(default=list)` string lists. ORG-1 promoted the first; this story promotes the second and, in doing so, **removes the last JSON list column from that model** — after task 3 the module-level helper `_validate_string_list` (`backend/apps/organization/models.py:8-12`) and the serializer method of the same name (`backend/apps/organization/serializers.py:44-49`) have no caller left and must be deleted with it.
- **CUST-1 completed:** [../customer-management/10-story-customer-profiles-SUPPORTOS-28.md](../customer-management/10-story-customer-profiles-SUPPORTOS-28.md). `Customer` (`backend/apps/customers/models.py:7-79`), `CustomerSerializer` (`backend/apps/customers/serializers.py:11-70`), `CustomerViewSet` (`backend/apps/customers/views.py:29-66`), `CustomerListPage.tsx`, `CustomerFormPage.tsx`. **This is the one place ORG-2 goes where ORG-1 did not** — ORG-1 explicitly declared "No `Customer.department`" out of scope because its own intake said only "agents and tickets"; this intake says "users/customers/tickets".
- **PORTAL-1/PORTAL-2 completed:** [../customer-portal/43-story-portal-ticket-submission-SUPPORTOS-66.md](../customer-portal/43-story-portal-ticket-submission-SUPPORTOS-66.md) and its siblings. `PortalTicketSerializer` (`backend/apps/portal/serializers.py:9-52`) subclasses `TicketSerializer` and derives its field list from `TicketSerializer.Meta.fields`, so **anything task 18 adds to that tuple is automatically exposed on the portal**. Verified: `PortalTicketSerializer.Meta.read_only_fields` (`:44-48`) names `customer`, `category`, `priority` — **but not `department`**, which means ORG-1 left `department` writable by a portal customer on ticket create. Task 19 closes that alongside `branch`.
- **RPT-1 completed:** [../reports-analytics/56-story-ticket-volume-reports-SUPPORTOS-97.md](../reports-analytics/56-story-ticket-volume-reports-SUPPORTOS-97.md). `DIMENSION_FIELDS` (`backend/apps/reports/tickets.py:37-43`) and `TICKET_SCOPES` (`:50`) are the two one-line extension points ORG-1 built for exactly this story — `TICKET_SCOPES`' own comment says so: *"A tuple, not a bare call, so ORG-2 adds `ScopeFilter(param="branch", field="branch")` here once and both reports pick it up."*
- Verified: **`branches` has exactly five consumers and no sixth.** `grep -rn "branches" backend/apps frontend/src` returns `apps/organization/models.py:79,107` (the column and its `clean()` check), `apps/organization/serializers.py:37,51-52`, `frontend/src/features/organization/types/settings.ts:7,18`, and `SettingsPage.tsx:26,53,194-203`. Nothing else reads it — CONVENTIONS.md §33's "no code may add a second consumer of that column" held. Dropping it breaks nothing beyond the files tasks 3 and 39 already edit.
- Verified: **no `django-filter`.** `DEFAULT_FILTER_BACKENDS` (`backend/config/settings/base.py`) is `OrderingFilter` + `SearchFilter` only. Every scope in this story is `apps/core/scoping.py`; **this story writes no parsing code at all.**
- Verified: **no migration-graph cycle.** `organization/0010` will depend on `("accounts", "0003_seed_roles")`; `accounts/0014`, `customers/0007`, and `tickets/0009` will each depend on `("organization", "0010_grant_branch_permissions")`. `0014 > 0003` within `accounts`, and at the model level all three FKs use the string reference `"organization.Branch"` — `apps/organization/models.py` imports nothing from `accounts`, `customers`, or `tickets`. Exactly the graph ORG-1 already ships (`organization/0006` ← `accounts/0003`; `accounts/0013` ← `organization/0006`).
- Verified: **`no-restricted-imports` forbids cross-feature imports** (`frontend/.oxlintrc.json:8-18`; the only overrides are `**/app/**` and `shared/i18n/resources.ts`). **Four** features need the same branch options list this time (`tickets`, `accounts`, `customers`, `reports`), so task 24 puts it in `src/shared/branches/` — `src/shared/departments/` is the worked precedent, file for file.
- Verified: **`can()` takes a plain `string`** (`frontend/src/shared/auth/types.ts:37`). There is no `Permission` union type to extend; `"branches.view"` needs no frontend type change.

---

## Story Goal

Do to `branches` exactly what Story 87 did to `departments`, and prove the mechanism it built is reusable by adding **zero lines of filter-parsing code**.

1. **`Branch` is a table.** `apps.organization.Branch` (`name` unique, optional `description`) replaces `OrganizationSettings.branches`, with a data migration that promotes every existing string in that list into a row. This removes the **last** JSON list column from `OrganizationSettings`, so the two dead `_validate_string_list` helpers go with it.
2. **Users, customers, and tickets link to it.** `accounts.User.branch`, `customers.Customer.branch`, and `tickets.Ticket.branch` — three nullable `SET_NULL` FKs, all three surfaced read-and-write on their existing admin/serializer/form paths.
3. **The scoping mechanism is consumed, not extended.** `TicketViewSet`, `UserViewSet`, `CustomerViewSet`, and `TICKET_SCOPES` each gain one `ScopeFilter(param="branch", field="branch")` tuple entry. `apps/core/scoping.py` is **read and not modified** — if this story has to touch it, something is wrong with either the plan or ORG-1.
4. **Scoped queues and reports.** A branch filter on the ticket list and the customer list, a new `/tickets/branch` queue showing the caller's own branch's tickets, a `branch` column on the tickets/users/customers lists, and a sixth `branch` dimension plus a `?branch=` filter on the RPT-1 volume/breakdown reports.
5. **A management screen.** `/settings/branches` — list, create, rename, delete — gated by two new permissions (`branches.view`, `branches.manage`), granted `admin`→both, `manager`/`agent`→view.
6. **One ORG-1 oversight closed.** `department` becomes read-only on `PortalTicketSerializer`, alongside `branch`.

### Explicitly not in scope

- **This is not branch-level access *control*.** `?branch=` is a convenience filter that authorizes nothing — `CONVENTIONS.md` §33's table says so in as many words, and `apps/core/scoping.py:1-8` repeats it. A user in branch A can still `GET /api/tickets/` and see branch B's tickets, exactly as they can today across departments. Restricting *what a staff account may see* to its own branch is a **security boundary**, which in this codebase means the `CustomerScopedModelViewSet` half of §33 — a different mechanism, a different threat model (every existing report, queue, export, and the whole of `apps/portal` would have to be re-audited against it), and its own story. The intake's "branch-level access" is delivered as the `/tickets/branch` queue and the two-permission split, mirroring ORG-1's reading of the identical phrase for departments.
- **Only the two RPT-1 reports gain `?branch=`.** ORG-1's feature overview suggested folding the other five report views into this story. **Declined, with a reason:** `sla_trend`/`sla_breach_rate` (`backend/apps/reports/sla.py:102,152`), `agent_performance` (`backend/apps/reports/agents.py:73`), and `dashboard_kpis` (`backend/apps/reports/dashboard.py:40`) all take `(start, end[, bucket|metric])` and build their querysets **internally** (`sla.py:81`, `agents.py:62`, `dashboard.py:44,61`) — honouring a scope means threading `query_params` through five function signatures across three modules. Worse, they are not uniform: the two CSAT views query `Feedback.objects` and would need a `ticket__branch` traversal, and `agent_performance` groups by agent, not by ticket, so "scoped" has to be decided per report. That is a reports story, not a mechanical repeat. Recorded as a follow-up in the feature overview.
- **No branch filter on the users list.** ORG-1 shipped `?department=` on `UserViewSet` with no frontend filter (`getUsers.ts:7` — `UserListParams` is `ServerTableParams & { search?: string }` and nothing more). Task 32 adds the `branch_name` **column** only, mirroring that exactly; adding a branch filter but not a department filter would leave the screen inconsistent with itself. Recorded as a follow-up.
- **Auto-assignment does not become branch-aware.** `apps/tickets/assignment.py`, `apps/sla/tasks.py::auto_assign_ticket`, and `AssignmentRule` are read but **not modified** — the same boundary ORG-1 drew for departments, for the same reason.
- **`Department` is untouched.** No `Department` field, serializer, view, screen, or migration changes, with the single exception of task 19's portal read-only fix and task 23's §33 amendment.
- **ORG-3 Custom Branding is a separate story.** `OrganizationSettings.name`/`logo_url` are read but not modified.

---

## Context — Read These Files First

1. `backend/apps/organization/models.py:1-134` — whole file. The module-level `_validate_string_list` (8-12, **deleted** by task 3), `Department` (15-48, the shape task 1 copies verbatim), the `OrganizationSettings` docstring's own "`branches` is a `JSONField(default=list)` string list… ORG-2 does the same to `branches`" paragraph (64-69, **rewritten** by task 3), the `branches` column (79), and `clean()` (99-119) where line 107 is the check task 3 deletes and 108-119 the SLA comparison that **stays**. Note `ValidationError` (line 1) is still needed at 113 — do not remove that import.
2. `backend/apps/core/scoping.py:1-108` — whole file, **read-only for this story**. `UNSCOPED` (39), `ScopeFilter` (42-50), `apply_scope_filters` (53-75), `ScopedQuerysetMixin` (78-108). Read the mixin's docstring at 79-99 before task 15: it states the two hard requirements — mix in **before** `BaseModelViewSet`, and the viewset must have a real `queryset` class attribute. Lines 22-25 name this story by name.
3. `backend/apps/organization/migrations/0003_department.py`, `0004_migrate_settings_departments.py`, `0005_remove_organizationsettings_departments.py`, `0006_grant_department_permissions.py` — all four, end to end. Tasks 1, 2, 3, and 5 are these four files with `department`→`branch`. `0004`'s `promote`/`demote` docstrings explain the `get_or_create`-not-`bulk_create` and `.first()`-not-`load()` choices; `0006`'s module comment explains the view/manage grant split. **Copy the reasoning, not just the code.**
4. `backend/apps/accounts/migrations/0013_user_department.py` and `backend/apps/tickets/migrations/0008_ticket_department.py` — the exact `AddField` + two-entry `dependencies` shape tasks 9, 13, and 17 produce three more of.
5. `backend/apps/core/permissions.py:18-49` — the `Permissions` class and the reflective `ALL_PERMISSIONS` (45-49). Task 4 adds two constants after line 39; nothing else is needed to make them grantable through SEC-2's role editor.
6. `backend/apps/organization/serializers.py:1-71` — `DepartmentSerializer` (9-20, the shape task 6 copies), then `OrganizationSettingsSerializer`: `Meta.fields` (33-42, line 37 is the `"branches"` entry task 3 removes), the `_validate_string_list` method (44-49, **deleted**), `validate_branches` (51-52, **deleted**), and `validate` (54-71, **kept** — it is the SLA comparison, not a list check).
7. `backend/apps/organization/views.py:12-37` — `DepartmentViewSet`. `queryset`/`serializer_class` (23-24), the six-entry `permission_map` (26-33), and `ordering_fields`/`search_fields` (36-37) with the comment tying each name to a `ColumnDef.id`. Task 7 is this class with `Branch`.
8. `backend/apps/organization/urls.py:1-17` — the **`SimpleRouter`, not `DefaultRouter`** rule and the comment explaining it (8-11). Task 7 adds one `router.register` line at 14.
9. `backend/apps/organization/admin.py:8-19` — `DepartmentAdmin`. Task 8 is this class with `Branch`.
10. `backend/apps/accounts/models.py:105-131` — `User.role` (105-112, `PROTECT`) directly above `User.department` (114-131, `SET_NULL`), and the long comment at 114-123 contrasting the two. Task 9's `User.branch` is the `department` half again; **quote that comment's reasoning**.
11. `backend/apps/accounts/serializers.py:31-45` — `DepartmentBriefSerializer`, the narrow two-field read-only mirror for `/auth/me/`, and its docstring's comparison to `RoleSerializer` (25-28) vs `RoleAdminSerializer`. Task 10's `BranchBriefSerializer` is this class again.
12. `backend/apps/accounts/serializers.py:100-123` — `UserSerializer`. `department = DepartmentBriefSerializer(read_only=True)` (107), `Meta.fields` (112-121), `read_only_fields` (122).
13. `backend/apps/accounts/serializers.py:155-182` — `UserAdminSerializer`'s `department_name` (158-163) with its dotted-source + `allow_null=True` comment, and `Meta.fields` (167-181). `create()` (below 184) is **unchanged** — `branch` is an ordinary writable field.
14. `backend/apps/accounts/views.py:154-209` — `UserViewSet`. Already `ScopedQuerysetMixin, BaseModelViewSet`; `queryset` (178), `scope_filters` (196), and the `get_queryset` override (198-209) whose `.filter(customer_profile__isnull=True)` staff-only filter must survive verbatim. Task 11 edits lines 178 and 196 only — **do not touch 198-209**.
15. `backend/apps/accounts/admin.py:55-85` — `UserAdmin`'s `list_display` (containing `"department"` at 62), `list_filter` (66), `list_select_related` (67), and the fieldset naming `"department"` (77). Task 12 adds `"branch"` beside each.
16. `backend/apps/customers/models.py:7-79` — `Customer`. `user` (45-58, the `SET_NULL` `OneToOneField` and its PROTECT-contrast comment) is the last field before `class Meta` (60-63); task 13's FK goes between them. `clean()` (68-79) is **unchanged**.
17. `backend/apps/customers/serializers.py:11-70` — `CustomerSerializer`. The two hand-declared `UniqueValidator`s (36-56) and their long "overriding a field opts it out of auto-derivation" comment are **not** relevant to `branch` (task 14 declares no `branch` field at all — DRF derives it). `Meta.fields` (57-70) is the tuple task 14 extends.
18. `backend/apps/customers/views.py:29-66` — `CustomerViewSet`. It is a plain `BaseModelViewSet` with **no `get_queryset` override at all** and `queryset = Customer.objects.all()` (36). Task 15 is therefore the *simplest* possible application of `ScopedQuerysetMixin` in this codebase — no method to reconcile, just two bases and a tuple. Read `permission_map` (39-59) and note it is unchanged.
19. `backend/apps/tickets/models.py:87-104` — `Ticket.department` and its comment (87-95) explaining why it is `SET_NULL` and why, unlike `assigned_agent`, it is **not** action-only. Task 17's `Ticket.branch` is the same call.
20. `backend/apps/tickets/serializers.py:14-82` — `TicketSerializer`. `department_name` (28-32) is the exact pair task 18 clones, `immutable_fields = ("customer",)` (49) is **not** extended (a ticket may be moved between branches), `Meta.fields` (52-71), and `read_only_fields` (77-82) — unchanged.
21. `backend/apps/portal/serializers.py:9-52` — `PortalTicketSerializer`. `Meta.fields = TicketSerializer.Meta.fields + ("has_feedback",)` (43) is why task 18 changes the portal payload for free, and `read_only_fields` (44-48) is the tuple task 19 extends. Read the docstring at 17-29: it explains exactly why `customer`/`category`/`priority` are read-only there, and that reasoning applies verbatim to `department` and `branch`.
22. `backend/apps/tickets/views.py:52-97` — `TicketViewSet`. `queryset`'s `select_related` (55-57) and `scope_filters` (93-97, whose comment names this story). Task 20 edits both; `get_queryset` (109-141) is **unchanged** — its four hand-parsed filters stay exactly as they are.
23. `backend/apps/tickets/admin.py:32,39` — `TicketAdmin`'s `list_display` and `list_filter`, both already naming `"department"`.
24. `backend/apps/reports/tickets.py:33-60` — `DIMENSION_FIELDS` (37-43) and `TICKET_SCOPES` (45-50). Task 22 adds exactly one dict key and one tuple entry. `scoped_tickets` (53-60) and `parse_dimension` (63-82) need **no** edit — `parse_dimension` validates against the dict's keys.
25. `backend/apps/reports/views.py:68-143` — the two RPT-1 views. Each `get_report` calls `scoped_tickets(...)` already (89, 137), so task 22's tuple entry is the whole change. Contrast `SlaTrendReportView.get_report` (161-162), `AgentPerformanceReportView.get_report` (200-203), and `DashboardKpiReportView.get_report` (265-266) — none of them touch a queryset, which is the evidence behind this story's scope boundary on the other five reports.
26. `frontend/src/shared/departments/` — all five files (`types.ts`, `departmentKeys.ts`, `getDepartments.ts`, `useDepartments.ts`, `index.ts`). Task 24 is these five, verbatim, with `department`→`branch`. `getDepartments.ts:6-9`'s `page_size: 100, ordering: 'name'` comment applies unchanged.
27. `frontend/src/features/organization/api/` — the eight `*Department*.ts` files. Task 26 is these eight. Note `useDepartmentMutations.ts:10-17`: the invalidation targets the **shared** `departmentKeys.all` prefix so the pickers in other features refresh — task 26 must invalidate `branchKeys.all` for the same reason.
28. `frontend/src/features/organization/types/department.ts:1-11` — the re-export-plus-`Input` shape task 25 copies.
29. `frontend/src/features/organization/components/DepartmentListPage.tsx:1-126` and `DepartmentFormPage.tsx:1-134` — full files. Tasks 27 and 28 are these two with `department`→`branch`. Copy them; do not invent a new list/form shape.
30. `frontend/src/features/organization/components/SettingsPage.tsx:1-210` — task 39's target. The `schema` (22-45, line 26 is `branches`), `toDefaults` (49-57, line 53), the local `StringListField` component (63-132), and its single `FormField` call site (192-203). **After removing `branches` this component has no consumer** — verified: `grep` for `StringListField` returns only its definition and that one call site. Delete it, and with it the imports it alone uses: `PlusIcon`/`XIcon` (2), `Badge` (8), `Button` (9 — `SubmitButton` at line 13 is a different import), `Input` (11), and `FormField`/`FormItem`/`FormLabel` from line 12 (`Form` stays). `useState` (1) stays — `formErrors` uses it.
31. `frontend/src/app/router.tsx:151-200` — the `tickets.view` group, with `tickets/my-tickets` (172-179) and `tickets/department` (180-188) both declared **before** `tickets/:id` (189-196). Task 29's `tickets/branch` route goes beside them, same reason.
32. `frontend/src/app/router.tsx:557-596` — the `departments.view` list group (557-568) and the `departments.manage` create/edit group (569-596), including the comment at 570-574 explaining the split. Task 29 adds two more groups in the same shape.
33. `frontend/src/app/Sidebar.tsx:130-138` (`showAdministration`), `:191-203` (the Support section's `my-tickets` link and the `user?.department ? … : null` conditional department-queue link), and `:282-297` (the Administration section's `/settings` and `/settings/departments` links). Task 30 edits all three regions. `Building2Icon` is already imported.
34. `frontend/src/shared/auth/types.ts:1-40` — `AuthRole` (1-5), `AuthDepartment` (7-11), and `AuthUser.department` (22-25) with its "Read-only — changing a user's department goes through `PATCH /api/users/<id>/`" note. Task 31 adds `AuthBranch` and one field.
35. `frontend/src/features/accounts/components/UserFormPage.tsx:29-70` — `ROLE_NONE` (32), `DEPARTMENT_NONE` (34) with its Radix reason, `baseShape` (36-43), `useRoleOptions` (51-58), and `useDepartmentOptions` (60-70). Then `:104-127` (create-form defaults + payload mapping), `:169-180` (the two `SelectField`s), and `:205-281` (the edit form's equivalents). Task 32 touches **six** regions in this one file — there are two independent form components.
36. `frontend/src/features/accounts/components/UserListPage.tsx:78-84` — the `department_name` column, non-sortable. Task 32's `branch_name` column goes after it.
37. `frontend/src/features/tickets/components/TicketListPage.tsx:55-120` — the `'all'`/`'none'` sentinel comment (55-60), the `useEffect` page reset and its dependency array (72-74), the params spread (78-83), and the `department_name` column (108-115). Then `:204-220` — the Department `Select`, the exact three-`SelectItem`-plus-map shape task 35 clones.
38. `frontend/src/features/tickets/components/DepartmentQueuePage.tsx:1-179` — full file. Task 36's `BranchQueuePage` is this file with `department`→`branch`, including the `enabled: departmentId !== undefined` guard (55-63) and the no-department empty state (115-125) that exist for the reason `## Edge Cases` records.
39. `frontend/src/features/tickets/components/TicketFormPage.tsx:34-80` (`DEPARTMENT_NONE`, the `z.string().min(1)` schema entry, defaults, `toDefaults`, `toTicketInput`) and `:122,161-207` (the query, the options map, and the `SelectField` with its `DEPARTMENT_NONE` first item). Task 34 mirrors each.
40. `frontend/src/features/customers/components/CustomerListPage.tsx:1-120` — note it uses its **own** local `SEARCH_DEBOUNCE_MS` debounce (20, 35-42) rather than `useDebouncedSearch`, and its own `useEffect` page reset (44-48) whose dependency array task 37 must extend. Columns are at 53-84.
41. `frontend/src/features/customers/components/CustomerFormPage.tsx:1-132` — full file. Four `TextField`s and no `Select` today; task 37 adds the first `SelectField` to this form, so `SelectField` must be added to the `@/shared/ui/form` import at line 9.
42. `frontend/src/features/reports/types/report.ts:20-33` — `REPORT_DIMENSIONS` and the comment (20-25) explaining why it is re-declared rather than imported. Task 38 adds one entry.
43. `frontend/src/features/reports/components/TicketReportsPage.tsx:75-107` (`department` state, `useDepartments`, `labelForDimensionValue`, and both param objects) and `:181-194` (the Department `Select`). Task 38 mirrors each.
44. `frontend/src/features/organization/locales/en.json` and `ar.json` — the `settings` block (whose `fields.branches`, `addBranch`, `newItemPlaceholder`, `removeItem`, and the already-dead `remove` keys task 40 removes) and the `departments` block (the twenty-key shape task 40's `branches` block copies).
45. `CONVENTIONS.md` §33 (2198-2246, "Organizational scoping (ORG-1)") — the whole section. Task 23 amends four specific claims in it. §16 is the no-automated-tests rule this story's `## Test Plan` obeys; §15 (238-249) is the import boundary forcing task 24; §22/§23 are the permission and feature-module templates tasks 4/5 and 26-28 follow.

---

## Product rules (from story)

| Rule | Current behaviour | New behaviour | Enforcement point |
|---|---|---|---|
| **A branch is a record, not a string.** | `OrganizationSettings.branches: list[str]`, editable only as free text on `/settings`. | `organization.Branch` rows with a unique name, full CRUD at `/api/branches/`. | Tasks 1-3, 7. The JSON column is **removed**, not shadowed — same call ORG-1 made for `departments`. |
| **Users, customers, and tickets belong to a branch.** | Nothing links any of the three. | Three nullable `SET_NULL` FKs, each settable on its existing form, shown as a column on its existing list. | Tasks 9-21. |
| **The scoping mechanism is consumed, not extended.** | `apps/core/scoping.py` has one scope per viewset (`department`). | Each `scope_filters` tuple gains a second entry. **`apps/core/scoping.py` is not edited.** | Tasks 11, 15, 20, 22. If this story modifies `scoping.py`, ORG-1's abstraction failed and that is a finding to report, not to patch around. |
| **`?branch=none` means "unassigned", not "invalid".** | n/a | `?branch=<id>` filters by id; `?branch=none` → `branch__isnull=True`; anything else is a **400**. | `apply_scope_filters` (`apps/core/scoping.py:53-75`), unchanged. |
| **Two scopes compose with AND.** | One scope per request. | `?department=3&branch=7` returns tickets in department 3 **and** branch 7. | `apply_scope_filters`' loop (`:61-74`) chains `.filter()` calls — already correct, no change. Verification Step 8 proves it. |
| **Reading the branch list is not an admin privilege; changing it is.** | `settings.manage` (admin only) gated the whole settings blob, branches included. | `branches.view` → `admin`, `manager`, `agent`. `branches.manage` → `admin` only. | Task 5's grant migration. **`settings.manage` is not reused** — an agent filling in a ticket's branch must not thereby be able to rewrite the org's SLA defaults. Identical split, identical reason, as `departments.*`. |
| **Deleting a branch must not delete its users, customers, or tickets.** | n/a | `on_delete=SET_NULL` on all three FKs — every row survives, merely unassigned. | Tasks 9, 13, 17. |
| **A ticket can change branch after creation.** | n/a | `branch` is an ordinary writable serializer field — deliberately **not** added to `TicketSerializer.immutable_fields`. | Task 18. Contrast `customer` (`serializers.py:49`), immutable because changing it moves the ticket's history into another customer's portal visibility. |
| **A portal customer sets neither department nor branch.** | A portal customer **can** currently POST `department` — `PortalTicketSerializer.read_only_fields` omits it (ORG-1 oversight). | Both read-only on the portal serializer; staff triage assigns them. | Task 19. Not a visibility breach (neither field affects `CustomerScopedModelViewSet`'s `customer_field` scoping), but it lets a customer file into an arbitrary org unit, which nothing intended. |
| **The backend enforces this even if the frontend is bypassed.** | — | Every `?branch=` value is parsed server-side; `'all'`/`'none'` sentinels and hidden buttons are UX only. | `apply_scope_filters`, `BranchViewSet.permission_map`. |
| **A branch filter is not an access boundary.** | — | Unchanged: any staff account with `tickets.view` can list any branch's tickets. | Stated in `## Story Goal`'s scope boundary and in task 23's §33 amendment. **Do not** add branch checks to `permission_map` or `get_queryset` to "make it safer" — that is a different story with a different audit. |

---

## Backend Tasks

### 1 — The `Branch` model

**File: `backend/apps/organization/models.py`** — add **between** `Department` (ends line 48) and `OrganizationSettings` (starts line 51):

```python
class Branch(TimeStampedModel):
    """A physical or regional location — ORG-2. Users
    (`accounts.User.branch`), customers (`customers.Customer.branch`), and
    tickets (`tickets.Ticket.branch`) point at one; all three FKs are
    nullable `SET_NULL`, so deleting a branch leaves every row intact and
    merely unassigned.

    Replaces `OrganizationSettings.branches`, the second and last
    `JSONField` string list SEC-4 shipped as a placeholder. ORG-1 promoted
    the `departments` half and left this one alone deliberately;
    CONVENTIONS.md §33 recorded the constraint that held until now ("no
    code may add a second consumer of that column").

    Shaped exactly like `Department` above, which is itself shaped like
    `tickets.Category` (apps/tickets/models.py:8-23). Three copies of the
    same four lines is the right answer here: a shared abstract base for
    "a named org unit" would couple `Department` and `Branch` migrations
    together for no behavioural gain, and they are free to diverge (a
    branch may later grow an address or a timezone; a department will not).
    """

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.CharField(_("description"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("branch")
        verbose_name_plural = _("branches")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name
```

**Generate the migration — this run must produce `CreateModel` ONLY.** Do not touch `OrganizationSettings.branches` yet; task 3 removes it in a later migration so task 2's data migration can still read the column.

```powershell
cd backend
python manage.py makemigrations organization
```

Expect exactly one file: `apps/organization/migrations/0007_branch.py`, one `CreateModel`, `dependencies = [("organization", "0006_grant_department_permissions")]`.

---

### 2 — Data migration: promote every configured branch string into a row

**Create file: `backend/apps/organization/migrations/0008_migrate_settings_branches.py`** (hand-written, not generated). This is `0004_migrate_settings_departments.py` with `departments`→`branches` and `Department`→`Branch`:

```python
from django.db import migrations


def promote(apps, schema_editor):
    """Every distinct, non-blank string in the one `OrganizationSettings`
    row's `branches` list becomes a `Branch` row.

    `get_or_create` on `name`, not `bulk_create`: the JSON list has no
    uniqueness guarantee (`_validate_string_list` only ever checked
    "non-empty string"), so a settings blob containing "Riyadh" twice must
    produce one row, not an IntegrityError that aborts the whole migration.

    `.first()`, not `OrganizationSettings.load()`: a historical model has no
    custom manager or classmethod, and on a database where the settings row
    was never created there is simply nothing to promote.

    Identical to `0004_migrate_settings_departments.promote` — see that
    migration for the reasoning this one inherits.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Branch = apps.get_model("organization", "Branch")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    for raw in settings_row.branches or []:
        name = (raw or "").strip()
        if name:
            Branch.objects.get_or_create(name=name)


def demote(apps, schema_editor):
    """Writes the rows back into the JSON list so `0007_branch`'s own
    reverse (`DeleteModel`) does not lose an admin's configuration.

    Django unapplies in reverse dependency order, so `0009`'s RemoveField is
    reversed — re-adding the `branches` column, empty — BEFORE this runs.
    That is what makes writing the column here possible at all. See
    `## Migration / Rollback`.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Branch = apps.get_model("organization", "Branch")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    settings_row.branches = list(Branch.objects.order_by("name").values_list("name", flat=True))
    settings_row.save(update_fields=["branches", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("organization", "0007_branch")]

    operations = [migrations.RunPython(promote, demote)]
```

---

### 3 — Drop `OrganizationSettings.branches` and both dead list validators

**File: `backend/apps/organization/models.py`** — four edits:

1. **Delete** the module-level `_validate_string_list` (lines 8-12) entirely. After edit 3 below it has no caller. Keep the `from django.core.exceptions import ValidationError` import at line 1 — `clean()` still raises it at line 113.
2. **Delete** the `branches` field (line 79).
3. **Delete** line 107 (`_validate_string_list(self.branches, "branches")`) from `clean()`. The method keeps `super().clean()` and the SLA target comparison; it does **not** become a no-op.
4. **Rewrite** the docstring paragraph at lines 64-69. Replace it with:

```python
    `departments` and `branches` were both `JSONField(default=list)` string
    lists until ORG-1 (Story 87) and ORG-2 (Story 89) promoted them to the
    `Department` and `Branch` models above. This model now holds only
    scalars — branding (`name`, `logo_url`) and the two org-wide SLA
    defaults. There is no JSON column left, which is why `clean()` no
    longer validates a list shape.
```

**File: `backend/apps/organization/serializers.py`** — three edits:

1. Remove `"branches"` from `OrganizationSettingsSerializer.Meta.fields` (line 37).
2. **Delete** the `_validate_string_list` method (lines 44-49) and `validate_branches` (lines 51-52). Keep `validate` (54-71) — that is the SLA comparison.
3. Rewrite the class docstring (24-29), which currently describes `validate_branches`, to say the serializer now carries branding and SLA defaults only, and that the DRF-repeats-model-`clean()` split (CONVENTIONS.md §22) still applies to the SLA check.

The `from django.utils.translation import gettext_lazy as _` and `from rest_framework import serializers` imports both stay — `validate` uses both.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations organization
```

Expect `apps/organization/migrations/0009_remove_organizationsettings_branches.py` with one `RemoveField`. **Open it and confirm `dependencies` names `("organization", "0008_migrate_settings_branches")`, not `0007_branch`.** If it names `0007`, a fresh `migrate` on an existing database can drop the column before `promote` reads it and silently lose every configured branch — edit the dependency by hand. (ORG-1 flagged exactly this risk; see its `## Edge Cases`.)

---

### 4 — Two new permission constants

**File: `backend/apps/core/permissions.py`** — after `DEPARTMENTS_MANAGE` (line 39):

```python
    BRANCHES_VIEW = "branches.view"
    BRANCHES_MANAGE = "branches.manage"
```

Nothing else. `ALL_PERMISSIONS` (45-49) is derived by reflection over this class, so both become grantable through SEC-2's role editor with no second edit.

---

### 5 — Grant migration

**Create file: `backend/apps/organization/migrations/0010_grant_branch_permissions.py`** — `0006_grant_department_permissions.py` verbatim with the two new constants:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Split for the same reason `0006_grant_department_permissions` splits
# DEPARTMENTS_*: reading the branch list is what populates the ticket form's
# picker, the customer form's picker, and three list filters, so an agent
# needs it. Changing the list is org configuration and stays with `admin`,
# alongside ROLES_MANAGE/SETTINGS_MANAGE. Reusing SETTINGS_MANAGE for the
# read would have handed every agent the power to rewrite the org's SLA
# defaults. See the plan's `## Product rules`.
GRANTS = {
    "admin": [Permissions.BRANCHES_VIEW, Permissions.BRANCHES_MANAGE],
    "manager": [Permissions.BRANCHES_VIEW],
    "agent": [Permissions.BRANCHES_VIEW],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) | set(permissions))
        role.save(update_fields=["permissions"])


def revoke(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) - set(permissions))
        role.save(update_fields=["permissions"])


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0009_remove_organizationsettings_branches"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

The `customer` role (seeded by `accounts/0004_seed_customer_role`) is deliberately absent from `GRANTS` — a portal customer has no business listing the org's branches.

---

### 6 — `BranchSerializer`

**File: `backend/apps/organization/serializers.py`** — add after `DepartmentSerializer` (ends line 20), and extend the model import on line 6 to `from .models import Branch, Department, OrganizationSettings`:

```python
class BranchSerializer(BaseModelSerializer):
    """CRUD over `Branch` — ORG-2's management screen. Shaped exactly like
    `DepartmentSerializer` above: the model field's own `unique=True` is
    what DRF derives the uniqueness validator from, so no hand-declared
    `UniqueValidator` is needed (contrast `CustomerSerializer.email`, which
    overrides the generated field and therefore must declare one —
    apps/customers/serializers.py:36-43).
    """

    class Meta(BaseModelSerializer.Meta):
        model = Branch
        fields = ("id", "name", "description", "created_at", "updated_at")
```

---

### 7 — `BranchViewSet` and its route

**File: `backend/apps/organization/views.py`** — add after `DepartmentViewSet` (ends line 37); extend the imports on lines 8-9 to include `Branch` and `BranchSerializer`:

```python
class BranchViewSet(BaseModelViewSet):
    """Branch CRUD — ORG-2. `DepartmentViewSet` above, for the other org
    unit.

    Two permissions, not one: `branches.view` reaches every staff role
    because the ticket form's picker, the customer form's picker, and three
    list filters all need the list; `branches.manage` is admin-only. See
    migration `0010_grant_branch_permissions`.

    NOT a `ScopedQuerysetMixin` consumer — a branch is the thing other
    models are scoped BY, not a thing that is itself scoped.
    """

    queryset = Branch.objects.all()
    serializer_class = BranchSerializer

    permission_map = {
        "list": Permissions.BRANCHES_VIEW,
        "retrieve": Permissions.BRANCHES_VIEW,
        "create": Permissions.BRANCHES_MANAGE,
        "update": Permissions.BRANCHES_MANAGE,
        "partial_update": Permissions.BRANCHES_MANAGE,
        "destroy": Permissions.BRANCHES_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `BranchListPage` (§23).
    ordering_fields = ("name", "created_at")
    search_fields = ("name", "description")
```

**File: `backend/apps/organization/urls.py`** — extend the import on line 4 and add one line after line 13:

```python
router.register("branches", BranchViewSet, basename="branch")
```

Leave the `SimpleRouter`/`DefaultRouter` comment (8-11) and the `settings/` `path()` (16) exactly as they are.

---

### 8 — `BranchAdmin`

**File: `backend/apps/organization/admin.py`** — add after `DepartmentAdmin` (ends line 19); extend the model import on line 5:

```python
@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    """`DepartmentAdmin` above, for `Branch` — an ordinary `ModelAdmin`, a
    manual fallback rather than the primary path (`/settings/branches` is
    that).
    """

    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
```

---

### 9 — `accounts.User.branch`

**File: `backend/apps/accounts/models.py`** — add immediately after `department` (ends line 131), before `objects = UserManager()`:

```python
    # SET_NULL and nullable for the same reasons `department` directly above
    # is (see its comment): a branch is an org-chart label, deleting one
    # must leave every account's access untouched, and every account that
    # exists today has no branch. String reference, not an import:
    # `apps.organization` must stay free of any `accounts` dependency so the
    # migration graph has no cycle (ORG-1 `## Prerequisites`).
    #
    # Independent of `department`, not nested under it: this codebase models
    # no department-within-branch hierarchy, and the intake asks for neither.
    # A user may have both, either, or neither.
    branch = models.ForeignKey(
        "organization.Branch",
        verbose_name=_("branch"),
        related_name="users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
```

**Generate:**

```powershell
cd backend
python manage.py makemigrations accounts
```

Expect `apps/accounts/migrations/0014_user_branch.py`. **Confirm by eye that `dependencies` contains both `("accounts", "0013_user_department")` and `("organization", "0010_grant_branch_permissions")`** — the second is what stops a fresh `migrate` from adding an FK to a table that does not exist yet.

---

### 10 — `BranchBriefSerializer`, `UserSerializer`, `UserAdminSerializer`

**File: `backend/apps/accounts/serializers.py`** — extend the `apps.organization.models` import to bring in `Branch` alongside `Department`, then:

**(a)** Add after `DepartmentBriefSerializer` (ends line 45):

```python
class BranchBriefSerializer(serializers.ModelSerializer):
    """The `/auth/me/` shape of a branch — id and name only.

    A narrow, read-only mirror distinct from
    `apps.organization.serializers.BranchSerializer` (which carries
    `description` and the timestamps for the management screen), exactly as
    `DepartmentBriefSerializer` above is. The session payload should carry
    the caller's branch, not a record of it.
    """

    class Meta:
        model = Branch
        fields = ("id", "name")
```

**(b)** `UserSerializer` — add `branch = BranchBriefSerializer(read_only=True)` after line 107, add `"branch"` to `Meta.fields` after `"department"` (line 119), and add `"branch"` to `read_only_fields` (line 122).

**(c)** `UserAdminSerializer` — add after `department_name` (ends line 163):

```python
    # Same dotted-source + `allow_null=True` pattern as `department_name`
    # above, for the same verified reason. `branch` itself needs no explicit
    # declaration: DRF derives `required=False, allow_null=True` from the
    # model FK's own `null=True, blank=True`.
    branch_name = serializers.CharField(source="branch.name", read_only=True, allow_null=True)
```

Add `"branch"` and `"branch_name"` to `Meta.fields` after `"department_name"` (line 178). **`create()` is unchanged** — `branch` is an ordinary writable field.

---

### 11 — `UserViewSet` gains the second scope

**File: `backend/apps/accounts/views.py`** — exactly two lines:

- Line 178: `queryset = User.objects.select_related("role", "department", "branch")`
- Line 196:

```python
    scope_filters = (
        ScopeFilter(param="department", field="department"),
        ScopeFilter(param="branch", field="branch"),
    )
```

**Do not touch `get_queryset` (198-209).** Its `.filter(customer_profile__isnull=True)` staff-only filter is the single most dangerous thing in this file to disturb; `super().get_queryset()` already reaches the mixin, which now applies both scopes.

---

### 12 — `UserAdmin`

**File: `backend/apps/accounts/admin.py`** — add `"branch"` immediately after `"department"` in `list_display` (line 62), in `list_filter` (66), in `list_select_related` (67), and in the fieldset field tuple (77).

---

### 13 — `customers.Customer.branch`

**File: `backend/apps/customers/models.py`** — add after `user` (ends line 58), before `class Meta` (line 60):

```python
    # The branch that owns this customer relationship — ORG-2. SET_NULL and
    # nullable for the same reasons `accounts.User.branch` and
    # `tickets.Ticket.branch` are: deleting a branch must not delete or
    # block deleting a customer, and every row that exists today has none.
    #
    # This is NOT a portal visibility boundary. Portal scoping is
    # `Customer.user` -> `CustomerScopedModelViewSet` (CONVENTIONS.md §26),
    # and it is untouched. `?branch=` on the staff customer list is a
    # convenience filter and authorizes nothing (§33).
    branch = models.ForeignKey(
        "organization.Branch",
        verbose_name=_("branch"),
        related_name="customers",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
```

**Generate:**

```powershell
cd backend
python manage.py makemigrations customers
```

Expect `apps/customers/migrations/0007_customer_branch.py`. **Confirm `dependencies` contains both `("customers", "0006_customer_external_id")` and `("organization", "0010_grant_branch_permissions")`.**

---

### 14 — `CustomerSerializer`

**File: `backend/apps/customers/serializers.py`** — add after `portal_access_enabled` (line 56):

```python
    # Same verified dotted-source + `allow_null=True` pattern as
    # `TicketSerializer.department_name` (apps/tickets/serializers.py:28-32).
    # `branch` itself needs no declaration — DRF derives
    # `required=False, allow_null=True` from the model FK. Unlike `email`
    # and `external_id` above, this field is NOT overridden, so it keeps
    # every auto-derived validator.
    branch_name = serializers.CharField(source="branch.name", read_only=True, allow_null=True)
```

Add `"branch"` and `"branch_name"` to `Meta.fields` after `"portal_access_enabled"` (line 64).

---

### 15 — `CustomerViewSet` becomes a scoped viewset

**File: `backend/apps/customers/views.py`** — the simplest `ScopedQuerysetMixin` application in the codebase: this class has **no `get_queryset` override**, so there is no method to reconcile.

Add to the imports:

```python
from apps.core.scoping import ScopeFilter, ScopedQuerysetMixin
```

Then change the class declaration (line 29) and the queryset (line 36), and add `scope_filters` after `search_fields` (line 65):

```python
class CustomerViewSet(ScopedQuerysetMixin, BaseModelViewSet):
```

```python
    queryset = Customer.objects.select_related("branch").all()
```

```python
    # ORG-2's scoping declaration — `apps/core/scoping.py`. `?branch=none`
    # lists customers with no branch. `ScopedQuerysetMixin` MUST come before
    # `BaseModelViewSet` in the bases above or Python's MRO puts
    # `ModelViewSet.get_queryset` first and this silently does nothing —
    # there is no error to see. See `## Edge Cases`.
    scope_filters = (ScopeFilter(param="branch", field="branch"),)
```

`permission_map`, `ordering_fields`, `search_fields`, and every `@action` are unchanged. `branch_name` is **not** added to `ordering_fields` — the same rule every joined display column in this codebase follows.

---

### 16 — `CustomerAdmin`

**File: `backend/apps/customers/admin.py`** — on `CustomerAdmin` (13-18): add `"branch"` to `list_display` (line 15, after `"company"`) and add `list_filter = ("branch",)` (this class has none today).

---

### 17 — `tickets.Ticket.branch`

**File: `backend/apps/tickets/models.py`** — add after `department` (ends line 104), before `status` (line 105):

```python
    # SET_NULL and nullable, and writable through `TicketSerializer` on
    # ordinary create/update — the same call `department` directly above
    # makes, for the same reasons stated there. Moving a ticket between
    # branches is routine triage, not a privileged state change, so this is
    # NOT action-only the way `assigned_agent` is.
    #
    # Independent of `department`: a ticket may have either, both, or
    # neither, and nothing validates a pair.
    branch = models.ForeignKey(
        "organization.Branch",
        verbose_name=_("branch"),
        related_name="tickets",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
```

**Generate:**

```powershell
cd backend
python manage.py makemigrations tickets
```

Expect `apps/tickets/migrations/0009_ticket_branch.py`. **Confirm `dependencies` contains both `("tickets", "0008_ticket_department")` and `("organization", "0010_grant_branch_permissions")`.**

---

### 18 — `TicketSerializer`

**File: `backend/apps/tickets/serializers.py`** — add after `department_name` (ends line 32):

```python
    # Same verified dotted-source + `allow_null=True` pattern as
    # `department_name` above. `branch` itself needs no declaration.
    branch_name = serializers.CharField(source="branch.name", read_only=True, allow_null=True)
```

Add `"branch"` and `"branch_name"` to `Meta.fields` after `"department_name"` (line 61).

**Do not extend `immutable_fields` (line 49)** — a ticket may be moved between branches, and that is the point.

**Do not extend `read_only_fields` (77-82)** — `branch` is writable for staff.

---

### 19 — `PortalTicketSerializer`: close the write hole for both org units

**File: `backend/apps/portal/serializers.py`** — task 18 adds `branch`/`branch_name` to the portal payload automatically, because `Meta.fields` is derived (line 43). Extend `read_only_fields` (44-48) to:

```python
        read_only_fields = TicketSerializer.Meta.read_only_fields + (
            "customer",
            "category",
            "priority",
            # ORG-1 added `department` to `TicketSerializer` as a writable
            # field and did not narrow it here, so a portal customer could
            # POST `department: <any id>` and file into an arbitrary org
            # unit. Not a visibility breach — neither field affects
            # `CustomerScopedModelViewSet`'s `customer_field` scoping — but
            # nothing intended it either. Both org units are staff triage
            # decisions, the same reasoning this class's docstring already
            # gives for `category` and `priority`.
            "department",
            "branch",
        )
```

Also add one sentence to the class docstring's `category`/`priority` paragraph (24-29) naming `department` and `branch` as read-only for the same reason.

---

### 20 — `TicketViewSet` gains the second scope

**File: `backend/apps/tickets/views.py`** — exactly two edits:

- Lines 55-57:

```python
    queryset = Ticket.objects.select_related(
        "customer", "category", "assigned_agent", "department", "branch"
    ).all()
```

- Lines 93-97 — replace the `scope_filters` declaration and update its comment (which currently forward-references this story):

```python
    # ORG-1's reusable scoping declaration, now with ORG-2's second entry —
    # added without one line of new parsing code, which was the point.
    # `?department=none`/`?branch=none` list tickets with no department/
    # branch; the two compose with AND. See `apps/core/scoping.py`.
    scope_filters = (
        ScopeFilter(param="department", field="department"),
        ScopeFilter(param="branch", field="branch"),
    )
```

**`get_queryset` (109-141) is unchanged** — its four hand-parsed `category`/`priority`/`status`/`assigned_to_me` filters stay exactly as they are, and `super().get_queryset()` already reaches the mixin.

---

### 21 — `TicketAdmin`

**File: `backend/apps/tickets/admin.py`** — add `"branch"` immediately after `"department"` in `list_display` (line 32) and in `list_filter` (line 39).

---

### 22 — Reports: a sixth dimension and a second scope

**File: `backend/apps/reports/tickets.py`** — two lines.

Add to `DIMENSION_FIELDS` (37-43), after the `"department"` entry:

```python
    "branch": "branch__name",
```

Replace `TICKET_SCOPES` (45-50) — the comment currently forward-references this story, so update it:

```python
# The scopes both RPT-1 endpoints honour. A tuple, so both reports pick up
# every entry: ORG-1 added `department`, ORG-2 added `branch`, and neither
# needed a change to `apply_scope_filters`. Applied via the shared
# `apps.core.scoping.apply_scope_filters` — the reports are plain
# `APIView`s, so they use the function rather than `ScopedQuerysetMixin`.
TICKET_SCOPES = (
    ScopeFilter(param="department", field="department"),
    ScopeFilter(param="branch", field="branch"),
)
```

`scoped_tickets` (53-60), `parse_dimension` (63-82), and both views in `apps/reports/views.py` need **no** edit: `parse_dimension` validates against `DIMENSION_FIELDS`' keys, and both `get_report` implementations already call `scoped_tickets`. Confirm with Verification Step 11 rather than by reading.

---

### 23 — `CONVENTIONS.md` §33 amendment

**File: `CONVENTIONS.md`** — amend §33 (2198-2246) in place. **Do not append a §35** — this is the same mechanism, now with a second consumer, not a new one. Four specific edits:

1. Heading (2198) → `## 33. Organizational scoping (ORG-1, ORG-2)`.
2. The declaring-a-scope example (2216-2220) → show the two-entry tuple, and add one sentence: *"A second scope is a second tuple entry and nothing else — `apps/core/scoping.py` was not modified when ORG-2 added `branch`."*
3. The `Department` paragraph (2235-2243) → replace with: both `departments` and `branches` are now real models (`organization.Department`, `organization.Branch`), promoted by `0004_migrate_settings_departments` and `0008_migrate_settings_branches`; **`OrganizationSettings` holds no JSON list column any more**, and the "no second consumer" constraint is discharged. State the three `Branch` FKs (`accounts.User.branch`, `customers.Customer.branch`, `tickets.Ticket.branch`), all nullable `SET_NULL`.
4. The frontend paragraph (2244-2246) → name `src/shared/branches/` beside `src/shared/departments/`, and note four features consume the branch list.

Then add a short closing paragraph to §33, because it is the thing most likely to be got wrong later:

> **A scope filter is not an access boundary.** `?department=`/`?branch=` narrow a list the caller was already authorized to read in full. Any staff account with `tickets.view` can list any branch's tickets, by design. Restricting *what a staff account may see* to its own org unit is a change to the top row of this section's table, not the bottom one — it needs its own story and its own audit of every report, export, and queue.

---

## Frontend Tasks

### 24 — `src/shared/branches/`

**Create five files**, each `src/shared/departments/`'s counterpart verbatim with `department`→`branch`:

- **`frontend/src/shared/branches/types.ts`** — `export type Branch = { id: number; name: string; description: string; created_at: string; updated_at: string }`, with a docstring naming `apps.organization.serializers.BranchSerializer` and the §15/§33 reason it lives in `shared/` (**four** features need it: `tickets`, `accounts`, `customers`, `reports`).
- **`frontend/src/shared/branches/branchKeys.ts`** — `export const branchKeys = featureKey('branches')` from `@/shared/lib/api/queryKeys`, with `departmentKeys.ts:3-4`'s comment.
- **`frontend/src/shared/branches/getBranches.ts`** — `api.getPage<Branch>('/branches/', { params: { page_size: 100, ordering: 'name' } })`, keeping `getDepartments.ts:6-7`'s `page_size` comment.
- **`frontend/src/shared/branches/useBranches.ts`** — `useQuery({ queryKey: branchKeys.resource('options'), queryFn: getBranches })`.
- **`frontend/src/shared/branches/index.ts`** — re-export `branchKeys`, `getBranches`, `useBranches`, and `type Branch`.

### 25 — `features/organization/types/branch.ts`

**Create file: `frontend/src/features/organization/types/branch.ts`** — `types/department.ts:1-11` verbatim: re-export `Branch` from `@/shared/branches`, and declare `BranchInput = { name: string; description: string }` with the same "always sent (`''` to clear), never omitted" comment.

### 26 — `features/organization/api/` — eight files

**Create** `getBranchList.ts`, `useBranchList.ts`, `getBranch.ts`, `useBranch.ts`, `createBranch.ts`, `updateBranch.ts`, `deleteBranch.ts`, `useBranchMutations.ts` — each its `*Department*.ts` counterpart with `department`→`branch`, `/departments/`→`/branches/`, and `departmentKeys`→`branchKeys` imported from `@/shared/branches`.

`useBranchMutations.ts` must invalidate the bare **`branchKeys.all`** prefix (not a narrower key), and keep `useDepartmentMutations.ts:10-13`'s comment adapted: one call refreshes the admin list, any open detail query, and the `useBranches()` picker in `features/tickets`/`features/accounts`/`features/customers`/`features/reports`.

### 27 — `BranchListPage.tsx`

**Create file: `frontend/src/features/organization/components/BranchListPage.tsx`** — `DepartmentListPage.tsx:1-126` verbatim with:

- `useTranslation('organization')` and every key under `branches.*` instead of `departments.*`.
- `<Can permission="branches.manage">` on the "New branch" button and every row's `DeleteRowButton`.
- Column ids **`name`**, **`description`**, **`created_at`**, **`actions`**; `name` and `created_at` sortable (they match `BranchViewSet.ordering_fields`), `description` not (keep the comment explaining why), `priority: 'sm'` on `description`.
- Links to `/settings/branches/${row.id}/edit` and `/settings/branches/new`.

### 28 — `BranchFormPage.tsx`

**Create file: `frontend/src/features/organization/components/BranchFormPage.tsx`** — `DepartmentFormPage.tsx:1-134` verbatim: the same `requiredString(100)` / `optionalString(255).transform((value) => value ?? '')` schema (keep the comment explaining why the transform is required for a `blank=True`-not-nullable column), the same one-component-for-both-modes split, `navigate('/settings/branches')` on success and cancel, and `branches.created`/`branches.updated` toasts.

### 29 — Routes

**File: `frontend/src/app/router.tsx`** — add two groups immediately after the `departments.manage` group (ends line 596), mirroring 557-596 including the split comment:

- `element: <RequirePermission permission="branches.view" />` → `path: 'settings/branches'` → lazy `BranchListPage`.
- `element: <RequirePermission permission="branches.manage" />` → `path: 'settings/branches/new'` **then** `path: 'settings/branches/:id/edit'` (declaration order matters, same reason `roles/new` records).

Then add to the `tickets.view` group, immediately after `tickets/department` (188) and **before** `tickets/:id` (189):

- `path: 'tickets/branch'` → lazy `BranchQueuePage` from `@/features/tickets/components/BranchQueuePage`, with the "must stay before `tickets/:id`" comment.

### 30 — Sidebar

**File: `frontend/src/app/Sidebar.tsx`** — three edits:

1. `showAdministration` (131-138): add `can('branches.view') ||` after the `departments.view` line.
2. The Support section (191-203): add a second conditional link after the department one — `{user?.branch ? <SidebarLink to="/tickets/branch" icon={MapPinIcon} label={t('tickets:branchQueue.title')} collapsed={collapsed} /> : null}`. Add `MapPinIcon` to the `lucide-react` import (`Building2Icon` is already taken by the department links; a distinct icon is what makes two adjacent queue links legible when the sidebar is collapsed to icons only).
3. The Administration section (289-297): add a `<Can permission="branches.view">` block after the `departments.view` one, linking `/settings/branches` with `MapPinIcon` and `t('organization:branches.title')`.

### 31 — `shared/auth/types.ts`

**File: `frontend/src/shared/auth/types.ts`** — add after `AuthDepartment` (11):

```ts
/** Mirrors `apps.accounts.serializers.BranchBriefSerializer` (ORG-2). */
export type AuthBranch = {
  id: number
  name: string
}
```

and after `AuthUser.department` (25):

```ts
  /** The caller's own branch, or `null`. Drives `/tickets/branch` and the
   * sidebar link to it. Read-only — changing a user's branch goes through
   * `PATCH /api/users/<id>/` (SEC-1's screen), never here. */
  branch: AuthBranch | null
```

### 32 — `features/accounts`

**File: `frontend/src/features/accounts/types/user.ts`** — add `branch: number | null` and `branch_name: string | null` to `AdminUser` (after line 13), and `branch: number | null` to `UserCreateInput` (after line 26). `UserUpdateInput` inherits it.

**File: `frontend/src/features/accounts/components/UserFormPage.tsx`** — six regions, because there are two independent form components:

1. Imports: add `useBranches` from `@/shared/branches` beside `useDepartments` (line 6).
2. After `DEPARTMENT_NONE` (34): `const BRANCH_NONE = 'none'` with the same Radix comment.
3. `baseShape` (36-43): add `branch: z.string()`.
4. After `useDepartmentOptions` (60-70): add `useBranchOptions(noBranchLabel: string)`, identical in shape.
5. **Create form** (~104-127): call `useBranchOptions(t('users.noBranch'))`, add `branch: BRANCH_NONE` to `defaultValues`, add `branch: values.branch === BRANCH_NONE ? null : Number(values.branch)` to the payload, add `branchesPending` to the `Loading` guard at 145, and add a fourth `SelectField` (`name="branch"`, `label={t('users.fields.branch')}`) after the department one at 176-180.
6. **Edit form** (~205-281): the same five changes, with `branch: user.branch === null ? BRANCH_NONE : String(user.branch)` in `defaultValues`.

**File: `frontend/src/features/accounts/components/UserListPage.tsx`** — add a `branch_name` column after the `department_name` one (78-84): non-sortable (absent from `UserViewSet.ordering_fields`), `cell: (row) => row.branch_name ?? t('users.noBranch')`, `priority: 'sm'`. **No filter `Select`** — see `## Story Goal`'s scope boundary.

### 33 — `features/tickets` types and API

**File: `frontend/src/features/tickets/types/ticket.ts`** — add `branch: number | null` and `branch_name: string | null` to `Ticket` (after line 32), and `branch: number | null` to `TicketInput` (after line 57) with the same "always sends this key explicitly (`null` to clear)" comment.

**File: `frontend/src/features/tickets/api/getTickets.ts`** — add to `TicketListParams` (7-16), after `department`:

```ts
  // A string, because the value carries either a numeric branch id or the
  // literal `'none'` — the backend scoping sentinel (ORG-2).
  branch?: string
```

### 34 — `TicketFormPage`

**File: `frontend/src/features/tickets/components/TicketFormPage.tsx`** — mirror every `department` site:

- Import `useBranches` from `@/shared/branches` (line 6 area).
- `const BRANCH_NONE = 'none'` after `DEPARTMENT_NONE` (34).
- `branch: z.string().min(1)` in the schema (after 48).
- `branch: BRANCH_NONE` in `EMPTY_DEFAULTS` (59), `branch: ticket.branch === null ? BRANCH_NONE : String(ticket.branch)` in `toDefaults` (69), `branch: values.branch === BRANCH_NONE ? null : Number(values.branch)` in `toTicketInput` (80).
- `const branchesQuery = useBranches()` (122), `branchesQuery.isPending` in the loading guard (170), a `branchOptions` map (161-165 pattern), and a `SelectField` after the department one (199-207) whose first item is `{ value: BRANCH_NONE, label: t('fields.noBranch') }`.

### 35 — `TicketListPage`

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`** — six edits, each beside its department counterpart:

- Import `useBranches` from `@/shared/branches` (line 7 area).
- `const [branchFilter, setBranchFilter] = useState('all')` after 60, `const branchesQuery = useBranches()` after 63.
- Add `branchFilter` to the page-reset `useEffect`'s dependency array (74).
- Add `...(branchFilter !== 'all' ? { branch: branchFilter } : {})` to the params spread (after 81).
- Add a `branch_name` column after `department_name` (108-115) — non-sortable, `?? t('fields.noBranch')`, `priority: 'sm'`.
- Add a fourth `Select` after the Department one (204-220), same three-item-plus-map shape: `all` → `t('filters.allBranches')`, `none` → `t('fields.noBranch')`, then `branchesQuery.data?.items`.

### 36 — `BranchQueuePage`

**Create file: `frontend/src/features/tickets/components/BranchQueuePage.tsx`** — `DepartmentQueuePage.tsx:1-179` verbatim with `department`→`branch`:

- `const branchId = user?.branch?.id`, `...(branchId !== undefined ? { branch: String(branchId) } : {})`, and **`{ enabled: branchId !== undefined }`** — keep the comment at 52-54: without the guard the query fires without `?branch=` and lists **every** ticket instead of none.
- The `if (branchId === undefined)` early return rendering `<Empty title={t('branchQueue.noBranch')} description={t('branchQueue.noBranchDescription')} />`.
- The same seven columns, the same two status/priority filters, `t('branchQueue.title')` as the caption.

### 37 — `features/customers`

**File: `frontend/src/features/customers/types/customer.ts`** — add `branch: number | null` and `branch_name: string | null` to `Customer` (after line 9), and `branch: number | null` to `CustomerInput` (after line 19).

**File: `frontend/src/features/customers/api/getCustomers.ts`** — add `branch?: string` to `CustomerListParams` (line 7) with the same "numeric id or the literal `'none'`" comment.

**File: `frontend/src/features/customers/components/CustomerFormPage.tsx`** — this form has no `Select` today:

- Add `SelectField` to the `@/shared/ui/form` import (line 9) and `useBranches` from `@/shared/branches`.
- `const BRANCH_NONE = 'none'` above the schema, with the Radix comment.
- `branch: z.string()` in the schema (27), `branch: BRANCH_NONE` in `EMPTY_DEFAULTS` (31), `branch: customer.branch === null ? BRANCH_NONE : String(customer.branch)` in `toDefaults` (33-40), `branch: values.branch === BRANCH_NONE ? null : Number(values.branch)` in `toCustomerInput` (47-54).
- A `SelectField` after the `company` `TextField` (125).
- The form mounts inside `QueryBoundary` for edit (71-75) but the branch options query is independent of it — render the `SelectField` with whatever options have loaded, as `UserFormPage` does; do **not** add a second loading gate.

**File: `frontend/src/features/customers/components/CustomerListPage.tsx`**:

- Import `useBranches`; add `const [branchFilter, setBranchFilter] = useState('all')` and `const branchesQuery = useBranches()`.
- Add `branchFilter` to the page-reset `useEffect` dependency array (44-48).
- Change the query call (50) to `useCustomers({ ...params, ...(search ? { search } : {}), ...(branchFilter !== 'all' ? { branch: branchFilter } : {}) })`.
- Add a `branch_name` column after `company` (72-79) — non-sortable, `?? t('fields.noBranch')`, `priority: 'sm'`.
- Add a branch `Select` beside the search `Input` (~103-107), wrapping both in a `<div className="flex flex-wrap items-center gap-2">` — `TicketListPage.tsx:196-220` is the layout to copy. Import the five `Select*` primitives from `@/shared/ui/primitives/select`.

### 38 — `features/reports`

**File: `frontend/src/features/reports/types/report.ts`** — add `'branch'` to `REPORT_DIMENSIONS` (26-32) after `'department'`.

**Files: `frontend/src/features/reports/api/getTicketVolume.ts` and `getTicketBreakdown.ts`** — add `branch?: string` beside `department` (line 12 in each), same comment.

**File: `frontend/src/features/reports/components/TicketReportsPage.tsx`**:

- Import `useBranches`; add `const [branch, setBranch] = useState('all')` after 75 and `const branchesQuery = useBranches()` after 76.
- Extend `labelForDimensionValue`'s trailing comment (81-84) to name `branch` alongside `category`/`department` as user data rather than a translatable key. **No code change** — the function already falls through to `return key`.
- Add `...(branch !== 'all' ? { branch } : {})` to `volumeParams` (94) and `breakdownParams` (106). Both export handlers pass those same objects, so CSV export picks the filter up for free.
- Add a branch `Select` after the department one (181-194), same `all`/`none`/map shape with `t('filters.allBranches')`/`t('filters.noBranch')`.

`series`/`dimension` need no change — both map over `REPORT_DIMENSIONS`.

### 39 — `SettingsPage`: remove the branches editor and its dead component

**File: `frontend/src/features/organization/types/settings.ts`** — delete `branches: string[]` from `OrganizationSettings` (7) and from `SettingsInput` (18).

**File: `frontend/src/features/organization/components/SettingsPage.tsx`**:

1. Remove `branches: z.array(z.string())` from `schema` (26) and `branches: settings.branches` from `toDefaults` (53).
2. Remove the entire `FormField`/`StringListField` block (192-203).
3. **Delete the `StringListField` component (63-132) entirely** — it now has no consumer. Verified: `grep -rn "StringListField" frontend/src` returns only its definition and that one call site.
4. Remove the imports only `StringListField` used: `PlusIcon`, `XIcon` (line 2 — delete the whole `lucide-react` import), `Badge` (8), `Button` (9), `Input` (11), and `FormItem`/`FormLabel`/`FormField` from line 12, keeping `Form`. Keep `useState` (1) — `formErrors` uses it. Keep `Card`/`CardContent`, `TextField`, `SubmitButton`, `FormErrorSummary`, `PageHeader`, `QueryBoundary`, `useToast`, and the whole `superRefine` `logo_url` check.
5. Add one line to the file's remaining comments recording that this screen now edits branding and SLA defaults only, and that both list fields became models (ORG-1 Story 87, ORG-2 Story 89).

`npm run build` is the gate: **removing `branches` from the `OrganizationSettings` type makes any surviving reference a compile error.**

### 40 — Locales

Five namespaces, both languages. Every key added to `en.json` must be added to `ar.json` in the same position — a missing key renders as the raw key string.

**`frontend/src/features/organization/locales/{en,ar}.json`:**
- **Remove** from `settings`: `fields.branches`, `addBranch`, `newItemPlaceholder`, `removeItem`, and `remove` (already dead — `grep` finds no consumer).
- **Add** a `branches` block, the `departments` block's twenty keys with the wording changed: `title` "Branches", `new` "New branch", `edit` "Edit branch", `search`/`searchPlaceholder`, `empty` "No branches yet", `emptyDescription` "Create a branch to organize users, customers, and tickets by location.", `noSearchResults`, `created`/`updated`, `fields.{name,description,createdAt,actions}`, `actions.{save,delete}`, and `delete.{title,description}` — the description mirroring the department one: "Users, customers, and tickets in this branch keep their records; they simply become unassigned."

**`frontend/src/features/tickets/locales/{en,ar}.json`:** add `fields.branch` "Branch", `fields.noBranch` "No branch", `filters.branch` "Filter by branch", `filters.allBranches` "All branches", and a `branchQueue` block mirroring `departmentQueue` (77-81): `title` "Branch queue", `empty`, `emptyDescription`, `noBranch` "You are not in a branch", `noBranchDescription` "Ask an admin to assign you to a branch to see its ticket queue."

**`frontend/src/features/accounts/locales/{en,ar}.json`:** add `users.noBranch` "No branch" (beside `noDepartment` at 12) and `users.fields.branch` "Branch" (beside `fields.department` at 20).

**`frontend/src/features/customers/locales/{en,ar}.json`:** add `fields.branch` "Branch", `fields.noBranch` "No branch", and a `filters` block with `branch`/`allBranches` (this namespace has no `filters` block today — add one).

**`frontend/src/features/reports/locales/{en,ar}.json`:** add `filters.allBranches`, `filters.noBranch`, `filters.branch` (beside 85-87) and `dimensions.branch` "Branch" (beside 95).

No new namespace is registered — `shared/i18n/resources.ts` is unchanged.

---

## Edge Cases & Failure Modes

- **The settings row has never been created.** `OrganizationSettings.objects.first()` returns `None` in task 2's `promote`, which returns early. Nothing to promote, no crash. `load()` (`models.py:131-134`) is `get_or_create(pk=1)`, so on a database where nobody ever opened `/settings`, the row genuinely does not exist.
- **The `branches` JSON list contains duplicates or blanks.** `_validate_string_list` only ever enforced "non-empty string", never uniqueness. Task 2 uses `get_or_create(name=…)` on a `.strip()`ed value and skips empties — two `"Riyadh"` entries produce one row, not an `IntegrityError` that aborts the migration.
- **Migration `0009` ordered before `0008`.** If the autodetector names `0007_branch` as `0009`'s only dependency, a fresh `migrate` on an existing database drops the `branches` column before `promote` reads it and **silently loses every configured branch**. Task 3 requires checking the generated `dependencies` by hand; Verification Step 2 checks it again.
- **`accounts/0014`, `customers/0007`, or `tickets/0009` missing the `organization` dependency.** On a **fresh** database `migrate` then tries to add an FK to a table that does not exist yet — `ProgrammingError: relation "organization_branch" does not exist`. Loud, but only on a fresh database, so it will not appear on a developer machine that already ran `0007`. Verification Step 3 runs a from-scratch migrate specifically to catch this.
- **`ScopedQuerysetMixin` placed after `BaseModelViewSet` on `CustomerViewSet` (task 15).** Python's MRO then puts `ModelViewSet.get_queryset` first, the mixin never runs, and every `?branch=` returns an **unfiltered** list. **There is no error to see** — the screen looks like it works. Verify by asserting a filtered customer list actually shrinks (Verification Step 9). This is the single most likely silent failure in this story, and it is the same trap ORG-1's `## Edge Cases` recorded for `UserViewSet`.
- **`branch_name` added to `ordering_fields`.** `OrderingFilter` would accept `?ordering=branch_name`, which is not a database field, and DRF would raise. Every joined display column in this codebase is deliberately absent from `ordering_fields` (`apps/tickets/views.py:84-90` records the rule); tasks 11, 15, and 20 add nothing to those tuples.
- **A branch name collides on rename.** `Branch.name` is `unique=True`; DRF derives the validator from the model field, so `PATCH /api/branches/<id>/` with a taken name is a **400 with a field error**, which `applyServerErrors` renders on the `name` input in `BranchFormPage`. Not a 500.
- **A branch is deleted while users, customers, and tickets point at it.** All three FKs are `SET_NULL`: the delete succeeds, every affected row's `branch_id` becomes `NULL`, and all three lists render the `noBranch` fallback. Nothing cascades; nothing 409s. Enforced at `apps/accounts/models.py` (task 9), `apps/customers/models.py` (task 13), `apps/tickets/models.py` (task 17).
- **A branch is deleted while someone has it selected as a list filter.** The next request sends `?branch=<gone id>` — a valid integer, so `apply_scope_filters` filters on it and returns an **empty page**, not a 400 and not an unfiltered list. The `Select` falls back to rendering the raw id because `useBranches()` no longer returns it; the user re-picks. Deliberate: validating existence would cost an extra query on every list request to improve a transient case. Identical to ORG-1.
- **`?branch=` sent empty (`/api/tickets/?branch=`).** `if not raw: continue` (`apps/core/scoping.py:63-64`) — treated as "no filter", identical to omitting it. This is why `UNSCOPED` is the string `"none"`.
- **`?branch=abc`.** `int()` raises and `apply_scope_filters` raises DRF `ValidationError` → **400** with `{"branch": ["Must be a numeric id or \"none\"."]}`. No new code; the message is generated from `scope.param`.
- **`?department=3&branch=7` where no ticket has both.** `apply_scope_filters`' loop chains two `.filter()` calls, so the semantics are **AND** and the result is legitimately empty. Not a bug and not a 400 — Verification Step 8 asserts it explicitly so nobody "fixes" it into an OR later.
- **`?branch=` on a detail route (`/api/tickets/5/?branch=9`).** Ignored — `ScopedQuerysetMixin` scopes only when `self.action` is in `scoped_actions` (`("list",)`). A detail fetch must not 404 because of a stray query param.
- **A user with no branch opens `/tickets/branch`.** `user.branch` is `null`; task 36 renders an empty state and **never fires the query**. Dropping the `enabled` guard would fire `useTickets` without `?branch=` and list every ticket in the org under the heading "Branch queue" — the worst-looking bug available here. The sidebar link is hidden for the same account, so the page is reachable only by typing the URL.
- **A `manager` or `agent` opens `/settings/branches`.** They hold `branches.view`, so `RequirePermission` lets them in and the list renders; the "New branch" button and every row's Delete button are hidden by `<Can permission="branches.manage">`, and the server rejects the writes regardless (`BranchViewSet.permission_map`).
- **A portal customer POSTs `{"branch": 3}` or `{"department": 3}` to `/api/portal/tickets/`.** Both are read-only after task 19, so DRF ignores them and the ticket is created unassigned. Before task 19, `department` was accepted. Verification Step 7 checks both.
- **`?series=branch` or `?dimension=branch` on a report whose tickets have no branch.** `grouped_counts`/`bucketed_counts` are already called with `include_null=True` / `null_label=str(_("Uncategorized"))` for every non-channel dimension (`apps/reports/views.py:141-143` and `:105-106`), so branch-less tickets group under "Uncategorized" rather than vanishing. No code change — but confirm the label reads acceptably on a branch axis (Verification Step 11).
- **`OrganizationSettings.branches` referenced by a stale frontend after deploy.** The old `SettingsPage` sends `branches: [...]` on `PATCH /api/settings/`; DRF ignores an unknown key by default, so the save succeeds and silently drops it. Deploy both halves together. Same half-state ORG-1 documented for `departments`.
- **`StringListField` left in place after task 39.** It compiles (nothing references it) but `oxlint` and `tsc` will flag its now-unused imports, and it is dead code that implies `OrganizationSettings` still has a list field. Delete the component, not just the call site.
- **RTL.** Every new screen composes existing primitives (`DataTable`, `Select`, `SelectField`, `PageHeader`, `Empty`, `Badge`) that are already RTL-clean. `npm run check:rtl` is the gate — no `ml-`/`mr-`/`left-`/`right-` in any new file.
- **`apps/core/scoping.py` modified.** If any task appears to need a change there, stop and report it. Two `ScopeFilter` entries on one viewset is exactly the case that module was built for (`scoping.py:22-25`); needing to edit it means either the plan is wrong or ORG-1's abstraction is, and both are findings, not patches.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` from `backend/` — the existing suite must still pass. `MigrationStateTests.test_no_pending_migrations` is what catches any of tasks 1, 3, 9, 13, or 17 shipping a model change without its migration.
2. `ruff format --check .` and `ruff check .` from `backend/` — covers all four new `organization` migrations, the three new FK migrations, and every edited module. Watch for `F401` on the imports task 3 leaves behind in `apps/organization/models.py`/`serializers.py`: if `ruff` flags an unused import there, the dead-validator deletion was incomplete.
3. `npm run build` from `frontend/` — typechecks the new `shared/branches/` module, the two new organization screens, `BranchQueuePage`, and the `Ticket`/`Customer`/`AdminUser`/`AuthUser`/`OrganizationSettings` type changes. **Removing `branches` from `OrganizationSettings` makes any surviving reference a compile error** — that is the gate for task 39.
4. `npm run lint` — `no-restricted-imports` is what proves task 24's `shared/branches/` placement was necessary: an accidental `@/features/organization/...` import from `features/customers` fails here. It also catches the imports task 39 must remove.
5. `npm run format:check` and `npm run check:rtl`.
6. The `en`/`ar` key-set comparison (the script introduced by [../customer-management/10-story-customer-profiles-SUPPORTOS-28.md](../customer-management/10-story-customer-profiles-SUPPORTOS-28.md) Verification Step 4), run against `features/organization`, `features/tickets`, `features/accounts`, `features/customers`, and `features/reports` — **five** namespaces this time.
7. Real HTTP and a real browser across the migrate → create → assign → filter → report chain — Verification Steps 2-14 below.

---

## Migration / Rollback

**Forward, in order:** `organization/0007_branch` → `organization/0008_migrate_settings_branches` → `organization/0009_remove_organizationsettings_branches` → `organization/0010_grant_branch_permissions`, with `accounts/0014_user_branch`, `customers/0007_customer_branch`, and `tickets/0009_ticket_branch` slotting in after `0010`.

```powershell
cd backend
python manage.py migrate
```

**Before running it on any database with real settings data,** record what is about to be promoted so the result can be checked:

```powershell
python manage.py shell -c "from apps.organization.models import OrganizationSettings; print(OrganizationSettings.load().branches)"
```

**Rollback:**

```powershell
cd backend
python manage.py migrate tickets 0008
python manage.py migrate customers 0006
python manage.py migrate accounts 0013
python manage.py migrate organization 0006
```

Reverse the three FK migrations **first**: `organization 0006` reverses `0007`'s `CreateModel` into a `DeleteModel`, which cannot drop a table that `accounts_user.branch_id`, `customers_customer.branch_id`, and `tickets_ticket.branch_id` still reference. Within the `organization` app, Django unapplies in reverse dependency order, so `0009`'s `RemoveField` is reversed — re-adding the `branches` column, empty — **before** `0008`'s `demote` runs, which is what makes writing that column possible at all.

**Half-applied states and what they look like:**

- **`0007` applied, `0008` not.** The `Branch` table exists and is empty; `OrganizationSettings.branches` still holds the strings. Harmless — nothing reads the table yet. Re-running `migrate` completes it.
- **`0008` applied, `0009` not.** Both sources exist and agree. Also harmless, and the only window in which a rollback loses nothing at all.
- **`0009` applied, `0010` not.** Branches exist and are linkable, but **no role holds `branches.view`** — every ticket form's picker, every customer form's picker, and three list filters return `403`. The most visible half-state; complete the migration.
- **`0010` applied, one of the three FK migrations not.** The `?branch=` scope on the viewset whose FK is missing raises `FieldError` on the first filtered list request — a 500, loud and immediate. Apply all four.
- **Backend deployed, frontend not.** The old `SettingsPage` sends `branches: [...]` on `PATCH /api/settings/`; DRF ignores the unknown key, the save succeeds, and the value silently vanishes. Deploy both halves together.

**The one irreversible loss:** rolling back past `0007` after an admin has created a branch **through the new screen** discards it — `demote` writes every `Branch.name` back into the JSON list, so the names survive, but `description`, `id`, and every `User`/`Customer`/`Ticket` link do not. Stated, not guarded: preserving FK links across a `DeleteModel` is not something a reverse migration can do.

---

## Verification Steps

1. **Backend builds:** from `backend/` — `python manage.py check` exits 0, then `ruff format --check .` and `ruff check .` both exit 0.
2. **Migration inspection, before applying:** `python manage.py makemigrations --check --dry-run` reports no pending changes. Then open all seven new migrations and confirm by eye that (a) `organization/0009`'s `dependencies` names `0008_migrate_settings_branches`, **not** `0007_branch`; and (b) `accounts/0014`, `customers/0007`, and `tickets/0009` each name `("organization", "0010_grant_branch_permissions")` alongside their own app's predecessor.
3. **From-scratch migrate (catches the FK ordering bug):** against a throwaway database — create one, point `DATABASE_URL` at it, run `python manage.py migrate`. It must reach the end with no `relation "organization_branch" does not exist`.
4. **Data promotion on the real database:** print `OrganizationSettings.load().branches`, run `python manage.py migrate`, then `python manage.py shell -c "from apps.organization.models import Branch; print(list(Branch.objects.values_list('name', flat=True)))"`. The second list must contain every distinct non-blank name from the first.
5. **Permissions landed:** `python manage.py shell -c "from apps.accounts.models import Role; print({r.slug: sorted(p for p in r.permissions if p.startswith('branches.')) for r in Role.objects.all()})"` → `admin` has both, `manager` and `agent` have `branches.view` only, `customer` has neither.
6. **Branch CRUD and the permission split.** As an `admin`: `POST /api/branches/ {"name": "Riyadh", "description": ""}` → 201; `POST` the same name again → **400**, not 500. As an `agent`: `GET /api/branches/` → 200; `POST /api/branches/` → **403**; `DELETE /api/branches/<id>/` → **403**.
7. **Portal write hole closed.** As a portal customer: `POST /api/portal/tickets/ {"subject": "x", "description": "y", "department": 1, "branch": 1}` → 201, and the created ticket has `department: null` **and** `branch: null`. Before task 19 the `department` would have stuck.
8. **Ticket scoping, including composition.** Assign branch B and department D to one ticket via `PATCH /api/tickets/<id>/ {"branch": <B>, "department": <D>}` → 200 with `branch_name` and `department_name` in the response. Then:
   - `GET /api/tickets/` → full count.
   - `GET /api/tickets/?branch=<B>` → **only** that ticket.
   - `GET /api/tickets/?branch=none` → every ticket **except** it.
   - `GET /api/tickets/?branch=` → same as unfiltered.
   - `GET /api/tickets/?branch=abc` → **400** with a `branch` field error.
   - `GET /api/tickets/?department=<D>&branch=<B>` → that one ticket (**AND**).
   - `GET /api/tickets/?department=<D>&branch=<other B>` → **empty**, not a 400 and not the department-only result.
   - `GET /api/tickets/<id>/?branch=999999` → **200**, the ticket (detail routes are not scoped).
9. **`CustomerViewSet`'s new mixin actually runs.** `GET /api/customers/` and record the count `N`. `PATCH /api/customers/<id>/ {"branch": <B>}` → 200 with `branch_name`. `GET /api/customers/?branch=<B>` → **exactly 1 row**. **If that returns `N`, `ScopedQuerysetMixin` is in the wrong MRO position** (task 15) — there is no error message for this.
10. **`UserViewSet` regression — the staff-only filter and two scopes together.** `GET /api/users/` and record the count. Confirm no portal customer's email appears (cross-check against a customer with `portal_access_enabled: true`). `PATCH /api/users/<id>/ {"branch": <B>}` → 200 with `branch_name`; `GET /api/users/?branch=<B>` → exactly 1 row; `GET /api/users/?department=<D>&branch=<B>` composes.
11. **Reports:** `GET /api/reports/tickets/breakdown/?dimension=branch` → rows keyed by branch name plus an "Uncategorized" row for branch-less tickets. `GET /api/reports/tickets/volume/?series=branch&branch=<B>` → only that branch's series. `GET /api/reports/tickets/breakdown/?dimension=department&branch=<B>` → department rows narrowed to branch B. `…&export=csv` → a CSV whose rows match the JSON.
12. **Deleting a branch nulls, does not cascade.** `DELETE /api/branches/<B>/` → 204. Re-fetch the ticket, the customer, and the user from steps 8-10 → all three still exist, all three now have `branch: null` and `branch_name: null`.
13. **Frontend runs:** from `frontend/` — `npm run dev`, then in the browser as an `admin`:
    - `/settings/branches` lists, creates, renames, and deletes; the sidebar link appears under Administration beside Departments.
    - `/users/<id>/edit` has both a Department and a Branch select; saving shows the new column on `/users`.
    - `/customers/<id>/edit` has a Branch select; `/customers` shows the Branch column and the Branch filter narrows the table.
    - `/tickets/new` has both selects; `/tickets` has both filters (applied together they narrow further) plus both columns.
    - `/tickets/branch` shows the caller's branch's tickets; log in as an account with no branch and confirm the sidebar link is gone and the URL renders the empty state **rather than every ticket in the org**.
    - `/reports/tickets` offers Branch in both the series and dimension selects and has a working Branch filter that also applies to the CSV export.
    - `/settings` no longer shows a Branches field (and no longer shows Departments), still shows organization name, logo URL, and both SLA defaults, and **still saves**.
    - Switch to Arabic and re-check all eight screens for RTL and for missing keys (a missing key renders as the raw key string).
14. **Regression:** `/tickets` category/priority/status/search/assigned-to-me filters still work and still 400 on a malformed value; `/users` and `/customers` search and sort still work; `/settings/departments` is untouched; `/tickets/department` still works; `/portal` still shows only the signed-in customer's own tickets (`CustomerScopedModelViewSet` is untouched — and task 15 adds a second scoping mixin to a *staff* customer viewset, so this proves the two did not get crossed).
15. **The mechanism was reused, not rewritten:** `git diff --stat backend/apps/core/scoping.py` is **empty**. If it is not, report why before proceeding.
16. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps.organization.Branch` exists with a unique `name` and optional `description`, and `OrganizationSettings.branches` is gone from the model, the serializer, and the frontend types.
- [ ] Both dead `_validate_string_list` helpers (module-level in `models.py`, method in `serializers.py`) and `validate_branches` are deleted; `ruff check .` reports no unused import in either file.
- [ ] Migration `organization/0008_migrate_settings_branches` promoted every distinct non-blank string from the JSON list into a `Branch` row on the real database, and `0009`'s `dependencies` names `0008`.
- [ ] `accounts.User.branch`, `customers.Customer.branch`, and `tickets.Ticket.branch` all exist as nullable `SET_NULL` FKs with `related_name` `users`/`customers`/`tickets`, and each migration names `("organization", "0010_grant_branch_permissions")`.
- [ ] `Permissions.BRANCHES_VIEW`/`BRANCHES_MANAGE` exist, and `0010_grant_branch_permissions` granted `admin` both, `manager`/`agent` view only, `customer` neither.
- [ ] `/api/branches/` supports full CRUD, 400s on a duplicate name, and 403s a `POST` from an `agent`.
- [ ] `?branch=<id>`, `?branch=none`, `?branch=` (empty), and `?branch=abc` behave per the contract on `/api/tickets/`, `/api/users/`, and `/api/customers/`, and `?department=`/`?branch=` compose with AND.
- [ ] `git diff backend/apps/core/scoping.py` is empty — the second scope was added as data, not code.
- [ ] `department` and `branch` are both read-only on `PortalTicketSerializer`; a portal `POST` naming either creates the ticket with both `null`.
- [ ] `/api/reports/tickets/volume/` and `/breakdown/` accept `?series=branch`/`?dimension=branch` and `?branch=`, and the CSV export carries the filter.
- [ ] `src/shared/branches/` holds the five-file options module; no feature imports another feature (`npm run lint` passes).
- [ ] `/settings/branches` lists, creates, renames, and deletes, gated `branches.view` for the route and `branches.manage` for every write control.
- [ ] `/tickets/branch` shows the caller's branch's tickets, and renders an empty state — firing **no** query — for a user with no branch.
- [ ] Branch selects on the user, customer, and ticket forms; branch columns on the users, customers, and tickets lists; branch filters on the tickets list, the customers list, and the ticket reports page.
- [ ] `/settings` edits organization name, logo URL, and the two SLA defaults only; `StringListField` is deleted; the page still saves.
- [ ] Every new `t(...)` key exists in both `en.json` and `ar.json` across all five namespaces; all eight new/changed screens render correctly in Arabic.
- [ ] `CONVENTIONS.md` §33 is retitled for ORG-1 + ORG-2, records both models and the three `Branch` FKs, drops the discharged "no second consumer" constraint, names `src/shared/branches/`, and closes with the "a scope filter is not an access boundary" paragraph.
- [ ] `python manage.py check`, `python manage.py test`, `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, and `npm run build` all exit 0.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 90.**
