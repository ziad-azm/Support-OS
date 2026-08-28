from django.urls import path

from .views import PortalTicketViewSet

app_name = "portal"

# A plain `path()`, not a router: this viewset exposes exactly one action.
# Registering it with a router would additionally route list/retrieve/
# update/destroy URLs this story does not want reachable — see
# PortalTicketViewSet's own docstring.
urlpatterns = [
    path(
        "portal/tickets/",
        PortalTicketViewSet.as_view({"post": "create"}),
        name="portal-ticket-create",
    ),
]
