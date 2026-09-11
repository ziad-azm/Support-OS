from django.urls import path

from .throttled_token_views import (
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
)
from .views import (
    ChangePasswordView,
    InviteConfirmView,
    LogoutView,
    MeView,
    MfaVerifyView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    TwoFactorConfirmView,
    TwoFactorDisableView,
    TwoFactorEnrollView,
)

app_name = "accounts"

urlpatterns = [
    # PROD-3: the throttled subclasses, at the SAME paths and under the SAME
    # route names — `reverse()` call sites and the frontend both depend on
    # those staying identical. See apps/accounts/throttled_token_views.py.
    path("token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"),
    # SEC-9: the 2FA challenge exchange, alongside the token endpoints above.
    path("token/verify-mfa/", MfaVerifyView.as_view(), name="token_verify_mfa"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("invite/confirm/", InviteConfirmView.as_view(), name="invite_confirm"),
    path(
        "password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("2fa/enroll/", TwoFactorEnrollView.as_view(), name="two_factor_enroll"),
    path("2fa/confirm/", TwoFactorConfirmView.as_view(), name="two_factor_confirm"),
    path("2fa/disable/", TwoFactorDisableView.as_view(), name="two_factor_disable"),
]
