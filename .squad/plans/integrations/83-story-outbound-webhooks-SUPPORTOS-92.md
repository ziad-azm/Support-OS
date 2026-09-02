# Story 83 — Outbound Webhooks (INT-4) (Story: SUPPORTOS-92)

## Prerequisites

- **`SLA-0` (Background Jobs Foundation, Story 27, `SUPPORTOS-49`) is complete** — [../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md](../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md). `config/celery.py`'s `app.autodiscover_tasks()` finds `apps/integrations/tasks.py` (already real, from Story 81) with no further wiring. This story adds its dispatch task beside `run_erp_sync`.
- **Stories 80-82 (`INT-1`/`INT-2`/`INT-3`) are complete and implemented.** `apps/integrations/{models,serializers,views,urls,admin,tasks,apps}.py` are mature, not scaffolds — this story appends to all seven. `CONVENTIONS.md` § 29-31 are the standing rules this story's own § 32 sits beside.
- **Scope decision, confirmed with the user this session: event dispatch hooks in via Django model signals, not explicit call sites.** Verified live: `Ticket` rows are created from **eight** distinct code paths (`apps/tickets/views.py::TicketViewSet.perform_create`, `apps/portal/views.py::PortalTicketViewSet.perform_create`, `apps/ai/chatbot.py`, and five channel adapters — `email_adapter.py`, `whatsapp_adapter.py`, `sms_adapter.py`, `live_chat_adapter.py`, `web_form_adapter.py`), plus Django admin and any future path. `Customer` rows are created from a comparable spread. Editing every call site (this project's established `notify(...)`-style explicit convention, used by `apps/tickets/assignment.py`/`apps/tickets/escalation.py`) would mean touching ~10 files for `ticket.created` alone and silently missing Django admin, a shell script, and every future creation path. **This is the first story in this project to use Django signals** (verified live: `grep -rln "post_save\|@receiver" apps/` returns nothing before this story) — a deliberate, discussed exception to the codebase's otherwise-universal explicit-call-site convention, made because "a ticket was created" must mean exactly that, regardless of which of the eight paths did it. `CONVENTIONS.md` § 32 states this exception explicitly so it is not read as license to reach for signals generally.
- **A signal-only design has one real, accepted cost: an extra query on every `Ticket` update.** `post_save` alone answers "was this created" for free, but answering "did `status`/`assigned_agent`/`escalated` just change" requires knowing the *previous* value, which a bare `post_save` receiver does not have. The standard signals-only way to get it (verified against this project's own non-dependency stance — `django-model-utils`' `FieldTracker` is not installed and adding it would be a new dependency for one story) is a `pre_save` receiver that re-fetches the row (`Ticket.objects.get(pk=instance.pk)`) before the incoming save lands, and stashes the diff on the instance for `post_save` to read. **This costs one additional `SELECT` on every `Ticket` UPDATE, project-wide, forever** — not just on the three tracked fields' own call sites. Accepted here because ticket updates are not a hot path at this project's scale and the alternative (a new dependency, or reverting to per-call-site dispatch) both cost more. Stated plainly in `## Edge Cases`, not hidden.
- **Verified live: every outbound HTTP call in this project already uses stdlib `urllib.request`** — `apps/integrations/erp_client.py` (Story 81) and `apps/communications/{whatsapp,sms}_adapter.py` (pre-Story-82). No `requests`/`httpx` dependency exists or is added here.
- **Verified live: this project's inbound-webhook signing convention already exists and this story mirrors it for the outbound direction.** `apps/communications/whatsapp_adapter.py::verify_signature` computes `hmac.new(secret, body, hashlib.sha256).hexdigest()` and Meta's own convention prefixes it `sha256=` in the `X-Hub-Signature-256` header this project verifies *inbound*. This story's `sign_payload` produces the identical `sha256=<hex>` format for the *outbound* `X-SupportOS-Signature` header — full symmetry, no new signing scheme invented.
- **No `AuditLog` row for subscription create/edit/delete**, for the same reason `CONVENTIONS.md` § 29/§ 30 already give: `accounts.AuditLog` addresses its target via `target_user`/`target_role`, a `WebhookSubscription` is neither, and `WebhookDelivery` is this story's own durable record — the same "the app's own table is the record" call INT-1/INT-2 already made twice.

---

## Story Goal

Let an external system register a URL and get a signed, retried HTTP `POST` the moment a chosen domain event happens in SupportOS:

1. **`WebhookSubscription`** (`apps/integrations/models.py`) — a real list, not a singleton (unlike every prior `INT-*` config): `name`, `target_url`, `secret` (write-only, HMAC-signing key), `events` (a `JSONField` list validated against an explicit allowlist — the same "vocabulary is code, mapping is data" split `Role.permissions`/`ErpConnection`'s field maps already establish), `enabled`, `created_by`.
2. **Six domain events**, dispatched via Django signals on `Ticket`/`Customer`/`Message`: `ticket.created`, `ticket.status_changed`, `ticket.assigned`, `ticket.escalated`, `customer.created`, `message.created`. `apps/integrations/signals.py` is the **only** place any of this project's other apps' models are watched — no other app knows webhooks exist.
3. **Async dispatch with retries** — `apps/integrations/tasks.py::deliver_webhook`, a `@shared_task(bind=True, max_retries=3)` with exponential backoff (60s/120s/240s), because a webhook is a one-shot notification tied to a moment, unlike `ErpConnection`'s self-healing recurring sync (Story 81) — a permanently-failed one-shot delivery is gone unless retried.
4. **`WebhookDelivery`** — one row per delivery *attempt* (not per logical delivery), so a flaky endpoint's retry history is fully visible, matching how GitHub/Stripe's own delivery logs work. This story's `## Story Goal`-level observability record, the same role `ErpSyncRun` (Story 81) plays for sync runs.
5. **A real config UI** — `/settings/webhooks` (list), `/settings/webhooks/new`, `/settings/webhooks/:id/edit` (form, with a scoped delivery-history table in edit mode), gated on a new `Permissions.WEBHOOKS_MANAGE`, following `RoleListPage.tsx`/`RoleFormPage.tsx`'s established list-plus-separate-form-pages shape — **not** the single-page-with-cards shape Stories 81/82 used for their singleton configs, because a subscription list is a genuinely different resource shape.

### The webhook contract

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-SupportOS-Event` | e.g. `ticket.created` |
| `X-SupportOS-Delivery-Attempt` | `1`, `2`, `3`, `4` |
| `X-SupportOS-Signature` | `sha256=<hex hmac of the raw body, keyed by the subscription's secret>` |

Body: `{"event": "ticket.status_changed", "occurred_at": "<ISO 8601>", "data": {...}, "changes": {"status": {"from": "open", "to": "resolved"}}}` — `changes` present only for `ticket.status_changed`. `data` **reuses the existing staff-facing serializer** for the affected object (`TicketSerializer`/`CustomerSerializer`/`MessageSerializer`) rather than inventing a second, parallel "external" shape — the same "the whole `/api/` tree is the one API, no second serializer for outside callers" posture `CONVENTIONS.md` § 29 already established for INT-1.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `WebhookSubscription`/`WebhookDelivery` | "Webhook subscriptions" + "dispatch" (backlog, `INT-4`). |
| `apps/integrations/signals.py` | The only way "fires... on domain events" (backlog) can mean *every* creation/change path, not just the ones this story remembers to edit. |
| `deliver_webhook` with retry/backoff | "Outcome: external systems notified" — a one-shot delivery that never retries under-delivers on that outcome. |
| `WebhookSubscriptionListPage.tsx`/`FormPage.tsx` | "+ UI" (backlog, `INT-4`). |
| `Permissions.WEBHOOKS_MANAGE` + grant migration | § 22's two-halves rule, the same shape every prior `INT-*` permission already took. |
| `CONVENTIONS.md` § 32 | Names the signals exception explicitly — the one precedent a later story might otherwise misread as "signals are now how this project does things everywhere." |

**Not here, and why:**

- **No "send a test event" action.** Matches Story 82's own declined "send a test message" action (`CONVENTIONS.md`-adjacent reasoning): the backlog task is "subscriptions + dispatch + UI", and a live test-fire is a real, separable feature this task text does not name.
- **No delivery-time editing or manual redelivery of a past `WebhookDelivery`.** The row is a record, not a queue; retrying is `deliver_webhook`'s own job while a delivery is in flight, not an operator action on history.
- **No signature-verification helper shipped for the *receiving* end.** This story is the sender; nothing in this codebase runs as the receiver of its own webhooks. The signing scheme is documented (`README.md`) so an external integrator can verify it themselves, mirroring how this project's own inbound-webhook verification (WhatsApp/SMS/Email, Stories 14/15/17) was each documented for *their* senders, not built as a two-sided pair.
- **No per-event payload customization or field selection.** `data` is always the full existing serializer output for the affected object — configurable payload shaping is real added complexity the backlog's plain "subscriptions + dispatch" does not ask for.
- **No encryption at rest for `WebhookSubscription.secret`.** Plain `CharField`, `write_only` in its serializer, never returned by the API — the fourth stored credential taking the exact posture `CONVENTIONS.md` § 29-31 already established three times over for `ApiKey.hashed_key` (a digest, the one exception), `ErpConnection.auth_token`, and the three `apps.communications` provider credentials.
- **No polling, no scheduled `PeriodicTask`.** Unlike Story 81's ERP import, dispatch is entirely event-driven (signal → task), so there is nothing to seed a schedule for.

---

## Context — Read These Files First

1. `.squad/stories/integrations/SUPPORTOS-92/intake.md` — one description line, no acceptance criteria, empty `attachments/`. `SupportOs backlog.MD` lines 878-882 (`STORY (INT-4)`) is the same text.
2. `backend/apps/notifications/services.py` (all 47 lines) — **the direct precedent for `apps/integrations/webhook_dispatch.py`'s shape**: `notify(...)` is "the one entry point... every event source calls", with two independently-`try/except`-guarded best-effort side effects (channel-layer push, `send_notification_email.delay(...)`) around an unconditional, non-defensive primary write. This story's `dispatch_event(...)` mirrors that shape exactly, one level up.
3. `backend/apps/tickets/assignment.py` (all 55 lines) and `backend/apps/tickets/escalation.py` (all 32 lines) — the exact "who calls `notify`, with what `Notification.Kind`, and why" precedent this story's *signal-based* dispatch replaces for the *webhook* channel specifically (notifications and webhooks are independent — this story does not touch either file). `apply_assignment` (lines 43-55, `assignment.py`) already has `old_agent`/`agent` in hand before its own `ticket.save()`; `apply_escalation` (lines 15-32, `escalation.py`) already has `old` vs new `escalated` similarly — useful context for *why* the signal-based `pre_save` re-fetch is a real, avoidable-if-not-for-signals cost (`## Prerequisites`), not a hidden one.
4. `backend/apps/tickets/models.py` lines 26-104 (`Ticket` in full: `Status`/`Priority` choices, `customer`/`category`/`assigned_agent` FKs, `status`/`priority`/`escalated`/`escalated_at` fields) — the three fields task 3's `pre_save` receiver tracks (`status`, `assigned_agent_id`, `escalated`).
5. `backend/apps/tickets/views.py` lines 90-100 (`TicketViewSet.perform_create`) and 192-232 (`set_status`, the `status` transition action) — confirms `status`/`assigned_agent` changes always go through a plain `ticket.save(update_fields=[...])` call (never bulk `.update()`, which would bypass signals entirely — verified via `grep -rn "Ticket.objects.*\.update(" apps/`, no results).
6. `backend/apps/customers/models.py` lines 7-66 (`Customer`) and `backend/apps/communications/models.py` lines 8-55 (`Message`) — the two other signal targets. `Message` rows are **never updated after creation** (verified live: `grep -rn "Message.objects.*\.(save|update)\("` across `apps/` finds only `.filter(...)` reads, no writes past `Message.objects.create`), so `message.created` needs no `pre_save` dirty-tracking — a plain `post_save` `created=True` check, the same shape task 3 uses for `customer.created`.
7. `backend/apps/integrations/erp_client.py` (all ~120 lines, Story 81) — the exact `urllib.request.Request` → `urlopen(timeout=...)` → `except HTTPError` (caught **before** `URLError`, since it is a subclass) → `except URLError` shape task 4's `webhook_client.py` copies, adapted to sign the request instead of authenticate as a caller.
8. `backend/apps/communications/whatsapp_adapter.py` lines 15-27 (`verify_signature`) — the `hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()` + `sha256=` prefix shape task 4's `sign_payload` mirrors for the opposite direction (this project signs outbound instead of verifying inbound, same primitive).
9. `backend/apps/accounts/models.py` lines 41-86 (`Role` — the `permissions` `JSONField` + `Role.clean()`'s allowlist-validation-against-`ALL_PERMISSIONS` shape) and `backend/apps/integrations/models.py`'s `ErpConnection.clean()`/`_validate_field_map` (Story 81) — the two-enforcement-point (`clean()` **and** serializer) pattern task 2's `_validate_events`/`WEBHOOK_EVENTS` copies for `WebhookSubscription.events`.
10. `backend/apps/integrations/models.py` (current, post-Story-82, ~304 lines) — `ApiKey` (Story 80, the credential-model precedent: `created_by` `SET_NULL`, no `enabled` flag needed) and `ErpSyncRun` (Story 81, the per-run observability-record precedent, `State` `TextChoices` named `state` not `status` to avoid the drf-spectacular enum collision Story 80's own verification found live) are what tasks 1-2's two new models each draw one half of their shape from.
11. `backend/apps/integrations/serializers.py`/`views.py`/`urls.py`/`admin.py`/`apps.py` (current, post-Story-82) — read each in full before appending; task 5-9 extend every one of them. `apps.py::ready()`'s existing `from . import authentication` (Story 80) is the exact precedent task 8's `from . import signals` addition follows — "a decorator/receiver only registers if its module is actually imported".
12. `backend/apps/core/permissions.py` lines 18-41 (`Permissions`, ending `COMMUNICATIONS_MANAGE`/`REPORTS_VIEW`) and `backend/apps/accounts/migrations/0010_grant_communications_permission.py` (Story 82's, the grant-migration template task 10's `0011` follows verbatim).
13. `backend/apps/core/views.py` lines 89-111 (`PermissionCatalogView`) — "gated on the same permission that gates writing the vocabulary it describes" is the exact precedent task 9's `WebhookEventCatalogView` follows for `WEBHOOK_EVENTS`.
14. `frontend/src/features/accounts/components/RoleListPage.tsx` (all ~105 lines) and `RoleFormPage.tsx` (all ~215 lines) — **the literal template** for tasks 15-16: `DataTable` + `useServerTable` + `useConfirm`-gated `DeleteRowButton` for the list; a single `mode: 'create' | 'edit'` form component with a `FormField` render-prop checklist (`permissions`, here `events`) grouped by `<area>.<action>`'s leading segment via `groupByArea` (directly reusable — `ticket.*`/`customer.*`/`message.*` group exactly the same way `<area>.<action>` permission strings do).
15. `frontend/src/features/accounts/api/{roleKeys,getRoles,getRole,useRoles,useRole,useRoleMutations,createRole,updateRole,deleteRole,getPermissionCatalog,usePermissionCatalog}.ts` (11 files, all short) — the exact API-layer shape tasks 12-14 mirror for a **real CRUD resource** (list + detail + create + update-via-PATCH-never-PUT + delete), materially different from Stories 81-82's singleton `GET`/`PATCH`-only shape.
16. `frontend/src/app/router.tsx` lines 328-354 (the `roles`/`roles/new`/`roles/:id/edit` block, including the "must stay before `roles/:id`" ordering comment) — task 17's literal template, adapted to `settings/webhooks`.
17. `frontend/src/app/Sidebar.tsx` — current icon imports, `useTranslation([...])` namespace array, `showAdministration` gate, and the `/settings/channels` `SidebarLink` (Story 82's, most recent) — task 18 extends all four the same way Story 82 extended them from Story 81's state.
18. `CONVENTIONS.md` § 29 (INT-1, lines ~1983-2027), § 30 (INT-2), § 31 (INT-3, current end of file) — task 20 appends § 32 after the current last line, renumbering nothing.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **A subscription fires only for the events it explicitly lists.** | Intake ("event subscriptions") | `WebhookSubscription.events`, matched via `events__contains=[event]` in `webhook_dispatch.dispatch_event`. |
| **Dispatch is asynchronous, never inline in the request that caused the event.** | Intake ("firing async") | `deliver_webhook.delay(...)`, called from a signal receiver, never awaited. |
| **A failed delivery is retried with backoff before being recorded as permanently failed.** | Intake outcome ("external systems notified") | `deliver_webhook`'s `self.retry(...)`, `max_retries=3`. |
| **Every payload is signed; every payload names its own event and delivery attempt.** | Standard webhook practice this project already half-establishes for inbound (§ 29-31) | `X-SupportOS-Signature`/`X-SupportOS-Event`/`X-SupportOS-Delivery-Attempt` headers. |
| **The signing secret is never returned by the API.** | Same "secure config" posture § 29-31 already establish for every other stored credential | `WebhookSubscriptionSerializer.secret` `write_only`; `has_secret` boolean instead. |
| **Only an operator who may manage webhooks can create, edit, delete, or view subscriptions and their delivery history.** | § 22 | `Permissions.WEBHOOKS_MANAGE` on every new endpoint; granted to `admin` by `accounts/0011`. |
| **A disabled subscription receives nothing.** | Implicit in "subscriptions" being toggleable | `dispatch_event`'s queryset filters `enabled=True`. |

---

## Backend Tasks

### 1 — The permission

**File: `backend/apps/core/permissions.py`** — add one constant to `Permissions`, after `COMMUNICATIONS_MANAGE` (added by Story 82) and before `REPORTS_VIEW`:

```python
    WEBHOOKS_MANAGE = "webhooks.manage"
```

`ALL_PERMISSIONS` derives itself from `vars(Permissions)`, so nothing else in this file changes.

**Create file: `backend/apps/accounts/migrations/0011_grant_webhooks_permission.py`** — structurally identical to `0010_grant_communications_permission.py`:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: a subscription's secret can sign requests an external system
# will trust, and a subscription can receive customer/ticket data on every
# matching event — at least as sensitive as editing a role, the same
# reasoning 0006/0008/0009/0010 record for their own grants. INT-4 (Story 83).
GRANTS = {
    "admin": [Permissions.WEBHOOKS_MANAGE],
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
        ("accounts", "0010_grant_communications_permission"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

Task 1's constant must land **before** this runs — `Role.clean()` rejects any string absent from `ALL_PERMISSIONS`.

---

### 2 — The two models

**File: `backend/apps/integrations/models.py`** — append below `ErpSyncRun` (current end of file). Extend the import block with nothing new (`ValidationError`/`gettext_lazy`/`TimeStampedModel` are already imported for `ErpConnection`).

```python
# The vocabulary a WebhookSubscription.events entry may contain — code, not
# data, the same "code is the vocabulary, the row is the mapping" split
# CONVENTIONS.md § 22 established for permissions. Grouped by the affected
# model, `<resource>.<change>` — the same shape Permissions' own
# `<area>.<action>` strings already use, which is what lets the frontend's
# `groupByArea` helper (RoleFormPage.tsx) work unmodified for this checklist
# too. Extending this set is how a later story adds a new event: one line
# here, one signal receiver in `signals.py` — never a hardcoded string at a
# dispatch call site.
WEBHOOK_EVENTS: frozenset[str] = frozenset(
    {
        "ticket.created",
        "ticket.status_changed",
        "ticket.assigned",
        "ticket.escalated",
        "customer.created",
        "message.created",
    }
)


def _validate_events(value) -> None:
    """Mirrors `Role.clean()`'s own allowlist check (apps/accounts/models.py)
    for `WebhookSubscription.events` — called from both `clean()` (admin/
    `full_clean()`) and the serializer (the API path; DRF does not call
    model `clean()`, CONVENTIONS.md § 22).
    """
    if not isinstance(value, list):
        raise ValidationError({"events": _("Must be a list of event names.")})
    unknown = sorted(set(value) - WEBHOOK_EVENTS)
    if unknown:
        raise ValidationError(
            {"events": _("Unknown events: %(names)s") % {"names": ", ".join(unknown)}}
        )


class WebhookSubscription(TimeStampedModel):
    """An external system's registration for one or more domain events —
    INT-4. Unlike every prior `INT-*` config (`ApiKey` aside), this is a
    real list, not a `pk=1` singleton — many URLs can each subscribe to
    their own, possibly overlapping, event sets.

    `secret` is stored in plain text and never returned by the API
    (`WebhookSubscriptionSerializer` declares it `write_only`) — the same
    posture `ErpConnection.auth_token`/the three `apps.communications`
    provider credentials already take (CONVENTIONS.md § 29-31). It signs
    every delivery to this subscription's `target_url` — see
    `apps/integrations/webhook_client.py::sign_payload`.

    No `enabled`-vs-`is_configured()` split the way `ErpConnection`/the
    provider configs need: a subscription is either created complete
    (`target_url` + `secret` + at least one event) or not created at all,
    unlike a singleton config a form fills in gradually over time.
    `enabled` alone is the on/off switch — pausing deliveries without
    losing the subscription's own configuration or delivery history.
    """

    name = models.CharField(_("name"), max_length=100)
    target_url = models.URLField(_("target URL"), max_length=500)
    secret = models.CharField(_("secret"), max_length=255, blank=True)
    events = models.JSONField(_("events"), default=list)
    enabled = models.BooleanField(_("enabled"), default=True)
    # SET_NULL: the operator who registered a subscription may leave while
    # the subscription itself keeps receiving deliveries — the same
    # asymmetry `ApiKey.created_by` (Story 80) already draws.
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhook_subscriptions_created",
        verbose_name=_("created by"),
    )

    class Meta:
        verbose_name = _("webhook subscription")
        verbose_name_plural = _("webhook subscriptions")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        super().clean()
        _validate_events(self.events)


class WebhookDelivery(TimeStampedModel):
    """One delivery **attempt** for one subscription/event pair — INT-4's
    observability record, the same role `ErpSyncRun` (Story 81) plays for
    a sync run. Deliberately one row PER ATTEMPT, not one row per logical
    delivery updated across retries: a flaky endpoint's third attempt
    succeeding is only genuinely visible if the first two failed attempts
    are their own rows too, the same shape GitHub's/Stripe's own delivery
    logs use.

    `state` is named `state`, not `status`, for the identical reason
    `ErpSyncRun.state` is (Story 81 `## Prerequisites`) — this project's
    own live-verified drf-spectacular enum-naming collision on fields
    named `status` (Story 80's own verification), not deepened here.

    CASCADE on `subscription`: a delivery record has no meaning independent
    of the subscription it was attempting to notify — the same reasoning
    `ErpOrder.customer`/`Message.ticket` already establish for their own
    parent relationships. Deleting a subscription deliberately takes its
    delivery history with it.
    """

    class State(models.TextChoices):
        SUCCESS = "success", _("Success")
        RETRYING = "retrying", _("Retrying")
        FAILED = "failed", _("Failed")

    subscription = models.ForeignKey(
        WebhookSubscription,
        on_delete=models.CASCADE,
        related_name="deliveries",
        verbose_name=_("subscription"),
    )
    event = models.CharField(_("event"), max_length=50)
    payload = models.JSONField(_("payload"), default=dict)
    state = models.CharField(_("state"), max_length=10, choices=State.choices)
    attempt = models.PositiveIntegerField(_("attempt"), default=1)
    response_status_code = models.PositiveIntegerField(
        _("response status code"), null=True, blank=True
    )
    # Truncated at write time (see tasks.py) — this is a debugging aid, not
    # a full response archive; an unbounded external response body must
    # never become an unbounded row.
    response_body = models.TextField(_("response body"), blank=True)
    error_message = models.TextField(_("error message"), blank=True)

    class Meta:
        verbose_name = _("webhook delivery")
        verbose_name_plural = _("webhook deliveries")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.event} -> {self.subscription_id} (attempt {self.attempt})"
```

Generate the migration:

```powershell
python manage.py makemigrations integrations
```

Expect `apps/integrations/migrations/0004_webhooksubscription_webhookdelivery.py` (Django names it from the model names; accept whatever it generates and do not hand-edit).

---

### 3 — Signals

**Create file: `backend/apps/integrations/signals.py`**

```python
"""Domain-event -> webhook dispatch bridge — INT-4 (Story 83).

The only place in this project that watches another app's models via
Django signals — see Story 83 `## Prerequisites` for why this one story
is the deliberate exception to the explicit-call-site convention every
other "something happened" hook in this codebase uses (`notify(...)`,
`apply_assignment`, `apply_escalation`). No other app needs to know
webhooks exist; this module imports their models, never the reverse.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.communications.models import Message
from apps.communications.serializers import MessageSerializer
from apps.customers.models import Customer
from apps.customers.serializers import CustomerSerializer
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer

from .webhook_dispatch import dispatch_event

# The three Ticket fields a webhook subscriber can care about changing.
# Extending this tuple is how a future ticket-lifecycle event is added —
# alongside a new entry in `models.WEBHOOK_EVENTS` and a branch below.
_TRACKED_TICKET_FIELDS = ("status", "assigned_agent_id", "escalated")


@receiver(pre_save, sender=Ticket)
def _capture_ticket_changes(sender, instance, **kwargs):
    """Stashes what changed onto `instance` for `_dispatch_ticket_events`
    (below) to read. Costs one extra `SELECT` per `Ticket` UPDATE — see
    Story 83 `## Prerequisites` for why this is an accepted, deliberate
    cost of a signals-only design with no new dependency.
    """
    if instance.pk is None:
        instance._webhook_changes = {}
        return
    try:
        old = Ticket.objects.get(pk=instance.pk)
    except Ticket.DoesNotExist:
        instance._webhook_changes = {}
        return
    changes = {}
    for field in _TRACKED_TICKET_FIELDS:
        old_value, new_value = getattr(old, field), getattr(instance, field)
        if old_value != new_value:
            changes[field] = (old_value, new_value)
    instance._webhook_changes = changes


@receiver(post_save, sender=Ticket)
def _dispatch_ticket_events(sender, instance, created, **kwargs):
    if created:
        dispatch_event("ticket.created", TicketSerializer(instance).data)
        return

    changes = getattr(instance, "_webhook_changes", {})
    if "status" in changes:
        old_status, new_status = changes["status"]
        dispatch_event(
            "ticket.status_changed",
            TicketSerializer(instance).data,
            changes={"status": {"from": old_status, "to": new_status}},
        )
    # Only a real assignment, not an unassignment (`agent=None`) — mirrors
    # `apply_assignment`'s own `if agent is not None: notify(...)` guard
    # (apps/tickets/assignment.py:65-71) for the identical reason: nobody
    # to notify an external system "about" when the ticket is unassigned.
    if "assigned_agent_id" in changes and instance.assigned_agent_id is not None:
        dispatch_event("ticket.assigned", TicketSerializer(instance).data)
    # Only escalating, never de-escalating — mirrors `apply_escalation`'s
    # own `if escalated and ...: notify(...)` guard
    # (apps/tickets/escalation.py:29-35).
    if "escalated" in changes and instance.escalated:
        dispatch_event("ticket.escalated", TicketSerializer(instance).data)


@receiver(post_save, sender=Customer)
def _dispatch_customer_created(sender, instance, created, **kwargs):
    if created:
        dispatch_event("customer.created", CustomerSerializer(instance).data)


@receiver(post_save, sender=Message)
def _dispatch_message_created(sender, instance, created, **kwargs):
    """Fires for both inbound and outbound messages — `data.direction`
    already distinguishes them, so this is one event
    (`message.created`), not two (`message.received`/`message.sent`) for
    what is fundamentally the same underlying fact: a `Message` row was
    created. `Message` rows are never updated after creation (verified
    live, Story 83 `## Context` item 6), so no `pre_save` tracking is
    needed here the way `Ticket` needs it.
    """
    if created:
        dispatch_event("message.created", MessageSerializer(instance).data)
```

---

### 4 — The HTTP client and signing

**Create file: `backend/apps/integrations/webhook_client.py`**

```python
"""Outbound HTTP to a webhook subscriber — INT-4 (Story 83).

`urllib.request` from the standard library, the same choice
`apps/integrations/erp_client.py` (Story 81) and both
`apps/communications/{whatsapp,sms}_adapter.py` (pre-Story-82) already
made — no `requests`/`httpx` dependency exists in this project or is
added here (CONVENTIONS.md § 0/§ 17).
"""

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

# Matches the 10s `whatsapp_adapter`/`sms_adapter` already use for a
# single outbound call — a webhook POST is the same shape of request,
# unlike ERP's heavier list-fetch (15s, erp_client.py).
WEBHOOK_TIMEOUT_SECONDS = 10
# A hard ceiling on a stored response body — a debugging aid, not an
# unbounded archive of whatever an external system chooses to return.
RESPONSE_BODY_MAX_CHARS = 2000

SIGNATURE_HEADER = "X-SupportOS-Signature"
EVENT_HEADER = "X-SupportOS-Event"
DELIVERY_ATTEMPT_HEADER = "X-SupportOS-Delivery-Attempt"


class WebhookError(Exception):
    """Any delivery failure — unreachable host, non-2xx, or a network
    timeout. The one exception type `tasks.deliver_webhook` catches, the
    same single-error-type contract `apps.integrations.erp_client.ErpError`
    (Story 81) already established.
    """


def sign_payload(secret: str, body: bytes) -> str:
    """The exact `sha256=<hex>` shape this project already verifies
    *inbound* for Meta's `X-Hub-Signature-256`
    (`apps.communications.whatsapp_adapter.verify_signature`) — reused
    here for the *outbound* direction, same primitive.
    """
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def send_webhook(subscription, event: str, payload: dict, attempt: int) -> tuple[int, str]:
    """POSTs `payload` to `subscription.target_url`, signed with
    `subscription.secret`. Returns `(status_code, response_body)` on any
    HTTP response — including a non-2xx one, which the caller decides
    whether to treat as a failure (see `tasks.deliver_webhook`). Only a
    connection-level failure (no response at all) raises `WebhookError`
    directly from here.
    """
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        EVENT_HEADER: event,
        DELIVERY_ATTEMPT_HEADER: str(attempt),
        SIGNATURE_HEADER: sign_payload(subscription.secret, body),
    }
    request = urllib.request.Request(
        subscription.target_url, data=body, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT_SECONDS) as response:
            return response.status, response.read().decode(errors="replace")[
                :RESPONSE_BODY_MAX_CHARS
            ]
    except urllib.error.HTTPError as exc:
        # A subclass of URLError, so it must be caught FIRST or the status
        # code is lost — the same ordering `erp_client.py` documents for
        # itself. A non-2xx response IS a response — surface it as a
        # WebhookError so the caller retries, but keep the code/reason.
        body_text = exc.read().decode(errors="replace")[:RESPONSE_BODY_MAX_CHARS]
        raise WebhookError(f"HTTP {exc.code} {exc.reason}: {body_text}") from exc
    except urllib.error.URLError as exc:
        raise WebhookError(str(exc.reason)) from exc
```

---

### 5 — The dispatch helper

**Create file: `backend/apps/integrations/webhook_dispatch.py`**

```python
"""The one entry point every domain-event source calls to notify webhook
subscribers — INT-4 (Story 83). Mirrors
`apps.notifications.services.notify`'s own "one entry point, called from
every event source" shape (Story 31) one layer up: `dispatch_event` is
webhooks' `notify`.

Today's only caller is `apps/integrations/signals.py`. A future
non-signal event source (if this project ever adds one) calls this
directly — never `WebhookSubscription`/`deliver_webhook` themselves.
"""

import logging

from django.utils import timezone

from .models import WebhookSubscription
from .tasks import deliver_webhook

logger = logging.getLogger(__name__)


def dispatch_event(event: str, data: dict, *, changes: dict | None = None) -> None:
    """Builds the payload once, then queues one `deliver_webhook` task
    per matching, enabled subscription. Each queue attempt is
    independently guarded — the same commit-first idiom
    `MessageViewSet.perform_create`/`TicketViewSet.perform_create` already
    use around their own `.delay(...)` calls: one subscription's queueing
    failure (a down Redis/worker) must never block another subscription's
    delivery, and the triggering save has already committed regardless.
    """
    payload = {"event": event, "occurred_at": timezone.now().isoformat(), "data": data}
    if changes:
        payload["changes"] = changes

    # `events__contains` on a JSONField is Postgres-only in Django —
    # already the verified, established pattern this project's own
    # `apps.tickets.assignment.assignable_agents` uses for
    # `role__permissions__contains` (Story 22 `## Prerequisites`).
    subscriptions = WebhookSubscription.objects.filter(enabled=True, events__contains=[event])
    for subscription in subscriptions:
        try:
            deliver_webhook.delay(subscription.id, event, payload)
        except Exception:
            logger.exception(
                "Failed to queue webhook delivery for subscription %s, event %s",
                subscription.id,
                event,
            )
```

---

### 6 — The Celery task

**File: `backend/apps/integrations/tasks.py`** — append below `run_erp_sync`. Extend the imports:

```python
from .models import ErpConnection, ErpSyncRun, WebhookDelivery, WebhookSubscription
from .webhook_client import WebhookError, send_webhook
```

```python
# Exponential backoff between retries — 60s, 120s, 240s for the three
# retries `max_retries=3` allows, roughly 7 minutes end to end across all
# four attempts. A module constant, not an ENV var — the same
# internal-tuning-knob reasoning `apps.integrations.authentication
# .LAST_USED_WRITE_INTERVAL` (Story 80) and `apps.accounts.tokens
# .RESET_TOKEN_MAX_AGE_SECONDS` (SEC-7) both make.
WEBHOOK_RETRY_BASE_SECONDS = 60


@shared_task(bind=True, max_retries=3)
def deliver_webhook(self, subscription_id: int, event: str, payload: dict) -> None:
    """Delivers one webhook event to one subscription, retrying on
    failure with exponential backoff. Every attempt — success, a retry,
    or the final failure — writes its own `WebhookDelivery` row; see that
    model's own docstring for why one row per attempt, not one row
    updated across retries.

    A subscription deleted or disabled since this was queued is a
    **silent no-op**, the same `DoesNotExist`-guard contract
    `apps.sla.tasks.auto_assign_ticket` already establishes for itself
    (Story 29) — the event this task exists to deliver may simply no
    longer be wanted.
    """
    subscription = WebhookSubscription.objects.filter(pk=subscription_id, enabled=True).first()
    if subscription is None:
        return

    attempt = self.request.retries + 1
    try:
        status_code, response_body = send_webhook(subscription, event, payload, attempt)
    except WebhookError as exc:
        # `attempt > self.max_retries` is only true on the final, no-more-
        # retries-left attempt — `self.retry(...)` below raises
        # `MaxRetriesExceededError` instead of scheduling another one at
        # that point, ending the task in Celery's own FAILURE state. The
        # row is written first either way, so the UI's history always
        # reflects what actually happened.
        WebhookDelivery.objects.create(
            subscription=subscription,
            event=event,
            payload=payload,
            state=(
                WebhookDelivery.State.FAILED
                if attempt > self.max_retries
                else WebhookDelivery.State.RETRYING
            ),
            attempt=attempt,
            error_message=str(exc),
        )
        raise self.retry(exc=exc, countdown=WEBHOOK_RETRY_BASE_SECONDS * (2**self.request.retries))
    else:
        WebhookDelivery.objects.create(
            subscription=subscription,
            event=event,
            payload=payload,
            state=WebhookDelivery.State.SUCCESS,
            attempt=attempt,
            response_status_code=status_code,
            response_body=response_body,
        )
```

---

### 7 — Register the signals

**File: `backend/apps/integrations/apps.py`** — extend `ready()`:

```python
    def ready(self):
        # Imports `ApiKeyScheme` (Story 80) at startup.
        from . import authentication  # noqa: F401

        # Imports `signals.py` at startup — a `@receiver` only registers
        # if its module is actually imported, the same "decorator needs
        # its module imported" reasoning `apps.communications.apps.py
        # ::ready()` already documents for `@register_adapter` (Story 13).
        # INT-4 (Story 83).
        from . import signals  # noqa: F401
```

---

### 8 — Serializers

**File: `backend/apps/integrations/serializers.py`** — append. Extend the imports:

```python
from .models import WebhookDelivery, WebhookSubscription
```

(`WEBHOOK_EVENTS` is imported where `validate_events` needs it, alongside `_validate_field_map`'s own existing pattern.)

```python
class WebhookSubscriptionSerializer(BaseModelSerializer):
    """Read/write over a `WebhookSubscription` row. `secret` is
    `write_only`, the same posture every other stored credential in this
    project takes; `has_secret` is what the UI renders instead.

    A blank/omitted `secret` on `PATCH` leaves the stored value untouched
    (`update` below) — the same contract `ErpConnectionSerializer`/the
    three `apps.communications` provider serializers already establish.
    Unlike those, `secret` **is** required on `create` — a subscription is
    created complete or not at all (see `WebhookSubscription`'s own
    docstring), so `validate` below enforces that only when `self.instance`
    is `None`.
    """

    secret = serializers.CharField(
        max_length=255, required=False, allow_blank=True, write_only=True
    )
    has_secret = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = WebhookSubscription
        fields = (
            "id",
            "name",
            "target_url",
            "secret",
            "has_secret",
            "events",
            "enabled",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*BaseModelSerializer.Meta.read_only_fields, "created_by")

    def get_has_secret(self, obj) -> bool:
        return bool(obj.secret)

    def validate_events(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(_("Must be a list of event names."))
        unknown = sorted(set(value) - WEBHOOK_EVENTS)
        if unknown:
            raise serializers.ValidationError(
                _("Unknown events: %(names)s") % {"names": ", ".join(unknown)}
            )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and not attrs.get("secret"):
            raise serializers.ValidationError(
                {"secret": [_("A secret is required when creating a subscription.")]}
            )
        return attrs

    def update(self, instance, validated_data):
        if not validated_data.get("secret"):
            validated_data.pop("secret", None)
        return super().update(instance, validated_data)


class WebhookDeliverySerializer(BaseModelSerializer):
    """Read-only history. `payload` is included — unlike `ErpOrder.raw`
    (Story 81, admin-only), a delivery's own outbound payload is exactly
    what an operator debugging a subscriber's rejection needs to see
    without leaving the UI.
    """

    state_display = serializers.CharField(source="get_state_display", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = WebhookDelivery
        fields = (
            "id",
            "subscription",
            "event",
            "payload",
            "state",
            "state_display",
            "attempt",
            "response_status_code",
            "response_body",
            "error_message",
            "created_at",
            "updated_at",
        )
```

Add `from .models import ErpConnection, ErpOrder, ErpSyncRun, WebhookDelivery, WebhookSubscription` (extending the existing models import) and `from .erp_sync import ..., WEBHOOK_EVENTS`-style import corrected to `from .models import WEBHOOK_EVENTS` (it lives in `models.py`, task 2).

---

### 9 — Views

**File: `backend/apps/integrations/views.py`** — append. Extend the imports:

```python
from .models import WEBHOOK_EVENTS, WebhookDelivery, WebhookSubscription
from .serializers import WebhookDeliverySerializer, WebhookSubscriptionSerializer
```

```python
class WebhookEventCatalogView(APIView):
    """The full webhook-event vocabulary — the same "gated on the same
    permission that gates writing what it describes" shape
    `apps.core.views.PermissionCatalogView` already establishes for
    `Permissions`/`Role.permissions`. What `WebhookSubscriptionFormPage`'s
    event checklist renders its options from.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.WEBHOOKS_MANAGE}

    def get(self, request):
        return Response(sorted(WEBHOOK_EVENTS))


class WebhookSubscriptionViewSet(BaseModelViewSet):
    """Full CRUD over `WebhookSubscription` — INT-4. Unlike `ApiKeyViewSet`
    (Story 80), no `http_method_names` restriction: every field here is
    legitimately editable via a full replace, so `PUT` stays available at
    the API level even though the frontend only ever calls `PATCH`
    (`updateWebhookSubscription.ts`, the same "PATCH, not PUT" convention
    `updateRole.ts` already documents for itself). A real `destroy` — no
    soft-delete the way `ApiKeyViewSet.perform_destroy` (Story 80) has:
    deleting a subscription an operator no longer wants is exactly what
    they asked for, and `WebhookDelivery.subscription`'s `CASCADE` takes
    its history with it deliberately (see that model's own docstring).
    """

    queryset = WebhookSubscription.objects.select_related("created_by").all()
    serializer_class = WebhookSubscriptionSerializer

    permission_map = {
        "list": Permissions.WEBHOOKS_MANAGE,
        "retrieve": Permissions.WEBHOOKS_MANAGE,
        "create": Permissions.WEBHOOKS_MANAGE,
        "update": Permissions.WEBHOOKS_MANAGE,
        "partial_update": Permissions.WEBHOOKS_MANAGE,
        "destroy": Permissions.WEBHOOKS_MANAGE,
    }

    ordering_fields = ("name", "enabled", "created_at")
    search_fields = ("name", "target_url")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WebhookDeliveryViewSet(BaseModelViewSet):
    """Read-only delivery history — the same `AuditLogViewSet`(SEC-3)/
    `ErpSyncRunViewSet` (Story 81) precedent: `http_method_names` drops
    every unsafe verb, since an omitted `permission_map` entry is merely
    authenticated-only under `HasPermission`'s grant-on-omission rule
    (§ 22), the wrong default for a record table.
    """

    http_method_names = ["get", "head", "options"]
    queryset = WebhookDelivery.objects.select_related("subscription").all()
    serializer_class = WebhookDeliverySerializer

    permission_map = {
        "list": Permissions.WEBHOOKS_MANAGE,
        "retrieve": Permissions.WEBHOOKS_MANAGE,
    }

    ordering_fields = ("created_at", "state", "event")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        subscription_id = self.request.query_params.get("subscription")
        if subscription_id:
            try:
                subscription_id = int(subscription_id)
            except ValueError:
                raise ValidationError(
                    {"subscription": [_("Must be a valid subscription id.")]}
                ) from None
            queryset = queryset.filter(subscription_id=subscription_id)
        return queryset
```

---

### 10 — Routing

**File: `backend/apps/integrations/urls.py`** — register two routes and add one path. Extend the `from .views import (...)` block:

```python
from .views import (
    ApiKeyViewSet,
    ErpConnectionView,
    ErpOrderViewSet,
    ErpSyncRunViewSet,
    ErpSyncTriggerView,
    SchemaView,
    WebhookDeliveryViewSet,
    WebhookEventCatalogView,
    WebhookSubscriptionViewSet,
)
```

```python
router.register("webhooks/subscriptions", WebhookSubscriptionViewSet, basename="webhook-subscription")
router.register("webhooks/deliveries", WebhookDeliveryViewSet, basename="webhook-delivery")
```

and, in `urlpatterns`, alongside the `erp/connection/`/`erp/sync/` paths:

```python
    path("webhooks/events/", WebhookEventCatalogView.as_view(), name="webhook-events"),
```

No collision with `apps.communications.urls`' own `webhooks/{email,whatsapp,sms}/inbound/` paths — different path segments (`subscriptions`/`deliveries`/`events` vs `email`/`whatsapp`/`sms`), on two different apps' routers, both included at the API root with no prefix. Endpoints: `GET|POST /api/webhooks/subscriptions/`, `GET|PATCH|DELETE /api/webhooks/subscriptions/<id>/`, `GET /api/webhooks/deliveries/[?subscription=<id>]`, `GET /api/webhooks/events/`.

---

### 11 — Django admin

**File: `backend/apps/integrations/admin.py`** — append. Extend the imports:

```python
from .models import WebhookDelivery, WebhookSubscription
```

```python
@admin.register(WebhookSubscription)
class WebhookSubscriptionAdmin(admin.ModelAdmin):
    """A lower-level fallback beside `/settings/webhooks` — the same
    both-paths-exist call `ErpConnectionAdmin` (Story 81) documents.
    Unlike the singleton config admins, adding IS allowed here — this is
    a real list, and Django's own default add form is a legitimate
    second path to create one, the same way `RoleAdmin` allows adding a
    `Role` from `/admin/` alongside the API.
    """

    list_display = ("name", "target_url", "enabled", "created_by", "created_at")
    list_filter = ("enabled",)
    list_select_related = ("created_by",)
    search_fields = ("name", "target_url")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    """Immutable record, same posture as `AuditLogAdmin`/`ErpSyncRunAdmin`
    (Story 81)."""

    list_display = ("event", "subscription", "state", "attempt", "response_status_code", "created_at")
    list_filter = ("state", "event")
    list_select_related = ("subscription",)
    search_fields = ("event", "subscription__name")
    readonly_fields = tuple(
        field.name for field in WebhookDelivery._meta.fields if field.name != "id"
    )

    def has_add_permission(self, request) -> bool:
        return False
```

---

## Frontend Tasks

### 12 — Types

**Create file: `frontend/src/features/webhooks/types/webhook.ts`**

```ts
/** Mirrors `apps.integrations.serializers.WebhookSubscriptionSerializer`'s
 *  read shape. `secret` is absent by design — write-only. */
export type WebhookSubscription = {
  id: number
  name: string
  target_url: string
  has_secret: boolean
  events: string[]
  enabled: boolean
  created_by: number | null
  created_at: string
  updated_at: string
}

/** The write shape. `secret` is send-only; omitting it (or sending '') on
 *  an update leaves the stored one untouched — required only on create,
 *  enforced server-side. */
export type WebhookSubscriptionInput = {
  name: string
  target_url: string
  secret?: string
  events: string[]
  enabled: boolean
}

export const WEBHOOK_DELIVERY_STATES = ['success', 'retrying', 'failed'] as const
export type WebhookDeliveryState = (typeof WEBHOOK_DELIVERY_STATES)[number]

export type WebhookDelivery = {
  id: number
  subscription: number
  event: string
  payload: Record<string, unknown>
  state: WebhookDeliveryState
  state_display: string
  attempt: number
  response_status_code: number | null
  response_body: string
  error_message: string
  created_at: string
  updated_at: string
}
```

### 13 — API layer: subscriptions

Create, mirroring `frontend/src/features/accounts/api/{roleKeys,getRoles,getRole,useRoles,useRole,useRoleMutations,createRole,updateRole,deleteRole}.ts` exactly (9 files → 9 files, `role` → `webhookSubscription`, `/roles/` → `/webhooks/subscriptions/`):

- **`webhookSubscriptionKeys.ts`** — `export const webhookSubscriptionKeys = featureKey('webhookSubscriptions')`
- **`getWebhookSubscriptions.ts`** — `api.getPage<WebhookSubscription>('/webhooks/subscriptions/', { params })`, `WebhookSubscriptionListParams = ServerTableParams & { search?: string }`
- **`getWebhookSubscription.ts`** — `api.get<WebhookSubscription>(\`/webhooks/subscriptions/${id}/\`)`
- **`useWebhookSubscriptions.ts`** / **`useWebhookSubscription.ts`** — the matching `useQuery` hooks, `useWebhookSubscription` taking `{ enabled?: boolean }` the same way `useRole` does (so the edit form's detail query only runs in edit mode).
- **`createWebhookSubscription.ts`** — `api.post<WebhookSubscription>('/webhooks/subscriptions/', input)`
- **`updateWebhookSubscription.ts`** — `api.patch<WebhookSubscription>(...)`, **PATCH, not PUT**, matching `updateRole.ts`'s own comment.
- **`deleteWebhookSubscription.ts`** — `api.delete(\`/webhooks/subscriptions/${id}/\`)`
- **`useWebhookSubscriptionMutations.ts`** — `useCreateWebhookSubscription`/`useUpdateWebhookSubscription`/`useDeleteWebhookSubscription`, each invalidating `webhookSubscriptionKeys.all` via the same shared `useInvalidateWebhookSubscriptions()` closure `useRoleMutations.ts` uses for `useInvalidateRoles()`.

### 14 — API layer: event catalog and deliveries

- **`getWebhookEventCatalog.ts`** — `api.get<string[]>('/webhooks/events/')`, the same plain-array (not `Page<T>`) shape `getPermissionCatalog.ts` uses.
- **`useWebhookEventCatalog.ts`** — cached under `webhookSubscriptionKeys.resource('catalog')`, the same "the catalog exists only to serve the form's checklist" reasoning `usePermissionCatalog.ts` documents for caching under `roleKeys` instead of a new key prefix.
- **`getWebhookDeliveries.ts`** — `api.getPage<WebhookDelivery>('/webhooks/deliveries/', { params })`, `WebhookDeliveryListParams = ServerTableParams & { subscription?: number }`.
- **`useWebhookDeliveries.ts`** — `useQuery` keyed `webhookSubscriptionKeys.resource('deliveries', params)` (deliveries live under the same feature-key prefix as subscriptions — one feature, the same split `roleKeys`/`userKeys` draw for two resources inside `features/accounts`, CONVENTIONS.md § 23).

### 15 — The list page

**Create file: `frontend/src/features/webhooks/components/WebhookSubscriptionListPage.tsx`**

Copy `RoleListPage.tsx` structurally, substituting the resource: `useServerTable` + `useDebouncedSearch` + `useWebhookSubscriptions({...params, ...(search ? {search} : {})})` + `useDeleteWebhookSubscription()` + `useConfirm()`-gated delete. Columns: `name` (a `TableLink` to `/settings/webhooks/${row.id}/edit`, sortable), `target_url`, `events` (`t('webhooks.eventCount', { count: row.events.length })`, not sortable — same "no ordering over a JSON array's length" reasoning `RoleListPage.tsx`'s own `permissions` column comment gives), `enabled` (a `Badge`: `variant="secondary"` when true, `variant="outline"` when false), `actions` (a `DeleteRowButton`, no system-row exception the way `RoleListPage.tsx` has for `is_system` — every subscription here is deletable). `PageHeader` action is a `Link` button to `/settings/webhooks/new`, gated `<Can permission="webhooks.manage">`, mirroring `RoleListPage.tsx`'s own "New role" button exactly.

### 16 — The form page

**Create file: `frontend/src/features/webhooks/components/WebhookSubscriptionFormPage.tsx`**

Copy `RoleFormPage.tsx`'s structure: `useParams` → `isEdit` → either `<WebhookSubscriptionForm mode="create" />` or a `QueryBoundary` over `useWebhookSubscription(id, { enabled: isEdit })`.

Schema:

```ts
const schema = z.object({
  name: requiredString(100),
  target_url: requiredString(500),
  secret: optionalString(255).transform((value) => value ?? ''),
  events: z.array(z.string()),
  enabled: z.boolean(),
})
```

`target_url` gets the same non-empty-only `z.url()` `superRefine` `ErpSettingsPage.tsx`'s `base_url` field uses (Story 81) — except `target_url` is **required** here (a subscription with no target makes no sense), so the refine always runs, not only when non-empty.

`toDefaults`: `secret` always `''` (never prefilled — the API does not return it, same as every other credential field this project has). `toInput`: strips `secret` from the payload when still blank, matching `ErpSettingsPage.tsx`'s exact `const { secret, ...rest } = values; return { ...rest, ...(secret ? { secret } : {}) }` shape.

Reuse `RoleFormPage.tsx`'s `groupByArea`/`areaLabel` helpers **verbatim** (copy, do not import — they are local to `accounts`, and `apps/README.md`'s "used by one feature → keep it there" rule means duplicating a ~10-line pure function into `features/webhooks` is correct, not a violation, until a second-after-this consumer exists) for the `events` checklist, driven by `useWebhookEventCatalog()` instead of `usePermissionCatalog()`. Groups render as "Ticket"/"Customer"/"Message" from `ticket.*`/`customer.*`/`message.*` — no `roles.permissionDescriptions.*`-style per-event description key is needed; the event name alone (`ticket.status_changed`) is self-explanatory the way a permission string alone was not for `RoleFormPage.tsx`'s non-technical audience, so skip that lookup entirely and render the bare event name.

Below the form (edit mode only, `mode === 'edit' && id !== undefined`): a **`WebhookDeliveryHistory`** section — a `DataTable` over `useWebhookDeliveries({ ...params, subscription: id })`, columns `created_at` (`useFormatters().dateTime`, sortable), `event`, `state` (a `Badge`: `success` → `variant="success"`, `failed` → `variant="destructive"`, `retrying` → `variant="outline"`, the same three-state mapping `ErpSettingsPage.tsx`'s `STATE_BADGE_VARIANT` map uses for `ErpSyncRun.state`), `attempt`, `response_status_code`, `error_message`. `empty={<Empty title={t('webhooks.deliveries.empty')} />}`.

### 17 — Route

**File: `frontend/src/app/router.tsx`** — add a sibling block after the `settings/channels` block (Story 82's), mirroring the `roles`/`roles/new`/`roles/:id/edit` block's exact three-child shape:

```tsx
          {
            element: <RequirePermission permission="webhooks.manage" />,
            children: [
              {
                path: 'settings/webhooks',
                lazy: async () => {
                  const { WebhookSubscriptionListPage } =
                    await import('@/features/webhooks/components/WebhookSubscriptionListPage')
                  return { element: <WebhookSubscriptionListPage /> }
                },
              },
              {
                // Must stay before `settings/webhooks/:id/edit`, same
                // reason as `roles/new`.
                path: 'settings/webhooks/new',
                lazy: async () => {
                  const { WebhookSubscriptionFormPage } =
                    await import('@/features/webhooks/components/WebhookSubscriptionFormPage')
                  return { element: <WebhookSubscriptionFormPage /> }
                },
              },
              {
                path: 'settings/webhooks/:id/edit',
                lazy: async () => {
                  const { WebhookSubscriptionFormPage } =
                    await import('@/features/webhooks/components/WebhookSubscriptionFormPage')
                  return { element: <WebhookSubscriptionFormPage /> }
                },
              },
            ],
          },
```

### 18 — Sidebar

**File: `frontend/src/app/Sidebar.tsx`** — extend the icon import with `WebhookIcon`; extend `showAdministration` with `|| can('webhooks.manage')`; extend the `useTranslation([...])` namespace array with `'webhooks'` (after `'communications'`); add a fourth `SidebarLink` after the `/settings/channels` one:

```tsx
            <Can permission="webhooks.manage">
              <SidebarLink
                to="/settings/webhooks"
                icon={WebhookIcon}
                label={t('webhooks:list.navLabel')}
                collapsed={collapsed}
              />
            </Can>
```

### 19 — Locales and namespace registration

**Create `frontend/src/features/webhooks/locales/en.json`** and **`ar.json`**: a `list` object (`navLabel`, `title`, `new`, `eventCount`, `search`, `searchPlaceholder`, `empty`, `emptyDescription`, `noSearchResults`, `fields.{name,targetUrl,enabled,actions}`, `enabledBadge`, `disabledBadge`, `delete.{title,description}`, `actions.delete`) and a `form` object (`new`, `edit`, `created`, `updated`, `fields.{name,targetUrl,secret,events,enabled}`, `secretHint.{set,unset,keep}`, `eventGroups.{ticket,customer,message}`, `actions.save`) and a `deliveries` object (`title`, `empty`, `fields.{createdAt,event,state,attempt,responseStatusCode,errorMessage}`). Arabic is a real translation, matching this project's established quality bar in every other namespace.

**File: `frontend/src/shared/i18n/resources.ts`** — two imports (alphabetically, after `ticketsAr`/`ticketsEn`, before `webFormAr`/`webFormEn`) and one line per language block, `webhooks: webhooksEn`/`webhooks: webhooksAr`.

---

## Documentation Tasks

### 20 — `CONVENTIONS.md` § 32

**File: `CONVENTIONS.md`** — append a new section at the end of the file (after § 31, Story 82's). **Do not renumber § 0-§ 31.**

```markdown

---

## 32. Outbound webhooks & the signals exception (INT-4)

`INT-4` (Story 83) is the **first and, until a future story explicitly
says otherwise, only** place in this project that uses Django model
signals (`post_save`/`pre_save`/`@receiver`). Every other "something
happened, tell someone" hook in this codebase — `apps.notifications
.services.notify`, `apps.tickets.assignment.apply_assignment`,
`apps.tickets.escalation.apply_escalation` — is an explicit call at the
call site, and that stays the default. Signals were the deliberate
exception here, confirmed with the user during planning, because a
single domain event (a `Ticket` being created, say) has eight distinct
call sites across five channel adapters, the staff API, the portal API,
and the AI chatbot handoff, with more likely in the future — an explicit
call site at all eight, forever, is the wrong trade for "a ticket was
created" to keep meaning exactly that.

**Before adding a second signal receiver anywhere in this codebase, read
`apps/integrations/signals.py` first and ask whether the explicit-call-site
convention still fits better** — it usually does. Signals earn their cost
(implicit control flow, and — for change-detection specifically — an
extra query per update, see below) only when a project-wide, no-gaps
guarantee is the actual requirement, not merely a convenience.

**Detecting a field *change* via signals costs a query `post_save` alone
does not.** `post_save`'s own `created` flag answers "was this just
created" for free; answering "did `status` just change" needs the
*previous* value, which `apps/integrations/signals.py::_capture_ticket_changes`
gets via a `pre_save` re-fetch (`Ticket.objects.get(pk=instance.pk)`).
This runs on **every** `Ticket` UPDATE project-wide, not just ones a
webhook subscriber cares about — an accepted, deliberate cost of a
signals-only design with no new dependency (`django-model-utils`'
`FieldTracker` is not installed). A story adding a fourth tracked field
extends `_TRACKED_TICKET_FIELDS`, not a second re-fetch.

**The webhook event vocabulary is code; the subscription's chosen subset
is data** — the same split § 22 established for permissions.
`apps.integrations.models.WEBHOOK_EVENTS` is the vocabulary,
`WebhookSubscription.events` is the mapping, and adding a new event is a
two-line change: one entry in `WEBHOOK_EVENTS`, one new signal receiver
(or branch in an existing one) in `signals.py` — never a hardcoded event
string at a dispatch call site, because there is deliberately only one
dispatch call site (`webhook_dispatch.dispatch_event`).

**A one-shot event retries; a recurring sync does not.**
`apps.integrations.tasks.deliver_webhook` retries a failed delivery three
times with backoff before giving up — contrast `run_erp_sync` (Story 81),
which never retries, because an ERP sync failure self-heals on the next
hourly run. A webhook fires once for one real moment in time; if that
delivery is never retried and never succeeds, the moment it was
reporting is simply never communicated. A future one-shot async task
should default to retrying; a future recurring/scheduled one should
default to not.
```

### 21 — `README.md`

Append a `###` subsection after "Messaging provider config (INT-3)" (Story 82) and before `### Consuming the API from the frontend`:

````markdown
### Outbound webhooks (INT-4)

`/settings/webhooks` (permission `webhooks.manage`) manages subscriptions to domain events —
external systems get a signed `POST` the moment one of the events they subscribed to happens.

| Endpoint | What it does |
|---|---|
| `GET`/`POST` `/api/webhooks/subscriptions/` | List/create subscriptions. |
| `GET`/`PATCH`/`DELETE` `/api/webhooks/subscriptions/<id>/` | Manage one subscription. `secret` is write-only — send `""` (or omit it) on `PATCH` to keep the stored one. |
| `GET /api/webhooks/deliveries/?subscription=<id>` | Delivery history, one row per attempt. |
| `GET /api/webhooks/events/` | The full event vocabulary a subscription's `events` list may contain. |

**Events:** `ticket.created`, `ticket.status_changed`, `ticket.assigned`, `ticket.escalated`,
`customer.created`, `message.created` (both inbound and outbound — `data.direction` tells you
which).

**The request your endpoint receives:**

```
POST <target_url>
Content-Type: application/json
X-SupportOS-Event: ticket.status_changed
X-SupportOS-Delivery-Attempt: 1
X-SupportOS-Signature: sha256=<hex hmac-sha256 of the raw body, keyed by your subscription's secret>

{"event": "ticket.status_changed", "occurred_at": "2026-...", "data": {...}, "changes": {"status": {"from": "open", "to": "resolved"}}}
```

`data` is exactly the same object shape `GET`-ing that resource from the API itself would return —
no separate "external" payload shape. Verify the signature the same way this project's own inbound
WhatsApp webhook handler does (`hmac.new(secret, raw_body, hashlib.sha256).hexdigest()`, `sha256=`
prefixed) before trusting a delivery.

**Delivery:** async, via Celery, with up to 3 retries (60s/120s/240s backoff) before a delivery is
recorded `failed`. **A Celery worker must be running** for any delivery to happen (`README.md` § 6;
on Windows, `celery -A config worker --pool=solo`).
````

---

## Edge Cases & Failure Modes

- **A subscription created, then disabled, then re-enabled mid-retry-window** — `deliver_webhook` re-checks `enabled=True` on every attempt (it re-queries, never trusts a value captured when first queued), so a subscription disabled after an event fired but before its retries finish simply stops retrying (the `filter(...).first()` returns `None`, the task no-ops) rather than delivering to a subscription the operator has since turned off.
- **A subscription deleted mid-retry-window** — same guard, same outcome: the task silently no-ops. No orphaned `WebhookDelivery` row is possible here (nothing is written for a delivery whose subscription is already gone), unlike a delivery that already succeeded before deletion, whose `WebhookDelivery` row is removed by `CASCADE` along with the subscription.
- **A subscriber's endpoint returns a non-2xx status** — `send_webhook` raises `WebhookError` for any `HTTPError` (any status DRF/`urllib` treats as an error, i.e. 4xx/5xx), which `deliver_webhook` treats exactly like a connection failure: retried, then recorded `failed` if retries are exhausted. A `3xx` redirect is followed transparently by `urllib.request.urlopen`'s own default behavior — not specially handled here.
- **A subscriber's endpoint hangs** — bounded by `WEBHOOK_TIMEOUT_SECONDS` (10s); a timeout surfaces as a `URLError` (`socket.timeout` wrapped), caught the same as any other connection failure.
- **Two `Ticket` saves racing** (an agent's `set_status` and an auto-escalation task landing near-simultaneously) — each save gets its own `pre_save`/`post_save` pair; `_capture_ticket_changes`'s `Ticket.objects.get(pk=...)` reads whatever is in the database at that instant, so a genuine race can make one save's "old value" already reflect the other save's write. This is the same read-then-write race every non-`select_for_update` Django code path already accepts elsewhere in this project (no existing ticket-mutation path uses row locking); not newly introduced here.
- **A ticket updated with `update_fields` that excludes every tracked field** (e.g. `ticket.save(update_fields=["subject"])`) — `_capture_ticket_changes` still runs (still costs its one extra query) but `changes` comes back empty, so `_dispatch_ticket_events` dispatches nothing. The query cost is paid regardless of whether anything tracked actually changed — see `## Prerequisites`.
- **`Ticket.objects.bulk_update`/`.update()`** would bypass `pre_save`/`post_save` entirely — verified live that no such call exists anywhere in this codebase today (`## Context` item 5). A future story adding one silently stops firing ticket webhook events for whatever it updates; `CONVENTIONS.md` § 32 is where that trap is documented.
- **An `events` list containing an unknown string** — rejected at `400 validation_error` on `events`, from both `WebhookSubscriptionSerializer.validate_events` (API path) and `WebhookSubscription.clean()`/`_validate_events` (admin/`full_clean()` path) — the same two-enforcement-point split `Role.clean()`/`RoleAdminSerializer` already establish.
- **Creating a subscription with no `secret`** — `400 validation_error` on `secret` (`WebhookSubscriptionSerializer.validate`, create-only check). **Editing** an existing subscription without touching `secret` (or sending `""`) leaves the stored value untouched — the established write-only-credential contract.
- **The signing secret never reaches a log line, an error message, or a response body.** `webhook_client.py` logs nothing about the request/response bodies by default (only `tasks.py`'s own `logger.exception`/`WebhookDelivery.error_message` capture failure *reasons*, never the secret); `WebhookSubscriptionSerializer.secret` is `write_only`. It **is** stored unencrypted — see `## Story Goal`/§ 32's cross-reference to § 29-31's identical, already-established posture for every other stored credential in this project.
- **`WEBHOOK_EVENTS` growing in a future story** — extend the frozenset in `models.py` and add/extend a signal receiver in `signals.py`; no migration is needed for the vocabulary itself (`events` is a plain `JSONField`), only if a genuinely new model needs its own new signal.
- **`makemigrations` must be run for `integrations`** (task 2), or `config/tests/test_settings.py::MigrationStateTests.test_no_pending_migrations` fails.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created and no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py makemigrations integrations` — generates the one new migration; `python manage.py makemigrations --check --dry-run` then reports nothing pending (`accounts/0011` is hand-written and data-only).
2. `python manage.py migrate`, then `python manage.py check`.
3. `python manage.py test` — must report **54** passing, `MigrationStateTests` included. This story changes neither the envelope renderer nor the exception handler.
4. `ruff format --check .` and `ruff check .` from `backend/`.
5. `python manage.py spectacular` — must still exit 0; the four new endpoints appear, envelope-wrapped by `apps.integrations.schema.envelope_postprocessing_hook` (Story 80) automatically — `WebhookSubscriptionViewSet`/`WebhookDeliveryViewSet` both declare `serializer_class`, so neither needs the `@extend_schema` fix Story 82's plain `APIView`s required (that gap was specific to a plain `APIView` with no `serializer_class` to introspect); `WebhookEventCatalogView` is a plain `APIView` returning a bare list the same shape `PermissionCatalogView` already is in this project's existing baseline (18 warnings / 135 errors) — confirm the error count does not grow by re-running the same `python manage.py spectacular` baseline check every prior `INT-*` story's plan used.
6. **The dispatch layer, exercised without any HTTP** — `apps.integrations.webhook_dispatch.dispatch_event` and `apps.integrations.webhook_client.sign_payload` are both plain, HTTP-independent-or-mockable functions; Verification Step 6 exercises `sign_payload` directly from a shell to confirm the exact signature format an integrator would independently compute.
7. Real HTTP against subscription CRUD, the event catalog, and a real signal-triggered, real-`Celery`-delivered webhook to a local stub receiver (the same `http.server`-script pattern Story 81 Verification Step 8 established) — Verification Steps 4-12 below.
8. `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` from `frontend/`, plus the `en`/`ar` key-set comparison for the new `webhooks` namespace.
9. A browser walkthrough of `/settings/webhooks` in both languages — Verification Step 13.

---

## Migration / Rollback

**Two migrations ship:**

| Migration | Kind | Reverse |
|---|---|---|
| `accounts/0011_grant_webhooks_permission` | Data | Its own `revoke()`. |
| `integrations/0004_webhooksubscription_webhookdelivery` | Schema (two tables) | `migrate integrations 0003` — drops every subscription and its delivery history. |

**Rollback of the code:** revert the commits, then `migrate integrations 0003`, `migrate accounts 0010`. No `pip install`/`npm install` to undo — this story adds no dependency.

**Half-applied states to avoid:**

- **Task 1's constant after task 1's migration** → `Role.clean()` raises `Unknown permissions: webhooks.manage` on the next role save. Constant first, always.
- **Task 3 (`signals.py` imports `.webhook_dispatch`) before task 5 (`webhook_dispatch.py` exists) or task 6 (`tasks.py`'s `deliver_webhook`)** → `ImportError` at Django startup, the moment `apps.py::ready()` (task 7) tries to import `signals`. Ship 2 (models), 4 (client), 5 (dispatch), 6 (task), 3 (signals), 7 (`ready()`) in that dependency order, or all together in one change.
- **Task 7 (`ready()` imports `signals`) before task 3 (`signals.py` exists)** → `ModuleNotFoundError` at Django startup — the app fails to boot at all, not just webhooks failing silently.
- **Task 9/10 (`views.py`/`urls.py`) before task 8 (`serializers.py`)** → `ImportError` at Django startup.
- **A `Ticket`/`Customer`/`Message` bulk-update path added in a later story with no awareness of `## Edge Cases`' `bulk_update`/`.update()` warning** → that path's changes silently never dispatch a webhook. Not fixable from this story; the warning in `CONVENTIONS.md` § 32 is the mitigation.

---

## Verification Steps

1. **Backend builds and migrates:** from `backend/` with the venv active — `python manage.py makemigrations integrations`, `python manage.py migrate`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`. All clean.
2. **Backend gates:** `python manage.py test` reports **54** passing; `ruff format --check .` and `ruff check .` exit 0.
3. **Schema still generates:** `python manage.py spectacular --file "$env:TEMP\webhooks-schema.yaml"` exits 0; confirm the four new paths are present and every `2xx` body is envelope-wrapped; confirm the error/warning counts match the pre-existing baseline (no new "unable to guess serializer" entries).
4. **Permission gating.** With `python manage.py runserver` up and a token for a role **without** `webhooks.manage`:

   ```powershell
   curl.exe -s -w "`n%{http_code}`n" http://127.0.0.1:8000/api/webhooks/subscriptions/ -H "Authorization: Bearer $agentToken"
   ```

   Expect `403 permission_denied`. Repeat with a `webhooks.manage` holder → `200`.
5. **Create a subscription without a secret (expect 400).** `POST /api/webhooks/subscriptions/ {"name":"Test","target_url":"http://127.0.0.1:9002/","events":["ticket.created"],"enabled":true}` → `400 validation_error` on `secret`.
6. **The signature format, computed independently.** In `manage.py shell`:

   ```python
   from apps.integrations.webhook_client import sign_payload
   sign_payload("test-secret", b'{"event":"ticket.created"}')
   ```

   Confirm the result is `sha256=<64 hex chars>`, and that recomputing `hmac.new(b"test-secret", b'{"event":"ticket.created"}', hashlib.sha256).hexdigest()` by hand matches the hex portion.
7. **Create a real subscription and confirm no secret leaks.** `POST .../subscriptions/ {"name":"Local test","target_url":"http://127.0.0.1:9002/","secret":"whsec_test123","events":["ticket.created","ticket.status_changed"],"enabled":true}` → `201`, `has_secret: true`, no `secret` key anywhere in the response. `GET` the same subscription → same, no `secret` key.
8. **The secret survives an unrelated save.** `PATCH .../subscriptions/<id>/ {"enabled":false}` (no `secret` key) → `200`; in `manage.py shell`, `WebhookSubscription.objects.get(pk=<id>).secret == "whsec_test123"` — unchanged. `PATCH {"enabled": true}` to restore it for the next step.
9. **A real end-to-end delivery.** Write a stdlib-only stub receiver to the scratchpad, following Story 81 Verification Step 8's exact shape, that verifies the signature and prints what it received:

   ```python
   # webhook_stub.py
   import hashlib, hmac, json
   from http.server import BaseHTTPRequestHandler, HTTPServer

   SECRET = "whsec_test123"

   class H(BaseHTTPRequestHandler):
       def do_POST(self):
           length = int(self.headers.get("Content-Length", 0))
           body = self.rfile.read(length)
           sig = self.headers.get("X-SupportOS-Signature", "")
           expected = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
           print("event:", self.headers.get("X-SupportOS-Event"))
           print("attempt:", self.headers.get("X-SupportOS-Delivery-Attempt"))
           print("signature valid:", hmac.compare_digest(sig, expected))
           print("body:", json.loads(body))
           self.send_response(200)
           self.send_header("Content-Length", "0")
           self.end_headers()

       def log_message(self, format, *args):
           pass

   HTTPServer(("127.0.0.1", 9002), H).serve_forever()
   ```

   Run it, start a Celery worker (`celery -A config worker --pool=solo -l info` on Windows), then create a ticket via the staff API (`POST /api/tickets/` with a valid `customer`). Confirm the stub prints `event: ticket.created`, `attempt: 1`, `signature valid: True`, and a `body` whose `data` matches the created ticket. Confirm `GET /api/webhooks/deliveries/?subscription=<id>` shows one row, `state: "success"`, `response_status_code: 200`.
10. **`ticket.status_changed`/`ticket.assigned`/`ticket.escalated`.** Subscribe to all three (`PATCH` the subscription's `events`), then: change the ticket's status via `POST /api/tickets/<id>/status/`, assign it via `POST /api/tickets/<id>/assign/`, escalate it via `POST /api/tickets/<id>/escalate/`. Confirm the stub receives three separate deliveries, and that the `status_changed` one's body has a top-level `changes.status.from`/`changes.status.to`.
11. **Retry on failure.** Stop the stub (`Ctrl+C`), then change the ticket's status again. Confirm `GET /api/webhooks/deliveries/?subscription=<id>&ordering=-created_at` shows a new row with `state: "retrying"`, `attempt: 1`, non-empty `error_message`. Wait ~60s (or trigger a retry manually via `manage.py shell`: `from apps.integrations.tasks import deliver_webhook; deliver_webhook.apply(args=[...])` with a fresh attempt count is unnecessary — the scheduled retry fires on its own); confirm a second row appears, `attempt: 2`. Restart the stub before the retries exhaust; confirm the next attempt succeeds with `state: "success"`.
12. **A disabled subscription receives nothing.** `PATCH {"enabled": false}`, then create another ticket. Confirm no new `WebhookDelivery` row appears for this subscription (query `?subscription=<id>` again — count unchanged).
13. **The UI walkthrough, both languages.** `npm run dev` with the backend and worker up, signed in as a `webhooks.manage` holder:
    - The sidebar Administration section shows the Webhooks link; `/settings/webhooks` lists the test subscription.
    - "New" opens the create form; the event checklist is grouped "Ticket"/"Customer"/"Message"; submitting with no secret shows an inline error on the secret field.
    - Editing the existing subscription shows its delivery history below the form, with the retry/success rows from Steps 9-11 visible with correctly colored state badges.
    - Deleting a subscription (with confirmation) removes it from the list.
    - Switch to Arabic: every label, badge, and toast is translated and `dir="rtl"`.
    - Sign in as a role **without** `webhooks.manage`: the sidebar link is absent and `/settings/webhooks` is refused by `RequirePermission`.
14. **No hardcoded strings.** From `frontend/`: `Select-String -Path src\features\webhooks\components\*.tsx -Pattern "'[A-Z][a-z]{3,}"` — only non-user-facing hits.
15. **Frontend gates, in CI order:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all exit 0. Plus the `en`/`ar` key-set comparison for `features/webhooks/locales`.
16. **Regression:** `python manage.py test` still **54**; walk `/tickets`, `/customers`, `/settings/erp`, `/settings/channels`, `/api-keys` and confirm no behavior change — this story only adds signal *receivers*, never modifies any existing view/serializer/adapter.

---

## Done Criteria

- [ ] `Permissions.WEBHOOKS_MANAGE` (`"webhooks.manage"`) added; `accounts/0011_grant_webhooks_permission.py` grants it to `admin` only and reverses cleanly.
- [ ] `WebhookSubscription`/`WebhookDelivery` exist in `apps/integrations/models.py`; `WEBHOOK_EVENTS` names exactly the six events; `_validate_events` enforced from both `clean()` and the serializer; one migration generated and committed.
- [ ] `apps/integrations/signals.py` exists, is the **only** signal-connected module in this project (verified by `grep -rln "@receiver" apps/` returning exactly this one file), and is imported from `IntegrationsConfig.ready()`.
- [ ] `_capture_ticket_changes`/`_dispatch_ticket_events` correctly fire `ticket.created` (on create), `ticket.status_changed` (with `changes`), `ticket.assigned` (only on a real, non-`None` assignment), `ticket.escalated` (only on escalating, never de-escalating) — verified live by Step 10.
- [ ] `customer.created`/`message.created` fire on creation only, via plain `post_save` with no dirty-tracking.
- [ ] `webhook_client.sign_payload` produces `sha256=<hex>` matching an independently computed HMAC-SHA256 (Step 6); `deliver_webhook` retries up to 3 times with 60/120/240s backoff before recording `state="failed"`; every attempt — success, retrying, or failed — writes its own `WebhookDelivery` row (Step 11).
- [ ] A disabled or deleted subscription is a silent no-op for any already-queued delivery (Step 12).
- [ ] `secret` is `write_only`, absent from every response, required on create, preserved when blank on `PATCH` (Steps 5, 7, 8).
- [ ] Four endpoints live and gated on `webhooks.manage`: full CRUD on `/api/webhooks/subscriptions/`, read-only `/api/webhooks/deliveries/` (with `?subscription=`), read-only `/api/webhooks/events/`.
- [ ] `/settings/webhooks` (list), `/settings/webhooks/new`, `/settings/webhooks/:id/edit` (form + scoped delivery history) all render, routed under their own `RequirePermission permission="webhooks.manage"`, with the sidebar link and Administration-section gate extended.
- [ ] `webhooks` locale namespace added in both languages, really translated, registered in `resources.ts`; `en`/`ar` key sets match.
- [ ] `README.md` gains the "Outbound webhooks (INT-4)" subsection; `CONVENTIONS.md` gains § 32 (the signals-exception rationale) with § 0-§ 31 unrenumbered.
- [ ] `python manage.py check`, `python manage.py test` (**54** passing), `python manage.py spectacular` (exit 0, no new schema errors), `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all pass.
- [ ] `.squad/plans/integrations/00-overview.md` carries this story's row, and records `EPIC 14` as now fully planned; `.squad/plans/00-index.md`'s `integrations` NN range includes `83`.

**This is the last story in `EPIC 14`. Report to the user and wait for confirmation before starting any other epic.**
