from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.permissions import ALL_PERMISSIONS


class UserManager(BaseUserManager):
    """Email is the identifier — there is no `username` on this model."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class Role(TimeStampedModel):
    """A named bundle of permission strings.

    A row, not an enum: SEC-1 manages roles and SEC-2 edits their permissions
    through a UI, and neither can edit Python. `slug` is the stable
    identifier — code and fixtures reference the slug, never the primary key
    or the display name.

    See CONVENTIONS.md §22 for why the vocabulary is code and the mapping is
    data.
    """

    slug = models.SlugField(_("slug"), max_length=50, unique=True)
    name = models.CharField(_("name"), max_length=100)
    description = models.CharField(_("description"), max_length=255, blank=True)
    permissions = models.JSONField(_("permissions"), default=list, blank=True)
    # Seeded roles are referenced by slug in code and must not be deletable
    # from the admin. SEC-1 enforces this in its UI too.
    is_system = models.BooleanField(_("system role"), default=False)

    class Meta:
        verbose_name = _("role")
        verbose_name_plural = _("roles")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        """Reject a permission string no view can ever check.

        This is the guard that keeps the code half and the data half from
        drifting — without it, SEC-2's UI could grant `tickets.delete` years
        before any view declares it, and the grant would silently do nothing.

        Runs from `full_clean()` only, so it guards forms (including the
        admin) and not programmatic writes. See CONVENTIONS.md §22.
        """
        super().clean()
        if not isinstance(self.permissions, list):
            raise DjangoValidationError({"permissions": _("Permissions must be a list.")})
        unknown = sorted(set(self.permissions) - ALL_PERMISSIONS)
        if unknown:
            raise DjangoValidationError(
                {"permissions": _("Unknown permissions: %(names)s") % {"names": ", ".join(unknown)}}
            )


class User(AbstractBaseUser, PermissionsMixin):
    """AUTH_USER_MODEL = "accounts.User". Email-based login — no `username`.

    Built from AbstractBaseUser + PermissionsMixin rather than AbstractUser so
    there is no unused `username` column — see Story 08 task 1. Authorization
    hangs off `role`; see CONVENTIONS.md §22.
    """

    email = models.EmailField(_("email address"), unique=True)
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)
    is_active = models.BooleanField(_("active"), default=True)
    is_staff = models.BooleanField(_("staff status"), default=False)
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)
    # PROTECT, not SET_NULL: deleting a role people still hold should fail
    # loudly rather than silently stripping everyone's access. Nullable
    # because a superuser needs no role and `createsuperuser` must not prompt.
    role = models.ForeignKey(
        "accounts.Role",
        verbose_name=_("role"),
        related_name="users",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )

    objects = UserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self) -> str:
        return self.email

    def get_full_name(self) -> str:
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.email
