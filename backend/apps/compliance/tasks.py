"""Background tasks — SEC-10. The second app (after `apps.sla`) to add its
own `tasks.py`; `app.autodiscover_tasks()` (`config/celery.py`) finds it
with no further wiring — see CONVENTIONS.md §24.
"""

from celery import shared_task
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import AuditLog
from apps.organization.models import OrganizationSettings

from . import retention


@shared_task
def run_data_retention() -> None:
    """Runs once a day (seeded `PeriodicTask`, this app's own
    `0001_seed_retention_schedule` data migration — see `evaluate_escalations`,
    apps/sla/tasks.py, for the same "runs on django-celery-beat's own
    schedule" shape). Reads `OrganizationSettings` fresh on every run — the
    same cross-app read `apps.sla.policy.resolve_policy` already makes for
    its own SLA-default fallback tier. A data class with no configured
    retention period (`None`) is skipped entirely; a run where every class
    is unconfigured is a normal no-op, the same "nothing configured, nothing
    to do" shape `evaluate_escalations` already has for no enabled
    `EscalationRule`.
    """
    settings_obj = OrganizationSettings.load()
    results: dict[str, int] = {}

    if settings_obj.retention_closed_tickets_days is not None:
        results["tickets_anonymized"] = retention.anonymize_closed_tickets(
            settings_obj.retention_closed_tickets_days
        )
    if settings_obj.retention_messages_days is not None:
        results["messages_purged"] = retention.purge_messages(settings_obj.retention_messages_days)
    if settings_obj.retention_attachments_days is not None:
        results["attachments_purged"] = retention.purge_attachments(
            settings_obj.retention_attachments_days
        )
    if settings_obj.retention_audit_log_days is not None:
        results["audit_log_purged"] = retention.purge_audit_log(
            settings_obj.retention_audit_log_days
        )

    if not results:
        return

    summary = ", ".join(f"{key}={value}" for key, value in results.items())
    AuditLog.objects.create(
        actor=None,
        action=AuditLog.Action.DATA_RETENTION_RUN,
        target_label=str(_("Scheduled data retention run")),
        to_value=summary,
    )
