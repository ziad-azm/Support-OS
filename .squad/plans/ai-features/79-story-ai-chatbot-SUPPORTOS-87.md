# Story 79 — AI Chatbot (Story: SUPPORTOS-87)

## Prerequisites

- **Story 74 (`AI-0`) completed, and this story is the extension `AI-0`'s own plan deferred to it.** [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md) `## Story Goal` states verbatim: *"No streaming, no multi-turn conversation state… `AI-5`'s chatbot is explicitly multi-turn and may need to extend `client.py`; that extension belongs to `AI-5`'s own story, not invented speculatively here."* Task 1 is that extension.
- **`KB-3` (Story 41) and `PORTAL-0` (Story 42) are complete.** `apps/ai/prompts.py::{ground_with_knowledge_base, build_grounded_system_prompt, resolve_language_name}` (all reused unchanged); `apps/core/views.py::CustomerScopedModelViewSet` (lines 34-62) and `Permissions.PORTAL_ACCESS` are the portal's own auth/scoping spine, and `PortalTicketViewSet.perform_create`'s `hasattr(self.request.user, "customer_profile")` guard (`apps/portal/views.py:77-80`) is the exact "only a real customer account may act here" check this story's views copy.
- **The intake matches its own title — no shift.** Confirmed against `SupportOs backlog.MD` lines 846-851 (`STORY (AI-5) — AI Chatbot`, `Dependencies: AI-0, KB-3, PORTAL-0`). **Two tasks**, unlike every other `AI-*` story:

  > **Task: Chatbot backend (grounded + handoff)** — Implement KB-grounded chatbot with human/ticket handoff via AI-0. Outcome: instant self-service.
  >
  > **Task: Chatbot widget** — Implement portal widget reusing conversation UI. Outcome: customer-facing bot.

- **"Reusing conversation UI" means the existing customer chat-bubble pattern, duplicated — not imported.** Verified live: `frontend/src/features/live-chat/components/LiveChatWidget.tsx`'s `ChatPane` (lines 104-199) is this project's only customer-facing conversation UI — a bubble list keyed on `message.direction` plus a single-field form. `no-restricted-imports` (`frontend/.oxlintrc.json` lines 8-18) forbids `features/portal` importing it, and this project's own established answer to exactly that is a local duplicate with a docstring saying so (`features/portal/components/PortalMarkdownPreview.tsx`, itself a verbatim duplicate of the knowledge-base component). Task 6 follows that precedent.
- **The conversation is a real `Ticket` + `Message` thread from the first turn, not a separate transcript store.** Verified live: the anonymous live-chat widget already works exactly this way (`LiveChatAdapter.start_session` creates a `Ticket`, `TicketChatConsumer.receive` persists each customer turn as an `INBOUND` `Message`), which means handoff needs **no** transcript migration — the ticket and its messages already exist, already appear in the staff queue, and already render in the staff `TicketConversation`. The only genuinely new state is *"is the bot still answering this ticket?"*, which task 3's one-field model holds.
- **The bot replies over REST, never inside the WebSocket consumer.** `TicketChatConsumer` is an `AsyncWebsocketConsumer` (`apps/communications/consumers.py:19`); running a multi-second synchronous LLM call inside its `receive()` would block the event loop for every other socket on that worker. A REST request/response is the correct place for a blocking call, and it is what lets this story leave `consumers.py`, `routing.py`, and the whole live-chat socket path **untouched**.
- **This story adds `apps.ai`'s first model and first migration.** `apps/ai/migrations/` currently contains only `__init__.py` (verified), so task 3's migration is `0001_initial.py`. `apps/ai/models.py` is still the one-line stub every prior `AI-*` story deliberately left alone.
- **Verified live, this session:** `python manage.py test` reports **54** passing, the baseline this story must not change; `apps.portal.urls` is already `include()`d in `config/api_urls.py` (line 22), so task 5's new paths need **no** change to that file.

---

## Story Goal

Give a signed-in portal customer a chat page where an AI assistant answers their questions grounded in the knowledge base, and hands the conversation to a human when it cannot help or the customer asks — at which point the already-existing ticket simply stops being bot-answered and enters the normal agent queue.

**Task 1 — Chatbot backend (grounded + handoff):**

1. **`apps/ai/client.py::generate_chat_completion(messages, ...)`** — the multi-turn counterpart to `generate_completion`, taking a full `messages` list. Same `AIServiceError` normalization, same single-integration-point rule.
2. **`apps/ai/models.py::ChatbotSession`** — one row per bot-handled ticket: `ticket` (OneToOne) plus `handed_off_at` (nullable). `handed_off_at is None` is the *only* definition of "the bot still owns this conversation."
3. **`apps/ai/chatbot.py`** — `get_or_start_session(customer)`, `answer(session, body)`, `hand_off(session)`. `answer` persists the customer's turn, builds the message history from the ticket's own `Message` rows, asks the KB-grounded assistant, persists the bot's turn, and hands off when the model emits the handoff marker.
4. **Portal endpoints** (`PORTAL_ACCESS`-gated): `GET`/`POST /api/portal/chatbot/` and `POST /api/portal/chatbot/handoff/`, each returning the full conversation state.

**Task 2 — Chatbot widget:**

