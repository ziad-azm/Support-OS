# Story 41 — Knowledge Base Search (Story: SUPPORTOS-54)

## Prerequisites

- **Stories 39 (`KB-1`, FAQs) and 40 (`KB-2`, Help Articles & Guides)
  completed and implemented**, as the intake's own "Dependencies: KB-1,
  KB-2" states —
  [39-story-faqs-SUPPORTOS-51.md](39-story-faqs-SUPPORTOS-51.md),
  [40-story-help-articles-guides-SUPPORTOS-53.md](40-story-help-articles-guides-SUPPORTOS-53.md).
  Verified live in this codebase: `apps/knowledge_base/models.py` has `FAQ`
  (`question`, `answer`, `order`) and `Article` (`title_en`/`title_ar`/
  `body_en`/`body_ar`, `category`, `status`); both are gated by the existing
  `Permissions.KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE`
  (`backend/apps/core/permissions.py:33-34`); `ArticleViewSet.get_queryset`
  (`backend/apps/knowledge_base/views.py:77-84`) already hides drafts from
  non-managers.
- **This story adds no new Django model, no new permission, no migration.**
  It is a read-only aggregation over the two existing models — the same
  shape `apps/customers/timeline.py::build_timeline` (Story 20) and
  `apps/tickets/history.py::build_history` (Story 24) already establish for
  "merge two querysets into one ranked/ordered feed."
- **Verified live against this project's actual Postgres instance** (not
  assumed): `django.contrib.postgres.search`'s `SearchVector`/`SearchQuery`/
  `SearchRank`/`SearchHeadline` all work with **no** `django.contrib.postgres`
  app registration and **no new migration** — confirmed by running real
  queries against `FAQ`/`Article` rows in this project's dev database during
  planning. Also verified: **`SELECT cfgname FROM pg_ts_config` includes
  `'arabic'`** on this Postgres instance (this project's is new enough to
  ship it as a built-in text-search configuration — not every Postgres
  version does), so per-language stemming for `Article`'s `_ar` fields is a
  real, working option, not a hopeful assumption.
- **A single combined `SearchQuery`, OR'd across three text-search configs,
  correctly matches vectors built with any of those configs** — verified
  directly: `SearchQuery('password', config='simple') |
  SearchQuery('password', config='english') | SearchQuery('password',
  config='arabic')` returned a nonzero rank against both a `'simple'`-only
  vector (`FAQ`) and an `'english'`/`'arabic'`-mixed vector (`Article`), and
  the same combined query with an Arabic term (`'كلمة'`) matched the
  `'arabic'`-configured half of `Article`'s vector. This is what lets one
  query object serve both models' differently-configured vectors — see
  task 1.
- **`SearchHeadline`'s `start_sel`/`stop_sel` can be set to Markdown's own
  bold syntax (`**`)** — verified: `SearchHeadline('answer', query,
  config='simple', start_sel='**', stop_sel='**', ...)` returned
  `'settings and click reset **password**'`. Rendering that string through
  the **already-existing** `MarkdownPreview`
  (`frontend/src/features/knowledge-base/components/MarkdownPreview.tsx`,
  Story 40) highlights the match with **zero new HTML-safety surface** —
  no second `dangerouslySetInnerHTML`-adjacent concern, no new sanitizer.
  This is the reasoning behind task 1's `start_sel='**', stop_sel='**'`
  choice; see `## Story Goal`.
- Verified: `backend/apps/knowledge_base/urls.py` (13 lines) has a
  `SimpleRouter` with `urlpatterns = router.urls`. Task 2 changes this to
  `router.urls + [path(...)]`, the first plain (non-router) path in this
  app.
- Verified: `backend/apps/core/permissions.py`'s `HasPermission` docstring
  (**lines 84–86**) already documents a method-keyed `permission_map`
  fallback for a plain `APIView` with no `self.action` — **this story is
  the first real caller of that fallback branch.**
- Verified: `frontend/src/features/customers/components/CustomerListPage.tsx`
  **lines 17, 33–39** — the `SEARCH_DEBOUNCE_MS = 300` debounce pattern this
  story's `SearchPage` copies verbatim.
- Verified: `frontend/src/shared/lib/api/client.ts` **lines 134–137**
  (`api.get<T>(url, config?)`) accepts an `AxiosRequestConfig` (so
  `{ params: { q } }` works) and unwraps to a **plain** `data` value — this
  endpoint returns a plain JSON array (`Response(results)`, not a DRF
  paginated queryset), so the frontend call is `api.get<SearchResult[]>`,
  **not** `api.getPage`.

---

## Story Goal

