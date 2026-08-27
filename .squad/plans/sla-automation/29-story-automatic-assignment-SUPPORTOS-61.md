# Story 29 — Automatic Assignment (Story: SUPPORTOS-61)

## Prerequisites

- **TKT-3 (Assignment) and SLA-0 (Background Jobs Foundation) both completed** — the intake names both (`Dependencies: TKT-3, SLA-0`). `Ticket.assigned_agent`, `apps/tickets/assignment.py::assignable_agents()`, and `TicketViewSet.assign` (Story 22) all exist; `config/celery.py`, `django-celery-beat`, and a working local Redis broker (Story 27) all exist and were verified live. This is the **first story to add a real `@shared_task`** beyond `config.celery.debug_task` — exactly the shape Story 27's own docstring anticipated (*"a future story adds `apps/sla/tasks.py` with `@shared_task` and needs no further wiring"*).
- **"Rules (category/load/round-robin)" (intake, task 1) is read as: `category` is a SCOPING dimension, `load`/`round-robin` are the two SELECTION strategies within that scope** — not three independent, competing mechanisms. A real routing system typically works this way (route to a pool by category, then pick *within* the pool by load or rotation), and it lets `AssignmentRule` reuse `SLAPolicy`'s own two-tier specificity design (Story 28) verbatim: a category-specific rule overrides the category-agnostic default (`category=None`). This is a documented interpretation of ambiguous backlog wording, not an invented requirement.
- **Auto-assignment runs asynchronously, via a Celery task fired from `TicketViewSet.perform_create`** — not synchronously in the create request. This is why `SLA-0` is a listed dependency at all: a synchronous rules engine would need no background-job foundation. Firing `.delay()` and returning immediately means ticket creation is never slowed or failed by the assignment engine, and an unreachable broker degrades to "the ticket is created, unassigned" rather than a 500.
- **`.delay()`'s own broker-connection failure is caught and logged, never allowed to fail the create request** — the exact resilience pattern `MessageViewSet.perform_create` already established for `adapter.send()` (Story 14, `apps/communications/views.py` lines 63-80: `try: adapter.send(instance) except Exception: logger.exception(...)`, with the comment *"the record is already committed... regardless of delivery outcome"*). This story's `perform_create` follows the identical shape, one line different (`auto_assign_ticket.delay(ticket.id)` instead of `adapter.send(instance)`).
- **No transaction-timing race exists between `serializer.save()` committing the ticket and the worker reading it.** Verified: this project sets no `ATOMIC_REQUESTS` anywhere in `config/settings/`, so Django's per-view default (autocommit, no implicit per-request transaction) applies — `serializer.save()` commits the `Ticket` row immediately, and `.delay()` (called right after, in the same synchronous function) only enqueues the task afterward. A worker picking up the task moments later, on its own DB connection, always sees a durably committed row.
- **A shared `apply_assignment(ticket, agent, actor)` helper backs BOTH the manual `assign` action (Story 22) and this story's automatic task** — added to the existing `apps/tickets/assignment.py` (which already houses `assignable_agents()`), not duplicated. `TicketViewSet.assign` is refactored to call it (`actor=request.user`); `auto_assign_ticket` calls it too (`actor=None`, a system action — `TicketActivity.actor` is already nullable, `SET_NULL`, precisely for this kind of case). One code path means the two can never drift on activity-logging behaviour, extending the exact "one shared queryset backs two callers" discipline Story 22 already established for `assignable_agents()` itself.
- **An auto-assignment can only ever land on someone who holds `tickets.manage`** — `apps/sla/assignment_rules.py::pick_agent` always intersects an `AssignmentRule`'s configured candidate pool (or, if none is configured, the global default) with `apps.tickets.assignment.assignable_agents()`, the exact same guarantee the manual `assign` action already enforces (Story 22). A rule's `agents` M2M can go stale (a member loses `tickets.manage`) without ever producing an invalid assignment.
- **`AssignmentRule` and its logic live in `apps.sla`**, matching the intake's own `feature slug: sla-automation` and the backlog's own `EPIC 7 — SLA & Automation` grouping — the same placement `SLAPolicy` (Story 28) already established for this app. `apps/sla/assignment_rules.py` (deliberately not named `assignment.py`, to avoid colliding with `apps/tickets/assignment.py`) imports `apps.tickets.models`/`apps.tickets.assignment`, a **third** instance this session of the same reverse cross-app relationship `apps/sla/policy.py` (Story 28) already established — verified safe the same way: `apps.tickets.models`/`assignment.py` import nothing from `apps.sla`.
- **"Assignment rules UI" (intake, task 2) is Django admin, not a new frontend screen** — the third time this exact scope call has been made this session (`Category`, Story 18; `SLAPolicy`, Story 28). `AssignmentRuleAdmin` is this story's entire config UI.
- **Round-robin state (`last_assigned_agent`) and concurrent auto-assignment races are an accepted limitation, not solved with row locking.** Two tickets created in the same instant could both read the same `last_assigned_agent` before either writes it back, producing two consecutive assignments to the same agent instead of a perfect rotation. This is the same class of limitation Story 22's own `## Edge Cases` already accepts for concurrent manual assignment ("last write wins, no optimistic locking anywhere in this project") — not introduced fresh here, and low-stakes for a rotation whose only consequence is a slightly uneven queue, never an incorrect state.
- **No new permission constant.** Reading/writing `AssignmentRule` happens only through Django admin (superuser bypass, the same as every other admin-registered model in this project); the task itself runs with no request/user context at all.

