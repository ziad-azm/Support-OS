# Story 23 — Status & Escalation (Story: SUPPORTOS-35)

## Prerequisites

- **Story 12 (TKT-1) completed** — the intake names it (`Dependencies: TKT-1`). `Ticket.status` (`backend/apps/tickets/models.py` lines 35-39, 88-90) has existed as a bare `TextChoices` placeholder since Story 12, with **no transition validation and no status-changing UI** — Story 12's own scope table and the `ticket-management/00-overview.md` "Scope boundary" table both name this story (`TKT-4`, line 27) as the owner of exactly that gap. `TICKET_STATUSES` (`frontend/src/features/tickets/types/ticket.ts` line 2) already mirrors the four values.
- **`status` is currently writable on `TicketSerializer` but never actually written by any client.** Verified: `TicketInput`/`toTicketInput` (`frontend/src/features/tickets/components/TicketFormPage.tsx` lines 61-69) never includes `status` — Story 12's own docstring on `TicketInput` says so directly (`ticket.ts` lines 25-27, "`status` is excluded on purpose... TKT-4 owns it"). So moving `status` into `read_only_fields` in this story is **not a behaviour change for any existing caller** — it only closes off the same latent full-payload-PATCH hazard Story 22 already closed for `assigned_agent`, extended here to a second field.
- **This story follows the exact shape Story 22 (`TKT-3`, Assignment) established, twice.** (1) `apps/tickets/assignment.py` is a small, pure helper module owning one business rule, imported by `views.py` — this story's `apps/tickets/status.py` (transition validation) is the same shape, one app closer to home (no cross-app import needed, since `status` is ticket-domain data living in the same app). (2) `Ticket.assigned_agent`/`TicketSerializer.assigned_agent` becoming read-only, writable only through `POST .../assign/`, is the precedent `CONVENTIONS.md` §23 already generalised as *"a field that has its own action endpoint should be read-only on the resource's serializer"* — `status` and the two new `escalated`/`escalated_at` fields all follow that same rule in this story.
- **The intake's two "endpoints" plural for escalation, one control for status, one confirm-gated action for escalation.** Read literally: *"Task: Status/escalation API — status enum with valid transitions **+** escalation level/flag endpoints"* (two things) and *"Task: Status/escalation UI — status control **+** escalate action using shared confirm dialog"* — grammatically, "using shared confirm dialog" attaches to the nearer noun phrase, "escalate action", not "status control". This story therefore builds the status control as an immediate-mutation `Select` (`TicketAssigneeControl`'s exact shape, Story 22) with **no** confirm dialog, and gates only the escalate/de-escalate button behind `useConfirm` — the one component in this codebase already wired for exactly that (`frontend/src/shared/ui/confirm/useConfirm.ts`, used today by `TicketDetailPage`'s delete button, lines 33-42).
- **"Escalation level/flag" is implemented as a flag, not a multi-tier level.** The UI task says "escalate **action**" (singular, one button), not "select an escalation level" — and `SLA-3` (`SupportOs backlog.MD` lines 476-481, *"Escalation Rules"*, depending on the not-yet-built `SLA-0` Celery foundation) is the backlog story that owns **automatic**, rule-driven escalation; this story is the **manual** signal an agent raises by hand. A boolean `Ticket.escalated` plus a `Ticket.escalated_at` timestamp (set when escalated, cleared when de-escalated) gives "transparent progress" (the intake's own outcome wording) without inventing a tier system `SLA-3` may later define differently. Documented here as a deliberate scope call, not left ambiguous.
- **No new permission constants — same reuse `TKT-2`/`TKT-3` already established.** `backend/apps/core/permissions.py` lines 26-32 confirm `TICKETS_VIEW`/`TICKETS_MANAGE` already exist. Status changes and escalation are ticket-workflow mutations, gated `TICKETS_MANAGE` exactly like `assign` (Story 22); reading them is covered by the existing `TICKETS_VIEW` gate on `retrieve`/`list` — no new endpoint needs its own read permission the way `assignable-agents` did, because status/escalation are plain fields on the existing ticket payload, not a separate resource.
- **`@action` mechanics, `permission_map` completeness, and the explicit-value-never-omission rule are already established, not new.** Story 20's `CustomerViewSet.timeline` was the first `@action`; Story 22's `assign`/`assignable_agents` are the second and third, and this story's `set_status`/`escalate` are the fourth and fifth. `permission_map` is keyed by the action's own method name, and a missing entry falls through to authenticated-only rather than denying (`CONVENTIONS.md` §22) — both new entries are load-bearing, see `## Migration / Rollback`. The explicit-value rule (§23: a nullable/stateful field is changed by sending its new value explicitly, never inferred from an omitted key) is why both `set_status` and `escalate` require their body key present, exactly like `assign` requires `assigned_agent` present.

---

## Story Goal

1. **Status API**: `Ticket.status` becomes read-only on `TicketSerializer`; a new `POST /api/tickets/<id>/status/` action (gated `tickets.manage`) changes it, validated against a fixed transition graph in `apps/tickets/status.py` — an illegal transition (including a no-op "change" to the same status) is a `400`, not a silent no-op.
2. **Escalation API**: two new nullable/boolean fields, `Ticket.escalated` (bool, default `False`) and `Ticket.escalated_at` (nullable timestamp), both read-only on the serializer; a new `POST /api/tickets/<id>/escalate/` action (gated `tickets.manage`) toggles them via an explicit `{"escalated": true|false}` body — re-sending the ticket's current escalation state is a `400`, mirroring the status action's no-op rejection.
3. **Status control UI**: an immediate-mutation `Select` on the ticket detail page (`TicketStatusControl`, mirroring `TicketAssigneeControl`), visible to `tickets.view`, editable only under `<Can permission="tickets.manage">`, offering only the current status plus its valid next statuses.
4. **Escalate action UI**: an "Escalation" row on the ticket detail page showing a `Badge` (visible to everyone with `tickets.view`) plus an Escalate/De-escalate `Button` (only under `tickets.manage`) that runs through `useConfirm` before firing.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/tickets/status.py::VALID_TRANSITIONS`/`is_valid_transition` | "status enum with valid transitions" (intake) — a fixed, hand-authored graph, not a general workflow engine. |
| `POST .../status/`, `status` read-only on the serializer | Single-writer invariant (§23), extended from `assigned_agent` (Story 22) to `status`. |
| `Ticket.escalated`/`escalated_at`, `POST .../escalate/` | "escalation level/flag endpoints" (intake), implemented as a manual flag — see `## Prerequisites` for why not a tier system. |
| `TicketStatusControl` (immediate `Select`, no confirm) | Mirrors `TicketAssigneeControl` (Story 22) exactly — a single control firing a mutation is not a form (§23). |
| Escalate/de-escalate `Button` + `useConfirm` | "escalate action using shared confirm dialog" (intake), read literally — see `## Prerequisites`. |

**Not here, and why:**

- **No automatic/rule-based escalation.** `SLA-3` (`SupportOs backlog.MD:476-481`) owns that, and depends on `SLA-0`'s not-yet-built Celery foundation (line 460). This story is the manual flag `SLA-3` can later set programmatically through the same field.
- **No escalation *level* (tiers, severity numbers).** See `## Prerequisites` — a flag is what the intake's UI task ("escalate action", singular) actually describes; `SLA-3` is free to add a level field later without this story pre-empting its shape.
- **No status or escalation filter/column on the ticket list.** Unlike Story 18 (category/priority filters) and Story 22 ("Only my tickets"), the intake's UI task for this story names only the detail page ("status control + escalate action"), not the list. The existing `status` list column (Story 12) is unaffected and keeps showing live data through the same `TicketSerializer.status` field, now read via `GET` rather than a client-editable one.
- **No status/escalation change notification or activity log entry.** `TKT-5` (Ticket History) owns the activity log — "TicketActivity log ... change logging (status/assignment/replies)" (`SupportOs backlog.MD` line 347) explicitly includes status changes as its own future work.
- **No reopening a `closed` ticket.** `closed` is a terminal state in the transition graph this story defines (see `## Backend Tasks` task 2) — a closed ticket that needs further work becomes a new ticket, the same implicit rule most support-ticket systems use. If this needs to change later, it is a one-line edit to `VALID_TRANSITIONS`, not a redesign.

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-35/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 336-341 (`STORY (TKT-4) — Status & Escalation`), plus lines 452-481 (`EPIC 5.5`/SLA foundation, `SLA-3` "Escalation Rules") — the downstream automatic-escalation story this one must not pre-empt, and lines 343-348 (`TKT-5`, Ticket History) — the future activity-log consumer of status/escalation changes.
3. `backend/apps/tickets/models.py` (101 lines, after Story 22) — `Ticket.Status`/`Ticket.Priority` (`TextChoices`, lines 35-45), the `assigned_agent` field's comment block (lines 74-87) as the shape task 1's `escalated`/`escalated_at` comment follows, and `priority` (lines 91-93) directly after which the new fields are inserted.
4. `backend/apps/tickets/views.py` (148 lines, after Story 22) — `permission_map` (lines 43-55), `get_queryset`'s `priority` branch (lines 82-86) as the "present-but-malformed is still a 400" pattern task 4's validation reuses, and both existing `@action`s — `assignable_agents` (lines 101-113) and `assign` (lines 115-148) — as the exact shape `set_status`/`escalate` follow: explicit-key-required, `ValidationError` with a field-keyed message, `self.get_object()` + `save(update_fields=[...])` + `Response(self.get_serializer(ticket).data)`.
5. `backend/apps/tickets/serializers.py` (58 lines, after Story 22) — `TicketSerializer.Meta.fields`/`read_only_fields` (lines 39-58) — `status` moves into `read_only_fields` here the same way `assigned_agent` did in Story 22; `escalated`/`escalated_at` need **no** dotted-source field declaration (plain scalars, unlike `assigned_agent_name`) — DRF derives their type from the model field directly.
6. `backend/apps/tickets/assignment.py` (Story 22, 40 lines) — the placement/shape precedent for `apps/tickets/status.py`: a small pure-function helper module, imported by `views.py`, owning one business rule. This story's version needs no cross-app import note (it imports only `.models`, same app).
7. `backend/apps/tickets/admin.py` (40 lines, after Story 22) — `TicketAdmin.list_display`/`list_filter` (lines 27-37), which task 1 extends with `escalated` the same way Story 22 extended it with `assigned_agent`.
8. `backend/apps/tickets/migrations/0004_ticket_assigned_agent.py` — the latest tickets migration; this story's migration depends on it.
9. `backend/apps/core/serializers.py` (20 lines) — `BaseModelSerializer.Meta.read_only_fields = ("id", "created_at", "updated_at")`, the tuple `status`/`escalated`/`escalated_at` are appended to, same as `assigned_agent` in Story 22.
10. `backend/apps/core/permissions.py` lines 26-32 (`Permissions`) — confirms `TICKETS_VIEW`/`TICKETS_MANAGE` already exist and no new constant is needed.
11. `backend/apps/tickets/urls.py` (18 lines) — the `SimpleRouter`; **confirm no edit is needed** (both new actions are `detail=True` and router-generated, exactly like `assign`).
12. `frontend/src/features/tickets/types/ticket.ts` (38 lines, after Story 22) — `TICKET_STATUSES`/`TicketStatus` (lines 1-3), `Ticket` (lines 8-23), and `TicketInput`'s docstring (lines 25-31) explaining why `status` is already excluded from the write shape — `escalated`/`escalated_at` join `assigned_agent`/`assigned_agent_name` in that same "on `Ticket`, never on `TicketInput`" category.
13. `frontend/src/features/tickets/components/TicketAssigneeControl.tsx` (67 lines, Story 22) — read in full: the exact shape `TicketStatusControl` copies (a plain `Select`, `useMutation`, disabled while pending, success toast, no confirm dialog) — everything task 8 changes is the value source (a static transition map, not a queried agent list) and the removal of the `agentsQuery`/`UNASSIGNED`-sentinel machinery, which a status field does not need (no "unset" state for `status`).
14. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (136 lines, after Story 22) — the `<dl>` grid's status row (lines 89-94) task 9 replaces, the `assignedAgent` row immediately above it (lines 71-88) as the `<Can>`+`fallback` pattern to copy, and `handleDelete`/the delete `Button` (lines 33-42, 115-122) as the `useConfirm` + mutation shape `handleToggleEscalation` copies.
15. `frontend/src/shared/ui/confirm/types.ts` (11 lines) — `ConfirmOptions` (`title`, optional `description`/`confirmLabel`/`cancelLabel`/`destructive`) — the escalate/de-escalate confirm calls use only `title`/`description`.
16. `frontend/src/shared/ui/primitives/button.tsx` lines 21-30 — confirms `size: 'sm'` exists (already used by Story 22's `Switch`/`Select` triggers; this is its first use on a `Button` in `tickets`).
17. `frontend/src/features/tickets/api/useTicketMutations.ts` (46 lines, after Story 22) — `useAssignTicket` (lines 40-46) as the exact shape `useSetTicketStatus`/`useEscalateTicket` follow: prefix-wide `ticketKeys.all` invalidation, no scoped exception (§23's default, same reasoning Story 22 gave — the list's `status` column must reflect a status change immediately, and any future status-based filter would need the same shift-aware invalidation `assigned_to_me` already gets).
18. `frontend/src/features/tickets/locales/en.json`/`ar.json` (81 lines each, after Story 22) — the `assign` block (lines 50-53) as the shape the new `status`/`escalation` blocks follow, and `fields.status` (already present) which the new `fields.escalation` key sits beside.
19. `CONVENTIONS.md` (1160 lines) — §22 (`permission_map` completeness), §23 (feature module conventions — Story 22's paragraph, appended after Story 21's, is the most recent; this story's own paragraph appends after it).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Status enum with valid transitions.** | Intake, task 1 | `apps/tickets/status.py::VALID_TRANSITIONS`/`is_valid_transition`; `TicketViewSet.set_status`. |
| **Escalation level/flag endpoints.** | Intake, task 1 | `Ticket.escalated`/`escalated_at`; `TicketViewSet.escalate`. |
| **Status control, reusing authorization helpers.** | Intake, task 2 | `TicketStatusControl` under `<Can permission="tickets.manage">`, fallback to the existing `Badge`. |
| **Escalate action using shared confirm dialog.** | Intake, task 2 | `TicketDetailPage.handleToggleEscalation` calls `useConfirm` before mutating; see `## Prerequisites` for why the status control itself does not. |
| **A ticket can only move to a status the graph allows from its current one.** | This story's design | `is_valid_transition`, called by `set_status` before saving. |
| **Re-stating the current status or escalation state is rejected, not a silent no-op.** | This story's design, for symmetry with §23's explicit-value rule | `set_status`/`escalate` both compare the requested value against the current one first. |
| **`status`/`escalated`/`escalated_at` are written only through their actions, never through a ticket edit.** | §23 (Story 22's rule, extended) | `read_only_fields` on `TicketSerializer`. |
| **Changing status or escalation is an explicit value, never an omitted key.** | §23's explicit-value rule (Story 10/18/22) | `set_status`/`escalate` both require their body key present; a missing key is a `400`. |
| Wire format is `snake_case` end to end; the UI translates, the API sends values. | §12 | `status`, `escalated`, `escalated_at`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`/`TICKETS_MANAGE`. |

---

## Backend Tasks

### 1 — The `escalated`/`escalated_at` fields

**File: `backend/apps/tickets/models.py`** — add two fields to `Ticket`, directly after `priority` (line 93), and extend the class docstring:

```python
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `priority`/`category` (Story 18, TKT-2), `assigned_agent` (Story 22,
    TKT-3), and `status`/`escalated` (Story 23, TKT-4) are all real now.
    Only TKT-5's activity history remains unimplemented.
    """
```

```python
    # A manual signal, not the automatic rule-driven escalation SLA-3 will
    # add later (SupportOs backlog.MD:476-481) — that story depends on a
    # Celery foundation (SLA-0) that does not exist yet, and can drive this
    # SAME field once it does. A flag, not a tier/level: the intake's UI
    # task says "escalate action" (one button), not "choose a level". See
    # Story 23 `## Prerequisites`.
    escalated = models.BooleanField(_("escalated"), default=False)
    # Set when `escalated` becomes True, cleared to None when it becomes
    # False — written only through `TicketViewSet.escalate`, never directly.
    escalated_at = models.DateTimeField(_("escalated at"), null=True, blank=True)
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations tickets
```

Expect **one** new file (`apps/tickets/migrations/0005_ticket_escalated_ticket_escalated_at.py` or Django's equivalent name) containing two `AddField` operations, depending on `("tickets", "0004_ticket_assigned_agent")`. **No new permission-grant migration** — see `## Prerequisites`. **No migration needed for `status`** — `Ticket.Status` itself is unchanged; only its read/write surface on the serializer changes (task 3).

**File: `backend/apps/tickets/admin.py`** — add `escalated` to `TicketAdmin`:

```python
    list_display = (
        "subject",
        "customer",
        "category",
        "assigned_agent",
        "status",
        "priority",
        "escalated",
        "created_at",
    )
    list_filter = ("status", "priority", "category", "assigned_agent", "escalated")
```

Everything else in `admin.py` is unchanged.

---

### 2 — The status-transition helper

**Create file: `backend/apps/tickets/status.py`**

```python
"""Which ticket status transitions are legal — TKT-4.

Same shape as `apps/tickets/assignment.py` (Story 22): a small, pure
business-rule helper, imported by `views.py`. No cross-app import note
needed here — `status` is ticket-domain data living in this same app.

The graph is hand-authored, not derived from `Ticket.Status`'s declaration
order, because "next status" is a product decision, not an artifact of how
the choices happen to be listed. `closed` is deliberately terminal — see
Story 23 `## Story Goal`, "What this story does... not".
"""

from .models import Ticket

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    Ticket.Status.OPEN: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.IN_PROGRESS: frozenset(
        {Ticket.Status.OPEN, Ticket.Status.RESOLVED, Ticket.Status.CLOSED}
    ),
    Ticket.Status.RESOLVED: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.CLOSED: frozenset(),
}


def is_valid_transition(current: str, new: str) -> bool:
    """True if `current -> new` is an allowed move. `current == new` is
    always False — re-stating the current status is rejected by the caller
    as a no-op, not treated as a legal (empty) transition."""
    return new in VALID_TRANSITIONS.get(current, frozenset())
```

---

### 3 — Serializer

**File: `backend/apps/tickets/serializers.py`** — `Meta.fields` gains `"escalated"` and `"escalated_at"` (after `priority`):

```python
        fields = (
            "id",
            "subject",
            "description",
            "customer",
            "customer_name",
            "category",
            "category_name",
            "assigned_agent",
            "assigned_agent_name",
            "status",
            "priority",
            "escalated",
            "escalated_at",
            "created_at",
            "updated_at",
        )
        # status/escalated/escalated_at are written ONLY through
        # TicketViewSet.set_status/escalate. Read-only here for the same
        # reason assigned_agent is (Story 22): a full-payload PATCH from the
        # edit form must never change them as a side effect. See Story 23
        # `## Prerequisites`.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "assigned_agent",
            "status",
            "escalated",
            "escalated_at",
        )
```

No new field declarations needed — `status` (already a plain `CharField` derived from the model) and `escalated`/`escalated_at` (plain `BooleanField`/`DateTimeField`, no dotted source) all use DRF's default derivation, unlike `assigned_agent_name`'s explicit dotted-source declaration.

---

### 4 — Views: the two actions

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from django.utils import timezone

from .status import is_valid_transition
```

(`action`, `Response`, `ValidationError`, `Permissions`, `_` are already imported.)

Add both `permission_map` entries to `TicketViewSet`:

```python
        # Both keyed by the @action's own method name (verified in Story 20,
        # reused in Story 22). A missing entry does NOT deny — it falls
        # through to authenticated-only. See Story 23 `## Migration / Rollback`.
        "set_status": Permissions.TICKETS_MANAGE,
        "escalate": Permissions.TICKETS_MANAGE,
```

Append both actions to `TicketViewSet`, after the existing `assign` action:

```python
    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        """Change a ticket's status along a valid transition — TKT-4.

        `status` must be present in the body — an omitted key is a 400, the
        same explicit-value rule §23 uses for `assign`'s `assigned_agent`.
        Re-sending the ticket's current status is also a 400: "no-op" is not
        a transition. See `apps/tickets/status.py` for the graph.
        """
        if "status" not in request.data:
            raise ValidationError({"status": [_("This field is required.")]})

        new_status = request.data.get("status")
        if new_status not in Ticket.Status.values:
            raise ValidationError({"status": [_("Must be a valid status.")]})

        ticket = self.get_object()
        if new_status == ticket.status:
            raise ValidationError({"status": [_("Ticket is already in this status.")]})
        if not is_valid_transition(ticket.status, new_status):
            raise ValidationError(
                {"status": [_("Cannot change status from %(current)s to %(new)s.")
                             % {"current": ticket.status, "new": new_status}]}
            )

        ticket.status = new_status
        ticket.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        """Escalate or de-escalate a ticket — TKT-4. A manual flag, not
        SLA-3's future automatic escalation — see Story 23 `## Prerequisites`.

        `escalated` must be present and a real boolean — an omitted key or a
        truthy-but-not-boolean value (e.g. the string `"true"`) is a 400.
        Re-sending the ticket's current escalation state is also a 400.
        """
        if "escalated" not in request.data:
            raise ValidationError({"escalated": [_("This field is required.")]})

        escalated = request.data.get("escalated")
        if not isinstance(escalated, bool):
            raise ValidationError({"escalated": [_("Must be true or false.")]})

        ticket = self.get_object()
        if escalated == ticket.escalated:
            raise ValidationError(
                {"escalated": [_("Ticket already has this escalation state.")]}
            )

        ticket.escalated = escalated
        ticket.escalated_at = timezone.now() if escalated else None
        ticket.save(update_fields=["escalated", "escalated_at", "updated_at"])
        return Response(self.get_serializer(ticket).data)
```

`save(update_fields=[...])` includes `updated_at` for the same `auto_now` reason Story 22's `assign` does.

**No `apps/tickets/urls.py` change** (both routes are router-generated, `detail=True`, exactly like `assign`). Endpoints: `POST /api/tickets/<id>/status/`, `POST /api/tickets/<id>/escalate/`.

---

## Frontend Tasks

### 5 — Types

**File: `frontend/src/features/tickets/types/ticket.ts`** — add two fields to `Ticket` (after `priority`):

```ts
  escalated: boolean
  escalated_at: string | null
```

Add a status-transition map, mirroring `apps/tickets/status.py::VALID_TRANSITIONS` — placed after `TicketStatus`:

```ts
/**
 * Mirrors `apps/tickets/status.py::VALID_TRANSITIONS` verbatim. Duplicated
 * here the same way `TICKET_STATUSES` already duplicates `Ticket.Status`
 * (§3) — the backend remains authoritative and re-validates on every
 * `POST .../status/`; this only keeps `TicketStatusControl`'s picker from
 * offering a transition the server would reject.
 */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['open', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
}
```

Extend `TicketInput`'s docstring with one sentence (`status` is already documented as excluded — add `escalated`/`escalated_at` to the same sentence):

```ts
/** … `assigned_agent`, `status`, `escalated`, and `escalated_at` are all
 * absent: each is read-only on the serializer and written only through its
 * own `POST /tickets/<id>/…` action, so a full-payload create/edit can
 * never move any of them as a side effect. See Story 23 `## Prerequisites`. */
```

---

### 6 — Status API layer

**Create file: `frontend/src/features/tickets/api/setTicketStatus.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket, TicketStatus } from '../types/ticket'

/** `status` is always sent explicitly. The backend rejects an omitted key,
 * an unrecognised value, or a no-op (same status) with a 400. */
export function setTicketStatus(id: number, status: TicketStatus): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${id}/status/`, { status })
}
```

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — append (add `import { setTicketStatus } from './setTicketStatus'` to the existing import block):

```ts
export function useSetTicketStatus(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: TicketStatus) => setTicketStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
```

(Add `TicketStatus` to the existing `import type { TicketInput } from '../types/ticket'` line.)

---

### 7 — Escalation API layer

**Create file: `frontend/src/features/tickets/api/escalateTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

/** `escalated` is always sent explicitly — the backend rejects an omitted
 * key or a re-statement of the current state with a 400. */
export function escalateTicket(id: number, escalated: boolean): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${id}/escalate/`, { escalated })
}
```

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — append (add `import { escalateTicket } from './escalateTicket'`):

```ts
export function useEscalateTicket(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (escalated: boolean) => escalateTicket(id, escalated),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
```

---

### 8 — The status control

**Create file: `frontend/src/features/tickets/components/TicketStatusControl.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSetTicketStatus } from '../api/useTicketMutations'
import { TICKET_STATUS_TRANSITIONS } from '../types/ticket'
import type { TicketStatus } from '../types/ticket'

/**
 * A plain `Select` driving a mutation directly, exactly like
 * `TicketAssigneeControl` (Story 22) — no confirm dialog; only the escalate
 * action uses one (`## Prerequisites`). Options are the current status plus
 * whatever `TICKET_STATUS_TRANSITIONS` allows from it, so the picker cannot
 * offer an illegal transition — the backend still re-validates via
 * `apps/tickets/status.py::is_valid_transition` against a hand-crafted
 * request. Rendered only inside `<Can permission="tickets.manage">`.
 */
export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: number
  status: TicketStatus
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const mutation = useSetTicketStatus(ticketId)

  const options: readonly TicketStatus[] = [status, ...TICKET_STATUS_TRANSITIONS[status]]

  function onValueChange(next: string) {
    if (next === status) return
    mutation.mutate(next as TicketStatus, {
      onSuccess: () => toast({ tone: 'success', message: t('status.updated') }),
      // A failure is already toasted by the shared mutation error handler
      // — CONVENTIONS.md §21.
    })
  }

  return (
    <Select value={status} onValueChange={onValueChange} disabled={mutation.isPending}>
      <SelectTrigger aria-label={t('fields.status')} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((value) => (
          <SelectItem key={value} value={value}>
            {t(`statuses.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

---

### 9 — Ticket detail: status control and escalate action

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — extend imports:

```tsx
import { useToast } from '@/shared/ui/toast/useToast'

import { useDeleteTicket, useEscalateTicket } from '../api/useTicketMutations'
import { TicketStatusControl } from './TicketStatusControl'
```

(`useDeleteTicket` is already imported from `'../api/useTicketMutations'` — add `useEscalateTicket` to that same import, do not duplicate the line. `Can`/`Badge`/`Button`/`useConfirm` are already imported.)

Add `toast` and the escalate mutation alongside the existing hooks:

```tsx
  const { toast } = useToast()
  const deleteMutation = useDeleteTicket()
  const escalateMutation = useEscalateTicket(id)
```

Add a handler alongside `handleDelete`:

```tsx
  async function handleToggleEscalation(currentlyEscalated: boolean) {
    const confirmed = await confirm({
      title: t(currentlyEscalated ? 'escalation.deEscalateConfirmTitle' : 'escalation.escalateConfirmTitle'),
      description: t(
        currentlyEscalated ? 'escalation.deEscalateConfirmDescription' : 'escalation.escalateConfirmDescription',
      ),
    })
    if (!confirmed) return
    escalateMutation.mutate(!currentlyEscalated, {
      onSuccess: () => toast({ tone: 'success', message: t('escalation.updated') }),
    })
  }
```

Replace the existing status `<dl>` row (lines 89-94) with a `<Can>`-gated control, mirroring the `assignedAgent` row immediately above it:

```tsx
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.status')}</dt>
                      <dd>
                        <Can
                          permission="tickets.manage"
                          fallback={<Badge variant="secondary">{t(`statuses.${ticket.status}`)}</Badge>}
                        >
                          <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
                        </Can>
                      </dd>
                    </div>
```

Add a new row directly after it, before the priority row:

```tsx
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.escalation')}</dt>
                      <dd className="flex items-center gap-2">
                        {ticket.escalated ? (
                          <Badge variant="destructive">{t('escalation.escalated')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('escalation.notEscalated')}</Badge>
                        )}
                        <Can permission="tickets.manage">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={escalateMutation.isPending}
                            onClick={() => void handleToggleEscalation(ticket.escalated)}
                          >
                            {t(ticket.escalated ? 'escalation.deEscalate' : 'escalation.escalate')}
                          </Button>
                        </Can>
                      </dd>
                    </div>
```

`Can`'s `fallback` prop (a `Badge`, this time, not plain text) needs no change to `shared/` — `fallback?: ReactNode` already accepts a JSX element (`frontend/src/shared/auth/Can.tsx:9`), matching Story 22's own use of a string fallback.

---

### 10 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — one key in `fields`, one new `status` block, one new `escalation` block:

```json
  "fields": {
    …
    "escalation": "Escalation"
  },
  "status": {
    "updated": "Status updated."
  },
  "escalation": {
    "escalated": "Escalated",
    "notEscalated": "Not escalated",
    "escalate": "Escalate",
    "deEscalate": "De-escalate",
    "escalateConfirmTitle": "Escalate this ticket?",
    "escalateConfirmDescription": "This flags the ticket for prioritized attention.",
    "deEscalateConfirmTitle": "De-escalate this ticket?",
    "deEscalateConfirmDescription": "This clears the escalation flag.",
    "updated": "Escalation updated."
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "fields": {
    …
    "escalation": "التصعيد"
  },
  "status": {
    "updated": "تم تحديث الحالة."
  },
  "escalation": {
    "escalated": "مُصعَّدة",
    "notEscalated": "غير مُصعَّدة",
    "escalate": "تصعيد",
    "deEscalate": "إلغاء التصعيد",
    "escalateConfirmTitle": "هل تريد تصعيد هذه التذكرة؟",
    "escalateConfirmDescription": "سيؤدي هذا إلى تمييز التذكرة لإعطائها أولوية اهتمام.",
    "deEscalateConfirmTitle": "هل تريد إلغاء تصعيد هذه التذكرة؟",
    "deEscalateConfirmDescription": "سيؤدي هذا إلى إزالة علامة التصعيد.",
    "updated": "تم تحديث حالة التصعيد."
  },
```

No `resources.ts` change — `tickets` is already a registered namespace.

---

## Documentation Tasks

### 11 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 22's paragraph):

> **A finite set of valid state changes is a hand-authored graph in a small helper module, not inline `if`-chains in the view.** `apps/tickets/status.py::VALID_TRANSITIONS`/`is_valid_transition` (Story 23, `TKT-4`) is the same shape `apps/tickets/assignment.py` (Story 22) established for a different business rule: a pure function, imported by the viewset, easy to unit-reason-about and to extend without touching request-handling code. **Re-stating a resource's current state is rejected, not treated as a no-op success** — `TicketViewSet.set_status`/`escalate` both compare the requested value against the current one before consulting the transition graph, so "change status to what it already is" and "escalate an already-escalated ticket" are both a `400`, consistent with this project's preference for explicit, intentional writes over silently-accepted no-ops. **A frontend picker that mirrors a backend validation graph duplicates it as a plain data structure with a comment pointing at the source of truth** — `TICKET_STATUS_TRANSITIONS` (`frontend/src/features/tickets/types/ticket.ts`) is the same duplication `TICKET_STATUSES` already makes of `Ticket.Status` (§3), narrowing what the UI *offers* while the backend remains the sole enforcer of what it *accepts*.

---

## Edge Cases & Failure Modes

- **`POST .../status/` with the `status` key omitted is a `400`, not a no-op.** Same explicit-value rule as `assign`.
- **`POST .../status/` with an unrecognised value (e.g. `"archived"`) is a `400`** naming `status`, checked against `Ticket.Status.values` before the transition graph is even consulted.
- **`POST .../status/` re-stating the ticket's current status is a `400`**, not a silent `200`. Deliberate — see `## Product rules`.
- **`POST .../status/` attempting an illegal transition (e.g. `open` → `resolved`, skipping `in_progress`; or anything → `closed` → anything, since `closed` is terminal) is a `400`** naming both the current and requested status in the message.
- **`POST .../escalate/` with the `escalated` key omitted, or present but not a JSON boolean (e.g. the string `"true"`, or `1`), is a `400`.** `isinstance(escalated, bool)` is intentionally strict — Python's `bool` is a subtype of `int`, but a client sending `1` almost always means "I serialized this wrong," and silently accepting it would let `escalated: 2` through too (truthy, but not a real boolean).
- **`POST .../escalate/` re-stating the ticket's current escalation state is a `400`.** Same no-op rejection as `status`.
- **De-escalating clears `escalated_at` back to `null`, it does not preserve the original escalation timestamp.** If a ticket is escalated, de-escalated, and escalated again, `escalated_at` reflects only the most recent escalation — there is no escalation history in this story (`TKT-5` owns any such log).
- **A ticket's `status`/`escalated`/`escalated_at` survive a normal ticket `PATCH` unchanged** — DRF silently drops read-only fields from `validated_data`; verified explicitly in `## Verification Steps`, the same check Story 22 ran for `assigned_agent`.
- **The status `Select`'s options never include an item the backend would reject** — `TICKET_STATUS_TRANSITIONS[status]` always matches `apps/tickets/status.py::VALID_TRANSITIONS[status]` by construction (both hand-authored from the same design, not generated from one source) — a future edit to one **must** update the other, called out explicitly in the new `CONVENTIONS.md` §23 paragraph.
- **A ticket already in `closed` shows a status `Select` with only "Closed" as an option** (no valid transitions out of it) — the control still renders (it is not disabled or hidden), it simply offers nothing to change to. Selecting the already-selected item is a no-op at the UI layer (`onValueChange`'s own `if (next === status) return` guard), never reaching the network.
- **Concurrent status/escalation changes are last-write-wins**, no optimistic locking anywhere in this project — same accepted limitation Story 22 documented for `assign`.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 1's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: every legal transition, every illegal transition (including the no-op and the `closed`-is-terminal case), the two malformed-body rejections for `status`, the escalate/de-escalate cycle plus its no-op and malformed-body rejections, permission gating (`403` without `tickets.manage`, `401` with no token), and confirmation that a ticket `PATCH` cannot move `status`/`escalated`/`escalated_at` — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including both new components.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**One migration**, generated by task 1: two `AddField` operations for `Ticket.escalated`/`Ticket.escalated_at`. Depends on `0004_ticket_assigned_agent`. **No migration for `status`** — its column and choices are unchanged; only the serializer's `read_only_fields` and a new action change its write path.

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0004` to unapply, if reverting only this story's migration.

**Half-applied states to avoid:**

- **`escalated`/`escalated_at` added without `blank=True`/`null=True` on `escalated_at`.** `escalated_at` must stay nullable (a non-escalated ticket has no timestamp); `escalated` needs no nullability (it has a real `default=False`), but a missing default on either field would prompt `makemigrations` for a one-off value and break a non-interactive run — the same trap Story 18/21/22 all documented.
- **`permission_map` missing `"set_status"` or `"escalate"`.** Does **not** deny — falls through to authenticated-only, so any signed-in user (including one with only `customers.view`) could change a ticket's status or escalation state. The highest-risk mistake in this story; `## Verification Steps` checks it explicitly.
- **`status`/`escalated`/`escalated_at` left writable on `TicketSerializer`** (not added to `read_only_fields`). No immediate breakage — the harm is latent, landing the day any of the three is added to `TicketInput`. `## Verification Steps` asserts a `PATCH` cannot move any of them.
- **`set_status` comparing against `Ticket.Priority.values` instead of `Ticket.Status.values`** (an easy copy-paste error from the neighbouring `priority` filter code task 4's context file names) — would accept a priority string as a "valid" status or reject every real status.
- **`is_valid_transition` consulted before the no-op (`new_status == ticket.status`) check**, rather than after — since `VALID_TRANSITIONS` never lists a status as its own valid next state, the order does not change the outcome here, but reversing it would make the no-op message ("already in this status") harder to distinguish from a generic "illegal transition" message. Keep the no-op check first, as written in task 4.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces one file with two `AddField` operations; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Every legal status transition works, in sequence, on one ticket.** Create a customer and a ticket (default status `open`). With a `tickets.manage` token: `POST .../status/` `{"status": "in_progress"}` → `200`, `status` is `in_progress`. `{"status": "resolved"}` → `200`. `{"status": "in_progress"}` (reopen from resolved) → `200`. `{"status": "closed"}` → `200`. Confirm `GET /api/tickets/<id>/` agrees after each step.
5. **Illegal transitions are all rejected.** On a fresh `open` ticket: `{"status": "resolved"}` (skips `in_progress`) → `400` naming `status`. On the `closed` ticket from step 4: `{"status": "open"}` → `400` (closed is terminal). `{"status": "open"}` on an `open` ticket (no-op) → `400`. `{"status": "not_a_status"}` → `400`. Omitted body (`{}`) → `400`.
6. **Escalate/de-escalate cycle and its rejections.** On a fresh ticket (`escalated: false`): `POST .../escalate/` `{"escalated": true}` → `200`, `escalated: true` and `escalated_at` is a real timestamp. Re-sending `{"escalated": true}` → `400` (no-op). `{"escalated": false}` → `200`, `escalated: false` and `escalated_at: null`. `{"escalated": "true"}` (string, not boolean) → `400`. Omitted body (`{}`) → `400`.
7. **Permission gating.** With a `customers.view`-only token (reuse the throwaway-role technique from Story 20/21/22): `POST .../status/` with a valid body → `403`. `POST .../escalate/` with a valid body → `403`. With no token → `401` on both.
8. **A ticket `PATCH` cannot change `status`, `escalated`, or `escalated_at`.** With a ticket at `in_progress`, `escalated: true`: `PATCH /api/tickets/<id>/` `{"status": "closed", "escalated": false}` → `200`, and all three fields are **unchanged** — DRF silently drops read-only fields. Also confirm a normal edit `PATCH` (`{"subject": "Renamed"}`) leaves them intact.
9. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as a `tickets.manage` user:
   - `/tickets/<id>` — the Status row shows a `Select` offering only the current status and its valid next statuses; changing it toasts "Status updated." and the value persists on reload.
   - The Escalation row shows "Not escalated" and an "Escalate" button. Clicking it opens the confirm dialog; confirming toasts "Escalation updated." and the badge switches to "Escalated" (destructive styling) with the button now reading "De-escalate".
   - Clicking "De-escalate" and confirming clears the badge back to "Not escalated".
   - Sign in as a user with `tickets.view` but **not** `tickets.manage` — the Status row shows a plain `Badge`, no `Select`; the Escalation row shows the badge but no button.
   - Switch to Arabic — every label translates, including both confirm dialogs, and the controls read correctly in RTL.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
11. **Clean up** every ticket and customer created for steps 4-8, plus any throwaway role/user reused from a prior story's verification.

---

## Done Criteria

- [ ] `Ticket.escalated`/`Ticket.escalated_at` — `BooleanField(default=False)` / nullable `DateTimeField`; class docstring updated to name TKT-4 as done.
- [ ] One migration: two `AddField` operations, depending on `0004_ticket_assigned_agent`. **No new permission-grant migration, no migration for `status`.**
- [ ] `TicketAdmin.list_display`/`list_filter` gain `escalated`.
- [ ] `apps/tickets/status.py` — `VALID_TRANSITIONS` (hand-authored graph, `closed` terminal) and `is_valid_transition`.
- [ ] `TicketSerializer` — `escalated`/`escalated_at` in `fields`; `status`/`escalated`/`escalated_at` all in `read_only_fields` alongside `assigned_agent`.
- [ ] `TicketViewSet` — `permission_map` gains `"set_status": TICKETS_MANAGE` and `"escalate": TICKETS_MANAGE`.
- [ ] `TicketViewSet.set_status` (`detail=True`, `POST`, `url_path="status"`) — requires `status` present, validates against `Ticket.Status.values` then `is_valid_transition`, rejects a no-op.
- [ ] `TicketViewSet.escalate` (`detail=True`, `POST`, `url_path="escalate"`) — requires `escalated` present and a real boolean, rejects a no-op, sets/clears `escalated_at`.
- [ ] **No `apps/tickets/urls.py` change, no new permission constant, no new dependency.**
- [ ] `types/ticket.ts` — `escalated`/`escalated_at` on `Ticket`, **not** on `TicketInput`; `TICKET_STATUS_TRANSITIONS` added, commented as mirroring `apps/tickets/status.py`.
- [ ] `api/setTicketStatus.ts`, `api/escalateTicket.ts`, and `useSetTicketStatus`/`useEscalateTicket` in `useTicketMutations.ts` (prefix-wide invalidation).
- [ ] `TicketStatusControl.tsx` — a plain `Select` (not `useAppForm`, no confirm dialog), options limited to current + valid-next statuses, disabled while pending, success toast.
- [ ] `TicketDetailPage.tsx` — Status row: the control under `tickets.manage`, plain `Badge` otherwise, via `Can`'s existing `fallback` prop. New Escalation row: a `Badge` visible to everyone, an Escalate/De-escalate `Button` under `tickets.manage` that runs through `useConfirm` before mutating.
- [ ] `en.json`/`ar.json` — `fields.escalation`, the new `status` block, and the new `escalation` block; identical key sets in both languages, **no `resources.ts` change**.
- [ ] `CONVENTIONS.md` §23 gains the state-transition-graph-as-helper-module / reject-the-no-op / frontend-picker-mirrors-backend-graph paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: every legal transition in sequence (Step 4); every illegal transition including the no-op and closed-terminal cases (Step 5); the escalate/de-escalate cycle and its rejections (Step 6); `403`/`401` permission gating on both actions (Step 7); a `PATCH` unable to move any of the three fields (Step 8).
- [ ] Both languages walk through cleanly in the browser, including the `tickets.view`-only read-only variant (Step 9).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 11).
- [ ] `.squad/plans/ticket-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The remaining `ticket-management` story is **TKT-5 (Ticket History)**, depending only on `TKT-1` — and now able to log the status/assignment changes both `TKT-3` and this story introduced.
