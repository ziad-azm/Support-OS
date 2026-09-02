from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class ApiKey(TimeStampedModel):
    """An external system's credential for the public API — INT-1.

    Authorization is **not** stored here. A key resolves to `user` and
    every existing `permission_map`/`HasPermission` check then applies to
    that user unchanged (CONVENTIONS.md § 22, § 29) — "reusing AUTHZ", the
    intake's own phrase. Narrowing a key therefore means issuing it
    against a narrowly-roled user, never adding a scope list here.

    `user` is `CASCADE`: a key exists *for* an identity and is meaningless
    without it — the same reasoning `notifications.Notification.recipient`
    records for itself. `created_by` is `SET_NULL`, because the operator
    who issued a key may leave while the key stays in service; that is
    the same asymmetry `AuditLog.actor` (SET_NULL) versus
    `Notification.recipient` (CASCADE) already draws.

    Nothing recoverable is stored: `hashed_key` is `sha256(secret)`
    (apps/integrations/keys.py), and the plaintext is returned exactly
    once, by `POST /api/api-keys/`.
    """

    name = models.CharField(_("name"), max_length=100)
    # Unique and indexed: this is the lookup key on every authenticated
    # request. `editable=False` keeps both credential columns out of the
    # Django admin form and out of any ModelForm.
    prefix = models.CharField(_("prefix"), max_length=12, unique=True, editable=False)
    # 64 hex characters — the width of a sha256 hexdigest.
    hashed_key = models.CharField(_("hashed key"), max_length=64, editable=False)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="api_keys",
        verbose_name=_("user"),
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="api_keys_issued",
        verbose_name=_("created by"),
    )
    # Revocation is a flag, not a delete: the row is the only record that
    # the key ever existed and when it was last used. See Story 80
    # `## Story Goal` for why no AuditLog row is written.
    is_active = models.BooleanField(_("active"), default=True)
    expires_at = models.DateTimeField(_("expires at"), null=True, blank=True)
    # Written by ApiKeyAuthentication at most once every
    # LAST_USED_WRITE_INTERVAL, not on every request — see that module.
    last_used_at = models.DateTimeField(_("last used at"), null=True, blank=True)

    class Meta:
        verbose_name = _("API key")
        verbose_name_plural = _("API keys")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} ({self.prefix})"

    def is_usable(self) -> bool:
        if not self.is_active:
            return False
        return self.expires_at is None or self.expires_at > timezone.now()
