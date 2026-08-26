from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Customer(TimeStampedModel):
    """A customer record — the identity core everything else attaches to.

    Deliberately minimal. `ContactDetail` (multi-channel contacts) is CUST-2,
    the interaction timeline is CUST-3, and `Note`/`Attachment` are CUST-4;
    none of them are pre-empted here. See Story 10 `## Story Goal`.
    """

    name = models.CharField(_("name"), max_length=200)
    # Unique WHEN PRESENT: this is the dedup key behind "each customer has one
    # record", and what COMM-* will match inbound messages against.
    #
    # `null=True` is load-bearing, not stylistic. Postgres allows any number of
    # NULLs in a unique column but rejects a second blank string — verified
    # against this project's database. Blank input is normalised to NULL in
    # `clean()` and again in the serializer, because a `""` reaching this
    # column is an IntegrityError (a 500), not a validation message.
    email = models.EmailField(
        _("email address"), max_length=254, unique=True, null=True, blank=True
    )
    # Plain text on purpose: international formats, extensions, and WhatsApp
    # identifiers make anything stricter actively wrong. Per-channel validation
    # belongs to CUST-2.
    phone = models.CharField(_("phone"), max_length=40, blank=True)
    company = models.CharField(_("company"), max_length=200, blank=True)

    class Meta:
        verbose_name = _("customer")
        verbose_name_plural = _("customers")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        """Normalise blank email to NULL.

        Guards the admin and any `full_clean()` caller. The serializer repeats
        this for the API path, because DRF does not call model `clean()` — the
        same split CONVENTIONS.md §22 records for `Role.clean()`.
        """
        super().clean()
        if not self.email:
            self.email = None
