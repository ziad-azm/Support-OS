# Story 108 — Saved Views & Filter Presets (Story: SUPPORTOS-131)

## Prerequisites

- **Story 18 (`TKT-2`, Categories & Priorities) completed:** [18-story-categories-priorities-SUPPORTOS-33.md](18-story-categories-priorities-SUPPORTOS-33.md). Established the "equality filter on a list screen is local component state merged into the query params at the call site" pattern (`CONVENTIONS.md` §19, lines 508-517) that `category`/`priority`/`status`/`department`/`branch` all still follow on `TicketListPage.tsx` today. This story's saved-view `filters` payload is exactly that same set of query params, captured and replayed, not a new filtering mechanism.
- **Story 22 (`TKT-3`, Assignment) completed:** [22-story-assignment-SUPPORTOS-34.md](22-story-assignment-SUPPORTOS-34.md). `onlyMine` (wire key `assigned_to_me`) is one of the filters a saved view must be able to hold.
- **Story 98 (`ORG-4`, SUPPORTOS-129, Ticket List Own Scope) completed:** [../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md](../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md). Established `departmentFilter`/`branchFilter`'s non-`'all'` `useState` initial values (the caller's own department/branch) and — critically — the exact "**a default, not a boundary**" language (`CONVENTIONS.md` §33, lines 2516-2522) this story's own default-saved-view rule explicitly reuses, word for word in spirit: a saved view is a starting point the agent can still change, never a lock (intake's own constraint).
- **Story 106 (`TKT-7`, SUPPORTOS-130, Bulk Ticket Actions) — most recently touched this exact file; read its CURRENT state, not Story 98's.** [106-story-bulk-ticket-actions-SUPPORTOS-130.md](106-story-bulk-ticket-actions-SUPPORTOS-130.md) added bulk-selection state (`selectedIds`) to `TicketListPage.tsx` and a second `useState` block (`statusFilter`, from `F-8`) landed between Story 98 and this story. **Not a formal dependency** — nothing here reuses selection or bulk actions — but the file has changed shape twice since Story 98's plan was written, and every line number this plan cites was re-verified against the file's current state this session (`frontend/src/features/tickets/components/TicketListPage.tsx`, 363 lines).
- **No dependency on a not-yet-planned story.** The intake names `TKT-2`, `TKT-3`, `ORG-4` explicitly; all three are implemented and current.

---

## Story Goal

1. **A `SavedView` model + API** — named, owned filter/sort presets, storing the exact query-param dict `GET /api/tickets/` already accepts (never SQL, never a frozen result set), with an `is_shared` flag making a view readable by every caller who can see the ticket list, editable only by its owner or a `tickets.manage` holder.
2. **A view switcher on `/tickets`** — save the current filter/sort state as a new named view, rename or delete an existing one (subject to the owner-or-manager rule), and apply any visible view's filters into the page's existing filter state with one click.
3. **The caller's own default view, when they have one, loads automatically** — replacing, for that caller only, `ORG-4`'s department/branch auto-scope defaults (see `## Product rules` for the exact interaction rule and why).

**Explicitly not in scope** (firm calls, not hedges — genuine open questions are in `## Edge Cases & Failure Modes`):

