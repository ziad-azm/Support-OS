# Story 33 — Quick Replies (Story: SUPPORTOS-64)

## Prerequisites

- **`COMM-0` (Messaging Core & Channel Adapter Pattern) is complete** — the intake's own only named dependency (`SupportOs backlog.MD` line 366). `Message` (`backend/apps/communications/models.py`, full file, 56 lines) and the channel-agnostic conversation/reply component (`frontend/src/features/tickets/components/TicketConversation.tsx`, full file, 137 lines) both exist and are the two pieces this story builds on: task 1 is a template store whose output ends up in `Message.body`; task 2 extends `TicketConversation.tsx`'s existing `ReplyForm`, not a new component.
- **`apps/README.md` line 71 names `apps.agents` as the owner of "Agent workspace: assignment views, tasks, quick replies, collaboration."** — `quick replies` is named explicitly. `backend/apps/agents/` already has real content from Story 32 (`AGENT-3`, Tasks & Reminders): `models.py` (59 lines, `Task`), `serializers.py` (38 lines, `TaskSerializer`), `views.py` (57 lines, `TaskViewSet`), `admin.py` (17 lines, `TaskAdmin`), `urls.py` (11 lines, `router.register("tasks", ...)`). This story adds `QuickReply` as a **second** model/serializer/viewset/admin registration in each of those same files — no new app.
- **`QuickReply` is a shared, team-wide resource, not owner-scoped — the opposite shape from `Task` (Story 32) despite living in the same app.** A reply template is meant to be reused by *any* agent composing a reply, not authored privately (contrast the intake's own wording for Story 32, "personal tasks," with this story's "reusable reply templates" — no "personal"/"my" framing anywhere in the intake or the backlog). `QuickReplyViewSet` therefore does **not** follow `TaskViewSet`/`NotificationViewSet`'s no-`BaseModelViewSet`/no-domain-permission shape; it follows `CategoryViewSet`'s (`backend/apps/tickets/views.py` lines 24-44) instead — full `BaseModelViewSet` CRUD, gated by **reused** `Permissions.TICKETS_VIEW`/`Permissions.TICKETS_MANAGE`, no new permission constant. `CategoryViewSet`'s own docstring already establishes the precedent this story follows one app-boundary further: *"Reuses `tickets.*` — a category is part of the ticket domain, not a separate permission domain (mirrors `MessageViewSet`'s reuse of the same constants, Story 13)."* A quick reply exists purely to speed up replying to tickets — the same permission domain, functionally, even though its Python module lives in `apps.agents`.
- **No frontend management (create/edit/delete) screen — the backend API is real CRUD, but the "template store" surface agents configure through is Django admin, the same call already made for `Category` (`CategoryAdmin`, `backend/apps/tickets/admin.py` lines 15-23: *"Also the de facto category-management UI for now — this story ships no frontend CRUD screen"*), `SLAPolicy`/`AssignmentRule`/`EscalationRule` (Stories 28-30).** The intake's second task is specifically *"Quick-reply picker in conversation"* — a **read** surface, not a management one. `QuickReplyAdmin` is this story's fifth instance of that established pattern.
- **The picker's only consumer is `frontend/src/features/tickets/components/TicketConversation.tsx`'s `ReplyForm`** — no other frontend feature needs a `QuickReply`. Per Story 25's own placement reasoning (`.squad/plans/agent-workspace/25-story-assigned-tickets-workspace-SUPPORTOS-45.md` `## Prerequisites`: *"a separate feature folder would force duplicating... or a deep cross-feature import `no-restricted-imports` forbids outright"*), this story's frontend code — `types/quickReply.ts`, `api/getQuickReplies.ts`/`useQuickReplies.ts` — lives inside the **existing** `features/tickets`, not a new `features/quick-replies/` folder, even though the backend model lives in `apps.agents`. The exact same placement split Story 25 already established (frontend feature boundary decided by who consumes it, not by mirroring the backend app).
- **`QuickReply` has no `channel` field — templates are channel-agnostic, matching `COMM-0`'s own framing** (`SupportOs backlog.MD` line 364: *"a channel-agnostic conversation/thread + reply component"*). Selecting a template fills `ReplyForm`'s `body` only; the agent still picks `channel` themselves, exactly as they do today.
- **Selecting a quick reply overwrites the reply draft's `body`, it does not append to or merge with it.** A deliberate simplification: "insert at cursor"/"append" is real UI complexity (cursor position, undo semantics) the intake does not ask for — "faster replies" (intake) means starting from a template and editing it, not composing from fragments. See `## Edge Cases & Failure Modes`.
- **No new `Permissions` constant, no permission-grant migration** — `TICKETS_VIEW`/`TICKETS_MANAGE` (`backend/apps/core/permissions.py` lines 26-33) already exist and already cover every agent who can reach `ReplyForm` (itself gated `<Can permission="tickets.manage">`, `TicketConversation.tsx` line 63).

