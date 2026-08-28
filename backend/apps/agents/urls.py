from rest_framework.routers import SimpleRouter

from .views import QuickReplyViewSet, TaskViewSet

app_name = "agents"

router = SimpleRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("quick-replies", QuickReplyViewSet, basename="quick-reply")

urlpatterns = router.urls