- **No generalisation to any other list screen.** `SavedView` is a `tickets`-domain model storing `TicketViewSet`'s own query params; `CustomerListPage`, `TaskListPage`, etc. get nothing from this story. A reusable "saved view" mechanism for every list screen is a much larger redesign than the intake asks for.
- **No sharing model beyond the existing role/permission system.** "Shared" means "visible to every caller holding `tickets.view`" — a single boolean, not a per-department/per-team ACL. `accounts.User` has no queryable "team" concept beyond department/branch, and the intake's own wording ("shared/team flag") is satisfied by one flag; building department-scoped sharing is undeclared scope.
- **No "watch/notify on view results" feature.** A saved view is inert stored data, applied on demand — not a subscription, not a digest email, not a badge count. Nothing in the intake asks for it.
- **No "overwrite this view's filters with my current filters" action.** The intake names **save / rename / delete** — three verbs. Changing what a saved view filters by is out of scope; the only way to change a view's *filters* after creation is delete-and-resave. `name` and `is_shared` remain editable via rename; `filters` is immutable after create (enforced, see Backend Task 2).
- **No defaulting to a saved view you do not own.** The caller's default can only be one of their own rows (private or shared) — never someone else's shared view, even though it is visible and applicable via the switcher. See `## Product rules` for the full reasoning; this is what keeps "default" a single boolean on `SavedView` rather than a second per-user pointer table.
- **No new permission constant.** `SavedViewViewSet` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` — the same reuse `CategoryViewSet` (Story 18) and `QuickReplyViewSet` (Story 33, `apps/agents/views.py:76-93`) already established for a resource that is part of the ticket domain but lives in its own model.

---

## Context — Read These Files First

1. `frontend/src/features/tickets/components/TicketListPage.tsx`, full file (363 lines, current — already updated by Story 98 **and** Story 106). Read in full: the filter `useState` block (lines 53-96, including `statusFilter` at 58-62 — added since Story 98's plan by `F-8` — and `selectedIds`/`canBulkAct` at 89-93, added by Story 106), the single filter-reset `useEffect` (107-119, which now also clears `selectedIds`), `handleSortChange`/`handlePageChange` (121-129), and the inline `useTickets({...})` call (131-140) whose object-spread shape Backend Task 4/Frontend Task 5 extract into a shared `filterParams` object so "save current view" and "apply the ticket query" read the exact same data.
2. `frontend/src/features/tickets/api/getTickets.ts`, full file (24 lines) — `TicketListParams`: `search`, `category`, `department`, `branch` (all strings — `department`/`branch` also carry the literal `'none'` sentinel, ORG-1/ORG-2), `status`, `priority`, `assigned_to_me`. This is the definitive list of keys a saved view's `filters` payload must be able to hold, alongside `ordering` (from `useServerTable`'s `ServerTableParams`, `frontend/src/shared/ui/data-table/useServerTable.ts:6-10`) — **not** `page`/`page_size`, which are not part of "a filter combination."
3. `backend/apps/tickets/views.py`, full file (476 lines, current). Read: `TicketViewSet.get_queryset` (140-189, the `category`/`priority`/`status`/`assigned_to_me` optional-filter contract — malformed-but-present is 400, absent is a no-op, exactly what a saved view's stored value replays into), `permission_map` (62-92, note `bulk_assign`/`bulk_status`/`bulk_priority` were the most recent additions, same "keyed by the `@action`'s own method name, missing means authenticated-only" rule every entry follows), `assign` (205-237, the `assigned_agent` required/validated/`None`-unassigns shape), `set_status`/`escalate` (239-275, the "field required, no-op re-statement is 400" contract `SavedViewViewSet.set_default` mirrors below).
4. `backend/apps/core/permissions.py`, full file (149 lines). `HasPermission._required_permission` (140-148, confirms `permission_map` is keyed by action name, a missing entry is authenticated-only not denied) and `has_object_permission` (107-138, the **existing** object-level extension point — read its docstring closely: it only ever tightens for a *portal customer* via `customer_field`, and is explicitly **not** touched by this story; SavedView's owner-or-manager edit rule is enforced separately, see Backend Task 3).
5. `backend/apps/tickets/assignment.py`, full file (74 lines) — `assignable_agents()` (22-42): the established stand-in for "a manager" throughout this codebase is **"holds `tickets.manage`,"** never a role-slug check. This is the precedent this story's "owner or a manager" rule reuses (see `## Product rules`).
6. `backend/apps/accounts/migrations/0003_seed_roles.py`, full file (55 lines) and `backend/apps/tickets/migrations/0002_grant_ticket_permissions.py`, full file (43 lines) — confirms the seeded `manager` role grants only `USERS_VIEW` by itself, and that `admin`/`manager`/`agent` all hold `TICKETS_MANAGE` identically via the grant migration. There is **no role-level distinction** between an "agent" and a "manager" for ticket permissions — role slugs are editable/data-driven (`Role.permissions` is a `JSONField`, `backend/apps/accounts/models.py:56`), so a hardcoded `role.slug == "manager"` check would be both wrong today and fragile against a future role rename. This is why "or a manager" is implemented as "holds `tickets.manage`," matching `assignable_agents()`.
7. `backend/apps/agents/models.py` (`Task`, lines 8-63) and `backend/apps/agents/views.py` (`TaskViewSet`, lines 18-74) — the project's only **owned, full-CRUD personal resource**: `owner` FK, `get_queryset` filtered to `owner=request.user`, `perform_create` sets `owner`. Verified via `grep -rn "owner" backend/apps --include=*.py` (7 files: `accounts/views.py`, `agents/{views,models,admin,tasks}.py`, `accounts/serializers.py`, `agents/migrations/0001_initial.py`) that **no existing model combines ownership with a "shared + editable by owner or manager" rule** — `Task` is owner-only (never shared, no manager override); `Category`/`QuickReply` (`apps/agents/models.py:65-87`) are the opposite shape (no owner, shared with everyone holding `tickets.manage`, editable by anyone with that permission — not "owner or manager," just "manage"). `SavedView` combines both shapes for the first time — confirmed genuinely new, not a rediscovery of an existing pattern; see `CONVENTIONS.md` §23, lines 1533-1547, for the "a shared resource in an owner-scoped app follows the shape of what it *is*" precedent this story extends.
8. `backend/apps/core/serializers.py`, full file (41 lines) — `BaseModelSerializer.immutable_fields` (30-40): "writable on create, frozen after" — the exact mechanism Backend Task 2 uses for `SavedView.filters` (never editable after create, only rename/`is_shared` are). `TicketSerializer.immutable_fields = ("customer",)` (`apps/tickets/serializers.py:59`) is the direct precedent.
9. `backend/apps/sla/models.py` (`SLAPolicy`/`AssignmentRule`, lines 9-166) and `backend/apps/sla/migrations/0005_enforce_single_default_policy_and_rule.py`, full file (45 lines) — the project's only precedent for "at most one row of a kind" via a **partial** `UniqueConstraint` (`condition=`, `nulls_distinct=False`). `SavedView`'s `unique_saved_view_owner_default` constraint (Backend Task 1) follows the same shape: a partial index over `is_default=True` rows only, scoped to `owner`.
10. **Installed DRF source, verified this session** — `backend/.venv/Lib/site-packages/rest_framework/serializers.py`, `get_unique_together_constraints` (1452-1473) and `get_uniqueness_extra_kwargs` (1475-1550). DRF auto-derives a validator from any **multi-field** `Meta.constraints` `UniqueConstraint` (`len(constraint.fields) > 1`, line 1462) whose fields are all present on the serializer. `SavedView`'s `unique_saved_view_owner_name` constraint (`fields=["owner", "name"]`) qualifies — but `owner` is also `read_only_fields`, and the auto-derivation would additionally mark it `required=True` (line 1535, since the FK has no default and is not nullable), and DRF asserts a field cannot be both `read_only` and `required`. **This is a real `AssertionError` at serializer-instantiation time, not a hypothetical** — Backend Task 2 disables the auto-validator (`Meta.validators = []`) and checks the duplicate-name case explicitly in `validate()` instead, the same shape `BaseModelSerializer.validate()` already uses for `immutable_fields`.
11. `backend/apps/core/exceptions.py`, full file (124 lines) — `_to_drf_exception` (54-71): confirms there is **no** global `IntegrityError` handler. A genuine race on either of `SavedView`'s two `UniqueConstraint`s would surface as an unhandled `500` via `_internal_error_response`. Not fixed by this story — see `## Edge Cases & Failure Modes`.
12. `backend/apps/tickets/models.py`, full file (273 lines, current) — `Feedback` (223-272) is the last model; `SavedView` is appended directly after it. `Category` (9-24) is the shortest existing `TimeStampedModel` subclass in this app, useful as a size reference.
13. `backend/apps/tickets/urls.py`, full file (19 lines) — `SimpleRouter` with `tickets`/`categories` registered; `saved-views` is a third registration on the same router, no new file.
14. `backend/apps/tickets/admin.py`, full file (72 lines) — `CategoryAdmin`/`TicketActivityAdmin`/`FeedbackAdmin`; and `backend/apps/agents/admin.py`, full file (47 lines) — `TaskAdmin` (6-17, `"Read-only ops visibility, not a config UI"`) is the precedent `SavedViewAdmin` follows (a real frontend surface exists, per `CONVENTIONS.md` §23 lines 1556-1560's "the deciding factor is always whether the resource has a real frontend management surface").
15. `frontend/src/features/tickets/api/ticketKeys.ts` (4 lines), `useCategoryMutations.ts` (41 lines, the exact "one `useInvalidate*` helper, three mutations, all invalidate the bare resource prefix" shape), `getCategories.ts`/`useCategories.ts`/`createCategory.ts`/`updateCategory.ts`/`deleteCategory.ts`/`useCategory.ts` — the full file set Frontend Tasks 1-2 mirror one-for-one for `SavedView`.
16. `frontend/src/shared/ui/form/useAppForm.ts` (63 lines), `frontend/src/shared/ui/form/index.ts` (10 lines, exports `SwitchField` among others), `frontend/src/shared/ui/form/SwitchField.tsx` (50 lines) — the "reuse UI/FORM" pieces: `useAppForm` + `TextField` + `SwitchField` + `SubmitButton` + `FormErrorSummary`, the same set `frontend/src/features/tickets/components/CategoryFormPage.tsx` (118 lines, full file, read in full) already assembles for a one-field create/edit form. **No existing component combines `Dialog` (`frontend/src/shared/ui/primitives/dialog.tsx`, full file, 156 lines) with `useAppForm`** — verified via `grep -rn "DialogContent" frontend/src/features` (zero hits). This is a new, deliberate composition of two existing pieces (Frontend Task 4), not an invented primitive — justified because save/rename is a small, name-plus-toggle input that belongs in a modal on the list screen, not a full navigated-to page the way `CategoryFormPage` is.
17. `frontend/src/shared/ui/confirm/useConfirm.ts` (13 lines) + `ConfirmContext` — `useConfirm()` returns `Promise<boolean>`, reused for the delete confirmation (mirrors every other destructive action in this feature — `TicketBulkActionBar`, `TicketStatusControl`).
18. `frontend/src/shared/auth/types.ts`, full file (52 lines) — `AuthUser.id`/`.permissions` (22-23, 37-39) and `AuthContextValue.can` (48): `user.id` lets the frontend compare `savedView.owner === user.id` for a UX-only edit-button visibility hint (**"UX only — the backend is the enforcement point," line 38's own comment**); `can('tickets.manage')` is the "or a manager" half.
19. `frontend/src/shared/ui/data-table/types.ts`, full file (42 lines) — `SortState = { field: string; direction: SortDirection } | null` (line 6): the shape a saved view's stored `ordering` string round-trips through.
20. `frontend/src/features/tickets/locales/en.json`, full file (238 lines, read in full) — `filters`, `bulk`, `categories` namespaces are the shape/tone the new `savedViews` namespace matches; `ar.json` is the same file, translated (not re-read in full this session — every prior story in this feature mirrors `en.json`'s key structure into `ar.json` with translated values, e.g. Story 18 `## Context`, item 18).
21. `CONVENTIONS.md` §19 (lines 401-571, especially the equality-filter paragraph at 508-517 and the bulk-selection paragraph at 519-538), §23 (lines 1023-1654, especially "a shared resource in an owner-scoped app" at 1533-1547 and "a second owner-scoped personal resource" at 1516-1531), §33 (lines 2425-2544, especially "Default list scope (ORG-4, Story 98)" at 2507-2543 — the "default, not a boundary" paragraph at 2516-2522 this story's own default-view rule explicitly echoes).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **A saved view stores the query-param dict, never SQL or a frozen result set.** | Intake, task 1 | `SavedView.filters` is a `JSONField` of the SAME string key/value pairs `TicketListParams` already sends; applying a view just calls `useTickets(view.filters)`, replayed through `TicketViewSet.get_queryset`'s EXISTING validation — a stale/invalid stored value 400s exactly like a hand-typed URL would, never a silent crash. |
| **A shared view is readable by anyone who can see the ticket list; editable only by its owner or a caller holding `tickets.manage`.** | Intake, task 1 | `SavedViewViewSet.get_queryset` — `Q(owner=user) \| Q(is_shared=True)`; `perform_update`/`perform_destroy`/`set_default` each call an explicit `_check_editable` helper. **"A manager" = "holds `tickets.manage`,"** the same stand-in `assignable_agents()` already uses — not a role-slug check (see `## Context`, item 6). |
| **Creating (and sharing) a view needs only `tickets.view`; only a NON-OWNER's edit of an existing shared view needs `tickets.manage`.** | This story's design, per the intake's own wording ("editable only by its owner or a manager" — an edit-time gate, stated nowhere as a creation-time one) | `permission_map`: `create`/`list`/`retrieve`/`update`/`partial_update`/`destroy`/`set_default` all map to `TICKETS_VIEW`; the owner-or-manager distinction is object-level, inside the four action methods, not in `permission_map` (which can only gate by action name, never by row). |
| **A saved view is a starting point, never a lock — the same "default, not a boundary" rule `ORG-4` established.** | Intake, task 2, explicit | Applying a view just calls the SAME `setCategoryFilter`/`setStatusFilter`/etc. setters a manual `Select` change already calls (`applyFilters`, Frontend Task 5) — after applying, the filters are ordinary component state, fully editable, with no live binding back to the `SavedView` row. |
| **The caller's own default saved view, when one exists, wins over `ORG-4`'s department/branch auto-scope defaults on first load — for that caller only.** | This story's design, filling the gap the task explicitly calls out | Frontend Task 5's default-application `useEffect`: when `useSavedViews()` resolves and finds a row with `owner === user.id && is_default`, its `filters` are applied over the `useState` initial values (which are still `ORG-4`'s own-department/branch defaults, computed synchronously at mount — see `## Edge Cases` for the resulting one-frame race). A caller with no default saved view is completely unaffected: `ORG-4`'s existing rule is the only thing that ever runs for them, unchanged. |
| **No defaulting to a view you don't own.** | This story's design | `SavedViewViewSet.set_default` explicitly checks `saved_view.owner_id == request.user.id`, raising `PermissionDenied` otherwise — even though the row may be visible (shared) and `get_object()` would otherwise succeed. The switcher's "Set as default" control is hidden client-side for a view the caller doesn't own (UX only; the backend check is the real gate). |
| **`filters` is writable on create, frozen after — rename/re-share never redefines what a view filters by.** | This story's design, per the intake's three verbs (save/rename/delete, not "edit filters") | `SavedViewSerializer.immutable_fields = ("filters",)` — the SAME `BaseModelSerializer` mechanism `TicketSerializer.immutable_fields = ("customer",)` already uses. A `PATCH` that includes a *changed* `filters` value is a 400. |
| **Deleting a view never rewrites the caller's current, already-applied filters.** | This story's design | Delete only removes the `SavedView` row and invalidates the saved-views query; `TicketListPage`'s filter `useState` values are untouched by the mutation — they were copied out at apply time, not referenced live. |
| Wire format is `snake_case` end to end. | §12 | `is_shared`, `is_default`, `owner_name`. |
| No new permission constant. | §17, §22 | `SavedViewViewSet.permission_map` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` only. |

---

## Backend Tasks

### 1 — The `SavedView` model

**File: `backend/apps/tickets/models.py`** — append after `Feedback` (end of file):

```python
class SavedView(TimeStampedModel):
    """A named, owned filter/sort preset for the ticket list — TKT-8. Stores
    the SAME query-param dict `TicketViewSet.get_queryset` already accepts
    (`filters`), never SQL and never a frozen id list (the intake's own
    constraint) — applying a view just replays those params through the
    existing endpoint.

    The first resource in this app combining `Category`/`QuickReply`'s
    shape (shared, visible to anyone who can see tickets) with `Task`'s
    shape (owned, personally writable) — see Story 108 `## Context`, item
    7. `is_shared=False` (the default) makes a row private to its owner,
    exactly like `Task`; `is_shared=True` makes it readable by everyone,
    exactly like `Category`, but — unlike `Category` — still editable only
    by its owner or a `tickets.manage` holder, never by "anyone who can
    manage tickets" outright. See `apps/tickets/views.py::SavedViewViewSet`.
    """

    # CASCADE: a saved view has no meaning independent of the account that
    # made it — the same reasoning `Task.owner` (apps/agents/models.py)
    # already uses for an owned personal resource, not `SET_NULL`
    # (`assigned_agent`/`category`), which is for a reference a record
    # should SURVIVE losing.
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="saved_views",
        verbose_name=_("owner"),
    )
    name = models.CharField(_("name"), max_length=100)
    # Visible to every caller holding tickets.view, not scoped to the
    # owner's own department/team — a single flag, matching
    # Category/QuickReply's own "shared = visible to anyone who can see
    # tickets" shape (Story 108 `## Story Goal`), not a second per-team ACL
    # this project has no queryable concept for.
    is_shared = models.BooleanField(_("shared"), default=False)
    # The exact query-param dict `GET /api/tickets/` accepts — string
    # keys/values, e.g. {"category": "3", "status": "open",
    # "assigned_to_me": "true", "ordering": "-created_at"}. Writable on
    # create only (`SavedViewSerializer.immutable_fields`, Backend Task 2).
    # JSONField precedent: apps/accounts/models.py:56 (Role.permissions).
    filters = models.JSONField(_("filters"), default=dict, blank=True)
    # Owner-scoped meaning: true here means "this loads for ME on open,"
    # never "this loads for everyone who can see it." Written ONLY through
    # `SavedViewViewSet.set_default`, mirroring `Ticket.escalated`'s
    # action-only field (Story 23) — never through the ordinary
    # create/update path. See Story 108 `## Story Goal` for why defaulting
    # to a view you do not own is out of scope.
    is_default = models.BooleanField(_("default"), default=False)

    class Meta:
        verbose_name = _("saved view")
        verbose_name_plural = _("saved views")
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"], name="unique_saved_view_owner_name"
            ),
            # At most one default per owner. No NULLs are involved (unlike
            # SLAPolicy/AssignmentRule's category-nullable constraints,
            # apps/sla/models.py:61-65,156-160), so `nulls_distinct` does
            # not apply here — `condition=` alone is what makes this a
            # PARTIAL index over `is_default=True` rows only, the same
            # "the constraint's name should mean what it says" reasoning
            # apps/sla/migrations/0005_enforce_single_default_policy_and_rule.py
            # already established for this project's other "only one
            # default" cases.
            models.UniqueConstraint(
                fields=["owner"],
                condition=models.Q(is_default=True),
                name="unique_saved_view_owner_default",
            ),
        ]

    def __str__(self) -> str:
        return self.name
```

**Migration:** from `backend/`, venv active: `python manage.py makemigrations tickets`. Expect one new file under `apps/tickets/migrations/` (next number after `0011_ticket_ticket_subject_trgm.py`, so `0012_savedview.py` or Django's equivalent auto-name) containing a single `CreateModel` for `SavedView` with both `UniqueConstraint`s in its `Meta.constraints`. Depends on `("tickets", "0011_ticket_ticket_subject_trgm")` and `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`, the same second dependency `0005_enforce_single_default_policy_and_rule.py` (SLA) carries for its own FK to the user model. **No grant migration** — no new permission constant.

---

### 2 — Serializer

**File: `backend/apps/tickets/serializers.py`** — extend the import (`from .models import Category, SavedView, Ticket`), add after `CategorySerializer`:

```python
class SavedViewSerializer(BaseModelSerializer):
    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)

    # Settable on create (a saved view's whole point), frozen after — the
    # SAME mechanism TicketSerializer.immutable_fields = ("customer",)
    # already established (Story 12/18 `## Prerequisites`;
    # apps/core/serializers.py::BaseModelSerializer). Renaming or
    # re-sharing a view must never silently redefine what it filters by —
    # the intake names save/rename/delete, not "edit filters."
    immutable_fields = ("filters",)

    class Meta(BaseModelSerializer.Meta):
        model = SavedView
        fields = (
            "id",
            "name",
            "owner",
            "owner_name",
            "is_shared",
            "is_default",
            "filters",
            "created_at",
            "updated_at",
        )
        # `is_default` is written ONLY through `set_default` (mirrors
        # `status`/`escalated`, Story 23); `owner` is set ONLY through
        # `perform_create` (mirrors `Task.owner`, apps/agents/views.py:56-57).
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("owner", "is_default")
        # `owner` is read-only, and `unique_saved_view_owner_name` is a
        # 2-field UniqueConstraint, which DRF auto-derives a validator for
        # (rest_framework/serializers.py:1452-1473, verified against the
        # installed source this session — see Story 108 `## Context`, item
        # 10). That auto-validator would additionally mark `owner`
        # `required=True` (no model default, not nullable), and a field
        # cannot be BOTH `read_only` and `required` — DRF asserts on it at
        # serializer-instantiation time, a real crash, not a hypothetical.
        # Disabling the auto-validator and checking the duplicate-name case
        # explicitly in `validate()` below avoids it entirely, using the
        # SAME shape `BaseModelSerializer.validate()` already uses for
        # `immutable_fields`.
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        name = attrs.get("name", self.instance.name if self.instance else None)
        owner = self.instance.owner if self.instance else self.context["request"].user
        if name is not None:
            conflict = SavedView.objects.filter(owner=owner, name=name)
            if self.instance is not None:
                conflict = conflict.exclude(pk=self.instance.pk)
            if conflict.exists():
                raise serializers.ValidationError(
                    {"name": [_("You already have a saved view with this name.")]}
                )
        return attrs
```

Add `from django.utils.translation import gettext_lazy as _` to the import block if not already present (verify against the current top of `serializers.py` — `TicketSerializer` does not currently import it, since it has no translated validation messages of its own; `SavedViewSerializer.validate()` is the first one in this file that does).

---

### 3 — Views and routing

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from django.db import transaction
from django.db.models import Q
```

```python
from .models import Category, SavedView, Ticket
from .serializers import CategorySerializer, SavedViewSerializer, TicketSerializer
```

(`PermissionDenied`/`ValidationError` and `permissions_for` are already imported — reused as-is.)

Add, after `CategoryViewSet` and before `TicketViewSet`:

```python
class SavedViewViewSet(BaseModelViewSet):
    """Named, per-user saved filter/sort combinations for the ticket list —
    TKT-8. Reuses `tickets.*` like `CategoryViewSet`/`QuickReplyViewSet` (a
    saved view is part of the ticket-list domain, not a separate
    permission), but ownership adds a wrinkle neither of those (fully
    shared, no owner) has: a private row is visible only to its own
    owner, and editing someone else's SHARED row needs `tickets.manage` —
    enforced explicitly below, not through `permission_map` (which only
    ever gates by action name, never by object) and not through
    `HasPermission.has_object_permission` (which stays the
    portal-customer-only extension point it already is). See Story 108
    `## Context`, items 4 and 7.
    """

    queryset = SavedView.objects.select_related("owner").all()
    serializer_class = SavedViewSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        # Creating (and sharing) a view needs only tickets.view — the
        # owner-or-manager rule is an EDIT-time gate on someone else's row,
        # per the intake's own wording. See Story 108 `## Product rules`.
        "create": Permissions.TICKETS_VIEW,
        "update": Permissions.TICKETS_VIEW,
        "partial_update": Permissions.TICKETS_VIEW,
        "destroy": Permissions.TICKETS_VIEW,
        "set_default": Permissions.TICKETS_VIEW,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)

    def get_queryset(self):
        queryset = super().get_queryset()
        # A private (is_shared=False) row is visible only to its own
        # owner; a shared row is visible to anyone who can reach this
        # endpoint at all. An invisible row 404s on retrieve/update/
        # destroy/set_default (DRF's get_object() filters through this),
        # never leaking existence the way a 403 would.
        return queryset.filter(Q(owner=self.request.user) | Q(is_shared=True))

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _check_editable(self, saved_view):
        """Owner always may; otherwise the caller needs tickets.manage —
        the established stand-in for "a manager" throughout this codebase
        (apps.tickets.assignment.assignable_agents(), Story 108
        `## Context` item 6), not a role-slug check.
        """
        if saved_view.owner_id == self.request.user.id:
            return
        if Permissions.TICKETS_MANAGE in permissions_for(self.request.user):
            return
        raise PermissionDenied()

    def perform_update(self, serializer):
        self._check_editable(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_editable(instance)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="set-default")
    def set_default(self, request, pk=None):
        """Marks (or clears) this view as the CALLER's own default — never
        someone else's, even for a shared view the caller merely edits.
        Owner-only: `is_default` reflects what loads on the caller's own
        screen, so the owner-or-manager EDIT rule (name/`is_shared`) does
        not extend to it. `is_default` must be present and a real
        boolean; re-sending the current value is a 400 — the same
        no-op-rejection contract `TicketViewSet.escalate` already
        established (Story 23).
        """
        if "is_default" not in request.data:
            raise ValidationError({"is_default": [_("This field is required.")]})
        is_default = request.data.get("is_default")
        if not isinstance(is_default, bool):
            raise ValidationError({"is_default": [_("Must be true or false.")]})

        saved_view = self.get_object()
        if saved_view.owner_id != request.user.id:
            raise PermissionDenied()
        if is_default == saved_view.is_default:
            raise ValidationError(
                {"is_default": [_("Saved view already has this default state.")]}
            )

        with transaction.atomic():
            if is_default:
                SavedView.objects.filter(owner=request.user, is_default=True).update(
                    is_default=False
                )
            saved_view.is_default = is_default
            saved_view.save(update_fields=["is_default", "updated_at"])
        return Response(self.get_serializer(saved_view).data)
```

**File: `backend/apps/tickets/urls.py`** — add the third registration:

```python
router.register("saved-views", SavedViewViewSet, basename="saved-view")
```

(Extend the `from .views import CategoryViewSet, SavedViewViewSet, TicketViewSet` import.) `detail=True` action (`set-default`), no shadowing risk against `/api/tickets/<pk>/` — this is a different router entirely (`saved-views`, not `tickets`).

---

### 4 — Admin

**File: `backend/apps/tickets/admin.py`** — extend the model import (`from .models import Category, Feedback, SavedView, Ticket, TicketActivity`), add:

```python
@admin.register(SavedView)
class SavedViewAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — follows `TaskAdmin`'s
    precedent (apps/agents/admin.py:6-17): a `SavedView` is authored,
    renamed, and deleted by its owner (or a manager, for a shared row)
    through the app's own switcher, not through `/admin/`. See Story 108
    `## Context`, item 14.
    """

    list_display = ("name", "owner", "is_shared", "is_default", "created_at")
    list_filter = ("is_shared", "is_default")
    search_fields = ("name", "owner__email")
    readonly_fields = ("created_at", "updated_at")
```

---

## Frontend Tasks

### 5 — `SavedView` type and API layer

**Create file: `frontend/src/features/tickets/types/savedView.ts`**

```ts
/** Mirrors `apps.tickets.serializers.SavedViewSerializer` verbatim. The
 * SAME string key/value shape `TicketListParams` (getTickets.ts) already
 * sends to `GET /tickets/` — no `page`/`page_size`, those are not part of
 * "a filter combination" (TKT-8). */
export type SavedView = {
  id: number
  name: string
  owner: number
  owner_name: string
  is_shared: boolean
  is_default: boolean
  filters: Record<string, string>
  created_at: string
  updated_at: string
}

/** The create-only write shape — `filters` is immutable after create
 * (`SavedViewSerializer.immutable_fields`, backend). */
export type SavedViewInput = {
  name: string
  is_shared: boolean
  filters: Record<string, string>
}

/** The rename write shape — deliberately narrower than `SavedViewInput`:
 * a PATCH through this type can never accidentally resend (and thus risk
 * rejecting on) `filters`. */
export type SavedViewRenameInput = {
  name: string
  is_shared: boolean
}
```

**Create file: `frontend/src/features/tickets/api/getSavedViews.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { SavedView } from '../types/savedView'

// page_size: 100 — the server's max, the same simplification getCategories.ts
// already accepted; a caller's own views plus every shared one is not
// expected to approach that in practice.
export function getSavedViews(): Promise<Page<SavedView>> {
  return api.getPage<SavedView>('/saved-views/', { params: { page_size: 100, ordering: 'name' } })
}
```

**Create file: `frontend/src/features/tickets/api/useSavedViews.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getSavedViews } from './getSavedViews'
import { ticketKeys } from './ticketKeys'

