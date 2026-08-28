# Story 32 — Tasks & Reminders (Story: SUPPORTOS-47)

## Prerequisites

- **`SLA-4` (Alerts & Notifications) is complete in the working tree**, not just planned — the intake's own only named dependency beyond `AUTH-1` (auth, long since shipped). Verified by direct inspection, not by trusting [`../sla-automation/31-story-alerts-notifications-SUPPORTOS-63.md`](../sla-automation/31-story-alerts-notifications-SUPPORTOS-63.md)'s text alone: `backend/apps/notifications/{models,serializers,services,tasks,views,urls,admin}.py` all exist on disk and match that plan verbatim; `apps.tickets.assignment.apply_assignment` (`backend/apps/tickets/assignment.py` lines 16-17, 65-72) and `apps.tickets.escalation.apply_escalation` (`backend/apps/tickets/escalation.py` lines 11-12, 30-37) already call `apps.notifications.services.notify(...)`; `frontend/src/features/notifications/` (types, api, `NotificationBell.tsx`, locales) exists and is wired into `frontend/src/app/RootLayout.tsx` and `frontend/src/shared/i18n/resources.ts`. This story's own "due notifications" (task 2) is entirely built on top of `apps.notifications.services.notify` and the already-shipped `NotificationBell` — it adds **zero** new delivery UI of its own.
- **`apps.notifications.services.notify(recipient, kind, *, title, body="", ticket=None)`** (`backend/apps/notifications/services.py` lines 22-55) is the one entry point every event source calls. It creates a `Notification` row, best-effort broadcasts it over the per-user Channels group `notifications_<user id>`, and best-effort queues `send_notification_email` — all already built. Task 6's `send_due_task_reminders` calls this exactly the way `apply_assignment`/`apply_escalation` already do; it adds no new delivery mechanism.
- **`Notification.Kind` (`backend/apps/notifications/models.py` lines 18-20) currently has exactly two values** (`ticket_assigned`, `ticket_escalated`) — Story 31's own `## Story Goal` names "future: tasks, collaboration, SLA, AI" as consumers still to come. Task 5 is the first of those: it adds `TASK_DUE = "task_due"`, a normal `AlterField` migration (choices are validated in Python, not enforced at the database level, so this is schema-inert) — the same kind of change any future consumer of the shared service will make.
- **The frontend `NotificationKind` union (`frontend/src/features/notifications/types/notification.ts` line 1) must be extended in lockstep** — its own doc comment says it "Mirrors `apps.notifications.serializers.NotificationSerializer` verbatim," and `NotificationBell.tsx` renders whatever `notification.title`/`created_at` the server sends regardless of `kind`, so a `task_due` notification already displays correctly there with **zero** component changes — only the type (and the currently-unused-but-mirrored `kinds` locale block, `frontend/src/features/notifications/locales/en.json` lines 7-10) need the new value, for type-correctness, not new behaviour.
- **`apps/README.md` line 71 names `apps.agents` as the owner of "Agent workspace: assignment views, tasks, quick replies, collaboration."** `backend/apps/agents/{models,views,admin}.py` are each still exactly one line of `startapp` scaffolding (verified — `# Create your models here.` / `# Create your views here.` / `# Register your models here.`), and `backend/apps/agents/apps.py` already declares `name = "apps.agents"` correctly. `"apps.agents"` is already present in `INSTALLED_APPS` (`backend/config/settings/base.py` line 62, between `apps.communications` and `apps.sla`) — **no `LOCAL_APPS` change needed**. This is this app's first real content; no `serializers.py`/`urls.py`/`tasks.py` exist yet (`apps/README.md`'s "files are created on demand" rule).
- **"Personal tasks" (intake, task 1) means owner-scoped, not domain-permission-gated — the same design `NotificationViewSet` (Story 31, `backend/apps/notifications/views.py` lines 11-41) already established for a resource with no group/role concept.** No role in this system bundles a "tasks" permission, and every action here is scoped to `request.user`'s own rows via `get_queryset`, not a `permission_map` string — there is nothing for one to name. `TaskViewSet` therefore also does **not** extend `apps.core.views.BaseModelViewSet` (`backend/apps/core/views.py` lines 12-31), the same deliberate deviation `NotificationViewSet` made, for the same reason. **Where this story's viewset differs from `NotificationViewSet`:** `NotificationViewSet` is `ListModelMixin`+`RetrieveModelMixin`+`GenericViewSet` because a `Notification` has no create/update/destroy surface at all (system-managed only, Story 31 `## Prerequisites`); `TaskViewSet` is a full `viewsets.ModelViewSet` because a task **is** authored and edited by its owner. That difference has a real consequence for the serializer — see the `completed_at`/`reminder_sent_at` note below.
- **`Task.ticket` is `SET_NULL`, not `CASCADE`, unlike `Notification.ticket` (`backend/apps/notifications/models.py` lines 35-42, `CASCADE`).** A `Notification` is *about* an event on that ticket and has no meaning once it is gone; a personal task's own existence is not tied to the ticket it optionally references — the intake's own wording is "optional ticket link" (`SupportOs backlog.MD` line 429). This is the same reasoning `Ticket.category`'s own `SET_NULL` already uses (`backend/apps/tickets/models.py` lines 59-72): deleting the referenced row should unlink, not cascade-delete, the referencing one.
- **`due_at` is required, not nullable — a documented reading of the intake's own parenthetical, not an invented requirement.** `SupportOs backlog.MD` line 429: *"Implement personal tasks (optional ticket link, due date)"* — grammatically, "optional" modifies "ticket link"; "due date" is the second, separate attribute a task/reminder is defined by. This also has to be true for task 2 to make sense at all: a due-date-less task has nothing for `send_due_task_reminders` (task 6) to fire on.
- **No new `Permissions` constant, no permission-grant migration** (`backend/apps/core/permissions.py` lines 18-33, unchanged) — same reasoning as `NotificationViewSet`, above.
- **`ticket_subject` (this story's read-only convenience field, mirroring `NotificationSerializer.ticket_subject`, `backend/apps/notifications/serializers.py` lines 8-12) gets no extra permission check**, even though the caller who links a ticket to their task might, at write time or later, not hold `tickets.view`. This is a deliberate, precedented choice, not an oversight: Story 26's `TicketViewSet.context` double-checks `customers.view` because its payload embeds a **full** `CustomerSerializer` record (`.squad/plans/agent-workspace/26-story-customer-context-panel-SUPPORTOS-46.md` `## Prerequisites`); `NotificationSerializer.ticket_subject` — the exact same single-string-field shape this story reuses — has never been held to that bar, because a subject line is not a full record. Task's own picker (`useTicketOptions`, task 12) calls `GET /api/tickets/?page_size=100`, itself gated `tickets.view` (`TicketViewSet.permission_map["list"]`) — a caller without it simply sees an empty picker, the exact same graceful degradation `TicketFormPage`'s own `useCustomerOptions`/`useCategories` already have for a `customers.view`-less caller (`frontend/src/features/tickets/components/TicketFormPage.tsx` lines 106-107, 149). See `## Edge Cases & Failure Modes`.

---

## Story Goal

1. **`Task`/`Reminder` model + API** (`apps.agents`, this app's first real content): a personal task, owned by exactly one agent, with a required title, optional description, required `due_at`, and an optional `ticket` link. Full CRUD (`GET/POST /api/tasks/`, `GET/PATCH/DELETE /api/tasks/<id>/`) plus two actions, `complete`/`reopen`, mirroring `NotificationViewSet.mark_read`'s shape. Scoped to the caller (`owner=request.user`) — never visible to, or editable by, anyone else.
2. **Tasks/reminders UI + due notifications**: a `TaskListPage` (list, sortable by due date, filterable pending/completed) and `TaskFormPage` (create/edit, reusing the same `useAppForm`/field-component pattern every other feature form uses) under a new `/tasks` route, plus `apps.agents.tasks.send_due_task_reminders` — a periodic Celery task (`django-celery-beat`, every 5 minutes, seeded live by a data migration exactly like `SLA-3`'s `evaluate_escalations`) that calls the already-built `notify(...)` once a task's `due_at` has passed. Delivery — the bell, the badge, the toast — is **entirely** the already-shipped `NotificationBell`; this story adds no second notification UI.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `Task` model (`owner`, `ticket`, `title`, `description`, `due_at`, `completed_at`, `reminder_sent_at`) | "Personal tasks (optional ticket link, due date)... reminders persistence" (intake, task 1). |
| `TaskViewSet` — full CRUD + `complete`/`reopen`, owner-scoped, no `permission_map` | "Personal" (intake) — the same no-domain-permission design `NotificationViewSet` established. |
| `apps.agents.tasks.send_due_task_reminders`, calling `notify(...)` | "Trigger via shared notification system" (intake, task 2), reusing Story 31's service wholesale. |
| `TaskListPage`/`TaskFormPage`, reusing `DataTable`/`useAppForm`/`SelectField`/`TextField` | "UI reusing primitives" (intake, task 2). |

**Not here, and why:**

- **No new notification delivery UI.** "Trigger via shared notification system" (intake) is read literally — `NotificationBell` (Story 31) already renders whatever `notify(...)` creates; this story adds no toast, badge, or dropdown of its own.
- **No `Task` detail/read page.** Every other CRUD feature in this project (`Customer`, `Ticket`) has a dedicated `:id` detail route because a customer/ticket accumulates related sub-resources (notes, attachments, conversation, history) worth a standalone page. A task has none of that — editing **is** the entire interaction, the same "one component for both create and edit" pattern `TicketFormPage`/`CustomerFormPage` already use (`CONVENTIONS.md` §20's worked example). `TaskFormPage` is reached at both `/tasks/new` and `/tasks/:id/edit`; there is no `/tasks/:id`.
- **No `TASKS_VIEW`/`TASKS_MANAGE` permission.** See `## Prerequisites` — a personal resource has no role/domain concept to gate.
- **No `Collaboration`/`QuickReply` model.** Those are `AGENT-4`/`AGENT-5`'s own stories (`SupportOs backlog.MD` lines 432-444), unbuilt, and not asked for here.
- **No search-as-you-type ticket picker.** `useTicketOptions` (task 12) lists up to `page_size=100` tickets, the exact same simplification `getCustomerOptions.ts` already accepted (`frontend/src/features/tickets/api/getCustomerOptions.ts` lines 6-9) — no combobox primitive exists yet in this codebase.
- **No server-side "overdue"/"upcoming" filter.** Only `?completed=true|false` is a real query-param filter (mirroring the `status`/`assigned_to_me` equality-filter contract, `CONVENTIONS.md` §23). "Overdue" is a client-side visual computed from `due_at`/`completed_at` already on the row — the same kind of derived, non-persisted state `Ticket.escalated`'s own UI treatment elsewhere in this project uses, not a new backend concept.

---

## Context — Read These Files First

**Backend**

1. `.squad/stories/agent-workspace/SUPPORTOS-47/intake.md` — two task blocks, **no attachments, no acceptance criteria**; `SupportOs backlog.MD` lines 425-430 (`EPIC 6`, `STORY (AGENT-3) — Tasks & Reminders`) is its source, re-verified directly against the file for this plan.
2. `backend/apps/notifications/models.py` (55 lines, Story 31, full file) — `Notification.Kind` (lines 18-20), task 5 adds `TASK_DUE` as a third value; the `ticket` field's `CASCADE` (lines 33-42), contrasted in `## Prerequisites` with this story's own `SET_NULL`.
3. `backend/apps/notifications/services.py` (56 lines, full file) — `notify(recipient, kind, *, title, body="", ticket=None)` (lines 22-55), called verbatim by task 6.
4. `backend/apps/notifications/serializers.py` (27 lines, full file) — `NotificationSerializer.ticket_subject` (lines 8-12), the exact pattern task 2's `TaskSerializer.ticket_subject` copies.
5. `backend/apps/notifications/views.py` (42 lines, full file) — `NotificationViewSet` (lines 11-41): no `BaseModelViewSet`, `permission_classes = [IsAuthenticated]` only, `get_queryset` scoped to `recipient=request.user` (lines 23-24), and `mark_read` (lines 26-32) — the exact `@action(detail=True, methods=["post"])` / `self.get_object()` / guarded-write / `Response(self.get_serializer(...).data)` shape task 3's `complete`/`reopen` copy.
6. `backend/apps/notifications/urls.py` (11 lines, full file) — `SimpleRouter` + explicit `basename=` (required because the viewset has no `queryset` class attribute, only `get_queryset()`) — task 3's `apps/agents/urls.py` follows this exactly.
7. `backend/apps/sla/tasks.py` (70 lines, full file) — `@shared_task` module-docstring/no-op-is-normal tone (both tasks); task 6's `send_due_task_reminders` follows this shape.
8. `backend/apps/sla/migrations/0004_seed_escalation_schedule.py` (38 lines, full file) — the `IntervalSchedule.objects.get_or_create(every=5, period="minutes")` + `PeriodicTask.objects.get_or_create(name=..., defaults={"task": ..., "interval": schedule, "enabled": True})` shape, and its own reverse-migration comment (lines 22-26) explaining why the `IntervalSchedule` row is deliberately **not** deleted on reverse — task 6's `0002_seed_due_reminder_schedule.py` reuses the identical `every=5, period="minutes"` row (a `get_or_create` match, not a new row) and must keep the same reverse-migration caution, doubly so now that two `PeriodicTask`s share it.
9. `backend/apps/tickets/assignment.py` (73 lines, full file, after Story 31) and `backend/apps/tickets/escalation.py` (38 lines, full file, after Story 31) — both already call `notify(...)` (lines 16-17/65-72 and 11-12/30-37 respectively); confirms Story 31's wiring is real, not just planned. No changes needed here.
10. `backend/apps/tickets/models.py` — `Ticket.category`'s `SET_NULL` reasoning (lines 59-72), the precedent task 1's `Task.ticket` field cites.
11. `backend/apps/accounts/models.py` — `User` (lines 89-134): `AUTH_USER_MODEL = "accounts.User"`, referenced by string (`"accounts.User"`) the same way `Notification.recipient`/`Ticket.assigned_agent` already do.
12. `backend/apps/core/models.py` (15 lines, full file) — `TimeStampedModel`, `Task`'s abstract base.
13. `backend/apps/core/serializers.py` (20 lines, full file) — `BaseModelSerializer`, `Meta.read_only_fields = ("id", "created_at", "updated_at")`; task 2's `TaskSerializer` extends this and appends two more read-only fields — see task 2 for why.
14. `backend/apps/core/views.py` (57 lines, full file) — `BaseModelViewSet` (lines 12-31), for contrast: `TaskViewSet` deliberately does not extend it — see `## Prerequisites`.
15. `backend/apps/core/permissions.py` (102 lines, full file) — current `Permissions` list (lines 18-33, unchanged by this story — confirms no new constant is needed).
16. `backend/config/settings/base.py` — `LOCAL_APPS` (lines 55-70, `"apps.agents"` already present at line 62, **no change**); `CELERY_BEAT_SCHEDULER`/Redis config (lines 375-391, unchanged, already live since Story 27).
17. `backend/config/api_urls.py` (21 lines, full file) — the `SimpleRouter` + one more `include()` **above** the catch-all `re_path` (line 20), which must stay last. Task 3 adds one more line after the existing `apps.notifications.urls` include (line 17).
18. `backend/apps/notifications/admin.py` (18 lines, full file) — `NotificationAdmin`: read-only ops visibility (`list_display`/`list_filter`/`search_fields`/`readonly_fields`, no create/edit surface) — the exact shape task 4's `TaskAdmin` copies.
19. `backend/apps/README.md` line 71 — `agents` app's ownership line, confirming this story's backend home.
20. `CONVENTIONS.md` §16 (lines 251-258, no tests), §20 (lines 501-641, forms — the `TextField`/`SelectField`/`useAppForm` worked example task 11 follows), §22 (lines 735-833, permissions — cited for contrast, no change here), §23 (lines 834-1293, feature module conventions — the backend/frontend shape template, the "every mutation invalidates its feature's whole key prefix" rule, and the `optionalString`/`nullableString` distinction task 11 relies on), §24 (lines 1294-1322, background jobs — the data-migration `PeriodicTask` seeding option, already used once by `SLA-3`, task 6 is its second use).

**Frontend**

21. `frontend/src/shared/ui/form/TextField.tsx` (50 lines, full file) — `type?: 'text' | 'email' | 'password' | 'number'` (line 16); task 10 adds `'datetime-local'` to this union, the field's only change.
22. `frontend/src/shared/ui/form/useAppForm.ts`, `SelectField.tsx` (both read in full) — the shared entry point and the Radix-`Select`-is-not-a-native-control wiring (`field.value`/`onValueChange`, not `{...field}`) task 11's ticket picker uses.
23. `frontend/src/shared/validation/schemas.ts` (72 lines, full file) — `requiredString`, `optionalString` (the `''` → `undefined` transform), `choice`; task 11's schema uses the first two.
24. `frontend/src/features/tickets/components/TicketFormPage.tsx` (195 lines, full file) — the complete create/edit-in-one-component pattern (`useAppForm`, `toDefaults`/`toTicketInput`, a `*_NONE` sentinel for an optional `Select`, `applyServerErrors`, `useToast`) task 11's `TaskFormPage` copies near-verbatim.
25. `frontend/src/features/customers/components/CustomerFormPage.tsx` — the `optionalString` + explicit `?? ''` coalescing pattern for a `blank=True`, non-nullable field (lines 20-27, 43-54) — task 11's `description` field copies this exactly, not `requiredString`.
26. `frontend/src/features/tickets/components/MyTicketsPage.tsx` (138 lines, full file, Story 25) — the complete `useServerTable`/`DataTable`/filter-`Select`/sentinel (`"all"`) pattern task 9's `TaskListPage` copies, adapted from two `Select` filters to one (`completed`).
27. `frontend/src/features/tickets/api/useCustomerOptions.ts`, `getCustomerOptions.ts`, `frontend/src/features/tickets/types/customerOption.ts` (all read in full) — the "this feature cannot import `@/features/tickets`, so it re-fetches a minimal shape directly" pattern (`CONVENTIONS.md` §15) task 12's `useTicketOptions`/`getTicketOptions`/`TicketOption` mirror, one layer over: `features/tasks` cannot import `@/features/tickets` either.
28. `frontend/src/features/customers/components/CustomerProfilePage.tsx` lines 1-43 — `useConfirm()` (`@/shared/ui/confirm/useConfirm`), the `confirm({ title, description, destructive: true })` → `deleteMutation.mutateAsync(id)` shape task 9's row-level delete button copies.
29. `frontend/src/features/tickets/api/getTickets.ts` lines 1-3 — `ServerTableParams` import path (`@/shared/ui/data-table/useServerTable`), reused by task 8's `getTasks.ts`.
30. `frontend/src/features/tickets/api/useTicketMutations.ts` (65 lines, full file) — the `useCreateX`/`useUpdateX`/`useDeleteX`, each invalidating `ticketKeys.all` (prefix-wide, `CONVENTIONS.md` §23), task 8's `useTaskMutations.ts` copies for `useCreateTask`/`useUpdateTask`/`useDeleteTask`/`useCompleteTask`/`useReopenTask`.
31. `frontend/src/features/tickets/api/escalateTicket.ts` — the `api.post<Ticket>(url, body)` shape for a state-changing `@action` with an explicit body; contrasted with task 8's `completeTask.ts`/`reopenTask.ts`, which send **no** body (mirroring `markNotificationRead.ts`'s bodyless `api.post`).
32. `frontend/src/app/router.tsx` (141 lines, full file) — the `RequireAuth` children array: the un-gated `index: true` `HealthPage` route (lines 37-43, no `RequirePermission` wrapper) is the precedent task 13's `tasks` routes follow — a personal resource needs no `RequirePermission`, unlike the `customers.view`/`tickets.view` groups either side of it.
33. `frontend/src/app/RootLayout.tsx` (54 lines, full file) — the nav `<Can permission="...">` blocks (lines 21-33); task 14 adds an **unconditional** link (no `<Can>` wrapper) directly after the `tickets.view` block and before the closing `</nav>` (line 34), matching the un-gated route from item 32.
34. `frontend/src/shared/i18n/resources.ts` (56 lines, full file) — the two-imports-plus-one-entry-per-language registration; task 15 adds a `tasks` entry alphabetically between `notifications` and `tickets`, and also edits the existing `notifications` entries in place (see `## Prerequisites`).
35. `frontend/src/features/notifications/types/notification.ts` (15 lines, full file) and `frontend/src/features/notifications/locales/en.json`/`ar.json` (12 lines each, full files) — `NOTIFICATION_KINDS`/`NotificationKind` and the `kinds` block; task 15 adds `'task_due'` to all three, in lockstep with the backend's new `Notification.Kind` value.
36. `frontend/src/features/tickets/locales/en.json` (134 lines, full file) — the nested-group shape (`fields`, `actions`, `delete`, `filters`) task 16's own `features/tasks/locales/en.json` follows.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Personal tasks with an optional ticket link and a due date.** | Intake, task 1 | `Task` model — `owner`, `ticket` (nullable, `SET_NULL`), `title`, `description`, `due_at` (required). |
| **Reminders persistence.** | Intake, task 1 | `TaskViewSet` — full CRUD, owner-scoped, no domain permission (mirrors `NotificationViewSet`). |
| **UI reusing primitives.** | Intake, task 2 | `TaskListPage`/`TaskFormPage` — `DataTable`, `useServerTable`, `useAppForm`, `TextField`/`TextareaField`/`SelectField`. |
| **Trigger via shared notification system.** | Intake, task 2 | `apps.agents.tasks.send_due_task_reminders` calls `apps.notifications.services.notify(...)` — no new delivery UI. |
| **A task's own existence outlives the ticket it optionally references.** | This story's design, mirroring `Ticket.category` | `Task.ticket` is `SET_NULL`, contrasted with `Notification.ticket`'s `CASCADE`. |
| **`completed_at`/`reminder_sent_at` are system-managed, never client-writable**, unlike `Notification.read_at` (never enforced there because `NotificationViewSet` has no create/update action to bypass through). | This story's design — see task 2 | `TaskSerializer.Meta.read_only_fields` extends `BaseModelSerializer`'s with both fields; only `complete`/`reopen` write `completed_at`, only `send_due_task_reminders` writes `reminder_sent_at`. |
| Wire format is `snake_case` end to end. | §12 | `due_at`, `completed_at`, `reminder_sent_at`, `ticket_subject`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `IsAuthenticated`; `django-celery-beat`, `channels` already installed. |

---

## Backend Tasks

### 1 — The `Task` model

**File: `backend/apps/agents/models.py`** (currently one line, `# Create your models here.` — replace entirely):

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Task(TimeStampedModel):
    """A personal task/reminder — AGENT-3. Owned by exactly one agent,
    never shared or assigned to anyone else; optionally linked to a
    ticket for follow-up context. This app's first real content — see
    Story 32 `## Prerequisites`.
    """

    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name=_("owner"),
    )
    # SET_NULL, not CASCADE: contrast `Notification.ticket` (Story 31,
    # CASCADE — a notification IS ABOUT an event on that ticket, so it has
    # no meaning once the ticket is gone). A task's own existence is not
    # tied to the ticket it optionally references — "optional ticket
    # link" (intake) — so deleting the ticket unlinks the task rather
    # than deleting it, the same reasoning `Ticket.category`'s own
    # SET_NULL uses. See Story 32 `## Prerequisites`.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_tasks",
        verbose_name=_("ticket"),
    )
    title = models.CharField(_("title"), max_length=255)
    description = models.CharField(_("description"), max_length=1000, blank=True)
    # Required: the intake's parenthetical ("optional ticket link, due
    # date") reads "optional" as modifying "ticket link" only — a
    # task/reminder with no due date has nothing for
    # `send_due_task_reminders` (task 6) to fire on. See Story 32
    # `## Prerequisites`.
    due_at = models.DateTimeField(_("due at"))
    completed_at = models.DateTimeField(_("completed at"), null=True, blank=True)
    # Idempotency guard mirroring `Notification.email_sent_at` (Story 31)
    # — `send_due_task_reminders` uses this to notify at most once per
    # task, however many times the periodic job runs while it stays
    # overdue.
    reminder_sent_at = models.DateTimeField(_("reminder sent at"), null=True, blank=True)

    class Meta:
        verbose_name = _("task")
        verbose_name_plural = _("tasks")
        # Soonest-due first — a to-do list, not an audit log (contrast
        # `TicketActivity.Meta.ordering`, newest-first).
        ordering = ("due_at",)

    def __str__(self) -> str:
        return self.title
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations agents
```

Expect one file, `apps/agents/migrations/0001_initial.py`, depending on `accounts`' and `tickets`' latest migrations. **Commit it.**

---

### 2 — Serializer

**Create file: `backend/apps/agents/serializers.py`**

```python
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Task


class TaskSerializer(BaseModelSerializer):
    # Read-only convenience, the same role `NotificationSerializer.ticket_subject`
    # plays (Story 31) — `default=""` covers a null `ticket` (the link is
    # optional; most tasks have none). No extra permission check on this
    # field — see Story 32 `## Prerequisites`.
    ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")

    class Meta(BaseModelSerializer.Meta):
        model = Task
        fields = (
            "id",
            "ticket",
            "ticket_subject",
            "title",
            "description",
            "due_at",
            "completed_at",
            "reminder_sent_at",
            "created_at",
            "updated_at",
        )
        # Additionally read-only, unlike `NotificationSerializer.read_at`
        # (never enforced there because `NotificationViewSet` has no
        # create/update action at all to bypass through). `TaskViewSet`
        # IS full CRUD, so without this a client could PATCH
        # `completed_at` directly, bypassing `complete`/`reopen`'s own
        # `timezone.now()` semantics. See Story 32 `## Prerequisites`.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "completed_at",
            "reminder_sent_at",
        )
