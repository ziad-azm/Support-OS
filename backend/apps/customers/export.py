"""Data-subject export — SEC-10 task 2. Assembles a machine-readable JSON
document of everything this codebase holds about one `Customer`. Attachment
file CONTENT is not embedded — each attachment's metadata is listed, and the
file itself stays reachable through the existing, permission-gated
`AttachmentViewSet.download` for as long as it has not since been purged.
Bundling binary file bytes into one response is out of scope for this
story — see the plan's `## Story Goal`.
"""

import json

from django.http import HttpResponse

from apps.communications.models import Message

from .models import Customer


def build_customer_export(customer: Customer) -> dict:
    tickets = []
    for ticket in customer.tickets.select_related("category").order_by("created_at"):
        tickets.append(
            {
                "id": ticket.id,
                "subject": ticket.subject,
                "description": ticket.description,
                "status": ticket.status,
                "priority": ticket.priority,
                "category": ticket.category.name if ticket.category_id else None,
                "created_at": ticket.created_at.isoformat(),
                "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
                "messages": [
                    {
                        "direction": message.direction,
                        "channel": message.channel,
                        "body": message.body,
                        "created_at": message.created_at.isoformat(),
                    }
                    for message in Message.objects.filter(ticket=ticket).order_by("created_at")
                ],
            }
        )

    return {
        "profile": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "company": customer.company,
            "created_at": customer.created_at.isoformat(),
        },
        "contact_details": [
            {"channel": contact.channel, "value": contact.value}
            for contact in customer.contacts.all()
        ],
        "notes": [
            {"body": note.body, "created_at": note.created_at.isoformat()}
            for note in customer.notes.all()
        ],
        "attachments": [
            {
                "id": attachment.id,
                "filename": attachment.original_filename,
                "size": attachment.size,
                "uploaded_at": attachment.created_at.isoformat(),
            }
            for attachment in customer.attachments.all()
        ],
        "tickets": tickets,
        "feedback": [
            {
                "ticket_id": feedback.ticket_id,
                "rating": feedback.rating,
                "comment": feedback.comment,
                "created_at": feedback.created_at.isoformat(),
            }
            for feedback in customer.feedback.order_by("created_at")
        ],
    }


def customer_export_response(customer: Customer) -> HttpResponse:
    """Plain `HttpResponse`, not a DRF `Response` — bypasses
    `EnvelopeJSONRenderer` exactly like `apps.reports.export.csv_response`
    and `AttachmentViewSet.download`'s `FileResponse`; the same escape
    hatch, a JSON body instead of CSV/binary.
    """
    payload = build_customer_export(customer)
    content = json.dumps(payload, indent=2, ensure_ascii=False)
    response = HttpResponse(content, content_type="application/json; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="customer-{customer.id}-export.json"'
    return response