export function useSavedViews() {
  return useQuery({
    queryKey: ticketKeys.resource('saved-views'),
    queryFn: getSavedViews,
  })
}
```

**Create files** `createSavedView.ts`, `updateSavedView.ts`, `deleteSavedView.ts`, `setDefaultSavedView.ts` — mirroring `createCategory.ts`/`updateCategory.ts`/`deleteCategory.ts` exactly:

```ts
// createSavedView.ts
import { api } from '@/shared/lib/api/client'
import type { SavedView, SavedViewInput } from '../types/savedView'

export function createSavedView(input: SavedViewInput): Promise<SavedView> {
  return api.post<SavedView>('/saved-views/', input)
}
```

```ts
// updateSavedView.ts
import { api } from '@/shared/lib/api/client'
import type { SavedView, SavedViewRenameInput } from '../types/savedView'

// PATCH, not PUT — matches updateCategory.ts.
export function updateSavedView(id: number, input: SavedViewRenameInput): Promise<SavedView> {
  return api.patch<SavedView>(`/saved-views/${id}/`, input)
}
```

```ts
// deleteSavedView.ts
import { api } from '@/shared/lib/api/client'

export function deleteSavedView(id: number): Promise<void> {
  return api.delete(`/saved-views/${id}/`)
}
```

```ts
// setDefaultSavedView.ts
import { api } from '@/shared/lib/api/client'
import type { SavedView } from '../types/savedView'

