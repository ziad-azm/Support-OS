from rest_framework.routers import SimpleRouter

from .views import NotificationViewSet

app_name = "notifications"

router = SimpleRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
