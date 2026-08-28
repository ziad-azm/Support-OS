# Story 34 — Team Collaboration (Story: SUPPORTOS-65)

## Prerequisites

- **`TKT-5` (Story 24, activity-log pattern) and `SLA-4` (Story 31, notifications) are both complete** — the intake's own two named dependencies (`SupportOs backlog.MD` line 441). `TicketActivity`/`apps/tickets/history.py::build_history` (Story 24) and `apps.notifications.services.notify` (Story 31, `backend/apps/notifications/services.py` lines 22-55) both exist and are the two pieces this story reuses: task 1 follows `TicketActivity`'s *shape*, and task 2's "notify mentioned agents" calls `notify(...)` directly, adding zero new delivery UI — the same "reuse the shared service, no bespoke notification path" call Story 32 (`AGENT-3`) already made.
- **"Reuse activity-log pattern" (intake, task 1) is read as reusing `TicketActivity`'s *shape* — a `TimeStampedModel` subclass, `ticket` FK, actor tracked — not its *immutability*.** `TicketActivity` (`backend/apps/tickets/models.py` lines 113-166) has no viewset at all; it is written only internally by `apply_assignment`/`apply_escalation`, never directly by an agent. That shape does not fit "private collaboration" (intake) — a genuine, ongoing team discussion an agent authors and can correct. `apps.customers.models.Note` (Story 21, `backend/apps/customers/models.py` lines 107-136) is the closer, more literal precedent: a free-text, author-tracked, **editable** log entry with its own full CRUD API (`NoteViewSet`, `backend/apps/customers/views.py` lines 104-136) and frontend section (`NotesSection.tsx`). This story's `InternalNote` reuses `Note`'s exact shape one level over — a ticket instead of a customer — plus the mentions this story's own task 1 adds.
- **`apps/README.md` line 71 names `apps.agents` as the owner of "Agent workspace: assignment views, tasks, quick replies, collaboration."** — `collaboration` is named explicitly, the same authority Story 32/33 already cited for `Task`/`QuickReply`. `InternalNote` is this app's **third** model, appended after `Task` (`backend/apps/agents/models.py` lines 8-59) and `QuickReply` (lines 62-83).
- **Mentions are an explicit, picked set of users — `mentioned_users`, a `ManyToManyField` — not free-text `@name` parsing of `body`.** No mention-autocomplete/combobox primitive exists anywhere in this codebase (every prior picker — `useCustomerOptions`, `useCategories`, `useTicketOptions`, `useQuickReplies` — is a plain `page_size`-capped list, never search-as-you-type), and parsing free text into real user records correctly (ambiguous names, partial matches, Arabic names) is real complexity the intake does not ask for. The composer instead reuses `GET /tickets/assignable-agents/` (`TicketViewSet.assignable_agents`, `backend/apps/tickets/views.py` lines 137-149) — the exact same candidate list `TicketAssigneeControl`'s own picker already uses — as a checkbox list beside the note body. "@mentions" (intake) is satisfied functionally: an agent picks who to notify; the note's own free text can still say "@Alice" as a human-readable label, but that string is never parsed.
- **`InternalNoteSerializer.mentioned_users` validates against `assignable_agents()`, the same queryset `TicketViewSet.assign` already validates assignment against** (`backend/apps/tickets/assignment.py` lines 22-42, `apply_assignment`'s own candidate pool). Without this, a hand-crafted `POST` could mention (and notify) a user who holds no `tickets.manage` at all — the picker only *offers* eligible agents, but nothing server-side enforced it before this. `apps.agents.serializers` importing `apps.tickets.assignment.assignable_agents` is a new one-way import — verified safe: `apps/tickets/assignment.py` imports `apps.core.permissions`, `apps.notifications.models`, `apps.notifications.services`, and its own app's `.models`, nothing from `apps.agents`, so no cycle.
- **`Notification.body` is a `CharField(max_length=500)`** (`backend/apps/notifications/models.py` line 45) — every existing `notify(...)` call passes an already-bounded string (`Ticket.subject`, `max_length=200`). `InternalNote.body` is an unconstrained `TextField`, the **first** source text passed into `notify(...)` that is not already guaranteed to fit — task 5's `perform_create` truncates it (`note.body[:500]`) before calling `notify(...)`, or a long note would raise a database-level error on Postgres (a real `varchar(500)` column constraint, not just a Python-level convention).
- **`InternalNoteAdmin` follows `TaskAdmin`'s "read-only ops visibility" precedent (Story 32), not `NoteAdmin`'s older, fully-editable one (Story 21).** `NoteAdmin` (`backend/apps/customers/admin.py` lines 29-33) predates the more deliberate split `TaskAdmin`'s own docstring establishes: *"Read-only ops visibility, not a config UI... authored and edited by its owner through the app, not through `/admin/`."* `InternalNote` gets a real frontend CRUD section (task 8) the same way `Task` does, so it follows the newer, better-reasoned precedent, not the pattern that predates it. Contrast `QuickReplyAdmin` (Story 33), which is fully editable **because** it has no frontend CRUD screen at all — the deciding factor either way is "does this resource have a real frontend management surface," not "is it a note-shaped model."
- **No new `Permissions` constant, no permission-grant migration.** `InternalNoteViewSet` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` (`backend/apps/core/permissions.py` lines 31-32), the same cross-app reuse `QuickReplyViewSet` (Story 33) already established for a resource that conceptually belongs to the ticket-collaboration domain regardless of which Python app its model lives in.
- **The frontend lives in `features/tickets`, not a new `features/collaboration/` folder** — `InternalNotesSection`'s only consumer is `TicketDetailPage.tsx`, the same single-consumer placement rule Story 25 established and Story 33 already reused for `QuickReply`.
- **No re-notification on edit.** `notify(...)` fires only inside `perform_create`, once, for every mentioned user except the note's own author (a self-mention notifies no one). Editing a note's `mentioned_users` later (adding or removing someone) sends no notification — diffing old vs. new mention sets to decide "who is newly mentioned" is real complexity the intake does not ask for; see `## Edge Cases & Failure Modes`.

---

## Story Goal

1. **Internal notes + @mentions API**: `InternalNote` (`apps.agents`) — a ticket-scoped, author-tracked, free-text note with an explicit set of mentioned users. Full CRUD (`GET/POST /api/internal-notes/`, `GET/PATCH/PUT/DELETE /api/internal-notes/<id>/`), gated by the reused `tickets.view`/`tickets.manage` permissions. Creating a note with mentions notifies each mentioned user (except the author) via the already-built `notify(...)` service.
2. **Collaboration UI + mention notifications**: an `InternalNotesSection` on `TicketDetailPage`, mirroring `NotesSection`'s (Story 21) add/edit/delete shape, with a checkbox picker (reusing `assignable-agents`) for choosing who to mention. Delivery is entirely the already-shipped `NotificationBell` (Story 31) — this story adds no new notification UI.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `InternalNote` model (`ticket`, `author`, `body`, `mentioned_users`) | "Private notes + mentions on tickets" (intake, task 1). |
| `InternalNoteViewSet` reusing `tickets.view`/`tickets.manage`, `mentioned_users` validated against `assignable_agents()` | Mirrors `QuickReplyViewSet`'s cross-app reuse and `TicketViewSet.assign`'s candidate-pool validation. See `## Prerequisites`. |
| `notify(...)` fired once per mentioned user on create | "Notify mentioned agents" (intake, task 2) — reuses Story 31's service wholesale. |
| `InternalNotesSection`, mirroring `NotesSection` + a checkbox mention picker reusing `assignable-agents` | "Collaboration UI" (intake, task 2) — "agents solve together" (intake's own outcome). |

**Not here, and why:**

- **No free-text `@name` mention parsing.** See `## Prerequisites` — mentions are an explicit picked set, not parsed from `body`.
- **No re-notification on edit.** See `## Prerequisites` and `## Edge Cases & Failure Modes`.
- **No merging into `build_history`/`TicketHistorySection`.** Internal notes get their own section, the same way `TicketConversation` (messages) already has its own section distinct from the history feed, even though the two overlap in content by design.
- **No customer visibility of any kind.** An internal note is never surfaced through `EmailAdapter`/any channel adapter, `CustomerContextPanel`, or any customer-portal endpoint — it exists only inside `TicketDetailPage`, behind `tickets.view`.
- **No frontend management page beyond the section itself** — there is no separate "all my mentions" inbox; the intake's own scope is per-ticket collaboration, not a cross-ticket mentions feed. (The existing `NotificationBell` already surfaces every mention across every ticket, generically.)

---

## Context — Read These Files First

**Backend**

1. `.squad/stories/agent-workspace/SUPPORTOS-65/intake.md` — two task blocks, **no attachments, no acceptance criteria**; `SupportOs backlog.MD` lines 439-444 (`EPIC 6`, `STORY (AGENT-5) — Team Collaboration`) is its source, re-verified directly against the file for this plan.
2. `backend/apps/customers/models.py` lines 107-136 — `Note`: the exact `TimeStampedModel` subclass shape (`CASCADE` parent FK, `SET_NULL` author FK, `body` `TextField`, newest-first `Meta.ordering`) task 1's `InternalNote` copies, substituting `Ticket` for `Customer`.
3. `backend/apps/customers/serializers.py` lines 96-110 — `NoteSerializer`: the `author_name` read-only convenience (`source="author.get_full_name"`, `allow_null=True` — a deleted author must not error) and `read_only_fields` extension task 2's `InternalNoteSerializer` copies, plus the new `mentioned_users`/`mentioned_user_names` fields task 2 adds on top.
4. `backend/apps/customers/views.py` lines 104-136 — `NoteViewSet`: the `?customer=` required-query-param `get_queryset` shape and `perform_create` setting `author` — task 3's `InternalNoteViewSet` copies both, substituting `?ticket=`.
5. `backend/apps/tickets/views.py` lines 137-149 — `TicketViewSet.assignable_agents`: the exact `[{"id":..., "name":...}]` shape the mention picker's candidate list already is; lines 151-183 — `assign`, the `agent = assignable_agents().filter(pk=agent_id).first()` validation-against-the-same-queryset pattern task 2's `mentioned_users` field reuses.
6. `backend/apps/tickets/assignment.py` (83 lines, full file) — `assignable_agents()` (lines 22-42), imported by task 2's serializer; verified no import cycle — see `## Prerequisites`.
7. `backend/apps/notifications/models.py` (55 lines, full file) — `Notification.Kind` (lines 18-21, currently three values); task 6 adds `MENTIONED`. `body` (line 45, `CharField(max_length=500)`) — the field task 5's truncation guards.
8. `backend/apps/notifications/services.py` lines 22-55 — `notify(recipient, kind, *, title, body="", ticket=None)`, called once per mentioned user by task 5.
9. `backend/apps/agents/models.py` (83 lines, full file, after Story 33) — `Task`/`QuickReply`; task 1's `InternalNote` is appended as a third model.
10. `backend/apps/agents/serializers.py` (44 lines, full file) — `TaskSerializer`/`QuickReplySerializer`; task 2's `InternalNoteSerializer` is appended after them.
11. `backend/apps/agents/views.py` (83 lines, full file) — `TaskViewSet`/`QuickReplyViewSet`, the latter the closer precedent (extends `BaseModelViewSet`, reuses `tickets.*`); task 3's `InternalNoteViewSet` is appended after both.
12. `backend/apps/agents/admin.py` (32 lines, full file) — `TaskAdmin`/`QuickReplyAdmin`, for contrast (read-only vs. editable — see `## Prerequisites` for which one `InternalNoteAdmin` follows); appended after both.
13. `backend/apps/agents/urls.py` (11 lines, full file) — `router.register("tasks", ...)`, `router.register("quick-replies", ...)`; task 4 adds a third registration.
14. `backend/apps/core/permissions.py` lines 18-33 — confirms `TICKETS_VIEW`/`TICKETS_MANAGE` already exist; no new constant.

**Frontend**

15. `frontend/src/features/customers/components/NotesSection.tsx` (192 lines, full file) — read in full: the complete `NotesSection`/`NoteRow`/`NoteAddForm`/`NoteEditForm` shape task 8's `InternalNotesSection` copies near-verbatim, adding the mention checkbox picker to both forms.
16. `frontend/src/features/customers/types/note.ts` (13 lines, full file), `frontend/src/features/customers/api/{getNotes,useNotes,createNote,updateNote,deleteNote}.ts`, `useNoteMutations.ts` (all read in full) — the exact type/API-layer shape task 7 copies, substituting `ticket` for `customer`.
17. `frontend/src/features/tickets/api/getAssignableAgents.ts`/`useAssignableAgents.ts`, `frontend/src/features/tickets/types/agentOption.ts` (all read in full) — the already-built candidate-list hook task 8's mention picker reuses directly, no new endpoint.
18. `frontend/src/shared/ui/primitives/checkbox.tsx` (28 lines, full file) — `Checkbox`, a controlled `checked`/`onCheckedChange` component (not `CheckboxField` — the mention picker is not part of the RHF-validated form, the same "ancillary picker lives beside, not inside, the form" pattern `QuickReply`'s picker already established, Story 33).
19. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (199 lines, full file, after Story 33) — read in full: the left-column `<div>` (lines 79-189) ending with `<TicketHistorySection ticketId={ticket.id} />` (line 188); task 9 appends `<InternalNotesSection ticketId={ticket.id} />` directly after it, still inside the same column.
20. `frontend/src/features/tickets/locales/en.json` (138 lines, full file, after Story 33) — the top-level block shape (`context`, `myQueue`, `history`, `sla`); task 10 adds a new top-level `internalNotes` block after `sla` (line 137).
21. `frontend/src/features/notifications/types/notification.ts` (15 lines, full file) and `frontend/src/features/notifications/locales/{en,ar}.json` (12 lines each) — `NOTIFICATION_KINDS`/`kinds`, currently three values (Story 32 added `task_due`); task 11 adds `mentioned`, the same lockstep-extension pattern.
22. `CONVENTIONS.md` §22 (lines 735-833, authorization), §23 (lines 834-1325, feature module conventions — the admin-as-config-UI-vs-read-only-ops-visibility split this story's own new paragraph documents a third instance of).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Private notes on a ticket, author-tracked, editable.** | Intake, task 1 | `InternalNote` — `ticket` (`CASCADE`), `author` (`SET_NULL`), `body`. Full CRUD. |
| **Mentions are an explicit set of eligible agents, not free text.** | This story's design | `mentioned_users` (M2M), validated against `assignable_agents()`. See `## Prerequisites`. |
| **A quick reply/internal note is part of the ticket-reply permission domain, reusing existing permissions.** | Mirrors `QuickReplyViewSet` (Story 33) | `InternalNoteViewSet.permission_map` — `TICKETS_VIEW`/`TICKETS_MANAGE`. No new constant. |
| **Notify mentioned agents.** | Intake, task 2 | `InternalNoteViewSet.perform_create` calls `notify(...)` once per mentioned user (excluding the author), on create only. |
| **Collaboration UI reusing existing pickers.** | Intake, task 2 | `InternalNotesSection`, mirroring `NotesSection`; mention picker reuses `useAssignableAgents()`. |
| Wire format is `snake_case` end to end. | §12 | `mentioned_users`, `mentioned_user_names`, `author_name`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`/`TICKETS_MANAGE`; `Checkbox` primitive already exists. |

---

## Backend Tasks

### 1 — The `InternalNote` model

**File: `backend/apps/agents/models.py`** — append after `QuickReply` (currently ending at line 83):

```python
class InternalNote(TimeStampedModel):
    """A private, ticket-scoped collaboration note — AGENT-5. Never
    customer-visible. Reuses `apps.customers.models.Note`'s exact shape
    one level over (a ticket instead of a customer), plus an explicit
    set of mentioned users. See Story 34 `## Prerequisites`.
    """

    # CASCADE: a note has no existence independent of its ticket, the
    # same reasoning `Note.customer` and `Message.ticket` already use.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="internal_notes",
        verbose_name=_("ticket"),
    )
    # SET_NULL: content survives its author's account being removed, the
    # same reasoning `Note.author`/`Task.owner`'s siblings already use.
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_internal_notes",
        verbose_name=_("author"),
    )
    body = models.TextField(_("body"))
    # The @mentions themselves: an explicit set, not free-text parsing of
    # `body` — see Story 34 `## Prerequisites`. Blank-allowed: a private
    # note need not mention anyone.
    mentioned_users = models.ManyToManyField(
        "accounts.User",
        related_name="mentioned_in_notes",
        blank=True,
        verbose_name=_("mentioned users"),
    )

    class Meta:
        verbose_name = _("internal note")
        verbose_name_plural = _("internal notes")
        # Newest-first, matching `Note.Meta.ordering` — a running log of
        # context reads best with the most recent entry on top.
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Note on ticket #{self.ticket_id}"
```

No new import needed — `models`, `_`, `TimeStampedModel`, `Ticket` are already imported at the top of this file for `Task`.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations agents
```

Expect one file, `apps/agents/migrations/0004_internalnote.py`, depending on `agents/0003_quickreply` and `accounts`' latest migration (for the M2M's `through` table). **Commit it.**

---

### 2 — Serializer

**File: `backend/apps/agents/serializers.py`** — append after `QuickReplySerializer`:

```python
class InternalNoteSerializer(BaseModelSerializer):
    # Mirrors `NoteSerializer.author_name` exactly — `allow_null=True`
    # covers a deleted author (SET_NULL).
    author_name = serializers.CharField(
        source="author.get_full_name", read_only=True, allow_null=True
    )
    # A SerializerMethodField, not a `source=` trick — that shortcut only
    # works for a single FK (see `author_name`, above), not a many-relation.
    mentioned_user_names = serializers.SerializerMethodField()
    # Explicit `queryset=`, not DRF's auto-generated `User.objects.all()`:
    # validates against the same candidate pool `TicketViewSet.assign`
    # already validates assignment against, so a hand-crafted request
    # cannot mention (and notify) an agent who holds no `tickets.manage`.
    # See Story 34 `## Prerequisites`.
    mentioned_users = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=assignable_agents()
    )

    class Meta(BaseModelSerializer.Meta):
        model = InternalNote
        fields = (
            "id",
            "ticket",
            "author",
            "author_name",
            "body",
            "mentioned_users",
            "mentioned_user_names",
            "created_at",
            "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("author",)

    def get_mentioned_user_names(self, obj) -> list[str]:
        return [user.get_full_name() for user in obj.mentioned_users.all()]
```

**Extend the existing imports** at the top of `backend/apps/agents/serializers.py`:

```python
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer
from apps.tickets.assignment import assignable_agents

from .models import InternalNote, QuickReply, Task
```

---

### 3 — Viewset

**File: `backend/apps/agents/views.py`** — append after `QuickReplyViewSet`:

```python
class InternalNoteViewSet(BaseModelViewSet):
    """Private, ticket-scoped collaboration notes — AGENT-5. Reuses
    `tickets.*`, the same cross-app permission reuse `QuickReplyViewSet`
    (Story 33) already established. See Story 34 `## Prerequisites`.
    """

    queryset = InternalNote.objects.select_related("author", "ticket").prefetch_related(
        "mentioned_users"
    )
    serializer_class = InternalNoteSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        ticket_id = self.request.query_params.get("ticket")
        if not ticket_id:
            raise ValidationError({"ticket": [_("This query parameter is required.")]})
        try:
            ticket_id = int(ticket_id)
        except ValueError:
            raise ValidationError({"ticket": [_("Must be a valid ticket id.")]}) from None
        return queryset.filter(ticket_id=ticket_id)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
        note = serializer.instance
        # `Notification.body` is `CharField(max_length=500)` — `note.body`
        # is an unconstrained `TextField`, the first source text passed
        # into `notify(...)` that is not already guaranteed to fit. See
        # Story 34 `## Prerequisites`.
        notification_body = note.body[:500]
        for user in note.mentioned_users.exclude(pk=self.request.user.pk):
            notify(
                user,
                Notification.Kind.MENTIONED,
                ticket=note.ticket,
                title=f"You were mentioned on ticket #{note.ticket_id}",
                body=notification_body,
            )
```

**Extend the existing imports** at the top of `backend/apps/agents/views.py`:

```python
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import InternalNote, QuickReply, Task
from .serializers import InternalNoteSerializer, QuickReplySerializer, TaskSerializer
```

(`Notification`/`notify` are new imports — neither `TaskViewSet` nor `QuickReplyViewSet` needs them today.)

---

### 4 — Routing

**File: `backend/apps/agents/urls.py`** — register a third route:

```python
from rest_framework.routers import SimpleRouter

from .views import InternalNoteViewSet, QuickReplyViewSet, TaskViewSet

app_name = "agents"

router = SimpleRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("quick-replies", QuickReplyViewSet, basename="quick-reply")
router.register("internal-notes", InternalNoteViewSet, basename="internal-note")

urlpatterns = router.urls
```

Endpoints: `GET/POST /api/internal-notes/`, `GET/PATCH/PUT/DELETE /api/internal-notes/<id>/`. **No `config/api_urls.py` change** — `apps.agents.urls` is already included there (Story 32).

---

### 5 — Admin

**File: `backend/apps/agents/admin.py`** — append after `QuickReplyAdmin`:

```python
@admin.register(InternalNote)
class InternalNoteAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — follows `TaskAdmin`'s
    precedent, not `NoteAdmin`'s (`apps.customers`, predates this
    distinction): an `InternalNote` is authored and edited by its author
    through the app's own `InternalNotesSection`, not through `/admin/`.
    See Story 34 `## Prerequisites`.
    """

    list_display = ("ticket", "author", "created_at", "updated_at")
    search_fields = ("body", "author__email")
    readonly_fields = ("created_at", "updated_at")
```

**Extend the existing import line:**

```python
from .models import InternalNote, QuickReply, Task
```

---

### 6 — A fourth `Notification.Kind`

**File: `backend/apps/notifications/models.py`** — extend `Notification.Kind` (currently lines 18-21):

```python
    class Kind(models.TextChoices):
        TICKET_ASSIGNED = "ticket_assigned", _("Ticket assigned")
        TICKET_ESCALATED = "ticket_escalated", _("Ticket escalated")
        TASK_DUE = "task_due", _("Task due")
        MENTIONED = "mentioned", _("Mentioned")
```

**Generate the migration:**

```powershell
python manage.py makemigrations notifications
```

Expect one file (an `AlterField` on `kind`, schema-inert). **Commit it.**

---

## Frontend Tasks

### 7 — Type and API layer

**Create file: `frontend/src/features/tickets/types/internalNote.ts`**

```ts
/** Mirrors `apps.agents.serializers.InternalNoteSerializer` verbatim. */
export type InternalNote = {
  id: number
  ticket: number
  author: number | null
  author_name: string | null
  body: string
  mentioned_users: number[]
  mentioned_user_names: string[]
  created_at: string
  updated_at: string
}

export type InternalNoteInput = { ticket: number; body: string; mentioned_users: number[] }
export type InternalNoteUpdateInput = Pick<InternalNoteInput, 'body' | 'mentioned_users'>
```

**Create file: `frontend/src/features/tickets/api/getInternalNotes.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { InternalNote } from '../types/internalNote'

// page_size: 100 — a ticket's internal notes are a short inline list,
// the same simplification `getNotes.ts` (features/customers) accepted.
export function getInternalNotes(ticketId: number): Promise<Page<InternalNote>> {
  return api.getPage<InternalNote>('/internal-notes/', {
    params: { ticket: ticketId, page_size: 100 },
  })
}
```

**Create file: `frontend/src/features/tickets/api/useInternalNotes.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getInternalNotes } from './getInternalNotes'
import { ticketKeys } from './ticketKeys'

export function useInternalNotes(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('internalNotes', ticketId),
    queryFn: () => getInternalNotes(ticketId),
  })
}
```

**Create files: `frontend/src/features/tickets/api/{createInternalNote,updateInternalNote,deleteInternalNote}.ts`**

```ts
// createInternalNote.ts
import { api } from '@/shared/lib/api/client'

import type { InternalNote, InternalNoteInput } from '../types/internalNote'

export function createInternalNote(input: InternalNoteInput): Promise<InternalNote> {
  return api.post<InternalNote>('/internal-notes/', input)
}
```

```ts
// updateInternalNote.ts
import { api } from '@/shared/lib/api/client'

import type { InternalNote, InternalNoteUpdateInput } from '../types/internalNote'

export function updateInternalNote(id: number, input: InternalNoteUpdateInput): Promise<InternalNote> {
  return api.patch<InternalNote>(`/internal-notes/${id}/`, input)
}
```

```ts
// deleteInternalNote.ts
import { api } from '@/shared/lib/api/client'

export function deleteInternalNote(id: number): Promise<void> {
  return api.delete(`/internal-notes/${id}/`)
}
```

**Create file: `frontend/src/features/tickets/api/useInternalNoteMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createInternalNote } from './createInternalNote'
import { deleteInternalNote } from './deleteInternalNote'
import { ticketKeys } from './ticketKeys'
import { updateInternalNote } from './updateInternalNote'
import type { InternalNoteInput, InternalNoteUpdateInput } from '../types/internalNote'

// Scoped invalidation, not the whole-feature prefix — an internal-note
// write for one ticket never affects another's, the same reasoning
// `useNoteMutations.ts` (features/customers) already documents.
function useInvalidateInternalNotes(ticketId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: ticketKeys.resource('internalNotes', ticketId) })
}

export function useCreateInternalNote(ticketId: number) {
  const invalidate = useInvalidateInternalNotes(ticketId)
  return useMutation({
    mutationFn: (input: InternalNoteInput) => createInternalNote(input),
    onSuccess: invalidate,
  })
}

export function useUpdateInternalNote(ticketId: number, id: number) {
  const invalidate = useInvalidateInternalNotes(ticketId)
  return useMutation({
    mutationFn: (input: InternalNoteUpdateInput) => updateInternalNote(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteInternalNote(ticketId: number) {
  const invalidate = useInvalidateInternalNotes(ticketId)
  return useMutation({
    mutationFn: (id: number) => deleteInternalNote(id),
    onSuccess: invalidate,
  })
}
```

---

### 8 — `InternalNotesSection`

**Create file: `frontend/src/features/tickets/components/InternalNotesSection.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Form } from '@/shared/ui/primitives/form'
import { TextareaField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useAssignableAgents } from '../api/useAssignableAgents'
import {
  useCreateInternalNote,
  useDeleteInternalNote,
  useUpdateInternalNote,
} from '../api/useInternalNoteMutations'
import { useInternalNotes } from '../api/useInternalNotes'
import type { InternalNote } from '../types/internalNote'

const noteSchema = z.object({ body: requiredString(5000) })
type NoteFormValues = z.output<typeof noteSchema>

export function InternalNotesSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useInternalNotes(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('internalNotes.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('internalNotes.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((note) => (
                <NoteRow key={note.id} ticketId={ticketId} note={note} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="tickets.manage">
          <NoteAddForm ticketId={ticketId} />
        </Can>
      </CardContent>
    </Card>
  )
}

/**
 * Not an RHF-submitted field — an ancillary picker beside the form, the
 * same pattern `ReplyForm`'s quick-reply `Select` already established
 * (Story 33). Reuses `assignable-agents`, the exact candidate list
 * `TicketAssigneeControl` already uses — no new endpoint.
 */
function MentionPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}) {
  const { t } = useTranslation('tickets')
  const agentsQuery = useAssignableAgents()
  const agents = agentsQuery.data ?? []

  if (agents.length === 0) return null

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{t('internalNotes.fields.mention')}</span>
      <div className="flex flex-wrap gap-3">
        {agents.map((agent) => (
          <label key={agent.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selectedIds.includes(agent.id)}
              onCheckedChange={() => toggle(agent.id)}
            />
            {agent.name}
          </label>
        ))}
      </div>
    </div>
  )
}

function NoteRow({ ticketId, note }: { ticketId: number; note: InternalNote }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteInternalNote(ticketId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('internalNotes.delete.title'),
      description: t('internalNotes.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(note.id)
  }

  if (isEditing) {
    return <NoteEditForm ticketId={ticketId} note={note} onDone={() => setIsEditing(false)} />
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {note.author_name ?? t('internalNotes.unknownAuthor')}
          {' · '}
          {dateTime(note.created_at)}
        </span>
        <Can permission="tickets.manage">
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              {t('internalNotes.actions.edit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {t('internalNotes.actions.remove')}
            </Button>
          </div>
        </Can>
      </div>
      {/* No forced `dir="ltr"` — same reasoning every other free-text
          render in this feature uses. */}
      <p className="whitespace-pre-wrap">{note.body}</p>
      {note.mentioned_user_names.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {note.mentioned_user_names.map((name) => (
            <Badge key={name} variant="outline">
              @{name}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  )
}

function NoteAddForm({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [mentionedIds, setMentionedIds] = useState<number[]>([])
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: '' } })
  const mutation = useCreateInternalNote(ticketId)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(
      { ticket: ticketId, mentioned_users: mentionedIds, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('internalNotes.created') })
          form.reset({ body: '' })
          setMentionedIds([])
          setFormErrors([])
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <TextareaField control={form.control} name="body" label={t('internalNotes.fields.body')} />
        <MentionPicker selectedIds={mentionedIds} onChange={setMentionedIds} />
        {formErrors.length > 0 ? (
          <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('internalNotes.actions.add')}
        </Button>
      </form>
    </Form>
  )
}

function NoteEditForm({
  ticketId,
  note,
  onDone,
}: {
  ticketId: number
  note: InternalNote
  onDone: () => void
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [mentionedIds, setMentionedIds] = useState<number[]>(note.mentioned_users)
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: note.body } })
  const mutation = useUpdateInternalNote(ticketId, note.id)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(
      { mentioned_users: mentionedIds, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('internalNotes.updated') })
          onDone()
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        },
      },
    )
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <TextareaField control={form.control} name="body" label={t('internalNotes.fields.body')} />
          <MentionPicker selectedIds={mentionedIds} onChange={setMentionedIds} />
          {formErrors.length > 0 ? (
            <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {t('internalNotes.actions.save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('internalNotes.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
```

**No gate/loading state around `MentionPicker`'s own fetch** — same graceful degradation `ReplyForm`'s quick-reply picker already established (Story 33): while `useAssignableAgents()` is pending or on failure, `agents` is `[]` and the picker simply does not render; the body `Textarea` and submit button are unaffected.

---

### 9 — Wire into `TicketDetailPage`

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — one import, alongside the other same-directory imports (currently lines 16-21, alphabetized):

```tsx
import { InternalNotesSection } from './InternalNotesSection'
```

Add `<InternalNotesSection ticketId={ticket.id} />` directly after `<TicketHistorySection ticketId={ticket.id} />` (currently line 188), still inside the left-column `<div>`:

```tsx
                <TicketSlaSection ticketId={ticket.id} />
                <TicketConversation ticketId={ticket.id} />
                <TicketHistorySection ticketId={ticket.id} />
                <InternalNotesSection ticketId={ticket.id} />
              </div>
              <CustomerContextPanel ticketId={ticket.id} />
```

---

### 10 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — one new top-level block, after `sla` (currently the last key, ending line 137):

```json
  "internalNotes": {
    "title": "Internal Notes",
    "empty": "No internal notes yet.",
    "unknownAuthor": "Unknown",
    "fields": {
      "body": "Note",
      "mention": "Mention teammates"
    },
    "actions": {
      "add": "Add note",
      "edit": "Edit",
      "remove": "Remove",
      "save": "Save",
      "cancel": "Cancel"
    },
    "delete": {
      "title": "Delete this note?",
      "description": "This permanently removes the note. This cannot be undone."
    },
    "created": "Note added.",
    "updated": "Note updated."
  }
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "internalNotes": {
    "title": "الملاحظات الداخلية",
    "empty": "لا توجد ملاحظات داخلية بعد.",
    "unknownAuthor": "غير معروف",
    "fields": {
      "body": "الملاحظة",
      "mention": "إشارة إلى زملاء الفريق"
    },
    "actions": {
      "add": "إضافة ملاحظة",
      "edit": "تعديل",
      "remove": "إزالة",
      "save": "حفظ",
      "cancel": "إلغاء"
    },
    "delete": {
      "title": "حذف هذه الملاحظة؟",
      "description": "سيؤدي هذا إلى إزالة الملاحظة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
    },
    "created": "تمت إضافة الملاحظة.",
    "updated": "تم تحديث الملاحظة."
  }
```

No `resources.ts` change — `tickets` is already a registered namespace.

---

### 11 — Extend the notifications vocabulary in lockstep

**File: `frontend/src/features/notifications/types/notification.ts`** — add the fourth kind (line 1):

```ts
export const NOTIFICATION_KINDS = ['ticket_assigned', 'ticket_escalated', 'task_due', 'mentioned'] as const
```

**File: `frontend/src/features/notifications/locales/en.json`** — extend the `kinds` block:

```json
  "kinds": {
    "ticket_assigned": "Ticket assigned",
    "ticket_escalated": "Ticket escalated",
    "task_due": "Task due",
    "mentioned": "Mentioned"
  }
```

**File: `frontend/src/features/notifications/locales/ar.json`** — the same key, translated:

```json
  "kinds": {
    "ticket_assigned": "تم تعيين التذكرة",
    "ticket_escalated": "تم تصعيد التذكرة",
    "task_due": "موعد مهمة",
    "mentioned": "تمت الإشارة إليك"
  }
```

Same as Story 32's own extension of this vocabulary: `kinds.*` is not read anywhere in `NotificationBell.tsx` today (it renders `notification.title`/`created_at` generically) — this is a type-correctness fix, not new behaviour.

---

## Documentation Tasks

### 12 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 33's paragraph, before `## 24`):

> **A third resource in `apps.agents`, and the third instance of the admin-editability split.** `InternalNote` (Story 34, `AGENT-5`) reuses `apps.customers.models.Note`'s exact shape (Story 21) one app over — a ticket-scoped, author-tracked, editable free-text note — plus an explicit `mentioned_users` set, validated against the same `assignable_agents()` queryset `TicketViewSet.assign` already validates assignment against, so a hand-crafted request cannot notify an agent ineligible to work the ticket. `InternalNoteAdmin` follows `TaskAdmin`'s (Story 32) "read-only ops visibility" precedent, not `NoteAdmin`'s (Story 21, predates the distinction) fully-editable one — the deciding factor is always whether the resource has a real frontend management surface (it does, `InternalNotesSection`), not whether it is shaped like a note. **A `notify(...)` call's `body` argument must fit `Notification.body`'s `CharField(max_length=500)`** — every prior caller passed an already-bounded string (`Ticket.subject`); `InternalNote.body` is the first unconstrained source text, truncated (`note.body[:500]`) at the call site before reaching `notify(...)`, since a longer string would fail as a database-level constraint violation on Postgres, not just a Python-level oversight.

---

### 13 — Overview

**File: `.squad/plans/agent-workspace/00-overview.md`** — add this story's row to the `## Stories` table:

```markdown
| 34 | [34-story-team-collaboration-SUPPORTOS-65.md](34-story-team-collaboration-SUPPORTOS-65.md) | Team Collaboration | SUPPORTOS-65 | Story 24 (`TKT-5`), Story 31 (`SLA-4`) |
```

And a new paragraph in `## Dependency notes` summarizing: `InternalNote`'s reuse of `Note`'s shape rather than `TicketActivity`'s; the explicit-mentions-not-free-text-parsing design and its `assignable_agents()` validation; the `Notification.body` truncation guard; and that `EPIC 6 — Agent Workspace` is now **fully planned**, all five stories (`AGENT-1` through `AGENT-5`) complete.

---

## Edge Cases & Failure Modes

- **A note mentions zero users** (the common case) — `mentioned_users: []`, no `notify(...)` calls fire, `mentioned_user_names` renders as `[]` (no badges shown).
- **A note's author is included in `mentioned_users`** (e.g. selected by habit, or via a hand-crafted request) — `perform_create`'s `.exclude(pk=self.request.user.pk)` means the author is never notified about their own note; every other mentioned user still is.
- **A hand-crafted `POST`/`PATCH` includes a user id who does not hold `tickets.manage`** — `mentioned_users`' `queryset=assignable_agents()` rejects it with a `400` naming `mentioned_users`, the same validation shape `TicketViewSet.assign` already has for `assigned_agent`.
- **`?ticket=` absent or malformed on `GET /api/internal-notes/`** — `400` naming `ticket`, the identical contract `NoteViewSet`'s own `?customer=` requirement already has.
- **A mentioned agent's `tickets.manage` grant is revoked *after* being mentioned** — the already-created `Notification` row and the note's own `mentioned_user_names` display are both unaffected; only a **future** mention attempt is blocked by the `assignable_agents()` validation. No retroactive cleanup.
- **Editing a note to add a new mention notifies no one** — see `## Prerequisites`. The newly-mentioned user only learns of the note if they separately view the ticket.
- **Editing a note to remove a mention** does not un-notify anyone or delete any already-sent `Notification` — a notification, once sent, is independent of the note's current state, the same reasoning `Notification`'s own design already accepts elsewhere (e.g. a `Task`'s `Notification.title` reads "Ticket #X assigned to you" and is never retroactively updated if the ticket is later reassigned).
- **A very long note body (well over 500 characters)** — the note itself has no length cap (`TextField`); only the **notification's** `body` is truncated to 500 characters. The full note text is always visible in `InternalNotesSection`; only the bell's preview is shortened.
- **A ticket with zero eligible mention candidates** (no user currently holds `tickets.manage`) — `MentionPicker` renders nothing (`agents.length === 0`); the note is still fully creatable with `mentioned_users: []`.
- **Arabic note bodies and mentioned names round-trip correctly** — no forced `dir="ltr"` anywhere in `InternalNotesSection`.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** after `apps/agents/migrations/0004_internalnote.py` and `apps/notifications/migrations/000N_alter_notification_kind.py` are generated and committed.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real HTTP: full CRUD, the `?ticket=` filter, the `mentioned_users` validation against `assignable_agents()`, and the notification fired (or not) on create — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new section, its wiring into `TicketDetailPage.tsx`, and the updated `notifications` type/locale files.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` and `features/notifications/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**Two migrations**: `apps/agents/migrations/0004_internalnote.py` (the `InternalNote` table plus its `mentioned_users` M2M through-table), `apps/notifications/migrations/000N_alter_notification_kind.py` (schema-inert `Kind` choices).

**Rollback of the code:** revert the commits. `python manage.py migrate agents 0003` reverses `0004_internalnote` cleanly. `python manage.py migrate notifications` to the prior number reverses the `Kind` change (schema-inert either direction).

**Half-applied states to avoid:**

- **`mentioned_users` left as DRF's auto-generated `queryset=User.objects.all()`** instead of `assignable_agents()` — silently reopens the "mention someone who can't manage tickets" gap this story's own design closes. See `## Prerequisites`.
- **`perform_create` calling `notify(...)` before `serializer.save(...)` completes**, or reading `note.mentioned_users` before the M2M `.set()` DRF performs internally has run — would silently notify zero users even when `mentioned_users` was provided. `note = serializer.instance` (read *after* `.save()`) is what makes the M2M relation queryable at that point; verify with a note that has at least one mention.
- **Passing `note.body` unmodified into `notify(...)`** — a note longer than 500 characters would raise a database error (Postgres `varchar(500)` constraint) the first time it happens, not at review time. Verify with a note body deliberately longer than 500 characters.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations generated and match expectations:** `python manage.py makemigrations agents` produces exactly `0004_internalnote.py`; `python manage.py makemigrations notifications` produces exactly one `AlterField` migration. `python manage.py makemigrations --check --dry-run` (project-wide) then exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Full CRUD, scoped by ticket.** Create two tickets (A, B) and a throwaway second agent with `tickets.manage` (call them agent X and agent Y). As agent X: `POST /api/internal-notes/` with `{ticket: A.id, body: "...", mentioned_users: [Y.id]}` → `201`, `author` is X's id (not client-supplied), `mentioned_user_names` includes Y's name. `GET /api/internal-notes/?ticket=A.id` → includes it. `GET /api/internal-notes/?ticket=B.id` → does not. `GET /api/internal-notes/` (no `ticket`) → `400`.
5. **Mentions notify, excluding the author.** After step 4's create: exactly one `Notification` exists for agent Y with `kind: "mentioned"`, `title` containing ticket A's id, and **zero** for agent X (the author, even though not mentioned here — confirm separately by mentioning X themselves and seeing zero notifications for X from that note).
6. **`mentioned_users` validates against `assignable_agents()`.** Create a throwaway third user with `tickets.view` only (no `tickets.manage`). `POST /api/internal-notes/` with that user's id in `mentioned_users` → `400` naming `mentioned_users`.
7. **Edit and delete.** `PATCH /api/internal-notes/<id>/` with a new `body` and an expanded `mentioned_users` → `200`, updated fields reflected; confirm **no new** `Notification` was created for the newly-added mention. `DELETE .../<id>/` → `204`.
8. **Permission gate.** With `tickets.view` only: `GET` → `200`; `POST`/`PATCH`/`DELETE` → all `403`. With neither permission → `403`. With no token → `401`.
9. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as an agent with `tickets.manage`, viewing a ticket:
   - The ticket detail page now shows an "Internal Notes" card below History.
   - Add a note with the body filled in and one teammate checked in "Mention teammates" → the note appears with the author's name, timestamp, and a `@Name` badge.
   - Edit the note (change body, toggle mentions) → updates in place.
   - Delete the note → confirmation dialog appears, removes it from the list.
   - Sign in as the mentioned teammate → the existing `NotificationBell` shows the mention notification, exactly like a `ticket_assigned`/`task_due` one, with no new UI.
   - Switch to Arabic — every label (section title, form fields, mention picker, delete dialog) translates, RTL layout intact, and Arabic note text round-trips correctly.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
11. **Clean up** every internal note, ticket, customer, and throwaway agent/role/token created for verification.

---

## Done Criteria

- [ ] `InternalNote` model (`apps.agents`) — `ticket` (`CASCADE`), `author` (`SET_NULL`), `body` (`TextField`), `mentioned_users` (M2M, blank). `Meta.ordering = ("-created_at",)`. Migration generated and committed.
- [ ] `InternalNoteSerializer` — `author_name` (nullable-safe), `mentioned_user_names` (`SerializerMethodField`), `mentioned_users` validated against `assignable_agents()`; `author` read-only.
- [ ] `InternalNoteViewSet` — extends `BaseModelViewSet`, `permission_map` reusing `TICKETS_VIEW`/`TICKETS_MANAGE`, `?ticket=` required on `list`, `perform_create` sets `author` and calls `notify(...)` once per mentioned user excluding the author, with `body` truncated to 500 characters.
- [ ] `apps/agents/urls.py` — `router.register("internal-notes", InternalNoteViewSet, basename="internal-note")`. **No `config/api_urls.py` change.**
- [ ] `InternalNoteAdmin` — read-only ops visibility, mirroring `TaskAdmin`.
- [ ] `Notification.Kind` gains `MENTIONED = "mentioned"`; migration generated and committed.
- [ ] **No new `Permissions` constant, no permission-grant migration.**
- [ ] `frontend/src/features/tickets/types/internalNote.ts`, full `api/` layer (`getInternalNotes`/`useInternalNotes`, `create`/`update`/`deleteInternalNote.ts`, `useInternalNoteMutations.ts`), `InternalNotesSection.tsx` (with `MentionPicker` reusing `useAssignableAgents()`), wired into `TicketDetailPage.tsx` after `TicketHistorySection`.
- [ ] `en.json`/`ar.json` (`tickets`) — `internalNotes.*`; identical key sets in both languages; **no `resources.ts` change**.
- [ ] `NOTIFICATION_KINDS`/`notifications` locale `kinds` blocks (both languages) gain `mentioned`, in lockstep with the backend's new `Kind` value.
- [ ] `CONVENTIONS.md` §23 gains the third-`apps.agents`-resource / admin-editability-split / notify-body-truncation paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes after both migrations are committed; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: full CRUD scoped by ticket (Step 4); mentions notify correctly, excluding the author (Step 5); `mentioned_users` validated against `assignable_agents()` (Step 6); edit/delete, with no re-notification on edit (Step 7); the permission gate including `403`/`401` boundaries (Step 8).
- [ ] Both languages walk through cleanly in the browser, including the mention picker and the existing `NotificationBell` surfacing a mention with zero new UI (Step 9).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any throwaway agent/role/token created during verification is cleaned up (Step 11).
- [ ] `.squad/plans/agent-workspace/00-overview.md` updated with this story's row and dependency notes (task 13).

**STOP HERE. Report to the user and wait for confirmation.** This is the last unplanned story in `agent-workspace` (`EPIC 6`) — `AGENT-1` through `AGENT-5` are now all planned, per `SupportOs backlog.MD` lines 406-444.
