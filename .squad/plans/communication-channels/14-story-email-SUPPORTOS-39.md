# Story 14 — Email (Story: SUPPORTOS-39)

## Prerequisites

- **Story 13 (COMM-0) completed**: `Message` model, `ChannelAdapter` (ABC, `receive`/`send`, zero subclasses/callers), `MessageViewSet` (reuses `tickets.*` permissions), `TicketConversation.tsx` (the channel-agnostic reply form, already offering `email` as one of five `MESSAGE_CHANNELS` choices). This story provides the **first concrete `ChannelAdapter` subclass** COMM-0 deferred, and the first real dispatch mechanism.
- **Verified: no live email provider exists or is configured anywhere in this project.** `grep -i email` across `backend/config/settings/` returned nothing before this story — no `EMAIL_*` Django setting, no provider SDK in `requirements.txt`. This story is the first to touch email configuration.
- **Provider config stays `ENV` for this story — a DB-backed config UI is explicitly a later story.** `SupportOs backlog.MD:661-665`, `STORY (INT-3) — Messaging Providers Config`, depends on `COMM-1/2/4` and owns "secure central config for email/SMS/WhatsApp credentials reused by channel adapters." The intake's own task says "provider config via `ENV`" — this story does **not** pre-empt INT-3 by building any settings model or admin UI for email credentials.
- **The channel-adapter registry this story adds is exactly what COMM-0's `ChannelAdapter` docstring named as deferred work**: *"`channel` -> adapter-class dispatch is deferred to whichever story adds the first concrete subclass (COMM-1)."* `register_adapter`/`get_adapter` (task 1) are the minimal registry — a decorator plus a dict lookup, wired through `CommunicationsConfig.ready()` so registration happens once per process, not per-request. No premature generality beyond what dispatching by `Message.channel` string requires.
- **Inbound routing uses a "+ticket-id" address tag, not real MIME threading.** A production email integration would typically thread replies via `In-Reply-To`/`References` headers against a stored `Message-ID`. This story deliberately does **not** implement that — there is no live provider to generate or verify those headers against, and per-ticket "+" addressing (`support+42@domain`) is a well-established, simpler pattern (Zendesk, Help Scout, and most support tools use exactly this) that this story *can* fully verify with a hand-built payload. `Message.metadata` (COMM-0) still records whatever raw header data a payload provides (`from`, `to`, `message_id`), leaving room for a future story to add real threading without a schema change.
- **The inbound webhook is provider-agnostic by necessity.** No real provider (SendGrid Inbound Parse, Mailgun Routes, Postmark) is integrated — there is no domain, DNS, or provider account for this project to receive real mail. `EmailInboundWebhookView` (task 2) accepts a **generic JSON shape** (`from`, `to`, `subject`, `body`, `message_id`) this story defines and fully tests with `curl`. Wiring a real provider's webhook to translate its own payload into this shape is out of scope here and not named in this story's tasks.
- **Verified Django behavior this story relies on, not re-derived from scratch:** `django.core.mail.backends.smtp.EmailBackend` reads exactly the settings `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS`/`DEFAULT_FROM_EMAIL` with no custom code required (documented, standard Django); `django.core.mail.backends.console.EmailBackend` needs **none** of those to function — it writes to `sys.stdout`, which is exactly how this story's `## Verification Steps` confirms outbound send actually fires, without any real SMTP credentials.

---

## Story Goal

