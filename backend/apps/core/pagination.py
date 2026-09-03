from django.conf import settings
from django.core.paginator import Paginator
from django.utils.functional import cached_property
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .cache import cache_delete, cache_get, cache_set, digest
from .envelope import success_envelope


class CachedCountPaginator(Paginator):
    """A Paginator whose `count` may come from the cache.

    `COUNT(*)` is the worst-scaling query in this API — measured at 4.3 ms
    over 50,000 rows and 96.1 ms over 250,000 (a Parallel Seq Scan; no index
    can help, since counting reads every row by definition). It is issued on
    EVERY paginated response, including `HomePage`'s two `page_size=1` KPI
    tiles, where it is the entire cost of the request.

    Only the count is cached. The page of rows itself is always a live query.
    PROD-2 (Story 91). See CONVENTIONS.md § 35.
    """

    cache_key = None

    @cached_property
    def count(self):
        if self.cache_key is None:
            return super().count
        cached = cache_get(self.cache_key)
        if cached is not None:
            return cached
        value = super().count
        # Only worth a round-trip above the threshold — below it the COUNT is
        # faster than the cache lookup that would replace it.
        if value >= settings.COUNT_CACHE_MIN_ROWS:
            cache_set(self.cache_key, value, settings.COUNT_CACHE_TTL_SECONDS)
        return value


def _cached_count_paginator_factory(cache_key):
    """Returns a callable with the same signature DRF's own
    `PageNumberPagination.paginate_queryset` calls its `django_paginator_class`
    with — `(object_list, per_page)`, positionally, no `self` — so it can
    stand in for that attribute for exactly one request. Constructing the
    `CachedCountPaginator` this way is what lets the per-request cache key
    reach the paginator instance without a public constructor kwarg.
    """

    def make(object_list, per_page, **kwargs):
        paginator = CachedCountPaginator(object_list, per_page, **kwargs)
        paginator.cache_key = cache_key
        return paginator

    return make


class DefaultPageNumberPagination(PageNumberPagination):
    """Project-wide pagination. Page size from ENV, clamped to a maximum.

    `get_paginated_response` returns an `Envelope`, so the renderer passes it
    through and the pagination block lands under `meta` instead of flattening
    DRF's default count/next/previous into the top level.

    `page_size` is deliberately not set here — it comes from
    REST_FRAMEWORK["PAGE_SIZE"], which reads DRF_PAGE_SIZE. Setting both would
    create two sources of truth.
    """

    page_size_query_param = "page_size"
    max_page_size = getattr(settings, "DRF_MAX_PAGE_SIZE", 100)

    def paginate_queryset(self, queryset, request, view=None):
        """PROD-2: route the paginator's `count` through the cache.

        The key must identify this exact filtered/scoped queryset, so that
        `?status=open` and `?status=closed` never share a count. `str(
        queryset.query)` is the compiled SQL including every filter the
        viewset applied; it is hashed because it is unbounded in length and
        may contain characters some cache backends reject.

        Building the key must never be able to fail the request — if
        compiling the queryset to a string raises for any reason, pagination
        simply proceeds uncached rather than erroring.
        """
        try:
            cache_key = "count:" + digest(queryset.db, str(queryset.query))
        except Exception:
            cache_key = None

        self.django_paginator_class = (
            _cached_count_paginator_factory(cache_key) if cache_key is not None else Paginator
        )

        try:
            return super().paginate_queryset(queryset, request, view)
        except NotFound:
            # A stale cached count can make `num_pages` larger than the table
            # now is, so DRF 404s a page that would exist if the count were
            # fresh. Drop the key and retry ONCE against a live count.
            if cache_key is not None:
                cache_delete(cache_key)
            return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        return Response(
            success_envelope(
                data,
                meta={
                    "pagination": {
                        "count": self.page.paginator.count,
                        "page": self.page.number,
                        "page_size": self.get_page_size(self.request),
                        "num_pages": self.page.paginator.num_pages,
                        "next": self.get_next_link(),
                        "previous": self.get_previous_link(),
                    }
                },
            )
        )

    def get_paginated_response_schema(self, schema):
        """What drf-spectacular reads to document a list endpoint — it
        never calls `get_paginated_response` above, so without this
        override every list endpoint would be documented with DRF's
        default flat `{count, next, previous, results}` body, a shape this
        API has never returned (README.md § Paginated). Returns the full
        envelope, `meta.pagination` included, because that block is a
        sibling of `data` and cannot be added from outside — which is
        also why `apps.integrations.schema.envelope_postprocessing_hook`
        skips an already-enveloped schema. INT-1 (Story 80).

        A plain dict, deliberately: this keeps `apps.core` free of any
        `drf_spectacular` import.
        """
        return {
            "type": "object",
            "required": ["success", "data", "error", "meta"],
            "properties": {
                "success": {"type": "boolean", "enum": [True]},
                "data": schema,
                "error": {"nullable": True},
                "meta": {
                    "type": "object",
                    "properties": {
                        "pagination": {
                            "type": "object",
                            "properties": {
                                "count": {"type": "integer", "example": 137},
                                "page": {"type": "integer", "example": 2},
                                "page_size": {"type": "integer", "example": 25},
                                "num_pages": {"type": "integer", "example": 6},
                                "next": {"type": "string", "format": "uri", "nullable": True},
                                "previous": {
                                    "type": "string",
                                    "format": "uri",
                                    "nullable": True,
                                },
                            },
                        }
                    },
                },
            },
        }
