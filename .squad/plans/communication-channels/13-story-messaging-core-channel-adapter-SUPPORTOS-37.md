# Story 13 — Messaging Core & Channel Adapter Pattern (Story: SUPPORTOS-37)

## Prerequisites

- **Story 12 (TKT-1) completed**: `Ticket` model (`backend/apps/tickets/models.py`, 55 lines), `TicketViewSet`, `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`, `SimpleRouter` established as the pattern for every domain router **after** the first (`apps.customers.urls`'s `DefaultRouter`, which owns the `/api/` root view), and `apps/core/exceptions.py`'s `ProtectedError` handling. This story's `Message.ticket` FK, admin inline, and router all build directly on that work.
- **Verified backend baseline:** `apps/communications/` is untouched `startapp` scaffolding — `models.py`, `views.py` contain only `# Create your ... here.`, `admin.py` only `# Register your models here.`, `migrations/` holds only `__init__.py`. `apps.communications` is already in `LOCAL_APPS` (`config/settings/base.py:56`) and `CommunicationsConfig.name` is already the correct dotted `apps.communications`.
- **This story is the third feature domain**, after customer-management and ticket-management. It reuses two patterns Story 12 established rather than re-deriving them:
  1. **`SimpleRouter`, not `DefaultRouter`** — `apps.customers.urls` already owns the auto-generated root view at `/api/`; a third `DefaultRouter` would collide the same way a second one would have. `apps/communications/urls.py` uses `SimpleRouter`.
  2. **A child resource reuses its parent's permissions** (`CONVENTIONS.md` § 23, added by Story 11, cited again by Story 12's own addendum). A `Message` always belongs to exactly one `Ticket` and is always displayed on that ticket's detail page — it is a child of the ticket domain, not a new permission domain. This story adds **zero** new permission constants; `MessageViewSet.permission_map` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` verbatim.
- **A placement decision this story makes explicit: the "shared conversation UI" lives in `features/tickets/components/`, not a new `features/communications/` frontend folder.** The intake's Outcome is "one conversation view all channels reuse" — read carefully, the reuse axis is **channel-agnostic rendering** (the same component renders an email message and a WhatsApp message identically), not **reuse across multiple screens**. Every real consumer of this component is the ticket detail page — there is no separate "communications" screen anywhere in EPIC 5's task list. Given that, and given `CONVENTIONS.md` § 15's `no-restricted-imports` (verified in Story 12 to block any `@/features/*` cross-feature import with zero exceptions besides `resources.ts`), building a `features/communications/` folder just to satisfy the intake's feature-slug name would either (a) sit unused with no real second consumer, or (b) force `features/tickets` to import it, which is forbidden. Story 12's `getCustomerOptions.ts` precedent — a feature calling **another domain's backend endpoint directly**, with its own minimal local type — is the pattern this story extends: `features/tickets/api/getMessages.ts`/`createMessage.ts` call `/api/messages/` directly. `frontend/src/README.md`'s already-documented exception (added by Story 12) covers exactly this case. **The backend `Message` model still lives in `apps/communications/`**, per `backend/apps/README.md:64` ("Channel adapters and messages") — only the frontend placement differs from the intake's feature-slug suggestion.
- **Verified: extending `BaseModelSerializer.Meta.read_only_fields` with an extra field works as expected** — this is the first serializer in the project with a field beyond the base `id`/`created_at`/`updated_at` that must be read-only (`Message.metadata`, adapter-only data no UI ever sets). Reproduced live:

  ```
  class Meta(BaseModelSerializer.Meta):
      model = ScratchMsg
      fields = ('id', 'body', 'metadata')
      read_only_fields = BaseModelSerializer.Meta.read_only_fields + ('metadata',)
  # -> fields['metadata'].read_only == True, fields['body'].read_only == False
  ```

  `MessageSerializer` (task 3) uses this exact shape.
- **No real channel adapter exists or is built in this story, by design.** The intake's own constraint: "channels reuse this; no per-channel bespoke models." `ChannelAdapter` (task 2) is an interface with **zero concrete subclasses and zero callers** — COMM-1 (Email) through COMM-4 (SMS) each provide exactly one subclass, per the backlog (`SupportOs backlog.MD:367-393`). This is deliberate incompleteness, not an oversight; `## Edge Cases` records how to exercise the conversation UI's inbound-message rendering without one (manually, via the API or admin).
- **This story does not fully unblock CUST-3 (Interaction History, SUPPORTOS-30).** CUST-3's intake lists `CUST-1, TKT-1, COMM-*`. After this story, both `Ticket` and `Message` exist as real models with real data an aggregation endpoint could query — the last unplanned piece for CUST-3 is CUST-3's own aggregation-endpoint story, not a missing model. Whether "COMM-*" is satisfied by COMM-0 alone or needs a real channel (COMM-1+) is a product judgement call left to whoever plans CUST-3 next; this story does not make that call.

