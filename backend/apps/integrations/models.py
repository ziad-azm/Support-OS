from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class ApiKey(TimeStampedModel):
    """An external system's credential for the public API — INT-1.

    Authorization is **not** stored here. A key resolves to `user` and
    every existing `permission_map`/`HasPermission` check then applies to
    that user unchanged (CONVENTIONS.md § 22, § 29) — "reusing AUTHZ", the
    intake's own phrase. Narrowing a key therefore means issuing it
    against a narrowly-roled user, never adding a scope list here.

    `user` is `CASCADE`: a key exists *for* an identity and is meaningless
    without it — the same reasoning `notifications.Notification.recipient`
    records for itself. `created_by` is `SET_NULL`, because the operator
    who issued a key may leave while the key stays in service; that is
    the same asymmetry `AuditLog.actor` (SET_NULL) versus
    `Notification.recipient` (CASCADE) already draws.

    Nothing recoverable is stored: `hashed_key` is `sha256(secret)`
    (apps/integrations/keys.py), and the plaintext is returned exactly
    once, by `POST /api/api-keys/`.
    """

    name = models.CharField(_("name"), max_length=100)
    # Unique and indexed: this is the lookup key on every authenticated
    # request. `editable=False` keeps both credential columns out of the
    # Django admin form and out of any ModelForm.
    prefix = models.CharField(_("prefix"), max_length=12, unique=True, editable=False)
    # 64 hex characters — the width of a sha256 hexdigest.
    hashed_key = models.CharField(_("hashed key"), max_length=64, editable=False)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="api_keys",
        verbose_name=_("user"),
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="api_keys_issued",
        verbose_name=_("created by"),
    )
    # Revocation is a flag, not a delete: the row is the only record that
    # the key ever existed and when it was last used. See Story 80
    # `## Story Goal` for why no AuditLog row is written.
    is_active = models.BooleanField(_("active"), default=True)
    expires_at = models.DateTimeField(_("expires at"), null=True, blank=True)
    # Written by ApiKeyAuthentication at most once every
    # LAST_USED_WRITE_INTERVAL, not on every request — see that module.
    last_used_at = models.DateTimeField(_("last used at"), null=True, blank=True)

    class Meta:
        verbose_name = _("API key")
        verbose_name_plural = _("API keys")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} ({self.prefix})"

    def is_usable(self) -> bool:
        if not self.is_active:
            return False
        return self.expires_at is None or self.expires_at > timezone.now()


def _validate_field_map(value, field_name: str, allowed: frozenset[str]) -> None:
    """A field map is a flat `{erp_field: supportos_field}` of non-empty
    strings, and every target must be in `allowed`.

    The allowlist is the story's safety boundary, not decoration: without
    it an operator could map an ERP column onto `user` and have a bulk
    import silently re-point portal logins, or onto `external_id` and
    break the correlation key the upsert depends on. The module-level
    helper mirrors `apps.organization.models._validate_string_list`
    exactly, including being called from both `clean()` (admin/`full_clean`
    path) and the serializer (API path) — DRF does not call model
    `clean()` (CONVENTIONS.md § 22).
    """
    if not isinstance(value, dict):
        raise ValidationError({field_name: _("Must be an object mapping ERP field to field.")})
    for source, target in value.items():
        if not isinstance(source, str) or not source.strip():
            raise ValidationError(
                {field_name: _("Every ERP field name must be a non-empty string.")}
            )
        if not isinstance(target, str) or not target.strip():
            raise ValidationError({field_name: _("Every mapped field must be a non-empty string.")})
        if target not in allowed:
            raise ValidationError(
                {
                    field_name: _("Cannot map to '%(target)s'. Allowed: %(allowed)s.")
                    % {"target": target, "allowed": ", ".join(sorted(allowed))}
                }
            )


