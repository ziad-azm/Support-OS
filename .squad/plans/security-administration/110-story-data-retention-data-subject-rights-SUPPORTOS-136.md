# Story 110 — Data Retention & Data-Subject Rights (PDPL / GDPR) (Story: SUPPORTOS-136)

## Prerequisites

- **Story 52 completed** (`SEC-3`, [52-story-audit-logs-SUPPORTOS-74.md](52-story-audit-logs-SUPPORTOS-74.md)) — `AuditLog`, reused for every retention/export/erasure action this story writes.
- **Story 53 completed** (`SEC-4`, [53-story-system-configuration-SUPPORTOS-75.md](53-story-system-configuration-SUPPORTOS-75.md)) — `OrganizationSettings`/`SettingsView`/`SettingsPage.tsx`, extended with the four retention-day fields.
- **Story 10/11 completed** (`CUST-1`/`CUST-2`, [../customer-management/00-overview.md](../customer-management/00-overview.md)) — `Customer`, `ContactDetail`, extended with `legal_hold` and the export/erasure actions.
- **Story 27 completed** (`SLA-0`, [../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md](../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md)) — Celery, `django-celery-beat`'s DB-backed scheduler; this story's purge job is the second `PeriodicTask` ever seeded, copying `apps/sla/migrations/0004_seed_escalation_schedule.py`'s exact shape.
- **Story 09 completed** (`AUTH-2`) — `HasPermission`/`permission_map`, reused for the two new permissions this story adds.
- Verified backend baseline (this session, live): `python manage.py test` — the existing suite passes before this story's changes (54 tests as of Story 73/107; re-verify the exact count at implementation time, since Story 109's ticket-merge work may have added more).
- Verified: no `legal_hold`/`retention`/"legal hold" concept exists anywhere in `backend/apps/` today (grepped the whole tree) — this is a wholly new field this story introduces, not an extension of anything.
- Verified: no `StreamingHttpResponse` exists anywhere in this codebase; the one existing non-enveloped export (`apps/reports/export.py::csv_response`) uses a plain buffered `HttpResponse` with `Content-Disposition: attachment` — this story's customer-data export copies that exact shape for a JSON payload instead of CSV.
- Verified: no report in `apps/reports/aggregation.py`/`tickets.py`/`sla.py`/`agents.py`/`dashboard.py` reads `Customer.name`/`.email`/`.phone`/`.company` — every dimension a report can group by is a ticket-side field (`status`, `priority`, `category__name`, a computed `channel`, `department__name`, `branch__name`; see `apps/reports/tickets.py`'s `DIMENSION_FIELDS` whitelist). Anonymizing customer PII in place therefore breaks no existing report — the intake's own "so RPT-* aggregates do not break" constraint is satisfied by construction, not by new report code.
- Verified: `Ticket.customer` is `on_delete=PROTECT` (`apps/tickets/models.py:57-59`, docstring: "a customer with ticket history must not silently vanish") — a `Customer` row with any ticket can never be hard-deleted. This is why "erasure" in this story means anonymizing the `Customer` row's personal fields and deleting its ancillary artifacts (contacts, notes, attachments), never deleting the row itself.

---

## Story Goal

1. **Retention policy + scheduled purge/anonymization job.** Four independent, optional (nullable, opt-in) retention periods — closed tickets, conversation messages, attachments, audit log entries — configurable on the existing org-settings screen. A new daily Celery job anonymizes ticket content in place (so ticket-level report counts survive) and purges (hard-deletes) messages, attachments (row **and** file), and audit-log rows past their configured limit. A `Customer` flagged under legal hold is skipped entirely by every purge/anonymize pass.
2. **Data-subject export & erasure for a customer.** Two new admin actions on the existing customer record: **Export data** downloads a single JSON document of everything held about that customer (profile, contacts, notes, tickets, every message on every one of their tickets, attachment metadata, feedback). **Erase data** anonymizes the customer's personal fields, deletes their contacts/notes/attachments (row and file), and blanks the free-text content of their tickets/messages/feedback — refusing outright if the customer is under legal hold. Both actions are gated by two new permissions and write an `AuditLog` entry.

### Verified findings that shape this story beyond the intake's own wording

**Four retention-day settings are four more scalar fields on `OrganizationSettings`, not a new model — `CONVENTIONS.md` §33's "list → model" precedent does not apply here.** That section (lines 2500-2619) records ORG-1/ORG-2 promoting two `JSONField` *string-list* columns (`departments`/`branches`) to real models, and states "a future story wanting a **list of things** on that model should create a model, not a column." A retention period in days is a single scalar per data class, the same shape `default_response_target_minutes`/`default_resolution_target_minutes` (`apps/organization/models.py:147-152`) already establish on this exact model — not a list. Four more nullable `PositiveIntegerField`s follows the existing sibling pattern directly; a new model would only be warranted for a *list* of per-category override rows, which nothing here asks for.

**No new business area owns both halves of this story equally — the two tasks split across two different, already-correct homes.** Task 2 (export/erasure) is single-customer, on-demand, and reads across `tickets`/`communications` for exactly one `Customer` — the identical shape `apps/customers/timeline.py::build_timeline` already established for `CustomerViewSet.timeline` (Story 20): a cross-app read that still "belongs to exactly one business area" (customers) per `apps/README.md`'s own rule 1. Task 1 (the scheduled purge) is a global, cross-cutting sweep across four different apps' tables with no natural single owner — the same shape that justified `apps/sla` existing as its own app for a cross-cutting automation job. This story therefore adds `apps/customers/export.py`/`erasure.py` (new actions on the existing `CustomerViewSet`) for task 2, and a **new app, `apps/compliance`**, for task 1 — `apps/README.md`'s rule 4 ("genuinely a new business area → a new app, plus a row in the table").

**"Erasure" anonymizes the `Customer` row; it never deletes it.** See `## Prerequisites` — `Ticket.customer`'s `PROTECT` means a customer with any ticket history cannot be hard-deleted without breaking that guarantee (and without destroying the ticket-level history the retention job is simultaneously trying to preserve for reporting). Erasure therefore blanks `name`/`email`/`phone`/`company` on the `Customer` row itself, deletes every `ContactDetail`/`Note`/`Attachment` (row **and** file), and blanks the free-text body of every `Message`/`Ticket.subject`/`Ticket.description`/`Feedback.comment` reachable from that customer — while leaving every `Ticket` row, its status/priority/category/dates, and every `AuditLog` row untouched, so report aggregates and the erasure's own audit trail both survive the erasure they describe.

**`Ticket` has no `closed_at` field today** (verified: only `created_at`/`updated_at` from `TimeStampedModel`, plus its own unrelated `escalated_at`). "Closed tickets past N days" needs an exact, stable closing timestamp — `updated_at` is not safe to reuse, since `closed` is a terminal status (`apps/tickets/status.py:24`, `VALID_TRANSITIONS[Ticket.Status.CLOSED] == frozenset()`) but nothing stops a later edit (department/category reassignment, TKT-9 merge) from bumping `updated_at` on an already-closed ticket, which would silently and incorrectly reset its retention clock. This story adds `Ticket.closed_at` (nullable, set once, only inside `apply_status_change`), mirroring `escalated_at`'s exact "set once, on one specific transition, never touched elsewhere" shape.

**Recovery/idempotency: no shared Celery locking or "already processed" convention exists in this codebase to reuse** (confirmed: no `select_for_update`, no distributed lock, no `task_acks_late` anywhere in `config/celery.py`/`settings/base.py`; `evaluate_escalations`' own idempotency is just a property of its `escalated=False` filter, not a shared mechanism). This story's purge task is naturally idempotent the same way: every operation re-selects "still past the cutoff, not yet in the target end-state" rows on every run, so a re-run (a missed schedule tick, a manual re-trigger) is always safe and produces the same end state, not a second undesired effect.

**Two new permissions, not a reuse of `customers.manage`.** The intake explicitly asks for "a dedicated permission via AUTHZ" for the export/erasure actions — `Permissions.CUSTOMERS_EXPORT_DATA` (`customers.export_data`) and `Permissions.CUSTOMERS_ERASE_DATA` (`customers.erase_data`), so an org can grant "view/edit customers" widely while keeping "run a data-subject request" narrow to a compliance-specific role.

**`legal_hold` is Django-admin-only for this story — no self-service UI.** The intake asks only that erasure "respect" a legal hold, not that this story ship a full self-service toggle. `Customer.external_id` (`apps/customers/serializers.py`) is the direct precedent for a real model field that exists on `Customer` but is deliberately absent from `CustomerSerializer`/`CustomerFormPage.tsx` — an admin-only escape hatch via Django admin, the same scope boundary `Feedback`'s own docstring documents for itself ("no staff-facing viewer... Django admin as the interim way"). A future story can add a self-service toggle if the compliance team needs one; this story ships the flag, `CustomerAdmin` exposure, and both consumers (the purge job, the erasure action) actually respecting it.

**A customer-data export is JSON metadata, not a zip bundling attachment file bytes.** "Machine-readable export... everything held" is satisfied by a structured JSON document (profile, contacts, notes, every ticket with its full message history, attachment *metadata*, feedback) — the actual attachment file bytes are not embedded. Bundling arbitrary binary files into one response is a materially different, larger piece of work (streaming zip construction, memory limits, content-type detection) this story does not take on; the export's `attachments` array lists id/filename/size/upload date, and the file itself stays reachable through the existing, permission-gated `AttachmentViewSet.download` for as long as it has not since been purged. Recorded as an explicit scope line, not a silent gap.

### Explicitly out of scope

- **A self-service `legal_hold` toggle in the customer UI.** See finding above — Django admin only, this story.
- **Bundling attachment file content into the customer export.** See finding above — metadata only.
- **Per-department/per-category retention overrides.** One global policy, four data-class knobs — the intake does not ask for finer granularity.
- **Deleting a customer's linked portal login (`Customer.user`) as part of erasure.** Erasure touches the CRM record only; a portal account is a separate `accounts.User` row with its own lifecycle (Story 71, staff-initiated user deletion). Flagged in `## Edge Cases`.
- **Automated tests.** Standing policy (`CONVENTIONS.md` §16).

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-136/intake.md` — one description, two task blocks (retention policy + scheduled job; data-subject export & erasure), no attachments, no acceptance criteria.
2. `backend/apps/tickets/models.py` (372 lines, current post-Story-109 state) — `Ticket` (27-152, `Status` choices 35-39, no `closed_at` today), `TicketActivity` (183-244), `Feedback` (247-296, lives in `apps.tickets`, **not** `apps.portal`).
3. `backend/apps/tickets/status.py` (all 69 lines, in full) — `apply_status_change` (35-68) is where task 1 below sets `closed_at`, mirroring how `escalated_at` is set only inside its own single call site.
4. `backend/apps/tickets/serializers.py:126-164` (`TicketSerializer.Meta`) — `escalated_at`'s read-only-field placement (145-146, 162) is the exact pattern task 9 copies for `closed_at`.
5. `backend/apps/communications/models.py:8-67` (`Message`) — `body` (39) is the conversation-transcript content this story purges; no direct FK to `Customer`, only via `ticket.customer`.
6. `backend/apps/customers/models.py` (all 254 lines, in full) — `Customer` (8-129, PII fields at 16-49), `ContactDetail` (132-174), `Attachment` (221-253, `file` FileField at 238), `Note` (186-218).
7. `backend/apps/customers/views.py` (all 425 lines, in full) — `CustomerViewSet` (32-217, `permission_map` 50-69, the `timeline`/`portal_access` `@action` precedents this story's `export_data`/`erase_data` actions copy); `AttachmentViewSet.perform_destroy` (404-412, `instance.file.delete(save=False)` before `instance.delete()` — the exact file-cleanup call every attachment-touching operation in this story must reuse) and `.download` (414-425, the `FileResponse`/`as_attachment=True` shape).
8. `backend/apps/customers/serializers.py:1-81` (`CustomerSerializer`) — current `Meta.fields` (66-81); `external_id`'s presence here but absence from the frontend `Customer`/`CustomerInput` types (`frontend/src/features/customers/types/customer.ts`) is the direct precedent for `legal_hold`'s own "real serializer field, no frontend form exposure" treatment.
9. `backend/apps/customers/admin.py` (all 42 lines, in full) — `CustomerAdmin` (13-19) is where `legal_hold` becomes admin-editable.
10. `backend/apps/accounts/models.py:194-284` (`AuditLog`) — `Action` choices (230-247, current post-Story-107 state, 14 members), `target_user`/`target_role` (258-273, the two-nullable-FK shape task 5 extends to three), docstring (201-206) citing `apps/notifications/models.py:35-36`'s own "plain FK, not `GenericForeignKey`" rule — the reasoning this story's `target_customer` addition follows literally.
11. `backend/apps/accounts/views.py` — `AuditLogViewSet.get_queryset`'s `target_type` filter (around line 649-656 as of this session; grep `target_type` to confirm current line numbers, since Story 107 may have shifted them) — the `"user"`/`"role"` branch pattern task 7 adds a `"customer"` branch to. `UserViewSet.destroy` (`target_user=None, target_label=user_label` — a pre-captured name snapshot before the row's state changes) is the exact pattern the erasure action's own `AuditLog.objects.create(...)` call copies.
12. `backend/apps/accounts/serializers.py` — `AuditLogSerializer.Meta.fields` (grep `class AuditLogSerializer`) gains `target_customer` alongside the existing `target_user`/`target_role`.
13. `backend/apps/core/permissions.py` (all ~150 lines, in full) — `Permissions` (18-46, 20 constants today) is where the two new constants are added, after `CUSTOMERS_MANAGE` (line 30).
14. `backend/apps/organization/models.py:89-195` (`OrganizationSettings`) — `default_response_target_minutes`/`default_resolution_target_minutes` (147-152) is the exact nullable-`PositiveIntegerField` shape the four new retention fields copy.
15. `backend/apps/organization/serializers.py:73-119` (`OrganizationSettingsSerializer`) — `Meta.fields` (91-100) gains the four new field names; no new `validate()` cross-check is needed (each retention field is independent, unlike the SLA-target pair).
16. `backend/apps/organization/views.py:137-158` (`SettingsView`) — unchanged; `OrganizationSettingsSerializer`'s widened `fields` tuple is the only touch point.
17. `backend/apps/sla/migrations/0004_seed_escalation_schedule.py` (all 38 lines, in full) — the exact `IntervalSchedule`/`PeriodicTask` data-migration template task 3 (new app) copies, adapted to a `CrontabSchedule` (daily, not every 5 minutes).
18. `backend/apps/sla/tasks.py:47-70` (`evaluate_escalations`) — the plain `@shared_task`, no-arguments, "a run that matches nothing is a normal no-op" shape the new `run_data_retention` task copies.
19. `backend/apps/reports/export.py` (all 60 lines, in full) — `csv_response` (50-59)'s plain-`HttpResponse`-with-`Content-Disposition`-bypassing-the-envelope shape, adapted to JSON for the customer-data export.
20. `backend/apps/README.md` (all 107 lines, in full) — the app-placement decision rules (13-27) this story's `apps/compliance` app follows under rule 4 (21-23); the apps table (69-84) gains one row.
21. `backend/config/settings/base.py:59-76` (`LOCAL_APPS`) — `"apps.compliance"` is appended after `"apps.integrations"` (line 73).
22. `CONVENTIONS.md` §24 (lines 1729-1777, Background jobs) and §33 (lines 2500-2619, the "list → model" precedent this story's settings fields are checked against and found not to trigger).
23. `frontend/src/features/organization/components/SettingsPage.tsx` (all 193 lines, in full) — the `nullablePositiveInt()` + `<TextField type="number">` pair (172-183) task 14 copies four more times, in a new `<Card>`.
24. `frontend/src/shared/validation/schemas.ts:67-71` (`nullablePositiveInt`) — reused unmodified.
25. `frontend/src/features/organization/types/settings.ts` (all 21 lines, in full) — `OrganizationSettings`/`SettingsInput`, both gain the four new fields.
26. `frontend/src/features/customers/components/CustomerProfilePage.tsx` (all 172 lines, in full) — the `<Can permission="customers.manage">` actions block (120-157) and `handleDelete`'s `confirm → mutateAsync` shape (43-52) task 17's `handleEraseData` copies; `Export data` is added as a sibling, permission-gated separately.
27. `frontend/src/shared/lib/download.ts` (all 50 lines, in full) — `downloadFile` (36-50), reused unmodified for the export download; `frontend/src/features/customers/api/downloadAttachment.ts` (9 lines) is the exact call-shape precedent.
28. `frontend/src/features/customers/api/revokePortalAccess.ts` (7 lines) and `useCustomerMutations.ts` (grep for `useRevokePortalAccess`) — the exact `api.<verb>` + `useMutation` two-layer shape the new export/erase API functions and hooks copy.
29. `frontend/src/features/customers/locales/en.json`/`ar.json` (150/~150 lines) — `portalAccess.revokeConfirm` (39-51) is the nested-confirm-copy precedent for `dataErasure.eraseConfirm`.
30. `frontend/src/features/audit-log/types/auditLog.ts` (30 lines, in full) — **verified gap**: `AUDIT_LOG_ACTIONS` (2-13) and `AuditLog.action`'s union still list only the 10 pre-2FA values; Story 107 (SEC-9) added four `two_factor_*` `AuditLog.Action` members on the backend but never updated this frontend mirror or `frontend/src/features/audit-log/locales/{en,ar}.json`'s `actions` block. This story's own three new backend action values touch the exact same array, so the four missing 2FA ones are added in the same edit — a found-and-fixed gap, not new scope.
31. `frontend/src/features/audit-log/components/AuditLogListPage.tsx` (all 123 lines, in full) — the `target_type` `Select` (100-109) gains a third `"customer"` option; `frontend/src/features/audit-log/api/getAuditLogs.ts`'s `target_type?: 'user' | 'role'` (line 9) widens to include `'customer'`.

---

## Backend Tasks

### 1 — `Ticket.closed_at`

**File: `backend/apps/tickets/models.py`** — add one field to `Ticket`, directly after `merged_into` (current lines 145-152), before `class Meta`:

```python
    # SEC-10. Set exactly once, only inside `apps.tickets.status.
    # apply_status_change` when the new status is `CLOSED` — never touched
    # anywhere else. `updated_at` is not safe to key retention off: `closed`
    # is terminal (this app's own `status.py::VALID_TRANSITIONS` maps it to
    # an empty set), but a later edit to a closed ticket (recategorizing,
    # TKT-9's merge) still bumps `updated_at`, which would silently reset
    # this ticket's retention clock. Mirrors `escalated_at`'s exact "set
    # once, on one specific transition" shape.
    closed_at = models.DateTimeField(_("closed at"), null=True, blank=True)
```

**File: `backend/apps/tickets/status.py`** — in `apply_status_change` (current lines 35-68), set `closed_at` alongside `status`:

```python
    old_status = ticket.status
    ticket.status = new_status
    update_fields = ["status", "updated_at"]
    if new_status == Ticket.Status.CLOSED:
        ticket.closed_at = timezone.now()
        update_fields.append("closed_at")
    ticket.save(update_fields=update_fields)
```

Add `from django.utils import timezone` to the top-of-file imports (not currently imported there).

**File: `backend/apps/tickets/serializers.py`** — add `"closed_at"` to `TicketSerializer.Meta.fields` (current lines 128-151), directly after `"escalated_at"` (line 146), and to `read_only_fields` (current lines 158-164), directly after `"escalated_at"` (line 162) — read-only for the identical reason: written only through `apply_status_change`, never through a plain PATCH.

---

### 2 — `Customer.legal_hold`

**File: `backend/apps/customers/models.py`** — add one field to `Customer`, directly after `whatsapp_enabled` (current line 48), before `company`:

```python
    # SEC-10. When true, this customer is exempt from every retention
    # purge/anonymize pass (apps.compliance.retention) and from the
    # erase-data action (apps.customers.erasure.erase_customer refuses
    # outright). Admin-only for this story — no self-service UI; set via
    # Django admin (see CustomerAdmin below). The direct precedent for a
    # real model field with no frontend form exposure is `external_id`
    # just below: present in `CustomerSerializer.Meta.fields` for API
    # visibility, absent from `CustomerFormPage.tsx`'s schema.
    legal_hold = models.BooleanField(_("legal hold"), default=False)
```

**File: `backend/apps/customers/serializers.py`** — add `"legal_hold"` to `CustomerSerializer.Meta.fields` (current lines 66-81), directly after `"external_id"` (line 75) — writable (a plain boolean, no special validation), reachable through the existing `PATCH /api/customers/<id>/` under `customers.manage` (Django admin is the only *UI* that exposes it, per `## Story Goal`, but the API field itself does not need a narrower permission — `customers.manage` already gates every other write on this serializer).

**File: `backend/apps/customers/admin.py`** — add `"legal_hold"` to `CustomerAdmin.list_display` and `list_filter` (current lines 15-16):

```python
    list_display = ("name", "email", "phone", "company", "branch", "user", "legal_hold", "created_at")
    list_filter = ("branch", "legal_hold")
```

---

### 3 — `OrganizationSettings` retention-day fields

**File: `backend/apps/organization/models.py`** — add four fields to `OrganizationSettings`, directly after `default_resolution_target_minutes` (current lines 150-152), before `class Meta`:

```python
    # SEC-10. Each is independently nullable/opt-in — the same "blank means
    # no policy configured for this data class, do nothing" shape
    # `default_response_target_minutes` above already establishes. Consumed
    # only by `apps.compliance.tasks.run_data_retention` (never read by
    # this app itself) — see CONVENTIONS.md §33 for why these are four more
    # scalars here rather than a new model.
    retention_closed_tickets_days = models.PositiveIntegerField(
        _("closed ticket retention (days)"), null=True, blank=True
    )
    retention_messages_days = models.PositiveIntegerField(
        _("message retention (days)"), null=True, blank=True
    )
    retention_attachments_days = models.PositiveIntegerField(
        _("attachment retention (days)"), null=True, blank=True
    )
    retention_audit_log_days = models.PositiveIntegerField(
        _("audit log retention (days)"), null=True, blank=True
    )
```

**File: `backend/apps/organization/serializers.py`** — add the four field names to `OrganizationSettingsSerializer.Meta.fields` (current lines 91-100), directly after `"default_resolution_target_minutes"` (line 97):

```python
        fields = (
            "id",
            "name",
            "logo_url",
            "primary_color",
            "default_response_target_minutes",
            "default_resolution_target_minutes",
            "retention_closed_tickets_days",
            "retention_messages_days",
            "retention_attachments_days",
            "retention_audit_log_days",
            "created_at",
            "updated_at",
        )
```

No new `validate()` entry — each retention field is independent (unlike the response/resolution pair, nothing cross-checks one against another).

---

### 4 — Migrations for tasks 1-3

**Create file: `backend/apps/tickets/migrations/0014_ticket_closed_at.py`**

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0013_ticket_merged_into_alter_ticketactivity_kind"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="closed_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="closed at"),
        ),
    ]
