"""Background tasks — AI-3 (Story 77). The project's second `@shared_task`
outside `apps.sla` — `apps.sla.tasks::auto_assign_ticket` (Story 29) is
the direct structural precedent: no further Celery wiring is needed,
`app.autodiscover_tasks()` (Story 27, `config/celery.py`) already finds
this module because it is named `tasks.py` inside an installed app.
"""

import logging

from celery import shared_task

from apps.tickets.models import Ticket

from .categorization import suggest_ticket_fields
from .exceptions import AIServiceError

logger = logging.getLogger(__name__)


@shared_task
def categorize_ticket(ticket_id: int) -> None:
    """Auto-tags a newly submitted ticket's priority, and its category
    when none was already chosen. A no-op (not an error) whenever
    nothing should happen: the ticket was deleted before this ran, or
    the AI service is unconfigured/unreachable. Fired from
    `PortalTicketViewSet.perform_create`. See Story 77 `## Prerequisites`.

    Priority is always overwritten — no path that queues this task ever
    lets a human choose it first (`PortalTicketSerializer.read_only_fields`
    includes `priority`). Category is overwritten only when still unset,
    the one respected human choice in scope: the web form's optional
    category picker is a different, out-of-scope creation path, but the
    same "never override an existing category" rule is the safe default
    regardless of how one got set.
    """
    try:
        ticket = Ticket.objects.select_related("category").get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    try:
        suggestion = suggest_ticket_fields(ticket)
    except AIServiceError:
        logger.exception("AI categorization failed for ticket %s", ticket_id)
        return

    update_fields = ["priority", "updated_at"]
    ticket.priority = suggestion["priority"]
    if ticket.category_id is None and suggestion["category"] is not None:
        ticket.category = suggestion["category"]
        update_fields.append("category")
    ticket.save(update_fields=update_fields)