export function setDefaultSavedView(id: number, isDefault: boolean): Promise<SavedView> {
  return api.post<SavedView>(`/saved-views/${id}/set-default/`, { is_default: isDefault })
}
```

**Create file: `frontend/src/features/tickets/api/useSavedViewMutations.ts`** — mirrors `useCategoryMutations.ts`'s one-invalidate-helper shape:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createSavedView } from './createSavedView'
import { deleteSavedView } from './deleteSavedView'
import { setDefaultSavedView } from './setDefaultSavedView'
import { updateSavedView } from './updateSavedView'
import { ticketKeys } from './ticketKeys'
import type { SavedViewInput, SavedViewRenameInput } from '../types/savedView'

function useInvalidateSavedViews() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ticketKeys.resource('saved-views') })
}

export function useCreateSavedView() {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: (input: SavedViewInput) => createSavedView(input),
    onSuccess: invalidate,
  })
}

export function useRenameSavedView(id: number) {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: (input: SavedViewRenameInput) => updateSavedView(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteSavedView() {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: (id: number) => deleteSavedView(id),
    onSuccess: invalidate,
  })
}

export function useSetDefaultSavedView() {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: ({ id, isDefault }: { id: number; isDefault: boolean }) =>
      setDefaultSavedView(id, isDefault),
    onSuccess: invalidate,
  })
}
```

