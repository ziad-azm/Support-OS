# Story 16 — Live Chat (Story: SUPPORTOS-41)

## Prerequisites

- **Story 13 (COMM-0), Story 14 (COMM-1), Story 15 (COMM-2) completed.** `ChannelAdapter`, `register_adapter`/`get_adapter`, `CommunicationsConfig.ready()`, `MessageViewSet.perform_create`'s fail-open dispatch, and `TicketConversation.tsx` (already offering `chat` as one of five `MESSAGE_CHANNELS`) all exist and are reused.
- **This story is qualitatively different from COMM-1/COMM-2: it is the first to touch shared infrastructure (the ASGI application, the dev server's underlying protocol handling) rather than adding an isolated adapter.** Every prior COMM story was purely additive — new files, new settings, zero risk to anything already shipped. This one is not: adding Django Channels + Daphne changes how `manage.py runserver` itself boots. `## Verification Steps` therefore re-checks **every previously-verified endpoint** (health, auth, customers, tickets, messages, both webhooks), not just this story's new surface — that is not optional caution, it is the actual risk profile of this change.
- **Verified: no HTTP client or real-time library is installed.** `requirements.txt` (confirmed unchanged since Story 15) has no `channels`, `daphne`, or `channels_redis`. This story adds `channels` and `daphne` — the first new runtime dependencies since project setup (Story 01).
- **The in-memory channel layer is a deliberate, scoped choice, not an oversight.** `CHANNEL_LAYERS` uses `channels.layers.InMemoryChannelLayer`, which only broadcasts within a single process — correct for local dev and a single-instance deployment, wrong for a multi-process production deployment (where a `channels_redis`-backed layer is the standard fix). This project has no Redis dependency anywhere and no multi-process deployment story yet; adding one is out of scope here and would be a one-line `CHANNEL_LAYERS` swap when it becomes real.
- **No customer authentication is built here — PORTAL-0 owns that.** `SupportOs backlog.MD:526-529`, `STORY (PORTAL-0) — Portal Access & Customer Auth`, explicitly owns "Customer auth + scoped access" and "Portal shell UI." COMM-3 depends only on `COMM-0`, not `PORTAL-0` — the backlog's own author anticipated an anonymous, session-token-based widget here, matching how real live-chat products (Intercom, Zendesk Chat) work: a visitor starts chatting by typing a name, not logging in. The widget's session token (`django.core.signing`, no new persisted field, no new dependency) is a deliberately lightweight, single-conversation credential — not a general customer account.
- **WebSocket authentication travels in the query string, not a header — a browser platform limitation, not a design choice.** The native `WebSocket` constructor has no way to set custom headers (including `Authorization`) on the handshake request; both the anonymous widget's signed session token and the signed-in agent's JWT are passed as `?customer_token=`/`?token=` query parameters. This is the standard, unavoidable pattern for browser-originated WebSocket auth.
- **The agent never sends a chat reply over the WebSocket.** `TicketConversation.tsx`'s existing reply form (`POST /api/messages/`, Story 13) is what "reusing the shared conversation UI" means for the agent side — picking `chat` as the channel there is unchanged from picking `email`/`whatsapp`. The WebSocket connection this story adds to `TicketConversation.tsx` is **receive-only**: it exists so the agent sees a customer's live message appear without a manual refresh, by invalidating the same TanStack Query cache the reply form already uses. `LiveChatAdapter.send()` performs the broadcast; the Consumer never processes an inbound frame from a JWT-authenticated connection.
- **`LiveChatAdapter.send()` (called synchronously, from `MessageViewSet.perform_create`) must reach the channel layer's async API via `asgiref.sync.async_to_sync`, and the Consumer (async) must reach the sync Django ORM/adapter via `channels.db.database_sync_to_async`.** Both are the standard, documented Channels bridging utilities for exactly this "sync view triggers a WS broadcast" / "async consumer calls sync ORM code" shape — not project inventions.
- **The WebSocket connection closes a real permission gap the REST endpoints already enforce.** An agent's connection is only accepted after validating their JWT **and** confirming they hold `tickets.view` (via the existing `apps.core.permissions.permissions_for`) — without this check, a signed-in user with no ticket permissions could otherwise eavesdrop on a ticket's live conversation over the socket even though `GET /api/messages/` would 403 them.
- **No migration.** No model field changes — `Message`, `Ticket`, `Customer` are all unchanged.

---

## Story Goal

1. **Real-time chat backend**: `LiveChatAdapter(ChannelAdapter)`, `TicketChatConsumer` (WebSocket), and the ASGI/Channels wiring, persisting every chat message to `Message` via the same adapter pattern every other channel uses.
2. **A live-chat widget**: a new, unauthenticated frontend feature (`features/live-chat/`) — a two-field "start chat" form, then a real-time message thread, all channel-agnostic UI patterns already established (`FORM`, `UI`, `I18N`) applied to a new anonymous surface.
3. **An agent console**: not a new screen — `TicketConversation.tsx` (Story 13) gains a small receive-only WebSocket hook so live customer messages appear without a manual refresh. The reply form is unchanged.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `channels`, `daphne` (new dependencies) | Required for any WebSocket support in Django — the intake names "Django Channels" explicitly. |
| `LiveChatAdapter.start_session` | The "first contact" step — anonymous, no address tag (mirrors WhatsApp's identity-based routing, Story 15), returns a signed session token. |
| `TicketChatConsumer` | The real-time transport: joins a per-ticket channel-layer group, persists inbound customer messages, relays broadcasts to every connected socket. |
| `features/live-chat/` (new feature) | The widget has a fundamentally different audience (anonymous customer) and auth model than every other frontend feature — it earns its own feature folder, not a corner of `features/tickets/`. |
| A receive-only WS hook in `features/tickets/` | "Agent console reusing shared conversation UI" — the console *is* `TicketConversation.tsx`; it only needed to learn about live updates. |

**Not here, and why:**

- **No customer authentication, no "portal."** PORTAL-0's job — see `## Prerequisites`.
- **No Redis-backed channel layer, no multi-process deployment support.** In-memory only, a deliberate, documented single-process scope.
- **No typing indicators, no read receipts, no "agent is online" presence.** Not named in the intake's two tasks.
- **No automatic WebSocket reconnection.** A dropped connection (network blip, server restart) stops delivering live updates until the component remounts (a page reload for the widget, a re-navigation for the agent console). Acceptable for this story's scope — see `## Edge Cases`.
- **No chat-history pagination beyond what already exists.** `TicketConversation`'s existing `page_size=100` cap (Story 13) is unchanged.
- **No production ASGI server choice** (Daphne vs. Uvicorn+Gunicorn) — a deployment/ops decision outside this plan's code changes; `config/asgi.py`'s `application` callable is what any of them would serve.

---

## Context — Read These Files First

1. `.squad/stories/communication-channels/SUPPORTOS-41/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` **lines 381-386** (`COMM-3`) and **lines 521-529** (`EPIC 9`/`PORTAL-0`, the customer-auth story this one must not pre-empt).
3. `backend/apps/communications/whatsapp_adapter.py` (all lines, after Story 15) — the "identity-based routing, no address tag, continue the most recent non-closed ticket" pattern task 1's `LiveChatAdapter.start_session` copies verbatim for a different identity key (name/email instead of a phone number).
4. `backend/apps/communications/views.py` (152 lines, after Story 15) — `EmailInboundWebhookView`/`WhatsAppInboundWebhookView`'s `authentication_classes: list = []` / `permission_classes = [AllowAny]` shape, copied by task 4's `LiveChatStartView`.
5. `backend/apps/communications/urls.py`, `apps.py`, `adapters.py` (unchanged shapes, extended the same way tasks 1-5 extend them).
6. `backend/apps/core/permissions.py` — `Permissions.TICKETS_VIEW`, `permissions_for(user)` (lines 42-57) — the exact function task 2's Consumer reuses to check an agent connection's permission, matching `HasPermission`'s own enforcement.
7. `backend/config/asgi.py` (16 lines) — Django's default scaffold, **unchanged since project setup**. Task 3 replaces its body with the `ProtocolTypeRouter` wiring.
8. `backend/config/settings/base.py` — `DJANGO_APPS`/`THIRD_PARTY_APPS`/`LOCAL_APPS` (lines 33-64) and the `# --- Email (COMM-1) ---`/`# --- WhatsApp (COMM-2) ---` section-comment style task 5's `ASGI_APPLICATION`/`CHANNEL_LAYERS` additions follow.
9. `frontend/src/config/env.ts` (23 lines) — `env.apiBaseUrl` (`http://localhost:8000/api`), the value task 9's `getWebSocketUrl` derives a `ws://localhost:8000/ws/...` URL from — no new frontend env var.
10. `frontend/src/shared/auth/tokenStorage.ts` (43 lines) — `getAccessToken()` (in-memory, exported but not re-exported from `index.ts`). Task 12's agent-side WS hook imports it directly from this file, not through `@/shared/auth`'s curated public surface — a `shared/` module, not a `features/*` cross-feature import, so `no-restricted-imports` does not apply.
11. `frontend/src/features/tickets/components/TicketConversation.tsx` (all lines, after Story 13) — `ReplyForm`'s exact `useAppForm` + schema + `Form`/`TextField` shape, copied by task 10's widget forms (both the "start chat" form and the message-compose box — `CONVENTIONS.md` § 20's "`useAppForm` is the only entry point" applies here too, including to a chat-message input, matching `ReplyForm`'s own precedent).
12. `frontend/src/app/router.tsx` — the `login` route (a direct child of the root, **outside** `RequireAuth`) is the exact precedent task 11's `chat` route follows — public, no auth guard.
13. `frontend/src/shared/i18n/resources.ts` — the two-imports-plus-one-entry-per-language registration pattern task 13 follows for the new `liveChat` namespace.
14. `CONVENTIONS.md` § 20 (the `useAppForm`-is-the-only-entry-point rule), § 15 (import conventions — `shared/` is not restricted the way `features/*` is), § 23 (feature module conventions — this story's own addition in task 14 follows the same shape as Stories 11-15's).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Real-time chat backend via Django Channels, persisting through the adapter pattern.** | Intake, task 1 | `LiveChatAdapter`, `TicketChatConsumer`, `channels`/`daphne`. |
| **Customer widget + agent console, reusing the shared conversation UI.** | Intake, task 2 | `features/live-chat/` (new); `TicketConversation.tsx` gains a receive-only WS hook, its reply form unchanged. |
| **The agent never sends over the socket — only the existing REST form.** | This story's design | `TicketChatConsumer.receive` ignores any frame from an outbound (JWT) connection. |
| **WebSocket auth via query string, both directions.** | Browser platform limitation | `?customer_token=`/`?token=`, verified in `## Prerequisites`. |
| **An agent connection is permission-checked, not just authenticated.** | This story's design, closing a real gap | `TICKETS_VIEW` checked via `permissions_for(user)` before `.accept()`. |
| **No customer login — PORTAL-0's job.** | `SupportOs backlog.MD:526-529` | `LiveChatStartView` is public; the session token is per-conversation, not a customer account. |
| **In-memory channel layer, single-process scope.** | This story's design | `CHANNEL_LAYERS["default"]["BACKEND"] = "channels.layers.InMemoryChannelLayer"`. |
| **Every previously-verified endpoint still works after adding Daphne.** | This story's design, given the shared-infrastructure risk | `## Verification Steps`' regression pass. |
| Wire format is `snake_case` end to end. | § 12 | `startLiveChat`'s payload/response; the WS message payload mirrors `MessageSerializer`. |
| Config from `ENV`; no new secret. | § 17 | Session token signing uses `SECRET_KEY` (already `ENV`-sourced); `SESSION_MAX_AGE_SECONDS` is a plain constant, not provider config — see `## Edge Cases`. |

---

## Backend Tasks

### 1 — Dependencies and settings

**File: `backend/requirements.txt`** — append:

```
channels>=4.1,<5
daphne>=4.1,<5
```

**File: `backend/config/settings/base.py`** — `daphne` must precede `django.contrib.staticfiles` (Channels' own documented setup requirement) so `manage.py runserver` becomes ASGI/WebSocket-aware:

```python
DJANGO_APPS = [
    "daphne",  # Must precede django.contrib.staticfiles — makes `runserver`
    # ASGI/WebSocket-aware. See Story 16 `## Prerequisites`.
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt.token_blacklist",
    "channels",
]
```

Append after the `# --- WhatsApp (COMM-2) ---` block:

```python
# --- Live Chat / Channels (COMM-3) -----------------------------------------
ASGI_APPLICATION = "config.asgi.application"

# In-memory: broadcasts only within a single process. Correct for local dev
# and a single-instance deployment; a channels_redis-backed layer is the
# standard swap for multi-process production, out of scope here — this
# project has no Redis dependency anywhere. See Story 16 `## Prerequisites`.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}
```

Install: `pip install -r requirements.txt` (from `backend/`, venv active).

---

### 2 — ASGI wiring

**File: `backend/config/asgi.py`** — replace entirely:

```python
"""
ASGI config for config project — now Channels-aware (Story 16, COMM-3).
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Django's own ASGI app must be constructed before importing anything that
# touches installed apps/models — Channels' routing imports the consumer,
# which imports models. See Django's own ASGI deployment docs.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from apps.communications.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # Validates the WS handshake's Origin header against ALLOWED_HOSTS —
        # a Channels-specific security layer, separate from CORS_ALLOWED_ORIGINS
        # (which only applies to HTTP responses, not the WS upgrade request).
        "websocket": AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
    }
)
```

No `AuthMiddlewareStack` — this project's WS auth is query-string token verification inside `TicketChatConsumer.connect`, not Django session/cookie auth.

---

### 3 — The live chat adapter

**Create file: `backend/apps/communications/live_chat_adapter.py`**

```python
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core import signing
from django.utils.translation import gettext_lazy as _

from apps.customers.models import Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message
from .serializers import MessageSerializer

LIVE_CHAT_SALT = "apps.communications.live_chat"
# A week: long enough for a customer to resume a conversation across visits,
# short enough that a stale/leaked token is not a standing liability. A
# plain constant, not an ENV var — an internal tuning knob, not provider
# config (contrast EMAIL_*/WHATSAPP_*, Stories 14-15).
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7


def resolve_session_ticket(token: str) -> int | None:
    """Verify a customer's live-chat session token and return the ticket id
    it names, or None if the token is missing, tampered with, or expired.
    """
    if not token:
        return None
    try:
        return signing.loads(token, salt=LIVE_CHAT_SALT, max_age=SESSION_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None


@register_adapter
class LiveChatAdapter(ChannelAdapter):
    """Live chat — COMM-3. Unlike Email/WhatsApp, there is no external
    provider: "delivery" for an outbound message is a WebSocket broadcast
    to the ticket's own channel-layer group (not a call to a third-party
    API), and "receiving" an inbound message is a WebSocket frame from the
    widget, not a webhook. See Story 16 `## Prerequisites`.
    """

    channel = Message.Channel.CHAT

    def start_session(self, name: str, email: str | None) -> tuple[Ticket, str]:
        """Find-or-create the customer/ticket for a new widget session and
        return `(ticket, signed_session_token)`. Mirrors the "continue the
        most recent non-closed ticket, else start a new one" rule Story 15
        established for WhatsApp — a chat widget has no per-conversation
        address either.
        """
        if email:
            customer, _created = Customer.objects.get_or_create(
                email=email, defaults={"name": name}
            )
        else:
            customer = Customer.objects.create(name=name)

        ticket = (
            Ticket.objects.filter(customer=customer)
            .exclude(status=Ticket.Status.CLOSED)
            .order_by("-created_at")
            .first()
        )
        if ticket is None:
            ticket = Ticket.objects.create(
                subject=_("Live chat with %(name)s") % {"name": name},
                description=_("Started via the live chat widget."),
                customer=customer,
            )
        token = signing.dumps(ticket.id, salt=LIVE_CHAT_SALT)
        return ticket, token

    def receive(self, payload: dict) -> Message:
        return Message.objects.create(
            ticket_id=payload["ticket_id"],
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.CHAT,
            body=payload["body"],
        )

    def send(self, message: Message) -> None:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"ticket_{message.ticket_id}",
            {"type": "chat.message", "message": MessageSerializer(message).data},
        )
```

---

### 4 — The WebSocket consumer and routing

**Create file: `backend/apps/communications/consumers.py`**

```python
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.permissions import Permissions, permissions_for

from .live_chat_adapter import LiveChatAdapter, resolve_session_ticket
from .models import Message
from .serializers import MessageSerializer

UNAUTHORIZED = 4401
FORBIDDEN = 4403


class TicketChatConsumer(AsyncWebsocketConsumer):
    """One WebSocket per ticket's live conversation. Two kinds of caller:

    * `?customer_token=<signed>` — the anonymous widget's own session token
      (`live_chat_adapter.resolve_session_ticket`). Messages it sends are
      persisted as inbound `Message`s.
    * `?token=<JWT>` — a signed-in agent, already viewing the ticket in
      `TicketConversation.tsx`. Receive-only: an agent still replies
      through the existing `POST /api/messages/` form (Story 13) — this
      connection only pushes live updates to that already-working screen.
      Permission-checked (`tickets.view`), not just authenticated — see
      Story 16 `## Prerequisites`.

    Browsers cannot set custom headers on a WebSocket handshake, so both
    tokens travel in the query string, not an Authorization header.
    """

    async def connect(self):
        self.ticket_id = int(self.scope["url_route"]["kwargs"]["ticket_id"])
        params = self.scope["query_string"].decode()
        query = dict(pair.split("=", 1) for pair in params.split("&") if "=" in pair)

        customer_token = query.get("customer_token")
        jwt_token = query.get("token")

        if customer_token:
            ticket_id = resolve_session_ticket(customer_token)
            if ticket_id != self.ticket_id:
                await self.close(code=UNAUTHORIZED)
                return
            self.direction = Message.Direction.INBOUND
        elif jwt_token:
            try:
                access = AccessToken(jwt_token)
            except TokenError:
                await self.close(code=UNAUTHORIZED)
                return
            user = await database_sync_to_async(
                get_user_model().objects.filter(pk=access["user_id"]).first
            )()
            has_permission = user is not None and Permissions.TICKETS_VIEW in (
                await database_sync_to_async(permissions_for)(user)
            )
            if not has_permission:
                await self.close(code=FORBIDDEN)
                return
            self.direction = Message.Direction.OUTBOUND
        else:
            await self.close(code=UNAUTHORIZED)
            return

        self.group_name = f"ticket_{self.ticket_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Only the customer side sends over the socket — see the class
        # docstring. An agent connection ignores any inbound frame.
        if self.direction != Message.Direction.INBOUND:
            return
        try:
            data = json.loads(text_data)
        except ValueError:
            return
        body = (data.get("body") or "").strip()
        if not body:
            return

        message = await database_sync_to_async(LiveChatAdapter().receive)(
            {"ticket_id": self.ticket_id, "body": body}
        )
        payload = await database_sync_to_async(lambda: MessageSerializer(message).data)()
        await self.channel_layer.group_send(
            self.group_name, {"type": "chat.message", "message": payload}
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["message"]))
```

**Create file: `backend/apps/communications/routing.py`**

```python
from django.urls import re_path

from .consumers import TicketChatConsumer

websocket_urlpatterns = [
    re_path(r"^ws/tickets/(?P<ticket_id>\d+)/$", TicketChatConsumer.as_asgi()),
]
```

Endpoint: `ws://.../ws/tickets/<id>/?customer_token=...` or `?token=...`.

---

### 5 — The "start chat" REST endpoint

**File: `backend/apps/communications/views.py`** — extend imports and append the view:

```python
from .live_chat_adapter import LiveChatAdapter
```

```python
class LiveChatStartView(APIView):
    """Starts (or resumes) an anonymous live-chat session: creates a
    Customer + Ticket (or continues the customer's most recent non-closed
    one) and returns a signed session token the widget uses to open its
    WebSocket connection. Public — a live-chat widget has no login;
    PORTAL-0 (`SupportOs backlog.MD:526-529`) owns real customer
    authentication, deliberately not pre-empted here. See Story 16
    `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": [_("This field is required.")]})
        email = (request.data.get("email") or "").strip() or None

        ticket, token = LiveChatAdapter().start_session(name, email)
        return Response(
            {"ticket_id": ticket.id, "session_token": token}, status=status.HTTP_201_CREATED
        )
```

**File: `backend/apps/communications/urls.py`** — add the new path:

```python
from .views import (
    EmailInboundWebhookView,
    LiveChatStartView,
    MessageViewSet,
    WhatsAppInboundWebhookView,
)

urlpatterns = [
    path("webhooks/email/inbound/", EmailInboundWebhookView.as_view(), name="email-inbound-webhook"),
    path(
        "webhooks/whatsapp/inbound/",
        WhatsAppInboundWebhookView.as_view(),
        name="whatsapp-inbound-webhook",
    ),
    path("live-chat/start/", LiveChatStartView.as_view(), name="live-chat-start"),
    *router.urls,
]
```

**File: `backend/apps/communications/apps.py`** — register the third adapter:

```python
    def ready(self):
        from . import (  # noqa: F401 — imports run @register_adapter
            email_adapter,
            live_chat_adapter,
            whatsapp_adapter,
        )
```

Endpoint: `POST /api/live-chat/start/`.

---

## Frontend Tasks

### 6 — WebSocket URL helper (shared)

**Create file: `frontend/src/shared/lib/ws.ts`**

```ts
import { env } from '@/config/env'

/**
 * Derives a WebSocket URL from the same `VITE_API_BASE_URL` the REST client
 * uses (`http://localhost:8000/api` -> `ws://localhost:8000/ws/...`) — no
 * new env var. `wss:` when the API is served over `https:`.
 */
export function getWebSocketUrl(path: string): string {
  const httpBase = env.apiBaseUrl.replace(/\/api$/, '')
  const wsBase = httpBase.replace(/^http/, 'ws')
  return `${wsBase}${path}`
}
```

Used by both the widget (task 10) and the agent-side hook (task 12) — genuinely shared, not feature-specific.

---

### 7 — The live-chat feature: types and API layer

**Create file: `frontend/src/features/live-chat/types/session.ts`**

```ts
export type LiveChatSession = {
  ticketId: number
  sessionToken: string
}
```

**Create file: `frontend/src/features/live-chat/types/message.ts`**

```ts
/**
 * A minimal local mirror of `apps.communications.serializers.MessageSerializer`
 * — this feature cannot import `@/features/tickets` (CONVENTIONS.md §15),
 * and needs only these three fields to render the thread.
 */
export type ChatMessage = {
  id: number
  direction: 'inbound' | 'outbound'
  body: string
}
```

**Create file: `frontend/src/features/live-chat/api/startLiveChat.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type StartLiveChatInput = { name: string; email?: string }
type StartLiveChatResponse = { ticket_id: number; session_token: string }

export function startLiveChat(input: StartLiveChatInput): Promise<StartLiveChatResponse> {
  return api.post<StartLiveChatResponse>('/live-chat/start/', input)
}
```

**Create file: `frontend/src/features/live-chat/lib/session.ts`**

```ts
import type { LiveChatSession } from '../types/session'

const STORAGE_KEY = 'supportos.liveChat.session'

export function loadSession(): LiveChatSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LiveChatSession
    if (typeof parsed.ticketId !== 'number' || typeof parsed.sessionToken !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: LiveChatSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Private mode / storage disabled — the chat still works for this tab,
    // it just will not resume after a reload.
  }
}
```

---

### 8 — Locale namespace

**Create file: `frontend/src/features/live-chat/locales/en.json`**

```json
{
  "start": {
    "title": "Start a conversation",
    "name": "Your name",
    "email": "Email (optional)",
    "action": "Start chat"
  },
  "chat": {
    "title": "Live chat",
    "placeholder": "Type a message",
    "send": "Send"
  }
}
```

**Create `frontend/src/features/live-chat/locales/ar.json`** with the identical key set, translated (e.g. `"title": "ابدأ محادثة"`, `"name": "اسمك"`, `"email": "البريد الإلكتروني (اختياري)"`, `"action": "بدء المحادثة"`, `"title": "الدردشة المباشرة"`, `"placeholder": "اكتب رسالة"`, `"send": "إرسال"`).

**File: `frontend/src/shared/i18n/resources.ts`** — register the `liveChat` namespace, following the existing two-imports-plus-one-entry-per-language pattern.

---

### 9 — The widget

**Create file: `frontend/src/features/live-chat/components/LiveChatWidget.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { optionalEmail, requiredString } from '@/shared/validation/schemas'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { TextField, useAppForm } from '@/shared/ui/form'
import { getWebSocketUrl } from '@/shared/lib/ws'

