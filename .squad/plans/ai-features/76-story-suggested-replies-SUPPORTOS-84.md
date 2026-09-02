# Story 76 — Suggested Replies (Story: SUPPORTOS-84)

## Prerequisites

- **Story 74 (`AI-0`, AI Service Foundation) and Story 75 (`AI-1`, Ticket Summaries) completed.** [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md), [75-story-ticket-summaries-SUPPORTOS-83.md](75-story-ticket-summaries-SUPPORTOS-83.md). Verified live, current code: `apps/ai/client.py::generate_completion`, `apps/ai/prompts.py::build_grounded_system_prompt` (53 lines), `apps/ai/exceptions.py::{AIServiceError, AIServiceUnavailable}` (33 lines), and `apps/tickets/summarization.py::build_conversation_transcript` (63 lines, function at lines 26-46) all exist and are reused verbatim or extended by this story.
- **The intake file (`.squad/stories/ai-features/SUPPORTOS-84/intake.md`) matches its own title this time — no shift.** Confirmed against `SupportOs backlog.MD` lines 828-832 (`STORY (AI-2) — Suggested Replies`, `Dependencies: AI-0, COMM-0`):

  > **Task: Suggested-reply endpoint + UI** — Draft replies from ticket + KB context; surface in shared conversation view. Outcome: faster quality replies.

