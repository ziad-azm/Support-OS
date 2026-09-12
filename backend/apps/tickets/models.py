from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.customers.models import Customer


class Category(TimeStampedModel):
    """A ticket classification tag — TKT-2's own model. Unlike
    `ContactDetail` (shared machinery reused by every channel adapter),
    nothing outside `apps.tickets` references this model. See Story 18
    `## Story Goal`.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Ticket(TimeStampedModel):
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `priority`/`category` (Story 18, TKT-2), `assigned_agent` (Story 22,
    TKT-3), `status`/`escalated` (Story 23, TKT-4), and now `TicketActivity`
    (Story 24, TKT-5) are all real. EPIC 4 is complete.
    """

    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        IN_PROGRESS = "in_progress", _("In progress")
        PENDING_CUSTOMER = "pending_customer", _("Waiting on customer")
        RESOLVED = "resolved", _("Resolved")
        CLOSED = "closed", _("Closed")

    class Priority(models.TextChoices):
        LOW = "low", _("Low")
        MEDIUM = "medium", _("Medium")
        HIGH = "high", _("High")
        URGENT = "urgent", _("Urgent")

    subject = models.CharField(_("subject"), max_length=200)
    # Required, not blank=True: a ticket records an issue, and a title with
    # no detail does not do that. Contrast Customer.phone/company, which are
    # secondary contact fields, not the record's whole purpose.
    description = models.TextField(_("description"))
    # PROTECT, not CASCADE: Story 10's own forward note names this exact
    # decision — a customer with ticket history must not silently vanish.
    # `apps/core/exceptions.py` gains ProtectedError handling in task 6
    # because this makes DELETE /api/customers/<id>/ fail cleanly instead of
    # with an unhandled 500 the moment a customer has tickets.
    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name="tickets", verbose_name=_("customer")
    )
    # SET_NULL, not PROTECT or CASCADE: the project's first nullable FK.
    # Contrast `customer` above (PROTECT — an identity that must not
    # silently vanish) and `Message.ticket` (CASCADE — no existence
    # independent of its parent, Story 13). A category is a classification
    # tag: deleting one should leave every ticket that had it intact, just
    # uncategorized. See Story 18 `## Prerequisites`.
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
        verbose_name=_("category"),
    )
    # SET_NULL, nullable: the project's fourth use of this behaviour, after
    # `category` above and `Note.author`/`Attachment.uploaded_by` (Story 21).
    # Deactivating or deleting an agent's account must not delete their
    # tickets (CASCADE) or block the deletion (PROTECT) — the ticket simply
    # becomes unassigned. Written ONLY through `TicketViewSet.assign`;
    # `TicketSerializer` keeps it read-only. See Story 22 `## Prerequisites`.
    assigned_agent = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
        verbose_name=_("assigned agent"),
    )
    # SET_NULL, nullable — the same call `category` and `assigned_agent`
    # above already make, for the same reason: deleting a department must
    # neither delete its tickets (CASCADE) nor block the deletion
    # (PROTECT); the ticket simply becomes department-less. Unlike
    # `assigned_agent` this is NOT action-only: it is written through
    # `TicketSerializer` on ordinary create/update, because moving a ticket
    # between departments is routine triage, not a privileged state
    # change. String reference, not an import — see
    # `accounts.User.department`.
    department = models.ForeignKey(
        "organization.Department",
        verbose_name=_("department"),
        related_name="tickets",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    # SET_NULL and nullable, and writable through `TicketSerializer` on
    # ordinary create/update — the same call `department` directly above
    # makes, for the same reasons stated there. Moving a ticket between
    # branches is routine triage, not a privileged state change, so this is
    # NOT action-only the way `assigned_agent` is.
    #
    # Independent of `department`: a ticket may have either, both, or
    # neither, and nothing validates a pair.
    branch = models.ForeignKey(
        "organization.Branch",
        verbose_name=_("branch"),
        related_name="tickets",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    status = models.CharField(
        _("status"), max_length=20, choices=Status.choices, default=Status.OPEN
    )
    priority = models.CharField(
        _("priority"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )
    # A manual signal, not the automatic rule-driven escalation SLA-3 will
    # add later (SupportOs backlog.MD:476-481) — that story depends on a
    # Celery foundation (SLA-0) that does not exist yet, and can drive this
    # SAME field once it does. A flag, not a tier/level: the intake's UI
    # task says "escalate action" (one button), not "choose a level". See
    # Story 23 `## Prerequisites`.
    escalated = models.BooleanField(_("escalated"), default=False)
    # Set when `escalated` becomes True, cleared to None when it becomes
    # False — written only through `TicketViewSet.escalate`, never directly.
    escalated_at = models.DateTimeField(_("escalated at"), null=True, blank=True)
    # Self-referential SET_NULL, nullable: a permanent pointer left on the
    # SOURCE ticket after TKT-9's merge closes it — never cleared, never
    # followed automatically by any other code path. SET_NULL (not CASCADE
    # or PROTECT): deleting the TARGET ticket later (TicketViewSet.destroy,
    # untouched by this story) must not delete or block deleting the
    # source — the source's own history/messages/notes still exist and
    # still mean something even if the ticket they were consolidated into
    # is later removed. See Story 109 `## Story Goal`.
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_tickets",
        verbose_name=_("merged into"),
    )
    # SEC-10. Set exactly once, only inside `apps.tickets.status.
    # apply_status_change` when the new status is `CLOSED` — never touched
    # anywhere else. `updated_at` is not safe to key retention off: `closed`
    # is terminal (this app's own `status.py::VALID_TRANSITIONS` maps it to
    # an empty set), but a later edit to a closed ticket (recategorizing,
    # TKT-9's merge) still bumps `updated_at`, which would silently reset
    # this ticket's retention clock. Mirrors `escalated_at`'s exact "set
    # once, on one specific transition" shape.
    closed_at = models.DateTimeField(_("closed at"), null=True, blank=True)
    # SLA-6 (Story 112). Set when `status` becomes `pending_customer`,
    # cleared when it leaves that status (either direction) — the same
    # "set on entry, cleared/frozen on exit" shape `escalated_at` already
    # uses. Read live by `apps/sla/policy.py::compute_sla_status` to add
    # the STILL-OPEN pause to `sla_paused_minutes` for a ticket paused
    # right now; only `apps/tickets/status.py::apply_status_change`
    # writes this field.
    pending_customer_since = models.DateTimeField(
        _("pending customer since"), null=True, blank=True
    )
    # SLA-6 (Story 112). The running total of paused minutes — WORKING
    # minutes when a calendar applies to this ticket (SLA-5), else plain
    # wall-clock minutes — accumulated by `apply_status_change` every
    # time the ticket LEAVES `pending_customer`. Stored explicitly, not
    # recomputed from history: editing a `WorkingWindow`/`Holiday` later
    # must never silently rewrite an already-closed-out pause.
    sla_paused_minutes = models.PositiveIntegerField(_("SLA paused minutes"), default=0)

    class Meta:
        verbose_name = _("ticket")
        verbose_name_plural = _("tickets")
        ordering = ("-created_at",)
        # PROD-2: `?status=` / `?priority=` are TicketViewSet's two most-used
        # filters (views.py:126-145), always combined with the `-created_at`
        # default ordering. Justified by QUEUE SKEW, not by the mere presence
        # of a filter: measured at 25% selectivity these bought NOTHING
        # (Postgres rightly preferred a backward scan of the existing
        # created_at index under LIMIT 25), and at a realistic ~1% `open`
        # share they bought 5.2x. See CONVENTIONS.md § 35 before adding a
        # composite index anywhere else.
        indexes = [
            models.Index(fields=["status", "-created_at"], name="ticket_status_created_idx"),
            models.Index(fields=["priority", "-created_at"], name="ticket_priority_created_idx"),
            # `?search=` (TicketViewSet.search_fields: subject, description,
            # customer__name) is ILIKE '%term%' — no btree can serve it.
            # `subject` is the selective field to index; `description` is
            # long-form text a trigram index on it would be large for little
            # gain, and `customer__name` is served by Customer's own trigram
            # index (apps/customers/models.py) through the join. See
            # CONVENTIONS.md § 35.
            GinIndex(fields=["subject"], name="ticket_subject_trgm", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self) -> str:
        return self.subject


class TicketActivity(TimeStampedModel):
    """An immutable audit-log entry for a ticket's status/assignment
    changes — TKT-5's "reusable activity-log pattern" (`SupportOs
    backlog.MD` lines 343-348). Replies are NOT logged here: `Message`
    already is the record of them, and duplicating message bodies into a
    second table would be a real data-integrity risk (two sources of truth
    for one reply). See `apps/tickets/history.py::build_history`, which
    merges this table with `Message` into one read-only feed.
    """

    class Kind(models.TextChoices):
        STATUS_CHANGED = "status_changed", _("Status changed")
        ASSIGNED = "assigned", _("Assignment changed")
        # TKT-9: recorded once on EACH side of a merge — the source gets
        # MERGED_INTO (to_value = a snapshot of the TARGET), the target
        # gets MERGED_FROM (to_value = a snapshot of the SOURCE). Two kinds,
        # not one with a direction flag, matching this model's own
        # "one Kind per semantic event" precedent (STATUS_CHANGED/ASSIGNED
        # are also two kinds, not one "changed" kind with a field name).
        MERGED_INTO = "merged_into", _("Merged into another ticket")
        MERGED_FROM = "merged_from", _("Merged from another ticket")

    # CASCADE, not PROTECT: an activity entry has no existence independent
    # of its ticket, the same reasoning `Message.ticket` uses (Story 13).
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="activities", verbose_name=_("ticket")
    )
    # SET_NULL: the project's now-settled pattern (`Note.author`,
    # `Attachment.uploaded_by`, `Ticket.assigned_agent`) for a reference
    # that must survive the referenced account being removed — the log
    # entry still means something after its actor's account is gone.
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ticket_activities",
        verbose_name=_("actor"),
    )
    kind = models.CharField(_("kind"), max_length=20, choices=Kind.choices)
    # Raw values, not pre-rendered sentences. `status_changed` stores the
    # `Ticket.Status` value string (e.g. "open"), which the frontend
    # translates via the SAME `statuses.<value>` i18n keys every other
    # status display already uses. `assigned` stores a NAME SNAPSHOT
    # (`User.get_full_name()` at write time, "" for unassigned) rather than
    # a user id, so the log stays historically correct even after the
    # referenced user is deleted (`assigned_agent` is itself SET_NULL) — the
    # standard audit-log tradeoff of a point-in-time snapshot over a live
    # reference. See Story 24 `## Prerequisites`.
    from_value = models.CharField(_("from value"), max_length=150, blank=True)
    to_value = models.CharField(_("to value"), max_length=150, blank=True)

    class Meta:
        verbose_name = _("ticket activity")
        verbose_name_plural = _("ticket activities")
        # Newest-first: an audit log reads like a feed, the same choice
        # `Note.Meta.ordering` makes (Story 21), not `Message.Meta.ordering`
        # (oldest-first — a conversation reads top-to-bottom).
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} on ticket #{self.ticket_id}"


