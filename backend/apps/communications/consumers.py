import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.permissions import Permissions, permissions_for

from .live_chat_adapter import LiveChatAdapter, resolve_session_ticket
from .models import Message
from .serializers import MessageSerializer

UNAUTHORIZED = 4401
FORBIDDEN = 4403


class TicketChatConsumer(AsyncWebsocketConsumer):
    """One WebSocket per ticket's live conversation. Two kinds of caller:

    * `?customer_token=<signed>` — the anonymous widget's own session token
      (`live_chat_adapter.resolve_session_ticket`). Messages it sends are
      persisted as inbound `Message`s.
    * `?token=<JWT>` — a signed-in agent, already viewing the ticket in
      `TicketConversation.tsx`. Receive-only: an agent still replies
      through the existing `POST /api/messages/` form (Story 13) — this
      connection only pushes live updates to that already-working screen.
      Permission-checked (`tickets.view`), not just authenticated — see
      Story 16 `## Prerequisites`.

    Browsers cannot set custom headers on a WebSocket handshake, so both
    tokens travel in the query string, not an Authorization header.
    """

    async def connect(self):
        self.ticket_id = int(self.scope["url_route"]["kwargs"]["ticket_id"])
        params = self.scope["query_string"].decode()
        query = dict(pair.split("=", 1) for pair in params.split("&") if "=" in pair)

        customer_token = query.get("customer_token")
        jwt_token = query.get("token")

        if customer_token:
            ticket_id = resolve_session_ticket(customer_token)
            if ticket_id != self.ticket_id:
                await self.close(code=UNAUTHORIZED)
                return
            self.direction = Message.Direction.INBOUND
        elif jwt_token:
            try:
                access = AccessToken(jwt_token)
            except TokenError:
                await self.close(code=UNAUTHORIZED)
                return
            user = await database_sync_to_async(
                get_user_model().objects.filter(pk=access["user_id"]).first
            )()
            has_permission = user is not None and Permissions.TICKETS_VIEW in (
                await database_sync_to_async(permissions_for)(user)
            )
            if not has_permission:
                await self.close(code=FORBIDDEN)
                return
            self.direction = Message.Direction.OUTBOUND
        else:
            await self.close(code=UNAUTHORIZED)
            return

        self.group_name = f"ticket_{self.ticket_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Only the customer side sends over the socket — see the class
        # docstring. An agent connection ignores any inbound frame.
        if self.direction != Message.Direction.INBOUND:
            return
        try:
            data = json.loads(text_data)
        except ValueError:
            return
        body = (data.get("body") or "").strip()
        if not body:
            return

        message = await database_sync_to_async(LiveChatAdapter().receive)(
            {"ticket_id": self.ticket_id, "body": body}
        )
        payload = await database_sync_to_async(lambda: MessageSerializer(message).data)()
        await self.channel_layer.group_send(
            self.group_name, {"type": "chat.message", "message": payload}
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["message"]))
