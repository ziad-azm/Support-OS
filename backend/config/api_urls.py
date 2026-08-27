"""Root of the versionless `/api/` tree.

Every domain app that exposes endpoints gets one `include()` line here. This is
the single place to look to see the API surface.
"""

from django.urls import include, path, re_path

from apps.core.views import ApiNotFoundView

urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.notifications.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