5. **`PortalChatbotPage`** at `/portal/chat` — the bubble conversation UI, a message input, a "Talk to a human" action, and a handed-off banner linking to the resulting ticket; plus a portal nav entry.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `generate_chat_completion` | "KB-grounded chatbot" (backlog) — a chatbot is multi-turn by definition; `AI-0` explicitly deferred this. |
| `ChatbotSession` | "human/ticket handoff" (backlog) — handoff needs one bit of durable state the bot can check before answering again. |
| `apps/ai/chatbot.py` | "Implement KB-grounded chatbot with human/ticket handoff via AI-0" (backlog, task 1). |
| Portal chatbot endpoints | The customer-facing surface task 2's widget calls; `PORTAL_ACCESS`-gated, customer-scoped. |
| `PortalChatbotPage` + nav entry | "Implement portal widget reusing conversation UI" (backlog, task 2). |

**Not here, and why:**

- **No WebSocket/streaming for the bot.** See `## Prerequisites` — a blocking LLM call must not run inside `TicketChatConsumer`'s event loop. The bot's reply arrives in the `POST` response; `consumers.py`/`routing.py`/`LiveChatAdapter` are untouched.
- **No change to the existing anonymous `/chat` live-chat widget.** That is `COMM-3`'s surface for anonymous visitors talking to a *human*; this story adds a separate, portal-authenticated surface for talking to the *bot*. Neither replaces the other.
- **No new `Message.Channel` value.** Bot and customer turns are `Channel.CHAT` `Message` rows — the same channel the existing chat conversation already uses, so the staff `TicketConversation` renders them with no frontend change. A bot turn is marked by `metadata={"author": "chatbot"}`, the schemaless-per-channel use `Message.metadata`'s own docstring already sanctions.
- **No live push of bot turns to a staff member watching the same ticket.** `LiveChatAdapter.send()` (the channel-layer broadcast) is deliberately not called — bot turns appear for staff on normal load/refresh. Wiring the broadcast would mean either calling an adapter from `apps.ai` or moving bot replies into the consumer, both rejected above.
- **No `categorize_ticket` call on handoff.** `auto_assign_ticket.delay(...)` is queued (handoff means *a human must pick this up*, exactly that task's job); AI categorization of chatbot tickets is `AI-3`'s scope decision to revisit, not this story's.
- **No bot involvement in any other channel.** Email/WhatsApp/SMS/web-form tickets are never auto-answered; the bot only ever answers within its own `ChatbotSession`.
- **No conversation-history limit tuning beyond the existing transcript cap.** History is built from the ticket's `Message` rows via the same most-recent-window rule `AI-1` established (`MAX_TRANSCRIPT_MESSAGES`), reused rather than re-invented.

---

## Context — Read These Files First

1. `.squad/stories/ai-features/SUPPORTOS-87/intake.md` — matches the backlog; two tasks.
2. `SupportOs backlog.MD` lines 846-851 — the authoritative `AI-5` task text.
3. `backend/apps/ai/client.py` (current, from Story 74) — `get_client()` and `generate_completion`'s exact `try/except anthropic.APIStatusError / APIConnectionError` shape (the two `except` arms task 1's new function copies verbatim) and its "never log the prompt or the response" rule.
4. `backend/apps/ai/prompts.py` (current, 76 lines) — `build_grounded_system_prompt` (lines 41-53), `ground_with_knowledge_base` (lines 10-21, `include_drafts=False`), `resolve_language_name` (lines 60-75). All three are called by task 4; none change.
5. `backend/apps/tickets/summarization.py` lines 14-20 (`MAX_TRANSCRIPT_MESSAGES = 50`) — the window size task 4's history builder reuses.
6. `backend/apps/communications/live_chat_adapter.py` lines 44-83 (`start_session`) — the find-or-create rule and the `[:200]` subject-truncation defensiveness task 4's `get_or_start_session` mirrors (including *why* the slice exists: `Ticket.subject` is `max_length=200` and a translated prefix plus a long name otherwise raises an unhandled `DataError`).
7. `backend/apps/communications/models.py` lines 8-55 (`Message`) — `Direction.INBOUND`/`OUTBOUND`, `Channel.CHAT`, `metadata` ("Schemaless on purpose: each channel adapter defines its own keys"), and `Meta.ordering = ("created_at",)`.
8. `backend/apps/communications/consumers.py` (all 101 lines) — read to confirm this story leaves it alone, and why (`## Prerequisites`).
9. `backend/apps/portal/views.py` (current, 94 lines) — `PortalTicketViewSet.perform_create`'s `customer_profile` guard (lines 66-89) and its `auto_assign_ticket.delay(...)` `try/except` (lines 82-89), both copied by tasks 4/5.
10. `backend/apps/portal/urls.py` (all 27 lines) — the plain-`path()`-not-a-router convention (its own comment explains why) task 5's two new paths follow.
11. `backend/apps/knowledge_base/views.py` (`KnowledgeBaseSearchView`, `KB-3`) — the precedent for a plain `APIView` in this project: explicit `permission_classes = [IsAuthenticated, HasPermission]` plus a **method-keyed** `permission_map` (`CONVENTIONS.md` §13/§22).
12. `frontend/src/features/live-chat/components/LiveChatWidget.tsx` lines 104-199 (`ChatPane`) — the bubble list + input form task 6 duplicates (adapted from WebSocket to REST).
13. `frontend/src/features/portal/components/PortalMarkdownPreview.tsx` (all 21 lines) — the cross-feature-duplication precedent, cited in `## Prerequisites`.
14. `frontend/src/features/portal/components/PortalLayout.tsx` (all 119 lines) — the `NavLink` block (lines 30-99) task 7 adds one entry to.
15. `frontend/src/app/router.tsx` — the `path: 'portal'` tree (from line 502), specifically the `RequirePermission permission="portal.access"` children list task 7 adds a `chat` route to.
16. `frontend/src/features/portal/locales/{en,ar}.json` — the `nav`/`shell` blocks task 8 extends.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **KB-grounded answers.** | Backlog, task 1 | `apps/ai/chatbot.py::answer`, building its system prompt via `build_grounded_system_prompt(..., kb_query=<the customer's latest message>)`. |
| **Human/ticket handoff.** | Backlog, task 1 | `ChatbotSession.handed_off_at`; set by an explicit customer request (`hand_off`) or by the model emitting `HANDOFF_MARKER`; `auto_assign_ticket.delay(...)` queued on handoff. |
| **The bot never answers a handed-off conversation.** | This story's own design | `answer` raises/returns early when `session.handed_off_at is not None`; the endpoint refuses a `POST` on a handed-off session with a `400`. |
| **Instant self-service — no agent involvement until handoff.** | Backlog outcome | A chatbot ticket is never auto-assigned at creation (only at handoff); `SLA-2`'s `auto_assign_ticket` is not called from `get_or_start_session`. |
| **Portal-authenticated and customer-scoped.** | `PORTAL-0` dependency | `permission_map` = `PORTAL_ACCESS` on both views; every lookup resolves the ticket through `request.user.customer_profile`, never a client-supplied id. |
| **Never surface unpublished KB content to a customer.** | Established rule, `AI-0` | `ground_with_knowledge_base`'s hardcoded `include_drafts=False`, unchanged. |
| **The bot answers in the customer's own UI language.** | Established rule, `AI-1`/`AI-2` | `resolve_language_name()`, unchanged. |
| **A bot turn is distinguishable from a human agent's turn.** | This story's own design | `Message.metadata = {"author": "chatbot"}` on every bot turn; the portal wire shape exposes it as `author: "bot"`. |
| **An AI failure surfaces as the existing clean `503`.** | Reuse, not reinvention | `apps.ai.exceptions.AIServiceUnavailable`, unchanged. |

