# Story 19 — Web Forms (Story: SUPPORTOS-43)

## Prerequisites

- **Story 13 (COMM-0) and Story 18 (TKT-2) completed** — the intake names both explicitly (`Dependencies: COMM-0, TKT-2`). `ChannelAdapter`, `register_adapter`/`get_adapter` (`apps/communications/adapters.py`), `CommunicationsConfig.ready()`, `MessageViewSet.perform_create`'s fail-open dispatch (`apps/communications/views.py`, 222 lines, after Story 17), and `Category` (`apps/tickets/models.py:8-23`, `CategorySerializer` `apps/tickets/serializers.py:8-11`, Story 18) all exist and are reused. **`Story 16`'s own overview note already anticipated this story by name**: *"the same 'lightweight anonymous identity' pattern any future anonymous surface (a chatbot widget, an embeddable web form for COMM-5) could reuse before reaching for `PORTAL-0`'s heavier machinery"* (`.squad/plans/communication-channels/00-overview.md:45`) — this story is that reuse.
- **`Message.Channel.WEB_FORM` already exists** — verified: `apps/communications/models.py:24`, `WEB_FORM = "web_form", _("Web form")` (added by Story 13, COMM-0, unused by any adapter until now — same "channel value exists, adapter doesn't" starting point Story 17 had for `SMS`). The class docstring (`models.py:9-12`) enumerates "COMM-1 Email, COMM-2 WhatsApp, COMM-3 Live Chat, COMM-4 SMS" but not COMM-5 — task 1 updates it to name all five, a trivial consistency fix while the file is already open for this story.
- **Why this story needs TKT-2, concretely: the public form offers a category selector, and the existing category API is not public.** `CategoryViewSet` (`apps/tickets/views.py`, Story 18) gates `list`/`retrieve` behind `Permissions.TICKETS_VIEW` — an anonymous visitor holds no permission at all (`permissions_for` returns an empty `frozenset` for an unauthenticated user, `apps/core/permissions.py:50-51`). A public web form cannot call `GET /api/categories/` to populate its selector. This story adds a **separate**, narrower, explicitly public read-only view (`WebFormCategoriesView`) rather than loosening `CategoryViewSet`'s own access control — the same "add a narrow public entry point, don't widen an authenticated one" instinct `LiveChatStartView` (Story 16) already applied to ticket creation.
- **A web form submission is qualitatively different from every prior channel: it is inbound-only, and it always starts a brand-new ticket.** Email/WhatsApp/SMS/Live-Chat are all two-way conversation channels with a "continue the customer's most recent non-closed ticket, else start a new one" routing rule (Story 14/15/16/17). A web form has no equivalent "conversation" — there is no way to reply *through* a web form, and the intake's own wording ("structured request capture") describes a discrete, one-shot submission, not a message in an ongoing exchange. `WebFormAdapter.receive()` therefore **always** creates a new `Ticket`, with no lookup against the customer's prior tickets — a deliberate divergence from the routing rule every earlier channel story established, not an oversight.
- **`WebFormAdapter.send()` has no possible implementation and must say so.** `ChannelAdapter` (`apps/communications/adapters.py:26-34`) declares `send` as an `@abstractmethod` every concrete adapter must implement, even one with no outbound delivery mechanism. `WebFormAdapter.send()` raises `ValueError` unconditionally — caught and logged by `MessageViewSet.perform_create`'s existing `except Exception` (Story 14 `## Product rules`), the same "record now, deliver best-effort" contract every other channel's failure path already has. `TicketConversation.tsx`'s reply form has offered `web_form` as one of five channel choices since Story 13 (`MESSAGE_CHANNELS`, `frontend/src/features/tickets/types/message.ts:5`) — an agent selecting it to "reply" now fails safely (message persists, error logged server-side) rather than crashing; see `## Edge Cases`.
- **A Python `ValueError` from an adapter's `receive()` is not translated by the shared exception handler and would surface as an unhandled `500`.** Verified: `apps/core/exceptions.py::_to_drf_exception` translates `Http404`, `DjangoPermissionDenied`, `DjangoValidationError`, and `ProtectedError` — nothing else, and a bare `ValueError` falls through unchanged; `drf_exception_handler` then returns `None` for it, routing to `_internal_error_response` (a `500`). Every request-shape validation (required fields, a well-formed `category` id that actually exists) therefore happens in `WebFormSubmissionView.post` itself — raising `rest_framework.exceptions.ValidationError`, which *is* translated to a clean `400` — before `WebFormAdapter.receive()` is ever called, mirroring `LiveChatStartView.post`'s exact division of labour (Story 16): the view validates shape, the adapter trusts its input and does the DB work.
- **`features/web-form/` is a new, separate frontend feature, not a corner of `features/tickets/`.** Same reasoning Story 16 gave for `features/live-chat/`: the audience (an anonymous visitor) and auth model (none) are fundamentally different from every authenticated screen, including `features/tickets/`'s own `TicketFormPage`. It cannot import `@/features/tickets`'s `Category` type either way (`no-restricted-imports`, `frontend/.oxlintrc.json`) — it defines its own minimal local type and calls `GET /api/web-form/categories/` directly, the same "own the exact data shape you need" pattern `getCustomerOptions.ts` established (Story 12).
- **No session token, unlike Live Chat.** `LiveChatAdapter.start_session` (Story 16) returns a signed session token because a chat widget needs to reopen a WebSocket against the same ticket across a page reload. A web form submission is a single `POST` with no follow-up interaction — `WebFormSubmissionView` returns only `{"ticket_id": ...}`, and the widget shows an inline success state, never a `django.core.signing` token.
- **No rate limiting or spam protection.** An anonymous `POST` that creates real `Ticket`/`Customer` rows is inherently spammable; this project has no throttle class configured anywhere (verified: no `DEFAULT_THROTTLE_CLASSES` in `REST_FRAMEWORK`, `config/settings/base.py:218-237`, and no throttle import anywhere in `backend/apps/`). Out of scope here, same honesty Story 16 applied to its own unrevoked session tokens — see `## Edge Cases`.

