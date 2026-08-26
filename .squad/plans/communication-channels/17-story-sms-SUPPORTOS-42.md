# Story 17 — SMS (Story: SUPPORTOS-42)

## Prerequisites

- **Story 13 (COMM-0), Story 14 (COMM-1, Email), and Story 15 (COMM-2, WhatsApp) completed.** `ChannelAdapter`, `register_adapter`/`get_adapter` (`apps/communications/adapters.py`, 52 lines), `CommunicationsConfig.ready()`, `MessageViewSet.perform_create`'s fail-open dispatch (`apps/communications/views.py`), and `TicketConversation.tsx` (already offering `sms` as one of five `MESSAGE_CHANNELS` — verified: `frontend/src/features/tickets/types/message.ts:5`, `MESSAGE_CHANNELS = ['email', 'whatsapp', 'chat', 'sms', 'web_form']`) all exist and are reused verbatim. **Story 15's `whatsapp_adapter.py` is the direct structural precedent this story copies** — same shape (module-level signing helper + `@register_adapter`-decorated adapter class + a webhook `APIView`), against a different real provider's real protocol.
- **This story engages Twilio's Programmable Messaging API — a second real, documented third-party protocol, structurally similar to Story 15's Meta integration but with two concrete differences that change the code, not just the provider name:**
  1. **Twilio's inbound webhook is form-encoded (`application/x-www-form-urlencoded`), not JSON.** This project's global DRF parser is JSON-only — verified: `backend/config/settings/base.py:222-224`, `"DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"]`. `rest_framework.parsers.FormParser` exists in the installed DRF version — verified by reading `backend/.venv/Lib/site-packages/rest_framework/parsers.py:71`. The new webhook view must declare `parser_classes = [FormParser]` itself; without it, every Twilio POST fails with `415 Unsupported Media Type` before the view's own code ever runs.
  2. **Twilio signs the webhook URL plus every POST parameter, not the raw request body.** Meta's `X-Hub-Signature-256` (Story 15) is computed over raw bytes and does not depend on the URL. Twilio's `X-Twilio-Signature` is computed over the exact URL Twilio was configured to POST to, concatenated with every parameter name+value (sorted by name), HMAC-SHA1'd with the Auth Token, then base64-encoded — publicly documented at Twilio's own "Validating requests" reference, unchanged for years, and independently verifiable as a pure algorithm without a live account (same confidence level Story 15 claimed for Meta's HMAC). **The exact URL matters and cannot be safely reconstructed from `request.build_absolute_uri()`** — a reverse proxy, tunnel (ngrok), or load balancer rewriting the `Host` header would silently break every signature check. This story pins it as an explicit `SMS_WEBHOOK_URL` setting instead — the literal URL entered into the Twilio console — rather than reconstructing it from the request.
- **Best-effort, not live-verified — same honesty Story 15 applied to Meta.** `verify_signature`'s algorithm and `SMSAdapter.send`'s request shape are built from Twilio's public REST API reference; this project has no live Twilio account. `## Verification Steps` hand-computes a real signature and confirms this project's own endpoint handles it correctly — that is the limit of what can be verified here.
- **No new Python dependency**, same reasoning as Story 15: `requirements.txt` (10 lines, confirmed unchanged since Story 16 — `channels`/`daphne` are its only additions) has no HTTP client. `SMSAdapter.send` needs one outbound POST with Basic Auth and a form-encoded body — small enough for the standard library's `urllib.request`/`base64`, matching `whatsapp_adapter.py`'s own precedent instead of adding the `twilio` SDK package.
- **Outbound send has no safe-by-default backend to swap**, same as WhatsApp — every `SMS_*` setting defaults to blank in every environment, and `SMSAdapter.send` refuses to run at all when any of the four sending-related settings (`SMS_API_BASE_URL`, `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM_NUMBER`) is unset, rather than firing a live request at Twilio's real, publicly-reachable API with blank/garbage credentials.
- **Ticket routing has no per-conversation address tag, same shape as WhatsApp, keyed on a different `ContactDetail` channel.** A phone number is the identity both SMS and a voice contact would use — this story routes via the **existing** `ContactDetail.Channel.PHONE` (verified: `backend/apps/customers/models.py:65`, `PHONE = "phone", _("Phone")`), not a new `SMS` channel value, so a phone number a customer already has on file (added via the existing Contact Details UI, Story 11) is found automatically, and a customer never ends up with two separate contact-detail rows for the same physical number. `Customer.phone` (unvalidated free text, Story 10's own documented decision) is still not the match key, for the same "matching two unnormalised fields would compound the unreliability" reason Story 15 gave.
- **`Message.Channel.SMS` already exists** — verified: `backend/apps/communications/models.py:23`, `SMS = "sms", _("SMS")` (added by Story 13, COMM-0, unused by any adapter until now).

---

## Story Goal

1. `SMSAdapter(ChannelAdapter)` — `receive(payload)` routes an inbound SMS to the sender's most recent non-closed `Ticket` (found via `ContactDetail(channel="phone")`) or starts a new one; `send(message)` posts to Twilio's documented Messages resource via `urllib.request`.
2. `SMSInboundWebhookView` — a single `POST`-only endpoint (Twilio has no separate verification-handshake step, unlike Meta's `GET`) that parses Twilio's form-encoded payload and verifies `X-Twilio-Signature` against the configured webhook URL.
3. Provider config entirely via `ENV` — no new model, no new admin, no new permission, no new Python dependency.
4. `TicketConversation.tsx`'s existing `sms` channel choice (COMM-0) becomes real — **zero new frontend code**, exactly like COMM-1 and COMM-2.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `SMSAdapter.receive`/`send` | The intake's literal ask ("SMS adapter — Implement provider send/receive adapter. Outcome: SMS ↔ tickets."). |
| Twilio's real `X-Twilio-Signature` verification | Not an optional extra — the actual required mechanic of trusting an inbound Twilio webhook; a pure, independently verifiable algorithm, same confidence level as Story 15's Meta HMAC. |
| `parser_classes = [FormParser]` on the webhook view only | Twilio's webhook is form-encoded; the project-wide `DEFAULT_PARSER_CLASSES` is JSON-only (`base.py:222-224`) and must not change for every other view. |
| Routing via `ContactDetail(channel="phone")` | Reuses the identity channel that already exists for a phone number (Story 11), rather than inventing a redundant SMS-specific one. |
| `SMS_WEBHOOK_URL` (new setting, no WhatsApp/Email equivalent) | Twilio's signature depends on the exact webhook URL; reconstructing it from the request is unsafe behind a proxy/tunnel. |

**Not here, and why:**

- **No `twilio`/`requests`/`httpx` dependency.** `urllib.request` covers one POST call; see `## Prerequisites`.
- **No MMS/media support.** `Message.body` is text-only, matching every prior channel's text-only scope.
- **No delivery-status callback handling.** Twilio can also POST delivery-status updates to a separate `StatusCallback` URL if one is configured; this story configures none, so Twilio never sends them — no code path is needed to ignore them (unlike WhatsApp, which shares one URL for both message and status events and must actively no-op the latter).
- **No provider-config model or admin UI.** `INT-3` (`SupportOs backlog.MD:661-665`), unchanged from COMM-1/COMM-2's own note.
- **No frontend UI changes.** See `## Story Goal`.

---

## Context — Read These Files First

1. `.squad/stories/communication-channels/SUPPORTOS-42/intake.md` — two task blocks ("SMS adapter", "SMS in conversation UI"), **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` — `COMM-4` (SMS), the epic 5 entry this story implements.
3. `backend/apps/communications/whatsapp_adapter.py` (148 lines, after Story 16) — the direct structural template: a module-level `verify_signature` helper, a `@register_adapter`-decorated class, `receive`/`send` shaped the same way. This story's `sms_adapter.py` follows the same shape with a different signing algorithm and a simpler (flat, non-batched) payload.
4. `backend/apps/communications/views.py` (183 lines, after Story 16) — `WhatsAppInboundWebhookView`'s `authentication_classes: list = []` / `permission_classes = [AllowAny]` / fail-closed-signature shape (lines 112-159), copied for `SMSInboundWebhookView`, minus the `GET` handshake half (Twilio has none) and plus a `parser_classes` override (new — no prior webhook view has needed one, since Email's token is a query param and WhatsApp's body is JSON, matching the global default).
5. `backend/apps/communications/adapters.py` (52 lines) — `register_adapter`/`get_adapter`, unchanged; this story adds no code here, only imports `SMSAdapter` for registration via `apps.py`.
6. `backend/apps/communications/apps.py` (13 lines, after Story 16) — `ready()` currently imports `email_adapter, live_chat_adapter, whatsapp_adapter`; this story adds `sms_adapter` to the same import tuple.
7. `backend/apps/communications/urls.py` (31 lines, after Story 16) — three existing `path()` entries (`webhooks/email/inbound/`, `webhooks/whatsapp/inbound/`, `live-chat/start/`) alongside the router; this story adds a fourth the same way.
8. `backend/apps/customers/models.py` lines 53-96 (`ContactDetail`) — `Channel.PHONE` (line 65, already exists, previously used only by the Contact Details CRUD screen — Story 11), the `(customer, channel, value)` unique constraint (lines 87-92).
9. `backend/apps/tickets/models.py` line 21 (`Ticket.Status.CLOSED`) — the field this story's routing logic excludes when finding "the customer's most recent open ticket," same as Story 15.
10. `backend/apps/communications/models.py` line 23 (`Message.Channel.SMS`) — already exists since Story 13; this story is its first real adapter.
11. `backend/config/settings/base.py` lines 320-345 (the `# --- WhatsApp (COMM-2) ---` and `# --- Live Chat / Channels (COMM-3) ---` blocks) — the section-comment style this story's `# --- SMS (COMM-4) ---` block follows; also **lines 218-237** (`REST_FRAMEWORK`), specifically `"DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"]` (lines 222-224) — the global setting `SMSInboundWebhookView.parser_classes` must override locally, not change globally.
12. `backend/.env.example` lines 44-49 (the `# --- WhatsApp (COMM-2) ---` block) — the format this story's `# --- SMS (COMM-4) ---` block appends after, in the same file.
13. `README.md` lines 483-487 (the five `WHATSAPP_*` table rows) — the table this story appends six `SMS_*` rows to, in the same commit as `.env.example`'s rule (`CONVENTIONS.md` § 17/output rule 9 equivalent — see Story 15's own `## Context`, item 12).
14. `backend/requirements.txt` (10 lines, after Story 16) — confirms no HTTP client library is present; this story adds **no line here** (stdlib `urllib`/`base64`/`hmac`/`hashlib` only).
15. `frontend/src/features/tickets/types/message.ts` line 5 — `MESSAGE_CHANNELS` already includes `'sms'`; `frontend/src/features/tickets/locales/en.json` line 54 — `"sms": "SMS"` already exists. **Confirms zero frontend files change in this story.**
16. `CONVENTIONS.md` § 13 (explicit `permission_classes` on an open `APIView`), § 23 (feature module conventions — lines 1001-1015 record the "identity/routing key is whatever the channel actually offers" and "no safe default, refuse to run unconfigured" patterns from Story 15/16 this story continues; this story's own addition appends after line 1015).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **SMS adapter against the shared interface + webhook intake.** | Intake, task 1 | `SMSAdapter(ChannelAdapter)`, `SMSInboundWebhookView`. |
| **SMS wired into the shared conversation view.** | Intake, task 2 | `MessageViewSet.perform_create` (unchanged code, already generic) dispatches to `SMSAdapter.send()` for every outbound `channel="sms"` `Message` — the *existing* reply form (COMM-0) is what triggers this; no new frontend code. |
| **Inbound `POST` is form-encoded, not JSON.** | Twilio's protocol | `SMSInboundWebhookView.parser_classes = [FormParser]`. |
| **Inbound `POST` is HMAC-signature-verified against the configured webhook URL.** | Twilio's protocol | `verify_signature` (`sms_adapter.py`) checks `X-Twilio-Signature` against `SMS_WEBHOOK_URL` + `SMS_AUTH_TOKEN` using `hmac.compare_digest`. |
| **Outbound send refuses to run against unconfigured settings, in every environment.** | This story's design, mirroring Story 15 | `SMSAdapter.send` raises `ValueError` if `SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` are not all set. |
| **Routing keys on `ContactDetail(channel="phone")`, never `Customer.phone`.** | This story's design, per Story 10's own unvalidated-`phone` decision | `SMSAdapter.receive`'s customer lookup. |
| Wire format is `snake_case` end to end. | § 12 | No new TS type — this story adds no frontend file. |
| Config from `ENV`; no new secret committed, no new dependency. | § 17 | All six new settings are `ENV`-driven; `urllib`/`base64`/`hmac`/`hashlib` are stdlib. |

---

## Backend Tasks

### 1 — The SMS adapter

**Create file: `backend/apps/communications/sms_adapter.py`**

```python
import base64
import hashlib
import hmac
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from apps.customers.models import ContactDetail, Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message


def verify_signature(auth_token: str, url: str, params: dict, signature_header: str) -> bool:
    """Twilio's request-signing algorithm: HMAC-SHA1 over the exact webhook
    URL, followed by every POST parameter's name and value concatenated (no
    separator) in sorted-by-name order, base64-encoded. `params` must
    contain every parameter Twilio sent — Twilio includes all of them
    (`AccountSid`, `To`, `ApiVersion`, ... — not just the fields this
    project reads) in its own computation, so a filtered subset would never
    match. Publicly documented at Twilio's "Validating requests" reference;
    NOT verified against a live Twilio account — see `## Prerequisites`.
    """
    data = url
    for key in sorted(params):
        data += key + params[key]
    expected = base64.b64encode(
        hmac.new(auth_token.encode(), data.encode(), hashlib.sha1).digest()
    ).decode()
    return hmac.compare_digest(expected, signature_header)


@register_adapter
class SMSAdapter(ChannelAdapter):
    """SMS channel — COMM-4, against Twilio's Programmable Messaging API.
    Routing mirrors WhatsApp (Story 15): no per-conversation address tag,
    so identity is matched via `ContactDetail(channel="phone")` (CUST-2) —
    the existing phone contact-detail channel, not a new SMS-specific one,
    since a phone number is the same identity for SMS as for a voice
    contact. See `## Prerequisites`.
    """

    channel = Message.Channel.SMS

    def receive(self, payload: dict) -> Message:
        from_number = payload["from"]
        body = payload["body"]
        message_sid = payload.get("message_sid", "")

        contact = (
            ContactDetail.objects.filter(channel=ContactDetail.Channel.PHONE, value=from_number)
            .select_related("customer")
            .first()
        )
        if contact is not None:
            customer = contact.customer
        else:
            customer = Customer.objects.create(name=from_number, phone=from_number)
            ContactDetail.objects.create(
                customer=customer, channel=ContactDetail.Channel.PHONE, value=from_number
            )

        # Continue the customer's most recent non-closed ticket, or start a
        # new one — same routing rule as WhatsApp (Story 15): SMS has no
        # per-conversation address tag the way email's "+ticket-id" does.
        ticket = (
            Ticket.objects.filter(customer=customer)
            .exclude(status=Ticket.Status.CLOSED)
            .order_by("-created_at")
            .first()
        )
        if ticket is None:
            ticket = Ticket.objects.create(
                subject=f"SMS from {from_number}",
                description=body,
                customer=customer,
            )

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.SMS,
            body=body,
            metadata={"from": from_number, "message_sid": message_sid},
        )

    def send(self, message: Message) -> None:
        if not (
            settings.SMS_API_BASE_URL
            and settings.SMS_ACCOUNT_SID
            and settings.SMS_AUTH_TOKEN
            and settings.SMS_FROM_NUMBER
        ):
            raise ValueError("SMS sending is not configured (SMS_* settings are blank).")

        contact = ContactDetail.objects.filter(
            customer=message.ticket.customer, channel=ContactDetail.Channel.PHONE
        ).first()
        if contact is None:
            raise ValueError(
                f"Cannot send SMS for ticket #{message.ticket_id}: "
                "its customer has no phone contact on file."
            )

        url = f"{settings.SMS_API_BASE_URL}/Accounts/{settings.SMS_ACCOUNT_SID}/Messages.json"
        body = urllib.parse.urlencode(
            {"To": contact.value, "From": settings.SMS_FROM_NUMBER, "Body": message.body}
        ).encode()
        credentials = base64.b64encode(
            f"{settings.SMS_ACCOUNT_SID}:{settings.SMS_AUTH_TOKEN}".encode()
        ).decode()
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError as exc:
            raise ValueError(f"SMS send failed for ticket #{message.ticket_id}: {exc}") from exc
```

**File: `backend/apps/communications/apps.py`** — register the fourth adapter:

```python
    def ready(self):
        from . import (  # noqa: F401 — imports run @register_adapter
            email_adapter,
            live_chat_adapter,
            sms_adapter,
            whatsapp_adapter,
        )
```

---

### 2 — The inbound webhook and routing

**File: `backend/apps/communications/views.py`** — extend imports and append the view:

```python
from rest_framework.parsers import FormParser

from .sms_adapter import SMSAdapter, verify_signature as verify_sms_signature
```

(`verify_signature` is aliased on import — `whatsapp_adapter` already exports a function with the same name, and both are imported into this one module.)

```python
class SMSInboundWebhookView(APIView):
    """Twilio's Programmable Messaging webhook — POST-only, form-encoded
    (unlike WhatsApp's JSON), no verification-handshake GET (unlike Meta's
    Callback URL setup). Signature-verified via `X-Twilio-Signature`
    (`sms_adapter.verify_signature`) against `SMS_WEBHOOK_URL` — the exact
    URL configured in the Twilio console, not reconstructed from the
    request, so a reverse proxy/tunnel rewriting `Host` does not silently
    break verification. See `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    parser_classes = [FormParser]

    def post(self, request):
        # Fail closed, same reasoning as EmailInboundWebhookView (Story 14).
        if not (settings.SMS_AUTH_TOKEN and settings.SMS_WEBHOOK_URL):
            raise PermissionDenied()
        signature = request.headers.get("X-Twilio-Signature", "")
        params = {key: request.data.get(key, "") for key in request.data}
        if not verify_sms_signature(settings.SMS_AUTH_TOKEN, settings.SMS_WEBHOOK_URL, params, signature):
            raise PermissionDenied()

        from_number = request.data.get("From", "")
        body = request.data.get("Body", "")
        if not from_number or not body:
            return Response(status=status.HTTP_200_OK)

        message = SMSAdapter().receive(
            {"from": from_number, "body": body, "message_sid": request.data.get("MessageSid", "")}
        )
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
```

**File: `backend/apps/communications/urls.py`** — add the fourth webhook path:

```python
from .views import (
    EmailInboundWebhookView,
    LiveChatStartView,
    MessageViewSet,
    SMSInboundWebhookView,
    WhatsAppInboundWebhookView,
)

urlpatterns = [
    path(
        "webhooks/email/inbound/", EmailInboundWebhookView.as_view(), name="email-inbound-webhook"
    ),
    path(
        "webhooks/whatsapp/inbound/",
        WhatsAppInboundWebhookView.as_view(),
        name="whatsapp-inbound-webhook",
    ),
    path("webhooks/sms/inbound/", SMSInboundWebhookView.as_view(), name="sms-inbound-webhook"),
    path("live-chat/start/", LiveChatStartView.as_view(), name="live-chat-start"),
    *router.urls,
]
```

Endpoint: `POST /api/webhooks/sms/inbound/`.

---

### 3 — Settings

**File: `backend/config/settings/base.py`** — append after the `# --- Live Chat / Channels (COMM-3) ---` block (ends line 345):

```python
# --- SMS (COMM-4) ------------------------------------------------------------
# Twilio's Programmable Messaging API. No safe default anywhere, same
# reasoning as WhatsApp (COMM-2) — every SMS_* setting stays blank until
# explicitly configured, in every environment. SMSAdapter.send refuses to
# run against blank config rather than firing a real request at Twilio's
# live API with empty credentials. See Story 17 `## Prerequisites`.
SMS_API_BASE_URL = env("SMS_API_BASE_URL", default="")
SMS_ACCOUNT_SID = env("SMS_ACCOUNT_SID", default="")
SMS_AUTH_TOKEN = env("SMS_AUTH_TOKEN", default="")
SMS_FROM_NUMBER = env("SMS_FROM_NUMBER", default="")
# The exact URL configured in the Twilio console for this webhook — used to
# verify X-Twilio-Signature. Not reconstructed from the request: Twilio's
# algorithm signs the URL it was told to POST to, and a proxy/tunnel
# rewriting Host would otherwise break every signature check silently.
SMS_WEBHOOK_URL = env("SMS_WEBHOOK_URL", default="")
```

**No `dev.py`/`prod.py` change** — unlike email, safety comes from requiring explicit configuration everywhere, not an environment-specific backend swap.

**No migration.** This story adds no model field (`Message.Channel.SMS` already existed since Story 13).

---

## Documentation Tasks

### 4 — Environment variables

**File: `backend/.env.example`** — append after the `# --- WhatsApp (COMM-2) ---` block (ends line 49):

```
# --- SMS (COMM-4) ---
SMS_API_BASE_URL=
SMS_ACCOUNT_SID=
SMS_AUTH_TOKEN=
SMS_FROM_NUMBER=
SMS_WEBHOOK_URL=
```

**File: `README.md`** — append five rows to the `### Backend` table (after the `WHATSAPP_*` rows, line 487), matching the five lines in task 3's settings block:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SMS_API_BASE_URL` | no | *(empty — sending refuses to run until set)* | Base URL of Twilio's REST API, e.g. `https://api.twilio.com/2010-04-01`. |
| `SMS_ACCOUNT_SID` | no | *(empty)* | Twilio Account SID, used both as the API path segment and the Basic Auth username. |
| `SMS_AUTH_TOKEN` | no | *(empty — inbound webhook rejects every request until set)* | Twilio Auth Token — the Basic Auth password for sending, and the HMAC key for verifying `X-Twilio-Signature` on inbound webhooks. |
| `SMS_FROM_NUMBER` | no | *(empty)* | The Twilio phone number outbound SMS is sent from. |
| `SMS_WEBHOOK_URL` | no | *(empty — inbound webhook rejects every request until set)* | The exact URL configured in the Twilio console for the inbound SMS webhook — used, not reconstructed, because Twilio's signature depends on it. |

### 5 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 16's paragraph, which currently ends the section):

> **A webhook signature scheme can depend on more than the raw request body — verify what it actually signs before choosing how to check it.** Meta's `X-Hub-Signature-256` (Story 15, `COMM-2`) is computed over raw request bytes alone; Twilio's `X-Twilio-Signature` (Story 17, `COMM-4`) is computed over the exact webhook URL plus every decoded POST parameter. When a provider's algorithm depends on the URL, pin it as an explicit setting (`SMS_WEBHOOK_URL`) rather than reconstructing it from the request — a reverse proxy or tunnel rewriting `Host` would otherwise break verification silently, not loudly. **A webhook's payload shape (JSON vs. form-encoded) determines its `parser_classes`, and this project's `DEFAULT_PARSER_CLASSES` is JSON-only** (`config/settings/base.py`) — a view receiving a form-encoded provider payload must declare `parser_classes = [FormParser]` itself, scoped to that one view, the same way `PlainTextRenderer` (Story 15) was scoped to one view's `GET` method rather than changing a global default.

No new import-boundary or invalidation pattern — this story adds no frontend file.

---

## Edge Cases & Failure Modes

- **The signature check fails closed with no auth token or webhook URL configured.** `SMS_AUTH_TOKEN`/`SMS_WEBHOOK_URL` default to `""`, and `SMSInboundWebhookView.post` rejects before comparing anything.
- **A request with a valid signature but no `From`/`Body` still returns `200`**, not an error — mirrors WhatsApp's "non-text event returns `200`" no-op, in case Twilio (or a misconfigured console) ever POSTs a shape this project does not expect; `receive()` is never reached for it.
- **A reply from an unknown phone number creates a new `Customer` (with `phone` set) and a matching `ContactDetail(channel="phone")` in the same transaction** — never a `Customer` with no way to be reached back.
- **A second inbound message from the same number, while their most recent ticket is still open, continues that ticket**; **if their most recent ticket is `closed`, a new ticket starts** — same routing rule Story 15 established for WhatsApp, for the same reason (no "new issue" signal exists on this channel either).
- **A customer who already has a `ContactDetail(channel="phone")` from a prior *voice* contact (not SMS) is matched automatically** — this is intended, not a bug: the identity being matched is "this phone number," not "this phone number, for SMS specifically." Verify this does not create a duplicate contact row for a number already on file (Story 11's own unique constraint on `(customer, channel, value)` prevents it at the database level regardless).
- **Sending to a customer with no `ContactDetail(channel="phone")` fails with a clear error, message still persists** — same "record now, deliver best-effort" pattern as COMM-1/COMM-2, caught and logged by the same unchanged `MessageViewSet.perform_create`.
- **Sending with any of `SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` blank never attempts a network call at all.**
- **The signature computation must include every POST parameter Twilio sent, not just `From`/`Body`/`MessageSid`.** `verify_signature`'s `params` argument is built by iterating `request.data`'s own keys (`sms_adapter.py`'s caller in `views.py`), not a hardcoded list — a hand-computed test signature in `## Verification Steps` that omits a parameter Twilio would have sent (e.g. `AccountSid`, `To`, `ApiVersion`) will not match, and that mismatch is the expected, correct behaviour, not a bug to work around.
- **A form-encoded request DRF cannot parse** (wrong `Content-Type`, or `parser_classes` misconfigured) surfaces as a `415 Unsupported Media Type` — an `EnvelopeJSONRenderer`-wrapped error response, not a silent 500, because the renderer is unaffected by the parser change.
- **Arabic SMS message bodies round-trip correctly** — `urllib.parse.urlencode`/`str.encode()` are UTF-8-safe by default; nothing in this story assumes ASCII (though real GSM-7/UCS-2 SMS encoding limits are a carrier-level concern outside this project's control, same boundary Story 14/15 drew for email/WhatsApp).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations communications --check --dry-run` — must report **no changes**.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: the signature check (fail-closed, mismatch, hand-computed-correct, using **every** parameter Twilio would send), first-contact routing, same-open-ticket continuation, closed-ticket-starts-new-ticket, outbound refusal when unconfigured, form-parser correctness — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` — confirms **zero** frontend files changed by this story still pass.

---

## Migration / Rollback

**No migration.** Pure code + settings change.

**Rollback of the code:** revert the commits. **No `pip install`/`npm install`** — `urllib`/`base64`/`hmac`/`hashlib` are stdlib.

**Half-applied states to avoid:**

- **Task 1's adapter without task 1's `apps.py` registration.** `get_adapter("sms")` silently returns `None` forever — outbound SMS messages are accepted and stored but never dispatched, no error anywhere.
- **Task 2's view without `parser_classes = [FormParser]`.** Every real Twilio webhook POST fails with `415` before any of this story's own logic runs — the most likely single mistake in this story, since every prior webhook view (Email, WhatsApp) relied on the global JSON parser and never needed this override.
- **`SMS_WEBHOOK_URL` left blank in a real deployment while `SMS_AUTH_TOKEN` is set.** The webhook fails closed correctly (both must be set), but a deployer might reasonably expect only the auth token to matter, the way `WHATSAPP_APP_SECRET` alone gates Meta's check — document this in `.env.example`'s inline comment (task 4) to avoid the confusion.
- **Task 4 (`.env.example`/README) skipped.** Breaks the "add a variable, document it in the same commit" rule silently, same risk Story 15 named.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration was needed:** `python manage.py makemigrations communications --check --dry-run` exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The signature check fails closed with no auth token/webhook URL configured.** `POST /api/webhooks/sms/inbound/` with any form body → `403`.
5. **Set `SMS_AUTH_TOKEN=test-auth-token` and `SMS_WEBHOOK_URL=http://localhost:8000/api/webhooks/sms/inbound/` in `backend/.env`, restart.** Compute the expected signature by hand for a body `{"From": "+15551234567", "Body": "Hello, I need help", "MessageSid": "SM123"}` (include exactly these three keys, sorted `Body`, `From`, `MessageSid`):

   ```powershell
   python -c "
import base64, hashlib, hmac
url = 'http://localhost:8000/api/webhooks/sms/inbound/'
params = {'From': '+15551234567', 'Body': 'Hello, I need help', 'MessageSid': 'SM123'}
data = url + ''.join(k + params[k] for k in sorted(params))
sig = base64.b64encode(hmac.new(b'test-auth-token', data.encode(), hashlib.sha1).digest()).decode()
print(sig)
"
   ```

   `POST .../inbound/` (`Content-Type: application/x-www-form-urlencoded`) with body `From=%2B15551234567&Body=Hello%2C+I+need+help&MessageSid=SM123` and header `X-Twilio-Signature: <that value>` → `201`; the same request with a **wrong** signature header → `403`.
6. **First-contact SMS creates a `Customer` (with `phone` set), a `ContactDetail(channel="phone")`, and a new `Ticket`.** Using step 5's request (fresh `From` number not seen before) → `201`; confirm via the API a `Customer` with `phone: "+15551234567"` exists and has a `ContactDetail` with `channel: "phone"`, `value: "+15551234567"`; the returned `Message.ticket` points at a new `Ticket` with subject `"SMS from +15551234567"`.
7. **A second message from the same number continues the same ticket** (it is still `open`). Repeat step 5/6 with a different `MessageSid`/`Body`, same `From`, correctly re-signed → `201`; `GET /api/messages/?ticket=<the same ticket id>` now shows two messages.
8. **A message from the same number after the ticket is closed starts a new ticket.** `PATCH` the ticket's `status` to `"closed"`; repeat with a correctly-signed request from the same `From` → `201`; confirm the returned `Message.ticket` is a **different** ticket id than steps 6-7's.
9. **A form-encoded request is actually being parsed as form data, not rejected.** Confirm step 5's request would return `415` if sent as `Content-Type: application/json` instead (sanity-check that `parser_classes = [FormParser]` is doing real work, not silently no-op).
10. **Outbound send refuses to run when unconfigured** (the shipped default — `SMS_*` sending settings unset in `.env.example`): `POST /api/messages/` with `{"ticket": <id>, "direction": "outbound", "channel": "sms", "body": "..."}` for a ticket whose customer **has** a phone `ContactDetail` → still `201` (message persists); server log shows a logged `ValueError` mentioning `"SMS sending is not configured"`.
11. **Sending to a customer with no phone contact fails the same way**, with the other `ValueError` message ("no phone contact on file") — confirm both failure messages are distinguishable in the log.
12. **No frontend file changed.** `git status --porcelain -- frontend/` shows nothing.
13. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0, unaffected by this story.

---

## Done Criteria

- [ ] `SMSAdapter(ChannelAdapter)` in `apps/communications/sms_adapter.py`, decorated `@register_adapter`, `channel = Message.Channel.SMS`.
- [ ] `verify_signature` module-level helper implementing Twilio's documented URL+params HMAC-SHA1 algorithm, explicitly caveated as unverified against a live account.
- [ ] `CommunicationsConfig.ready()` imports `email_adapter`, `live_chat_adapter`, `sms_adapter`, `whatsapp_adapter`.
- [ ] `receive()` routes via `ContactDetail(channel="phone")`, never `Customer.phone`; continues the customer's most recent non-closed ticket or creates a new one.
- [ ] `send()` refuses to run when any of `SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` are blank; raises a clear error when the customer has no phone `ContactDetail`; otherwise posts to Twilio's documented Messages resource via `urllib.request` with Basic Auth — **no new dependency**.
- [ ] `SMSInboundWebhookView` declares `parser_classes = [FormParser]`; verifies `X-Twilio-Signature` against `SMS_WEBHOOK_URL` + `SMS_AUTH_TOKEN`, fails closed when either is unset; returns `200` (no-op) when `From`/`Body` are missing, before calling `receive()`.
- [ ] Registered at `POST /api/webhooks/sms/inbound/`.
- [ ] Five `SMS_*` settings added to `base.py` — **no `dev.py`/`prod.py` change**, **no migration**.
- [ ] `.env.example` and `README.md`'s environment-variable table both gain all five new variables, in the same change.
- [ ] `CONVENTIONS.md` § 23 gains the signature-scope/form-parser paragraph.
- [ ] **Zero frontend files changed.**
- [ ] `python manage.py test` reports **54** passing; `makemigrations communications --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the signature check including a hand-computed correct signature over every sent parameter (Step 5); first-contact routing creating `Customer`+`ContactDetail`+`Ticket` (Step 6); same-open-ticket continuation (Step 7); closed-ticket-starts-new-ticket (Step 8); form-parser sanity check (Step 9); outbound refusal when unconfigured and when the customer lacks a phone contact, both distinguishable in the log (Steps 10-11).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0, unaffected by this story.
- [ ] `.squad/plans/communication-channels/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** This is the last story in `communication-channels` that depends only on `COMM-0`. The remaining epic-5 story, **COMM-5 (Web Forms)**, additionally needs `TKT-2` (Categories & Priorities, not yet planned) per the overview's dependency notes.