1. `EmailAdapter(ChannelAdapter)` — `receive(payload)` turns a provider-agnostic inbound JSON payload into a `Message`, finding the right `Ticket` via a `+<ticket id>` address tag or creating a new `Customer`+`Ticket` on first contact; `send(message)` delivers an outbound `Message` via Django's mail backend.
2. A minimal channel registry (`register_adapter`/`get_adapter`) and `MessageViewSet.perform_create` dispatch: every outbound `Message` with `channel="email"` triggers `EmailAdapter.send()` automatically.
3. `EmailInboundWebhookView` — a token-authenticated `APIView` a (future, or hand-tested) provider posts inbound email payloads to.
4. Provider config entirely via `ENV` — no new model, no new admin, no new permission.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `EmailAdapter.receive`/`send` | The intake's literal ask — "inbound parse + outbound send." |
| A channel registry (`register_adapter`/`get_adapter`) | COMM-0 named this as COMM-1's job. Minimal: a decorator, a dict, one lookup function. |
| `EmailInboundWebhookView`, token-protected | Something has to receive inbound email; no live provider exists to call it automatically, so this story makes it callable and testable on its own. |
| "+ticket-id" address tagging | The simplest correct routing scheme this story can build and verify without a live provider or real MIME parsing. |
| `EMAIL_*` settings in `base.py`/`dev.py`/`prod.py` | "provider config via ENV," per the intake. |

**Not here, and why:**

- **No provider-config model or admin UI.** `INT-3` (`SupportOs backlog.MD:661-665`), which explicitly depends on `COMM-1`.
- **No real MIME parsing, no `In-Reply-To`/`References` threading.** No live provider to generate or verify real headers against — see `## Prerequisites`.
- **No delivery-status field on `Message`.** COMM-0 already named this as deferred, channel-specific, future scope; this story does not add it either — a failed send is logged server-side, not surfaced as UI-visible state (see `## Edge Cases`).
- **No frontend UI changes.** COMM-0's `TicketConversation.tsx` already offers `email` as a channel choice in the reply form — that UI is channel-agnostic *by design*, and this story's job is making the *backend* behind that existing choice real. See `## Story Goal` and the file list below — no `frontend/` file is touched.
- **No queue, no retry, no async delivery.** `send()` is called synchronously inside the request that creates the `Message`; a slow or failing SMTP call blocks that request. Acceptable for this story's scope — a future story reaching for SLA-0's async infrastructure (named elsewhere in the backlog) would be the fix if this becomes a real problem.

---

## Context — Read These Files First