```

No `owner` field — every row `TaskViewSet.get_queryset` returns already belongs to `request.user`; echoing it back is redundant, the same reasoning `NotificationSerializer` omits `recipient`.

---

### 3 — Views, URLs, and routing

**Create file: `backend/apps/agents/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import TaskViewSet

app_name = "agents"

router = SimpleRouter()
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = router.urls
```

**File: `backend/apps/agents/views.py`** (currently one line, `# Create your views here.` — replace entirely):

```python
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    """The caller's own personal task/reminder list — AGENT-3. Deliberately
    not `apps.core.views.BaseModelViewSet`: a `Task` has no domain
    permission to gate (no role bundles a "tasks" grant), and every
    action here is scoped to `request.user`'s own rows via `get_queryset`
    — the same reasoning `NotificationViewSet` (Story 31) already
    established for an owner-scoped personal resource. Unlike
    `NotificationViewSet`, this IS full CRUD (create/update/destroy, not
    just list/retrieve), because a task is authored and edited by its
    owner, not system-generated. See Story 32 `## Prerequisites`.
    """

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    # What makes `?ordering=` real for these columns (CONVENTIONS.md
    # §23) — each name here must match a `TaskListPage` `ColumnDef.id`.
    ordering_fields = ("due_at", "created_at", "title")

    def get_queryset(self):
        queryset = Task.objects.filter(owner=self.request.user).select_related("ticket")
        completed = self.request.query_params.get("completed")
        if completed:
            if completed not in ("true", "false"):
                raise ValidationError({"completed": [_('Must be "true" or "false" if present.')]})
            queryset = queryset.filter(completed_at__isnull=(completed == "false"))
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.completed_at is None:
            task.completed_at = timezone.now()
            task.save(update_fields=["completed_at", "updated_at"])
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        task = self.get_object()
        if task.completed_at is not None:
            task.completed_at = None
            task.save(update_fields=["completed_at", "updated_at"])
        return Response(self.get_serializer(task).data)
```

**File: `backend/config/api_urls.py`** — one more `include()`, above the catch-all, after the existing `apps.notifications.urls` line:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.agents.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoints: `GET/POST /api/tasks/`, `GET/PATCH/PUT/DELETE /api/tasks/<id>/`, `POST /api/tasks/<id>/complete/`, `POST /api/tasks/<id>/reopen/`.

**No new `Permissions` constant, no permission-grant migration** — see `## Prerequisites`.

---

### 4 — Admin

**File: `backend/apps/agents/admin.py`** (currently one line, `# Register your models here.` — replace entirely):

```python
from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — the same call
    `NotificationAdmin` (Story 31) already made: a `Task` is authored and
    edited by its owner through the app, not through `/admin/`.
    """

    list_display = ("title", "owner", "ticket", "due_at", "completed_at", "reminder_sent_at")
    list_filter = ("completed_at",)
    search_fields = ("title", "owner__email")
    readonly_fields = ("created_at", "updated_at")
