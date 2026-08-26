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

    No adapter is registered yet. `channel` -> adapter-class dispatch is
    deferred to whichever story adds the first concrete subclass (COMM-1) —
    a registry with zero real entries has nothing to prove it right. See
    Story 13 `## Prerequisites`.
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
