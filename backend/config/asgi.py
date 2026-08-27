"""
ASGI config for config project — now Channels-aware (Story 16, COMM-3).
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from apps.communications import routing as communications_routing  # noqa: E402
from apps.notifications import routing as notifications_routing  # noqa: E402

communications_websocket_urlpatterns = communications_routing.websocket_urlpatterns
notifications_websocket_urlpatterns = notifications_routing.websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            URLRouter(communications_websocket_urlpatterns + notifications_websocket_urlpatterns)
        ),
    }
)