---

## Backend Tasks

### 1 — Multi-turn support in the AI client

**File: `backend/apps/ai/client.py`** — add, after `generate_completion`:

```python
def generate_chat_completion(
    messages: list[dict],
    *,
    system: str | None = None,
    max_tokens: int = 1024,
    model: str | None = None,
) -> str:
    """Multi-turn completion — the extension Story 74 `## Story Goal`
    deferred to AI-5. `messages` is the full alternating history in the
    Anthropic wire shape (`{"role": "user"|"assistant", "content": str}`),
    oldest first; the caller owns history construction (see
    `apps.ai.chatbot.build_history`).

    Identical failure contract to `generate_completion`: every
    `anthropic.*` error becomes an `AIServiceError`, and neither the
    prompt nor the response is ever logged (CONVENTIONS.md §10).
    """
    client = get_client()
    try:
        response = client.messages.create(
            model=model or settings.AI_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
    except anthropic.APIStatusError as exc:
        logger.error("AI provider returned status %s", exc.status_code)
        raise AIServiceError(f"AI provider error (status {exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        logger.error("AI provider connection failed: %s", exc.__class__.__name__)
        raise AIServiceError("Could not reach the AI provider.") from exc

    text = next((block.text for block in response.content if block.type == "text"), "")
    if not text:
        raise AIServiceError("AI provider returned an empty response.")
    return text
```

**`system=None` is passed through unchanged** — verified live in Story 74 that the SDK accepts it and the request reaches the API normally.

---

### 2 — The session model

**File: `backend/apps/ai/models.py`** — replace the one-line stub with:

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class ChatbotSession(TimeStampedModel):
    """One bot-handled conversation — AI-5. The conversation itself lives
    in the ticket's own `Message` rows (the same spine the anonymous
    live-chat widget already uses, `COMM-3`); this model holds the one
    piece of state those rows cannot express: whether the bot is still
    answering.

    `handed_off_at is None` is the ONLY definition of "bot-handled." It is
    deliberately not inferred from `Ticket.assigned_agent` — `SLA-2`'s
    `auto_assign_ticket` can assign a ticket for unrelated reasons, which
    would silently mute the bot — nor from `Ticket.escalated`, which
    carries `TKT-4`/`SLA-3`'s own meaning. See Story 79 `## Prerequisites`.
    """

    # CASCADE + OneToOne: the session has no meaning without its ticket,
    # and a ticket is either bot-handled or it is not — the same
    # one-row-per-ticket shape `tickets.Feedback` already uses (PORTAL-5).
    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name="chatbot_session",
        verbose_name=_("ticket"),
    )
    handed_off_at = models.DateTimeField(_("handed off at"), null=True, blank=True)

    class Meta:
        verbose_name = _("chatbot session")
        verbose_name_plural = _("chatbot sessions")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Chatbot session for ticket #{self.ticket_id}"
```

**Migration:** `python manage.py makemigrations ai` — this is `apps.ai`'s **first** migration (`0001_initial.py`); `apps/ai/migrations/` currently holds only `__init__.py`. `config/tests/test_settings.py::MigrationStateTests.test_no_pending_migrations` fails until it is generated and committed.

---

### 3 — The chatbot logic

**Create file: `backend/apps/ai/chatbot.py`**

```python
"""The KB-grounded portal chatbot — AI-5 (Story 79). Built on AI-0's
`generate_chat_completion` (task 1) and `apps.ai.prompts`; the
conversation itself is a `Ticket` plus `Message` rows, the same spine
`COMM-3`'s live-chat widget already uses.
"""

import logging

from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.communications.models import Message
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket
from apps.tickets.summarization import MAX_TRANSCRIPT_MESSAGES

from .client import generate_chat_completion
from .models import ChatbotSession
from .prompts import build_grounded_system_prompt, resolve_language_name

logger = logging.getLogger(__name__)

BOT_AUTHOR = "chatbot"
# The model is told to emit this exact token when it cannot help. Checked
# with `in`, then stripped, so a reply that both answers partially AND
# gives up still reaches the customer without the marker leaking.
HANDOFF_MARKER = "[HANDOFF]"
MAX_TOKENS = 1024


def get_or_start_session(customer) -> ChatbotSession:
    """The customer's current bot conversation, or a new one. Continues an
    existing session only while it is still bot-handled and its ticket is
    not closed — a handed-off or closed conversation starts a fresh
    session rather than re-attaching the bot to a thread a human now owns.
    """
    session = (
        ChatbotSession.objects.filter(
            ticket__customer=customer,
            handed_off_at__isnull=True,
        )
        .exclude(ticket__status=Ticket.Status.CLOSED)
        .select_related("ticket")
        .order_by("-created_at")
        .first()
    )
    if session is not None:
        return session

    # `[:200]` for the same reason `LiveChatAdapter.start_session` slices:
    # `Ticket.subject` is `max_length=200`, and the translated prefix's own
    # length varies by locale, so an over-long customer name would
    # otherwise reach Postgres as an unhandled `DataError`.
    subject = (_("Assistant chat with %(name)s") % {"name": customer.name})[:200]
    ticket = Ticket.objects.create(
        subject=subject,
        description=_("Started via the portal assistant."),
        customer=customer,
    )
    return ChatbotSession.objects.create(ticket=ticket)


def build_history(ticket: Ticket) -> list[dict]:
    """The ticket's messages as an Anthropic-shaped alternating history,
    oldest first, capped to the most recent `MAX_TRANSCRIPT_MESSAGES`
    (reusing AI-1's own window rather than a second constant). An inbound
    message is the customer (`user`); anything outbound — the bot's own
    turns, and any reply a human agent has since sent — is `assistant`.
    """
    recent = list(
        Message.objects.filter(ticket=ticket).order_by("-created_at")[:MAX_TRANSCRIPT_MESSAGES]
    )
    recent.reverse()
    return [
        {
            "role": "user" if message.direction == Message.Direction.INBOUND else "assistant",
            "content": message.body,
        }
        for message in recent
    ]


def _system_prompt(latest_body: str) -> str:
    instructions = (
        "You are a customer-support assistant for this company's help "
        "portal. Answer the customer's question directly and concisely, "
        "using the knowledge base context when it is relevant. If you "
        "cannot answer confidently, or the customer asks for a person, "
        f"end your reply with the exact token {HANDOFF_MARKER} so the "
        "conversation is passed to a human agent. Never invent policies, "
        "prices, or account details. Respond in "
        f"{resolve_language_name()}."
    )
    return build_grounded_system_prompt(instructions, kb_query=latest_body)


def answer(session: ChatbotSession, body: str) -> None:
    """Persist the customer's turn, generate the bot's grounded reply,
    persist it, and hand off if the model asked to. Raises
    `apps.ai.exceptions.AIServiceError` on provider failure — the
    customer's own message is already committed by then, so their turn is
    never lost to a provider outage (the same "the record is already
    committed" resilience rule `MessageViewSet.perform_create` follows).
    """
    Message.objects.create(
        ticket=session.ticket,
        direction=Message.Direction.INBOUND,
        channel=Message.Channel.CHAT,
        body=body,
    )

    reply = generate_chat_completion(
        build_history(session.ticket),
        system=_system_prompt(body),
        max_tokens=MAX_TOKENS,
    )
    wants_handoff = HANDOFF_MARKER in reply
    cleaned = reply.replace(HANDOFF_MARKER, "").strip()

    Message.objects.create(
        ticket=session.ticket,
        direction=Message.Direction.OUTBOUND,
        channel=Message.Channel.CHAT,
        body=cleaned,
        metadata={"author": BOT_AUTHOR},
    )
    if wants_handoff:
        hand_off(session)


def hand_off(session: ChatbotSession) -> None:
    """Stop the bot and put the ticket in front of a human. Idempotent —
    a second call on an already-handed-off session is a no-op, not an
    error. Queues `SLA-2`'s own `auto_assign_ticket` (a chatbot ticket is
    deliberately NOT auto-assigned at creation, only here) inside the
    same `try/except` every other caller of it uses.
    """
    if session.handed_off_at is not None:
        return
    session.handed_off_at = timezone.now()
    session.save(update_fields=["handed_off_at", "updated_at"])
    try:
        auto_assign_ticket.delay(session.ticket_id)
    except Exception:
        # Same resilience contract as every other `.delay()` call site in
        # this project — the handoff itself is already committed.
        logger.exception("Failed to queue auto-assignment for ticket %s", session.ticket_id)
```

**Every import here is module-scope**, unlike `prompts.py`'s deliberately lazy `apps.knowledge_base` import — `apps.ai` importing `apps.sla.tasks`/`apps.communications.models`/`apps.tickets.*` at startup has no app-loading ordering hazard (`apps.sla.tasks` itself already imports `apps.tickets` the same way), so there is nothing here to defer.

---

### 4 — The portal endpoints

**File: `backend/apps/portal/serializers.py`** — add, after `PortalFeedbackSerializer`:

```python
class PortalChatbotMessageSerializer(serializers.Serializer):
    """Write-only input for `PortalChatbotView.post` — a plain
    `Serializer`, not a `ModelSerializer`: the customer supplies only a
    body, and everything else about the resulting `Message` (ticket,
    direction, channel) is decided server-side by `apps.ai.chatbot`.
    `max_length` matches the live-chat widget's own 2000-char cap
    (`LiveChatWidget`'s `messageSchema`).
    """

    body = serializers.CharField(max_length=2000, trim_whitespace=True)
```

**File: `backend/apps/portal/views.py`** — add imports and two views.

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.chatbot import BOT_AUTHOR, answer, get_or_start_session, hand_off
from apps.ai.exceptions import AIServiceError, AIServiceUnavailable
from apps.ai.models import ChatbotSession
from apps.communications.models import Message
from apps.core.permissions import HasPermission, Permissions

from .serializers import (
    PortalChatbotMessageSerializer,
    PortalFeedbackSerializer,
    PortalTicketSerializer,
)
```

```python
def _chatbot_state(session: ChatbotSession) -> dict:
    """The one response shape all three chatbot endpoints return — the
    full conversation state, so the widget replaces its state wholesale
    instead of merging. `author` is derived here rather than exposing
    `direction`/`metadata`: a customer-facing surface should not have to
    know that "outbound" means "not the customer."
    """
    messages = Message.objects.filter(ticket=session.ticket).order_by("created_at")
    return {
        "ticket": session.ticket_id,
        "handed_off": session.handed_off_at is not None,
        "messages": [
            {
                "id": message.id,
                "author": (
                    "customer"
                    if message.direction == Message.Direction.INBOUND
                    else ("bot" if message.metadata.get("author") == BOT_AUTHOR else "agent")
                ),
                "body": message.body,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }


class PortalChatbotView(APIView):
    """The portal assistant — AI-5. `GET` loads (or starts) the customer's
    conversation; `POST` sends a message and returns the state including
    the bot's reply. A plain `APIView`, so `permission_classes` is set
    explicitly and `permission_map` is keyed by lowercased HTTP method —
    the same shape `KnowledgeBaseSearchView` (KB-3) established.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.PORTAL_ACCESS,
        "post": Permissions.PORTAL_ACCESS,
    }

    def _customer(self):
        # Same guard, same reason as PortalTicketViewSet.perform_create:
        # a staff account can hold `portal.access` without ever having a
        # customer profile.
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(_("Only customer accounts can use the portal assistant."))
        return self.request.user.customer_profile

    def get(self, request):
        session = get_or_start_session(self._customer())
        return Response(_chatbot_state(session))

    def post(self, request):
        serializer = PortalChatbotMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = get_or_start_session(self._customer())
        if session.handed_off_at is not None:
            raise ValidationError(
                {"body": [_("This conversation is now with a human agent.")]}
            )
        try:
            answer(session, serializer.validated_data["body"])
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        session.refresh_from_db()
        return Response(_chatbot_state(session))


class PortalChatbotHandoffView(APIView):
    """Customer-requested handoff — AI-5. Idempotent (`hand_off` is), so a
    double-click is a no-op rather than a second assignment attempt.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"post": Permissions.PORTAL_ACCESS}

    def post(self, request):
        if not hasattr(request.user, "customer_profile"):
            raise PermissionDenied(_("Only customer accounts can use the portal assistant."))
        session = get_or_start_session(request.user.customer_profile)
        hand_off(session)
        session.refresh_from_db()
        return Response(_chatbot_state(session))
```

`PermissionDenied`/`ValidationError`/`_` are already imported at the top of this file (lines 3-4) — no new import for those.

---

### 5 — Routes

**File: `backend/apps/portal/urls.py`** — add two plain paths (matching this file's own "plain `path()`s, not a router" convention):

```python
from .views import (
    PortalChatbotHandoffView,
    PortalChatbotView,
    PortalFeedbackViewSet,
    PortalTicketViewSet,
)
```

```python
    path("portal/chatbot/", PortalChatbotView.as_view(), name="portal-chatbot"),
    path(
        "portal/chatbot/handoff/",
        PortalChatbotHandoffView.as_view(),
        name="portal-chatbot-handoff",
    ),
```

**No change to `config/api_urls.py`** — `apps.portal.urls` is already included (line 22).

---

## Frontend Tasks

### 6 — Types, API layer, and the widget

**Create file: `frontend/src/features/portal/types/portalChatbot.ts`**

```ts
/** Mirrors `apps.portal.views._chatbot_state`'s shape verbatim. */
export const CHATBOT_AUTHORS = ['customer', 'bot', 'agent'] as const
export type ChatbotAuthor = (typeof CHATBOT_AUTHORS)[number]

export type PortalChatbotMessage = {
  id: number
  author: ChatbotAuthor
  body: string
  created_at: string
}

export type PortalChatbotState = {
  ticket: number
  handed_off: boolean
  messages: PortalChatbotMessage[]
}
```

**Create file: `frontend/src/features/portal/api/portalChatbotKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const portalChatbotKeys = featureKey('portal-chatbot')
```

**Create file: `frontend/src/features/portal/api/getPortalChatbot.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalChatbotState } from '../types/portalChatbot'

/** `GET` starts the conversation if the customer has none open yet —
 * the backend's `get_or_start_session` is find-or-create. */
export function getPortalChatbot(): Promise<PortalChatbotState> {
  return api.get<PortalChatbotState>('/portal/chatbot/')
}
```

**Create file: `frontend/src/features/portal/api/sendPortalChatbotMessage.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalChatbotState } from '../types/portalChatbot'

/** Returns the FULL refreshed conversation state, including the bot's
 * reply — the caller replaces its state wholesale, no merging. */
export function sendPortalChatbotMessage(body: string): Promise<PortalChatbotState> {
  return api.post<PortalChatbotState>('/portal/chatbot/', { body })
}
```

**Create file: `frontend/src/features/portal/api/handOffPortalChatbot.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalChatbotState } from '../types/portalChatbot'

export function handOffPortalChatbot(): Promise<PortalChatbotState> {
  return api.post<PortalChatbotState>('/portal/chatbot/handoff/')
}
```

**Create file: `frontend/src/features/portal/api/usePortalChatbot.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalChatbot } from './getPortalChatbot'
import { portalChatbotKeys } from './portalChatbotKeys'

export function usePortalChatbot() {
  return useQuery({
    queryKey: portalChatbotKeys.resource('conversation'),
    queryFn: getPortalChatbot,
  })
}
```

**Create file: `frontend/src/features/portal/api/usePortalChatbotMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { handOffPortalChatbot } from './handOffPortalChatbot'
import { portalChatbotKeys } from './portalChatbotKeys'
import { sendPortalChatbotMessage } from './sendPortalChatbotMessage'
import type { PortalChatbotState } from '../types/portalChatbot'

/** Both mutations return the full state, so they seed the query cache
 * directly (`setQueryData`) instead of invalidating and refetching — one
 * round trip, and the bot's reply is already in hand. */
export function useSendPortalChatbotMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => sendPortalChatbotMessage(body),
    onSuccess: (state: PortalChatbotState) =>
      queryClient.setQueryData(portalChatbotKeys.resource('conversation'), state),
  })
}

export function useHandOffPortalChatbot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => handOffPortalChatbot(),
    onSuccess: (state: PortalChatbotState) =>
      queryClient.setQueryData(portalChatbotKeys.resource('conversation'), state),
  })
}
```

**Create file: `frontend/src/features/portal/components/PortalChatbotPage.tsx`**

Bubble list + input, duplicating `LiveChatWidget`'s `ChatPane` pattern (`## Prerequisites`) with REST in place of the WebSocket:

```tsx
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as z from 'zod'

import { cn } from '@/shared/lib/cn'
import { requiredString } from '@/shared/validation/schemas'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/primitives/alert'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { usePortalChatbot } from '../api/usePortalChatbot'
import {
  useHandOffPortalChatbot,
  useSendPortalChatbotMessage,
} from '../api/usePortalChatbotMutations'
import type { PortalChatbotState } from '../types/portalChatbot'

const messageSchema = z.object({ body: requiredString(2000) })
type MessageFormValues = z.output<typeof messageSchema>

export function PortalChatbotPage() {
  const { t } = useTranslation('portal')
  const query = usePortalChatbot()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('chatbot.title')}</h1>
      <QueryBoundary query={query}>{(state) => <ChatPane state={state} />}</QueryBoundary>
    </div>
  )
}

function ChatPane({ state }: { state: PortalChatbotState }) {
  const { t } = useTranslation('portal')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const form = useAppForm({ schema: messageSchema, defaultValues: { body: '' } })
  const sendMutation = useSendPortalChatbotMessage()
  const handOffMutation = useHandOffPortalChatbot()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [state.messages])

  function onSubmit(values: MessageFormValues) {
    sendMutation.mutate(values.body, { onSuccess: () => form.reset({ body: '' }) })
  }

  return (
    <Card className="flex h-[min(36rem,calc(100dvh-12rem))] flex-col">
      <CardHeader className="border-b pb-4">
        <CardTitle asChild>
          <h2>{t('chatbot.paneTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        {state.handed_off ? (
          <Alert>
            <AlertTitle>{t('chatbot.handedOff.title')}</AlertTitle>
            <AlertDescription>
              {t('chatbot.handedOff.description')}{' '}
              <Link to={`/portal/tickets/${state.ticket}`} className="font-medium hover:underline">
                {t('chatbot.handedOff.viewTicket')}
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {state.messages.length === 0 ? (
            <li className="m-auto text-center text-sm text-muted-foreground">
              {t('chatbot.empty')}
            </li>
          ) : (
            state.messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  'flex',
                  message.author === 'customer' ? 'justify-end' : 'justify-start',
                )}
              >
                {/* No forced `dir` — free-form prose that may itself be
                    Arabic, the same reasoning `MessageRow` applies. */}
                <p
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                    message.author === 'customer'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {message.body}
                </p>
              </li>
            ))
          )}
          <div ref={bottomRef} />
        </ul>
        {state.handed_off ? null : (
          <>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField control={form.control} name="body" label={t('chatbot.placeholder')} />
                </div>
                <SubmitButton pending={sendMutation.isPending}>{t('chatbot.send')}</SubmitButton>
              </form>
            </Form>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={handOffMutation.isPending}
              onClick={() => handOffMutation.mutate()}
            >
              {t('chatbot.talkToHuman')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

---

### 7 — Route and nav

**File: `frontend/src/app/router.tsx`** — add one child inside the existing `RequirePermission permission="portal.access"` children list (alongside `faqs`/`articles`/`tickets`):

```tsx
              {
                path: 'chat',
                lazy: async () => {
                  const { PortalChatbotPage } =
                    await import('@/features/portal/components/PortalChatbotPage')
                  return { element: <PortalChatbotPage /> }
                },
              },
```

`/portal/chat` does not collide with the public `/chat` live-chat route — that one lives in the `PublicLayout` tree (`router.tsx` lines 26-32), a sibling of the `portal` tree.

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — add one `NavLink`, after the `nav.faqs` link, copying the surrounding block verbatim:

```tsx
            <NavLink
              to="/portal/chat"
              className={({ isActive }) =>
                cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  isActive && 'bg-accent text-accent-foreground',
                )
              }
            >
              {t('nav.assistant')}
            </NavLink>
```

---

### 8 — Locale

**File: `frontend/src/features/portal/locales/en.json`** — add `nav.assistant` to the existing `nav` block, and a new top-level `chatbot` block:

```json
  "chatbot": {
    "title": "Assistant",
    "paneTitle": "Ask the assistant",
    "empty": "Ask a question to get started.",
    "placeholder": "Type your question",
    "send": "Send",
    "talkToHuman": "Talk to a human",
    "handedOff": {
      "title": "A person is taking over",
      "description": "Your conversation has been passed to our support team.",
      "viewTicket": "View the ticket"
    }
  },
```

**File: `frontend/src/features/portal/locales/ar.json`** — the same additions, translated (`nav.assistant`: `"المساعد"`; `chatbot.title`: `"المساعد"`; `paneTitle`: `"اسأل المساعد"`; `empty`: `"اطرح سؤالاً للبدء."`; `placeholder`: `"اكتب سؤالك"`; `send`: `"إرسال"`; `talkToHuman`: `"التحدث إلى شخص"`; `handedOff.title`: `"سيتولى أحد موظفينا المحادثة"`; `handedOff.description`: `"تم تحويل محادثتك إلى فريق الدعم."`; `handedOff.viewTicket`: `"عرض التذكرة"`).

---

## Edge Cases & Failure Modes

- **`ANTHROPIC_API_KEY` unconfigured, or the provider errors/times out mid-turn.** `answer` has already committed the customer's `INBOUND` message before calling the model, so their question is never lost; `generate_chat_completion` raises `AIServiceError`, the view returns `503 ai_service_unavailable`, and the next `GET` shows the customer's own message with no bot reply. Re-sending is the recovery path.
- **The model emits `[HANDOFF]` mid-sentence or alone.** `HANDOFF_MARKER` is removed with `.replace(...).strip()` wherever it appears, so the marker never reaches the customer. A reply consisting of nothing *but* the marker becomes an empty-body bot message, which renders as an empty bubble above the handed-off banner — accepted, because the banner is the real signal the customer acts on. Verification Step 5 asserts the marker never appears in any returned body.
- **The customer POSTs to an already-handed-off conversation** (e.g. a stale tab) — `400 validation_error` on `body` with a translated message, not a silent no-op and not a bot reply. The widget hides the input entirely once `handed_off` is true, so this only happens to a stale client.
- **Double-clicking "Talk to a human"** — `hand_off` is idempotent (returns early when `handed_off_at` is already set), so no second `auto_assign_ticket` is queued and `handed_off_at` keeps its first value.
- **The Celery broker is unreachable at handoff.** Caught and logged inside `hand_off`; the handoff itself is already committed, so the conversation still stops being bot-handled — the ticket simply sits unassigned in the queue, exactly as if no assignment rule matched.
- **A staff agent replies to a still-bot-handled chatbot ticket** (via the normal staff conversation form) — that reply is an `OUTBOUND` message with no `chatbot` author marker, so `build_history` feeds it back as an `assistant` turn and the wire shape labels it `agent`. The bot does **not** stop answering, because nothing handed the session off; an agent who wants to take over must have the conversation handed off (customer-initiated or model-initiated). This is a real limitation, documented rather than solved — a staff-side "take over this chat" control is not in this story's two tasks.
- **The customer's ticket is closed by staff while a session is open** — `get_or_start_session` excludes closed tickets, so the next message starts a fresh session and ticket rather than reopening a closed thread.
- **A staff account holding `portal.access` with no customer profile** (a real case: `super_admin` holds every permission) — both views raise `PermissionDenied` with a translated message, the same guard `PortalTicketViewSet.perform_create` already uses.
- **Very long conversations** — `build_history` caps at `MAX_TRANSCRIPT_MESSAGES` (50) most-recent messages, so the oldest turns fall out of the model's view while the full transcript remains on the ticket for the agent.
- **`message.metadata` is `{}` for every pre-existing chat message** (live-chat rows created before this story) — `.get("author")` returns `None`, so those label as `agent`, which is correct: they were human replies.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

The mechanical checks that stand in for it:

1. `python manage.py makemigrations ai` — generates `0001_initial.py`; `python manage.py migrate` applies it.
2. `python manage.py check`, then `python manage.py test` — must report **54** passing, including `MigrationStateTests.test_no_pending_migrations`, which fails if the migration is missing.
3. `ruff format --check .` / `ruff check .` over the new/changed Python files.
4. `npm run build` — typechecks `PortalChatbotState`, both mutation hooks, and the panel's `author`-keyed rendering.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the extended `portal` namespace (`chatbot.*`, `nav.assistant`).
7. Real HTTP/Django-shell verification plus a browser walkthrough in both languages — `## Verification Steps`.

---

## Migration / Rollback

**One migration:** `apps/ai/migrations/0001_initial.py` (`ChatbotSession`) — `apps.ai`'s first.

**Rollback:** `python manage.py migrate ai zero`, then revert the commits. `ChatbotSession` rows are the only new data; the tickets and messages a chatbot conversation produced are ordinary `Ticket`/`Message` rows and survive the rollback intact (they simply lose their bot/human provenance flag).

**Half-applied states to avoid:**

- **`models.py` edited without generating the migration** → `test_no_pending_migrations` fails, and any `ChatbotSession` query raises `ProgrammingError: relation "ai_chatbotsession" does not exist` at runtime.
- **`apps/portal/views.py`'s new views added before `apps/ai/chatbot.py` exists** → `ImportError` at Django startup, caught by `python manage.py check`.
- **`hand_off` called without the `handed_off_at is not None` early return** — every repeat call would re-stamp the timestamp and queue another `auto_assign_ticket`, re-assigning a ticket an agent may already have taken.
- **`HANDOFF_MARKER` left in the persisted bot message** — the customer would literally read `[HANDOFF]`; the `.replace(...)` in `answer` is what prevents it, and Step 5 verifies it.
- **The input form left visible after handoff** — every subsequent send would `400`. The `state.handed_off ? null : (...)` guard in task 6 is what prevents it.

---

## Verification Steps

1. **Migration and backend gates:** from `backend/` with the venv active — `python manage.py makemigrations ai` (creates `0001_initial.py`), `python manage.py migrate`, `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **Unconfigured-AI behavior, via a real HTTP call** (with `ANTHROPIC_API_KEY` blank), as a customer account holding `portal.access`: `GET /api/portal/chatbot/` → `200` with an empty `messages` list and a freshly created ticket; `POST /api/portal/chatbot/` `{"body": "hello"}` → `503 ai_service_unavailable`; a second `GET` → `200` showing the customer's own `hello` message with `author: "customer"` and no bot reply.
4. **Configured behavior, with a real key in `backend/.env`:** `POST` a question that a seeded FAQ/Article covers (e.g. about resetting a password) → `200`, `messages` ends with an `author: "bot"` reply that reflects the KB content, `handed_off: false`.
5. **Model-initiated handoff and marker stripping:** `POST` a message the assistant cannot answer from the KB (e.g. "I want to speak to a person about my invoice") → `200`, `handed_off: true`, and **no `[HANDOFF]` substring anywhere** in the returned message bodies. Confirm via Django shell that the ticket's `ChatbotSession.handed_off_at` is set.
6. **Explicit handoff is idempotent:** `POST /api/portal/chatbot/handoff/` twice → both `200` with `handed_off: true`; confirm `handed_off_at` did not change between the two calls, and that a subsequent `POST /api/portal/chatbot/` returns `400` on `body`.
7. **Permission and scoping checks:** the same requests with no token → `401`; as a staff account holding `portal.access` but with no customer profile → `403`; as a *different* customer → their own separate session/ticket, never the first customer's (confirm the two `ticket` ids differ).
8. **Staff-side continuity:** open the resulting ticket in the staff UI (`/tickets/<id>`) — the conversation renders in `TicketConversation` as ordinary chat messages, and after handoff the ticket appears in the normal queue (assigned if an `AssignmentRule` matched).
9. **The UI walkthrough.** `npm run dev` with the backend up and a real key configured: `/portal/chat` loads, the nav shows "Assistant", sending a question shows the customer bubble then the bot bubble, "Talk to a human" replaces the input with the handed-off banner, and the banner's link opens the portal ticket. Switch to Arabic and repeat — labels, banner, and the bot's own replies are all in Arabic.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps/ai/client.py` gains `generate_chat_completion(messages, *, system=None, max_tokens=1024, model=None)` with the same `AIServiceError` normalization and no prompt/response logging.
- [ ] `apps/ai/models.py` defines `ChatbotSession` (`ticket` OneToOne CASCADE, `handed_off_at` nullable); `apps/ai/migrations/0001_initial.py` is generated and committed.
- [ ] `apps/ai/chatbot.py` — `get_or_start_session`, `build_history`, `answer`, `hand_off`; grounded via `build_grounded_system_prompt`, localized via `resolve_language_name`, bot turns marked `metadata={"author": "chatbot"}`, `HANDOFF_MARKER` stripped before persisting.
- [ ] `hand_off` is idempotent and queues `auto_assign_ticket.delay(...)` inside a `try/except Exception: logger.exception(...)`; a chatbot ticket is **not** auto-assigned at creation.
- [ ] `PortalChatbotView` (`GET`/`POST`) and `PortalChatbotHandoffView` (`POST`) — plain `APIView`s with explicit `permission_classes` and method-keyed `permission_map` (`PORTAL_ACCESS`), a `customer_profile` guard, `AIServiceError` → `AIServiceUnavailable`, and a `400` on posting to a handed-off conversation; both routed in `apps/portal/urls.py`, with **no** change to `config/api_urls.py`.
- [ ] `_chatbot_state` returns `{ticket, handed_off, messages:[{id, author, body, created_at}]}` with `author` derived server-side (`customer`/`bot`/`agent`).
- [ ] Portal frontend: `types/portalChatbot.ts`, `api/{portalChatbotKeys,getPortalChatbot,sendPortalChatbotMessage,handOffPortalChatbot,usePortalChatbot,usePortalChatbotMutations}.ts`, `components/PortalChatbotPage.tsx`; both mutations seed the cache via `setQueryData` rather than invalidating.
- [ ] `PortalChatbotPage` hides the input and the handoff button once `handed_off` is true, and shows a banner linking to `/portal/tickets/<id>`.
- [ ] Route `chat` added under the portal's `portal.access` block; `PortalLayout` gains an "Assistant" nav entry.
- [ ] `portal` locales gain `chatbot.*` and `nav.assistant` in **both** languages, key-parity verified.
- [ ] **No change to `consumers.py`, `routing.py`, `live_chat_adapter.py`, the public `/chat` widget, or any `Message.Channel` value.**
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0; `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified live: unconfigured AI degrades to `503` with the customer's message preserved; a configured call returns a KB-grounded reply; model-initiated handoff sets `handed_off_at` and leaks no `[HANDOFF]`; explicit handoff is idempotent; `401`/`403`/cross-customer scoping all behave; the staff ticket shows the full transcript; the UI walkthrough passes in both languages.
- [ ] `.squad/plans/ai-features/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** With this story planned, **`EPIC 13` (AI Features) is fully planned** — `AI-0` through `AI-5`, Stories 74-79. `AI-0`/`AI-1`/`AI-2`/`AI-3`/`AI-4` are implemented; this story is the last one outstanding.
