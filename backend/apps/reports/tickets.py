"""Ticket-specific report queries — RPT-1.

`aggregation.py` deliberately "knows nothing about a ticket" (its own
docstring, lines 6-8): it takes a queryset and a field name. Everything
that DOES know what a ticket is lives here — which dimensions are
reportable, and how a ticket acquires a "channel" it has no field for.
The same split `apps/knowledge_base/search.py` and `apps/sla/policy.py`
already use: the app that owns the question implements the helper, the
view is a thin wrapper.
"""

from django.db.models import OuterRef, QuerySet, Subquery
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.communications.models import Message

# The annotation alias `with_origin_channel` adds. Named once so the
# whitelist below and the annotation cannot drift.
ORIGIN_CHANNEL_FIELD = "origin_channel"

# A ticket created in the staff UI has no inbound message, so no origin
# channel — 6 of 11 rows in this project's current database. Counted under
# this key rather than dropped: dropping them would understate total volume
# by more than half, and "created directly" is itself a real answer to
# "where do our tickets come from". Translated for display on the frontend
# via the `channels.direct` locale key, NOT here — a report row carries a
# raw enum-ish value, the same rule `TicketActivity.from_value` follows.
DIRECT_CHANNEL = "direct"

# The dimensions `?series=`/`?dimension=` accept, mapped to the queryset
# field each resolves to. A whitelist, not `getattr` on user input: an
# arbitrary `?dimension=customer__email` would otherwise be a working
# data-extraction endpoint for anyone with `reports.view`.
DIMENSION_FIELDS = {
    "status": "status",
    "priority": "priority",
    "category": "category__name",
    "channel": ORIGIN_CHANNEL_FIELD,
}


def parse_dimension(query_params, param: str, *, required: bool) -> str | None:
    """`?<param>=` as one of DIMENSION_FIELDS' keys.

    `required=False` (the volume report's `?series=`) returns None when the
    param is absent — one total line, not a split. `required=True` (the
    breakdown's `?dimension=`) raises rather than guessing which axis the
    caller meant. Either way an unknown value raises DRF `ValidationError`
    naming the valid keys, the same shape `parse_bucket` uses
    (`aggregation.py:104-112`).
    """
    raw = query_params.get(param)
    if raw is None:
        if required:
            valid = ", ".join(sorted(DIMENSION_FIELDS))
            raise ValidationError({param: [_("Must be one of: %(valid)s.") % {"valid": valid}]})
        return None
    if raw not in DIMENSION_FIELDS:
        valid = ", ".join(sorted(DIMENSION_FIELDS))
        raise ValidationError({param: [_("Must be one of: %(valid)s.") % {"valid": valid}]})
    return raw


def with_origin_channel(queryset: QuerySet) -> QuerySet:
    """`queryset` annotated with `origin_channel` — the channel of each
    ticket's EARLIEST INBOUND message, or NULL when it has none.

    Inbound only: an agent's outbound reply says how we answered, not how
    the ticket arrived, and `Message.direction` has no default precisely
    because the two must never be interchangeable
    (`apps/communications/models.py:33-37`).

    A `Subquery`, not a persisted field: a stored `Ticket.origin_channel`
    would need a backfill migration plus an edit to every channel adapter's
    create path, to answer one report. Verified against this project's
    Postgres — the alias is a valid `.values()` key and a valid
    `exclude(...__isnull=True)` target, so `grouped_counts` consumes it with
    no change. See Story 56 `## Product rules`.
    """
    origin = (
        Message.objects.filter(ticket=OuterRef("pk"), direction=Message.Direction.INBOUND)
        .order_by("created_at")
        .values("channel")[:1]
    )
    return queryset.annotate(**{ORIGIN_CHANNEL_FIELD: Subquery(origin)})
