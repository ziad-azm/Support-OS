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
    articles = (
        Article.objects.all()
        if include_drafts
        else Article.objects.filter(status=Article.Status.PUBLISHED)
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