class Feedback(TimeStampedModel):
    """Post-resolution customer satisfaction rating — PORTAL-5. One row per
    ticket (`ticket` is a `OneToOneField`), submitted by the customer
    through the portal. No staff-facing viewer or report exists yet —
    `RPT-4` (Customer Satisfaction, `SupportOs backlog.MD:623-627`, not
    yet planned) is the eventual consumer named in the intake ("feeds
    Reports CSAT"); this story ships the model, the portal submission
    endpoint, and Django admin as the interim way to see the data.
    """

    class Rating(models.TextChoices):
        # Matches CONVENTIONS.md §25's already-recorded RPT-4 chart design
        # ("satisfied/neutral/dissatisfied breakdown", a Waffle Chart over
        # exactly these three categories) — this vocabulary is not invented
        # here, it is the one already decided for reporting.
        SATISFIED = "satisfied", _("Satisfied")
        NEUTRAL = "neutral", _("Neutral")
        DISSATISFIED = "dissatisfied", _("Dissatisfied")

    # CASCADE, not PROTECT: feedback has no existence independent of the
    # ticket it is about, the same reasoning TicketActivity.ticket uses
    # (above). OneToOneField, not ForeignKey: one CSAT rating per ticket —
    # the DB-level uniqueness DRF turns into a free UniqueValidator on
    # create (see apps/portal/serializers.py, PortalFeedbackSerializer).
    ticket = models.OneToOneField(
        Ticket, on_delete=models.CASCADE, related_name="feedback", verbose_name=_("ticket")
    )
    # Denormalized from `ticket.customer` — deliberately a direct FK, not
    # reached via a `ticket__customer` lookup. CustomerScopedModelViewSet's
    # `customer_field` and HasPermission.has_object_permission both resolve
    # `customer_field` as `getattr(obj, f"{customer_field}_id", None)` — a
    # single real attribute, not an ORM double-underscore path. A nested
    # field name would satisfy `get_queryset()`'s `filter(**{...})` but
    # silently break `has_object_permission` (`getattr(obj,
    # "ticket__customer_id", None)` is never a real attribute) — the exact
    # class of bug Story 46 found and fixed in ArticleViewSet.retrieve, in
    # the opposite direction. CASCADE, matching `ticket` above.
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="feedback", verbose_name=_("customer")
    )
    rating = models.CharField(_("rating"), max_length=20, choices=Rating.choices)
    comment = models.TextField(_("comment"), blank=True)

    class Meta:
        verbose_name = _("feedback")
        verbose_name_plural = _("feedback")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_rating_display()} — ticket #{self.ticket_id}"


