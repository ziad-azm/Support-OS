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
