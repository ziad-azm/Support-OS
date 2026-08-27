# Story 31 — Alerts & Notifications (Story: SUPPORTOS-63)

## Prerequisites

- **Story 27 (SLA-0) completed** — the intake's own only named dependency. `config/celery.py` (`app.autodiscover_tasks()`) and `django-celery-beat` are already live; this story's email delivery is the project's **second** real `@shared_task` module (after `apps/sla/tasks.py`, Stories 29–30), needing no further Celery wiring.
- **Story 29 (SLA-2, Automatic Assignment) and Story 30 (SLA-3, Escalation Rules) are the two event sources this story wires into.** Both already funnel their manual and automatic triggers through one shared helper each — `apps/tickets/assignment.py::apply_assignment` and `apps/tickets/escalation.py::apply_escalation` — specifically so a single call inside each helper covers both the human action (`TicketViewSet.assign`/`escalate`) and the system action (`auto_assign_ticket`/`evaluate_escalations`) with no duplication. This story adds its `notify(...)` call **inside those two helpers**, not at their call sites, for exactly that reason.
- **Story 14 (COMM-1, Email) is the only existing email-sending code in the project** — `apps/communications/email_adapter.py:69-87`, `EmailAdapter.send`, the sole prior `django.core.mail.EmailMessage`/`.send()` usage anywhere in the backend (verified, no other hits). `EMAIL_BACKEND` is hardcoded per settings module, not `ENV`-read: `config/settings/dev.py:12` (console backend — safe by construction, nothing sends for real locally) vs. `config/settings/prod.py:19` (SMTP). `DEFAULT_FROM_EMAIL`/`EMAIL_HOST_*` (`config/settings/base.py:306-317`, the `# --- Email (COMM-1) ---` block) are already configured — task 4 reuses all of it; no new email infrastructure, no new setting.
- **Story 16 (COMM-3, Live Chat) is the only existing Channels/WebSocket precedent**, and this story's real-time push is its second consumer. `TicketChatConsumer` (`apps/communications/consumers.py:19-100`) and `LiveChatAdapter.send` (`apps/communications/live_chat_adapter.py:81-86`) are the worked example task 5 mirrors verbatim: `asgiref.sync.async_to_sync` bridges a synchronous caller into the (async) channel layer; a JWT travels in the connection's query string, never a header (browsers cannot set one on a WS handshake); `CONVENTIONS.md` line 1028's own rule — *"a connection should be permission-checked, not just authenticated, whenever the equivalent REST endpoint would be"* — is satisfied here by symmetry: `NotificationViewSet` (task 6) needs no domain permission either (see below), so the new consumer needs none beyond a valid JWT.
- **`CHANNEL_LAYERS` is `InMemoryChannelLayer`, single-process only** (`config/settings/base.py:352-356`, its own comment: *"a deliberate scope limit... Redis entered this project through Celery, and `CHANNEL_LAYERS` does not (yet) reuse it"*). This has a real, load-bearing consequence for this story specifically: `auto_assign_ticket`/`evaluate_escalations` run inside the **Celery worker process** (`celery -A config worker`), a different OS process from the one serving HTTP/WebSocket traffic (Daphne, `INSTALLED_APPS`'s `"daphne"` entry). A `group_send` call made from inside the worker process can never reach a browser's WebSocket connection held open in the Daphne process — the in-memory layer has no cross-process transport. **Consequence, accepted rather than worked around:** a notification's live "toast the moment it happens" push only actually reaches the browser when `notify(...)` is called from the same process serving that browser's HTTP/WS traffic — i.e. the **manual** paths (`TicketViewSet.assign`/`escalate`, both synchronous view code). The **automatic** paths (`auto_assign_ticket`, `evaluate_escalations`) still create the `Notification` row correctly and it is still visible the next time the frontend fetches — it just does not arrive as a live push. See `## Edge Cases`. Fixing this for real means moving `CHANNEL_LAYERS` onto the Celery broker's own Redis instance (`channels_redis`) — out of scope here, and not asked for by the intake.
- **No `apps/notifications` app exists yet, and no `Task`/`Collaboration` model exists anywhere** (`apps/agents/models.py` is untouched `startapp` scaffolding — one line, `# Create your models here.`). The intake's "reused by tasks, collaboration, SLA, AI" names **future** consumers, not present ones: `.squad/plans/agent-workspace/00-overview.md:24` and `SupportOs backlog.MD:427,441` both confirm `AGENT-3` (Tasks & Reminders) and `AGENT-5` (Team Collaboration) are blocked on this story shipping, not the reverse. This story therefore builds the shared service and wires it into the two event sources that already exist (assignment, escalation) — it does not invent a `Task`/`Collaboration` model to notify about, and does not widen `Notification`'s "what is this about" field into a `GenericForeignKey`/`ContentType` relation (verified: zero existing use of either anywhere in the codebase — this would be the first). A plain, nullable `ForeignKey(Ticket)` is the correct, honest scope for what exists today; widening it is deferred to whichever future story actually adds a second target type.
- **In-app notifications are agent-only, by construction, not by a new rule.** `AUTH_USER_MODEL = "accounts.User"` (`config/settings/base.py:73`) has no `is_agent`/`user_type` field and no notification-preference field (verified — `apps/accounts/models.py:89-134` is the entire field list). Customers are a wholly separate model (`apps.customers.models.Customer`, never logged in, never `AUTH_USER_MODEL`). Since an in-app notification implies a signed-in recipient, `Notification.recipient` can only ever be `accounts.User` — this is also exactly right for this story's two event kinds (ticket assigned, ticket escalated), which are both agent-facing already.
- **This story deliberately wires exactly two event sources, not four.** The intake names no specific trigger list; two are chosen because each already has a single, shared, no-duplication hook point (`apply_assignment`, `apply_escalation`, both above). A third candidate — "new inbound message" — is deliberately **not** wired: there is no single existing chokepoint for it. `MessageViewSet.perform_create` (`apps/communications/views.py:63-80`) only handles **outbound** messages (`if instance.direction != Message.Direction.OUTBOUND: return`, lines 65-66); every inbound message is created independently by each channel adapter's own `receive()` (`EmailAdapter.receive`, `WhatsAppAdapter.receive`, `SMSAdapter.receive`, `LiveChatAdapter.receive`, `WebFormAdapter`'s equivalent — five separate call sites, none funneling through one place). Wiring this would mean either touching all five adapters or adding the codebase's first `Message` `post_save` signal — a real design decision the intake does not ask for. **Not built here.** A fourth candidate, "SLA at-risk" as a state distinct from "escalated," is also not built: `evaluate_escalations` (`apps/sla/tasks.py:47-69`) has no separate "at-risk but not yet escalated" persisted state — `compute_sla_status` computes it live, on every tick, and immediately escalates via `apply_escalation(ticket, True)` the moment a ticket is at-risk or idle. Wiring the escalation hook alone therefore already covers "an at-risk ticket got escalated automatically" with no separate hook needed.
- **`NotificationViewSet` deliberately does not extend `apps.core.views.BaseModelViewSet`** (`ModelViewSet` + `permission_map`, the template `CONVENTIONS.md` §23 names for every feature's `views.py`) — the first documented deviation from it. Two reasons, both structural: (1) a `Notification` row is created only by `apps.notifications.services.notify` (system-managed) — there is no create/update/destroy surface to expose via the API at all, unlike every other domain viewset in this project; (2) every action here is scoped to `request.user`'s own rows via `get_queryset`, not gated by a domain permission string the way `tickets.manage`/`customers.view` are — there is nothing for a `permission_map` to name. `NotificationViewSet` is instead `mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet` with `permission_classes = [IsAuthenticated]` only (no `HasPermission`) and two write actions (`mark_read`, `mark_all_read`) plus one read action (`unread_count`) — see task 6. No new `Permissions` constant is added.

---

## Story Goal

1. **A shared notification service** (`apps/notifications/`): a `Notification` model (in-app record, one row per recipient per event); `apps/notifications/services.py::notify(...)`, the single entry point every feature calls to raise a notification (creates the row, best-effort broadcasts it live over the channel layer, best-effort queues its email); `apps/notifications/tasks.py::send_notification_email`, the project's second `@shared_task` module. Wired into the two existing event sources that already have a single shared hook point: ticket assignment (`apply_assignment`) and ticket escalation (`apply_escalation`) — both already fire from a manual and an automatic path today.
2. **A notification center UI**: a bell icon in the header (`RootLayout`) showing an unread count, opening a dropdown panel of recent notifications (mark-as-read per item, mark-all-read), plus a live toast when a notification arrives while the app is open (best-effort — see `## Prerequisites`' `InMemoryChannelLayer` limitation).

### What this story holds, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `Notification` (`recipient`, `kind`, nullable `ticket`, `title`, `body`, `read_at`, `email_sent_at`) | The in-app record. `kind` starts with exactly two values — `ticket_assigned`, `ticket_escalated` — matching the two event sources actually wired this story. |
| `notify(recipient, kind, *, title, body="", ticket=None)` | The one call every feature makes to raise a notification — "one notification system... so that all features send alerts consistently" (intake, verbatim). |
| Email delivery via `send_notification_email` (`@shared_task`) | "in-app + email delivery" (intake, task 1). Reuses Story 14's existing `EMAIL_BACKEND`/`DEFAULT_FROM_EMAIL` wholesale — no new provider, no new setting. |
| Real-time push via a per-user Channels group (`notifications_<user id>`) | Mirrors `LiveChatAdapter`/`TicketChatConsumer` (Story 16) — the only existing precedent for "push a live update to an open browser tab." Powers the "toast" half of task 2. Known partial limitation — see `## Prerequisites`. |
| Wired into `apply_assignment`/`apply_escalation` | The two event sources that already have exactly one shared hook point covering both their manual and automatic trigger paths (Stories 22/29 and 23/30). |
| `NotificationBell` (header) + dropdown + `useNotificationSocket` | "Notification center UI... reusable... + toasts" (intake, task 2). |

**Not here, and why:**

- **No "new message" notification trigger.** No single existing chokepoint covers both directions and all five channels — see `## Prerequisites`. Building one (a `Message.post_save` signal, or five adapter edits) is a real design decision the intake does not ask for.
- **No separate "SLA at-risk" notification kind.** `evaluate_escalations` has no persisted "at-risk but not escalated yet" state to notify about distinctly from "escalated" — see `## Prerequisites`.
- **No `Task`/`Collaboration` model, no AI-triggered notification.** `AGENT-3`/`AGENT-5`/any AI story are unbuilt and explicitly named as *future consumers* of this service (`.squad/plans/agent-workspace/00-overview.md:24`), not something this story builds against.
- **No `GenericForeignKey`/`ContentType` relation.** `Notification.ticket` is a plain nullable `ForeignKey(Ticket)` — the first, and only, target type that exists. Widening this is future work for whichever story adds a second one.
- **No per-user notification preferences** (e.g. "email me for X but not Y"). `accounts.User` has no such field today, and the intake does not ask for one; every notification is delivered both in-app and by email, unconditionally.
- **No new `Permissions` constant, no permission-grant migration.** `NotificationViewSet` is authenticated-only, scoped by `recipient=request.user` — see `## Prerequisites`.
- **No dedicated "all notifications" page/route.** The header dropdown is this story's entire "notification center" — no sibling story or intake line asks for a separate full-page inbox, and the dropdown's own `unread_count`-driven badge plus a 10-row recent list is enough surface for what exists today.
- **A dedicated 403 screen, automated tests.** Same standing project-wide calls as every prior story (`RequirePermission` redirects to `/`; `CONVENTIONS.md` §16 — no test file anywhere).

---

## Context — Read These Files First

**Backend**

1. `.squad/stories/sla-automation/SUPPORTOS-63/intake.md` — two tasks, no attachments, no acceptance criteria; `SupportOs backlog.MD:483-489` is its source (`SLA-4`, `Dependencies: SLA-0`).
2. `backend/apps/sla/tasks.py` (70 lines) — `@shared_task` module-docstring/decorator style, the `try/except`-free "no-op is normal, not an error" tone in each task's own docstring. `apps/sla/models.py` (184 lines) — `TimeStampedModel` subclass shape, `TextChoices` nested in the model, `Meta.ordering` as a tuple, every field's label wrapped in `_(...)`.
3. `backend/apps/core/models.py:4-15` — `TimeStampedModel` itself (`created_at`/`updated_at`, `abstract = True`).
4. `backend/apps/tickets/assignment.py` (64 lines, full file) — `apply_assignment` (lines 43-63): task 8 adds the `notify(...)` call right before its final `return True`, guarded `if agent is not None:` (skip on unassign, `agent=None`).
5. `backend/apps/tickets/escalation.py` (28 lines, full file) — `apply_escalation` (lines 12-27): task 9 adds the `notify(...)` call right before its final `return True`, guarded `if escalated and ticket.assigned_agent is not None:` (skip on de-escalation, and skip when nobody is assigned to notify).
6. `backend/apps/tickets/models.py` — `Ticket.assigned_agent` (a `ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, ...)`, ~lines 79-86) — the field `apply_escalation`'s new notification reads to find its recipient; `Ticket.Status`/`Meta.ordering` for context only, unchanged.
7. `backend/apps/communications/email_adapter.py:1-87` (full file) — `EmailAdapter.send` (lines 69-87), the only existing `EmailMessage`/`.send()` call in the backend; task 4's `send_notification_email` follows its import (`from django.core.mail import EmailMessage`) and construction shape, but — unlike it — needs no "recipient has no email" guard (`accounts.User.email` is a required, unique field; `Customer.email` is not, which is why `EmailAdapter.send` has that guard and this task does not).
8. `backend/config/settings/base.py:306-317` (`# --- Email (COMM-1) ---`) — `EMAIL_HOST`/`DEFAULT_FROM_EMAIL`/etc., already configured, reused verbatim. `base.py:345-356` (`# --- Live Chat / Channels (COMM-3) ---`) — `ASGI_APPLICATION`, `CHANNEL_LAYERS` (`InMemoryChannelLayer`) and its own comment naming the single-process limitation task 5 must respect. `base.py:33-71` — `LOCAL_APPS` (task 1 appends `"apps.notifications"` immediately after `"apps.sla"`, before `"apps.knowledge_base"` — placing it beside the epic it ships in). `base.py:73` — `AUTH_USER_MODEL = "accounts.User"`.
9. `backend/apps/communications/consumers.py:19-100` (full file) — `TicketChatConsumer`: the `connect`/`disconnect`/`group_add`/`group_discard` shape task 5's `NotificationConsumer` mirrors, including the query-string JWT read (`self.scope["query_string"]`) and `AccessToken`/`TokenError` handling (lines 50-55). `backend/apps/communications/live_chat_adapter.py:1-2,81-86` — `LiveChatAdapter.send`'s `async_to_sync(channel_layer.group_send)(...)` call, the exact shape `notify()`'s own broadcast step copies. `backend/apps/communications/routing.py` (full file, 8 lines) and `backend/config/asgi.py` (full file, 24 lines) — the `websocket_urlpatterns` + `ProtocolTypeRouter` wiring task 5 extends to include a second app's routes.
10. `backend/apps/core/views.py:12-31` — `BaseModelViewSet` (for contrast: `NotificationViewSet` deliberately does *not* extend this — see `## Prerequisites`). `backend/apps/core/permissions.py:18-32` — current `Permissions` list (unchanged by this story — confirms no new constant is needed). `backend/apps/core/serializers.py` (full file, 20 lines) — `BaseModelSerializer`, which `NotificationSerializer` still extends (only the *viewset* base changes, not the serializer base).
11. `backend/apps/tickets/serializers.py`'s `TicketSerializer.customer_name` (a read-only `CharField(source="customer.name", read_only=True)`) — the precedent `NotificationSerializer.ticket_subject` copies, adapted with `default=""` for the nullable `ticket` relation.
12. `backend/apps/tickets/urls.py` (full file, 18 lines) and `backend/config/api_urls.py` (full file, 20 lines) — the `SimpleRouter` + one more `include()` **above** the catch-all `re_path`, which must stay last. Task 6 follows this exactly.
13. `backend/apps/sla/admin.py` — `SLAPolicyAdmin`/`AssignmentRuleAdmin`/`EscalationRuleAdmin`'s `list_display`/`list_filter`/`readonly_fields` shape; task 7's `NotificationAdmin` is read-only ops visibility (nothing to configure, unlike those three admin-as-config-UI examples).
14. `CONVENTIONS.md` §16 (lines 251-258, no tests), §22 (lines 735-832, `permission_map`/"unmapped grants" rule — cited for contrast), §23 (lines 834-1281, feature module template; lines 1028-1043 specifically — the real-time-delivery/WebSocket-auth paragraph task 5's consumer must satisfy), §24 (lines 1282-1322, background jobs — `@shared_task`, `app.autodiscover_tasks()`, the Windows `--pool=solo` caveat).

**Frontend**

15. `frontend/src/app/RootLayout.tsx` (full file, 54 lines) — the `ms-auto flex items-center gap-2` div (lines 35-46): task 15 inserts `<NotificationBell />` there, before `<LanguageSwitcher />` (line 44).
16. `frontend/src/shared/ui/ThemeToggle.tsx` (full file, 51 lines) — the exact `DropdownMenu`/`DropdownMenuTrigger` (icon `Button`, `aria-label`)/`DropdownMenuContent align="end"`/`DropdownMenuItem` structure task 14's `NotificationBell` copies. `frontend/src/shared/ui/primitives/dropdown-menu.tsx` — confirms `DropdownMenuContent` already has `max-h-(--radix-dropdown-menu-content-available-height)` + `overflow-y-auto` built in (no new primitive needed for a scrollable notification list). `frontend/src/shared/ui/primitives/badge.tsx` (full file, 47 lines) — `Badge`, used for the unread-count pill.
17. `frontend/src/features/tickets/api/useTicketSla.ts` (full file, 20 lines), `getTicketSla.ts`, `ticketKeys.ts` — the `get<Thing>.ts` + `use<Thing>` + `featureKey` shape task 10's `getNotifications`/`useNotifications`/`notificationKeys` mirrors exactly.
18. `frontend/src/features/customers/api/useCustomerMutations.ts` (full file, 40 lines) — the mutation + `onSuccess: () => queryClient.invalidateQueries({ queryKey: X.all })` shape task 11 copies for `useMarkNotificationRead`/`useMarkAllNotificationsRead`.
19. `frontend/src/features/tickets/api/useTicketChatSocket.ts` (full file, 33 lines) and `frontend/src/shared/lib/ws.ts` (full file, 13 lines) — the exact `new WebSocket(getWebSocketUrl(...))` + `getAccessToken()` + no-reconnect shape task 12's `useNotificationSocket` copies, scoped per-user instead of per-ticket.
20. `frontend/src/shared/ui/toast/useToast.ts`, `toastSink.ts`, `types.ts` (all read in full) — `useToast().toast({ tone: 'info', message })`, called from inside `useNotificationSocket` (a hook mounted inside the React tree, so the hook form is used, not the `pushToast` escape hatch reserved for code outside it).
21. `frontend/src/shared/lib/api/client.ts` (full file, 174 lines) — `api.get`/`api.post`/`api.getPage` (no new client method needed). `frontend/src/shared/lib/api/queryClient.ts` (full file, 56 lines) — `staleTime: 30_000`, `refetchOnWindowFocus: false` — this is *why* task 14's dropdown explicitly invalidates on open rather than relying on a background refetch (see `## Product rules`).
22. `frontend/src/shared/i18n/resources.ts` (full file, 52 lines) — the two-imports-plus-one-entry-per-language registration; task 13 adds a `notifications` entry the same way. `frontend/src/features/tickets/locales/en.json` — the nested-group JSON shape (`fields`, `actions`, etc.) task 13's own locale file follows.
23. `frontend/src/shared/auth/tokenStorage.ts` (full file) — `getAccessToken()`, used by task 12 exactly as `useTicketChatSocket` already does.
24. `frontend/src/README.md` — "A feature never imports from another feature" (a new `features/notifications/` is a clean, standalone feature — nothing here needs another feature's code).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **One notification system; all features send alerts through it.** | Intake, task 1 | `apps.notifications.services.notify(...)` — the single entry point every caller uses. |
| **In-app + email delivery.** | Intake, task 1 | `Notification` row (in-app) + `send_notification_email` (`@shared_task`, email). Both fired from `notify()`, independently guarded. |
| **Triggered from events.** | Intake, task 1 | Two existing shared helpers, each already covering a manual and an automatic trigger: `apply_assignment`, `apply_escalation`. See `## Prerequisites` for why exactly these two and no others. |
| **A notification about a ticket is a plain FK, not a generic relation — no second target type exists yet.** | This story's design | `Notification.ticket = ForeignKey(Ticket, null=True, blank=True)`. |
| **In-app delivery is agent-only; `Notification.recipient` is always `accounts.User`.** | This story's design, per verified `User` model | `recipient = ForeignKey("accounts.User", on_delete=models.CASCADE)`. |
| **No domain permission gates a user's own notification inbox.** | This story's design | `NotificationViewSet` — `IsAuthenticated` only, `get_queryset` scoped to `recipient=request.user`; no `Permissions` constant added. |
| **Reusable notification center + toasts.** | Intake, task 2 | `NotificationBell` (header dropdown) + `useNotificationSocket` (live push → `useToast()`). |
| **The dropdown must not depend on the live socket for correctness** — `staleTime: 30_000`/`refetchOnWindowFocus: false` means a stale list otherwise, and the automatic (Celery) trigger paths cannot push live at all (see `## Prerequisites`). | This story's design | `DropdownMenu`'s `onOpenChange` explicitly invalidates `notificationKeys.all` every time the panel opens. |
| Wire format is `snake_case` end to end. | §12 | `Notification`/`NotificationSerializer` TS mirror is a 1:1 field match. |
| No new dependency, no new secret. | §17 | `django.core.mail`, `channels`, `django-celery-beat` are all already installed; `lucide-react`'s `Bell` icon is already a dependency (used by `ThemeToggle`'s `SunIcon`/`MoonIcon`/`MonitorIcon`). |

---

## Backend Tasks

### 1 — App scaffold

**Create file: `backend/apps/notifications/__init__.py`** (empty).

**Create file: `backend/apps/notifications/apps.py`**

```python
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
```

**File: `backend/config/settings/base.py`** — insert `"apps.notifications"` into `LOCAL_APPS` (currently lines 55-69) immediately after `"apps.sla"` and before `"apps.knowledge_base"`:

```python
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.organization",
    "apps.customers",
    "apps.tickets",
    "apps.communications",
    "apps.agents",
    "apps.sla",
    "apps.notifications",
    "apps.knowledge_base",
    "apps.portal",
    "apps.reports",
    "apps.ai",
    "apps.integrations",
]
```

---

### 2 — The `Notification` model

**Create file: `backend/apps/notifications/models.py`**

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Notification(TimeStampedModel):
    """The shared notification service's in-app record — SLA-4.

    Created only by `apps.notifications.services.notify`, never directly by
    the API (see `apps/notifications/views.py::NotificationViewSet`, which is
    read-plus-mark-read only). `kind` starts with exactly the two event
    sources this story wires: automatic/manual ticket assignment and
    automatic/manual ticket escalation. See Story 31 `## Prerequisites`.
    """

    class Kind(models.TextChoices):
        TICKET_ASSIGNED = "ticket_assigned", _("Ticket assigned")
        TICKET_ESCALATED = "ticket_escalated", _("Ticket escalated")

    # CASCADE, not SET_NULL: unlike Ticket.assigned_agent (which keeps the
    # ticket when its agent is removed), a Notification exists *for* its
    # recipient — one has no meaning without the other. See Story 31
    # `## Prerequisites` for the contrast with Ticket.customer's PROTECT.
    recipient = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name=_("recipient"),
    )
    kind = models.CharField(_("kind"), max_length=30, choices=Kind.choices)
    # Nullable: a plain FK to the one target type that exists today, not a
    # GenericForeignKey — see Story 31 `## Prerequisites`.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
        verbose_name=_("ticket"),
    )
    title = models.CharField(_("title"), max_length=255)
    body = models.CharField(_("body"), max_length=500, blank=True)
    read_at = models.DateTimeField(_("read at"), null=True, blank=True)
    email_sent_at = models.DateTimeField(_("email sent at"), null=True, blank=True)

    class Meta:
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} → {self.recipient}"
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations notifications
```

Expect one file, `apps/notifications/migrations/0001_initial.py`, depending on `accounts`' and `tickets`' latest migrations. **Commit it.**

---

### 3 — Serializer

**Create file: `backend/apps/notifications/serializers.py`**

```python
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Notification


