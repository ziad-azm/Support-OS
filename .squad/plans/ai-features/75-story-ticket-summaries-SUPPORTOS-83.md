# Story 75 — Ticket Summaries (Story: SUPPORTOS-83)

## Prerequisites

- **Story 74 (`AI-0`, AI Service Foundation) completed** — [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md). Implemented and verified live this session: `apps/ai/client.py::generate_completion(user_prompt, *, system=None, max_tokens=4096, model=None)` raises `apps.ai.exceptions.AIServiceError` for every failure mode; `ANTHROPIC_API_KEY`/`AI_MODEL` exist in `config/settings/base.py`. This story is the first real caller.
- **The intake file (`.squad/stories/ai-features/SUPPORTOS-83/intake.md`) carries the wrong description** — its "Suggested-reply endpoint + UI... Draft replies from ticket + KB context" text is `AI-2`'s task (Suggested Replies, `SUPPORTOS-84`), not `AI-1`'s. The authoritative text is `SupportOs backlog.MD` lines 824-826 (`STORY (AI-1) — Ticket Summaries`):

  > **Task: Summary endpoint + UI action** — Summarize ticket conversation via AI-0; add "summarize" action in ticket detail. Outcome: quick ticket comprehension.

  This story plans against the backlog text — confirmed against the pattern already established and confirmed with the user for `AI-0` (Story 74 `## Prerequisites`), where the same intake-shift was found and resolved the same way. **No suggested-reply drafting and no KB grounding belongs to this story** — that is `AI-2`, planned separately.
- **`COMM-0` (Messaging Core / Channel Adapter, Story 13) is complete.** `apps/communications/models.py::Message` (`ticket` FK, `direction` — `Direction.INBOUND`/`OUTBOUND`, `body`) is the conversation data this story summarizes. Verified live: `Message.Meta.ordering = ("created_at",)` (chronological); `MessageViewSet.perform_create` (`apps/communications/views.py:81-90`) confirms `OUTBOUND` is always the agent-composed reply (`instance.direction != Message.Direction.OUTBOUND: return` before the send-adapter call runs) and every channel adapter's own `receive()` (`whatsapp_adapter.py:102`, `sms_adapter.py:84`, `email_adapter.py:59`, `web_form_adapter.py:44`, `live_chat_adapter.py:88`) sets `INBOUND` for a customer-originated message — so `INBOUND` = customer, `OUTBOUND` = agent, unambiguously, across every channel.
- **This story adds no Django model, no migration, and no new permission constant.** The endpoint reuses `Permissions.TICKETS_VIEW` — see `## Product rules` for why, a deliberate departure from `AI-0`'s own forward-looking guess ("adds `Permissions.AI_USE` (or equivalent)", Story 74 `## Story Goal`) once this story's actual design was worked out.
- **Verified live, this session:** `python manage.py test` reports **54** passing, the baseline this story must not change; `apps/tickets/{history.py,context.py}` are read as the direct structural precedent for this story's own `apps/tickets/summarization.py`.

---

## Story Goal

Add a "Summarize" action to a ticket's conversation: an agent clicks a button on the ticket detail page, the backend builds a transcript from the ticket's description and messages, sends it to `apps.ai.client.generate_completion` (`AI-0`) for a short summary, and the frontend displays the result inline. Nothing is persisted — every click regenerates the summary from the ticket's current state.

