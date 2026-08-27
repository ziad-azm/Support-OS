"""Combined ticket+customer+recent-history context — AGENT-2.

Lives in `apps.tickets`: the endpoint is anchored by ticket id (the panel
sits beside the ticket detail screen), even though most of the payload is
customer data. Reuses `apps.customers.serializers.CustomerSerializer` and
`apps.customers.timeline.build_timeline` (Story 20) rather than re-deriving
either. Reverse-direction import, verified safe — the same precedent
`apps/customers/timeline.py` already set importing `apps.tickets.models`:
neither `apps.customers.serializers` nor `apps.customers.timeline` imports
anything back from `apps.tickets.views`/`apps.tickets.context`, so there is
no cycle, only a one-way leaf-module dependency. See Story 26
`## Prerequisites`.
"""

from apps.customers.serializers import CustomerSerializer
from apps.customers.timeline import build_timeline

from .models import Ticket

# A short preview, not the full profile timeline (`TIMELINE_MAX_ENTRIES`,
# 100, apps/customers/timeline.py) — the panel shows recent context at a
# glance; the customer's own profile page is where an agent goes for the
# complete history.
CONTEXT_HISTORY_MAX_ENTRIES = 5


def build_ticket_context(ticket: Ticket) -> dict:
    """The customer behind this ticket, plus their most recent activity
    EXCLUDING this same ticket — `TicketDetailPage` already shows this
    ticket's own detail, conversation, and history in full; the point of
    this panel is what else has happened with this customer. Every
    `build_timeline` entry carries `ticket_id`, for both its "ticket" and
    "message" kinds, which makes the exclusion a single filter.
    """
    customer = ticket.customer
    history = [entry for entry in build_timeline(customer) if entry["ticket_id"] != ticket.id][
        :CONTEXT_HISTORY_MAX_ENTRIES
    ]
    return {
        "customer": CustomerSerializer(customer).data,
        "recent_history": history,
    }