---

## Story Goal

1. **`QuickReply` model + API**: a shared `title`/`body` template, full CRUD (`GET/POST /api/quick-replies/`, `GET/PATCH/PUT/DELETE /api/quick-replies/<id>/`), gated by the reused `tickets.view`/`tickets.manage` permissions — the same shape `Category` already has. Managed through `/admin/` (`QuickReplyAdmin`); no frontend management screen.
2. **Quick-reply picker in conversation**: a `Select` inside `TicketConversation.tsx`'s existing `ReplyForm`, listing every `QuickReply` by `title`; choosing one fills the reply's `body` field with that template's text, which the agent can still edit before sending.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `QuickReply` model (`title`, `body`), full CRUD API | "QuickReply model + API... template store" (intake, task 1). |
| `QuickReplyViewSet` reusing `tickets.view`/`tickets.manage`, no new permission | Mirrors `CategoryViewSet` — a quick reply is part of the ticket-reply permission domain, not a separate one. See `## Prerequisites`. |
| `QuickReplyAdmin`, editable, the de facto template-management UI | Same established call as `CategoryAdmin`/`SLAPolicyAdmin`/etc. — no frontend CRUD screen shipped here. |
| A `Select` inside `ReplyForm`, filling `body` on choice | "Quick-reply picker in conversation... inside shared conversation view" (intake, task 2) — extends the existing component, does not create a new one. |

**Not here, and why:**

- **No frontend page to create/edit/delete quick replies.** See `## Prerequisites` — the intake's own task 2 is a picker (read), not a management screen; `QuickReplyAdmin` is where templates are authored, the established pattern for every prior shared/config-like resource in this project.
- **No `channel` field, no per-channel templates.** `COMM-0`'s conversation view is explicitly channel-agnostic; a template is plain text reused across every channel.
- **No "insert at cursor"/append behaviour.** Choosing a template replaces the draft body outright — see `## Prerequisites` and `## Edge Cases & Failure Modes`.
- **No search-as-you-type picker.** `useQuickReplies()` lists up to `page_size=100`, the exact simplification `useCategories()`/`useCustomerOptions()` already accepted — no combobox primitive exists yet in this codebase.
- **No new `Permissions` constant.** See `## Prerequisites`.

---

## Context — Read These Files First

**Backend**

