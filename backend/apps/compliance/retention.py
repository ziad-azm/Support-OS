"""Data retention — SEC-10 task 1. Each function purges or anonymizes one
data class past its configured limit and returns the number of rows it
touched. Pure, no Celery/task-framework dependency — `tasks.py` is the only
caller. Every query excludes a customer under legal hold
(`Customer.legal_hold`); see that field's own docstring
(apps/customers/models.py) for the scope this covers.

Idempotent by construction, not by a lock: every filter re-selects "still
past the cutoff, not yet in the target end state" rows on each run, so a
missed schedule tick or a manual re-trigger is always safe — this codebase
has no shared Celery locking primitive to reuse (verified: no
`select_for_update`/`task_acks_late` anywhere in `config/celery.py` or
`settings/base.py`), so each function below invents its own via its filter
shape rather than via a lock.
"""

from datetime import timedelta

from django.utils import timezone

from apps.communications.models import Message
from apps.customers.models import Attachment
from apps.tickets.models import Ticket

# Idempotent: re-running against an already-anonymized ticket is a no-op —
# the `.exclude(subject=...)` below stops it from being re-selected, so the
# placeholder text is never rewritten with an identical value on every run.
CLOSED_TICKET_SUBJECT_PLACEHOLDER = "[Removed — data retention policy]"
CLOSED_TICKET_DESCRIPTION_PLACEHOLDER = (
    "This ticket's content was removed under the organization's data retention policy."
)


def anonymize_closed_tickets(days: int, *, now=None) -> int:
    """Blanks `subject`/`description` on every `CLOSED` ticket whose
    `closed_at` is past `days` — the ticket row, its status, dates, category,
    department, and branch all survive untouched, so ticket-count reports
    keep working. Never touches `Message` rows — see `purge_messages` below,
    which has its own independent day count.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    return (
        Ticket.objects.filter(status=Ticket.Status.CLOSED, closed_at__lt=cutoff)
        .exclude(subject=CLOSED_TICKET_SUBJECT_PLACEHOLDER)
        .exclude(customer__legal_hold=True)
        .update(
            subject=CLOSED_TICKET_SUBJECT_PLACEHOLDER,
            description=CLOSED_TICKET_DESCRIPTION_PLACEHOLDER,
            updated_at=now,
        )
    )


def purge_messages(days: int, *, now=None) -> int:
    """Hard-deletes every `Message` on a `CLOSED` ticket whose `closed_at`
    is past `days`. Keyed off the PARENT ticket's `closed_at`, not the
    message's own `created_at` — a still-open ticket's messages are never
    purged regardless of their age, since the conversation is not over.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    queryset = Message.objects.filter(
        ticket__status=Ticket.Status.CLOSED, ticket__closed_at__lt=cutoff
    ).exclude(ticket__customer__legal_hold=True)
    count = queryset.count()
    queryset.delete()
    return count


def purge_attachments(days: int, *, now=None) -> int:
    """Hard-deletes every `Attachment` past `days` old — both the DB row
    and the underlying file (`file.delete(save=False)`), the exact cleanup
    `AttachmentViewSet.perform_destroy` already performs for a manual
    delete (apps/customers/views.py). Keyed off the attachment's own
    `created_at`, independent of any ticket — `Attachment` is
    customer-scoped, not ticket-scoped, in this codebase.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    queryset = Attachment.objects.filter(created_at__lt=cutoff).exclude(customer__legal_hold=True)
    count = 0
    for attachment in queryset.iterator():
        attachment.file.delete(save=False)
        attachment.delete()
        count += 1
    return count


def purge_audit_log(days: int, *, now=None) -> int:
    """Hard-deletes `AuditLog` rows past `days` old. Not legal-hold-scoped
    — an audit entry is not itself a customer's personal data record, and
    this table has no `Customer`-shaped ownership to check.

    Imports `AuditLog` locally rather than at module load time (unlike
    every other function above, which imports its models at the top of
    this file) — `apps.accounts` is upstream of nothing this module
    otherwise needs, but a top-level import here would be the one import
    in this file pointing at `apps.accounts` specifically; kept local so a
    future `apps.accounts` -> `apps.compliance` import (unlikely, but this
    module is new) can never create a cycle.
    """
    from apps.accounts.models import AuditLog

    now = now or timezone.now()
    cutoff = now - timedelta(days=days)
    queryset = AuditLog.objects.filter(created_at__lt=cutoff)
    count = queryset.count()
    queryset.delete()
    return count