class ErpConnection(TimeStampedModel):
    """The one ERP connection — INT-2.

    A singleton in exactly the way `organization.OrganizationSettings`
    is: `load()` is the only supported way in, `save()` forces `pk=1`,
    `delete()` is a no-op. The backlog says "ERP Integration", singular
    (SupportOs backlog.MD:868); a connection table with one row in it
    would be speculative generality (CONVENTIONS.md § 0). `INT-3` may
    well need many provider rows — it can promote this then, with a real
    second consumer in hand.

    `customer_field_map`/`order_field_map` are the intake's "field
    mapping": `{erp_field_name: supportos_field_name}`, validated against
    the allowlists in `apps/integrations/erp_sync.py`. They are what lets
    a different ERP vendor be a configuration change rather than a code
    change — see Story 81 `## Story Goal`.

    `auth_token` is stored in plain text and never returned by the API
    (`ErpConnectionSerializer` declares it `write_only`). Unlike INT-1's
    `ApiKey.hashed_key`, it cannot be hashed: this credential has to be
    replayed on every outbound call. Encryption at rest is deliberately
    out of scope — no encryption library is installed and that choice
    belongs to `INT-3` ("secure central config for … credentials",
    SupportOs backlog.MD:876). See Story 81 `## Edge Cases`.
    """

    # Master switch, default False: an ERP nobody has configured must not
    # be contacted just because the seeded PeriodicTask (Story 81 task 7)
    # is enabled. The same two-independent-opt-ins split § 24 records for
    # SLA-3's schedule vs its EscalationRule criteria.
    enabled = models.BooleanField(_("enabled"), default=False)
    base_url = models.URLField(_("base URL"), max_length=500, blank=True)
    auth_token = models.CharField(_("auth token"), max_length=500, blank=True)
    # Import is the primary direction; export is separately opt-in because
    # it WRITES to a system this project does not own.
    export_enabled = models.BooleanField(_("export enabled"), default=False)
    customer_field_map = models.JSONField(_("customer field map"), default=dict, blank=True)
    order_field_map = models.JSONField(_("order field map"), default=dict, blank=True)
    # Which key in the ERP's payload carries its own record id, and which
    # key on an order points back at its customer. Configurable for the
    # same reason the field maps are — "id" is a convention, not a
    # standard.
    customer_external_id_field = models.CharField(
        _("customer id field"), max_length=100, default="id"
    )
    order_external_id_field = models.CharField(_("order id field"), max_length=100, default="id")
    order_customer_ref_field = models.CharField(
        _("order customer reference field"), max_length=100, default="customer_id"
    )
    last_sync_at = models.DateTimeField(_("last sync at"), null=True, blank=True)

    class Meta:
        verbose_name = _("ERP connection")
        verbose_name_plural = _("ERP connection")

    def __str__(self) -> str:
        return str(_("ERP connection"))

    def is_configured(self) -> bool:
        """Both halves, not just `enabled`: a switched-on connection with
        no URL has nothing to call. `run_erp_sync` gates on this.
        """
        return bool(self.enabled and self.base_url)

    def clean(self) -> None:
        from .erp_sync import CUSTOMER_SYNCABLE_FIELDS, ORDER_SYNCABLE_FIELDS

        super().clean()
        _validate_field_map(self.customer_field_map, "customer_field_map", CUSTOMER_SYNCABLE_FIELDS)
        _validate_field_map(self.order_field_map, "order_field_map", ORDER_SYNCABLE_FIELDS)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # Nothing sensible for "delete the ERP connection" to mean — the
        # row comes back with defaults (and `enabled=False`) on the next
        # `load()`. A silent no-op, matching OrganizationSettings.delete.
        pass

    @classmethod
    def load(cls) -> "ErpConnection":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class ErpOrder(TimeStampedModel):
    """An order, mirrored from the ERP — INT-2, and read-only here.

    The intake's outcome names "customer/order sync", but **no story in
    this project owns orders**: `grep -rn "class Order"` finds nothing and
    the backlog mentions the noun exactly once, in INT-2's own task text
    (verified — Story 81 `## Prerequisites`). So an order is ERP-owned
    reference data, never a SupportOS entity: nothing in this codebase
    creates, edits, or exports one, `ErpOrderViewSet` is `GET`-only, and
    `ErpOrderAdmin` disables adding — the same read-and-nothing-else
    posture `ApiKeyAdmin` (INT-1) takes for a different reason.

    `status` is a plain `CharField`, deliberately **not** `TextChoices`:
    the vocabulary belongs to the ERP, and enumerating a foreign system's
    states here would be wrong the first time the ERP adds one. It also
    keeps this field out of drf-spectacular's enum-naming collision set
    (Story 80 verification recorded a live collision on fields named
    "status").

    `raw` keeps the whole original payload, so an operator who discovers
    a mis-mapped field can see what the ERP actually sent without
    re-running the import.
    """

    # CASCADE: an order mirror has no meaning without the customer it
    # belongs to — the same reasoning `notifications.Notification.recipient`
    # and `integrations.ApiKey.user` (INT-1) both record.
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="erp_orders",
        verbose_name=_("customer"),
    )
    external_id = models.CharField(_("ERP external id"), max_length=100, unique=True)
    order_number = models.CharField(_("order number"), max_length=100, blank=True)
    status = models.CharField(_("status"), max_length=50, blank=True)
    total_amount = models.DecimalField(
        _("total amount"), max_digits=14, decimal_places=2, null=True, blank=True
    )
    currency = models.CharField(_("currency"), max_length=3, blank=True)
    placed_at = models.DateTimeField(_("placed at"), null=True, blank=True)
    raw = models.JSONField(_("raw payload"), default=dict, blank=True)
    synced_at = models.DateTimeField(_("synced at"))

    class Meta:
        verbose_name = _("ERP order")
        verbose_name_plural = _("ERP orders")
        ordering = ("-placed_at", "-id")

    def __str__(self) -> str:
        return self.order_number or self.external_id