---

## Story Goal

1. **Assignment rules engine**: `AssignmentRule` model (optional category scope, `load`/`round_robin` strategy, optional candidate-agent pool, a round-robin cursor); `apps/sla/assignment_rules.py::resolve_rule`/`pick_agent`; `apps/sla/tasks.py::auto_assign_ticket` (a `@shared_task`), fired from `TicketViewSet.perform_create` on every new ticket.
2. **Assignment rules UI**: `AssignmentRuleAdmin` (Django admin) for configuring rules.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `AssignmentRule` (category scope + `load`/`round_robin` strategy + agent pool) | "rules (category/load/round-robin)" (intake) — see `## Prerequisites` for the category-as-scope reading. |
| `resolve_rule`/`pick_agent`, mirroring `SLAPolicy`'s two-tier lookup | Reuses Story 28's already-established specificity pattern rather than inventing a new one. |
| `auto_assign_ticket` (`@shared_task`), fired from `perform_create` | "applied on ticket creation" (intake) — the first real Celery consumer, per `SLA-0`'s own dependency listing. |
| `apply_assignment` shared helper | Keeps the manual (`assign`) and automatic paths from drifting on `TicketActivity` logging. |
| `AssignmentRuleAdmin` | "Assignment rules UI... config UI" (intake), the third `Category`/`SLAPolicy`-precedented admin-as-config-UI call this session. |

**Not here, and why:**

