import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

UNAUTHORIZED = 4401


class NotificationConsumer(AsyncWebsocketConsumer):
    """One WebSocket per signed-in user's own notification stream —
    receive-only, mirroring `TicketChatConsumer`'s agent-side connection
    (Story 16) but scoped to a user, not a ticket. Authenticated only, no
    domain permission — the equivalent REST endpoint (`NotificationViewSet`)
    needs none either, for the same reason (see Story 31
    `## Prerequisites`), satisfying `CONVENTIONS.md`'s own rule that a
    connection be "permission-checked, not just authenticated, whenever the
    equivalent REST endpoint would be" (line 1038).
    """

    async def connect(self):
        query = dict(
            pair.split("=", 1)
            for pair in self.scope["query_string"].decode().split("&")
            if "=" in pair
        )
        jwt_token = query.get("token")
        if not jwt_token:
            await self.close(code=UNAUTHORIZED)
            return
        try:
            access = AccessToken(jwt_token)
        except TokenError:
            await self.close(code=UNAUTHORIZED)
            return
        user = await database_sync_to_async(
            get_user_model().objects.filter(pk=access["user_id"]).first
        )()
        if user is None:
            await self.close(code=UNAUTHORIZED)
            return

        self.group_name = f"notifications_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event["notification"]))
