# Story 77 — Automatic Categorization (Story: SUPPORTOS-85)

## Prerequisites

- **Story 74 (`AI-0`, AI Service Foundation) completed.** [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md). Verified live, current code: `apps/ai/client.py::generate_completion`, `apps/ai/exceptions.py::AIServiceError` (both reused unchanged). `TKT-2` (Categories & Priorities, Story 18) is complete — `apps/tickets/models.py::Category`/`Ticket.Priority` are the two fields this story writes to.
- **The intake file (`.squad/stories/ai-features/SUPPORTOS-85/intake.md`) matches its own title — no shift.** Confirmed against `SupportOs backlog.MD` lines 834-838 (`STORY (AI-3) — Automatic Categorization`, `Dependencies: AI-0, TKT-2`):

  > **Task: AI categorization on intake** — Auto-tag category/priority (agent-overridable) via AI-0. Outcome: less manual triage.

- **This story targets exactly one ticket-creation path: `PortalTicketViewSet.perform_create`** (`apps/portal/views.py:66-89`) — the customer-submitted ticket flow. This is a deliberate, evidenced scope decision, not an oversight:
  - **Staff-created tickets are excluded.** `TicketViewSet.perform_create` (`apps/tickets/views.py`) creates a ticket from a form where the agent has **already** chosen `category`/`priority` explicitly — both are writable, non-defaulted fields on `TicketSerializer` (`apps/tickets/serializers.py`, no `read_only_fields` entry for either). Auto-tagging moments after creation would silently **overwrite** the agent's own deliberate choice — a regression, not "less manual triage."
  - **Portal-submitted tickets are the evidenced target.** `PortalTicketSerializer`'s own docstring (`apps/portal/serializers.py` lines 24-29) already states the exact gap this story closes: *"`category` and `priority` are read-only too... A portal-submitted ticket lands uncategorized at the default priority; **staff triage assigns both later**."* That sentence, written when `PORTAL-1`/`PORTAL-2` shipped, is this story's own reason to exist.
  - **Channel-adapter-created tickets (email/WhatsApp/SMS/live chat/web form) are out of scope.** None of `COMM-1`…`COMM-5` are named in this story's dependency list (`AI-0, TKT-2` only — contrast `AI-2`'s intake, which explicitly names `COMM-0`). Wiring five adapter files (`apps/communications/{email,whatsapp,sms,web_form,live_chat}_adapter.py`) — none of which currently import `logging` or queue any Celery task — is a materially larger, differently-scoped change than this story's own dependency list signals. A future story can extend coverage there.
- **Verified live, this session:** `python manage.py test` reports **54** passing, the baseline this story must not change; `apps/sla/tasks.py::auto_assign_ticket` (the project's only prior `@shared_task`, `SLA-2`) is the direct structural precedent for this story's own `apps/ai/tasks.py::categorize_ticket` — same "no-op in every case nothing should happen," same "queue from `perform_create` inside a `try/except Exception: logger.exception(...)`" shape.

---

## Story Goal

When a customer submits a ticket through the portal, queue a background task that asks the AI to suggest a priority and (when none was already assigned) a category, and applies the result — closing the "staff triage assigns both later" gap `PORTAL-1`'s own docstring names. Nothing in the UI changes: the agent still edits `category`/`priority` through the existing ticket edit form exactly as before (this is what "agent-overridable" already means — no new UI is needed to make an existing, always-writable field overridable).

1. **`apps/ai/categorization.py::suggest_ticket_fields(ticket)`** — asks the AI to classify the ticket's `subject`/`description` into one of `Ticket.Priority`'s four values and one of the existing `Category` rows (or none), and parses the response deterministically. Raises `AIServiceError` on failure — same contract as every other `apps.ai` consumer.
2. **`apps/ai/tasks.py::categorize_ticket(ticket_id)`** — the project's second `@shared_task` (after `SLA-2`'s `auto_assign_ticket`). Applies the suggested priority unconditionally and the suggested category only when the ticket has none yet. A no-op, not an error, for every failure mode.
3. **`PortalTicketViewSet.perform_create`** — queues `categorize_ticket.delay(ticket.id)` alongside the existing `auto_assign_ticket.delay(ticket.id)` call, in its own `try/except`, matching the file's own established resilience shape.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/ai/categorization.py::suggest_ticket_fields` | "Auto-tag category/priority... via AI-0" (backlog, `AI-3`). |
| `apps/ai/tasks.py::categorize_ticket` | "on intake" (backlog) — applied asynchronously so a slow/unavailable AI provider never delays or fails a customer's ticket submission, the same reasoning `SLA-2`'s own `auto_assign_ticket` is async. |
| `PortalTicketViewSet.perform_create`'s new `.delay()` call | The one evidenced "nothing categorizes this today" creation path (see `## Prerequisites`). |

