# Story 15 — WhatsApp (Story: SUPPORTOS-40)

## Prerequisites

- **Story 13 (COMM-0) and Story 14 (COMM-1) completed.** `ChannelAdapter`, the `register_adapter`/`get_adapter` registry, `CommunicationsConfig.ready()`, `MessageViewSet.perform_create`'s fail-open dispatch, and `TicketConversation.tsx` (already offering `whatsapp` as one of five `MESSAGE_CHANNELS`) all exist and are reused verbatim. `EmailAdapter`/`EmailInboundWebhookView` (`apps/communications/email_adapter.py`, `views.py`) are the direct structural precedent this story copies, per `CONVENTIONS.md` § 23's own note: *"The next channel story (COMM-2, WhatsApp) copies both shapes."*
- **This story engages with the real WhatsApp Business (Cloud) API's documented conventions, unlike COMM-1's provider-agnostic payload.** The intake names the real product explicitly ("provider (WhatsApp Business API) adapter"), and — critically — WhatsApp's webhook verification handshake and signature scheme are **not per-vendor guesswork**: they are Meta's single, stable, publicly documented convention shared across WhatsApp/Messenger/Instagram webhooks, unchanged for years. That part of this story is built from documented behaviour with high confidence. **What is genuinely unverifiable without a live WhatsApp Business account:** the exact byte-for-byte shape of a real inbound webhook payload, and whether a real outbound send succeeds. This plan is explicit about which claims are which — see the two bullets immediately below.
- **Verified, not assumed — the mechanics this story's webhook view depends on:**
  - `rest_framework.views.APIView.dispatch` sets `self.request = request` (line 510 of the installed `rest_framework/views.py`) **before** calling `self.initial(...)` (line 514), which is what performs content negotiation via `get_renderers()`. Overriding `get_renderers()` to branch on `self.request.method` is therefore safe — `self.request` already exists by the time it runs. Confirmed by reading the installed library source, not assumed.
  - DRF's `Request.__getattr__` (`rest_framework/request.py:419`) proxies any attribute DRF's `Request` does not define itself to the wrapped Django `HttpRequest` — confirmed by reading the source. `request.body` (raw bytes, needed for HMAC signature verification) reaches Django's own cached-body property this way; reading `request.body` before DRF parses `request.data` is the standard, safe order (Django caches the raw body on first read; framework-level `.data`/`.POST` parsing afterward reads from that cache, not a second time from the socket).
  - `EnvelopeJSONRenderer` (`apps/core/renderers.py`) wraps **every** non-204/304 response in the envelope — confirmed by reading its 24-line source. Meta's webhook verification handshake requires the raw `hub.challenge` string echoed back, not JSON — an unavoidable, narrow conflict with `CONVENTIONS.md` § 11 ("the envelope is the only response shape"), resolved by a `PlainTextRenderer` used **only** for this view's `GET` method. See `## Product rules`.
- **Best-effort, not live-verified — the shape of a real Meta Cloud API payload.** `extract_text_message` (task 1) parses `entry[].changes[].value.messages[]` with `from`/`type`/`text.body`/`id` fields — built from Meta's publicly documented Cloud API webhook reference, but this project has no WhatsApp Business account to confirm it against real traffic. `## Verification Steps` constructs a **hand-built** payload matching this documented shape and confirms this project's own endpoint handles it correctly — that is the limit of what can be verified here. The same honesty applies to `WhatsAppAdapter.send`: the request it builds matches Meta's documented send-message contract, but no live call is ever made without real credentials (see the next bullet).
- **No new Python dependency.** `WhatsAppAdapter.send` needs to make one outbound HTTP POST. `requirements.txt` has no HTTP client (`requests`, `httpx`, and `urllib3` are all absent — verified: `python -c "import requests"` fails in the project's own venv). Rather than adding one, this story uses the standard library's `urllib.request`/`urllib.error` — a single POST with a JSON body and a Bearer header is a small, well-contained use, and `urllib.error.HTTPError` is a subclass of `urllib.error.URLError`, so one `except` clause covers both a real HTTP error response and a connection-level failure (DNS, timeout, refused connection).
- **Outbound send has no safe-by-default backend to swap, unlike email's `EMAIL_BACKEND` (console in dev, SMTP in prod).** Django provides that abstraction for mail; there is no equivalent for an arbitrary third-party HTTP API. Instead, `WHATSAPP_API_BASE_URL` (and its sibling settings) default to **empty in every environment**, and `WhatsAppAdapter.send` refuses to run at all when any of them are unset — never firing a live, bound-to-fail (or worse, accidentally-succeeding-with-garbage-data) request at Meta's real, publicly-reachable Graph API. This is a stricter, simpler safety property than email's dev/prod split, chosen because no split is available here.
- **Ticket routing has no per-conversation address tag to key on, unlike email's `+<ticket id>` scheme.** A WhatsApp number is the customer's one fixed identity — there is no equivalent of plus-addressing. Routing therefore matches the sender's number against `ContactDetail(channel="whatsapp")` (Story 11, `CUST-2`) — **not** `Customer.phone`, because `Customer.phone` is deliberately unvalidated free text (Story 10's own documented decision) and matching two unnormalised fields against each other would only compound the unreliability. This is the first real production use of `ContactDetail` beyond its own CRUD screen (Story 11) — verified by `grep`: no other code path reads `ContactDetail` today.