1. `.squad/stories/agent-workspace/SUPPORTOS-64/intake.md` — two task blocks, **no attachments, no acceptance criteria**; `SupportOs backlog.MD` lines 432-437 (`EPIC 6`, `STORY (AGENT-4) — Quick Replies`) is its source, re-verified directly against the file for this plan.
2. `backend/apps/tickets/views.py` lines 24-44 — `CategoryViewSet`: the exact `BaseModelViewSet` subclass shape (`queryset`, `serializer_class`, `permission_map` reusing `TICKETS_VIEW`/`TICKETS_MANAGE`, `ordering_fields`, `search_fields`) task 3's `QuickReplyViewSet` copies verbatim, one app over.
3. `backend/apps/tickets/serializers.py` lines 8-11 — `CategorySerializer`: the minimal `Meta(BaseModelSerializer.Meta)` shape (no extra read-only fields, no FK) task 2's `QuickReplySerializer` copies.
4. `backend/apps/tickets/admin.py` lines 15-23 — `CategoryAdmin`: `list_display`/`search_fields`/`readonly_fields`, and its own docstring naming it "the de facto category-management UI" — task 4's `QuickReplyAdmin` copies this shape and reasoning.
5. `backend/apps/agents/models.py` (59 lines, full file, Story 32) — `Task`'s exact `TimeStampedModel` subclass shape (docstring, `Meta.verbose_name`/`ordering`, `__str__`); task 1's `QuickReply` is appended as a second model in this file, after `Task`.
6. `backend/apps/agents/serializers.py` (38 lines, full file) — `TaskSerializer`; task 2's `QuickReplySerializer` is appended after it.
7. `backend/apps/agents/views.py` (57 lines, full file) — `TaskViewSet`, for contrast: unlike it, `QuickReplyViewSet` **does** extend `BaseModelViewSet` — see `## Prerequisites`. Appended after `TaskViewSet`.
8. `backend/apps/agents/admin.py` (17 lines, full file) — `TaskAdmin`, for contrast: read-only (Task is owner-authored via the app), unlike `QuickReplyAdmin` (editable — see item 4). Appended after `TaskAdmin`.
9. `backend/apps/agents/urls.py` (11 lines, full file) — `router.register("tasks", TaskViewSet, basename="task")`; task 3 adds a second `router.register("quick-replies", QuickReplyViewSet, basename="quick-reply")` line.
10. `backend/apps/core/permissions.py` lines 18-33 — confirms `TICKETS_VIEW`/`TICKETS_MANAGE` already exist and cover everything this story touches; no new constant.
11. `backend/apps/communications/models.py` (56 lines, full file) — `Message.body` (`TextField()`, no `max_length`) — the precedent `QuickReply.body`'s own unconstrained `TextField()` follows, since a template becomes a message body verbatim.

**Frontend**

