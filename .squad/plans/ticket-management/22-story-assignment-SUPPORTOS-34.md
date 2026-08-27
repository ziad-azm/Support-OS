# Story 22 — Assignment (Story: SUPPORTOS-34)

## Prerequisites

- **Story 12 (TKT-1) and Story 09 (AUTH-2) completed** — the intake names both (`Dependencies: TKT-1, AUTH-2`). `Ticket` (`apps/tickets/models.py`, 89 lines, incl. `category` since Story 18), `TicketViewSet`/`TicketSerializer`, `Permissions`/`permissions_for`/`HasPermission` (`apps/core/permissions.py`, 101 lines), and the frontend's `useAuth`/`Can`/`hasPermission` helpers all exist and are reused. The intake's "Reuse authorization helpers" is satisfied by `Can` (frontend) and `permission_map` (backend) — nothing new is invented.
- **There is no user-listing API, and this story must not build one.** Verified: `apps/accounts/urls.py` exposes exactly four paths (`token/`, `token/refresh/`, `logout/`, `me/`) — no `UserViewSet`, no `/api/users/`. `SEC-1` (`SupportOs backlog.MD:682-684`, *"User/role admin API + UI"*) owns that. This story therefore adds a **narrow, purpose-built** read-only endpoint answering only "who can a ticket be assigned to" — the same "add a second, narrower view rather than build or widen a general resource" move `WebFormCategoriesView` made in Story 19, and the reason `USERS_VIEW` stays unused by any viewset.
- **"Assignable" mirrors `permissions_for`'s own two branches, and the query was verified live against this project's Postgres.** An agent who cannot work tickets must not be assignable, so the criterion is "holds `tickets.manage`" — which `permissions_for` resolves as *either* `is_superuser` (the documented bypass, `permissions.py:50-57`) *or* `role.permissions` containing the string. `Role.permissions` is a `JSONField`, so the role half needs a JSON containment lookup. **Verified by running it against the live database:**

  ```python
  User.objects.filter(is_active=True).filter(
      Q(is_superuser=True) | Q(role__permissions__contains=["tickets.manage"])
  )
  ```

  returned exactly `mgr@supportos.local` (role `manager`), `agent@supportos.local` (role `agent`), and the two superusers `admin@supportos.local`/`ziad@email.com` (both `role=None`) — i.e. both branches work and the superusers are correctly included despite having no role. `__contains` on a `JSONField` is Postgres-only in Django; this project is Postgres 17, so it is available here (and would need rewriting only if the database ever changed).
- **`assigned_agent` is deliberately read-only on `TicketSerializer`, writable only through the `assign` action.** This is not ceremony — it forecloses a concrete class of bug. `TicketFormPage` sends the **full** `TicketInput` on every edit (Story 12/18); if `assigned_agent` were a writable serializer field, the day someone adds it to `TicketInput` with a `null` default, every ticket edit would silently unassign the ticket. Single-writer keeps that impossible. It also matches the intake's own wording — *"assign/reassign **endpoint**"*, not "assignment field".
- **`@action(detail=False, url_path="assignable-agents")` does not collide with the `tickets/<pk>/` detail route.** The generic `{lookup}` regex (`[^/.]+`) would happily match the literal string `assignable-agents`, so the ordering is load-bearing — verified in the installed DRF: `rest_framework/routers.py` registers the **`detail=False` DynamicRoute** (`^{prefix}/{url_path}{trailing_slash}$`, lines 109-114) **before** the detail `Route` (`^{prefix}/{lookup}{trailing_slash}$`, lines 116-127). Django resolves `urlpatterns` in registration order, so `/api/tickets/assignable-agents/` hits the action, not `retrieve(pk="assignable-agents")`. `## Verification Steps` checks this explicitly rather than trusting it.
- **`@action` mechanics are already established, not new.** Story 20's `CustomerViewSet.timeline` was the project's first; both facts it verified still hold and are reused here: the router auto-generates the URL (no `urls.py` edit), and `permission_map` is keyed by the action's own **method name** (`"assign"`, `"assignable_agents"`), with a missing entry falling through to authenticated-only rather than denying. Both entries are load-bearing — see `## Migration / Rollback`.
- **`assigned_agent` is `SET_NULL`, the project's now-established pattern for a reference that must not block deleting what it points to.** Fourth use, after `Ticket.category` (Story 18) and `Note.author`/`Attachment.uploaded_by` (Story 21): deactivating or deleting an agent's account must not delete or block their tickets — the ticket simply becomes unassigned. Contrast `Ticket.customer` (`PROTECT`) and `Message.ticket` (`CASCADE`).
- **One shared `assignable_agents()` helper backs both the options endpoint and the action's validation.** The `assign` action must reject an id that is not assignable — otherwise the options endpoint is cosmetic and a hand-crafted `POST` could assign a ticket to a customers-only user. Both call the same queryset, so the two can never drift. Placed in a new `apps/tickets/assignment.py`, mirroring `apps/customers/timeline.py`'s placement (Story 20): a cross-app read lives in the app that owns the *question*, and this question ("who can work a ticket") is ticket-domain even though the rows are `accounts.User`. Same verified-safe reverse-direction import (no *model* imports across apps).
- **No new permission constants.** `assign` requires `TICKETS_MANAGE`; reading the assignable list and filtering "my tickets" require `TICKETS_VIEW` — all already granted to `admin`/`manager`/`agent` by `apps/tickets/migrations/0002_grant_ticket_permissions.py`. **No new grant migration.**

---

## Story Goal

