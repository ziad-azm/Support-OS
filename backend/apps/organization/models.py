from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


def _validate_string_list(value, field_name: str) -> None:
    if not isinstance(value, list):
        raise ValidationError({field_name: _("Must be a list of strings.")})
    if any(not isinstance(item, str) or not item.strip() for item in value):
        raise ValidationError({field_name: _("Every entry must be a non-empty string.")})


class Department(TimeStampedModel):
    """A functional unit — ORG-1. Agents (`accounts.User.department`) and
    tickets (`tickets.Ticket.department`) point at one; both FKs are
    nullable `SET_NULL`, so deleting a department leaves both intact and
    merely unassigned.

    Replaces `OrganizationSettings.departments`, the `JSONField` string
    list SEC-4 shipped as a deliberate placeholder — that field's own
    docstring named the condition for promoting it: "Nothing else in this
    codebase references an individual department or branch yet." This
    story is the story that makes something reference one.

    Shaped exactly like `tickets.Category` (apps/tickets/models.py:8-23):
    a unique name, alphabetical default ordering, `__str__` returning the
    name. `description` is the one addition — a department is an org-chart
    unit an admin may need to annotate ("Tier 2 escalations, EMEA hours"),
    which `Role.description` (apps/accounts/models.py:55) already
    establishes the shape for.

    `OrganizationSettings.branches` is deliberately NOT promoted here —
    ORG-2 does that, reusing this model and this story's migrations as its
    template.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.CharField(_("description"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("department")
        verbose_name_plural = _("departments")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class OrganizationSettings(TimeStampedModel):
    """The one organization-wide settings record — SEC-4's "central
    configurable settings" backing branding, department/branch lists, and
    SLA defaults. A singleton: `load()` is the only supported way to get an
    instance, `save()` forces `pk=1`, and `delete()` is a no-op — the same
    "there is exactly one relevant row" shape `MeView`
    (apps/accounts/views.py:44-52) already established for a per-user
    singleton, generalized here to a per-deployment one. This is the first
    singleton model in this codebase; no third-party package (e.g.
    `django-solo`) is installed, so this is a small, self-contained
    implementation of the well-known "pk=1" pattern rather than a new
    dependency.

    `branches` is a `JSONField(default=list)` string list, not a separate
    `Branch` table — the same "a list of strings that doesn't need its own
    table today" call `Role.permissions` (apps/accounts/models.py:56) made,
    and the same call this model made for `departments` until ORG-1
    (Story 87) promoted that half to the real `Department` model above.
    ORG-2 does the same to `branches`.

    `logo_url` is a plain URL, not an uploaded file — combining a file
    upload with this model's JSON list fields in one request would need an
    unprecedented parsing path in this codebase (see Story 53
    `## Prerequisites`).
    """

    name = models.CharField(_("organization name"), max_length=150, blank=True)
    logo_url = models.URLField(_("logo URL"), max_length=500, blank=True)
    branches = models.JSONField(_("branches"), default=list, blank=True)
    # Mirrors `SLAPolicy.response_target_minutes`/`resolution_target_minutes`
    # (apps/sla/models.py) exactly, but nullable: unlike a configured
    # `SLAPolicy` row (which always has both), the org-wide default is
    # opt-in — an admin who never fills these in gets exactly today's
    # behaviour (`resolve_policy` falling through to `None`).
    default_response_target_minutes = models.PositiveIntegerField(
        _("default response target (minutes)"), null=True, blank=True
    )
    default_resolution_target_minutes = models.PositiveIntegerField(
        _("default resolution target (minutes)"), null=True, blank=True
    )

    class Meta:
        verbose_name = _("organization settings")
        verbose_name_plural = _("organization settings")

    def __str__(self) -> str:
        return str(_("Organization settings"))

    def clean(self) -> None:
        """Guards the Django-admin form path — DRF does not call model
        `clean()`, so `OrganizationSettingsSerializer` repeats this logic
        for the API path, the same split `Role.clean()`/
        `RoleAdminSerializer.validate_permissions` already establishes
        (CONVENTIONS.md § 22).
        """
        super().clean()
        _validate_string_list(self.branches, "branches")
        if (
            self.default_response_target_minutes is not None
            and self.default_resolution_target_minutes is not None
            and self.default_resolution_target_minutes < self.default_response_target_minutes
        ):
            raise ValidationError(
                {
                    "default_resolution_target_minutes": _(
                        "Must be at least the default response target."
                    )
                }
            )

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # There is nothing sensible for "delete the organization's
        # settings" to mean — the row is recreated with defaults on the
        # next `load()` anyway. A silent no-op, not an exception.
        pass

    @classmethod
    def load(cls) -> "OrganizationSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj
