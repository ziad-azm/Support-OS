# Story 24 — Ticket History (Story: SUPPORTOS-36)

## Prerequisites

- **Story 12 (TKT-1) completed** — the intake names it (`Dependencies: TKT-1`). `Ticket`/`Category` (`backend/apps/tickets/models.py`, 110 lines, after Story 23) and `Message` (`backend/apps/communications/models.py`, 56 lines, Story 13) both exist. `TicketViewSet`'s `assign` (Story 22) and `set_status`/`escalate` (Story 23) are the two write paths this story adds logging to.
- **This is the project's SECOND persisted activity-log-shaped model, and the first that actually gets written to by other actions.** `Note`/`Attachment` (Story 21, `apps/customers/models.py`) are user-authored content, not a system-generated audit trail — `TicketActivity` is the first model in this project whose rows are created *by code*, not by a request body. The intake marks its own task `🔑`, *"reusable activity-log pattern"* — this plan treats `TicketActivity`'s generic `kind` + `from_value`/`to_value` shape (task 1) as the thing future stories reuse, not a ticket-specific one-off.
- **"Replies" are not duplicated into `TicketActivity` — `Message` already is the record of them.** Storing a second copy of every message body would be a real data-integrity risk (two sources of truth for the same reply, guaranteed to drift). Instead, `apps/tickets/history.py::build_history` merges `TicketActivity` (status/assignment changes) with the ticket's existing `Message` rows into one read-only feed — the exact shape `apps/customers/timeline.py::build_timeline` (Story 20) already established for merging `Ticket`+`Message` into one feed, one app closer to home. `Message` crossing from `apps.communications` is the same reverse-direction import `apps/tickets/admin.py` already makes safely (`from apps.communications.models import Message`, Story 13) — no *model*-level cycle.
- **`MessageViewSet` already reuses `tickets.*` permissions, verified**: `apps/communications/views.py` lines 41-47 show `"list"`/`"retrieve"` gated on `Permissions.TICKETS_VIEW`, the exact same constant `TicketViewSet` uses (Story 13's own design, `CategoryViewSet`'s reuse). This means gating the new `history` action on `tickets.view` alone is safe and complete — no permission bypass, and **no** second explicit check is needed the way `CustomerViewSet.timeline` (Story 20) needed one for `tickets.view` on top of `customers.view`, because `history` never leaves the `tickets` permission domain the way CUST-3's cross-domain aggregate did.
- **An audit-log entry snapshots values at write time; it does not store a live reference that can rot.** `TicketActivity.actor` is `SET_NULL` (the project's now-settled pattern, after `Note.author`/`Attachment.uploaded_by`/`Ticket.assigned_agent`) so a log entry survives its actor's account being deleted. `from_value`/`to_value` go further: for an assignment change they store a **name snapshot** (`User.get_full_name()` at write time, `""` for unassigned), not a user id — a `TicketActivity` row must stay historically correct even after the referenced user is deleted, and a stored id would need a live lookup that could come back empty. For a status change they store the **raw `Ticket.Status` value string** (e.g. `"open"`), not a snapshot label — status values are a fixed enum, not user data that can vanish, and the frontend must still be able to translate them via the exact same `statuses.<value>` i18n keys every other status display in this app already uses. This is a deliberate asymmetry between the two `kind`s, not an inconsistency — see `## Backend Tasks` task 1.
- **No new permission constants.** `backend/apps/core/permissions.py` lines 26-32 confirm `TICKETS_VIEW`/`TICKETS_MANAGE` already exist. Reading history is a `tickets.view` concern (same as `retrieve`); writing activity rows happens only as a side effect of `assign`/`set_status`, which are already gated `tickets.manage`.
- **No standalone `TicketActivity` CRUD endpoint.** The intake says *"`TicketActivity` log & API"* + *"history endpoint"* (singular) — read the same way Story 22 read *"assign/reassign endpoint"* as ruling out a general user-listing API: this story adds only the merged, read-only `GET /tickets/<id>/history/` action. `TicketActivity` rows are written **only** internally by `assign`/`set_status`, never through a request body.
- **Escalation changes are deliberately NOT logged.** The backlog's own task line for this story (`SupportOs backlog.MD:347`) says *"change logging (status/assignment/replies)"* — three kinds, and escalation (added one story later, Story 23) is not one of them. Adding a fourth `Kind` later is a one-line change to the same enum plus one more `TicketActivity.objects.create(...)` call in `TicketViewSet.escalate` — trivial, but not this story's literal scope. Documented as a deliberate exclusion, not an oversight.
- **`@action` mechanics, `permission_map` completeness, and CASCADE/SET_NULL choices are already established, not new.** `TicketActivity.ticket` is `CASCADE` (an activity entry has no existence independent of its ticket, the same reasoning `Message.ticket` uses, Story 13) — contrast `Ticket.customer`'s `PROTECT`. The fourth `@action` on `TicketViewSet` after `assignable_agents`/`assign`/`set_status`/`escalate`; a missing `permission_map` entry falls through to authenticated-only, not denied (`CONVENTIONS.md` §22).

---

## Story Goal

1. **`TicketActivity` log**: a new, generic, system-written model (`ticket`, `actor`, `kind`, `from_value`, `to_value`) capturing every status change (Story 23's `set_status`) and every assignment change (Story 22's `assign`) — reused as-is, not duplicated, for any future event kind.
2. **History API**: `GET /api/tickets/<id>/history/` (gated `tickets.view`) returns one newest-first feed merging `TicketActivity` rows with the ticket's `Message` rows — auditable status/assignment/reply history in one read, via `apps/tickets/history.py::build_history`.
3. **History timeline UI**: a new `TicketHistorySection` on the ticket detail page, reusing `InteractionTimelineSection`'s (Story 20) exact `<ul>`-of-heterogeneous-rows shape — visible to everyone with `tickets.view`, no write surface (there is nothing to edit in an audit trail).

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `TicketActivity` model, generic `kind`/`from_value`/`to_value` | "reusable activity-log pattern" (intake, marked 🔑) — one shape for every event kind, not a table per kind. |
| Logging calls added to `assign`/`set_status` | "change logging (status/assignment/replies)" (intake) — replies come from `Message`, not a new write. |
| `apps/tickets/history.py::build_history`, `GET .../history/` | "history endpoint" (intake) — the merged, auditable read. |
| `TicketHistorySection` (new `<ul>` card) | "History timeline UI ... reusing timeline/state components" (intake) — `InteractionTimelineSection`'s exact shape. |

**Not here, and why:**

- **No escalation logging.** See `## Prerequisites` — the backlog's own task line names three kinds, not four.
- **No `TicketActivity` write API.** Rows are a side effect of `assign`/`set_status`, never created directly through a request body — see `## Prerequisites`.
- **No activity log for `Category`/`Ticket` field edits (subject, description, category, priority via the create/edit form).** The backlog's task line names status/assignment/replies specifically; a general "audit every field edit" log is a materially bigger feature (needs before/after diffing on arbitrary fields) that no story has asked for.
- **No pagination on the history feed.** Same reasoning `build_timeline`/`getCustomerTimeline` already documented (Story 20): the endpoint merges two querysets in Python and caps itself at `HISTORY_MAX_ENTRIES` (100), so DRF's queryset pagination does not apply.
- **No WebSocket/real-time push for new history entries.** `TicketChatConsumer` (Story 16) is scoped to the live conversation; history is a `staleTime`-refreshed read like `InteractionTimelineSection`'s, not a live feed.

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-36/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 343-348 (`STORY (TKT-5) — Ticket History`) — the literal three event kinds (`"status/assignment/replies"`) this story's scope is read from.
3. `backend/apps/tickets/models.py` (110 lines, after Story 23) — `Ticket`'s class docstring (lines 27-32, names TKT-5 as the last unimplemented piece) and its `assigned_agent`/`status`/`escalated` fields (lines 79-102) as the `SET_NULL`/comment-block style task 1's `TicketActivity` follows; `Category`'s placement (top of file) as the "second model in this file" precedent.
4. `backend/apps/customers/models.py` lines 107-140 — `Note` (CASCADE-not-PROTECT reasoning, `-created_at` ordering) as the exact `Meta`/docstring shape `TicketActivity` copies, one model closer to an audit log than a note.
5. `backend/apps/tickets/views.py` (213 lines, after Story 23) — `assign` (lines 122-155) and `set_status` (lines 157-188), both edited by task 3 to log an activity row after their existing `save(update_fields=[...])` call; `escalate` (lines 190-213) is read but **not** edited (see `## Prerequisites`); `permission_map` (lines 45-62), which task 3 also extends.
6. `backend/apps/customers/timeline.py` (72 lines, Story 20) — read in full: the exact merge-two-querysets-into-one-sorted-feed shape `apps/tickets/history.py::build_history` (task 2) copies, including the "slice each side to the cap before merging is exact, not approximate" reasoning (lines 66-70).
7. `backend/apps/customers/views.py` lines 52-69 — `CustomerViewSet.timeline`: the `@action` + docstring shape task 3's `history` action follows, **except** the double-permission-check (lines 66-67) which `history` does not need — see `## Prerequisites` for why.
8. `backend/apps/communications/models.py` (56 lines) — `Message` (`direction`, `channel`, `body`, `created_at`) — note there is **no** actor/sender field on `Message` at all; reply rows in the merged history carry no "by ..." attribution, matching `TicketConversation`'s own message rows.
9. `backend/apps/communications/views.py` lines 41-47 — `MessageViewSet.permission_map`, confirming `tickets.view`/`tickets.manage` reuse (verified in `## Prerequisites`).
10. `backend/apps/tickets/admin.py` (41 lines, after Story 23) — `TicketAdmin` (lines 26-41) and the existing `MessageInline` shape (lines 8-12) task 1 does **not** reuse (`TicketActivity` gets its own standalone `ModelAdmin`, mirroring `NoteAdmin`/`AttachmentAdmin`, not `MessageInline`'s inline treatment — see task 1).
11. `backend/apps/tickets/migrations/0005_ticket_escalated_ticket_escalated_at.py` — the latest tickets migration; this story's migration depends on it.
12. `frontend/src/features/customers/types/timelineEntry.ts` (49 lines, Story 20) — read in full: the discriminated-union + `${kind}-${id}` key-function shape `types/ticketHistoryEntry.ts` (task 5) copies exactly.
13. `frontend/src/features/customers/api/getCustomerTimeline.ts`/`useCustomerTimeline.ts` (Story 20) — the plain-array `api.get<T[]>` shape and the "nothing invalidates this, cross-feature" reasoning task 6's `useTicketHistory` **contrasts** with (same-feature invalidation reaches it for free — see task 6).
14. `frontend/src/features/customers/components/InteractionTimelineSection.tsx` (97 lines, Story 20) — read in full: the `<Card>` + `QueryBoundary` + `<ul>` + kind-dispatching row components shape task 8's `TicketHistorySection` copies almost verbatim.
15. `frontend/src/features/tickets/components/TicketConversation.tsx` (137 lines, Story 13/14) — `MessageRow` (lines 71-90) as the exact rendering task 8's history `MessageRow` reuses (same `conversation.directions`/`conversation.channels` i18n keys, no duplication needed — same feature, same namespace).
16. `frontend/src/features/tickets/api/useMessageMutations.ts` (20 lines, Story 13) — `useCreateMessage`'s scoped invalidation (`ticketKeys.resource('messages', ticketId)`) — task 7 adds a second `invalidateQueries` call for `ticketKeys.resource('history', ticketId)`, since this is the one existing mutation whose effect on the new history feed `ticketKeys.all`'s prefix-wide invalidation (used by `assign`/`set_status`) does **not** already cover.
17. `frontend/src/features/tickets/api/ticketKeys.ts` and `frontend/src/shared/lib/api/queryKeys.ts` — confirms `ticketKeys.resource('history', id)` is `['tickets', 'history', id]`, a **child** of `ticketKeys.all` (`['tickets']`) — React Query's default partial-key matching means `useAssignTicket`/`useSetTicketStatus`'s existing `ticketKeys.all` invalidation already reaches it with no code change (verified against `useTicket`'s `ticketKeys.resource('detail', id)`, which the same prefix-wide invalidation already refreshes today).
18. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (187 lines, after Story 23) — `<TicketConversation ticketId={ticket.id} />` (line 178), directly after which task 9 adds `<TicketHistorySection ticketId={ticket.id} />`.
19. `frontend/src/features/tickets/locales/en.json`/`ar.json` (96 lines each, after Story 23) — the `conversation` block (lines 73-95) whose `directions`/`channels` sub-keys task 10's history rows reuse, and the `escalation` block's shape as the nesting style the new `history` block follows.
20. `CONVENTIONS.md` (1180 lines) — §20 (aggregate-read-belongs-to-the-app-that-owns-the-question, Story 20's paragraph), §23 (feature module conventions — Story 23's state-transition-graph paragraph, most recent; this story's own paragraph appends after it).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`TicketActivity` log & API, reusable pattern.** | Intake, task 1 | `TicketActivity` model (generic `kind`/`from_value`/`to_value`); `apps/tickets/history.py::build_history`. |
| **Change logging covers status, assignment, and replies.** | Intake, task 1 | `TicketViewSet.set_status`/`assign` each create a `TicketActivity` row; replies are read live from `Message`, not duplicated. |
| **History timeline UI, reusing timeline/state components.** | Intake, task 2 | `TicketHistorySection`, copying `InteractionTimelineSection`'s shape. |
| **An assignment change with no actual change (reassigning to the SAME agent) logs nothing.** | This story's design | `assign` compares the new agent against the ticket's prior `assigned_agent` before creating a row. |
| **Every successful `set_status` call logs an entry**, because Story 23 already rejects a no-op status "change" before this code path is reached. | This story's design | No extra no-op check needed in `set_status`'s logging — the guarantee already exists upstream. |
| **A status-change log entry stores translatable enum values; an assignment-change log entry stores a resolved name snapshot.** | This story's design, for i18n correctness | `TicketActivity.from_value`/`to_value`; see `## Prerequisites`. |
| **The history feed is read-only — nothing on it can be edited or deleted through the API.** | Intake's own framing ("auditable") | No `update`/`destroy` on `TicketActivity`; no `ModelViewSet` for it at all. |
| Wire format is `snake_case` end to end; the UI translates, the API sends values. | §12 | `kind`, `from_value`, `to_value`, `actor_name`, `occurred_at`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`. |

---

## Backend Tasks

### 1 — The `TicketActivity` model

**File: `backend/apps/tickets/models.py`** — update `Ticket`'s class docstring (lines 27-32):

```python
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `priority`/`category` (Story 18, TKT-2), `assigned_agent` (Story 22,
    TKT-3), `status`/`escalated` (Story 23, TKT-4), and now `TicketActivity`
    (Story 24, TKT-5) are all real. EPIC 4 is complete.
    """
```

Append a new model at the end of the file, after `Ticket.__str__`:

```python
class TicketActivity(TimeStampedModel):
    """An immutable audit-log entry for a ticket's status/assignment
    changes — TKT-5's "reusable activity-log pattern" (`SupportOs
    backlog.MD` lines 343-348). Replies are NOT logged here: `Message`
    already is the record of them, and duplicating message bodies into a
    second table would be a real data-integrity risk (two sources of truth
    for one reply). See `apps/tickets/history.py::build_history`, which
    merges this table with `Message` into one read-only feed.
    """

    class Kind(models.TextChoices):
        STATUS_CHANGED = "status_changed", _("Status changed")
        ASSIGNED = "assigned", _("Assignment changed")

    # CASCADE, not PROTECT: an activity entry has no existence independent
    # of its ticket, the same reasoning `Message.ticket` uses (Story 13).
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="activities", verbose_name=_("ticket")
    )
    # SET_NULL: the project's now-settled pattern (`Note.author`,
    # `Attachment.uploaded_by`, `Ticket.assigned_agent`) for a reference
    # that must survive the referenced account being removed — the log
    # entry still means something after its actor's account is gone.
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ticket_activities",
        verbose_name=_("actor"),
    )
    kind = models.CharField(_("kind"), max_length=20, choices=Kind.choices)
    # Raw values, not pre-rendered sentences. `status_changed` stores the
    # `Ticket.Status` value string (e.g. "open"), which the frontend
    # translates via the SAME `statuses.<value>` i18n keys every other
    # status display already uses. `assigned` stores a NAME SNAPSHOT
    # (`User.get_full_name()` at write time, "" for unassigned) rather than
    # a user id, so the log stays historically correct even after the
    # referenced user is deleted (`assigned_agent` is itself SET_NULL) — the
    # standard audit-log tradeoff of a point-in-time snapshot over a live
    # reference. See Story 24 `## Prerequisites`.
    from_value = models.CharField(_("from value"), max_length=150, blank=True)
    to_value = models.CharField(_("to value"), max_length=150, blank=True)

    class Meta:
        verbose_name = _("ticket activity")
        verbose_name_plural = _("ticket activities")
        # Newest-first: an audit log reads like a feed, the same choice
        # `Note.Meta.ordering` makes (Story 21), not `Message.Meta.ordering`
        # (oldest-first — a conversation reads top-to-bottom).
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} on ticket #{self.ticket_id}"
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations tickets
```

Expect **one** new file (`apps/tickets/migrations/0006_ticketactivity.py` or Django's equivalent name) containing a single `CreateModel`, depending on `("tickets", "0005_ticket_escalated_ticket_escalated_at")` and `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`. **No new permission-grant migration** — see `## Prerequisites`.

**File: `backend/apps/tickets/admin.py`** — extend the model import and register `TicketActivity` as its own standalone admin, mirroring `NoteAdmin`/`AttachmentAdmin` (`apps/customers/admin.py`), not `MessageInline`'s inline treatment:

```python
from .models import Category, Ticket, TicketActivity
```

```python
@admin.register(TicketActivity)
class TicketActivityAdmin(admin.ModelAdmin):
    list_display = ("ticket", "kind", "actor", "from_value", "to_value", "created_at")
    list_filter = ("kind",)
    search_fields = ("ticket__subject",)
    readonly_fields = ("created_at", "updated_at")
```

Everything else in `admin.py` is unchanged.

---

### 2 — The history-merge helper

**Create file: `backend/apps/tickets/history.py`**

```python
"""A ticket's full activity history — TKT-5's "reusable activity-log
pattern" (`SupportOs backlog.MD` lines 343-348). Merges the persisted
`TicketActivity` log (status/assignment changes) with the ticket's existing
`Message` rows (replies) into one newest-first feed. Replies are NOT
duplicated into `TicketActivity` — `Message` already is the record of them.

Same merge-two-querysets-into-one-feed shape as
`apps/customers/timeline.py::build_timeline` (Story 20), one app closer to
home: `Message` crossing from `apps.communications` is the same
reverse-direction import `apps/tickets/admin.py` already makes safely — no
*model* here imports across apps in a cycle.
"""

from apps.communications.models import Message

from .models import Ticket, TicketActivity

HISTORY_MAX_ENTRIES = 100


def build_history(ticket: Ticket) -> list[dict]:
    """Every logged status/assignment change plus every message on this
    ticket, merged newest-first and capped at `HISTORY_MAX_ENTRIES` — the
    same cap and merge order `build_timeline` uses, for the same reason:
    both sides are already newest-first, so the merged top N is exact, not
    an approximation.
    """
    activities = (
        TicketActivity.objects.filter(ticket=ticket)
        .select_related("actor")
        .order_by("-created_at")[:HISTORY_MAX_ENTRIES]
    )
    messages = Message.objects.filter(ticket=ticket).order_by("-created_at")[:HISTORY_MAX_ENTRIES]

    entries = [
        {
            "kind": "activity",
            "id": activity.id,
            "occurred_at": activity.created_at,
            "activity_kind": activity.kind,
            "actor_name": activity.actor.get_full_name() if activity.actor else None,
            "from_value": activity.from_value,
            "to_value": activity.to_value,
        }
        for activity in activities
    ] + [
        {
            "kind": "message",
            "id": message.id,
            "occurred_at": message.created_at,
            "direction": message.direction,
            "channel": message.channel,
            "body": message.body,
        }
        for message in messages
    ]

    entries.sort(key=lambda entry: entry["occurred_at"], reverse=True)
    return entries[:HISTORY_MAX_ENTRIES]
```

---

### 3 — Views: log activity on `assign`/`set_status`, and the `history` action

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from .history import build_history
from .models import Category, Ticket, TicketActivity
```

(The second line replaces the existing `from .models import Category, Ticket`.)

Add the `history` permission_map entry (alongside the existing four):

```python
        "history": Permissions.TICKETS_VIEW,
```

**In `assign`** (lines 122-155), capture the prior assignee and log a row only when it actually changes:

```python
        ticket = self.get_object()
        old_agent = ticket.assigned_agent
        ticket.assigned_agent = agent
        ticket.save(update_fields=["assigned_agent", "updated_at"])
        if agent != old_agent:
            TicketActivity.objects.create(
                ticket=ticket,
                actor=request.user,
                kind=TicketActivity.Kind.ASSIGNED,
                from_value=old_agent.get_full_name() if old_agent else "",
                to_value=agent.get_full_name() if agent else "",
            )
        return Response(self.get_serializer(ticket).data)
```

(Replaces the existing three-line `ticket = self.get_object()` / `ticket.assigned_agent = agent` / `ticket.save(...)` block, lines 152-154.)

**In `set_status`** (lines 157-188), capture the prior status and log unconditionally — Story 23's own no-op check (lines 174-175) already guarantees `new_status != ticket.status` by this point, so every call that reaches here is a real transition:

```python
        old_status = ticket.status
        ticket.status = new_status
        ticket.save(update_fields=["status", "updated_at"])
        TicketActivity.objects.create(
            ticket=ticket,
            actor=request.user,
            kind=TicketActivity.Kind.STATUS_CHANGED,
            from_value=old_status,
            to_value=new_status,
        )
        return Response(self.get_serializer(ticket).data)
```

(Replaces the existing two-line `ticket.status = new_status` / `ticket.save(...)` block, lines 186-187.)

**Append the `history` action**, after `escalate` (after line 213):

```python
    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """A ticket's full activity history — TKT-5. Merges the persisted
        `TicketActivity` log (status/assignment changes) with the ticket's
        `Message` rows (replies) into one feed. Gated on `tickets.view`
        alone — `MessageViewSet` already reuses the same permission for
        reading messages, verified in `## Prerequisites`, so no second
        explicit check is needed the way `CustomerViewSet.timeline`
        (Story 20) needed one.
        """
        ticket = self.get_object()
        return Response(build_history(ticket))
```

**No `apps/tickets/urls.py` change** (router-generated, `detail=True`, like every prior action). Endpoint: `GET /api/tickets/<id>/history/`.

---

## Frontend Tasks

### 4 — No changes to `Ticket`/`TicketInput`

`Ticket` (`types/ticket.ts`) and `TicketSerializer` are **unchanged** by this story — `history` is a separate action returning its own shape, not a field on the ticket resource. Confirm this while implementing; do not add `activities`/`history` to `Ticket`.

---

### 5 — History entry types

**Create file: `frontend/src/features/tickets/types/ticketHistoryEntry.ts`**

```ts
import type { MessageChannel, MessageDirection } from './message'

export type TicketActivityKind = 'status_changed' | 'assigned'

/**
 * Mirrors the `kind: "activity"` entries `apps.tickets.history.build_history`
 * emits. `from_value`/`to_value` mean different things per `activity_kind`:
 * for `status_changed` they are `TicketStatus` values, translated via the
 * same `statuses.<value>` i18n keys every other status display uses; for
 * `assigned` they are already-resolved name snapshots — render as-is,
 * blank meaning unassigned. See Story 24 `## Prerequisites`.
 */
export type TicketHistoryActivityEntry = {
  kind: 'activity'
  id: number
  occurred_at: string
  activity_kind: TicketActivityKind
  actor_name: string | null
  from_value: string
  to_value: string
}

/** Mirrors the `kind: "message"` entries `build_history` emits — the same
 * shape `TicketConversation`'s own message rows render, reused here
 * (same feature, same locale namespace) rather than duplicated. */
export type TicketHistoryMessageEntry = {
  kind: 'message'
  id: number
  occurred_at: string
  direction: MessageDirection
  channel: MessageChannel
  body: string
}

/** A discriminated union on `kind` — narrow with `entry.kind === 'activity'`. */
export type TicketHistoryEntry = TicketHistoryActivityEntry | TicketHistoryMessageEntry

/** `id` alone is not a stable React key across kinds — same reasoning as
 * `timelineEntryKey` (Story 20). */
export function ticketHistoryEntryKey(entry: TicketHistoryEntry): string {
  return `${entry.kind}-${entry.id}`
}
```

---

### 6 — History API layer

**Create file: `frontend/src/features/tickets/api/getTicketHistory.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TicketHistoryEntry } from '../types/ticketHistoryEntry'

// A plain array, not a paginated `Page<T>` — same reasoning as
// `getCustomerTimeline.ts` (Story 20): the endpoint merges two querysets in
// Python and caps the result itself (`HISTORY_MAX_ENTRIES`, 100).
export function getTicketHistory(ticketId: number): Promise<TicketHistoryEntry[]> {
  return api.get<TicketHistoryEntry[]>(`/tickets/${ticketId}/history/`)
}
```

**Create file: `frontend/src/features/tickets/api/useTicketHistory.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTicketHistory } from './getTicketHistory'
import { ticketKeys } from './ticketKeys'

/**
 * Read-only. Unlike `useCustomerTimeline` (nothing invalidates it — it
 * aggregates across a feature boundary `customerKeys` cannot reach),
 * `useAssignTicket`/`useSetTicketStatus`'s existing prefix-wide
 * `ticketKeys.all` invalidation already covers this key for free:
 * `ticketKeys.resource('history', ticketId)` is `['tickets', 'history',
 * ticketId]`, a child of `['tickets']`, and React Query's default
 * partial-key matching invalidates every child of an invalidated prefix.
 * `useCreateMessage`'s SCOPED invalidation does not reach it, though —
 * task 7 extends that one call site.
 */
export function useTicketHistory(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('history', ticketId),
    queryFn: () => getTicketHistory(ticketId),
  })
}
```

---

### 7 — Extend `useCreateMessage`'s invalidation

**File: `frontend/src/features/tickets/api/useMessageMutations.ts`** — a new reply is one of the three event kinds the history feed shows, and it lives outside `ticketKeys.all`'s reach the same way `messages` already does (this hook's own scoped-invalidation exception, Story 11/13):

```ts
/**
 * Scoped invalidation, per CONVENTIONS.md §23's documented exception
 * (Story 11): a message write for one ticket cannot affect another ticket's
 * conversation or the ticket list, so invalidating only this ticket's
 * `messages` key is precise. `history` is invalidated alongside it (Story
 * 24, TKT-5) — a new reply is one of the three event kinds the ticket
 * history feed shows, and it sits outside `ticketKeys.all`'s reach the
 * same way `messages` does.
 */
