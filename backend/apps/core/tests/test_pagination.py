"""DefaultPageNumberPagination puts its block under `meta`, not at the top level.

Driven through the paginator directly with a plain list, so no model and no
database are involved.
"""

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.exceptions import NotFound
from rest_framework.test import APIRequestFactory

from apps.core.envelope import Envelope
from apps.core.pagination import DefaultPageNumberPagination

PAGINATION_KEYS = {"count", "page", "page_size", "num_pages", "next", "previous"}


class PaginationTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.items = list(range(100))

    def paginate(self, query=""):
        paginator = DefaultPageNumberPagination()
        request = self.factory.get(f"/api/things/{query}")
        # DRF's paginator expects a DRF Request-like object for query_params.
        from rest_framework.request import Request

        drf_request = Request(request)
        page = paginator.paginate_queryset(self.items, drf_request, view=None)
        return paginator, page

    def test_paginated_response_puts_pagination_in_meta(self):
        paginator, page = self.paginate()
        response = paginator.get_paginated_response(page)
        body = response.data
        self.assertIsInstance(body, Envelope)
        self.assertIs(body["success"], True)
        self.assertEqual(body["data"], page)
        self.assertEqual(set(body["meta"]["pagination"]), PAGINATION_KEYS)
        # Explicitly NOT DRF's default flat shape.
        self.assertNotIn("results", body)
        self.assertNotIn("count", body)

    def test_default_page_size_comes_from_settings(self):
        _paginator, page = self.paginate()
        self.assertEqual(len(page), settings.DRF_PAGE_SIZE)

    def test_pagination_meta_values(self):
        paginator, page = self.paginate("?page=2")
        pagination = paginator.get_paginated_response(page).data["meta"]["pagination"]
        self.assertEqual(pagination["count"], 100)
        self.assertEqual(pagination["page"], 2)
        self.assertEqual(pagination["page_size"], settings.DRF_PAGE_SIZE)
        self.assertEqual(pagination["num_pages"], 100 // settings.DRF_PAGE_SIZE)
        self.assertIsNotNone(pagination["previous"])

    def test_page_size_query_param_is_clamped_to_max(self):
        paginator, page = self.paginate("?page_size=100000")
        pagination = paginator.get_paginated_response(page).data["meta"]["pagination"]
        self.assertEqual(pagination["page_size"], settings.DRF_MAX_PAGE_SIZE)
        self.assertEqual(len(page), settings.DRF_MAX_PAGE_SIZE)

    def test_page_out_of_range_raises_not_found(self):
        # Becomes a `not_found` 404 envelope via the global exception handler,
        # rather than a silent empty 200.
        with self.assertRaises(NotFound):
            self.paginate("?page=9999")