Ship one ranked, cross-content search: a reusable backend function over
`FAQ` and `Article` together, a thin read-only endpoint over it, and a
search screen that reuses this feature's own existing states/primitives
(`QueryBoundary`, `Card`, `Badge`, `MarkdownPreview`) with no new ones.

1. `apps/knowledge_base/search.py::search_knowledge_base(query, *, limit,
   include_drafts)` — Postgres full-text search across `FAQ.question`/
   `answer` and `Article.title_en`/`title_ar`/`body_en`/`body_ar`, ranked
   and merged into one list, each result tagged with a `kind` discriminator
   (`"faq"` / `"article"`) the same way `build_timeline`'s entries already
   are. **This is the 🔑 reusable piece** the intake calls out — a later
   AI story (`AI-0`, `SupportOs backlog.MD:646`) calls this same function
   directly for grounding, not through the HTTP view.
2. `GET /api/search/?q=<term>` (`KnowledgeBaseSearchView`) — a thin `APIView`
   wrapper, gated `knowledge_base.view`, elevating to `include_drafts=True`
   for a caller holding `knowledge_base.manage` (the same permission-scoped
   visibility rule `ArticleViewSet.get_queryset` already established,
   Story 40).
3. `SearchPage` at `/knowledge-base/search` — a debounced search input plus
   a merged, ranked results feed (`<ul>`-shaped, not a `DataTable` — a
   heterogeneous FAQ/Article feed has none of the sortable/paginated
   properties `DataTable` is for, the same call `build_timeline`'s own
   frontend consumer already makes). Reuses `MarkdownPreview` to render each
   result's Markdown-highlighted snippet.
4. Cross-links: a nav entry, plus a link from `FaqBrowsePage` and
   `ArticleBrowsePage` to `/knowledge-base/search`, so all three
   knowledge-base screens reach each other — completing the pattern
   Story 40 started between just those two.

### Why full-text search, not `icontains`/the existing `search_fields`

`FAQViewSet`/`ArticleViewSet` already have basic DRF `SearchFilter`
`search_fields` (substring match, no ranking) — that is what Story 39/40
explicitly deferred to this story. Postgres full-text search adds
**ranking** (`SearchRank`, so a title match outranks a body match — see the
`weight="A"`/`weight="B"` split in task 1) and **stemming** (`config=
"english"`/`"arabic"` — "resetting" matches a query for "reset"), neither
of which substring matching provides. This is what "ranked search" in the
intake's own outcome line means.

### Why one combined `SearchQuery` across three configs, not per-model queries

`FAQ` has no language field — its `question`/`answer` could be written in
either language (or both), so it is indexed with `config="simple"` (no
stemming, since applying English or Arabic stemming rules to
untagged-language text would silently corrupt matches for whichever
language it guessed wrong). `Article` **does** know its language per field
(`_en`/`_ar`), so each half of its vector uses the matching stemmed config.
A single query string from the search box does not know which of these
three configs it should be parsed with, so it is parsed as **all three,
OR'd together** — verified (see `## Prerequisites`) to correctly match
whichever side's vector actually applies. This is not a query run three
times; it is one `SearchQuery` expression Postgres evaluates once per row.

### Why no persisted `SearchVectorField`, no GIN index, no save-hook

Django's documented "correct at scale" full-text search pattern is a
persisted `SearchVectorField` column, kept in sync via a `pre_save` signal
or a trigger, with a `GinIndex`. This story computes the vector inline via
`.annotate()` on every request instead — the same "compute on every read
instead of caching/persisting, because the read is cheap enough to redo"
call `apps/sla/policy.py::compute_sla_status` (Story 28) already makes for
this codebase. `FAQ`/`Article` are help-content tables, not transactional
data — dozens to low hundreds of rows, not millions. If this ever becomes
a real performance problem, the fix is exactly Django's documented pattern;
nothing about `search_knowledge_base`'s public shape needs to change for
that migration to happen later.

### Why results are capped and unpaginated, not a `DataTable`

