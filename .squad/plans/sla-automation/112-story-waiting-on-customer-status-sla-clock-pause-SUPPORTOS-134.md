# Story 112 — Waiting-on-Customer Status & SLA Clock Pause (Story: SUPPORTOS-134)

## Prerequisites

- **`TKT-4` (Story 23), `SLA-1` (Story 28), `SLA-5` (Story 111) completed** — the intake names exactly these three. `apps/tickets/status.py::VALID_TRANSITIONS`/`apply_status_change` (TKT-4), `apps/sla/policy.py::compute_sla_status` (SLA-1), and `apps/organization/business_hours.py::advance`/`elapsed_working_minutes` plus `apps/sla/policy.py::resolve_calendar` (SLA-5, Story 111) are all real and confirmed live by direct read.
- **`pending_customer` is inserted into TKT-4's existing state machine, not a parallel one** — the intake's own constraint. `apps/tickets/status.py::VALID_TRANSITIONS` (19-26) gains one new key and one new edge from `in_progress`; `apply_status_change` (36-74) is extended in place with pause bookkeeping, not duplicated.
- **Scope of the new transitions is deliberately narrow, matching the intake's own wording exactly**: `in_progress -> pending_customer` (manual, agent-initiated) and `pending_customer -> in_progress` (manual, agent-initiated, OR automatic, customer-reply-initiated). No `pending_customer -> resolved`/`closed` edge is added — the intake describes only these two directions ("entered from in_progress and left automatically... or manually"), and inventing a third exit path is not requested. A future story can widen this if a real need appears.
- **The automatic exit needs a NEW Django signal receiver — this codebase's SECOND deliberate exception to the explicit-call-site convention, after `apps.integrations.signals` (INT-4, `CONVENTIONS.md` §32).** An inbound `Message` (a customer's reply) is created from **six independent call sites** today, verified by direct read: `EmailAdapter.receive` (`apps/communications/email_adapter.py:87`), `SMSAdapter.receive` (`sms_adapter.py:89`), `WhatsAppAdapter.receive` (`whatsapp_adapter.py:115`), `WebFormAdapter.receive` (`web_form_adapter.py:61`), `LiveChatAdapter.receive` (`live_chat_adapter.py:121`), and `TicketChatConsumer.receive` (`consumers.py:101`, which itself calls `LiveChatAdapter().receive(...)` — so five distinct `Message.objects.create(...)` call sites in total, reached six ways). `CONVENTIONS.md` §32 explicitly names this exact shape ("a single domain event... with eight distinct call sites across five channel adapters... an explicit call site at all eight, forever, is the wrong trade") as the justified case for a signal, and this codebase has already been bitten once by the alternative: `EmailAdapter.receive`'s own comment (`email_adapter.py:75-85`, "F-25") records a ticket silently missing auto-assignment because it bypassed the one call site that queued it. A `post_save` receiver on `Message` needs no `pre_save` change-tracking (`Message` rows are never updated after creation — already verified and documented by `apps.integrations.signals._dispatch_message_created`'s own docstring), so it costs nothing beyond what `post_save`'s free `created` flag already answers.
- **New module `apps/tickets/signals.py`, wired via `apps/tickets/apps.py::TicketsConfig.ready()`** — the identical shape `apps/integrations/apps.py::IntegrationsConfig.ready()` already uses for `apps.integrations.signals`. Imports `apps.communications.models.Message` (never the reverse — `apps.communications` has no reason to know about SLA pause behaviour), the same one-way "watcher app imports the watched app's models" direction INT-4 established.
- **Pause bookkeeping reuses SLA-5's working-time primitive, never a second time calculation** — the intake's own constraint. `apps/tickets/status.py::apply_status_change` computes the just-ended pause's length via `apps/sla/policy.py::resolve_calendar` + `apps/organization/business_hours.py::elapsed_working_minutes`, the exact same calendar-resolution order `compute_sla_status`/`is_at_risk`/`is_idle` already use (Story 111). This is a **new reverse-cross-app import**: `apps.tickets.status` importing `apps.sla.policy` and `apps.organization.business_hours`. Verified safe, the same proof Story 28/111 already recorded for the opposite direction: `apps.sla.policy` imports `apps.tickets.models` (not `apps.tickets.status`), and `apps.organization.business_hours` imports only `apps.organization.models` — so `apps.tickets.status -> apps.sla.policy -> apps.tickets.models` and `apps.tickets.status -> apps.organization.business_hours -> apps.organization.models` are both one-way leaf-module dependencies with no cycle.
- **Accumulated pause is stored explicitly on `Ticket`, closed out on every exit from `pending_customer`** — the intake's own constraint ("store accumulated pause explicitly... recomputation is not required"). `Ticket.sla_paused_minutes` (a running total) and `Ticket.pending_customer_since` (set on entry, cleared on exit) are the two new fields; `apply_status_change` is the ONLY place either is written, so both the manual and automatic exit paths (and TKT-7's `bulk_status`, which already calls the same helper — `apps/tickets/views.py:472-497`) can never drift.
- **A still-open pause (the ticket is `pending_customer` RIGHT NOW) is never persisted mid-flight — it is added live, on top of the stored total, by `apps/sla/policy.py::compute_sla_status`/`status_from_facts`.** This is the same "compute what hasn't finished yet" rule `compute_sla_status` already applies to its own `response_status`/`resolution_status` (a "pending" ticket becomes "breached" automatically once real time passes, with nothing to update) — extended here to the pause itself, not a new philosophy.
- **The single-ticket detail path (`compute_sla_status`) is calendar-aware for the pause the same way it already is for due times (Story 111); the bulk paths (`status_from_facts` — ticket list, `apps/reports/sla.py` — RPT-2) treat `sla_paused_minutes` as plain minutes, no calendar lookup.** This is the SAME wall-clock-only simplification Story 111 already accepted for its own due-time calendar-awareness on the bulk paths (`## Prerequisites`, "Not every SLA consumer is calendar-aware") — not a new limitation this story invents, just the same one extended to cover pause too.
- **`is_idle` (`apps/sla/escalation_rules.py:92-108`) gains one new guard: a ticket currently `pending_customer` is never idle-escalated.** This is the intake's own explicit ask — "the state also gives the escalation job a way to tell 'idle because blocked' from 'idle because neglected'." `is_at_risk` (61-89) is deliberately **not** changed beyond what it already inherits from `compute_sla_status`'s now-pause-aware due dates — a ticket already at-risk when it enters `pending_customer` stays classified at-risk (its remaining time-to-deadline freezes rather than shrinking further while paused, because the due date itself is being pushed out at the same rate `now` advances), which needs no separate guard.
- **`SlaDimensionStatus`/`dimension_status`'s own three-value vocabulary (`met`/`breached`/`pending`) is UNCHANGED.** "Paused" is not a due-date outcome — it is a separate fact about the ticket's current state, surfaced as a new top-level `paused`/`paused_minutes` pair on `compute_sla_status`'s dict (single-ticket detail) and as a fourth, short-circuiting outcome specifically on the TICKET-LEVEL overall classifiers that already have a `status` in hand: `status_from_facts` (ticket list) and `apps/reports/sla.py::sla_breach_rate` (RPT-2). Keeping `dimension_status` itself untouched means every existing caller (escalation, the per-dimension detail badges) is unaffected.
- **Frontend reuses existing badge semantics — no new colour vocabulary**, the intake's own constraint. `frontend/src/features/tickets/lib/statusBadge.ts::ticketStatusVariant`/`slaStatusVariant` both already map onto a fixed, already-used variant set (`info`/`warning`/`success`/`outline`/`secondary`/`destructive` — DSN-4). `pending_customer` and the new `"paused"` `SlaStatus` value both map to `secondary`, the same neutral variant `TicketSlaSection.tsx`'s own local `badgeVariant` already uses for `"pending"` — distinct from `warning` (used for `in_progress`, an "actively worked" state) so a paused ticket never reads as more urgent than it is.

