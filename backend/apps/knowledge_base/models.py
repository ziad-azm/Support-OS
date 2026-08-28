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