export function useCreateMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MessageInput) => createMessage(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('history', ticketId) })
    },
  })
}
```

(Replaces the existing `onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) })` one-liner and its docstring.)

---

### 8 — The history section

**Create file: `frontend/src/features/tickets/components/TicketHistorySection.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useTicketHistory } from '../api/useTicketHistory'
import { ticketHistoryEntryKey } from '../types/ticketHistoryEntry'
import type {
  TicketHistoryActivityEntry,
  TicketHistoryEntry,
  TicketHistoryMessageEntry,
} from '../types/ticketHistoryEntry'

/**
 * A ticket's audit trail — TKT-5. A `<ul>`, not a `DataTable`: the same
 * heterogeneous-feed reasoning `InteractionTimelineSection` (Story 20)
 * documents. Replies appear here too, alongside status/assignment changes
 * — not a duplicate of `TicketConversation`'s own reply thread, but a
 * lightweight chronological log next to it, the same relationship
 * `InteractionTimelineSection`'s ticket rows have to `/tickets` itself.
 */
export function TicketHistorySection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useTicketHistory(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          query={query}
          isEmpty={(entries) => entries.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('history.empty')}</p>}
        >
          {(entries) => (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <HistoryRow key={ticketHistoryEntryKey(entry)} entry={entry} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function HistoryRow({ entry }: { entry: TicketHistoryEntry }) {
  return entry.kind === 'activity' ? <ActivityRow entry={entry} /> : <MessageRow entry={entry} />
}

function ActivityRow({ entry }: { entry: TicketHistoryActivityEntry }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()

  // `status_changed` values are `TicketStatus`es, translated the same way
  // every other status display in this app is. `assigned` values are
  // already-resolved name snapshots — rendered as-is, blank meaning
  // unassigned, the same fallback `fields.unassigned` provides elsewhere.
  // See Story 24 `## Prerequisites`.
  const from =
    entry.activity_kind === 'status_changed'
      ? t(`statuses.${entry.from_value}`)
      : entry.from_value || t('fields.unassigned')
  const to =
    entry.activity_kind === 'status_changed'
      ? t(`statuses.${entry.to_value}`)
      : entry.to_value || t('fields.unassigned')

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{t(`history.kinds.${entry.activity_kind}`)}</Badge>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      <p>
        {t(
          entry.activity_kind === 'status_changed'
            ? 'history.statusChanged'
            : 'history.assigneeChanged',
          { from, to },
        )}
        {entry.actor_name ? ` ${t('history.by', { actor: entry.actor_name })}` : null}
      </p>
    </li>
  )
}

function MessageRow({ entry }: { entry: TicketHistoryMessageEntry }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={entry.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`conversation.directions.${entry.direction}`)}
        </Badge>
        <Badge variant="outline">{t(`conversation.channels.${entry.channel}`)}</Badge>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — same reasoning `TicketConversation`'s own
          `MessageRow` uses: a message body is free-form prose that may
          itself be Arabic. */}
      <p className="whitespace-pre-wrap">{entry.body}</p>
    </li>
  )
}
```

---

### 9 — Ticket detail: render the history section

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — one import, one line:

```tsx
import { TicketHistorySection } from './TicketHistorySection'
```

(Add alongside the existing `TicketConversation`/`TicketStatusControl` imports from the same directory, keeping the block alphabetized.)

```tsx
              <TicketConversation ticketId={ticket.id} />
              <TicketHistorySection ticketId={ticket.id} />