1. **Assignment API**: a nullable `Ticket.assigned_agent` FK (`SET_NULL`), a `POST /api/tickets/<id>/assign/` action (assign, reassign, and unassign via explicit `null`) gated on `tickets.manage`, and `GET /api/tickets/assignable-agents/` (gated on `tickets.view`) listing only users who actually hold `tickets.manage`.
2. **Assignment UI & "my tickets"**: an assignee selector on the ticket detail page (visible to `tickets.view`, editable only under `<Can permission="tickets.manage">`), an `Assignee` column on the ticket list, and an **"Only my tickets"** toggle driving a new `?assigned_to_me=true` server-side filter — the personal queue the intake asks for.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `Ticket.assigned_agent` (nullable FK, `SET_NULL`) | The intake's literal ask; `SET_NULL` so an agent's account can be removed without touching their tickets. |
| `POST .../assign/` action, `assigned_agent` read-only on the serializer | "assign/reassign endpoint" (intake) + the single-writer invariant that stops a full-payload edit from silently unassigning. |
| `assignable_agents()` + `GET .../assignable-agents/` | A ticket must not be assignable to someone who cannot work it; one helper backs both the picker and the action's validation so they cannot drift. |
| `?assigned_to_me=true` filter | "agent-scoped filter … personal queue" (intake), scoped by `request.user` server-side. |
| `assigned_agent_name` column + detail row | "clear ownership" (intake) — a joined display column, not sortable, mirroring `customer_name`/`category_name`. |

**Not here, and why:**

- **No user/role admin API or UI.** `SEC-1` owns it — see `## Prerequisites`. This story adds only the narrow assignable-agents read.
- **No auto-assignment, load balancing, or round-robin.** `AGENT-4` (`SupportOs backlog.MD:471-474`, *"Assignment rules engine"*) owns that and depends on this story plus `SLA-0`.
- **No dedicated "my queue" screen with status/SLA facets.** `AGENT-1` (`SupportOs backlog.MD:413-416`, *"Agent queue API/UI"*) owns that and depends on this story. This story ships the *filter* on the existing list, not a second screen — and deliberately does **not** add a general `?assigned_agent=<id>` filter, which is `AGENT-1`'s to shape.
- **No assignment history or notification.** `TKT-5` (Ticket History) owns the activity log; no email/in-app notification exists anywhere in this project yet.
- **No status-change UI.** Still `TKT-4`'s, unchanged since Story 12's scope table.

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-34/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 329-334 (`STORY (TKT-3) — Assignment`), plus lines 413-416 (`AGENT-1`) and 471-474 (`AGENT-4`) — the two downstream stories this one unblocks and must not pre-empt.
3. `backend/apps/tickets/models.py` (89 lines, after Story 18) — `Ticket.customer` (`PROTECT`, lines 59-61) and `Ticket.category` (`SET_NULL`, lines 62-75, with the comment block explaining the three deletion behaviours) — `assigned_agent` is added directly after `category` and follows `category`'s shape.
4. `backend/apps/tickets/views.py` (80 lines, after Story 18) — `TicketViewSet.get_queryset`'s existing optional `category`/`priority` filters (lines ~57-79): the exact "absent → no filter, present-but-malformed → 400" pattern `assigned_to_me` extends; `ordering_fields`/`search_fields` (unchanged).
5. `backend/apps/tickets/serializers.py` (42 lines, after Story 18) — `TicketSerializer.category_name` (line 26, `source="category.name"`, `allow_null=True`) — the verified-safe dotted-source pattern `assigned_agent_name` copies, here traversing to a **method** (`get_full_name`) rather than a field, exactly as `NoteSerializer.author_name` already does (Story 21).
6. `backend/apps/customers/views.py` — `CustomerViewSet.timeline` (Story 20): the `@action` + `permission_map`-entry + explicit-docstring shape both new actions follow. `AttachmentViewSet.download` (Story 21) is the second precedent.
7. `backend/apps/customers/timeline.py` (Story 20) — the placement precedent for `apps/tickets/assignment.py`: a helper module in the app that owns the question, importing models from another app in the reverse direction (safe because no *model* imports across apps).
8. `backend/apps/accounts/models.py` (133 lines) — `Role.permissions` (line 56, `JSONField(default=list)`), `User.is_active`/`is_superuser`/`role` (lines 100-113), and `User.get_full_name()` (lines 128-130) — note it falls back to `self.email` when both name fields are blank, which is why the seeded users render as email addresses in `## Verification Steps`.
9. `backend/apps/core/permissions.py` lines 42-57 (`permissions_for`) — the two branches (`is_superuser` bypass, then `role.permissions`) `assignable_agents()` mirrors in SQL. Lines 26-32 confirm `TICKETS_MANAGE`/`TICKETS_VIEW` already exist and `USERS_VIEW` is unused by any viewset.
10. `backend/apps/tickets/migrations/0003_category_ticket_category.py` — the latest tickets migration; this story's depends on it. `0002_grant_ticket_permissions.py` confirms no new grant is needed.
11. `backend/apps/tickets/urls.py` (18 lines) — the `SimpleRouter`; **confirm no edit is needed here** (both actions are router-generated — see `## Prerequisites`).
12. `backend/apps/tickets/admin.py` (32 lines, after Story 18) — `TicketAdmin.list_display`/`list_filter`, which task 1 extends with `assigned_agent`.
13. `frontend/src/features/tickets/types/ticket.ts` (34 lines) — `Ticket`/`TicketInput`; `assigned_agent`/`assigned_agent_name` are added to `Ticket` only, **never** to `TicketInput` (see `## Prerequisites`).
14. `frontend/src/features/tickets/api/getCustomerOptions.ts` (14 lines) and `getCategories.ts` (Story 18) — the "own a minimal option shape, fetch it from its own endpoint" precedent `getAssignableAgents.ts` follows; `frontend/src/features/customers/api/getCustomerTimeline.ts` (11 lines, Story 20) — the `api.get<T[]>` plain-array shape (not `Page<T>`), which is what the new action returns.
15. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (117 lines, after Story 18) — the `<dl>` grid (lines 57-86) task 9 adds one row to, and the `<Can permission="tickets.manage">` block (lines 91-105) whose gating the assignee control mirrors.
16. `frontend/src/features/tickets/components/TicketListPage.tsx` (173 lines, after Story 18) — `columns` (lines 69-109) and the filter row (lines 127-154) with its `"all"`-sentinel `Select`s and page-reset `useEffect` (lines 58-60) — task 10 adds one column and one toggle, following the identical local-state-into-query-params pattern `CONVENTIONS.md` § 19 now documents.
17. `frontend/src/features/tickets/api/useTicketMutations.ts` (37 lines) — prefix-wide `ticketKeys.all` invalidation and its own docstring explaining why (the ticket list is paginated/sorted); `useAssignTicket` follows it, **not** Story 11's scoped exception.
18. `frontend/src/shared/auth/types.ts` — `AuthUser.permissions` (already flat and superuser-resolved) and `AuthContextValue.can`; `frontend/src/shared/auth/index.ts` — the curated public surface (`Can`, `useAuth`) this story imports from.
19. `frontend/src/features/tickets/locales/en.json`/`ar.json` (74 lines each) — the `fields`/`filters` blocks task 11 extends and the new `assign` block it adds.
20. `CONVENTIONS.md` § 19 (the equality-filter/local-state pattern Story 18 added — the "my tickets" toggle is its second consumer), § 22 (`permission_map` completeness), § 23 (feature module conventions — Story 21's paragraph is the most recent; this story's own addition appends after it).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`assigned_agent` + assign/reassign endpoint with permission checks.** | Intake, task 1 | `Ticket.assigned_agent`, `TicketViewSet.assign`, `permission_map["assign"] = TICKETS_MANAGE`. |
| **Assignment control + agent-scoped filter, reusing authorization helpers.** | Intake, task 2 | `TicketAssigneeControl` under `<Can permission="tickets.manage">`; `?assigned_to_me=true`. |
| **A ticket can only be assigned to someone who can work it.** | This story's design | `assignable_agents()`, called by both the options endpoint and `assign`'s validation. |
| **`assigned_agent` is written only through the action, never through a ticket edit.** | This story's design, closing a real bug class | `read_only_fields` on `TicketSerializer`; see `## Prerequisites`. |
| **Unassigning is an explicit `null`, never an omitted key.** | § 23's explicit-`null` rule (Story 10/18) | `assign` requires the `assigned_agent` key to be present; a missing key is a `400`, not an unassign. |
| **"My tickets" is scoped by `request.user` server-side, not by a client-supplied id.** | This story's design | `get_queryset`'s `assigned_to_me` branch filters on `self.request.user`. |
| **The assignee column is not sortable.** | § 19 (`ordering_fields` is the contract with `DataTable`) | `assigned_agent_name` is absent from `ordering_fields`, mirroring `customer_name`/`category_name`. |
| Wire format is `snake_case` end to end; the UI translates, the API sends values. | § 12 | `assigned_agent`, `assigned_agent_name`, `assigned_to_me`. |
| No new permission constant, no new dependency. | § 17, § 22 | Reuses `TICKETS_VIEW`/`TICKETS_MANAGE`. |

