from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions, permissions_for
from apps.core.views import BaseModelViewSet

from .models import FAQ, Article, Category
from .search import search_knowledge_base
from .serializers import ArticleSerializer, CategorySerializer, FAQSerializer


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


class CategoryViewSet(BaseModelViewSet):
    """Article-category CRUD. Reuses `knowledge_base.*` — a category is
    part of the knowledge-base domain, not a separate permission concern,
    mirroring `apps.tickets.views.CategoryViewSet`'s identical reuse of
    `tickets.*`. See Story 40 `## Story Goal`.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    permission_map = {
        "list": Permissions.KNOWLEDGE_BASE_VIEW,
        "retrieve": Permissions.KNOWLEDGE_BASE_VIEW,
        "create": Permissions.KNOWLEDGE_BASE_MANAGE,
        "update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "partial_update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "destroy": Permissions.KNOWLEDGE_BASE_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)


class ArticleViewSet(BaseModelViewSet):
    """Article CRUD, with a draft/published visibility split. See Story 40
    `## Story Goal` for why `get_queryset` branches on the caller's own
    `knowledge_base.manage` permission rather than on the action name.
    """

    queryset = Article.objects.select_related("category").all()
    serializer_class = ArticleSerializer

    permission_map = {
        "list": Permissions.KNOWLEDGE_BASE_VIEW,
        "retrieve": Permissions.KNOWLEDGE_BASE_VIEW,
        "create": Permissions.KNOWLEDGE_BASE_MANAGE,
        "update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "partial_update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "destroy": Permissions.KNOWLEDGE_BASE_MANAGE,
    }

    ordering_fields = ("title_en", "status", "created_at")
    search_fields = ("title_en", "title_ar", "body_en", "body_ar")

    def get_queryset(self):
        queryset = super().get_queryset()
        if Permissions.KNOWLEDGE_BASE_MANAGE in permissions_for(self.request.user):
            return queryset
        # A view-only caller sees only published rows on BOTH list and
        # retrieve — a draft's direct id returns 404, not 403, so its
        # existence is not confirmed to a caller who cannot manage it.
        return queryset.filter(status=Article.Status.PUBLISHED)


class KnowledgeBaseSearchView(APIView):
    """Ranked full-text search across FAQs and articles — KB-3. The first
    plain `APIView` in this project whose `permission_map` is keyed by HTTP
    method rather than DRF `action` — `HasPermission`'s own docstring
    already documents this fallback (`apps/core/permissions.py:84-86`) but
    had no real caller before this story.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.KNOWLEDGE_BASE_VIEW}

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            raise ValidationError({"q": [_("Must be at least 2 characters.")]})
        include_drafts = Permissions.KNOWLEDGE_BASE_MANAGE in permissions_for(request.user)
        return Response(search_knowledge_base(query, include_drafts=include_drafts))
