from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer
from apps.customers.models import ContactDetail

from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig

# Maps a Message channel to the ContactDetail channel it draws candidate
# `target_address` values from — WhatsApp/SMS/Email each have a different
# `ContactDetail.Channel` slug than their own `Message.Channel` one (`sms`
# vs `phone`), so this cannot be a shared identity mapping.
_CONTACT_CHANNEL_FOR_MESSAGE_CHANNEL = {
    Message.Channel.EMAIL: ContactDetail.Channel.EMAIL,
    Message.Channel.SMS: ContactDetail.Channel.PHONE,
    Message.Channel.WHATSAPP: ContactDetail.Channel.WHATSAPP,
}


class MessageSerializer(BaseModelSerializer):
    # `ticket` must stay writable on create (the reply's target ticket,
    # chosen from the ticket detail page's reply form) but must never
    # change afterward — a PATCH that moves `ticket` silently relocates a
    # reply into a different ticket's conversation. See `BaseModelSerializer`.
    immutable_fields = ("ticket",)

    class Meta(BaseModelSerializer.Meta):
        model = Message
        fields = (
            "id",
            "ticket",
            "direction",
            "channel",
            "body",
            "metadata",
            "target_address",
            "created_at",
            "updated_at",
        )
        # `metadata` is adapter-only data no UI ever sets — read-only via the
        # API. Verified this tuple-concatenation shape works (`## Prerequisites`).
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("metadata",)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        target_address = attrs.get("target_address", "")
        if not target_address:
            return attrs

        channel = attrs.get("channel") or getattr(self.instance, "channel", None)
        ticket = attrs.get("ticket") or getattr(self.instance, "ticket", None)
        contact_channel = _CONTACT_CHANNEL_FOR_MESSAGE_CHANNEL.get(channel)
        # `web_form`/`chat` have no addressable destination at all — a
        # `target_address` on either is always invalid, the same as an
        # unrecognised channel would be.
        if ticket is None or contact_channel is None:
            raise serializers.ValidationError(
                {"target_address": [_("This channel does not support choosing a target address.")]}
            )

        customer = ticket.customer
        # A `ContactDetail` row for this channel is always a valid
        # candidate, regardless of the opt-out/opt-in flags below — those
        # flags govern only the PRIMARY `email`/`phone` fields on `Customer`
        # itself, never a customer's own separately-added secondary
        # contacts.
        known_addresses = set(
            ContactDetail.objects.filter(customer=customer, channel=contact_channel).values_list(
                "value", flat=True
            )
        )
        if channel == Message.Channel.EMAIL and customer.email and customer.email_contact_enabled:
            known_addresses.add(customer.email)
        elif channel == Message.Channel.SMS and customer.phone and customer.phone_contact_enabled:
            known_addresses.add(customer.phone)
        # WhatsApp is opt-in twice over: `whatsapp_enabled` is the shortcut
        # for "the PRIMARY phone above is ALSO my WhatsApp number"; a
        # dedicated `ContactDetail(channel="whatsapp")` row (already
        # included above, unconditionally) remains the way to register a
        # DIFFERENT number as WhatsApp-only.
        elif channel == Message.Channel.WHATSAPP and customer.phone and customer.whatsapp_enabled:
            known_addresses.add(customer.phone)

        if target_address not in known_addresses:
            raise serializers.ValidationError(
                {
                    "target_address": [
                        _("Must be one of this customer's own known addresses for this channel.")
                    ]
                }
            )
        return attrs


class EmailProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `EmailProviderConfig` row. `host_password`
    is `write_only`, the same posture `ErpConnectionSerializer.auth_token`
    (Story 81) takes; `has_host_password` is what the UI renders instead.
    A blank/omitted `host_password` on `PATCH` leaves the stored value
    untouched (`update` below) — without that, saving any other field
    from a form that cannot display the current password would silently
    wipe it, and the next ticket-reply email would start failing.
    """

    host_password = serializers.CharField(
        max_length=255, required=False, allow_blank=True, write_only=True
    )
    has_host_password = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = EmailProviderConfig
        fields = (
            "id",
            "host",
            "port",
            "host_user",
            "host_password",
            "has_host_password",
            "use_tls",
            "default_from_email",
            "created_at",
            "updated_at",
        )

    def get_has_host_password(self, obj) -> bool:
        return bool(obj.host_password)

    def update(self, instance, validated_data):
        if not validated_data.get("host_password"):
            validated_data.pop("host_password", None)
        return super().update(instance, validated_data)


class WhatsAppProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `WhatsAppProviderConfig` row. Same
    write-only-credential contract as `EmailProviderConfigSerializer`
    above, applied to `access_token`.
    """

    access_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_access_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = WhatsAppProviderConfig
        fields = (
            "id",
            "api_base_url",
            "phone_number_id",
            "access_token",
            "has_access_token",
            "created_at",
            "updated_at",
        )

    def get_has_access_token(self, obj) -> bool:
        return bool(obj.access_token)

    def update(self, instance, validated_data):
        if not validated_data.get("access_token"):
            validated_data.pop("access_token", None)
        return super().update(instance, validated_data)


class SmsProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `SmsProviderConfig` row. Same
    write-only-credential contract, applied to `auth_token` — the same
    field `SMSInboundWebhookView` now also reads (Story 82
    `## Prerequisites`), so a value saved here takes effect for both
    outbound sending and inbound signature verification at once.
    """

    auth_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_auth_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = SmsProviderConfig
        fields = (
            "id",
            "api_base_url",
            "account_sid",
            "auth_token",
            "has_auth_token",
            "from_number",
            "created_at",
            "updated_at",
        )

    def get_has_auth_token(self, obj) -> bool:
        return bool(obj.auth_token)

    def update(self, instance, validated_data):
        if not validated_data.get("auth_token"):
            validated_data.pop("auth_token", None)
        return super().update(instance, validated_data)
