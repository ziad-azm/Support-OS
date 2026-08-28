from rest_framework.routers import SimpleRouter

from .views import InternalNoteViewSet, QuickReplyViewSet, TaskViewSet

app_name = "agents"

router = SimpleRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("quick-replies", QuickReplyViewSet, basename="quick-reply")
router.register("internal-notes", InternalNoteViewSet, basename="internal-note")

urlpatterns = router.urls
