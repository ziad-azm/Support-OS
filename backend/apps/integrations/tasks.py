"""Background ERP sync — INT-2 (Story 81). The third `tasks.py` in this
project after `apps/sla/tasks.py` (SLA-2/3) and
`apps/notifications/tasks.py` (SLA-4); `app.autodiscover_tasks()`
(`config/celery.py`) finds it with no further wiring (CONVENTIONS.md
§ 24).
"""

import logging

from celery import shared_task
from django.utils import timezone

from .erp_client import ErpError
from .erp_sync import export_customers, import_customers, import_orders
from .models import ErpConnection, ErpSyncRun

logger = logging.getLogger(__name__)


@shared_task
def run_erp_sync(direction: str = ErpSyncRun.Direction.IMPORT, triggered_by_id: int | None = None):
    """Run one sync in `direction` and record it as an `ErpSyncRun`.

    A run against an unconfigured or disabled connection is a **normal
    no-op, not an error, and writes no run row** — the same contract
    `apps.sla.tasks.evaluate_escalations` states for itself when nothing
    is configured (apps/sla/tasks.py:57-60). That is what lets task 7
    ship an *enabled* PeriodicTask without it doing anything until an
    operator actually fills the form in: the schedule existing and the
    connection being configured are two independent opt-ins, exactly as
    § 24 records for SLA-3.

    `import` runs customers before orders, because
    `erp_sync.import_orders` links an order to an already-imported
    customer and skips one it cannot find.
    """
    connection = ErpConnection.load()
    if not connection.is_configured():
        logger.info("ERP sync skipped: connection is disabled or has no base URL.")
        return
    if direction == ErpSyncRun.Direction.EXPORT and not connection.export_enabled:
        logger.info("ERP export skipped: export_enabled is False.")
        return

    run = ErpSyncRun.objects.create(
        direction=direction,
        state=ErpSyncRun.State.RUNNING,
        triggered_by_id=triggered_by_id,
        started_at=timezone.now(),
    )
    try:
        if direction == ErpSyncRun.Direction.EXPORT:
            export_customers(connection, run)
        else:
            import_customers(connection, run)
            import_orders(connection, run)
    except ErpError as exc:
        # A connection-level failure (host down, 401, non-JSON body) ends
        # the run. Per-record failures never reach here — `erp_sync`
        # counts those into `failed_count` and carries on.
        run.state = ErpSyncRun.State.FAILED
        run.error_message = str(exc)
    except Exception as exc:
        logger.exception("ERP sync crashed")
        run.state = ErpSyncRun.State.FAILED
        run.error_message = str(exc)
    else:
        run.state = ErpSyncRun.State.SUCCESS
        connection.last_sync_at = timezone.now()
        connection.save(update_fields=["last_sync_at", "updated_at"])

    run.finished_at = timezone.now()
    run.save(
        update_fields=[
            "state",
            "error_message",
            "created_count",
            "updated_count",
            "skipped_count",
            "failed_count",
            "finished_at",
            "updated_at",
        ]
    )