A merged FAQ+Article feed is heterogeneous (two different row shapes, no
shared sortable field, no shared page size), the same reasoning
`build_timeline`'s ticket+message feed already established. `DEFAULT_LIMIT
= 20` (task 1) caps the response; there is no pagination UI, matching
`TicketViewSet.assignable_agents`'s own "a plain capped list, no
`DefaultPageNumberPagination`" precedent (Story 22).

### Explicitly out of scope

- **A persisted `SearchVectorField`/GIN index/save-hook** — see above; a
  forward note, not a decision this story defers indefinitely.
- **The `AI-0` grounding call itself** — this story ships the function
  `AI-0` will call; it does not call it from anywhere but
  `KnowledgeBaseSearchView`.
- **Typo-tolerance/fuzzy matching** (`pg_trgm`, `SIMILARITY`) — Postgres
  full-text search's stemming already covers the intake's "quick answer
  discovery" bar; fuzzy matching is a distinct feature with its own
  extension (`CREATE EXTENSION pg_trgm`) this story does not install.
- **Search-term highlighting inside the FAQ/Article detail pages
  themselves** (only the search results feed shows highlighted snippets).
- **Automated tests.** Standing policy (`CONVENTIONS.md` §16).

---

## Context — Read These Files First

1. `.squad/stories/knowledge-base/SUPPORTOS-54/intake.md` — two task blocks,
   `Dependencies: KB-1, KB-2`, no attachments, no acceptance criteria. Done
   Criteria derive from the two **Outcome** lines ("ranked search + reusable
   retrieval for AI" / "quick answer discovery").
2. [40-story-help-articles-guides-SUPPORTOS-53.md](40-story-help-articles-guides-SUPPORTOS-53.md)
   in full — every backend/frontend file this story touches was created or
   last touched by that story.
3. `backend/apps/knowledge_base/models.py` (current) — `FAQ.question`/
   `answer` (single-language), `Article.title_en`/`title_ar`/`body_en`/
   `body_ar` (per-language fields), `Article.Status.PUBLISHED`.
4. `backend/apps/knowledge_base/views.py` (current, 85 lines) —
   `ArticleViewSet.get_queryset` **lines 77–84**, the permission-scoped
   visibility rule task 2's `KnowledgeBaseSearchView` reuses identically.
5. `backend/apps/knowledge_base/urls.py` (current, 19 lines) — the
   `SimpleRouter`; task 2 changes `urlpatterns = router.urls` to
   `router.urls + [path("search/", ...)]`.
6. `backend/apps/core/permissions.py` **lines 89–103** (`HasPermission`) —
   `_required_permission`'s `action`-then-method fallback; this story's
   `permission_map = {"get": Permissions.KNOWLEDGE_BASE_VIEW}` is keyed by
   HTTP method because a plain `APIView` has no `self.action`.
7. `backend/apps/customers/timeline.py` (all 72 lines) — `build_timeline`:
   the exact "merge two queryset-derived lists into one dict list, sort by
   the ranking key, slice to a cap" shape `search_knowledge_base` copies,
   substituting `rank` (descending) for `occurred_at` (descending).
8. `backend/config/api_urls.py` (current, 23 lines) — confirm the existing
   `path("", include("apps.knowledge_base.urls"))` line already covers the
   new `search/` path; **no edit to this file**.
9. `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx`
   (all 13 lines) — the exact component the search results feed reuses
   as-is for highlighted snippets; **no changes to this file**.
10. `frontend/src/features/customers/components/CustomerListPage.tsx`
    **lines 17, 33–39** — the debounce pattern `SearchPage` copies.
11. `frontend/src/shared/ui/QueryBoundary.tsx` (all 49 lines) — `isEmpty`/
    `empty` props, reused for the "no results" state.
12. `frontend/src/shared/lib/api/client.ts` **lines 134–137** — `api.get`
    accepts `{ params }` and returns the plain unwrapped `data`.
13. `frontend/src/app/router.tsx` (current, 250 lines) — the existing
    `knowledge_base.view` block, **lines 186–214**. Task 5 adds one more
    child route to it.
14. `frontend/src/app/RootLayout.tsx` (current, 68 lines) — the
    `knowledge_base.view`-gated `<Can>` block, **lines 38–45**. Task 5 adds
    a third link inside it, beside FAQs/Articles.
15. `frontend/src/features/knowledge-base/components/{FaqBrowsePage,
    ArticleBrowsePage}.tsx` — the existing cross-link buttons Story 40
    established between these two screens; task 5 adds a third link to
    `/knowledge-base/search` on both.
16. `CONVENTIONS.md` §16, §19, §23 (especially the `build_timeline`/
    `build_history` "heterogeneous feed is a `<ul>`" rule and the two KB-2
    addenda on permission-scoped visibility and bilingual content) — the
    template every task below follows.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Full-text search API, reusable by AI suggestions.** | Intake, task 1 | `apps/knowledge_base/search.py::search_knowledge_base` — a plain function, importable with no HTTP dependency, the same shape `build_timeline`/`build_history` already are. |
| **Ranked results.** | Intake, task 1 | `SearchRank` per model, `weight="A"` on titles/questions and `weight="B"` on bodies/answers, merged and sorted descending. |
| **Search UI, reusing primitives/states.** | Intake, task 2 | `SearchPage` composes `Input`, `QueryBoundary`, `Card`, `Badge`, `MarkdownPreview` — no new shared component. |
| Reuse `AUTHZ`; no new permission. | `## Story Goal` | `knowledge_base.view` gates the endpoint; `knowledge_base.manage` elevates visibility, mirroring `ArticleViewSet.get_queryset`. |
| Config from `ENV`; no new dependency. | Story 01 `ENV` contract | `django.contrib.postgres.search` ships with Django/psycopg, already installed; no new package on either side. |