---

## Backend Tasks

### 1 — The `assigned_agent` field

**File: `backend/apps/tickets/models.py`** — add the field to `Ticket`, directly after `category` (line 75), and extend the class docstring:

```python
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `priority`/`category` (Story 18, TKT-2) and `assigned_agent` (Story 22,
    TKT-3) are real. `status` is still a placeholder pending TKT-4
    (status-transition validation, escalation); TKT-5 owns activity history.
    Neither is pre-empted here.
    """
```

```python
    # SET_NULL, nullable: the project's fourth use of this behaviour, after
    # `category` above and `Note.author`/`Attachment.uploaded_by` (Story 21).
    # Deactivating or deleting an agent's account must not delete their
    # tickets (CASCADE) or block the deletion (PROTECT) — the ticket simply
    # becomes unassigned. Written ONLY through `TicketViewSet.assign`;
    # `TicketSerializer` keeps it read-only. See Story 22 `## Prerequisites`.
    assigned_agent = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
        verbose_name=_("assigned agent"),
    )
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations tickets
```

Expect **one** new file (`apps/tickets/migrations/0004_ticket_assigned_agent.py` or Django's equivalent name) containing a single `AddField`, depending on `("tickets", "0003_category_ticket_category")` and `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`. **No new permission-grant migration** — see `## Prerequisites`.

**File: `backend/apps/tickets/admin.py`** — add `assigned_agent` to `TicketAdmin`:

```python
    list_display = (
        "subject",
        "customer",
        "category",
        "assigned_agent",
        "status",
        "priority",
        "created_at",
    )
    list_filter = ("status", "priority", "category", "assigned_agent")
```

Everything else in `admin.py` is unchanged.

---

### 2 — The assignable-agents helper

**Create file: `backend/apps/tickets/assignment.py`**

```python
"""Who can a ticket be assigned to — TKT-3.

Lives in `apps.tickets` because the *question* is ticket-domain, even
though the rows are `accounts.User`: the same placement rule
`apps/customers/timeline.py` follows (Story 20). Safe reverse-direction
import — no *model* here imports across apps.

Deliberately NOT a general user-listing API: `SEC-1` owns user admin
(`SupportOs backlog.MD:682-684`). See Story 22 `## Prerequisites`.
"""

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from apps.core.permissions import Permissions


def assignable_agents() -> QuerySet:
    """Active users who actually hold `tickets.manage`.

    Mirrors `apps.core.permissions.permissions_for`'s own two branches in
    SQL: a superuser holds every permission by bypass (and typically has
    no role at all), otherwise the role's `permissions` JSON list must
    contain the string. `__contains` on a JSONField is Postgres-only in
    Django — verified working against this project's Postgres 17, see
    Story 22 `## Prerequisites`.

    One queryset, two callers: the `assignable-agents` options endpoint and
    `TicketViewSet.assign`'s validation. Sharing it is what keeps the
    picker and the enforcement from drifting apart.
    """
    return (
        get_user_model()
        .objects.filter(is_active=True)
        .filter(
            Q(is_superuser=True)
            | Q(role__permissions__contains=[Permissions.TICKETS_MANAGE])
        )
        .select_related("role")
        .order_by("first_name", "last_name", "email")
    )
```

---

### 3 — Serializer

**File: `backend/apps/tickets/serializers.py`** — add one field and two `Meta` entries to `TicketSerializer`:

```python
    # Same verified-safe dotted-source pattern as `category_name` above and
    # `NoteSerializer.author_name` (Story 21): `allow_null=True` is what
    # makes this return `None` instead of erroring when `assigned_agent` is
    # `None`. `get_full_name` is a method, not a field — DRF's
    # `get_attribute` calls it (verified in Story 21's own use), and it
    # falls back to the user's email when both name fields are blank.
    assigned_agent_name = serializers.CharField(
        source="assigned_agent.get_full_name", read_only=True, allow_null=True
    )
```

`Meta.fields` gains `"assigned_agent"` and `"assigned_agent_name"` (after `category_name`), and:

```python
        # assigned_agent is written ONLY through `TicketViewSet.assign`.
        # Read-only here so a full-payload PATCH from the edit form can
        # never unassign a ticket as a side effect. See Story 22
        # `## Prerequisites`.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("assigned_agent",)
```

---

### 4 — Views: the two actions and the filter

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from rest_framework.decorators import action
from rest_framework.response import Response

from .assignment import assignable_agents
```

Add both `permission_map` entries to `TicketViewSet`:

```python
        # Both keyed by the @action's own method name (verified in Story 20).
        # A missing entry does NOT deny — it falls through to
        # authenticated-only. See Story 22 `## Migration / Rollback`.
        "assign": Permissions.TICKETS_MANAGE,
        "assignable_agents": Permissions.TICKETS_VIEW,
```

Add `assigned_agent` to the queryset's `select_related` so `assigned_agent_name` costs no extra query per row:

```python
    queryset = Ticket.objects.select_related("customer", "category", "assigned_agent").all()
```

`ordering_fields` is **unchanged** — `assigned_agent_name` is a joined display column, not sortable, exactly like `customer_name`/`category_name`. Extend that existing comment to name it.

Extend `get_queryset`'s filter block (after the `priority` branch, before `return queryset`):

```python
        # Scoped by request.user, never by a client-supplied id — "my
        # tickets" means the caller's own queue. Same optional-filter
        # contract as `category`/`priority` above: absent means no filter.
        # Only the exact string "true" enables it, so a typo'd value is an
        # explicit 400 rather than a silently-unfiltered list.
        assigned_to_me = self.request.query_params.get("assigned_to_me")
        if assigned_to_me:
            if assigned_to_me != "true":
                raise ValidationError({"assigned_to_me": [_('Must be "true" if present.')]})
            queryset = queryset.filter(assigned_agent=self.request.user)
```

Append both actions to `TicketViewSet`:

```python
    @action(detail=False, methods=["get"], url_path="assignable-agents")
    def assignable_agents(self, request):
        """Users a ticket can be assigned to — TKT-3. A narrow, read-only
        list, NOT a user-management API (`SEC-1` owns that). Gated on
        `tickets.view`: picking an assignee is part of working tickets, not
        of administering users, which is why this needs no `users.view`.

        `/api/tickets/assignable-agents/` does not shadow
        `/api/tickets/<pk>/` — the router registers detail=False dynamic
        routes first (verified, see Story 22 `## Prerequisites`).
        """
        agents = [
            {"id": agent.id, "name": agent.get_full_name()} for agent in assignable_agents()
        ]
        return Response(agents)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign, reassign, or unassign a ticket — TKT-3.

        `assigned_agent` must be present in the body: an id to assign, or
        an explicit `null` to unassign. An omitted key is a 400, not an
        unassign — the same explicit-`null`-never-omission rule §23
        records for every nullable field in this project.

        A non-assignable id is rejected against the SAME queryset the
        options endpoint serves (`assignment.assignable_agents`), so a
        hand-crafted POST cannot assign a ticket to someone who has no
        `tickets.manage`. See Story 22 `## Prerequisites`.
        """
        if "assigned_agent" not in request.data:
            raise ValidationError({"assigned_agent": [_("This field is required.")]})

        agent_id = request.data.get("assigned_agent")
        agent = None
        if agent_id is not None:
            try:
                agent_id = int(agent_id)
            except (TypeError, ValueError):
                raise ValidationError(
                    {"assigned_agent": [_("Must be a valid user id.")]}
                ) from None
            agent = assignable_agents().filter(pk=agent_id).first()
            if agent is None:
                raise ValidationError(
                    {"assigned_agent": [_("That user cannot be assigned tickets.")]}
                )

        ticket = self.get_object()
        ticket.assigned_agent = agent
        ticket.save(update_fields=["assigned_agent", "updated_at"])
        return Response(self.get_serializer(ticket).data)
