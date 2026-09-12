# Story 111 — Business Hours & Holiday Calendar (Story: SUPPORTOS-133)

## Prerequisites

- **`SLA-1` (Response & Resolution Targets, Story 28), `SEC-4` (Organization Settings), `ORG-2` (Branch, Story 89) completed** — the intake names exactly these three (`Dependencies: SLA-1, SEC-4, ORG-2`), confirmed live: `apps/sla/models.py::SLAPolicy` (207 lines), `apps/organization/models.py::OrganizationSettings`/`Branch` (both real, not placeholders).
- **`BusinessCalendar`/`WorkingWindow`/`Holiday` live in `apps.organization`, not a new app and not `apps.sla`.** `apps/sla/policy.py` already imports `apps.organization.models.OrganizationSettings` (line 19) — the exact reverse-cross-app direction this story reuses for `BusinessCalendar`. `Branch` (the thing that needs a `calendar` FK per the intake's "optionally a Branch, per ORG-2") already lives in `apps.organization` too, so putting the calendar model there avoids a new cross-app FK entirely. Verified safe: `apps.organization.models`/`business_hours` import nothing from `apps.sla` or `apps.tickets`, so `apps.sla.policy` → `apps.organization.business_hours` has no cycle.
- **This story narrows, for calendar-bearing tickets only, the "compute SLA status entirely on read, nothing persisted" principle Story 28 established** (`apps/sla/policy.py`'s own module docstring; `CONVENTIONS.md` §23's SLA-1 paragraph: *"computed fresh on every read, never cached or persisted, when nothing forces otherwise"*). This story does **not** add a persisted due-time field to `Ticket` — see `## Story Goal`, "What this story does not do", for why the intake's "recompute derived due times on ticket save rather than retroactively rewriting history" constraint is satisfied without one.
- **One working-time primitive, one set of call sites.** The intake's task 1 (🔑) says explicitly: *"this function is the single implementation every consumer calls — no second copy in escalation or reports."* `apps/organization/business_hours.py::advance`/`elapsed_working_minutes` are that primitive. Consumers wired in THIS story: `apps/sla/policy.py::compute_sla_status` (single-ticket due times) and `apps/sla/escalation_rules.py::is_at_risk`/`is_idle` (SLA-3's thresholds). **Not** wired in this story, and explicitly out of scope: `apps/sla/policy.py`'s own bulk path (`bulk_target_resolver`, `annotate_sla_facts`, `status_from_facts` — the ticket-list `sla_status` column, Story 103/F-9) and `apps/reports/sla.py` (RPT-2, Story 57). Both remain plain wall-clock. See `## Story Goal` and `## Edge Cases & Failure Modes` for the documented consequence (a calendar-bearing ticket's list badge can disagree with its own detail page).
- **Calendar assignment has exactly two surfaces, per the intake's own task 3 wording** ("let an SLAPolicy... and optionally a Branch... select a calendar"): `SLAPolicy.calendar` (config surface: Django admin, the same "admin is the config UI" call `SLAPolicyAdmin` already makes — Story 28 `## Prerequisites`) and `Branch.calendar` (config surface: the existing `BranchFormPage.tsx`, since `Branch` already has full frontend CRUD, Story 89). `OrganizationSettings` gains **no** third, org-wide default calendar field — not named by the intake, and adding one would be an invented requirement.
- **Calendar resolution order, used identically by due-time computation and escalation**: a resolved `SLAPolicy.calendar` (if set) wins; else the ticket's `Branch.calendar` (if set); else `None`, meaning today's exact 24/7 wall-clock behaviour — the intake's own explicit "additive, not breaking" constraint. `apps/sla/policy.py::resolve_calendar(ticket, policy)` is the one function that encodes this order; `policy` is optional so `is_idle` (which has no natural SLA policy to hang a calendar override off) can call it as `resolve_calendar(ticket, None)` and still get the branch-level fallback.
- **`WorkingWindow`/`Holiday` are real child models of `BusinessCalendar`, not a `JSONField`.** `CONVENTIONS.md` §33 records, twice over (`ORG-1`/`ORG-2` promoting `OrganizationSettings.departments`/`.branches` from JSON lists to real models), that *"a future story wanting a list of things on that model should create a model, not a column: that is now the established answer."* This is that future story's third instance.
- **`WorkingWindow`/`Holiday` get their own scoped `ModelViewSet`s, filtered by a required `?calendar=<id>` query param** — the exact `ContactDetailViewSet` shape (`apps/customers/views.py:259-288`, scoped by `?customer=<id>`), not a nested-write `CalendarSerializer`. No nested-serializer-with-bulk-sync pattern exists anywhere in this codebase; inventing one here would be new machinery for one consumer, the opposite of `CONVENTIONS.md` §8/§23's "no new shared abstraction for a single consumer" rule.
- **One `WorkingWindow` per weekday, no overnight (wrap-past-midnight) windows.** `UniqueConstraint(calendar, weekday)` plus `clean()`/serializer `validate()` rejecting `end_time <= start_time`. A split morning/afternoon shift or an overnight shift (e.g. 22:00–06:00) is out of scope — a documented scope limit, not an oversight; see `## Story Goal`.
- **This is the first `TimeField` and the first non-FK, non-audit `DateField` in this codebase** (verified: `grep -rn "TimeField\|DateField" apps/*/models.py` only ever matches `DateTimeField`). DRF serializes/deserializes both as plain `"HH:MM:SS"`/`"YYYY-MM-DD"` strings with no extra configuration needed.
- **`TextField.tsx`'s `type` union gains `'time'` and `'date'`** (`frontend/src/shared/ui/form/TextField.tsx:20`, currently `'text' | 'email' | 'password' | 'number' | 'datetime-local'`) — native `<input type="time">`/`<input type="date">`, no new shared date/time-picker component. No existing date/time field component exists in `shared/ui/form/` (verified: `ls shared/ui/form/` lists six files, none date/time-named).
- **No `useFieldArray`, anywhere in this codebase (verified).** The working-window/holiday editors follow `ContactDetailsSection.tsx`'s (`frontend/src/features/customers/components/ContactDetailsSection.tsx`) exact "list + inline add-form + inline edit-form, each a small local component" shape — not a repeatable field array bound to the parent `CalendarFormPage` form.

---

## Story Goal

1. **`BusinessCalendar` + `WorkingWindow` + `Holiday`** (`apps.organization`): a named calendar of per-weekday working windows plus dated holiday exceptions.
2. **`apps/organization/business_hours.py::advance`/`elapsed_working_minutes`**: the one working-time primitive — advance a timestamp by N working minutes; measure elapsed working minutes between two timestamps. Timezone-aware via `django.utils.timezone.localtime()`, honouring `DJANGO_TIME_ZONE` (`config/settings/base.py:164`); a calendar with zero configured working windows falls back to plain wall-clock arithmetic, identically to no calendar at all.
3. **`SLAPolicy.calendar`** and **`Branch.calendar`** (both nullable FKs to `BusinessCalendar`): the two calendar-assignment surfaces the intake names.
4. **`apps/sla/policy.py::compute_sla_status`** and **`apps/sla/escalation_rules.py::is_at_risk`/`is_idle`** consume the working-time primitive instead of raw `timedelta` arithmetic, when a calendar resolves for the ticket.
5. **A frontend management screen** (`/settings/calendars`) — list, create, edit a `BusinessCalendar`, with inline working-window and holiday editors — plus a `calendar` picker added to the existing `BranchFormPage.tsx`.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `BusinessCalendar`/`WorkingWindow`/`Holiday` models, `apps/organization/business_hours.py` | Intake task 1 (🔑) — "reused by SLA due times, escalation, and reporting." |
| `SLAPolicy.calendar`, `Branch.calendar` | Intake task 3 — the two calendar-selection surfaces. |
| `compute_sla_status`/`is_at_risk`/`is_idle` made calendar-aware | Intake task 2 — "SLA-1's due-time computation and SLA-3's escalation thresholds." |
| `/settings/calendars` (list/form + working-window/holiday inline editors), `BranchFormPage.tsx` calendar picker | Intake task 3 — "reuse UI/FORM/I18N... managers configure real working hours without code." |