```

**Create file: `backend/apps/customers/migrations/0011_customer_legal_hold.py`**

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0010_customer_email_contact_enabled_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="legal_hold",
            field=models.BooleanField(default=False, verbose_name="legal hold"),
        ),
    ]
```

**Create file: `backend/apps/organization/migrations/0015_organizationsettings_retention_fields.py`**

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0014_landing_hero_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizationsettings",
            name="retention_closed_tickets_days",
            field=models.PositiveIntegerField(
                blank=True, null=True, verbose_name="closed ticket retention (days)"
            ),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="retention_messages_days",
            field=models.PositiveIntegerField(
                blank=True, null=True, verbose_name="message retention (days)"
            ),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="retention_attachments_days",
            field=models.PositiveIntegerField(
                blank=True, null=True, verbose_name="attachment retention (days)"
            ),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="retention_audit_log_days",
            field=models.PositiveIntegerField(
                blank=True, null=True, verbose_name="audit log retention (days)"
            ),
        ),
    ]
```

Run `python manage.py makemigrations --check tickets customers organization` at implementation time to confirm each file matches what `makemigrations` itself generates against the task 1-3 model changes exactly (field ordering/kwargs) — adjust to match if Django's generator differs in any cosmetic way.

---

### 5 — `AuditLog.target_customer` and three new `Action` values

**File: `backend/apps/accounts/models.py`** — add three choices to `AuditLog.Action` (current lines 230-247), directly after `TWO_FACTOR_RECOVERY_CODE_USED` (lines 244-247):

```python
        DATA_RETENTION_RUN = "data_retention_run", _("Scheduled data retention run")
        CUSTOMER_DATA_EXPORTED = "customer_data_exported", _("Customer data exported")
        CUSTOMER_DATA_ERASED = "customer_data_erased", _("Customer data erased")
