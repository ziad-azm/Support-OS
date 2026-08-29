from django.urls import path

from .views import SettingsView

app_name = "organization"

urlpatterns = [
    path("settings/", SettingsView.as_view(), name="settings"),
]
