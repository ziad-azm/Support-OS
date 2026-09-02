# Story 78 — Suggested Solutions (Story: SUPPORTOS-86)

## Prerequisites

- **Story 74 (`AI-0`) and Story 75 (`AI-1`) completed.** [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md), [75-story-ticket-summaries-SUPPORTOS-83.md](75-story-ticket-summaries-SUPPORTOS-83.md). Verified live, current code: `apps/ai/client.py::generate_completion`, `apps/ai/prompts.py::ground_with_knowledge_base` (lines 10-21, `limit=DEFAULT_GROUNDING_LIMIT` default of 5), `apps/ai/exceptions.py::{AIServiceError, AIServiceUnavailable}`, and `apps/tickets/summarization.py::build_conversation_transcript` — all reused unchanged. `KB-3` (Knowledge Base Search, Story 41) is complete — `ground_with_knowledge_base` is the exact reusable function its own `## Story Goal` named `AI-0` as the intended caller of; this story is a second such caller (after `AI-2`, Story 76).
- **The intake file (`.squad/stories/ai-features/SUPPORTOS-86/intake.md`) matches its own title — no shift.** Confirmed against `SupportOs backlog.MD` lines 840-844 (`STORY (AI-4) — Suggested Solutions`, `Dependencies: AI-0, KB-3`):

  > **Task: Solution-suggestion endpoint + panel** — Match ticket to KB solutions; show panel in ticket detail. Outcome: faster resolutions.

- **The AI's role here is query extraction, not answer synthesis.** "Match ticket to KB solutions" plus the panel showing plural *solutions* (not one generated answer, unlike `AI-1`'s summary or `AI-2`'s reply) is read as: distill the ticket's conversation into a short search phrase, then return `KB-3`'s own ranked results for that phrase — the same data `search_knowledge_base` already returns, not a second, LLM-synthesized narrative on top of it. This is also why the story's own dependency list names `KB-3` explicitly (the retrieval) alongside `AI-0` (the one `generate_completion` call that produces the search phrase) — a pure KB search with no AI involvement would have no reason to depend on `AI-0` at all.
- **No shared frontend module is introduced for the result-card shapes.** Verified live: `frontend/src/features/portal/components/PortalMarkdownPreview.tsx` is an already-existing, deliberate **verbatim duplicate** of `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx`, with its own docstring stating *"`no-restricted-imports` forbids importing it across the feature boundary"* — this project's own established answer to "a second feature needs the same small rendering," not a `shared/ui/` relocation. This story does not need `MarkdownPreview` at all, though: results are shown as a plain question/answer (FAQ) or a title link to the existing `ArticleReaderPage` (Article) — no `**highlighted**` snippet text is rendered, so no Markdown renderer is needed in either case. See `## Story Goal` for why.
- **This story adds no Django model, no migration, and no new permission constant.** The endpoint reuses `Permissions.TICKETS_VIEW` and `apps.ai.exceptions.AIServiceUnavailable`, both already established.
- **Verified live, this session:** `python manage.py test` reports **54** passing, the baseline this story must not change.

---

## Story Goal

Add a "Find solutions" action to the ticket detail page: an agent clicks it, the backend extracts a short search phrase from the ticket's conversation, searches the knowledge base for it (`KB-3`), and the frontend shows the ranked FAQ/Article matches in a panel — clicking an Article opens it in the existing reader page; an FAQ's answer is shown inline. Nothing is persisted or auto-run; the same click-to-generate shape `AI-1`/`AI-2` already establish for a real-cost AI action.