---

## Story Goal

1. **`pending_customer` ticket status** (`apps.tickets`): a new `Ticket.Status` value, entered manually (`in_progress -> pending_customer`) and left either manually (`pending_customer -> in_progress`) or automatically the moment the customer's own reply arrives on any channel.
2. **SLA clock pause**: `Ticket.pending_customer_since`/`Ticket.sla_paused_minutes` track time spent waiting on the customer; `apps/sla/policy.py::compute_sla_status` extends both due dates by the paused amount (working-time-aware when a calendar applies, per SLA-5) so a paused ticket is never penalised for a delay the team did not cause.
3. **Escalation awareness**: `apps/sla/escalation_rules.py::is_idle` never fires for a `pending_customer` ticket — blocked, not neglected.
4. **Surfacing**: the new status renders via existing badge semantics on the ticket list/detail; a "Paused" SLA indicator appears on the detail page's SLA card; RPT-2's SLA reports gain a `paused` bucket, correctly excluded from the breach rate.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `Ticket.Status.PENDING_CUSTOMER`, `VALID_TRANSITIONS` extension | Intake task 1 — "add the status... extend the valid-transition graph." |
| `apps/tickets/signals.py` (NEW) — auto-resume on inbound message | Intake task 1 — "left automatically... via COMM-0's inbound message path." |
| `Ticket.pending_customer_since`/`sla_paused_minutes`; `apply_status_change` bookkeeping | Intake task 2 — "implement accumulated paused time... store accumulated pause explicitly." |
| `compute_sla_status`'s pause-extended due dates, `paused`/`paused_minutes` fields | Intake task 2 — "subtract it when computing response/resolution status." |
| `is_idle`'s `pending_customer` guard | Intake's own "idle because blocked... idle because neglected" framing. |
| `ticketStatusVariant`/`slaStatusVariant` extensions, `TicketSlaSection.tsx`'s Paused badge, ticket-list `sla_status` gaining `"paused"` | Intake task 3 — "show the status and a paused-SLA indicator... via UI/DSN semantics." |
| `apps/reports/sla.py`'s `paused` bucket | Intake task 3 — "separate paused time in RPT-2's SLA reporting." |

**Not here, and why:**

- **No `pending_customer -> resolved`/`closed` transition.** See `## Prerequisites` — not named by the intake; a future story can add it with its own design pass if a real workflow need appears.
- **No calendar-awareness in the bulk SLA paths' pause handling** (`status_from_facts`, `apps/reports/sla.py`) — the same simplification Story 111 already accepted for due-time calendar-awareness on those same two paths.
- **No change to `is_at_risk`** beyond what it already inherits from pause-aware due dates — see `## Prerequisites`.
- **No new `TicketActivity.Kind`.** Every transition into or out of `pending_customer` — manual or automatic — logs as an ordinary `STATUS_CHANGED` entry, exactly like every other status change; `from_value`/`to_value` already round-trip an arbitrary status string with no enum restriction on the activity log itself.
- **No admin.py change.** `TicketAdmin.list_display`/`list_filter` (`apps/tickets/admin.py:28-49`) already reference the plain `status` field, which Django re-derives its choices from automatically; `escalated_at`/`closed_at` are not in `readonly_fields` today, and `pending_customer_since`/`sla_paused_minutes` follow that same precedent rather than special-casing themselves.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| `pending_customer` is entered/left through the SAME transition validation as every other status. | Intake, task 1 | `apps/tickets/status.py::VALID_TRANSITIONS`/`apply_status_change`. |
| An inbound message from the customer, on ANY channel, automatically resumes a `pending_customer` ticket. | Intake, task 1 | `apps/tickets/signals.py` (NEW), a `post_save` receiver on `Message`. |
| Paused time is accumulated explicitly, working-time-aware, using SLA-5's own primitive. | Intake, task 2 | `apply_status_change`'s pause bookkeeping; `apps/sla/policy.py::resolve_calendar`/`elapsed_working_minutes`. |
| A currently-open pause is added live on top of the stored total; nothing is left to "recompute later." | This story's design | `apps/sla/policy.py::_effective_paused_minutes`. |
| Idle escalation never fires while explicitly waiting on the customer. | Intake's own framing | `apps/sla/escalation_rules.py::is_idle`. |
| Paused tickets are excluded from breach figures, not misclassified as breached/pending. | Intake, task 3 | `status_from_facts`, `apps/reports/sla.py::sla_breach_rate`. |
| No new badge colour vocabulary. | Intake, task 3; DSN-4 | `frontend/.../lib/statusBadge.ts`. |

---

## Context — Read These Files First

