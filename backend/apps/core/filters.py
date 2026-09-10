"""DRF filter-backend overrides — the project's own strictness contract
applied to `rest_framework.filters`, the same way `apps.core.scoping`
applies it to `?<param>=` scope filters.
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter


class StrictOrderingFilter(OrderingFilter):
    """Rejects an unrecognized `?ordering=` field with a 400 instead of
    DRF's own default — silently dropping it and falling back to the
    view's default order.

    F-17 (QA-REPORT-1): `apps.core.scoping`'s own docstring states the
    project's rule for every other filter parameter — "NEVER a silent
    no-op: a typo'd filter that quietly returns everything is the harder
    bug to find" — and `apply_scope_filters` 400s an unrecognized
    `?department=`/`?branch=` value accordingly. `OrderingFilter` was the
    one filter backend still exempt: `?ordering=bogus` returned 200 with
    the view's default order, giving no signal that the field name was
    wrong.

    Drop-in for `rest_framework.filters.OrderingFilter` — same
    `ordering_param`, same `ordering_fields`/`get_default_valid_fields`
    resolution, same `-field` descending syntax. Only
    `remove_invalid_fields`'s failure mode changes.
    """

    def remove_invalid_fields(self, queryset, fields, view, request):
        valid_fields = [
            item[0] for item in self.get_valid_fields(queryset, view, {"request": request})
        ]

        def term_field(term: str) -> str:
            return term[1:] if term.startswith("-") else term

        invalid = [term for term in fields if term_field(term) not in valid_fields]
        if invalid:
            raise ValidationError(
                {
                    self.ordering_param: [
                        _("Invalid ordering field(s): %(fields)s.") % {"fields": ", ".join(invalid)}
                    ]
                }
            )
        return super().remove_invalid_fields(queryset, fields, view, request)
