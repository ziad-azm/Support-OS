# security-administration — plan overview

Entry point for the **security-administration** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 48 | [48-story-users-roles-admin-SUPPORTOS-72.md](48-story-users-roles-admin-SUPPORTOS-72.md) | Users & Roles Admin | SUPPORTOS-72 | Story 09 (`AUTH-2`), Story 10 (feature-module template) |
| 49 | [49-story-permissions-management-SUPPORTOS-73.md](49-story-permissions-management-SUPPORTOS-73.md) | Permissions Management | SUPPORTOS-73 | Story 48 (`SEC-1`) |
| 52 | [52-story-audit-logs-SUPPORTOS-74.md](52-story-audit-logs-SUPPORTOS-74.md) | Audit Logs | SUPPORTOS-74 | Story 48 (`SEC-1`), Story 49 (`SEC-2`) |

## Dependency notes

This feature maps to **EPIC 14 — Security & Administration** in the Jira workspace (`SEC-1` through `SEC-4`, `SUPPORTOS-72`–`75`) — renumbered from "EPIC 13" sometime between Story 49 and Story 52 (verified this session by re-grepping `SupportOs backlog.MD`, which now numbers Integrations as EPIC 13). It builds admin screens over the `AUTHZ` models Story 09 (`../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md`) shipped — no new authorization mechanism, no new `Permissions` constant beyond what SEC-3 itself adds, no migration beyond what SEC-3 itself adds.

**SEC-1 → SEC-2 → SEC-3 → SEC-4 is a strict sequence**, per each intake's own dependency line. Because `naming.globalSequence: true` (`.squad/config.yaml`), this feature's own `NN` numbers are **not contiguous** — Stories 50 and 51 were claimed by two unrelated `design-intelligence-ui-ux-system` stories (`DSN-4`, `DSN-5`) planned in between SEC-2 and SEC-3:

- **Story 48 (`SEC-1`, this one)** ships `UserViewSet`/`RoleViewSet` — user CRUD (no delete; deactivation only) and role CRUD (create/rename/delete, **not** permission editing).
- **Story 49 (`SEC-2`, `SUPPORTOS-73`)** — "Dependencies: SEC-1" per its own intake. Builds the role→permission mapping UI over `Role.permissions`, which Story 48 deliberately ships read-only.
- **Story 52 (`SEC-3`, `SUPPORTOS-74`)** — Audit-log service + viewer over sensitive actions: every SEC-1/SEC-2 write (user create/role-change/status-change, role create/rename/permissions-change/delete) now writes an immutable `AuditLog` row, visible in a new filtered `/audit-log` screen.
- **SEC-4 (`SUPPORTOS-75`, not yet planned)** — Settings model + admin UI for org-level configuration (branding/departments/branches/SLA defaults) — independent of the other three. Its own `NN` is not assumed to be 53 until `/squad-plan` actually runs for it.

**Verified findings that shaped Story 52:**

- **`AuditLog` lives in `apps/accounts`, not a new app.** `backend/apps/README.md`'s own placement rule ("belongs to exactly one business area → that app") resolves this: today's only two target types, `User` and `Role`, both already live in `accounts`. Unlike `Notification` (its own app because genuinely cross-cutting across `tickets`/`sla`/future consumers), `AuditLog` audits only `accounts`-owned models today.
- **Two nullable FKs (`target_user`/`target_role`), not a `GenericForeignKey`** — the direct generalization of `apps/notifications/models.py:35-36`'s own explicit rejection of `ContentType` machinery ("a plain FK to the one target type that exists today") to a table that needs two target types at once.
- **Every `AuditLog` row is written inline, at the exact call site of the change** (`UserViewSet`/`RoleViewSet`'s `perform_create`/`perform_update`/`destroy`), mirroring `TicketActivity.objects.create()`'s own call-site pattern (`apps/tickets/views.py:217-223`) — no signal, no generic diff-everything hook.
- **`Permissions.AUDIT_LOG_VIEW` is granted to the seeded `admin` role only**, the same admin-only grant `ROLES_MANAGE` already has — a judgment call (seeing who changed what is at least as sensitive as making the change), not dictated by the intake.

**Verified findings that shaped Story 48:**

- **A hard `DELETE` on `accounts.User` would cascade-delete data**, not just fail loudly like `Role`'s `PROTECT` does. `agents.Task.owner` and `notifications.Notification.recipient` are `on_delete=CASCADE` — verified by grep across every migration referencing `settings.AUTH_USER_MODEL`. `UserViewSet` removes `"delete"` from `http_method_names` entirely rather than leaving it unmapped (which `CONVENTIONS.md` §22's grant-on-omission rule would treat as authenticated-only, not forbidden).
- **A portal customer's `User` row is provisioned through `Customer.user` (Story 42), not through this screen.** `UserViewSet.get_queryset` filters on `customer_profile__isnull=True` (the OneToOne's reverse accessor) so a staff "manage users" screen never lists or edits a customer's login identity.
- **`RoleViewSet.list`/`retrieve` are gated on `users.view`, not `roles.manage`** — the user form's role picker needs to read the roles list under the same permission that already gates the user list, the same cross-feature reuse `TicketViewSet.assignable_agents` established for `tickets.view`. Only creating/renaming/deleting a role needs `roles.manage`.
- **Four system roles are seeded, not three**: `admin`/`manager`/`agent` (Story 09) plus `customer` (Story 42, `apps/accounts/migrations/0004_seed_customer_role.py`, added between Story 09 and this one for portal access).

**Verified findings that shaped Story 49:**

- **No backend change was needed to `RoleViewSet` itself.** `update`/`partial_update` were already gated on `roles.manage` by Story 48 — Story 49 only had to stop `RoleAdminSerializer` from refusing the `permissions` field. The entire authorization mechanism (`HasPermission`, `permission_map`) is reused unmodified.
- **`is_system` protects only `slug` and `destroy`, never `permissions`.** Editing a seeded role's (`admin`/`manager`/`agent`/`customer`) permission set is Story 49's whole purpose — locking it behind `is_system` would make the checklist non-functional on the four accounts that most need it.
- **`permissions_for` (Story 09) has no server-side cache**, so a role's permission edit takes effect on an already-issued, still-valid access token's very next request — verified live (Story 49 Verification Step 7). This is what makes the query-cache forward constraint (`CONVENTIONS.md` §22) partly reachable for the first time: a role's *content* can now change with no Django admin step, though an already-signed-in affected user's in-memory `user.permissions` still needs a reload to pick it up.
- **The permissions checklist is a new UI pattern** (many checkboxes bound to one `string[]` field via a hand-rolled `FormField` composition, not a new shared field component) — documented as a worked example in `CONVENTIONS.md` §23 for the next feature that needs a multi-select array field.

**Known gap resolved by Story 49:** `Role.permissions` is no longer read-only — Story 48's interim state (new roles created empty, editable only via Django admin) is superseded.

**Known gap carried forward:** the query-cache-not-permission-aware forward constraint (`CONVENTIONS.md` §22) is still not fixed — `queryClient.clear()`-on-role-change remains unbuilt. An already-signed-in user holding an edited role sees the change only after their next `/auth/me/` fetch (reload or re-login).
