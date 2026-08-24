from django.conf import settings
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .envelope import success_envelope


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
