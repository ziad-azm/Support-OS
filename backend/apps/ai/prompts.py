"""Shared prompt-building utilities and KB grounding — AI-0's other
reusable piece (SupportOs backlog.MD:822). `ground_with_knowledge_base`
is the named caller `apps/knowledge_base/search.py::search_knowledge_base`
was built for (Story 41 `## Story Goal`, point 1).
"""

DEFAULT_GROUNDING_LIMIT = 5


def ground_with_knowledge_base(query: str, *, limit: int = DEFAULT_GROUNDING_LIMIT) -> list[dict]:
    """Published-only KB grounding for AI features. `include_drafts` is
    always `False` here — unlike `KnowledgeBaseSearchView`'s
    permission-elevated search (Story 41), an AI-generated answer must
    never surface unpublished content to whoever reads it. Imported
    lazily inside the function, not at module scope, so `apps.ai` importing
    `apps.knowledge_base` at Django startup cannot create an app-loading
    order hazard between two independently-migrated apps.
    """
    from apps.knowledge_base.search import search_knowledge_base

    return search_knowledge_base(query, limit=limit, include_drafts=False)


def format_kb_context(results: list[dict]) -> str:
    """Render `search_knowledge_base`'s merged FAQ/Article results
    (Story 41's two result shapes) as a numbered plain-text block for
    insertion into a system prompt. Returns `""` for an empty list —
    callers append this to their own instructions unconditionally.
    """
    if not results:
        return ""
    lines = []
    for index, result in enumerate(results, start=1):
        if result["kind"] == "faq":
            lines.append(f"{index}. Q: {result['question']}\n   A: {result['answer']}")
        else:
            lines.append(f"{index}. {result['title_en']}\n   {result['headline_en'] or ''}")
    return "\n".join(lines)


def build_grounded_system_prompt(instructions: str, *, kb_query: str | None = None) -> str:
    """Compose a system prompt, optionally grounded in the knowledge base.
    The one place every AI-1..AI-5 story builds its system prompt, so
    grounding format stays consistent across features (backlog's "single
    AI integration point"). Returns `instructions` unchanged when
    `kb_query` is omitted or the search returns nothing.
    """
    if not kb_query:
        return instructions
    context = format_kb_context(ground_with_knowledge_base(kb_query))
    if not context:
        return instructions
    return f"{instructions}\n\nRelevant knowledge base context:\n{context}"


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
