from rest_framework.routers import DefaultRouter

from .views import AttachmentViewSet, ContactDetailViewSet, CustomerViewSet, NoteViewSet

app_name = "customers"

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("contact-details", ContactDetailViewSet, basename="contact-detail")
router.register("notes", NoteViewSet, basename="note")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = router.urls
