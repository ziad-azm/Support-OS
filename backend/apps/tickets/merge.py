"""Merging a duplicate ticket into another — TKT-9. Same shape as
`apps/tickets/assignment.py`/`apps/tickets/status.py`: a small, validating,
mutating helper imported by `views.py`, so a future second caller (there is
none today — see Story 109 `## Story Goal`, "no bulk merge") can never
bypass the checks or the logging.

Reverse-direction imports: `Message` from `apps.communications` mirrors the
identical import `apps/tickets/history.py` already makes safely (Story 24).
`InternalNote` from `apps.agents` is the FIRST import in this direction —
today only `apps.agents.models` imports `apps.tickets.models.Ticket`, never
the reverse. Neither models module imports the other's non-model code, so
this is not a real cycle; `python manage.py check` is the verification
(see Story 109 `## Verification Steps`).
"""

from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.agents.models import InternalNote
from apps.communications.models import Message

from .models import Ticket, TicketActivity
from .status import apply_status_change


def apply_merge(source: Ticket, target: Ticket, actor) -> None:
    """Validates, then merges `source` into `target`: moves every Message
    and InternalNote, closes `source` (unless already closed), sets
    `source.merged_into`, and logs one TicketActivity row on EACH ticket.
    Raises `ValidationError` (never a bare exception) for every rejected
    case, so `TicketViewSet.merge`'s `except` handling stays uniform with
    every other action in this file.
    """
    if source.pk == target.pk:
        raise ValidationError({"target_id": [_("A ticket cannot be merged into itself.")]})
    if source.customer_id != target.customer_id:
        raise ValidationError(
            {"target_id": [_("Cannot merge tickets that belong to different customers.")]}
        )

    with transaction.atomic():
        # Lock the source row inside the transaction: closes the race where
        # two concurrent merge requests for the SAME source both pass the
        # `merged_into_id is None` check below before either commits (see
        # Story 109 `## Edge Cases & Failure Modes`). The SECOND request
        # then blocks here until the first commits, re-reads a now-non-null
        # `merged_into_id`, and cleanly raises instead of silently
        # overwriting the first merge's pointer.
        #
        # `locked_source` is used ONLY for this lock + re-check — every
        # actual mutation below stays on the ORIGINAL `source`/`target`
        # objects the caller passed in, so the caller's own references end
        # up correctly updated in place (the view returns `source` after
        # this call; reassigning the local name here would leave the
        # caller's object stale).
        locked_source = Ticket.objects.select_for_update().get(pk=source.pk)
        if locked_source.merged_into_id is not None:
            raise ValidationError({"target_id": [_("This ticket has already been merged.")]})
        if target.merged_into_id is not None:
            raise ValidationError(
                {
                    "target_id": [
                        _("Cannot merge into a ticket that was itself merged into another ticket.")
                    ]
                }
            )

        Message.objects.filter(ticket=source).update(ticket=target)
        InternalNote.objects.filter(ticket=source).update(ticket=target)
        # Attachment is deliberately NOT touched: it is a Customer-scoped
        # model (`apps.customers.models.Attachment`), never a Ticket-scoped
        # one — see Story 109 `## Prerequisites`/`## Story Goal`. Since
        # source and target share the same customer (checked above), every
        # attachment is already visible on both tickets' customer panel;
        # there is nothing to move.

        source.merged_into = target
        source.save(update_fields=["merged_into", "updated_at"])
        if source.status != Ticket.Status.CLOSED:
            apply_status_change(source, Ticket.Status.CLOSED, actor=actor)

        TicketActivity.objects.create(
            ticket=source,
            actor=actor,
            kind=TicketActivity.Kind.MERGED_INTO,
            to_value=f"#{target.id} — {target.subject}"[:150],
        )
        TicketActivity.objects.create(
            ticket=target,
            actor=actor,
            kind=TicketActivity.Kind.MERGED_FROM,
            to_value=f"#{source.id} — {source.subject}"[:150],
        )