---

## Story Goal

1. `WhatsAppAdapter(ChannelAdapter)` — `receive(payload)` parses Meta's documented Cloud API webhook shape, routes to the sender's most recent non-closed `Ticket` (found via `ContactDetail`) or starts a new one; `send(message)` posts to Meta's documented send-message endpoint via `urllib.request`.
2. `WhatsAppInboundWebhookView` — one URL serving **both** Meta's `GET` verification handshake (echoes `hub.challenge` as plain text) and the `POST` message-delivery webhook (HMAC-`X-Hub-Signature-256`-verified, not query-token-verified like COMM-1's email webhook — Meta's own convention, not this project's invention).
3. Provider config entirely via `ENV` — no new model, no new admin, no new permission, no new Python dependency.
4. `TicketConversation.tsx`'s existing `whatsapp` channel choice (COMM-0) becomes real — zero new frontend code, exactly like COMM-1.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `WhatsAppAdapter.receive`/`send` | The intake's literal ask. |
| Meta's real verification handshake + `X-Hub-Signature-256` | Not optional extras — these are the actual required mechanics of integrating with Meta's webhook system, fully implementable and independently verifiable without a live account (they are algorithms, not network calls to Meta). |
| Routing via `ContactDetail(channel="whatsapp")` | The only reliable identity key WhatsApp offers; reuses Story 11's model exactly as intended. |
| `PlainTextRenderer` (new, in `apps/core/renderers.py`) | Meta's protocol, not this project's, dictates the `GET` handshake's response shape. A narrow, explicit exception to § 11, confined to one method of one view. |

**Not here, and why:**

- **No `requests`/`httpx` dependency.** `urllib.request` covers one POST call; see `## Prerequisites`.
- **No media/attachment support** (images, documents, audio). `Message.body` is text-only, matching COMM-1's own text-only scope; WhatsApp's real API supports far more than this story touches.
- **No delivery-status/read-receipt webhook handling.** Meta also posts status-update events to the same webhook URL — this story's view returns a bare `200` for anything that is not an inbound text message (Meta requires `200` for every event it sends, or it retries and eventually disables the subscription) but does **not** process or store status events. Same "no delivery-status field" boundary COMM-0/COMM-1 already drew.
- **No provider-config model or admin UI.** `INT-3` (`SupportOs backlog.MD:661-665`), unchanged from COMM-1's own note.
- **No frontend UI changes.** See `## Story Goal`.

---

## Context — Read These Files First