1. **`apps/tickets/summarization.py::build_conversation_transcript(ticket)`** — the ticket's subject, description, and up to its most recent `MAX_TRANSCRIPT_MESSAGES` messages (oldest-first within that window), each labeled "Customer" or "Agent" per `Message.direction`. Mirrors `history.py`/`context.py`'s "one function file per view helper" shape already established in this app.
2. **`apps/tickets/summarization.py::summarize_ticket(ticket)`** — builds the transcript, composes a system instruction (in the requesting agent's resolved UI language — `django.utils.translation.get_language()`, already active via `LocaleMiddleware`), and calls `generate_completion`. Raises `apps.ai.exceptions.AIServiceError` on failure — unchanged from `AI-0`'s contract, not caught here.
3. **`TicketViewSet.summarize`** (`POST /api/tickets/<id>/summarize/`) — a thin action, the same shape as `TicketViewSet.history`/`.context`/`.sla`: `Response({"summary": summarize_ticket(ticket)})`. Catches `AIServiceError` and re-raises the new `apps.ai.exceptions.AIServiceUnavailable` (a `rest_framework.exceptions.APIException` subclass, `status_code = 503`) — the first DRF-recognized translation of an `apps.ai` failure, reusable by every later `AI-*` view instead of each reinventing it.
4. **Frontend**: a "Summarize" button in `TicketConversation`'s header (`CardAction`), and an `Alert` showing the returned summary text once generated.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/tickets/summarization.py` | "Summarize ticket conversation via AI-0" (backlog, `AI-1`). |
| `TicketViewSet.summarize` action | "add 'summarize' action in ticket detail" (backlog, `AI-1`) — the endpoint half. |
| `apps.ai.exceptions.AIServiceUnavailable` | A clean 503 for a user-facing AI failure, instead of falling through to `envelope_exception_handler`'s generic `500 internal_error` (`apps/core/exceptions.py:98-112`) for the first time an agent sees an AI error in the product. |
| `TicketConversation`'s "Summarize" button + `Alert` | "add 'summarize' action in ticket detail" (backlog, `AI-1`) — the UI half; "quick ticket comprehension" (backlog outcome) is what an agent reading the result gets. |

**Not here, and why:**

- **No suggested-reply drafting, no KB grounding.** That is `AI-2` (`SUPPORTOS-84`), a separate story with its own plan.
- **No persistence of the generated summary.** The backlog's outcome is "quick ticket comprehension," not an audit trail of past summaries; every request recomputes from the ticket's current messages, the same "compute on every read instead of caching" call `apps/knowledge_base/search.py` (`KB-3`) and `apps/sla/policy.py::compute_sla_status` already make in this codebase for read-shaped derived data.
- **No new permission constant.** `TicketViewSet.history`/`.context`/`.sla` (Stories 24, 26, 28) already establish the precedent of reusing `Permissions.TICKETS_VIEW` for a read-context ticket action rather than inventing a new permission per action; `summarize` is another read-context action on the same viewset and follows the same rule. A dedicated `ai.use`-shaped permission would have no second consumer yet — `AI-2`/`AI-3`/`AI-4`/`AI-5` each live on their own views with their own natural domain permission (message-sending, ticket intake, KB, portal), not a shared generic "AI access" concept this backlog defines anywhere.
- **No Celery task, no async job.** A single-turn `generate_completion` call is fast enough to run synchronously inside the request/response cycle, the same way `KnowledgeBaseSearchView` (`KB-3`) and every existing `TicketViewSet` action already do; nothing here is long-running enough to need `SLA-0`'s background-job foundation.
- **No change to `MessageSerializer`, `TicketSerializer`, or any existing endpoint's response shape.** `summarize` is a new, additive action; nothing existing is touched.

---

## Context — Read These Files First

1. `.squad/stories/ai-features/SUPPORTOS-83/intake.md` — read it, but see `## Prerequisites` above: its description belongs to `AI-2`, not this story.
2. `SupportOs backlog.MD` lines 824-826 — the authoritative `AI-1` task text this plan implements.
3. [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md) in full — `apps/ai/client.py::generate_completion`'s exact signature and `AIServiceError`'s contract, both reused verbatim here.
4. `backend/apps/tickets/history.py` (all 60 lines) — the exact "module docstring, one top-level cap constant, one function returning plain data" shape `summarization.py` copies; note its own precedent for importing `apps.communications.models.Message` from `apps.tickets` (line 14) — the same cross-app import `build_conversation_transcript` needs.
5. `backend/apps/tickets/context.py` (`build_ticket_context`) — the other existing "view helper function, thin `@action` wrapper" pair in this app, alongside `history.py`.
6. `backend/apps/communications/models.py` lines 8-55 (`Message`) — `Direction.INBOUND`/`OUTBOUND` choices, `Meta.ordering = ("created_at",)` (chronological, line 50), `body`/`channel` fields.
7. `backend/apps/communications/views.py` lines 81-90 (`MessageViewSet.perform_create`) — confirms `OUTBOUND` is always the agent-composed reply, never inbound-channel traffic.
8. `backend/apps/tickets/views.py` lines 47-73 (`TicketViewSet`, `permission_map`) and lines 249-287 (`.history`, `.context`, `.sla` — the three existing `detail=True, methods=["get"]` actions gated on `Permissions.TICKETS_VIEW` alone) — the exact precedent `.summarize`'s `permission_map` entry and action shape follow, except `methods=["post"]` (see `## Product rules`).
9. `backend/apps/core/exceptions.py` lines 29-51, 98-112 — confirms an `APIException` subclass with a `default_code` is rendered into the envelope via the `else` branch (`code = getattr(exc, "default_code", "error")`), not the `_internal_error_response` fallback — this is what makes `AIServiceUnavailable` render as a clean `503 ai_service_unavailable` envelope instead of a generic `500`.
10. `backend/apps/ai/exceptions.py` (current, 12 lines, from Story 74) — `AIServiceError`; task 2 adds `AIServiceUnavailable` to this same file.
11. `frontend/src/features/tickets/components/TicketConversation.tsx` (all 183 lines) — the exact component this story edits: `CardHeader`/`CardTitle` (lines 59-63) gain a `CardAction` button; `MessageRow` (lines 86-105) is the "no forced `dir`, free-form prose" precedent the new summary `Alert` follows.
12. `frontend/src/features/tickets/api/useTicketMutations.ts` (all 65 lines) — the exact `useMutation` shape task 5's `useSummarizeTicket` follows, minus the `queryClient.invalidateQueries` every existing mutation here has (this one changes nothing cached — see `## Story Goal` "what this story does not").
13. `frontend/src/features/tickets/api/escalateTicket.ts` — the exact `api.post<T>(url, body)` shape `summarizeTicket.ts` follows, minus a body (no input needed).
14. `frontend/src/shared/ui/primitives/card.tsx` lines 57-65 (`CardAction`) — not yet used anywhere in the frontend (verified: no existing consumer); this is the first real usage, for exactly the "header-right action button" case it exists for.
15. `frontend/src/shared/ui/primitives/alert.tsx` (all 61 lines) — `Alert`/`AlertTitle`/`AlertDescription`, the summary display.
16. `frontend/src/features/tickets/locales/{en,ar}.json` — the existing `conversation` key block (`en.json` lines 92-118, `ar.json` lines 92-117) task 7 extends with `actions.summarize` and a new `summary` block.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Summarize a ticket's conversation via `AI-0`.** | Backlog, `AI-1`'s sole task | `apps/tickets/summarization.py::summarize_ticket`, calling `apps.ai.client.generate_completion`. |
| **"Summarize" action in ticket detail.** | Backlog, `AI-1`'s sole task | `TicketViewSet.summarize` (`POST /api/tickets/<id>/summarize/`); `TicketConversation`'s new header button. |
| **Reuse `tickets.view` — no new permission.** | This story's own design, following `.history`/`.context`/`.sla`'s established precedent (`views.py:249-287`) | `permission_map["summarize"] = Permissions.TICKETS_VIEW`. |
| **A `POST`, not a `GET`, despite reading data.** | This story's own design | Unlike `.history`/`.context`/`.sla` (free, idempotent reads), a summarization call has a real external cost (an LLM request) and returns a freshly generated, non-deterministic result each time — matching this project's own `.assign`/`.set_status`/`.escalate` precedent that a real-cost or state-changing action is `POST`, never `GET`. |
| **No persistence — every call recomputes from current messages.** | Backlog outcome ("quick ticket comprehension," not an audit trail) | `summarize_ticket` takes no cache/storage path; no model, no migration. |
| **The summary is generated in the requesting agent's UI language.** | This story's own design, extending §18's "translate by the caller's resolved language" pattern to AI-generated text for the first time | `summarize_ticket` reads `django.utils.translation.get_language()` (resolved by the existing `LocaleMiddleware` from the frontend's `Accept-Language` header, §18) and instructs the model to respond in that language. |
| **An AI failure surfaces as a clean `503`, not a generic `500`.** | This story's own design, reusable by every later `AI-*` view | `apps.ai.exceptions.AIServiceUnavailable` (`APIException`, `status_code = 503`, `default_code = "ai_service_unavailable"`). |

---

## Backend Tasks

### 1 — The transcript builder and summarizer

**Create file: `backend/apps/tickets/summarization.py`**

```python
"""Ticket-conversation summarization — AI-1 (Story 75), built on AI-0's
`apps.ai.client.generate_completion` (Story 74). Same "module docstring,
one cap constant, one function returning plain data" shape as
`history.py`/`context.py` in this same app.
"""

from django.utils.translation import get_language

from apps.ai.client import generate_completion
from apps.communications.models import Message

from .models import Ticket

# Realistic ticket volumes in this project are dozens of messages, not
# thousands — the same scale assumption `apps/knowledge_base/search.py`
# (KB-3) makes for FAQ/Article counts. This is a safety bound against a
# pathological outlier, not a normal-case truncation: at Claude Opus 5's
# context window, even 50 long messages is a small fraction of what the
# model can accept.
MAX_TRANSCRIPT_MESSAGES = 50

_LANGUAGE_NAMES = {"en": "English", "ar": "Arabic"}
_DEFAULT_LANGUAGE_NAME = "English"


def build_conversation_transcript(ticket: Ticket) -> str:
    """The ticket's subject, description, and up to its most recent
    `MAX_TRANSCRIPT_MESSAGES` messages, oldest-first within that window.
    An agent needs the conversation's CURRENT state summarized, not its
    earliest history, so a ticket over the cap keeps its most recent
    activity — `.order_by("-created_at")[:N]` then reversed back to
    chronological order, not `Message.Meta.ordering`'s own ascending
    order sliced directly (which would keep the OLDEST N instead).
    """
    lines = [f"Subject: {ticket.subject}", f"Description: {ticket.description}", ""]

    recent_messages = list(
        Message.objects.filter(ticket=ticket).order_by("-created_at")[:MAX_TRANSCRIPT_MESSAGES]
    )
    recent_messages.reverse()

    for message in recent_messages:
        speaker = "Customer" if message.direction == Message.Direction.INBOUND else "Agent"
        lines.append(f"{speaker}: {message.body}")

    return "\n".join(lines)


def summarize_ticket(ticket: Ticket) -> str:
    """Build the transcript and summarize it via AI-0's single integration
    point. Raises `apps.ai.exceptions.AIServiceError` on any failure —
    unchanged from `generate_completion`'s own contract; the caller
    (`TicketViewSet.summarize`) decides how to translate that for HTTP.
    """
    transcript = build_conversation_transcript(ticket)
    language_name = _LANGUAGE_NAMES.get(get_language(), _DEFAULT_LANGUAGE_NAME)
    system = (
        "You are a support-ticket summarization assistant. Summarize the "
        "conversation below for a support agent in 2-4 concise sentences, "
        "focused on the customer's issue and its current state. Respond "
        f"in {language_name}."
    )
    return generate_completion(transcript, system=system, max_tokens=512)
```

---

### 2 — The HTTP-facing exception

**File: `backend/apps/ai/exceptions.py`** — append, after `AIServiceError`:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException


class AIServiceUnavailable(APIException):
    """DRF-recognized translation of `AIServiceError` for a view that
    wants a clean `503` instead of falling through to
    `envelope_exception_handler`'s generic `500 internal_error`
    (`apps/core/exceptions.py:98-112`). A view catches `AIServiceError`
    and raises this instead; `apps.ai.client`/`apps.ai.prompts` never
    raise it themselves — they have no HTTP context. First real caller:
    Story 75 (`AI-1`, `TicketViewSet.summarize`), reusable by every later
    `AI-*` view.
    """

    status_code = 503
    default_code = "ai_service_unavailable"
    default_detail = _("The AI service is temporarily unavailable. Please try again shortly.")
```

The two new imports (`gettext_lazy`, `APIException`) go at the top of the file, above the existing `AIServiceError` class — `apps/ai/exceptions.py` currently has no imports at all.

---

### 3 — The endpoint

**File: `backend/apps/tickets/views.py`** — add imports and one action.

```python
from apps.ai.exceptions import AIServiceError, AIServiceUnavailable

from .summarization import summarize_ticket
```

Add to the existing `from .assignment import ...` / `from .context import ...` / `from .escalation import ...` / `from .history import ...` import block, keeping the existing alphabetical-by-module grouping — `.summarization` sorts after `.status`, so it becomes the new last line in that group, before `from .models import ...`.

Add `"summarize": Permissions.TICKETS_VIEW,` to `TicketViewSet.permission_map` (`views.py:53-73`), alongside `"history"`/`"context"`/`"sla"`.

Add the action itself, after `.sla` (the current last method in the class):

```python
    @action(detail=True, methods=["post"], url_path="summarize")
    def summarize(self, request, pk=None):
        """AI-generated conversation summary — AI-1. Gated `tickets.view`
        alone, the same reasoning `.history`/`.context`/`.sla` use — no
        separate AI permission exists (see Story 75 `## Product rules`).
        `POST`, not `GET`: unlike those three, this has a real external
        cost and returns a freshly generated result each call.
        """
        ticket = self.get_object()
        try:
            summary = summarize_ticket(ticket)
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        return Response({"summary": summary})
```

---

## Frontend Tasks

### 4 — Types and API layer

**Create file: `frontend/src/features/tickets/types/ticketSummary.ts`**

```ts
/** Mirrors `TicketViewSet.summarize`'s response shape verbatim. */
export type TicketSummary = {
  summary: string
}
```

**Create file: `frontend/src/features/tickets/api/summarizeTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TicketSummary } from '../types/ticketSummary'

