from rest_framework.routers import SimpleRouter

from .views import TaskViewSet

app_name = "agents"

router = SimpleRouter()
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = router.urls
