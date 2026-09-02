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
