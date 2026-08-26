from rest_framework.routers import DefaultRouter

from .views import ContactDetailViewSet, CustomerViewSet

app_name = "customers"

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("contact-details", ContactDetailViewSet, basename="contact-detail")

urlpatterns = router.urls
