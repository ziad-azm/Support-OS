from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class FAQ(TimeStampedModel):
    """A frequently-asked question and its answer — KB-1. Deliberately
    minimal: no category, no status, no per-locale content. `Article`
    (KB-2) gets all three; none of them are pre-empted here. See Story 39
    `## Story Goal`.
    """

    question = models.CharField(_("question"), max_length=300)
    answer = models.TextField(_("answer"))
    # Manual display order for the browse screen. Ties broken alphabetically
    # by `question` below — no drag-and-drop, a number in the edit form is
    # the whole UI for this. See Story 39 `## Story Goal`.
    order = models.PositiveIntegerField(_("order"), default=0)

    class Meta:
        verbose_name = _("FAQ")
        verbose_name_plural = _("FAQs")
        ordering = ("order", "question")

    def __str__(self) -> str:
        return self.question


class Category(TimeStampedModel):
    """An article classification tag, scoped to `apps.knowledge_base` —
    deliberately a second, separate model from `apps.tickets.models.Category`
    (different domain, different app, different table). Copies that
    model's exact shape. See Story 40 `## Prerequisites`.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Article(TimeStampedModel):
    """A bilingual, Markdown-authored help article — KB-2. The first model
    in this project with genuinely translated CONTENT (not just UI chrome
    translated around a single-language value). See Story 40
    `## Story Goal`.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        PUBLISHED = "published", _("Published")

    title_en = models.CharField(_("title (English)"), max_length=200)
    title_ar = models.CharField(_("title (Arabic)"), max_length=200)
    # Markdown source, rendered client-side via react-markdown — never
    # dangerouslySetInnerHTML. No max_length: matches QuickReply.body
    # (apps/agents/models.py) — a long-form text column, deliberately
    # uncapped. See Story 40 `## Prerequisites`.
    body_en = models.TextField(_("body (English)"))
    body_ar = models.TextField(_("body (Arabic)"))
    # SET_NULL, nullable: the same classification-tag reasoning
    # `Ticket.category` already uses (Story 18) — deleting a category must
    # not delete or hide the articles that had it.
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="articles",
        verbose_name=_("category"),
    )
    status = models.CharField(
        _("status"), max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    class Meta:
        verbose_name = _("article")
        verbose_name_plural = _("articles")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title_en
