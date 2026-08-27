# Story 30 — Escalation Rules (Story: SUPPORTOS-62)

## Prerequisites

- **SLA-1 and SLA-0 both completed** — the intake names both (`Dependencies: SLA-1, SLA-0`). `apps/sla/policy.py::compute_sla_status` (Story 28) computes `response_status`/`resolution_status` (`met`/`breached`/`pending`) live on read; `config/celery.py`, `django-celery-beat`, and a working local Redis broker (Story 27) all exist and are verified live, with `apps/sla/tasks.py::auto_assign_ticket` (Story 29) as the project's first real `@shared_task`. This story is the **first to actually use `django-celery-beat`'s own scheduling** (a `PeriodicTask`/`IntervalSchedule` pair) — Stories 27 and 29 only ever fired a task on-demand (`debug_task.delay()`, `auto_assign_ticket.delay(ticket.id)`), never on a recurring schedule.
- **"At-risk/idle" (intake, task 1) is read as two independent triggers, not one blended condition:**
  - **At-risk** — a ticket's response or resolution dimension is still `pending` (not yet met, not yet breached) and its deadline is within a configured threshold. This directly reuses `compute_sla_status` (Story 28): a ticket with no applicable `SLAPolicy` (which returns `None`) can never be "at risk" — the same "opt-in per priority" contract SLA-1 already established.
  - **Idle** — a ticket has had no recent activity (no reply, no logged status/assignment change) for a configured threshold, entirely independent of any SLA policy. A ticket with no `SLAPolicy` at all can still be escalated for being idle.

  These read as genuinely different heuristics with different data sources (one derived from `SLAPolicy` deadlines, the other from the raw timestamp of the most recent `Message`/`TicketActivity`), so they get two independent thresholds rather than one combined rule — the same "documented interpretation of ambiguous backlog wording" discipline Story 29 used for "category/load/round-robin".
- **A new `EscalationRule` model configures the CRITERIA (how many minutes count as "at risk" / "idle"), while WHEN the evaluation job runs is configured separately, through `django-celery-beat`'s own already-existing `PeriodicTask`/`IntervalSchedule` admin** (shipped by the package, registered automatically — nothing new to build for that half). `CONVENTIONS.md` §24 already names this exact split ("vocabulary is code, mapping is data") and already anticipated a scheduled job being added "via `/admin/`, a data migration, or a management command" — this story is the first to actually exercise the data-migration option.
- **The job's own schedule is seeded by a data migration, not left for an admin to configure by hand.** Unlike `SLAPolicy`/`AssignmentRule` (both deliberately opt-in — "no config = no effect" is a correct, safe default for pricing/routing), an escalation *schedule* that silently does nothing until someone remembers to create a `PeriodicTask` would leave a fresh deployment looking broken. `apps/sla/migrations/0004_seed_escalation_schedule.py` seeds one `IntervalSchedule` (every 5 minutes) and one enabled `PeriodicTask` pointing at `apps.sla.tasks.evaluate_escalations`. The `EscalationRule` rows themselves (the criteria) remain fully opt-in, exactly like `SLAPolicy`/`AssignmentRule` — the schedule existing and the criteria being configured are two independent switches, not one.
- **A shared `apply_escalation(ticket, escalated)` helper backs both the existing manual `escalate` action (Story 23) and this story's automatic job** — added to a new `apps/tickets/escalation.py`, mirroring `apps/tickets/assignment.py::apply_assignment`'s exact shape (Story 29): validate in the view, apply-and-return-changed in the shared helper. `TicketViewSet.escalate` is refactored to call it.
- **This job only ever escalates, never de-escalates.** The intake's own outcome for task 1 is "automatic escalation" — there is no "automatic de-escalation" outcome named anywhere. De-escalating a ticket remains exclusively a human decision via the existing `POST /tickets/<id>/escalate/` with `escalated: false`. `evaluate_escalations`'s candidate queryset filters `escalated=False` up front, so an already-escalated ticket is never re-examined or touched by this job at all.
- **No new `TicketActivity` kind, and no new logging of escalation changes.** Story 24 already decided escalation changes are not logged to `TicketActivity` ("the backlog's own task line names only status/assignment/replies"); this story does not revisit that decision just because escalation can now also happen automatically. `apply_escalation` therefore never touches `TicketActivity`, unlike `apply_assignment`.
- **`EscalationRule` and its logic live in `apps.sla`**, matching the intake's own `feature slug: sla-automation` and continuing the placement `SLAPolicy` (Story 28) and `AssignmentRule` (Story 29) already established for this app. `apps/sla/escalation_rules.py` (mirroring `apps/sla/assignment_rules.py`'s naming, avoiding any collision with `apps/tickets/escalation.py`) imports `apps.tickets.models`, `apps.communications.models`, and `apps.sla.policy` — a fourth instance of the same verified-safe reverse cross-app relationship (`apps.tickets`/`apps.communications` import nothing from `apps.sla`, so no cycle).
- **"Idle" is computed from the most recent of `Message`/`TicketActivity`/`Ticket.created_at`, via two cheap `.first()` lookups — not by calling `apps/tickets/history.py::build_history`.** `build_history` (Story 24) fetches up to `HISTORY_MAX_ENTRIES` rows from each of two tables to build a full feed for one ticket's detail page; this job needs only the single latest timestamp, computed for potentially every open ticket on every 5-minute tick, where that cost difference is worth avoiding. This is a deliberate divergence from reusing an existing helper, not an oversight.
- **"Escalation rules UI" (intake, task 2) is Django admin, not a new frontend screen** — the fourth time this exact scope call has been made this session (`Category`, Story 18; `SLAPolicy`, Story 28; `AssignmentRule`, Story 29). `EscalationRuleAdmin` is this story's entire config UI for the criteria; the schedule itself is configurable through `django-celery-beat`'s own bundled `/admin/` UI, needing no new admin code at all.
- **No row-locking, no per-ticket transaction, for the evaluation loop.** A ticket flipping from `pending` to `met`/`breached`, or the escalation criteria changing, in the moment between this job reading it and calling `apply_escalation` is an accepted low-stakes race — the same class of limitation Story 22/29 already accept for concurrent assignment. Worst case, a ticket is escalated one tick later or earlier than a perfectly-consistent read would produce; never an incorrect persisted state.
- **No new permission constant.** Reading/writing `EscalationRule` happens only through Django admin (superuser bypass, same as every other admin-registered model in this project); the task itself runs with no request/user context, same as `auto_assign_ticket`.