**Not here, and why:**

- **No new frontend code, no new locale keys.** `category`/`priority` are already editable on every ticket through the existing `TicketFormPage` edit flow — "agent-overridable" is already true today; this story only changes what value those fields start at.
- **No change to `TicketViewSet.perform_create` (staff-created tickets).** See `## Prerequisites` — auto-tagging there would overwrite an agent's own explicit choice.
- **No change to any channel adapter** (`email`/`whatsapp`/`sms`/`web_form`/`live_chat`). Not named in this story's dependency list; a materially larger change than this story's own scope. A future story, naming the relevant `COMM-*` dependencies, extends coverage there if wanted.
- **No new Django model, no migration, no new permission constant.** `categorize_ticket` writes to `Ticket.priority`/`Ticket.category`, both of which already exist; nothing about who may read/write a ticket changes.
- **No `TicketActivity` log entry for the AI's change.** Category/priority changes are not logged anywhere in this codebase today — not even for a staff member's own manual edit via `TicketViewSet.update` (`TicketActivity.Kind` has only `STATUS_CHANGED`/`ASSIGNED`, `apps/tickets/models.py`). This story does not introduce audit logging for a field class that has never had it.
- **No structured-output/JSON-schema extension to `apps.ai.client`.** The AI's response is parsed as two plain, deterministically-validated lines (`## Backend Tasks` task 1) — simpler than extending `AI-0`'s shipped `generate_completion` contract, and sufficient for a four-value enum plus a short, admin-managed category name list.

---

## Context — Read These Files First

