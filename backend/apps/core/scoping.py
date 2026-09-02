"""Query-param scoping — ORG-1's reusable filter mechanism.

The second scoping primitive in this codebase, and deliberately NOT a
replacement for the first. `CustomerScopedModelViewSet` (`.views`) scopes
by WHO IS CALLING: a portal customer sees their own rows, always, with no
way to ask for anyone else's. This module scopes by WHAT THE CALLER ASKED
FOR: an optional `?<param>=` narrowing an already-authorized list. Neither
is a security boundary the other can stand in for.

Generalizes the four hand-parsed filters already inside
`TicketViewSet.get_queryset` (apps/tickets/views.py:102-141) — same
contract, one implementation:

* absent or empty  -> no filtering at all (a list must still work unfiltered)
* a numeric id     -> `filter(<field>_id=<id>)`
* the literal
  `"none"`         -> `filter(<field>__isnull=True)` — rows with no scope
* anything else    -> DRF `ValidationError` (400). NEVER a silent no-op:
                      a typo'd filter that quietly returns everything is
                      the harder bug to find.

ORG-2's `Branch` adds `ScopeFilter(param="branch", field="branch")` to a
viewset's `scope_filters` and writes no parsing code of its own. Adding a
`__contains`/date/enum scope later means adding a field to `ScopeFilter`,
not a second module.
"""

from dataclasses import dataclass

from django.db.models import QuerySet
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# The sentinel for "rows with no value in this scope". A string, not an
# empty param: `?department=` (empty) already means "no filter" above, and
# the two must not collide. Mirrors the frontend's own `'all'`/`'none'`
# Select sentinels (CONVENTIONS.md §19), which exist for the same
# "Radix Select.Item cannot have an empty value" reason.
UNSCOPED = "none"


@dataclass(frozen=True)
class ScopeFilter:
    """`param` is the query-string key; `field` is the FK's attribute name
    on the model (NOT `<field>_id` — the `_id`/`__isnull` suffixes are
    appended here so a declaration reads like the model field it names).
    """

    param: str
    field: str


def apply_scope_filters(queryset: QuerySet, query_params, scopes) -> QuerySet:
    """Applies every scope in `scopes` that the caller actually sent.

    A plain function, not a method, so the report views — plain `APIView`s
    with no queryset of their own until `get_report` builds one — can reuse
    it without inheriting anything. `ScopedQuerysetMixin` below is a thin
    wrapper for the viewset case.
    """
    for scope in scopes:
        raw = query_params.get(scope.param)
        if not raw:
            continue
        if raw == UNSCOPED:
            queryset = queryset.filter(**{f"{scope.field}__isnull": True})
            continue
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValidationError(
                {scope.param: [_('Must be a numeric id or "%(none)s".') % {"none": UNSCOPED}]}
            ) from None
        queryset = queryset.filter(**{f"{scope.field}_id": value})
    return queryset


class ScopedQuerysetMixin:
    """Mix in BEFORE `BaseModelViewSet` in the bases list, so this
    `get_queryset` runs first and a subclass's own override reaches it
    through `super()`:

        class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):
            scope_filters = (ScopeFilter(param="department", field="department"),)

    The viewset must also have a real `queryset` class attribute —
    `ModelViewSet.get_queryset`, which `super()` eventually reaches,
    asserts on it.

    Only `list` is scoped by default. A detail route must NOT be — a 404
    that depends on a query param the client did not intend as a scope is
    an unpleasant surprise, and `retrieve` on an authorized row is not a
    listing question. Override `scoped_actions` to widen it deliberately.

    Declares NO `permission_map` — per `HasPermission`'s grant-on-omission
    rule (`apps/core/permissions.py:80-90`), every subclass must still
    declare its own, exactly as `CustomerScopedModelViewSet` already
    documents for its own subclasses.
    """

    scope_filters: tuple[ScopeFilter, ...] = ()
    scoped_actions: tuple[str, ...] = ("list",)

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "action", None) not in self.scoped_actions:
            return queryset
        return apply_scope_filters(queryset, self.request.query_params, self.scope_filters)