```

`save(update_fields=[...])` includes `updated_at` because `TimeStampedModel.updated_at` is `auto_now=True` — Django only refreshes an `auto_now` field when it is in `update_fields` (or when the whole row is saved).

**No `apps/tickets/urls.py` change** (both routes are router-generated). Endpoints: `GET /api/tickets/assignable-agents/`, `POST /api/tickets/<id>/assign/`.

---

## Frontend Tasks

### 5 — Types

**File: `frontend/src/features/tickets/types/ticket.ts`** — add two fields to `Ticket` (after `category_name`) and **nothing** to `TicketInput`:

```ts
  assigned_agent: number | null
  assigned_agent_name: string | null
```

Extend `TicketInput`'s docstring with one sentence:

```ts
/** … `assigned_agent` is deliberately absent: it is read-only on the
 * serializer and written only through `POST /tickets/<id>/assign/`, so a
 * full-payload edit can never unassign a ticket. See Story 22
 * `## Prerequisites`. */
```

**Create file: `frontend/src/features/tickets/types/agentOption.ts`**

```ts
/**
 * Minimal shape for the assignee selector, mirroring the plain array
 * `GET /tickets/assignable-agents/` returns. `name` is already resolved
 * server-side by `User.get_full_name()` (which falls back to the email),
 * so the UI never composes a display name itself.
 */
export type AgentOption = {
  id: number
  name: string
}
```

---

### 6 — Assignable-agents API layer

**Create file: `frontend/src/features/tickets/api/getAssignableAgents.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { AgentOption } from '../types/agentOption'

// A plain array, not a paginated `Page<T>` — the endpoint is an @action
// returning a short curated list, the same shape
// `features/customers/api/getCustomerTimeline.ts` (Story 20) returns.
export function getAssignableAgents(): Promise<AgentOption[]> {
  return api.get<AgentOption[]>('/tickets/assignable-agents/')
}
```

**Create file: `frontend/src/features/tickets/api/useAssignableAgents.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getAssignableAgents } from './getAssignableAgents'
import { ticketKeys } from './ticketKeys'

export function useAssignableAgents() {
  return useQuery({
    queryKey: ticketKeys.resource('assignableAgents'),
    queryFn: getAssignableAgents,
  })
}
```

---

### 7 — Assign mutation

**Create file: `frontend/src/features/tickets/api/assignTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

/** `assigned_agent` is always sent explicitly — `null` unassigns. The
 * backend rejects an omitted key with a 400 rather than guessing. */
export function assignTicket(id: number, assignedAgent: number | null): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${id}/assign/`, { assigned_agent: assignedAgent })
}
```

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — append, following the same prefix-wide invalidation the file's own docstring justifies (an assignment change moves rows in and out of a `?assigned_to_me=true` list, so it is exactly the paginated-result-set-shift case):

```ts
export function useAssignTicket(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignedAgent: number | null) => assignTicket(id, assignedAgent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
```

(Add `import { assignTicket } from './assignTicket'` to the existing import block.)

---

### 8 — The assignee control

**Create file: `frontend/src/features/tickets/components/TicketAssigneeControl.tsx`**

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

import { useAssignableAgents } from '../api/useAssignableAgents'
import { useAssignTicket } from '../api/useTicketMutations'

// Radix's `Select.Item` requires a non-empty value — this sentinel stands
// in for "unassigned", mirroring `TicketFormPage`'s `CATEGORY_NONE`
// (Story 18) and the list filters' `"all"`. See CONVENTIONS.md §19.
const UNASSIGNED = 'unassigned'

/**
 * A plain `Select` driving a mutation directly — not a `useAppForm` form.
 * §20's "`useAppForm` is the only entry point" governs *forms*; this is a
 * single-control immediate action with no submit step and nothing to
 * validate client-side, the same shape `LanguageSwitcher` and the ticket
 * list's own filters use. Rendered only inside
 * `<Can permission="tickets.manage">` by its caller.
 */
