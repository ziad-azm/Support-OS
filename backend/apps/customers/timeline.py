"""Interaction-history aggregation — CUST-3.

Lives in `apps.customers` per `backend/apps/README.md`'s app-purpose table
("customers | Customer records, contacts, interaction history"), even though
it reads `apps.tickets` and `apps.communications` models. That is a
reverse-direction cross-app import, with precedent (`apps/tickets/admin.py`
imports `apps.communications.models`) and no cycle risk: no *model* here
imports across apps. See Story 20 `## Prerequisites`.
"""

from apps.communications.models import Message
from apps.tickets.models import Ticket

from .models import Customer

# The 100 most recent entries, matching DRF_MAX_PAGE_SIZE and the same
# "inline on the profile, no pagination UI" ceiling
# `getContactDetails.ts` accepts. Not an ENV var — an internal display
# limit, not deployment config.
TIMELINE_MAX_ENTRIES = 100


def build_timeline(customer: Customer) -> list[dict]:
    """Every ticket this customer opened and every message on those tickets,
    merged newest-first and capped at `TIMELINE_MAX_ENTRIES`.

    Newest-first deliberately diverges from `Message.Meta.ordering`
    (oldest-first, because a *conversation* reads top-to-bottom) and follows
    `Ticket.Meta.ordering` instead — an agent opening a profile wants recent
    activity first. See Story 20 `## Product rules`.
    """
    tickets = (
        Ticket.objects.filter(customer=customer)
        .select_related("category")
        .order_by("-created_at")[:TIMELINE_MAX_ENTRIES]
    )
    messages = Message.objects.filter(ticket__customer=customer).order_by("-created_at")[
        :TIMELINE_MAX_ENTRIES
    ]

    entries = [
        {
            "kind": "ticket",
            "id": ticket.id,
            "occurred_at": ticket.created_at,
            "ticket_id": ticket.id,
            "subject": ticket.subject,
            "status": ticket.status,
            "priority": ticket.priority,
            "category_name": ticket.category.name if ticket.category else None,
        }
        for ticket in tickets
    ] + [
        {
            "kind": "message",
            "id": message.id,
            "occurred_at": message.created_at,
            "ticket_id": message.ticket_id,
            "direction": message.direction,
            "channel": message.channel,
            "body": message.body,
        }
        for message in messages
    ]

    # Slicing each queryset to the cap BEFORE this merge is exact, not an
    # approximation: both sides are already newest-first, so the merged top
    # N can only be drawn from each side's top N. See Story 20
    # `## Prerequisites`.
    entries.sort(key=lambda entry: entry["occurred_at"], reverse=True)
    return entries[:TIMELINE_MAX_ENTRIES]