---

## Story Goal

1. A `Message` model — `ticket` FK, `direction`, `channel`, `body`, `metadata` — full CRUD through `BaseModelViewSet`, closed by the **existing** `tickets.view`/`tickets.manage` permissions (no new permission strings).
2. A `ChannelAdapter` abstract interface every future channel story subclasses — `receive(payload) -> Message` (inbound) and `send(message)` (outbound). No subclass, no registry, no caller in this story.
3. A channel-agnostic conversation UI — a message thread plus a reply form — embedded on the existing ticket detail page (`TicketDetailPage.tsx`, Story 12). No new route.

### What `Message` holds, and what it deliberately does not

| Field | Why it is here |
|---|---|
| `ticket` | `ForeignKey(Ticket, on_delete=CASCADE)`. Required — a message with no ticket is meaningless. `CASCADE`, not `PROTECT`: a message has no independent value once its ticket is gone, the same reasoning Story 11 used for `ContactDetail.customer` (contrast `Ticket.customer`'s `PROTECT`, where the *customer* — not the ticket — outlives the relationship). |
| `direction` | `TextChoices` (`inbound`/`outbound`), **no default**. Unlike `Ticket.status`/`priority` (deliberate placeholders with a sensible default), `direction` is real content with no correct default — an inbound webhook payload and an agent's typed reply are never accidentally interchangeable, so every caller (the UI, a future adapter) must state it explicitly. |
| `channel` | `TextChoices` (`email`/`whatsapp`/`chat`/`sms`/`web_form`) — the five channels EPIC 5's description names (`SupportOs backlog.MD:356`). A **separate** vocabulary from `ContactDetail.Channel` (`email`/`phone`/`whatsapp`): one identifies how a *customer can be reached*, the other identifies *which channel a specific message travelled through* — `web_form`/`chat` have no equivalent as a standing contact method, and `phone` (a contact method, not itself a message channel — no plain "phone call" message) has no equivalent here. |
| `body` | The message text. Required. |
| `metadata` | `JSONField(default=dict, blank=True)`, **read-only via the API**. Schemaless on purpose — each channel adapter (COMM-1+) defines its own keys (an email `Message-ID`, a WhatsApp message SID, ...); this model does not validate their shape, and no UI ever sets it. |

**Not here, and why:**

- **No direct `customer`/`ContactDetail` FK.** Reachable via `message.ticket.customer` — adding a second path to the same data would let the two disagree.
- **No channel → adapter-class registry.** Deferred to COMM-1, the first story with a real subclass to register. A registry with zero real entries has nothing to prove it right.
- **No delivery-status field** (sent/delivered/bounced/read). Channel-specific and not named in this story's task list; each adapter's `metadata` is where that eventually lives.
- **No attachments.** Not named anywhere in EPIC 5's five stories; if it lands, it is its own story.
- **No message-editing or -deletion UI**, though the API technically allows both (see `## Edge Cases`) — the same "field exists, no UI exposes it" shape `Ticket.status` already established in Story 12.

### Explicitly out of scope

- **Any real channel implementation** — COMM-1 (Email) through COMM-4 (SMS), each its own story.
- **Live chat / WebSockets** — COMM-3, which the backlog explicitly calls out as needing Django Channels, a new dependency this story does not add.
- **A `features/communications/` frontend folder.** See `## Prerequisites`' placement decision.
- **New permission constants or a grant migration.** `tickets.*` already covers this.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/communication-channels/SUPPORTOS-37/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` **lines 353-397** — all of EPIC 5 through COMM-5. Read COMM-1 through COMM-4 before adding any field beyond the table above; note the 🔑 marker on both of this story's tasks, meaning later stories build directly on them.
3. `backend/apps/tickets/models.py` (55 lines) — `Ticket`, the FK target. Note its `on_delete=PROTECT`/`related_name="tickets"` shape on `Customer`, contrasted in this story's `Message.ticket` (`CASCADE`, `related_name="messages"`).
4. `backend/apps/tickets/views.py` (28 lines) — `TicketViewSet`'s `permission_map`, copied verbatim by `MessageViewSet` (task 4).
5. `backend/apps/tickets/admin.py` (11 lines) — `TicketAdmin`'s shape; task 5 adds a `MessageInline` to it (the project's first **cross-app** admin inline — `tickets/admin.py` importing a `communications` model, exactly mirroring how `ContactDetailInline` lives beside `CustomerAdmin` in the *same* app in Story 11, one level further).
6. `backend/apps/customers/views.py` lines 38-67 (`ContactDetailViewSet`) — the exact `get_queryset` shape (required filter query param, `int()` conversion guarded against `ValueError`) task 4's `MessageViewSet.get_queryset` copies, filtering by `ticket` instead of `customer`.
7. `backend/apps/core/serializers.py` (20 lines) — `BaseModelSerializer.Meta.read_only_fields`. Task 3 extends it with a tuple concatenation — verified live in `## Prerequisites`.
8. `backend/apps/core/permissions.py` (101 lines) — `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` (lines 31-32). No new constant is added.
9. `backend/apps/customers/urls.py` and `backend/apps/tickets/urls.py` — the `DefaultRouter` (customers, owns `/api/`) vs `SimpleRouter` (tickets) precedent. Task 4's `apps/communications/urls.py` copies the `SimpleRouter` shape.
10. `backend/config/api_urls.py` (19 lines, after Story 12) — task 4 adds one more `include()`, above the catch-all, after `apps.tickets.urls`.
11. `frontend/src/features/tickets/api/getCustomerOptions.ts` — the exact "call another domain's endpoint directly, own minimal type" pattern task 6's `getMessages.ts`/`createMessage.ts` extend.
12. `frontend/src/features/customers/api/useContactDetailMutations.ts` — the **scoped invalidation** pattern (`CONVENTIONS.md` § 23's documented exception, added by Story 11) task 6's `useCreateMessage` copies: invalidates only `ticketKeys.resource('messages', ticketId)`, not the whole `ticketKeys.all` prefix.
13. `frontend/src/features/customers/components/ContactDetailsSection.tsx` (all 251 lines) — the exact structural precedent for task 8's `TicketConversation.tsx`: a `Card` wrapping a `QueryBoundary`-driven list plus a `<Can permission="...">`-gated add form, with per-row rendering split into its own function.
14. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (110 lines, after Story 12) — the exact insertion point for task 8 is between the closing `</Card>` (line 101) and the closing `</QueryBoundary>` (line 103), inside the `(ticket) => (...)` render prop — the same fragment-wrap shape Story 11 used on `CustomerProfilePage.tsx`.
15. `frontend/src/shared/validation/schemas.ts` — `requiredString`, `choice` (unchanged since Story 11/12). Task 8 uses both; no new helper.
16. `frontend/src/shared/ui/form/index.ts` — confirms `TextareaField` is exported alongside `TextField`/`SelectField`. Task 8's reply form uses `SelectField` (channel) + `TextareaField` (body) — no `TextField`.
17. `frontend/src/features/tickets/locales/en.json`/`ar.json` (after Story 12) — task 7 adds a `conversation` key nested inside the **existing** `tickets` namespace (no new namespace, no `resources.ts` change), the same nested-extension shape Story 11 used for `contacts.*` inside `customers`.
18. `CONVENTIONS.md` § 15 (import conventions, the `no-restricted-imports` rule and Story 12's cross-feature-endpoint-reuse addendum), § 22 (permission_map convention), § 23 (feature module conventions, including Story 11's child-resource-reuses-parent-permissions and scoped-invalidation addenda, and Story 12's `ProtectedError`/cross-feature-endpoint addenda — this story's own additions in task 9 follow the same shape).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`Message` model exactly:** `ticket` FK, `direction`, `channel`, `body`, `metadata`. | Intake, task 1 | `backend/apps/communications/models.py::Message` — no more, no fewer. |
| **A channel-adapter interface; channels reuse it, no per-channel bespoke models.** | Intake, task 1 constraints | `ChannelAdapter` (ABC), `receive`/`send` abstract methods, zero subclasses in this story. |
| **A shared, channel-agnostic conversation UI; reuse `UI`, `FORM`, `I18N`.** | Intake, task 2 | `TicketConversation.tsx` — one component renders every `channel` value identically; `useAppForm` + `SelectField`/`TextareaField` for the reply. |
| **Reuse the parent domain's permissions — no new permission strings.** | This story's design, per `CONVENTIONS.md` § 23 (Story 11's addendum) | `MessageViewSet.permission_map` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`. |
| **The conversation UI lives in `features/tickets/`, not a new `features/communications/` folder.** | This story's design | See `## Prerequisites`' placement decision. |
| **Scoped invalidation, not prefix-wide.** | `CONVENTIONS.md` § 23 (Story 11's addendum) | `useCreateMessage` invalidates only `ticketKeys.resource('messages', ticketId)` — a message write for one ticket cannot affect another ticket's messages or the ticket list. |
| Wire format is `snake_case` end to end. | § 12 | `Message`/`MessageInput` TS types mirror the serializer verbatim. |
| Config from `ENV`; no new secrets, no new dependency. | § 17 | No environment variable, no package — `JSONField` is Django core. |

---

## Backend Tasks

### 1 — The `Message` model

**File: `backend/apps/communications/models.py`** — replace the placeholder:

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Message(TimeStampedModel):
    """A single message in a ticket's conversation — the reusable spine
    every channel (COMM-1 Email, COMM-2 WhatsApp, COMM-3 Live Chat, COMM-4
    SMS) attaches to via `ChannelAdapter` (`adapters.py`). No channel has a
    bespoke model — everything is a `Message`. See Story 13 `## Story Goal`.
    """

    class Direction(models.TextChoices):
        INBOUND = "inbound", _("Inbound")
        OUTBOUND = "outbound", _("Outbound")

    class Channel(models.TextChoices):
        EMAIL = "email", _("Email")
        WHATSAPP = "whatsapp", _("WhatsApp")
        CHAT = "chat", _("Live chat")
        SMS = "sms", _("SMS")
        WEB_FORM = "web_form", _("Web form")

    # CASCADE, not PROTECT: contrast `Ticket.customer` (Story 12, PROTECT —
    # the customer outlives the relationship). A message has no existence
    # independent of its ticket.
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="messages", verbose_name=_("ticket")
    )
    # No default, unlike Ticket.status/priority: direction is real content,
    # not a placeholder, and there is no correct default — an inbound
    # webhook payload and an agent's typed reply must never be accidentally
    # interchangeable.
    direction = models.CharField(_("direction"), max_length=10, choices=Direction.choices)
    channel = models.CharField(_("channel"), max_length=20, choices=Channel.choices)
    body = models.TextField(_("body"))
    # Schemaless on purpose: each channel adapter defines its own keys (an
    # email Message-ID, a WhatsApp message SID, ...). Read-only via the API
    # — see MessageSerializer (task 3).
    metadata = models.JSONField(_("metadata"), default=dict, blank=True)

    class Meta:
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        # Chronological, oldest first — a conversation reads top-to-bottom.
        # Contrast Ticket.Meta.ordering, a queue read newest-first.
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.get_direction_display()} {self.get_channel_display()} on ticket #{self.ticket_id}"
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations communications
```

Expect one file, `apps/communications/migrations/0001_initial.py`. **Commit it** — `MigrationStateTests.test_no_pending_migrations` fails the build otherwise.

---

### 2 — The `ChannelAdapter` interface

**Create file: `backend/apps/communications/adapters.py`**

```python
from abc import ABC, abstractmethod

from .models import Message


class ChannelAdapter(ABC):
    """Interface every channel implementation subclasses — COMM-1 (Email),
    COMM-2 (WhatsApp), COMM-3 (Live Chat), COMM-4 (SMS) each provide exactly
    one concrete subclass. Two directions:

    * `receive` turns a channel-native inbound payload (an email, a webhook
      body, ...) into a persisted `Message` attached to the right `Ticket` —
      finding or creating that ticket is left to the adapter, since "how a
      channel identifies the right conversation" is channel-specific.
    * `send` delivers an outbound `Message` (already persisted — the shared
      conversation UI's reply form, task 8, always persists first) through
      this channel's real API.

    No adapter is registered yet. `channel` -> adapter-class dispatch is
    deferred to whichever story adds the first concrete subclass (COMM-1) —
    a registry with zero real entries has nothing to prove it right. See
    Story 13 `## Prerequisites`.
    """

    channel: str

    @abstractmethod
    def receive(self, payload: dict) -> Message:
        """Turn an inbound channel-native payload into a persisted Message."""
        raise NotImplementedError

    @abstractmethod
    def send(self, message: Message) -> None:
        """Deliver an outbound Message through this channel."""
        raise NotImplementedError
```

**This file has no caller in this story.** It is interface-first, deliberately unconsumed until COMM-1 — see `## Edge Cases`.

---

### 3 — Serializer

**Create file: `backend/apps/communications/serializers.py`**

```python
from apps.core.serializers import BaseModelSerializer

from .models import Message


class MessageSerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = Message
        fields = (
            "id",
            "ticket",
            "direction",
            "channel",
            "body",
            "metadata",
            "created_at",
            "updated_at",
        )
        # `metadata` is adapter-only data no UI ever sets — read-only via the
        # API. Verified this tuple-concatenation shape works (`## Prerequisites`).
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("metadata",)
```

No `validate()` override — `ticket`/`direction`/`channel`/`body` are all plain required fields with no cross-field constraint.

---

### 4 — Viewset and routing

**Create file: `backend/apps/communications/views.py`** — replacing the placeholder:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Message
from .serializers import MessageSerializer


class MessageViewSet(BaseModelViewSet):
    """Message CRUD for one ticket's conversation. Reuses `tickets.*` — a
    message is a child of the ticket domain, not a separate permission
    domain (Story 13 `## Product rules`).
    """

    queryset = Message.objects.select_related("ticket").all()
    serializer_class = MessageSerializer

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
```

**No `ordering_fields`/`search_fields`.** Unlike `TicketViewSet`, the conversation UI has no sort control and no search box — `Message.Meta.ordering` (chronological) is the only order this story needs. `update`/`partial_update`/`destroy` are still mapped (never leave an action unmapped, § 22), even though no UI exposes editing or deleting a message — see `## Edge Cases`.

**Create file: `backend/apps/communications/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import MessageViewSet

app_name = "communications"

# SimpleRouter, continuing the precedent apps/tickets/urls.py set (Story 12):
# apps.customers.urls already owns the DefaultRouter-generated root view at
# `/api/`. A third DefaultRouter here would collide the same way a second
# one would have.
router = SimpleRouter()
router.register("messages", MessageViewSet, basename="message")

urlpatterns = router.urls
```

**File: `backend/config/api_urls.py`** — one more `include()`, above the catch-all:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    path("", include("apps.communications.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoints: `GET/POST /api/messages/` (list requires `?ticket=<id>`), `GET/PATCH/DELETE /api/messages/<pk>/`.

---

### 5 — Admin

**File: `backend/apps/communications/admin.py`** — replace the placeholder:

```python
from django.contrib import admin

from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "direction", "channel", "created_at")
    list_filter = ("direction", "channel")
    search_fields = ("body", "ticket__subject")
    readonly_fields = ("created_at", "updated_at")
```

**File: `backend/apps/tickets/admin.py`** — add a `MessageInline` to `TicketAdmin`. This is the project's first **cross-app** admin inline (`tickets/admin.py` importing a `communications` model) — the same parent-owns-the-inline shape as `ContactDetailInline` on `CustomerAdmin` (Story 11), one app apart instead of the same app:

```python
from django.contrib import admin

from apps.communications.models import Message

from .models import Ticket


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ("direction", "channel", "body", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "customer", "status", "priority", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "description", "customer__name")
    readonly_fields = ("created_at", "updated_at")
    inlines = (MessageInline,)
```

---

## Frontend Tasks

### 6 — Types and API layer (in `features/tickets/`)

**Create file: `frontend/src/features/tickets/types/message.ts`**

```ts
/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]

export const MESSAGE_CHANNELS = ['email', 'whatsapp', 'chat', 'sms', 'web_form'] as const
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]

/**
 * Mirrors `apps.communications.serializers.MessageSerializer` verbatim. Lives
 * here, not in a `features/communications/` folder — see Story 13
 * `## Prerequisites`' placement decision.
 */
export type Message = {
  id: number
  ticket: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** The write shape. `direction` has no default (mirrors the backend) — the
 * reply form (task 8) always sends `'outbound'` explicitly; it is never a
 * field the user picks. */
export type MessageInput = {
  ticket: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
}
```

**Create file: `frontend/src/features/tickets/api/getMessages.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Message } from '../types/message'

// page_size: 100 (the server's max) — same simplification as the contact
// list (Story 11) and the customer selector (Story 12): no pagination UI
// exists for a conversation thread. No `ordering` param — `Message.Meta.ordering`
// (chronological) is already the order this view needs.
export function getMessages(ticketId: number): Promise<Page<Message>> {
  return api.getPage<Message>('/messages/', {
    params: { ticket: ticketId, page_size: 100 },
  })
}
```

**Create file: `frontend/src/features/tickets/api/createMessage.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Message, MessageInput } from '../types/message'

export function createMessage(input: MessageInput): Promise<Message> {
  return api.post<Message>('/messages/', input)
}
```

**Create file: `frontend/src/features/tickets/api/useMessages.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getMessages } from './getMessages'
import { ticketKeys } from './ticketKeys'

export function useMessages(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('messages', ticketId),
    queryFn: () => getMessages(ticketId),
  })
}
```

**Create file: `frontend/src/features/tickets/api/useMessageMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createMessage } from './createMessage'
import { ticketKeys } from './ticketKeys'
import type { MessageInput } from '../types/message'

/**
 * Scoped invalidation, per CONVENTIONS.md §23's documented exception
 * (Story 11): a message write for one ticket cannot affect another ticket's
 * conversation or the ticket list, so invalidating only this ticket's
 * `messages` key is precise.
 */
export function useCreateMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MessageInput) => createMessage(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) }),
  })
}
```

---

### 7 — Locale additions

**File: `frontend/src/features/tickets/locales/en.json`** — add a `conversation` key alongside the existing top-level keys (no new namespace, no `resources.ts` change):

```json
"conversation": {
  "title": "Conversation",
  "empty": "No messages yet.",
  "directions": {
    "inbound": "Customer",
    "outbound": "Agent"
  },
  "channels": {
    "email": "Email",
    "whatsapp": "WhatsApp",
    "chat": "Live chat",
    "sms": "SMS",
    "web_form": "Web form"
  },
  "fields": {
    "channel": "Channel",
    "body": "Message"
  },
  "actions": {
    "send": "Send"
  },
  "sent": "Message sent."
}
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the same key set, translated (e.g. `"title": "المحادثة"`, `"empty": "لا توجد رسائل بعد."`, `"directions": {"inbound": "العميل", "outbound": "الوكيل"}`, `"channels": {"email": "البريد الإلكتروني", "whatsapp": "واتساب", "chat": "الدردشة المباشرة", "sms": "رسالة نصية", "web_form": "نموذج الويب"}` — translate every leaf; `## Verification Steps` checks the key sets match exactly).

---

### 8 — The conversation UI

**Create file: `frontend/src/features/tickets/components/TicketConversation.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { SelectField, TextareaField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateMessage } from '../api/useMessageMutations'
import { useMessages } from '../api/useMessages'
import { MESSAGE_CHANNELS } from '../types/message'
import type { Message, MessageInput } from '../types/message'

const replySchema = z.object({
  channel: choice(MESSAGE_CHANNELS),
  body: requiredString(5000),
})

type ReplyFormValues = z.output<typeof replySchema>

const EMPTY_REPLY: ReplyFormValues = { channel: 'email', body: '' }

// `direction` has no default (mirrors the backend model) and is never a
// field the user picks — a reply composed through this form is always
// outbound. See Story 13 `## Story Goal`.
function toMessageInput(ticketId: number, values: ReplyFormValues): MessageInput {
  return { ticket: ticketId, direction: 'outbound', channel: values.channel, body: values.body }
}

export function TicketConversation({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useMessages(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('conversation.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('conversation.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="tickets.manage">
          <ReplyForm ticketId={ticketId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function MessageRow({ message }: { message: Message }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={message.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`conversation.directions.${message.direction}`)}
        </Badge>
        <Badge variant="outline">{t(`conversation.channels.${message.channel}`)}</Badge>
        <span>{date(message.created_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — unlike a contact's email/phone value
          (Story 11), a message body is free-form prose that may itself be
          Arabic, not a Latin-script identifier. */}
      <p className="whitespace-pre-wrap">{message.body}</p>
    </li>
  )
}

function ReplyForm({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: replySchema, defaultValues: EMPTY_REPLY })
  const mutation = useCreateMessage(ticketId)

  function onSubmit(values: ReplyFormValues) {
    mutation.mutate(toMessageInput(ticketId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('conversation.sent') })
        form.reset(EMPTY_REPLY)
        setFormErrors([])
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        // A non-validation failure is already toasted by the shared
        // mutation error handler — CONVENTIONS.md §21.
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <SelectField
          control={form.control}
          name="channel"
          label={t('conversation.fields.channel')}
          options={MESSAGE_CHANNELS.map((value) => ({
            value,
            label: t(`conversation.channels.${value}`),
          }))}
        />
        <TextareaField
          control={form.control}
          name="body"
          label={t('conversation.fields.body')}
        />
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

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — wrap the existing `<Card>` (lines 50-101) and a new `<TicketConversation>` in a fragment inside the `(ticket) => (...)` render prop (line 49), the same shape Story 11 used on `CustomerProfilePage.tsx`:

```tsx
{(ticket) => (
  <>
    <Card>
      {/* ...unchanged... */}
    </Card>
    <TicketConversation ticketId={ticket.id} />
  </>
)}
```

Add `import { TicketConversation } from './TicketConversation'` to the top of the file.

---

## Documentation Tasks

### 9 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 12's two paragraphs):

> **A component "shared across channels/variants" is not automatically a `shared/` component.** When every real consumer of a "reusable" UI piece renders in the same place (one parent screen), the reuse axis is *handling every variant uniformly*, not *appearing on multiple screens* — it belongs in the feature that owns that screen, not in `src/shared/ui/` or a separate feature folder built to match a domain name. `frontend/src/features/tickets/components/TicketConversation.tsx` (Story 13, `COMM-0`) is the worked example: it renders every message channel identically and lives in `tickets` (the one screen that ever shows it), not in a `features/communications/` folder that would have needed to import it back out — which `no-restricted-imports` forbids.

No `.env.example` change, no new environment variable, no README.md change (no new API-consumption convention beyond what Story 11/12 already documented).

---

## Edge Cases & Failure Modes

- **No message is actually delivered through any real channel.** `ChannelAdapter.send`/`receive` have no concrete subclass to call them (`## Prerequisites`). The reply form's POST only **persists** an outbound `Message` row — there is no live email/WhatsApp/SMS delivery until COMM-1+ lands. This is the intended scope, not a bug.
- **There is no way to create an inbound message through the UI.** The reply form always sends `direction: 'outbound'`. To exercise the conversation UI's inbound-message rendering (the `Badge` styling, the "Customer" label) before any real adapter exists, `POST /api/messages/` manually with `"direction": "inbound"` (or use Django admin) — `## Verification Steps` does this.
- **`update`/`partial_update`/`destroy` are live API endpoints with no UI.** Same shape as `Ticket.status` in Story 12: every action is mapped (§ 22's "never leave one unmapped" rule), but nothing in the UI edits or deletes a sent message. Reachable only via a hand-built request.
- **`metadata` is always `{}` until a real adapter sets it.** The API returns it on every `Message` (read-only), but nothing populates it in this story — a future adapter's `receive()`/`send()` is where real per-channel data would be attached.
- **A ticket with more than 100 messages** silently shows only the first page — same `page_size=100` cap and forward constraint as the contact list (Story 11) and the customer selector (Story 12). A future story adding real pagination to this view is the fix.
- **Deleting a `Ticket` cascades to its messages with no confirmation beyond the existing ticket-delete dialog.** `Message.ticket` uses `CASCADE` — correct, since a message has no meaning without its ticket, but worth stating plainly: `TicketDetailPage`'s existing delete confirmation is the only guard.
- **Message body is not forced `dir="ltr"`,** unlike a `ContactDetail` value (Story 11). A contact's email/phone is always a Latin-script identifier; a message body is free-form prose that may itself be Arabic — forcing LTR would be wrong here.
- **A role without `tickets.manage` sees the conversation but cannot reply.** `<Can permission="tickets.manage">` gates the reply form only — the message list is visible to anyone with `tickets.view`, matching every other view/manage split in the project.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. `MigrationStateTests.test_no_pending_migrations` catches a `Message` shipped without its migration; `ApiCatchAllTests` is the guard on the new `SimpleRouter` not shadowing the catch-all.
2. `ruff format --check .` / `ruff check .` over the new Python.
3. `npm run build` — typechecks `Message`/`MessageInput`, the `useAppForm<typeof replySchema>` instantiation, and every new `t('tickets:conversation.…')` key through `CustomTypeOptions`.
4. `npm run lint` — confirms `getMessages.ts`/`createMessage.ts` trip no `no-restricted-imports` violation.
5. `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the `tickets` namespace (now including `conversation.*`) — `## Verification Steps`.
7. Real HTTP across permission states plus a real browser walkthrough in both languages, including a manually-created inbound message — `## Verification Steps`.

---

## Migration / Rollback

**One migration, additive.** `communications/0001_initial` creates one table with a `CASCADE` FK to `tickets_ticket`. **No change to any existing table.** No grant migration — this story adds no permission.

**Rollback of the code:** revert the commits. **No `npm install`, no `pip install`** — `JSONField` and `SimpleRouter` are both already-installed.

**Rollback of the schema:**

```powershell
python manage.py migrate communications zero
```

Reverse drops the `communications_message` table. Clean because nothing yet references `Message` — no other model's FK points at it.

**Half-applied states to avoid:**

- **Task 1's model without task 4's viewset guard** (the `?ticket=` filter). `GET /api/messages/` with no query string would return every message for every ticket — an information-scope bug, the same class Story 11 caught for `ContactDetail`.
- **Task 8 before task 6/7** — `TicketConversation.tsx`'s imports (`../api/useMessages`, `../types/message`, every `t('tickets:conversation.…')` key) fail to resolve; the build fails on the import, not the route.
- **Task 5's `MessageInline` without task 1's migration applied** — Django admin errors on a model with no table. Apply the migration before touching admin in a running instance.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration applies forward, no reset:** `python manage.py migrate`; `python manage.py showmigrations communications` shows `0001` applied.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **`en`/`ar` key sets match** for the `tickets` namespace (now including `conversation.*`). Reuse the Node one-liner from Story 10/11/12 against `frontend/src/features/tickets/locales/{en,ar}.json`. Both arrays empty.
5. **The required-filter guard works**, mirroring Story 11's Verification Step 5 exactly: `GET /api/messages/` (no query string) → `validation_error`, `fields: {"ticket": [...]}`. `GET /api/messages/?ticket=abc` → `validation_error`, **not** `internal_error`. `GET /api/messages/?ticket=999999` (nonexistent) → `200`, empty `items`.
6. **Every action enforces its own permission**, using `admin@supportos.local`/`mgr@supportos.local`/`agent@supportos.local` (password `Sup3rSecret!`), same shape as Story 12's Verification Step 6, applied to `/api/messages/`.
7. **An outbound message round-trips.** `POST /api/messages/` with `{"ticket": <id>, "direction": "outbound", "channel": "email", "body": "..."}` → `201`, `metadata` comes back `{}`.
8. **An inbound message can be created manually** (there is no adapter yet). `POST /api/messages/` with `{"ticket": <id>, "direction": "inbound", "channel": "whatsapp", "body": "..."}` → `201`. Confirm it renders with the "Customer" label in the UI (Step 10).
9. **Deleting a ticket cascades its messages.** Create a ticket with at least one message; `DELETE /api/tickets/<id>/` → `204`; `GET /api/messages/?ticket=<id>` → `200`, empty `items` (the messages are gone, not orphaned).
10. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as `agent@`:
    - Open a ticket's detail page: a "Conversation" card renders below the ticket details, empty state if no messages exist.
    - Manually create an inbound message via `curl`/admin (Step 8), refresh: it renders with the "Customer" badge.
    - Use the reply form to send an outbound message: it appears with the "Agent" badge, the form resets, no page reload needed.
    - Switch to Arabic: labels translate; message bodies render in their own natural direction (not forced LTR); channel/direction badges translate.
    - Sign in as an account **without** `tickets.manage`: the conversation list is visible, the reply form is absent.
11. **No hardcoded strings, no forbidden cross-feature import.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\tickets\components\TicketConversation.tsx -Pattern "'[A-Z][a-z]{3,}"
    Select-String -Path src\features\tickets\api\getMessages.ts,src\features\tickets\api\createMessage.ts -Pattern "@/features/communications"
    ```

    The first must return only non-user-facing hits; the second must return **nothing** (there is no `features/communications/` folder to import from in the first place — this also confirms one was not accidentally created).
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `communications.Message` extends `TimeStampedModel` with `ticket` (**`ForeignKey(Ticket, on_delete=CASCADE)`**), `direction`/`channel` (`TextChoices`, `direction` has **no default**), `body`, `metadata` (`JSONField`, read-only via the API), `Meta.ordering = ("created_at",)`.
- [ ] **No customer/`ContactDetail` FK, no delivery-status field, no attachments, no channel→adapter registry** — boundaries respected.
- [ ] `apps/communications/migrations/0001_initial.py` committed; `manage.py test` reports no pending migrations.
- [ ] `ChannelAdapter` (ABC, `receive`/`send` abstract) exists with **zero concrete subclasses and zero callers**.
- [ ] `MessageSerializer` extends `BaseModelSerializer`; `metadata` is read-only via `read_only_fields` tuple concatenation (verified pattern).
- [ ] `MessageViewSet` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` — **no new permission constants, no new grant migration**; all six actions mapped; `get_queryset` requires `?ticket=` on `list` with the `int()`-conversion guard.
- [ ] `apps/communications/urls.py` uses `SimpleRouter`; `config/api_urls.py` registers it above the catch-all.
- [ ] `MessageAdmin` registered; `MessageInline` added to `TicketAdmin` (first cross-app admin inline).
- [ ] `features/tickets/types/message.ts`, `api/getMessages.ts`, `createMessage.ts`, `useMessages.ts`, `useMessageMutations.ts` — **no `features/communications/` frontend folder created**.
- [ ] `useCreateMessage` invalidates only `ticketKeys.resource('messages', ticketId)` — scoped, not prefix-wide.
- [ ] `TicketConversation.tsx` renders the message list (no forced `dir="ltr"` on message bodies) and gates the reply form behind `<Can permission="tickets.manage">`; embedded on `TicketDetailPage.tsx` via the fragment-wrap shape.
- [ ] The reply form never exposes a `direction` field — every submission is hard-coded `outbound`.
- [ ] `conversation.*` keys added to both `tickets` locale files; `en`/`ar` key sets match exactly.
- [ ] `CONVENTIONS.md` § 23 gains the "shared across variants ≠ `shared/`" paragraph.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified by real HTTP: the required-filter guard (Step 5); all four verbs × three permission states (Step 6); outbound and manually-created inbound message round-trips (Steps 7-8); cascade delete (Step 9).
- [ ] Both languages walk through cleanly, including a manually-created inbound message rendering correctly (Step 10).
- [ ] `.squad/plans/communication-channels/00-overview.md` filled in and `.squad/plans/00-index.md` updated.

**STOP HERE. Report to the user and wait for confirmation.** This story does not fully resolve CUST-3 (Interaction History, SUPPORTOS-30)'s dependency — whether "COMM-*" requires a real channel (COMM-1+) or is satisfied by this story's messaging spine alone is a product judgement call for whoever plans CUST-3 next. The next ready stories in communication-channels are **COMM-1 (Email)** through **COMM-4 (SMS)** — each depends only on this story and can be sequenced in any order; **COMM-5 (Web Forms)** additionally needs `TKT-2`.