import { startLiveChat } from '../api/startLiveChat'
import { loadSession, saveSession } from '../lib/session'
import type { ChatMessage } from '../types/message'
import type { LiveChatSession } from '../types/session'

const startSchema = z.object({
  name: requiredString(200),
  email: optionalEmail(),
})
type StartFormValues = z.output<typeof startSchema>

const messageSchema = z.object({ body: requiredString(2000) })
type MessageFormValues = z.output<typeof messageSchema>

export function LiveChatWidget() {
  const [session, setSession] = useState<LiveChatSession | null>(() => loadSession())

  if (!session) {
    return <StartForm onStarted={setSession} />
  }
  return <ChatPane session={session} />
}

function StartForm({ onStarted }: { onStarted: (session: LiveChatSession) => void }) {
  const { t } = useTranslation('liveChat')
  const [pending, setPending] = useState(false)
  const form = useAppForm({ schema: startSchema, defaultValues: { name: '', email: '' } })

  async function onSubmit(values: StartFormValues) {
    setPending(true)
    try {
      const result = await startLiveChat({ name: values.name, email: values.email })
      const session = { ticketId: result.ticket_id, sessionToken: result.session_token }
      saveSession(session)
      onStarted(session)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-sm">
      <CardHeader>
        <CardTitle>{t('start.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <TextField control={form.control} name="name" label={t('start.name')} />
            <TextField control={form.control} name="email" label={t('start.email')} type="email" />
            <Button type="submit" disabled={pending}>
              {t('start.action')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function ChatPane({ session }: { session: LiveChatSession }) {
  const { t } = useTranslation('liveChat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const form = useAppForm({ schema: messageSchema, defaultValues: { body: '' } })

  useEffect(() => {
    const socket = new WebSocket(
      getWebSocketUrl(`/ws/tickets/${session.ticketId}/?customer_token=${session.sessionToken}`),
    )
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ChatMessage
      setMessages((prev) => [...prev, message])
    }
    socketRef.current = socket
    return () => socket.close()
  }, [session])

  function onSubmit(values: MessageFormValues) {
    socketRef.current?.send(JSON.stringify({ body: values.body }))
    form.reset({ body: '' })
  }

  return (
    <Card className="mx-auto mt-10 flex max-w-sm flex-col" style={{ height: '32rem' }}>
      <CardHeader>
        <CardTitle>{t('chat.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {messages.map((message) => (
            <li
              key={message.id}
              className={message.direction === 'outbound' ? 'self-end text-end' : 'self-start'}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
            </li>
          ))}
        </ul>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
            <TextField control={form.control} name="body" label={t('chat.placeholder')} />
            <Button type="submit">{t('chat.send')}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

`self-end`/`self-start` (not `ms-auto`/physical alternatives) are logical flex-alignment values — direction-safe by construction, no § 18 RTL exemption needed.

---

### 10 — Route

**File: `frontend/src/app/router.tsx`** — add a public `chat` route as a sibling of the existing `login` route, **outside** `RequireAuth`:

```tsx
      {
        path: 'chat',
        lazy: async () => {
          const { LiveChatWidget } = await import('@/features/live-chat/components/LiveChatWidget')
          return { element: <LiveChatWidget /> }
        },
      },
```

No `RequirePermission`, no `RequireAuth` — this route is intentionally public.

---

### 11 — Agent-side live updates

**Create file: `frontend/src/features/tickets/api/useTicketChatSocket.ts`**

```ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getAccessToken } from '@/shared/auth/tokenStorage'
import { getWebSocketUrl } from '@/shared/lib/ws'

import { ticketKeys } from './ticketKeys'

/**
 * Receive-only: an agent always replies through the existing
 * `POST /api/messages/` form (`TicketConversation.tsx`'s `ReplyForm`,
 * Story 13) — this hook only invalidates the messages cache when *any*
 * live-chat event arrives, so the existing `useMessages` query refetches.
 * See Story 16 `## Prerequisites`.
 *
 * No automatic reconnection: a dropped connection stops delivering live
 * updates until this component remounts. See `## Edge Cases`.
 */
export function useTicketChatSocket(ticketId: number) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const socket = new WebSocket(getWebSocketUrl(`/ws/tickets/${ticketId}/?token=${token}`))
    socket.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) })
    }
    return () => socket.close()
  }, [ticketId, queryClient])
}
```

**File: `frontend/src/features/tickets/components/TicketConversation.tsx`** — add one line inside `TicketConversation`:

```tsx
import { useTicketChatSocket } from '../api/useTicketChatSocket'