- **`COMM-0` (Messaging Core / Channel Adapter, Story 13) is complete** — same conversation data (`apps.communications.models.Message`) `AI-1` already consumes via `build_conversation_transcript`, reused here rather than rebuilt.
- **This story refactors a small piece of Story 75's shipped code, not its plan file.** `apps/tickets/summarization.py`'s private `_LANGUAGE_NAMES`/`_DEFAULT_LANGUAGE_NAME` dict and inline `get_language()` resolution (current lines 7, 22-23, 56) is AI-prompt machinery, not ticket-domain logic — it was only in `apps.tickets` because `AI-1` was its first consumer. This story is the second consumer (`suggest_reply` also needs to phrase its system prompt in the caller's language), which is exactly the "a second real consumer appears" trigger `CONVENTIONS.md` §8 already uses for shared-vs-local placement (there stated for frontend `shared/`, the same reasoning applies to `apps.ai` as the shared home for cross-feature AI-prompt utilities). Task 1 moves it to `apps/ai/prompts.py` as `resolve_language_name()`, and updates `summarization.py` to call it — [75-story-ticket-summaries-SUPPORTOS-83.md](75-story-ticket-summaries-SUPPORTOS-83.md) itself stays untouched; this is normal incremental code evolution across stories in the same app, the same way `TicketViewSet` has been extended by every `TKT-*`/`SLA-*`/`AI-*` story in sequence.
- **This story adds no Django model, no migration, and no new permission constant.** The endpoint reuses `Permissions.TICKETS_MANAGE` — see `## Product rules` for why (a different permission than `AI-1`'s `TICKETS_VIEW`, deliberately).
- **Verified live, this session:** `python manage.py test` reports **54** passing, the baseline this story must not change.

---

## Story Goal

Add a "Suggest reply" action next to the existing Quick Reply picker in the shared conversation view's reply form: an agent clicks it, the backend drafts a reply from the ticket's conversation plus any relevant knowledge-base context, and the frontend fills the reply body with the result — the same "fill, don't send" interaction the Quick Reply picker already establishes, generated instead of templated.

1. **`apps/ai/prompts.py::resolve_language_name()`** — extracted from `apps/tickets/summarization.py` (see `## Prerequisites`), the shared "requesting caller's UI language as a plain English name" helper both `AI-1` and this story's `AI-2` need.
2. **`apps/tickets/reply_suggestions.py::draft_reply(ticket)`** — builds the same transcript `AI-1` uses (`build_conversation_transcript`), grounds a system prompt in the knowledge base via `apps.ai.prompts.build_grounded_system_prompt(instructions, kb_query=ticket.subject)`, and calls `generate_completion`. Raises `AIServiceError` on failure, same contract as `summarize_ticket`.
3. **`TicketViewSet.suggest_reply`** (`POST /api/tickets/<id>/suggest-reply/`) — the same thin-action, `AIServiceError`-to-`AIServiceUnavailable` shape as `.summarize` (`AI-1`), but gated `tickets.manage` (see `## Product rules`).
4. **Frontend**: a "Suggest reply" button next to the Quick Reply select inside `ReplyForm` (`TicketConversation.tsx`), filling the reply body on success exactly like `handleQuickReplySelect` already does.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/ai/prompts.py::resolve_language_name` | Second real consumer of the language-resolution logic `AI-1` first wrote — relocated to the shared AI-prompt module (`## Prerequisites`). |
| `apps/tickets/reply_suggestions.py::draft_reply` | "Draft replies from ticket + KB context" (backlog, `AI-2`). |
| `TicketViewSet.suggest_reply` action | "Suggested-reply endpoint" (backlog, `AI-2`) — the endpoint half. |
| `ReplyForm`'s "Suggest reply" button | "surface in shared conversation view" (backlog, `AI-2`) — the UI half; "faster quality replies" (backlog outcome) is what filling the body field with a drafted reply gives the agent. |

**Not here, and why:**

- **No new AI exception type.** `apps.ai.exceptions.AIServiceUnavailable` (`AI-1`) is reused as-is — this is exactly the "reusable by every later AI-* view" case its own docstring names.
- **No auto-send.** The drafted reply fills the form's `body` field the same way a Quick Reply template does; the agent still reviews and clicks the existing "Send" button. Nothing in the backlog's outcome ("faster quality replies") implies skipping agent review, and auto-sending unreviewed AI text would be a materially different (and riskier) feature this story does not build.
- **No persistence of the draft.** Same "compute on every call, nothing cached" rule `AI-1`/`KB-3`/`SLA-1` already establish for derived AI/read data in this codebase.
- **No new permission constant.** `tickets.manage` already gates the entire `ReplyForm` (`<Can permission="tickets.manage"><ReplyForm .../></Can>`, `TicketConversation.tsx` current line 113) — drafting a reply is part of the same "can this user actually reply" capability, not a separate one.
- **No change to `MessageSerializer`/`TicketSerializer`/`QuickReply`.** `suggest_reply` is a new, additive action reusing existing form-filling mechanics; the Quick Reply feature (Story 33) is untouched.

---

## Context — Read These Files First

1. `.squad/stories/ai-features/SUPPORTOS-84/intake.md` — matches the backlog this time; no correction needed.
2. `SupportOs backlog.MD` lines 828-832 — the authoritative `AI-2` task text this plan implements.
3. `backend/apps/ai/prompts.py` (all 53 lines) — `build_grounded_system_prompt` (lines 41-53), the function `draft_reply` calls directly; task 1 adds `resolve_language_name` here.
4. `backend/apps/tickets/summarization.py` (all 63 lines) — `_LANGUAGE_NAMES`/`_DEFAULT_LANGUAGE_NAME` (lines 22-23) and their inline use (line 56) move out in task 1; `build_conversation_transcript` (lines 26-46) is reused unchanged by task 2.
5. `backend/apps/ai/exceptions.py` (all 33 lines, current) — `AIServiceError`/`AIServiceUnavailable`, reused verbatim, no changes.
6. `backend/apps/tickets/views.py` lines 1-23 (imports) and lines 47-74 (`TicketViewSet.permission_map`, note `"assign"`/`"set_status"`/`"escalate"` all map to `Permissions.TICKETS_MANAGE` — the precedent `"suggest_reply"` follows) and lines 292-304 (`.summarize`, `AI-1`) — the exact action shape task 4 mirrors.
7. `frontend/src/features/tickets/components/TicketConversation.tsx` (all 219 lines, current) — `ReplyForm` (lines 142-218), specifically `handleQuickReplySelect` (lines 157-163, the exact `form.setValue('body', ..., { shouldValidate: true, shouldDirty: true })` overwrite-outright shape task 6's `handleSuggestReply` copies) and the Quick Reply `<Select>` block (lines 183-200, where the new button sits alongside).
8. `frontend/src/features/tickets/api/useTicketMutations.ts` (current, with `useSummarizeTicket` already added by Story 75) — the exact `useMutation` shape (no `queryClient.invalidateQueries`) task 5's `useSuggestTicketReply` copies.
9. `frontend/src/features/tickets/types/ticketSummary.ts` and `api/summarizeTicket.ts` (Story 75) — the exact "one-field response type + thin `api.post` wrapper" shape task 4/5's new files copy for the reply-suggestion equivalent.
10. `frontend/src/features/tickets/locales/{en,ar}.json` — the existing `conversation.actions` block (`en.json`, current, inside the `conversation` object) task 7 extends with `suggestReply`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Draft a reply from the ticket's conversation plus KB context.** | Backlog, `AI-2`'s sole task | `apps/tickets/reply_suggestions.py::draft_reply`, calling `build_conversation_transcript` + `build_grounded_system_prompt(..., kb_query=ticket.subject)`. |
| **Surface it in the shared conversation view.** | Backlog, `AI-2`'s sole task | `ReplyForm`'s new "Suggest reply" button, filling `body` the same way Quick Reply does. |
| **Gate on `tickets.manage`, matching the reply form itself.** | This story's own design, following the existing `<Can permission="tickets.manage">` wrapper around `ReplyForm` | `permission_map["suggest_reply"] = Permissions.TICKETS_MANAGE`. |
| **KB grounding uses the ticket's subject as the search term, not the full transcript.** | This story's own design | A full transcript is prose, not search keywords — Postgres full-text ranking (`KB-3`) is tuned for a short query, the same reasoning a human agent searching the KB by topic would use; see `## Edge Cases` for the no-match fallback. |
| **The draft overwrites the reply body outright, like a Quick Reply template.** | Established precedent, `ReplyForm`'s own code comment (current lines 150-153, Story 33) | `handleSuggestReply` calls `form.setValue('body', ..., { shouldValidate: true, shouldDirty: true })`, identical to `handleQuickReplySelect`. |
| **No persistence — every call redrafts from current state.** | Backlog outcome ("faster quality replies," not an audit trail) | `draft_reply` takes no cache/storage path; no model, no migration. |
| **An AI failure surfaces as the existing clean `503`.** | Reuse, not reinvention (`AI-1`'s own forward intent) | `apps.ai.exceptions.AIServiceUnavailable`, unchanged. |

---

## Backend Tasks

### 1 — Relocate the language-resolution helper to `apps.ai`

**File: `backend/apps/ai/prompts.py`** — add, after `build_grounded_system_prompt`:

```python
LANGUAGE_NAMES = {"en": "English", "ar": "Arabic"}
DEFAULT_LANGUAGE_NAME = "English"


def resolve_language_name() -> str:
    """The requesting caller's UI language as a plain English name, for
    instructing the model to respond in that language. Reads
    `django.utils.translation.get_language()`, resolved by the existing
    `LocaleMiddleware` from the frontend's `Accept-Language` header
    (`CONVENTIONS.md` §18) — extending that resolved-language pattern to
    AI-generated text, first established by `apps.tickets.summarization`
    (Story 75) and moved here once a second consumer (this story)
    appeared. Falls back to `"English"` for a language outside
    `LANGUAGES` in `base.py` (only `en`/`ar` today), degrading
    gracefully rather than raising if a third language is ever added
    without updating this dict.
    """
    from django.utils.translation import get_language

    return LANGUAGE_NAMES.get(get_language(), DEFAULT_LANGUAGE_NAME)
```

`get_language` is imported inside the function, matching `ground_with_knowledge_base`'s own lazy-import style already in this file (line 19) — a plain deferred stdlib/Django import here, not a cross-app one, but kept consistent with the file's existing pattern.

**File: `backend/apps/tickets/summarization.py`** — remove the now-relocated pieces and use the shared helper instead:

Replace:

```python
from django.utils.translation import get_language

from apps.ai.client import generate_completion
from apps.communications.models import Message

from .models import Ticket
```

with:

```python
from apps.ai.client import generate_completion
from apps.ai.prompts import resolve_language_name
from apps.communications.models import Message

from .models import Ticket
```

Remove the two lines:

```python
_LANGUAGE_NAMES = {"en": "English", "ar": "Arabic"}
_DEFAULT_LANGUAGE_NAME = "English"
```

In `summarize_ticket`, replace:

```python
    language_name = _LANGUAGE_NAMES.get(get_language(), _DEFAULT_LANGUAGE_NAME)
```

with:

```python
    language_name = resolve_language_name()
```

No other line in `summarization.py` changes; `build_conversation_transcript` is untouched.

---

### 2 — The reply drafter

**Create file: `backend/apps/tickets/reply_suggestions.py`**

```python
"""AI-drafted reply suggestions — AI-2 (Story 76), built on AI-0's
`apps.ai.client.generate_completion` and
`apps.ai.prompts.build_grounded_system_prompt` (Story 74). Reuses
`apps.tickets.summarization.build_conversation_transcript` (Story 75) —
the intake's "Draft replies from ticket" text names the same
ticket-plus-messages input `AI-1` already builds.
"""

from apps.ai.client import generate_completion
from apps.ai.prompts import build_grounded_system_prompt, resolve_language_name

from .models import Ticket
from .summarization import build_conversation_transcript

MAX_TOKENS = 1024


def draft_reply(ticket: Ticket) -> str:
    """Draft a reply to the ticket's conversation, grounded in the
    knowledge base via the ticket's subject — a short, stable search
    term across a whole thread; the full transcript is prose, not
    keywords, and would rank poorly against `KB-3`'s full-text search
    (see Story 76 `## Edge Cases`). Raises
    `apps.ai.exceptions.AIServiceError` on failure — unchanged contract;
    `TicketViewSet.suggest_reply` translates it for HTTP.
    """
    transcript = build_conversation_transcript(ticket)
    language_name = resolve_language_name()
    instructions = (
        "You are a support agent's reply-drafting assistant. Draft a "
        "professional, concise reply to the customer's most recent "
        "message in the conversation below, addressing their issue "
        "directly. Use the knowledge base context only if it is "
        f"actually relevant. Respond in {language_name}."
    )
    system = build_grounded_system_prompt(instructions, kb_query=ticket.subject)
    return generate_completion(transcript, system=system, max_tokens=MAX_TOKENS)
```

---

### 3 — The endpoint

**File: `backend/apps/tickets/views.py`** — add one import, after `from .status import is_valid_transition`:

```python
from .reply_suggestions import draft_reply
```

Keep alphabetical-by-module ordering — `.reply_suggestions` sorts before `.serializers`, so it goes between `from .models import ...` and `from .serializers import ...`:

```python
from .assignment import apply_assignment, assignable_agents
from .context import build_ticket_context
from .escalation import apply_escalation
from .history import build_history
from .models import Category, Ticket, TicketActivity
from .reply_suggestions import draft_reply
from .serializers import CategorySerializer, TicketSerializer
from .status import is_valid_transition
from .summarization import summarize_ticket
```

Add `"suggest_reply": Permissions.TICKETS_MANAGE,` to `TicketViewSet.permission_map` (current lines 53-74), alongside `"assign"`/`"set_status"`/`"escalate"` (the other `TICKETS_MANAGE`-gated actions):

```python
        "assign": Permissions.TICKETS_MANAGE,
        "assignable_agents": Permissions.TICKETS_VIEW,
        "set_status": Permissions.TICKETS_MANAGE,
        "escalate": Permissions.TICKETS_MANAGE,
        "history": Permissions.TICKETS_VIEW,
        "context": Permissions.TICKETS_VIEW,
        "sla": Permissions.TICKETS_VIEW,
        "summarize": Permissions.TICKETS_VIEW,
        "suggest_reply": Permissions.TICKETS_MANAGE,
    }
```

Add the action itself, after `.summarize` (the current last method in the class):

```python
    @action(detail=True, methods=["post"], url_path="suggest-reply")
    def suggest_reply(self, request, pk=None):
        """AI-drafted reply suggestion — AI-2. Gated `tickets.manage`,
        matching `ReplyForm`'s own gate (`<Can permission="tickets.manage">`,
        `TicketConversation.tsx`) — only a user who could actually send a
        reply gets to draft one.
        """
        ticket = self.get_object()
        try:
            reply = draft_reply(ticket)
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        return Response({"reply": reply})
```

`AIServiceError`/`AIServiceUnavailable` are already imported at the top of this file (Story 75) — no new exception import needed.

---

## Frontend Tasks

### 4 — Types and API layer

**Create file: `frontend/src/features/tickets/types/ticketReplySuggestion.ts`**

```ts
/** Mirrors `TicketViewSet.suggest_reply`'s response shape verbatim. */
export type TicketReplySuggestion = {
  reply: string
}
```

**Create file: `frontend/src/features/tickets/api/suggestTicketReply.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TicketReplySuggestion } from '../types/ticketReplySuggestion'

/** No request body — the backend rebuilds the transcript and KB
 * grounding from the ticket's current state on every call; nothing is
 * cached or persisted server-side. */
export function suggestTicketReply(id: number): Promise<TicketReplySuggestion> {
  return api.post<TicketReplySuggestion>(`/tickets/${id}/suggest-reply/`)
}
```

---

### 5 — The mutation hook

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — add an import and one hook, after `useSummarizeTicket` (added by Story 75):

```ts
import { suggestTicketReply } from './suggestTicketReply'
```

```ts
// No queryClient.invalidateQueries — same reasoning as useSummarizeTicket
// (Story 75): drafting a reply changes nothing cached; the caller
// consumes the result directly via onSuccess.
export function useSuggestTicketReply(id: number) {
  return useMutation({
    mutationFn: () => suggestTicketReply(id),
  })
}
```

---

### 6 — The UI

**File: `frontend/src/features/tickets/components/TicketConversation.tsx`** — add an import, after `useSummarizeTicket`:

```ts
import { useSuggestTicketReply } from '../api/useTicketMutations'
```

(Both hooks live in the same module, so this becomes a single combined import: `import { useSuggestTicketReply, useSummarizeTicket } from '../api/useTicketMutations'`, alphabetized.)

Inside `ReplyForm`, add the mutation and handler, after `const quickReplies = quickRepliesQuery.data?.items ?? []`:

```ts
  const suggestReplyMutation = useSuggestTicketReply(ticketId)

  function handleSuggestReply() {
    suggestReplyMutation.mutate(undefined, {
      onSuccess: (data) => {
        form.setValue('body', data.reply, { shouldValidate: true, shouldDirty: true })
      },
    })
  }
```

Change the Quick Reply block to sit alongside the new button in one row:

```tsx
        <div className="flex flex-wrap items-center gap-2">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={suggestReplyMutation.isPending}
            onClick={handleSuggestReply}
          >
            {t('conversation.actions.suggestReply')}
          </Button>
        </div>
```

`Button` is already imported in this file (Story 75, for the "Summarize" action) — no new import needed for it.

**The draft overwrites `body` outright, exactly like `handleQuickReplySelect`** — no merge/append, no confirmation dialog, matching the established precedent in this same form (current lines 150-153).

---

### 7 — Locale

**File: `frontend/src/features/tickets/locales/en.json`** — inside the existing `conversation.actions` object, add `suggestReply` after `summarize`:

```json
    "actions": {
      "send": "Send",
      "summarize": "Summarize",
      "suggestReply": "Suggest reply"
    },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the same addition, translated:

```json
    "actions": {
      "send": "إرسال",
      "summarize": "تلخيص",
      "suggestReply": "اقتراح رد"
    },
```

---

## Edge Cases & Failure Modes

- **`ANTHROPIC_API_KEY` is unconfigured, or the AI provider errors/times out.** Same `AIServiceError` → `AIServiceUnavailable` → `503 ai_service_unavailable` path `AI-1` already established; the frontend's shared `MutationCache.onError` toast surfaces it, no second error UI needed.
- **The ticket's subject yields no knowledge-base match.** `build_grounded_system_prompt` (Story 74, verified live) already falls back to the plain `instructions` string with no "Relevant knowledge base context:" block appended — `draft_reply` still produces an ungrounded (but conversation-grounded) reply rather than failing. Not an error case.
- **A ticket with zero messages** (only its `description`) — `build_conversation_transcript` still returns a valid transcript; the drafted reply addresses the initial report alone, the same "not an error case" `AI-1` `## Edge Cases` already documents for this exact input shape.
- **Clicking "Suggest reply" after already typing text in the body field** — the draft **replaces** whatever was there, matching `handleQuickReplySelect`'s existing, already-shipped behavior (Story 33) for the same textarea. An agent who wants to keep their own draft simply does not click the button.
- **Two rapid clicks of "Suggest reply"** — `suggestReplyMutation.isPending` disables the button for the duration of the in-flight request, the same guard `AI-1`'s "Summarize" button and every other action button in this app already use.
- **The requesting agent's UI language is neither `en` nor `ar`** — `resolve_language_name()` falls back to `"English"` (see task 1), unchanged behavior from `AI-1`, now shared rather than duplicated.
- **Switching tickets (navigating to a different ticket detail page) after drafting a reply** — `ReplyForm`/`TicketConversation` remount for the new `ticketId`; any drafted-but-unsent text in the previous ticket's form is gone, the same way any other unsaved form state in this app is not preserved across navigation.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — confirms `apps/ai/prompts.py`'s addition, `apps/tickets/summarization.py`'s edit, the new `apps/tickets/reply_suggestions.py`, and `apps/tickets/views.py`'s new import/action all import cleanly.
2. `python manage.py test` — reports the same **54** passing as before this story (no model, no migration).
3. `ruff format --check .` / `ruff check .` over the new/changed Python files.
4. `npm run build` — typechecks `TicketReplySuggestion`, the new `useSuggestTicketReply` hook, and `ReplyForm`'s new state/JSX.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the extended `tickets` namespace (`conversation.actions.suggestReply`).
7. Real HTTP/Django-shell verification plus a browser walkthrough in both languages — `## Verification Steps`.

---

## Migration / Rollback

**No migration in this story.** No model changed.

**Rollback:** revert the commits (`apps/ai/prompts.py`, `apps/tickets/summarization.py`, `apps/tickets/reply_suggestions.py`, `apps/tickets/views.py`, and the four frontend files/edits). Nothing to reverse at the database level.

**Half-applied states to avoid:**

- **`apps/tickets/summarization.py` edited to call `resolve_language_name()` before task 1's `apps/ai/prompts.py` addition lands** → `ImportError` at Django startup, caught immediately by `python manage.py check`.
- **`views.py`'s new action added before `reply_suggestions.py` exists** → same `ImportError` failure mode, same immediate catch.
- **`permission_map["suggest_reply"]` omitted** — per `CONVENTIONS.md` §22, falls through to authenticated-only rather than denying; still not a security hole, but inconsistent with every sibling `TICKETS_MANAGE` action — add it in the same change as the action.
- **The Quick Reply `<Select>` and new `<Button>` left in separate, unstyled blocks instead of the single `flex flex-wrap items-center gap-2` row** — not a functional bug, but a layout regression from the intended "both fill-body actions grouped together" design; verify visually in Step 6.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing, unchanged.
3. **Unconfigured behavior, verified via a real HTTP call** (with `ANTHROPIC_API_KEY` blank): `POST /api/tickets/<id>/suggest-reply/` as an authenticated user holding `tickets.manage` → `503`, envelope `{code: "ai_service_unavailable", ...}`, not `500` — same shape as `AI-1` Step 3.
4. **Configured behavior, with a real key set in `backend/.env`:** the same request on a ticket with at least one message → `200`, envelope `data: {reply: "<drafted text>"}`. Repeat with `Accept-Language: ar` and confirm the reply is written in Arabic.
5. **KB grounding, verified via Django shell**, against a ticket whose subject matches an existing published FAQ/Article (see `AI-0`'s own Verification Step 5 for the seeded data): `draft_reply(ticket)` produces a reply that references the matched content; a ticket with a subject guaranteed to match nothing still produces a plain, ungrounded reply, not an error.
6. **Permission check:** the same request as a user holding `tickets.view` but not `tickets.manage` → `403`; with no token at all → `401`.
7. **The UI walkthrough.** `npm run dev` with the backend up and a real key configured: open a ticket with conversation history, click "Suggest reply" next to (or in place of) the Quick Reply picker — the button disables while pending, then the reply textarea fills with the drafted text. Typing something first and then clicking "Suggest reply" replaces it outright. Switch to Arabic and repeat — the button label and the drafted reply content are both in Arabic.
8. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps/ai/prompts.py` gains `LANGUAGE_NAMES`, `DEFAULT_LANGUAGE_NAME`, `resolve_language_name()`.
- [ ] `apps/tickets/summarization.py` no longer defines its own `_LANGUAGE_NAMES`/`_DEFAULT_LANGUAGE_NAME`; `summarize_ticket` calls `apps.ai.prompts.resolve_language_name()` instead.
- [ ] `apps/tickets/reply_suggestions.py` — `draft_reply(ticket)`, reusing `build_conversation_transcript`, grounded via `ticket.subject`, `max_tokens=1024`.
- [ ] `TicketViewSet.suggest_reply` (`POST`, `detail=True`, `url_path="suggest-reply"`) — catches `AIServiceError`, raises `AIServiceUnavailable`, otherwise returns `{"reply": ...}`; `permission_map["suggest_reply"] = Permissions.TICKETS_MANAGE`.
- [ ] **No new Django model, no migration, no new permission constant, no new AI exception type.**
- [ ] `frontend/src/features/tickets/types/ticketReplySuggestion.ts`, `api/suggestTicketReply.ts`, and `useSuggestTicketReply` in `api/useTicketMutations.ts` (no cache invalidation).
- [ ] `ReplyForm` — a "Suggest reply" button alongside the Quick Reply select, disabled while pending, filling `body` outright on success via the same `form.setValue(..., { shouldValidate: true, shouldDirty: true })` shape Quick Reply uses.
- [ ] `en.json`/`ar.json` gain `conversation.actions.suggestReply`, both languages.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified live: an unconfigured/failing AI service returns `503 ai_service_unavailable`; a configured call returns a real, language-matched, KB-grounded-when-relevant reply; permission checks (`403`/`401`) behave as expected; the full UI walkthrough works in both languages.
- [ ] `.squad/plans/ai-features/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 77.** `AI-3` (Automatic Categorization, `SUPPORTOS-85`, depends on `AI-0` + `TKT-2`, both complete), `AI-4` (Suggested Solutions, `SUPPORTOS-86`, depends on `AI-0` + `KB-3`, both complete), and `AI-5` (AI Chatbot, `SUPPORTOS-87`, depends on `AI-0` + `KB-3` + `PORTAL-0`, all complete) remain unplanned and can proceed in any order — none of them depend on this story.