```

---

### 5 — A third `Notification.Kind`

**File: `backend/apps/notifications/models.py`** — extend `Notification.Kind` (currently lines 18-20):

```python
    class Kind(models.TextChoices):
        TICKET_ASSIGNED = "ticket_assigned", _("Ticket assigned")
        TICKET_ESCALATED = "ticket_escalated", _("Ticket escalated")
        TASK_DUE = "task_due", _("Task due")
```

**Generate the migration:**

```powershell
python manage.py makemigrations notifications
```

Expect one file, `apps/notifications/migrations/0002_alter_notification_kind.py` — schema-inert (choices are validated in Python, not the database), same as any future `Kind` addition. **Commit it.**

---

### 6 — The due-reminder background task

**Create file: `backend/apps/agents/tasks.py`**

```python
"""Background tasks — AGENT-3. The project's third `@shared_task`
module, after `apps/sla/tasks.py` (Stories 29-30) and
`apps/notifications/tasks.py` (Story 31). `app.autodiscover_tasks()`
(`config/celery.py`) finds this module with no further wiring.
"""

from celery import shared_task
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import Task


@shared_task
def send_due_task_reminders() -> None:
    """Notifies each task's owner once its `due_at` has passed, for
    every task that is not yet completed and has not already been
    reminded. Runs on `django-celery-beat`'s own schedule, seeded by
    this app's `0002_seed_due_reminder_schedule` data migration — the
    same 5-minute cadence `apps/sla/migrations/0004_seed_escalation_schedule.py`
    (Story 30) already established, reused rather than reinvented.
    `reminder_sent_at` makes this idempotent against a task that stays
    overdue across multiple runs: only the first run after `due_at`
    notifies. A run that finds nothing due is a normal no-op, not an
    error — same tone as `evaluate_escalations`.
    """
    due = Task.objects.filter(
        due_at__lte=timezone.now(), completed_at__isnull=True, reminder_sent_at__isnull=True
    ).select_related("owner", "ticket")
    for task in due:
        notify(
            task.owner,
            Notification.Kind.TASK_DUE,
            ticket=task.ticket,
            title=f"Reminder: {task.title}",
            body=task.description,
        )
        task.reminder_sent_at = timezone.now()
        task.save(update_fields=["reminder_sent_at", "updated_at"])
