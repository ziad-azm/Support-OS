import logging
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.exceptions import SuspiciousFileOperation
from django.http import FileResponse
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import AuditLog, Role
from apps.accounts.tasks import send_invite_email
from apps.core.permissions import Permissions, permissions_for
from apps.core.scoping import ScopedQuerysetMixin, ScopeFilter
from apps.core.views import BaseModelViewSet

from .models import Attachment, ContactDetail, Customer, Note
from .serializers import (
    AttachmentSerializer,
    ContactDetailSerializer,
    CustomerSerializer,
    NoteSerializer,
)
from .timeline import build_timeline

User = get_user_model()
logger = logging.getLogger(__name__)


class CustomerViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    """Customer CRUD. The first consumer of `BaseModelViewSet`.

    Every action is mapped: an unmapped action would fall through to
    authenticated-only, which for a write endpoint is not what we want. See
    CONVENTIONS.md §22.

    `ScopedQuerysetMixin` (ORG-2) is the simplest application of that mixin
    in this codebase — this class has no `get_queryset` override of its own,
    so there is no method to reconcile. It MUST stay first in the bases:
    after `BaseModelViewSet`, Python's MRO puts `ModelViewSet.get_queryset`
    first, the mixin never runs, and every `?branch=` silently returns an
    unfiltered list. There is no error to see.
    """

    queryset = Customer.objects.select_related("branch").all()
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
        # One HTTP-method-agnostic entry: DRF sets `self.action` to the
        # decorated method's own name ("portal_access") for BOTH the `post`
        # and `delete` methods bound to it below — verified against the
        # installed DRF's `@action`/`MethodMapper` (rest_framework/decorators.py),
        # the same "keyed by method name, not verb" rule `timeline` above
        # already established for a single-method action.
        "portal_access": Permissions.CUSTOMERS_MANAGE,
    }

    # `ordering_fields` is what makes `?ordering=` real for these columns —
    # OrderingFilter ignores any field not listed. Each name here must match a
    # `ColumnDef.id` on the frontend.
    ordering_fields = ("name", "email", "company", "created_at")
    search_fields = ("name", "email", "company")

    # ORG-2's scoping declaration — `apps/core/scoping.py`. `?branch=none`
    # lists customers with no branch; a malformed value is a 400, never a
    # silently-unfiltered list. `branch_name` is deliberately absent from
    # `ordering_fields` above — it is a joined display column, the same rule
    # every other one in this codebase follows.
    scope_filters = (ScopeFilter(param="branch", field="branch"),)

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

    @action(detail=True, methods=["post", "delete"], url_path="portal-access")
    def portal_access(self, request, pk=None):
        """CUST-5: staff-controlled portal onboarding, replacing the
        Django-admin-only path Story 42 left as intentionally temporary
        (`CONVENTIONS.md` §26). `POST` grants — reusing SEC-5's invite-email
        flow with `role=customer`; `DELETE` revokes — unlinking `Customer.user`
        and deactivating the underlying `User`, both, per the intake's own
        "unlink/deactivate" wording.
        """
        customer = self.get_object()
        if request.method == "POST":
            self._grant_portal_access(customer)
        else:
            self._revoke_portal_access(customer)
        return Response(CustomerSerializer(customer).data)

    def _grant_portal_access(self, customer: Customer) -> None:
        if customer.user_id is not None:
            raise ValidationError(
                {"non_field_errors": [_("Portal access is already enabled for this customer.")]}
            )
        if not customer.email:
            raise ValidationError(
                {"non_field_errors": [_("Add an email address before granting portal access.")]}
            )

        customer_role = Role.objects.get(slug="customer")
        existing = User.objects.filter(email=customer.email).first()

        if existing is not None:
            # `Customer.user_id` carries a UNIQUE constraint (the OneToOneField
            # compiles to one) — linking a User another Customer already holds
            # would raise IntegrityError with no guard. See `## Story Goal`.
            if getattr(existing, "customer_profile", None) is not None:
                raise ValidationError(
                    {
                        "non_field_errors": [
                            _("This email is already linked to another customer's portal account.")
                        ]
                    }
                )
            # `is_staff` alone is not a reliable enough signal — verified live:
            # an account provisioned outside `UserAdminSerializer.create()`
            # (e.g. directly via `manage.py shell`, as this project's own dev
            # seed accounts are) can hold a real operational role with
            # `is_staff=False`. Holding any role other than `customer` is the
            # actual "this identity is in real use" signal, independent of how
            # the account was created.
            if existing.is_staff or (
                existing.role_id is not None and existing.role_id != customer_role.id
            ):
                raise ValidationError(
                    {
                        "non_field_errors": [
                            _(
                                "This email belongs to a staff account and cannot "
                                "also be used for portal access."
                            )
                        ]
                    }
                )
            # An orphaned account with no current Customer link, held by
            # nobody else's operational role — the ordinary "re-grant after a
            # prior revoke" case. Reused, not recreated: a second User row
            # would collide on the unique `email` column anyway.
            user = existing
            user.role = customer_role
            user.is_active = False
            user.set_password(None)
            user.save(update_fields=["role", "is_active", "password"])
        else:
            user = User.objects.create_user(
                email=customer.email,
                password=None,
                is_staff=False,
                is_active=False,
                role=customer_role,
                first_name=customer.name,
            )

        customer.user = user
        customer.save(update_fields=["user"])

        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.PORTAL_ACCESS_GRANTED,
            target_user=user,
            target_label=customer.name,
        )
        # Best-effort, the same commit-first idiom `UserViewSet.perform_create`
        # already uses around its own `send_invite_email.delay(...)` call — a
        # down Redis/worker must never fail or roll back the already-created
        # link.
        try:
            send_invite_email.delay(user.id)
        except Exception:
            logger.exception("Failed to queue portal invite email for user %s", user.id)

    def _revoke_portal_access(self, customer: Customer) -> None:
        user = customer.user
        if user is None:
            raise ValidationError(
                {"non_field_errors": [_("Portal access is not enabled for this customer.")]}
            )
        customer.user = None
        customer.save(update_fields=["user"])
        user.is_active = False
        user.save(update_fields=["is_active"])

        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.PORTAL_ACCESS_REVOKED,
            target_user=user,
            target_label=customer.name,
        )


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