class ErpSyncRun(TimeStampedModel):
    """One execution of `run_erp_sync` — INT-2's observability record.

    An async job nobody can inspect is an async job nobody will trust,
    and this is also what the config UI's history table renders. It is
    this story's answer to "why no AuditLog row": `accounts.AuditLog`
    addresses its target through `target_user`/`target_role` (§ 22) and a
    sync run is neither, so rather than add a third nullable FK to
    another app's model, the run itself is the durable record — the same
    call INT-1 made and documented.

    The choices field is named `state`, not `status`, on purpose: Story
    80's verification recorded a live drf-spectacular warning
    ("enum naming encountered a … collision for fields named 'status'")
    from the existing `tickets`/`knowledge_base` components, and adding a
    third `status` enum would deepen a known problem for no gain. The
    pre-existing collision is untouched and stays out of scope.
    """

    class Direction(models.TextChoices):
        IMPORT = "import", _("Import")
        EXPORT = "export", _("Export")

    class State(models.TextChoices):
        RUNNING = "running", _("Running")
        SUCCESS = "success", _("Success")
        FAILED = "failed", _("Failed")

    direction = models.CharField(_("direction"), max_length=10, choices=Direction.choices)
    state = models.CharField(
        _("state"), max_length=10, choices=State.choices, default=State.RUNNING
    )
    # SET_NULL and nullable: a scheduled run has no human behind it at
    # all, and an operator who triggered one may later be deleted — the
    # same asymmetry `AuditLog.actor` already draws.
    triggered_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="erp_sync_runs",
        verbose_name=_("triggered by"),
    )
    created_count = models.PositiveIntegerField(_("created"), default=0)
    updated_count = models.PositiveIntegerField(_("updated"), default=0)
    skipped_count = models.PositiveIntegerField(_("skipped"), default=0)
    failed_count = models.PositiveIntegerField(_("failed"), default=0)
    started_at = models.DateTimeField(_("started at"))
    finished_at = models.DateTimeField(_("finished at"), null=True, blank=True)
    # Free text, not a code: this carries whatever the ERP or the network
    # said. Never the auth token — see `erp_client._request`.
    error_message = models.TextField(_("error message"), blank=True)

    class Meta:
        verbose_name = _("ERP sync run")
        verbose_name_plural = _("ERP sync runs")
        ordering = ("-started_at",)

    def __str__(self) -> str:
        return f"{self.get_direction_display()} {self.started_at:%Y-%m-%d %H:%M}"


# The vocabulary a WebhookSubscription.events entry may contain — code, not
# data, the same "code is the vocabulary, the row is the mapping" split
# CONVENTIONS.md § 22 established for permissions. Grouped by the affected
# model, `<resource>.<change>` — the same shape Permissions' own
# `<area>.<action>` strings already use, which is what lets the frontend's
# `groupByArea` helper (RoleFormPage.tsx) work unmodified for this checklist
# too. Extending this set is how a later story adds a new event: one line
# here, one signal receiver in `signals.py` — never a hardcoded string at a
# dispatch call site.
WEBHOOK_EVENTS: frozenset[str] = frozenset(
    {
        "ticket.created",
        "ticket.status_changed",
        "ticket.assigned",
        "ticket.escalated",
        "customer.created",
        "message.created",
    }
)