1. `.squad/stories/communication-channels/SUPPORTOS-40/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` **lines 374-379** (`COMM-2`).
3. `backend/apps/communications/email_adapter.py` (all lines, after Story 14) — the direct structural template: a module-level parsing helper (`TICKET_TAG_RE` → this story's `extract_text_message`), a `@register_adapter`-decorated class, `receive`/`send` shaped the same way.
4. `backend/apps/communications/views.py` (107 lines, after Story 14) — `EmailInboundWebhookView`'s exact `authentication_classes: list = []` / `permission_classes = [AllowAny]` / fail-closed-token shape, copied for the `POST` half of `WhatsAppInboundWebhookView`. The `GET` half has no COMM-1 precedent — new in this story.
5. `backend/apps/communications/adapters.py` (53 lines) — `register_adapter`/`get_adapter`, unchanged; task 1 adds no code here, only imports `WhatsAppAdapter` for registration via `apps.py`.
6. `backend/apps/communications/apps.py` (9 lines) — `ready()` currently imports only `email_adapter`; task 1 adds `whatsapp_adapter` to the same import line.
7. `backend/apps/communications/urls.py` (20 lines) — the single `path()` alongside the router; task 3 adds a second `path()` the same way.
8. `backend/apps/core/renderers.py` (24 lines) — `EnvelopeJSONRenderer`, read in full: its 204/304 special-case (lines 17-19) is the only existing precedent for a response that does **not** get the envelope. Task 2 adds `PlainTextRenderer` to this **same file** — the shared home for renderer classes, per `CONVENTIONS.md` § 0/§ 1.
9. `backend/apps/customers/models.py` lines 53-95 (`ContactDetail`) — `Channel.WHATSAPP` (line 66, already exists), the `(customer, channel, value)` unique constraint (lines 87-92, satisfied automatically since this story only ever creates a `ContactDetail` alongside a brand-new `Customer`).
10. `backend/apps/tickets/models.py` (56 lines) — `Ticket.Status.CLOSED` (line 21), the field task 1's routing logic excludes when finding "the customer's most recent open ticket."
11. `backend/config/settings/base.py` — the `# --- Email (COMM-1) ---` section (added by Story 14) is the section-comment style task 4's `# --- WhatsApp (COMM-2) ---` block follows; contrast its **no-safe-default-anywhere** design with email's dev/prod `EMAIL_BACKEND` split — see `## Prerequisites`.
12. `README.md` **§ Environment variables → Backend** — the table task 5 appends five rows to, in the same commit as `.env.example` (§ 9's rule).
13. `backend/requirements.txt` (7 lines) — confirms no HTTP client library is present; task 1 adds **no line here** (stdlib `urllib` only).
14. `CONVENTIONS.md` § 11 (the envelope-is-the-only-shape rule this story carves one narrow exception into), § 13 (explicit `permission_classes` on an open `APIView`), § 23 (feature module conventions — this story's own addition in task 6 follows the same shape as Story 11/12/13/14's).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **WhatsApp adapter against the shared interface + webhook intake.** | Intake, task 1 | `WhatsAppAdapter(ChannelAdapter)`, `WhatsAppInboundWebhookView`. |
| **WhatsApp wired into the shared conversation view.** | Intake, task 2 | `MessageViewSet.perform_create` (unchanged code, already generic) dispatches to `WhatsAppAdapter.send()` for every outbound `channel="whatsapp"` `Message` — the *existing* reply form (COMM-0) is what triggers this; no new frontend code. |
| **The verification handshake echoes plain text, not the envelope.** | Meta's protocol, not this project's choice | `WhatsAppInboundWebhookView.get_renderers()` returns `[PlainTextRenderer()]` only for `GET`; `POST` keeps the project-wide envelope. |
| **Inbound `POST` is HMAC-signature-verified, not query-token-verified.** | Meta's protocol | `verify_signature` (`whatsapp_adapter.py`) checks `X-Hub-Signature-256` against `WHATSAPP_APP_SECRET` using `hmac.compare_digest`. |
| **A non-text webhook event (status update, read receipt, ...) still returns `200`, but is not processed.** | Meta's protocol requirement | `WhatsAppInboundWebhookView.post` returns `Response(status=200)` when `extract_text_message` finds nothing, before calling `receive()`. |
| **Outbound send refuses to run against unconfigured settings, in every environment.** | This story's design | `WhatsAppAdapter.send` raises `ValueError` if `WHATSAPP_API_BASE_URL`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` are not all set — never a live call with garbage credentials. |
| **Routing keys on `ContactDetail(channel="whatsapp")`, never `Customer.phone`.** | This story's design, per Story 10's own unvalidated-`phone` decision | `WhatsAppAdapter.receive`'s customer lookup. |
| Wire format is `snake_case` end to end. | § 12 | No new TS type — this story adds no frontend file. |
| Config from `ENV`; no new secret committed, no new dependency. | § 17 | All five new settings are `ENV`-driven; `urllib` is stdlib. |

---

## Backend Tasks

### 1 — The WhatsApp adapter

**Create file: `backend/apps/communications/whatsapp_adapter.py`**

```python
import hashlib
import hmac
import json
import urllib.error
import urllib.request

from django.conf import settings

from apps.customers.models import ContactDetail, Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message


def verify_signature(secret: str, body: bytes, signature_header: str) -> bool:
    """Meta's `X-Hub-Signature-256` HMAC-SHA256 verification — the same
    convention Meta uses across WhatsApp, Messenger, and Instagram webhooks.
    `body` must be the exact raw request bytes Meta signed, read before DRF
    parses `request.data`. See Story 15 `## Prerequisites`.
    """
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    provided = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)


def extract_text_message(payload: dict) -> dict | None:
    """Meta's Cloud API webhook batches multiple entries/changes per
    request and includes non-message events (status updates, read
    receipts); this project only handles the first `type: "text"` message
    in the batch. Built from Meta's publicly documented Cloud API webhook
    shape — NOT verified against a live WhatsApp Business account. See
    Story 15 `## Prerequisites`.
    """
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []):
                if message.get("type") != "text":
                    continue
                return {
                    "from": message.get("from", ""),
                    "body": message.get("text", {}).get("body", ""),
                    "message_id": message.get("id", ""),
                }
    return None


@register_adapter
class WhatsAppAdapter(ChannelAdapter):
    """WhatsApp channel — COMM-2, against Meta's WhatsApp Business (Cloud)
    API. Unlike `EmailAdapter` (COMM-1), routing has no per-conversation
    address tag to key on — a WhatsApp number is the customer's fixed
    identity, matched via `ContactDetail(channel="whatsapp")` (CUST-2,
    Story 11), not `Customer.phone` (unvalidated free text — matching two
    unnormalised fields against each other would only compound the
    unreliability). See Story 15 `## Prerequisites`.
    """

    channel = Message.Channel.WHATSAPP

    def receive(self, payload: dict) -> Message:
        extracted = extract_text_message(payload)
        if extracted is None:
            raise ValueError("No text message found in the WhatsApp webhook payload.")

        from_number = extracted["from"]
        body = extracted["body"]

        contact = (
            ContactDetail.objects.filter(channel=ContactDetail.Channel.WHATSAPP, value=from_number)
            .select_related("customer")
            .first()
        )
        if contact is not None:
            customer = contact.customer
        else:
            customer = Customer.objects.create(name=from_number, phone=from_number)
            ContactDetail.objects.create(
                customer=customer, channel=ContactDetail.Channel.WHATSAPP, value=from_number
            )

        # Continue the customer's most recent non-closed ticket, or start a
        # new one. No per-conversation address tag exists for WhatsApp the
        # way email's "+ticket-id" does — routing keys on customer identity.
        ticket = (
            Ticket.objects.filter(customer=customer)
            .exclude(status=Ticket.Status.CLOSED)
            .order_by("-created_at")
            .first()
        )
        if ticket is None:
            ticket = Ticket.objects.create(
                subject=f"WhatsApp from {from_number}",
                description=body,
                customer=customer,
            )

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.WHATSAPP,
            body=body,
            metadata={"from": from_number, "message_id": extracted["message_id"]},
        )

    def send(self, message: Message) -> None:
        if not (
            settings.WHATSAPP_API_BASE_URL
            and settings.WHATSAPP_PHONE_NUMBER_ID
            and settings.WHATSAPP_ACCESS_TOKEN
        ):
            raise ValueError("WhatsApp sending is not configured (WHATSAPP_* settings are blank).")

        contact = ContactDetail.objects.filter(
            customer=message.ticket.customer, channel=ContactDetail.Channel.WHATSAPP
        ).first()
        if contact is None:
            raise ValueError(
                f"Cannot send WhatsApp message for ticket #{message.ticket_id}: "
                "its customer has no WhatsApp contact on file."
            )

        url = f"{settings.WHATSAPP_API_BASE_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        body = json.dumps(
            {
                "messaging_product": "whatsapp",
                "to": contact.value,
                "type": "text",
                "text": {"body": message.body},
            }
        ).encode()
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError as exc:
            raise ValueError(
                f"WhatsApp send failed for ticket #{message.ticket_id}: {exc}"
            ) from exc
```

**File: `backend/apps/communications/apps.py`** — register the second adapter:

```python
    def ready(self):
        from . import email_adapter, whatsapp_adapter  # noqa: F401 — imports run @register_adapter
```

---

### 2 — The plain-text renderer

**File: `backend/apps/core/renderers.py`** — append:

```python
class PlainTextRenderer:
    """Meta's WhatsApp webhook verification handshake requires the
    `hub.challenge` value echoed back as a raw string — not this API's
    envelope, which `EnvelopeJSONRenderer` would otherwise wrap it in. A
    deliberate, narrow exception to CONVENTIONS.md §11 ("the envelope is
    the only response shape") for an external protocol this project does
    not control the contract of. Used only by
    `WhatsAppInboundWebhookView.get_renderers()` (Story 15, COMM-2), and
    only for its `GET` method.
    """

    media_type = "text/plain"
    format = "txt"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return str(data).encode("utf-8")
```

---

### 3 — The inbound webhook and routing

**File: `backend/apps/communications/views.py`** — extend imports and append the view:

```python
from apps.core.renderers import PlainTextRenderer

from .whatsapp_adapter import WhatsAppAdapter, extract_text_message, verify_signature
```

```python
class WhatsAppInboundWebhookView(APIView):
    """Meta's WhatsApp Business (Cloud) API webhook — one URL handles both
    the `GET` verification handshake and `POST` inbound message delivery,
    matching how Meta's own webhook configuration works (a single Callback
    URL). `POST` is signature-verified (`X-Hub-Signature-256`,
    `WHATSAPP_APP_SECRET`), not token-in-query-string like
    `EmailInboundWebhookView` — Meta's own convention, not this project's
    invention. See Story 15 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get_renderers(self):
        if self.request.method == "GET":
            return [PlainTextRenderer()]
        return super().get_renderers()

    def get(self, request):
        # Fail closed, same reasoning as EmailInboundWebhookView (Story 14).
        if not settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
            raise PermissionDenied()
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token", "")
        challenge = request.query_params.get("hub.challenge", "")
        if mode != "subscribe" or not constant_time_compare(
            token, settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN
        ):
            raise PermissionDenied()
        return Response(challenge)

    def post(self, request):
        if not settings.WHATSAPP_APP_SECRET:
            raise PermissionDenied()
        signature = request.headers.get("X-Hub-Signature-256", "")
        if not verify_signature(settings.WHATSAPP_APP_SECRET, request.body, signature):
            raise PermissionDenied()

        # Meta POSTs every webhook event (message delivered, read receipts,
        # ...) to this same URL, not just inbound text messages — Meta
        # requires 200 OK for all of them or it retries and eventually
        # disables the subscription. Only a text message is processed.
        if extract_text_message(request.data) is None:
            return Response(status=status.HTTP_200_OK)

        message = WhatsAppAdapter().receive(request.data)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
```

**File: `backend/apps/communications/urls.py`** — add the second webhook path:

```python
from .views import EmailInboundWebhookView, MessageViewSet, WhatsAppInboundWebhookView

urlpatterns = [
    path(
        "webhooks/email/inbound/", EmailInboundWebhookView.as_view(), name="email-inbound-webhook"
    ),
    path(
        "webhooks/whatsapp/inbound/",
        WhatsAppInboundWebhookView.as_view(),
        name="whatsapp-inbound-webhook",
    ),
    *router.urls,
]
```

Endpoints: `GET/POST /api/webhooks/whatsapp/inbound/`. No change to `config/api_urls.py` — already covered.

---

### 4 — Settings

**File: `backend/config/settings/base.py`** — append after the `# --- Email (COMM-1) ---` block:

```python
# --- WhatsApp (COMM-2) -----------------------------------------------------
# Meta's WhatsApp Business (Cloud) API. No safe default anywhere — unlike
# email's dev/prod EMAIL_BACKEND split, there is no "print instead of send"
# abstraction for an arbitrary HTTP call, so every WHATSAPP_* setting stays
# blank until explicitly configured, in every environment.
# WhatsAppAdapter.send refuses to run against blank config rather than
# firing a real request at Meta's live API with empty credentials. See
# Story 15 `## Prerequisites`.
WHATSAPP_API_BASE_URL = env("WHATSAPP_API_BASE_URL", default="")
WHATSAPP_PHONE_NUMBER_ID = env("WHATSAPP_PHONE_NUMBER_ID", default="")
WHATSAPP_ACCESS_TOKEN = env("WHATSAPP_ACCESS_TOKEN", default="")
# Fail closed: GET verification handshake rejects every request until set.
WHATSAPP_WEBHOOK_VERIFY_TOKEN = env("WHATSAPP_WEBHOOK_VERIFY_TOKEN", default="")
# Fail closed: POST signature verification rejects every request until set.
WHATSAPP_APP_SECRET = env("WHATSAPP_APP_SECRET", default="")
```

**No `dev.py`/`prod.py` change** — unlike email, safety comes from requiring explicit configuration everywhere, not an environment-specific backend swap.

**No migration.** This story adds no model field.

---

## Documentation Tasks

### 5 — Environment variables

**File: `backend/.env.example`** — append:

```
# --- WhatsApp (COMM-2) ---
WHATSAPP_API_BASE_URL=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
```

**File: `README.md`** — append five rows to the `### Backend` table (after the `EMAIL_*` rows added by Story 14):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `WHATSAPP_API_BASE_URL` | no | *(empty — sending refuses to run until set)* | Base URL of Meta's Graph API, e.g. `https://graph.facebook.com/v21.0`. |
| `WHATSAPP_PHONE_NUMBER_ID` | no | *(empty)* | Meta's internal id for the business's WhatsApp number. |
| `WHATSAPP_ACCESS_TOKEN` | no | *(empty)* | Bearer token for the WhatsApp Cloud API. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | no | *(empty — verification handshake rejects every request until set)* | Shared secret Meta's `GET` webhook-verification handshake checks against `hub.verify_token`. |
| `WHATSAPP_APP_SECRET` | no | *(empty — inbound webhook rejects every request until set)* | Meta App Secret used to verify the `X-Hub-Signature-256` header on every inbound `POST`. |

### 6 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 14's paragraph):

> **A channel adapter's identity/routing key is whatever the channel actually offers — not a pattern copied from the previous channel.** Email routes by a `+<ticket id>` address tag; WhatsApp has no such per-conversation address, so it routes by matching the sender's number against `ContactDetail(channel=...)` (`CUST-2`, Story 11) and continuing the customer's most recent non-closed ticket. **When a third-party protocol dictates a response shape this API's envelope cannot express** (Meta's plain-text webhook-verification echo), scope the exception to exactly the one view/method that needs it — `PlainTextRenderer` (`apps/core/renderers.py`) plus a `get_renderers()` override, not a global renderer change. **An outbound integration with no safe "don't actually send" backend to swap** (unlike Django's mail backends) should refuse to run at all against unconfigured settings, in every environment, rather than attempting a live call with blank credentials. `apps/communications/whatsapp_adapter.py` (Story 15, `COMM-2`) is the worked example for all three.

No new import-boundary or invalidation pattern — this story adds no frontend file.

---

## Edge Cases & Failure Modes

- **The verification handshake fails closed with no token configured**, exactly like `EmailInboundWebhookView` — `WHATSAPP_WEBHOOK_VERIFY_TOKEN` defaults to `""`, and the `GET` handler rejects before comparing anything.
- **The `X-Hub-Signature-256` check fails closed with no app secret configured.** Same shape, different mechanism (HMAC comparison instead of a query-string token) — Meta's own convention, not invented here.
- **A non-text webhook event (delivery status, read receipt) returns `200` but is silently not processed.** `extract_text_message` returns `None` for anything without a `messages` array containing a `type: "text"` entry; the view responds `200` **before** calling `WhatsAppAdapter().receive()`, so `receive()`'s own `ValueError` for "no text message" is never actually reached from the webhook — it only fires for a direct/hand-built call to `receive()` that skips this guard.
- **A reply from an unknown WhatsApp number creates a new `Customer` (with `phone` set) and a matching `ContactDetail(channel="whatsapp")` in the same transaction** — never a `Customer` with no way to be reached back on the channel it just contacted.
- **A second inbound message from the same number, while their most recent ticket is still open, continues that ticket** rather than starting a new one; **if their most recent ticket is `closed`, a new ticket starts** — this is a real product decision, not an oversight: WhatsApp has no way to signal "this is a new issue" the way opening a fresh email thread does, so ticket boundaries are inferred from status alone.
- **Sending to a customer with no `ContactDetail(channel="whatsapp")` fails with a clear error, message still persists** — same "record now, deliver best-effort" pattern as COMM-1's no-email-customer case, caught and logged by the same unchanged `MessageViewSet.perform_create`.
- **Sending with any of `WHATSAPP_API_BASE_URL`/`PHONE_NUMBER_ID`/`ACCESS_TOKEN` blank never attempts a network call at all** — verified as the safe default in every environment, not just dev (contrast COMM-1, where a misconfigured prod could still attempt a real SMTP connection).
- **`request.body` is read before `request.data` is parsed, in that order, on every `POST`.** Reordering this (parsing `.data` first) would still work functionally in this Django/DRF version (verified: body caching), but the signature check must happen **before** any code trusts the payload — verified order matters for security intent, not just mechanics.
- **Arabic WhatsApp message bodies round-trip correctly** — `body.encode()`/`json.dumps(...).encode()` are UTF-8 by default in Python; nothing in this story assumes ASCII.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations communications --check --dry-run` — must report **no changes**.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: the verification handshake (fail-closed, mode mismatch, success), the signature check (fail-closed, mismatch, hand-computed-correct), a non-text event's `200` no-op, first-contact routing, same-open-ticket continuation, closed-ticket-starts-new-ticket, outbound refusal when unconfigured — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` — confirms **zero** frontend files changed by this story still pass.

---

## Migration / Rollback

**No migration.** Pure code + settings change.

**Rollback of the code:** revert the commits. **No `pip install`/`npm install`** — `urllib` is stdlib.

**Half-applied states to avoid:**

- **Task 1's adapter without task 1's `apps.py` registration.** `get_adapter("whatsapp")` silently returns `None` forever — outbound WhatsApp messages are accepted and stored but never dispatched, no error anywhere.
- **Task 3's view without task 2's `PlainTextRenderer`.** The `GET` verification handshake returns the JSON envelope instead of a raw challenge string — Meta's real webhook setup would reject the subscription (though this project cannot confirm that against a live account, the `Content-Type`/body mismatch from what Meta's docs specify is itself the observable bug, verifiable in `## Verification Steps`).
- **Task 5 (`.env.example`/README) skipped.** § 9's rule broken silently.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration was needed:** `python manage.py makemigrations communications --check --dry-run` exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The verification handshake fails closed with no token configured**, `GET /api/webhooks/whatsapp/inbound/?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123` → `403`.
5. **Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN=test-verify` in `backend/.env`, restart.** `GET .../?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123` → `403`. `GET .../?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=123` → `200`, response body is the **literal text `123`**, `Content-Type: text/plain` — confirm with `curl -i` that the body is not JSON-wrapped.
6. **The signature check fails closed with no app secret configured.** `POST /api/webhooks/whatsapp/inbound/` with any body/headers → `403`.
7. **Set `WHATSAPP_APP_SECRET=test-app-secret`, restart.** Compute the expected signature by hand:

   ```powershell
   python -c "import hmac,hashlib; print('sha256=' + hmac.new(b'test-app-secret', b'{}', hashlib.sha256).hexdigest())"
   ```

   `POST .../inbound/` with body `{}` and header `X-Hub-Signature-256: <that value>` → `200` (empty body — no `messages` key, treated as a non-text event). The same request with a **wrong** signature header → `403`.
8. **A non-text event returns `200` without creating anything.** Compute the correct signature for a body shaped like `{"entry":[{"changes":[{"value":{"messages":[{"type":"image","from":"15551234567","id":"wamid.1"}]}}]}]}`; `POST` it with the correct header → `200`; confirm no new `Ticket`/`Message` exists for that number.
9. **First-contact text message creates a `Customer` (with `phone` set), a `ContactDetail(channel="whatsapp")`, and a new `Ticket`.** Build a payload matching the documented shape:

   ```json
   {"entry":[{"changes":[{"value":{"messages":[{"type":"text","from":"15551234567","id":"wamid.2","text":{"body":"Hello, I need help"}}]}}]}]}
   ```

   Compute its signature, `POST` with the correct header → `201`; confirm via the API a `Customer` with `phone: "15551234567"` exists and has a `ContactDetail` with `channel: "whatsapp"`, `value: "15551234567"`; the returned `Message.ticket` points at a new `Ticket`.
10. **A second message from the same number continues the same ticket** (it is still `open`). Repeat step 9's payload shape with a different `message_id`/body, same `from` — `201`; `GET /api/messages/?ticket=<the same ticket id>` now shows two messages.
11. **A message from the same number after the ticket is closed starts a new ticket.** `PATCH` the ticket's `status` to `"closed"` (direct API call, since Story 12 deliberately ships no status-changing UI); repeat step 9's payload shape again → `201`; confirm the returned `Message.ticket` is a **different** ticket id than steps 9-10's.
12. **Outbound send refuses to run when unconfigured** (the shipped default — `WHATSAPP_API_BASE_URL` etc. unset in `.env.example`): `POST /api/messages/` with `{"ticket": <id>, "direction": "outbound", "channel": "whatsapp", "body": "..."}` for a ticket whose customer **has** a WhatsApp `ContactDetail` → still `201` (message persists); server log shows a logged `ValueError` mentioning `"WhatsApp sending is not configured"`.
13. **Sending to a customer with no WhatsApp contact fails the same way**, with the other `ValueError` message ("no WhatsApp contact on file") — confirm both failure messages are distinguishable in the log.
14. **No frontend file changed.** `git status --porcelain -- frontend/` shows nothing.
15. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `WhatsAppAdapter(ChannelAdapter)` in `apps/communications/whatsapp_adapter.py`, decorated `@register_adapter`, `channel = Message.Channel.WHATSAPP`.
- [ ] `extract_text_message`/`verify_signature` module-level helpers, built from Meta's documented Cloud API webhook shape, explicitly caveated as unverified against a live account.
- [ ] `CommunicationsConfig.ready()` imports both `email_adapter` and `whatsapp_adapter`.
- [ ] `receive()` routes via `ContactDetail(channel="whatsapp")`, never `Customer.phone`; continues the customer's most recent non-closed ticket or creates a new one.
- [ ] `send()` refuses to run when any of `WHATSAPP_API_BASE_URL`/`PHONE_NUMBER_ID`/`ACCESS_TOKEN` are blank; raises a clear error when the customer has no WhatsApp `ContactDetail`; otherwise posts to Meta's documented send-message shape via `urllib.request` — **no new dependency**.
- [ ] `PlainTextRenderer` added to `apps/core/renderers.py`; `WhatsAppInboundWebhookView.get_renderers()` uses it only for `GET`.
- [ ] `WhatsAppInboundWebhookView.get` implements Meta's real verification handshake (`hub.mode`/`hub.verify_token`/`hub.challenge`), fails closed when `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is unset.
- [ ] `WhatsAppInboundWebhookView.post` verifies `X-Hub-Signature-256` against `WHATSAPP_APP_SECRET`, fails closed when unset; returns `200` (no-op) for a non-text event before calling `receive()`.
- [ ] Registered at `GET/POST /api/webhooks/whatsapp/inbound/`.
- [ ] Five `WHATSAPP_*` settings added to `base.py` — **no `dev.py`/`prod.py` change**, **no migration**.
- [ ] `.env.example` and `README.md`'s environment-variable table both gain all five new variables, in the same change.
- [ ] `CONVENTIONS.md` § 23 gains the routing/renderer-exception/fail-safe paragraph.
- [ ] **Zero frontend files changed.**
- [ ] `python manage.py test` reports **54** passing; `makemigrations communications --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the verification handshake, plain-text response confirmed via `curl -i` (Steps 4-5); the signature check, including a hand-computed correct signature (Steps 6-7); non-text-event no-op (Step 8); first-contact routing creating `Customer`+`ContactDetail`+`Ticket` (Step 9); same-open-ticket continuation (Step 10); closed-ticket-starts-new-ticket (Step 11); outbound refusal when unconfigured and when the customer lacks a WhatsApp contact, both distinguishable in the log (Steps 12-13).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0, unaffected by this story.
- [ ] `.squad/plans/communication-channels/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The next ready stories in communication-channels are **COMM-3 (Live Chat)** and **COMM-4 (SMS)** — each depends only on `COMM-0` (complete) and can copy this story's or COMM-1's registry/dispatch pattern (COMM-4/SMS, via a provider like Twilio, is architecturally closer to this story's real-third-party-API shape than to COMM-1's provider-agnostic one); **COMM-5 (Web Forms)** additionally needs `TKT-2` (not yet planned). COMM-3 (Live Chat) is a bigger jump — the backlog names Django Channels (WebSockets) as a new dependency, unlike every story so far.