1. `.squad/stories/communication-channels/SUPPORTOS-39/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` **lines 367-372** (`COMM-1`) and **lines 661-665** (`INT-3`, the provider-config-UI story this one must not pre-empt).
3. `backend/apps/communications/models.py` (55 lines) — `Message`, in particular `metadata` (schemaless, read-only via the API) and `Channel.EMAIL`.
4. `backend/apps/communications/adapters.py` (36 lines) — `ChannelAdapter` (ABC). Task 1 adds the registry to this **same file**; task 2 adds `EmailAdapter` to a **new** file, `email_adapter.py`.
5. `backend/apps/communications/views.py` (41 lines) — `MessageViewSet`, in particular `get_queryset`'s required-filter-param shape (unchanged by this story) and the absence of a `perform_create` override (task 3 adds one).
6. `backend/apps/communications/urls.py` (15 lines) — the `SimpleRouter` registering `"messages"`. Task 3 adds a plain `path()` for the webhook, **not** through the router (it is not a `ModelViewSet` resource).
7. `backend/apps/core/views.py` lines 34-57 (`HealthView`) — the exact `authentication_classes: list = []` / `permission_classes = [AllowAny]` shape task 3's `EmailInboundWebhookView` copies, since it is the project's only other explicitly-open, non-JWT `APIView`.
8. `backend/apps/core/exceptions.py` — confirms `rest_framework.exceptions.ValidationError`/`PermissionDenied` are already translated correctly (no new branch needed); this story raises both from a plain view for the first time outside `HasPermission`/DRF's own internals.
9. `backend/apps/customers/models.py` — `Customer.email` (`unique=True, null=True, blank=True`). Task 2's `EmailAdapter.receive` calls `Customer.objects.get_or_create(email=...)` against a **guaranteed non-blank** sender address (validated at the webhook view before `receive()` is ever called) — the blank-collides-with-blank trap Story 10 found does not apply here for that reason; state it explicitly rather than assume.
10. `backend/apps/tickets/models.py` (55 lines) — `Ticket.subject`/`description` (`description` is required, no `blank=True`) and `Ticket.customer` (`on_delete=PROTECT`). Task 2's new-ticket-on-first-contact path must supply both.
11. `backend/config/settings/base.py` — the `env`/`env.int`/`env.bool`/`env.list` helpers and the section-comment style (`# --- CORS ---`, `# --- DRF ---`) task 4 follows for `# --- Email (COMM-1) ---`. Note `JWT_SIGNING_KEY`'s `default=""` + fallback pattern (line 165) — the same "no crash at import, fail safe at the point of use" shape task 4's `EMAIL_INBOUND_WEBHOOK_TOKEN` follows.
12. `backend/config/settings/dev.py` (8 lines) and `prod.py` (17 lines) — task 4 adds `EMAIL_BACKEND` to **each**, hardcoded (not `env`-driven), so local development can never accidentally attempt a real send.
13. `README.md` **lines 443-474** (`## Environment variables` → `### Backend`) — the exact table format task 5 appends nine rows to, in the same commit as `.env.example` (§9's rule).
14. `backend/.env.example` — task 5 appends an `# --- Email (COMM-1) ---` block, following the existing section-comment convention.
15. `CONVENTIONS.md` § 13 (the "a plain `APIView` that must be protected sets `permission_classes` explicitly" rule — here inverted: a plain `APIView` that must be **open at the DRF layer with its own custom guard** still states `permission_classes = [AllowAny]` explicitly, matching `HealthView`), § 22 (permission_map convention, unchanged by this story), § 23 (feature module conventions — this story's own addition in task 6 follows the same shape as Story 11/12/13's).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Email adapter against the shared interface.** | Intake, task 1 | `EmailAdapter(ChannelAdapter)`, `channel = Message.Channel.EMAIL`. |
| **Provider config via `ENV`.** | Intake, task 1 | `EMAIL_HOST`/`PORT`/`USER`/`PASSWORD`/`USE_TLS`/`DEFAULT_FROM_EMAIL`/`EMAIL_INBOUND_LOCAL_PART`/`EMAIL_INBOUND_DOMAIN`/`EMAIL_INBOUND_WEBHOOK_TOKEN` — no model, no admin. |
| **Email wired into the shared conversation view.** | Intake, task 2 | `MessageViewSet.perform_create` dispatches to `EmailAdapter.send()` for every outbound `channel="email"` `Message` — the *existing* reply form (COMM-0) is what triggers this; no new frontend code. |
| **A send failure does not fail the API request.** | This story's design | `perform_create` catches any exception from `adapter.send()`, logs it, and still returns the created `Message` — the agent's reply is recorded regardless of delivery outcome. |
| **The inbound webhook fails closed.** | This story's design | `EMAIL_INBOUND_WEBHOOK_TOKEN` defaults to `""`; `EmailInboundWebhookView` rejects every request when it is unset, before even inspecting the caller's token. |
| Wire format is `snake_case` end to end. | § 12 | No new TS type — this story adds no frontend file. |
| Config from `ENV`; no new secret committed. | § 17 | All nine new settings are `ENV`-driven; `.env.example` ships them blank/placeholder. |

---

## Backend Tasks

### 1 — The channel-adapter registry

**File: `backend/apps/communications/adapters.py`** — append below `ChannelAdapter`:

```python
CHANNEL_ADAPTERS: dict[str, type[ChannelAdapter]] = {}


def register_adapter(adapter_cls: type[ChannelAdapter]) -> type[ChannelAdapter]:
    """Class decorator: `@register_adapter` on a `ChannelAdapter` subclass
    makes `get_adapter(channel)` find it. The subclass module must actually
    be imported for this to run — `CommunicationsConfig.ready()` (task 2)
    is where that happens, once per process, not per request.
    """
    CHANNEL_ADAPTERS[adapter_cls.channel] = adapter_cls
    return adapter_cls


def get_adapter(channel: str) -> ChannelAdapter | None:
    adapter_cls = CHANNEL_ADAPTERS.get(channel)
    return adapter_cls() if adapter_cls else None
```

Also update `ChannelAdapter`'s docstring — replace the paragraph starting *"No adapter is registered yet..."* with:

```python
    """... (the receive/send paragraphs above are unchanged)

    `register_adapter`/`get_adapter` below are the minimal channel ->
    adapter-class registry COMM-0 deferred. `apps/communications/email_adapter.py`
    (Story 14, COMM-1) is the first entry.
    """
```

---

### 2 — The email adapter

**Create file: `backend/apps/communications/email_adapter.py`**

```python
import re

from django.conf import settings
from django.core.mail import EmailMessage

from apps.customers.models import Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message

# A plain email address only — this story's inbound payload is a
# provider-agnostic shape this project defines (no real MIME "To" header
# with display names/multiple recipients to parse). See Story 14
# `## Prerequisites`.
TICKET_TAG_RE = re.compile(r"\+(?P<ticket_id>\d+)@")


@register_adapter
class EmailAdapter(ChannelAdapter):
    """Email channel — COMM-1.

    Inbound: `EmailInboundWebhookView` (views.py) calls `receive()` with a
    provider-agnostic JSON payload — no live email provider is integrated,
    see Story 14 `## Prerequisites`.

    Outbound: `MessageViewSet.perform_create` calls `send()` automatically
    for every outbound `channel="email"` Message — see Story 14
    `## Product rules`.
    """

    channel = Message.Channel.EMAIL

    def receive(self, payload: dict) -> Message:
        to_address = payload.get("to", "")
        from_address = payload["from"]
        body = payload.get("body", "")

        ticket = None
        match = TICKET_TAG_RE.search(to_address)
        if match:
            ticket = Ticket.objects.filter(pk=int(match.group("ticket_id"))).first()

        # No tag, or the tagged ticket no longer exists: treat this as first
        # contact rather than dropping the email. Never lose an inbound
        # message over a stale or absent routing tag.
        if ticket is None:
            customer, _created = Customer.objects.get_or_create(
                email=from_address, defaults={"name": from_address}
            )
            ticket = Ticket.objects.create(
                subject=payload.get("subject") or "(no subject)",
                description=body,
                customer=customer,
            )

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body=body,
            metadata={
                "from": from_address,
                "to": to_address,
                "message_id": payload.get("message_id", ""),
            },
        )

    def send(self, message: Message) -> None:
        customer = message.ticket.customer
        if not customer.email:
            raise ValueError(
                f"Cannot send email for ticket #{message.ticket_id}: "
                "its customer has no email address."
            )
        reply_to = (
            f"{settings.EMAIL_INBOUND_LOCAL_PART}+{message.ticket_id}"
            f"@{settings.EMAIL_INBOUND_DOMAIN}"
        )
        email = EmailMessage(
            subject=message.ticket.subject,
            body=message.body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[customer.email],
            reply_to=[reply_to],
        )
        email.send()