```

Add one field, directly after `target_role` (current lines 266-273), before `target_label`:

```python
    # SEC-10. Extends the exact two-nullable-FK shape `target_user`/
    # `target_role` above already establish, to a third target type — not
    # a `GenericForeignKey`, for the identical reason this class's own
    # docstring gives for the first two (apps/notifications/models.py's
    # "a plain FK to the one target type that exists today" rule). String
    # reference (`"customers.Customer"`), matching `accounts.User.department`/
    # `.branch`'s own reference style — `apps.accounts` importing
    # `apps.customers` directly would be a new, unnecessary inter-app
    # coupling this avoids.
    target_customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs_as_target",
        verbose_name=_("target customer"),
    )
```

**File: `backend/apps/accounts/serializers.py`** — add `"target_customer"` to `AuditLogSerializer.Meta.fields`, directly after `"target_role"` (grep `class AuditLogSerializer` to find the current exact line — it is unchanged in shape since Story 52, just shifted down by Story 107's additions elsewhere in the file).

**File: `backend/apps/accounts/views.py`** — in `AuditLogViewSet.get_queryset`'s `target_type` block (grep `target_type = params.get`, currently around lines 649-656), add a third branch:

```python
        target_type = params.get("target_type")
        if target_type:
            if target_type == "user":
                queryset = queryset.filter(target_user__isnull=False)
            elif target_type == "role":
                queryset = queryset.filter(target_role__isnull=False)
            elif target_type == "customer":
                queryset = queryset.filter(target_customer__isnull=False)
            else:
                raise ValidationError(
                    {"target_type": [_('Must be "user", "role", or "customer".')]}
                )
```

**Create file: `backend/apps/accounts/migrations/0017_auditlog_target_customer_and_more.py`**

```python
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_two_factor_authentication"),
        ("customers", "0011_customer_legal_hold"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditlog",
            name="target_customer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="audit_logs_as_target",
                to="customers.customer",
                verbose_name="target customer",
            ),
        ),
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("user_created", "User created"),
                    ("user_role_changed", "User role changed"),
                    ("user_status_changed", "User status changed"),
                    ("user_deleted", "User deleted"),
                    ("role_created", "Role created"),
                    ("role_renamed", "Role renamed"),
                    ("role_permissions_changed", "Role permissions changed"),
                    ("role_deleted", "Role deleted"),
                    ("portal_access_granted", "Portal access granted"),
                    ("portal_access_revoked", "Portal access revoked"),
                    ("two_factor_enabled", "Two-factor authentication enabled"),
                    ("two_factor_disabled", "Two-factor authentication disabled"),
                    ("two_factor_reset", "Two-factor authentication reset by admin"),
                    ("two_factor_recovery_code_used", "Two-factor recovery code used"),
                    ("data_retention_run", "Scheduled data retention run"),
                    ("customer_data_exported", "Customer data exported"),
                    ("customer_data_erased", "Customer data erased"),
                ],
                max_length=30,
                verbose_name="action",
            ),
        ),
    ]
