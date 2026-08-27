"""Ensures the Celery app (`config/celery.py`) is loaded when Django
starts, so `@shared_task`-decorated functions register correctly —
Celery's own documented Django integration pattern.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