---

### 6 — `SaveViewDialog`: the save/rename form

**Create file: `frontend/src/features/tickets/components/SaveViewDialog.tsx`**

A new, deliberate composition of `Dialog` (`shared/ui/primitives/dialog.tsx`) and `useAppForm` (`shared/ui/form`) — verified no existing consumer combines them (Story 108 `## Context`, item 16). One component for both "save current view" (create) and "rename" (update), the same "one component, two modes" shape `CategoryFormPage` uses:

```tsx
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { isValidationError } from '@/shared/validation/serverErrors'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, SwitchField, TextField, useAppForm } from '@/shared/ui/form'
import { applyServerErrors } from '@/shared/validation/serverErrors'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateSavedView, useRenameSavedView } from '../api/useSavedViewMutations'
import type { SavedView } from '../types/savedView'

const schema = z.object({
  name: requiredString(100),
  is_shared: z.boolean(),
})

type FormValues = z.output<typeof schema>

export function SaveViewDialog({
  open,
  onOpenChange,
  mode,
  view,
  filters,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'save' | 'rename'
  /** Required when `mode === 'rename'`. */
  view?: SavedView
  /** The current filter/sort state — used only in `mode === 'save'`. */
  filters?: Record<string, string>
  onSaved: (view: SavedView) => void
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const form = useAppForm({
    schema,
    defaultValues: { name: view?.name ?? '', is_shared: view?.is_shared ?? false },
  })
  const createMutation = useCreateSavedView()
  const renameMutation = useRenameSavedView(view?.id ?? 0)
  const mutation = mode === 'save' ? createMutation : renameMutation

  function onSubmit(values: FormValues) {
    const onSuccess = (savedView: SavedView) => {
      toast({
        tone: 'success',
        message: t(mode === 'save' ? 'savedViews.created' : 'savedViews.updated'),
      })
      onOpenChange(false)
      onSaved(savedView)
    }
    const onError = (error: unknown) => {
      if (isValidationError(error)) applyServerErrors(form, error)
    }
    if (mode === 'save') {
      createMutation.mutate({ ...values, filters: filters ?? {} }, { onSuccess, onError })
    } else {
      renameMutation.mutate(values, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(mode === 'save' ? 'savedViews.saveDialog.title' : 'savedViews.renameDialog.title')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField control={form.control} name="name" label={t('savedViews.fields.name')} />
            <SwitchField
              control={form.control}
              name="is_shared"
              label={t('savedViews.fields.shared')}
              description={t('savedViews.fields.sharedDescription')}
            />
            <FormErrorSummary errors={[]} />
            <DialogFooter>
              <SubmitButton pending={mutation.isPending}>{t('actions.save')}</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

> Verify `applyServerErrors`'s exact signature against `frontend/src/shared/validation/serverErrors.ts` before wiring `FormErrorSummary` — `CategoryFormPage.tsx` (lines 67, 87-90) keeps a separate `formErrors` state array populated from `applyServerErrors`'s return value; mirror that exactly rather than passing `[]`, the placeholder above.

---

### 7 — `SavedViewBar`: the switcher and its actions

**Create file: `frontend/src/features/tickets/components/SavedViewBar.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSavedViews } from '../api/useSavedViews'
import { useDeleteSavedView, useSetDefaultSavedView } from '../api/useSavedViewMutations'
import { SaveViewDialog } from './SaveViewDialog'
import type { SavedView } from '../types/savedView'

const CUSTOM = 'custom'

