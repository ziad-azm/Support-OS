"""Data-subject erasure — SEC-10 task 2. See the plan's `## Story Goal` for
why this anonymizes the `Customer` row rather than deleting it —
`Ticket.customer` is `on_delete=PROTECT`, and every `Ticket`/`AuditLog` row
must survive this action for reporting and for the erasure's own audit
trail to remain meaningful.
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.communications.models import Message

from .models import Customer

ERASED_NAME_TEMPLATE = "Erased customer #{id}"
ERASED_CONTENT_PLACEHOLDER = "[Removed — data subject erasure request]"


def erase_customer(customer: Customer) -> None:
    """Raises DRF's `ValidationError` directly — the same "a plain
    business-logic module raises the framework exception itself" shape
    `apps.tickets.status.apply_status_change` already establishes, rather
    than a Django-level exception the view would have to translate.
    """
    if customer.legal_hold:
        raise ValidationError(
            {"non_field_errors": [_("This customer is under legal hold and cannot be erased.")]}
        )

    customer.contacts.all().delete()
    customer.notes.all().delete()
    for attachment in customer.attachments.all():
        # Same cleanup AttachmentViewSet.perform_destroy already performs
        # for a manual delete (apps/customers/views.py) — removes the file
        # from storage, not just the DB row.
        attachment.file.delete(save=False)
        attachment.delete()

    for ticket in customer.tickets.all():
        Message.objects.filter(ticket=ticket).update(body=ERASED_CONTENT_PLACEHOLDER)
        ticket.subject = ERASED_CONTENT_PLACEHOLDER
        ticket.description = ERASED_CONTENT_PLACEHOLDER
        ticket.save(update_fields=["subject", "description", "updated_at"])

    customer.feedback.update(comment="")

    customer.name = ERASED_NAME_TEMPLATE.format(id=customer.id)
    customer.email = None
    customer.phone = ""
    customer.company = ""
    customer.email_contact_enabled = False
    customer.phone_contact_enabled = False
    customer.whatsapp_enabled = False
    customer.save(
        update_fields=[
            "name",
            "email",
            "phone",
            "company",
            "email_contact_enabled",
            "phone_contact_enabled",
            "whatsapp_enabled",
            "updated_at",
        ]
    )