class NotificationSerializer(BaseModelSerializer):
    # Read-only convenience for the dropdown, same role TicketSerializer's
    # customer_name plays. default="" covers a null `ticket` (this
    # notification's kind may not be ticket-anchored in a future story).
    ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")

    class Meta(BaseModelSerializer.Meta):
        model = Notification
        fields = (
            "id",
            "kind",
            "ticket",
            "ticket_subject",
            "title",
            "body",
            "read_at",
            "created_at",
            "updated_at",
        )
```

No `recipient` field — every row returned by `NotificationViewSet.get_queryset` already belongs to `request.user`; echoing it back is redundant.

---

### 4 — `notify()` and the email task

**Create file: `backend/apps/notifications/tasks.py`**

```python
"""Background tasks — SLA-4. The project's second `@shared_task` module,
after `apps/sla/tasks.py` (Stories 29-30). `app.autodiscover_tasks()`
(`config/celery.py`) finds this module with no further wiring.
"""

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from .models import Notification


@shared_task
def send_notification_email(notification_id: int) -> None:
    """Sends the email half of an in-app notification. A no-op if the
    notification was deleted before this ran (mirrors `auto_assign_ticket`'s
    own `DoesNotExist` guard, Story 29) or if it was already emailed
    (idempotent against a retried task). Unlike `EmailAdapter.send`
    (Story 14), there is no "recipient has no email" guard needed —
    `accounts.User.email` is a required, unique field, unlike
    `Customer.email`.
    """
    try:
        notification = Notification.objects.select_related("recipient").get(pk=notification_id)
    except Notification.DoesNotExist:
        return
    if notification.email_sent_at is not None:
        return

    email = EmailMessage(
        subject=notification.title,
        body=notification.body or notification.title,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[notification.recipient.email],
    )
    email.send()
    notification.email_sent_at = timezone.now()
    notification.save(update_fields=["email_sent_at", "updated_at"])