```

**Create file: `backend/apps/agents/migrations/0002_seed_due_reminder_schedule.py`**

```python
from django.db import migrations


def seed_due_reminder_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    # Matches the row `apps/sla/migrations/0004_seed_escalation_schedule.py`
    # (Story 30) already created — `get_or_create` reuses that same
    # `IntervalSchedule`, it does not create a second "every 5 minutes"
    # row. Two `PeriodicTask`s now point at it.
    schedule, _ = IntervalSchedule.objects.get_or_create(every=5, period="minutes")
    PeriodicTask.objects.get_or_create(
        name="AGENT-3: send due task reminders",
        defaults={
            "task": "apps.agents.tasks.send_due_task_reminders",
            "interval": schedule,
            "enabled": True,
        },
    )


def unseed_due_reminder_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="AGENT-3: send due task reminders").delete()
    # The shared `every=5, period="minutes"` IntervalSchedule row is
    # deliberately left in place on reverse, for the same reason Story
    # 30's own migration already documents — it is now shared by TWO
    # PeriodicTasks (this one and SLA-3's), so deleting it on this
    # migration's reverse would silently break the other one too.


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0001_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_due_reminder_schedule, unseed_due_reminder_schedule),
    ]
```

**Commit both migrations.** No `CELERY_BEAT_SCHEDULER`/broker change — already live since Story 27.

---

## Frontend Tasks

### 7 — Types

**Create file: `frontend/src/features/tasks/types/task.ts`**

```ts
/** Mirrors `apps.agents.serializers.TaskSerializer` verbatim. */
export type Task = {
  id: number
  ticket: number | null
  ticket_subject: string
  title: string
  description: string
  due_at: string
  completed_at: string | null
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

/** The write shape. `completed_at`/`reminder_sent_at` are absent — both
 * are read-only on the serializer, written only through their own
 * `POST /tasks/<id>/{complete,reopen}/` action or the background job,
 * so a full-payload create/edit can never move either as a side
 * effect. Mirrors `TicketInput`'s own reasoning (Story 23). */
export type TaskInput = {
  ticket: number | null
  title: string
  description: string
  due_at: string
}
```

---

### 8 — API layer and mutations

**Create file: `frontend/src/features/tasks/api/taskKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const taskKeys = featureKey('tasks')
```

**Create file: `frontend/src/features/tasks/api/getTasks.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Task } from '../types/task'