1. **`apps/tickets/solution_suggestions.py::find_ticket_solutions(ticket)`** — builds the conversation transcript (`AI-1`'s `build_conversation_transcript`), asks the AI for a short search phrase, and passes it to `apps.ai.prompts.ground_with_knowledge_base` (`AI-0`/`KB-3`). Returns `{"query": <str>, "results": <list[dict]>}` — `results` is `search_knowledge_base`'s own per-item shape, unmodified. Raises `AIServiceError` on failure, same contract as every other `apps.ai` consumer.
2. **`TicketViewSet.suggest_solutions`** (`POST /api/tickets/<id>/suggest-solutions/`) — the same thin-action, `AIServiceError`-to-`AIServiceUnavailable` shape as `.summarize`/`.suggest_reply`, gated `tickets.view` (a read-oriented convenience, like `.summarize`, not a mutation).
3. **Frontend**: `SuggestedSolutionsPanel`, a new self-contained section on `TicketDetailPage`, after `TicketConversation` — a button that fetches suggestions and a results list (FAQ answers inline; Article titles link to `/knowledge-base/articles/<id>`).

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/tickets/solution_suggestions.py::find_ticket_solutions` | "Match ticket to KB solutions" (backlog, `AI-4`). |
| `TicketViewSet.suggest_solutions` action | "Solution-suggestion endpoint" (backlog, `AI-4`) — the endpoint half. |
| `SuggestedSolutionsPanel` | "show panel in ticket detail" (backlog, `AI-4`) — the UI half; "faster resolutions" (backlog outcome) is what an agent clicking through to a matched article gets. |

**Not here, and why:**

- **No LLM-synthesized "recommended solution" paragraph.** See `## Prerequisites` — the backlog's plural "solutions" and "panel" (vs. `AI-1`/`AI-2`'s single generated text) point to a results list, not a second summary.
- **No `**highlighted**` snippet rendering, no `MarkdownPreview` reuse or duplication.** An FAQ's plain `answer` (already plain text elsewhere in this app, e.g. `FaqBrowsePage`) and an Article's title-only link are enough for "faster resolutions" — the agent reads the full article on `ArticleReaderPage`, which already renders its Markdown body correctly. Skipping the highlighted-snippet field entirely avoids needing `MarkdownPreview` (which `no-restricted-imports` would otherwise require duplicating, per the `PortalMarkdownPreview` precedent).
- **No persistence of past suggestions.** Same "compute on every call, nothing cached" rule `AI-1`/`AI-2`/`KB-3` already establish.
- **No new permission constant.** `tickets.view` already gates every other read-context ticket action (`.history`/`.context`/`.sla`/`.summarize`); this one follows the same rule.
- **No change to `KnowledgeBaseSearchView`, `search_knowledge_base`, or the standalone `/knowledge-base/search` page.** This story is a second caller of the same reusable function, not a modification of it.
- **No draft-content visibility.** `ground_with_knowledge_base` is hardcoded `include_drafts=False` (`AI-0`, unchanged) — an AI-suggested solution must never surface an unpublished article, the same rule already established for `AI-2`'s reply grounding.

---

## Context — Read These Files First

1. `.squad/stories/ai-features/SUPPORTOS-86/intake.md` — matches the backlog; no correction needed.
2. `SupportOs backlog.MD` lines 840-844 — the authoritative `AI-4` task text this plan implements.
3. `backend/apps/ai/prompts.py` lines 10-21 (`ground_with_knowledge_base`) — the exact function task 1 calls; note its `include_drafts=False` and default `limit=5` (`DEFAULT_GROUNDING_LIMIT`, line 7) — no `limit=` override needed.
4. `backend/apps/tickets/summarization.py` lines 26-46 (`build_conversation_transcript`) — reused unchanged as the query-extraction input.
5. `backend/apps/knowledge_base/search.py` (all 62 lines, `KB-3`) — the exact per-item result shape (`faq`: `question`/`answer`/`headline`/`rank`; `article`: `title_en`/`title_ar`/`headline_en`/`headline_ar`/`status`/`rank`) task 1's return value carries through unmodified, and task 4's frontend type mirrors.
6. `backend/apps/tickets/views.py` (current, 322 lines) — `permission_map` (lines 56-78, `"summarize"`/`"suggest_reply"` as the two most recent additions) and `.summarize` (lines 294-307) — the exact action shape task 3 mirrors (`tickets.view` gate, `AIServiceError` → `AIServiceUnavailable`).
7. `frontend/src/features/knowledge-base/components/SearchPage.tsx` (all 632 — wait, actual file is far shorter; read directly) — specifically the `result.kind === 'faq' ? ... : ...` branch shape (the discriminated-union rendering pattern task 5 adapts, simplified to drop the highlighted-snippet half).
8. `frontend/src/features/portal/components/PortalMarkdownPreview.tsx` (all 21 lines) — the direct precedent cited in `## Prerequisites` for why this story does **not** need a shared or duplicated Markdown renderer (it avoids the underlying need instead).
9. `frontend/src/features/knowledge-base/types/article.ts` lines 1-3 (`ARTICLE_STATUSES`/`ArticleStatus`) — the exact `'draft' | 'published'` literal union task 4's own (independently declared, not imported) `status` field type mirrors.
10. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (current, 209 lines) — the `TicketSlaSection`/`TicketConversation`/`TicketHistorySection`/`InternalNotesSection` stack (current lines 195-198) — task 6 inserts `SuggestedSolutionsPanel` between `TicketConversation` and `TicketHistorySection`.
11. `frontend/src/features/tickets/components/TicketConversation.tsx` (current, with `AI-1`/`AI-2`'s "Summarize"/"Suggest reply" buttons) — the `useState` + `useMutation` + `CardAction` button shape task 5's panel copies for its own "Find solutions" button.
12. `frontend/src/features/tickets/locales/{en,ar}.json` — the existing `sla`/`internalNotes` blocks (`en.json` lines 135-167) task 7's new `solutions` block sits between.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Match the ticket to KB solutions.** | Backlog, `AI-4`'s sole task | `apps/tickets/solution_suggestions.py::find_ticket_solutions`, calling `ground_with_knowledge_base` with an AI-extracted query. |
| **Show a panel in ticket detail.** | Backlog, `AI-4`'s sole task | `SuggestedSolutionsPanel` on `TicketDetailPage`. |
| **Reuse `tickets.view` — no new permission.** | This story's own design, following `.summarize`'s established precedent | `permission_map["suggest_solutions"] = Permissions.TICKETS_VIEW`. |
| **The AI's job is query extraction, not answer generation.** | This story's own design (see `## Prerequisites`) | `find_ticket_solutions` sends the transcript to `generate_completion` once, for a short phrase, then reuses `KB-3`'s own ranked results as-is. |
| **Never surface unpublished KB content.** | Established rule, `AI-0`/`AI-2` | `ground_with_knowledge_base`'s hardcoded `include_drafts=False`, unchanged. |
| **No persistence — every call re-searches from current state.** | Backlog outcome ("faster resolutions," not a saved recommendation) | `find_ticket_solutions` takes no cache/storage path; no model, no migration. |
| **An AI failure surfaces as the existing clean `503`.** | Reuse, not reinvention | `apps.ai.exceptions.AIServiceUnavailable`, unchanged. |

---

## Backend Tasks

### 1 — The solution matcher

**Create file: `backend/apps/tickets/solution_suggestions.py`**

```python
"""AI-matched knowledge-base solutions — AI-4 (Story 78), built on AI-0's
`apps.ai.client.generate_completion` and
`apps.ai.prompts.ground_with_knowledge_base` (Story 74). Reuses
`apps.tickets.summarization.build_conversation_transcript` (Story 75) for
the same ticket-plus-messages context AI-1/AI-2 already build.
"""

from apps.ai.client import generate_completion
from apps.ai.prompts import ground_with_knowledge_base

from .models import Ticket
from .summarization import build_conversation_transcript

QUERY_MAX_TOKENS = 32

_QUERY_EXTRACTION_SYSTEM = (
    "Read the support ticket conversation below and respond with ONLY a "
    "short knowledge-base search phrase (3-8 words) capturing the "
    "customer's core issue. No punctuation, no explanation — the phrase "
    "and nothing else."
)


def find_ticket_solutions(ticket: Ticket) -> dict:
    """Extracts a short search phrase from the ticket's conversation, then
    matches it against the knowledge base via AI-0's own grounding helper
    (`KB-3`'s `search_knowledge_base`, wrapped by
    `apps.ai.prompts.ground_with_knowledge_base`). Returns `{"query":
    <str>, "results": <list[dict]>}` — `results` is `search_knowledge_base`'s
    own per-item shape, unmodified. Raises
    `apps.ai.exceptions.AIServiceError` on failure — unchanged contract;
    `TicketViewSet.suggest_solutions` translates it for HTTP.
    """
    transcript = build_conversation_transcript(ticket)
    query = generate_completion(
        transcript, system=_QUERY_EXTRACTION_SYSTEM, max_tokens=QUERY_MAX_TOKENS
    ).strip()
    results = ground_with_knowledge_base(query)
    return {"query": query, "results": results}
```

**An empty or whitespace-only `query`** (a degenerate model response) reaches `ground_with_knowledge_base` → `search_knowledge_base` unchanged; Postgres's `SearchQuery('')` matches zero rows rather than raising, so this degrades to an empty `results` list, not an error — see `## Edge Cases`.

---

### 2 — The endpoint

**File: `backend/apps/tickets/views.py`** — add one import, after `from .serializers import CategorySerializer, TicketSerializer`:

```python
from .solution_suggestions import find_ticket_solutions
```

Keep alphabetical-by-module ordering — `.solution_suggestions` sorts before `.status`:

```python
from .models import Category, Ticket, TicketActivity
from .reply_suggestions import draft_reply
from .serializers import CategorySerializer, TicketSerializer
from .solution_suggestions import find_ticket_solutions
from .status import is_valid_transition
from .summarization import summarize_ticket
```

Add `"suggest_solutions": Permissions.TICKETS_VIEW,` to `TicketViewSet.permission_map` (current lines 56-78), alongside `"summarize"`:

```python
        "summarize": Permissions.TICKETS_VIEW,
        "suggest_reply": Permissions.TICKETS_MANAGE,
        "suggest_solutions": Permissions.TICKETS_VIEW,
    }
```

Add the action itself, after `.suggest_reply` (the current last method in the class):

```python
    @action(detail=True, methods=["post"], url_path="suggest-solutions")
    def suggest_solutions(self, request, pk=None):
        """AI-matched knowledge-base solutions — AI-4. Gated `tickets.view`
        alone, the same reasoning `.summarize` uses — a read-oriented
        convenience for whoever can already see the ticket, not a
        mutation.
        """
        ticket = self.get_object()
        try:
            suggestion = find_ticket_solutions(ticket)
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        return Response(suggestion)
```

`AIServiceError`/`AIServiceUnavailable` are already imported at the top of this file (Story 75) — no new exception import needed.

---

## Frontend Tasks

### 3 — Types and API layer

**Create file: `frontend/src/features/tickets/types/ticketSolutionSuggestions.ts`**

```ts
/** Mirrors `apps.knowledge_base.search.search_knowledge_base`'s two
 * per-item shapes, independently declared here — this feature does not
 * import `features/knowledge-base`'s own `SearchResult` type
 * (`no-restricted-imports`, `CONVENTIONS.md` §15). `headline`/
 * `headline_en`/`headline_ar` are present on the wire (the backend
 * returns `search_knowledge_base`'s dicts unmodified) but intentionally
 * not declared — this panel never renders the highlighted snippet. */
export type FaqSolutionMatch = {
  kind: 'faq'
  id: number
  question: string
  answer: string
  rank: number
}

export type ArticleSolutionMatch = {
  kind: 'article'
  id: number
  title_en: string
  title_ar: string
  status: 'draft' | 'published'
  rank: number
}

export type SolutionMatch = FaqSolutionMatch | ArticleSolutionMatch

/** Mirrors `TicketViewSet.suggest_solutions`'s response shape verbatim. */
export type TicketSolutionSuggestions = {
  query: string
  results: SolutionMatch[]
}
```

**Create file: `frontend/src/features/tickets/api/suggestTicketSolutions.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TicketSolutionSuggestions } from '../types/ticketSolutionSuggestions'

/** No request body — the backend rebuilds the search query and re-runs
 * the knowledge-base search from the ticket's current state on every
 * call; nothing is cached or persisted server-side. */
export function suggestTicketSolutions(id: number): Promise<TicketSolutionSuggestions> {
  return api.post<TicketSolutionSuggestions>(`/tickets/${id}/suggest-solutions/`)
}
```

---

### 4 — The mutation hook

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — add an import and one hook, after `useSuggestTicketReply`:

```ts
import { suggestTicketSolutions } from './suggestTicketSolutions'
```

```ts
// No queryClient.invalidateQueries — same reasoning as useSummarizeTicket/
// useSuggestTicketReply: finding solutions changes nothing cached; the
// caller consumes the result directly via onSuccess.
export function useSuggestTicketSolutions(id: number) {
  return useMutation({
    mutationFn: () => suggestTicketSolutions(id),
  })
}
```

---

### 5 — The panel

**Create file: `frontend/src/features/tickets/components/SuggestedSolutionsPanel.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'

import { useSuggestTicketSolutions } from '../api/useTicketMutations'
import type { TicketSolutionSuggestions } from '../types/ticketSolutionSuggestions'

export function SuggestedSolutionsPanel({ ticketId }: { ticketId: number }) {
  const { t, i18n } = useTranslation('tickets')
  const isArabic = i18n.language.startsWith('ar')

  const [suggestions, setSuggestions] = useState<TicketSolutionSuggestions | null>(null)
  const mutation = useSuggestTicketSolutions(ticketId)

  function handleSuggest() {
    mutation.mutate(undefined, {
      onSuccess: (data) => setSuggestions(data),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('solutions.title')}</h2>
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={handleSuggest}
          >
            {t('solutions.actions.suggest')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {suggestions === null ? (
          <p className="text-sm text-muted-foreground">{t('solutions.empty')}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('solutions.query', { query: suggestions.query })}
            </p>
            {suggestions.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('solutions.noMatches')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {suggestions.results.map((result) => (
                  <li key={`${result.kind}-${result.id}`} className="rounded-md border p-3">
                    {result.kind === 'faq' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.question}</span>
                          <Badge variant="secondary">{t('solutions.kinds.faq')}</Badge>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {result.answer}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/knowledge-base/articles/${result.id}`}
                          className="font-medium hover:underline"
                        >
                          {isArabic ? result.title_ar : result.title_en}
                        </Link>
                        <Badge variant="secondary">{t('solutions.kinds.article')}</Badge>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

**`result.status` is declared on the type but never rendered** — a matched Article is never a draft (`ground_with_knowledge_base` is `include_drafts=False`, `## Prerequisites`), so there is no reachable state for a draft-status badge to show; the field is kept only because it mirrors the wire shape verbatim, the same "declared but not necessarily used" convention this codebase's other mirror types already follow.

**React key combines the discriminator with `id`** (`` `${kind}-${id}` ``) — ids are only unique within a `kind`, the same rule `SearchPage.tsx` (`KB-3`) and `CONVENTIONS.md` §23 already establish for a merged FAQ/Article feed.

---

### 6 — Wire it into the ticket detail page

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — add an import, alphabetized between `InternalNotesSection` and `TicketAssigneeControl`:

```ts
import { SuggestedSolutionsPanel } from './SuggestedSolutionsPanel'
```

Insert the panel between `TicketConversation` and `TicketHistorySection` (current lines 195-198):

```tsx
                <TicketSlaSection ticketId={ticket.id} />
                <TicketConversation ticketId={ticket.id} />
                <SuggestedSolutionsPanel ticketId={ticket.id} />
                <TicketHistorySection ticketId={ticket.id} />
                <InternalNotesSection ticketId={ticket.id} />
```

---

### 7 — Locale

**File: `frontend/src/features/tickets/locales/en.json`** — add a new `solutions` block, after `sla` and before `internalNotes`:

```json
  "solutions": {
    "title": "Suggested Solutions",
    "empty": "Click \"Find solutions\" to search the knowledge base for this ticket.",
    "query": "Searched for: \"{{query}}\"",
    "noMatches": "No matching knowledge base content found.",
    "actions": {
      "suggest": "Find solutions"
    },
    "kinds": {
      "faq": "FAQ",
      "article": "Article"
    }
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the same block, translated, in the same position:

```json
  "solutions": {
    "title": "الحلول المقترحة",
    "empty": "انقر على \"البحث عن حلول\" للبحث في قاعدة المعرفة عن هذه التذكرة.",
    "query": "تم البحث عن: \"{{query}}\"",
    "noMatches": "لم يتم العثور على محتوى مطابق في قاعدة المعرفة.",
    "actions": {
      "suggest": "البحث عن حلول"
    },
    "kinds": {
      "faq": "الأسئلة الشائعة",
      "article": "مقالة"
    }
  },
```

---

## Edge Cases & Failure Modes

- **`ANTHROPIC_API_KEY` is unconfigured, or the AI provider errors/times out.** `find_ticket_solutions` raises `AIServiceError` during the query-extraction call; `TicketViewSet.suggest_solutions` catches it and raises `AIServiceUnavailable` — the same clean `503 ai_service_unavailable` path `AI-1`/`AI-2` already established. No knowledge-base search is even attempted in this case (the failure happens before `ground_with_knowledge_base` is called).
- **The extracted query is empty or whitespace-only** (a degenerate model response, e.g. the model returns nothing before hitting `QUERY_MAX_TOKENS`) — `ground_with_knowledge_base("")` → `search_knowledge_base("")` matches zero rows in Postgres (an empty `SearchQuery` is valid, not an error); the response is `{"query": "", "results": []}`, rendered as the "no matching knowledge base content found" empty state, not a failure.
- **No `FAQ`/`Article` rows match the extracted query at all** — `results` is `[]`; the panel shows `solutions.noMatches`, distinct from the pre-click `solutions.empty` state.
- **A ticket with zero messages** (only its `description`) — `build_conversation_transcript` still returns a valid transcript (`AI-1` `## Edge Cases`); the query-extraction call proceeds normally against the initial report alone.
- **Two rapid clicks of "Find solutions"** — `mutation.isPending` disables the button for the duration of the in-flight request, the same guard every other AI action button in this app already uses.
- **A matched Article is a draft** — cannot happen: `ground_with_knowledge_base` is hardcoded `include_drafts=False` (`AI-0`), so `results` never contains an unpublished article. `SolutionMatch`'s `status` field exists only because it is present on the wire (mirroring `search_knowledge_base`'s own per-item shape); the panel does not branch on it.
- **The agent lacks `knowledge_base.view`** and clicks through to an Article result — the existing `/knowledge-base/articles/:id` route guard (from `KB-3`) handles this the same way it does for any other entry point into that route; this story adds no new authorization surface for the article-reader page itself.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — confirms `apps/tickets/solution_suggestions.py` and `apps/tickets/views.py`'s new import/action import cleanly.
2. `python manage.py test` — reports the same **54** passing as before this story (no model, no migration).
3. `ruff format --check .` / `ruff check .` over the new/changed Python files.
4. `npm run build` — typechecks `TicketSolutionSuggestions`/`SolutionMatch`, the new `useSuggestTicketSolutions` hook, and `SuggestedSolutionsPanel`'s discriminated-union rendering.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the extended `tickets` namespace (`solutions.*`).
7. Real HTTP/Django-shell verification plus a browser walkthrough in both languages — `## Verification Steps`.