def _validate_events(value) -> None:
    """Mirrors `Role.clean()`'s own allowlist check (apps/accounts/models.py)
    for `WebhookSubscription.events` — called from both `clean()` (admin/
    `full_clean()`) and the serializer (the API path; DRF does not call
    model `clean()`, CONVENTIONS.md § 22).
    """
    if not isinstance(value, list):
        raise ValidationError({"events": _("Must be a list of event names.")})
    unknown = sorted(set(value) - WEBHOOK_EVENTS)
    if unknown:
        raise ValidationError(
            {"events": _("Unknown events: %(names)s") % {"names": ", ".join(unknown)}}
        )


class WebhookSubscription(TimeStampedModel):
    """An external system's registration for one or more domain events —
    INT-4. Unlike every prior `INT-*` config (`ApiKey` aside), this is a
    real list, not a `pk=1` singleton — many URLs can each subscribe to
    their own, possibly overlapping, event sets.

    `secret` is stored in plain text and never returned by the API
    (`WebhookSubscriptionSerializer` declares it `write_only`) — the same
    posture `ErpConnection.auth_token`/the three `apps.communications`
    provider credentials already take (CONVENTIONS.md § 29-31). It signs
    every delivery to this subscription's `target_url` — see
    `apps/integrations/webhook_client.py::sign_payload`.

    No `enabled`-vs-`is_configured()` split the way `ErpConnection`/the
    provider configs need: a subscription is either created complete
    (`target_url` + `secret` + at least one event) or not created at all,
    unlike a singleton config a form fills in gradually over time.
    `enabled` alone is the on/off switch — pausing deliveries without
    losing the subscription's own configuration or delivery history.
    """

    name = models.CharField(_("name"), max_length=100)
    target_url = models.URLField(_("target URL"), max_length=500)
    secret = models.CharField(_("secret"), max_length=255, blank=True)
    events = models.JSONField(_("events"), default=list)
    enabled = models.BooleanField(_("enabled"), default=True)
    # SET_NULL: the operator who registered a subscription may leave while
    # the subscription itself keeps receiving deliveries — the same
    # asymmetry `ApiKey.created_by` (Story 80) already draws.
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhook_subscriptions_created",
        verbose_name=_("created by"),
    )

    class Meta:
        verbose_name = _("webhook subscription")
        verbose_name_plural = _("webhook subscriptions")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        super().clean()
        _validate_events(self.events)


class WebhookDelivery(TimeStampedModel):
    """One delivery **attempt** for one subscription/event pair — INT-4's
    observability record, the same role `ErpSyncRun` (Story 81) plays for
    a sync run. Deliberately one row PER ATTEMPT, not one row per logical
    delivery updated across retries: a flaky endpoint's third attempt
    succeeding is only genuinely visible if the first two failed attempts
    are their own rows too, the same shape GitHub's/Stripe's own delivery
    logs use.

    `state` is named `state`, not `status`, for the identical reason
    `ErpSyncRun.state` is (Story 81 `## Prerequisites`) — this project's
    own live-verified drf-spectacular enum-naming collision on fields
    named `status` (Story 80's own verification), not deepened here.

    CASCADE on `subscription`: a delivery record has no meaning independent
    of the subscription it was attempting to notify — the same reasoning
    `ErpOrder.customer`/`Message.ticket` already establish for their own
    parent relationships. Deleting a subscription deliberately takes its
    delivery history with it.
    """

    class State(models.TextChoices):
        SUCCESS = "success", _("Success")
        RETRYING = "retrying", _("Retrying")
        FAILED = "failed", _("Failed")

    subscription = models.ForeignKey(
        WebhookSubscription,
        on_delete=models.CASCADE,
        related_name="deliveries",
        verbose_name=_("subscription"),
    )
    event = models.CharField(_("event"), max_length=50)
    payload = models.JSONField(_("payload"), default=dict)
    state = models.CharField(_("state"), max_length=10, choices=State.choices)
    attempt = models.PositiveIntegerField(_("attempt"), default=1)
    response_status_code = models.PositiveIntegerField(
        _("response status code"), null=True, blank=True
    )
    # Truncated at write time (see tasks.py) — this is a debugging aid, not
    # a full response archive; an unbounded external response body must
    # never become an unbounded row.
    response_body = models.TextField(_("response body"), blank=True)
    error_message = models.TextField(_("error message"), blank=True)

    class Meta:
        verbose_name = _("webhook delivery")
        verbose_name_plural = _("webhook deliveries")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.event} -> {self.subscription_id} (attempt {self.attempt})"
