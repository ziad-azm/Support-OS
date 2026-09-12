"""Business-hours arithmetic — SLA-5. The single working-time
implementation every consumer calls: `apps/sla/policy.py::compute_sla_status`
(due times) and `apps/sla/escalation_rules.py::is_at_risk`/`is_idle`
(escalation thresholds) today; `apps/reports/sla.py` is a documented,
deliberate non-consumer for now — see Story 111 `## Prerequisites`.

Timezone-aware throughout via `django.utils.timezone.localtime()`, which
converts to `settings.TIME_ZONE` (`DJANGO_TIME_ZONE` env var) — this
project activates no per-request timezone (verified: no
`timezone.activate()` call anywhere), so "the current timezone" and "the
configured deployment timezone" are the same thing.
"""

from datetime import date, datetime, timedelta

from django.utils import timezone

from .models import BusinessCalendar

# A calendar whose `working_windows` are all deleted after holidays were
# added, or one that is simply misconfigured, must never make `advance`
# loop forever looking for working time that will never arrive. 3650 days
# (10 years) is far beyond any real SLA target; hitting this is always a
# configuration bug, not a legitimate wait.
MAX_DAYS_SCANNED = 3650


def _windows_by_weekday(calendar: BusinessCalendar) -> dict:
    return {
        window.weekday: (window.start_time, window.end_time)
        for window in calendar.working_windows.all()
    }


def _holidays(calendar: BusinessCalendar) -> set[date]:
    return set(calendar.holidays.values_list("date", flat=True))


def advance(calendar: BusinessCalendar, start: datetime, minutes: int) -> datetime:
    """`start` advanced by `minutes` WORKING minutes, per `calendar`'s
    windows/holidays. A calendar with no `working_windows` configured at
    all advances by plain wall-clock minutes — the documented "not
    really configured" fallback (see `BusinessCalendar`'s own
    docstring), not an error.
    """
    windows = _windows_by_weekday(calendar)
    if not windows:
        return start + timedelta(minutes=minutes)

    holidays = _holidays(calendar)
    cursor = timezone.localtime(start)
    remaining = minutes

    for _ in range(MAX_DAYS_SCANNED):
        window = windows.get(cursor.weekday())
        if window is not None and cursor.date() not in holidays:
            window_start = cursor.replace(
                hour=window[0].hour, minute=window[0].minute, second=0, microsecond=0
            )
            window_end = cursor.replace(
                hour=window[1].hour, minute=window[1].minute, second=0, microsecond=0
            )
            if cursor < window_start:
                cursor = window_start
            if cursor < window_end:
                available = int((window_end - cursor).total_seconds() // 60)
                if remaining <= available:
                    return cursor + timedelta(minutes=remaining)
                remaining -= available
        cursor = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    raise RuntimeError(
        f"BusinessCalendar {calendar.id} has no reachable working time within "
        f"{MAX_DAYS_SCANNED} days"
    )


def elapsed_working_minutes(calendar: BusinessCalendar, start: datetime, end: datetime) -> int:
    """Working minutes between `start` and `end` (0 if `end <= start`),
    per `calendar`'s windows/holidays. `advance`'s inverse — falls back
    to plain wall-clock minutes under the identical "no windows
    configured" condition.
    """
    if end <= start:
        return 0

    windows = _windows_by_weekday(calendar)
    if not windows:
        return int((end - start).total_seconds() // 60)

    holidays = _holidays(calendar)
    cursor = timezone.localtime(start)
    end_local = timezone.localtime(end)
    total = 0

    for _ in range(MAX_DAYS_SCANNED):
        if cursor >= end_local:
            break
        window = windows.get(cursor.weekday())
        if window is not None and cursor.date() not in holidays:
            window_start = cursor.replace(
                hour=window[0].hour, minute=window[0].minute, second=0, microsecond=0
            )
            window_end = cursor.replace(
                hour=window[1].hour, minute=window[1].minute, second=0, microsecond=0
            )
            overlap_start = max(cursor, window_start)
            overlap_end = min(end_local, window_end)
            if overlap_end > overlap_start:
                total += int((overlap_end - overlap_start).total_seconds() // 60)
        cursor = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    return total
