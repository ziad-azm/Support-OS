# security-administration — plan overview

Entry point for the **security-administration** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 48 | [48-story-users-roles-admin-SUPPORTOS-72.md](48-story-users-roles-admin-SUPPORTOS-72.md) | Users & Roles Admin | SUPPORTOS-72 | Story 09 (`AUTH-2`), Story 10 (feature-module template) |
| 49 | [49-story-permissions-management-SUPPORTOS-73.md](49-story-permissions-management-SUPPORTOS-73.md) | Permissions Management | SUPPORTOS-73 | Story 48 (`SEC-1`) |
| 52 | [52-story-audit-logs-SUPPORTOS-74.md](52-story-audit-logs-SUPPORTOS-74.md) | Audit Logs | SUPPORTOS-74 | Story 48 (`SEC-1`), Story 49 (`SEC-2`) |
| 53 | [53-story-system-configuration-SUPPORTOS-75.md](53-story-system-configuration-SUPPORTOS-75.md) | System Configuration | SUPPORTOS-75 | None (independent of SEC-1/2/3) |
| — | _not yet planned_ | New User Invitation & First-Login Password Setup | `SEC-5` | Story 48 (`SEC-1`) |
| — | _not yet planned_ | User Account Deletion | `SEC-6` | Story 48 (`SEC-1`) |
| — | _not yet planned_ | Forgot Password / Self-Service Reset | `SEC-7` | `SEC-5` (reuses its token utility) |
| — | _not yet planned_ | Change Password | `SEC-8` | AUTH-1, FORM |

`SEC-5` through `SEC-8` are backlog-only additions (`SupportOs backlog.MD`) with no `NN`/intake file yet. All four are now folded into this feature: `SEC-5`/`SEC-6` came from a short-lived `account-lifecycle` epic (both extend `SEC-1`'s own Users admin screen directly); `SEC-7`/`SEC-8` came from an even shorter-lived `Password Self-Service` epic that briefly held just those two before being dissolved back into this one — every `User`-account credential concern now lives in one place rather than split across epics. Plan them the normal way (`/squad-new-story` → `/squad-plan`) when it's time to build them.

## Dependency notes

This feature maps to **EPIC 12 — Security & Administration** in the Jira workspace (`SEC-1` through `SEC-4`, `SUPPORTOS-72`–`75`, plus the backlog-only `SEC-5` through `SEC-8` above) — moved here (from EPIC 15) and repositioned right after Reports & Analytics, absorbing `SEC-5`/`SEC-6` from a short-lived `account-lifecycle` epic in the same reorg. That epic's other two stories (`ACCT-1` Forgot Password, `ACCT-2` Change Password) briefly survived as their own renamed "Password Self-Service" epic, then were dissolved into this feature too as `SEC-7`/`SEC-8` — there is no separate account/password epic left; every `User`-account concern is here. Previously this feature was EPIC 15, before that "EPIC 13" (renumbered between Story 49 and Story 52). It builds admin screens over the `AUTHZ` models Story 09 (`../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md`) shipped — no new authorization mechanism, no new `Permissions` constant beyond what SEC-3 itself adds, no migration beyond what SEC-3 itself adds.

**SEC-1 → SEC-2 → SEC-3 → SEC-4 is a strict sequence**, per each intake's own dependency line. Because `naming.globalSequence: true` (`.squad/config.yaml`), this feature's own `NN` numbers are **not contiguous** — Stories 50 and 51 were claimed by two unrelated `design-intelligence-ui-ux-system` stories (`DSN-4`, `DSN-5`) planned in between SEC-2 and SEC-3:

- **Story 48 (`SEC-1`, this one)** ships `UserViewSet`/`RoleViewSet` — user CRUD (no delete; deactivation only) and role CRUD (create/rename/delete, **not** permission editing).
- **Story 49 (`SEC-2`, `SUPPORTOS-73`)** — "Dependencies: SEC-1" per its own intake. Builds the role→permission mapping UI over `Role.permissions`, which Story 48 deliberately ships read-only.
- **Story 52 (`SEC-3`, `SUPPORTOS-74`)** — Audit-log service + viewer over sensitive actions: every SEC-1/SEC-2 write (user create/role-change/status-change, role create/rename/permissions-change/delete) now writes an immutable `AuditLog` row, visible in a new filtered `/audit-log` screen.
- **Story 53 (`SEC-4`, `SUPPORTOS-75`)** — Settings model + admin UI for org-level configuration (branding/departments/branches/SLA defaults) — independent of the other three (no `Dependencies:` line in its own intake). All four SEC stories are now planned.

**Verified findings that shaped Story 53:**

- **`apps/organization` was an untouched `startapp` scaffold** — this is the first story to put real code in it, fulfilling the "org-level settings" third of `apps/README.md`'s own app-table promise for that app (line 67).
- **`OrganizationSettings` is a singleton** (`save()` forces `pk=1`, `delete()` is a no-op, `load()` is the only accessor) — this codebase's first singleton model, deliberately self-built rather than a new `django-solo`-style dependency.
- **`departments`/`branches` are `JSONField(default=list)` string lists, not new `Department`/`Branch` tables** — the direct generalization of `Role.permissions`'s own "a list of strings that doesn't need its own table today" precedent; neither list has any other consumer yet, a deliberate, flagged scope decision.
- **SLA defaults are wired, not inert**: `apps/sla/policy.py::resolve_policy` gained a third fallback tier reading `OrganizationSettings`'s two default-minutes fields, returned as an unsaved `SLAPolicy` instance — zero risk to `compute_sla_status`, which already tolerates a `None` `policy_id`.
- **`logo_url` is a plain URL field, not an uploaded file** — combining a multipart file upload with this model's JSON list fields in one request would need an untested parsing path this codebase has never exercised (its one existing upload, `uploadAttachment.ts`, never combines a file with a `JSONField`).
- **`Permissions.SETTINGS_MANAGE` is granted to the seeded `admin` role only**, the same admin-only posture `ROLES_MANAGE`/`AUDIT_LOG_VIEW` already have.

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