- **No frontend rules-management screen.** See `## Prerequisites` — Django admin, matching `Category`/`SLAPolicy`.
- **No retry policy on `auto_assign_ticket`.** A transient failure (e.g. a momentary DB hiccup on the worker's own connection) leaves the ticket unassigned, recoverable via the existing manual `assign` action — not a scope this story's "auto-routing" outcome requires solving with Celery retry/backoff semantics.
- **No row-level locking for round-robin/load-balancing races.** See `## Prerequisites` — the same accepted limitation Story 22 already documents for concurrent manual assignment.
- **No change to `assignable_agents()`'s own contract or the `/assignable-agents/` endpoint.** Both are reused exactly as Story 22 built them.
- **No visibility into WHY a ticket got auto-assigned (e.g. "matched rule X") anywhere in the UI beyond the existing `TicketActivity`/history feed**, which already shows every assignment change (Story 24) — this story does not add a dedicated "auto-assignment log" beyond that.
- **No auto-assignment retroactively applied to existing, already-created tickets.** The task only fires from `perform_create`; nothing sweeps existing unassigned tickets.

---

## Context — Read These Files First

1. `.squad/stories/sla-automation/SUPPORTOS-61/intake.md` — two tasks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 469-474 (`EPIC 7`, `STORY (SLA-2) — Automatic Assignment`).
3. `backend/apps/sla/models.py` (76 lines, after Story 28) — `SLAPolicy`'s exact shape (nullable `category`, `CASCADE`, `UniqueConstraint`, `Meta.ordering`) task 1's `AssignmentRule` copies for its own category scoping.
4. `backend/apps/sla/policy.py` (93 lines, Story 28) — `resolve_policy`'s two-tier lookup, the exact shape task 2's `resolve_rule` copies (specific-category match, then `category__isnull=True` default).
5. `backend/apps/tickets/assignment.py` (39 lines, Story 22) — `assignable_agents()`, which task 2's `pick_agent` reuses directly (never a hand-rolled permission check); task 4 adds `apply_assignment` to this same file.
6. `backend/apps/tickets/views.py` (283 lines, after Story 28) — `assign` (lines 134-176, refactored by task 5 to call `apply_assignment`), `TicketViewSet`'s current lack of any `perform_create` override (uses `CreateModelMixin`'s bare default) — task 6 adds one.
7. `backend/apps/communications/views.py` lines 1-2, 29, 63-80 (Story 14) — `logger = logging.getLogger(__name__)` and `MessageViewSet.perform_create`'s exact `try/except Exception: logger.exception(...)` shape task 6's own `perform_create` copies verbatim, one call site different.
8. `backend/config/celery.py` (Story 27) — `app.autodiscover_tasks()`'s own docstring naming `apps/<app>/tasks.py` as where a future task belongs; task 3's `apps/sla/tasks.py` is that file, needing no further Celery wiring.
9. `backend/apps/tickets/models.py` — `TicketActivity.Kind.ASSIGNED`, `Category` — reused by task 1/2/4, not re-declared.
10. `backend/apps/tickets/admin.py` (`CategoryAdmin`, Story 18) and `backend/apps/sla/admin.py` (`SLAPolicyAdmin`, Story 28) — the exact "admin doubles as the config UI" shape task 7's `AssignmentRuleAdmin` follows a third time.
11. `CONVENTIONS.md` §23 (feature module conventions — Story 28's paragraph, most recent; this story's own paragraph appends after it), §24 (background jobs — Story 27's own `apps/<app>/tasks.py` convention, which this story is the first to actually use).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Assignment rules engine (category/load/round-robin), applied on ticket creation.** | Intake, task 1 | `AssignmentRule`; `resolve_rule`/`pick_agent`; `auto_assign_ticket`, fired from `perform_create`. |
| **Assignment rules config UI.** | Intake, task 2 | `AssignmentRuleAdmin`. |
| **A category-specific rule takes precedence; otherwise the category-agnostic default applies.** | This story's design, reusing Story 28's pattern | `resolve_rule`'s two-step lookup. |
| **An auto-assignment never lands on someone without `tickets.manage`.** | Story 22's own rule, reused unchanged | `pick_agent` always intersects with `assignable_agents()`. |
| **A background task fired from a create request must not fail that request.** | Story 14's own established pattern, reused | `perform_create`'s `try/except Exception: logger.exception(...)` around `.delay()`. |
| **Manual and automatic assignment log identically, through one shared code path.** | This story's design | `apply_assignment(ticket, agent, actor)`, `actor=None` for the automatic path. |
| Wire format is `snake_case` end to end. | §12 | N/A — this story adds no new API field or endpoint. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `assignable_agents()`; Django admin's own superuser bypass. |

---

## Backend Tasks

### 1 — The `AssignmentRule` model

**File: `backend/apps/sla/models.py`** — append after `SLAPolicy`:

```python
class AssignmentRule(TimeStampedModel):
    """Automatic ticket routing — SLA-2. `category=None` is the
    category-agnostic default rule; a rule with a real `category` applies
    only to tickets of that category and takes precedence when present —
    the same two-tier specificity `SLAPolicy` already uses (Story 28). See
    Story 29 `## Prerequisites` for why "category" is a scoping dimension
    here, not a third strategy alongside `load`/`round_robin`.
    """

    class Strategy(models.TextChoices):
        LOAD = "load", _("Least loaded agent")
        ROUND_ROBIN = "round_robin", _("Round robin")

    # CASCADE, not SET_NULL: a category-specific rule has no meaning once
    # its category is gone — the same reasoning `SLAPolicy.category`
    # already uses (Story 28).
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="assignment_rules",
        verbose_name=_("category"),
    )
    strategy = models.CharField(_("strategy"), max_length=20, choices=Strategy.choices)
    # Empty means "any agent who holds tickets.manage" — `pick_agent`
    # always intersects this with `assignable_agents()` regardless, so a
    # stale member (one who lost `tickets.manage` after being added here)
    # can never actually receive an assignment. See Story 29
    # `## Prerequisites`.
    agents = models.ManyToManyField(
        "accounts.User",
        blank=True,
        related_name="assignment_rules",
        verbose_name=_("candidate agents"),
    )
    # The round-robin cursor: who this rule assigned last, so the next
    # pick continues the rotation. Unused by the `load` strategy. SET_NULL
    # so removing that user does not block their own deletion.
    last_assigned_agent = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="last_assigned_rules",
        verbose_name=_("last assigned agent"),
    )
    # Lets an admin pause an active rule without losing its configured
    # pool or round-robin cursor — unlike `SLAPolicy` (a passive, read-only
    # lookup), this rule fires on every ticket creation, so a temporary
    # on/off switch is worth the one extra field.
    enabled = models.BooleanField(_("enabled"), default=True)

    class Meta:
        verbose_name = _("assignment rule")
        verbose_name_plural = _("assignment rules")
        constraints = [
            models.UniqueConstraint(fields=["category"], name="unique_assignment_rule_category")
        ]
        ordering = ("category__name",)

    def __str__(self) -> str:
        scope = self.category.name if self.category else str(_("all categories"))
        return f"{self.get_strategy_display()} / {scope}"
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations sla
```

Expect **one** new file, `apps/sla/migrations/0002_assignmentrule.py`, containing a `CreateModel` for `AssignmentRule` plus its M2M-through-table, depending on `apps.sla`'s `0001_initial` and the latest `apps.tickets`/`accounts` migrations.

---

### 2 — Rule resolution and agent selection

**Create file: `backend/apps/sla/assignment_rules.py`**

```python
"""Assignment-rule resolution and candidate selection — SLA-2.

Lives in `apps.sla`, alongside `apps/sla/policy.py` (Story 28) — the same
placement reasoning, and the same verified-safe reverse-direction import
into `apps.tickets.models`/`assignment.py` (neither imports back from
`apps.sla`, so no cycle). Named `assignment_rules.py`, not `assignment.py`,
to avoid colliding with `apps/tickets/assignment.py`.
"""

from apps.tickets.assignment import assignable_agents
from apps.tickets.models import Category, Ticket

from .models import AssignmentRule


def resolve_rule(ticket: Ticket) -> AssignmentRule | None:
    """The most specific enabled rule for this ticket: an exact category
    match if the ticket has a category and an enabled rule exists for it,
    else the category-agnostic default (category=None). `None` if neither
    exists — auto-assignment is opt-in per category, not guaranteed.
    """
    if ticket.category_id is not None:
        specific = AssignmentRule.objects.filter(
            category_id=ticket.category_id, enabled=True
        ).first()
        if specific is not None:
            return specific
    return AssignmentRule.objects.filter(category__isnull=True, enabled=True).first()


def _pick_round_robin(candidates: list, last_assigned) -> object:
    """The next agent after `last_assigned` in a deterministic (id-order)
    rotation, wrapping around. Restarts from the top if `last_assigned` is
    `None` or has fallen out of the candidate pool (removed from the
    rule's `agents`, or no longer `assignable_agents()`).
    """
    ordered = sorted(candidates, key=lambda user: user.id)
    if last_assigned is None:
        return ordered[0]
    ids = [user.id for user in ordered]
    try:
        index = ids.index(last_assigned.id)
    except ValueError:
        return ordered[0]
    return ordered[(index + 1) % len(ordered)]


def _pick_least_loaded(candidates: list) -> object:
    """The candidate with the fewest currently-open (not resolved/closed)
    assigned tickets. Ties break on user id, so the result is
    deterministic rather than dependent on query/iteration order.
    """
    open_counts = {
        user.id: Ticket.objects.filter(assigned_agent=user)
        .exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])
        .count()
        for user in candidates
    }
    return min(candidates, key=lambda user: (open_counts[user.id], user.id))


def pick_agent(rule: AssignmentRule):
    """The agent this rule would assign to right now, or `None` if its
    (possibly empty, after intersecting with `assignable_agents()`)
    candidate pool has nobody in it. Never returns someone without
    `tickets.manage` — see Story 29 `## Prerequisites`.
    """
    candidates_qs = assignable_agents()
    configured_ids = list(rule.agents.values_list("id", flat=True))
    if configured_ids:
        candidates_qs = candidates_qs.filter(id__in=configured_ids)
    candidates = list(candidates_qs)
    if not candidates:
        return None
    if rule.strategy == AssignmentRule.Strategy.ROUND_ROBIN:
        return _pick_round_robin(candidates, rule.last_assigned_agent)
    return _pick_least_loaded(candidates)
```

(`Category` is imported for the type hint context only if needed — omit the import if unused after implementation; `Ticket`/`assignable_agents`/`AssignmentRule` are the ones actually referenced.)

---

### 3 — The Celery task

**Create file: `backend/apps/sla/tasks.py`**

```python
"""Background tasks — SLA-2. The project's first real `@shared_task`
beyond `config.celery.debug_task` (Story 27) — no further Celery wiring
is needed; `app.autodiscover_tasks()` (`config/celery.py`) finds this
module because it is named `tasks.py` inside an installed app.
"""

from celery import shared_task

from apps.tickets.assignment import apply_assignment
from apps.tickets.models import Ticket

from .assignment_rules import pick_agent, resolve_rule
from .models import AssignmentRule


@shared_task
def auto_assign_ticket(ticket_id: int) -> None:
    """Applies the matching `AssignmentRule` to a newly created ticket, if
    one exists and its candidate pool is non-empty. A no-op (not an
    error) in every case where nothing should happen: the ticket was
    deleted before this ran, no rule matches, or no eligible agent exists.
    Fired from `TicketViewSet.perform_create`. See Story 29
    `## Prerequisites`.
    """
    try:
        ticket = Ticket.objects.select_related("category", "assigned_agent").get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    rule = resolve_rule(ticket)
    if rule is None:
        return

    agent = pick_agent(rule)
    if agent is None:
        return

    changed = apply_assignment(ticket, agent, actor=None)
    if changed and rule.strategy == AssignmentRule.Strategy.ROUND_ROBIN:
        rule.last_assigned_agent = agent
        rule.save(update_fields=["last_assigned_agent", "updated_at"])
```

---

### 4 — The shared `apply_assignment` helper

**File: `backend/apps/tickets/assignment.py`** — add the `TicketActivity` import and a new function, after `assignable_agents`:

```python
from .models import TicketActivity
```

```python
def apply_assignment(ticket, agent, actor) -> bool:
    """Assigns `ticket` to `agent` (or unassigns via `agent=None`),
    logging a `TicketActivity` only when the assignee actually changes.
    Shared by `TicketViewSet.assign` (Story 22, a human `actor`) and
    SLA-2's `auto_assign_ticket` task (`actor=None`, a system action) —
    one code path, so both can never drift on logging behaviour. Returns
    `True` if a change was made.
    """
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
    return True
```

(The `from .models import TicketActivity` line goes at the top of the file, alongside the existing `django.contrib.auth`/`django.db.models` imports — same-app import, no cycle concern.)

---

### 5 — Refactor `assign` to use the shared helper

**File: `backend/apps/tickets/views.py`** — replace `assign`'s tail (the `ticket = self.get_object()` block through the `TicketActivity.objects.create(...)` call, lines 164-175) with:

```python
        ticket = self.get_object()
        apply_assignment(ticket, agent, actor=request.user)
        return Response(self.get_serializer(ticket).data)
```

Update the import (`.assignment` gains `apply_assignment`):

```python
from .assignment import apply_assignment, assignable_agents
```

This is a behaviour-preserving refactor — `assign`'s external contract (validation, response shape, the "log only if changed" rule) is unchanged; only the assign-and-log logic itself moves into the shared helper.

---

### 6 — Fire auto-assignment on ticket creation

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
import logging
```

```python
from apps.sla.tasks import auto_assign_ticket
```

Add the module-level logger (mirroring `apps/communications/views.py` line 29):

```python
logger = logging.getLogger(__name__)
```

Add a `perform_create` override to `TicketViewSet`, after `search_fields` and before `get_queryset`:

```python
    def perform_create(self, serializer):
        ticket = serializer.save()
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # The Ticket row is already committed — creation must succeed
            # regardless of whether the auto-assignment task could even be
            # queued (e.g. Redis unreachable). Same resilience pattern
            # `MessageViewSet.perform_create` already uses for
            # `adapter.send()` (Story 14). See Story 29 `## Prerequisites`.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)
```

---

### 7 — Admin (the config UI)

**File: `backend/apps/sla/admin.py`** — extend the model import and register `AssignmentRule`:

```python
from .models import AssignmentRule, SLAPolicy
```

```python
@admin.register(AssignmentRule)
class AssignmentRuleAdmin(admin.ModelAdmin):
    """Also the de facto assignment-rules config UI for now — the third
    `Category`/`SLAPolicy`-precedented admin-as-config-UI call this
    session. See Story 29 `## Prerequisites`.
    """

    list_display = ("category", "strategy", "enabled", "last_assigned_agent", "created_at")
    list_filter = ("strategy", "enabled", "category")
    filter_horizontal = ("agents",)
    readonly_fields = ("created_at", "updated_at", "last_assigned_agent")
```

`last_assigned_agent` is read-only in the admin form — it is a cursor the engine itself maintains, not a value an admin sets directly.

---

## Documentation Tasks

### 8 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 28's paragraph):

> **A helper shared by a manual write path and an automatic one lives where the manual path already put it, not duplicated for the automatic caller.** `apps/tickets/assignment.py::apply_assignment` (Story 29, `SLA-2`) is called by both `TicketViewSet.assign` (a human `actor`) and `auto_assign_ticket` (`actor=None`, a system action) — one function decides what "an assignment changed" means and how it gets logged, so a future third caller inherits the same correctness rather than a fresh chance to drift. **A background task fired from inside a request's `perform_create`/`perform_update` must not be allowed to fail that request.** `TicketViewSet.perform_create`'s `try/except Exception: logger.exception(...)` around `auto_assign_ticket.delay(...)` is the same shape `MessageViewSet.perform_create` (Story 14) already established for `adapter.send()` — the record the request is about is already committed, so a failure in triggering the *next* step (an outbound send, a queued task) is logged, never returned as an error to a caller who already got what they asked for. **`apps/<app>/tasks.py` (§24) is where a story's first real `@shared_task` goes, with no additional Celery wiring** — `app.autodiscover_tasks()` (Story 27, `config/celery.py`) already finds it by that filename inside any installed app.

---

### 9 — Overview

**File: `.squad/plans/sla-automation/00-overview.md`** — add this story's row to the `## Stories` table and a dependency-notes paragraph summarizing: the category-as-scope reading, the shared `apply_assignment` refactor, and this being the project's first real Celery task.

---

## Edge Cases & Failure Modes

- **A ticket created in a category with no matching rule, and no category-agnostic default rule configured either, is simply left unassigned** — no error, no `TicketActivity` row, exactly like `SLAPolicy`'s own "no policy" `None` case (Story 28).
- **A rule's candidate pool (its `agents` M2M, intersected with `assignable_agents()`) is empty** — same outcome: the ticket stays unassigned. This can happen if every configured agent has since lost `tickets.manage`, or if `agents` is empty and there are currently zero users holding `tickets.manage` at all.
- **The Celery worker is not running when a ticket is created** — `auto_assign_ticket.delay(...)` still succeeds (the message reaches Redis); the ticket is simply unassigned until a worker eventually starts and drains the queue. Creation itself is unaffected either way.
- **Redis itself is unreachable when a ticket is created** — `.delay()` raises synchronously; `perform_create`'s `try/except` catches and logs it, and ticket creation still returns `201` with an unassigned ticket, exactly as if no rule had matched.
- **The `ticket_id` no longer exists by the time the task runs** (a ticket created and then immediately deleted) — `auto_assign_ticket` catches `Ticket.DoesNotExist` and returns, no error.
- **Concurrent ticket creation can produce an uneven round-robin rotation or an occasional double-pick under `load`** — accepted, documented limitation (see `## Prerequisites`), the same class Story 22 already accepts for concurrent manual assignment.
- **Disabling a rule (`enabled=False`) via `/admin/` takes effect on the very next ticket creation** — `resolve_rule` filters on `enabled=True`, so a disabled rule is invisible to new tickets immediately; it is not deleted, so its `agents` pool and round-robin cursor are preserved for whenever it is re-enabled.
- **Deleting a `Category` that has a category-specific `AssignmentRule` also deletes that rule** (`on_delete=CASCADE`) — tickets that had that category are unaffected in their own right (`Ticket.category` is `SET_NULL`, Story 18).
- **A rule's `last_assigned_agent` pointing at a user later removed from `agents` (or who lost `tickets.manage`) is handled gracefully** — `_pick_round_robin` catches the resulting `ValueError` from `.index(...)` and restarts the rotation from the top, rather than raising.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 1's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real, live verification with the Celery worker actually running (Redis + `celery -A config worker`, `--pool=solo` on Windows, per Story 27): category-specific vs. default rule resolution; `load` picking the least-loaded candidate; `round_robin` rotating correctly across several ticket creations; no rule/empty pool leaving a ticket unassigned; manual `assign` still working identically after the refactor; the create request succeeding even with the worker stopped — `## Verification Steps`.
5. No frontend changes — `npm run lint`/`format:check`/`check:rtl`/`build` are unaffected by this story.

---

## Migration / Rollback

**One migration**, generated by task 1: a `CreateModel` for `AssignmentRule` (plus its `agents` M2M through-table) in `apps.sla`. Depends on `apps.sla.0001_initial`, the latest `apps.tickets` migration (`Category`), and `accounts`'s user migration (for `agents`/`last_assigned_agent`).

**Rollback of the code:** revert the commits, then `python manage.py migrate sla 0001` to unapply, if reverting only this story's migration.

**Half-applied states to avoid:**

- **`perform_create`'s `.delay()` call left unwrapped by `try/except`.** With Redis unreachable, every ticket creation would 500 instead of succeeding unassigned — the single highest-risk regression this story could introduce, since ticket creation is a far more heavily used path than any prior story's new endpoint.
- **`pick_agent` returning a candidate without intersecting `assignable_agents()`.** Would let a stale/deactivated/permission-losing `agents` M2M member receive real assignments — the same class of bug Story 22's own `## Migration / Rollback` flagged for the manual path ("`assign` validating against `User.objects` instead of `assignable_agents()`").
- **`resolve_rule` querying without guarding `category_id is not None`** before the specific-match branch — mirrors the exact trap `SLAPolicy.resolve_policy` already documented (Story 28): passing `category_id=None` into the "specific" query would collapse the two branches together.
- **The round-robin cursor advanced even when `apply_assignment` returned `False`** (no actual change — cannot happen in this flow since a freshly created ticket is always unassigned, but worth keeping the `if changed and ...` guard as written rather than removing it, since a future caller of `pick_agent`/`apply_assignment` outside this exact flow could hit that case).

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations sla` produces one file with a `CreateModel` for `AssignmentRule`; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Start Redis and a Celery worker** (`redis-cli ping` → `PONG`; `celery -A config worker -l info`, `--pool=solo` on Windows) — required for every step below that creates a ticket.
5. **Category-specific rule beats the default.** Create two `AssignmentRule`s (via `/admin/` or shell): a category-agnostic default (`category=None`, `strategy=round_robin`, two agents in the pool) and a category-specific one (`category=<X>`, `strategy=load`, a different two-agent pool). Create a ticket **with** category `<X>` → its `assigned_agent` (check `GET /api/tickets/<id>/`) is chosen from the *specific* rule's pool by least-loaded. Create a second ticket with **no** category → chosen from the *default* rule's pool by round-robin.
6. **Round-robin rotates correctly.** With only the round-robin default rule active (disable/delete the specific one), create three tickets with no category in sequence → their `assigned_agent`s cycle through the pool in order, and `AssignmentRule.last_assigned_agent` (check via shell) reflects the most recent pick after each.
7. **Load picks the least-loaded candidate.** Manually assign several open tickets to one agent in the pool (via the existing `assign` action) so they are no longer the least loaded, then create a new ticket in scope for the `load` rule → it goes to the OTHER candidate.
8. **No matching rule, or an empty candidate pool, leaves the ticket unassigned.** Create a ticket in a category with no rule and no default configured → `assigned_agent` is `null`. Configure a rule whose `agents` pool contains only a user who does NOT hold `tickets.manage` → a ticket in that scope is also left unassigned.
9. **The manual `assign` action still works identically after the refactor.** `POST /api/tickets/<id>/assign/` with a valid agent id → `200`, `TicketActivity` logs with the real `actor`; re-`POST` the same agent id → no new `TicketActivity` row (no-op, same as before Story 22's original behaviour).
10. **An auto-assignment logs a `TicketActivity` with `actor: null`.** `GET /api/tickets/<id>/history/` (Story 24) on an auto-assigned ticket → the `assigned` entry's `actor_name` is `null` (no "by ..." attribution), distinguishing it from a manually-triggered assignment.
11. **Ticket creation succeeds even with the worker stopped.** Stop the Celery worker process, then `POST /api/tickets/` → still `201`, ticket created and left unassigned (no exception surfaced to the caller). Restart the worker; the ticket remains unassigned (the task was never queued while Redis itself was reachable but no worker was consuming — confirm this is the expected "worker was down" case, distinct from step 12).
12. **Ticket creation succeeds even with Redis itself unreachable.** Stop Redis (`Stop-Service Redis` on Windows), then `POST /api/tickets/` → still `201`; check the backend server's own log output for the `logger.exception("Failed to queue auto-assignment...")` line. Restart Redis afterward.
13. **Clean up** every `AssignmentRule`, ticket, and customer created for steps 5-12.

---

## Done Criteria

- [ ] `AssignmentRule` — nullable `category` (`CASCADE`), `strategy` (`load`/`round_robin`), `agents` M2M, `last_assigned_agent` (`SET_NULL`), `enabled`, `UniqueConstraint(category)`.
- [ ] One migration: `apps/sla/migrations/0002_assignmentrule.py`. **No `Ticket` model change, no new permission-grant migration.**
- [ ] `apps/sla/assignment_rules.py::resolve_rule` (specific-then-default lookup, mirroring `SLAPolicy`) and `pick_agent` (`load`/`round_robin`, always intersected with `assignable_agents()`).
- [ ] `apps/sla/tasks.py::auto_assign_ticket` — the project's first real `@shared_task`; handles a deleted ticket, no matching rule, and an empty candidate pool, all as silent no-ops.
- [ ] `apps/tickets/assignment.py::apply_assignment` — shared by `assign` (refactored, `actor=request.user`) and `auto_assign_ticket` (`actor=None`).
- [ ] `TicketViewSet.perform_create` — saves the ticket, then queues `auto_assign_ticket.delay(...)` inside a `try/except Exception: logger.exception(...)`, mirroring `MessageViewSet.perform_create` exactly.
- [ ] `AssignmentRuleAdmin` registered — the story's entire config UI; `last_assigned_agent` read-only.
- [ ] **No new API endpoint, no new permission constant, no frontend change.**
- [ ] `CONVENTIONS.md` §23 gains the shared-helper / task-failure-must-not-fail-the-request / `apps/<app>/tasks.py`-needs-no-wiring paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified live, with Redis and a real worker running: category-specific-over-default resolution (Step 5); round-robin rotation (Step 6); load-based selection (Step 7); unassigned outcomes for no-rule/empty-pool cases (Step 8); the manual `assign` action unchanged post-refactor (Step 9); an auto-assignment's `TicketActivity` carrying `actor: null` (Step 10); ticket creation succeeding with the worker stopped (Step 11) and with Redis itself stopped (Step 12).
- [ ] Every `AssignmentRule`, ticket, and customer created during verification is cleaned up (Step 13).
- [ ] `.squad/plans/sla-automation/00-overview.md` updated with this story's row and dependency notes (task 9).

**STOP HERE. Report to the user and wait for confirmation.** The remaining `sla-automation` stories are **SLA-3 (Escalation Rules, depends on this story's `SLA-1` sibling + `SLA-0`, both complete — now plannable)** and **SLA-4 (Alerts & Notifications, depends only on `SLA-0`, complete — the direct unblock for `agent-workspace`'s `AGENT-3`)**.