**Not here, and why:**

- **No persisted due-time field on `Ticket`.** See `## Prerequisites` — SLA status stays computed on every read, the same as Story 28 shipped it. The intake's "recompute on ticket save, not retroactively" constraint is satisfied because nothing is cached: every read already uses whatever calendar/policy configuration is current, and there is no stored historical value to accidentally rewrite in bulk. A batch "recompute existing tickets" migration is unnecessary and is not built.
- **No calendar-awareness in the bulk/report SLA path** (`bulk_target_resolver`, `annotate_sla_facts`, `status_from_facts`, `apps/reports/sla.py`). These keep computing plain wall-clock due times. See `## Edge Cases & Failure Modes` for the resulting, accepted inconsistency between a ticket's list badge and its own detail page once it has a calendar.
- **No org-wide default calendar on `OrganizationSettings`.** Only `SLAPolicy.calendar` and `Branch.calendar` exist, per the intake's own task 3 wording.
- **No multiple working windows per weekday, no overnight windows.** One `(weekday, start_time, end_time)` row per weekday, `end_time > start_time` enforced. A future story can lift this if a real shift-pattern need appears.
- **No per-calendar timezone.** One calendar model, honouring the single `DJANGO_TIME_ZONE` env value — the intake says "honouring ENV's configured timezone," not "configurable per calendar."
- **No frontend CRUD for `SLAPolicy`.** Unchanged from Story 28: `SLAPolicyAdmin` (Django admin) remains the sole config surface for `SLAPolicy`, including its new `calendar` field.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| One working-time primitive; every consumer calls it, no second copy. | Intake, task 1 | `apps/organization/business_hours.py::advance`/`elapsed_working_minutes`. |
| A calendar is optional; none configured keeps 24/7 wall-clock exactly. | Intake, task 2 | `resolve_calendar` returning `None`; `advance`/`elapsed_working_minutes` on a calendar with zero windows. |
| Calendar resolution: policy's own calendar, else the ticket's branch's calendar, else none. | This story's design, from intake task 3's two surfaces | `apps/sla/policy.py::resolve_calendar`. |
| Timezone-aware, honouring `DJANGO_TIME_ZONE`. | Intake, task 1 | `business_hours.py` uses `timezone.localtime()` throughout, no per-calendar tz. |
| Managers configure working hours without code. | Intake, task 3 | `/settings/calendars` (list/form), working-window/holiday inline editors, `BranchFormPage.tsx` calendar picker. |
| SLA config (`SLAPolicy.calendar`) stays Django-admin-only. | Story 28's own precedent, reaffirmed | `SLAPolicyAdmin`. |

---

## Context — Read These Files First

