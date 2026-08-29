# Story 52 — Audit Logs (Story: SUPPORTOS-74)

## Prerequisites

- **Story 48 (`SEC-1`) and Story 49 (`SEC-2`) completed and implemented.** `UserViewSet`/`RoleViewSet` (`backend/apps/accounts/views.py`), `UserAdminSerializer`/`RoleAdminSerializer` (`backend/apps/accounts/serializers.py`), and `Permissions.USERS_VIEW`/`USERS_MANAGE`/`ROLES_MANAGE` (`backend/apps/core/permissions.py:26-28`) are the exact surfaces this story instruments. No line in either viewset's `permission_map` changes — this story only adds a `perform_create`/`perform_update`/`destroy` side effect.
- **The epic is now numbered EPIC 14, not EPIC 13.** `SupportOs backlog.MD` (grepped this session) currently reads `# EPIC 14 — Security & Administration` at line 730 — `.squad/plans/security-administration/00-overview.md`'s own "Dependency notes" section (written during Story 48/49) still says "EPIC 13" and this story's own overview update corrects it (see `## Documentation Tasks`, task 8).
- **`.squad/plans/security-administration/00-overview.md`'s existing text names this story "Story 50" and SEC-4 "Story 51".** Both numbers were claimed by unrelated stories in the interim — Story 50 is `DSN-4` (Comprehensive Visual Redesign) and Story 51 is `DSN-5` (App Shell Redesign), both under `design-intelligence-ui-ux-system`, per `.squad/plans/00-index.md`'s current NN ranges. This story is the next global sequence number, verified by scanning `.squad/plans/**/NN-story-*.md` for the highest `NN` (51, `51-story-app-shell-sidebar-theme-SUPPORTOS-95.md`): **Story 52**. SEC-4's own number is not fixed here — it is planned whenever `/squad-plan` next runs for `SUPPORTOS-75`.
- **The reusable activity-log pattern is `TicketActivity`** (`backend/apps/tickets/models.py:113-166`, TKT-5/`SEC-3`'s own intake both name it), read in full this session. Its shape: `TimeStampedModel` base, `actor` (`SET_NULL`, nullable FK to `accounts.User` — an actor's account can vanish without breaking the log), a `Kind` `TextChoices` field, and a scalar `from_value`/`to_value` `CharField(max_length=150, blank=True)` pair snapshotting a before/after label. Entries are created **inline**, at the exact call site of the state change (`backend/apps/tickets/views.py:217-223`, inside `TicketViewSet`'s `set_status` action) — there is no signal, no generic diff-everything hook, no service-layer wrapper. This story reuses that shape and that creation mechanism, not a signal-based one.
- **`GenericForeignKey`/`ContentType` is a verified, explicit non-pattern in this codebase.** `django.contrib.contenttypes` is installed (`backend/config/settings/base.py:39`, Django's own default) but grepped as unused anywhere for a real relation. `backend/apps/notifications/models.py:35-36`'s own comment on `Notification.ticket`: *"Nullable: a plain FK to the one target type that exists today, not a `GenericForeignKey`."* `AuditLog` (this story) needs **two** target types at once (`User`, `Role`), not one — the direct, precedent-consistent generalization of "a plain FK, not `GenericForeignKey`" for two types is **two nullable FKs**, not a switch to `ContentType` machinery. See `## Story Goal` for the exact schema.
- **`backend/apps/README.md`'s own placement rule (`## Where new code goes`) resolves where `AuditLog` lives**, without inventing a new app: *"Belongs to exactly one business area → that app."* Today's only two target types, `User` and `Role`, both already live in `apps.accounts` — `accounts` "Owns: Users, profiles, credentials, sessions" per the app table (line 66). This is unlike `Notification`, which earned its own app because it is genuinely cross-cutting (event sources in `tickets`, `sla`, and — per Story 31's own `## Prerequisites`, read this session — future `agents`/`ai` consumers). `AuditLog` is not cross-app today: it lives in `apps/accounts/models.py`, its viewset in `apps/accounts/views.py`, its admin registration in `apps/accounts/admin.py`, its migrations in `apps/accounts/migrations/`. A future story auditing a different app's actions is free to add its own `*Activity`/`*Log` model in that app, the same way `TicketActivity` lives in `tickets` — not by widening this table into a shared cross-app one.
- **Verified: `UserViewSet` has no `perform_create`/`perform_update` override today** (`backend/apps/accounts/views.py:55-97`, read in full) — DRF's own `CreateModelMixin.perform_create`/`UpdateModelMixin.perform_update` (`serializer.save()`, nothing else) run unmodified. `RoleViewSet` (lines 100-134) has a `destroy` override (`is_system` guard) but no `perform_create`/`perform_update` override either. This story adds all four.
- **Verified: DRF's `serializer.save()` mutates `serializer.instance` in place** (the same instance `perform_update(self, serializer)` receives as `serializer.instance` *before* `.save()` is called) — capturing a field's value off `serializer.instance` immediately before calling `super().perform_update(serializer)`, then re-reading the same attribute immediately after, reliably captures the pre- and post-write values with no extra query. This is the mechanism task 2/3 below use to detect "did `role_id` change" / "did `permissions` change" without a second `SELECT`.
- **Verified: `Role.PROTECT`-on-delete for `User.role`** (`backend/apps/accounts/models.py:106-113`) means a role still held by any user cannot be deleted at all — Django raises `ProtectedError` before `RoleViewSet.destroy` ever reaches this story's new audit-log write. Only a role with zero users can be deleted, and `is_system` roles are already rejected one line earlier (`RoleViewSet.destroy`, line 132-133). No new guard is needed for this story's `ROLE_DELETED` entry to be safe: it is only ever created immediately before a delete that is already known to succeed.
- **Verified: the four seeded roles' current grants** (live-tested this session, Story 48/49's own accounts): `admin` = superuser (bypasses `permissions_for` entirely — `apps/core/permissions.py:53-56`), `manager` holds `users.view` plus grants from later feature migrations, `agent` holds none of `users.view`/`roles.manage`. `Permissions.ROLES_MANAGE` (the most comparable "sensitive, admin-only" capability today) is granted to the seeded `admin` role alone, per `backend/apps/accounts/migrations/0003_seed_roles.py:14-18`. This story's new `Permissions.AUDIT_LOG_VIEW` follows the identical grant: `admin` only (see `## Backend Tasks`, task 5) — a judgment call, not dictated by the intake, made because seeing *who changed what* in user/role administration is at least as sensitive as making the change itself.
- **Verified: global `DEFAULT_FILTER_BACKENDS`** (`backend/config/settings/base.py:242-245`) already registers `OrderingFilter` and `SearchFilter` project-wide — every `ordering_fields`/`search_fields` declaration on a `BaseModelViewSet` subclass (e.g. `UserViewSet`, `TicketViewSet`) works with no per-viewset `filter_backends` line. `AuditLogViewSet` (task 4) needs no new backend wiring for sort; only its own `get_queryset()` filter params (actor/action/target type/date range), mirroring `TicketViewSet.get_queryset`'s manual `query_params.get(...)` + `ValidationError` pattern (`backend/apps/tickets/views.py:95-135`, read in full this session) — this codebase does not use `django-filter`.
- **Verified: `python manage.py test` currently reports 54 passing** (run live this session). This story ships no test file (`CONVENTIONS.md` § 16, standing policy) and must not change that count.

---

## Story Goal

Give every SEC-1/SEC-2 write — user creation, a user's role reassignment, a user's active/inactive toggle, role creation, a role rename, a role's permission-set edit, and role deletion — an immutable, admin-only audit trail, viewable in a new filtered list screen. Nothing about `UserViewSet`'s or `RoleViewSet`'s existing `permission_map`, serializers' validation, or the frontend forms changes; this story only adds a side effect after each of those seven writes, plus a new read-only surface to see them.

### The `AuditLog` model

**File: `backend/apps/accounts/models.py`** — a new model appended at the end of the file, after `User`, so it can reference `User` and `Role` directly (no string forward-reference needed, unlike a cross-app FK).

```python
class AuditLog(TimeStampedModel):
    """An immutable, admin-facing audit trail of sensitive account/role
    changes — SEC-3's own reuse of TKT-5's "reusable activity-log pattern"
    (`TicketActivity`, apps/tickets/models.py:113-166), adapted for a target
    that can be either a `User` or a `Role` rather than always the same
    parent `Ticket`.

    Two nullable FKs (`target_user`/`target_role`), not a `GenericForeignKey`
    — `apps/notifications/models.py:35-36` already rejected `ContentType`
    machinery for a single target type ("a plain FK to the one target type
    that exists today, not a GenericForeignKey"). This table needs two
    target types at once, so it gets two plain FKs instead of introducing
    the one `GenericForeignKey` this codebase has never used anywhere.
    Exactly one of the two is populated per row — enforced by every call
    site in `UserViewSet`/`RoleViewSet` below, the only places a row is
    ever created; there is no model-level constraint, the same "trust the
    call site" posture `TicketActivity` itself takes for its own `kind`/
    `from_value`/`to_value` shape.

    `target_label` is a point-in-time snapshot of the target's display name
    — the same snapshot rationale `TicketActivity`'s `from_value`/`to_value`
    already establishes (`history.py`'s `build_history` reads
    `activity.actor.get_full_name()` live instead, because `actor` is never
    the thing being described). Here, the *target* is the thing being
    described, and it is exactly what `SET_NULL` can null out from under a
    live join (a deleted role, a — hypothetically — deleted user), so its
    display name must survive independently of the FK.

    `from_value`/`to_value` are `TextField`, not `TicketActivity`'s
    `CharField(max_length=150)` — the one structural deviation from that
    precedent. A role's permission-set change (task 3) stores a
    comma-joined list of permission strings in each, which can exceed 150
    characters as `ALL_PERMISSIONS` grows; a user's role/status change
    (tasks 1-2) never approaches that length either way.
    """

    class Action(models.TextChoices):
        USER_CREATED = "user_created", _("User created")
        USER_ROLE_CHANGED = "user_role_changed", _("User role changed")
        USER_STATUS_CHANGED = "user_status_changed", _("User status changed")
        ROLE_CREATED = "role_created", _("Role created")
        ROLE_RENAMED = "role_renamed", _("Role renamed")
        ROLE_PERMISSIONS_CHANGED = "role_permissions_changed", _("Role permissions changed")
        ROLE_DELETED = "role_deleted", _("Role deleted")

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name=_("actor"),
    )
    action = models.CharField(_("action"), max_length=30, choices=Action.choices)
    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs_as_target",
        verbose_name=_("target user"),
    )
    target_role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs_as_target",
        verbose_name=_("target role"),
    )
    target_label = models.CharField(_("target label"), max_length=150)
    from_value = models.TextField(_("from value"), blank=True)
    to_value = models.TextField(_("to value"), blank=True)

    class Meta:
        verbose_name = _("audit log entry")
        verbose_name_plural = _("audit log entries")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_action_display()} — {self.target_label}"
```

No new import beyond what `models.py` already has (`models`, `_`) — `User` and `Role` are defined earlier in the same file.

### Explicitly out of scope

- **No generic "audit anything" hook, signal, or middleware.** Every entry is an explicit `AuditLog.objects.create(...)` call at the exact point the meaningful change happens, mirroring `TicketActivity.objects.create(...)`'s own call site inside `TicketViewSet.set_status` — not a `post_save` signal that would fire (and need filtering) for every field on every save, including ones nobody asked to audit (e.g. a user's `first_name` edit).
- **No audit entry for `first_name`/`last_name`/`email`/`description` edits.** The intake asks for "sensitive actions" — this story's reading of that phrase (consistent with `AUTHZ`'s own vocabulary) is *identity/access* changes: who exists, what they're allowed to do, and whether they can log in. A cosmetic profile edit is not access-relevant.
- **No audit entry for login/logout.** `LoginView`/`LogoutView` (`apps/accounts/views.py`) are untouched — session-level events, not `AUTHZ`-relevant admin actions, and the intake's "reuses activity-log pattern" reference point (`TicketActivity`) does not log message sends either, for the same "already recorded elsewhere or out of scope" reasoning (`TicketActivity`'s own docstring: replies are `Message`'s job, not `TicketActivity`'s).
- **No merged feed with another log source.** `apps/tickets/history.py::build_history` merges `TicketActivity` with `Message` because a ticket's *complete* story includes both; there is no equivalent second source for user/role administration — the viewer (task 6) is `AuditLog` alone.
- **No retention/archival policy.** Not asked for; every prior story with an unbounded-growth table (`Notification`, `TicketActivity`) ships with none either.
- **Any change to `UserViewSet`'s or `RoleViewSet`'s `permission_map`, or either serializer's validation.** Both are already correct and untouched by this story — only `perform_create`/`perform_update`/`destroy` gain a side effect.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-74/intake.md` — one task block, no attachments, no acceptance criteria. Done Criteria derive from *"Audit-log service + viewer 🔑 (reuses activity-log pattern) — Implement immutable logging of sensitive actions + filtered viewer"* and *"Outcome: traceability."*
2. `backend/apps/tickets/models.py:113-166` (`TicketActivity`, read in full this session) — the literal pattern this story reuses: `TimeStampedModel` base, `SET_NULL` actor, a `TextChoices` kind field, scalar from/to snapshot fields, `ordering = ("-created_at",)`.
3. `backend/apps/tickets/views.py:209-224` (`TicketViewSet.set_status`) — the exact inline-`.objects.create()`-at-the-call-site creation mechanism tasks 1-3 below copy, including capturing the "old" value into a local variable before mutating the row.
4. `backend/apps/notifications/models.py:30-40` (`Notification.ticket`, read in full this session) — the explicit, cited rejection of `GenericForeignKey`/`ContentType` this story's two-FK design directly generalizes.
5. `backend/apps/accounts/models.py` (full file, 134 lines, read this session) — `Role` (41-87, especially `clean()`'s `ALL_PERMISSIONS` validation, 69-86) and `User` (89-134, especially `role`'s `PROTECT`, 106-113, and `get_full_name`, 128-130). Task 0 appends `AuditLog` after `User`.
6. `backend/apps/accounts/views.py` (full file, 135 lines, read this session) — `UserViewSet` (55-97) and `RoleViewSet` (100-134), the exact classes tasks 1-3 extend. Confirm before starting: neither has a `perform_create`/`perform_update` override today (verified, see `## Prerequisites`).
7. `backend/apps/accounts/serializers.py` — `UserAdminSerializer` (96-158) and `RoleAdminSerializer` (20-70), unchanged by this story; read only to confirm `serializer.instance`'s field names (`role_id`/`is_active` on `User`, `name`/`permissions` on `Role`) match what tasks 1-3 read off it.
8. `backend/apps/core/permissions.py` (full file, 138 lines) — `Permissions` (18-35, ten constants today; task 5 appends an eleventh), `ALL_PERMISSIONS` (38-42), `HasPermission`/`_required_permission` (63-137, especially the "an action absent from `permission_map` is authenticated-only, not forbidden" rule task 4's `http_method_names` override is designed around).
9. `backend/apps/accounts/migrations/0003_seed_roles.py` (full file, read this session) — the seed data (`admin`/`manager`/`agent` with their starting `permissions` lists) and, more importantly, `backend/apps/tickets/migrations/0002_grant_ticket_permissions.py` (full file, read this session) — the exact `GRANTS = {slug: [permissions]}` + `role.permissions = sorted(set(...) | set(...))` grant-migration pattern task 6's new migration copies verbatim, scoped to `{"admin": [Permissions.AUDIT_LOG_VIEW]}`.
10. `backend/apps/accounts/admin_urls.py` (full file, 14 lines) — the `SimpleRouter` registering `users`/`roles`; task 4 adds one more `router.register(...)` line, same file.
11. `backend/apps/accounts/admin.py` (full file, 91 lines, read this session) — `RoleAdmin`/`UserAdmin`'s existing shape; task 7 appends an `AuditLogAdmin` in the same style (`list_display`, `list_filter`, `readonly_fields` — but here, **every** field is read-only, since the whole model is immutable).
12. `frontend/src/features/accounts/components/UserListPage.tsx` (full file, 124 lines, read this session) — the base `PageHeader` + `Input` search + `DataTable` shape task 10's `AuditLogListPage` copies, minus the "New" action button (this list has none — there is nothing to create from the UI).
13. `frontend/src/features/tickets/components/TicketListPage.tsx` (full file, 210 lines, read this session) — the `Select`-based filter-dropdown-plus-`useEffect`-page-reset pattern (lines 44-74, 152-190) task 10 copies for the actor/action/target-type filters, including the `"all"` sentinel convention for "no filter" (Radix `Select.Item` cannot take an empty-string `value`).
14. `frontend/src/shared/ui/data-table/useServerTable.ts` (full file, 42 lines) and `frontend/src/features/accounts/api/getUsers.ts`/`userKeys.ts`/`useUsers.ts` (all three, read this session) — the exact `ServerTableParams`/`featureKey`/`useQuery` wiring task 9's `getAuditLogs.ts`/`auditLogKeys.ts`/`useAuditLogs.ts` copy.
15. `frontend/src/shared/ui/PageHeader.tsx` (full file, 21 lines) and `frontend/src/shared/ui/Empty.tsx` (full file, 37 lines) — task 10 uses `PageHeader` with no `action` prop (nothing to create) and a plain `<Empty title=.../>` (no custom icon needed — a filtered-to-nothing audit log is not a distinct enough state to warrant one, unlike Story 50's semantic-icon empties).
16. `frontend/src/app/router.tsx` (full file, 419 lines, read this session) — the `RequirePermission permission="roles.manage"` block (254-282) is the direct sibling task 11's new `audit_log.view`-gated block is added next to.
17. `frontend/src/app/Sidebar.tsx` (full file, 211 lines, read this session — this is the file this session's own prior turn just fixed footer spacing on) — the `<Can permission="roles.manage">` `SidebarLink` (172-179) is the direct sibling task 12 adds a new link next to. `lucide-react` imports are alphabetical (2-15); `HistoryIcon` inserts between `FileTextIcon` and `InboxIcon`.
18. `frontend/src/shared/i18n/resources.ts` (full file, 75 lines) — the explicit two-import-plus-two-map-entries-per-feature registration pattern task 14 follows for the new `auditLog` namespace.
19. `CONVENTIONS.md` § 22 (Authorization) and § 23 (Feature module conventions) — read both before task 15; § 22's existing "vocabulary is code, mapping is data" framing and § 23's per-feature-locale-namespace convention both apply unchanged, no new mechanism.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Immutable logging of sensitive actions.** | Intake | `AuditLog` rows are created by `perform_create`/`perform_update`/`destroy` overrides only; `AuditLogViewSet.http_method_names` hard-disables every write verb (task 4) — not merely an unmapped `permission_map` entry, an actual 405. |
| **Reuses activity-log pattern.** | Intake, epic description | `AuditLog`'s shape (`TimeStampedModel`, `SET_NULL` actor, `TextChoices` action, from/to snapshot pair, `-created_at` ordering) and creation mechanism (inline `.objects.create()` at the call site) both copy `TicketActivity` (TKT-5) directly — see `## Story Goal`. |
| **Filtered viewer.** | Intake | `AuditLogViewSet.get_queryset()` supports `actor`, `action`, `target_type`, `date_from`, `date_to` query params (task 4); `AuditLogListPage` exposes all five as UI controls (task 10). |
| **Outcome: traceability.** | Intake | Every one of the seven `AuditLog.Action` values names *who* (`actor`), *what* (`action` + `target_label`), *when* (`created_at`), and *the before/after* (`from_value`/`to_value`) for a sensitive `AUTHZ` change. |
| **The backend owns authorization; the frontend check is UX only.** | § 12, § 22 | The viewer is reachable only via the `audit_log.view`-gated `/audit-log` route (task 11); `AuditLogViewSet.permission_map` independently re-authorizes every request. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 0 — The `AuditLog` model

**File: `backend/apps/accounts/models.py`** — append the full `AuditLog` class from `## Story Goal` at the end of the file, after `User`.

---

### 1 — Audit `UserViewSet`'s writes

**File: `backend/apps/accounts/views.py`** — add two method overrides to `UserViewSet`, and extend its import line.

```python
from .models import AuditLog, Role
```

```python
    def perform_create(self, serializer):
        super().perform_create(serializer)
        user = serializer.instance
        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.USER_CREATED,
            target_user=user,
            target_label=user.get_full_name(),
        )

    def perform_update(self, serializer):
        user = serializer.instance
        old_role_id = user.role_id
        old_role_name = user.role.name if old_role_id else ""
        old_is_active = user.is_active
        super().perform_update(serializer)

        if user.role_id != old_role_id:
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.USER_ROLE_CHANGED,
                target_user=user,
                target_label=user.get_full_name(),
                from_value=old_role_name,
                to_value=user.role.name if user.role_id else "",
            )
        if user.is_active != old_is_active:
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.USER_STATUS_CHANGED,
                target_user=user,
                target_label=user.get_full_name(),
                from_value=_("Active") if old_is_active else _("Inactive"),
                to_value=_("Active") if user.is_active else _("Inactive"),
            )
```

`self.request.user` is never anonymous here — `BaseModelViewSet.permission_classes` already requires `IsAuthenticated` for every action, so no `is_authenticated`/`None` guard is needed (unlike `AuditLog.actor`'s own nullability, which exists for the read side: an actor's account can be deleted *after* the entry is written, not at write time).

`old_role_name = user.role.name if old_role_id else ""` reads `user.role` (a cached/lazy FK access) **before** `super().perform_update(serializer)` mutates `user.role_id` in place — this is the verified-safe "capture off `serializer.instance` before `.save()`" mechanism from `## Prerequisites`.

---

### 2 — Audit `RoleViewSet`'s create/update

**File: `backend/apps/accounts/views.py`** — add two method overrides to `RoleViewSet` (above its existing `destroy` override).

```python
    def perform_create(self, serializer):
        super().perform_create(serializer)
        role = serializer.instance
        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.ROLE_CREATED,
            target_role=role,
            target_label=role.name,
        )

    def perform_update(self, serializer):
        role = serializer.instance
        old_name = role.name
        old_permissions = list(role.permissions)
        super().perform_update(serializer)

        if role.name != old_name:
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.ROLE_RENAMED,
                target_role=role,
                target_label=role.name,
                from_value=old_name,
                to_value=role.name,
            )
        if set(role.permissions) != set(old_permissions):
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.ROLE_PERMISSIONS_CHANGED,
                target_role=role,
                target_label=role.name,
                from_value=", ".join(sorted(old_permissions)),
                to_value=", ".join(sorted(role.permissions)),
            )
```

`old_permissions = list(role.permissions)` copies the JSON list before `.save()` overwrites the same Python list object in place — a plain `old_permissions = role.permissions` would alias the same list `serializer.save()` then mutates, making the "before" comparison meaningless. This is the one place this pattern needs a defensive copy that `old_role_id`/`old_name` (scalars) do not.

---

### 3 — Audit `RoleViewSet.destroy`

**File: `backend/apps/accounts/views.py`** — extend the existing `destroy` override (currently lines 126-134) with the new audit write, placed *before* the actual delete:

```python
    def destroy(self, request, *args, **kwargs):
        """Mirrors `RoleAdmin.has_delete_permission` (apps/accounts/admin.py:42-45)
        for the API path — a system role must not be deletable from here
        either. Logs the deletion before it happens: `target_role`'s
        `on_delete=SET_NULL` means the just-created `AuditLog` row's own
        `target_role` is nulled out the instant `super().destroy()` runs,
        the same way any other `AuditLog` row survives its target's later
        deletion — `target_label` is what keeps the entry meaningful either
        way.
        """
        role = self.get_object()
        if role.is_system:
            raise ValidationError({"non_field_errors": [_("System roles cannot be deleted.")]})
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.ROLE_DELETED,
            target_role=role,
            target_label=role.name,
        )
        return super().destroy(request, *args, **kwargs)
```

Only the docstring and the one `AuditLog.objects.create(...)` call (before `return super().destroy(...)`) are new; the `is_system` check is unchanged.

---

### 4 — The read-only, filtered `AuditLogViewSet`

**File: `backend/apps/accounts/views.py`** — add a new serializer import and a new viewset, placed after `RoleViewSet`.

```python
from django.utils.dateparse import parse_date
```

```python
class AuditLogViewSet(BaseModelViewSet):
    """The read-only viewer over `AuditLog` — SEC-3's "filtered viewer".
    `http_method_names` drops every unsafe verb entirely, the same
    `UserViewSet` precedent (Story 48) for actively disabling an action
    rather than leaving it unmapped: an omitted `permission_map` entry is
    merely authenticated-only (`HasPermission`'s grant-on-omission rule),
    which would be the wrong default for a table the intake calls
    "immutable". POST/PUT/PATCH/DELETE now 405 at Django's own dispatch
    level, before `HasPermission` is ever consulted.
    """

    http_method_names = ["get", "head", "options"]
    queryset = AuditLog.objects.select_related("actor", "target_user", "target_role").all()
    serializer_class = AuditLogSerializer

    permission_map = {
        "list": Permissions.AUDIT_LOG_VIEW,
        "retrieve": Permissions.AUDIT_LOG_VIEW,
    }

    ordering_fields = ("created_at", "action")
    search_fields = ("target_label",)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        params = self.request.query_params

        actor_id = params.get("actor")
        if actor_id:
            try:
                actor_id = int(actor_id)
            except ValueError:
                raise ValidationError({"actor": [_("Must be a valid user id.")]}) from None
            queryset = queryset.filter(actor_id=actor_id)

        action_filter = params.get("action")
        if action_filter:
            if action_filter not in AuditLog.Action.values:
                raise ValidationError({"action": [_("Must be a valid action.")]})
            queryset = queryset.filter(action=action_filter)

        target_type = params.get("target_type")
        if target_type:
            if target_type == "user":
                queryset = queryset.filter(target_user__isnull=False)
            elif target_type == "role":
                queryset = queryset.filter(target_role__isnull=False)
            else:
                raise ValidationError({"target_type": [_('Must be "user" or "role".')]})

        date_from = params.get("date_from")
        if date_from:
            parsed = parse_date(date_from)
            if parsed is None:
                raise ValidationError({"date_from": [_("Must be a valid date (YYYY-MM-DD).")]})
            queryset = queryset.filter(created_at__date__gte=parsed)

        date_to = params.get("date_to")
        if date_to:
            parsed = parse_date(date_to)
            if parsed is None:
                raise ValidationError({"date_to": [_("Must be a valid date (YYYY-MM-DD).")]})
            queryset = queryset.filter(created_at__date__lte=parsed)

        return queryset
```

This mirrors `TicketViewSet.get_queryset` (`apps/tickets/views.py:95-135`) exactly: guard on `self.action != "list"`, one `if params.get(...)` block per filter, `ValidationError` on a malformed (not merely absent) value, `queryset.filter(...)` appended each time.

**File: `backend/apps/accounts/admin_urls.py`** — one new `router.register(...)` line:

```python
from .views import AuditLogViewSet, RoleViewSet, UserViewSet

router = SimpleRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("audit-logs", AuditLogViewSet, basename="auditlog")
```

Endpoint: `GET /api/audit-logs/`, `GET /api/audit-logs/<id>/`.

---

### 5 — `Permissions.AUDIT_LOG_VIEW`

**File: `backend/apps/core/permissions.py`** — one new constant, appended after `PORTAL_ACCESS` (line 35), per the file's own *"every feature story appends its own"* rule (docstring, lines 11-12):

```python
    PORTAL_ACCESS = "portal.access"
    AUDIT_LOG_VIEW = "audit_log.view"
```

`ALL_PERMISSIONS` (lines 38-42) needs no edit — it derives from `vars(Permissions)` by reflection, so the new constant is picked up automatically.

---

### 6 — The `AuditLog` serializer

**File: `backend/apps/accounts/serializers.py`** — one new serializer, appended after `RoleAdminSerializer`, plus one import extension.

```python
from .models import AuditLog, Role
```

```python
class AuditLogSerializer(BaseModelSerializer):
    """Read-only — `AuditLogViewSet` has no write action for this to ever
    validate. `actor_name` uses the same verified-safe dotted-`source`
    pattern as `TicketSerializer.assigned_agent_name`
    (apps/tickets/serializers.py:33-35): `get_full_name` is a method, not a
    field, and DRF's `get_attribute` calls it; `allow_null=True` returns
    `None` instead of erroring when `actor` is `None` (a deleted actor).
    `target_label` is the snapshot field, not a dotted source on
    `target_user`/`target_role` — see `AuditLog`'s own docstring for why the
    snapshot exists.
    """

    actor_name = serializers.CharField(
        source="actor.get_full_name", read_only=True, allow_null=True
    )
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_name",
            "action",
            "action_display",
            "target_user",
            "target_role",
            "target_label",
            "from_value",
            "to_value",
            "created_at",
        )
```

`BaseModelSerializer.Meta.read_only_fields = ("id", "created_at", "updated_at")` is inherited unchanged; `updated_at` is not in `fields` (mirrors `TicketActivityAdmin`'s own `readonly_fields` including a Meta-inherited `updated_at` that a `TimeStampedModel` row never actually updates after creation — harmless, not a new pattern).

---

### 7 — Django admin registration

**File: `backend/apps/accounts/admin.py`** — one new registration, appended after `UserAdmin`, plus an import extension:

```python
from .models import AuditLog, Role, User
```

```python
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """The Django-admin fallback view over `AuditLog`, mirroring
    `TicketActivityAdmin` (apps/tickets/admin.py:44-49) — same
    `list_display`/`list_filter`/`search_fields` shape, adapted for two
    possible targets instead of one. Every field is read-only: the table is
    immutable end to end, including from this screen — there is no
    `has_add_permission`/`has_change_permission` override needed because
    `readonly_fields` covering every field already makes the change form
    display-only, and no create button exists without at least one
    non-readonly field for Django to render a form around.
    """

    list_display = ("action", "actor", "target_label", "created_at")
    list_filter = ("action",)
    search_fields = ("target_label",)
    readonly_fields = (
        "actor",
        "action",
        "target_user",
        "target_role",
        "target_label",
        "from_value",
        "to_value",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
```

`has_add_permission`/`has_delete_permission` overrides ARE still needed despite the all-`readonly_fields` list — `readonly_fields` alone does not remove the admin's "Add" button or a row's delete action, only its edit form's field widgets.

---

## Migration / Rollback

**Two migrations, both in `backend/apps/accounts/migrations/`, following the schema-then-grant split `apps/tickets/migrations/0001_initial.py` → `0002_grant_ticket_permissions.py` already establishes across app boundaries** (here, within the same app, since `AuditLog` and its grant are both accounts-owned).

**`0005_auditlog.py`** (schema) — generated via `python manage.py makemigrations accounts`, depends on `("accounts", "0004_seed_customer_role")`. Verify the generated migration's `CreateModel` matches task 0's field list exactly (in particular, both `target_user`/`target_role` as `on_delete=models.SET_NULL`, `null=True`) before treating it as final — do not hand-write it; Django's migration autodetector is authoritative for the exact field/index SQL.

**`0006_grant_audit_log_permission.py`** (data) — hand-written, copying `apps/tickets/migrations/0002_grant_ticket_permissions.py` verbatim with a narrower `GRANTS`:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: seeing who changed a user's role/status or a role's
# permissions is at least as sensitive as making that change, which
# `Permissions.ROLES_MANAGE` already restricts to `admin` alone
# (0003_seed_roles.py). See the plan's `## Prerequisites`.
GRANTS = {
    "admin": [Permissions.AUDIT_LOG_VIEW],
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
        ("accounts", "0005_auditlog"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

**Rollback of the code:** revert the commits, then `python manage.py migrate accounts 0004_seed_customer_role` to unwind both new migrations (the data migration's `revoke` runs first, then the schema migration drops the table). No `npm install`/`pip install` — no new dependency.

**Half-applied states to avoid:**

- **Tasks 1-3 (viewset audit writes) before task 0 (the model)** → `ImportError` on `AuditLog` at Django startup. Not a real risk in a single implementation pass, listed for completeness.
- **Task 4 (`AuditLogViewSet`) before task 6 (the serializer)** → `NameError` on `AuditLogSerializer`. Same as above.
- **Task 4/`admin_urls.py` registration before the migration is applied** → `AuditLogViewSet.queryset = AuditLog.objects.all()` at class-definition time does not hit the database (Django QuerySets are lazy), so this ordering is actually safe; only *running* the server or a request against `/api/audit-logs/` before migrating would fail with `ProgrammingError: relation does not exist`. Migrate before starting the dev server.
- **The grant migration (0006) before the schema migration (0005) is applied** → `0006` only touches `accounts_role.permissions` (unrelated table), so it cannot fail on a missing `AuditLog` table — but its `dependencies` entry enforces the correct order regardless, so this is not reachable.

---

## Frontend Tasks

### 8 — Feature folder and types

**Create directory: `frontend/src/features/audit-log/`** — a new feature (not folded into `features/accounts/`), because its list page needs no data from `features/accounts` at all: the backend serializer (task 6) already flattens `actor_name`/`target_label` to plain strings, so there is nothing to import across the feature boundary (`no-restricted-imports`, `frontend/.oxlintrc.json:8-18`) in the first place.

**Create file: `frontend/src/features/audit-log/types/auditLog.ts`**

```ts
/** Mirrors `apps.accounts.models.AuditLog.Action` values. */
export const AUDIT_LOG_ACTIONS = [
  'user_created',
  'user_role_changed',
  'user_status_changed',
  'role_created',
  'role_renamed',
  'role_permissions_changed',
  'role_deleted',
] as const

export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number]

/** Mirrors `apps.accounts.serializers.AuditLogSerializer`'s read shape. */
export type AuditLog = {
  id: number
  actor: number | null
  actor_name: string | null
  action: AuditLogAction
  action_display: string
  target_user: number | null
  target_role: number | null
  target_label: string
  from_value: string
  to_value: string
  created_at: string
}
```

---

### 9 — API hooks

**Create file: `frontend/src/features/audit-log/api/auditLogKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const auditLogKeys = featureKey('auditLogs')
```

**Create file: `frontend/src/features/audit-log/api/getAuditLogs.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { AuditLog, AuditLogAction } from '../types/auditLog'

export type AuditLogListParams = ServerTableParams & {
  actor?: number
  action?: AuditLogAction
  target_type?: 'user' | 'role'
  date_from?: string
  date_to?: string
}

export function getAuditLogs(params: AuditLogListParams): Promise<Page<AuditLog>> {
  return api.getPage<AuditLog>('/audit-logs/', { params })
}
```

**Create file: `frontend/src/features/audit-log/api/useAuditLogs.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getAuditLogs } from './getAuditLogs'
import type { AuditLogListParams } from './getAuditLogs'
import { auditLogKeys } from './auditLogKeys'

export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: auditLogKeys.resource('list', params),
    queryFn: () => getAuditLogs(params),
  })
}
```

Copies `frontend/src/features/accounts/api/{userKeys,getUsers,useUsers}.ts` exactly, one file each.

---

### 10 — `AuditLogListPage`

**Create file: `frontend/src/features/audit-log/components/AuditLogListPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useAuditLogs } from '../api/useAuditLogs'
import { AUDIT_LOG_ACTIONS } from '../types/auditLog'
import type { AuditLog, AuditLogAction } from '../types/auditLog'

/**
 * The audit-log viewer — SEC-3's "filtered viewer". No `PageHeader` action
 * (nothing to create from this screen) and no search input (`target_label`
 * search is not asked for by the intake; the four dropdown filters plus
 * date range are). Copies `TicketListPage`'s Select-filter-plus-page-reset
 * shape (Story 12, `## Context`) rather than `UserListPage`'s search-only
 * shape (Story 48), since this screen's filtering need is closer to
 * ticket's multi-dimension filter set than to a plain name/email search.
 */
export function AuditLogListPage() {
  const { t } = useTranslation('auditLog')
  const { dateTime } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  // "all" is the sentinel for "no filter" — Radix's Select.Item requires a
  // non-empty value, mirroring TicketListPage's identical convention.
  const [actionFilter, setActionFilter] = useState('all')
  const [targetTypeFilter, setTargetTypeFilter] = useState('all')

  useEffect(() => {
    setPage(1)
  }, [actionFilter, targetTypeFilter, setPage])

  const query = useAuditLogs({
    ...params,
    ...(actionFilter !== 'all' ? { action: actionFilter as AuditLogAction } : {}),
    ...(targetTypeFilter !== 'all'
      ? { target_type: targetTypeFilter as 'user' | 'role' }
      : {}),
  })

  const columns: readonly ColumnDef<AuditLog>[] = [
    {
      id: 'created_at',
      header: t('fields.when'),
      sortable: true,
      cell: (row) => dateTime(row.created_at),
    },
    {
      id: 'actor_name',
      header: t('fields.actor'),
      cell: (row) => row.actor_name ?? t('deletedActor'),
    },
    {
      id: 'action',
      header: t('fields.action'),
      sortable: true,
      cell: (row) => row.action_display,
    },
    {
      id: 'target_label',
      header: t('fields.target'),
      cell: (row) => row.target_label,
    },
    {
      id: 'change',
      header: t('fields.change'),
      cell: (row) =>
        row.from_value || row.to_value ? `${row.from_value} → ${row.to_value}` : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger aria-label={t('filters.action')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allActions')}</SelectItem>
            {AUDIT_LOG_ACTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`actions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
          <SelectTrigger aria-label={t('filters.targetType')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTargetTypes')}</SelectItem>
            <SelectItem value="user">{t('filters.targetTypeUser')}</SelectItem>
            <SelectItem value="role">{t('filters.targetTypeRole')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('title')}
        empty={<Empty title={t('empty')} description={t('emptyDescription')} />}
      />
    </div>
  )
}
```

**Verify `useFormatters` exposes a `dateTime` (date + time) formatter, not only `date`** (`TicketListPage` only ever calls `date(...)`, since a ticket's creation date alone is enough context there — this screen's rows can be minutes apart on the same day, so the time component matters). Read `frontend/src/shared/hooks/useFormatters.ts` before writing this task; if only `date` exists, add a `dateTime` formatter there following the same `Intl.DateTimeFormat`-per-locale pattern the existing `date` formatter uses, rather than formatting inline in this one component.

---

### 11 — Route

**File: `frontend/src/app/router.tsx`** — one new `RequirePermission` block, added as a sibling immediately after the `roles.manage` block (lines 253-282):

```tsx
          {
            element: <RequirePermission permission="audit_log.view" />,
            children: [
              {
                path: 'audit-log',
                lazy: async () => {
                  const { AuditLogListPage } =
                    await import('@/features/audit-log/components/AuditLogListPage')
                  return { element: <AuditLogListPage /> }
                },
              },
            ],
          },
```

No `:id` sub-route — the viewer is list-only; a `retrieve` endpoint exists (task 4) for API completeness (matching every other `BaseModelViewSet` subclass) but nothing in the UI links to a single entry's own page.

---

### 12 — Sidebar nav entry

**File: `frontend/src/app/Sidebar.tsx`** — add `HistoryIcon` to the `lucide-react` import (alphabetically, between `FileTextIcon` and `InboxIcon`):

```tsx
import {
  BookOpenIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ContactIcon,
  FileTextIcon,
  HistoryIcon,
  InboxIcon,
  ListTodoIcon,
  LogOutIcon,
  SearchIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserCogIcon,
} from 'lucide-react'
```

Add `'auditLog'` to the `useTranslation([...])` namespace array (currently `['common', 'customers', 'tickets', 'tasks', 'knowledgeBase', 'accounts']`), and add a new `<Can>` block immediately after the existing `roles.manage` one (lines 172-179):

```tsx
        <Can permission="roles.manage">
          <SidebarLink
            to="/roles"
            icon={ShieldCheckIcon}
            label={t('accounts:roles.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="audit_log.view">
          <SidebarLink
            to="/audit-log"
            icon={HistoryIcon}
            label={t('auditLog:title')}
            collapsed={collapsed}
          />
        </Can>
```

---

### 13 — Locale files

**Create file: `frontend/src/features/audit-log/locales/en.json`**

```json
{
  "title": "Audit Log",
  "empty": "No audit log entries yet",
  "emptyDescription": "Sensitive user and role changes will appear here.",
  "deletedActor": "Deleted user",
  "fields": {
    "when": "When",
    "actor": "Actor",
    "action": "Action",
    "target": "Target",
    "change": "Change"
  },
  "filters": {
    "action": "Filter by action",
    "allActions": "All actions",
    "targetType": "Filter by target type",
    "allTargetTypes": "All targets",
    "targetTypeUser": "Users",
    "targetTypeRole": "Roles"
  },
  "actions": {
    "user_created": "User created",
    "user_role_changed": "User role changed",
    "user_status_changed": "User status changed",
    "role_created": "Role created",
    "role_renamed": "Role renamed",
    "role_permissions_changed": "Role permissions changed",
    "role_deleted": "Role deleted"
  }
}
```

**Create file: `frontend/src/features/audit-log/locales/ar.json`** — the same key set, translated into Arabic (mirroring `frontend/src/features/accounts/locales/ar.json`'s existing translation style and tone for `users`/`roles`).

---

### 14 — Register the new locale namespace

**File: `frontend/src/shared/i18n/resources.ts`** — two new imports (alphabetically, between `auth` and `customers`) and two new map entries (in the same relative position as the imports, matching every existing feature's placement):

```ts
import auditLogAr from '@/features/audit-log/locales/ar.json'
import auditLogEn from '@/features/audit-log/locales/en.json'
```

```ts
  en: {
    common: enCommon,
    errors: enErrors,
    validation: enValidation,
    health: healthEn,
    auth: authEn,
    auditLog: auditLogEn,
    accounts: accountsEn,
    ...
  },
  ar: {
    ...
    auth: authAr,
    auditLog: auditLogAr,
    accounts: accountsAr,
    ...
  },
```

---

## Documentation Tasks

### 15 — `CONVENTIONS.md` § 22

Append one entry after § 22's existing content, documenting the two-FK target-reference pattern as a worked example for the next feature that needs to reference more than one target type:

```markdown
**A row that must reference one of several target types uses one nullable
FK per type, not a `GenericForeignKey`.** `AuditLog` (Story 52, `SEC-3`)
needs to point at either a `User` or a `Role`. `apps/notifications
/models.py`'s own precedent already established "a plain FK to the one
target type that exists today, not a `GenericForeignKey`" for a
single-target case (`Notification.ticket`); `AuditLog.target_user`/
`target_role` is the direct generalization of that same reasoning to two
target types — two plain, independently nullable FKs, exactly one
populated per row, rather than introducing the one `GenericForeignKey`/
`ContentType` relation this codebase has never used. A `target_label`
snapshot field (mirroring `TicketActivity`'s own from/to snapshot
rationale) keeps the row meaningful after `SET_NULL` fires on either FK.
```

Do not renumber § 0-§ 26.

### 16 — `backend/apps/README.md`

No edit needed — `AuditLog`'s placement inside `apps/accounts` follows the existing "belongs to exactly one business area" rule with no exception or addition to record; the "Where new code goes" checklist already covers this case exactly as written.

---

## Edge Cases & Failure Modes

- **A user's `role_id` and `is_active` can both change in the same `PATCH`.** `perform_update` (task 1) checks both independently and writes up to two separate `AuditLog` rows for one request — the same "one row per meaningfully changed field" granularity `TicketActivity` itself has no equivalent multi-field case to test, but this story's own design commits to it (mirrors `RoleViewSet.perform_update`'s identical two-row possibility for `name`+`permissions`).
- **A `PATCH` that changes neither `role` nor `is_active`** (e.g. only `first_name`) — no `AuditLog` row is created at all. This is correct, not a gap: see `## Story Goal`'s "Explicitly out of scope."
- **Removing every permission from a role (`permissions: []`)** — `set(role.permissions) != set(old_permissions)` still detects this correctly (`set() != {"a", "b"}` is `True`); `to_value` renders as an empty string via `", ".join(sorted([]))`. The UI's "Change" column (task 10) renders `"old values → "` in this case — acceptable, not a rendering bug, since an empty `to_value` is exactly the true value.
- **A role held by zero users can be deleted even if it is not `is_system`** — `RoleViewSet.destroy` (task 3) logs `ROLE_DELETED` immediately before the delete succeeds; if `Role.PROTECT` were to raise `ProtectedError` instead (a role still held by a user), Django's `ProtectedError` is not caught by `RoleViewSet.destroy` today (pre-existing, unrelated-to-this-story behavior — the same gap existed before this story and is not fixed here) and would surface as an unhandled 500 **before** reaching the new `AuditLog.objects.create(...)` call, since `get_object()` succeeds but the actual delete inside `super().destroy()` is what raises. Not introduced by this story; not fixed by it either — out of scope.
- **`AuditLogViewSet.retrieve` exists but nothing in the UI links to it.** A `GET /api/audit-logs/<id>/` still works (for API completeness/consistency with every other `BaseModelViewSet` subclass) and is gated by the same `AUDIT_LOG_VIEW` permission as `list`.
- **An actor's account is later deleted.** `AuditLog.actor` is `SET_NULL`; `actor_name` (task 6's serializer) renders `None`, and the frontend (task 10) shows `t('deletedActor')` ("Deleted user") instead of a blank cell — mirrors `TicketSerializer.assigned_agent_name`'s own `allow_null=True` contract, just with an explicit UI fallback string where `TicketListPage` uses `t('fields.unassigned')` for the analogous case.
- **`date_from`/`date_to` filters use `created_at__date__gte`/`__lte` (a date, not a datetime, comparison)** — a `date_to` of today includes every entry created today regardless of time-of-day, the intuitive "through the end of this day" reading a bare date-range picker implies, rather than a datetime cutoff at midnight that would silently exclude today's own entries.
- **The permissions-list `from_value`/`to_value` strings could theoretically still be very long** (`ALL_PERMISSIONS` growing well past today's eleven entries) — `TextField` has no length cap, unlike `TicketActivity`'s `CharField(150)`, so this does not become a truncation bug as the permission vocabulary grows. See `AuditLog`'s own docstring.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check`, `python manage.py makemigrations --check --dry-run` (confirms task 0's model change is fully captured by the two new migrations, no drift), `python manage.py migrate`.
2. `python manage.py test` reports **54** passing — unchanged; this story ships no test file and no change to any existing tested behavior.
3. `ruff format --check .` / `ruff check .` on the changed Python.
4. `npm run build` — typechecks the new `AuditLog`/`AuditLogAction` types, `AuditLogListParams`, and `AuditLogListPage`'s `ColumnDef<AuditLog>[]`.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison, extended to cover the new `auditLog` namespace.
7. Real HTTP, using the accounts from prior verification (`admin@supportos.local` — superuser — and `mgr@supportos.local`/`agent@supportos.local`, neither of whom holds `roles.manage` or, after this story, `audit_log.view`):
   - Create a user, reassign a user's role, toggle a user's `is_active`, create a role, rename a role, edit a role's permissions, delete a non-system role with no users — as `admin@`/a superuser — and confirm each produces exactly the expected `AuditLog` row(s) via `GET /api/audit-logs/`.
   - Confirm the permission gate table (`GET /api/audit-logs/` with no token → 401; with `agent@`'s token → 403; with `admin@`'s token → 200).
   - Confirm each filter (`actor`, `action`, `target_type`, `date_from`, `date_to`) narrows the result set correctly, and that a malformed value (e.g. `action=bogus`) returns a `validation_error`, not a 500.
   - Confirm `POST`/`PUT`/`PATCH`/`DELETE` against `/api/audit-logs/` and `/api/audit-logs/<id>/` all return 405, not 403 or 200.
8. The full UI walkthrough, both languages: `npm run dev` with the backend up, signed in as `admin@` — `/audit-log` lists entries newest-first, the action/target-type filters narrow the table, an entry made by a since-deleted actor (if reachable in the seeded data) shows "Deleted user", and the sidebar's new "Audit Log" link (icon-only when collapsed, matching every other `SidebarLink`) is visible only to an account holding `audit_log.view`. Switch to Arabic and confirm the table and filters render correctly in RTL.

---

## Verification Steps

1. **Backend checks, migrations, and formats clean:** from `backend/` with the venv active — `python manage.py check`, `python manage.py makemigrations --check --dry-run` (expect no changes needed once tasks 0/0005/0006 are in place), `python manage.py migrate`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **`en`/`ar` key sets match**, including the new `auditLog` namespace.
4. **The audit-log endpoint's permission gate:**

   | Request | no token | `agent@supportos.local` (no `audit_log.view`) | `admin@supportos.local` (superuser) |
   |---|---|---|---|
   | `GET /api/audit-logs/` | 401 `not_authenticated` | 403 `permission_denied` | 200 |
   | `POST /api/audit-logs/` | 401 | 405 `method_not_allowed` | 405 `method_not_allowed` |

5. **Each of the seven `Action` values is producible and correctly shaped**, verified live via `curl.exe` against a running dev server as `admin@`:
   - `POST /api/users/` → one `user_created` row.
   - `PATCH /api/users/<id>/` changing `role` → one `user_role_changed` row with the correct `from_value`/`to_value` role names.
   - `PATCH /api/users/<id>/` changing `is_active` → one `user_status_changed` row.
   - `POST /api/roles/` → one `role_created` row.
   - `PATCH /api/roles/<id>/` changing `name` → one `role_renamed` row.
   - `PATCH /api/roles/<id>/` changing `permissions` → one `role_permissions_changed` row with comma-joined `from_value`/`to_value`.
   - `DELETE /api/roles/<id>/` on a non-system role with no users → one `role_deleted` row, and a follow-up `GET /api/audit-logs/<that id>/` still returns 200 with `target_role: null` and the original `target_label` intact.
6. **Filters work and reject bad input:** `?actor=<id>`, `?action=user_created`, `?target_type=user`, `?target_type=role`, `?date_from=YYYY-MM-DD`, `?date_to=YYYY-MM-DD` each narrow the result set correctly; `?action=bogus` and `?target_type=bogus` each return `validation_error`, not a 500.
7. **The full UI walkthrough, both languages**, per `## Test Plan` item 8.
8. **No hardcoded application strings introduced.** From `frontend/`:

   ```powershell
   Select-String -Path src\features\audit-log\components\AuditLogListPage.tsx -Pattern "'[A-Z][a-z]{3,}"
   ```

   Any hit must be inside a comment or a non-JSX context, not a JSX text node.
9. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `AuditLog` model exists in `backend/apps/accounts/models.py` with the exact shape from `## Story Goal`: `TimeStampedModel` base, `actor`/`target_user`/`target_role` all `SET_NULL` nullable FKs, `action` a `TextChoices` field with all seven values, `target_label` a required `CharField(150)`, `from_value`/`to_value` `TextField(blank=True)`, `ordering = ("-created_at",)`.
- [ ] `UserViewSet.perform_create`/`perform_update` write `user_created`/`user_role_changed`/`user_status_changed` `AuditLog` rows exactly when those specific fields change — no row for any other field edit.
- [ ] `RoleViewSet.perform_create`/`perform_update`/`destroy` write `role_created`/`role_renamed`/`role_permissions_changed`/`role_deleted` rows exactly when those specific fields change (or on delete); the existing `is_system` guard in `destroy` is unchanged.
- [ ] `Permissions.AUDIT_LOG_VIEW = "audit_log.view"` exists in `apps/core/permissions.py`, appended after `PORTAL_ACCESS`; granted to the seeded `admin` role only, via a new data migration mirroring `apps/tickets/migrations/0002_grant_ticket_permissions.py`'s shape.
- [ ] `AuditLogViewSet` (`apps/accounts/views.py`) is list/retrieve-only (`http_method_names` excludes every unsafe verb — a real 405, not merely an unmapped `permission_map` entry), gated on `AUDIT_LOG_VIEW`, registered at `GET /api/audit-logs/` via `apps/accounts/admin_urls.py`, and supports `actor`/`action`/`target_type`/`date_from`/`date_to` query-param filters with `ValidationError` on malformed (not absent) values.
- [ ] `AuditLogSerializer` exists, exposing `actor_name` (dotted-source, `allow_null=True`) and `action_display` alongside the raw model fields.
- [ ] `AuditLogAdmin` registered in Django admin, fully read-only (`has_add_permission`/`has_delete_permission` both `False`).
- [ ] `frontend/src/features/audit-log/` exists with `types/auditLog.ts`, `api/{auditLogKeys,getAuditLogs,useAuditLogs}.ts`, `components/AuditLogListPage.tsx`, `locales/{en,ar}.json` — no import from `features/accounts` anywhere in this new feature.
- [ ] `/audit-log` route exists in `router.tsx`, gated by `RequirePermission permission="audit_log.view"`; a new "Audit Log" link exists in `Sidebar.tsx`, gated by `<Can permission="audit_log.view">`, using `HistoryIcon`.
- [ ] `frontend/src/shared/i18n/resources.ts` registers the new `auditLog` namespace for both languages.
- [ ] Two new migrations in `apps/accounts/migrations/`: a schema migration for `AuditLog` and a data migration granting `AUDIT_LOG_VIEW` to `admin`.
- [ ] Verified by real HTTP: all seven `Action` values producible with correct `from_value`/`to_value` snapshots (Verification Step 5); the permission gate table including the 405s (Step 4); filter correctness and rejection of malformed filter values (Step 6); a deleted role's audit entry surviving with `target_role: null` and its original `target_label` (Step 5's last bullet).
- [ ] Both languages walk through cleanly in the UI (Step 7).
- [ ] `CONVENTIONS.md` § 22 gains one appended entry documenting the two-FK target-reference pattern — appended in place, § 0-§ 26 unrenumbered.
- [ ] `python manage.py test` reports **54** passing; `python manage.py makemigrations --check --dry-run` reports no pending changes; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story, including the EPIC 13→14 renumbering correction.

**STOP HERE. Report to the user and wait for confirmation before proceeding to SEC-4 (`SUPPORTOS-75`, System Configuration) — not yet planned, and not assumed to be Story 53 until `/squad-plan` actually runs for it.**