# PROD-3. An allowlist, never a denylist: a denylist is a list of the
# extensions someone happened to think of. Covers what a support attachment
# actually is — documents, images, archives, plain text, saved mail.
#
# Severity, stated honestly: this is defense-in-depth, NOT a live XSS fix.
# `AttachmentViewSet.download` already serves every file with
# `as_attachment=True` (Content-Disposition: attachment), so a stored
# .svg/.html is downloaded rather than rendered inline — DO NOT remove that.
# This closes the "we store and redistribute arbitrary executables" half.
#
# Note this is an extension check, not content sniffing: a .png containing
# HTML still passes. Real content inspection needs libmagic, a new binary
# dependency this project deliberately does not add. Extend this set rather
# than switching to a denylist. See CONVENTIONS.md § 36.
ALLOWED_ATTACHMENT_EXTENSIONS = frozenset(
    {
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".csv",
        ".txt",
        ".log",
        ".md",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".bmp",
        ".tiff",
        ".zip",
        ".gz",
        ".tar",
        ".7z",
        ".eml",
        ".msg",
    }
)


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
        # Size first: it is the cheaper check, and an over-large file should
        # report its real problem rather than an incidental type mismatch.
        if file_obj.size > MAX_ATTACHMENT_SIZE_BYTES:
            max_mb = MAX_ATTACHMENT_SIZE_BYTES // (1024 * 1024)
            raise ValidationError(
                {"file": [_("File must be %(max_mb)s MB or smaller.") % {"max_mb": max_mb}]}
            )
        # PROD-3: type allowlist. An extensionless upload has `suffix == ""`,
        # which is not in the set and is therefore rejected — deliberate.
        extension = Path(file_obj.name).suffix.lower()
        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            raise ValidationError(
                {"file": [_("Files of type “%(ext)s” are not accepted.") % {"ext": extension}]}
            )
        try:
            serializer.save(
                uploaded_by=self.request.user,
                original_filename=file_obj.name,
                size=file_obj.size,
            )
        except SuspiciousFileOperation as exc:
            # PROD-3: Django rejects `..`/absolute paths in the generated
            # upload path (django/db/models/fields/files.py:357, via
            # `validate_file_name`). Already SAFE — the file is never
            # written — but the raw exception is unhandled by
            # `envelope_exception_handler` and renders as a 500. This makes
            # it the 400 it always was semantically.
            raise ValidationError({"file": [_("This file name is not accepted.")]}) from exc

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