---

## Story Goal

1. **Escalation evaluation job**: `EscalationRule` model (`kind`: `at_risk`/`idle`, `threshold_minutes`, `enabled`); `apps/sla/escalation_rules.py::max_enabled_threshold`/`is_at_risk`/`is_idle`; `apps/sla/tasks.py::evaluate_escalations` (a `@shared_task`), scheduled every 5 minutes via a seeded `django-celery-beat` `PeriodicTask`.
2. **Escalation rules UI**: `EscalationRuleAdmin` (Django admin) for configuring the at-risk/idle thresholds.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `EscalationRule` (`kind` + `threshold_minutes` + `enabled`) | "Escalation evaluation job... escalating at-risk/idle tickets" (intake) — see `## Prerequisites` for the two-independent-triggers reading. |
| `is_at_risk` (reuses `compute_sla_status`, Story 28) | At-risk is fundamentally an SLA-deadline question; no new due-time computation is invented. |
| `is_idle` (own cheap last-activity lookup) | Idle is independent of SLA policy; reusing `build_history` here would be needlessly expensive at bulk-scan scale — see `## Prerequisites`. |
| `evaluate_escalations` (`@shared_task`), on a seeded 5-minute schedule | "scheduled job (via SLA-0)" (intake) — the first story to actually schedule, not just fire on demand. |
| `apply_escalation` shared helper | Keeps the manual `escalate` action and the automatic job from drifting on what "escalating" means, mirroring `apply_assignment` (Story 29). |
| `EscalationRuleAdmin` | "Escalation rules UI... config UI" (intake), the fourth `Category`/`SLAPolicy`/`AssignmentRule`-precedented admin-as-config-UI call this session. |

**Not here, and why:**

- **No frontend rules-management screen.** See `## Prerequisites` — Django admin, matching `Category`/`SLAPolicy`/`AssignmentRule`.
- **No automatic de-escalation.** See `## Prerequisites` — this job is one-directional; de-escalating stays a manual action.
- **No new `TicketActivity` kind, no logging of automatic (or manual) escalation to the activity/history feed.** Story 24's own decision, unchanged.
- **No per-priority or per-category scoping on `EscalationRule`.** Unlike `SLAPolicy`/`AssignmentRule`, the intake gives no indication escalation criteria should vary by category — a global pair of thresholds (per kind) is all that is asked for; adding scoping here would be unrequested complexity.
- **No change to `Ticket.escalated`/`escalated_at`'s shape.** Both fields already exist (Story 23); this story only adds a second, automatic caller of the logic that sets them.
- **No frontend change of any kind.** `TicketDetailPage`'s existing escalation badge/button (Story 23) already renders `ticket.escalated`/`escalated_at` regardless of whether a human or the job set them — nothing to build.

---

## Context — Read These Files First

