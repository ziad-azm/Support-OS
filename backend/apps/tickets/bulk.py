"""Shared plumbing for TKT-7's bulk ticket actions — parsing/validating
the `ticket_ids` list once and fetching every requested ticket in a
single query, so `TicketViewSet.bulk_assign`/`bulk_status`/`bulk_priority`
each stay a thin loop over the SAME per-ticket helpers the single-ticket
actions use (`apply_assignment`, `apply_status_change`, or a plain field
write for `priority`). Same "small, pure helper module, imported by
views.py" placement `assignment.py`/`status.py` already established
(Story 22/23).

A batch never fails whole because of one bad row (the intake's own
"returning a per-row result rather than failing the whole batch"): the
`ticket_ids` list ITSELF is validated up front — absent/empty/malformed/
oversized is a single 400 for the whole request, the same "a present-but-
malformed value is a 400, never a silent no-op" contract every filter in
this project already follows — but a PER-ID problem (not found, illegal
transition, ...) becomes one `{"id": ..., "ok": False, "error": ...}`
entry, never an exception that aborts the rest of the batch.
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# A generous but real ceiling on a hand-crafted request — `TicketListPage`'s
# "select all on this page" can only ever select `page_size` rows (25 by
# default, 100 at `DRF_MAX_PAGE_SIZE`; `backend/apps/core/pagination.py`),
# so this never bites through the UI. Chosen the same deliberate-round-
# number way `HISTORY_MAX_ENTRIES` (`apps/tickets/history.py`) was.
MAX_BULK_IDS = 200


def parse_ticket_ids(data) -> list[int]:
    """`ticket_ids` must be present, a non-empty list, at most
    `MAX_BULK_IDS` long, and every element must parse as an int. Any
    violation is ONE 400 for the whole request — this validates the
    request's shape, not a per-ticket outcome.
    """
    raw = data.get("ticket_ids")
    if not isinstance(raw, list) or not raw:
        raise ValidationError({"ticket_ids": [_("Must be a non-empty list of ticket ids.")]})
    if len(raw) > MAX_BULK_IDS:
        raise ValidationError(
            {
                "ticket_ids": [
                    _("Cannot act on more than %(max)s tickets at once.") % {"max": MAX_BULK_IDS}
                ]
            }
        )
    ids = []
    for raw_id in raw:
        try:
            ids.append(int(raw_id))
        except (TypeError, ValueError):
            raise ValidationError({"ticket_ids": [_("Every id must be a number.")]}) from None
    return ids


def fetch_tickets(queryset, ticket_ids: list[int]) -> dict:
    """One query for every requested id, keyed by id for O(1) per-row
    lookup in the caller's loop. An id with no matching row (wrong id, or
    deleted between the page loading and the bulk request being sent) is
    simply absent from the returned dict — the caller reports that as a
    per-row "not found," never as a 404 for the whole request.
    """
    return {ticket.id: ticket for ticket in queryset.filter(pk__in=ticket_ids)}


def first_error_message(exc: ValidationError) -> str:
    """Flattens a DRF `ValidationError.detail` (normally `{field: [msg,
    ...]}`) to one string for a bulk result row — the first message of
    the first field. These are the EXACT messages `apply_status_change`/
    the single-ticket actions already raise, just surfaced per-row here
    instead of as the whole request's 400.
    """
    detail = exc.detail
    if isinstance(detail, dict):
        for messages in detail.values():
            if messages:
                return str(messages[0])
    if isinstance(detail, list) and detail:
        return str(detail[0])
    return str(detail)