```

**Create file: `backend/apps/notifications/services.py`**

```python
"""The shared notification service's one entry point — SLA-4.

`notify(...)` is what "one notification system... so that all features send
alerts consistently" (intake) actually means in code: every event source
(today: `apps/tickets/assignment.py::apply_assignment`,
`apps/tickets/escalation.py::apply_escalation`; future: tasks, collaboration,
SLA, AI, per the intake's own "reused by" note) calls this and nothing else.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification
from .serializers import NotificationSerializer
from .tasks import send_notification_email

logger = logging.getLogger(__name__)


def notify(recipient, kind: str, *, title: str, body: str = "", ticket=None) -> Notification:
    """Creates the in-app `Notification` row, then best-effort pushes it live
    over the channel layer and best-effort queues its email delivery.

    The row itself is a plain, synchronous DB write — no try/except around
    it, the same way `apply_assignment`/`apply_escalation`'s own `ticket.save()`
    calls right beside this one are not defensively wrapped either. The two
    steps *after* it are genuinely best-effort side effects (a down channel
    layer, or Redis/the Celery worker being unavailable), each independently
    guarded so one failing never blocks the other and neither ever undoes the
    already-committed row — the same commit-first idiom
    `MessageViewSet.perform_create`/`TicketViewSet.perform_create` already use
    (Stories 14/29), consolidated here in one place since `notify` has
    multiple call sites from day one, unlike either of those.
    """
    notification = Notification.objects.create(
        recipient=recipient, kind=kind, ticket=ticket, title=title, body=body
    )

    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient.id}",
            {"type": "notification.message", "notification": NotificationSerializer(notification).data},
        )
    except Exception:
        logger.exception("Failed to broadcast notification %s over the channel layer", notification.id)

    try:
        send_notification_email.delay(notification.id)
    except Exception:
        logger.exception("Failed to queue email delivery for notification %s", notification.id)

    return notification
```

---

### 5 — Real-time consumer and routing

**Create file: `backend/apps/notifications/consumers.py`**

```python
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

UNAUTHORIZED = 4401


class NotificationConsumer(AsyncWebsocketConsumer):
    """One WebSocket per signed-in user's own notification stream —
    receive-only, mirroring `TicketChatConsumer`'s agent-side connection
    (Story 16) but scoped to a user, not a ticket. Authenticated only, no
    domain permission — the equivalent REST endpoint (`NotificationViewSet`)
    needs none either, for the same reason (see Story 31
    `## Prerequisites`), satisfying `CONVENTIONS.md`'s own rule that a
    connection be "permission-checked, not just authenticated, whenever the
    equivalent REST endpoint would be" (line 1038).
    """

    async def connect(self):
        query = dict(
            pair.split("=", 1)
            for pair in self.scope["query_string"].decode().split("&")
            if "=" in pair
        )
        jwt_token = query.get("token")
        if not jwt_token:
            await self.close(code=UNAUTHORIZED)
            return
        try:
            access = AccessToken(jwt_token)
        except TokenError:
            await self.close(code=UNAUTHORIZED)
            return
        user = await database_sync_to_async(
            get_user_model().objects.filter(pk=access["user_id"]).first
        )()
        if user is None:
            await self.close(code=UNAUTHORIZED)
            return

        self.group_name = f"notifications_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event["notification"]))
```

**Create file: `backend/apps/notifications/routing.py`**

```python
from django.urls import re_path

from .consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/notifications/$", NotificationConsumer.as_asgi()),
]
```

**File: `backend/config/asgi.py`** — combine both apps' routes:

```python
from apps.communications.routing import websocket_urlpatterns as communications_websocket_urlpatterns  # noqa: E402
from apps.notifications.routing import websocket_urlpatterns as notifications_websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            URLRouter(communications_websocket_urlpatterns + notifications_websocket_urlpatterns)
        ),
    }
)
```

---

### 6 — Viewset and routing

**Create file: `backend/apps/notifications/views.py`**

```python
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """The caller's own notification inbox — read-only plus two write
    actions, never full CRUD. Deliberately not `apps.core.views.BaseModelViewSet`
    (`ModelViewSet` + `permission_map`) — a `Notification` is created only by
    `apps.notifications.services.notify`, and every action here is scoped to
    `request.user`'s own rows rather than gated by a domain permission. See
    Story 31 `## Prerequisites`.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related("ticket")

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=204)

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})
```

**Create file: `backend/apps/notifications/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import NotificationViewSet

