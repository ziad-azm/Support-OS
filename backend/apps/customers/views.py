from django.http import FileResponse
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.core.permissions import Permissions, permissions_for
from apps.core.views import BaseModelViewSet

from .models import Attachment, ContactDetail, Customer, Note
from .serializers import (
    AttachmentSerializer,
    ContactDetailSerializer,
    CustomerSerializer,
    NoteSerializer,
)
from .timeline import build_timeline


class CustomerViewSet(BaseModelViewSet):
    """Customer CRUD. The first consumer of `BaseModelViewSet`.

    Every action is mapped: an unmapped action would fall through to
    authenticated-only, which for a write endpoint is not what we want. See
    CONVENTIONS.md §22.
    """

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
        # Keyed by the @action's own method name — DRF sets
        # `self.action = "timeline"` for it (verified, see Story 20
        # `## Prerequisites`). Without this entry the action would fall
        # through to authenticated-only, NOT be denied.
        "timeline": Permissions.CUSTOMERS_VIEW,
    }

    # `ordering_fields` is what makes `?ordering=` real for these columns —
    # OrderingFilter ignores any field not listed. Each name here must match a
    # `ColumnDef.id` on the frontend.
    ordering_fields = ("name", "email", "company", "created_at")
    search_fields = ("name", "email", "company")

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        """A customer's full interaction history — CUST-3. The router
        generates `/api/customers/<pk>/timeline/` from this decorator; no
        `urls.py` change is needed (verified, see Story 20
        `## Prerequisites`).

        Permission-checked twice on purpose: `permission_map` gates it on
        `customers.view` like every other read here, and the explicit check
        below adds `tickets.view`, because the payload is ticket and message
        data that `TicketViewSet`/`MessageViewSet` both gate that way. The
        same "permission-checked, not just authenticated" move Story 16's
        `TicketChatConsumer` made. See Story 20 `## Prerequisites`.
        """
        if Permissions.TICKETS_VIEW not in permissions_for(request.user):
            raise PermissionDenied()
        customer = self.get_object()
        return Response(build_timeline(customer))


class ContactDetailViewSet(BaseModelViewSet):
    """CRUD for a customer's contact channels. Reuses `customers.*` —
    CUST-2 is part of the customer record, not a separate permission domain
    (Story 11 `## Product rules`).
    """

    queryset = ContactDetail.objects.all()
    serializer_class = ContactDetailSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)


class NoteViewSet(BaseModelViewSet):
    """Note CRUD for one customer. Reuses `customers.*` — a note is part of
    the customer record, the same reasoning `ContactDetailViewSet` already
    established (Story 11 `## Product rules`).
    """

    queryset = Note.objects.select_related("author").all()
    serializer_class = NoteSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# 10 MB — a first-cut default, not a spec'd product requirement (no size
# limit existed anywhere before this fix, front or back end, confirmed by
# uploading a 15 MB file with no rejection). Easy to change here later; the
# point of this constant is that *some* bound exists, closing a real
# storage-exhaustion/DoS vector, not that this exact number is final.
MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024


class AttachmentViewSet(BaseModelViewSet):
    """Attachment create/list/retrieve/destroy/download for one customer.
    Reuses `customers.*`, same reasoning as `NoteViewSet`. No `update`/
    `partial_update` — see Story 21 `## Prerequisites`.
    """

    queryset = Attachment.objects.select_related("uploaded_by").all()
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser]
    # Narrows Django's own View.http_method_names — verified this makes
    # PUT/PATCH a clean 405 before any handler or permission_map lookup
    # runs (rest_framework/views.py:517). See Story 21 `## Prerequisites`.
    http_method_names = ["get", "post", "delete", "head", "options"]

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
        "download": Permissions.CUSTOMERS_VIEW,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)

    def perform_create(self, serializer):
        file_obj = serializer.validated_data["file"]
        if file_obj.size > MAX_ATTACHMENT_SIZE_BYTES:
            max_mb = MAX_ATTACHMENT_SIZE_BYTES // (1024 * 1024)
            raise ValidationError({"file": [_("File must be %(max_mb)s MB or smaller.") % {"max_mb": max_mb}]})
        serializer.save(
            uploaded_by=self.request.user,
            original_filename=file_obj.name,
            size=file_obj.size,
        )

    def perform_destroy(self, instance):
        # `instance.delete()` (the `ModelViewSet` default `perform_destroy`)
        # only removes the DB row — the physical file under `MEDIA_ROOT` is
        # never touched by Django on its own, so every attachment delete
        # leaked a file on disk permanently. `file.delete(save=False)`
        # removes it from storage; `save=False` since the `Attachment` row
        # itself is about to be deleted anyway.
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Streams the file back with its original name. Bypasses
        `EnvelopeJSONRenderer` entirely — verified safe, see Story 21
        `## Prerequisites`.
        """
        attachment = self.get_object()
        return FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=attachment.original_filename,
        )