export function TicketConversation({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useMessages(ticketId)
  useTicketChatSocket(ticketId)
  // ...unchanged...
```

---

## Documentation Tasks

### 12 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 15's paragraph):

> **Real-time delivery for a channel with no external provider is a WebSocket broadcast to a per-record channel-layer group, not a third-party API call.** `LiveChatAdapter.send()` (Story 16, `COMM-3`) bridges from synchronous view code to the (async) channel layer via `asgiref.sync.async_to_sync`; `TicketChatConsumer` (async) bridges back to synchronous Django ORM/adapter calls via `channels.db.database_sync_to_async` — both are Channels' own documented utilities for this exact shape, not project inventions. **A browser cannot set custom headers on a WebSocket handshake** — auth (a JWT, or an anonymous signed session token) travels in the query string on every WS connection this project makes, and a connection should be **permission-checked, not just authenticated**, whenever the equivalent REST endpoint would be. **A signed, unpersisted session token** (`django.core.signing`, no new model field) is the pattern for a lightweight anonymous identity that does not warrant a real customer account — reach for it before adding a session/account model for a single-conversation credential.

No new import-boundary pattern beyond what Story 12 already established (`features/live-chat/` reuses the same "own the exact data shape you need" approach, not a new one).

---

## Edge Cases & Failure Modes

- **A dropped WebSocket connection is not automatically reconnected**, on either side (widget or agent console). The widget still works for sending (each submit reuses the same `socketRef`, which will silently fail to send if the socket already closed — accepted, no retry UI); the agent console simply stops receiving live pushes until the ticket detail page is revisited. Acceptable for this story's scope.
- **The customer's session token has no server-side revocation.** A leaked token grants live-chat access to that one ticket's conversation for up to `SESSION_MAX_AGE_SECONDS` (one week) — no logout, no rotation. Consistent with the token's deliberately narrow scope (one conversation, not an account); a real account system (PORTAL-0) would need its own, separate token lifecycle.
- **A closed ticket does not close the widget's existing WebSocket connection.** If an agent closes the ticket while the customer's tab is still open, the socket stays connected (nothing in `TicketChatConsumer` checks `Ticket.status`), and a further message from the customer is still recorded as inbound on the closed ticket. The *next* `start_session` call (a page reload with no stored session, or an expired token) would correctly start a **new** ticket, per the "continue the most recent non-closed ticket" rule — but an already-open tab does not notice the status change. Accepted; a future story could have the Consumer check status on each `receive`.
- **`InMemoryChannelLayer` means live updates only work within one running server process.** Running `manage.py runserver` normally (a single process) is fine; anything that forks multiple worker processes (not this project's current dev or deployment setup) would silently split ticket groups across processes with no error — see `## Prerequisites`.
- **A malformed WebSocket text frame (invalid JSON, or JSON with no `body`) is silently dropped**, not an error response — WebSocket frames have no per-message HTTP-style status code to return, so the Consumer's `receive` simply does nothing rather than crash the connection.
- **The widget's "start chat" `email` field reuses `Customer.email`'s exact uniqueness behaviour** (Story 10's verified blank-collision/NULL finding) — `get_or_create(email=email, ...)` is only reached when `email` is truthy (never blank), so the trap that finding described does not apply here; a **duplicate** email correctly reuses the existing customer instead of erroring, matching WhatsApp's own `ContactDetail` lookup precedent (Story 15) rather than Story 10's serializer-level `UniqueValidator` path (this view never goes through `CustomerSerializer`).
- **Arabic chat bodies round-trip correctly** — `json.dumps`/`JSON.stringify` are UTF-8-safe by default on both ends; nothing in the Consumer or the widget assumes ASCII.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide, not just `communications`) — must report **no changes**.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. **The full regression pass** — every previously-verified endpoint (health, auth, customers, tickets, messages, both webhooks) re-checked after adding Daphne — `## Verification Steps` step 4.
5. Real WebSocket traffic: `start_session` creating/continuing a ticket, a customer message broadcasting to a connected agent socket, an agent's REST reply broadcasting to a connected customer socket, both auth-failure paths (bad/missing token, insufficient permission) — `## Verification Steps`.
6. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new `live-chat` feature and `TicketConversation.tsx`'s one-line addition.

---

## Migration / Rollback

**No migration.** No model field changes.

**Rollback of the code:** revert the commits, then `pip uninstall channels daphne` (or reinstall from the reverted `requirements.txt`) and remove `"daphne"`/`"channels"` from `INSTALLED_APPS` if reverting partially — reverting the whole story's commits together avoids a half-applied `INSTALLED_APPS` state, which is the actual risk (see below).

**Half-applied states to avoid:**

- **`daphne`/`channels` added to `INSTALLED_APPS` without the packages installed** (or vice versa) — `manage.py` fails to start at all, not just this story's new endpoints. Install and configure together; verify with `python manage.py check` immediately after task 1.
- **`ASGI_APPLICATION` set before `config/asgi.py` is updated** (task 2) — Channels looks for a `ProtocolTypeRouter`-shaped `application`; Django's original plain `get_asgi_application()` result does not support WebSockets, so `manage.py runserver` would start but every WS connection would fail. Ship tasks 1-2 together.
- **`LiveChatAdapter` registered (task 3/5) without `apps.py`'s `ready()` import** — `get_adapter("chat")` returns `None` forever, silently matching every other channel's "unregistered adapter" no-op (Story 13's established behaviour) — not a crash, but live chat never actually broadcasts.
- **Task 11 (`TicketConversation.tsx`'s WS hook) before task 6 (`ws.ts`)** — import fails to resolve, build fails on the import, not silently.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration was needed:** `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Full regression pass on every previously-verified endpoint**, after starting the dev server with `daphne` installed (`python manage.py runserver`, confirm the startup banner now shows Daphne, not Django's plain WSGI dev server):
   - `GET /api/health/` → `200`.
   - `POST /api/auth/token/` with `agent@supportos.local`/`Sup3rSecret!` → `200`, valid tokens.
   - `GET /api/customers/`, `POST /api/tickets/`, `GET/POST /api/messages/?ticket=<id>` → all still behave exactly as Stories 10-13 established.
   - `POST /api/webhooks/email/inbound/` and `POST /api/webhooks/whatsapp/inbound/` (Stories 14-15's fail-closed/signature checks) → still return the same codes as before this story.
5. **`start_session` creates a ticket and returns a usable token.** `POST /api/live-chat/start/` with `{"name": "Test Visitor"}` → `201`, `{"ticket_id": <id>, "session_token": "..."}`. Confirm via `GET /api/tickets/<id>/` (agent token) the ticket exists with `subject: "Live chat with Test Visitor"`.
6. **A second `start_session` call with the same email continues the same ticket**, mirroring Story 15's WhatsApp continuation behaviour — `POST` again with `{"name": "Test Visitor", "email": "test@example.com"}` twice; confirm both calls return the same `ticket_id` on the second call (after the first establishes the customer).
7. **A WebSocket connection with no token, or a garbage token, is rejected.** Using a WS client (`python -m channels...` test utility, or a short ad-hoc script using `channels.testing.WebsocketCommunicator` — not a checked-in test file, a throwaway verification script): connect to `/ws/tickets/<id>/` with no query string → connection rejected (close code `4401`). Connect with `?customer_token=garbage` → rejected the same way.
8. **A valid customer token connects and a sent message broadcasts.** Connect with the `session_token` from step 5; send `{"body": "Hello"}`; confirm (a) the connection receives its own broadcast back (echoed via the group), and (b) `GET /api/messages/?ticket=<id>` (agent token) shows the new inbound `Message`.
9. **An agent's REST reply broadcasts to a connected customer socket.** With the customer's WS connection from step 8 still open, `POST /api/messages/` (agent token) with `{"ticket": <id>, "direction": "outbound", "channel": "chat", "body": "We're here to help"}` → `201`; confirm the customer's open WS connection receives the broadcast without polling.
10. **An agent WS connection without `tickets.view` is rejected.** Using an account with no `tickets.view` permission (or a plain expired/garbage JWT), connect to `/ws/tickets/<id>/?token=...` → rejected (`4401` for an invalid token, `4403` for a valid-but-unauthorized user).
11. **The full UI walkthrough, both languages.** `npm run dev` with the backend up:
    - Visit `/chat` (no login) — the "Start a conversation" form renders; submitting creates a session and shows the chat pane.
    - Type and send a message; it appears in the thread.
    - In a separate signed-in agent session, open the corresponding ticket's detail page — the message is visible in `TicketConversation`, and a new message from either side appears live without a manual refresh.
    - Reload the widget tab — the same session resumes (no new "start chat" form) and prior messages... **note:** the widget does not fetch chat history on reconnect in this story's scope (only new messages since the reconnect appear) — confirm this matches `## Edge Cases`' documented scope, not an unexpected gap.
    - Switch to Arabic on both surfaces: labels translate, message alignment (`self-end`/`self-start`) still reads correctly in RTL.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `channels`/`daphne` added to `requirements.txt` and installed; `daphne` precedes `django.contrib.staticfiles` in `INSTALLED_APPS`; `channels` added to `THIRD_PARTY_APPS`.
- [ ] `ASGI_APPLICATION`/`CHANNEL_LAYERS` (in-memory) added to `base.py`; `config/asgi.py` wires a `ProtocolTypeRouter` with `AllowedHostsOriginValidator`.
- [ ] `LiveChatAdapter` — `start_session` (find-or-create by email, continue most recent non-closed ticket), `receive`, `send` (broadcasts via `async_to_sync(channel_layer.group_send)`), registered via `@register_adapter` and imported in `apps.py`'s `ready()`.
- [ ] `TicketChatConsumer` — dual auth (`customer_token`/`token`), permission-checked agent connections (`tickets.view`), group join/leave, customer-side `receive` persists + broadcasts, agent-side frames ignored.
- [ ] `LiveChatStartView` public at `POST /api/live-chat/start/`, requires `name`, `email` optional.
- [ ] **No migration.**
- [ ] `frontend/src/shared/lib/ws.ts` — `getWebSocketUrl`, no new frontend env var.
- [ ] `features/live-chat/` — types, `startLiveChat`, `session.ts` (localStorage persistence), `liveChat` locale namespace registered in `resources.ts`, `LiveChatWidget.tsx` (both `StartForm` and `ChatPane` use `useAppForm`, per § 20).
- [ ] `chat` route added to `router.tsx`, **outside** `RequireAuth` — genuinely public.
- [ ] `useTicketChatSocket` (receive-only) wired into `TicketConversation.tsx`; the reply form is unchanged.
- [ ] `CONVENTIONS.md` § 23 gains the real-time/broadcast/session-token paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] **Full regression pass confirms every previously-shipped endpoint is unaffected by adding Daphne** (Verification Step 4) — this is the load-bearing check for this story, given the shared-infrastructure risk.
- [ ] Verified by real WebSocket traffic: rejected connections (no token, garbage token, insufficient permission); a customer message broadcasting to itself and to `GET /api/messages/`; an agent's REST reply broadcasting live to an open customer socket (Steps 7-10).
- [ ] Both languages walk through cleanly in the browser, including the live round-trip between an open widget tab and an open agent tab (Step 11).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] `.squad/plans/communication-channels/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** This is the largest and riskiest story in communication-channels so far — confirm the regression pass (Step 4) explicitly before treating this as done. The remaining story in this epic is **COMM-4 (SMS)** — depends only on `COMM-0`, architecturally closer to COMM-2 (WhatsApp)'s real-third-party-API shape (a provider like Twilio) than to this story's in-process broadcast model; **COMM-5 (Web Forms)** additionally needs `TKT-2` (not yet planned).