12. `frontend/src/features/tickets/components/TicketConversation.tsx` (137 lines, full file) — read in full: `ReplyForm` (lines 92-136), its `replySchema`/`useAppForm`/`toMessageInput` shape, and the `<Can permission="tickets.manage">` wrapper around it (line 63) that already gates who can reach the picker. Task 6 inserts the quick-reply `Select` at the top of `ReplyForm`'s `<form>` (before line 117's `SelectField` for `channel`).
13. `frontend/src/features/tickets/types/category.ts` (10 lines, full file) — the minimal-type-mirroring-a-shared-resource shape task 4's `types/quickReply.ts` copies.
14. `frontend/src/features/tickets/api/getCategories.ts`/`useCategories.ts` (both read in full) — the `page_size: 100, ordering: 'name'` + `ticketKeys.resource(...)` shape task 5's `getQuickReplies.ts`/`useQuickReplies.ts` copy exactly, substituting `ordering: 'title'`.
15. `frontend/src/shared/ui/primitives/select.tsx` — confirms `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` (already imported indirectly via `SelectField` elsewhere in this file); task 6 imports these directly, since the picker is not a submitted RHF field.
16. `frontend/src/features/tickets/locales/en.json` (134 lines, full file) — the `conversation` block's nested shape (`fields`, `actions`, lines 89-111); task 7 adds a `conversation.quickReply` block.
17. `CONVENTIONS.md` §22 (lines 735-833, authorization — "vocabulary is code, mapping is data," the reused-permission precedent), §23 (lines 834-1308, feature module conventions — the `BaseModelViewSet` template and the admin-as-config-UI pattern this story's own new paragraph documents a second instance of).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Reusable reply templates — a shared store, not personal.** | Intake, task 1 | `QuickReply` model, no `owner` field, visible to every caller who holds `tickets.view`. |
| **A quick reply is part of the ticket-reply permission domain, reusing existing permissions.** | This story's design, mirroring `CategoryViewSet`/`MessageViewSet` | `QuickReplyViewSet.permission_map` — `TICKETS_VIEW` (list/retrieve), `TICKETS_MANAGE` (create/update/destroy). No new constant. |
| **Managed via `/admin/`, no frontend CRUD screen.** | This story's design, matching `CategoryAdmin`/`SLAPolicyAdmin`/etc. | `QuickReplyAdmin`, editable. |
| **Picker inside the shared conversation view.** | Intake, task 2 | `ReplyForm` (`TicketConversation.tsx`) gains a `Select` that fills `body` on choice. |
| **Templates are channel-agnostic.** | `COMM-0`'s own framing | No `channel` field on `QuickReply`. |
| Wire format is `snake_case` end to end. | §12 | `title`, `body`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`/`TICKETS_MANAGE`; no new package. |

---

## Backend Tasks

### 1 — The `QuickReply` model

**File: `backend/apps/agents/models.py`** — append after `Task` (currently ending at line 59):

```python
class QuickReply(TimeStampedModel):
    """A reusable reply template — AGENT-4. Shared across every agent, the
    opposite shape from `Task`, above: no `owner`, visible to and usable
    by anyone who can reach `ReplyForm` (`tickets.manage`). See Story 33
    `## Prerequisites`.
    """

    title = models.CharField(_("title"), max_length=200)
    # TextField, no max_length — matches `apps.communications.models.Message.body`,
    # since a template's text becomes a message body verbatim.
    body = models.TextField(_("body"))

    class Meta:
        verbose_name = _("quick reply")
        verbose_name_plural = _("quick replies")
        # Alphabetical — a template library is browsed, not read as a
        # feed. Contrast `Task.Meta.ordering` (due-soonest) and
        # `TicketActivity.Meta.ordering` (newest-first).
        ordering = ("title",)

    def __str__(self) -> str:
        return self.title
```

No new import needed — `models`, `_`, `TimeStampedModel` are already imported at the top of this file for `Task`.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations agents
```

Expect one file, `apps/agents/migrations/0003_quickreply.py`, depending on `agents/0002_seed_due_reminder_schedule`. **Commit it.**

---

### 2 — Serializer

**File: `backend/apps/agents/serializers.py`** — append after `TaskSerializer`:

```python
class QuickReplySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = QuickReply
        fields = ("id", "title", "body", "created_at", "updated_at")
```

**Extend the existing import line** (currently `from .models import Task`):

```python
from .models import QuickReply, Task
```

---

### 3 — Viewset and routing

**File: `backend/apps/agents/views.py`** — append after `TaskViewSet`:

```python
class QuickReplyViewSet(BaseModelViewSet):
    """Reply-template CRUD — AGENT-4. Reuses `tickets.*`, the same call
    `CategoryViewSet` (`apps/tickets/views.py`) already made: a quick
    reply is part of the ticket-reply permission domain, not a separate
    one. See Story 33 `## Prerequisites`.
    """

    queryset = QuickReply.objects.all()
    serializer_class = QuickReplySerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    ordering_fields = ("title", "created_at")
    search_fields = ("title", "body")
```

**Extend the existing imports** at the top of `backend/apps/agents/views.py`:

```python
from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import QuickReply, Task
from .serializers import QuickReplySerializer, TaskSerializer
```

(`Permissions`/`BaseModelViewSet` are new imports — `TaskViewSet` does not import either today, since it deliberately skips `BaseModelViewSet`; `QuickReply`/`QuickReplySerializer` join the existing `Task`/`TaskSerializer` imports.)

**File: `backend/apps/agents/urls.py`** — register a second route:

```python
from rest_framework.routers import SimpleRouter

from .views import QuickReplyViewSet, TaskViewSet

app_name = "agents"

router = SimpleRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("quick-replies", QuickReplyViewSet, basename="quick-reply")

urlpatterns = router.urls
```

Endpoints: `GET/POST /api/quick-replies/`, `GET/PATCH/PUT/DELETE /api/quick-replies/<id>/`. **No `config/api_urls.py` change** — `apps.agents.urls` is already included there (Story 32).

---

### 4 — Admin

**File: `backend/apps/agents/admin.py`** — append after `TaskAdmin`:

```python
@admin.register(QuickReply)
class QuickReplyAdmin(admin.ModelAdmin):
    """Also the de facto template-management UI for now — this story
    ships no frontend CRUD screen, the same call already made for
    `Category` (`CategoryAdmin`), `SLAPolicy`, `AssignmentRule`, and
    `EscalationRule`. Editable, unlike `TaskAdmin`/`NotificationAdmin`
    above — a `QuickReply` IS authored through `/admin/`, unlike a
    `Task` (authored by its owner through the app) or a `Notification`
    (system-managed only).
    """

    list_display = ("title", "created_at", "updated_at")
    search_fields = ("title", "body")
    readonly_fields = ("created_at", "updated_at")
```

**Extend the existing import line** (currently `from .models import Task`):

```python
from .models import QuickReply, Task
```

---

## Frontend Tasks

### 5 — Type and API layer

**Create file: `frontend/src/features/tickets/types/quickReply.ts`**

```ts
/** Mirrors `apps.agents.serializers.QuickReplySerializer` verbatim. Owned
 * by this feature, not `apps.agents` — the picker's only consumer is
 * `TicketConversation.tsx`; see Story 33 `## Prerequisites` for why this
 * frontend code lives in `features/tickets` despite the backend model
 * living in `apps.agents` (the same split Story 25 already established). */
export type QuickReply = {
  id: number
  title: string
  body: string
  created_at: string
  updated_at: string
}
```

**Create file: `frontend/src/features/tickets/api/getQuickReplies.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { QuickReply } from '../types/quickReply'

// page_size: 100 (the server's max) — no search-as-you-type combobox
// exists yet, the same simplification `getCategories.ts` already accepted.
export function getQuickReplies(): Promise<Page<QuickReply>> {
  return api.getPage<QuickReply>('/quick-replies/', { params: { page_size: 100, ordering: 'title' } })
}
```

**Create file: `frontend/src/features/tickets/api/useQuickReplies.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getQuickReplies } from './getQuickReplies'
import { ticketKeys } from './ticketKeys'

export function useQuickReplies() {
  return useQuery({
    queryKey: ticketKeys.resource('quickReplies'),
    queryFn: getQuickReplies,
  })
}
```

---

### 6 — The picker

**File: `frontend/src/features/tickets/components/TicketConversation.tsx`** — extend the primitives import (currently line 9, `Select`/etc. are not yet imported directly):

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
```

Add one more import, alongside the other `../api/` imports (currently lines 17-19):

```tsx
import { useQuickReplies } from '../api/useQuickReplies'
```

**Inside `ReplyForm`** (currently lines 92-136), add the picker's state and handler, and render the `Select` as the first child of the `<form>`, before the existing `channel` `SelectField` (currently line 117):

```tsx
function ReplyForm({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: replySchema, defaultValues: EMPTY_REPLY })
  const mutation = useCreateMessage(ticketId)
  const quickRepliesQuery = useQuickReplies()

  // Not a submitted field — a "fill" action. Resets to '' after each pick
  // so the trigger falls back to its placeholder rather than staying
  // stuck on the last-chosen template's title. Overwrites `body` outright
  // (does not append/merge) — see Story 33 `## Prerequisites`.
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState('')
  const quickReplies = quickRepliesQuery.data?.items ?? []

  function handleQuickReplySelect(value: string) {
    const reply = quickReplies.find((candidate) => String(candidate.id) === value)
    if (reply) {
      form.setValue('body', reply.body, { shouldValidate: true, shouldDirty: true })
    }
    setSelectedQuickReplyId('')
  }

  function onSubmit(values: ReplyFormValues) {
    mutation.mutate(toMessageInput(ticketId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('conversation.sent') })
        form.reset(EMPTY_REPLY)
        setFormErrors([])
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        {quickReplies.length > 0 ? (
          <Select value={selectedQuickReplyId} onValueChange={handleQuickReplySelect}>
            <SelectTrigger
              size="sm"
              className="self-start"
              aria-label={t('conversation.quickReply.label')}
            >
              <SelectValue placeholder={t('conversation.quickReply.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {quickReplies.map((reply) => (
                <SelectItem key={reply.id} value={String(reply.id)}>
                  {reply.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <SelectField
          control={form.control}
          name="channel"
          label={t('conversation.fields.channel')}
          options={MESSAGE_CHANNELS.map((value) => ({
            value,
            label: t(`conversation.channels.${value}`),
          }))}
        />
        <TextareaField control={form.control} name="body" label={t('conversation.fields.body')} />
        {formErrors.length > 0 ? (
          <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('conversation.actions.send')}
        </Button>
      </form>
    </Form>
  )
}
```

**No `isPending`/`isError` gate on `quickRepliesQuery`.** The picker degrades to simply not rendering (`quickReplies.length > 0 ? ... : null`) while loading or on a `tickets.view`-less failure (impossible in practice here, since `ReplyForm` is already wrapped `<Can permission="tickets.manage">`, which implies `tickets.view` in every seeded role) — the reply `Textarea`/`Send` button are never blocked on this fetch. Mirrors the graceful-degradation reasoning `TicketFormPage`'s own `useCustomerOptions`/`useCategories` and `TaskFormPage`'s `useTicketOptions` (Story 32) already established.

---

### 7 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — one new block inside the existing `conversation` object (after `fields`, before `actions`):

```json
    "quickReply": {
      "label": "Quick reply",
      "placeholder": "Insert a quick reply…"
    },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key, translated:

```json
    "quickReply": {
      "label": "رد سريع",
      "placeholder": "إدراج رد سريع…"
    },
```

No `resources.ts` change — `tickets` is already a registered namespace.

---

## Documentation Tasks

### 8 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 32's paragraph, before `## 24`):

> **A shared resource in an owner-scoped app follows the shape of what it *is*, not the shape of its siblings.** `QuickReply` (Story 33, `AGENT-4`) lives in `apps.agents` beside `Task` (Story 32) and `Notification` lives in `apps.notifications`, but unlike either — both owner-scoped, no domain permission — `QuickReplyViewSet` extends `BaseModelViewSet` and reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`, the same call `CategoryViewSet` already made for the identical reason: a quick reply is part of the ticket-reply permission domain, not a separate one, regardless of which Python app its model lives in. **`QuickReplyAdmin` is this project's fifth "admin is the de facto config UI, no frontend CRUD screen" resource**, after `Category`, `SLAPolicy`, `AssignmentRule`, and `EscalationRule` — the pattern now clearly established: a shared, infrequently-edited configuration list gets a real API (for whatever needs to read it) plus an editable admin, not a bespoke management page, until a story's own intake actually asks for one.

---

### 9 — Overview

**File: `.squad/plans/agent-workspace/00-overview.md`** — add this story's row to the `## Stories` table:

```markdown
| 33 | [33-story-quick-replies-SUPPORTOS-64.md](33-story-quick-replies-SUPPORTOS-64.md) | Quick Replies | SUPPORTOS-64 | Story 13 (`COMM-0`) |
```

And a new paragraph in `## Dependency notes` summarizing: `QuickReply`'s shared (not owner-scoped) shape contrasted with `Task`'s, reusing `CategoryViewSet`'s precedent for permission reuse across an app boundary; the admin-as-config-UI placement; and that `AGENT-5` (Team Collaboration) is now the only remaining unplanned story in this feature.

---

## Edge Cases & Failure Modes

- **A caller with `tickets.view` but not `tickets.manage` can list/read quick replies but cannot create, edit, or delete one** — `403` from the API on those three actions; the picker itself is unreachable to such a caller anyway, since `ReplyForm` is gated `tickets.manage` at the component level.
- **Choosing a quick reply while the reply body already has agent-typed text overwrites it outright** — no merge, no cursor-position insert. See `## Prerequisites`. The agent can still edit the result before sending; nothing is sent automatically.
- **Choosing the same quick reply twice in a row** (after having edited the body in between) re-fills it with the template's original text again — `handleQuickReplySelect` always looks up the template fresh from `quickReplies`, not from any cached "already applied" state.
- **No quick replies exist yet** (a fresh install, or all templates deleted via `/admin/`) — the picker's `Select` does not render at all (`quickReplies.length > 0 ? ... : null`); `ReplyForm` behaves exactly as it did before this story.
- **The quick-replies fetch fails or is still loading** when `ReplyForm` mounts — the picker simply does not render yet (or ever, if it keeps failing); the channel `Select`, body `Textarea`, and `Send` button are unaffected and fully usable throughout. No loading spinner, no error banner for this ancillary fetch.
- **A quick reply's `body` is empty or whitespace-only** (an admin misconfiguration) — selecting it fills `ReplyForm`'s `body` with that empty/whitespace string; the existing `replySchema`'s `requiredString(5000)` validation on `body` still rejects an empty submission at send time, the same as if the agent had typed nothing.
- **Arabic quick-reply titles and bodies round-trip correctly** — no forced `dir="ltr"` anywhere in the picker or `ReplyForm`, matching every other free-text render in this feature.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** after `apps/agents/migrations/0003_quickreply.py` is generated and committed.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real HTTP: full CRUD, the reused-permission gate (`tickets.view` vs. `tickets.manage`), and `/admin/` reachability — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the extended `TicketConversation.tsx` and the new `types`/`api` files.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**One migration**: `apps/agents/migrations/0003_quickreply.py` (the `QuickReply` table). No data migration, no permission-grant migration — reused permissions need no grant.

**Rollback of the code:** revert the commits. `python manage.py migrate agents 0002` reverses `0003_quickreply` cleanly (a plain `CreateModel`, nothing else depends on it).

**Half-applied states to avoid:**

- **`QuickReplyViewSet.permission_map` omitting an action** (e.g. forgetting `destroy`) — per `HasPermission`'s own rule (`apps/core/permissions.py` lines 75-85), a missing entry falls through to authenticated-only, **not** denied — any signed-in user could then delete a shared template. Verify all five CRUD actions are present, matching `CategoryViewSet`'s own map exactly.
- **Declaring a new `QUICK_REPLIES_VIEW`/`MANAGE` permission instead of reusing `TICKETS_VIEW`/`TICKETS_MANAGE`** — would silently strip picker access from every already-seeded role that holds `tickets.manage` but was never granted a new, unrelated permission string; nothing in this story's design calls for one. See `## Prerequisites`.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and matches expectations:** `python manage.py makemigrations agents` produces exactly `0003_quickreply.py`. `python manage.py makemigrations --check --dry-run` (project-wide) then exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Full CRUD, correctly gated.** With a `tickets.manage` token: `POST /api/quick-replies/` with `{title, body}` → `201`. `GET /api/quick-replies/` → includes it, ordered by `title`. `PATCH .../<id>/` → `200`. `DELETE .../<id>/` → `204`. With a `tickets.view`-only token (a throwaway role): `GET /api/quick-replies/` → `200`; `POST`/`PATCH`/`DELETE` → all `403`. With neither permission → `403` on every action. With no token → `401`.
5. **`/admin/` is a real management surface.** Sign in to `/admin/` as a superuser, create/edit/delete a `QuickReply` via `QuickReplyAdmin` — confirms task 4 without needing any frontend screen.
6. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as an agent with `tickets.manage`, with at least one `QuickReply` seeded via `/admin/` and viewing a ticket with an existing conversation:
   - The reply composer now shows a quick-reply picker above the channel selector.
   - Selecting a template fills the body textarea with that template's exact text; the picker itself resets to its placeholder.
   - Typing over the filled text, then re-selecting the same template, replaces the edit with the template's original text again.
   - Sending the reply behaves exactly as before this story (message posted, form resets, picker still shows its placeholder).
   - With zero quick replies (delete the seeded one via `/admin/` and reload) — the picker no longer renders; the rest of the reply form is unaffected.
   - Sign in as an agent with `tickets.view` only — `ReplyForm` (and therefore the picker) does not render at all, unchanged from before this story.
   - Switch to Arabic — the picker's label/placeholder and every template title/body render correctly, RTL layout intact.
7. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
8. **Clean up** every quick reply, ticket, customer, and throwaway role/token created for verification.

---

## Done Criteria

- [ ] `QuickReply` model (`apps.agents`) — `title` (`CharField`, 200), `body` (`TextField`, unconstrained), no `owner`. `Meta.ordering = ("title",)`. Migration generated and committed.
- [ ] `QuickReplySerializer` — `id`, `title`, `body`, `created_at`, `updated_at`; no extra read-only fields beyond the base.
- [ ] `QuickReplyViewSet` — extends `BaseModelViewSet`, `permission_map` reusing `TICKETS_VIEW`/`TICKETS_MANAGE` across all five actions, `ordering_fields`/`search_fields` set.
- [ ] `apps/agents/urls.py` — `router.register("quick-replies", QuickReplyViewSet, basename="quick-reply")`, alongside the existing `tasks` registration. **No `config/api_urls.py` change** (already includes `apps.agents.urls`).
- [ ] `QuickReplyAdmin` — editable (`list_display`, `search_fields`, `readonly_fields` on timestamps only), the de facto template-management UI.
- [ ] **No new `Permissions` constant, no permission-grant migration.**
- [ ] `frontend/src/features/tickets/types/quickReply.ts`, `api/getQuickReplies.ts`, `api/useQuickReplies.ts` — mirroring `Category`'s own shape/placement exactly.
- [ ] `TicketConversation.tsx`'s `ReplyForm` — a `Select` picker (not an RHF-submitted field) that fills `body` via `form.setValue(..., { shouldValidate: true, shouldDirty: true })` on choice, resets to its placeholder after each pick, and does not render at all when `quickReplies` is empty. No gate/loading state on the rest of the form.
- [ ] `en.json`/`ar.json` — `conversation.quickReply.{label,placeholder}`; identical key sets in both languages; **no `resources.ts` change**.
- [ ] `CONVENTIONS.md` §23 gains the shared-resource-in-an-owner-scoped-app paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: full CRUD correctly gated by reused permissions, including the `403`/`401` boundary cases (Step 4); `/admin/` reachability (Step 5).
- [ ] Both languages walk through cleanly in the browser, including the empty-picker and `tickets.view`-only cases (Step 6).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any throwaway role/token created during verification is cleaned up (Step 8).
- [ ] `.squad/plans/agent-workspace/00-overview.md` updated with this story's row and dependency notes (task 9).

**STOP HERE. Report to the user and wait for confirmation.** The remaining `agent-workspace` story is **`AGENT-5` (Team Collaboration)**, depending on this feature's `TKT-5` history pattern (Story 24, complete) and `SLA-4` (Story 31, complete) — `SupportOs backlog.MD` lines 439-444. It is now immediately plannable, and would complete `EPIC 6`.
