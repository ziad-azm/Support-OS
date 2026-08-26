from django.urls import re_path

from .consumers import TicketChatConsumer

websocket_urlpatterns = [
    re_path(r"^ws/tickets/(?P<ticket_id>\d+)/$", TicketChatConsumer.as_asgi()),
]
