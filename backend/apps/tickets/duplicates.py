"""Duplicate-candidate suggestion for the ticket merge flow — TKT-9.
Reuses the SAME Postgres full-text-search mechanism (SearchVector/
SearchQuery/SearchRank) `apps.knowledge_base.search::search_knowledge_base`
already established for KB-3 — applied to `Ticket.subject`/`description`
instead of FAQ/Article fields, since that function is model-locked and
cannot be called directly here. See Story 109 `## Prerequisites`.
"""

from datetime import timedelta

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

from .models import Ticket

DEFAULT_LIMIT = 10
# A generous but real window ("near in time," the intake's own wording) —
# the same "deliberate round number" precedent `HISTORY_MAX_ENTRIES`/
# `MAX_BULK_IDS` already set in this app. Symmetric: the true duplicate may
# have been filed either before or after this ticket.
NEAR_IN_TIME_DAYS = 90


def _subject_query(subject: str) -> SearchQuery:
    """ORs every word in the ticket's own subject together, rather than
    passing the whole subject to a single `SearchQuery` the way
    `search_knowledge_base` passes a short, user-typed query string.
    `SearchQuery`'s default `search_type="plain"` ANDs every term — correct
    for a few user-typed keywords, but a ticket subject is a full sentence,
    and two independently-written duplicate subjects almost never share
    EVERY word. OR-ing means any single shared word scores above zero, and
    `SearchRank`'s own weighting still ranks more-overlapping subjects
    higher. Verified live: an AND query over "Login broken again" scored
    every other candidate at Postgres's zero floor (`1e-20`) even against
    an obvious near-duplicate ("Login page throws an error"); the OR'd
    version scored it `~0.08`. See Story 109 `## Edge Cases & Failure Modes`.
    """
    words = [word for word in subject.split() if word]
    if not words:
        return SearchQuery("", config="simple")
    query = SearchQuery(words[0], config="simple")
    for word in words[1:]:
        query |= SearchQuery(word, config="simple")
    return query


def find_duplicate_candidates(ticket: Ticket, *, limit: int = DEFAULT_LIMIT) -> list[Ticket]:
    """The SAME customer's other, not-already-merged-away tickets, filed
    within `NEAR_IN_TIME_DAYS` of this one, ordered by full-text rank
    against THIS ticket's own subject (highest first) and then recency.

    Deliberately does NOT filter out `rank == 0` rows the way
    `search_knowledge_base` filters `rank__gt=0`: this list doubles as the
    merge dialog's ONLY target picker (no separate ticket-search UI exists
    — see `## Story Goal`), so every one of the customer's other recent
    tickets stays selectable even when its text does not literally overlap
    with this one. Rank only affects ORDER, never membership.
    """
    window_start = ticket.created_at - timedelta(days=NEAR_IN_TIME_DAYS)
    window_end = ticket.created_at + timedelta(days=NEAR_IN_TIME_DAYS)
    search_query = _subject_query(ticket.subject)
    vector = SearchVector("subject", weight="A", config="simple") + SearchVector(
        "description", weight="B", config="simple"
    )
    return list(
        Ticket.objects.filter(
            customer_id=ticket.customer_id,
            merged_into__isnull=True,
            created_at__gte=window_start,
            created_at__lte=window_end,
        )
        .exclude(pk=ticket.pk)
        .annotate(rank=SearchRank(vector, search_query))
        .order_by("-rank", "-created_at")[:limit]
    )