app_name = "notifications"

router = SimpleRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
```

**File: `backend/config/api_urls.py`** — one more `include()`, above the catch-all:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.notifications.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoints: `GET /api/notifications/`, `GET /api/notifications/<pk>/`, `POST /api/notifications/<pk>/mark_read/`, `POST /api/notifications/mark_all_read/`, `GET /api/notifications/unread_count/`.

---

### 7 — Admin

**Create file: `backend/apps/notifications/admin.py`**

```python
from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — unlike SLAPolicy/
    AssignmentRule/EscalationRule (Stories 28-30), there is nothing to
    configure here: `kind` is a fixed code vocabulary, not admin-managed
    data.
    """

    list_display = ("recipient", "kind", "ticket", "read_at", "email_sent_at", "created_at")
    list_filter = ("kind",)
    search_fields = ("recipient__email", "title")
    readonly_fields = ("created_at", "updated_at")
```

---

### 8 — Wire into ticket assignment

**File: `backend/apps/tickets/assignment.py`** — add imports and the `notify(...)` call:

```python
from apps.notifications.models import Notification
from apps.notifications.services import notify
```

```python
def apply_assignment(ticket, agent, actor) -> bool:
    """..."""
    old_agent = ticket.assigned_agent
    if agent == old_agent:
        return False
    ticket.assigned_agent = agent
    ticket.save(update_fields=["assigned_agent", "updated_at"])
    TicketActivity.objects.create(
        ticket=ticket,
        actor=actor,
        kind=TicketActivity.Kind.ASSIGNED,
        from_value=old_agent.get_full_name() if old_agent else "",
        to_value=agent.get_full_name() if agent else "",
    )
    if agent is not None:
        notify(
            agent,
            Notification.Kind.TICKET_ASSIGNED,
            ticket=ticket,
            title=f"Ticket #{ticket.id} assigned to you",
            body=ticket.subject,
        )
    return True
```

**No new import cycle:** `apps.tickets.assignment` → `apps.notifications.services` → `apps.notifications.models` → `apps.tickets.models` (a different module within `apps.tickets`, which imports nothing back from `apps.notifications` or `apps.tickets.assignment`) — verified safe, the same "reverse cross-app relationship" pattern `apps/sla/escalation_rules.py` already documents.

**Guarded `if agent is not None:`** — an unassignment (`agent=None`) never notifies; there is no one to notify.

---

### 9 — Wire into ticket escalation

**File: `backend/apps/tickets/escalation.py`** — add imports and the `notify(...)` call:

```python
from apps.notifications.models import Notification
from apps.notifications.services import notify
```

```python
def apply_escalation(ticket, escalated: bool) -> bool:
    """..."""
    if escalated == ticket.escalated:
        return False
    ticket.escalated = escalated
    ticket.escalated_at = timezone.now() if escalated else None
    ticket.save(update_fields=["escalated", "escalated_at", "updated_at"])
    if escalated and ticket.assigned_agent is not None:
        notify(
            ticket.assigned_agent,
            Notification.Kind.TICKET_ESCALATED,
            ticket=ticket,
            title=f"Ticket #{ticket.id} escalated",
            body=ticket.subject,
        )
    return True
```

**Guarded `if escalated and ticket.assigned_agent is not None:`** — de-escalation never notifies (this story's job/action stays one-directional, same as Story 30's own `evaluate_escalations`), and an unassigned ticket has no agent to notify. Both `apply_assignment` (Story 22/29) and `apply_escalation` (Story 23/30) already run for their manual (`TicketViewSet.assign`/`escalate`) and automatic (`auto_assign_ticket`/`evaluate_escalations`) callers alike, so this one insertion point covers all four trigger paths with no further changes to `apps/sla/tasks.py` or `apps/tickets/views.py`.

---

## Frontend Tasks

### 10 — Types, API layer, and query keys

**Create file: `frontend/src/features/notifications/types/notification.ts`**

```ts
export const NOTIFICATION_KINDS = ['ticket_assigned', 'ticket_escalated'] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Mirrors `apps.notifications.serializers.NotificationSerializer` verbatim. */
export type Notification = {
  id: number
  kind: NotificationKind
  ticket: number | null
  ticket_subject: string
  title: string
  body: string
  read_at: string | null
  created_at: string
  updated_at: string
}
```

**Create file: `frontend/src/features/notifications/api/notificationKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const notificationKeys = featureKey('notifications')
```

**Create file: `frontend/src/features/notifications/api/getNotifications.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Notification } from '../types/notification'

export function getNotifications(): Promise<Page<Notification>> {
  return api.getPage<Notification>('/notifications/', { params: { page_size: 10 } })
}
```

**Create file: `frontend/src/features/notifications/api/getUnreadCount.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function getUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>('/notifications/unread_count/')
}
```

**Create file: `frontend/src/features/notifications/api/useNotifications.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getNotifications } from './getNotifications'
import { notificationKeys } from './notificationKeys'

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.resource('list'),
    queryFn: getNotifications,
  })
}
```

**Create file: `frontend/src/features/notifications/api/useUnreadCount.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getUnreadCount } from './getUnreadCount'
import { notificationKeys } from './notificationKeys'

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.resource('unreadCount'),
    queryFn: getUnreadCount,
  })
}
```

---

### 11 — Mutations

**Create file: `frontend/src/features/notifications/api/markNotificationRead.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Notification } from '../types/notification'

export function markNotificationRead(id: number): Promise<Notification> {
  return api.post<Notification>(`/notifications/${id}/mark_read/`)
}
```

**Create file: `frontend/src/features/notifications/api/markAllNotificationsRead.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function markAllNotificationsRead(): Promise<void> {
  return api.post('/notifications/mark_all_read/')
}
```

**Create file: `frontend/src/features/notifications/api/useNotificationMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markAllNotificationsRead } from './markAllNotificationsRead'
import { markNotificationRead } from './markNotificationRead'
import { notificationKeys } from './notificationKeys'

// Prefix-wide invalidation, same reason as useCustomerMutations: a read
// changes both the list (read_at) and the unread count together.
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
```

---

### 12 — The WebSocket hook

**Create file: `frontend/src/features/notifications/api/useNotificationSocket.ts`**

```ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getAccessToken } from '@/shared/auth/tokenStorage'
import { getWebSocketUrl } from '@/shared/lib/ws'
import { useToast } from '@/shared/ui/toast/useToast'

import { notificationKeys } from './notificationKeys'
import type { Notification } from '../types/notification'

/**
 * Receive-only, mirroring `useTicketChatSocket` (Story 16) but scoped to the
 * signed-in user rather than a ticket. No automatic reconnection — a
 * dropped connection stops delivering live pushes until this component
 * remounts (same accepted limitation Story 16 documents).
 *
 * A notification whose event was raised from a Celery worker process (the
 * automatic assignment/escalation paths) never arrives here at all —
 * `CHANNEL_LAYERS` is `InMemoryChannelLayer`, single-process only. The
 * notification still exists and is fetched normally the next time the
 * bell's dropdown opens (`NotificationBell`'s `onOpenChange` invalidation).
 * See Story 31 `## Prerequisites`.
 */
export function useNotificationSocket() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const socket = new WebSocket(getWebSocketUrl(`/ws/notifications/?token=${token}`))
    socket.onmessage = (event) => {
      const notification = JSON.parse(event.data) as Notification
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      toast({ tone: 'info', message: notification.title })
    }
    return () => socket.close()
  }, [queryClient, toast])
}
```

---

### 13 — Locale namespace

**Create file: `frontend/src/features/notifications/locales/en.json`**

```json
{
  "bell": {
    "label": "Notifications"
  },
  "empty": "No notifications yet",
  "markAllRead": "Mark all as read",
  "kinds": {
    "ticket_assigned": "Ticket assigned",
    "ticket_escalated": "Ticket escalated"
  }
}
```

**Create `frontend/src/features/notifications/locales/ar.json`** with the identical key set, translated.

**File: `frontend/src/shared/i18n/resources.ts`** — register the namespace, two imports plus one entry per language, following the existing `auth`/`customers`/`tickets`/`liveChat`/`webForm` pattern (lines 1-12, 29-52).

---

### 14 — The `NotificationBell` component

**Create file: `frontend/src/features/notifications/components/NotificationBell.tsx`**

Structure copied from `ThemeToggle.tsx` (icon `Button` trigger + `DropdownMenuContent align="end"` + `DropdownMenuItem` per row), with:

- `useNotificationSocket()` called once, at the top of this component (the only place it is used — no need to lift it into `RootLayout`).
- `BellIcon` (`lucide-react`) as the trigger icon; a `Badge variant="destructive"` overlaid (absolutely positioned, `-top-1 -end-1`, RTL-safe logical offset) showing `useUnreadCount().data?.count` when greater than zero.
- `DropdownMenu` with `onOpenChange={(open) => { if (open) queryClient.invalidateQueries({ queryKey: notificationKeys.all }) }}` — the dropdown always fetches fresh on open, not relying on the live socket (see `## Product rules`).
- Inside `DropdownMenuContent`: a `t('markAllRead')` item (calls `useMarkAllNotificationsRead()`) when any unread notification exists; then `useNotifications().data?.items.map(...)`, each a `DropdownMenuItem` showing `notification.title` and `useFormatters().dateTime(notification.created_at)`, unread ones visually distinguished (e.g. a small dot or bold text — no new primitive needed); `t('empty')` when the list is empty.
- Clicking a row calls `useMarkNotificationRead(notification.id)` and, if `notification.ticket` is not `null`, navigates to `/tickets/${notification.ticket}` via `useNavigate()` (`react-router`).

---

### 15 — Wire into the header

**File: `frontend/src/app/RootLayout.tsx`** — add the import and render it inside the `ms-auto flex items-center gap-2` div (lines 35-46), before `<LanguageSwitcher />`:

```tsx
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
```

```tsx
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />
```

No change to `useTranslation([...])`'s namespace array on line 12 — `NotificationBell` calls its own `useTranslation('notifications')`, the same self-contained pattern `ThemeToggle`/`LanguageSwitcher` already use (neither is in `RootLayout`'s own namespace list either).

---

## Documentation Tasks

### 16 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after the existing real-time-delivery paragraph, ~line 1043):

> **A viewset with no create/update/destroy surface and no domain permission to gate does not extend `BaseModelViewSet`.** `apps/notifications/views.py::NotificationViewSet` (Story 31, `SLA-4`) is the first such case: `Notification` rows are created only by `apps.notifications.services.notify`, and every action is scoped to `request.user`'s own rows rather than a `tickets.manage`-style permission string. It extends `mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet` directly, with `permission_classes = [IsAuthenticated]` and no `permission_map`. Reach for this shape only when both conditions hold — a domain resource that is merely read-only but still permission-gated (there is none yet) would still extend `BaseModelViewSet` with a `permission_map` naming only its `view` permission.

And one paragraph to the end of `## 24. Background jobs (Celery, SLA-0)` (after the existing Windows `--pool=solo` paragraph):

> **`SLA-4` is the second feature to add its own `tasks.py` module** (`apps/notifications/tasks.py::send_notification_email`, after `apps/sla/tasks.py`, Stories 29-30) — confirming `app.autodiscover_tasks()` needs no per-app registration; any `apps/<app>/tasks.py` is picked up automatically.

No `.env.example` change, no new environment variable, no new dependency.

### 17 — Overview and index

**File: `.squad/plans/sla-automation/00-overview.md`** — add this story's row to the `## Stories` table:

```
| 31 | [31-story-alerts-notifications-SUPPORTOS-63.md](31-story-alerts-notifications-SUPPORTOS-63.md) | Alerts & Notifications | SUPPORTOS-63 | Story 27 (`SLA-0`), Story 29 (`SLA-2`), Story 30 (`SLA-3`) |
```

Add a dependency-notes paragraph (after Story 30's) summarizing: the two-event-source scope (assignment, escalation) and why "new message"/"SLA at-risk" are deliberately deferred; the `InMemoryChannelLayer` cross-process limitation on automatic-path live push; the `NotificationViewSet`/`BaseModelViewSet` deviation. Update the epic's closing sentence: **`sla-automation` (EPIC 7) is now fully planned** — this was its last remaining story — and note that `agent-workspace`'s `AGENT-3` (Tasks & Reminders) and `AGENT-5` (Team Collaboration) are now unblocked on the dependency this story satisfies.

**File: `.squad/plans/00-index.md`** — update the `sla-automation` row's `NN range` from `27–30` to `27–31`, and its parenthetical from `(fully planned)`-equivalent wording to note the epic is now complete (matching how `ticket-management`'s row already reads `(EPIC 4 fully planned)`).

---

## Edge Cases & Failure Modes

- **A notification raised from a Celery worker process never arrives as a live WebSocket push, only in-app on next fetch.** `auto_assign_ticket`/`evaluate_escalations` run in a separate OS process from the one serving WebSocket connections; `InMemoryChannelLayer` has no cross-process transport. The `Notification` row and its queued email are unaffected — only the live toast is missed. See `## Prerequisites`. Verified, accepted, not fixed here (would require `channels_redis` against the existing Celery Redis broker).
- **Unassigning a ticket (`agent=None`)** — `apply_assignment`'s `if agent is not None:` guard skips `notify()` entirely; no "unassigned" notification kind exists.
- **De-escalating a ticket** — `apply_escalation`'s `if escalated and ...` guard skips `notify()`; this story's notification, like Story 30's own job, is one-directional.
- **Escalating an unassigned ticket** — `ticket.assigned_agent is not None` guard skips `notify()`; there is no one to notify. The escalation itself still happens (`ticket.escalated`/`escalated_at` are set) — only the notification is skipped.
- **The channel layer or Celery worker/Redis is down when `notify()` runs** — both are individually guarded with `try/except Exception: logger.exception(...)` inside `notify()`; the `Notification` row is already committed by that point regardless, so assignment/escalation itself is never blocked or rolled back by either failure.
- **A retried `send_notification_email` task** — `if notification.email_sent_at is not None: return` makes it idempotent; the email is sent at most once per notification.
- **A `Notification` referencing a since-deleted `Ticket`** — `on_delete=CASCADE` removes the notification along with it (a notification about a ticket that no longer exists is meaningless), contrasting `Ticket.customer`'s `PROTECT` (a customer with ticket history must not silently vanish) — different relationships, different reasoning, per `CONVENTIONS.md`'s own "three deletion behaviours, chosen by what the relationship means" rule (line 1060).
- **A user with zero notifications** — `NotificationBell` renders `t('empty')`; `unread_count` returns `{"count": 0}`; no badge shown.
- **Marking an already-read notification read again** (`mark_read` called twice) — `if notification.read_at is None:` guard makes it a no-op on the second call, not an error, not a second timestamp write.
- **The WebSocket connection drops** — no automatic reconnection (same accepted limitation `useTicketChatSocket` already documents for its own socket); live pushes stop until `NotificationBell` remounts, but the dropdown's own `onOpenChange` invalidation still surfaces anything missed the next time it is opened.
- **Arabic rendering** — `t('kinds.ticket_assigned')`/`t('kinds.ticket_escalated')` translate the kind label if shown; `useFormatters().dateTime` handles the timestamp; the unread-count badge's position uses logical offsets (`-end-1`, not `-right-1`) per `check:rtl`'s enforcement.
- **A user with `tickets.view` but not the ticket that a notification references (e.g. reassigned since)** — `NotificationBell`'s click-through navigates to `/tickets/<id>/`, which is itself already permission-gated (`RequirePermission permission="tickets.view"`); no separate check is needed here.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 2's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. `npm run build` — typechecks `Notification`, `NotificationKind`, every new `t('notifications:...')` key.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the new `notifications` namespace.
7. Real, live verification with Redis + a Celery worker + Daphne all running, and a real WebSocket connection from the browser — `## Verification Steps`.

---

## Migration / Rollback

**One migration**, `apps/notifications/migrations/0001_initial.py` — creates the `Notification` table, additive only. **No change to any existing table's schema.** `apps/tickets/assignment.py` and `apps/tickets/escalation.py` gain a code-only `notify(...)` call each — no migration of their own.

**Rollback of the code:** revert the commits. **No `npm install`, no `pip install`** — every dependency used (`channels`, `django-celery-beat`, `django.core.mail`, `lucide-react`) is already installed.

**Rollback of the schema:**

```powershell
python manage.py migrate notifications zero
```

Clean — nothing outside `apps.notifications` references `Notification` (it is always the "many" side of its two FKs).

**Half-applied states to avoid:**

- **Task 8/9's `notify(...)` calls added before task 1-4's app/model/service exist** — `ImportError` on Django startup for `apps.tickets`. Ship the new app (tasks 1-7) before wiring its two callers (tasks 8-9).
- **Task 5's `asgi.py` change without task 1's `LOCAL_APPS` entry** — `apps.notifications.routing` fails to import (`apps.notifications` not an installed app yet); ship `LOCAL_APPS` first.
- **Task 15 (frontend wiring) before tasks 10-14** — every `../api/`/`../types/` import in `NotificationBell` fails to resolve; the build fails on the import, not the render.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration applies forward, no reset:** `python manage.py migrate`; `python manage.py showmigrations notifications` shows `0001` applied.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Start Redis, a Celery worker, and Daphne** (`redis-cli ping` → `PONG`; `celery -A config worker -l info --pool=solo`; `daphne config.asgi:application` or `python manage.py runserver`, per `README.md`).
5. **Manual assignment fires a notification, in-app and by email.** `POST /api/tickets/<id>/assign/` with a real agent → `200`. `GET /api/notifications/` (as that agent) shows a new `kind: "ticket_assigned"` row. The Celery worker's console log (dev's console `EMAIL_BACKEND`) shows the email that was sent.
6. **Manual escalation fires a notification.** `POST /api/tickets/<id>/escalate/ {"escalated": true}` on an assigned ticket − confirm a `kind: "ticket_escalated"` row appears for the assigned agent the same way.
7. **De-escalation and unassignment do not notify.** `POST .../escalate/ {"escalated": false}` and `POST .../assign/ {"agent": null}` − no new `Notification` rows from either call.
8. **Automatic paths still create the row, but do not push live.** Trigger `auto_assign_ticket`/`evaluate_escalations` (per Stories 29/30's own verification steps) − confirm the resulting `Notification` row exists via `GET /api/notifications/`, while a browser tab connected to `/ws/notifications/` at the time receives **no** frame for it (documented limitation, `## Prerequisites`).
9. **The live WebSocket push works for the manual paths.** With a browser open to the app (signed in as the agent being assigned/escalated to) and DevTools' Network/WS tab open, repeat step 5 or 6 from a second session − confirm a `notification.message` frame arrives and a toast appears.
10. **`mark_read`/`mark_all_read`/`unread_count` behave correctly.** `POST /api/notifications/<id>/mark_read/` twice − `read_at` set once, second call is a no-op (same timestamp). `GET /api/notifications/unread_count/` reflects the true unread count. `POST /api/notifications/mark_all_read/` − `204`, `unread_count` now `0`.
11. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as an agent with at least one notification:
    - The bell shows the correct unread badge; opening it lists recent notifications, newest first, with a working "mark all as read."
    - Clicking a notification with a ticket navigates to that ticket's detail page and marks it read.
    - Trigger a fresh manual assignment/escalation to yourself from a second tab/session − a toast appears in the first tab without reloading.
    - Switch to Arabic: labels and timestamps localise; the unread badge sits correctly in RTL (logical offset, not `-right-1`).
12. **The full gate set, in CI order:** from `frontend/` − `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps/notifications/` exists, registered in `LOCAL_APPS` (`config/settings/base.py`) immediately after `apps.sla`.
- [ ] `Notification` (`recipient` CASCADE, `kind` — exactly `ticket_assigned`/`ticket_escalated` — nullable `ticket` CASCADE, `title`, `body`, `read_at`, `email_sent_at`), one migration, committed.
- [ ] `apps/notifications/services.py::notify(...)` — creates the row, then independently try/except-guards a channel-layer broadcast and a queued `send_notification_email.delay(...)`.
- [ ] `apps/notifications/tasks.py::send_notification_email` — idempotent against a retried call, no "missing email" guard needed (contrast `EmailAdapter.send`).
- [ ] `apps/notifications/consumers.py::NotificationConsumer` + `routing.py`, wired into `config/asgi.py` alongside `apps.communications`'s own routes; JWT-in-query-string, authenticated-only (no domain permission), mirroring `TicketChatConsumer`.
- [ ] `apps/notifications/views.py::NotificationViewSet` — `ListModelMixin`+`RetrieveModelMixin`+`GenericViewSet` (**not** `BaseModelViewSet` — documented deviation), `IsAuthenticated` only, scoped to `recipient=request.user`, plus `mark_read`/`mark_all_read`/`unread_count` actions. **No new `Permissions` constant.**
- [ ] `apps/notifications/urls.py` (`SimpleRouter`) registered in `config/api_urls.py` above the catch-all; `apps/notifications/admin.py` (read-only ops visibility).
- [ ] `apps/tickets/assignment.py::apply_assignment` and `apps/tickets/escalation.py::apply_escalation` each call `notify(...)` once, correctly guarded (`agent is not None` / `escalated and ticket.assigned_agent is not None`) — covering all four existing trigger paths (manual + automatic × assignment + escalation) with these two insertion points alone.
- [ ] **No "new message" trigger, no "SLA at-risk" kind, no `Task`/`Collaboration` model, no `GenericForeignKey`** — all explicitly deferred per `## Prerequisites`.
- [ ] `features/notifications/` — `types/notification.ts`, `api/` (keys, `getNotifications`, `getUnreadCount`, `useNotifications`, `useUnreadCount`, mark-read/mark-all mutations, `useNotificationSocket`), `components/NotificationBell.tsx`, `locales/{en,ar}.json` registered in `resources.ts`.
- [ ] `RootLayout.tsx` renders `<NotificationBell />` in the header's `ms-auto` group, before `<LanguageSwitcher />`.
- [ ] The dropdown invalidates `notificationKeys.all` on every open (`onOpenChange`), independent of the live socket.
- [ ] `CONVENTIONS.md` §23 gains the `NotificationViewSet`/`BaseModelViewSet`-deviation paragraph; §24 gains the second-`tasks.py`-module paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified live: manual assignment/escalation notify in-app + email (Steps 5-6); de-escalation/unassignment do not (Step 7); automatic paths create the row but do not push live (Step 8, documented limitation); the live push and toast work for manual paths (Step 9); `mark_read`/`mark_all_read`/`unread_count` behave correctly (Step 10); full bilingual UI walkthrough (Step 11).
- [ ] `.squad/plans/sla-automation/00-overview.md` and `.squad/plans/00-index.md` updated — `sla-automation` (EPIC 7) is now fully planned.

**STOP HERE. Report to the user and wait for confirmation.** This story completes **EPIC 7 (SLA & Automation)** — `sla-automation` is now fully planned end-to-end (Stories 27-31). It also unblocks `agent-workspace`'s **`AGENT-3` (Tasks & Reminders)** and **`AGENT-5` (Team Collaboration)**, both previously blocked on this story's shared notification service — either is now immediately plannable.