---

## Backend Tasks

### 1 — The reusable search function

**Create file: `backend/apps/knowledge_base/search.py`**

```python
"""Cross-content full-text search — KB-3. A plain function, not a view: the
🔑 reusable piece the intake calls out (`AI-0`'s KB grounding calls this
directly, per `SupportOs backlog.MD:646`), the same "app that owns the
question implements build_X, the view is a thin wrapper" shape
`apps/customers/timeline.py::build_timeline` already established.
"""

from django.contrib.postgres.search import SearchHeadline, SearchQuery, SearchRank, SearchVector

from .models import FAQ, Article

# A help-content table, not transactional data — dozens to low hundreds of
# rows. Computing the vector on every request instead of persisting a
# SearchVectorField is the same "compute over cache when the read is cheap
# enough to redo" call `apps/sla/policy.py::compute_sla_status` already
# makes. See Story 41 `## Story Goal` for the forward note if this changes.
DEFAULT_LIMIT = 20

# Markdown's own bold syntax as the highlight marker: the returned headline
# renders through the EXISTING `MarkdownPreview` component with zero new
# HTML-safety surface — verified, see `## Prerequisites`.
_HEADLINE_KWARGS = {
    "start_sel": "**",
    "stop_sel": "**",
    "max_words": 35,
    "min_words": 15,
    "max_fragments": 2,
}


def _combined_query(query: str) -> SearchQuery:
    """One parse per config, OR'd together. `FAQ` has no language field
    (indexed `simple`); `Article` has one per field (`english`/`arabic`).
    A query string does not know in advance which of the three it needs —
    OR'ing all three is what lets one `SearchQuery` match whichever side's
    vector actually applies. Verified against this project's Postgres
    instance; see Story 41 `## Prerequisites`.
    """
    return (
        SearchQuery(query, config="simple")
        | SearchQuery(query, config="english")
        | SearchQuery(query, config="arabic")
    )


def search_knowledge_base(
    query: str, *, limit: int = DEFAULT_LIMIT, include_drafts: bool = False
) -> list[dict]:
    """Ranked FAQ + Article results for `query`, merged into one list.

    `include_drafts` mirrors `ArticleViewSet.get_queryset`'s own
    permission-scoped visibility rule (Story 40) — the caller (the HTTP
    view, or a future AI caller) decides whether the requesting context
    may see unpublished articles; this function does not check permissions
    itself.
    """
    search_query = _combined_query(query)

    faq_vector = SearchVector("question", weight="A", config="simple") + SearchVector(
        "answer", weight="B", config="simple"
    )
    faqs = (
        FAQ.objects.annotate(
            rank=SearchRank(faq_vector, search_query),
            headline=SearchHeadline("answer", search_query, config="simple", **_HEADLINE_KWARGS),
        )
        .filter(rank__gt=0)
        .order_by("-rank")[:limit]
    )

    article_vector = (
        SearchVector("title_en", weight="A", config="english")
        + SearchVector("body_en", weight="B", config="english")
        + SearchVector("title_ar", weight="A", config="arabic")
        + SearchVector("body_ar", weight="B", config="arabic")
    )
    articles = Article.objects.all() if include_drafts else Article.objects.filter(
        status=Article.Status.PUBLISHED
    )
    articles = (
        articles.annotate(
            rank=SearchRank(article_vector, search_query),
            headline_en=SearchHeadline(
                "body_en", search_query, config="english", **_HEADLINE_KWARGS
            ),
            headline_ar=SearchHeadline(
                "body_ar", search_query, config="arabic", **_HEADLINE_KWARGS
            ),
        )
        .filter(rank__gt=0)
        .order_by("-rank")[:limit]
    )

    results = [
        {
            "kind": "faq",
            "id": faq.id,
            "question": faq.question,
            "answer": faq.answer,
            "headline": faq.headline,
            "rank": faq.rank,
        }
        for faq in faqs
    ] + [
        {
            "kind": "article",
            "id": article.id,
            "title_en": article.title_en,
            "title_ar": article.title_ar,
            "headline_en": article.headline_en,
            "headline_ar": article.headline_ar,
            "status": article.status,
            "rank": article.rank,
        }
        for article in articles
    ]

    # Each side is already capped to `limit` and sorted descending, so the
    # merged top `limit` can only be drawn from each side's own top `limit`
    # — the same "slice before merge is exact, not approximate" reasoning
    # `build_timeline` documents (Story 20).
    results.sort(key=lambda result: result["rank"], reverse=True)
    return results[:limit]