1. `.squad/stories/sla-automation/SUPPORTOS-62/intake.md` — two tasks, no attachments, no acceptance criteria.
2. `SupportOs backlog.MD` lines 476-481 (`EPIC 7`, `STORY (SLA-3) — Escalation Rules`).
3. `backend/apps/sla/models.py` (143 lines, after Story 29) — `SLAPolicy`/`AssignmentRule`'s exact shape; task 1's `EscalationRule` follows the same `TimeStampedModel` + `Meta.ordering` pattern, but with no `UniqueConstraint` (see `## Prerequisites` — multiple same-kind rules are allowed, not scoped).
4. `backend/apps/sla/policy.py` (93 lines, Story 28) — `compute_sla_status`'s return shape (`response_due_at`/`response_status`, `resolution_due_at`/`resolution_status`), which task 2's `is_at_risk` reads directly, unchanged.
5. `backend/apps/sla/assignment_rules.py` (77 lines, Story 29) — the sibling module task 2's `apps/sla/escalation_rules.py` is named and shaped after.
6. `backend/apps/sla/tasks.py` (41 lines, Story 29) — `auto_assign_ticket`'s exact `@shared_task` shape; task 3's `evaluate_escalations` is appended to this same file.
7. `backend/apps/tickets/assignment.py` (63 lines, Story 29) — `apply_assignment`'s exact shape (validate-in-view, apply-and-return-changed-in-helper), which task 4's new `apps/tickets/escalation.py::apply_escalation` mirrors.
8. `backend/apps/tickets/views.py` (289 lines, after Story 29) — `escalate` (lines 226-249, refactored by task 5 to call `apply_escalation`); `assign`'s own already-refactored shape (lines 151-183) as the direct precedent for how `escalate`'s tail should look afterward.
9. `backend/apps/tickets/models.py` — `Ticket.escalated`/`escalated_at` (lines 99-102), `Ticket.Status` choices (lines 34-38), `TicketActivity.Kind` (lines 123-125, unchanged — confirms no `ESCALATED` kind is added).
10. `backend/apps/communications/models.py` — `Message.created_at`, `Message.ticket` — read by task 2's `is_idle`/`_last_activity_at`.
11. `backend/apps/sla/admin.py` (35 lines, after Story 29) — `SLAPolicyAdmin`/`AssignmentRuleAdmin`, the exact "admin doubles as the config UI" shape task 6's `EscalationRuleAdmin` follows a fourth time.
12. `django_celery_beat`'s `IntervalSchedule`/`PeriodicTask` models (installed at `.venv/Lib/site-packages/django_celery_beat/`) — task 7's seed migration creates one row of each via `apps.get_model(...)`, the historical-model pattern any data migration touching another app's tables must use.
13. `CONVENTIONS.md` §23 (feature module conventions — Story 29's paragraph on shared helpers/task-must-not-fail-request, which this story's `apply_escalation` extends as a second instance, needing no restated paragraph) and §24 (background jobs — Story 27's own section, which already names the "data migration" option task 8 exercises for the first time).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Escalation evaluation job, scheduled via SLA-0, escalating at-risk/idle tickets.** | Intake, task 1 | `EscalationRule`; `is_at_risk`/`is_idle`; `evaluate_escalations`, on a seeded 5-minute `PeriodicTask`. |
| **Escalation rules config UI.** | Intake, task 2 | `EscalationRuleAdmin`. |
| **At-risk and idle are independent triggers, each individually opt-in.** | This story's design (see `## Prerequisites`) | `max_enabled_threshold(kind)` returns `None` (short-circuiting that trigger entirely) when no enabled rule of that kind exists. |
| **This job only escalates; it never de-escalates.** | Intake's own outcome wording ("automatic escalation") | `evaluate_escalations`'s candidate queryset filters `escalated=False`; `apply_escalation` is called with `escalated=True` only. |
| **Manual and automatic escalation apply through one shared code path.** | This story's design, mirroring Story 29's `apply_assignment` | `apply_escalation(ticket, escalated)`, called by both `TicketViewSet.escalate` and `evaluate_escalations`. |
| **Escalation changes are still not logged to `TicketActivity`.** | Story 24's own decision, reused unchanged | `apply_escalation` never touches `TicketActivity`. |
| Wire format is `snake_case` end to end. | §12 | N/A — this story adds no new API field or endpoint. |
| No new permission constant, no new dependency. | §17, §22 | Django admin's own superuser bypass; `evaluate_escalations` runs with no request/user context. |

---

## Backend Tasks

### 1 — The `EscalationRule` model

**File: `backend/apps/sla/models.py`** — append after `AssignmentRule`:

```python
class EscalationRule(TimeStampedModel):
    """Automatic escalation criteria — SLA-3. Two independent triggers,
    each opt-in: an `at_risk` rule escalates a ticket whose response or
    resolution deadline (per `apps/sla/policy.py::compute_sla_status`,
    SLA-1) is within `threshold_minutes` and still pending; an `idle` rule
    escalates a ticket with no activity for `threshold_minutes`,
    independent of any SLA policy. Unlike `SLAPolicy`/`AssignmentRule`,
    deliberately not scoped by category — the intake asks for at-risk/idle
    criteria, not per-category variants of them. See Story 30
    `## Prerequisites`.
    """

    class Kind(models.TextChoices):
        AT_RISK = "at_risk", _("At risk of SLA breach")
        IDLE = "idle", _("Idle (no recent activity)")

    kind = models.CharField(_("kind"), max_length=20, choices=Kind.choices)
    threshold_minutes = models.PositiveIntegerField(
        _("threshold (minutes)"),
        help_text=_(
            "For 'at risk': minutes before an SLA deadline that counts as at-risk. "
            "For 'idle': minutes of no activity that counts as idle."
        ),
    )
    # No unique constraint on `kind`: multiple enabled rules of the same
    # kind are allowed (if redundant) rather than blocked — see Story 30
    # `## Prerequisites` for why evaluating "any enabled rule of this kind
    # matches" is equivalent to just using the largest threshold among
    # them, so this never needs a specificity/precedence rule the way
    # `SLAPolicy`/`AssignmentRule`'s category scoping does.
    enabled = models.BooleanField(_("enabled"), default=True)

    class Meta:
        verbose_name = _("escalation rule")
        verbose_name_plural = _("escalation rules")
        ordering = ("kind", "threshold_minutes")

    def __str__(self) -> str:
        return f"{self.get_kind_display()} ({self.threshold_minutes}m)"
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations sla
```

Expect **one** new file, `apps/sla/migrations/0003_escalationrule.py`, containing a `CreateModel` for `EscalationRule`, depending on `apps.sla`'s `0002_assignmentrule`.

---

### 2 — Threshold resolution and at-risk/idle evaluation

**Create file: `backend/apps/sla/escalation_rules.py`**

```python
"""Escalation-rule threshold resolution and at-risk/idle evaluation —
SLA-3.

Lives in `apps.sla`, alongside `apps/sla/policy.py` (Story 28) and
`apps/sla/assignment_rules.py` (Story 29) — the same placement reasoning
and the same verified-safe reverse-direction import into
`apps.tickets.models`/`apps.communications.models` (neither imports back
from `apps.sla`, so no cycle).
"""

from datetime import timedelta

from apps.communications.models import Message
from apps.sla.policy import compute_sla_status
from apps.tickets.models import Ticket, TicketActivity

from .models import EscalationRule


def max_enabled_threshold(kind: str) -> int | None:
    """The largest `threshold_minutes` among enabled rules of this kind,
    or `None` if none are enabled. Evaluating against the single largest
    threshold is equivalent to "any enabled rule of this kind matches": a
    smaller remaining-time-to-deadline (or a longer idle gap) that
    satisfies a smaller threshold always satisfies a larger one too, so
    multiple overlapping rules of the same kind collapse to one check
    with no loss of behaviour. Called once per kind per task run
    (`apps/sla/tasks.py::evaluate_escalations`), not once per ticket.
    """
    return (
        EscalationRule.objects.filter(kind=kind, enabled=True)
        .order_by("-threshold_minutes")
        .values_list("threshold_minutes", flat=True)
        .first()
    )


def _last_activity_at(ticket: Ticket):
    """The most recent of: the ticket's own creation, its latest message,
    its latest logged activity. A cheap, two-query alternative to
    `apps/tickets/history.py::build_history` (Story 24) — that function
    fetches up to `HISTORY_MAX_ENTRIES` rows from each of two tables to
    build a full feed for one ticket's detail page; this needs only the
    single latest timestamp, computed for potentially every open ticket
    on a recurring schedule, where that cost difference is worth avoiding.
    """
    latest_message = (
        Message.objects.filter(ticket=ticket)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    latest_activity = (
        TicketActivity.objects.filter(ticket=ticket)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    return max(ts for ts in (latest_message, latest_activity, ticket.created_at) if ts is not None)


def is_at_risk(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """`True` if the ticket's response or resolution dimension is still
    `pending` (per `compute_sla_status`, Story 28) and due within
    `threshold_minutes`. `False` immediately if `threshold_minutes` is
    `None` (no `at_risk` rule enabled), or no `SLAPolicy` applies to this
    ticket at all — at-risk escalation is opt-in twice over.
    """
    if threshold_minutes is None:
        return False
    sla = compute_sla_status(ticket)
    if sla is None:
        return False
    threshold = timedelta(minutes=threshold_minutes)
    for due_at, dimension_status in (
        (sla["response_due_at"], sla["response_status"]),
        (sla["resolution_due_at"], sla["resolution_status"]),
    ):
        if dimension_status == "pending" and due_at - now <= threshold:
            return True
    return False


def is_idle(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """`True` if `threshold_minutes` is not `None` and the ticket's last
    activity (message or logged activity, whichever is newer) is at least
    that many minutes in the past.
    """
    if threshold_minutes is None:
        return False
    return now - _last_activity_at(ticket) >= timedelta(minutes=threshold_minutes)
```

---

### 3 — The Celery task

**File: `backend/apps/sla/tasks.py`** — extend imports and append a second task:

```python
from django.utils import timezone

from apps.tickets.assignment import apply_assignment
from apps.tickets.escalation import apply_escalation
from apps.tickets.models import Ticket

from .assignment_rules import pick_agent, resolve_rule
from .escalation_rules import is_at_risk, is_idle, max_enabled_threshold
from .models import AssignmentRule, EscalationRule
```

```python
@shared_task
def evaluate_escalations() -> None:
    """Escalates every open (not resolved/closed), not-already-escalated
    ticket that is at-risk of an SLA breach or idle, per any enabled
    `EscalationRule`. Runs on `django-celery-beat`'s own schedule, seeded
    by this app's `0004_seed_escalation_schedule` data migration so the
    job is live the moment this story ships. One-directional: this task
    only escalates, never de-escalates — see Story 30 `## Prerequisites`.
    A run in which nothing is configured, or nothing matches, is a normal
    no-op, not an error.
    """
    at_risk_minutes = max_enabled_threshold(EscalationRule.Kind.AT_RISK)
    idle_minutes = max_enabled_threshold(EscalationRule.Kind.IDLE)
    if at_risk_minutes is None and idle_minutes is None:
        return

    now = timezone.now()
    candidates = Ticket.objects.filter(escalated=False).exclude(
        status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED]
    )
    for ticket in candidates:
        if is_at_risk(ticket, at_risk_minutes, now) or is_idle(ticket, idle_minutes, now):
            apply_escalation(ticket, True)
```

(The existing `auto_assign_ticket` task and its own imports are unchanged; this task is appended after it in the same file.)

---

### 4 — The shared `apply_escalation` helper

**Create file: `backend/apps/tickets/escalation.py`**

```python
"""Escalating a ticket — TKT-4's manual flag, now also SLA-3's automatic
trigger.

Lives in `apps.tickets` — `escalated`/`escalated_at` are `Ticket`'s own
fields, the same placement reasoning `apps/tickets/assignment.py` uses
for `apply_assignment` (Story 29).
"""

from django.utils import timezone


def apply_escalation(ticket, escalated: bool) -> bool:
    """Sets `ticket.escalated`/`escalated_at`, returning `False` (no-op)
    if the ticket already has this exact state. Shared by the manual
    `TicketViewSet.escalate` action (Story 23, a human decision) and
    SLA-3's `evaluate_escalations` task (an automatic one, always called
    with `escalated=True`) — one code path for both, mirroring
    `apply_assignment`'s own shape (Story 29). Unlike `apply_assignment`,
    this never creates a `TicketActivity` row — escalation changes are
    deliberately not logged (Story 24's own decision, unchanged here).
    """
    if escalated == ticket.escalated:
        return False
    ticket.escalated = escalated
    ticket.escalated_at = timezone.now() if escalated else None
    ticket.save(update_fields=["escalated", "escalated_at", "updated_at"])
    return True
```

---

### 5 — Refactor `escalate` to use the shared helper

**File: `backend/apps/tickets/views.py`** — extend the import:

```python
from .escalation import apply_escalation
```

Replace `escalate`'s tail (lines 242-249: the `ticket = self.get_object()` block through the final `return`) with:

```python
        ticket = self.get_object()
        if not apply_escalation(ticket, escalated):
            raise ValidationError({"escalated": [_("Ticket already has this escalation state.")]})
        return Response(self.get_serializer(ticket).data)
```

Update the docstring's second sentence (currently "A manual flag, not SLA-3's future automatic escalation — see Story 23 `## Prerequisites`.") to read:

```
        """Escalate or de-escalate a ticket — TKT-4. A manual action; SLA-3's
        automatic evaluation job (`apps.sla.tasks.evaluate_escalations`)
        shares this action's `apply_escalation` helper but can only ever
        escalate, never de-escalate — see Story 30 `## Prerequisites`.

        `escalated` must be present and a real boolean — an omitted key or a
        truthy-but-not-boolean value (e.g. the string `"true"`) is a 400.
        Re-sending the ticket's current escalation state is also a 400.
        """
```

This is a behaviour-preserving refactor — the endpoint's validation, response shape, and the "no-op is a 400" rule are all unchanged; only the apply-and-save logic moves into the shared helper, the same shape task 5 of Story 29 used for `assign`.

---

### 6 — Admin (the config UI)

**File: `backend/apps/sla/admin.py`** — extend the model import and register `EscalationRule`:

```python
from .models import AssignmentRule, EscalationRule, SLAPolicy
```

```python
@admin.register(EscalationRule)
class EscalationRuleAdmin(admin.ModelAdmin):
    """Also the de facto escalation-rules config UI for now — the fourth
    `Category`/`SLAPolicy`/`AssignmentRule`-precedented admin-as-config-UI
    call this session. See Story 30 `## Prerequisites`. This only
    configures WHAT `evaluate_escalations` looks for — WHEN it runs is
    configured separately, through `django-celery-beat`'s own already
    installed `/admin/` (`PeriodicTask`/`IntervalSchedule`).
    """

    list_display = ("kind", "threshold_minutes", "enabled", "created_at")
    list_filter = ("kind", "enabled")
    readonly_fields = ("created_at", "updated_at")
```

---

### 7 — Seed the evaluation schedule

**Create file: `backend/apps/sla/migrations/0004_seed_escalation_schedule.py`** (hand-written data migration, not `makemigrations`-generated):

```python
from django.db import migrations


def seed_escalation_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = IntervalSchedule.objects.get_or_create(every=5, period="minutes")
    PeriodicTask.objects.get_or_create(
        name="SLA-3: evaluate escalations",
        defaults={
            "task": "apps.sla.tasks.evaluate_escalations",
            "interval": schedule,
            "enabled": True,
        },
    )


def unseed_escalation_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="SLA-3: evaluate escalations").delete()
    # The `every=5, period="minutes"` IntervalSchedule row is deliberately
    # left in place on reverse — this migration only owns the PeriodicTask
    # row it created, and deleting a shared IntervalSchedule could break
    # some other PeriodicTask an admin has since pointed at the same
    # interval.


class Migration(migrations.Migration):
    dependencies = [
        ("sla", "0003_escalationrule"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_escalation_schedule, unseed_escalation_schedule),
    ]
```

`get_or_create` on both rows makes this migration idempotent to rerun (e.g. after a `migrate sla 0003` / `migrate sla 0004` cycle during verification) without producing duplicate `PeriodicTask`/`IntervalSchedule` rows.

---

## Documentation Tasks

### 8 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 24. Background jobs (Celery, SLA-0)` (after the existing Windows `--pool=solo` paragraph):

> **`SLA-3` is the first story to actually use the "data migration" option this section already named for adding a `PeriodicTask` row.** `apps/sla/migrations/0004_seed_escalation_schedule.py` seeds an `IntervalSchedule` (every 5 minutes) and an enabled `PeriodicTask` pointing at `apps.sla.tasks.evaluate_escalations`, so the job is live the moment this story ships — no manual `/admin/` step is required before it can even start looking for at-risk/idle tickets. What it finds (or whether it finds anything at all) stays entirely config-driven through `EscalationRule` (`EscalationRuleAdmin`, §23) — the schedule existing and the criteria being configured are two independent opt-ins, not one.

No new `## 23` paragraph is needed: `apps/tickets/escalation.py::apply_escalation` is a second, unremarkable instance of the "a helper shared by a manual write path and an automatic one lives where the manual path already put it" convention Story 29's own `## 23` paragraph already documents in general terms.

### 9 — Overview

**File: `.squad/plans/sla-automation/00-overview.md`** — add this story's row to the `## Stories` table:

```
| 30 | [30-story-escalation-rules-SUPPORTOS-62.md](30-story-escalation-rules-SUPPORTOS-62.md) | Escalation Rules | SUPPORTOS-62 | Story 28 (`SLA-1`), Story 27 (`SLA-0`) |
```

and a dependency-notes paragraph (after Story 29's) summarizing: the two-independent-triggers reading, the seeded-schedule-via-data-migration design (the first use of that `## 24`-named option), the one-directional (escalate-only) scope boundary, and the shared `apply_escalation` refactor. Close by updating the "Remaining stories" sentence to name only `SLA-4` (Alerts & Notifications) as still open.

**File: `.squad/plans/00-index.md`** — update the `sla-automation` row's story-number range from `27–29` to `27–30`.

---

## Edge Cases & Failure Modes

- **No `EscalationRule` enabled at all** — `evaluate_escalations` returns immediately after both `max_enabled_threshold` calls, touching zero tickets. This is the expected steady state right after this story ships (the schedule is seeded and live; the criteria are not configured yet).
- **Only one kind (`at_risk` or `idle`) has an enabled rule** — the other trigger's threshold is `None`, so `is_at_risk`/`is_idle` short-circuit `False` for it without doing any extra work (`is_at_risk` never calls `compute_sla_status` when `at_risk_minutes` is `None`).
- **A ticket already escalated (`escalated=True`)** — excluded from `evaluate_escalations`'s own candidate queryset up front; never re-examined, never touched, confirming the job is one-directional by construction, not just by convention.
- **A resolved/closed ticket** — excluded up front too; a finished ticket is never a candidate for escalation regardless of how at-risk or idle it looks.
- **A ticket with no applicable `SLAPolicy`** (`compute_sla_status` returns `None`) — can still be escalated via `idle`, which has no dependency on any policy; `is_at_risk` returns `False` for it regardless of threshold.
- **Multiple enabled rules of the same `kind` with different thresholds** — only the largest threshold is effectively used; see `## Prerequisites` for why this is exactly equivalent to "any enabled rule of this kind matches", not a bug.
- **The seed migration re-run after a partial rollback** (`migrate sla 0003` then `migrate sla 0004` again) — `get_or_create` on both the `IntervalSchedule` and the `PeriodicTask` makes this idempotent; no duplicate rows.
- **Reverting this story** (`migrate sla 0002`) — removes the seeded `PeriodicTask` (via the reverse migration) and the `EscalationRule` table; the `every=5 minutes` `IntervalSchedule` row is deliberately left behind (see task 7's own comment).
- **A ticket deleted between `evaluate_escalations` listing candidates and reaching it in the loop** — not otherwise guarded (unlike `auto_assign_ticket`'s `Ticket.DoesNotExist` catch, which only guards a single-ticket lookup by id); accepted as an extremely low-probability race in a project with no bulk ticket deletion anywhere in its current UI, consistent with this story's general no-locking stance (see `## Prerequisites`).
- **The Celery worker or beat process is not running** — the seeded `PeriodicTask` simply accumulates no ticks; nothing escalates until a worker+beat pair is running, exactly like `auto_assign_ticket` accumulating no assignments while the worker is down (Story 29).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once tasks 1 and 7's migrations are generated/added.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real, live verification with a Celery worker and beat actually running (Redis + `celery -A config worker --pool=solo` + `celery -A config beat`, per Story 27/Windows): the seeded `PeriodicTask` exists and is enabled; `evaluate_escalations` (called directly, and via `.delay()`) escalates a backdated at-risk ticket and a backdated idle ticket; an already-escalated, a resolved, and a policy-less-but-not-idle ticket are all left untouched; the manual `escalate` action still works identically after the refactor — `## Verification Steps`.
5. No frontend changes — `npm run lint`/`format:check`/`check:rtl`/`build` are unaffected by this story.

---

## Migration / Rollback

**Two migrations**, both in `apps.sla`: task 1's `0003_escalationrule.py` (schema, `makemigrations`-generated) and task 7's `0004_seed_escalation_schedule.py` (hand-written data migration seeding `django_celery_beat`'s `IntervalSchedule`/`PeriodicTask`). `0004` depends on both `0003` and `django_celery_beat`'s own latest migration (`0019_alter_periodictasks_options`).

**Rollback of the code:** revert the commits, then `python manage.py migrate sla 0002` to unapply both (the reverse of `0004` deletes the seeded `PeriodicTask`; the reverse of `0003` drops the `EscalationRule` table), if reverting only this story's migrations.

**Half-applied states to avoid:**

- **`0004` applied before `0003`, or with the wrong `django_celery_beat` dependency** — would either fail outright (table doesn't exist yet) or silently target the wrong migration graph state; the `dependencies` list must name both explicitly, the same care Story 29's own migration took with `apps.tickets`/`accounts`.
- **`evaluate_escalations` missing the `escalated=False` exclusion** — would let the job re-touch already-escalated tickets every tick (harmless given `apply_escalation`'s own no-op-if-unchanged guard, but wasteful and muddies the "one-directional" guarantee this story is designed around).
- **`is_at_risk` computed without the `dimension_status == "pending"` guard** — would flag an already-`breached` (long overdue) ticket as merely "at risk" forever, since `due_at - now` stays negative and thus `<= threshold` for any positive threshold; the guard is what keeps "at risk" meaning "approaching, not yet breached."
- **The seed migration's `PeriodicTask.task` string not matching `apps.sla.tasks.evaluate_escalations` exactly** — `django-celery-beat` resolves the task by this dotted path string at run time; a typo here would leave beat "firing" a task that Celery cannot find, failing silently from the scheduler's point of view (visible only in the worker's own log as an unregistered-task error).

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations generated/added and applied cleanly:** `python manage.py makemigrations sla` produces `0003_escalationrule.py`; add `0004_seed_escalation_schedule.py` by hand; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The schedule is seeded and live.** `python manage.py shell`: `from django_celery_beat.models import PeriodicTask; t = PeriodicTask.objects.get(name="SLA-3: evaluate escalations"); (t.task, t.enabled, t.interval.every, t.interval.period)` → `("apps.sla.tasks.evaluate_escalations", True, 5, "minutes")`.
5. **Start Redis and a Celery worker** (`redis-cli ping` → `PONG`; `celery -A config worker -l info --pool=solo`) for every step below that fires the task.
6. **At-risk escalation fires.** Create an `SLAPolicy` (e.g. `response_target_minutes=30`), a matching ticket, and back-date it via shell (`Ticket.objects.filter(pk=t.id).update(created_at=timezone.now() - timedelta(minutes=25))`) so it is 5 minutes from its response deadline. Create an enabled `EscalationRule(kind="at_risk", threshold_minutes=10)`. Call `evaluate_escalations()` directly in shell (a `@shared_task` function remains directly callable, executing synchronously, in-process) → the ticket's `escalated` is now `True`, `escalated_at` set (check via `GET /api/tickets/<id>/`).
7. **Idle escalation fires, independent of any SLA policy.** Create a second ticket with **no** category/policy match, back-date it (`created_at` 2 hours ago) with no messages/activity on it. Create an enabled `EscalationRule(kind="idle", threshold_minutes=60)`. Call `evaluate_escalations()` again → this ticket is also now `escalated=True`.
8. **Already-escalated, resolved, and not-yet-at-risk/idle tickets are left untouched.** Re-run `evaluate_escalations()` → the two tickets from steps 6-7 are unchanged (already `escalated=True`, excluded up front). Create a third ticket, resolved, backdated the same way as step 6 → still `escalated=False` after another run (excluded by status). Create a fourth ticket matching the same policy as step 6 but created just now (not near its deadline) → still `escalated=False`.
9. **Disabling the only enabled rule of a kind stops that trigger.** Set the `at_risk` rule's `enabled=False` via `/admin/`. Create a fifth ticket identical to step 6's setup → `evaluate_escalations()` leaves it `escalated=False` (no enabled `at_risk` rule to match against).
10. **The task also works fired asynchronously.** With no enabled rules at all (temporarily disable both from steps 6/7, or delete them), call `evaluate_escalations.delay()` via shell with the worker running → confirm (via the worker's own log output) it ran and returned with no tickets touched, exactly mirroring the direct-call behavior in step 8's "nothing configured" case.
11. **The manual `escalate` action still works identically after the refactor.** `POST /api/tickets/<id>/escalate/ {"escalated": true}` on an unescalated ticket → `200`, `escalated`/`escalated_at` set. Re-`POST` the same value → `400` ("Ticket already has this escalation state."), the same response `assign`'s own no-op case gives after its Story 29 refactor.
12. **Clean up** every `EscalationRule`, `SLAPolicy` row added for this story's verification, all created tickets, and the seeded `PeriodicTask`/`IntervalSchedule` are left in place (they are the story's actual shipped state, not verification scaffolding — do not delete them during cleanup).

---

## Done Criteria

- [ ] `EscalationRule` — `kind` (`at_risk`/`idle`), `threshold_minutes`, `enabled`. No category scoping, no `UniqueConstraint`.
- [ ] Two migrations: `apps/sla/migrations/0003_escalationrule.py` (schema) and `0004_seed_escalation_schedule.py` (seeds one `IntervalSchedule` + one enabled `PeriodicTask`, both idempotent via `get_or_create`). **No `Ticket` model change, no new permission-grant migration.**
- [ ] `apps/sla/escalation_rules.py::max_enabled_threshold`/`is_at_risk`/`is_idle` — at-risk reuses `compute_sla_status` (Story 28); idle uses its own two-query last-activity lookup, not `build_history`.
- [ ] `apps/sla/tasks.py::evaluate_escalations` — the project's first scheduled (not merely on-demand) `@shared_task`; short-circuits to a no-op when nothing is configured; excludes already-escalated and resolved/closed tickets up front.
- [ ] `apps/tickets/escalation.py::apply_escalation` — shared by `escalate` (refactored) and `evaluate_escalations` (always `escalated=True`); never touches `TicketActivity`.
- [ ] `TicketViewSet.escalate` — refactored to call `apply_escalation`, behavior-preserving.
- [ ] `EscalationRuleAdmin` registered — this story's config UI for the criteria; the schedule itself is configurable via `django-celery-beat`'s own existing `/admin/`.
- [ ] **No new API endpoint, no new permission constant, no frontend change, no new `TicketActivity` kind.**
- [ ] `CONVENTIONS.md` §24 gains the seeded-schedule-via-data-migration paragraph; no new §23 paragraph needed.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified live: the seeded `PeriodicTask` exists/enabled (Step 4); at-risk escalation fires on a backdated, policy-matched ticket (Step 6); idle escalation fires independent of any policy (Step 7); already-escalated/resolved/not-yet-due tickets stay untouched across re-runs (Step 8); disabling the only enabled rule of a kind stops that trigger (Step 9); the task also runs correctly via `.delay()` (Step 10); the manual `escalate` action is unchanged post-refactor (Step 11).
- [ ] Every `EscalationRule`/`SLAPolicy`/ticket created for verification is cleaned up; the seeded `PeriodicTask`/`IntervalSchedule` are deliberately left in place (Step 12).
- [ ] `.squad/plans/sla-automation/00-overview.md` and `.squad/plans/00-index.md` updated (task 9).

**STOP HERE. Report to the user and wait for confirmation.** The one remaining `sla-automation` story is **SLA-4 (Alerts & Notifications, depends only on `SLA-0`, complete — the direct unblock for `agent-workspace`'s `AGENT-3`, now immediately plannable)**.
