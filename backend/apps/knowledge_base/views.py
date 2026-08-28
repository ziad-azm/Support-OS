from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import FAQ
from .serializers import FAQSerializer


class FAQViewSet(BaseModelViewSet):
    """FAQ CRUD — the first consumer of `BaseModelViewSet` in
    `apps.knowledge_base`. Every action is mapped: an unmapped action would
    fall through to authenticated-only, which for a write endpoint is not
    what we want. See CONVENTIONS.md §22.
    """

    queryset = FAQ.objects.all()
    serializer_class = FAQSerializer

    permission_map = {
        "list": Permissions.KNOWLEDGE_BASE_VIEW,
        "retrieve": Permissions.KNOWLEDGE_BASE_VIEW,
        "create": Permissions.KNOWLEDGE_BASE_MANAGE,
        "update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "partial_update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "destroy": Permissions.KNOWLEDGE_BASE_MANAGE,
    }

    # Matches `ColumnDef.id` on the manage screen, exactly like every prior
    # feature's `ordering_fields` contract (CONVENTIONS.md §23).
    ordering_fields = ("order", "question", "created_at")
    search_fields = ("question", "answer")