```

**Note the added cross-app migration dependency** on `("customers", "0011_customer_legal_hold")` — required because `target_customer` FKs to `customers.Customer`; Django's migration graph needs `customers`' migration applied first. Run `python manage.py makemigrations --check accounts` to confirm this matches Django's own generated shape.

---

### 6 — Two new permissions

**File: `backend/apps/core/permissions.py`** — add two constants to `Permissions` (current lines 26-46), directly after `CUSTOMERS_MANAGE` (line 30):

```python
    CUSTOMERS_EXPORT_DATA = "customers.export_data"
    CUSTOMERS_ERASE_DATA = "customers.erase_data"
```

No migration needed — `Permissions`/`ALL_PERMISSIONS` are code, not data (`CONVENTIONS.md` §22); a role only gains either permission through the existing `RoleFormPage.tsx` checklist once `usePermissionCatalog` picks it up automatically (it derives from `ALL_PERMISSIONS`, no per-permission registration elsewhere).

---

### 7 — New app: `apps/compliance` (the retention/purge job)

**Create file: `backend/apps/compliance/__init__.py`** — empty.

**Create file: `backend/apps/compliance/apps.py`**

```python
from django.apps import AppConfig


class ComplianceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.compliance"
```

**Create file: `backend/apps/compliance/retention.py`**

```python
"""Data retention — SEC-10 task 1. Each function purges or anonymizes one
data class past its configured limit and returns the number of rows it
touched. Pure, no Celery/task-framework dependency — `tasks.py` is the only
caller. Every query excludes a customer under legal hold
(`Customer.legal_hold`); see that field's own docstring
(apps/customers/models.py) for the scope this covers.

Idempotent by construction, not by a lock: every filter re-selects "still
past the cutoff, not yet in the target end state" rows on each run, so a
missed schedule tick or a manual re-trigger is always safe — this codebase
has no shared Celery locking primitive to reuse (verified: no
`select_for_update`/`task_acks_late` anywhere in `config/celery.py` or
`settings/base.py`), so each function below invents its own via its filter
shape rather than via a lock.
"""

from datetime import timedelta

from django.utils import timezone

from apps.communications.models import Message
from apps.customers.models import Attachment
from apps.tickets.models import Ticket

# Idempotent: re-running against an already-anonymized ticket is a no-op —
# the `.exclude(subject=...)` below stops it from being re-selected, so the
# placeholder text is never rewritten with an identical value on every run.
CLOSED_TICKET_SUBJECT_PLACEHOLDER = "[Removed — data retention policy]"
CLOSED_TICKET_DESCRIPTION_PLACEHOLDER = (
    "This ticket's content was removed under the organization's data retention policy."
)


def anonymize_closed_tickets(days: int, *, now=None) -> int:
    """Blanks `subject`/`description` on every `CLOSED` ticket whose
    `closed_at` is past `days` — the ticket row, its status, dates, category,
    department, and branch all survive untouched, so ticket-count reports
    keep working. Never touches `Message` rows — see `purge_messages` below,
    which has its own independent day count.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    return (
        Ticket.objects.filter(status=Ticket.Status.CLOSED, closed_at__lt=cutoff)
        .exclude(subject=CLOSED_TICKET_SUBJECT_PLACEHOLDER)
        .exclude(customer__legal_hold=True)
        .update(
            subject=CLOSED_TICKET_SUBJECT_PLACEHOLDER,
            description=CLOSED_TICKET_DESCRIPTION_PLACEHOLDER,
            updated_at=now,
        )
    )


def purge_messages(days: int, *, now=None) -> int:
    """Hard-deletes every `Message` on a `CLOSED` ticket whose `closed_at`
    is past `days`. Keyed off the PARENT ticket's `closed_at`, not the
    message's own `created_at` — a still-open ticket's messages are never
    purged regardless of their age, since the conversation is not over.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    queryset = Message.objects.filter(
        ticket__status=Ticket.Status.CLOSED, ticket__closed_at__lt=cutoff
    ).exclude(ticket__customer__legal_hold=True)
    count = queryset.count()
    queryset.delete()
    return count


