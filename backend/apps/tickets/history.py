"""A ticket's full activity history — TKT-5's "reusable activity-log
pattern" (`SupportOs backlog.MD` lines 343-348). Merges the persisted
`TicketActivity` log (status/assignment changes) with the ticket's existing
`Message` rows (replies) into one newest-first feed. Replies are NOT
duplicated into `TicketActivity` — `Message` already is the record of them.

Same merge-two-querysets-into-one-feed shape as
`apps/customers/timeline.py::build_timeline` (Story 20), one app closer to
home: `Message` crossing from `apps.communications` is the same
reverse-direction import `apps/tickets/admin.py` already makes safely — no
*model* here imports across apps in a cycle.
"""

from apps.communications.models import Message

from .models import Ticket, TicketActivity

HISTORY_MAX_ENTRIES = 100


def build_history(ticket: Ticket) -> list[dict]:
    """Every logged status/assignment change plus every message on this
    ticket, merged newest-first and capped at `HISTORY_MAX_ENTRIES` — the
    same cap and merge order `build_timeline` uses, for the same reason:
    both sides are already newest-first, so the merged top N is exact, not
    an approximation.
    """
    activities = (
        TicketActivity.objects.filter(ticket=ticket)
        .select_related("actor")
        .order_by("-created_at")[:HISTORY_MAX_ENTRIES]
    )
    messages = Message.objects.filter(ticket=ticket).order_by("-created_at")[:HISTORY_MAX_ENTRIES]

    entries = [
        {
            "kind": "activity",
            "id": activity.id,
            "occurred_at": activity.created_at,
            "activity_kind": activity.kind,
            "actor_name": activity.actor.get_full_name() if activity.actor else None,
            "from_value": activity.from_value,
            "to_value": activity.to_value,
        }
        for activity in activities
    ] + [
        {
            "kind": "message",
            "id": message.id,
            "occurred_at": message.created_at,
            "direction": message.direction,
            "channel": message.channel,
            "body": message.body,
        }
        for message in messages
    ]

    entries.sort(key=lambda entry: entry["occurred_at"], reverse=True)
    return entries[:HISTORY_MAX_ENTRIES]