1. `.squad/stories/ai-features/SUPPORTOS-85/intake.md` — matches the backlog; no correction needed.
2. `SupportOs backlog.MD` lines 834-838 — the authoritative `AI-3` task text this plan implements.
3. `backend/apps/portal/serializers.py` lines 24-29 (`PortalTicketSerializer` docstring) — the direct textual evidence for this story's scope, quoted in `## Prerequisites`.
4. `backend/apps/portal/views.py` (current, 89 lines) — `perform_create` (lines 66-89), specifically the existing `auto_assign_ticket.delay(ticket.id)` `try/except` (lines 82-89) task 3 mirrors; `logger` already defined at module scope (line 13) — no new logger import needed here.
5. `backend/apps/sla/tasks.py` (all 70 lines) — `auto_assign_ticket` (lines 19-44): the exact `@shared_task`, `Ticket.DoesNotExist: return` no-op, and module docstring shape (lines 1-5, "no further Celery wiring is needed... `app.autodiscover_tasks()` finds this module") task 2's `apps/ai/tasks.py` copies.
6. `backend/apps/tickets/models.py` lines 26-110 (`Ticket`) — `Priority` choices (lines 40-44: `low`/`medium`/`high`/`urgent`, default `MEDIUM`) and `category` (lines 65-72, nullable `SET_NULL` FK to `Category`); lines 8-23 (`Category` — `name`, `ordering = ("name",)`).
7. `backend/apps/ai/client.py` (current, from Story 74) — `generate_completion(user_prompt, *, system=None, max_tokens=4096, model=None)`, called directly by task 1; no changes to this file.
8. `backend/apps/ai/exceptions.py` (current, from Stories 74-75) — `AIServiceError`, caught by task 2, not task 1.
9. `backend/apps/README.md` line 83 — `ai`'s declared ownership includes "classification," confirming `apps/ai/categorization.py` is the correct home, not `apps/tickets/`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Auto-tag category and priority on ticket intake.** | Backlog, `AI-3`'s sole task | `apps/ai/tasks.py::categorize_ticket`, queued from `PortalTicketViewSet.perform_create`. |
| **Only the portal-submission path, not staff creation.** | This story's own design, evidenced by `PortalTicketSerializer`'s own docstring | `.delay()` call added only to `apps/portal/views.py`; `apps/tickets/views.py::TicketViewSet.perform_create` is untouched. |
| **Priority is always set; category only when none was chosen.** | This story's own design — a portal submission never lets the customer pick a category or priority (`PortalTicketSerializer.Meta.read_only_fields`, lines 44-48) | `categorize_ticket` sets `ticket.priority` unconditionally and `ticket.category` only if `ticket.category_id is None`. |
| **Agent-overridable — already true, no new UI.** | Backlog, parenthetical | `category`/`priority` are already writable via the existing ticket edit form; no frontend change in this story. |
| **Runs asynchronously; never blocks or fails ticket submission.** | Backlog outcome ("on intake," matching `SLA-2`'s own async-assignment reasoning) | `categorize_ticket.delay(...)` inside a `try/except Exception: logger.exception(...)`, mirroring `auto_assign_ticket`'s own call site exactly. |
| **A missing/deleted ticket, or an AI-service failure, is a silent no-op, never an error.** | `SLA-2`'s own established precedent for a background task | `categorize_ticket` returns early on `Ticket.DoesNotExist` and on `AIServiceError`, logging the latter, raising neither. |
| **The AI must choose from the real, existing category set — never invent one.** | This story's own design | `suggest_ticket_fields` validates the model's category response against `Category.objects.all()` by exact (case-insensitive) name match; anything else resolves to no category, never a new `Category` row. |

---

## Backend Tasks

### 1 — The categorization logic

**Create file: `backend/apps/ai/categorization.py`**

```python
"""AI ticket categorization — AI-3 (Story 77), built on AI-0's
`apps.ai.client.generate_completion` (Story 74). Applied only from
`PortalTicketViewSet.perform_create` — see Story 77 `## Prerequisites`
for why staff-created and channel-adapter-created tickets are excluded.
"""

from apps.ai.client import generate_completion

from .models import Category, Ticket

MAX_TOKENS = 64

PRIORITY_PREFIX = "priority:"
CATEGORY_PREFIX = "category:"


def suggest_ticket_fields(ticket: Ticket) -> dict:
    """Classify `ticket.subject`/`ticket.description` into one of
    `Ticket.Priority`'s four values and one of the existing `Category`
    rows (or `None`). Returns `{"priority": <str>, "category": <Category
    | None>}`. Raises `apps.ai.exceptions.AIServiceError` on failure —
    unchanged contract; `apps.ai.tasks.categorize_ticket` decides what to
    do about it.
    """
    categories = list(Category.objects.all())
    category_names = ", ".join(category.name for category in categories) or "(none configured)"
    priority_values = ", ".join(Ticket.Priority.values)

    system = (
        "You triage incoming support tickets. Read the ticket below and "
        "respond with EXACTLY two lines and nothing else:\n"
        f"Priority: <one of: {priority_values}>\n"
        f"Category: <one of: {category_names}, or None if nothing fits well>"
    )
    user_prompt = f"Subject: {ticket.subject}\nDescription: {ticket.description}"
    response = generate_completion(user_prompt, system=system, max_tokens=MAX_TOKENS)

    return {
        "priority": _parse_priority(response),
        "category": _parse_category(response, categories),
    }


def _parse_priority(response: str) -> str:
    """Defaults to `Ticket.Priority.MEDIUM` — the model field's own
    default — for a missing line or a value outside the fixed four-value
    enum, rather than raising over a malformed model response.
    """
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(PRIORITY_PREFIX):
            value = stripped[len(PRIORITY_PREFIX) :].strip().lower()
            if value in Ticket.Priority.values:
                return value
    return Ticket.Priority.MEDIUM


def _parse_category(response: str, categories: list[Category]) -> Category | None:
    """Matches the model's response against the REAL category list by
    exact, case-insensitive name — never constructs a new `Category`.
    Any unmatched or missing value (including the literal "None") falls
    back to `None`, the same "no confident match" outcome.
    """
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(CATEGORY_PREFIX):
            value = stripped[len(CATEGORY_PREFIX) :].strip()
            for category in categories:
                if category.name.lower() == value.lower():
                    return category
            return None
    return None
```

---

### 2 — The background task

**Create file: `backend/apps/ai/tasks.py`**

```python
"""Background tasks — AI-3 (Story 77). The project's second `@shared_task`
outside `apps.sla` — `apps.sla.tasks::auto_assign_ticket` (Story 29) is
the direct structural precedent: no further Celery wiring is needed,
`app.autodiscover_tasks()` (Story 27, `config/celery.py`) already finds
this module because it is named `tasks.py` inside an installed app.
"""

import logging

from celery import shared_task

from apps.tickets.models import Ticket

from .categorization import suggest_ticket_fields
from .exceptions import AIServiceError

logger = logging.getLogger(__name__)


@shared_task
def categorize_ticket(ticket_id: int) -> None:
    """Auto-tags a newly submitted ticket's priority, and its category
    when none was already chosen. A no-op (not an error) whenever
    nothing should happen: the ticket was deleted before this ran, or
    the AI service is unconfigured/unreachable. Fired from
    `PortalTicketViewSet.perform_create`. See Story 77 `## Prerequisites`.

    Priority is always overwritten — no path that queues this task ever
    lets a human choose it first (`PortalTicketSerializer.read_only_fields`
    includes `priority`). Category is overwritten only when still unset,
    the one respected human choice in scope: the web form's optional
    category picker is a different, out-of-scope creation path, but the
    same "never override an existing category" rule is the safe default
    regardless of how one got set.
    """
    try:
        ticket = Ticket.objects.select_related("category").get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    try:
        suggestion = suggest_ticket_fields(ticket)
    except AIServiceError:
        logger.exception("AI categorization failed for ticket %s", ticket_id)
        return

    update_fields = ["priority", "updated_at"]
    ticket.priority = suggestion["priority"]
    if ticket.category_id is None and suggestion["category"] is not None:
        ticket.category = suggestion["category"]
        update_fields.append("category")
    ticket.save(update_fields=update_fields)
```

---

### 3 — Queue it from portal ticket creation

**File: `backend/apps/portal/views.py`** — add one import, after `from apps.sla.tasks import auto_assign_ticket`:

```python
from apps.ai.tasks import categorize_ticket
```

Keep alphabetical-by-module ordering — `apps.ai` sorts before `apps.core`:

```python
from apps.ai.tasks import categorize_ticket
from apps.core.permissions import Permissions
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Feedback, Ticket
```

Add the new queuing call inside `perform_create`, after the existing `auto_assign_ticket` block (current lines 81-89):

```python
        ticket = serializer.save(customer=self.request.user.customer_profile)
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract as TicketViewSet.perform_create
            # (apps/tickets/views.py:83-93) — the Ticket row is already
            # committed; auto-assignment queuing failing must not fail
            # the customer's submission.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)
        try:
            categorize_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract, one call site over — AI-3.
            logger.exception("Failed to queue AI categorization for ticket %s", ticket.id)
```

---

## Edge Cases & Failure Modes

- **`ANTHROPIC_API_KEY` is unconfigured, or the AI provider errors/times out.** `suggest_ticket_fields` raises `AIServiceError`; `categorize_ticket` catches it, logs it, and returns — the ticket keeps its default `priority=medium`/`category=None`, exactly as if this story did not exist. Not a customer-visible failure: the submission already returned `201` before this task ever ran.
- **The Celery broker is unreachable when `.delay()` is called.** Caught by `perform_create`'s own `try/except`, logged, submission still succeeds — identical shape to the existing `auto_assign_ticket` call immediately above it.
- **The ticket is deleted between being created and this task running** (a narrow race, `Ticket.DoesNotExist`) — a silent no-op, the same as `auto_assign_ticket`.
- **The model's response doesn't match the requested two-line format, or names a priority/category that doesn't exist.** `_parse_priority`/`_parse_category` fall back to `Ticket.Priority.MEDIUM`/`None` respectively for anything unparseable — never raises over a malformed response, never invents a `Category` row.
- **No `Category` rows exist yet.** `category_names` renders as `"(none configured)"` in the prompt; the model's own instruction still asks it to say "None" when nothing fits, which `_parse_category` resolves to `None` (an empty `categories` list also means the matching loop never finds anything, deferring to the same `None` fallback either way).
- **A race between `auto_assign_ticket` and `categorize_ticket`, both queued back-to-back from the same request.** Each updates a disjoint set of fields (`assigned_agent` vs. `priority`/`category`) via its own `update_fields`-scoped `save()`, so whichever runs first or second, neither clobbers the other's write — no accepted-but-unaddressed race here, unlike `## Prerequisites`' broader "runs promptly after creation" acceptance for the (out-of-scope) staff-edit-during-the-queue-window case, which does not apply to two tasks touching different fields.
- **A staff member edits the ticket's priority or category in the brief window before this task runs.** Not guarded against — `categorize_ticket` applies its own decision unconditionally once it runs, the same accepted "runs promptly, in practice" limitation `auto_assign_ticket` (`SLA-2`) already carries with no special handling; Celery tasks in this project's local setup are expected to drain within seconds, and this story does not introduce new machinery to close that already-accepted gap.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — confirms `apps/ai/categorization.py`, `apps/ai/tasks.py`, and `apps/portal/views.py`'s new import/call all import cleanly.
2. `python manage.py test` — reports the same **54** passing as before this story (no model, no migration).
3. `ruff format --check .` / `ruff check .` over the new/changed Python files.
4. Real Django-shell verification of `suggest_ticket_fields`/`categorize_ticket`, plus an end-to-end portal-submission check — `## Verification Steps`.
5. No frontend changes — confirmed via `git status`/diff that nothing under `frontend/` changed; frontend gates are unaffected by this story.

---

## Migration / Rollback

**No migration in this story.** No model changed.

**Rollback:** revert the commits (`apps/ai/categorization.py`, `apps/ai/tasks.py`, `apps/portal/views.py`). Nothing to reverse at the database level.

**Half-applied states to avoid:**

- **`apps/portal/views.py`'s new `.delay()` call added before `apps/ai/tasks.py` exists** → `ImportError` at Django startup, caught immediately by `python manage.py check`.
- **The new `try/except` around `categorize_ticket.delay(...)` omitted.** With Redis unreachable, every portal ticket submission would fail instead of succeeding uncategorized — the same "single highest-risk regression" `SLA-2`'s own plan already flagged for `auto_assign_ticket`'s identical call shape.
- **`categorize_ticket` skipping the `ticket.category_id is None` guard** — would let a stale/slow task overwrite a category some *other* process (a future channel-adapter story, or a manual admin fix) set in the meantime. The guard is what makes this task safe to extend to more creation paths later without redesigning it.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing, unchanged.
3. **Unconfigured-AI behavior, verified via Django shell** (with `ANTHROPIC_API_KEY` blank, the default state): create a `Ticket` with `category=None`, call `apps.ai.tasks.categorize_ticket(ticket.id)` directly (not `.delay()`, to run synchronously in-process) — returns `None`, no exception raised, and `ticket.priority`/`ticket.category` are unchanged in the database (re-fetch and confirm) once the failure is logged.
4. **Configured behavior, with a real key set in `backend/.env`:** the same call on a ticket whose subject/description clearly indicates urgency (e.g. "Cannot log in, production down") and whose text matches an existing `Category` name — re-fetch the ticket and confirm `priority` reflects the urgency and `category` was set to the matching row.
5. **Category-preservation check:** repeat Step 4 against a ticket that already has a `category` set — confirm `category` is unchanged after the task runs, while `priority` still updates.
6. **End-to-end portal submission**, with a real key configured: `POST /api/portal/tickets/` as a customer account — the request still returns `201` immediately (not blocked on the AI call); shortly after (once a Celery worker processes the queue — `celery -A config worker` running, per `README.md` § 6), re-fetch the ticket via `GET /api/tickets/<id>/` as staff and confirm `priority`/`category` reflect the AI's suggestion.
7. **No frontend regression:** confirm via `git status`/diff that nothing under `frontend/` changed.

---

## Done Criteria

- [ ] `apps/ai/categorization.py` — `suggest_ticket_fields(ticket)`, `_parse_priority`, `_parse_category`; validates the model's category choice against real `Category` rows by case-insensitive name match, never inventing one.
- [ ] `apps/ai/tasks.py` — `categorize_ticket(ticket_id)` (`@shared_task`): no-op on `Ticket.DoesNotExist` or `AIServiceError`; sets `priority` unconditionally, `category` only when previously `None`.
- [ ] `apps/portal/views.py::PortalTicketViewSet.perform_create` — queues `categorize_ticket.delay(ticket.id)` in its own `try/except Exception: logger.exception(...)`, alongside the existing `auto_assign_ticket.delay(...)` call.
- [ ] **`apps/tickets/views.py::TicketViewSet.perform_create` (staff-created tickets) is untouched.** No channel adapter (`email`/`whatsapp`/`sms`/`web_form`/`live_chat`) is touched.
- [ ] **No new Django model, no migration, no new permission constant, no `TicketActivity` log entry, no frontend change.**
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified live: an unconfigured/failing AI service leaves the ticket unchanged, silently; a configured call sets a sensible priority and (when previously unset) a real, existing category; an already-categorized ticket's category is never overwritten; a real portal submission still returns `201` immediately regardless of AI outcome.
- [ ] `.squad/plans/ai-features/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 78.** `AI-4` (Suggested Solutions, `SUPPORTOS-86`, depends on `AI-0` + `KB-3`, both complete) and `AI-5` (AI Chatbot, `SUPPORTOS-87`, depends on `AI-0` + `KB-3` + `PORTAL-0`, all complete) remain unplanned and can proceed in any order — neither depends on this story.
