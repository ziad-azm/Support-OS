from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from apps.core.serializers import BaseModelSerializer

from .models import Customer


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

    class Meta(BaseModelSerializer.Meta):
        model = Customer
        fields = ("id", "name", "email", "phone", "company", "created_at", "updated_at")

    def validate_email(self, value):
        """Blank -> None, so the unique constraint sees NULL.

        DRF does not call model `clean()`, so this cannot be left to the model.
        """
        return value or None