export function TicketAssigneeControl({
  ticketId,
  assignedAgent,
}: {
  ticketId: number
  assignedAgent: number | null
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const agentsQuery = useAssignableAgents()
  const mutation = useAssignTicket(ticketId)

  function onValueChange(next: string) {
    mutation.mutate(next === UNASSIGNED ? null : Number(next), {
      onSuccess: () => toast({ tone: 'success', message: t('assign.updated') }),
      // A failure is already toasted by the shared mutation error handler
      // — CONVENTIONS.md §21.
    })
  }

  return (
    <Select
      value={assignedAgent === null ? UNASSIGNED : String(assignedAgent)}
      onValueChange={onValueChange}
      disabled={mutation.isPending || agentsQuery.isPending}
    >
      <SelectTrigger aria-label={t('assign.label')} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>{t('fields.unassigned')}</SelectItem>
        {(agentsQuery.data ?? []).map((agent) => (
          <SelectItem key={agent.id} value={String(agent.id)}>
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

---

### 9 — Ticket detail: show and change the assignee

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — one import, and one `<div>` in the `<dl>` grid after the category row (line 69):

```tsx
import { Can } from '@/shared/auth'

import { TicketAssigneeControl } from './TicketAssigneeControl'
```

(`Can` is already imported — do not duplicate it.)

```tsx
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.assignedAgent')}</dt>
                      <dd>
                        {/* Everyone with `tickets.view` sees WHO owns the
                            ticket; only `tickets.manage` can change it —
                            the same split the edit/delete buttons below
                            already use. */}
                        <Can
                          permission="tickets.manage"
                          fallback={ticket.assigned_agent_name ?? t('fields.unassigned')}
                        >
                          <TicketAssigneeControl
                            ticketId={ticket.id}
                            assignedAgent={ticket.assigned_agent}
                          />
                        </Can>
                      </dd>
                    </div>
```

`Can`'s `fallback` prop already exists and needs no change to `shared/` — verified: `frontend/src/shared/auth/Can.tsx:9` (`fallback?: ReactNode`, defaulted to `null` at line 19). This is its first use in the project; every prior `<Can>` call site relies on the default. **Do not widen `Can`.**

---

### 10 — Ticket list: assignee column and the "my tickets" toggle

**File: `frontend/src/features/tickets/api/getTickets.ts`** — extend the params type:

```ts
export type TicketListParams = ServerTableParams & {
  search?: string
  category?: string
  priority?: TicketPriority
  assigned_to_me?: 'true'
}
```

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`** — add state, extend the page-reset effect and the query, add one column, and add the toggle to the existing filter row:

```tsx
  const [onlyMine, setOnlyMine] = useState(false)
```

```tsx
  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, priorityFilter, onlyMine, setPage])

  const query = useTickets({
    ...params,
    ...(search ? { search } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
    ...(onlyMine ? { assigned_to_me: 'true' as const } : {}),
  })
```

Column, after `category_name`:

```tsx
    {
      id: 'assigned_agent_name',
      header: t('fields.assignedAgent'),
      // Not sortable: a joined display column absent from the viewset's
      // `ordering_fields`, same as `customer_name`/`category_name`.
      cell: (row) => row.assigned_agent_name ?? t('fields.unassigned'),
    },
```

Toggle, inside the existing `<div className="flex flex-wrap items-center gap-2">` after the priority `Select` — reusing the shared `SwitchField`'s underlying primitive directly, since this is a filter and not a form field:

```tsx
        <div className="flex items-center gap-2">
          <Switch
            id="only-mine"
            checked={onlyMine}
            onCheckedChange={setOnlyMine}
            aria-label={t('filters.onlyMine')}
          />
          <Label htmlFor="only-mine" className="text-sm">
            {t('filters.onlyMine')}
          </Label>
        </div>
```

Add `import { Switch } from '@/shared/ui/primitives/switch'` and `import { Label } from '@/shared/ui/primitives/label'` — both names verified against the real exports (`switch.tsx:39`, `label.tsx:19`).

---

### 11 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — two keys in `fields`, one in `filters`, and a new `assign` block:

```json
  "fields": {
    …
    "assignedAgent": "Assignee",
    "unassigned": "Unassigned",
    …
  },
  "filters": {
    …
    "onlyMine": "Only my tickets"
  },
  "assign": {
    "label": "Change assignee",
    "updated": "Assignee updated."
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "fields": {
    …
    "assignedAgent": "المسؤول",
    "unassigned": "غير مُعيَّن",
    …
  },
  "filters": {
    …
    "onlyMine": "تذاكري فقط"
  },
  "assign": {
    "label": "تغيير المسؤول",
    "updated": "تم تحديث المسؤول."
  },
```

No `resources.ts` change — `tickets` is already a registered namespace.

---

## Documentation Tasks

### 12 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 21's paragraph):

> **A field that has its own action endpoint should be read-only on the resource's serializer.** `Ticket.assigned_agent` (Story 22, `TKT-3`) is written only by `POST /tickets/<id>/assign/`; keeping it in `read_only_fields` means a full-payload `PATCH` from the edit form can never clear it as a side effect — a real bug class, since this project's forms send every field they own on every save. **A `detail=False` `@action` does not shadow the detail route**: DRF registers dynamic list routes before `^{prefix}/{lookup}/$` (`rest_framework/routers.py`), so `/api/tickets/assignable-agents/` resolves to the action even though `{lookup}` would match that literal string — ordering, not the regex, is what makes it safe. **When a picker offers a restricted set of values, the write endpoint must validate against the same queryset the picker reads** — `apps/tickets/assignment.py::assignable_agents()` backs both, so a hand-crafted request cannot assign a ticket to a user the picker would never have offered. **A single control that fires a mutation immediately is not a form** — § 20's "`useAppForm` is the only entry point" governs forms with a submit step and client-side validation; a lone `Select` that saves on change uses the plain primitive, like `LanguageSwitcher` and the ticket list's filters.

---

## Edge Cases & Failure Modes

- **`POST .../assign/` with the `assigned_agent` key omitted is a `400`, not an unassign.** Deliberate: "unassign" and "I forgot the field" are different intents, and the project's explicit-`null` rule (§ 23) already forbids inferring one from the other.
- **`POST .../assign/` with a real user id who lacks `tickets.manage` is a `400`**, not a silent success — validated against `assignable_agents()`. A `customers.view`-only user cannot be made a ticket's assignee even by a hand-crafted request.
- **`?assigned_to_me=` with any value other than the exact string `"true"` is a `400`.** Consistent with Story 18's `category`/`priority` filters: absent means no filter, but a present-but-malformed value never silently returns an unfiltered list. Note `assigned_to_me=false` is therefore an error, not "show all" — the frontend omits the param entirely instead.
- **An agent with zero assigned tickets sees the normal empty state under "Only my tickets"**, not an error — `DataTable`'s own empty row. Because `search` is falsy in that case, the message shown is `empty`/`emptyDescription` ("No tickets yet"), which reads slightly oddly for a filtered-to-nothing queue. Accepted: it is the identical behaviour Story 18's category/priority filters already have, and changing it means reworking the shared empty-state branch for all four filters at once — `AGENT-1`'s dedicated queue screen is the right place for queue-specific copy.
- **Deleting or deactivating an agent leaves their tickets unassigned, not deleted.** `SET_NULL`. Note **deactivating** (`is_active=False`) does *not* clear existing assignments — it only removes the user from `assignable_agents()`, so they stop appearing in the picker while their current tickets keep showing their name. That is intended (history stays readable); a bulk-reassign-on-deactivate flow is not in scope.
- **A ticket assigned to a now-deactivated agent still renders that agent's name**, and the `Select` will show no matching option (Radix renders the raw value's absence as an empty trigger). Reassigning or unassigning works normally. Accepted rough edge, same class as Story 19's "category deleted mid-flow".
- **`assigned_agent_name` falls back to the user's email** when both `first_name` and `last_name` are blank — that is `User.get_full_name()`'s own documented behaviour (`accounts/models.py:128-130`), and it is why every seeded user in `## Verification Steps` displays as an email address rather than a name.
- **The assignee `Select` is disabled while the mutation is in flight**, so a double-click cannot fire two conflicting assignments. The last write wins if two agents assign the same ticket concurrently — no optimistic locking anywhere in this project.
- **Arabic assignee names round-trip correctly** — no ASCII assumption; the name is rendered as prose, while nothing here needs `dir="ltr"` (an email-shaped fallback is a single token, but it appears inside a `Select` trigger, matching how `ContactDetailsSection` already renders channel values without wrapping the whole control).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 1's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: the assignable-agents list (contents and permission gating, plus the route-shadowing check), assign/reassign/unassign, all four rejection paths (omitted key, non-numeric, non-existent, non-assignable), the `assigned_to_me` filter (true / malformed / absent), and confirmation that a ticket `PATCH` cannot change `assigned_agent` — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new control.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**One migration**, generated by task 1: a single `AddField` for `Ticket.assigned_agent`. Depends on `0003_category_ticket_category` and `swappable_dependency(AUTH_USER_MODEL)`.

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0003` to unapply, if reverting only this story's migration.

**Half-applied states to avoid:**

- **`assigned_agent` added without `null=True, blank=True`.** `SET_NULL` requires a nullable field; `makemigrations` would prompt for a one-off default and break a non-interactive run — the same trap Story 18 and Story 21 both documented.
- **`permission_map` missing the `"assign"` entry.** This does **not** deny — it falls through to authenticated-only, so any signed-in user (including a `customers.view`-only one) could reassign any ticket. The highest-risk mistake in this story; `## Verification Steps` step 7 is what catches it.
- **`assigned_agent` left writable on `TicketSerializer`** (i.e. not added to `read_only_fields`). No immediate breakage — the harm is latent, and lands the day `assigned_agent` is added to `TicketInput`. `## Verification Steps` step 9 asserts a `PATCH` cannot move it.
- **`assign` validating against `User.objects` instead of `assignable_agents()`.** Silently allows assigning to anyone with an account, making the options endpoint decorative.
- **`select_related("assigned_agent")` omitted.** No error, just one extra query per row on every list request.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces one file with a single `AddField`; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The assignable-agents route is not shadowed by the detail route.** With an agent token, `GET /api/tickets/assignable-agents/` → `200` and a **plain JSON array** (no `meta.pagination`), containing `mgr@supportos.local`, `agent@supportos.local`, and both superusers — four entries against the current seed data, each `{"id": …, "name": "…"}` where `name` is the email (both name fields are blank; see `## Edge Cases`). A `404`/`"Not found"` here means the route resolved to `retrieve(pk="assignable-agents")` instead — the failure this endpoint's ordering was verified against.
5. **A non-assignable user is absent from the list.** Create a throwaway role holding only `customers.view` and a user in it (the technique Story 20/21's verification already used), then re-`GET` the list → that user does **not** appear. Keep this user for step 7.
6. **Assign, reassign, and unassign all work.** Create a customer and a ticket. `POST /api/tickets/<id>/assign/` `{"assigned_agent": <agent user id>}` → `200`, the returned ticket has `assigned_agent` set and `assigned_agent_name` matching. Repeat with the **manager's** id → `200`, both fields change (reassign). `POST` `{"assigned_agent": null}` → `200`, both fields are `null` (unassign). Confirm `GET /api/tickets/<id>/` agrees after each step.
7. **All four rejection paths, plus permission gating.** With an agent token: omitted key (`{}`) → `400` naming `assigned_agent`; `{"assigned_agent": "abc"}` → `400`; `{"assigned_agent": 999999}` → `400`; `{"assigned_agent": <the customers.view-only user's id from step 5>}` → `400` (**this is the check that proves validation runs against `assignable_agents()`, not `User.objects`**). Then with **that** user's own token: `POST .../assign/` with a valid body → **`403`** (proving `permission_map["assign"]` is present), while `GET /api/tickets/<id>/` → also `403` (they lack `tickets.view` too, so use a `tickets.view`-only role if a sharper split is wanted). With no token → `401`.
8. **The `assigned_to_me` filter.** Assign one of two tickets to the agent. With the agent's token: `GET /api/tickets/?assigned_to_me=true` → only that ticket. `GET /api/tickets/` → both. `GET /api/tickets/?assigned_to_me=false` → **`400`** naming `assigned_to_me`. `GET /api/tickets/?assigned_to_me=yes` → `400`. With the **manager's** token, `?assigned_to_me=true` → **zero** tickets (the filter is per-caller, not global).
9. **A ticket `PATCH` cannot change the assignee.** With a ticket currently assigned to the agent: `PATCH /api/tickets/<id>/` `{"assigned_agent": null}` → `200`, and `assigned_agent` is **unchanged** (still the agent) — DRF silently drops a read-only field. Also confirm a normal edit `PATCH` (`{"subject": "Renamed"}`) leaves `assigned_agent` intact.
10. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as the agent:
    - `/tickets` — an "Assignee" column shows either a name or "Unassigned"; the "Only my tickets" toggle narrows the list to the agent's own tickets and restores it when switched off; the page resets to 1 on toggle.
    - `/tickets/<id>` — an "Assignee" row shows a `Select`; changing it toasts "Assignee updated." and the list column reflects the change on navigating back.
    - Set the assignee to "Unassigned" from the detail page — it clears, and the list column shows "Unassigned".
    - Sign in as a user with `tickets.view` but **not** `tickets.manage` (reuse a throwaway role) — the detail page shows the assignee as **plain text**, no `Select`, and the list still shows the column.
    - Switch to Arabic on both screens — every label translates, and the toggle/`Select` read correctly in RTL.
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Clean up** every record created for steps 5-9 (tickets first, then customers — `Ticket.customer` is `PROTECT`), plus every throwaway role and user.

---

## Done Criteria

- [ ] `Ticket.assigned_agent` — nullable FK to `accounts.User`, `on_delete=SET_NULL`, `related_name="assigned_tickets"`; class docstring updated to name TKT-3 as done.
- [ ] One migration: a single `AddField`, depending on `0003_category_ticket_category` + `swappable_dependency(AUTH_USER_MODEL)`. **No new permission-grant migration.**
- [ ] `TicketAdmin.list_display`/`list_filter` gain `assigned_agent`.
- [ ] `apps/tickets/assignment.py` — `assignable_agents()` mirroring `permissions_for`'s superuser-or-role branches, `select_related("role")`, deterministic ordering.
- [ ] `TicketSerializer` — `assigned_agent` in `fields` **and** in `read_only_fields`; `assigned_agent_name` via the `allow_null=True` dotted source to `get_full_name`.
- [ ] `TicketViewSet` — `select_related("assigned_agent")`; `permission_map` gains `"assign": TICKETS_MANAGE` and `"assignable_agents": TICKETS_VIEW`; `ordering_fields` **unchanged**.
- [ ] `TicketViewSet.assignable_agents` (`detail=False`, `url_path="assignable-agents"`) returning a plain array; `TicketViewSet.assign` (`detail=True`, `POST`) requiring an explicit `assigned_agent` key and validating against `assignable_agents()`.
- [ ] `get_queryset` gains the optional `assigned_to_me` filter, scoped to `request.user`, `400` on any value other than `"true"`.
- [ ] **No `apps/tickets/urls.py` change, no new permission constant, no new dependency.**
- [ ] `types/ticket.ts` — `assigned_agent`/`assigned_agent_name` on `Ticket`, **not** on `TicketInput`; `types/agentOption.ts` added.
- [ ] `api/getAssignableAgents.ts`, `api/useAssignableAgents.ts`, `api/assignTicket.ts`, and `useAssignTicket` in `useTicketMutations.ts` (prefix-wide invalidation).
- [ ] `TicketAssigneeControl.tsx` — a plain `Select` (not `useAppForm`), `UNASSIGNED` sentinel, disabled while pending, success toast.
- [ ] `TicketDetailPage.tsx` — an "Assignee" `<dl>` row: the control under `tickets.manage`, plain text otherwise, via `Can`'s existing `fallback` prop — **no change to `shared/auth/Can.tsx`**.
- [ ] `TicketListPage.tsx` — `assigned_agent_name` column (not sortable) and the "Only my tickets" toggle, included in the page-reset effect; `getTickets.ts`'s params type extended.
- [ ] `en.json`/`ar.json` — `fields.assignedAgent`, `fields.unassigned`, `filters.onlyMine`, and the `assign` block; identical key sets in both languages, **no `resources.ts` change**.
- [ ] `CONVENTIONS.md` § 23 gains the read-only-field / route-ordering / validate-against-the-picker / control-is-not-a-form paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the plain-array assignable-agents list and its non-shadowed route (Step 4); a non-assignable user absent from it (Step 5); assign/reassign/unassign (Step 6); all four rejection paths including the non-assignable id, plus `403`/`401` gating (Step 7); the `assigned_to_me` filter across true/false/malformed/absent and per-caller scoping (Step 8); a `PATCH` unable to move `assigned_agent` (Step 9).
- [ ] Both languages walk through cleanly in the browser, including the `tickets.view`-only read-only variant (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record, role, and user created during verification is cleaned up (Step 12).
- [ ] `.squad/plans/ticket-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The remaining `ticket-management` stories are **TKT-4 (Status & Escalation)** and **TKT-5 (Ticket History)**, both depending only on `TKT-1`. This story also unblocks **AGENT-1 (Agent Queue)** and **AGENT-4 (Auto-Assignment Rules)**, which the backlog lists as depending on `TKT-3`.