1. `.squad/stories/sla-automation/SUPPORTOS-133/intake.md` — three tasks, no attachments, no acceptance criteria.
2. `backend/apps/organization/models.py` lines 56-86 (`Branch`) and lines 89-213 (`OrganizationSettings`, including its `default_response_target_minutes`/`default_resolution_target_minutes` — the two-field "opt-in default" shape this story's own nullable `calendar` FKs mirror).
3. `backend/apps/sla/models.py` lines 1-91 (`SLAPolicy`) — where `calendar` is added; `apps/sla/policy.py` (228 lines) in full — `resolve_policy` (25-42), `_org_default_policy` (45-63), `dimension_status` (66-79), `compute_sla_status` (82-124), the bulk section (127-228, out of scope — see `## Prerequisites`).
4. `backend/apps/sla/escalation_rules.py` in full (92 lines) — `is_at_risk` (62-81), `is_idle` (84-91), `_last_activity_at` (38-59).
5. `backend/apps/sla/tasks.py` lines 47-69 (`evaluate_escalations`) — the Celery periodic task whose `candidates` queryset (line 64) needs `select_related("branch__calendar")` added.
6. `backend/apps/customers/views.py` lines 259-288 (`ContactDetailViewSet`) — the exact "child resource, scoped by a required `?parent_id=` query param" shape `WorkingWindowViewSet`/`HolidayViewSet` copy.
7. `backend/apps/customers/serializers.py` lines 104-130 (`ContactDetailSerializer`) — confirms a bare `UniqueConstraint` auto-derives a DRF `UniqueTogetherValidator` (no `validators=[...]` needed), and the "`validate()` does per-field cross-checks because DRF never calls model `clean()`" pattern `WorkingWindowSerializer` copies for `end_time > start_time`.
8. `backend/apps/organization/admin.py` in full (Branch/Department/OrganizationSettings admins) and `backend/apps/customers/admin.py` lines 1-30 (`ContactDetailInline`) — the `TabularInline` shape `BusinessCalendarAdmin` copies for `WorkingWindow`/`Holiday`.
9. `backend/apps/organization/views.py` lines 1-84 (imports through `BranchViewSet`) and `backend/apps/organization/serializers.py` lines 1-45 (`DepartmentSerializer`/`BranchSerializer`) and `backend/apps/organization/urls.py` in full (38 lines) — the router registration shape for `CalendarViewSet`/`WorkingWindowViewSet`/`HolidayViewSet`.
10. `backend/apps/organization/migrations/0010_grant_branch_permissions.py` in full — the exact `GRANTS`/`grant`/`revoke` shape the new `calendars.*` permission-grant migration copies.
11. `backend/apps/core/permissions.py` lines 26-49 (`Permissions`) — where `CALENDARS_VIEW`/`CALENDARS_MANAGE` are appended.
12. `frontend/src/features/organization/components/BranchListPage.tsx` and `BranchFormPage.tsx` (both in full) — the list/form pair `CalendarListPage.tsx`/`CalendarFormPage.tsx` copy exactly, field-for-field for `name`/`description`.
13. `frontend/src/features/customers/components/ContactDetailsSection.tsx` (in full, 339 lines) — the list + inline add-form + inline edit-form shape `WorkingWindowsSection.tsx`/`HolidaysSection.tsx` copy.
14. `frontend/src/shared/branches/` (`branchKeys.ts`, `getBranches.ts`, `useBranches.ts`, `types.ts`) and `frontend/src/features/organization/api/{getBranchList,getBranch,createBranch,updateBranch,deleteBranch,useBranchList,useBranch,useBranchMutations}.ts` and `frontend/src/features/organization/types/branch.ts` — the complete CRUD-plus-shared-picker file set `Calendar` copies.
15. `frontend/src/shared/ui/form/TextField.tsx` lines 19-26 — the `type` union to extend.
16. `frontend/src/app/router.tsx` lines 662-702 (the `branches.view`/`branches.manage` route groups) and `frontend/src/app/Sidebar.tsx` lines 383-398 (`departments`/`branches` `SidebarLink`s) — the exact blocks `calendars` copies.
17. `frontend/src/features/organization/locales/en.json` lines 24-75 (`departments`/`branches` blocks) — the key shape `calendars`/`workingWindows`/`holidays` follow.
18. `CONVENTIONS.md` §23 (SLA-1's compute-on-read paragraph) and §37 (the most recent numbered section) — this story appends `## 38. Business hours & working-time arithmetic (SLA-5)` after it.

---

## Backend Tasks

### 1 — Permissions

**File: `backend/apps/core/permissions.py`** — append after `BRANCHES_MANAGE` (line 43):

```python
    CALENDARS_VIEW = "calendars.view"
    CALENDARS_MANAGE = "calendars.manage"
```

### 2 — `BusinessCalendar`, `WorkingWindow`, `Holiday`; `Branch.calendar`

**File: `backend/apps/organization/models.py`** — add after the `Branch` class (after line 86), before `OrganizationSettings`:

```python
class BusinessCalendar(TimeStampedModel):
    """A named set of weekly working windows plus dated holiday
    exceptions — SLA-5's shared working-time primitive. The actual
    arithmetic (`advance`, `elapsed_working_minutes`) lives in
    `apps/organization/business_hours.py`, imported by `apps.sla`
    (see that app's `## Prerequisites`, Story 111) — this model only
    holds the configured shape.

    A calendar with ZERO `working_windows` rows is treated identically to
    no calendar at all: `business_hours.py` falls back to plain
    wall-clock arithmetic rather than concluding "no working time ever
    exists," which would make a due date unreachable. See
    `business_hours.py`'s own docstring.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.CharField(_("description"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("business calendar")
        verbose_name_plural = _("business calendars")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class WorkingWindow(TimeStampedModel):
    """One weekday's working hours on a `BusinessCalendar` — SLA-5. ONE
    row per weekday (`UniqueConstraint` below): no split morning/
    afternoon shifts and no overnight (wrap-past-midnight) windows in
    this story — see Story 111 `## Story Goal`.

    `weekday` uses Python's own `datetime.weekday()` numbering
    (Monday=0 ... Sunday=6) directly, so `business_hours.py` never needs
    to translate between two conventions.
    """

    class Weekday(models.IntegerChoices):
        MONDAY = 0, _("Monday")
        TUESDAY = 1, _("Tuesday")
        WEDNESDAY = 2, _("Wednesday")
        THURSDAY = 3, _("Thursday")
        FRIDAY = 4, _("Friday")
        SATURDAY = 5, _("Saturday")
        SUNDAY = 6, _("Sunday")

    calendar = models.ForeignKey(
        BusinessCalendar,
        on_delete=models.CASCADE,
        related_name="working_windows",
        verbose_name=_("calendar"),
    )
    weekday = models.PositiveSmallIntegerField(_("weekday"), choices=Weekday.choices)
    start_time = models.TimeField(_("start time"))
    end_time = models.TimeField(_("end time"))

    class Meta:
        verbose_name = _("working window")
        verbose_name_plural = _("working windows")
        constraints = [
            models.UniqueConstraint(
                fields=["calendar", "weekday"], name="unique_working_window_calendar_weekday"
            )
        ]
        ordering = ("weekday", "start_time")

    def clean(self):
        # Guards the admin (DRF never calls model `clean()` — the same
        # gap `WorkingWindowSerializer.validate` fills for the API path,
        # the split `ContactDetailSerializer.validate` already
        # establishes).
        if self.start_time is not None and self.end_time is not None:
            if self.end_time <= self.start_time:
                raise ValidationError({"end_time": _("End time must be after start time.")})

    def __str__(self) -> str:
        return f"{self.get_weekday_display()} {self.start_time}-{self.end_time}"


class Holiday(TimeStampedModel):
    """One dated exception on a `BusinessCalendar` — SLA-5. A holiday
    date with no working window that weekday is a harmless no-op; the
    date simply never mattered to begin with.
    """

    calendar = models.ForeignKey(
        BusinessCalendar,
        on_delete=models.CASCADE,
        related_name="holidays",
        verbose_name=_("calendar"),
    )
    date = models.DateField(_("date"))
    label = models.CharField(_("label"), max_length=100, blank=True)

    class Meta:
        verbose_name = _("holiday")
        verbose_name_plural = _("holidays")
        constraints = [
            models.UniqueConstraint(fields=["calendar", "date"], name="unique_holiday_calendar_date")
        ]
        ordering = ("date",)

    def __str__(self) -> str:
        return f"{self.date} ({self.label})" if self.label else str(self.date)
```

Add `calendar` to `Branch` (after `description`, line 78, before `class Meta` at line 80):

```python
    # SET_NULL, nullable — the same call every other optional Branch
    # relationship makes. A branch with no calendar keeps its tickets on
    # 24/7 wall-clock SLA arithmetic, unchanged from before this story.
    # See Story 111 `## Prerequisites`.
    calendar = models.ForeignKey(
        BusinessCalendar,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="branches",
        verbose_name=_("business calendar"),
    )
```

(`BusinessCalendar` must be defined before `Branch` references it, or use the string form `"organization.BusinessCalendar"` if declared after — since task 2 places `BusinessCalendar`/`WorkingWindow`/`Holiday` AFTER `Branch` in this same file, use the string form `"self"`-style forward reference: `models.ForeignKey("BusinessCalendar", ...)` for `Branch.calendar`, since `BusinessCalendar` is defined later in the same module.)

Add `from django.core.exceptions import ValidationError` to this file's imports if not already present (it is not — verified, `apps/organization/models.py`'s current imports are `ValidationError` from `django.core.exceptions` already, at line 1 — reuse it).

### 3 — Migration

From `backend/`, venv active:

```
python manage.py makemigrations organization
```

Expect **one** new file, `apps/organization/migrations/0016_<name>.py` — three `CreateModel`s (`BusinessCalendar`, `WorkingWindow`, `Holiday`) plus one `AddField` (`Branch.calendar`), depending on `organization`'s `0015_organizationsettings_retention_fields`.

### 4 — Grant `calendars.*` permissions

**Create file: `backend/apps/organization/migrations/0017_grant_calendar_permissions.py`** — copy `0010_grant_branch_permissions.py`'s exact shape:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# `admin` gets both — configuring working hours is org configuration,
# alongside BRANCHES_MANAGE/SETTINGS_MANAGE. `manager` gets VIEW only, so
# a manager editing a Branch (BranchFormPage's new calendar picker) can
# see the list of calendars to choose from, even though only `admin`
# holds BRANCHES_MANAGE today. `agent` is deliberately absent: nothing
# agent-facing ever surfaces a calendar (no ticket-list column, no
# picker on the ticket form) — see Story 111 `## Prerequisites`.
GRANTS = {
    "admin": [Permissions.CALENDARS_VIEW, Permissions.CALENDARS_MANAGE],
    "manager": [Permissions.CALENDARS_VIEW],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) | set(permissions))
        role.save(update_fields=["permissions"])


def revoke(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) - set(permissions))
        role.save(update_fields=["permissions"])


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0016_businesscalendar_workingwindow_holiday_branch_calendar"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