class SavedView(TimeStampedModel):
    """A named, owned filter/sort preset for the ticket list — TKT-8. Stores
    the SAME query-param dict `TicketViewSet.get_queryset` already accepts
    (`filters`), never SQL and never a frozen id list (the intake's own
    constraint) — applying a view just replays those params through the
    existing endpoint.

    The first resource in this app combining `Category`/`QuickReply`'s
    shape (shared, visible to anyone who can see tickets) with `Task`'s
    shape (owned, personally writable) — see Story 108 `## Context`, item
    7. `is_shared=False` (the default) makes a row private to its owner,
    exactly like `Task`; `is_shared=True` makes it readable by everyone,
    exactly like `Category`, but — unlike `Category` — still editable only
    by its owner or a `tickets.manage` holder, never by "anyone who can
    manage tickets" outright. See `apps/tickets/views.py::SavedViewViewSet`.
    """

    # CASCADE: a saved view has no meaning independent of the account that
    # made it — the same reasoning `Task.owner` (apps/agents/models.py)
    # already uses for an owned personal resource, not `SET_NULL`
    # (`assigned_agent`/`category`), which is for a reference a record
    # should SURVIVE losing.
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="saved_views",
        verbose_name=_("owner"),
    )
    name = models.CharField(_("name"), max_length=100)
    # Visible to every caller holding tickets.view, not scoped to the
    # owner's own department/team — a single flag, matching
    # Category/QuickReply's own "shared = visible to anyone who can see
    # tickets" shape (Story 108 `## Story Goal`), not a second per-team ACL
    # this project has no queryable concept for.
    is_shared = models.BooleanField(_("shared"), default=False)
    # The exact query-param dict `GET /api/tickets/` accepts — string
    # keys/values, e.g. {"category": "3", "status": "open",
    # "assigned_to_me": "true", "ordering": "-created_at"}. Writable on
    # create only (`SavedViewSerializer.immutable_fields`, Backend Task 2).
    # JSONField precedent: apps/accounts/models.py:56 (Role.permissions).
    filters = models.JSONField(_("filters"), default=dict, blank=True)
    # Owner-scoped meaning: true here means "this loads for ME on open,"
    # never "this loads for everyone who can see it." Written ONLY through
    # `SavedViewViewSet.set_default`, mirroring `Ticket.escalated`'s
    # action-only field (Story 23) — never through the ordinary
    # create/update path. See Story 108 `## Story Goal` for why defaulting
    # to a view you do not own is out of scope.
    is_default = models.BooleanField(_("default"), default=False)

    class Meta:
        verbose_name = _("saved view")
        verbose_name_plural = _("saved views")
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="unique_saved_view_owner_name"),
            # At most one default per owner. No NULLs are involved (unlike
            # SLAPolicy/AssignmentRule's category-nullable constraints,
            # apps/sla/models.py:61-65,156-160), so `nulls_distinct` does
            # not apply here — `condition=` alone is what makes this a
            # PARTIAL index over `is_default=True` rows only, the same
            # "the constraint's name should mean what it says" reasoning
            # apps/sla/migrations/0005_enforce_single_default_policy_and_rule.py
            # already established for this project's other "only one
            # default" cases.
            models.UniqueConstraint(
                fields=["owner"],
                condition=models.Q(is_default=True),
                name="unique_saved_view_owner_default",
            ),
        ]

    def __str__(self) -> str:
        return self.name