export function SavedViewBar({
  filters,
  selectedViewId,
  onSelectView,
  onApply,
}: {
  /** The list's current filter/sort state, as query params — passed to
   * "Save current view." */
  filters: Record<string, string>
  selectedViewId: number | null
  onSelectView: (id: number | null) => void
  /** Applies a chosen view's filters onto the page's own filter state. */
  onApply: (filters: Record<string, string>) => void
}) {
  const { t } = useTranslation('tickets')
  const { user, can } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const savedViewsQuery = useSavedViews()
  const deleteMutation = useDeleteSavedView()
  const setDefaultMutation = useSetDefaultSavedView()
  const [dialog, setDialog] = useState<'save' | 'rename' | null>(null)

  const views = savedViewsQuery.data?.items ?? []
  const selectedView = views.find((view) => view.id === selectedViewId) ?? null
  const canEditSelected =
    selectedView !== null && (selectedView.owner === user?.id || can('tickets.manage'))

  function handleSelect(value: string) {
    if (value === CUSTOM) {
      onSelectView(null)
      return
    }
    const view = views.find((candidate) => String(candidate.id) === value)
    if (!view) return
    onSelectView(view.id)
    onApply(view.filters)
  }

  async function handleDelete() {
    if (!selectedView) return
    const ok = await confirm({
      title: t('savedViews.delete.title'),
      description: t('savedViews.delete.description'),
      destructive: true,
    })
    if (!ok) return
    deleteMutation.mutate(selectedView.id, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('savedViews.deleted') })
        onSelectView(null)
      },
    })
  }

  function handleToggleDefault() {
    if (!selectedView || selectedView.owner !== user?.id) return
    setDefaultMutation.mutate(
      { id: selectedView.id, isDefault: !selectedView.is_default },
      {
        onSuccess: () => toast({ tone: 'success', message: t('savedViews.defaultUpdated') }),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedViewId ? String(selectedViewId) : CUSTOM} onValueChange={handleSelect}>
        <SelectTrigger aria-label={t('savedViews.switcherLabel')} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CUSTOM}>{t('savedViews.customOption')}</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={String(view.id)}>
              {view.name}
              {view.is_default && view.owner === user?.id ? ` (${t('savedViews.defaultBadge')})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedView?.is_shared ? <Badge variant="secondary">{t('savedViews.sharedBadge')}</Badge> : null}
      <Button type="button" variant="outline" size="sm" onClick={() => setDialog('save')}>
        {t('savedViews.actions.save')}
      </Button>
      {canEditSelected ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog('rename')}>
            {t('savedViews.actions.rename')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDelete}>
            {t('savedViews.actions.delete')}
          </Button>
        </>
      ) : null}
      {selectedView && selectedView.owner === user?.id ? (
        <Button type="button" variant="ghost" size="sm" onClick={handleToggleDefault}>
          {t(selectedView.is_default ? 'savedViews.actions.clearDefault' : 'savedViews.actions.setDefault')}
        </Button>
      ) : null}
      {dialog === 'save' ? (
        <SaveViewDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode="save"
          filters={filters}
          onSaved={(view) => onSelectView(view.id)}
        />
      ) : null}
      {dialog === 'rename' && selectedView ? (
        <SaveViewDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode="rename"
          view={selectedView}
          onSaved={() => undefined}
        />
      ) : null}
    </div>
  )
}
```

`canEditSelected`/the owner-only default controls are **UX only** — `AuthUser`'s own docstring (`shared/auth/types.ts:38`) already states the backend is the enforcement point; a stale `user.id` comparison merely hides a button that would otherwise 403.

---

### 8 — `TicketListPage`: filter-params extraction, apply, and the default-on-load effect

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`**

Add imports: `useSavedViews` (unused directly here — `SavedViewBar` owns that query; this file only needs it for the default-application effect), `useRef` from `react`, `SavedViewBar`, `SortState` type (already imported at line 24).

Extract the inline `useTickets({...})` spread (lines 131-140) into a named object both the query and `SavedViewBar` read:

```tsx
  const filterParams: Record<string, string> = {
    ...(search ? { search } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter } : {}),
    ...(departmentFilter !== 'all' ? { department: departmentFilter } : {}),
    ...(branchFilter !== 'all' ? { branch: branchFilter } : {}),
    ...(onlyMine ? { assigned_to_me: 'true' } : {}),
    ...(sort ? { ordering: `${sort.direction === 'desc' ? '-' : ''}${sort.field}` } : {}),
  }
  const query = useTickets({ ...params, ...filterParams })
```

(`TicketPriority`/`TicketStatus` casts from the original spread are dropped — `filterParams`'s values are all plain strings, and `useTickets`'s `TicketListParams` already accepts `string` for `category`/`department`/`branch`; verify `status`/`priority`/`assigned_to_me`'s literal-union types in `getTickets.ts` still accept this looser `Record<string, string>` shape when spread — widen `TicketListParams` to accept `string` for those three fields if `tsc` objects, since a saved view's stored value cannot be typed any more narrowly than a string at rest.)

Add saved-view state and the apply function, after the `selectedIds`/`canBulkAct` block (line 93):

```tsx
  // TKT-8: which saved view (if any) the current filters were last applied
  // from. Purely a "what did I start from" pointer for the switcher's own
  // rename/delete/set-default targeting — NOT a live binding. Changing a
  // filter afterward does not clear this, because a saved view is a
  // starting point the agent can still change, never a lock (ORG-4's own
  // "default, not a boundary" rule, reused verbatim here).
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null)
  const savedViewsQuery = useSavedViews()
  const appliedDefaultRef = useRef(false)

  function applyFilters(filters: Record<string, string>) {
    setSearchInput(filters.search ?? '')
    setSearch(filters.search ?? '')
    setCategoryFilter(filters.category ?? 'all')
    setStatusFilter(filters.status ?? 'all')
    setPriorityFilter(filters.priority ?? 'all')
    setDepartmentFilter(filters.department ?? 'all')
    setBranchFilter(filters.branch ?? 'all')
    setOnlyMine(filters.assigned_to_me === 'true')
    if (filters.ordering) {
      const desc = filters.ordering.startsWith('-')
      setSort({ field: desc ? filters.ordering.slice(1) : filters.ordering, direction: desc ? 'desc' : 'asc' })
    } else {
      setSort(null)
    }
  }
```

Add the default-on-load effect, after the effect above (which resets `page`/clears `selectedIds`):

```tsx
  // TKT-8: applies the caller's OWN default saved view (if any) ONCE,
  // after `useSavedViews()` resolves — it cannot run any earlier, since
  // the saved-views list is genuinely async (unlike `user.department`,
  // which `useAuth()` already resolves synchronously by the time this
  // page mounts, see ORG-4 `## Prerequisites`). This means the list can
  // paint ONE extra request under ORG-4's own department/branch defaults
  // before this effect fires and re-applies the saved default — a known,
  // accepted cost (see Story 108 `## Edge Cases`), not a regression of
  // ORG-4's own synchronous guarantee for a caller with NO default view,
  // who is fully unaffected by this effect (the `find` below returns
  // `undefined` and nothing happens).
  useEffect(() => {
    if (appliedDefaultRef.current) return
    if (!savedViewsQuery.isSuccess) return
    appliedDefaultRef.current = true
    const defaultView = savedViewsQuery.data.items.find(
      (view) => view.owner === user?.id && view.is_default,
    )
    if (defaultView) {
      applyFilters(defaultView.filters)
      setSelectedViewId(defaultView.id)
    }
  }, [savedViewsQuery.isSuccess, savedViewsQuery.data, user])
```

Clear `selectedViewId` whenever the currently-selected view disappears from a refetched list (deleted by its owner or, for a shared view, by a manager — Backend Task 3's `_check_editable`):

```tsx
  useEffect(() => {
    if (selectedViewId === null || !savedViewsQuery.isSuccess) return
    const stillExists = savedViewsQuery.data.items.some((view) => view.id === selectedViewId)
    if (!stillExists) setSelectedViewId(null)
  }, [selectedViewId, savedViewsQuery.isSuccess, savedViewsQuery.data])
```

Render `SavedViewBar` above the existing filter row, before the `<Input>` (search) or directly after it — placed here directly after the search `Input`, before the `flex flex-wrap` filter `Select` row:

```tsx
      <SavedViewBar
        filters={filterParams}
        selectedViewId={selectedViewId}
        onSelectView={setSelectedViewId}
        onApply={applyFilters}
      />