def purge_attachments(days: int, *, now=None) -> int:
    """Hard-deletes every `Attachment` past `days` old — both the DB row
    and the underlying file (`file.delete(save=False)`), the exact cleanup
    `AttachmentViewSet.perform_destroy` already performs for a manual
    delete (apps/customers/views.py:404-412). Keyed off the attachment's
    own `created_at`, independent of any ticket — `Attachment` is
    customer-scoped, not ticket-scoped, in this codebase.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    queryset = Attachment.objects.filter(created_at__lt=cutoff).exclude(customer__legal_hold=True)
    count = 0
    for attachment in queryset.iterator():
        attachment.file.delete(save=False)
        attachment.delete()
        count += 1
    return count


def purge_audit_log(days: int, *, now=None) -> int:
    """Hard-deletes `AuditLog` rows past `days` old. Not legal-hold-scoped
    — an audit entry is not itself a customer's personal data record, and
    this table has no `Customer`-shaped ownership to check.

    Imports `AuditLog` locally rather than at module load time (unlike
    every other function above, which imports its models at the top of
    this file) — `apps.accounts` is upstream of nothing this module
    otherwise needs, but a top-level import here would be the one import
    in this file pointing at `apps.accounts` specifically; kept local so a
    future `apps.accounts` -> `apps.compliance` import (unlikely, but this
    module is new) can never create a cycle.
    """
    from apps.accounts.models import AuditLog

    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    queryset = AuditLog.objects.filter(created_at__lt=cutoff)
    count = queryset.count()
    queryset.delete()
    return count
```

**Create file: `backend/apps/compliance/tasks.py`**

```python
"""Background tasks — SEC-10. The second app (after `apps.sla`) to add its
own `tasks.py`; `app.autodiscover_tasks()` (`config/celery.py`) finds it
with no further wiring — see CONVENTIONS.md §24.
"""

from celery import shared_task
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import AuditLog
from apps.organization.models import OrganizationSettings

from . import retention


@shared_task
def run_data_retention() -> None:
    """Runs once a day (seeded `PeriodicTask`, this app's own
    `0001_seed_retention_schedule` data migration — see `evaluate_escalations`,
    apps/sla/tasks.py:48-70, for the same "runs on django-celery-beat's own
    schedule" shape). Reads `OrganizationSettings` fresh on every run — the
    same cross-app read `apps.sla.policy.resolve_policy` already makes for
    its own SLA-default fallback tier. A data class with no configured
    retention period (`None`) is skipped entirely; a run where every class
    is unconfigured is a normal no-op, the same "nothing configured, nothing
    to do" shape `evaluate_escalations` already has for no enabled
    `EscalationRule`.
    """
    settings_obj = OrganizationSettings.load()
    results: dict[str, int] = {}

    if settings_obj.retention_closed_tickets_days is not None:
        results["tickets_anonymized"] = retention.anonymize_closed_tickets(
            settings_obj.retention_closed_tickets_days
        )
    if settings_obj.retention_messages_days is not None:
        results["messages_purged"] = retention.purge_messages(settings_obj.retention_messages_days)
    if settings_obj.retention_attachments_days is not None:
        results["attachments_purged"] = retention.purge_attachments(
            settings_obj.retention_attachments_days
        )
    if settings_obj.retention_audit_log_days is not None:
        results["audit_log_purged"] = retention.purge_audit_log(
            settings_obj.retention_audit_log_days
        )

    if not results:
        return

    summary = ", ".join(f"{key}={value}" for key, value in results.items())
    AuditLog.objects.create(
        actor=None,
        action=AuditLog.Action.DATA_RETENTION_RUN,
        target_label=str(_("Scheduled data retention run")),
        to_value=summary,
    )
```

**Create file: `backend/apps/compliance/migrations/__init__.py`** — empty.

**Create file: `backend/apps/compliance/migrations/0001_seed_retention_schedule.py`**

```python
from django.db import migrations


def seed_retention_schedule(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="2", day_of_week="*", day_of_month="*", month_of_year="*"
    )
    PeriodicTask.objects.get_or_create(
        name="SEC-10: data retention sweep",
        defaults={
            "task": "apps.compliance.tasks.run_data_retention",
            "crontab": schedule,
            "enabled": True,
        },
    )


def unseed_retention_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="SEC-10: data retention sweep").delete()
    # The CrontabSchedule row is deliberately left in place on reverse — the
    # same "this migration only owns the PeriodicTask row it created" call
    # apps/sla/migrations/0004_seed_escalation_schedule.py already makes.


class Migration(migrations.Migration):

    dependencies = [
        # Same django_celery_beat migration SLA-3 pinned
        # (apps/sla/migrations/0004_seed_escalation_schedule.py) — verify
        # with `python manage.py showmigrations django_celery_beat` at
        # implementation time in case a newer django-celery-beat release
        # shipped a later migration since.
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_retention_schedule, unseed_retention_schedule),
    ]
```

Daily at 02:00 (server time), via `CrontabSchedule` — deliberately not `evaluate_escalations`' 5-minute `IntervalSchedule`: a compliance sweep is a nightly batch job, not a near-real-time check, and this is `django-celery-beat`'s other schedule type, already installed and unused until now.

**File: `backend/config/settings/base.py`** — add one line to `LOCAL_APPS` (current lines 59-74), after `"apps.integrations"`:

```python
    "apps.compliance",
```

**File: `backend/apps/README.md`** — add one row to the apps table (current lines 71-84), after `| integrations | ... |`:

```markdown
| `compliance` | Data retention policy enforcement and the scheduled purge/anonymization job. |
```

---

### 8 — Customer data export

**Create file: `backend/apps/customers/export.py`**

```python
"""Data-subject export — SEC-10 task 2. Assembles a machine-readable JSON
document of everything this codebase holds about one `Customer`. Attachment
file CONTENT is not embedded — each attachment's metadata is listed, and the
file itself stays reachable through the existing, permission-gated
`AttachmentViewSet.download` for as long as it has not since been purged.
Bundling binary file bytes into one response is out of scope for this
story — see the plan's `## Story Goal`.
"""

import json

from django.http import HttpResponse

from apps.communications.models import Message

from .models import Customer


def build_customer_export(customer: Customer) -> dict:
    tickets = []
    for ticket in customer.tickets.select_related("category").order_by("created_at"):
        tickets.append(
            {
                "id": ticket.id,
                "subject": ticket.subject,
                "description": ticket.description,
                "status": ticket.status,
                "priority": ticket.priority,
                "category": ticket.category.name if ticket.category_id else None,
                "created_at": ticket.created_at.isoformat(),
                "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
                "messages": [
                    {
                        "direction": message.direction,
                        "channel": message.channel,
                        "body": message.body,
                        "created_at": message.created_at.isoformat(),
                    }
                    for message in Message.objects.filter(ticket=ticket).order_by("created_at")
                ],
            }
        )

    return {
        "profile": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "company": customer.company,
            "created_at": customer.created_at.isoformat(),
        },
        "contact_details": [
            {"channel": contact.channel, "value": contact.value}
            for contact in customer.contacts.all()
        ],
        "notes": [
            {"body": note.body, "created_at": note.created_at.isoformat()}
            for note in customer.notes.all()
        ],
        "attachments": [
            {
                "id": attachment.id,
                "filename": attachment.original_filename,
                "size": attachment.size,
                "uploaded_at": attachment.created_at.isoformat(),
            }
            for attachment in customer.attachments.all()
        ],
        "tickets": tickets,
        "feedback": [
            {
                "ticket_id": feedback.ticket_id,
                "rating": feedback.rating,
                "comment": feedback.comment,
                "created_at": feedback.created_at.isoformat(),
            }
            for feedback in customer.feedback.order_by("created_at")
        ],
    }


def customer_export_response(customer: Customer) -> HttpResponse:
    """Plain `HttpResponse`, not a DRF `Response` — bypasses
    `EnvelopeJSONRenderer` exactly like `apps.reports.export.csv_response`
    (apps/reports/export.py:50-59) and `AttachmentViewSet.download`'s
    `FileResponse` (apps/customers/views.py:414-425); the same escape hatch,
    a JSON body instead of CSV/binary.
    """
    payload = build_customer_export(customer)
    content = json.dumps(payload, indent=2, ensure_ascii=False)
    response = HttpResponse(content, content_type="application/json; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="customer-{customer.id}-export.json"'
    return response
```

---

### 9 — Customer data erasure

**Create file: `backend/apps/customers/erasure.py`**

```python
"""Data-subject erasure — SEC-10 task 2. See the plan's `## Story Goal` for
why this anonymizes the `Customer` row rather than deleting it —
`Ticket.customer` is `on_delete=PROTECT`, and every `Ticket`/`AuditLog` row
must survive this action for reporting and for the erasure's own audit
trail to remain meaningful.
"""

from rest_framework.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from apps.communications.models import Message

from .models import Customer

ERASED_NAME_TEMPLATE = "Erased customer #{id}"
ERASED_CONTENT_PLACEHOLDER = "[Removed — data subject erasure request]"


def erase_customer(customer: Customer) -> None:
    """Raises DRF's `ValidationError` directly — the same "a plain
    business-logic module raises the framework exception itself" shape
    `apps.tickets.status.apply_status_change` already establishes, rather
    than a Django-level exception the view would have to translate.
    """
    if customer.legal_hold:
        raise ValidationError(
            {"non_field_errors": [_("This customer is under legal hold and cannot be erased.")]}
        )

    customer.contacts.all().delete()
    customer.notes.all().delete()
    for attachment in customer.attachments.all():
        # Same cleanup AttachmentViewSet.perform_destroy already performs
        # for a manual delete (apps/customers/views.py:404-412) — removes
        # the file from storage, not just the DB row.
        attachment.file.delete(save=False)
        attachment.delete()

    for ticket in customer.tickets.all():
        Message.objects.filter(ticket=ticket).update(body=ERASED_CONTENT_PLACEHOLDER)
        ticket.subject = ERASED_CONTENT_PLACEHOLDER
        ticket.description = ERASED_CONTENT_PLACEHOLDER
        ticket.save(update_fields=["subject", "description", "updated_at"])

    customer.feedback.update(comment="")

    customer.name = ERASED_NAME_TEMPLATE.format(id=customer.id)
    customer.email = None
    customer.phone = ""
    customer.company = ""
    customer.email_contact_enabled = False
    customer.phone_contact_enabled = False
    customer.whatsapp_enabled = False
    customer.save(
        update_fields=[
            "name",
            "email",
            "phone",
            "company",
            "email_contact_enabled",
            "phone_contact_enabled",
            "whatsapp_enabled",
            "updated_at",
        ]
    )
```

---

### 10 — `CustomerViewSet` actions: `export-data`, `erase-data`

**File: `backend/apps/customers/views.py`** — extend imports (current lines 1-26):

```python
from .erasure import erase_customer
from .export import customer_export_response
```

Add two entries to `CustomerViewSet.permission_map` (current lines 50-69), directly after `"portal_access"` (line 68):

```python
        "export_data": Permissions.CUSTOMERS_EXPORT_DATA,
        "erase_data": Permissions.CUSTOMERS_ERASE_DATA,
```

Add two new actions, directly after `portal_access` (current lines 103-117), before `_grant_portal_access`:

```python
    @action(detail=True, methods=["get"], url_path="export-data")
    def export_data(self, request, pk=None):
        """SEC-10 task 2, export half. Returns the JSON document directly
        (bypassing the envelope, see `customer_export_response`'s own
        docstring) — the frontend downloads it via `shared/lib/download.ts`,
        the same mechanism `AttachmentViewSet.download` already uses.
        """
        customer = self.get_object()
        response = customer_export_response(customer)
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.CUSTOMER_DATA_EXPORTED,
            target_customer=customer,
            target_label=customer.name,
        )
        return response

    @action(detail=True, methods=["post"], url_path="erase-data")
    def erase_data(self, request, pk=None):
        """SEC-10 task 2, erasure half. `customer_label` is captured BEFORE
        `erase_customer` blanks `customer.name` — the same "snapshot before
        the row's state changes" pattern `UserViewSet.destroy` already uses
        for `USER_DELETED` (apps/accounts/views.py, `user_label =
        user.get_full_name()` captured before the hard delete).
        """
        customer = self.get_object()
        customer_label = customer.name
        erase_customer(customer)
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.CUSTOMER_DATA_ERASED,
            target_customer=customer,
            target_label=customer_label,
        )
        return Response(CustomerSerializer(customer).data)
```

Endpoints: `GET /api/customers/<id>/export-data/`, `POST /api/customers/<id>/erase-data/`.

---

### 11 — `CONVENTIONS.md` updates

**File: `CONVENTIONS.md`** — append a new numbered section after §37 (the current last section, `## 37. Optional Docker packaging (PROD-4)`):

```markdown

---

## 38. Data retention & data-subject rights (SEC-10)

Two independent halves, deliberately living in two different apps.

**The scheduled purge/anonymize job lives in a NEW app, `apps/compliance`
— not in `tickets`/`communications`/`customers`/`accounts`, even though it
touches all four.** No single one of those apps "owns" a cross-cutting
compliance sweep any more than `tickets` owns SLA escalation — `apps/sla`
already established the precedent that a scheduled, cross-model automation
job gets its own app (`apps/README.md` rule 4). `apps/compliance` has no
`models.py` at all — the four retention-DAY settings it reads live on
`organization.OrganizationSettings` (SEC-4), read fresh on every run the
same way `apps.sla.policy.resolve_policy` already reads that model's SLA
defaults.

**The customer-scoped export/erasure actions live in `apps/customers`
instead**, as new `@action`s on the existing `CustomerViewSet` — the same
"belongs to exactly one business area, cross-app reads are normal" shape
`apps/customers/timeline.py::build_timeline` already established for
`CustomerViewSet.timeline` (`apps/README.md` rule 1 beating rule 2).

**Erasure anonymizes the `Customer` row; it never deletes it.**
`Ticket.customer` is `on_delete=PROTECT` — a customer with any ticket
history cannot be hard-deleted without breaking that guarantee, and every
`Ticket`/`AuditLog` row must survive an erasure for report aggregates and
the erasure's own audit trail to keep meaning anything. `apps.customers.
erasure.erase_customer` blanks `Customer.name`/`.email`/`.phone`/
`.company`, deletes every `ContactDetail`/`Note`/`Attachment` (row and
file), and blanks `Message.body`/`Ticket.subject`/`.description`/
`Feedback.comment` — the row, its status/priority/category/dates, and
every audit trail entry all survive untouched.

**`AuditLog` gained a third nullable target FK, `target_customer`** —
the exact `target_user`/`target_role` two-FK shape (§22, this model's own
docstring) extended by one, not replaced with a `GenericForeignKey`
(consistent with `apps/notifications/models.py`'s own established rule).

**`Ticket.closed_at` exists because `updated_at` is not a safe retention
clock for a terminal status.** `closed` has no outbound transition
(`apps/tickets/status.py::VALID_TRANSITIONS`), but a later edit to an
already-closed ticket still bumps `updated_at` — `closed_at` is set exactly
once, only inside `apply_status_change`, the same "set once, on one
specific transition" shape `escalated_at` already has.

**`Customer.legal_hold` is Django-admin-only, deliberately.** No
self-service UI in this story — the same scope boundary `external_id`
(a real serializer field, absent from the frontend form) already
establishes for an admin-only escape hatch on this same model.

**No shared Celery locking/idempotency primitive exists in this codebase
— a new scheduled task must invent its own via its own filter shape.**
`apps.compliance.retention`'s four functions are each idempotent because
they only ever re-select rows still past the cutoff and not yet in the
target end state; there is no `select_for_update`/distributed lock
anywhere in `config/celery.py`/`settings/base.py` to reuse, and none is
added by this story either.
```

Do **not** renumber §0-§37.

---

## Frontend Tasks

### 12 — Organization settings: retention fields

**File: `frontend/src/features/organization/types/settings.ts`** — add four fields to both types:

```ts
/** Mirrors `apps.organization.serializers.OrganizationSettingsSerializer`'s
 * read shape. */
export type OrganizationSettings = {
  id: number
  name: string
  logo_url: string
  primary_color: string
  default_response_target_minutes: number | null
  default_resolution_target_minutes: number | null
  retention_closed_tickets_days: number | null
  retention_messages_days: number | null
  retention_attachments_days: number | null
  retention_audit_log_days: number | null
  created_at: string
  updated_at: string
}

/** The write shape — no `id`/`created_at`/`updated_at`, all server-managed. */
export type SettingsInput = {
  name: string
  logo_url: string
  primary_color: string
  default_response_target_minutes: number | null
  default_resolution_target_minutes: number | null
  retention_closed_tickets_days: number | null
  retention_messages_days: number | null
  retention_attachments_days: number | null
  retention_audit_log_days: number | null
}
```

**File: `frontend/src/features/organization/components/SettingsPage.tsx`** — extend `schema` (current lines 21-58), adding four fields inside the `z.object({...})` (after `default_resolution_target_minutes`, line 27):

```ts
    retention_closed_tickets_days: nullablePositiveInt(),
    retention_messages_days: nullablePositiveInt(),
    retention_attachments_days: nullablePositiveInt(),
    retention_audit_log_days: nullablePositiveInt(),
```

Extend `toDefaults` (current lines 62-70) and `toSettingsInput` needs no change (it already spreads `{ ...values }`, line 72-74). Add to `toDefaults`:

```ts
    retention_closed_tickets_days: settings.retention_closed_tickets_days,
    retention_messages_days: settings.retention_messages_days,
    retention_attachments_days: settings.retention_attachments_days,
    retention_audit_log_days: settings.retention_audit_log_days,
```

Add a second `<Card>` in `SettingsForm`'s JSX, directly after the closing `</Card>` of the branding/SLA card (current line 185), before `<FormErrorSummary errors={formErrors} />` (line 186):

```tsx
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField
                control={form.control}
                name="retention_closed_tickets_days"
                type="number"
                label={t('settings.fields.retentionClosedTicketsDays')}
                description={t('settings.retentionHint')}
              />
              <TextField
                control={form.control}
                name="retention_messages_days"
                type="number"
                label={t('settings.fields.retentionMessagesDays')}
              />
              <TextField
                control={form.control}
                name="retention_attachments_days"
                type="number"
                label={t('settings.fields.retentionAttachmentsDays')}
              />
              <TextField
                control={form.control}
                name="retention_audit_log_days"
                type="number"
                label={t('settings.fields.retentionAuditLogDays')}
              />
            </CardContent>
          </Card>
```

The description hint sits once, on the first field, matching how `primary_color` alone carries `colorHint` for the branding card above.

**File: `frontend/src/features/organization/locales/en.json`** — extend `settings.fields` (current lines 5-11) and add one hint key after `colorPreview` (line 14):

```json
    "fields": {
      "name": "Organization name",
      "logoUrl": "Logo URL",
      "primaryColor": "Brand colour",
      "defaultResponseMinutes": "Default response target (minutes)",
      "defaultResolutionMinutes": "Default resolution target (minutes)",
      "retentionClosedTicketsDays": "Closed ticket retention (days)",
      "retentionMessagesDays": "Message retention (days)",
      "retentionAttachmentsDays": "Attachment retention (days)",
      "retentionAuditLogDays": "Audit log retention (days)"
    },
    "colorHint": "Enter a colour as #RRGGBB. Leave blank to use the default brand colour.",
    "invalidColor": "Enter a colour as #RRGGBB.",
    "colorPreview": "Brand colour preview",
    "retentionHint": "Leave any field blank to disable automatic removal for that data class.",
```

**File: `frontend/src/features/organization/locales/ar.json`** — the identical structural change (mirror every new key above, translated; the executor matches this file's existing tone for the four labels and the hint).

---

### 13 — `frontend/src/features/customers/api/`: export and erase

**Create file: `frontend/src/features/customers/api/exportCustomerData.ts`**

```ts
import { downloadFile } from '@/shared/lib/download'

export function exportCustomerData(customerId: number, filename: string): Promise<void> {
  return downloadFile(`/customers/${customerId}/export-data/`, filename)
}
```

**Create file: `frontend/src/features/customers/api/eraseCustomerData.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function eraseCustomerData(customerId: number): Promise<Customer> {
  return api.post<Customer>(`/customers/${customerId}/erase-data/`)
}
```

**File: `frontend/src/features/customers/api/useCustomerMutations.ts`** — add import and one hook, after `useRevokePortalAccess` (grep the file for its definition — same file `revokePortalAccess.ts`'s hook lives in):

```ts
import { eraseCustomerData } from './eraseCustomerData'
```

```ts
export function useEraseCustomerData(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eraseCustomerData(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
```

---

### 14 — `CustomerProfilePage.tsx`: Export data / Erase data

**File: `frontend/src/features/customers/components/CustomerProfilePage.tsx`** — extend imports (current lines 1-23):

```tsx
import { exportCustomerData } from '../api/exportCustomerData'
import { useEraseCustomerData } from '../api/useCustomerMutations'
```

(`useEraseCustomerData` joins the existing `useDeleteCustomer, useGrantPortalAccess, useRevokePortalAccess` import from `'../api/useCustomerMutations'`, current lines 15-19.)

Add one mutation and one handler inside `CustomerProfilePage` (current lines 25-72), alongside the existing ones:

```tsx
  const eraseMutation = useEraseCustomerData(id)

  async function handleExportData(customer: { id: number; name: string }) {
    try {
      await exportCustomerData(customer.id, `customer-${customer.id}-export.json`)
    } catch {
      toast({ tone: 'error', message: t('dataRights.exportFailed') })
    }
  }

  async function handleEraseData() {
    const confirmed = await confirm({
      title: t('dataRights.eraseConfirm.title'),
      description: t('dataRights.eraseConfirm.description'),
      destructive: true,
    })
    if (!confirmed) return
    try {
      await eraseMutation.mutateAsync()
      toast({ tone: 'success', message: t('dataRights.erased') })
    } catch (error) {
      if (isValidationError(error)) {
        toast({ tone: 'error', message: error.message })
      }
    }
  }
```

Add `import { isValidationError } from '@/shared/validation/serverErrors'` — needed to surface the `legal_hold` refusal's translated message (the `non_field_errors` validation error `erase_customer` raises) rather than only the generic global-mutation-error toast; mirrors how `LoginPage.tsx`/`ChangePasswordSection.tsx` already read `isValidationError` for a field-specific case, adapted here to a non-field-error string.

Add a new `<Can>`-gated block inside the existing top `<Card>`'s `<CardContent>` (current lines 89-158), as a sibling to the existing `<Can permission="customers.manage">` block, directly after its closing `</Can>` (line 157):

```tsx
                  <Can permission="customers.export_data">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleExportData(customer)}
                    >
                      {t('dataRights.export')}
                    </Button>
                  </Can>
                  <Can permission="customers.erase_data">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={eraseMutation.isPending}
                      onClick={() => void handleEraseData()}
                    >
                      {t('dataRights.erase')}
                    </Button>
                  </Can>
```

Each wrapped separately (not nested inside the `customers.manage`-gated block) — an org may grant `customers.export_data`/`customers.erase_data` to a compliance role that does not otherwise hold `customers.manage`, per this story's own "a dedicated permission" requirement.

---

### 15 — Customers locale additions

**File: `frontend/src/features/customers/locales/en.json`** — add a new top-level `dataRights` object, after `portalAccess` (current lines 39-52), before `contacts` (line 53):

```json
  "dataRights": {
    "export": "Export data",
    "erase": "Erase data",
    "exportFailed": "Could not generate the data export.",
    "erased": "Customer data erased.",
    "eraseConfirm": {
      "title": "Erase this customer's data?",
      "description": "This permanently removes their contact details, notes, and attachments, and blanks the content of their tickets and messages. Their ticket history and record are kept for reporting, but their personal details are gone. This cannot be undone."
    }
  },
```

**File: `frontend/src/features/customers/locales/ar.json`** — the identical structural change (mirror every key above, translated; the executor matches this file's existing tone, following `portalAccess.revokeConfirm`'s own nesting exactly).

---

### 16 — Audit-log frontend: `target_customer`, the three new actions, and the pre-existing 2FA gap

**File: `frontend/src/features/audit-log/types/auditLog.ts`** — replace the file in full:

```ts
/** Mirrors `apps.accounts.models.AuditLog.Action` values. */
export const AUDIT_LOG_ACTIONS = [
  'user_created',
  'user_role_changed',
  'user_status_changed',
  'user_deleted',
  'role_created',
  'role_renamed',
  'role_permissions_changed',
  'role_deleted',
  'portal_access_granted',
  'portal_access_revoked',
  'two_factor_enabled',
  'two_factor_disabled',
  'two_factor_reset',
  'two_factor_recovery_code_used',
  'data_retention_run',
  'customer_data_exported',
  'customer_data_erased',
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
  target_customer: number | null
  target_label: string
  from_value: string
  to_value: string
  created_at: string
}
```

The four `two_factor_*` entries were already live on the backend since Story 107 (SEC-9) but missing from this mirror — a found gap, fixed here in the same edit as SEC-10's own three new values, since both touch this identical array.

**File: `frontend/src/features/audit-log/api/getAuditLogs.ts`** — widen the `target_type` param type (current line 9):

```ts
  target_type?: 'user' | 'role' | 'customer'
```

**File: `frontend/src/features/audit-log/components/AuditLogListPage.tsx`** — widen the cast at the `target_type` params spread (current line 49):

```ts
    ...(targetTypeFilter !== 'all' ? { target_type: targetTypeFilter as 'user' | 'role' | 'customer' } : {}),
```

Add a third `<SelectItem>` to the target-type `<Select>` (current lines 100-109), after `role` (line 107):

```tsx
            <SelectItem value="customer">{t('filters.targetTypeCustomer')}</SelectItem>
```

**File: `frontend/src/features/audit-log/locales/en.json`** — add one filter key and seven action keys (four retroactive 2FA + three new SEC-10):

```json
    "targetTypeRole": "Roles",
    "targetTypeCustomer": "Customers"
```

```json
    "portal_access_revoked": "Portal access revoked",
    "two_factor_enabled": "Two-factor authentication enabled",
    "two_factor_disabled": "Two-factor authentication disabled",
    "two_factor_reset": "Two-factor authentication reset by admin",
    "two_factor_recovery_code_used": "Two-factor recovery code used",
    "data_retention_run": "Scheduled data retention run",
    "customer_data_exported": "Customer data exported",
    "customer_data_erased": "Customer data erased"
```

**File: `frontend/src/features/audit-log/locales/ar.json`** — the identical structural change, translated, matching this file's existing entries for the ten pre-existing actions.

---

## Edge Cases & Failure Modes

- **A retention day field left blank disables that data class entirely.** `run_data_retention` skips any class whose `OrganizationSettings` field is `None` — the default state for every org until an admin opts in, matching `default_response_target_minutes`'s own "blank = no policy" precedent.
- **A customer under `legal_hold` is skipped by every purge/anonymize pass, and `erase_customer` refuses outright with a clean `400 validation_error`** (`non_field_errors`), not a silent no-op and not a 500 — verified by `erase_customer`'s own leading guard clause.
- **Re-running `run_data_retention` (a missed beat tick, a manual `.delay()` in a shell) is always safe.** Every filter re-selects "still past cutoff, not yet in the end state" rows; an already-anonymized ticket is excluded by its own placeholder text, an already-purged message/attachment/audit row simply no longer exists to be selected again.
- **A ticket still `OPEN`/`IN_PROGRESS`/`RESOLVED` is never touched by the retention job, regardless of age** — every retention filter keys off `status=CLOSED` (or, for messages, the parent ticket being closed); an old-but-still-open ticket is not "past the limit," it is still active work.
- **`purge_attachments` always deletes the physical file before the DB row**, exactly like `AttachmentViewSet.perform_destroy` — an interrupted run (worker killed mid-loop) can leave a file deleted with its row still present for one iteration, never the reverse (a DB row deleted with an orphaned file still on disk); the next run's `Attachment.objects.filter(created_at__lt=cutoff)` still finds and finishes that row.
- **Exporting a customer with zero tickets/notes/attachments/feedback returns a well-formed JSON document with empty arrays**, not an error — `build_customer_export` never assumes any related queryset is non-empty.
- **`export_data`/`erase_data` are both real, closed actions with explicit `permission_map` entries** — an unmapped custom `@action` on a `BaseModelViewSet` subclass would fall through to authenticated-only (`HasPermission`'s grant-on-omission rule, `CONVENTIONS.md` §22), which is not the intended default for either.
- **Erasing a customer who also has a linked portal login (`Customer.user`) does not touch that `accounts.User` row at all.** The account keeps its email/password and can still sign in to the portal after the CRM record is anonymized — a real, deliberate scope boundary (see `## Story Goal`'s "explicitly out of scope"), not an oversight. A full data-subject request for such a customer needs a second, separate action (Story 71's user-deletion path) that this story does not wire together automatically.
- **The scheduled job's own `AuditLog` row has `actor=None`** (no human triggered it) — `AuditLogSerializer.actor_name`'s existing `allow_null=True` dotted-source already renders this as `None`/"deleted actor" the same way it already does for any row whose actor account was later removed; no new frontend handling is needed.
- **A `Ticket`/`Message` erased or anonymized (by either the scheduled job or the erasure action) keeps its `id`, `created_at`, `status`, `priority`, `category`, `department`, `branch`, and — for tickets — `closed_at` intact.** Only the free-text content changes; every dimension `apps/reports/aggregation.py` can group by survives unchanged, which is what makes the intake's "so RPT-* aggregates do not break" constraint hold.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py makemigrations --check tickets customers organization accounts` from `backend/` with the venv active.
2. `python manage.py test` — the existing suite must still pass.
3. `ruff format --check .` / `ruff check .` on every changed/new Python file, including the new `apps/compliance/` package.
4. `npm run build` — typechecks every new/changed TSX/TS file and every new `t('organization:settings...')`/`t('customers:dataRights...')`/`t('auditLog:...')` key.
5. `npm run lint` / `npm run format:check` / `npm run check:rtl`.
6. The `en`/`ar` key-set comparison script, run against `frontend/src/features/organization/locales`, `frontend/src/features/customers/locales`, and `frontend/src/features/audit-log/locales`.
7. Real HTTP + a real browser walkthrough — Verification Steps 4-13 below.

---

## Migration / Rollback

**Schema migrations**: `apps/tickets/migrations/0014_ticket_closed_at.py`, `apps/customers/migrations/0011_customer_legal_hold.py`, `apps/organization/migrations/0015_organizationsettings_retention_fields.py`, `apps/accounts/migrations/0017_auditlog_target_customer_and_more.py`, `apps/compliance/migrations/0001_seed_retention_schedule.py` — all additive (new nullable/defaulted columns, one new FK, one seeded `PeriodicTask` row). Safe against a populated database; every existing `Ticket`/`Customer`/`OrganizationSettings`/`AuditLog` row gets the column's default (`NULL`/`False`) with no data migration needed.

**Rollback of the code**: revert the commits. No new pip/npm dependency was added.

**Rollback of the migrations**: `python manage.py migrate compliance zero` (removes the seeded `PeriodicTask` — the `CrontabSchedule` row itself is deliberately left behind, per the migration's own reverse function), then `accounts 0016_two_factor_authentication`, `organization 0014_landing_hero_image`, `customers 0010_customer_email_contact_enabled_and_more`, `tickets 0013_ticket_merged_into_alter_ticketactivity_kind`, in that order (accounts' `target_customer` FK depends on `customers`' `legal_hold` migration being present, so roll back `accounts` before `customers`).

**Half-applied states to avoid**:

- **Task 5's migration (`accounts/0017_...`) applied before task 4's `customers/0011_customer_legal_hold`** → Django's own migration-graph dependency check refuses to apply `0017` out of order (the migration file declares `("customers", "0011_customer_legal_hold")` as a dependency), so this fails loudly at `migrate` time, not silently.
- **Task 7 (`apps/compliance`) added to `LOCAL_APPS` before its `migrations/__init__.py` exists** → `python manage.py migrate`/`makemigrations` raises `ModuleNotFoundError` for the missing migrations package. Create the empty `__init__.py` in the same change as the app registration.
- **Task 10 (`CustomerViewSet` imports `apps.customers.erasure`/`.export`) before tasks 8/9 (those files existing)** → `ImportError` at Django startup.
- **Task 14 (`CustomerProfilePage.tsx` imports `useEraseCustomerData`/`exportCustomerData`) before task 13 (the API files existing)** → the import fails, `tsc -b` fails.
- **Task 14/15 before task 15's locale keys** → every new `t('customers:dataRights...')` call fails `tsc -b`, the same failure mode `CONVENTIONS.md` §23 documents for a components-before-locales ordering.

---

## Verification Steps

1. **Backend checks and formats clean**: from `backend/` with the venv active — `python manage.py check`, `python manage.py makemigrations --check tickets customers organization accounts`, `ruff format --check .`, `ruff check .`.
2. **Backend regression**: `python manage.py test` — the existing suite still passes.
3. **`en`/`ar` key sets match** for `features/organization/locales`, `features/customers/locales`, `features/audit-log/locales` (`## Test Plan` item 6).
4. **The retention job anonymizes closed tickets and purges messages, in isolation.** Set `retention_closed_tickets_days`/`retention_messages_days` to `1` via `PATCH /api/settings/`; manually backdate a test ticket's `closed_at` (e.g. via Django shell) to 2 days ago; run `python manage.py shell -c "from apps.compliance.tasks import run_data_retention; run_data_retention()"`. Confirm: the ticket's `subject`/`description` are now the placeholder text, its `status`/`priority`/`category`/`closed_at` are unchanged, and its messages are gone (`ticket.messages.count() == 0`). Confirm one new `AuditLog` row, `action=data_retention_run`, `actor=None`, with a `to_value` summary mentioning both counts.
5. **A customer under legal hold is skipped.** Repeat step 4 against a second backdated, closed ticket whose `customer.legal_hold = True` (set via Django admin or shell) — confirm its `subject`/`description`/messages are untouched after the same task run.
6. **Attachment purge removes the file from disk, not just the row.** Backdate an `Attachment.created_at` past a configured `retention_attachments_days`; run the task; confirm the row is gone (`Attachment.objects.filter(pk=...).exists()` is `False`) **and** the file under `MEDIA_ROOT` no longer exists on disk.
7. **Audit log purge removes old rows.** Backdate a handful of `AuditLog` rows past a configured `retention_audit_log_days`; run the task; confirm they are gone and a fresh `data_retention_run` summary row exists.
8. **The scheduled `PeriodicTask` exists and is enabled** immediately after `migrate` — `django_celery_beat.models.PeriodicTask.objects.get(name="SEC-10: data retention sweep")` — `enabled=True`, `task="apps.compliance.tasks.run_data_retention"`, `crontab.hour="2"`, `crontab.minute="0"`.
9. **Customer export returns a well-formed JSON document.** As a `customers.export_data` holder: `GET /api/customers/<id>/export-data/` → `200`, `Content-Type: application/json`, `Content-Disposition: attachment; filename="customer-<id>-export.json"`. Confirm `profile`/`contact_details`/`notes`/`attachments`/`tickets`/`feedback` keys are all present, and every message on every one of that customer's tickets appears under its ticket's `messages` array. Confirm one new `AuditLog` row, `action=customer_data_exported`, `target_customer=<id>`.
10. **Customer erasure blanks personal fields and deletes ancillary records, but keeps the row and ticket history.** As a `customers.erase_data` holder: `POST /api/customers/<id>/erase-data/` on a customer with at least one contact detail, one note, one attachment, and one closed ticket with messages → `200`. Confirm: `GET /api/customers/<id>/` still succeeds (the row exists) with `name` now `"Erased customer #<id>"`, `email: null`, `phone: ""`, `company: ""`; `contacts`/`notes`/`attachments` for that customer are all empty; the ticket's `subject`/`description` are the erasure placeholder and its messages' `body` are too, while `status`/`priority`/`created_at` are unchanged. Confirm one new `AuditLog` row, `action=customer_data_erased`, `target_customer=<id>`, `target_label` = the customer's ORIGINAL name (not the erased placeholder).
11. **Erasure refuses a customer under legal hold.** `POST /api/customers/<id>/erase-data/` for a `legal_hold=True` customer → `400 validation_error`, `non_field_errors`. Confirm nothing on that customer changed.
12. **Both new permissions gate independently of `customers.manage`.** As a user holding `customers.view` + `customers.export_data` but NOT `customers.manage`/`customers.erase_data`: `GET /api/customers/<id>/export-data/` → `200`; `POST /api/customers/<id>/erase-data/` → `403 permission_denied`.
13. **The full UI walkthrough, both languages.** `npm run dev` with the backend up:
    - `/settings` shows a new "data retention" card with four numeric fields below the existing branding/SLA card; saving round-trips correctly (reload shows the saved values).
    - A customer profile page (as a `customers.export_data`+`customers.erase_data` holder) shows "Export data" and "Erase data" buttons; clicking "Export data" downloads a `.json` file; clicking "Erase data" shows a confirm dialog, and confirming shows a success toast and the profile's displayed name/email/phone update to the erased state.
    - `/audit-log` shows a third "Customers" option in the target-type filter, and the new `two_factor_*`/`data_retention_run`/`customer_data_exported`/`customer_data_erased` actions all render translated labels (not raw snake_case strings) in the action column and the action filter dropdown.
    - Switch to Arabic: every new string above (settings card, both customer buttons, the confirm dialog, the audit-log filter and action labels) is translated, `dir="rtl"`.
14. **No hardcoded strings.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\organization\components\SettingsPage.tsx,src\features\customers\components\CustomerProfilePage.tsx,src\features\audit-log\components\AuditLogListPage.tsx -Pattern "'[A-Z][a-z]{3,}"
    ```

    Must return only non-user-facing hits.
15. **The full gate set, in CI order**: from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `Ticket.closed_at` is set exactly once, only inside `apply_status_change`, on the `CLOSED` transition; exposed read-only on `TicketSerializer`.
- [ ] `Customer.legal_hold` exists, is admin-editable via `CustomerAdmin`, and is respected by both the retention job (every data class it applies to) and `erase_customer` (a hard refusal, `400`, not a silent no-op).
- [ ] `OrganizationSettings` gains four independent, nullable retention-day fields, each opt-in (blank = disabled for that class); exposed on `OrganizationSettingsSerializer`/`SettingsView`, editable on `SettingsPage.tsx`.
- [ ] `AuditLog` gains `target_customer` (third nullable FK, same shape as `target_user`/`target_role`) and three new `Action` values; `AuditLogViewSet`'s `target_type` filter and the frontend audit-log viewer both support `"customer"`.
- [ ] A new `apps/compliance` app (no models, `apps.py`/`retention.py`/`tasks.py`/one seed migration) runs `run_data_retention` daily via a seeded `PeriodicTask`/`CrontabSchedule`, verified live (Verification Steps 4, 6-8): anonymizes closed tickets past their limit, purges messages/attachments (row **and** file)/audit-log rows past theirs, skips every customer under legal hold, and writes one summary `AuditLog` row per run.
- [ ] `CustomerViewSet` gains `export_data`/`erase_data` actions, each gated by its own new permission (`customers.export_data`/`customers.erase_data`, no reuse of `customers.manage`), each writing its own `AuditLog` row with a name snapshot captured before any state change (Verification Steps 9-12).
- [ ] Export returns a well-formed JSON document (profile, contacts, notes, every ticket's messages, attachment metadata, feedback) via a plain `HttpResponse` bypassing the envelope, exactly like `apps.reports.export.csv_response`.
- [ ] Erasure anonymizes the `Customer` row and deletes every `ContactDetail`/`Note`/`Attachment` (row and file) and blanks `Message`/`Ticket`/`Feedback` free-text content, while the `Customer` row, every `Ticket` row's structured fields, and every `AuditLog` row all survive.
- [ ] `frontend/src/features/audit-log/types/auditLog.ts` and its locale files include the four Story-107 `two_factor_*` actions that were previously missing, alongside SEC-10's own three new ones — the found gap and the new scope fixed in the same edit.
- [ ] All new locale keys added to both `en`/`ar` files in `features/organization/locales`, `features/customers/locales`, `features/audit-log/locales`; key sets match (Verification Step 3).
- [ ] `CONVENTIONS.md` gains a new `## 38. Data retention & data-subject rights (SEC-10)` section; `apps/README.md`'s app table gains the `compliance` row.
- [ ] `python manage.py test` still passes; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story's row; `.squad/plans/00-index.md`'s `security-administration` NN range updated to include `110`.
