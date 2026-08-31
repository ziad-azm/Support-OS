"""SLA-specific report queries — RPT-2.

`aggregation.py` knows nothing about a ticket or an SLA policy; this
module is where that domain knowledge lives, the same split
`apps/reports/tickets.py` (RPT-1) already established.

Computes response/resolution status in BULK, not by calling
`apps.sla.policy.compute_sla_status` per ticket — that function does two
extra queries per call (`apps/sla/policy.py:90-108`), an N+1 risk across
a report's ticket list that Story 28's own `## Prerequisites` (point 13)
explicitly flagged and deferred: "a future story can add [batching] once
there is a batching strategy... worth its own design pass." This module
is that batching strategy: two `Subquery` annotations (the same technique
`apps/reports/tickets.py::with_origin_channel` uses) plus one bulk
`SLAPolicy`/`OrganizationSettings` fetch, replacing what would otherwise
be `2N+1` queries with exactly 3. Classification itself still goes
through the shared `apps.sla.policy.dimension_status`, so this can never
silently disagree with the single-ticket `TicketViewSet.sla` action.
"""

from datetime import timedelta

from django.db.models import OuterRef, Subquery
from django.utils import timezone

from apps.communications.models import Message
from apps.organization.models import OrganizationSettings
from apps.reports.aggregation import BUCKETS, DATE_FORMAT
from apps.sla.models import SLAPolicy
from apps.sla.policy import dimension_status
from apps.tickets.models import Ticket, TicketActivity

# The two fixed dimensions every SLA report has — unlike RPT-1's
# user-selectable status/priority/category/channel, response and
# resolution are not a whitelist of query-string options; they are always
# both computed and always both returned.
RESPONSE = "response"
RESOLUTION = "resolution"


def _bulk_target_resolver(policies_by_key, org_targets):
    """Returns a function `(priority, category_id) -> (response_minutes,
    resolution_minutes) | None`, mirroring `apps.sla.policy.resolve_policy`'s
    exact two-tier lookup (category-specific, then priority-only default,
    then org default) but against a pre-fetched dict instead of two
    queries per ticket.
    """

    def resolve(priority, category_id):
        policy = policies_by_key.get((priority, category_id))
        if policy is None:
            policy = policies_by_key.get((priority, None))
        if policy is not None:
            return (policy.response_target_minutes, policy.resolution_target_minutes)
        return org_targets

    return resolve


def _annotated_tickets(start, end):
    """Every ticket created in [start, end), annotated with its earliest
    outbound message time and earliest resolved/closed activity time —
    the same two facts `compute_sla_status` reads per-ticket, fetched here
    in ONE query for the whole range via `Subquery`, not `2N+1`.
    """
    first_response = (
        Message.objects.filter(ticket=OuterRef("pk"), direction=Message.Direction.OUTBOUND)
        .order_by("created_at")
        .values("created_at")[:1]
    )
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=OuterRef("pk"),
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .values("created_at")[:1]
    )
    return (
        Ticket.objects.filter(created_at__gte=start, created_at__lt=end)
        .annotate(
            first_response_at=Subquery(first_response),
            resolved_at=Subquery(resolved_activity),
        )
        .values("id", "created_at", "priority", "category_id", "first_response_at", "resolved_at")
    )


def _target_resolver():
    policies_by_key = {(p.priority, p.category_id): p for p in SLAPolicy.objects.all()}
    org = OrganizationSettings.load()
    org_targets = None
    if (
        org.default_response_target_minutes is not None
        and org.default_resolution_target_minutes is not None
    ):
        org_targets = (org.default_response_target_minutes, org.default_resolution_target_minutes)
    return _bulk_target_resolver(policies_by_key, org_targets)


def sla_trend(start, end, bucket: str) -> list[dict]:
    """Average response/resolution time (minutes) per bucket, two series.

    Returns `[{"bucket": "2026-01-01", "series": "response", "value": 42.3}, ...]`
    — the SAME flat shape `bucketed_counts` returns, so it reuses the
    identical frontend `LineChart`/`ChartDataTable` composition RPT-1's
    volume trend already uses. Deliberately NOT gap-filled: an average has
    no natural zero (unlike a count), so a bucket with zero achieved
    values in it is OMITTED rather than reported as "0 minutes", which
    would falsely claim instant response/resolution. See Story 57
    `## Prerequisites` and `CONVENTIONS.md` § 27's new point.

    A ticket with no resolvable SLA policy (`resolve()` returns `None`) is
    silently excluded — the same "SLA tracking is opt-in, not every ticket
    has one" outcome `compute_sla_status` already treats as normal
    (`apps/sla/policy.py:80`), not an error.
    """
    resolve = _target_resolver()
    trunc = BUCKETS[bucket]
    tz = timezone.get_current_timezone()

    sums: dict[tuple[str, str], float] = {}
    counts: dict[tuple[str, str], int] = {}

    for row in _annotated_tickets(start, end).annotate(_bucket=trunc("created_at", tzinfo=tz)):
        targets = resolve(row["priority"], row["category_id"])
        if targets is None:
            continue
        bucket_date = row["_bucket"].date() if hasattr(row["_bucket"], "date") else row["_bucket"]
        bucket_key = bucket_date.strftime(DATE_FORMAT)
        created = row["created_at"]

        if row["first_response_at"] is not None:
            minutes = (row["first_response_at"] - created).total_seconds() / 60
            key = (bucket_key, RESPONSE)
            sums[key] = sums.get(key, 0) + minutes
            counts[key] = counts.get(key, 0) + 1
        if row["resolved_at"] is not None:
            minutes = (row["resolved_at"] - created).total_seconds() / 60
            key = (bucket_key, RESOLUTION)
            sums[key] = sums.get(key, 0) + minutes
            counts[key] = counts.get(key, 0) + 1

    return [
        {"bucket": bucket_key, "series": series, "value": round(sums[key] / counts[key], 1)}
        for key in sorted(sums)
        for bucket_key, series in [key]
    ]


def sla_breach_rate(start, end) -> list[dict]:
    """`met`/`breached`/`pending` counts and a breach rate for each of
    `response`/`resolution` over the whole [start, end) range — one
    snapshot, not a time series (CONVENTIONS.md § 25 row 4, "Performance
    vs Target").

    Returns `[{"key": "response", "met": 2, "breached": 9, "pending": 0,
    "rate": 0.818}, {"key": "resolution", ...}]`. `rate` excludes
    `pending` from the denominator — a ticket not yet past its deadline is
    not evidence of either meeting or missing it — and is `None` when
    `met + breached == 0` (nothing to rate yet).
    """
    resolve = _target_resolver()
    now = timezone.now()
    counts = {
        RESPONSE: {"met": 0, "breached": 0, "pending": 0},
        RESOLUTION: {"met": 0, "breached": 0, "pending": 0},
    }

    for row in _annotated_tickets(start, end):
        targets = resolve(row["priority"], row["category_id"])
        if targets is None:
            continue
        response_target, resolution_target = targets
        created = row["created_at"]
        response_due = created + timedelta(minutes=response_target)
        resolution_due = created + timedelta(minutes=resolution_target)
        counts[RESPONSE][dimension_status(response_due, row["first_response_at"], now)] += 1
        counts[RESOLUTION][dimension_status(resolution_due, row["resolved_at"], now)] += 1

    result = []
    for key in (RESPONSE, RESOLUTION):
        c = counts[key]
        total = c["met"] + c["breached"]
        rate = None if total == 0 else round(c["breached"] / total, 3)
        result.append({"key": key, **c, "rate": rate})
    return result
