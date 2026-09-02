from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Message(TimeStampedModel):
    """A single message in a ticket's conversation — the reusable spine
    every channel (COMM-1 Email, COMM-2 WhatsApp, COMM-3 Live Chat, COMM-4
    SMS, COMM-5 Web Form) attaches to via `ChannelAdapter` (`adapters.py`).
    No channel has a bespoke model — everything is a `Message`. See Story 13
    `## Story Goal`.
    """

    class Direction(models.TextChoices):
        INBOUND = "inbound", _("Inbound")
        OUTBOUND = "outbound", _("Outbound")

    class Channel(models.TextChoices):
        EMAIL = "email", _("Email")
        WHATSAPP = "whatsapp", _("WhatsApp")
        CHAT = "chat", _("Live chat")
        SMS = "sms", _("SMS")
        WEB_FORM = "web_form", _("Web form")

    # CASCADE, not PROTECT: contrast `Ticket.customer` (Story 12, PROTECT —
    # the customer outlives the relationship). A message has no existence
    # independent of its ticket.
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="messages", verbose_name=_("ticket")
    )
    # No default, unlike Ticket.status/priority: direction is real content,
    # not a placeholder, and there is no correct default — an inbound
    # webhook payload and an agent's typed reply must never be accidentally
    # interchangeable.
    direction = models.CharField(_("direction"), max_length=10, choices=Direction.choices)
    channel = models.CharField(_("channel"), max_length=20, choices=Channel.choices)
    body = models.TextField(_("body"))
    # Schemaless on purpose: each channel adapter defines its own keys (an
    # email Message-ID, a WhatsApp message SID, ...). Read-only via the API
    # — see MessageSerializer (task 3).
    metadata = models.JSONField(_("metadata"), default=dict, blank=True)

    class Meta:
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        # Chronological, oldest first — a conversation reads top-to-bottom.
        # Contrast Ticket.Meta.ordering, a queue read newest-first.
        ordering = ("created_at",)

    def __str__(self) -> str:
        direction = self.get_direction_display()
        channel = self.get_channel_display()
        return f"{direction} {channel} on ticket #{self.ticket_id}"


class EmailProviderConfig(TimeStampedModel):
    """SMTP credentials for `EmailAdapter.send()` — INT-3.

    A singleton, the same `pk=1`/`load()`/`save()`/`delete()`-no-op shape
    `organization.OrganizationSettings` and `integrations.ErpConnection`
    already establish. Deliberately narrower than the Django-wide
    `EMAIL_*` settings it partially shadows: this row is read **only** by
    `EmailAdapter.send()` (the ticket-reply path). Invite emails
    (`apps.accounts.tasks`), password-reset emails (same module), and
    notification emails (`apps.notifications.tasks`) all continue reading
    `settings.EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_HOST_USER`/
    `EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS` unchanged — confirmed scope
    boundary, see Story 82 `## Prerequisites`.

    `host_password` is stored in plain text and never returned by the API
    (`EmailProviderConfigSerializer` declares it `write_only`) — the same
    posture `ErpConnection.auth_token` (Story 81) takes, for the same
    reason: no encryption library is installed in this project, and
    adding one is a cross-cutting decision, not a per-field one. See
    Story 82 `## Edge Cases`.
    """

    host = models.CharField(_("SMTP host"), max_length=255, blank=True)
    port = models.PositiveIntegerField(_("SMTP port"), default=587)
    host_user = models.CharField(_("SMTP username"), max_length=255, blank=True)
    host_password = models.CharField(_("SMTP password"), max_length=255, blank=True)
    use_tls = models.BooleanField(_("use TLS"), default=True)
    # Deliberately a field of ITS OWN — not a read of `settings.
    # DEFAULT_FROM_EMAIL` — so this config is fully self-contained and a
    # ticket-reply email never silently depends on the Django-wide value
    # invite/reset/notification emails also use.
    default_from_email = models.EmailField(_("from address"), max_length=254, blank=True)

    class Meta:
        verbose_name = _("email provider config")
        verbose_name_plural = _("email provider config")

    def __str__(self) -> str:
        return str(_("Email provider config"))

    def is_configured(self) -> bool:
        return bool(self.host and self.default_from_email)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # Nothing sensible for "delete the email provider config" to mean
        # — the row comes back with defaults on the next `load()`. Same
        # no-op posture `OrganizationSettings.delete`/`ErpConnection.delete`
        # already take.
        pass

    @classmethod
    def load(cls) -> "EmailProviderConfig":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class WhatsAppProviderConfig(TimeStampedModel):
    """Meta WhatsApp Business (Cloud) API credentials for
    `WhatsAppAdapter.send()` — INT-3. Replaces `settings.WHATSAPP_API_BASE_URL`/
    `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` one-for-one; the
    inbound-only `WHATSAPP_WEBHOOK_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET` stay
    ENV settings (`## Prerequisites`) — no adapter code reads either.

    `is_configured()`'s three-field check is the exact condition
    `WhatsAppAdapter.send` already enforced via `settings.*` (Story 15) —
    moved, not changed.
    """

    api_base_url = models.URLField(_("API base URL"), max_length=500, blank=True)
    phone_number_id = models.CharField(_("phone number id"), max_length=100, blank=True)
    access_token = models.CharField(_("access token"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("WhatsApp provider config")
        verbose_name_plural = _("WhatsApp provider config")

    def __str__(self) -> str:
        return str(_("WhatsApp provider config"))

    def is_configured(self) -> bool:
        return bool(self.api_base_url and self.phone_number_id and self.access_token)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        pass

    @classmethod
    def load(cls) -> "WhatsAppProviderConfig":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class SmsProviderConfig(TimeStampedModel):
    """Twilio Programmable Messaging credentials for `SMSAdapter.send()`
    **and** `SMSInboundWebhookView`'s inbound signature check — INT-3.
    Replaces `settings.SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/
    `SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` one-for-one; `SMS_WEBHOOK_URL`
    stays an ENV setting (`## Prerequisites`) — it names a fixed,
    deployment-level URL, not a rotatable credential.

    `auth_token` is deliberately the **one** field two different call
    sites read (`sms_adapter.py::SMSAdapter.send`,
    `views.py::SMSInboundWebhookView.post`) — Twilio's own Auth Token is
    dual-purpose (Basic Auth password for sending, HMAC key for verifying
    `X-Twilio-Signature` on receiving), so this row is the single source
    of truth for both, not two independent fields that could drift apart.
    See Story 82 `## Prerequisites` for the live bug this prevents.
    """

    api_base_url = models.URLField(_("API base URL"), max_length=500, blank=True)
    account_sid = models.CharField(_("account SID"), max_length=100, blank=True)
    auth_token = models.CharField(_("auth token"), max_length=500, blank=True)
    from_number = models.CharField(_("from number"), max_length=40, blank=True)

    class Meta:
        verbose_name = _("SMS provider config")
        verbose_name_plural = _("SMS provider config")

    def __str__(self) -> str:
        return str(_("SMS provider config"))

    def is_configured(self) -> bool:
        return bool(self.api_base_url and self.account_sid and self.auth_token and self.from_number)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        pass

    @classmethod
    def load(cls) -> "SmsProviderConfig":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj
