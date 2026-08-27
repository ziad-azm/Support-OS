# Story 28 — Response & Resolution Targets (Story: SUPPORTOS-50)

## Prerequisites

- **TKT-2 (Categories & Priorities) completed** — the intake names it (`Dependencies: TKT-2`). It is Story 18. `Ticket.priority`/`Ticket.Priority` (`backend/apps/tickets/models.py`, `TextChoices`) and `Category` (same file) both exist and are reused directly, not re-declared. **Not** listed as a dependency: `SLA-0` (Story 27, Celery). This story computes SLA status live, on read — it needs no scheduled job, confirmed by the backlog's own dependency line naming only `TKT-2`.
- **`apps.sla` gets its first real content in this story.** `apps/sla/models.py`, `admin.py`, and `views.py` are all `startapp`-placeholder comments today (`# Create your models here.` etc.) — confirmed by direct read. This story adds `models.py` (`SLAPolicy`) and `admin.py` (its config UI); `views.py` stays untouched — see below for why the read action lives elsewhere.
- **`SLAPolicy` reuses `Ticket.Priority`'s choices directly rather than re-declaring them** (`priority = models.CharField(choices=Ticket.Priority.choices)`) — a policy's priority value must always match exactly what a ticket's `priority` can hold, and any drift would silently break the lookup. This is a reverse cross-app model import (`apps.sla` → `apps.tickets`), the same *direction* `apps/customers/timeline.py` already established (Story 20) and verified safe: `apps.tickets.models` imports nothing from `apps.sla`, so there is no cycle.
- **"Policies per priority/category" (intake, task 1) is a two-tier specificity lookup, not a full cross-product.** `SLAPolicy.category` is nullable: a row with `category=None` is the default for that priority across every category with no more specific override; a row with a real `category` applies only to that exact (priority, category) pair and takes precedence when present. `resolve_policy` (task 2) tries the specific match first, falling back to the priority-only default — this means configuring N priorities needs only N rows unless a specific category genuinely needs a different target, not N × (number of categories) rows.
- **SLA status is computed on every read, never persisted on `Ticket`.** No new `Ticket` field, no cached "breach" flag, no migration on `apps.tickets`. This is a deliberate extension of the "aggregate read" pattern already used three times this session (`apps/customers/timeline.py`, `apps/tickets/history.py`, `apps/tickets/context.py`): due times and met/breached/pending status are derived fresh from `SLAPolicy` + `Ticket.created_at` + `Message`/`TicketActivity`, so a later change to the policy or the ticket's own priority/category is reflected immediately, with nothing to keep in sync and no scheduled job needed for this story's scope.
- **"Resolved at" is read from `TicketActivity` (Story 24), never `Ticket.updated_at`.** `updated_at` is `auto_now=True` and bumps on *every* save after resolution too (an `escalate` call, a later `assign`) — it would silently misreport how long resolution actually took. The first `TicketActivity` row with `kind=STATUS_CHANGED` and `to_value` in `{"resolved", "closed"}` is the authoritative "when did this ticket first reach a resolved state" — exactly the kind of question `TicketActivity`'s own docstring (Story 24) says it exists to answer.
- **The read action lives on `TicketViewSet` (`apps/tickets/views.py`), not a new `apps.sla` view/URL** — the same placement rule `context` (Story 26, anchored by ticket id even though its payload is mostly customer data) and `history` (Story 24) already follow. The *computation* itself (`resolve_policy`, `compute_sla_status`) lives in `apps/sla/policy.py` — the app that owns the question "what is this ticket's SLA status" — and is imported into `apps.tickets.views`, the **reverse** direction from `context`'s own import (there, `apps.tickets` read *from* `apps.customers`; here, `apps.tickets` reads from `apps.sla`). Verified safe the same way: `apps.sla.policy`/`models` import `apps.tickets.models` (and `apps.communications.models`), not `apps.tickets.views`, so the full chain (`apps.tickets.views` → `apps.sla.policy` → `apps.tickets.models`) has no cycle.
- **"SLA config UI" (intake, task 2) is Django admin, not a new frontend screen** — the same call Story 18 made for `Category` (`CategoryAdmin`'s own docstring: *"Also the de facto category-management UI for now"*). `SLAPolicy` rows are infrequent, admin-configured data (a handful of priority/category combinations), not a high-volume screen; `SLAPolicyAdmin` (task 3) is this story's entire "config UI." No new Django `auth.Permission` grants are needed either — every admin-registered model in this project today relies on superuser bypass, and this story does not change that pattern.
- **"Ticket badges" (intake, task 2) are scoped to the ticket detail page only, not the ticket list/queue.** Computing SLA status touches two extra queries per ticket (policy resolution, first-reply/resolution lookups) — cheap for one ticket on its own detail page, but a real N+1 risk across a paginated list (`TicketListPage`, `MyTicketsPage`). The intake's own wording is "ticket badges" (singular-ticket framing), not "list column" or "queue filter" — a list-level SLA indicator is a natural, explicitly-deferred follow-up (see `## Story Goal`, "What this story does... not"), not smuggled into this story's scope under ambiguous wording.
- **No new permission constant.** Reading a ticket's SLA status is gated `tickets.view` alone, the same reasoning `history` already uses (Story 24) — no separate `sla.view` exists or is needed.

---

## Story Goal

1. **`SLAPolicy` model + computation**: `apps/sla/models.py::SLAPolicy` (priority, optional category, response/resolution targets in minutes); `apps/sla/policy.py::resolve_policy`/`compute_sla_status` compute due times and a three-state (`met`/`breached`/`pending`) status per dimension, on read, from a ticket's resolved policy.
2. **Config UI + on-ticket indicators**: `SLAPolicyAdmin` (Django admin) for configuring policies; a new `GET /api/tickets/<id>/sla/` action (gated `tickets.view`) and a new `TicketSlaSection` on `TicketDetailPage` showing Response/Resolution badges.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `SLAPolicy` (priority + optional category + two minute targets) | "policies per priority/category" (intake) — see `## Prerequisites` for the two-tier specificity design. |
| `apps/sla/policy.py::resolve_policy`/`compute_sla_status` | "compute due times + breach status" (intake) — computed on read, not persisted. |
| `SLAPolicyAdmin` | "SLA config UI" (intake), reusing the `CategoryAdmin`-as-config-UI precedent (Story 18). |
| `GET /tickets/<id>/sla/`, `TicketSlaSection` | "ticket badges... visible SLA status" (intake) — detail-page only, see `## Prerequisites`. |

**Not here, and why:**

- **No list/queue-level SLA column, filter, or bulk indicator.** See `## Prerequisites` — the N+1 cost and the intake's own singular-ticket wording. A future story can add this once there is a batching strategy (e.g. an annotated queryset or a cached field) worth its own design pass.
- **No "at risk" tier between "pending" and "breached."** The backlog's own `SLA-3` (Escalation Rules) task line uses that exact vocabulary — *"escalating at-risk/idle tickets"* — confirming "at risk" is `SLA-3`'s scope, not this story's binary-until-the-deadline `met`/`breached`/`pending`.
- **No automatic escalation, notification, or scheduled evaluation job.** `SLA-3` (escalation rules, needs `SLA-0`) and `SLA-4` (alerts, needs `SLA-0`) own those. This story's status is computed only when a ticket's SLA is actually viewed.
- **No `Ticket` model or migration change.** SLA status is entirely derived; `Ticket` gains no new field.
- **No frontend SLA-policy CRUD screen.** See `## Prerequisites` — Django admin is this story's config UI, the same scope call Story 18 made.
- **No validation preventing a resolution target shorter than the response target beyond a same-policy sanity check** (task 3's `clean()`) — cross-policy consistency (e.g. urgent's resolution target should not exceed low's) is not enforced; that is a config-quality concern for whoever maintains `/admin/`, not a data-integrity rule this story enforces.

---

## Context — Read These Files First

1. `.squad/stories/sla-automation/SUPPORTOS-50/intake.md` — two tasks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 462-467 (`EPIC 7`, `STORY (SLA-1) — Response & Resolution Targets`), plus lines 476-481 (`SLA-3`, whose *"at-risk/idle"* wording this story's own `## Prerequisites` cites to justify not building a three-tier status here).
3. `backend/apps/sla/models.py`, `admin.py`, `views.py` — all `startapp` placeholders today; task 1/3 replace the first two, `views.py` stays untouched.
4. `backend/apps/tickets/models.py` — `Ticket.Priority`/`Ticket.Status` (`TextChoices`), `Category`, `Ticket.created_at`/`priority`/`category`, `TicketActivity.Kind.STATUS_CHANGED`/`to_value` (Story 24) — everything task 1's `SLAPolicy` and task 2's `compute_sla_status` read or reuse.
5. `backend/apps/communications/models.py` — `Message.Direction.OUTBOUND`, `Message.ticket`/`created_at` — task 2's "first response" lookup.
6. `backend/apps/customers/models.py` lines 107-140 (`Note`) and `backend/apps/tickets/admin.py` (`CategoryAdmin`, Story 18) — the exact "model `clean()` + admin-as-config-UI" shape task 1/3 follow.
7. `backend/apps/tickets/context.py` (Story 26) and `backend/apps/tickets/history.py` (Story 24) — the placement precedent for a same-session-established "small pure-function module, imported into `TicketViewSet`" shape; task 2's `apps/sla/policy.py` is the same shape, imported in the *opposite* cross-app direction — see `## Prerequisites`.
8. `backend/apps/tickets/views.py` (269 lines, after Story 26) — imports (lines 1-15), `permission_map` (lines 47-66), and `context` (lines 255-268, the most recent action) — task 4's `sla` action is appended after it, following the identical `@action`/docstring/`self.get_object()`/`Response(...)` shape.
9. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (198 lines, after Story 26) — the main `Card`'s closing tag (line 184) directly after which task 8 inserts `<TicketSlaSection>`, before `<TicketConversation>` (line 185); the `<Badge variant="secondary"|"destructive">` pattern (lines 123, 134-136, 156) task 7's badge-variant mapping copies.
10. `frontend/src/features/tickets/api/useMessageMutations.ts` (Story 24) — `useCreateMessage`'s two-key scoped invalidation, which task 6 extends to a third key (`sla`) — the same call site Story 24 already extended once.
11. `frontend/src/features/tickets/locales/en.json`/`ar.json` (124/124 lines, after Story 26) — the `history`/`context` blocks' nesting shape task 9's new `sla` block follows.
12. `CONVENTIONS.md` §23 (feature module conventions — Story 26's paragraph, most recent; this story's own paragraph appends after it).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`SLAPolicy` model + computation, per priority/category.** | Intake, task 1 | `SLAPolicy`; `apps/sla/policy.py::resolve_policy`/`compute_sla_status`. |
| **SLA config UI + on-ticket indicators.** | Intake, task 2 | `SLAPolicyAdmin`; `GET /tickets/<id>/sla/`; `TicketSlaSection`. |
| **A category-specific policy takes precedence; otherwise the priority-only default applies.** | This story's design | `resolve_policy`'s two-step lookup. |
| **"Resolved at" is the ticket's own logged history, not its current row state.** | This story's design, to avoid a real correctness bug | `compute_sla_status` reads `TicketActivity`, not `Ticket.updated_at`. |
| **SLA status is computed fresh on every read; nothing about it is cached or persisted.** | This story's design | No new `Ticket` field or migration. |
| Wire format is `snake_case` end to end; the UI translates, the API sends values. | §12 | `response_due_at`, `response_status`, `resolution_due_at`, `resolution_status`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`. |

---

## Backend Tasks

### 1 — The `SLAPolicy` model

**File: `backend/apps/sla/models.py`** — replace the placeholder comment with:

```python
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Category, Ticket


class SLAPolicy(TimeStampedModel):
    """Response/resolution time targets — SLA-1. One row per (priority,
    category) combination worth tracking; `category=None` is the default
    for that priority across every category with no more specific
    override. See `apps/sla/policy.py::resolve_policy` for the lookup
    order, and Story 28 `## Prerequisites` for why `priority` reuses
    `Ticket.Priority`'s own choices rather than re-declaring them.
    """

    priority = models.CharField(_("priority"), max_length=20, choices=Ticket.Priority.choices)
    # CASCADE, not SET_NULL: a category-specific policy has no meaning
    # once its category is gone — the same reasoning `Message.ticket`
    # already uses for a child with no existence independent of its
    # parent (Story 13). `null=True` is the OTHER half of the design:
    # this field means "no category override" when absent, not "unknown
    # category" — contrast `Ticket.category`'s own SET_NULL (Story 18),
    # a genuinely different relationship.
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sla_policies",
        verbose_name=_("category"),
    )
    response_target_minutes = models.PositiveIntegerField(
        _("response target (minutes)"),
        help_text=_(
            "Minutes from ticket creation within which a first outbound reply is due."
        ),
    )
    resolution_target_minutes = models.PositiveIntegerField(
        _("resolution target (minutes)"),
        help_text=_(
            "Minutes from ticket creation within which the ticket must reach resolved/closed."
        ),
    )

    class Meta:
        verbose_name = _("SLA policy")
        verbose_name_plural = _("SLA policies")
        constraints = [
            models.UniqueConstraint(
                fields=["priority", "category"], name="unique_sla_policy_priority_category"
            )
        ]
        ordering = ("priority", "category__name")

    def clean(self):
        # Guards the admin (DRF has no write path for this model at all —
        # config is admin-only, see Story 28 `## Prerequisites`). A
        # resolution target shorter than the response target for the SAME
        # policy is never sensible: you cannot resolve a ticket before
        # you have even replied to it.
        if (
            self.response_target_minutes is not None
            and self.resolution_target_minutes is not None
            and self.resolution_target_minutes < self.response_target_minutes
        ):
            raise ValidationError(
                {
                    "resolution_target_minutes": _(
                        "Resolution target must be at least the response target."
                    )
                }
            )

    def __str__(self) -> str:
        scope = self.category.name if self.category else str(_("all categories"))
        return f"{self.get_priority_display()} / {scope}"
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations sla
```

Expect **one** new file, `apps/sla/migrations/0001_initial.py` — this app's first real migration, containing a single `CreateModel` with the `UniqueConstraint` above, depending only on `apps.tickets`'s latest migration (for the `Category` FK) and `apps.core`'s abstract `TimeStampedModel` (no separate dependency row for an abstract base).

---

### 2 — The policy-resolution and status-computation helper

**Create file: `backend/apps/sla/policy.py`**

```python
"""SLA policy resolution and status computation — SLA-1.

Lives in `apps.sla`: this is the domain's own question ("what is a
ticket's SLA status"), even though the read action that calls it sits on
`TicketViewSet` (`apps/tickets/views.py`) — the reverse-direction
relationship `apps/tickets/context.py` has with `apps.customers`, mirrored
the other way. Verified safe: `apps.sla.models`/`policy` import
`apps.tickets.models` and `apps.communications.models`, not
`apps.tickets.views`, so `apps.tickets.views` → `apps.sla.policy` →
`apps.tickets.models` has no cycle. See Story 28 `## Prerequisites`.
"""

from datetime import timedelta

from django.utils import timezone

from apps.communications.models import Message
from apps.tickets.models import Ticket, TicketActivity

from .models import SLAPolicy


def resolve_policy(ticket: Ticket) -> SLAPolicy | None:
    """The most specific policy for this ticket: an exact
    (priority, category) match if the ticket has a category and one
    exists, else the priority-only default (category=None). `None` if
    neither exists — SLA tracking is opt-in per priority, not guaranteed
    for every ticket.
    """
    if ticket.category_id is not None:
        specific = SLAPolicy.objects.filter(
            priority=ticket.priority, category_id=ticket.category_id
        ).first()
        if specific is not None:
            return specific
    return SLAPolicy.objects.filter(priority=ticket.priority, category__isnull=True).first()


def _dimension_status(due_at, achieved_at, now) -> str:
    """"met" (achieved by the deadline), "breached" (deadline passed,
    whether achieved late or not at all), or "pending" (not yet due, not
    yet achieved). Computed fresh every call — a "pending" ticket becomes
    "breached" automatically once real time passes `due_at`, with nothing
    to update.
    """
    if achieved_at is not None:
        return "met" if achieved_at <= due_at else "breached"
    return "breached" if now > due_at else "pending"


def compute_sla_status(ticket: Ticket) -> dict | None:
    """Response/resolution due times and status for this ticket, computed
    on read from its resolved policy — nothing is persisted on `Ticket`.
    `None` if no policy applies to this ticket's priority/category.
    """
    policy = resolve_policy(ticket)
    if policy is None:
        return None

    now = timezone.now()
    response_due_at = ticket.created_at + timedelta(minutes=policy.response_target_minutes)
    resolution_due_at = ticket.created_at + timedelta(minutes=policy.resolution_target_minutes)

    first_reply = (
        Message.objects.filter(ticket=ticket, direction=Message.Direction.OUTBOUND)
        .order_by("created_at")
        .first()
    )
    first_response_at = first_reply.created_at if first_reply else None

    # The FIRST time this ticket reached resolved/closed, per the activity
    # log (Story 24) — NOT `ticket.updated_at`, which bumps on every save
    # after resolution too. See Story 28 `## Prerequisites`.
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=ticket,
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .first()
    )
    resolved_at = resolved_activity.created_at if resolved_activity else None

    return {
        "policy_id": policy.id,
        "response_target_minutes": policy.response_target_minutes,
        "resolution_target_minutes": policy.resolution_target_minutes,
        "response_due_at": response_due_at,
        "response_status": _dimension_status(response_due_at, first_response_at, now),
        "resolution_due_at": resolution_due_at,
        "resolution_status": _dimension_status(resolution_due_at, resolved_at, now),
    }
```

---

### 3 — Admin (the config UI)

**File: `backend/apps/sla/admin.py`** — replace the placeholder comment with:

```python
from django.contrib import admin

from .models import SLAPolicy


@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    """Also the de facto SLA-policy config UI for now — the same call
    Story 18 made for `Category` (`CategoryAdmin`'s own docstring). See
    Story 28 `## Prerequisites`.
    """

    list_display = (
        "priority",
        "category",
        "response_target_minutes",
        "resolution_target_minutes",
        "created_at",
    )
    list_filter = ("priority", "category")
    readonly_fields = ("created_at", "updated_at")
```

---

### 4 — Views: the `sla` action

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from apps.sla.policy import compute_sla_status
```

(A new import line alongside the other same-file helper imports, e.g. after `from .assignment import assignable_agents`.)

Add the `sla` permission_map entry (alongside the existing six):

```python
        "sla": Permissions.TICKETS_VIEW,
```

Append the `sla` action, after `context` (the current last action):

```python
    @action(detail=True, methods=["get"], url_path="sla")
    def sla(self, request, pk=None):
        """This ticket's SLA status — SLA-1. Gated `tickets.view` alone,
        the same reasoning `history` uses (Story 24) — no separate SLA
        permission exists. Returns `null` when no `SLAPolicy` applies to
        this ticket's priority/category, which is a normal outcome (SLA
        tracking is opt-in per priority), not an error.
        """
        ticket = self.get_object()
        sla_status = compute_sla_status(ticket)
        return Response(sla_status)
```

**No `apps/tickets/urls.py` change** (router-generated, `detail=True`, like every prior action). **No `apps/sla/urls.py`** — this app exposes no API of its own; its only public surface is this one action on `TicketViewSet`. Endpoint: `GET /api/tickets/<id>/sla/`.

---

## Frontend Tasks

### 5 — Types

**Create file: `frontend/src/features/tickets/types/ticketSla.ts`**

```ts
export type SlaDimensionStatus = 'met' | 'breached' | 'pending'

/** Mirrors `apps.sla.policy.compute_sla_status`'s return shape. `null`
 * means no `SLAPolicy` applies to this ticket's priority/category — a
 * normal outcome, not missing data. */
export type TicketSla = {
  policy_id: number
  response_target_minutes: number
  resolution_target_minutes: number
  response_due_at: string
  response_status: SlaDimensionStatus
  resolution_due_at: string
  resolution_status: SlaDimensionStatus
} | null
```

---

### 6 — API layer

**Create file: `frontend/src/features/tickets/api/getTicketSla.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TicketSla } from '../types/ticketSla'

// A plain object (or `null`), not a paginated `Page<T>` — same reasoning
// as `getTicketContext.ts`/`getTicketHistory.ts` (Story 24/26).
export function getTicketSla(ticketId: number): Promise<TicketSla> {
  return api.get<TicketSla>(`/tickets/${ticketId}/sla/`)
}
```

**Create file: `frontend/src/features/tickets/api/useTicketSla.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTicketSla } from './getTicketSla'
import { ticketKeys } from './ticketKeys'

/**
 * Read-only. `useAssignTicket`/`useSetTicketStatus`/`useEscalateTicket`/
 * `useUpdateTicket`'s existing prefix-wide `ticketKeys.all` invalidation
 * already refreshes this key for free (a status change or a priority/
 * category edit both change the computed SLA status). Only
 * `useCreateMessage`'s SCOPED invalidation does not reach it — task 7
 * extends that call site a second time (it already gained `history` in
 * Story 24).
 */
export function useTicketSla(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('sla', ticketId),
    queryFn: () => getTicketSla(ticketId),
  })
}
```

---

### 7 — Extend `useCreateMessage`'s invalidation

**File: `frontend/src/features/tickets/api/useMessageMutations.ts`** — a new reply can change the *response* dimension's status (from `pending` to `met`), so it must invalidate `sla` too:

```ts
/**
 * Scoped invalidation, per CONVENTIONS.md §23's documented exception
 * (Story 11): a message write for one ticket cannot affect another ticket's
 * conversation or the ticket list, so invalidating only this ticket's keys
 * is precise. `history` (Story 24) and `sla` (Story 28) are invalidated
 * alongside `messages` for the same reason: a new reply can change either
 * feed's or SLA's computed data, and both sit outside `ticketKeys.all`'s
 * reach the same way `messages` does.
 */
export function useCreateMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MessageInput) => createMessage(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('history', ticketId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('sla', ticketId) })
    },
  })
}
```

(Replaces the existing two-`invalidateQueries`-call `onSuccess` body and its docstring.)

---

### 8 — The SLA section

**Create file: `frontend/src/features/tickets/components/TicketSlaSection.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useTicketSla } from '../api/useTicketSla'
import type { SlaDimensionStatus } from '../types/ticketSla'

function badgeVariant(status: SlaDimensionStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'met') return 'default'
  if (status === 'breached') return 'destructive'
  return 'secondary'
}

/**
 * SLA-1 — this ticket's response/resolution status, computed on read.
 * `null` (no policy configured for this priority/category) renders a
 * plain message, not an error. See Story 28 `## Prerequisites`.
 */
export function TicketSlaSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()
  const query = useTicketSla(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('sla.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary query={query}>
          {(sla) =>
            sla === null ? (
              <p className="text-sm text-muted-foreground">{t('sla.noPolicy')}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">{t('sla.response')}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(sla.response_status)}>
                      {t(`sla.statuses.${sla.response_status}`)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {dateTime(sla.response_due_at)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('sla.resolution')}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(sla.resolution_status)}>
                      {t(`sla.statuses.${sla.resolution_status}`)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {dateTime(sla.resolution_due_at)}
                    </span>
                  </dd>
                </div>
              </dl>
            )
          }
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}
```

---

### 9 — Ticket detail: render the SLA section

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — one import:

```tsx
import { TicketSlaSection } from './TicketSlaSection'
```

(Add alongside the existing same-directory imports, keeping the block alphabetized.)

```tsx
                </Card>
                <TicketSlaSection ticketId={ticket.id} />
                <TicketConversation ticketId={ticket.id} />
```

(The main `Card`'s closing tag is line 184; this inserts the new section directly after it, before the existing `<TicketConversation ticketId={ticket.id} />` at line 185 — ticket-intrinsic status information stays grouped at the top of the left column, ahead of the conversation and history feed.)

---

### 10 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — one new top-level `sla` block:

```json
  "sla": {
    "title": "SLA Status",
    "noPolicy": "No SLA policy configured for this ticket's priority.",
    "response": "Response",
    "resolution": "Resolution",
    "statuses": {
      "met": "Met",
      "breached": "Breached",
      "pending": "Pending"
    }
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "sla": {
    "title": "حالة اتفاقية مستوى الخدمة",
    "noPolicy": "لا توجد سياسة SLA مُهيّأة لأولوية هذه التذكرة.",
    "response": "الاستجابة",
    "resolution": "الحل",
    "statuses": {
      "met": "تم الالتزام",
      "breached": "تم التجاوز",
      "pending": "قيد الانتظار"
    }
  },
```

No `resources.ts` change — `tickets` is already a registered namespace.

---

## Documentation Tasks

### 11 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 26's paragraph):

> **A derived status with a real deadline is computed fresh on every read, never cached or persisted, when nothing forces otherwise.** `apps/sla/policy.py::compute_sla_status` (Story 28, `SLA-1`) derives a ticket's response/resolution due times and `met`/`breached`/`pending` status entirely from `SLAPolicy` + `Ticket.created_at` + `Message`/`TicketActivity` — no new `Ticket` field, no migration, no state that can drift from reality. A "pending" ticket becomes "breached" automatically the moment real time passes its deadline, with nothing to update — the same reason this project prefers computing over caching wherever the read is cheap enough to redo. **The event log is the source of truth for "when did X first happen," never a row's own `updated_at`.** `compute_sla_status` reads the first matching `TicketActivity` row for "when was this ticket resolved," not `Ticket.updated_at`, which bumps on any later save (an escalate call, a reassignment) and would silently misreport how long resolution actually took — the same lesson `TicketActivity` (Story 24) exists to generalize. **A reverse cross-app import can run in either direction depending on which side owns the *question*.** `apps/tickets/context.py` (Story 26) reads *from* `apps.customers` because "what is this ticket's customer context" is framed from the ticket; `apps/sla/policy.py` is read *by* `apps.tickets.views` because "what is this ticket's SLA status" is framed from SLA policy data. Both are safe for the identical reason: neither app's `models.py` imports back into the other, so only a one-way leaf-module dependency exists either way.

---

### 12 — Overview

**File: `.squad/plans/sla-automation/00-overview.md`** — add this story's row to the `## Stories` table and a dependency-notes paragraph summarizing: the two-tier policy-specificity design, compute-on-read (no new `Ticket` field), the `TicketActivity`-not-`updated_at` correctness point, and the detail-page-only scope of the badges.

---

## Edge Cases & Failure Modes

- **A ticket whose priority (and, if set, category) has no matching `SLAPolicy` returns `null`** from `GET .../sla/` — the frontend renders `sla.noPolicy`, not an error. SLA tracking is opt-in per priority, not mandatory for every ticket.
- **Two policies could theoretically apply if configured carelessly** (e.g. one for `priority=urgent, category=None` and one for `priority=urgent, category=<X>`) — this is not a conflict: `resolve_policy` always prefers the specific (category-set) match over the default, by design, not by which was created first.
- **The `(priority, category)` `UniqueConstraint` allows multiple rows with the SAME priority as long as `category` differs** (including multiple `category=None` rows for *different* priorities) — Postgres's own NULL-does-not-collide-with-NULL-across-different-priority-rows behaviour is irrelevant here since `priority` is part of the same constraint; two rows can only collide if BOTH `priority` and `category` match exactly, including both being `None`.
- **Changing a ticket's priority or category after creation immediately changes which policy applies and what the due times are** — an inherent, accepted consequence of computing on read rather than snapshotting at creation time. A ticket created as `low` priority and later escalated to `urgent` gets `urgent`'s (typically tighter) targets retroactively from `ticket.created_at`, not from the moment of the priority change.
- **Editing an `SLAPolicy`'s targets retroactively changes the computed status of every ticket that resolves to it**, including already-resolved tickets — the same accepted consequence of "compute on read, nothing cached." This is a deliberate tradeoff (see `## Prerequisites`), not an oversight.
- **A ticket that never receives an outbound reply keeps `response_status` at `"pending"` until `now` passes `response_due_at`, then it becomes `"breached"` on the very next read** — no explicit transition, no job needed; time itself is what changes the computed value.
- **Deleting a `Category` that has a category-specific `SLAPolicy` also deletes that policy row** (`on_delete=CASCADE`) — tickets that had that category are unaffected in their own right (`Ticket.category` is `SET_NULL`, Story 18); they simply fall back to the priority-only default policy (if one exists) on their next SLA read.
- **`SLAPolicyAdmin.clean()` rejects a resolution target shorter than the response target for the SAME policy row** at save time in `/admin/` — a `ValidationError` on the form, not a silent save; cross-policy consistency (e.g. urgent's resolution target vs. low's) is not checked.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once task 1's migration is generated.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: a policy's exact-match vs. priority-only-default resolution; the full `met`/`breached`/`pending` matrix for both dimensions; a ticket with no matching policy returning `null`; the response status flipping from `pending` to `met` after a reply; the resolution status using `TicketActivity`, not `updated_at`; permission gating — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new section.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**One migration**, generated by task 1: a single `CreateModel` for `SLAPolicy` in `apps.sla`, its first ever migration. Depends on the latest `apps.tickets` migration (for the `Category` FK) — no dependency on `apps.core` (an abstract base contributes no migration of its own).

**Rollback of the code:** revert the commits, then `python manage.py migrate sla zero` to unapply, if reverting only this story's migration.

**Half-applied states to avoid:**

- **`SLAPolicy.category` added without `null=True, blank=True`.** The whole "priority-only default" half of the design requires it — the same nullable-FK trap Story 18/21/22/23/24 all documented.
- **`compute_sla_status` reading `ticket.updated_at` instead of `TicketActivity`** for "resolved at." Would silently misreport resolution time for any ticket touched again after resolving (an `escalate` call, a reassignment) — see `## Prerequisites`.
- **`permission_map` missing the `"sla"` entry.** Does **not** deny — falls through to authenticated-only, so any signed-in user could read SLA status without `tickets.view`. `## Verification Steps` checks this explicitly.
- **`resolve_policy` querying without `category_id=ticket.category_id` guarded by `ticket.category_id is not None`** — passing `category_id=None` into the specific-match query would incorrectly match a `category=None` policy on the "specific" branch, silently skipping the intended fallback logic (the two branches would collapse into the same query).

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations sla` produces one file with a single `CreateModel`; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Policy resolution: specific over default.** Via `/admin/` or the Django shell, create two policies: `(priority=urgent, category=None, response=30, resolution=240)` and `(priority=urgent, category=<a real category>, response=15, resolution=120)`. Create an `urgent` ticket **with** that category — `GET .../sla/` → its due times use the category-specific targets (15/120). Create a second `urgent` ticket with **no** category (or a different one) — its due times use the default (30/240).
5. **No matching policy returns `null`.** Create a ticket at a priority with no configured policy at all → `GET .../sla/` → `200`, `data` is `null`.
6. **The full status matrix, response dimension.** On a fresh ticket with a policy: immediately after creation, `response_status` is `"pending"` (not yet due). Send an outbound reply before the deadline (`POST /api/messages/`) → `response_status` becomes `"met"`. On a second ticket, do not reply, and use a policy with a very small `response_target_minutes` (e.g. `0`) so the deadline is already past → `response_status` is `"breached"` with no reply.
7. **The full status matrix, resolution dimension, using the activity log correctly.** Transition a ticket through `open → in_progress → resolved` (`POST .../status/`, Story 23). `GET .../sla/` → `resolution_status` is `"met"` (assuming within target) and `resolution_due_at`/the underlying `resolved_at` reflects the `TicketActivity` row's timestamp. Then call `POST .../escalate/` on the same now-resolved ticket — `GET .../sla/` again → `resolution_status` is unchanged (still `"met"`, using the same original resolution timestamp), proving the escalate call's `updated_at` bump did not affect the computed status.
8. **Permission gating.** With a `customers.view`-only token (reuse the throwaway-role technique from prior stories): `GET .../sla/` → `403`. With no token → `401`. With `tickets.view` → `200`.
9. **`SLAPolicyAdmin`'s validation.** In `/admin/`, attempt to save a policy with `resolution_target_minutes` less than `response_target_minutes` → form validation error, not a 500 or a silent save.
10. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as `tickets.manage`:
    - `/tickets/<id>` for a ticket with a policy — a new "SLA Status" card shows Response/Resolution rows, each with a colored badge (default for met, destructive for breached, secondary for pending) and a formatted due date.
    - A ticket with no matching policy shows the "No SLA policy configured..." message instead.
    - Sending a reply updates the Response badge without a manual page refresh.
    - Switch to Arabic — every label and status word translates, and the layout reads correctly in RTL.
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Clean up** every ticket, customer, message, and `SLAPolicy` row created for steps 4-9, plus any throwaway role/user reused from a prior story's verification.

---

## Done Criteria

- [ ] `SLAPolicy` — `priority` (reuses `Ticket.Priority.choices`), nullable `category` (`CASCADE`), `response_target_minutes`/`resolution_target_minutes` (`PositiveIntegerField`), `UniqueConstraint(priority, category)`, `clean()` rejecting `resolution < response`.
- [ ] One migration: `apps/sla/migrations/0001_initial.py`, a single `CreateModel`. **No `Ticket` model change, no new permission-grant migration.**
- [ ] `apps/sla/policy.py::resolve_policy` (specific-then-default lookup) and `compute_sla_status` (due times + `met`/`breached`/`pending` per dimension, "resolved at" from `TicketActivity`).
- [ ] `SLAPolicyAdmin` registered — the story's entire config UI.
- [ ] `TicketViewSet.sla` (`detail=True`, `GET`, `url_path="sla"`) — `permission_map["sla"] = TICKETS_VIEW`; returns `null` when no policy applies.
- [ ] **No `apps/tickets/urls.py` or `apps/sla/urls.py` change; no new permission constant; no list/queue-level SLA UI.**
- [ ] `types/ticketSla.ts` — `TicketSla` (nullable), `SlaDimensionStatus`.
- [ ] `api/getTicketSla.ts`, `api/useTicketSla.ts`; `useMessageMutations.ts`'s `useCreateMessage` extended to also invalidate `ticketKeys.resource('sla', ticketId)`.
- [ ] `TicketSlaSection.tsx` — two badge rows (Response, Resolution), `met`→default/`breached`→destructive/`pending`→secondary variant mapping, a no-policy message when `sla === null`.
- [ ] `TicketDetailPage.tsx` renders `<TicketSlaSection ticketId={ticket.id} />` directly after the main `Card`, before `<TicketConversation>`.
- [ ] `en.json`/`ar.json` — the new `sla` block; identical key sets in both languages; **no `resources.ts` change**.
- [ ] `CONVENTIONS.md` §23 gains the compute-on-read / event-log-as-source-of-truth / bidirectional-reverse-import paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: specific-over-default policy resolution (Step 4); `null` for no policy (Step 5); the response-dimension matrix (Step 6); the resolution-dimension matrix, including the `escalate`-does-not-move-it proof (Step 7); `403`/`401`/`200` permission gating (Step 8); admin-side `clean()` validation (Step 9).
- [ ] Both languages walk through cleanly in the browser, including a live badge update after a reply with no manual refresh (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 12).
- [ ] `.squad/plans/sla-automation/00-overview.md` updated with this story's row and dependency notes (task 12).

**STOP HERE. Report to the user and wait for confirmation.** The remaining `sla-automation` stories are **SLA-2 (Automatic Assignment, depends on `TKT-3` + `SLA-0`)**, **SLA-3 (Escalation Rules, depends on this story + `SLA-0`)**, and **SLA-4 (Alerts & Notifications, depends only on `SLA-0`, complete)** — `SLA-4` is the direct unblock for `agent-workspace`'s `AGENT-3`, and is now plannable.