/** No request body — the backend rebuilds the transcript from the
 * ticket's current messages on every call; nothing is cached or
 * persisted server-side. */
export function summarizeTicket(id: number): Promise<TicketSummary> {
  return api.post<TicketSummary>(`/tickets/${id}/summarize/`)
}
```

---

### 5 — The mutation hook

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — add an import and one hook, after `useEscalateTicket`:

```ts
import { summarizeTicket } from './summarizeTicket'
```

```ts
// No queryClient.invalidateQueries — unlike every other mutation in this
// file, summarizing changes nothing cached; the result is consumed
// directly by the caller via onSuccess. See Story 75 `## Story Goal`.
export function useSummarizeTicket(id: number) {
  return useMutation({
    mutationFn: () => summarizeTicket(id),
  })
}
```

---

### 6 — The UI

**File: `frontend/src/features/tickets/components/TicketConversation.tsx`** — add imports:

```ts
import { useState } from 'react'
// ... existing React/i18n/zod imports stay ...
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/primitives/alert'
import { Button } from '@/shared/ui/primitives/button'
// ... existing shared/ui imports stay ...
import { useSummarizeTicket } from '../api/useTicketMutations'
```

`useState` is not currently imported in this file (`ReplyForm`'s own `useState` import, line 1, already covers the module-level import — confirm it stays a single `import { useState } from 'react'` line, not duplicated).

Change `TicketConversation`'s body:

```tsx
export function TicketConversation({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useMessages(ticketId)
  useTicketChatSocket(ticketId)

  const [summary, setSummary] = useState<string | null>(null)
  const summarizeMutation = useSummarizeTicket(ticketId)

  function handleSummarize() {
    summarizeMutation.mutate(undefined, {
      onSuccess: (data) => setSummary(data.summary),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('conversation.title')}</h2>
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={summarizeMutation.isPending}
            onClick={handleSummarize}
          >
            {t('conversation.actions.summarize')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary ? (
          <Alert>
            <AlertTitle>{t('conversation.summary.title')}</AlertTitle>
            {/* No forced `dir` — AI-generated prose may itself be Arabic,
                the same "free-form prose, not a Latin-script identifier"
                reasoning `MessageRow` already applies to `message.body`
                below. */}
            <AlertDescription className="whitespace-pre-wrap text-foreground">
              {summary}
            </AlertDescription>
          </Alert>
        ) : null}
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
```

Add `CardAction` to the existing `import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'` line, making it `Card, CardAction, CardContent, CardHeader, CardTitle`.

`AlertDescription`'s own default styling is `text-muted-foreground` (`alert.tsx:52`) — `text-foreground` overrides it here because a generated summary is primary content an agent reads and acts on, not secondary metadata the way a form hint or timestamp is; every other `AlertDescription` use in this codebase (if any) keeps the muted default, so this override is scoped to this one usage via `className`, not a change to the primitive.

`Can permission="tickets.manage"` on the button is deliberately **absent** — the whole ticket detail page already requires `tickets.view` to be reachable at all (route-level gate), and `summarize` is gated on that same permission on the backend, so no narrower frontend check is needed, the same reasoning `TicketSlaSection`/`TicketHistorySection` already apply for their own `tickets.view`-gated content.

---

### 7 — Locale

**File: `frontend/src/features/tickets/locales/en.json`** — inside the existing `conversation` object, add `summarize` to `actions` and a new `summary` key, after `actions`:

```json
    "actions": {
      "send": "Send",
      "summarize": "Summarize"
    },
    "summary": {
      "title": "AI Summary"
    },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the same two additions, translated:

```json
    "actions": {
      "send": "إرسال",
      "summarize": "تلخيص"
    },
    "summary": {
      "title": "ملخص الذكاء الاصطناعي"
    },
```

---

## Edge Cases & Failure Modes

- **`ANTHROPIC_API_KEY` is unconfigured (the default state).** `generate_completion` raises `AIServiceError`; `TicketViewSet.summarize` catches it and raises `AIServiceUnavailable`, a clean `503 ai_service_unavailable` envelope — not the generic `500` an uncaught `AIServiceError` would otherwise produce. The frontend's shared `MutationCache.onError` toast (`CONVENTIONS.md` §21) surfaces this to the agent automatically; `TicketConversation` adds no second error-specific UI beyond that shared toast.
- **The AI provider errors or times out mid-request** (rate limit, outage, network failure) — same `AIServiceError` → `AIServiceUnavailable` → `503` path as above; no retry logic in this story beyond `generate_completion`'s own SDK-level retries (`AI-0` `## Edge Cases`).
- **A ticket with zero messages** (only its `description`) — `build_conversation_transcript` still returns a valid, non-empty transcript (`Subject: ...`, `Description: ...`, no message lines); `summarize_ticket` proceeds normally, summarizing the initial report alone. Not an error case.
- **A ticket with more than `MAX_TRANSCRIPT_MESSAGES` (50) messages** — the transcript keeps the 50 most recent, dropping the oldest. The summary is therefore about the conversation's current state, not a complete history; this is the intended behavior (see task 1's comment), not a bug to fix by raising the cap.
- **The requesting agent's UI language is neither `en` nor `ar`** (should not occur — `LANGUAGES` in `base.py` lists only these two, §18) — `_LANGUAGE_NAMES.get(get_language(), _DEFAULT_LANGUAGE_NAME)` falls back to `"English"` rather than raising, so a future third language added without updating this dict degrades gracefully instead of erroring.
- **Two rapid clicks of "Summarize"** — each is an independent `POST`; `summarizeMutation.isPending` disables the button for the duration of the in-flight request, the same `disabled={mutation.isPending}` guard every other action button in `TicketDetailPage`/`TicketConversation` already uses. A second click cannot fire while the first is pending.
- **The summary references content that changes immediately after generation** (a new message arrives right after summarizing) — the displayed summary is a point-in-time snapshot, held in local component state (`useState`), not re-synced against `useMessages`' live query; this is consistent with "no persistence, no caching" (`## Story Goal`) — the agent re-clicks "Summarize" to refresh it.
- **Navigating away from and back to the ticket detail page** — `summary` local state resets to `null` (component remount); this is expected, not a bug — nothing is persisted per `## Product rules`.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — confirms `apps/tickets/summarization.py`, the `apps/ai/exceptions.py` addition, and `apps/tickets/views.py`'s new imports/action all import cleanly.
2. `python manage.py test` — reports the same **54** passing as before this story (no model, no migration).
3. `ruff format --check .` / `ruff check .` over the new/changed Python files.
4. `npm run build` — typechecks `TicketSummary`, the new `useSummarizeTicket` hook, and `TicketConversation`'s new state/JSX.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the extended `tickets` namespace (`conversation.actions.summarize`, `conversation.summary.title`).
7. Real HTTP/Django-shell verification plus a browser walkthrough in both languages — `## Verification Steps`.

---

## Migration / Rollback

**No migration in this story.** No model changed.

**Rollback:** revert the commits (`apps/tickets/summarization.py`, `apps/ai/exceptions.py`, `apps/tickets/views.py`, and the four frontend files/edits). Nothing to reverse at the database level.

**Half-applied states to avoid:**

- **`views.py`'s new action added before `summarization.py` exists** → `ImportError` at Django startup, caught immediately by `python manage.py check`.
- **`permission_map["summarize"]` omitted** — per `CONVENTIONS.md` §22, an unmapped action does not deny; it falls through to authenticated-only. Not a security hole (still requires login), but inconsistent with every sibling read-context action on this viewset — add the entry in the same change as the action, not after.
- **`TicketConversation`'s `CardAction` import added without also updating the existing `Card, CardContent, CardHeader, CardTitle` import line** → a build-time `ReferenceError`-shaped TypeScript error, caught by `npm run build`.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing, unchanged.
3. **Unconfigured behavior, verified via a real HTTP call** (with `ANTHROPIC_API_KEY` blank, the default state): `POST /api/tickets/<id>/summarize/` as an authenticated user holding `tickets.view` → `503`, envelope `{code: "ai_service_unavailable", message: "The AI service is temporarily unavailable..."}`, not a `500`.
4. **Configured behavior, with a real key set in `backend/.env`:** the same request on a ticket with at least one message → `200`, envelope `data: {summary: "<2-4 sentence text>"}`. Repeat as a user whose UI language is Arabic (`Accept-Language: ar`) and confirm the returned summary is written in Arabic.
5. **Permission check:** the same request with `tickets.view` stripped from the caller's role → `403`; with no token at all → `401`.
6. **The UI walkthrough.** `npm run dev` with the backend up and a real key configured: open a ticket with conversation history, click "Summarize" in the conversation card header — the button disables while pending, then an "AI Summary" alert appears above the message list with the generated text. Click again — the alert updates to the newly generated text. Switch to Arabic and repeat — the button label, alert title, and (per Step 4) the summary content itself are all in Arabic.
7. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps/tickets/summarization.py` — `build_conversation_transcript(ticket)` (most-recent-`MAX_TRANSCRIPT_MESSAGES`-messages, chronological order, "Customer"/"Agent" labels from `Message.direction`) and `summarize_ticket(ticket)` (language-aware system prompt via `get_language()`, calls `generate_completion` with `max_tokens=512`).
- [ ] `apps/ai/exceptions.py` gains `AIServiceUnavailable` (`APIException`, `status_code = 503`, `default_code = "ai_service_unavailable"`).
- [ ] `TicketViewSet.summarize` (`POST`, `detail=True`, `url_path="summarize"`) — catches `AIServiceError`, raises `AIServiceUnavailable`, otherwise returns `{"summary": ...}`; `permission_map["summarize"] = Permissions.TICKETS_VIEW`.
- [ ] **No new Django model, no migration, no new permission constant.**
- [ ] `frontend/src/features/tickets/types/ticketSummary.ts`, `api/summarizeTicket.ts`, and `useSummarizeTicket` in `api/useTicketMutations.ts` (no cache invalidation).
- [ ] `TicketConversation.tsx` — a `CardAction`-slotted "Summarize" button in the header, disabled while pending; a generated summary renders in an `Alert` above the message list, with no forced text direction.
- [ ] `en.json`/`ar.json` gain `conversation.actions.summarize` and `conversation.summary.title`, both languages.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified live: an unconfigured/failing AI service returns `503 ai_service_unavailable`, not `500`; a configured call returns a real, language-matched summary; permission checks (`403`/`401`) behave as expected; the full UI walkthrough works in both languages.
- [ ] `.squad/plans/ai-features/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 76.** `AI-2` (Suggested Replies, `SUPPORTOS-84`, depends on `AI-0` + `COMM-0`, both complete), `AI-3` (Automatic Categorization, `SUPPORTOS-85`, depends on `AI-0` + `TKT-2`, both complete), `AI-4` (Suggested Solutions, `SUPPORTOS-86`, depends on `AI-0` + `KB-3`, both complete), and `AI-5` (AI Chatbot, `SUPPORTOS-87`, depends on `AI-0` + `KB-3` + `PORTAL-0`, all complete) remain unplanned and can proceed in any order — none of them depend on this story.
