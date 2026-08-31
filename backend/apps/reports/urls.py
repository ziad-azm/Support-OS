from django.urls import path

from .views import (
    AgentPerformanceReportView,
    CsatBreakdownReportView,
    CsatTrendReportView,
    DashboardKpiReportView,
    SlaBreachRateReportView,
    SlaTrendReportView,
    TicketBreakdownReportView,
    TicketVolumeReportView,
)

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
    path("reports/sla/trend/", SlaTrendReportView.as_view(), name="sla-trend"),
    path("reports/sla/breach-rate/", SlaBreachRateReportView.as_view(), name="sla-breach-rate"),
    path(
        "reports/agents/performance/",
        AgentPerformanceReportView.as_view(),
        name="agent-performance",
    ),
    path("reports/csat/trend/", CsatTrendReportView.as_view(), name="csat-trend"),
    path("reports/csat/breakdown/", CsatBreakdownReportView.as_view(), name="csat-breakdown"),
    path("reports/dashboard/kpis/", DashboardKpiReportView.as_view(), name="dashboard-kpis"),
]
