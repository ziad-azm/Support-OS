from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LogoutSerializer, UserSerializer


class LogoutView(APIView):
    """Blacklists the given refresh token.

    No Authorization header required: the refresh token in the body IS the
    credential being revoked, and a client whose access token has already
    expired must still be able to invalidate its refresh token. See
    CONVENTIONS.md §21.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            # Already invalid/expired/blacklisted — the caller's goal (this
            # token must not work again) already holds. Idempotent by design.
            pass
        return Response(None, status=status.HTTP_200_OK)


class MeView(APIView):
    """The authenticated user's own profile. The frontend's one source of
    `AuthUser` — fetched once at boot and once right after login.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
