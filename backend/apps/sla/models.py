from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Category, Ticket


class SLAPolicy(TimeStampedModel):
    """Response/resolution time targets — SLA-1. One row per (priority,
    category) combination worth tracking; `category=None` is the default
    for that priority across every category with no more specific
    override. See `apps/sla/policy.py::resolve_policy` for the lookup
    order, and Story 28 `## Prerequisites` for why `priority` reuses
    `Ticket.Priority`'s own choices rather than re-declaring them.
    """

    priority = models.CharField(_("priority"), max_length=20, choices=Ticket.Priority.choices)
    # CASCADE, not SET_NULL: a category-specific policy has no meaning
    # once its category is gone — the same reasoning `Message.ticket`
    # already uses for a child with no existence independent of its
    # parent (Story 13). `null=True` is the OTHER half of the design:
    # this field means "no category override" when absent, not "unknown
    # category" — contrast `Ticket.category`'s own SET_NULL (Story 18),
    # a genuinely different relationship.
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sla_policies",
        verbose_name=_("category"),
    )
    response_target_minutes = models.PositiveIntegerField(
        _("response target (minutes)"),
        help_text=_("Minutes from ticket creation within which a first outbound reply is due."),
    )
    resolution_target_minutes = models.PositiveIntegerField(
        _("resolution target (minutes)"),
        help_text=_(
            "Minutes from ticket creation within which the ticket must reach resolved/closed."
        ),
    )

    class Meta:
        verbose_name = _("SLA policy")
        verbose_name_plural = _("SLA policies")
        constraints = [
            models.UniqueConstraint(
                fields=["priority", "category"], name="unique_sla_policy_priority_category"
            )
        ]
        ordering = ("priority", "category__name")

    def clean(self):
        # Guards the admin (DRF has no write path for this model at all —
        # config is admin-only, see Story 28 `## Prerequisites`). A
        # resolution target shorter than the response target for the SAME
        # policy is never sensible: you cannot resolve a ticket before
        # you have even replied to it.
        if (
            self.response_target_minutes is not None
            and self.resolution_target_minutes is not None
            and self.resolution_target_minutes < self.response_target_minutes
        ):
            raise ValidationError(
                {
                    "resolution_target_minutes": _(
                        "Resolution target must be at least the response target."
                    )
                }
            )

    def __str__(self) -> str:
        scope = self.category.name if self.category else str(_("all categories"))
        return f"{self.get_priority_display()} / {scope}"


class AssignmentRule(TimeStampedModel):
    """Automatic ticket routing — SLA-2. `category=None` is the
    category-agnostic default rule; a rule with a real `category` applies
    only to tickets of that category and takes precedence when present —
    the same two-tier specificity `SLAPolicy` already uses (Story 28). See
    Story 29 `## Prerequisites` for why "category" is a scoping dimension
    here, not a third strategy alongside `load`/`round_robin`.
    """

    class Strategy(models.TextChoices):
        LOAD = "load", _("Least loaded agent")
        ROUND_ROBIN = "round_robin", _("Round robin")

    # CASCADE, not SET_NULL: a category-specific rule has no meaning once
    # its category is gone — the same reasoning `SLAPolicy.category`
    # already uses (Story 28).
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="assignment_rules",
        verbose_name=_("category"),
    )
    strategy = models.CharField(_("strategy"), max_length=20, choices=Strategy.choices)
    # Empty means "any agent who holds tickets.manage" — `pick_agent`
    # always intersects this with `assignable_agents()` regardless, so a
    # stale member (one who lost `tickets.manage` after being added here)
    # can never actually receive an assignment. See Story 29
    # `## Prerequisites`.
    agents = models.ManyToManyField(
        "accounts.User",
        blank=True,
        related_name="assignment_rules",
        verbose_name=_("candidate agents"),
    )
    # The round-robin cursor: who this rule assigned last, so the next
    # pick continues the rotation. Unused by the `load` strategy. SET_NULL
    # so removing that user does not block their own deletion.
    last_assigned_agent = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="last_assigned_rules",
        verbose_name=_("last assigned agent"),
    )
    # Lets an admin pause an active rule without losing its configured
    # pool or round-robin cursor — unlike `SLAPolicy` (a passive, read-only
    # lookup), this rule fires on every ticket creation, so a temporary
    # on/off switch is worth the one extra field.
    enabled = models.BooleanField(_("enabled"), default=True)

    class Meta:
        verbose_name = _("assignment rule")
        verbose_name_plural = _("assignment rules")
        constraints = [
            models.UniqueConstraint(fields=["category"], name="unique_assignment_rule_category")
        ]
        ordering = ("category__name",)

    def __str__(self) -> str:
        scope = self.category.name if self.category else str(_("all categories"))
        return f"{self.get_strategy_display()} / {scope}"