```

**Cross-source rank scores are not perfectly comparable** — `FAQ`'s
`'simple'`-config rank and `Article`'s `'english'`/`'arabic'`-config ranks
come from different tsvector weightings, so a merged sort is a reasonable
ordering, not a mathematically calibrated one across sources. Documented in
`## Edge Cases`, not solved with a normalisation scheme — see
`## Story Goal` for why that would be over-engineering at this table size.

---

### 2 — The endpoint

**File: `backend/apps/knowledge_base/views.py`** — add imports and one view.

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .search import search_knowledge_base

# ... existing imports/viewsets stay ...


class KnowledgeBaseSearchView(APIView):
    """Ranked full-text search across FAQs and articles — KB-3. The first
    plain `APIView` in this project whose `permission_map` is keyed by HTTP
    method rather than DRF `action` — `HasPermission`'s own docstring
    already documents this fallback (`apps/core/permissions.py:84-86`) but
    had no real caller before this story.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.KNOWLEDGE_BASE_VIEW}

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            raise ValidationError({"q": [_("Must be at least 2 characters.")]})
        include_drafts = Permissions.KNOWLEDGE_BASE_MANAGE in permissions_for(request.user)
        return Response(search_knowledge_base(query, include_drafts=include_drafts))
```

`from apps.core.permissions import HasPermission` is added to the existing
`from apps.core.permissions import Permissions, permissions_for` import
line (making it `Permissions, permissions_for, HasPermission` — `views.py`
does not currently import `HasPermission` directly, since every existing
viewset gets it for free through `BaseModelViewSet`; a plain `APIView` must
set `permission_classes` itself, per `CONVENTIONS.md` §13's standing note).

**File: `backend/apps/knowledge_base/urls.py`** — add the plain path
alongside the router's URLs.

```python
from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import ArticleViewSet, CategoryViewSet, FAQViewSet, KnowledgeBaseSearchView

app_name = "knowledge_base"

router = SimpleRouter()
router.register("faqs", FAQViewSet, basename="faq")
router.register("articles", ArticleViewSet, basename="article")
router.register("article-categories", CategoryViewSet, basename="article-category")

urlpatterns = router.urls + [
    path("search/", KnowledgeBaseSearchView.as_view(), name="search"),
]
```

Endpoint: `GET /api/search/?q=<term>`. **No edit to
`backend/config/api_urls.py`** — the existing `include()` line already
covers it.

---

## Frontend Tasks

### 3 — Types and API layer

**Create file: `frontend/src/features/knowledge-base/types/searchResult.ts`**

```ts
import type { ArticleStatus } from './article'

export type FaqSearchResult = {
  kind: 'faq'
  id: number
  question: string
  answer: string
  headline: string
  rank: number
}

export type ArticleSearchResult = {
  kind: 'article'
  id: number
  title_en: string
  title_ar: string
  headline_en: string
  headline_ar: string
  status: ArticleStatus
  rank: number
}

/** Mirrors `apps.knowledge_base.search.search_knowledge_base`'s per-item
 * shape verbatim. The `kind` discriminator is what makes this a
 * discriminated union — narrow on it before reading kind-specific fields,
 * the same pattern a merged `build_timeline`/`build_history` feed already
 * needs on the frontend. */
export type SearchResult = FaqSearchResult | ArticleSearchResult
```

**Create file: `frontend/src/features/knowledge-base/api/searchKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const searchKeys = featureKey('knowledge-base-search')
```

**Create file: `frontend/src/features/knowledge-base/api/getSearchResults.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { SearchResult } from '../types/searchResult'

// Not `api.getPage` — the endpoint returns a plain, capped, unpaginated
// array (`Response(search_knowledge_base(...))`), not a DRF-paginated
// queryset. See Story 41 `## Prerequisites`.
export function getSearchResults(query: string): Promise<SearchResult[]> {
  return api.get<SearchResult[]>('/search/', { params: { q: query } })
}
```

**Create file: `frontend/src/features/knowledge-base/api/useSearch.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getSearchResults } from './getSearchResults'
import { searchKeys } from './searchKeys'

// Mirrors the backend's own `len(query) < 2` guard (apps/knowledge_base/views.py)
// so the UI never fires a request the server would just reject — a UX
// nicety, not the enforcement point (CONVENTIONS.md §12).
const MIN_QUERY_LENGTH = 2

export function useSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: searchKeys.resource('results', trimmed),
    queryFn: () => getSearchResults(trimmed),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
  })
}
```

---

### 4 — The search screen

**Create file: `frontend/src/features/knowledge-base/components/SearchPage.tsx`**

Composition, following `CustomerListPage.tsx`'s debounce pattern
(`SEARCH_DEBOUNCE_MS = 300`, `useState` + `useEffect`/`setTimeout`):

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Input } from '@/shared/ui/primitives/input'
import { Empty } from '@/shared/ui/Empty'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { MarkdownPreview } from './MarkdownPreview'
import { useSearch } from '../api/useSearch'
import type { SearchResult } from '../types/searchResult'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function SearchPage() {
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')

  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [input])

  const searchQuery = useSearch(query)
  const hasEnoughInput = query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('search.title')}</h1>
      <Input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.title')}
      />
      {!hasEnoughInput ? (
        <p className="text-sm text-muted-foreground">{t('search.prompt')}</p>
      ) : (
        <QueryBoundary
          query={searchQuery}
          isEmpty={(results) => results.length === 0}
          empty={
            <Empty title={t('search.empty')} description={t('search.emptyDescription')} />
          }
        >
          {(results) => (
            <div className="flex flex-col gap-3">
              {results.map((result: SearchResult) =>
                result.kind === 'faq' ? (
                  <Card key={`faq-${result.id}`}>
                    <CardHeader>
                      <CardTitle>{result.question}</CardTitle>
                      <Badge variant="secondary">{t('search.kinds.faq')}</Badge>
                    </CardHeader>
                    <CardContent>
                      <MarkdownPreview>{result.headline || result.answer}</MarkdownPreview>
                    </CardContent>
                  </Card>
                ) : (
                  <Card key={`article-${result.id}`}>
                    <CardHeader>
                      <CardTitle>
                        <Link to={`/knowledge-base/articles/${result.id}`}>
                          {isArabic ? result.title_ar : result.title_en}
                        </Link>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{t('search.kinds.article')}</Badge>
                        {result.status !== 'published' ? (
                          <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <MarkdownPreview>
                        {(isArabic ? result.headline_ar : result.headline_en) || ''}
                      </MarkdownPreview>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}
        </QueryBoundary>
      )}
    </div>
  )
}
```

**React key combines the discriminator with `id`** (`` `faq-${id}` `` /
`` `article-${id}` ``) — ids are only unique within a `kind`, the same rule
`CONVENTIONS.md` §23 already states for `build_timeline`'s merged feed.
**Not a `DataTable`** — see `## Story Goal`.

---

### 5 — Locale, routes, and cross-links

**File: `frontend/src/features/knowledge-base/locales/en.json`** — add a
`search` top-level key beside the existing `title`/`manage`/`browse`/
`articles` keys:

```json
{
  "search": {
    "title": "Search knowledge base",
    "placeholder": "Search FAQs and articles…",
    "prompt": "Type at least 2 characters to search.",
    "empty": "No results",
    "emptyDescription": "Try a different search term.",
    "kinds": {
      "faq": "FAQ",
      "article": "Article"
    }
  }
}
```

**Update `frontend/src/features/knowledge-base/locales/ar.json`** with the
identical `search` key set, translated.

**File: `frontend/src/app/router.tsx`** — one more child in the existing
`knowledge_base.view` block (**lines 186–214**), alongside
`knowledge-base`/`knowledge-base/articles`/`knowledge-base/articles/:id`:

```tsx
              {
                path: 'knowledge-base/search',
                lazy: async () => {
                  const { SearchPage } =
                    await import('@/features/knowledge-base/components/SearchPage')
                  return { element: <SearchPage /> }
                },
              },
```

No route-order hazard — `knowledge-base/search` is a literal path with no
`:id` sibling to collide with.

**File: `frontend/src/app/RootLayout.tsx`** — a third link inside the
existing `knowledge_base.view`-gated `<Can>` block (after the Articles
link, **line 44**):

```tsx
              <Button asChild variant="ghost" size="sm">
                <Link to="/knowledge-base/search">{t('knowledgeBase:search.title')}</Link>
              </Button>
```

**File: `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx`**
and **`ArticleBrowsePage.tsx`** — add a matching link to
`/knowledge-base/search` beside each screen's existing cross-link button
(`FaqBrowsePage`'s Articles link, `ArticleBrowsePage`'s header), completing
the three-way cross-link Story 40 started between just FAQs and Articles.

---

## Edge Cases & Failure Modes

- **A query shorter than 2 characters is rejected server-side** (`400
  validation_error`, `fields: {"q": [...]}`) — the frontend's own
  `MIN_QUERY_LENGTH` guard (`useSearch.ts`) keeps this from ever actually
  firing in normal use, but the backend remains the real boundary
  (`CONVENTIONS.md` §12); a hand-crafted request with `q=a` still gets a
  clean field error, not a 500.
- **Cross-source rank scores are not perfectly comparable** — `FAQ`'s
  `'simple'`-config rank and `Article`'s `'english'`/`'arabic'`-config
  ranks are computed against different tsvector weightings. The merged
  sort is a reasonable relevance ordering across sources, not a
  mathematically calibrated one; within a single source, ordering is
  correct. Accepted for this story's table sizes — see `## Story Goal`.
- **A view-only caller never sees a draft article in search results** —
  `include_drafts` (task 1) mirrors `ArticleViewSet.get_queryset`'s
  existing rule exactly; a manager's search results include drafts (marked
  with the same draft `Badge` the manage table and browse screen already
  use).
- **A term that matches only via one language's stemming still returns the
  bilingual pair.** `Article`'s result always carries both `title_en`/
  `title_ar` and both `headline_en`/`headline_ar`, regardless of which
  language actually matched — the frontend picks by `i18n.language`, the
  same rule Story 40 established for the reader/browse screens. An Arabic
  query against an English-only-matching article can therefore surface an
  **empty** `headline_ar` if nothing in `body_ar` matched — `|| ''` in
  `SearchPage` guards this (an empty `MarkdownPreview` renders nothing, not
  an error).
- **`SearchHeadline`'s `**` markers only ever wrap matched terms** — a
  result with no highlightable fragment (e.g. the match was in a title,
  not the body) returns a headline with no `**` in it at all, which is
  still valid, harmless Markdown (renders as plain text). Not an error
  case, just a plainer-looking result.
- **No index means every search does a full scan of `FAQ`/`Article` at
  request time.** Acceptable at this table's expected size (see
  `## Story Goal`); if it stops being acceptable, the fix is a persisted
  `SearchVectorField` + `GinIndex` + a `pre_save` hook, not a change to
  `search_knowledge_base`'s signature or return shape.
- **`KnowledgeBaseSearchView` is a plain `APIView`, so it has no
  `get_queryset`/`get_object` to inherit `BaseModelViewSet`'s defaults
  from.** `permission_classes = [IsAuthenticated, HasPermission]` is set
  explicitly on the view itself, per `CONVENTIONS.md` §13's standing note
  for exactly this case (`HealthView`/`ApiNotFoundView` are the only prior
  examples, both `AllowAny` rather than gated).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No
test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — no migration is generated by this story, so
   there is nothing for `MigrationStateTests` to catch, but `check` still
   confirms the new view/urls wiring imports cleanly.
2. `ruff format --check .` / `ruff check .` over the new Python.
3. `npm run build` — typechecks `SearchResult`'s discriminated union, the
   `result.kind === 'faq'` narrowing in `SearchPage`, and every new
   `t('knowledgeBase:search…')` key.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison for the extended `knowledgeBase`
   namespace.
6. Real HTTP/Django-shell ranking and permission checks, plus a browser
   walkthrough in both languages (Verification Steps 3–8).

---

## Migration / Rollback

**No migration in this story** — `search_knowledge_base` reads existing
`FAQ`/`Article` rows with no schema change. Rollback is reverting the
commits; nothing to reverse at the database level.

**Half-applied states to avoid:**

- **Task 2's view/urls before task 1's `search.py` exists** → an
  `ImportError` on Django startup, not a runtime 500 — caught immediately
  by `python manage.py check`.
- **Task 5's routes before task 4's `SearchPage` exists** → the lazy import
  fails at build time, not silently at runtime.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py
   check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports the same passing
   count as before this story (no migration, no model change).
3. **Ranking and stemming, verified directly.** Via `python manage.py shell`
   or a Django-shell `APIClient` (`override_settings(ALLOWED_HOSTS=["*"])`):
   create one `FAQ` and one published `Article` that both mention a shared
   English term (e.g. "password") and confirm
   `search_knowledge_base("password")` returns both, ranked, with non-empty
   `headline`/`headline_en` containing `**password**`. Repeat with an
   Arabic term against `Article.body_ar`/`title_ar` and confirm
   `headline_ar` is populated and `headline_en` is empty.
4. **`q` validation.** `GET /api/search/?q=a` → `400 validation_error`,
   `fields: {"q": [...]}`, not a 500. `GET /api/search/` (no `q` at all) →
   the same.
5. **Draft visibility in search matches `ArticleViewSet`'s own rule.**
   Create a `draft` article containing a unique term found nowhere else.
   Search for that term as a `knowledge_base.manage` holder → it appears.
   Temporarily strip `knowledge_base.manage` (keep `knowledge_base.view`)
   and search again → it does **not** appear. Restore the permission
   afterward.
6. **No permission → 401/403 as usual.** `GET /api/search/?q=test` with no
   token → 401 `not_authenticated`. (Every seeded role already holds
   `knowledge_base.view`, so a 403 case requires manually stripping it from
   a test role first, the same way Steps 5/6 in Story 39/40 do.)
7. **The UI walkthrough.** `npm run dev` with the backend up: `/knowledge-base/search`
   accepts input, waits ~300 ms, then shows results; typing a single
   character shows the "type at least 2 characters" prompt instead of
   firing a request (confirm via the browser's network panel); a FAQ result
   shows its full answer (with any matched term bolded); an Article result
   links to its reader page and shows a bolded snippet; a no-match query
   shows the empty state.
8. **Both languages, RTL included, cross-links present.** Switch to
   Arabic: the search screen, its empty state, and both result card shapes
   are all translated; `FaqBrowsePage`/`ArticleBrowsePage`/`SearchPage` each
   link to the other two.
9. **The full gate set, in CI order:** from `frontend/` — `npm run lint`,
   `npm run format:check`, `npm run check:rtl`, `npm run build`. All four
   exit 0.

---

## Done Criteria

- [ ] `apps/knowledge_base/search.py::search_knowledge_base(query, *,
      limit=20, include_drafts=False)` — a plain, HTTP-independent
      function; the first real caller of `HasPermission`'s method-keyed
      `permission_map` fallback lives in the view that wraps it, not in
      this function itself.
- [ ] The combined `SearchQuery` is OR'd across `simple`/`english`/`arabic`
      configs; `FAQ`'s vector is `simple`-only; `Article`'s vector splits
      `english` (`_en` fields) / `arabic` (`_ar` fields), each weighted
      `A` (title/question) / `B` (body/answer).
- [ ] `SearchHeadline` uses `start_sel='**', stop_sel='**'` so highlighted
      snippets render through the existing `MarkdownPreview` with no new
      HTML-safety surface.
- [ ] `include_drafts` mirrors `ArticleViewSet.get_queryset`'s existing
      permission-scoped visibility rule — no drift between the two.
- [ ] **No new Django model, no new permission constant, no new
      migration.**
- [ ] `KnowledgeBaseSearchView` is a plain `APIView` with
      `permission_classes` set explicitly and a method-keyed
      `permission_map`; `GET /api/search/?q=<term>` returns a plain,
      unpaginated, capped (`DEFAULT_LIMIT = 20`) list.
- [ ] `apps/knowledge_base/urls.py`'s `urlpatterns` is `router.urls +
      [path("search/", ...)]`; no change to `config/api_urls.py`.
- [ ] A query under 2 characters is a `validation_error` on `q`, not a 500.
- [ ] `features/knowledge-base/` gains `types/searchResult.ts` (a
      discriminated union on `kind`), `api/{searchKeys,getSearchResults,
      useSearch}.ts` (using `api.get`, **not** `api.getPage`), and
      `components/SearchPage.tsx`.
- [ ] `SearchPage` debounces at 300 ms (matching `CustomerListPage`), uses
      `QueryBoundary` (not `DataTable`), and keys each result
      `` `${kind}-${id}` ``.
- [ ] Route `knowledge-base/search` added to the existing
      `knowledge_base.view` block; `RootLayout` and both
      `FaqBrowsePage`/`ArticleBrowsePage` gain a link to it, completing the
      three-way cross-link between all knowledge-base screens.
- [ ] Verified: ranking/stemming across both languages (Step 3); `q`
      validation (Step 4); draft visibility matches `ArticleViewSet`'s
      existing rule exactly (Step 5); both languages walk through cleanly
      (Step 8).
- [ ] `python manage.py test` count unchanged; `ruff format --check .`,
      `ruff check .`, `npm run lint`, `npm run format:check`,
      `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/knowledge-base/00-overview.md` updated with this
      story's row.

**STOP HERE. Report to the user and wait for confirmation.** EPIC 9
(Knowledge Base) is now fully planned: `KB-1`/`KB-2`/`KB-3` complete the
FAQ, Article, and search surfaces this story's own `search_knowledge_base`
already prepares for reuse by the still-unplanned `AI-0` (AI provider
client + prompt/util layer, `SupportOs backlog.MD:646`) and `PORTAL-4`
(Access FAQs, depends on `KB-1`/`KB-2`, not this story).
