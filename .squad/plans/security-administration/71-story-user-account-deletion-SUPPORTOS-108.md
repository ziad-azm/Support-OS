# Story 71 — User Account Deletion (Story: SUPPORTOS-108)

## Prerequisites

- **Story 48 completed:** [48-story-users-roles-admin-SUPPORTOS-72.md](48-story-users-roles-admin-SUPPORTOS-72.md) (`SEC-1`). This story reverses that story's own deliberate choice to drop `"delete"` from `UserViewSet.http_method_names` — see `## Story Goal` for the re-verified CASCADE finding that made deactivation-only the interim ceiling, and how this story raises it.
- **Story 52 completed:** [52-story-audit-logs-SUPPORTOS-74.md](52-story-audit-logs-SUPPORTOS-74.md) (`SEC-3`). This story adds one more `AuditLog.Action` choice and one more call-site write, following that story's own "write inline, at the exact call site, only after the change actually succeeds" pattern (`RoleViewSet.destroy`, the closest existing precedent for a guarded, audited hard delete).
- **Story 70 completed:** [70-story-user-invitation-first-login-password-SUPPORTOS-107.md](70-story-user-invitation-first-login-password-SUPPORTOS-107.md) (`SEC-5`). Unrelated in mechanism, but the most recent change to `apps/accounts/views.py`/`UserViewSet` — read it as the current baseline, not Story 48's own plan body, which is now stale in several places (e.g. `UserAdminSerializer` no longer has a `password` field).
- Verified backend baseline (this session, live): `python manage.py test` reports **54** passing, matching `CONVENTIONS.md` § 16's own citation. `backend/apps/accounts/migrations/` currently ends at `0006_grant_audit_log_permission.py`.
- **Re-verified, fresh, the exact claim Story 48's own finding and this story's intake both make** — grep across every model file referencing `"accounts.User"` (not just migrations, which mirror the models 1:1): `agents.Task.owner` and `notifications.Notification.recipient` are still the **only two** `on_delete=CASCADE` relationships to `accounts.User` in the entire codebase today. Every other reference is `SET_NULL` (`customers.Customer.user`, `customers.Note.author`, `customers.Attachment.uploaded_by`, `tickets.Ticket.assigned_agent`, `tickets.TicketActivity.actor`, `agents.InternalNote.author`, `sla.AssignmentRule.last_assigned_agent`, `accounts.AuditLog.actor`/`target_user`) or a plain `ManyToManyField` (`agents.InternalNote.mentioned_users`, `sla.AssignmentRule.agents`/`sla.SLAPolicy`-adjacent agent pools — an M2M delete only drops join rows, never cascades to the related object, safe by construction regardless). No new CASCADE relationship has been added since Story 48 shipped.
- Verified: `backend/apps/agents/models.py:8-13` (`Task`'s own docstring) — *"Owned by exactly one agent, never shared or assigned to anyone else."* `Task.owner` is a required FK (no `null=True`), so there is no reassignment concept to fall back on for a departing owner's tasks — this is the fact that shapes this story's delete-blocking design (see `## Story Goal`).
- Verified: `backend/apps/notifications/models.py:24-27` (`Notification`'s own docstring) — *"a Notification exists FOR its recipient — one has no meaning without the other."* This is the fact that justifies letting `Notification` rows cascade silently rather than blocking on them too.
- Verified: `backend/apps/agents/views.py:36-43` (`TaskViewSet.get_queryset`) — every action on `/api/tasks/` is hard-scoped to `Task.objects.filter(owner=self.request.user)`. There is **no** API path today for an admin to view or clear another user's tasks; `backend/apps/agents/admin.py:6-17` (`TaskAdmin`) is the only place that can, and its own docstring calls it *"read-only ops visibility, not a config UI"* even though Django admin's own delete/edit actions are not disabled there (only `created_at`/`updated_at` are in `readonly_fields`). This gap is real and flagged in `## Edge Cases`, not silently assumed away.

---

## Story Goal

Complete the `User` lifecycle Story 48 (`SEC-1`) deliberately left at deactivation-only: give an admin a real, permanent delete, without ever silently destroying a departing user's task/notification history or a customer's own ticket/interaction history through some indirect FK.

1. **Backend** — `UserViewSet` gets `"delete"` back in `http_method_names`, gated by the same `Permissions.USERS_MANAGE` that already gates `create`/`update` (no new permission constant). A custom `destroy()`:
   - Refuses to let a caller delete their own account (a new, deliberate guard — see the second finding below).
   - Refuses the delete while the target still owns any `Task` row, with a clear `non_field_errors` message — the intake's own bracketed "or blocks the delete" option, chosen over "reassign" because `Task.owner`'s own docstring rules reassignment out (see `## Prerequisites`).
   - Lets `Notification` rows cascade-delete silently and correctly — no explicit code needed; this is exactly what `on_delete=CASCADE` was already configured to do, and exactly what the model's own docstring says should happen.
   - Writes one `AuditLog` row (`Action.USER_DELETED`, new) **after** the delete actually succeeds, `target_user=None`, `target_label` a snapshot of the deleted user's name — the same ordering and shape `RoleViewSet.destroy` already established for `ROLE_DELETED`.
2. **Frontend** — `UserListPage.tsx` gains a `users.manage`-gated destructive "Delete" action per row (reusing `DeleteRowButton` + `useConfirm()`, the exact `RoleListPage` shape), whose confirm-dialog copy states plainly, before the irreversible action: their notifications are removed too, and the delete is refused if they still own tasks. The delete control never renders on the signed-in admin's own row at all — see the second finding below.

### Two verified findings that shape this story beyond the intake's own wording

**1. "Reassign" is not available for `Task` — this story blocks instead, and says so.** The intake's backend task offers two options in parenthesis: "reassigns or nullifies the target's owned Task and Notification rows (or blocks the delete with a clear error while unhandled dependent records exist — a product decision to confirm before building)." `Task.owner` is a required FK and the model's own docstring is explicit that a task is never shared or reassigned — so "reassign" is not a real option without inventing a task-reassignment feature this story does not otherwise need, and "nullify" is impossible on a non-nullable FK without a schema change. `Notification`, by contrast, needs no decision at all: its own docstring already treats CASCADE as correct. The product decision, made here: **block on `Task`, cascade on `Notification`.**

**2. Self-delete is blocked — a new guard this story adds, not one the intake names, and deliberately asymmetric with Story 48's own accepted self-deactivation gap.** Story 48's `## Edge Cases` already accepts that *"deactivating your own account is not specially prevented"* — a reasoned choice, because deactivation is trivially reversible by any other admin (`PATCH {"is_active": true}`). A hard `DELETE` is not reversible at all: the row, its email's uniqueness slot, and its identity are permanently gone, and unlike a self-deactivation lockout (survivable — someone else re-activates you), a self-delete of the only signed-in admin who noticed the mistake has no in-app recovery path at all. The asymmetry in how each is treated is deliberate, not an inconsistency: reversible risk is left alone (§ 0's "only build what's needed" bias), irreversible risk gets a guard. The frontend never renders the delete control on the caller's own row; the backend refuses it independently, the same "backend owns authorization, frontend check is UX only" split `CONVENTIONS.md` § 22 already establishes for permissions.

### Explicitly out of scope

- **A frontend or backend path to view/reassign/delete another user's `Task` rows.** `TaskViewSet` stays scoped to `request.user`'s own tasks (Story 32's own design). An admin who hits the "still owns tasks" block today has to go through Django admin (`/admin/agents/task/`) to reassign or delete them — a real, accepted gap, not solved here. See `## Edge Cases`.
- **Preventing deletion of the last `admin`-role (or `users.manage`-holding) account.** Only *self*-delete is blocked. Deleting the second-to-last admin account, leaving one admin left, or even (by two different admins acting one after another) leaving zero holders of `users.manage`, is not specially prevented — a known, accepted risk, the same posture Story 48/49 already take toward comparable footguns. Flagged, not engineered around.
- **Bulk delete.** One user at a time, matching every other destructive action in this project (`RoleListPage`'s delete, `CategoryListPage`'s delete).
- **Undelete / soft-delete / a trash screen.** The intake asks for "permanently delete." This is a hard `DELETE`, no recovery path — the confirm dialog's entire job is to make that unambiguous before it happens.
- **Automated tests.** Standing policy (`CONVENTIONS.md` § 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-108/intake.md` — one description, two task blocks (safe backend delete flow; delete-user UI and confirmation), no attachments, no acceptance criteria. The backend task's own parenthetical is what `## Story Goal` finding 1 resolves.
2. `backend/apps/accounts/views.py:85-171` (`UserViewSet`, current post-Story-70 state) — the class docstring (86-100, *"No `destroy`..."*, now false and fully rewritten by task 3), `http_method_names`/`permission_map` (102-111), `perform_create`/`perform_update` (129-170, the exact `AuditLog.objects.create(...)` call-site shape task 3's `destroy()` copies). Also read `RoleViewSet.destroy` (lines 234-259 in the same file) in full — it is the closest existing precedent for "guard, then delete, then audit-log only on success," including its own documented reasoning for writing the audit row *after* `super().destroy()` (no `ATOMIC_REQUESTS`, logging before success once left a false row for a delete that never happened).
3. `backend/apps/accounts/models.py:136-217` (`AuditLog`) — the `Action` choices (172-179, task 1 inserts one line at 176) and the class's own docstring (136-170) explaining why `target_user`/`target_role` are `SET_NULL` (an audit row must outlive its target).
4. `backend/apps/agents/models.py:1-59` (`Task`) — `owner` (15-20, required, `CASCADE`) and the model's own docstring (8-13, "never shared or assigned to anyone else") that rules out reassignment. `backend/apps/agents/views.py:18-43` (`TaskViewSet`) — `get_queryset` (36-43) is the owner-only scoping that makes "no in-app admin path to another user's tasks" a verified fact, not an assumption. `backend/apps/agents/admin.py:6-17` (`TaskAdmin`) — the one existing (if unadvertised) path to clear another user's tasks.
5. `backend/apps/notifications/models.py:8-56` (`Notification`) — `recipient` (28-33, required, `CASCADE`) and the docstring (9-16) explicitly framing CASCADE as correct, not a hazard.
6. `backend/apps/accounts/migrations/0005_auditlog.py` (all 35 lines) and `0006_grant_audit_log_permission.py` (all 39 lines) — the exact `choices=[...]` list format task 2's new migration mirrors, and the `('accounts', '0006_grant_audit_log_permission')` dependency it chains onto.
7. `backend/apps/core/permissions.py:18-38` (`Permissions`) — confirms `USERS_MANAGE` already exists (Story 09/48); this story adds **no new permission constant**.
8. `backend/apps/core/exceptions.py:29-51` (`envelope_exception_handler`) — a `ValidationError` always renders `message: VALIDATION_MESSAGE` ("The submitted data is invalid.") at the envelope's top level; the *specific* reason only ever reaches `fields.non_field_errors`. This is what `## Edge Cases` cites when explaining what the global toast will and will not show.
9. `frontend/src/features/accounts/components/RoleListPage.tsx` (all 121 lines) — the exact shape task 6 copies: `useConfirm()` (25), `handleDelete` (35-43), the `actions` column's `<Can>`-gated `<DeleteRowButton>` (66-78), no success toast on delete (feedback is the row disappearing after `useInvalidateRoles`'s cache invalidation).
10. `frontend/src/features/accounts/components/UserListPage.tsx` (all 116 lines) — current state, including its own now-stale docstring (20-25, *"No delete action anywhere here"*) task 6 rewrites, and the existing columns (36-74) the new `actions` column is appended after.
11. `frontend/src/features/accounts/api/deleteRole.ts` (5 lines) and `useRoleMutations.ts` (all 41 lines, `useDeleteRole` at 34-40) — the exact shape task 5's `deleteUser.ts`/`useDeleteUser` copies, including `useInvalidateRoles`'s "invalidate the whole prefix" pattern (task 5 reuses `UserFormPage`'s/`useUserMutations.ts`'s existing `useInvalidateUsers`, unchanged).
12. `frontend/src/shared/ui/confirm/types.ts` (`ConfirmOptions`, all 11 lines) — `title`/`description`/`destructive`, already-translated strings only.
13. `frontend/src/shared/ui/data-table/DeleteRowButton.tsx` (all 35 lines) — the one shared destructive row-action button; task 6 renders it unchanged, no new component.
14. `frontend/src/shared/auth/types.ts:9-19` (`AuthUser`) and `useAuth.ts` (all 12 lines) — `useAuth().user.id`, what task 6 compares each row's `id` against to hide the delete control on the caller's own row.
15. `frontend/src/shared/lib/api/queryClient.ts` (all 56 lines, `createQueryClient` 23-56) and `frontend/src/app/providers.tsx:22-31` — confirms every mutation error always reaches the shared toast via `t(error.code, { defaultValue: error.message })`; for a `validation_error` this resolves to the generic top-level message, never the specific `non_field_errors` text (§ `## Edge Cases`, referenced from `RoleListPage`'s own identical, already-accepted limitation for a `ProtectedError`-derived role-delete block).
16. `frontend/src/features/audit-log/types/auditLog.ts` (all 27 lines) — `AUDIT_LOG_ACTIONS` (2-10), task 7 appends one value. `frontend/src/features/audit-log/components/AuditLogListPage.tsx:87-99` — confirms the array drives both the filter dropdown's options and each option's `t(\`actions.${value}\`)` lookup, so a missing locale key would render a raw translation-key string in the dropdown, not just silently omit the option.
17. `frontend/src/features/audit-log/locales/en.json`/`ar.json` (all 30/31 lines) — the `actions` object (21-29/21-29) task 7 appends `user_deleted` to.
18. `CONVENTIONS.md` § 16 (lines 251-258, no automated tests — the **54** figure verified live this session), § 22 (lines 757-873, authorization — grant-on-omission and the backend-owns-authorization/frontend-is-UX-only split this story's self-delete guard follows), § 23 (lines 873-1469, feature module conventions — task 8 appends one entry after the existing last one, which currently ends at line 1465, before the `---` at 1467).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **A user can be permanently removed.** | Intake | `UserViewSet.http_method_names` regains `"delete"`; `destroy` gated on `Permissions.USERS_MANAGE`. |
| **Never silently destroy a departing user's task history — block instead, since reassignment isn't a real option.** | Intake + `## Story Goal` finding 1 | `destroy()` raises a `non_field_errors` `ValidationError` while `Task.objects.filter(owner=user).exists()`. |
| **Notifications are safe to cascade — they have no meaning without their recipient.** | `Notification`'s own docstring | No explicit code; `on_delete=CASCADE` already does this. |
| **Must never silently cascade-delete a customer's own ticket/interaction history through any indirect FK.** | Intake constraint | Re-verified (`## Prerequisites`): every FK from customer-facing data (`Ticket`, `Message`, `Note`, `Attachment`, `TicketActivity`) to `accounts.User` is `SET_NULL`, not `CASCADE` — deleting a user never touches a `Ticket` row or anything under it. |
| **Reuse AUTHZ permissions, the API envelope, and SEC-3's audit-log pattern — no new mechanism.** | Intake constraint | `Permissions.USERS_MANAGE` (existing); `envelope_exception_handler` (existing, unmodified); `AuditLog.objects.create(...)` at the call site, after success, mirroring `RoleViewSet.destroy` exactly. |
| **A confirmation states plainly what happens before the irreversible action.** | Intake | `useConfirm()`'s `description` names both consequences (notifications removed; blocked if tasks remain) before the destructive button is ever clicked. |
| **The backend enforces self-delete refusal even if the frontend control is somehow reached anyway.** | § 22's general posture, this story's own finding 2 | `destroy()` checks `user.id == request.user.id` independently of the frontend hiding the button on that row. |

---

## Backend Tasks

### 1 — New `AuditLog.Action` choice

**File: `backend/apps/accounts/models.py`** — insert one line into the existing `Action` class (current lines 172-179), immediately after `USER_STATUS_CHANGED` (line 175):

```python
        USER_DELETED = "user_deleted", _("User deleted")
```

Resulting order: `USER_CREATED`, `USER_ROLE_CHANGED`, `USER_STATUS_CHANGED`, `USER_DELETED`, `ROLE_CREATED`, `ROLE_RENAMED`, `ROLE_PERMISSIONS_CHANGED`, `ROLE_DELETED` — every `USER_*` action grouped before every `ROLE_*` action, matching the existing order exactly.

---

### 2 — Migration for the new choice

**Create file: `backend/apps/accounts/migrations/0007_alter_auditlog_action.py`**

A metadata-only `AlterField` — no `ALTER TABLE` is emitted for a plain `CharField`'s `choices=` on PostgreSQL, but Django's migration state must still track it (the same reasoning that makes `MigrationStateTests.test_no_pending_migrations`, `backend/config/tests/test_settings.py`, fail without it).

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_grant_audit_log_permission'),
    ]

    operations = [
        migrations.AlterField(
            model_name='auditlog',
            name='action',
            field=models.CharField(
                choices=[
                    ('user_created', 'User created'),
                    ('user_role_changed', 'User role changed'),
                    ('user_status_changed', 'User status changed'),
                    ('user_deleted', 'User deleted'),
                    ('role_created', 'Role created'),
                    ('role_renamed', 'Role renamed'),
                    ('role_permissions_changed', 'Role permissions changed'),
                    ('role_deleted', 'Role deleted'),
                ],
                max_length=30,
                verbose_name='action',
            ),
        ),
    ]
```

After task 1's model edit, run `python manage.py makemigrations accounts --check --dry-run` from `backend/` (venv active) to confirm Django's own autodetector agrees no further state is pending once this file exists — it should report no changes needed. If Django's autogenerated file name or shape differs from the above (e.g. a different auto-name), keep Django's own output instead of this hand-written version — the `choices` list and `dependencies` entry are what matter, not the exact filename.

---

### 3 — `UserViewSet.destroy`

**File: `backend/apps/accounts/views.py`**

Add `from apps.agents.models import Task` to the import block (no circular import: `apps/agents/models.py` imports only `apps.core.models` and `apps.tickets.models`, never `apps.accounts`).

Replace the `UserViewSet` class docstring (current lines 86-100) with:

```python
class UserViewSet(BaseModelViewSet):
    """Staff user administration — SEC-1, extended by SEC-5 (invite-only
    creation) and SEC-6 (this story, hard delete).

    `destroy` is real: `agents.Task.owner` and
    `notifications.Notification.recipient` are still the only two
    `on_delete=CASCADE` relationships to `accounts.User` (re-verified —
    see `## Prerequisites`). `Notification` rows are safe to let cascade —
    they have no meaning without their recipient (their own model
    docstring). `Task` rows are not: `Task.owner` is required and, per
    `apps/agents/models.py`'s own docstring, a task is never reassigned —
    so `destroy()` below blocks the delete instead, the same PROTECT-style
    guard `RoleViewSet.destroy` already uses for a system role. It also
    refuses to let a caller delete their own account — a new guard, not
    forced by any CASCADE risk; see `## Story Goal` finding 2.
    """

    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    serializer_class = UserAdminSerializer

    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.USERS_MANAGE,
        "update": Permissions.USERS_MANAGE,
        "partial_update": Permissions.USERS_MANAGE,
        "destroy": Permissions.USERS_MANAGE,
    }
```

(`ordering_fields`/`search_fields`/`get_queryset`/`perform_create`/`perform_update`, current lines 113-170, are unchanged — only the docstring and the two attributes above move.)

Add `destroy` as the last method on `UserViewSet`, after `perform_update` (current line 170), before `class RoleViewSet` begins:

```python
    def destroy(self, request, *args, **kwargs):
        """Hard-deletes a User — SEC-6. See the class docstring for the
        CASCADE/PROTECT-style reasoning. Both guards below raise before
        `super().destroy()` ever runs, so neither a self-delete attempt
        nor a still-has-tasks user is ever partially deleted.
        """
        user = self.get_object()
        if user.id == request.user.id:
            raise ValidationError(
                {"non_field_errors": [_("You cannot delete your own account.")]}
            )
        if Task.objects.filter(owner=user).exists():
            raise ValidationError(
                {
                    "non_field_errors": [
                        _(
                            "This user still owns tasks. Complete or remove "
                            "them before deleting this account."
                        )
                    ]
                }
            )
        user_label = user.get_full_name()
        response = super().destroy(request, *args, **kwargs)
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.USER_DELETED,
            target_user=None,
            target_label=user_label,
        )
        return response
```

`target_user=None` from the start (not left for a later `SET_NULL` side effect) — the same reasoning `RoleViewSet.destroy`'s own docstring already gives for `target_role=None`.

---

## Documentation Tasks

### 4 — Append to `CONVENTIONS.md` § 23

**File: `CONVENTIONS.md`** — append after the existing last entry in § 23 (ends line 1465, before the `---` at line 1467). Do **not** renumber § 0-§ 27.

```markdown

**A verb removed for a CASCADE risk (§ 23's own earlier entry) can be
reinstated once the risk is actually guarded, not just documented.**
`UserViewSet` (Story 48, `SEC-1`) dropped `"delete"` from
`http_method_names` because a hard delete would have silently cascaded
onto `agents.Task.owner`. Story 71 (`SEC-6`) adds `"delete"` back — not by
loosening anything, but by making the one still-real CASCADE risk
(`Task`, which cannot be reassigned — its own model docstring rules that
out) a `ValidationError` raised *before* `super().destroy()` runs, the
same PROTECT-style guard `RoleViewSet.destroy` already uses for a system
role. The other CASCADE relationship, `notifications.Notification.recipient`,
needed no guard at all — its own docstring already treats "deleted with
its recipient" as correct, not a hazard. The lesson: a removed HTTP verb
is not necessarily a permanent decision — re-examine it once a real guard
exists, rather than treating "we once removed this verb" as settled.
```

---

## Frontend Tasks

### 5 — API layer

**Create file: `frontend/src/features/accounts/api/deleteUser.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function deleteUser(id: number): Promise<void> {
  return api.delete(`/users/${id}/`)
}
```

**File: `frontend/src/features/accounts/api/useUserMutations.ts`** — add the import and a new hook, and correct the header comment (current lines 8-12, which claims *"There is no `useDeleteUser`"*):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createUser } from './createUser'
import { deleteUser } from './deleteUser'
import { updateUser } from './updateUser'
import { userKeys } from './userKeys'
import type { UserCreateInput, UserUpdateInput } from '../types/user'

// Every mutation invalidates the whole `users` key prefix — a create/edit/
// delete changes which rows land on which page, the same reasoning
// `useCustomerMutations.ts` documents. CONVENTIONS.md §23.
function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: userKeys.all })
}
```

Append, after `useUpdateUser`:

```ts
export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: invalidate,
  })
}
```

---

### 6 — `UserListPage.tsx` delete action

**File: `frontend/src/features/accounts/components/UserListPage.tsx`**

Replace the file's leading docstring (current lines 20-25):

```tsx
/**
 * The staff user-admin list screen. A `users.manage`-gated destructive
 * delete per row (SEC-6) — never rendered on the signed-in admin's own
 * row (see the plan's `## Story Goal` finding 2; the backend refuses a
 * self-delete independently either way). Deactivation via the edit form
 * remains the reversible alternative for every other row.
 */
```

Add imports (alongside the existing ones):

```tsx
import { Can, useAuth } from '@/shared/auth'
import { DeleteRowButton } from '@/shared/ui/data-table/DeleteRowButton'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'

import { useDeleteUser } from '../api/useUserMutations'
```

Inside `UserListPage()`, after the existing `query` line, add:

```tsx
  const { user: currentUser } = useAuth()
  const { confirm } = useConfirm()
  const deleteMutation = useDeleteUser()

  async function handleDelete(user: AdminUser) {
    const confirmed = await confirm({
      title: t('users.delete.title'),
      description: t('users.delete.description', { email: user.email }),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(user.id)
  }
```

Append a new column to `columns` (after the existing `is_active` column):

```tsx
    {
      id: 'actions',
      header: t('users.fields.actions'),
      cell: (row) =>
        row.id === currentUser?.id ? null : (
          <Can permission="users.manage">
            <DeleteRowButton onClick={() => void handleDelete(row)}>
              {t('users.actions.delete')}
            </DeleteRowButton>
          </Can>
        ),
    },
```

No other change — `RoleListPage`'s own precedent shows no success toast on delete; the row disappearing from the (re-fetched, `useInvalidateUsers`-triggered) list is the feedback. A blocked delete (self-delete or still-owns-tasks) surfaces through the shared global mutation-error toast (`## Edge Cases` — the message is generic, the same already-accepted limitation `RoleListPage`'s own `ProtectedError`-derived block has today).

---

### 7 — Locale changes

**File: `frontend/src/features/accounts/locales/en.json`** — inside `users.fields` (current lines 14-20), add `"actions": "Actions"`. Inside `users.actions` (current line 22), add `"delete": "Delete"`. Add a new `users.delete` object (placed after `status`, matching where `roles.delete` sits relative to `roles.systemBadge`):

```json
    "delete": {
      "title": "Delete this user?",
      "description": "This permanently removes {{email}}. Their notifications are removed too. If they still own any tasks, the deletion is blocked until those are resolved."
    },
```

**File: `frontend/src/features/accounts/locales/ar.json`** — the identical structural change:

```json
    "delete": {
      "title": "حذف هذا المستخدم؟",
      "description": "سيؤدي هذا إلى إزالة {{email}} نهائيًا. سيتم حذف إشعاراته أيضًا. إذا كان لا يزال يملك مهامًا، فسيُحظر الحذف حتى يتم حلها."
    },
```

`"fields": { ..., "actions": "الإجراءات" }`, `"actions": { "save": "حفظ", "delete": "حذف" }`.

**File: `frontend/src/features/audit-log/locales/en.json`** — inside `actions` (current lines 21-29), add `"user_deleted": "User deleted"` after `"user_status_changed"`.

**File: `frontend/src/features/audit-log/locales/ar.json`** — the same position, `"user_deleted": "تم حذف المستخدم"`.

**File: `frontend/src/features/audit-log/types/auditLog.ts`** — insert `'user_deleted'` into `AUDIT_LOG_ACTIONS` (current lines 2-10), after `'user_status_changed'`, before `'role_created'` — matching the backend `Action` enum's own order exactly.

---

## Edge Cases & Failure Modes

- **A "still owns tasks" block only shows a generic toast, not the specific reason.** `envelope_exception_handler` always sets a `ValidationError`'s top-level `message` to the fixed "The submitted data is invalid." string (`apps/core/exceptions.py:29-51`); the specific text lives only in `fields.non_field_errors`, which the shared `MutationCache`-driven toast (`t(error.code, { defaultValue: error.message })`) never reads. This is not a new gap — `RoleListPage`'s existing delete-blocked-by-`ProtectedError` case has the identical limitation today, unaddressed. The confirm dialog's own upfront copy (task 6/7) is this story's actual mitigation: an admin is told about the task-block *before* attempting the delete, not just after a vague failure.
- **A self-delete attempt via a hand-crafted request (frontend button hidden, API called directly) fails cleanly, not with a 500 or a partial delete.** `destroy()`'s `user.id == request.user.id` check raises before `super().destroy()` is ever reached.
- **Deleting a user who still owns tasks fails atomically — no partial delete, no orphaned `Notification` rows.** The `Task.objects.filter(...).exists()` check also raises before `super().destroy()` runs; nothing is deleted at all until both guards pass.
- **A TOCTOU race: a task is created between the `Task.objects.filter(...).exists()` check and the actual delete.** No row lock (`select_for_update`) guards this window — the same "no `ATOMIC_REQUESTS`, no explicit locking" posture `RoleViewSet.destroy`'s own docstring already accepts for a different race, and `InviteConfirmSerializer` (Story 70) accepts for a third. In the extremely unlikely event this fires, `on_delete=CASCADE` still silently deletes the just-created task along with the user — an accepted, near-zero-probability edge case, not engineered around, since `Task` creation is a synchronous, authenticated, self-service action rather than something a concurrent batch process does.
- **An admin has no in-app path to clear another user's tasks today.** `TaskViewSet` is hard-scoped to `request.user`'s own rows (Story 32's own design, unchanged by this story). The only existing path is Django admin (`/admin/agents/task/`), which is not a self-service admin-panel flow. This is a real, accepted gap — flagged in `## Prerequisites` and `## Story Goal`'s "Explicitly out of scope," not silently assumed to have a solution.
- **`AuditLogListPage`'s `?target_type=user` filter will not show a `USER_DELETED` row.** `target_user=None` for a deleted user's audit entry (by design — the row is gone), and `AuditLogViewSet.get_queryset`'s `target_type` filter is `target_user__isnull=False`. This is the exact same, already-accepted behavior `ROLE_DELETED` rows already have under `?target_type=role` (Story 52) — not a new gap this story introduces.
- **Deleting the second-to-last (or even the last) `users.manage`-holding account is not prevented.** Only *self*-delete is blocked. Two different admins, each individually permitted, could between them delete every account holding `users.manage`, leaving nobody able to invite or manage staff. A known, accepted risk — see `## Story Goal`'s "Explicitly out of scope."
- **A weird partial state cannot occur:** either both guards pass and the user (plus its `Notification` rows, via `CASCADE`) is fully deleted and the audit row is written, or an exception is raised before anything is touched. There is no window where the `User` row is gone but the audit log is not written (mirrors `RoleViewSet.destroy`'s own reasoning for writing the audit row only after a confirmed-successful `super().destroy()`).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations accounts --check --dry-run` reports no pending changes once task 1 and task 2 both exist.
3. `ruff format --check .` / `ruff check .` on the new and changed Python (`models.py`, the new migration, `views.py`).
4. `npm run build` — typechecks the new `UserListPage.tsx` imports/handlers and the `AUDIT_LOG_ACTIONS` addition.
5. `npm run lint` (`react/jsx-no-literals` over the changed `UserListPage.tsx`), `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison script (the same one Story 10 Verification Step 4 introduced), run against `frontend/src/features/accounts/locales/{en,ar}.json` and `frontend/src/features/audit-log/locales/{en,ar}.json`.
7. Real HTTP against the full delete flow — self-delete refusal, task-block refusal, a clean successful delete, and the resulting audit-log row — plus a real browser walkthrough in both languages: Verification Steps 4-13 below.

---

## Migration / Rollback

**One metadata-only migration** (task 2) — no `ALTER TABLE`, no data migration, no risk to existing rows. `User`/`Task`/`Notification`/`AuditLog` schemas are otherwise unchanged.

**Rollback of the code:** revert the commits, including the migration (`python manage.py migrate accounts 0006_grant_audit_log_permission` before reverting, if the migration already ran against a shared database — unnecessary for a purely local/dev rollback). No `pip install`/`npm install` — no new dependency.

**Half-applied states to avoid:**

- **Task 1 (model) before task 2 (migration)** → `python manage.py check`/`test` both fail immediately with Django's own "model has changes not reflected in a migration" warning path becoming a hard error under `MigrationStateTests.test_no_pending_migrations`. Ship them together.
- **Task 3 (`UserViewSet.destroy` reads `AuditLog.Action.USER_DELETED`) before task 1** → `AttributeError` on the very first delete attempt. Ship task 1 before or with task 3.
- **Task 6 (frontend component) before task 5 (`useDeleteUser` exists)** → the import fails, `tsc -b` fails.
- **Task 6 before task 7 (locale keys)** → every new `t('users.delete...')`/`t('users.fields.actions')`/`t('users.actions.delete')` call fails `tsc -b` the same way `CONVENTIONS.md` § 23 already documents for a components-before-locales ordering.
- **Task 7's `audit-log` locale/type additions before or after task 3 independently** → no ordering risk either way; `AuditLogListPage` already tolerates an unknown action value gracefully today (it would render the raw key), so this is a cosmetic-only risk, not a build break — but ship together for a clean diff regardless.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **No pending migration state:** `python manage.py makemigrations accounts --check --dry-run` exits 0 with no changes detected.
4. **`en`/`ar` key sets match** for both `features/accounts/locales` and `features/audit-log/locales` (`## Test Plan` item 6).
5. **A user cannot delete their own account.**

   ```powershell
   curl.exe -s -X DELETE http://127.0.0.1:8000/api/users/1/ -H "Authorization: Bearer $adminToken"
   ```

   Using `admin@`'s own id (`1`, or whatever id `GET /api/auth/me/` with that token returns) — expect `400 validation_error`, `fields.non_field_errors` containing "You cannot delete your own account.", and confirm via `GET /api/users/1/` immediately after that the row still exists.
6. **A user who owns a task cannot be deleted.** Sign in as (or create) a staff account, create a `Task` owned by it (`POST /api/tasks/` while authenticated as that user), then `DELETE /api/users/<that-id>/` as `admin@` — expect `400 validation_error` naming the task block. Confirm the user row still exists.
7. **A user with no tasks deletes cleanly.** Create a fresh staff user with no owned tasks (e.g. via `POST /api/users/` per Story 70's invite flow, left uninvited/unconfirmed is fine — deletion does not require an active account), then `DELETE /api/users/<id>/` as `admin@` — expect `204`. `GET /api/users/<id>/` afterward — `404`.
8. **The deleted user's notifications are gone; a `USER_DELETED` audit row exists.** Before deleting a user with at least one `Notification` (e.g. from an existing ticket-assignment/escalation fixture), note their notification count via `python manage.py shell -c "..."`; after the delete, confirm `Notification.objects.filter(recipient_id=<deleted-id>).count()` is `0`. Then `GET /api/audit-logs/?action=user_deleted` as `admin@` — the newest row's `target_label` matches the deleted user's former name, `target_user` is `null`.
9. **`DELETE` on a non-existent or already-deleted user id is a clean 404, not a 500.**
10. **`DELETE` without `users.manage` is a clean 403.** Using an account holding only `users.view` (e.g. `mgr@` per Story 09's seeded accounts) — `403 permission_denied`.
11. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as `admin@`:
    - `/users` shows a "Delete" action on every row **except** the signed-in admin's own row.
    - Clicking "Delete" on a fresh, task-free user opens the confirm dialog with the exact copy naming both consequences; confirming removes the row from the list with no manual refresh.
    - Clicking "Delete" on a user who owns a task, confirming, shows the generic error toast (per `## Edge Cases`) and the row remains in the list.
    - `/audit-log` shows the new "User deleted" entry, filterable via the action dropdown.
    - Switch to Arabic: the confirm dialog, the "Delete" button label, and the audit-log action name are all translated, `dir="rtl"`.
12. **No hardcoded strings.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\accounts\components\UserListPage.tsx -Pattern "'[A-Z][a-z]{3,}"
    ```

    Must return only non-user-facing hits.
13. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `AuditLog.Action.USER_DELETED` added (`models.py`); migration `0007` (or Django's own auto-name) makes `makemigrations --check` report clean.
- [ ] `UserViewSet.http_method_names` includes `"delete"`; `permission_map["destroy"] = Permissions.USERS_MANAGE` — no new `Permissions` constant.
- [ ] `UserViewSet.destroy` refuses a self-delete (`user.id == request.user.id`) and refuses a delete while `Task.objects.filter(owner=user).exists()`, both via a `non_field_errors` `ValidationError` raised before any row is touched.
- [ ] A successful delete cascades `Notification` rows silently (no explicit code), writes exactly one `AuditLog` row (`USER_DELETED`, `target_user=None`, `target_label` a name snapshot) only after `super().destroy()` succeeds, and never touches `Ticket`/`Customer`/any other SET_NULL-related row's actual content (only nulls the FK, per existing, unchanged `on_delete=SET_NULL` behavior).
- [ ] `frontend/src/features/accounts/api/deleteUser.ts` and `useDeleteUser` (`useUserMutations.ts`) exist, following `deleteRole.ts`/`useDeleteRole`'s exact shape; the stale "There is no `useDeleteUser`" comment is removed.
- [ ] `UserListPage.tsx` renders a `users.manage`-gated `DeleteRowButton` per row, **never** on the signed-in admin's own row; `useConfirm()`'s dialog names both consequences (notifications removed; blocked if tasks remain) before the delete fires.
- [ ] `users.delete.title`/`users.delete.description`/`users.fields.actions`/`users.actions.delete` added to both `accounts` locale files; `audit-log`'s `actions.user_deleted` added to both `audit-log` locale files and `AUDIT_LOG_ACTIONS`; `en`/`ar` key sets match in both namespaces (Verification Step 4).
- [ ] Verified by real HTTP: self-delete refusal (Step 5), task-owning-user refusal (Step 6), a clean successful delete with cascaded notifications and a correct audit row (Steps 7-8), 404-not-500 on a missing id (Step 9), 403 without `users.manage` (Step 10).
- [ ] Both languages walk through cleanly (Step 11); no hardcoded strings (Step 12).
- [ ] `CONVENTIONS.md` § 23 gains the appended verb-reinstatement entry (§ 0-§ 27 unrenumbered).
- [ ] `python manage.py test` reports **54** passing; `python manage.py makemigrations accounts --check --dry-run` clean; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story's row; `.squad/plans/00-index.md`'s `security-administration` NN range updated to include `71`.
