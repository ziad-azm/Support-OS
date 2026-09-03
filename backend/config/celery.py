"""Celery application instance — SLA-0's shared background-job foundation.

Reused by SLA (escalation evaluation), automatic assignment, notifications,
AI, and integrations (SupportOs backlog.MD:460) — this file and its ENV
contract (`REDIS_URL`, README § 6) are the only things those future stories
need to add a `@shared_task`, not a new Celery app each.

Lives in `config/`, not `apps/core/`: this is project bootstrapping/wiring,
the same category `config/asgi.py` (Channels) already occupies — not
domain code, so `apps/README.md`'s "needed by two or more apps → apps/core"
rule does not apply. See Story 27 `## Prerequisites`.
"""

import logging
import os

from celery import Celery

logger = logging.getLogger(__name__)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("supportos")

# Reads every CELERY_* setting from Django's settings module — one
# configuration surface, not two. namespace="CELERY" is what maps
# `CELERY_BROKER_URL` (a Django setting) to `app.conf.broker_url`.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscovers a `tasks.py` in every app listed in INSTALLED_APPS. A
# future story adds e.g. `apps/sla/tasks.py` with `@shared_task` and needs
# no further wiring here.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Celery's own standard Django-integration smoke test — dispatch it
    from a shell (`debug_task.delay()`) with the worker running to prove
    the app→broker→worker→result chain works end to end. See Story 27
    `## Verification Steps`.
    """
    # Was `print(f"Request: {self.request!r}")` until PROD-1. Two problems:
    # `print` is a CONVENTIONS.md § 10 violation, and `self.request!r` dumps
    # the task's own args — a § 10 secrets leak for any task that carries one.
    # The task id alone proves the chain, which is all this task is for.
    # `config` has its own LOGGING entry (settings/base.py) precisely so this
    # INFO line is not swallowed by root's WARNING threshold.
    logger.info("debug_task ran", extra={"celery_task_id": self.request.id})
