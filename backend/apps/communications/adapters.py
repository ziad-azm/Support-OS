from abc import ABC, abstractmethod

from .models import Message


class ChannelAdapter(ABC):
    """Interface every channel implementation subclasses — COMM-1 (Email),
    COMM-2 (WhatsApp), COMM-3 (Live Chat), COMM-4 (SMS) each provide exactly
    one concrete subclass. Two directions:

    * `receive` turns a channel-native inbound payload (an email, a webhook
      body, ...) into a persisted `Message` attached to the right `Ticket` —
      finding or creating that ticket is left to the adapter, since "how a
      channel identifies the right conversation" is channel-specific.
    * `send` delivers an outbound `Message` (already persisted — the shared
      conversation UI's reply form, task 8, always persists first) through
      this channel's real API.

    `register_adapter`/`get_adapter` below are the minimal channel ->
    adapter-class registry COMM-0 deferred. `apps/communications/email_adapter.py`
    (Story 14, COMM-1) is the first entry.
    """

    channel: str

    @abstractmethod
    def receive(self, payload: dict) -> Message:
        """Turn an inbound channel-native payload into a persisted Message."""
        raise NotImplementedError

    @abstractmethod
    def send(self, message: Message) -> None:
        """Deliver an outbound Message through this channel."""
        raise NotImplementedError


CHANNEL_ADAPTERS: dict[str, type[ChannelAdapter]] = {}


def register_adapter(adapter_cls: type[ChannelAdapter]) -> type[ChannelAdapter]:
    """Class decorator: `@register_adapter` on a `ChannelAdapter` subclass
    makes `get_adapter(channel)` find it. The subclass module must actually
    be imported for this to run — `CommunicationsConfig.ready()` is where
    that happens, once per process, not per request.
    """
    CHANNEL_ADAPTERS[adapter_cls.channel] = adapter_cls
    return adapter_cls


def get_adapter(channel: str) -> ChannelAdapter | None:
    adapter_cls = CHANNEL_ADAPTERS.get(channel)
    return adapter_cls() if adapter_cls else None
