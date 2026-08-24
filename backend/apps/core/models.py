from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base for every domain model: creation and update timestamps.

    Abstract, so it produces no migration and no table of its own.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        get_latest_by = "created_at"
