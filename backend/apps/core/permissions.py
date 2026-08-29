"""The project's authorization vocabulary and its one DRF permission class.

Two halves, deliberately split (see CONVENTIONS.md §22):

* The permission STRINGS below are code. Code is what enforces a permission,
  so a permission that no view declares must not be grantable — SEC-2's
  future admin UI offers exactly this list and nothing else.
* The role -> permission MAPPING is data (`accounts.Role.permissions`), so
  SEC-2 can build a UI over it.

Adding a permission is a two-line change here plus the view that declares it.
Every feature story appends its own; this list grows with the domain.
"""

from rest_framework.permissions import BasePermission


class Permissions:
    """Permission strings, namespaced `<area>.<action>`.

    Only the areas that exist today are listed. A feature story adds its own
    constants here in the same change as the viewset that declares them —
    never a string literal at the call site.
    """

    USERS_VIEW = "users.view"
    USERS_MANAGE = "users.manage"
    ROLES_MANAGE = "roles.manage"
    CUSTOMERS_VIEW = "customers.view"
    CUSTOMERS_MANAGE = "customers.manage"
    TICKETS_VIEW = "tickets.view"
    TICKETS_MANAGE = "tickets.manage"
    KNOWLEDGE_BASE_VIEW = "knowledge_base.view"
    KNOWLEDGE_BASE_MANAGE = "knowledge_base.manage"
    PORTAL_ACCESS = "portal.access"


ALL_PERMISSIONS: frozenset[str] = frozenset(
    value
    for name, value in vars(Permissions).items()
    if not name.startswith("_") and isinstance(value, str)
)


def permissions_for(user) -> frozenset[str]:
    """Every permission this user holds.

    A superuser holds all of them — Django's own `has_perm` already
    short-circuits to True for a superuser (verified), so anything narrower
    here would make the API and `/auth/me/` disagree. Duck-typed on `role`
    rather than importing `accounts`, to keep `core` free of app imports.
    """
    if not user or not user.is_authenticated:
        return frozenset()
    if user.is_superuser:
        return ALL_PERMISSIONS
    role = getattr(user, "role", None)
    if role is None:
        return frozenset()
    return frozenset(role.permissions)


class HasPermission(BasePermission):
    """Grants a request when the user holds the permission the view demands.

    The view declares a `permission_map` of action -> permission string:

        class CustomerViewSet(BaseModelViewSet):
            permission_map = {
                "list": Permissions.CUSTOMERS_VIEW,
                "retrieve": Permissions.CUSTOMERS_VIEW,
                "create": Permissions.CUSTOMERS_MANAGE,
                "update": Permissions.CUSTOMERS_MANAGE,
                "partial_update": Permissions.CUSTOMERS_MANAGE,
                "destroy": Permissions.CUSTOMERS_MANAGE,
            }

    A view with no `permission_map` (or an action absent from it) is
    authenticated-only — this class does NOT silently deny, because a missing
    entry is far more often an unfinished map than an intent to forbid, and a
    silent 403 on a working endpoint is the harder bug to find.
    `IsAuthenticated` is what keeps such a view from being public; see
    BaseModelViewSet.

    Plain `APIView`s have no `self.action` (verified — DRF sets it in
    `ViewSet.initialize_request`), so `permission_map` may also be keyed by
    lowercased HTTP method for those.
    """

    def has_permission(self, request, view) -> bool:
        required = self._required_permission(request, view)
        if required is None:
            return True
        return required in permissions_for(request.user)

    def has_object_permission(self, request, view, obj) -> bool:
        """Row-level half of the extension point CONVENTIONS.md §22 names.

        A no-op for every existing (staff) viewset: it only tightens the
        check when the caller is a portal customer, i.e. `request.user` has a
        linked `Customer` row. `CustomerScopedModelViewSet.get_queryset()`
        (apps/core/views.py) is the PRIMARY defence — DRF's own
        `get_object()` filters through `get_queryset()` before this method
        ever runs, so a mismatched pk already 404s, not 403s, for the
        standard list/retrieve/update/destroy actions. This method exists for
        the case that primary defence cannot cover: a custom `@action` that
        fetches an object directly (e.g. `Model.objects.get(pk=...)`) instead
        of through `self.get_object()`. Without it, such an action would leak
        another customer's row with no gate at all.

        Only tightens for a view that opts in by declaring `customer_field`
        (every `CustomerScopedModelViewSet` subclass). A plain
        `BaseModelViewSet` subclass — e.g. `ArticleViewSet`, `FAQViewSet` —
        has no customer-owned relation at all; defaulting `customer_field` to
        `"customer"` here caused a false 403 on `Article.retrieve` for any
        portal customer, since `Article` has no `customer` FK to read a
        `customer_id` off of. Found live by Story 46 (Access FAQs), the
        first story to give a portal customer real `retrieve` access to a
        non-`CustomerScopedModelViewSet` endpoint.
        """
        customer = getattr(request.user, "customer_profile", None)
        if customer is None:
            return True
        if not hasattr(view, "customer_field"):
            return True
        customer_field = view.customer_field
        return getattr(obj, f"{customer_field}_id", None) == customer.id

    @staticmethod
    def _required_permission(request, view) -> str | None:
        mapping = getattr(view, "permission_map", None)
        if not mapping:
            return None
        action = getattr(view, "action", None)
        if action is not None and action in mapping:
            return mapping[action]
        return mapping.get(request.method.lower())
