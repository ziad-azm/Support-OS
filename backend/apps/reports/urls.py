from django.urls import path

from .views import TicketBreakdownReportView, TicketVolumeReportView

app_name = "reports"

# No router: these are plain APIViews, not viewsets — the `path()`-only
# half of `apps/knowledge_base/urls.py`'s router-plus-path shape. Nested
# under `reports/tickets/` so RPT-2..RPT-5 add siblings
# (`reports/sla/`, `reports/agents/`, ...) rather than overloading these.
urlpatterns = [
    path("reports/tickets/volume/", TicketVolumeReportView.as_view(), name="ticket-volume"),
    path(
        "reports/tickets/breakdown/", TicketBreakdownReportView.as_view(), name="ticket-breakdown"
    ),
]
