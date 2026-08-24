from django.db import connection
from django.db.utils import OperationalError
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class BaseModelViewSet(viewsets.ModelViewSet):
    """Single inheritance point for every domain ModelViewSet.

    Deliberately empty. It exists so AUTH-2 can add project-wide permission
    and filtering defaults in one place instead of editing every viewset.
    Return plain payloads from actions — the renderer adds the envelope.
    """


class HealthView(APIView):
    """Liveness probe. Reports database reachability, not just process health.

    Returns a plain dict: never build an envelope in a view, or the renderer
    will pass the hand-made one through and the shape drifts.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
            database = "ok"
        except OperationalError:
            database = "error"

        payload = {
            "status": "ok" if database == "ok" else "degraded",
            "database": database,
        }
        code = (
            status.HTTP_200_OK
            if database == "ok"
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(payload, status=code)


class ApiNotFoundView(APIView):
    """Catch-all for unmatched paths under /api/.

    Django's URL resolver raises Http404 before any DRF view runs, so an
    unmatched path would return Django's HTML 404 page and break the envelope
    contract for exactly the case a client hits most often: a typo'd endpoint.
    Routing the miss through a DRF view puts it back in envelope form.

    Registered last in `config/api_urls.py`. Any method is a 404 here, not a
    405 — the path does not exist, so no method on it is allowed.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def _not_found(self, request, *args, **kwargs):
        raise NotFound()

    get = post = put = patch = delete = head = options = _not_found