export type TaskListParams = ServerTableParams & {
  completed?: 'true' | 'false'
}

export function getTasks(params: TaskListParams): Promise<Page<Task>> {
  return api.getPage<Task>('/tasks/', { params })
}
```

**Create file: `frontend/src/features/tasks/api/useTasks.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTasks } from './getTasks'
import type { TaskListParams } from './getTasks'
import { taskKeys } from './taskKeys'

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.resource('list', params),
    queryFn: () => getTasks(params),
  })
}
```

**Create file: `frontend/src/features/tasks/api/getTask.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Task } from '../types/task'

export function getTask(id: number): Promise<Task> {
  return api.get<Task>(`/tasks/${id}/`)
}
```

**Create file: `frontend/src/features/tasks/api/useTask.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTask } from './getTask'
import { taskKeys } from './taskKeys'

export function useTask(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.resource('detail', id),
    queryFn: () => getTask(id),
    enabled: options?.enabled,
  })
}
```

**Create files: `frontend/src/features/tasks/api/{createTask,updateTask,deleteTask,completeTask,reopenTask}.ts`**

```ts
// createTask.ts
import { api } from '@/shared/lib/api/client'

import type { Task, TaskInput } from '../types/task'

export function createTask(input: TaskInput): Promise<Task> {
  return api.post<Task>('/tasks/', input)
}
```

```ts
// updateTask.ts
import { api } from '@/shared/lib/api/client'

import type { Task, TaskInput } from '../types/task'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateTask(id: number, input: TaskInput): Promise<Task> {
  return api.patch<Task>(`/tasks/${id}/`, input)
}
```

```ts
// deleteTask.ts
import { api } from '@/shared/lib/api/client'

export function deleteTask(id: number): Promise<void> {
  return api.delete(`/tasks/${id}/`)
}
```

```ts
// completeTask.ts
import { api } from '@/shared/lib/api/client'

import type { Task } from '../types/task'

// No body — mirrors `markNotificationRead.ts` (Story 31), not
// `escalateTicket.ts` (which sends an explicit `{ escalated }`): there
// is only one direction to move `completed_at` from this endpoint.
export function completeTask(id: number): Promise<Task> {
  return api.post<Task>(`/tasks/${id}/complete/`)
}
```

```ts
// reopenTask.ts
import { api } from '@/shared/lib/api/client'

import type { Task } from '../types/task'

export function reopenTask(id: number): Promise<Task> {
  return api.post<Task>(`/tasks/${id}/reopen/`)
}
```

**Create file: `frontend/src/features/tasks/api/useTaskMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { completeTask } from './completeTask'
import { createTask } from './createTask'
import { deleteTask } from './deleteTask'
import { reopenTask } from './reopenTask'
import { taskKeys } from './taskKeys'
import { updateTask } from './updateTask'
import type { TaskInput } from '../types/task'

// Every mutation invalidates the whole `tasks` key prefix — a create/edit/
// delete/complete/reopen can all change which rows land on which page or
// which side of the `completed` filter a row falls on. CONVENTIONS.md §23.
function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: taskKeys.all })
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskInput) => createTask(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTask(id: number) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskInput) => updateTask(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: invalidate,
  })
}

export function useCompleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) => completeTask(id),
    onSuccess: invalidate,
  })
}

export function useReopenTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) => reopenTask(id),
    onSuccess: invalidate,
  })
}
```

---

### 9 — `TaskListPage`

**Create file: `frontend/src/features/tasks/components/TaskListPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
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
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'

import { useCompleteTask, useDeleteTask, useReopenTask } from '../api/useTaskMutations'
import { useTasks } from '../api/useTasks'
import type { Task } from '../types/task'

// Sentinel values, the same role `MyTicketsPage`'s `"all"` plays
// (CONVENTIONS.md §19) — "pending"/"completed" map to the boolean
// `completed` query param, `"all"` omits it.
type CompletedFilter = 'all' | 'pending' | 'completed'