```

**Attaching by address tag regardless of exact sender match is deliberate** — a CC'd colleague replying to the same thread should land on the same ticket. See `## Edge Cases`.

**File: `backend/apps/communications/apps.py`** — register the adapter at process start:

```python
from django.apps import AppConfig


class CommunicationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.communications"

    def ready(self):
        from . import email_adapter  # noqa: F401 — import runs @register_adapter
```

---

### 3 — Outbound dispatch and the inbound webhook

**File: `backend/apps/communications/views.py`** — add imports and a `perform_create` override to `MessageViewSet`, plus the new webhook view:

```python
import logging

from django.conf import settings
from django.utils.crypto import constant_time_compare
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .adapters import get_adapter
from .email_adapter import EmailAdapter
from .models import Message
from .serializers import MessageSerializer

logger = logging.getLogger(__name__)
```

Add to `MessageViewSet`:

```python
    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.direction != Message.Direction.OUTBOUND:
            return
        adapter = get_adapter(instance.channel)
        if adapter is None:
            return
        try:
            adapter.send(instance)
        except Exception:
            # The Message row is already committed — the agent's reply is
            # recorded regardless of delivery outcome. See Story 14
            # `## Product rules`.
            logger.exception(
                "Failed to send outbound message %s via channel %s",
                instance.pk,
                instance.channel,
            )