```

Add the import: `import { SavedViewBar } from './SavedViewBar'` and `import { useSavedViews } from '../api/useSavedViews'`.

---

### 9 — Locale namespace

**File: `frontend/src/features/tickets/locales/en.json`** — add a new top-level `savedViews` key (e.g. after `categories`):

```json
"savedViews": {
  "switcherLabel": "Saved view",
  "customOption": "Custom filters",
  "defaultBadge": "Default",
  "sharedBadge": "Shared",
  "actions": {
    "save": "Save current view",
    "rename": "Rename",
    "delete": "Delete",
    "setDefault": "Set as default",
    "clearDefault": "Remove as default"
  },
  "saveDialog": { "title": "Save current view" },
  "renameDialog": { "title": "Rename saved view" },
  "fields": {
    "name": "Name",
    "shared": "Share with the team",
    "sharedDescription": "Visible to everyone who can see tickets. Only you or a manager can rename or delete it."
  },
  "delete": {
    "title": "Delete this saved view?",
    "description": "This removes it for everyone who could see it. This cannot be undone."
  },
  "created": "Saved view created.",
  "updated": "Saved view updated.",
  "deleted": "Saved view deleted.",
  "defaultUpdated": "Default view updated."
}
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
"savedViews": {
  "switcherLabel": "العرض المحفوظ",
  "customOption": "تصفية مخصصة",
  "defaultBadge": "افتراضي",
  "sharedBadge": "مشترك",
  "actions": {
    "save": "حفظ العرض الحالي",
    "rename": "إعادة تسمية",
    "delete": "حذف",
    "setDefault": "تعيين كافتراضي",
    "clearDefault": "إزالة كافتراضي"
  },
  "saveDialog": { "title": "حفظ العرض الحالي" },
  "renameDialog": { "title": "إعادة تسمية العرض المحفوظ" },
  "fields": {
    "name": "الاسم",
    "shared": "مشاركة مع الفريق",
    "sharedDescription": "مرئي لكل من يمكنه رؤية التذاكر. يمكن فقط لك أو للمدير إعادة تسميته أو حذفه."
  },
  "delete": {
    "title": "حذف هذا العرض المحفوظ؟",
    "description": "سيُزال هذا العرض لكل من كان بإمكانه رؤيته. لا يمكن التراجع عن هذا الإجراء."
  },
  "created": "تم إنشاء العرض المحفوظ.",
  "updated": "تم تحديث العرض المحفوظ.",
  "deleted": "تم حذف العرض المحفوظ.",
  "defaultUpdated": "تم تحديث العرض الافتراضي."
}
```

---

## Documentation Task

### 10 — `CONVENTIONS.md`

**File: `CONVENTIONS.md`** — append one paragraph to the end of § 23 (Feature module conventions, after the "shared resource in an owner-scoped app" paragraph at lines 1533-1547, before whatever paragraph currently follows it):

> **A resource can be both owned and shareable at once — pick which half of the shape each rule follows, don't force one shape whole.** `SavedView` (Story 108, `TKT-8`) is the first resource in this project combining `Category`/`QuickReply`'s shape (a boolean makes a row visible to everyone holding the domain's `.view` permission) with `Task`'s shape (owned, personally writable) — read visibility follows the former (`Q(owner=user) | Q(is_shared=True))`), write access follows a THIRD rule neither sibling needed: **owner or a `.manage` holder**, checked explicitly inside `perform_update`/`perform_destroy` rather than through `HasPermission.has_object_permission` (which stays the portal-customer-only extension point it already was) or through `permission_map` (which can only ever gate by action name, never by row). "A manager" is never a role-slug check — it is "holds the domain's `.manage` permission," the same stand-in `apps.tickets.assignment.assignable_agents()` already established, because role permissions are data (`Role.permissions`, a `JSONField` editable through `SEC-2`'s UI), not code.

---

## Edge Cases & Failure Modes

- **Deleting a view that is currently applied.** The already-applied filters in `TicketListPage`'s own `useState` values are untouched — they were copied out at apply time (`applyFilters`), never a live reference to the `SavedView` row. Only the switcher itself reacts: once the delete mutation invalidates `ticketKeys.resource('saved-views')` and the list refetches without that id, the "still exists?" effect (Frontend Task 8) clears `selectedViewId` back to the `CUSTOM` sentinel. The agent's visible ticket list does not change out from under them.
- **Deleting, or a manager deleting, a shared view that was its owner's default.** Because `is_default` lives ON the deleted row itself (not a separate pointer table — this is the direct payoff of rejecting the "defaulting to someone else's view" design, `## Story Goal`), there is no dangling reference to clean up: the row and its `is_default=True` flag simply cease to exist together. The next time that owner loads `/tickets`, the default-application effect finds no matching row and falls straight back to `ORG-4`'s own department/branch defaults — the exact same "no default view exists" path every caller who never saved one already takes.
- **Renaming a view to a name the same owner already used.** `SavedViewSerializer.validate()` raises a `400` on `name` before the database is touched (Backend Task 2); the DB-level `unique_saved_view_owner_name` constraint is the backstop for a genuine race between two concurrent requests from the same owner — an actual race there is not handled and would surface as an unhandled `500` (`apps/core/exceptions.py` has no `IntegrityError` handler, verified — `## Context`, item 11). Accepted: two simultaneous saves of the identically-named view, by the identical user, is a vanishingly rare race, and adding a global `IntegrityError` handler is a separate, cross-cutting hardening story, not this one's.
- **A non-owner, non-manager attempting to edit or delete a shared view.** `get_object()` succeeds (the row is visible, `is_shared=True`), then `_check_editable` raises `PermissionDenied` → `403`, never a `404` — consistent with `HasPermission.has_object_permission`'s own "visible but not permitted is 403" philosophy (`apps/core/permissions.py:107-138`) even though this story enforces the rule through a different code path (object-level check inside the action, not that shared class).
- **A saved view's stored `filters` references a category/department/branch id that no longer exists.** Applying it just sends that id as `?category=<id>` (etc.) to `GET /tickets/`; `TicketViewSet.get_queryset` filters by a well-formed-but-nonexistent id the same way it always has — zero matching rows, not a `400` and not a crash. Only a MALFORMED value (non-numeric, or an unrecognised `status`/`priority` string) 400s, exactly as it would from a hand-typed URL — no new validation path is added for stored values.
- **Two default views somehow both `True` for the same owner.** Prevented at three layers: `set_default`'s own re-statement check (can't set the same view default twice in a row), the `transaction.atomic()` unset-then-set inside it, and the `unique_saved_view_owner_default` partial `UniqueConstraint` as the hard backstop against a genuine race between two concurrent `set_default` calls for the same owner — which, like the name race above, would surface as an unhandled `500`, not silently succeed with two rows `True`.
- **The default-on-load race: one frame of `ORG-4`'s defaults before the saved default is applied.** `useSavedViews()` is genuinely async — unlike `user.department`/`user.branch`, which `useAuth()` already resolves synchronously by the time `TicketListPage` mounts (behind `RequireAuth`, verified in `ORG-4`'s own plan). A caller WITH a default saved view sees the list briefly open under `ORG-4`'s auto-scope defaults, then re-request once the default-application effect fires — one extra `/api/tickets/` call, not a broken state. A caller with NO default saved view is completely unaffected (the effect's `find` returns `undefined`).
- **Empty state — no saved views exist at all (personal or shared).** `SavedViewBar`'s `Select` still renders, showing only the `CUSTOM`/"Custom filters" option; "Save current view" is always available regardless. No special empty-state component is needed — this mirrors how `categoriesQuery`'s own empty case already renders an otherwise-empty `Select` today.
- **RTL and keyboard accessibility of the new switcher.** `SavedViewBar` reuses the exact same `Select`/`Button`/`Badge` primitives every other control on this page already uses (Radix-based, already keyboard-accessible — Story 106 `## Context`, item 13's `Checkbox` finding applies identically here: no extra wiring needed) — verified via `npm run check:rtl` (Verification Steps) rather than assumed.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or removed. Verification is the real HTTP/UI walkthrough in `## Verification Steps`.

---

## Migration / Rollback

**One migration**, generated by Backend Task 1: a single `CreateModel(SavedView)` with two `UniqueConstraint`s (`unique_saved_view_owner_name`, `unique_saved_view_owner_default`) in `Meta.constraints`. Depends on `("tickets", "0011_ticket_ticket_subject_trgm")` and `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`. **No grant migration** — no new permission constant.

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0011` to unapply the new migration before removing it, if rolling back only this story (not the whole commit history since).

**Half-applied states to avoid:**

- **`SavedViewSerializer` shipped without `Meta.validators = []`.** Per the verified DRF source (`## Context`, item 10), this raises an `AssertionError` the first time the serializer is instantiated — a total `500` on every request touching `/saved-views/`, not a partial degradation. Verify this explicitly (Verification Steps) rather than trusting the code compiles.
- **`SavedViewViewSet` registered on the router without every `permission_map` entry populated.** A missing action entry is authenticated-only, not denied (`HasPermission`'s own documented behaviour) — this story's `permission_map` covers `list`/`retrieve`/`create`/`update`/`partial_update`/`destroy`/`set_default`; verify it stays fully populated if edited.
- **Frontend shipped `SavedViewBar`/`SaveViewDialog` (Tasks 6-8) without Backend Tasks 1-4 deployed first.** Every mutation would 404 — ship backend before frontend, or at minimum in the same deploy.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces exactly one new file containing `CreateModel(SavedView)` with both `UniqueConstraint`s; `python manage.py migrate`; `python manage.py makemigrations tickets --check --dry-run` exits 0 with no output afterward.
3. **`SavedViewSerializer` instantiates without error.** `python manage.py shell -c "from apps.tickets.serializers import SavedViewSerializer; SavedViewSerializer()"` does not raise `AssertionError` — the exact failure mode named in `## Migration / Rollback`.
4. **Backend regression:** `python manage.py test` still passes (the existing suite count, unchanged by this story — no test file is added).
5. **Real HTTP: create, list, and the owner-or-manager edit rule.** As agent A (holds `tickets.manage`, per seed data every agent/manager/admin role does): `POST /api/saved-views/` `{"name": "My urgent", "is_shared": false, "filters": {"priority": "urgent"}}` → `201`. `GET /api/saved-views/` as agent B → does **not** include it (private). `PATCH` it as agent B → `403`. Now `PATCH` it as agent A (the owner) → `200`, name changes. Re-`POST` a second view with `is_shared: true` as agent A; `GET /api/saved-views/` as agent B → **does** include it; `PATCH` it as agent B → `403` (agent B holds `tickets.manage` too under this seed, so this specific check needs a caller who does NOT — verify against a role with only `tickets.view`, or note in the test run that every seeded staff role currently holds `tickets.manage` and this distinction needs a temporary custom role to exercise for real); `DELETE` it as agent A → `204`.
6. **`filters` is immutable after create.** `PATCH` an existing saved view with a `filters` value different from its current one → `400` naming `filters`. `PATCH` with the SAME `filters` value (or omitted) → `200`, no rejection.
7. **Duplicate name is rejected, scoped per owner.** `POST` two saved views with the identical `name` as the SAME owner → second is `400` naming `name`. `POST` the identical `name` as a DIFFERENT owner → `201`, both exist.
8. **`set_default`: the no-op rejection and the single-default guarantee.** `POST /api/saved-views/<id>/set-default/` `{"is_default": true}` on one of agent A's own views → `200`. Re-`POST` the same body → `400` (no-op). `POST` `{"is_default": true}` on a SECOND of agent A's own views → `200`, and `GET`ting the first now shows `"is_default": false` (verifies the atomic unset-then-set). `POST /api/saved-views/<shared id owned by someone else>/set-default/` `{"is_default": true}` → `403`, even though the view is visible via `GET`.
9. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as an agent with `tickets.manage`. On `/tickets`: apply a few filters, click "Save current view," name it, save — the switcher now shows it selected. Change a filter afterward — the switcher selection does NOT reset (starting point, not a lock). Click "Rename," change the name and toggle "Share with the team" on, save. Sign in as a second agent — the shared view appears in their switcher too; selecting it applies its filters; "Rename"/"Delete" are hidden for them (not the owner, and — if this second agent also holds `tickets.manage` under seed data — they WILL still see Rename/Delete, per the verified role reality in step 5; use a role without `tickets.manage` to see them truly hidden). Back as the owner: click "Set as default," reload `/tickets` — the saved view's filters are applied automatically on load, not `ORG-4`'s department/branch defaults. Delete the saved view — the switcher falls back to "Custom filters," the current (already-applied) filters are unchanged. Switch to Arabic — the switcher, dialog, and badges all read correctly in RTL.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `SavedView(TimeStampedModel)` in `apps/tickets/models.py` — `owner` (CASCADE), `name`, `is_shared`, `filters` (JSONField), `is_default`; `unique_saved_view_owner_name` and `unique_saved_view_owner_default` (partial) constraints.
- [ ] One migration: `CreateModel(SavedView)` with both constraints, depending on `0011_ticket_ticket_subject_trgm` and the user-model swappable dependency. **No grant migration.**
- [ ] `SavedViewSerializer` — `owner`/`is_default` read-only, `filters` in `immutable_fields`, `Meta.validators = []` with an explicit `validate()` duplicate-name check (the verified DRF-crash workaround).
- [ ] `SavedViewViewSet` — `permission_map` fully populated (`TICKETS_VIEW` throughout, no `TICKETS_MANAGE` entries — that gate is object-level); `get_queryset` filters to `owner=request.user OR is_shared=True`; `perform_update`/`perform_destroy` call `_check_editable` (owner or `tickets.manage`); `set_default` action (owner-only, no-op-rejecting, atomically exclusive).
- [ ] `apps/tickets/urls.py` — `saved-views` registered on the same `SimpleRouter` as `tickets`/`categories`.
- [ ] `apps/tickets/admin.py` — `SavedViewAdmin`, read-only-ops-visibility style.
- [ ] `features/tickets/types/savedView.ts`, `api/{getSavedViews,useSavedViews,createSavedView,updateSavedView,deleteSavedView,setDefaultSavedView,useSavedViewMutations}.ts` — new files, mirroring the `Category` file set.
- [ ] `SaveViewDialog.tsx` (new `Dialog` + `useAppForm` composition, save/rename modes) and `SavedViewBar.tsx` (switcher, save/rename/delete/set-default actions, owner-or-manager visibility as UX-only hints).
- [ ] `TicketListPage.tsx` — `filterParams` extracted and shared between `useTickets` and `SavedViewBar`; `applyFilters` reuses the existing per-field setters; the default-on-load effect (guarded, fires once, owner-scoped); the "selected view still exists" effect; `SavedViewBar` rendered above the filter row.
- [ ] `en.json`/`ar.json` — new `savedViews` namespace, identical key sets in both languages.
- [ ] `CONVENTIONS.md` § 23 gains the "owned and shareable at once" paragraph.
- [ ] `python manage.py test` passes; `makemigrations tickets --check --dry-run` reports no changes after migrating; `ruff format --check .`, `ruff check .` exit 0; `SavedViewSerializer()` instantiates without `AssertionError`.
- [ ] Verified by real HTTP: create/list/visibility (Step 5); `filters` immutability (Step 6); duplicate-name rejection, scoped per owner (Step 7); `set_default`'s no-op rejection and exclusivity (Step 8).
- [ ] The full bilingual UI walkthrough — save, rename, share, apply, set-default, delete, both languages (Step 9).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] `.squad/plans/ticket-management/00-overview.md` and `.squad/plans/00-index.md` updated with this story's row.