---

## Story Goal

1. **A configurable, provider-agnostic web-form intake API**: `WebFormAdapter(ChannelAdapter)` (`receive()` only — `send()` always fails, see `## Prerequisites`) and `WebFormSubmissionView`, a public `POST` that creates a `Customer` (find-or-create by email, like Live Chat) + a **brand-new** `Ticket` + the first inbound `Message`. "Configurable" means the payload is a plain, provider-agnostic JSON shape (name/email/subject/description/category) any form — this project's own, or an embed on another page — can `POST` to, the same sense `EmailInboundWebhookView`'s payload is provider-agnostic (Story 14).
2. **A public category list** (`WebFormCategoriesView`, `GET /api/web-form/categories/`) — the narrow, explicit exception that lets an anonymous form populate a category selector without widening `CategoryViewSet`'s own `tickets.view` gate.
3. **An embeddable/portal web form** (`features/web-form/`, route `/contact`, outside `RequireAuth`) — name, optional email, subject, description, and a category selector, built with `useAppForm` + the same shared Zod validators (`requiredString`, `optionalEmail`) `TicketFormPage`/`LiveChatWidget` already use ("reusing validation," the intake's own words).

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `WebFormAdapter.receive()` | The intake's literal ask — "configurable form submission → ticket creation." |
| `WebFormAdapter.send()` raising unconditionally | `ChannelAdapter.send` is abstract; a web form has no outbound delivery mechanism. |
| `WebFormCategoriesView` (new, narrow, public) | The form needs to read categories (TKT-2); `CategoryViewSet` itself must stay `tickets.view`-gated. |
| `WebFormSubmissionView` always creating a **new** ticket | A web form submission is a discrete request, not a message in a conversation — no per-customer "continue the open ticket" rule applies. |
| `features/web-form/` (new feature) | Same anonymous-audience/no-auth-model reasoning Story 16 gave `features/live-chat/`. |

**Not here, and why:**

- **No customer authentication, no "portal" account.** Same `PORTAL-0` boundary Story 16 drew — this form is anonymous, one-shot, not a login.
- **No configurable form *builder*.** "Configurable" (intake, task 1) means the API's payload shape is provider-agnostic, not that fields/validation are admin-editable — no such UI or model is asked for, and none is added.
- **No rate limiting, no CAPTCHA, no spam protection.** See `## Prerequisites` and `## Edge Cases`.
- **No status-changing UI, no assignment.** `TKT-3`/`TKT-4`'s own stories, unchanged scope boundary every ticket-management/comm story before this one has drawn.
- **No change to `CategoryViewSet`'s own permission gate.** A new, narrower public view is added instead — see `## Prerequisites`.

---

## Context — Read These Files First

1. `.squad/stories/communication-channels/SUPPORTOS-43/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 395-400 (`STORY (COMM-5) — Web Forms`).
3. `backend/apps/communications/live_chat_adapter.py` (86 lines, after Story 16) — the direct structural template for a public, no-provider adapter: `start_session`'s find-or-create-`Customer`-by-email (lines 51-56), no `except` around the whole thing, trusts its caller's already-validated input. `WebFormAdapter.receive()` copies the customer lookup verbatim; the ticket-creation half diverges (always new, never "continue most recent") — see `## Prerequisites`.
4. `backend/apps/communications/views.py` (222 lines, after Story 17) — `LiveChatStartView` (lines 200-222) is the shape `WebFormSubmissionView` copies: `authentication_classes: list = []`, `permission_classes = [AllowAny]`, hand-validate required fields in the view, delegate the DB work to the adapter. `WhatsAppAdapter.send`'s `ValueError`-on-missing-precondition pattern (lines ~193 in `whatsapp_adapter.py`, referenced not copied verbatim) is the precedent `WebFormAdapter.send()`'s unconditional raise follows.
5. `backend/apps/communications/models.py` (54 lines) — `Message.Channel.WEB_FORM` (line 24, exists, unused); the class docstring (lines 9-12) task 1 extends to name COMM-5.
6. `backend/apps/communications/adapters.py` (52 lines) — `ChannelAdapter`'s abstract `send` (lines 31-34) — confirms every concrete adapter, including this one, must implement it.
7. `backend/apps/communications/apps.py` (14 lines, after Story 17) — `ready()` currently imports `email_adapter, live_chat_adapter, sms_adapter, whatsapp_adapter`; task 4 adds `web_form_adapter` to the same tuple.
8. `backend/apps/communications/urls.py` (33 lines, after Story 17) — four existing `path()` entries alongside the router; task 4 adds two more the same way.
9. `backend/apps/tickets/models.py` lines 8-23 (`Category`) and lines 68-75 (`Ticket.category`, nullable FK, Story 18) — the field `WebFormSubmissionView` validates against and `WebFormAdapter.receive()` writes to.
10. `backend/apps/tickets/serializers.py` lines 8-11 (`CategorySerializer`) — reused directly by `WebFormCategoriesView` (a cross-app serializer import — no existing prohibition against it; `apps/communications` already imports `apps.tickets`' **models** directly, e.g. `live_chat_adapter.py`'s `from apps.tickets.models import Ticket`).
11. `backend/apps/core/permissions.py` lines 50-57 (`permissions_for`) — confirms an unauthenticated user holds `frozenset()`, the reason `CategoryViewSet.list` is unreachable for a public visitor and a separate view is needed.
12. `backend/apps/core/exceptions.py` (113 lines) — `_to_drf_exception` (lines 54-71) — confirms a bare `ValueError` is **not** translated, the reason all validation happens in the view, not the adapter. See `## Prerequisites`.
13. `frontend/src/features/live-chat/components/LiveChatWidget.tsx` (120 lines, after Story 16) — `StartForm`'s exact `useAppForm` + `z.object({...})` + `Form`/`TextField` shape (lines 35-70), the direct template `WebFormPage`'s form copies; note it has **no** `ChatPane`-equivalent second stage — this story's form is single-stage, submit-then-success.
14. `frontend/src/features/live-chat/api/startLiveChat.ts` (8 lines) — the `api.post<Response>(url, input)` shape `submitWebForm.ts` copies.
15. `frontend/src/features/tickets/components/TicketFormPage.tsx` (195 lines, after Story 18) — the `CATEGORY_NONE` sentinel pattern (lines 25-28) and category `SelectField` (lines 149-157) `WebFormPage`'s own category selector copies — **duplicated locally**, not imported, per `no-restricted-imports`.
16. `frontend/src/app/router.tsx` (125 lines, after Story 16) — the `chat` route (lines 20-26), a direct sibling of `login`, **outside** `RequireAuth` — the exact precedent task 9's `contact` route follows.
17. `frontend/src/shared/i18n/resources.ts` (50 lines, after Story 16) — the two-imports-plus-one-entry-per-language registration pattern task 8 follows for the new `webForm` namespace.
18. `frontend/src/shared/i18n/locales/en/common.json`/`ar/common.json` — `{{var}}` interpolation already in use (e.g. `pageOf`, `rowCount_other`); `frontend/src/shared/ui/data-table/DataTablePagination.tsx:57` — a real `t('key', { var: value })` call site, the pattern the success message's `{{id}}` follows.
19. `CONVENTIONS.md` § 20 (the `useAppForm`-is-the-only-entry-point rule), § 23 (feature module conventions — Story 17's routing-key and Story 18's optional-filter/FK-deletion paragraphs are the most recent worked examples this story's own addition follows the same shape as).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Configurable web-form intake API creating tickets.** | Intake, task 1 | `WebFormAdapter.receive()`, `WebFormSubmissionView`. |
| **Embeddable/portal form, `FORM`+`I18N`, reusing validation.** | Intake, task 2 | `features/web-form/components/WebFormPage.tsx`, `requiredString`/`optionalEmail` from `shared/validation/schemas`. |
| **A submission always creates a new ticket — no "continue the open ticket" routing.** | This story's design | `WebFormAdapter.receive()` — no `Ticket.objects.filter(...).exclude(status=CLOSED)` lookup, unlike WhatsApp/SMS/Live Chat. |
| **The category list is public; the category CRUD resource stays permission-gated.** | This story's design | `WebFormCategoriesView` (new, `AllowAny`) vs. `CategoryViewSet` (unchanged, `tickets.view`/`tickets.manage`). |
| **`send()` always fails, safely.** | `ChannelAdapter`'s abstract contract | `WebFormAdapter.send()` raises `ValueError`, caught and logged by `MessageViewSet.perform_create` (Story 14). |
| Wire format is `snake_case` end to end. | § 12 | `WebFormSubmissionView`'s payload/response; `WebFormCategory`'s local mirror of `CategorySerializer`. |
| Config from `ENV`; no new secret, no new dependency. | § 17 | N/A — no provider, no new package. |

---

## Backend Tasks

### 1 — The web form adapter

**File: `backend/apps/communications/models.py`** — extend the `Message` docstring (lines 9-12) to name all five channels:

```python
class Message(TimeStampedModel):
    """A single message in a ticket's conversation — the reusable spine
    every channel (COMM-1 Email, COMM-2 WhatsApp, COMM-3 Live Chat, COMM-4
    SMS, COMM-5 Web Form) attaches to via `ChannelAdapter` (`adapters.py`).
    No channel has a bespoke model — everything is a `Message`. See Story 13
    `## Story Goal`.
    """
```

**Create file: `backend/apps/communications/web_form_adapter.py`**

```python
from apps.customers.models import Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message


@register_adapter
class WebFormAdapter(ChannelAdapter):
    """Web form — COMM-5. Unlike every other channel, a web form has no
    "reply" concept: it is inbound-only, a one-shot structured intake, not
    a back-and-forth conversation. Unlike WhatsApp/SMS/Live Chat, a
    submission always starts a brand-new Ticket — there is no per-customer
    "continue the most recent open ticket" rule, because each submission is
    a discrete, structured request by design (the intake's own wording),
    not a message in an ongoing exchange. See Story 19 `## Prerequisites`.
    """

    channel = Message.Channel.WEB_FORM

    def receive(self, payload: dict) -> Message:
        name = payload["name"]
        email = payload.get("email")
        subject = payload["subject"]
        description = payload["description"]
        category_id = payload.get("category")

        if email:
            customer, _created = Customer.objects.get_or_create(
                email=email, defaults={"name": name}
            )
        else:
            customer = Customer.objects.create(name=name)

        ticket = Ticket.objects.create(
            subject=subject,
            description=description,
            customer=customer,
            category_id=category_id,
        )

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.WEB_FORM,
            body=description,
        )

    def send(self, message: Message) -> None:
        # A web form has no delivery channel back to whoever submitted it —
        # there is no "reply via web form." MessageViewSet.perform_create
        # (Story 13) catches and logs this like any other adapter.send()
        # failure; the Message itself is already committed regardless.
        raise ValueError("Web form has no outbound delivery — it is an inbound-only channel.")
```

**File: `backend/apps/communications/apps.py`** — register the fifth adapter:

```python
    def ready(self):
        from . import (  # noqa: F401 — imports run @register_adapter
            email_adapter,
            live_chat_adapter,
            sms_adapter,
            web_form_adapter,
            whatsapp_adapter,
        )
```

---

### 2 — The public category list and the submission endpoint

**File: `backend/apps/communications/views.py`** — extend imports and append two views:

```python
from apps.tickets.models import Category
from apps.tickets.serializers import CategorySerializer

from .web_form_adapter import WebFormAdapter
```

```python
class WebFormCategoriesView(APIView):
    """Public, read-only category list for the anonymous web form —
    `Category` (TKT-2, Story 18) is otherwise gated behind `tickets.view`
    via `CategoryViewSet`, which an anonymous visitor never holds. See
    Story 19 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.all()
        return Response(CategorySerializer(categories, many=True).data)


class WebFormSubmissionView(APIView):
    """Creates a Customer (find-or-create by email) + a brand-new Ticket +
    the first inbound Message from a public web-form submission. Public —
    same `authentication_classes`/`permission_classes` shape as
    `LiveChatStartView` (Story 16); no session token, since a submission has
    no follow-up interaction to resume. See Story 19 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": [_("This field is required.")]})
        subject = (request.data.get("subject") or "").strip()
        if not subject:
            raise ValidationError({"subject": [_("This field is required.")]})
        description = (request.data.get("description") or "").strip()
        if not description:
            raise ValidationError({"description": [_("This field is required.")]})
        email = (request.data.get("email") or "").strip() or None

        category_id = request.data.get("category")
        if category_id is not None:
            try:
                category_id = int(category_id)
            except (TypeError, ValueError):
                raise ValidationError(
                    {"category": [_("Must be a valid category id.")]}
                ) from None
            if not Category.objects.filter(id=category_id).exists():
                raise ValidationError({"category": [_("Must be a valid category id.")]})

        message = WebFormAdapter().receive(
            {
                "name": name,
                "email": email,
                "subject": subject,
                "description": description,
                "category": category_id,
            }
        )
        return Response({"ticket_id": message.ticket_id}, status=status.HTTP_201_CREATED)
```

**File: `backend/apps/communications/urls.py`** — add two paths:

```python
from .views import (
    EmailInboundWebhookView,
    LiveChatStartView,
    MessageViewSet,
    SMSInboundWebhookView,
    WebFormCategoriesView,
    WebFormSubmissionView,
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
    path(
        "web-form/categories/", WebFormCategoriesView.as_view(), name="web-form-categories"
    ),
    path("web-form/submit/", WebFormSubmissionView.as_view(), name="web-form-submit"),
    *router.urls,
]
```

Endpoints: `GET /api/web-form/categories/`, `POST /api/web-form/submit/`. No `config/api_urls.py` change — `apps.communications.urls` is already included.

**No migration.** No model field changes — `Message`, `Ticket`, `Customer`, `Category` are all unchanged by this story.

---

## Frontend Tasks

### 3 — Web-form feature: types and API layer

**Create file: `frontend/src/features/web-form/types/category.ts`**

```ts
/**
 * A minimal local mirror of `apps.tickets.serializers.CategorySerializer`
 * — this feature cannot import `@/features/tickets` (CONVENTIONS.md §15),
 * and needs only these two fields to render the selector.
 */
export type WebFormCategory = {
  id: number
  name: string
}
```

**Create file: `frontend/src/features/web-form/api/getWebFormCategories.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { WebFormCategory } from '../types/category'

// A plain array, not a paginated Page<T> — GET /web-form/categories/ is a
// small, curated public list (an APIView, not a ModelViewSet), unlike
// GET /categories/'s own paginated shape.
export function getWebFormCategories(): Promise<WebFormCategory[]> {
  return api.get<WebFormCategory[]>('/web-form/categories/')
}
```

**Create file: `frontend/src/features/web-form/api/useWebFormCategories.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getWebFormCategories } from './getWebFormCategories'

export function useWebFormCategories() {
  return useQuery({
    queryKey: ['webForm', 'categories'],
    queryFn: getWebFormCategories,
  })
}
```

**Create file: `frontend/src/features/web-form/api/submitWebForm.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type SubmitWebFormInput = {
  name: string
  email?: string
  subject: string
  description: string
  category: number | null
}
type SubmitWebFormResponse = { ticket_id: number }

export function submitWebForm(input: SubmitWebFormInput): Promise<SubmitWebFormResponse> {
  return api.post<SubmitWebFormResponse>('/web-form/submit/', input)
}
```

---

### 4 — Locale namespace

**Create file: `frontend/src/features/web-form/locales/en.json`**

```json
{
  "title": "Submit a request",
  "fields": {
    "name": "Your name",
    "email": "Email (optional)",
    "subject": "Subject",
    "description": "Description",
    "category": "Category",
    "noCategory": "No category"
  },
  "action": "Submit",
  "success": {
    "title": "Request submitted",
    "description": "Thanks — your request (#{{id}}) has been submitted. We'll be in touch."
  }
}
```

**Create `frontend/src/features/web-form/locales/ar.json`** with the identical key set, translated:

```json
{
  "title": "إرسال طلب",
  "fields": {
    "name": "اسمك",
    "email": "البريد الإلكتروني (اختياري)",
    "subject": "الموضوع",
    "description": "الوصف",
    "category": "الفئة",
    "noCategory": "بدون فئة"
  },
  "action": "إرسال",
  "success": {
    "title": "تم إرسال الطلب",
    "description": "شكرًا — تم إرسال طلبك (رقم {{id}}). سنتواصل معك قريبًا."
  }
}
```

**File: `frontend/src/shared/i18n/resources.ts`** — register the `webForm` namespace, following the existing two-imports-plus-one-entry-per-language pattern (alongside `liveChat`).

---

### 5 — The form

**Create file: `frontend/src/features/web-form/components/WebFormPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { optionalEmail, requiredString } from '@/shared/validation/schemas'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { SelectField, TextField, TextareaField, useAppForm } from '@/shared/ui/form'

import { submitWebForm } from '../api/submitWebForm'
import { useWebFormCategories } from '../api/useWebFormCategories'

// Radix's `Select.Item` requires a non-empty `value` — mirrors
// `TicketFormPage`'s own `CATEGORY_NONE` sentinel (Story 18), duplicated
// locally rather than imported: this feature cannot import
// `@/features/tickets` (CONVENTIONS.md §15).
const CATEGORY_NONE = 'none'

const webFormSchema = z.object({
  name: requiredString(200),
  email: optionalEmail(),
  subject: requiredString(200),
  description: requiredString(5000),
  category: z.string().min(1),
})
type FormValues = z.output<typeof webFormSchema>

export function WebFormPage() {
  const { t } = useTranslation('webForm')
  const [ticketId, setTicketId] = useState<number | null>(null)

  if (ticketId !== null) {
    return (
      <Card className="mx-auto mt-10 max-w-lg">
        <CardHeader>
          <CardTitle>{t('success.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t('success.description', { id: ticketId })}</p>
        </CardContent>
      </Card>
    )
  }

  return <WebForm onSubmitted={setTicketId} />
}

function WebForm({ onSubmitted }: { onSubmitted: (ticketId: number) => void }) {
  const { t } = useTranslation('webForm')
  const [pending, setPending] = useState(false)
  const categoriesQuery = useWebFormCategories()
  const form = useAppForm({
    schema: webFormSchema,
    defaultValues: { name: '', email: '', subject: '', description: '', category: CATEGORY_NONE },
  })

  const categoryOptions =
    categoriesQuery.data?.map((category) => ({
      value: String(category.id),
      label: category.name,
    })) ?? []

  async function onSubmit(values: FormValues) {
    setPending(true)
    try {
      const result = await submitWebForm({
        name: values.name,
        email: values.email,
        subject: values.subject,
        description: values.description,
        category: values.category === CATEGORY_NONE ? null : Number(values.category),
      })
      onSubmitted(result.ticket_id)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <TextField control={form.control} name="name" label={t('fields.name')} />
            <TextField control={form.control} name="email" label={t('fields.email')} type="email" />
            <TextField control={form.control} name="subject" label={t('fields.subject')} />
            <TextareaField
              control={form.control}
              name="description"
              label={t('fields.description')}
            />
            <SelectField
              control={form.control}
              name="category"
              label={t('fields.category')}
              options={[
                { value: CATEGORY_NONE, label: t('fields.noCategory') },
                ...categoryOptions,
              ]}
            />
            <Button type="submit" disabled={pending}>
              {t('action')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

---

### 6 — Route

**File: `frontend/src/app/router.tsx`** — add a public `contact` route as a sibling of `login`/`chat`, **outside** `RequireAuth`:

```tsx
      {
        path: 'contact',
        lazy: async () => {
          const { WebFormPage } = await import('@/features/web-form/components/WebFormPage')
          return { element: <WebFormPage /> }
        },
      },
```

No `RequirePermission`, no `RequireAuth` — this route is intentionally public.

---

## Documentation Tasks

### 7 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 18's paragraphs):

> **A channel with no outbound delivery mechanism still implements `ChannelAdapter.send()` — by always raising.** `WebFormAdapter.send()` (Story 19, `COMM-5`) unconditionally raises `ValueError`, caught and logged by `MessageViewSet.perform_create`'s existing `except Exception` (Story 14) — the same "record now, deliver best-effort" contract every channel's own failure path already has, not a special case. **A resource that must stay permission-gated for authenticated use can still have a separate, narrower public view over the same model** — `WebFormCategoriesView` (Story 19) reads the same `Category` table `CategoryViewSet` (Story 18) does, without loosening `CategoryViewSet`'s own `tickets.view` gate; add a second, explicitly public view rather than widen an existing authenticated one. **Not every channel routes a new inbound message into the customer's most recent open ticket** — that rule (Email/WhatsApp/SMS/Live Chat) assumes an ongoing conversation; a one-shot structured intake (a web form) should always start a new ticket instead, because there is no "conversation" for a later message to continue.

---

## Edge Cases & Failure Modes

- **An agent selecting "Web form" as an outbound reply channel fails safely, not loudly.** `WebFormAdapter.send()` always raises; `MessageViewSet.perform_create` catches and logs it (Story 14's existing pattern) — the message still persists and the agent still sees a "sent" toast, with no visible error. Accepted: `web_form` has been a selectable `MESSAGE_CHANNELS` option since Story 13, and removing it is out of this story's scope (not asked for by the intake).
- **`category` present but referencing a non-existent id returns `400`, not an `IntegrityError`-driven `500`.** `WebFormSubmissionView.post` checks `Category.objects.filter(id=category_id).exists()` before ever calling `WebFormAdapter().receive()` — `Ticket.objects.create(category_id=...)` with a bad id would otherwise hit the database's FK constraint directly.
- **A submission with no email creates a brand-new `Customer` every time**, exactly like Live Chat's own no-email path (Story 16) — there is no way to deduplicate an anonymous submitter without an identifying field.
- **A submission with an email address already on file reuses that `Customer`, but still creates a new `Ticket`** — unlike WhatsApp/SMS/Live Chat, a repeat submitter's earlier ticket (open or closed) is never reused. This is the story's own defining design choice, not a bug — see `## Prerequisites`.
- **No rate limiting or spam protection exists.** A scripted flood of `POST /api/web-form/submit/` requests would create real `Ticket`/`Customer` rows with no throttling anywhere in this project to stop it. Acceptable for this story's scope; a future story would need a `DEFAULT_THROTTLE_CLASSES` addition or an external layer (e.g. a reverse-proxy rate limit) — neither exists today.
- **`GET /api/web-form/categories/` returns every category with no pagination**, unlike `GET /api/categories/`. Acceptable while the category list stays small (a business's own configured set, not user-generated); if it ever needs pagination, `WebFormCategoriesView` would need updating independently of `CategoryViewSet`.
- **A category deleted between the widget loading the list and the visitor submitting** is caught by the same `Category.objects.filter(id=category_id).exists()` check — `400`, not a crash, and the visitor would need to reselect (the widget does not currently re-fetch categories on a failed submit; an accepted rough edge, matching Live Chat's own "no automatic reconnection" scope limitation, Story 16).
- **Arabic form submissions round-trip correctly** — no ASCII assumption anywhere in `WebFormAdapter`/`WebFormSubmissionView`/the frontend form.
- **This project has no `CORS_ALLOWED_ORIGINS` entry for any domain other than its own dev frontend** (`config/settings/base.py`, `.env`'s `CORS_ALLOWED_ORIGINS`). A truly external "embed this widget on another domain" deployment would need that origin added — an ops/deployment concern outside this plan's code changes, the same boundary Story 16 drew around "no production ASGI server choice."

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes**.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: public category list, submission creating `Customer`+`Ticket`+`Message`, repeat-email-reuses-customer-but-not-ticket, malformed/nonexistent `category`, missing required fields, outbound `web_form` send failing safely — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new `web-form` feature.

---

## Migration / Rollback

**No migration.** No model field changes.

**Rollback of the code:** revert the commits.

**Half-applied states to avoid:**

- **`WebFormAdapter` registered (task 1) without `apps.py`'s `ready()` import (also task 1)** — `get_adapter("web_form")` returns `None` forever, silently matching every other channel's "unregistered adapter" no-op (Story 13's established behaviour), but `WebFormSubmissionView` itself does not depend on registration (it calls `WebFormAdapter().receive()` directly, not via `get_adapter`) — only outbound `send()` dispatch would be affected, and only if an agent tries to reply via `web_form`.
- **`WebFormSubmissionView` shipped without the `Category.objects.filter(...).exists()` check** — a malformed or stale `category` id would surface as an unhandled `500` (a raw `IntegrityError`) instead of a clean `400`. Verify this check explicitly; see `## Prerequisites`'s note on `ValueError` not being translated.
- **Task 6 (router) before task 5 (`WebFormPage.tsx`)** — the lazy import fails to resolve, a build failure, not a silent gap.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration was needed:** `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The public category list works with no auth.** Seed a category via `/admin/tickets/category/add/` or `POST /api/categories/` with an agent token, then `GET /api/web-form/categories/` with **no** `Authorization` header → `200`, a plain array (not paginated) including it.
5. **A submission with no category creates a `Customer`, a new `Ticket` (uncategorized), and an inbound `Message`.** `POST /api/web-form/submit/` with `{"name": "Web Visitor", "subject": "Need help", "description": "Something is broken"}` (no `email`, no `category`) → `201`, `{"ticket_id": <id>}`. Confirm via an agent token: `GET /api/tickets/<id>/` shows `subject: "Need help"`, `category: null`, `customer_name: "Web Visitor"`; `GET /api/messages/?ticket=<id>` shows one inbound `channel: "web_form"` message with `body: "Something is broken"`.
6. **A submission with a valid category attaches it.** Repeat step 5 with `"category": <seeded category id>` → `201`; the resulting ticket's `category`/`category_name` match.
7. **A submission with a malformed or nonexistent category is rejected.** `"category": "notanumber"` → `400` naming `category`. `"category": 999999` (does not exist) → `400` naming `category`. Neither creates a `Customer`/`Ticket`.
8. **Missing required fields are rejected individually.** Omit `name` → `400` naming `name`; omit `subject` → `400` naming `subject`; omit `description` → `400` naming `description`. None of these create a `Customer`/`Ticket`.
9. **A repeat submission with the same email reuses the customer but creates a second, independent ticket.** `POST` twice with the same `"email": "repeat@example.com"`, different `subject`s → both `201`; `GET /api/customers/?search=repeat@example.com` shows exactly **one** customer; the two responses' `ticket_id`s are **different**, and neither ticket references the other.
10. **Selecting `web_form` as an outbound reply channel fails safely.** With an existing ticket (agent token): `POST /api/messages/` `{"ticket": <id>, "direction": "outbound", "channel": "web_form", "body": "test"}` → `201` (message persists); server log shows a logged `ValueError` mentioning `"Web form has no outbound delivery"`.
11. **The full bilingual UI walkthrough.** `npm run dev` with the backend up.
    - Visit `/contact` (no login) — the form renders with a category selector (seeded categories plus "No category").
    - Submit it — a success message appears showing the ticket reference number, no navigation to a `/tickets/*` page (the visitor has no access to it).
    - In a signed-in agent session, open the corresponding ticket — subject/description/category match what was submitted, and the conversation shows the inbound `web_form` message.
    - Switch to Arabic — labels translate, the success message's `{{id}}` interpolation renders correctly.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `Message`'s docstring names all five channels including COMM-5.
- [ ] `WebFormAdapter(ChannelAdapter)` in `apps/communications/web_form_adapter.py` — `receive()` always creates a new `Ticket` (no "continue open ticket" lookup), `send()` unconditionally raises `ValueError`.
- [ ] `CommunicationsConfig.ready()` imports `web_form_adapter` alongside the other four.
- [ ] `WebFormCategoriesView` — public, `GET /api/web-form/categories/`, plain array via `CategorySerializer`, `CategoryViewSet` itself unchanged.
- [ ] `WebFormSubmissionView` — public, `POST /api/web-form/submit/`, validates `name`/`subject`/`description` required, `category` optional-but-must-exist-if-present, delegates to `WebFormAdapter().receive()`.
- [ ] **No migration.**
- [ ] `features/web-form/` — types (`WebFormCategory`), `getWebFormCategories`/`useWebFormCategories`, `submitWebForm`, `webForm` locale namespace registered in `resources.ts`, `WebFormPage.tsx` (form + inline success state, `useAppForm`, per § 20, `CATEGORY_NONE` sentinel duplicated locally per § 15).
- [ ] `contact` route added to `router.tsx`, **outside** `RequireAuth` — genuinely public.
- [ ] `CONVENTIONS.md` § 23 gains the send()-always-raises / narrow-public-view / no-conversation-routing paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: public category list (Step 4); submission creating Customer+Ticket+Message, with and without category (Steps 5-6); malformed/nonexistent category and missing-field rejections (Steps 7-8); repeat-email reuses customer but not ticket (Step 9); `web_form` outbound send failing safely (Step 10).
- [ ] Both languages walk through cleanly in the browser, including the `{{id}}`-interpolated success message (Step 11).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] `.squad/plans/communication-channels/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** This is the last story in `communication-channels` — EPIC 5 is now fully planned (`COMM-0` through `COMM-5`).