export function TaskListPage() {
  const { t } = useTranslation('tasks')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'due_at', direction: 'asc' },
  })

  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('pending')

  useEffect(() => {
    setPage(1)
  }, [completedFilter, setPage])

  const query = useTasks({
    ...params,
    ...(completedFilter === 'all' ? {} : { completed: completedFilter === 'completed' ? 'true' : 'false' }),
  })

  const completeMutation = useCompleteTask()
  const reopenMutation = useReopenTask()
  const deleteMutation = useDeleteTask()

  async function handleDelete(task: Task) {
    const confirmed = await confirm({
      title: t('delete.title'),
      description: t('delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(task.id)
  }

  const columns: readonly ColumnDef<Task>[] = [
    {
      id: 'title',
      header: t('fields.title'),
      sortable: true,
      cell: (row) => <Link to={`/tasks/${row.id}/edit`}>{row.title}</Link>,
    },
    {
      id: 'ticket_subject',
      header: t('fields.ticket'),
      cell: (row) =>
        row.ticket === null ? '—' : <Link to={`/tickets/${row.ticket}`}>{row.ticket_subject}</Link>,
    },
    {
      id: 'due_at',
      header: t('fields.dueAt'),
      sortable: true,
      cell: (row) => {
        const overdue = row.completed_at === null && new Date(row.due_at) < new Date()
        return <span className={overdue ? 'font-medium text-destructive' : undefined}>{dateTime(row.due_at)}</span>
      },
    },
    {
      id: 'status',
      header: t('fields.status'),
      cell: (row) => (
        <Badge variant={row.completed_at === null ? 'secondary' : 'default'}>
          {t(row.completed_at === null ? 'statuses.pending' : 'statuses.completed')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('fields.actions'),
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.completed_at === null ? (
            <Button size="sm" variant="outline" onClick={() => completeMutation.mutate(row.id)}>
              {t('actions.complete')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate(row.id)}>
              {t('actions.reopen')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
            {t('actions.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <Button asChild>
          <Link to="/tasks/new">{t('new')}</Link>
        </Button>
      </div>
      <Select value={completedFilter} onValueChange={(value) => setCompletedFilter(value as CompletedFilter)}>
        <SelectTrigger aria-label={t('filters.completed')} size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">{t('filters.pending')}</SelectItem>
          <SelectItem value="completed">{t('filters.completedOnly')}</SelectItem>
          <SelectItem value="all">{t('filters.all')}</SelectItem>
        </SelectContent>
      </Select>
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

---

### 10 — `TextField` gains `datetime-local`

**File: `frontend/src/shared/ui/form/TextField.tsx`** — extend the `type` union (line 16):

```ts
type TextFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local'
}
```

No other change to this file — `Input type={type} {...field}` (line 42) already passes any `type` straight through to the native element.

---

### 11 — `TaskFormPage`

**Create file: `frontend/src/features/tasks/api/getTicketOptions.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { TicketOption } from '../types/ticketOption'

// page_size: 100 (the server's max, DRF_MAX_PAGE_SIZE) — no search-as-you-
// type combobox primitive exists yet, the same simplification
// `getCustomerOptions.ts` (features/tickets) already accepted. Relies on
// `Ticket.Meta.ordering` (`-created_at`) — no explicit `ordering` param.
export function getTicketOptions(): Promise<Page<TicketOption>> {
  return api.getPage<TicketOption>('/tickets/', { params: { page_size: 100 } })
}
```

**Create file: `frontend/src/features/tasks/types/ticketOption.ts`**

```ts
/**
 * Minimal shape for the task form's optional ticket-link selector. This
 * feature calls `/tickets/` directly (see `../api/getTicketOptions.ts`)
 * rather than importing `@/features/tickets` — `no-restricted-imports`
 * (`frontend/.oxlintrc.json`) forbids any `@/features/*` import from
 * another feature, the same reason `features/tickets/types/customerOption.ts`
 * duplicates `Customer`'s minimal shape instead of importing it.
 */
export type TicketOption = {
  id: number
  subject: string
}
```

**Create file: `frontend/src/features/tasks/api/useTicketOptions.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTicketOptions } from './getTicketOptions'
import { taskKeys } from './taskKeys'

/**
 * A caller without `tickets.view` gets a `403` here and simply sees an
 * empty picker (no crash) — `TaskFormPage` does not special-case
 * `isError`, the same graceful degradation `TicketFormPage`'s own
 * `useCustomerOptions`/`useCategories` already have for a
 * `customers.view`-less caller. See Story 32 `## Prerequisites`.
 */
export function useTicketOptions() {
  return useQuery({
    queryKey: taskKeys.resource('ticketOptions'),
    queryFn: getTicketOptions,
  })
}
```

**Create file: `frontend/src/features/tasks/components/TaskFormPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { SelectField, TextField, TextareaField, useAppForm } from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateTask, useUpdateTask } from '../api/useTaskMutations'
import { useTask } from '../api/useTask'
import { useTicketOptions } from '../api/useTicketOptions'
import type { Task, TaskInput } from '../types/task'

// Radix's `Select.Item` requires a non-empty `value` — this sentinel
// stands in for "no ticket", the same role `TicketFormPage`'s own
// `CATEGORY_NONE` plays for an optional `category`.
const TICKET_NONE = 'none'

const taskSchema = z.object({
  title: requiredString(255),
  // `blank=True`, not nullable — the same `optionalString` + explicit
  // `?? ''` coalescing pattern `CustomerFormPage` uses for `phone`/
  // `company` (CONVENTIONS.md §23), not `requiredString`.
  description: optionalString(1000),
  // The raw `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm");
  // converted to/from an ISO instant in `toDefaults`/`toTaskInput` below.
  due_at: requiredString(),
  ticket: z.string().min(1),
})

type FormValues = z.output<typeof taskSchema>

const EMPTY_DEFAULTS: FormValues = { title: '', description: '', due_at: '', ticket: TICKET_NONE }

// `datetime-local`'s value has no timezone — per the WHATWG/ECMA-262 date
// string grammar, `new Date(value)` on such a string parses it as the
// BROWSER's local time (only a bare date-only string like "2026-08-30" is
// is treated as UTC), and `new Date(iso)` on the server's UTC-offset ISO
// string parses correctly regardless. Reading the `Date`'s own local
// getters (`getFullYear`/etc.) and writing back via `.toISOString()`
// therefore round-trips correctly through the browser's local zone with
// no new dependency — see `## Edge Cases & Failure Modes`.
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

function toDefaults(task: Task): FormValues {
  return {
    title: task.title,
    description: task.description,
    due_at: toDatetimeLocalValue(task.due_at),
    ticket: task.ticket === null ? TICKET_NONE : String(task.ticket),
  }
}

function toTaskInput(values: FormValues): TaskInput {
  return {
    title: values.title,
    description: values.description ?? '',
    due_at: fromDatetimeLocalValue(values.due_at),
    ticket: values.ticket === TICKET_NONE ? null : Number(values.ticket),
  }
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function TaskFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const taskQuery = useTask(id, { enabled: isEdit })

  if (!isEdit) {
    return <TaskForm mode="create" />
  }

  return (
    <QueryBoundary query={taskQuery}>
      {(task) => <TaskForm mode="edit" id={id} task={task} />}
    </QueryBoundary>
  )
}

function TaskForm({ mode, id, task }: { mode: 'create' | 'edit'; id?: number; task?: Task }) {
  const { t } = useTranslation('tasks')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const ticketOptionsQuery = useTicketOptions()

  const form = useAppForm({
    schema: taskSchema,
    defaultValues: task ? toDefaults(task) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toTaskInput(values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t(mode === 'create' ? 'created' : 'updated') })
        navigate('/tasks')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  const ticketOptions =
    ticketOptionsQuery.data?.items.map((ticket) => ({
      value: String(ticket.id),
      label: ticket.subject,
    })) ?? []

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'new' : 'edit')}</h1>
      {ticketOptionsQuery.isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField control={form.control} name="title" label={t('fields.title')} />
            <TextareaField control={form.control} name="description" label={t('fields.description')} />
            <TextField
              control={form.control}
              name="due_at"
              type="datetime-local"
              label={t('fields.dueAt')}
            />
            <SelectField
              control={form.control}
              name="ticket"
              label={t('fields.ticket')}
              options={[{ value: TICKET_NONE, label: t('fields.noTicket') }, ...ticketOptions]}
            />
            {formErrors.length > 0 ? (
              <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              {t('actions.save')}
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
}
```

---

### 12 — Route

**File: `frontend/src/app/router.tsx`** — add a new, **un-gated** children group (no `RequirePermission` wrapper, matching the `index: true` `HealthPage` precedent) inside `RequireAuth`'s `children` array, directly after the `tickets.view` group (after line 129, before the array closes at line 131):

```tsx
          {
            path: 'tasks',
            lazy: async () => {
              const { TaskListPage } = await import('@/features/tasks/components/TaskListPage')
              return { element: <TaskListPage /> }
            },
          },
          {
            // Must stay before `tasks/:id/edit`, same reason
            // `tickets/new` is declared before `tickets/:id`.
            path: 'tasks/new',
            lazy: async () => {
              const { TaskFormPage } = await import('@/features/tasks/components/TaskFormPage')
              return { element: <TaskFormPage /> }
            },
          },
          {
            path: 'tasks/:id/edit',
            lazy: async () => {
              const { TaskFormPage } = await import('@/features/tasks/components/TaskFormPage')
              return { element: <TaskFormPage /> }
            },
          },
```

---

### 13 — Nav link

**File: `frontend/src/app/RootLayout.tsx`** — add an **unconditional** link (no `<Can>` wrapper — this route needs no permission) directly after the existing `tickets.view` `<Can>` block (after line 33) and before `</nav>` (line 34):

```tsx
            <Button asChild variant="ghost" size="sm">
              <Link to="/tasks">{t('tasks:title')}</Link>
            </Button>
```

Also add `'tasks'` to the `useTranslation` namespace list (line 12): `useTranslation(['common', 'customers', 'tickets', 'tasks'])`.

---

### 14 — Locale namespace

**Create file: `frontend/src/features/tasks/locales/en.json`**

```json
{
  "title": "Tasks",
  "new": "New task",
  "edit": "Edit task",
  "empty": "No tasks",
  "emptyDescription": "Create a task to get a reminder before it's due.",
  "fields": {
    "title": "Title",
    "description": "Description",
    "dueAt": "Due",
    "ticket": "Linked ticket",
    "noTicket": "No linked ticket",
    "status": "Status",
    "actions": "Actions"
  },
  "statuses": {
    "pending": "Pending",
    "completed": "Completed"
  },
  "filters": {
    "completed": "Filter by status",
    "pending": "Pending",
    "completedOnly": "Completed",
    "all": "All"
  },
  "actions": {
    "save": "Save",
    "complete": "Complete",
    "reopen": "Reopen",
    "delete": "Delete"
  },
  "delete": {
    "title": "Delete this task?",
    "description": "This permanently removes the task. This cannot be undone."
  },
  "created": "Task created.",
  "updated": "Task updated."
}
```

**Create file: `frontend/src/features/tasks/locales/ar.json`** with the identical key set, translated:

```json
{
  "title": "المهام",
  "new": "مهمة جديدة",
  "edit": "تعديل المهمة",
  "empty": "لا توجد مهام",
  "emptyDescription": "أنشئ مهمة لتصلك تذكيرًا قبل موعدها.",
  "fields": {
    "title": "العنوان",
    "description": "الوصف",
    "dueAt": "الموعد",
    "ticket": "التذكرة المرتبطة",
    "noTicket": "بدون تذكرة مرتبطة",
    "status": "الحالة",
    "actions": "الإجراءات"
  },
  "statuses": {
    "pending": "قيد الانتظار",
    "completed": "مكتملة"
  },
  "filters": {
    "completed": "تصفية حسب الحالة",
    "pending": "قيد الانتظار",
    "completedOnly": "مكتملة",
    "all": "الكل"
  },
  "actions": {
    "save": "حفظ",
    "complete": "إكمال",
    "reopen": "إعادة فتح",
    "delete": "حذف"
  },
  "delete": {
    "title": "حذف هذه المهمة؟",
    "description": "سيؤدي هذا إلى إزالة المهمة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
  },
  "created": "تم إنشاء المهمة.",
  "updated": "تم تحديث المهمة."
}
```

**File: `frontend/src/shared/i18n/resources.ts`** — add two imports, alphabetically between the existing `notifications` and `tickets` imports (currently lines 9-10/11-12):

```ts
import tasksAr from '@/features/tasks/locales/ar.json'
import tasksEn from '@/features/tasks/locales/en.json'
```

And one entry per language in the `resources` object, between the existing `notifications` and `tickets` keys:

```ts
    tasks: tasksEn,
```
```ts
    tasks: tasksAr,
```

**Also edit, in place** (same file's two sibling imports, unchanged paths — only their target files change, per task 15):

No change to `resources.ts` itself beyond the addition above; the `notifications` entries already registered (lines 9-10, 42, 54) pick up task 15's new `kinds.task_due` key automatically once that JSON file gains it.

---

### 15 — Extend the notifications vocabulary in lockstep

**File: `frontend/src/features/notifications/types/notification.ts`** — add the third kind (line 1):

```ts
export const NOTIFICATION_KINDS = ['ticket_assigned', 'ticket_escalated', 'task_due'] as const
```

**File: `frontend/src/features/notifications/locales/en.json`** — extend the `kinds` block:

```json
  "kinds": {
    "ticket_assigned": "Ticket assigned",
    "ticket_escalated": "Ticket escalated",
    "task_due": "Task due"
  }
```

**File: `frontend/src/features/notifications/locales/ar.json`** — the same key, translated:

```json
  "kinds": {
    "ticket_assigned": "تم تعيين التذكرة",
    "ticket_escalated": "تم تصعيد التذكرة",
    "task_due": "موعد مهمة"
  }
```

`kinds.*` is not currently read anywhere in `NotificationBell.tsx` (verified — it renders `notification.title`/`created_at` only), so this is a type-correctness fix, not new behaviour: `Notification.kind` can now genuinely hold `"task_due"` at runtime, and the TS union must not silently omit it.

---

## Documentation Tasks

### 16 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 26's paragraph):

> **A second owner-scoped personal resource, this time full CRUD.** `TaskViewSet` (Story 32, `AGENT-3`) follows `NotificationViewSet`'s (Story 31, `SLA-4`) precedent of skipping `BaseModelViewSet`/`permission_map` entirely for a resource with no domain-permission concept — every action is scoped to `request.user`'s own rows via `get_queryset`, and `IsAuthenticated` alone is the gate. Unlike `NotificationViewSet` (list/retrieve-only, system-managed rows), `TaskViewSet` is a full `viewsets.ModelViewSet`, so its serializer must mark any action-only field (`completed_at`, mirroring `Notification.read_at`) explicitly `read_only_fields` — `NotificationViewSet` never needed this because it has no create/update action to bypass through in the first place. **`TextField` (`shared/ui/form/TextField.tsx`) now also accepts `type="datetime-local"`** — the first form field in this project editing a date+time value; converting between its timezone-less input value and the server's UTC-offset ISO string uses the browser's own `Date` local getters/`toISOString()`, no new dependency.

---

### 17 — Overview

**File: `.squad/plans/agent-workspace/00-overview.md`** — add this story's row to the `## Stories` table:

```markdown
| 32 | [32-story-tasks-reminders-SUPPORTOS-47.md](32-story-tasks-reminders-SUPPORTOS-47.md) | Tasks & Reminders | SUPPORTOS-47 | Story 27 (`SLA-0`), Story 31 (`SLA-4`) |
```

And a new paragraph in `## Dependency notes` summarizing: `SLA-4`'s completeness (backend + frontend, verified directly, not just planned) unblocked this story; the owner-scoped no-`BaseModelViewSet` design mirroring `NotificationViewSet`; the `SET_NULL` vs. `Notification.ticket`'s `CASCADE` contrast; and that `AGENT-4`/`AGENT-5` remain the only unplanned stories in this feature.

---

## Edge Cases & Failure Modes

- **A task's `due_at` passes while it is already completed** — `send_due_task_reminders`'s own `completed_at__isnull=True` filter excludes it; no reminder fires for a task the owner already finished.
- **The periodic job runs repeatedly while a task stays overdue and unactioned** — `reminder_sent_at__isnull=True` means only the **first** run after `due_at` notifies; every later run skips it. Reopening a completed task (`reopen`) does **not** clear `reminder_sent_at` — a previously-reminded, then-completed, then-reopened task does not get a second reminder for the same original due date. This is a deliberate, accepted simplification: the intake asks for "due notifications," not "re-notify on reopen," and clearing it would require deciding whether reopening also un-marks completion of the reminder itself, a real design question not asked for here.
- **A ticket linked to a task is deleted** — `Task.ticket` is `SET_NULL`; the task survives, unlinked (`ticket: null`, `ticket_subject: ""`), rather than being deleted or blocking the ticket's deletion. Contrast `Notification.ticket`'s `CASCADE` — see `## Prerequisites`.
- **A caller without `tickets.view` opens `TaskFormPage`** — `useTicketOptions` gets a `403` from `GET /api/tickets/`; the picker shows only `fields.noTicket`, and the task is still fully creatable/editable with `ticket: null`. No error is surfaced for this — same accepted degradation `TicketFormPage`'s own `useCustomerOptions`/`useCategories` already have. See `## Prerequisites`.
- **A client PATCHes `completed_at` or `reminder_sent_at` directly** on `PATCH /api/tasks/<id>/` — both are `read_only_fields` on `TaskSerializer`; DRF silently ignores them in `validated_data` rather than erroring, so the request succeeds but neither field changes. Only `complete`/`reopen` (for `completed_at`) and the background job (for `reminder_sent_at`) can ever write them.
- **`?completed=` with anything other than exactly `"true"` or `"false"`** (e.g. `"1"`, `"yes"`) is a `400` naming `completed` — the same "malformed value is a 400, not silently ignored" contract `assigned_to_me`/`status` already have on `TicketViewSet`.
- **The `datetime-local` input has no timezone of its own** — `toDatetimeLocalValue`/`fromDatetimeLocalValue` (task 11) round-trip correctly through the **browser's** local zone (verified: a date-time string with no offset parses as local time per the WHATWG/ECMA-262 grammar), not the server's `TIME_ZONE` setting. Two agents in different time zones each see and enter `due_at` in their own local wall-clock time; the value stored is the same UTC instant either way, so `send_due_task_reminders`'s `due_at__lte=timezone.now()` comparison is correct regardless of which agent created it.
- **A task with an empty `description`** renders `fields.description`'s `TextareaField` empty, not `"—"` — `description` is `blank=True`, not nullable; `optionalString()` + the explicit `description: values.description ?? ''` coalescing in `toTaskInput` (task 11) always sends the key, matching `CustomerFormPage`'s own `phone`/`company` handling.
- **Deleting a task that has already been reminded, or already completed**, does not touch its `Notification` row — `Notification.ticket` (if any) points at the ticket, not at the `Task`; there is no FK from `Notification` to `Task`, so the notification's own record (and its `read_at`/`email_sent_at` state) is unaffected by the task's deletion.
- **Arabic task titles/descriptions round-trip correctly** — no forced `dir="ltr"` anywhere in `TaskListPage`/`TaskFormPage`, matching every other free-text render in this project.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** after both migrations (task 1's `0001_initial`, task 5's `0002_alter_notification_kind`, task 6's `0002_seed_due_reminder_schedule`) are generated and committed.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real HTTP: full CRUD scoped to the caller, the `completed` filter valid/malformed/absent, `complete`/`reopen`, and that another user's tasks are never visible — `## Verification Steps`.
5. A manual Celery run of `send_due_task_reminders` (or waiting out the 5-minute schedule with the worker/beat running) confirming a `Notification` row is created, `reminder_sent_at` is set, and a second run does not double-notify.
6. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new `tasks` feature, the `TextField` change, and the `notifications` feature's updated type/locale files.
7. An `en`/`ar` key-set comparison for `features/tasks/locales/` and the updated `features/notifications/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**Three migrations**: `apps/agents/migrations/0001_initial.py` (the `Task` table), `apps/agents/migrations/0002_seed_due_reminder_schedule.py` (data migration, `PeriodicTask`/`IntervalSchedule`), `apps/notifications/migrations/0002_alter_notification_kind.py` (schema-inert `Kind` choices).

**Rollback of the code:** revert the commits. `python manage.py migrate agents 0001` (or `zero`) reverses `0002_seed_due_reminder_schedule` cleanly via its own `unseed_due_reminder_schedule` — see the "half-applied states to avoid" note on the shared `IntervalSchedule` row, below. `python manage.py migrate notifications 0001` reverses the `Kind` choices change (schema-inert either direction).

**Half-applied states to avoid:**

- **Deleting the `every=5, period="minutes"` `IntervalSchedule` row on any manual cleanup**, rather than letting `0002_seed_due_reminder_schedule`'s own `unseed_due_reminder_schedule` run — that row is now shared by **two** `PeriodicTask`s (`SLA-3: evaluate escalations` and `AGENT-3: send due task reminders`). Deleting it directly (e.g. via `/admin/`) would silently stop **both** jobs, not just this story's.
- **`send_due_task_reminders` filtering by `id` instead of `reminder_sent_at__isnull=True`** — would either never suppress a repeat reminder (if the guard were dropped) or never fire at all (if inverted). Verify both a fresh overdue task gets exactly one `Notification`, and a second job run on the same task creates zero more.
- **`TaskSerializer` omitting `completed_at`/`reminder_sent_at` from `read_only_fields`** — silently reopens the "client can PATCH completion state directly" gap task 2 closes; a `python manage.py test`/`ruff` pass would not catch this (no test file), only the manual HTTP check in `## Verification Steps` does.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations generated and match expectations:** `python manage.py makemigrations agents` produces exactly `0001_initial.py`; hand-write `0002_seed_due_reminder_schedule.py` per task 6; `python manage.py makemigrations notifications` produces exactly one `AlterField` migration for `Kind`. `python manage.py makemigrations --check --dry-run` (project-wide) then exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Full CRUD, scoped to the caller.** With agent A's token: `POST /api/tasks/` with `{title, description, due_at, ticket: null}` → `201`, `owner` not in the response body, `completed_at`/`reminder_sent_at` both `null`. `GET /api/tasks/` → includes it. With agent B's token (a different account): `GET /api/tasks/` → does **not** include agent A's task; `GET /api/tasks/<A's id>/` → `404` (not `403` — `get_queryset` already excludes it, so `get_object()` never finds the row for B).
5. **`ticket` link and `ticket_subject`.** Create a ticket, then a task with `ticket: <that id>` → `201`, `ticket_subject` matches the ticket's `subject`. Delete the ticket → `GET` the task again → `ticket: null`, `ticket_subject: ""` (not a `404`/error on the task).
6. **`complete`/`reopen`.** `POST /api/tasks/<id>/complete/` → `200`, `completed_at` set. A second `complete` call → `200`, `completed_at` **unchanged** (not bumped to a later timestamp — the `if task.completed_at is None:` guard). `POST .../reopen/` → `200`, `completed_at` back to `null`.
7. **`completed` filter.** With one pending and one completed task: `GET /api/tasks/?completed=false` → only the pending one. `?completed=true` → only the completed one. No `completed` param → both. `?completed=maybe` → `400` naming `completed`.
8. **A client cannot set `completed_at`/`reminder_sent_at` directly.** `PATCH /api/tasks/<id>/` with `{..., completed_at: "2020-01-01T00:00:00Z"}` → `200`, but `completed_at` in the response is **unchanged** from before the request (still whatever `complete`/`reopen` last set it to, or `null`).
9. **The due-reminder job fires exactly once.** Create a task with `due_at` a few minutes in the past. Run `python manage.py shell -c "from apps.agents.tasks import send_due_task_reminders; send_due_task_reminders()"` (or let the Celery worker/beat pick it up on schedule — **Windows requires `celery -A config worker --pool=solo`**, `CONVENTIONS.md` §24). Confirm: exactly one `Notification` row is created for the task's owner, `kind: "task_due"`, `title` starts with `"Reminder: "`; the task's own `reminder_sent_at` is now set. Run the same task function again → **zero** new `Notification` rows.
10. **The bell surfaces it with no new frontend code.** With the frontend running (`npm run dev`) and signed in as the task's owner: open the existing `NotificationBell` dropdown → the `task_due` notification appears with its title and timestamp, exactly like a `ticket_assigned`/`ticket_escalated` one. Marking it read/unread behaves identically — no `TASK_DUE`-specific branch exists anywhere in `NotificationBell.tsx`.
11. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in:
    - Click the new "Tasks" nav link → lands on `/tasks`, defaulting to the `pending` filter.
    - Create a task with a due date/time and a linked ticket → appears in the list, sorted by due date.
    - Complete it → moves out of the `pending` filter view; switch to `completed` → it appears there. Reopen it → moves back.
    - Create a task with `due_at` in the past → its due-date cell renders in the destructive/red style (overdue).
    - Delete a task → confirmation dialog appears (`useConfirm`), confirming removes it from the list.
    - Switch to Arabic → every label (nav link, list, filters, form, delete dialog) translates, and the layout reads correctly in RTL.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
13. **Clean up** every task, ticket, and customer created for steps 4-11, plus any throwaway second user account.

---

## Done Criteria

- [ ] `Task` model (`apps.agents`) — `owner` (CASCADE), `ticket` (`SET_NULL`, nullable), `title`, `description` (blank), `due_at` (required), `completed_at`/`reminder_sent_at` (both nullable, system-managed). `Meta.ordering = ("due_at",)`.
- [ ] `TaskSerializer` — excludes `owner`; `ticket_subject` read-only convenience; `completed_at`/`reminder_sent_at` explicitly in `read_only_fields` on top of the base's `id`/`created_at`/`updated_at`.
- [ ] `TaskViewSet` — full CRUD, `IsAuthenticated` only (no `BaseModelViewSet`/`permission_map`), `get_queryset` scoped to `owner=request.user`, `?completed=true|false` filter (400 on malformed), `complete`/`reopen` actions.
- [ ] `apps/agents/urls.py` (`basename="task"`) + one `include()` line in `config/api_urls.py`, above the catch-all.
- [ ] `TaskAdmin` — read-only ops visibility, mirroring `NotificationAdmin`.
- [ ] `Notification.Kind` gains `TASK_DUE = "task_due"`; migration generated and committed.
- [ ] `apps.agents.tasks.send_due_task_reminders` — calls `notify(...)` for every overdue, uncompleted, not-yet-reminded task; sets `reminder_sent_at`; idempotent across repeated runs. Seeded live by `0002_seed_due_reminder_schedule.py` (every 5 minutes, sharing Story 30's `IntervalSchedule` row).
- [ ] **No new `Permissions` constant, no permission-grant migration, no `LOCAL_APPS` change** (`apps.agents` was already installed).
- [ ] `features/tasks/` — `types/task.ts`, full `api/` layer (`taskKeys`, `getTasks`/`getTask`, `useTasks`/`useTask`, `create`/`update`/`delete`/`complete`/`reopenTask.ts`, `useTaskMutations.ts`), `getTicketOptions.ts`/`useTicketOptions.ts`/`types/ticketOption.ts`, `TaskListPage.tsx`, `TaskFormPage.tsx`, `locales/{en,ar}.json`.
- [ ] `TextField.tsx`'s `type` union gains `'datetime-local'` — no other change to that file.
- [ ] `router.tsx` — `tasks`, `tasks/new`, `tasks/:id/edit` routes inside `RequireAuth`, **not** wrapped in `RequirePermission`. `RootLayout.tsx` — an unconditional nav link (no `<Can>`).
- [ ] `resources.ts` — `tasks` namespace registered (alphabetically between `notifications` and `tickets`).
- [ ] `NOTIFICATION_KINDS`/`notifications` locale `kinds` blocks (both languages) gain `task_due`, in lockstep with the backend's new `Kind` value.
- [ ] `CONVENTIONS.md` §23 gains the owner-scoped-full-CRUD / `datetime-local` paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes after all three migrations are committed; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: full CRUD scoped to the caller (Step 4); the ticket link and its `SET_NULL` behaviour (Step 5); `complete`/`reopen` idempotency (Step 6); the `completed` filter (Step 7); `completed_at`/`reminder_sent_at` truly read-only (Step 8); the due-reminder job firing exactly once (Step 9); the existing `NotificationBell` surfacing it with zero new frontend code (Step 10).
- [ ] Both languages walk through cleanly in the browser, including the overdue visual and the pending/completed filter (Step 11).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any throwaway second account created during verification is cleaned up (Step 13).
- [ ] `.squad/plans/agent-workspace/00-overview.md` updated with this story's row and dependency notes (task 17).

**STOP HERE. Report to the user and wait for confirmation.** The remaining `agent-workspace` stories are **`AGENT-4` (Quick Replies, depends only on `COMM-0`, complete)** and **`AGENT-5` (Team Collaboration, depends on this feature's `TKT-5` history pattern — Story 24, complete — and `SLA-4` — Story 31, now confirmed complete)** — `SupportOs backlog.MD` lines 432-444. Both are now immediately plannable.