(Replace the dependency's exact migration name with whatever task 3 actually generated.)

### 5 — The working-time primitive

**Create file: `backend/apps/organization/business_hours.py`**

```python
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
    return {window.weekday: (window.start_time, window.end_time) for window in calendar.working_windows.all()}


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
        f"BusinessCalendar {calendar.id} has no reachable working time within {MAX_DAYS_SCANNED} days"
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
```

### 6 — Admin

**File: `backend/apps/organization/admin.py`** — add imports (`BusinessCalendar`, `Holiday`, `WorkingWindow` to the existing `.models` import) and, after `BranchAdmin`:

```python
class WorkingWindowInline(admin.TabularInline):
    """`ContactDetailInline` (apps/customers/admin.py), for `WorkingWindow`."""

    model = WorkingWindow
    extra = 1


class HolidayInline(admin.TabularInline):
    """`ContactDetailInline` (apps/customers/admin.py), for `Holiday`."""

    model = Holiday
    extra = 1


@admin.register(BusinessCalendar)
class BusinessCalendarAdmin(admin.ModelAdmin):
    """A manual fallback, like `BranchAdmin` above — `/settings/calendars`
    (task 20) is the primary UI. See Story 111 `## Story Goal`.
    """

    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
    inlines = (WorkingWindowInline, HolidayInline)
```

### 7 — Serializers

**File: `backend/apps/organization/serializers.py`** — add `BusinessCalendar`, `Holiday`, `WorkingWindow` to the `.models` import (line 8-16), then:

```python
class CalendarSerializer(BaseModelSerializer):
    """CRUD over `BusinessCalendar` — SLA-5's management screen. Shaped
    exactly like `BranchSerializer` above.
    """

    class Meta(BaseModelSerializer.Meta):
        model = BusinessCalendar
        fields = ("id", "name", "description", "created_at", "updated_at")


class WorkingWindowSerializer(BaseModelSerializer):
    """CRUD over one `WorkingWindow`, scoped by `calendar` — the exact
    `ContactDetailSerializer` shape. `(calendar, weekday)`'s
    `UniqueConstraint` auto-derives a `UniqueTogetherValidator`, the same
    verified-safe DRF behaviour `ContactDetailSerializer`'s own docstring
    records.
    """

    class Meta(BaseModelSerializer.Meta):
        model = WorkingWindow
        fields = ("id", "calendar", "weekday", "start_time", "end_time", "created_at", "updated_at")

    def validate(self, attrs):
        """DRF never calls model `clean()` — the same gap
        `ContactDetailSerializer.validate` fills for its own model.
        `start_time`/`end_time` fall back to the existing instance's
        values on a PATCH that sends only one of the pair.
        """
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start_time is not None and end_time is not None and end_time <= start_time:
            raise serializers.ValidationError({"end_time": _("End time must be after start time.")})
        return attrs


class HolidaySerializer(BaseModelSerializer):
    """CRUD over one `Holiday`, scoped by `calendar` — the exact
    `ContactDetailSerializer` shape. `(calendar, date)`'s
    `UniqueConstraint` auto-derives its own `UniqueTogetherValidator`.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Holiday
        fields = ("id", "calendar", "date", "label", "created_at", "updated_at")
```

Add `calendar`/`calendar_name` to `BranchSerializer.Meta.fields` (line 44), plus the read-only dotted-source field, mirroring `category_name`/`department_name` on `TicketSerializer`:

```python
class BranchSerializer(BaseModelSerializer):
    calendar_name = serializers.CharField(source="calendar.name", read_only=True, allow_null=True)

    class Meta(BaseModelSerializer.Meta):
        model = Branch
        fields = ("id", "name", "description", "calendar", "calendar_name", "created_at", "updated_at")
```

### 8 — Views

**File: `backend/apps/organization/views.py`** — add `BusinessCalendar`, `Holiday`, `WorkingWindow` to the `.models` import and `CalendarSerializer`, `HolidaySerializer`, `WorkingWindowSerializer` to the `.serializers` import, then after `BranchViewSet` (after line 84):

```python
class CalendarViewSet(BaseModelViewSet):
    """`BusinessCalendar` CRUD — SLA-5's management screen. `BranchViewSet`
    above, for the calendar primitive. Two permissions: `calendars.view`
    reaches `admin`/`manager` (the `BranchFormPage` picker needs it);
    `calendars.manage` is admin-only. See migration
    `0017_grant_calendar_permissions`.
    """

    queryset = BusinessCalendar.objects.all()
    serializer_class = CalendarSerializer

    permission_map = {
        "list": Permissions.CALENDARS_VIEW,
        "retrieve": Permissions.CALENDARS_VIEW,
        "create": Permissions.CALENDARS_MANAGE,
        "update": Permissions.CALENDARS_MANAGE,
        "partial_update": Permissions.CALENDARS_MANAGE,
        "destroy": Permissions.CALENDARS_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name", "description")


class WorkingWindowViewSet(BaseModelViewSet):
    """`WorkingWindow` CRUD for one calendar. `ContactDetailViewSet`
    (apps/customers/views.py:259-288) — reuses `calendars.*`, not a
    separate permission domain, the same reasoning that story records
    for `ContactDetail` reusing `customers.*` (Story 11).
    """

    queryset = WorkingWindow.objects.all()
    serializer_class = WorkingWindowSerializer

    permission_map = {
        "list": Permissions.CALENDARS_VIEW,
        "retrieve": Permissions.CALENDARS_VIEW,
        "create": Permissions.CALENDARS_MANAGE,
        "update": Permissions.CALENDARS_MANAGE,
        "partial_update": Permissions.CALENDARS_MANAGE,
        "destroy": Permissions.CALENDARS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        calendar_id = self.request.query_params.get("calendar")
        if not calendar_id:
            raise ValidationError({"calendar": [_("This query parameter is required.")]})
        try:
            calendar_id = int(calendar_id)
        except ValueError:
            raise ValidationError({"calendar": [_("Must be a valid calendar id.")]}) from None
        return queryset.filter(calendar_id=calendar_id)


class HolidayViewSet(BaseModelViewSet):
    """`Holiday` CRUD for one calendar. `WorkingWindowViewSet` above,
    identical shape.
    """

    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    permission_map = {
        "list": Permissions.CALENDARS_VIEW,
        "retrieve": Permissions.CALENDARS_VIEW,
        "create": Permissions.CALENDARS_MANAGE,
        "update": Permissions.CALENDARS_MANAGE,
        "partial_update": Permissions.CALENDARS_MANAGE,
        "destroy": Permissions.CALENDARS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        calendar_id = self.request.query_params.get("calendar")
        if not calendar_id:
            raise ValidationError({"calendar": [_("This query parameter is required.")]})
        try:
            calendar_id = int(calendar_id)
        except ValueError:
            raise ValidationError({"calendar": [_("Must be a valid calendar id.")]}) from None
        return queryset.filter(calendar_id=calendar_id)
```

Add `from rest_framework.exceptions import ValidationError` and `from django.utils.translation import gettext_lazy as _` to this file's imports if not already present (verify against the file's current header — `ContactDetailViewSet`'s own file, `apps/customers/views.py`, already imports both this exact way; mirror it).

### 9 — URLs

**File: `backend/apps/organization/urls.py`** — add `CalendarViewSet`, `HolidayViewSet`, `WorkingWindowViewSet` to the `.views` import, then register on the existing `router`:

```python
router.register("calendars", CalendarViewSet, basename="calendar")
router.register("working-windows", WorkingWindowViewSet, basename="working-window")
router.register("holidays", HolidayViewSet, basename="holiday")
```

### 10 — `SLAPolicy.calendar`

**File: `backend/apps/sla/models.py`** — add the import (`from apps.organization.models import BusinessCalendar`) and, on `SLAPolicy`, after `category` (before `response_target_minutes`, around line 34):

```python
    # SET_NULL, nullable, opt-in — a policy with no calendar keeps
    # today's 24/7 wall-clock behaviour exactly. See Story 111
    # `## Prerequisites` for the two-surface (`SLAPolicy`/`Branch`)
    # calendar-resolution order.
    calendar = models.ForeignKey(
        BusinessCalendar,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sla_policies",
        verbose_name=_("business calendar"),
    )
```

Migration, from `backend/`:

```
python manage.py makemigrations sla
```

Expect **one** new file, `apps/sla/migrations/0006_slapolicy_calendar.py` — a single `AddField`, depending on `sla`'s `0005_enforce_single_default_policy_and_rule` and `organization`'s new `0016_...` migration (task 3), for the FK.

### 11 — `SLAPolicyAdmin`

**File: `backend/apps/sla/admin.py`** — add `"calendar"` to `SLAPolicyAdmin.list_display` (after `"category"`) and `list_filter` (after `"category"`):

```python
    list_display = (
        "priority",
        "category",
        "calendar",
        "response_target_minutes",
        "resolution_target_minutes",
        "created_at",
    )
    list_filter = ("priority", "category", "calendar")
```

### 12 — Apply working time to SLA due times

**File: `backend/apps/sla/policy.py`** — add the import:

```python
from apps.organization.business_hours import advance
from apps.organization.models import BusinessCalendar
```

Add `resolve_calendar`, after `resolve_policy` (after line 42):

```python
def resolve_calendar(ticket: Ticket, policy: SLAPolicy | None) -> BusinessCalendar | None:
    """The calendar that applies to this ticket's working-time
    arithmetic: the resolved `SLAPolicy`'s own `calendar` if set, else
    the ticket's `branch.calendar` if set, else `None` (today's 24/7
    wall-clock behaviour). `policy` is optional so `is_idle`
    (`apps/sla/escalation_rules.py`, which has no SLA policy to hang a
    calendar override off) can resolve a calendar from the ticket's
    branch alone by passing `None`. See Story 111 `## Prerequisites`.
    """
    if policy is not None and policy.calendar_id is not None:
        return policy.calendar
    if ticket.branch_id is not None:
        return ticket.branch.calendar
    return None
```

Change `compute_sla_status` (lines 82-124) to compute `response_due_at`/`resolution_due_at` via `resolve_calendar`/`advance` when a calendar resolves:

```python
    now = timezone.now()
    calendar = resolve_calendar(ticket, policy)
    if calendar is not None:
        response_due_at = advance(calendar, ticket.created_at, policy.response_target_minutes)
        resolution_due_at = advance(calendar, ticket.created_at, policy.resolution_target_minutes)
    else:
        response_due_at = ticket.created_at + timedelta(minutes=policy.response_target_minutes)
        resolution_due_at = ticket.created_at + timedelta(minutes=policy.resolution_target_minutes)
```

(Replaces the existing two unconditional `timedelta` lines; everything after — `first_reply`, `resolved_activity`, the returned dict — is unchanged.)

### 13 — Apply working time to escalation thresholds

**File: `backend/apps/sla/escalation_rules.py`** — add the import:

```python
from apps.sla.policy import compute_sla_status, resolve_calendar, resolve_policy
from apps.organization.business_hours import elapsed_working_minutes
```

(Replaces the existing `from apps.sla.policy import compute_sla_status` line.)

Change `is_at_risk` (lines 62-81) to measure WORKING minutes to the deadline when a calendar resolves:

```python
def is_at_risk(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """`True` if the ticket's response or resolution dimension is still
    `pending` (per `compute_sla_status`, Story 28) and due within
    `threshold_minutes` WORKING minutes — measured with the same
    calendar `compute_sla_status` itself resolved for this ticket, per
    Story 111's single working-time primitive rule. `False` immediately
    if `threshold_minutes` is `None` (no `at_risk` rule enabled), or no
    `SLAPolicy` applies to this ticket at all.
    """
    if threshold_minutes is None:
        return False
    sla = compute_sla_status(ticket)
    if sla is None:
        return False
    calendar = resolve_calendar(ticket, resolve_policy(ticket))
    for due_at, dimension_status in (
        (sla["response_due_at"], sla["response_status"]),
        (sla["resolution_due_at"], sla["resolution_status"]),
    ):
        if dimension_status != "pending":
            continue
        if calendar is not None:
            remaining = elapsed_working_minutes(calendar, now, due_at)
        else:
            remaining = (due_at - now).total_seconds() / 60
        if remaining <= threshold_minutes:
            return True
    return False
```

Change `is_idle` (lines 84-91) to measure WORKING minutes of inactivity when the ticket's branch has a calendar:

```python
def is_idle(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """`True` if `threshold_minutes` is not `None` and the ticket's last
    activity is at least that many WORKING minutes in the past, per the
    ticket's branch calendar if one is set (`resolve_calendar(ticket,
    None)` — idle has no SLA policy to hang a calendar override off, see
    Story 111 `## Prerequisites`), else plain wall-clock minutes.
    """
    if threshold_minutes is None:
        return False
    last_activity_at = _last_activity_at(ticket)
    calendar = resolve_calendar(ticket, None)
    if calendar is not None:
        elapsed = elapsed_working_minutes(calendar, last_activity_at, now)
    else:
        elapsed = (now - last_activity_at).total_seconds() / 60
    return elapsed >= threshold_minutes
```

**File: `backend/apps/sla/tasks.py`** — line 64, add `select_related` to the candidates queryset so `is_at_risk`/`is_idle`'s new `ticket.branch.calendar` access does not add a query per open ticket on top of the existing per-ticket cost this task already accepts (Story 30):

```python
    candidates = (
        Ticket.objects.select_related("branch__calendar")
        .filter(escalated=False)
        .exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])
    )
```

---

## Frontend Tasks

### 14 — `TextField` gains `time`/`date`

**File: `frontend/src/shared/ui/form/TextField.tsx`** line 20 — extend the union:

```ts
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local' | 'time' | 'date'
```

### 15 — Shared calendar picker

**Create files**, mirroring `frontend/src/shared/branches/` exactly:

- `frontend/src/shared/calendars/types.ts` — `Calendar = { id: number; name: string; description: string; created_at: string; updated_at: string }`, mirroring `shared/branches/types.ts`'s `Branch`.
- `frontend/src/shared/calendars/calendarKeys.ts` — `export const calendarKeys = featureKey('calendars')`.
- `frontend/src/shared/calendars/getCalendars.ts` — `api.getPage<Calendar>('/calendars/', { params: { page_size: 100, ordering: 'name' } })`.
- `frontend/src/shared/calendars/useCalendars.ts` — `useQuery({ queryKey: calendarKeys.resource('options'), queryFn: getCalendars })`.
- `frontend/src/shared/calendars/index.ts` — re-export all four, mirroring `shared/branches`'s own barrel (verify its exact export list and copy the shape).

### 16 — Feature types

**Create files:**

- `frontend/src/features/organization/types/calendar.ts` — `export type { Calendar } from '@/shared/calendars'` plus `CalendarInput = { name: string; description: string }`, mirroring `types/branch.ts`.
- `frontend/src/features/organization/types/workingWindow.ts` — `WEEKDAYS = [0,1,2,3,4,5,6] as const` (or named constants matching `WorkingWindow.Weekday`); `WorkingWindow = { id: number; calendar: number; weekday: number; start_time: string; end_time: string; created_at: string; updated_at: string }`; `WorkingWindowInput = { calendar: number; weekday: number; start_time: string; end_time: string }`.
- `frontend/src/features/organization/types/holiday.ts` — `Holiday = { id: number; calendar: number; date: string; label: string; created_at: string; updated_at: string }`; `HolidayInput = { calendar: number; date: string; label: string }`.

### 17 — Calendar CRUD API layer

**Create files**, mirroring `frontend/src/features/organization/api/{getBranchList,getBranch,createBranch,updateBranch,deleteBranch,useBranchList,useBranch,useBranchMutations}.ts` exactly, substituting `Branch`→`Calendar`, `/branches/`→`/calendars/`, `branchKeys`→`calendarKeys` (from `@/shared/calendars`):

- `getCalendarList.ts`, `getCalendar.ts`, `createCalendar.ts`, `updateCalendar.ts` (PATCH), `deleteCalendar.ts`
- `useCalendarList.ts`, `useCalendar.ts`, `useCalendarMutations.ts` (`useCreateCalendar`/`useUpdateCalendar`/`useDeleteCalendar`, invalidating `calendarKeys.all`)

### 18 — Working-window / holiday API layer

**Create files**, mirroring `frontend/src/features/customers/api/{getContactDetails,createContactDetail,updateContactDetail,deleteContactDetail,useContactDetails,useContactDetailMutations}.ts` exactly, substituting `ContactDetail`→`WorkingWindow`/`Holiday`, `/contact-details/`→`/working-windows/`/`/holidays/`, `customer`→`calendar` as the scoping param, `customerKeys.resource('contacts', customerId)`→a local per-calendar key (this feature has no shared cross-feature key for working windows/holidays — a plain local `['organization', 'working-windows', calendarId]`/`['organization', 'holidays', calendarId]` array is enough, since nothing outside `CalendarFormPage` reads these):

- `getWorkingWindows.ts`, `createWorkingWindow.ts`, `updateWorkingWindow.ts`, `deleteWorkingWindow.ts`, `useWorkingWindows.ts`, `useWorkingWindowMutations.ts`
- `getHolidays.ts`, `createHoliday.ts`, `updateHoliday.ts`, `deleteHoliday.ts`, `useHolidays.ts`, `useHolidayMutations.ts`

### 19 — `CalendarListPage.tsx`

**Create file: `frontend/src/features/organization/components/CalendarListPage.tsx`** — copy `BranchListPage.tsx` in full, substituting `Branch`→`Calendar`, `branches.*` translation keys/permissions→`calendars.*`, `/settings/branches`→`/settings/calendars`. Same two columns (`name`, `description`) plus `created_at`/`actions`.

### 20 — `CalendarFormPage.tsx` + inline editors

**Create file: `frontend/src/features/organization/components/CalendarFormPage.tsx`** — copy `BranchFormPage.tsx`'s structure (the `name`/`description` card, create-vs-edit split) substituting `Branch`→`Calendar`. Below the `name`/`description` card, in **edit mode only** (working windows/holidays need a saved `calendar.id` to scope by — the same "children only make sense once the parent exists" constraint `ContactDetailsSection` accepts implicitly by living on `CustomerProfilePage`, not the create form):

```tsx
{mode === 'edit' && id !== undefined ? (
  <>
    <WorkingWindowsSection calendarId={id} />
    <HolidaysSection calendarId={id} />
  </>
) : null}
```

**Create file: `frontend/src/features/organization/components/WorkingWindowsSection.tsx`** — copy `ContactDetailsSection.tsx`'s three-part shape (`XSection`, `XRow`, `XAddForm`/`XEditForm`) with:
- A row shows: weekday label (`t('calendars.workingWindows.weekdays.<n>')`), `start_time`–`end_time`.
- The add/edit form: a `SelectField` for `weekday` (options 0-6, labelled via the same weekday translation keys) and two `TextField`s with `type="time"` for `start_time`/`end_time`.
- Zod schema: `weekday: z.coerce.number().int().min(0).max(6)`, `start_time`/`end_time`: `z.string().regex(/^\d{2}:\d{2}$/)` (native `<input type="time">` value shape), plus a `.refine()` that `end_time > start_time` (client-side mirror of the server's `WorkingWindowSerializer.validate`).
- Server 400s surface through `applyServerErrors`, same as every other form in this codebase.

**Create file: `frontend/src/features/organization/components/HolidaysSection.tsx`** — copy `ContactDetailsSection.tsx`'s shape with:
- A row shows: `date` (formatted via `useFormatters().date`), `label`.
- The add/edit form: a `TextField` with `type="date"` for `date`, a `TextField` for `label` (optional — `optionalString(100).transform((value) => value ?? '')`).
- Zod schema: `date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.

### 21 — `BranchFormPage.tsx` calendar picker

**File: `frontend/src/features/organization/components/BranchFormPage.tsx`** — add a `calendar` field:

- Zod schema (line 19-25): add `calendar: z.coerce.number().int().nullable()` (or the project's existing "nullable FK select" pattern — check `TicketFormPage.tsx`'s `category`/`branch` fields for the exact nullable-select zod idiom and copy it verbatim rather than inventing a new one).
- `toDefaults`/`toBranchInput` (lines 31-37): thread `calendar` through both directions.
- `BranchInput` type (`types/branch.ts`): add `calendar: number | null`.
- Render a `SelectField` (or the project's nullable-FK select component — same one `category`/`branch` use on `TicketFormPage.tsx`) bound to `calendar`, options from `useCalendars()` (`@/shared/calendars`), each `{ value: String(calendar.id), label: calendar.name }`, plus a "None" option mapping to `null` — the exact pattern `TicketFormPage.tsx`'s optional FK selects already use.

### 22 — Routes

**File: `frontend/src/app/router.tsx`** — after the `branches.manage` route group (after line 702), add a `calendars.view`/`calendars.manage` pair copying lines 662-702 verbatim, substituting `Branch`→`Calendar`, `branches`→`calendars`:

```tsx
{
  element: <RequirePermission permission="calendars.view" />,
  children: [
    {
      path: 'settings/calendars',
      lazy: async () => {
        const { CalendarListPage } =
          await import('@/features/organization/components/CalendarListPage')
        return { element: <CalendarListPage /> }
      },
    },
  ],
},
{
  element: <RequirePermission permission="calendars.manage" />,
  children: [
    {
      path: 'settings/calendars/new',
      lazy: async () => {
        const { CalendarFormPage } =
          await import('@/features/organization/components/CalendarFormPage')
        return { element: <CalendarFormPage /> }
      },
    },
    {
      path: 'settings/calendars/:id/edit',
      lazy: async () => {
        const { CalendarFormPage } =
          await import('@/features/organization/components/CalendarFormPage')
        return { element: <CalendarFormPage /> }
      },
    },
  ],
},
```

### 23 — Sidebar

**File: `frontend/src/app/Sidebar.tsx`** — after the `branches.view` `SidebarLink` (after line 398):

```tsx
<Can permission="calendars.view">
  <SidebarLink
    to="/settings/calendars"
    icon={CalendarClockIcon}
    label={t('organization:calendars.title')}
    collapsed={collapsed}
  />
</Can>
```

Add `CalendarClockIcon` to the existing `lucide-react` import at the top of the file.

### 24 — Locales

**File: `frontend/src/features/organization/locales/en.json`** — add, after the `branches` block (after line 75):

```json
  "calendars": {
    "title": "Business Calendars",
    "new": "New calendar",
    "edit": "Edit calendar",
    "search": "Search calendars",
    "searchPlaceholder": "Search by name",
    "empty": "No calendars yet",
    "emptyDescription": "Create a calendar to measure SLA targets in working hours instead of around the clock.",
    "noSearchResults": "No calendars match your search",
    "created": "Calendar created.",
    "updated": "Calendar updated.",
    "fields": { "name": "Name", "description": "Description", "createdAt": "Created", "actions": "Actions" },
    "actions": { "save": "Save", "delete": "Delete" },
    "delete": {
      "title": "Delete calendar?",
      "description": "SLA policies and branches using this calendar fall back to 24/7 wall-clock SLA targets."
    },
    "workingWindows": {
      "title": "Working hours",
      "empty": "No working hours configured — this calendar has no effect until at least one day is added.",
      "add": "Add working hours",
      "fields": { "weekday": "Day", "startTime": "Start time", "endTime": "End time" },
      "actions": { "add": "Add", "save": "Save", "edit": "Edit", "remove": "Remove", "cancel": "Cancel" },
      "created": "Working hours added.",
      "updated": "Working hours updated.",
      "delete": { "title": "Remove working hours?", "description": "This day becomes non-working for this calendar." },
      "weekdays": {
        "0": "Monday", "1": "Tuesday", "2": "Wednesday", "3": "Thursday",
        "4": "Friday", "5": "Saturday", "6": "Sunday"
      }
    },
    "holidays": {
      "title": "Holidays",
      "empty": "No holidays added.",
      "add": "Add holiday",
      "fields": { "date": "Date", "label": "Label" },
      "actions": { "add": "Add", "save": "Save", "edit": "Edit", "remove": "Remove", "cancel": "Cancel" },
      "created": "Holiday added.",
      "updated": "Holiday updated.",
      "delete": { "title": "Remove holiday?", "description": "This date becomes a normal working day again." }
    }
  },
```

Add `"calendar": "Business calendar"` to the existing `branches.fields` block (line 61-66).

**File: `frontend/src/features/organization/locales/ar.json`** — the identical key set, translated, in the same position.

---

## Documentation Tasks

### 25 — `CONVENTIONS.md`

**File: `CONVENTIONS.md`** — append after §37 (end of file):

> ## 38. Business hours & working-time arithmetic (SLA-5)
>
> **One working-time primitive, every consumer calls it.** `apps/organization/business_hours.py::advance`/`elapsed_working_minutes` (Story 111) is the single implementation of "advance a timestamp by N working minutes" / "measure elapsed working minutes between two timestamps." `apps/sla/policy.py::compute_sla_status` and `apps/sla/escalation_rules.py::is_at_risk`/`is_idle` are its only consumers today — a future feature needing the same arithmetic (a second reporting metric, a different domain's deadline) must import this module, never re-derive it.
>
> **A calendar is optional, all the way down.** No `SLAPolicy`/`Branch`/`OrganizationSettings` configuration is required anywhere; a `BusinessCalendar` with zero `WorkingWindow` rows and a ticket/policy/branch with no calendar at all both resolve to the exact same plain wall-clock arithmetic this codebase used before Story 111. Nothing "breaks" by omission — see that story's own `## Story Goal`.
>
> **Calendar resolution has one order, defined once.** `apps/sla/policy.py::resolve_calendar(ticket, policy)`: the resolved `SLAPolicy`'s own `calendar`, else the ticket's `branch.calendar`, else `None`. Both `compute_sla_status` and `escalation_rules.py`'s `is_at_risk`/`is_idle` call this same function — never a second, parallel resolution.
>
> **Not every SLA consumer is calendar-aware, and that is a recorded, deliberate limitation, not an oversight.** The bulk ticket-list `sla_status` column (`apps/sla/policy.py::bulk_target_resolver`/`annotate_sla_facts`, `apps/tickets/serializers.py::get_sla_status`) and `apps/reports/sla.py` (RPT-2) still compute plain wall-clock due times even when a ticket's resolved policy/branch has a calendar. A ticket's list badge can therefore disagree with its own `GET /tickets/<id>/sla/` detail once a calendar is involved — see Story 111 `## Edge Cases & Failure Modes`. Extending the bulk path needs its own batching design (the exact deferral Story 28 already recorded for the N+1 problem itself) and is not assumed solved by this addition.

### 26 — Overview

**File: `.squad/plans/sla-automation/00-overview.md`** — add this story's row to the `## Stories` table and a dependency-notes paragraph summarizing: `BusinessCalendar`/`WorkingWindow`/`Holiday` living in `apps.organization` (not a new app), the single `business_hours.py` primitive, the policy-then-branch calendar resolution order, the deliberate non-coverage of the bulk/report SLA path, and the frontend `/settings/calendars` management screen plus `BranchFormPage.tsx`'s new picker.

---

## Edge Cases & Failure Modes

- **A calendar with zero `WorkingWindow` rows behaves exactly like no calendar at all** (`business_hours.py::advance`/`elapsed_working_minutes`'s `if not windows:` fallback) — a manager who creates a calendar but forgets to add any working hours gets safe 24/7 behaviour, not a ticket whose due date can never be reached.
- **A calendar whose windows all fall on a holiday on every occurrence is impossible by construction** (`WorkingWindow` is weekly-recurring, `Holiday` is a single date), so `advance`'s `MAX_DAYS_SCANNED` guard is a safety net for a real misconfiguration bug, never a reachable state through normal admin/UI use — hitting the `RuntimeError` means a bug in this arithmetic itself, not bad input.
- **Deleting a `BusinessCalendar` referenced by a `SLAPolicy` or a `Branch`** (`SET_NULL` on both) silently reverts that policy/branch to 24/7 wall-clock SLA arithmetic — no error, no orphaned reference, consistent with every other optional FK in this codebase.
- **A ticket's list-view `sla_status` badge and reports (`apps/reports/sla.py`) can disagree with its own `GET /tickets/<id>/sla/` detail** once a calendar applies — the bulk path is explicitly out of scope (see `## Prerequisites`/`CONVENTIONS.md` §38). This is a known, accepted inconsistency, not a bug to chase down in this story.
- **`is_idle`'s calendar resolution is branch-only, `is_at_risk`'s is policy-then-branch** — a ticket with a calendar-bearing `SLAPolicy` but no `Branch` gets calendar-aware at-risk evaluation but plain wall-clock idle evaluation. Documented, deliberate: idle has no SLA policy to hang a calendar override off.
- **`WorkingWindow.clean()`/`WorkingWindowSerializer.validate()` reject `end_time <= start_time`** — no overnight (wrap-past-midnight) windows in this story; a shift like 22:00–06:00 must be entered as two calendars' worth of tickets is not supported and is out of scope (see `## Story Goal`).
- **The `(calendar, weekday)` `UniqueConstraint` on `WorkingWindow` rejects a second window for the same weekday** — a split morning/afternoon shift is out of scope; the admin form/frontend surfaces the 400 as a normal validation error, not a 500.
- **Changing a ticket's `branch`, or a `Branch`'s/`SLAPolicy`'s `calendar`, after ticket creation immediately changes the computed due time on next read** — the same accepted, already-documented consequence Story 28 records for priority/category changes (`## Edge Cases & Failure Modes`), now extended to calendar assignment. Nothing is persisted, so there is nothing to retroactively "get wrong."
- **A `Holiday` dated on a weekday with no configured `WorkingWindow` is a harmless no-op** — it was never going to affect that day's (nonexistent) working hours anyway.
- **DST transitions inside a working window are not specially handled** — `business_hours.py` operates entirely in `timezone.localtime()`'s local-time representation and does simple `.replace(hour=..., minute=...)` arithmetic; a calendar spanning a DST transition may be off by the transition's offset on that one day. Not addressed in this story; flagged here for a future pass if a deployment's `DJANGO_TIME_ZONE` observes DST.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing suite must still pass (record the baseline count before starting; confirm the identical count afterward — no regressions, no new tests).
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once tasks 3/10 generate their migrations.
3. `ruff format --check .` / `ruff check .` over the new/changed Python.
4. Real HTTP / Django shell: `advance`/`elapsed_working_minutes` against a calendar with a single Mon-Fri 09:00-17:00 window and one holiday — a Thursday-17:00 ticket with a 4-hour response target due Friday 13:00 (skipping the overnight and non-working hours); a target that spans the holiday, skipping it entirely; a calendar with zero windows behaving identically to no calendar.
5. `GET /api/tickets/<id>/sla/` for a ticket whose resolved policy has a calendar vs. one that does not — due times differ exactly as task 12 describes; a ticket with a calendar-less policy but a calendar-bearing branch still gets calendar-aware due times (branch fallback).
6. `evaluate_escalations` (Celery task, or call `is_at_risk`/`is_idle` directly in a shell): a ticket just outside a wall-clock `at_risk` threshold but within it once business hours are accounted for (e.g. due Monday morning, evaluated Friday evening) escalates correctly; an idle ticket over a weekend with a calendar assigned does not idle-escalate purely from elapsed wall-clock weekend hours.
7. Admin: `WorkingWindowInline`/`HolidayInline` on `/admin/organization/businesscalendar/<id>/change/` — adding a second window for the same weekday is rejected; `end_time <= start_time` is rejected; `SLAPolicyAdmin`'s `calendar` dropdown saves correctly.
8. Permission gating: `calendars.view`-only token can `GET /api/calendars/`/`/api/working-windows/?calendar=<id>`/`/api/holidays/?calendar=<id>` but gets `403` on `POST`/`PATCH`/`DELETE`; no token gets `401`; `calendars.manage` (admin) can do both.
9. `WorkingWindowViewSet`/`HolidayViewSet` without `?calendar=` on `list` → `400`, matching `ContactDetailViewSet`'s own required-param behaviour.
10. Full bilingual UI walkthrough: `/settings/calendars` — create a calendar, add working windows and holidays inline, edit and remove each; `/settings/branches/<id>/edit` — assign a calendar to a branch and save; switch to Arabic and confirm every new label translates and the layout reads correctly in RTL.
11. The full gate set, in CI order: from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. Clean up every calendar, working window, holiday, branch-calendar assignment, and any throwaway role/user created during verification.

---

## Migration / Rollback

**Three migrations**: `apps/organization/migrations/0016_...` (three `CreateModel`s, one `AddField` on `Branch`), `apps/organization/migrations/0017_grant_calendar_permissions.py` (data migration, reversible via `revoke`), `apps/sla/migrations/0006_slapolicy_calendar.py` (one `AddField`, depends on organization's `0016`).

**Rollback of the code:** revert the commits, then `python manage.py migrate sla 0005_enforce_single_default_policy_and_rule` and `python manage.py migrate organization 0015_organizationsettings_retention_fields` to unapply, in that order (sla depends on organization's new migration).

**Half-applied states to avoid:**

- **`Branch.calendar`/`SLAPolicy.calendar` added without `null=True, blank=True`.** The entire "calendar is optional" design requires it — the same nullable-FK trap every prior story in this app has documented.
- **`business_hours.py::advance`/`elapsed_working_minutes` missing the "no windows configured" fallback.** Without it, a freshly created `BusinessCalendar` with no working windows yet assigned to a `Branch`/`SLAPolicy` mid-configuration would make every affected ticket's due time unreachable (`advance` looping to its `MAX_DAYS_SCANNED` guard and raising) instead of behaving like no calendar at all.
- **`evaluate_escalations`'s `candidates` queryset missing `select_related("branch__calendar")`** (task 13's `apps/sla/tasks.py` edit) — not a correctness bug, but every ticket in an already N+1-heavy periodic task gaining one more per-ticket query the codebase's own conventions (`CONVENTIONS.md` §35) flag as worth avoiding when cheap.
- **`WorkingWindowSerializer`/`HolidaySerializer` missing their `UniqueConstraint`-derived validators** (verify, per task 7's own note, that DRF still auto-derives them the same way `ContactDetailSerializer` does) — without it, a duplicate `(calendar, weekday)` or `(calendar, date)` row would surface as a raw 500 database-constraint error instead of a clean 400.
- **`WorkingWindowViewSet`/`HolidayViewSet`'s `get_queryset` missing the required-`?calendar=` guard** — would silently list every calendar's windows/holidays together on an unfiltered `GET`, the same class of bug `ContactDetailViewSet`'s own required-param check prevents.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations generated and applied cleanly:** `python manage.py makemigrations organization sla` produces exactly the files described in tasks 3/10 (plus the hand-written grant migration, task 4); `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports the same passing count as before this change.
4. **Working-time arithmetic, in a Django shell:** build a calendar with a Mon-Fri 09:00-17:00 window and one holiday; verify `advance`/`elapsed_working_minutes` skip weekends, the holiday, and outside-window hours correctly (see `## Test Plan` step 4 for concrete cases); verify a zero-window calendar behaves identically to `calendar=None`.
5. **SLA due times respect the calendar:** `GET /tickets/<id>/sla/` for a ticket whose resolved policy/branch has a calendar shows working-hours-adjusted due times; an otherwise-identical ticket with no calendar anywhere in its resolution chain shows unchanged plain wall-clock due times (today's exact prior behaviour).
6. **Escalation thresholds respect the calendar:** `is_at_risk`/`is_idle` (or `evaluate_escalations` end-to-end) escalate/do-not-escalate per working-hours math, not wall-clock, for a calendar-bearing ticket — see `## Test Plan` step 6.
7. **Admin-side validation:** duplicate-weekday and `end_time <= start_time` are both rejected as form errors, not 500s or silent saves.
8. **Permission gating:** `403`/`401`/`200` exactly as `## Test Plan` step 8 describes, across `/api/calendars/`, `/api/working-windows/`, `/api/holidays/`.
9. **The full bilingual UI walkthrough:** `/settings/calendars` (create/edit a calendar, add/edit/remove working windows and holidays inline) and `/settings/branches/<id>/edit` (assign a calendar) both work end to end in English and Arabic, RTL-correct.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
11. **Clean up** every calendar, working window, holiday, branch/policy calendar assignment, and any throwaway role/user created during verification.

---

## Done Criteria

- [ ] `BusinessCalendar`/`WorkingWindow`/`Holiday` models in `apps.organization`; `Branch.calendar` and `SLAPolicy.calendar` (both nullable, `SET_NULL`).
- [ ] `apps/organization/business_hours.py::advance`/`elapsed_working_minutes` — the single working-time primitive, timezone-aware, with the documented "no windows configured" 24/7 fallback.
- [ ] `apps/sla/policy.py::resolve_calendar` (policy-then-branch order) wired into `compute_sla_status`; `apps/sla/escalation_rules.py::is_at_risk`/`is_idle` wired the same way; `apps/sla/tasks.py::evaluate_escalations`'s candidates queryset gains `select_related("branch__calendar")`.
- [ ] Three migrations: `organization/0016_...` (three `CreateModel`s + one `AddField`), `organization/0017_grant_calendar_permissions.py` (reversible), `sla/0006_slapolicy_calendar.py`.
- [ ] `CALENDARS_VIEW`/`CALENDARS_MANAGE` permissions; `admin` gets both, `manager` gets view-only, `agent` gets neither.
- [ ] `CalendarViewSet`/`WorkingWindowViewSet`/`HolidayViewSet` registered at `/api/calendars/`, `/api/working-windows/`, `/api/holidays/`; the latter two 400 on a `list` with no `?calendar=`.
- [ ] `BusinessCalendarAdmin` (with `WorkingWindowInline`/`HolidayInline`) and `SLAPolicyAdmin`'s new `calendar` field, both as manual-fallback config surfaces.
- [ ] `/settings/calendars` — list, create, edit; inline working-window and holiday editors on the edit form, in edit mode only.
- [ ] `BranchFormPage.tsx` — a `calendar` picker, backed by `shared/calendars`.
- [ ] `en.json`/`ar.json` — the new `calendars`/`workingWindows`/`holidays` blocks and `branches.fields.calendar`; identical key sets in both languages.
- [ ] `CONVENTIONS.md` gains `## 38. Business hours & working-time arithmetic (SLA-5)`.
- [ ] **No `Ticket` model change, no new persisted due-time field, no bulk/report SLA path change** — both explicitly out of scope, per `## Prerequisites`.
- [ ] `python manage.py test` reports the same passing count as before; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP/shell: calendar-aware `advance`/`elapsed_working_minutes` arithmetic (Step 4); calendar-aware SLA due times (Step 5) and escalation thresholds (Step 6); admin-side validation (Step 7); `403`/`401`/`200` permission gating (Step 8).
- [ ] Both languages walk through cleanly in the browser for `/settings/calendars` and the `BranchFormPage.tsx` picker (Step 9).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 11).
- [ ] `.squad/plans/sla-automation/00-overview.md` updated with this story's row and dependency notes (task 26).

**STOP HERE. Report to the user and wait for confirmation.**