---

## Migration / Rollback

**No migration in this story.** No model changed.

**Rollback:** revert the commits (`apps/tickets/solution_suggestions.py`, `apps/tickets/views.py`, and the five frontend files/edits). Nothing to reverse at the database level.

**Half-applied states to avoid:**

- **`views.py`'s new action added before `solution_suggestions.py` exists** → `ImportError` at Django startup, caught immediately by `python manage.py check`.
- **`permission_map["suggest_solutions"]` omitted** — falls through to authenticated-only rather than denying (`CONVENTIONS.md` §22), still inconsistent with every sibling read-context action — add it in the same change as the action.
- **`SuggestedSolutionsPanel` imported into `TicketDetailPage.tsx` without also being added to the render tree** — a lint-clean but functionally incomplete change; verify visually in Step 7.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing, unchanged.
3. **Unconfigured behavior, verified via a real HTTP call** (with `ANTHROPIC_API_KEY` blank): `POST /api/tickets/<id>/suggest-solutions/` as an authenticated user holding `tickets.view` → `503`, envelope `{code: "ai_service_unavailable", ...}` — same shape as `AI-1`/`AI-2`.
4. **Configured behavior, with a real key set in `backend/.env`:** the same request on a ticket whose subject/description matches an existing published `FAQ`/`Article` (see `AI-0`'s own Verification Step 5 for the seeded data) → `200`, envelope `data: {query: "<short phrase>", results: [...]}` with at least one match.
5. **No-match behavior:** the same request on a ticket about something with no KB coverage → `200`, `results: []`.
6. **Permission check:** the same request with `tickets.view` stripped from the caller's role → `403`; with no token at all → `401`.
7. **The UI walkthrough.** `npm run dev` with the backend up and a real key configured: open a ticket, click "Find solutions" in the new panel — the button disables while pending, then the extracted query and the ranked results appear; an FAQ result shows its answer inline, an Article result links to `/knowledge-base/articles/<id>` and opens the real article. Switch to Arabic and repeat — labels and Article titles (via `title_ar`) are in Arabic.
8. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps/tickets/solution_suggestions.py` — `find_ticket_solutions(ticket)`, extracting a short query via `generate_completion` and reusing `ground_with_knowledge_base` for retrieval.
- [ ] `TicketViewSet.suggest_solutions` (`POST`, `detail=True`, `url_path="suggest-solutions"`) — catches `AIServiceError`, raises `AIServiceUnavailable`, otherwise returns `{"query": ..., "results": [...]}`; `permission_map["suggest_solutions"] = Permissions.TICKETS_VIEW`.
- [ ] **No new Django model, no migration, no new permission constant, no new AI exception type.**
- [ ] `frontend/src/features/tickets/types/ticketSolutionSuggestions.ts`, `api/suggestTicketSolutions.ts`, and `useSuggestTicketSolutions` in `api/useTicketMutations.ts` (no cache invalidation).
- [ ] `SuggestedSolutionsPanel.tsx` — "Find solutions" button, disabled while pending; renders the extracted query, an empty state, a no-matches state, and a results list (FAQ inline, Article linked).
- [ ] `TicketDetailPage.tsx` — `SuggestedSolutionsPanel` wired in between `TicketConversation` and `TicketHistorySection`.
- [ ] `en.json`/`ar.json` gain a `solutions` block, both languages, key-parity verified.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified live: an unconfigured/failing AI service returns `503 ai_service_unavailable`; a configured call returns a real extracted query plus ranked, published-only KB matches; a no-match ticket returns an empty list, not an error; permission checks (`403`/`401`) behave as expected; the full UI walkthrough works in both languages.
- [ ] `.squad/plans/ai-features/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 79.** `AI-5` (AI Chatbot, `SUPPORTOS-87`, depends on `AI-0` + `KB-3` + `PORTAL-0`, all complete) is the only remaining unplanned `ai-features` story.
