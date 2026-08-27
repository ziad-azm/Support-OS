"""Who can a ticket be assigned to — TKT-3.

Lives in `apps.tickets` because the *question* is ticket-domain, even
though the rows are `accounts.User`: the same placement rule
`apps/customers/timeline.py` follows (Story 20). Safe reverse-direction
import — no *model* here imports across apps.

Deliberately NOT a general user-listing API: `SEC-1` owns user admin
(`SupportOs backlog.MD:682-684`). See Story 22 `## Prerequisites`.
"""

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from apps.core.permissions import Permissions


def assignable_agents() -> QuerySet:
    """Active users who actually hold `tickets.manage`.

    Mirrors `apps.core.permissions.permissions_for`'s own two branches in
    SQL: a superuser holds every permission by bypass (and typically has
    no role at all), otherwise the role's `permissions` JSON list must
    contain the string. `__contains` on a JSONField is Postgres-only in
    Django — verified working against this project's Postgres 17, see
    Story 22 `## Prerequisites`.

    One queryset, two callers: the `assignable-agents` options endpoint and
    `TicketViewSet.assign`'s validation. Sharing it is what keeps the
    picker and the enforcement from drifting apart.
    """
    return (
        get_user_model()
        .objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(role__permissions__contains=[Permissions.TICKETS_MANAGE]))
        .select_related("role")
        .order_by("first_name", "last_name", "email")
    )