```

(The first line already exists at line 178; this adds the second line directly after it, still inside the `<>` fragment, still inside `QueryBoundary`'s render prop.)

---

### 10 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — one new top-level `history` block, placed after `conversation` (reuses `conversation.directions`/`conversation.channels` — no duplication needed, same namespace):

```json
  "history": {
    "title": "History",
    "empty": "No activity yet.",
    "kinds": {
      "status_changed": "Status changed",
      "assigned": "Assignment changed"
    },
    "statusChanged": "Status changed from {{from}} to {{to}}",
    "assigneeChanged": "Assignee changed from {{from}} to {{to}}",
    "by": "by {{actor}}"
  }
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "history": {
    "title": "السجل",
    "empty": "لا يوجد نشاط بعد.",
    "kinds": {
      "status_changed": "تغيير الحالة",
      "assigned": "تغيير التعيين"
    },
    "statusChanged": "تم تغيير الحالة من {{from}} إلى {{to}}",
    "assigneeChanged": "تم تغيير المسؤول من {{from}} إلى {{to}}",
    "by": "بواسطة {{actor}}"
  }
```

Both are the new **last** top-level key before the closing `}` (after `conversation`). No `resources.ts` change — `tickets` is already a registered namespace.

---

## Documentation Tasks

### 11 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 23's paragraph):

> **A system-written audit log snapshots values at write time; it does not store a live reference that can later resolve to nothing.** `TicketActivity` (Story 24, `TKT-5`) is the project's first model written only as a side effect of other actions (`assign`/`set_status`), never through its own request body. Its `actor` follows the established `SET_NULL` pattern for a reference that must survive account deletion, but its `from_value`/`to_value` go further: an assignment change stores a **name snapshot** (`User.get_full_name()` at write time), not a user id, so the log stays correct even after the referenced user is gone — the standard audit-log tradeoff of a point-in-time copy over a live foreign key. A status change, by contrast, stores the **raw enum value** (not a snapshot label), because status values are a fixed set the frontend must still translate via the same `statuses.<value>` i18n keys every other status display uses — a deliberate asymmetry driven by whether the underlying value can change independently of the log entry. **Not every logged event needs a new table.** `apps/tickets/history.py::build_history` extends `apps/customers/timeline.py::build_timeline`'s (Story 20) merge-two-querysets-into-one-feed shape to a second worked example: replies are represented by the *existing* `Message` rows, merged into the read rather than duplicated into the new `TicketActivity` table, because `Message` already is the record of them and a second copy would just be a drift risk. **A same-feature derived view invalidated by prefix gets the update for free; a scoped-invalidation mutation does not.** `useTicketHistory`'s query key is a child of `ticketKeys.all`, so `useAssignTicket`/`useSetTicketStatus`'s existing prefix-wide invalidation already refreshes it with no new code — but `useCreateMessage`'s narrower, *scoped* invalidation (Story 11's documented exception) does not reach a sibling key by construction, and had to be extended explicitly. When adding a new aggregate view, check whether every mutation that should refresh it uses prefix-wide or scoped invalidation before assuming it already works.

---

## Edge Cases & Failure Modes

- **Reassigning a ticket to the SAME agent it already has logs nothing.** `assign` itself still succeeds (Story 22 never rejected this as a no-op, unlike Story 23's `set_status`/`escalate`) — only the activity-log write is skipped, because `agent == old_agent` means nothing actually changed. The ticket's `updated_at` still bumps (the `save()` call is unconditional), but no `TicketActivity` row is created.
- **Unassigning a never-assigned ticket** (`assigned_agent` already `None`, `assign` called with `{"assigned_agent": null}`) — same no-op skip: `old_agent` and `agent` are both `None`, so `agent != old_agent` is `False`.
- **Every `set_status` success logs exactly one row** — Story 23's own `if new_status == ticket.status: raise ValidationError(...)` already runs before this code path, so `old_status != new_status` is guaranteed by the time the log entry is created. No separate no-op check is needed or added here.
- **A ticket with zero activity and zero messages shows the empty state**, not an error — `history.empty` (`"No activity yet."` / `"لا يوجد نشاط بعد."`), the same `QueryBoundary` `empty` prop pattern `InteractionTimelineSection` and `TicketConversation` already use.
- **An activity row whose `actor` was later deleted renders with no "by ..." suffix** — `actor_name` is `null`, and `ActivityRow` conditionally omits the trailing `t('history.by', ...)` text entirely rather than inventing a "System" placeholder. Message rows never show a "by ..." at all (`Message` has no actor field, verified in `## Prerequisites`).
- **Deleting a ticket cascade-deletes its `TicketActivity` rows** (`on_delete=CASCADE`) — an audit trail with no ticket to belong to is meaningless, same reasoning `Message.ticket` already uses.
- **The history feed and `TicketConversation`'s own message list can show slightly different data for a moment** if a request is in flight — `TicketConversation` refetches on its own `messages` key, `TicketHistorySection` on `history`; task 7 makes `useCreateMessage` invalidate both together so a sent reply appears in both places after the same mutation, but they are still two independent queries, not one shared cache entry.
- **`from_value`/`to_value` are capped at 150 characters.** A `User.get_full_name()` snapshot realistically never approaches this; if it ever did, Django would raise on save rather than silently truncate — acceptable, since a name this long would be a data-entry problem elsewhere, not a history-logging one.
- **Arabic actor names and status labels round-trip correctly** — `actor_name` is prose (a person's name, possibly Arabic), rendered without a forced `dir`; `from`/`to` for `status_changed` route through the same `statuses.<value>` i18n keys already verified bilingual in Story 18/23.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 1's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: a status change and an assignment change each produce exactly one correctly-shaped `TicketActivity` row visible through `GET .../history/`; a reassignment-to-the-same-agent produces none; a reply appears in the same feed without a new `TicketActivity` row; permission gating (`403` without `tickets.view`, `401` with no token); the feed is newest-first across mixed kinds — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new component.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**One migration**, generated by task 1: a single `CreateModel` for `TicketActivity`. Depends on `0005_ticket_escalated_ticket_escalated_at` and `swappable_dependency(AUTH_USER_MODEL)`. **No new permission-grant migration.**

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0005` to unapply, if reverting only this story's migration.

**Half-applied states to avoid:**

- **`TicketActivity.actor` added without `null=True, blank=True`.** `SET_NULL` requires a nullable field — the same trap Story 18/21/22/23 all documented; `makemigrations` would prompt for a one-off default and break a non-interactive run.
- **`permission_map` missing `"history"`.** Does **not** deny — falls through to authenticated-only, so any signed-in user (including a `customers.view`-only one) could read a ticket's status/assignment/reply history without `tickets.view`. `## Verification Steps` checks this explicitly.
- **The `assign`/`set_status` logging inserted BEFORE `ticket.save(...)`** instead of after. Both still work either way here (the `TicketActivity` row does not read back from the saved `ticket`, only from local variables), but keeping the log write after the save matches this project's general "commit the primary change first, log/side-effect second" ordering (the same ordering `MessageViewSet.perform_create`'s adapter-send-after-save already uses, Story 14).
- **`old_agent`/`old_status` captured AFTER mutating `ticket.assigned_agent`/`ticket.status`** instead of before — would silently log a "changed from X to X" no-op row (or crash comparing `agent != agent`), since the prior value would already be overwritten by the time it is read.
- **`build_history` filtering `Message.objects.filter(ticket=ticket)` without `.select_related` on anything `Message` needs** — `Message` has no FK to select beyond `ticket` itself (already filtered on), so no `select_related` is needed here, unlike `TicketActivity`'s `.select_related("actor")` (which avoids one query per row for `actor.get_full_name()`).

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces one file with a single `CreateModel`; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **A status change logs one activity row, visible through history.** Create a customer and a ticket (default status `open`). `POST .../status/` `{"status": "in_progress"}` → `200`. `GET .../history/` → contains exactly one `kind: "activity"` entry with `activity_kind: "status_changed"`, `from_value: "open"`, `to_value: "in_progress"`, and `actor_name` matching the caller.
5. **An assignment change logs one activity row; reassigning to the same agent logs none.** `POST .../assign/` `{"assigned_agent": <agent id>}` → `200`. `GET .../history/` → one new `kind: "activity"` entry, `activity_kind: "assigned"`, `from_value: ""` (was unassigned), `to_value` matching the agent's `get_full_name()`. Re-`POST` the SAME `{"assigned_agent": <same agent id>}` → still `200`, but `GET .../history/` shows **no new entry** (still exactly one `assigned` row).
6. **Unassigning logs a row with a blank `to_value`.** `POST .../assign/` `{"assigned_agent": null}` → `200`. `GET .../history/` → a new `assigned` entry with `from_value` matching the agent's name and `to_value: ""`.
7. **A reply appears in the merged history with no new `TicketActivity` row.** `POST /api/messages/` (or the ticket's message-create endpoint) a reply on this ticket → `200`/`201`. `GET .../history/` → a new `kind: "message"` entry with matching `body`/`direction`/`channel`; confirm via Django shell (or an admin list) that `TicketActivity.objects.filter(ticket=<id>).count()` did **not** increase.
8. **The feed is newest-first across mixed kinds.** With the status change, assignment change, unassign, and reply from steps 4-7 all on one ticket, confirm `GET .../history/`'s `occurred_at` values are in strictly descending order regardless of `kind`.
9. **Permission gating.** With a `customers.view`-only token (reuse the throwaway-role technique from Story 20/21/22/23): `GET .../history/` → `403`. With no token → `401`.
10. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as a `tickets.manage` user:
    - `/tickets/<id>` — a new "History" card appears after the conversation, showing the status change, assignment change(s), and reply from the earlier steps, newest-first.
    - The status-change row reads as a translated sentence ("Status changed from Open to In progress"), not raw enum values.
    - The assignment-change row shows resolved names (or "Unassigned"), not ids.
    - Sending a new reply through the conversation form updates BOTH the conversation list and the history feed without a manual refresh.
    - Switch to Arabic — every label and composed sentence translates, including the interpolated `{{from}}`/`{{to}}` values, and the feed reads correctly in RTL.
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Clean up** every ticket, customer, and message created for steps 4-9, plus any throwaway role/user reused from a prior story's verification.

---

## Done Criteria

- [ ] `TicketActivity` — `ticket` (`CASCADE`), `actor` (`SET_NULL`), `kind` (`Kind.STATUS_CHANGED`/`Kind.ASSIGNED`), `from_value`/`to_value` (`CharField`, `blank=True`); `Ticket`'s class docstring updated to name TKT-5 as done.
- [ ] One migration: a single `CreateModel`, depending on `0005_ticket_escalated_ticket_escalated_at`. **No new permission-grant migration.**
- [ ] `TicketActivityAdmin` registered (standalone, not inline), mirroring `NoteAdmin`/`AttachmentAdmin`.
- [ ] `apps/tickets/history.py::build_history` — merges `TicketActivity` + `Message`, newest-first, capped at `HISTORY_MAX_ENTRIES` (100).
- [ ] `TicketViewSet.assign` logs an `ASSIGNED` activity row only when the assignee actually changes.
- [ ] `TicketViewSet.set_status` logs a `STATUS_CHANGED` activity row on every successful call (guaranteed non-no-op by Story 23's own validation).
- [ ] `TicketViewSet.history` (`detail=True`, `GET`, `url_path="history"`) returns `build_history`'s plain array; `permission_map` gains `"history": TICKETS_VIEW`.
- [ ] **No `apps/tickets/urls.py` change, no new permission constant, no `TicketActivity` write API.**
- [ ] `types/ticketHistoryEntry.ts` — `TicketHistoryActivityEntry`/`TicketHistoryMessageEntry` discriminated union, `ticketHistoryEntryKey`.
- [ ] `api/getTicketHistory.ts`, `api/useTicketHistory.ts`; `useMessageMutations.ts`'s `useCreateMessage` extended to also invalidate `ticketKeys.resource('history', ticketId)`.
- [ ] `TicketHistorySection.tsx` — `<Card>` + `<ul>` of `ActivityRow`/`MessageRow`, mirroring `InteractionTimelineSection`; no write surface.
- [ ] `TicketDetailPage.tsx` renders `<TicketHistorySection ticketId={ticket.id} />` directly after `<TicketConversation>`.
- [ ] `en.json`/`ar.json` — the new `history` block (`title`, `empty`, `kinds`, `statusChanged`, `assigneeChanged`, `by`); identical key sets in both languages; reuses `conversation.directions`/`conversation.channels` rather than duplicating them; **no `resources.ts` change**.
- [ ] `CONVENTIONS.md` §23 gains the audit-log-snapshot / not-every-event-needs-a-table / prefix-vs-scoped-invalidation paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: a status change logs one row (Step 4); an assignment change logs one row and a same-agent reassignment logs none (Step 5); unassigning logs a blank-`to_value` row (Step 6); a reply appears in history with no new `TicketActivity` row (Step 7); the merged feed is newest-first across kinds (Step 8); `403`/`401` permission gating (Step 9).
- [ ] Both languages walk through cleanly in the browser, including live cache updates after a new reply (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 12).
- [ ] `.squad/plans/ticket-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** This is the last planned story in `ticket-management` — `TKT-1` through `TKT-5` (`EPIC 4`) are now all planned. `TKT-3` (Story 22) remains the named dependency for `AGENT-1` (Agent Queue) and `AGENT-4` (Auto-Assignment Rules) in `EPIC 6`; this story's `TicketActivity` pattern is the one the backlog itself flags (🔑) as reusable by later epics that need their own audit trail.