```

Append the new view:

```python
class EmailInboundWebhookView(APIView):
    """Receives inbound email as a provider-agnostic JSON payload
    (`from`, `to`, `subject`, `body`, `message_id`) and turns it into a
    Message via `EmailAdapter.receive()`. No live email provider is
    integrated — see Story 14 `## Prerequisites`. A real provider's webhook
    would translate its own payload shape into this one and POST here.

    Token-authenticated, not JWT — the caller is an external system, not a
    signed-in user. `authentication_classes = []` / `permission_classes =
    [AllowAny]`, the same explicit-open shape as `HealthView`
    (`apps/core/views.py`) — CONVENTIONS.md §13.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        # Fail closed: an unconfigured token must reject every request, not
        # crash the app at import time over an optional feature that may not
        # be set up yet. See Story 14 `## Prerequisites`.
        if not settings.EMAIL_INBOUND_WEBHOOK_TOKEN:
            raise PermissionDenied()
        token = request.query_params.get("token", "")
        if not constant_time_compare(token, settings.EMAIL_INBOUND_WEBHOOK_TOKEN):
            raise PermissionDenied()

        payload = request.data
        missing = [key for key in ("from", "to", "body") if not payload.get(key)]
        if missing:
            raise ValidationError({key: [_("This field is required.")] for key in missing})

        message = EmailAdapter().receive(payload)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
```

**File: `backend/apps/communications/urls.py`** — add the webhook path alongside the router:

```python
from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import EmailInboundWebhookView, MessageViewSet

app_name = "communications"

router = SimpleRouter()
router.register("messages", MessageViewSet, basename="message")

urlpatterns = [
    path("webhooks/email/inbound/", EmailInboundWebhookView.as_view(), name="email-inbound-webhook"),
    *router.urls,
]
```

Endpoint: `POST /api/webhooks/email/inbound/?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>`. No change to `config/api_urls.py` — the existing `path("", include("apps.communications.urls"))` already covers it.

---

### 4 — Settings

**File: `backend/config/settings/base.py`** — append after the `# --- Logging ---` block:

```python
# --- Email (COMM-1) -------------------------------------------------------
# Outbound uses Django's own SMTP backend. EMAIL_BACKEND itself is NOT read
# from ENV — dev.py hardcodes the console backend so local development can
# never accidentally send a real email; prod.py hardcodes SMTP. Provider
# config stays ENV-only for this story; INT-3 (SupportOs backlog.MD:661-665)
# is where a DB-backed config UI eventually lands.
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="support@example.com")

# Inbound routing: a reply lands on `{EMAIL_INBOUND_LOCAL_PART}+<ticket
# id>@{EMAIL_INBOUND_DOMAIN}`. See apps/communications/email_adapter.py.
EMAIL_INBOUND_LOCAL_PART = env("EMAIL_INBOUND_LOCAL_PART", default="support")
EMAIL_INBOUND_DOMAIN = env("EMAIL_INBOUND_DOMAIN", default="support.example.com")
# No safe default: an empty token makes EmailInboundWebhookView reject every
# request (fail closed), rather than crash the app at import time over an
# optional feature that may not be configured yet.
EMAIL_INBOUND_WEBHOOK_TOKEN = env("EMAIL_INBOUND_WEBHOOK_TOKEN", default="")
```

**File: `backend/config/settings/dev.py`** — append:

```python
# Console backend: every outbound email prints to the dev server's stdout
# instead of attempting a real send. Hardcoded, not ENV-driven, so local
# development can never accidentally deliver a real email.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
```

**File: `backend/config/settings/prod.py`** — append:

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
```

**No migration.** This story adds no model field.

---

## Documentation Tasks

### 5 — Environment variables

**File: `backend/.env.example`** — append:

```
# --- Email (COMM-1) ---
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=support@example.com
EMAIL_INBOUND_LOCAL_PART=support
EMAIL_INBOUND_DOMAIN=support.example.com
EMAIL_INBOUND_WEBHOOK_TOKEN=
```

**File: `README.md`** — append nine rows to the `### Backend` table (after `DJANGO_SECURE_HSTS_SECONDS`, line 473):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `EMAIL_HOST` | no | *(empty)* | SMTP host. Ignored in dev (console backend); needed in prod for real delivery. |
| `EMAIL_PORT` | no | `587` | SMTP port. |
| `EMAIL_HOST_USER` | no | *(empty)* | SMTP auth username. |
| `EMAIL_HOST_PASSWORD` | no | *(empty)* | SMTP auth password. |
| `EMAIL_USE_TLS` | no | `True` | Use STARTTLS for SMTP. |
| `DEFAULT_FROM_EMAIL` | no | `support@example.com` | `From` address for outbound email. |
| `EMAIL_INBOUND_LOCAL_PART` | no | `support` | Local-part of the inbound routing address, before the `+<ticket id>` tag. |
| `EMAIL_INBOUND_DOMAIN` | no | `support.example.com` | Domain of the inbound routing address a reply-to uses. |
| `EMAIL_INBOUND_WEBHOOK_TOKEN` | no | *(empty — endpoint rejects every request until set)* | Shared secret `EmailInboundWebhookView` requires as `?token=`. |

### 6 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 13's paragraph):

> **A channel/provider dispatch table is a decorator plus a dict, wired through `AppConfig.ready()` — not more.** `apps/communications/adapters.py::register_adapter`/`get_adapter` (Story 14, `COMM-1`) is the worked example: a concrete `ChannelAdapter` subclass registers itself with `@register_adapter` at import time, and `CommunicationsConfig.ready()` is what guarantees that import actually happens once per process. **A dispatched side effect (an outbound send) must not fail the request that triggered it** — `MessageViewSet.perform_create` catches and logs any `adapter.send()` failure; the record it was attached to is already committed. The next channel story (COMM-2, WhatsApp) copies both shapes.

No new import-boundary or invalidation pattern — this story adds no frontend file.

---

## Edge Cases & Failure Modes

- **An outbound email to a customer with no email address fails, but the reply is still recorded.** `EmailAdapter.send` raises `ValueError`; `perform_create` catches, logs (`logger.exception`), and still returns `201` with the `Message` row. From the UI's perspective the reply "sent" successfully (COMM-0's existing toast fires) — only the server log shows the real outcome. No delivery-status field surfaces this to the UI in this story; see `## Story Goal`'s out-of-scope list.
- **`EMAIL_INBOUND_WEBHOOK_TOKEN` unset (the shipped default) makes the webhook reject every request, correct/incorrect token alike.** Verified explicitly, not assumed — `## Verification Steps` checks this before checking the token-mismatch case, so the two failure modes are not confused with each other.
- **An inbound email whose `to` address carries no `+<ticket id>` tag, or tags a ticket that no longer exists, is never dropped** — it becomes a new `Customer` (found-or-created by the sender's address) and a new `Ticket`, exactly like a first-contact email to a general inbox address.
- **A reply from someone other than the ticket's own customer still attaches to that ticket**, as long as it carries the right address tag — a CC'd participant replying to the thread is the intended case this permits, not a bug.
- **The inbound payload's `to` field is a single plain address, not a real `To:` header.** A display name (`"Name" <addr>`) or multiple comma-separated recipients would not match `TICKET_TAG_RE` correctly — acceptable, since this story defines its own provider-agnostic payload shape rather than parsing real MIME; a future real-provider integration is what would need to normalise its own header format into this shape first.
- **`send()` runs synchronously inside the `POST /api/messages/` request.** A slow SMTP connection (or the console backend, which is instant) makes that request slower proportionally; there is no queue or retry. Acceptable for this story's scope — see `## Story Goal`.
- **`get_adapter` returns `None` for every channel except `email` in this story** (`whatsapp`/`chat`/`sms`/`web_form` have no registered adapter yet) — `perform_create` treats a missing adapter as a no-op, exactly matching COMM-0's existing behaviour (a `Message` row is created; nothing attempts delivery) for every channel this story does not touch.
- **Arabic email bodies round-trip correctly.** No encoding assumption in `EmailAdapter` — `EmailMessage`'s `body`/`subject` are plain Python `str`, and Django's SMTP backend handles UTF-8 correctly by default; nothing in this story needs § 18's bidi/formatting rules since no new UI renders.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations communications --check --dry-run` — must report **no changes**; this story adds no model field.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: the webhook's fail-closed default, the token-mismatch case, first-contact ticket creation, tagged-ticket attachment, outbound dispatch (console backend), and the no-email-customer failure path — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` — confirms **zero** frontend files changed by this story still pass, since none should be touched.

---

## Migration / Rollback

**No migration.** This story is a pure code + settings change — no model field, no new table.

**Rollback of the code:** revert the commits. **No `npm install`, no `pip install`** — everything used (`django.core.mail`, `django.utils.crypto`) is Django core.

**Half-applied states to avoid:**

- **Task 1's registry without task 2's `@register_adapter` import wired through `CommunicationsConfig.ready()`.** `get_adapter("email")` silently returns `None` forever — outbound email is accepted and stored but never dispatched, with no error anywhere. `## Verification Steps` checks the console-backend output specifically to catch this.
- **Task 3's `perform_create` without task 4's `EMAIL_BACKEND` setting in `dev.py`.** With no `EMAIL_BACKEND` set, Django defaults to the SMTP backend, which then tries a real connection using blank `EMAIL_HOST`/credentials — a real (loud) connection error, not a silent failure, but still worth shipping together so local dev testing works out of the box.
- **Task 5 (`.env.example`/README) skipped.** §9's rule broken silently — the next developer has no way to discover `EMAIL_INBOUND_WEBHOOK_TOKEN` exists without reading the source.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration was needed:** `python manage.py makemigrations communications --check --dry-run` exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The webhook fails closed with no token configured.** With `EMAIL_INBOUND_WEBHOOK_TOKEN` unset (the shipped `.env.example` default), `POST /api/webhooks/email/inbound/` (any body, any `?token=`) → `403 permission_denied`.
5. **Set `EMAIL_INBOUND_WEBHOOK_TOKEN=test-secret` in `backend/.env`, restart the server.** `POST /api/webhooks/email/inbound/?token=wrong` → `403`. `POST /api/webhooks/email/inbound/?token=test-secret` with `{}` → `validation_error`, `fields` names all three of `from`/`to`/`body`.
6. **First-contact inbound email creates a customer and a ticket.** `POST .../inbound/?token=test-secret` with `{"from": "new-customer@example.com", "to": "support@support.example.com", "subject": "Help", "body": "I need help", "message_id": "<abc@x>"}` → `201`; confirm via `GET /api/customers/?search=new-customer@example.com` a `Customer` now exists, and the returned `Message`'s `ticket` points at a new `Ticket` whose `subject` is `"Help"`.
7. **A tagged reply attaches to the existing ticket, not a new one.** Using the ticket id from Step 6, `POST .../inbound/?token=test-secret` with `{"from": "new-customer@example.com", "to": "support+<that-ticket-id>@support.example.com", "body": "Following up"}` → `201`; `GET /api/messages/?ticket=<that-ticket-id>` now shows **two** messages, chronological.
8. **An untagged or stale-tagged address still creates a new ticket, never drops the email.** Repeat Step 6's payload with `"to": "support+999999@support.example.com"` (a ticket id that does not exist) → `201`, and a **new** ticket is created (confirm its id differs from Step 6's).
9. **Outbound dispatch actually fires**, verified against the running dev server's own console (the `EMAIL_BACKEND` console backend from task 4): `POST /api/tickets/` + `POST /api/messages/` with `{"ticket": <id>, "direction": "outbound", "channel": "email", "body": "Reply text"}` for a ticket whose customer **has** an email → `201`; check the terminal running `python manage.py runserver` for a printed `Content-Type: text/plain` email block containing `Reply text` and a `Reply-To: support+<id>@support.example.com` header.
10. **A customer with no email fails to send but the message still persists.** Create a ticket for a customer with `email: null`; `POST /api/messages/` the same outbound payload → still `201`; the server log shows a logged `ValueError` (`grep` the terminal output or the log file for `"Cannot send email for ticket"`); `GET /api/messages/?ticket=<id>` shows the message exists regardless.
11. **No frontend file changed.** `git status --porcelain -- frontend/` (or the plan's own file list) shows nothing under `frontend/` — confirms `## Story Goal`'s "no new frontend file" claim is actually true, not just asserted.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0 (unaffected by this story, verified rather than assumed).

---

## Done Criteria

- [ ] `register_adapter`/`get_adapter`/`CHANNEL_ADAPTERS` added to `apps/communications/adapters.py`; `ChannelAdapter`'s docstring updated to reference them.
- [ ] `EmailAdapter(ChannelAdapter)` in `apps/communications/email_adapter.py`, decorated `@register_adapter`, `channel = Message.Channel.EMAIL`.
- [ ] `CommunicationsConfig.ready()` imports `email_adapter` so registration actually runs.
- [ ] `EmailAdapter.receive` routes via a `+<ticket id>` address tag when present and resolvable; otherwise finds-or-creates a `Customer` by sender address and creates a new `Ticket` — **never drops an inbound email**.
- [ ] `EmailAdapter.send` raises a clear error when the ticket's customer has no email; otherwise sends via `django.core.mail.EmailMessage` with a `Reply-To` built from `EMAIL_INBOUND_LOCAL_PART`/`EMAIL_INBOUND_DOMAIN`.
- [ ] `MessageViewSet.perform_create` dispatches every outbound message to `get_adapter(channel)` if one is registered, catching and logging any send failure **without failing the API request**.
- [ ] `EmailInboundWebhookView` — token-protected (`EMAIL_INBOUND_WEBHOOK_TOKEN`, fails closed when unset), validates `from`/`to`/`body` present, registered at `POST /api/webhooks/email/inbound/`.
- [ ] `EMAIL_*` settings added to `base.py` (all nine), `EMAIL_BACKEND` hardcoded in `dev.py` (console) and `prod.py` (SMTP) — **no migration**.
- [ ] `.env.example` and `README.md`'s environment-variable table both gain all nine new variables, in the same change.
- [ ] `CONVENTIONS.md` § 23 gains the channel-dispatch-pattern paragraph.
- [ ] **Zero frontend files changed** — `TicketConversation.tsx`'s existing `email` channel option is what exercises this story's backend, with no new UI code.
- [ ] `python manage.py test` reports **54** passing; `makemigrations communications --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the webhook fails closed with no token (Step 4); token mismatch and missing-field validation (Step 5); first-contact ticket creation (Step 6); tagged-ticket attachment (Step 7); stale-tag fallback to a new ticket (Step 8); outbound dispatch actually printing to the console backend (Step 9); the no-email-customer failure path still persisting the message (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0, unaffected by this story.
- [ ] `.squad/plans/communication-channels/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The next ready stories in communication-channels are **COMM-2 (WhatsApp)**, **COMM-3 (Live Chat)**, and **COMM-4 (SMS)** — each depends only on `COMM-0` (already complete) and can copy this story's registry/dispatch pattern; **COMM-5 (Web Forms)** additionally needs `TKT-2` (not yet planned). Separately, **`INT-3` (Messaging Providers Config)** — the DB-backed credentials UI this story deliberately deferred — now has a real `COMM-1` to depend on.
