from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from apps.core.serializers import BaseModelSerializer

from .models import Attachment, ContactDetail, Customer, Note


class CustomerSerializer(BaseModelSerializer):
    # allow_blank AND allow_null: the client may send "", null, or omit the
    # key entirely, and all three must mean "no email". Without allow_blank a
    # cleared field is a validation error; without the normalisation below a
    # "" reaches a unique column and becomes an IntegrityError. See Story 10
    # `## Story Goal` for the verified failure.
    #
    # `UniqueValidator` is explicit and NOT redundant with the model's
    # `unique=True` — verified against this project's installed DRF (3.18):
    # ModelSerializer only auto-derives a UniqueValidator for a field it
    # generates itself. Overriding `email` here (required to get
    # `allow_blank`/`allow_null`) opts this field out of that auto-derivation,
    # so without this the second customer with a duplicate email hits the
    # database's unique constraint directly — an IntegrityError (500), the
    # very failure `## Story Goal` describes, just from a different cause
    # than the blank-collides-with-blank one it documents.
    #
    # Safe for the null case: DRF's `Field.validate_empty_values` treats an
    # explicit `None` on an `allow_null=True` field as an "empty value" and
    # skips `run_validators` (hence this validator) entirely — verified
    # against the installed version — so two customers with `email: null`
    # never run the uniqueness check against each other, matching Postgres's
    # own NULLs-don't-collide behaviour. A blank `''` does run the check, but
    # since `validate_email` below always normalises a saved row's blank to
    # `None`, no row ever persists `''` for the filter to match.
    email = serializers.EmailField(
        max_length=254,
        required=False,
        allow_blank=True,
        allow_null=True,
        validators=[UniqueValidator(queryset=Customer.objects.all())],
    )
    # Same three reasons as `email` above, and the same trap: overriding a
    # field opts it out of ModelSerializer's auto-derived UniqueValidator
    # (verified against DRF 3.18 — see this class's own comment), so the
    # validator must be declared by hand or a duplicate ERP id becomes an
    # IntegrityError instead of a 400.
    external_id = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
        validators=[UniqueValidator(queryset=Customer.objects.all())],
    )

    class Meta(BaseModelSerializer.Meta):
        model = Customer
        fields = (
            "id",
            "name",
            "email",
            "phone",
            "company",
            "external_id",
            "created_at",
            "updated_at",
        )

    def validate_email(self, value):
        """Blank -> None, so the unique constraint sees NULL.

        DRF does not call model `clean()`, so this cannot be left to the model.
        """
        return value or None

    def validate_external_id(self, value):
        return value or None


class ContactDetailSerializer(BaseModelSerializer):
    """No fields declared beyond `Meta` — verified unnecessary. `customer` is
    a required FK the ModelSerializer auto-generates as `PrimaryKeyRelatedField`,
    and the (customer, channel, value) `UniqueConstraint` auto-derives a
    `UniqueTogetherValidator` with no `validators=[...]` needed, unlike the
    single-field gap `CustomerSerializer.email` works around. See Story 11
    `## Prerequisites` for the verified proof.
    """

    class Meta(BaseModelSerializer.Meta):
        model = ContactDetail
        fields = ("id", "customer", "channel", "value", "created_at", "updated_at")

    def validate(self, attrs):
        """Per-channel value format: an email-channel contact must parse as
        an email address. DRF does not call model `clean()`, and this model
        deliberately has none, so this is the one enforcement point.

        `channel`/`value` fall back to the existing instance's value on a
        PATCH that sends only the other one, so a partial update still
        validates the pair together.
        """
        channel = attrs.get("channel", getattr(self.instance, "channel", None))
        value = attrs.get("value", getattr(self.instance, "value", None))
        if channel == ContactDetail.Channel.EMAIL and value:
            try:
                validate_email(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"value": list(exc.messages)}) from exc
        return attrs

    def update(self, instance, validated_data):
        """Reassigning a contact to a different customer is not a supported
        operation — delete and recreate under the new customer instead.
        `customer` stays writable on create (it's how the contact is
        attached in the first place) but is ignored on every PATCH."""
        validated_data.pop("customer", None)
        return super().update(instance, validated_data)


class NoteSerializer(BaseModelSerializer):
    # `author` itself is read-only — never client-supplied, always set from
    # `request.user` in `NoteViewSet.perform_create` (Story 21
    # `## Product rules`). `author_name` mirrors `TicketSerializer
    # .category_name`'s verified-safe `allow_null=True` pattern (Story 18):
    # `source="author.get_full_name"` returns `None`, not an error, when
    # `author` is `None` (a deleted user).
    author_name = serializers.CharField(
        source="author.get_full_name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Note
        fields = ("id", "customer", "author", "author_name", "body", "created_at", "updated_at")
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("author",)

    def update(self, instance, validated_data):
        """Reassigning a note to a different customer is not supported —
        mirrors `ContactDetailSerializer.update` verbatim (Story 11)."""
        validated_data.pop("customer", None)
        return super().update(instance, validated_data)


class AttachmentSerializer(BaseModelSerializer):
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.get_full_name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Attachment
        fields = (
            "id",
            "customer",
            "uploaded_by",
            "uploaded_by_name",
            "file",
            "original_filename",
            "size",
            "created_at",
            "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "uploaded_by",
            "original_filename",
            "size",
        )
        # write_only: without this, DRF's FileField.to_representation calls
        # `.url` (UPLOADED_FILES_USE_URL defaults to True), which raises —
        # no MEDIA_URL is configured. Verified, see Story 21
        # `## Prerequisites`.
        extra_kwargs = {"file": {"write_only": True}}