1. `.squad/stories/sla-automation/SUPPORTOS-134/intake.md` — three tasks, no attachments, no acceptance criteria.
2. `backend/apps/tickets/models.py` lines 27-46 (`Ticket.Status`), 121-161 (`status`/`escalated`/`escalated_at`/`closed_at` — the exact "set on entry, cleared/frozen on exit" field shapes `pending_customer_since`/`sla_paused_minutes` follow), 163-189 (`Meta`), 202-213 (`TicketActivity.Kind`, reused unchanged).
3. `backend/apps/tickets/status.py` (74 lines, in full) — `VALID_TRANSITIONS` (19-26) and `apply_status_change` (36-74), both extended in place.
4. `backend/apps/tickets/apps.py` (5 lines) — currently no `ready()`; add one mirroring `apps/integrations/apps.py`'s exact shape.
5. `backend/apps/integrations/signals.py` (98 lines, in full) and `apps/integrations/apps.py` — the precedent this story's `apps/tickets/signals.py` copies: a dedicated app-level signals module, wired via `ready()`, watching a foreign app's model.
6. `backend/apps/communications/email_adapter.py` lines 38-97 (`EmailAdapter.receive`, including the `# F-25` comment at 75-85 — direct evidence of the decentralized-call-site failure mode this story's signal avoids repeating) and lines 87-97 specifically (the `Message.objects.create(..., direction=Message.Direction.INBOUND, ...)` call the signal fires on). `sms_adapter.py:89`, `whatsapp_adapter.py:115`, `web_form_adapter.py:61`, `live_chat_adapter.py:121` — the other four inbound-create call sites, unchanged by this story (the signal covers all of them with zero edits here).
7. `backend/apps/communications/consumers.py` lines 88-107 (`TicketChatConsumer.receive`) — confirms the live-chat socket path also routes through `LiveChatAdapter().receive(...)` (`live_chat_adapter.py:121`'s own `Message.objects.create`), so it needs no separate signal wiring.
8. `backend/apps/sla/policy.py` (251 lines, in full) — `resolve_calendar` (67-80), `dimension_status` (83-96, UNCHANGED), `compute_sla_status` (99-146), `status_from_facts` (225-250) — all four either called by or modified for this story.
9. `backend/apps/sla/escalation_rules.py` (109 lines, in full) — `is_at_risk` (61-89, unchanged) and `is_idle` (92-108, gains one guard).
10. `backend/apps/sla/tasks.py` lines 47-77 (`evaluate_escalations`) — confirms the `candidates` queryset already includes `pending_customer` tickets (only excludes `resolved`/`closed`); no queryset change needed, only `is_idle`'s own new guard.
11. `backend/apps/tickets/serializers.py` lines 1-8 (imports) and 168-193 (`TicketSerializer.get_sla_status`) — the one call site of `status_from_facts` this story extends with two new arguments.
12. `backend/apps/reports/sla.py` (140 lines, in full) — `_annotated_tickets` (39-50), `sla_trend` (53-100), `sla_breach_rate` (103-139) — all three read/extended.
13. `backend/apps/reports/views.py` lines 236-256 (`SlaBreachRateReportView`, including `csv_columns`) — the CSV export column list this story extends.
14. `backend/apps/tickets/views.py` lines 472-497 (`bulk_status`) — confirms it already calls `apply_status_change` (no view-layer change needed anywhere in this file for this story).
15. `frontend/src/features/tickets/types/ticket.ts` (in full, 77 lines) — `TICKET_STATUSES`, `TICKET_STATUS_TRANSITIONS`, `SLA_STATUSES`/`SlaStatus`.
16. `frontend/src/features/tickets/types/ticketSla.ts` (in full) — `TicketSla`, gains `paused`/`paused_minutes`.
17. `frontend/src/features/tickets/lib/statusBadge.ts` (in full, 54 lines) — `ticketStatusVariant` (9-22), `slaStatusVariant` (44-53).
18. `frontend/src/features/tickets/components/TicketSlaSection.tsx` (in full, 71 lines) — the detail-page SLA card, gains a Paused badge.
19. `frontend/src/features/tickets/components/TicketListPage.tsx` lines 255-279 (`status`/`sla_status` columns — confirm no code change needed, only the two badge-variant functions and locale keys) and `TicketDetailPage.tsx` lines 158-172 (the ticket's own status badge/control).
20. `frontend/src/features/tickets/components/TicketStatusControl.tsx` (in full, 77 lines) and `TicketHistorySection.tsx` lines 89-102 — both already generic over `TICKET_STATUS_TRANSITIONS`/`t('statuses.…')`, confirming zero code changes needed there beyond the shared constant/locale extensions.
21. `frontend/src/features/reports/types/sla.ts` (in full) — `SlaBreachRateRow`, gains `paused`.
22. `frontend/src/features/reports/components/SlaReportsPage.tsx` lines 176-196 (the breach-rate `ChartDataTable` columns/rows).
23. `frontend/src/features/tickets/locales/en.json` lines 29-34 (`statuses`), 176-186 (`sla`), 247-251 (`slaStatuses`) and `frontend/src/features/reports/locales/en.json` lines 69-77 (`breachRate`) — the key blocks this story extends, both languages.
24. `CONVENTIONS.md` §32 (the signals exception, read in full before adding the second receiver — its own instruction) and §38 (Story 111's business-hours section, most recent) — this story appends `## 39. SLA clock pause & the second signals exception (SLA-6)` after it.

---

## Backend Tasks

### 1 — `pending_customer` status

**File: `backend/apps/tickets/models.py`** — extend `Ticket.Status` (after line 39, `RESOLVED`'s declaration comes after — insert `PENDING_CUSTOMER` between `IN_PROGRESS` and `RESOLVED`):

```python
    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        IN_PROGRESS = "in_progress", _("In progress")
        PENDING_CUSTOMER = "pending_customer", _("Waiting on customer")
        RESOLVED = "resolved", _("Resolved")
        CLOSED = "closed", _("Closed")
```

Add two fields after `closed_at` (line 161), before `class Meta`:

```python
    # SLA-6 (Story 112). Set when `status` becomes `pending_customer`,
    # cleared when it leaves that status (either direction) — the same
    # "set on entry, cleared/frozen on exit" shape `escalated_at` already
    # uses. Read live by `apps/sla/policy.py::compute_sla_status` to add
    # the STILL-OPEN pause to `sla_paused_minutes` for a ticket paused
    # right now; only `apps/tickets/status.py::apply_status_change`
    # writes this field.
    pending_customer_since = models.DateTimeField(
        _("pending customer since"), null=True, blank=True
    )
    # SLA-6 (Story 112). The running total of paused minutes — WORKING
    # minutes when a calendar applies to this ticket (SLA-5), else plain
    # wall-clock minutes — accumulated by `apply_status_change` every
    # time the ticket LEAVES `pending_customer`. Stored explicitly, not
    # recomputed from history: editing a `WorkingWindow`/`Holiday` later
    # must never silently rewrite an already-closed-out pause.
    sla_paused_minutes = models.PositiveIntegerField(_("SLA paused minutes"), default=0)
```

Migration, from `backend/`:

```
python manage.py makemigrations tickets
```

Expect **one** new file, `apps/tickets/migrations/0015_<name>.py` — an `AlterField` on `status` (the new choice, a state-only change with no DB effect since `choices` is not enforced as a database constraint here) plus two `AddField` operations, depending on `tickets`' `0014_ticket_closed_at`.

### 2 — Transition graph

**File: `backend/apps/tickets/status.py`** — replace `VALID_TRANSITIONS` (lines 19-26):

```python
VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    Ticket.Status.OPEN: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.IN_PROGRESS: frozenset(
        {
            Ticket.Status.OPEN,
            Ticket.Status.PENDING_CUSTOMER,
            Ticket.Status.RESOLVED,
            Ticket.Status.CLOSED,
        }
    ),
    # SLA-6 (Story 112): the only way out is back to `in_progress` — see
    # Story 112 `## Prerequisites` for why `resolved`/`closed` are not
    # reachable directly from here.
    Ticket.Status.PENDING_CUSTOMER: frozenset({Ticket.Status.IN_PROGRESS}),
    Ticket.Status.RESOLVED: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.CLOSED: frozenset(),
}
```

### 3 — Pause bookkeeping in `apply_status_change`

**File: `backend/apps/tickets/status.py`** — add imports:

```python
from apps.organization.business_hours import elapsed_working_minutes
from apps.sla.policy import resolve_calendar, resolve_policy
```

Replace the body of `apply_status_change` (lines 36-74) from `old_status = ticket.status` onward:

```python
    old_status = ticket.status
    ticket.status = new_status
    update_fields = ["status", "updated_at"]
    now = timezone.now()

    if new_status == Ticket.Status.PENDING_CUSTOMER:
        ticket.pending_customer_since = now
        update_fields.append("pending_customer_since")
    elif old_status == Ticket.Status.PENDING_CUSTOMER:
        # Leaving a wait — SLA-6 (Story 112). Folds the just-ended pause
        # into the running total, working-time-aware when a calendar
        # applies (the same `resolve_calendar` lookup
        # `compute_sla_status` uses, so the two can never disagree about
        # which calendar governs this ticket).
        paused_since = ticket.pending_customer_since
        if paused_since is not None:
            calendar = resolve_calendar(ticket, resolve_policy(ticket))
            if calendar is not None:
                elapsed = elapsed_working_minutes(calendar, paused_since, now)
            else:
                elapsed = int((now - paused_since).total_seconds() // 60)
            ticket.sla_paused_minutes += elapsed
            update_fields.append("sla_paused_minutes")
        ticket.pending_customer_since = None
        update_fields.append("pending_customer_since")

    if new_status == Ticket.Status.CLOSED:
        ticket.closed_at = now
        update_fields.append("closed_at")
    ticket.save(update_fields=update_fields)
    TicketActivity.objects.create(
        ticket=ticket,
        actor=actor,
        kind=TicketActivity.Kind.STATUS_CHANGED,
        from_value=old_status,
        to_value=new_status,
    )
```

(The validation block above `old_status = ticket.status` — lines 46-58 — is unchanged.)

### 4 — Automatic resume helper

**File: `backend/apps/tickets/status.py`** — append, after `apply_status_change`:

```python
def resume_from_pending_customer(ticket: Ticket) -> None:
    """Ends a `pending_customer` wait automatically — the customer just
    replied (`apps/tickets/signals.py`, SLA-6, Story 112). A no-op if the
    ticket has already left `pending_customer` by the time this runs
    (e.g. an agent manually resumed it moments earlier) — never raises
    for an already-resolved race, unlike `apply_status_change`'s own
    strict validation.
    """
    if ticket.status != Ticket.Status.PENDING_CUSTOMER:
        return
    apply_status_change(ticket, Ticket.Status.IN_PROGRESS, actor=None)
```

### 5 — The signal

**Create file: `backend/apps/tickets/signals.py`**

```python
"""Automatic ticket-status reaction to inbound messages — SLA-6
(Story 112).

The SECOND deliberate exception to this codebase's explicit-call-site
convention, after `apps.integrations.signals` (INT-4) — read that module
and `CONVENTIONS.md` §32 first. Same justification: an inbound `Message`
(a customer's own reply) is created from FIVE independent call sites
today — `EmailAdapter`, `SMSAdapter`, `WhatsAppAdapter`, `WebFormAdapter`,
`LiveChatAdapter` (the last also reached through
`TicketChatConsumer.receive`, `apps/communications/consumers.py:101`) —
with more channels likely in the future. An explicit call at every one,
forever, is the same wrong trade INT-4's own docstring rejected for "a
ticket was created." This codebase has already been bitten by exactly
this failure mode once: `EmailAdapter.receive`'s own "F-25" comment
records a brand-new ticket silently missing auto-assignment because it
bypassed the one call site that queued it.

Watches `apps.communications.models.Message`, never the reverse — this
module imports `apps.communications.models`; that app has no reason to
import anything about SLA pause behaviour. `Message` rows are never
updated after creation (verified — `apps.integrations.signals
._dispatch_message_created`'s own docstring already documents this), so
`post_save`'s free `created` flag is all this needs; no `pre_save`
change-tracking, unlike INT-4's own `Ticket` receiver.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.communications.models import Message

from .models import Ticket
from .status import resume_from_pending_customer


@receiver(post_save, sender=Message)
def _resume_ticket_on_customer_reply(sender, instance, created, **kwargs):
    """A no-op for every case but one: a newly created INBOUND message.
    `resume_from_pending_customer` itself guards against the ticket
    already having left `pending_customer`, so no status check is
    duplicated here.
    """
    if not created or instance.direction != Message.Direction.INBOUND:
        return
    resume_from_pending_customer(instance.ticket)
```

**File: `backend/apps/tickets/apps.py`** — replace in full:

```python
from django.apps import AppConfig


class TicketsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tickets"

    def ready(self):
        # `signals` registers its `@receiver` the same way
        # `apps.integrations.apps.py::ready()` documents for its own
        # (INT-4) — a decorator only takes effect if its module is
        # actually imported. SLA-6 (Story 112).
        from . import signals  # noqa: F401
```

### 6 — Pause-aware SLA due times

**File: `backend/apps/sla/policy.py`** — extend the `business_hours` import (line 19):

```python
from apps.organization.business_hours import advance, elapsed_working_minutes
```

Add `_effective_paused_minutes`, after `resolve_calendar` (after line 80):

```python
def _effective_paused_minutes(ticket: Ticket, calendar: BusinessCalendar | None, now) -> int:
    """`ticket.sla_paused_minutes` (every CLOSED-OUT `pending_customer`
    period) plus, if the ticket is paused RIGHT NOW, the still-open
    period's own elapsed minutes so far — computed live, never
    persisted, the same "compute what hasn't finished yet" rule this
    module already applies to `response_status`/`resolution_status`
    themselves. SLA-6 (Story 112).
    """
    paused_minutes = ticket.sla_paused_minutes
    if ticket.status == Ticket.Status.PENDING_CUSTOMER and ticket.pending_customer_since is not None:
        if calendar is not None:
            paused_minutes += elapsed_working_minutes(calendar, ticket.pending_customer_since, now)
        else:
            paused_minutes += int((now - ticket.pending_customer_since).total_seconds() // 60)
    return paused_minutes
```

Change `compute_sla_status` (lines 99-146) — replace the due-date computation:

```python
    now = timezone.now()
    calendar = resolve_calendar(ticket, policy)
    paused_minutes = _effective_paused_minutes(ticket, calendar, now)
    if calendar is not None:
        response_due_at = advance(
            calendar, ticket.created_at, policy.response_target_minutes + paused_minutes
        )
        resolution_due_at = advance(
            calendar, ticket.created_at, policy.resolution_target_minutes + paused_minutes
        )
    else:
        response_due_at = ticket.created_at + timedelta(
            minutes=policy.response_target_minutes + paused_minutes
        )
        resolution_due_at = ticket.created_at + timedelta(
            minutes=policy.resolution_target_minutes + paused_minutes
        )
```

Add two keys to the returned dict (after `resolution_status`):

```python
        "paused": ticket.status == Ticket.Status.PENDING_CUSTOMER,
        "paused_minutes": paused_minutes,
```

### 7 — Pause-aware overall status (ticket list)

**File: `backend/apps/sla/policy.py`** — replace `status_from_facts`'s signature and body (lines 225-250):

```python
def status_from_facts(
    created_at,
    priority,
    category_id,
    first_response_at,
    resolved_at,
    resolve,
    now,
    status: str,
    paused_minutes: int,
) -> str | None:
    """One ticket's overall SLA status, from already-fetched facts.

    The WORSE of the two dimensions, in `dimension_status`'s own
    vocabulary (`met` / `breached` / `pending`) — deliberately not a new
    three-value scale. An "at risk" tier was considered and rejected:
    nothing in this codebase defines an approaching-breach threshold, so
    it would be an invented number pretending to be a measurement.

    `None` when no policy resolves — SLA tracking is opt-in, the same
    outcome `compute_sla_status` already treats as normal.

    `status`/`paused_minutes` — SLA-6 (Story 112): the ticket's own
    `status`/`sla_paused_minutes` columns, already present on any
    `Ticket` row this is called for, no extra query. If `status` is
    `Ticket.Status.PENDING_CUSTOMER`, returns `"paused"` immediately,
    before any due-date math — a currently-paused ticket is neither
    `met`, `pending`, nor `breached` from a team-owned-time perspective,
    and must never contribute to a breach figure. Otherwise,
    `paused_minutes` extends both due dates by that many minutes — the
    same wall-clock-only simplification this bulk path already accepts
    for calendar awareness (Story 111 `## Prerequisites`); only the
    single-ticket `compute_sla_status` is calendar-aware.
    """
    if status == Ticket.Status.PENDING_CUSTOMER:
        return "paused"
    targets = resolve(priority, category_id)
    if targets is None:
        return None
    response_target, resolution_target = targets
    statuses = (
        dimension_status(
            created_at + timedelta(minutes=response_target + paused_minutes),
            first_response_at,
            now,
        ),
        dimension_status(
            created_at + timedelta(minutes=resolution_target + paused_minutes),
            resolved_at,
            now,
        ),
    )
    for worst in ("breached", "pending", "met"):
        if worst in statuses:
            return worst
    return None
```

**File: `backend/apps/tickets/serializers.py`** — extend the `status_from_facts` call inside `get_sla_status` (lines 185-193):

```python
        return status_from_facts(
            obj.created_at,
            obj.priority,
            obj.category_id,
            obj.first_response_at,
            obj.resolved_at,
            resolve,
            timezone.now(),
            obj.status,
            obj.sla_paused_minutes,
        )
```

### 8 — Idle escalation skips paused tickets

**File: `backend/apps/sla/escalation_rules.py`** — `is_idle` (lines 92-108), add a guard as the first line of the body:

```python
def is_idle(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """... (existing docstring, plus:) SLA-6 (Story 112): a ticket
    currently `pending_customer` is never idle — it is blocked on the
    customer, not neglected. This is checked before `threshold_minutes`
    itself, so it applies even when an `idle` rule is enabled.
    """
    if ticket.status == Ticket.Status.PENDING_CUSTOMER:
        return False
    if threshold_minutes is None:
        return False
    ...
```

(`Ticket` is already imported at the top of this file.)

### 9 — RPT-2: paused bucket in reports

**File: `backend/apps/reports/sla.py`** — extend `_annotated_tickets`'s projection (line 50):

```python
    ).values(
        "id", "created_at", "priority", "category_id", "first_response_at", "resolved_at",
        "status", "sla_paused_minutes",
    )
```

Change `sla_trend` (lines 53-100) — subtract paused minutes from each elapsed-time sample, clamped at zero:

```python
        if row["first_response_at"] is not None:
            minutes = max(
                (row["first_response_at"] - created).total_seconds() / 60 - row["sla_paused_minutes"],
                0,
            )
            key = (bucket_key, RESPONSE)
            sums[key] = sums.get(key, 0) + minutes
            counts[key] = counts.get(key, 0) + 1
        if row["resolved_at"] is not None:
            minutes = max(
                (row["resolved_at"] - created).total_seconds() / 60 - row["sla_paused_minutes"],
                0,
            )
            key = (bucket_key, RESOLUTION)
            sums[key] = sums.get(key, 0) + minutes
            counts[key] = counts.get(key, 0) + 1
```

Change `sla_breach_rate` (lines 103-139):

```python
    resolve = bulk_target_resolver()
    now = timezone.now()
    counts = {
        RESPONSE: {"met": 0, "breached": 0, "pending": 0, "paused": 0},
        RESOLUTION: {"met": 0, "breached": 0, "pending": 0, "paused": 0},
    }

    for row in _annotated_tickets(start, end):
        if row["status"] == Ticket.Status.PENDING_CUSTOMER:
            counts[RESPONSE]["paused"] += 1
            counts[RESOLUTION]["paused"] += 1
            continue
        targets = resolve(row["priority"], row["category_id"])
        if targets is None:
            continue
        response_target, resolution_target = targets
        created = row["created_at"]
        paused = row["sla_paused_minutes"]
        response_due = created + timedelta(minutes=response_target + paused)
        resolution_due = created + timedelta(minutes=resolution_target + paused)
        counts[RESPONSE][dimension_status(response_due, row["first_response_at"], now)] += 1
        counts[RESOLUTION][dimension_status(resolution_due, row["resolved_at"], now)] += 1

    result = []
    for key in (RESPONSE, RESOLUTION):
        c = counts[key]
        total = c["met"] + c["breached"]
        rate = None if total == 0 else round(c["breached"] / total, 3)
        result.append({"key": key, **c, "rate": rate})
    return result
```

(`rate`'s denominator stays `met + breached` — `pending` and `paused` are both excluded, unchanged reasoning.)

**File: `backend/apps/reports/views.py`** — extend `SlaBreachRateReportView.csv_columns` (lines 246-252):

```python
    csv_columns = (
        ("key", _("Dimension")),
        ("met", _("Met")),
        ("breached", _("Breached")),
        ("pending", _("Pending")),
        ("paused", _("Paused")),
        ("rate", _("Breach rate")),
    )
```

---

## Frontend Tasks

### 10 — Status/SLA-status vocabulary

**File: `frontend/src/features/tickets/types/ticket.ts`** — replace `TICKET_STATUSES` and `TICKET_STATUS_TRANSITIONS` (lines 2, 15-20):

```ts
export const TICKET_STATUSES = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'] as const

export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['open', 'pending_customer', 'resolved', 'closed'],
  pending_customer: ['in_progress'],
  resolved: ['in_progress', 'closed'],
  closed: [],
}
```

Replace `SLA_STATUSES` (line 75):

```ts
export const SLA_STATUSES = ['met', 'pending', 'breached', 'paused'] as const
```

### 11 — `TicketSla` type

**File: `frontend/src/features/tickets/types/ticketSla.ts`** — add two fields to the non-null branch:

```ts
export type TicketSla = {
  policy_id: number | null
  response_target_minutes: number
  resolution_target_minutes: number
  response_due_at: string
  response_status: SlaDimensionStatus
  resolution_due_at: string
  resolution_status: SlaDimensionStatus
  /** SLA-6 (Story 112): true while this ticket is currently `pending_customer`. */
  paused: boolean
  /** SLA-6 (Story 112): accumulated paused minutes, live-inclusive of any
   * still-open pause. */
  paused_minutes: number
} | null
```

### 12 — Badge semantics

**File: `frontend/src/features/tickets/lib/statusBadge.ts`** — extend `ticketStatusVariant` (lines 9-22):

```ts
export function ticketStatusVariant(
  status: TicketStatus,
): 'info' | 'warning' | 'secondary' | 'success' | 'outline' {
  switch (status) {
    case 'open':
      return 'info'
    case 'in_progress':
      return 'warning'
    case 'pending_customer':
      return 'secondary'
    case 'resolved':
      return 'success'
    case 'closed':
      return 'outline'
  }
}
```

Extend `slaStatusVariant` (lines 44-53):

```ts
export function slaStatusVariant(
  status: SlaStatus,
): 'success' | 'warning' | 'secondary' | 'destructive' {
  switch (status) {
    case 'met':
      return 'success'
    case 'pending':
      return 'warning'
    case 'breached':
      return 'destructive'
    case 'paused':
      return 'secondary'
  }
}
```

(No change to `TicketListPage.tsx`/`TicketDetailPage.tsx` — both already call these two functions generically, per `## Context`.)

### 13 — Paused indicator on the SLA card

**File: `frontend/src/features/tickets/components/TicketSlaSection.tsx`** — render a Paused badge above the Response/Resolution grid, inside the `sla !== null` branch:

```tsx
            sla === null ? (
              <p className="text-sm text-muted-foreground">{t('sla.noPolicy')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {sla.paused ? (
                  <div>
                    <Badge variant="secondary">{t('sla.paused')}</Badge>
                  </div>
                ) : null}
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* existing Response/Resolution <div>s, unchanged */}
                </dl>
              </div>
            )
```

(Wraps the existing `<dl>` in a new outer `<div>` so the Paused badge can sit above it; the `<dl>`'s own two children are untouched.)

### 14 — Reports: paused bucket

**File: `frontend/src/features/reports/types/sla.ts`** — add to `SlaBreachRateRow`:

```ts
export type SlaBreachRateRow = {
  key: 'response' | 'resolution'
  met: number
  breached: number
  pending: number
  /** SLA-6 (Story 112): tickets currently `pending_customer` — excluded
   * from `rate`'s denominator, the same as `pending`. */
  paused: number
  rate: number | null
}
```

**File: `frontend/src/features/reports/components/SlaReportsPage.tsx`** — extend the breach-rate `ChartDataTable` (lines 179-194):

```tsx
            columns={[
              t('fields.dimension'),
              t('breachRate.met'),
              t('breachRate.breached'),
              t('breachRate.pending'),
              t('breachRate.paused'),
              t('breachRate.rate'),
            ]}
            rows={rows.map((row) => [
              labelForSeries(row.key),
              String(row.met),
              String(row.breached),
              String(row.pending),
              String(row.paused),
              row.rate === null
                ? t('breachRate.noData')
                : number(row.rate, { style: 'percent', maximumFractionDigits: 1 }),
            ])}
```

(The `GaugeChart` below, keyed off `row.rate`, needs no change.)

### 15 — Locales

**File: `frontend/src/features/tickets/locales/en.json`** — `statuses` block (lines 29-34):

```json
  "statuses": {
    "open": "Open",
    "in_progress": "In progress",
    "pending_customer": "Waiting on customer",
    "resolved": "Resolved",
    "closed": "Closed"
  },
```

`sla` block (lines 176-186) — add `"paused"` as a sibling of `"response"`/`"resolution"` (the per-dimension `sla.statuses.*` sub-block stays exactly as-is, unchanged):

```json
  "sla": {
    "title": "SLA Status",
    "noPolicy": "No SLA policy configured for this ticket's priority.",
    "paused": "SLA paused — waiting on customer",
    "response": "Response",
    "resolution": "Resolution",
    "statuses": {
      "met": "Met",
      "breached": "Breached",
      "pending": "Pending"
    }
  },
```

`slaStatuses` block (lines 247-251):

```json
  "slaStatuses": {
    "met": "Met",
    "pending": "On track",
    "breached": "Breached",
    "paused": "Paused"
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated, in the same three positions.

**File: `frontend/src/features/reports/locales/en.json`** — `breachRate` block (lines 69-77), add `"paused"` after `"pending"`:

```json
  "breachRate": {
    "title": "SLA breach rate",
    "description": "Share of tickets that missed their response/resolution target in the selected period.",
    "met": "Met",
    "breached": "Breached",
    "pending": "Pending",
    "paused": "Paused",
    "rate": "Breach rate",
    "noData": "No data yet"
  },
```

**File: `frontend/src/features/reports/locales/ar.json`** — the identical key, translated, in the same position.

---

## Documentation Tasks

### 16 — `CONVENTIONS.md`

**File: `CONVENTIONS.md`** — append after §38 (end of file):

> ## 39. SLA clock pause & the second signals exception (SLA-6)
>
> **`apps/tickets/signals.py` (Story 112) is this codebase's SECOND deliberate use of Django model signals, after `apps.integrations.signals` (INT-4, §32).** Read §32 first — its own instruction — before adding a THIRD. The justification is identical: an inbound `Message` (a customer's own reply) is created from five independent channel-adapter call sites, with more likely in the future, and this codebase has already been bitten once by the decentralized-call-site alternative (`EmailAdapter.receive`'s own "F-25" comment, apps/communications/email_adapter.py). A `post_save` receiver on `Message`, watching for `direction=INBOUND`, is what ends a ticket's `pending_customer` wait automatically, no matter which channel the reply arrives on — see Story 112 `## Prerequisites`.
>
> **A ticket's accumulated SLA pause is stored explicitly (`Ticket.sla_paused_minutes`), never recomputed from history, and only `apps/tickets/status.py::apply_status_change` writes it.** The still-OPEN portion of a pause in progress right now is the one exception: it is added live by `apps/sla/policy.py::_effective_paused_minutes`, the same "compute what hasn't finished yet" rule this codebase already applies to `response_status`/`resolution_status` themselves (§23's SLA-1 paragraph). Editing a `WorkingWindow`/`Holiday` (SLA-5) later can still change a LIVE due-date computation, but it can never rewrite an already-closed-out pause — that total is a fact about the past, not a live derivation.
>
> **Not every SLA consumer needs to agree on how precisely a pause is measured.** The single-ticket detail path (`compute_sla_status`) is calendar-aware for pause the same way it already is for due times (§38); the ticket-list and reporting bulk paths (`status_from_facts`, `apps/reports/sla.py`) treat accumulated pause as plain minutes, no calendar lookup — the identical, already-accepted simplification §38 documents for due-time calendar-awareness on those same two paths, now extended to cover pause too.

### 17 — Overview

**File: `.squad/plans/sla-automation/00-overview.md`** — add this story's row to the `## Stories` table and a dependency-notes paragraph summarizing: the new `pending_customer` status and its narrow (manual-entry, dual-exit) transition graph; the second signals exception and why (F-25 precedent, five call sites); pause accumulated explicitly and folded into due dates via SLA-5's own primitive; `is_idle`'s new guard; and RPT-2's new `paused` bucket.

---

## Edge Cases & Failure Modes

- **A ticket paused, resumed, and paused again** accumulates `sla_paused_minutes` across BOTH periods independently — each exit from `pending_customer` adds only that period's own elapsed time; nothing is double-counted or overwritten.
- **An agent manually resumes a ticket a moment before the customer's reply also arrives** (a race between `TicketViewSet.set_status` and the signal): whichever `apply_status_change`/`resume_from_pending_customer` call runs first wins; the second is a no-op, because `resume_from_pending_customer` re-checks `ticket.status == PENDING_CUSTOMER` and `apply_status_change` itself rejects a re-stated/no-op transition. No double pause-close, no error surfaced to either caller.
- **An inbound message arrives for a ticket that is NOT `pending_customer`** (the common case) — the signal's `resume_from_pending_customer` call is a pure no-op; every existing ticket-creation/reply flow is otherwise completely unaffected by this story.
- **A ticket enters `pending_customer` and is never resumed** — `pending_customer_since` stays set indefinitely; `compute_sla_status`'s live pause calculation keeps growing every time it is read, so the due dates keep moving out in lockstep and the ticket is never spuriously marked breached purely due to the open-ended wait. `is_idle` never escalates it either (Task 8's guard). It sits, correctly, until an agent or the customer acts.
- **`sla_paused_minutes` on a ticket whose `SLAPolicy`/calendar changes AFTER the pause already closed out** — the stored minutes value itself never changes (it is a plain accumulated integer, not a recomputed derivation), but the DUE DATE it is added to is still computed fresh on every read against the CURRENT policy/calendar — the same "policy edits retroactively change computed status" trade-off Story 28 already documents and accepts.
- **`status_from_facts`/`sla_breach_rate`'s bulk pause handling ignores the ticket's calendar** even when one is configured — a documented, accepted simplification (see `## Prerequisites`), not a bug: only `GET /tickets/<id>/sla/` (the single-ticket detail path) is fully calendar-aware for pause.
- **`sla_trend`'s pause subtraction is clamped at zero** (`max(elapsed - paused, 0)`) — guards against a degenerate negative value if a ticket's accumulated pause somehow exceeds its raw elapsed time to first response/resolution (should not happen in practice, since pause can only accumulate between creation and now, but the clamp keeps a trend average from going nonsensical rather than trusting the invariant blindly).
- **The `PENDING_CUSTOMER -> IN_PROGRESS` edge is the only way out** — a hand-crafted `POST .../status/` targeting `resolved`/`closed` directly from `pending_customer` is rejected by `is_valid_transition` with the existing "Cannot change status from X to Y" `ValidationError`, the same as any other illegal transition; an agent must resume to `in_progress` first.
- **`TicketChatConsumer`'s async `receive()` still triggers the (synchronous) `post_save` signal correctly** — it creates the `Message` via `database_sync_to_async(LiveChatAdapter().receive)(...)` (`consumers.py:101`), a real synchronous ORM call under the hood; Django signals fire regardless of the calling context being wrapped for async, so the live-chat channel is covered with zero code specific to this story.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing suite must still pass (record the baseline count before starting; confirm the identical count afterward).
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 1's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real HTTP/shell: `POST .../status/` `in_progress -> pending_customer` succeeds and sets `pending_customer_since`; the same ticket rejects `pending_customer -> resolved`/`closed` (400); `pending_customer -> in_progress` succeeds, clears `pending_customer_since`, and increments `sla_paused_minutes` by the correct elapsed amount (working-time-aware for a ticket with a calendar, wall-clock for one without).
5. Automatic resume: create an inbound `Message` (any adapter's `receive()`, or the live-chat socket) for a ticket currently `pending_customer` — status flips to `in_progress` automatically, `TicketActivity` logs a `STATUS_CHANGED` entry with `actor=None`, and `sla_paused_minutes` reflects the elapsed pause.
6. `GET /tickets/<id>/sla/` for a currently-paused ticket shows `paused: true`, `paused_minutes` growing across repeated reads, and both due dates pushed out accordingly; for a ticket with a closed-out pause (already resumed), `paused: false` and both due dates still reflect the accumulated `sla_paused_minutes`.
7. Ticket list `sla_status` for a `pending_customer` ticket reads `"paused"`, not `"pending"`/`"breached"`, regardless of the raw wall-clock due-date math.
8. `evaluate_escalations`/`is_idle` directly: a `pending_customer` ticket with no activity well past any configured idle threshold does NOT escalate; the same ticket, once resumed, becomes eligible again under the normal rule.
9. `GET /api/reports/sla/breach-rate/` — a range including a currently-paused ticket shows it counted under `paused`, excluded from `rate`'s denominator; `?export=csv` includes the new `Paused` column. `GET /api/reports/sla/trend/` — a resolved ticket that was previously paused shows a shorter elapsed-minutes average than its raw wall-clock time would imply.
10. Full bilingual UI walkthrough: `npm run dev` with the backend up — `TicketStatusControl` on a ticket detail page offers "Waiting on customer" from `in_progress`, and only "In progress" once selected; the ticket list and detail both render the new status badge and the SLA card's Paused indicator; the reports page's breach-rate table/CSV show the new column. Switch to Arabic and confirm every new label translates and RTL layout holds.
11. The full gate set, in CI order: from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. Clean up every ticket, message, and report-range artifact created for verification.

---

## Migration / Rollback

**One migration**: `apps/tickets/migrations/0015_<name>.py` — an `AlterField` on `status` (new choice, state-only) plus `AddField` for `pending_customer_since`/`sla_paused_minutes`, depending on `tickets`' `0014_ticket_closed_at`.

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0014_ticket_closed_at` to unapply.

**Half-applied states to avoid:**

- **`apps/tickets/signals.py` written but `apps/tickets/apps.py::ready()` not added (or not importing it)** — the decorator never registers, so inbound replies silently stop auto-resuming `pending_customer` tickets with no error anywhere. Verify via Step 5 of `## Verification Steps`, not by reading the code alone.
- **`apply_status_change`'s pause bookkeeping placed AFTER `ticket.save(...)`** rather than before — would persist `status` without the paired `pending_customer_since`/`sla_paused_minutes` update reaching the same `save()` call (since `update_fields` must list every field a single `save()` writes), silently losing the bookkeeping despite the code appearing to run.
- **`VALID_TRANSITIONS[Ticket.Status.PENDING_CUSTOMER]` including `RESOLVED`/`CLOSED`** — an unrequested, undocumented widening of scope; see `## Prerequisites`.
- **`is_idle`'s new guard placed AFTER the `threshold_minutes is None` check** rather than before — functionally equivalent in most cases, but the docstring's own claim ("applies even when an `idle` rule is enabled") would be wrong if reordered; keep the `pending_customer` check first.
- **`status_from_facts`'s new `status`/`paused_minutes` parameters added but `TicketSerializer.get_sla_status`'s call site not updated** — a `TypeError` on every list request, not a silent bug; `## Verification Steps` Step 1 (`python manage.py test`) and Step 7 both catch this immediately.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces the one file described in task 1; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports the same passing count as before this change.
4. **Manual transition + pause accumulation:** see `## Test Plan` step 4.
5. **Automatic resume on customer reply, across at least two different channels** (e.g. email and live chat): see `## Test Plan` step 5.
6. **Single-ticket SLA detail reflects pause correctly, both live and closed-out:** see `## Test Plan` step 6.
7. **Ticket-list `sla_status` shows `"paused"`:** see `## Test Plan` step 7.
8. **Idle escalation correctly skips a paused ticket:** see `## Test Plan` step 8.
9. **RPT-2 reports show the new `paused` bucket, correctly excluded from the breach rate, in both JSON and CSV:** see `## Test Plan` step 9.
10. **The full bilingual UI walkthrough:** see `## Test Plan` step 10.
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Clean up** every record created during verification.

---

## Done Criteria

- [ ] `Ticket.Status.PENDING_CUSTOMER`; `pending_customer_since`/`sla_paused_minutes` fields; one migration.
- [ ] `VALID_TRANSITIONS` — `in_progress -> pending_customer` (new), `pending_customer -> in_progress` (new, the only exit). **No `pending_customer -> resolved`/`closed`.**
- [ ] `apply_status_change` — pause bookkeeping on entry/exit, working-time-aware via `resolve_calendar`/`elapsed_working_minutes`, folded into the SAME `save()`/`TicketActivity` call every other transition uses.
- [ ] `apps/tickets/signals.py` (NEW) + `apps/tickets/apps.py::ready()` — automatic resume on any inbound `Message`, covering all five/six existing call sites with zero edits to any of them.
- [ ] `apps/tickets/status.py::resume_from_pending_customer` — the guarded helper the signal calls.
- [ ] `compute_sla_status` — pause-extended due dates (calendar-aware); new `paused`/`paused_minutes` response fields.
- [ ] `status_from_facts` — `"paused"` short-circuit for the ticket-list overall status; `TicketSerializer.get_sla_status` passes the two new arguments.
- [ ] `is_idle` — never escalates a `pending_customer` ticket. **`is_at_risk` unchanged.**
- [ ] `apps/reports/sla.py` — `sla_breach_rate` gains a `paused` bucket (excluded from `rate`); `sla_trend` subtracts accumulated pause, clamped at zero; `SlaBreachRateReportView.csv_columns` gains the `Paused` column.
- [ ] Frontend: `TICKET_STATUSES`/`TICKET_STATUS_TRANSITIONS`/`SLA_STATUSES` extended; `ticketStatusVariant`/`slaStatusVariant` map the two new values to `secondary` (no new badge colour); `TicketSla` type gains `paused`/`paused_minutes`; `TicketSlaSection.tsx` renders a Paused badge; `SlaBreachRateRow`/`SlaReportsPage.tsx` gain the paused column. **No code change needed in `TicketListPage.tsx`, `TicketDetailPage.tsx`, `TicketStatusControl.tsx`, or `TicketHistorySection.tsx`.**
- [ ] `en.json`/`ar.json` (tickets and reports) — all new keys, identical sets in both languages.
- [ ] `CONVENTIONS.md` gains `## 39. SLA clock pause & the second signals exception (SLA-6)`.
- [ ] `python manage.py test` reports the same passing count as before; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP/shell: manual transition + pause accumulation (Step 4); automatic multi-channel resume (Step 5); live and closed-out pause reflected in the single-ticket detail (Step 6); ticket-list `"paused"` (Step 7); idle-escalation skip (Step 8); RPT-2's new bucket in both JSON and CSV (Step 9).
- [ ] Both languages walk through cleanly in the browser (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record created during verification is cleaned up (Step 12).
- [ ] `.squad/plans/sla-automation/00-overview.md` updated with this story's row and dependency notes (task 17).

**STOP HERE. Report to the user and wait for confirmation.**
