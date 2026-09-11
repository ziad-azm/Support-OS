# Story 106 — Bulk Ticket Actions (Story: SUPPORTOS-130)

## Prerequisites

- **Story 22 (`TKT-3`, Assignment) completed:** [22-story-assignment-SUPPORTOS-34.md](22-story-assignment-SUPPORTOS-34.md). Verified landed and still current: `apps/tickets/assignment.py::assignable_agents()`/`apply_assignment(ticket, agent, actor)` (the latter now shared by the single `assign` action and SLA-2's auto-assignment task, `backend/apps/tickets/assignment.py:45-73`), and `TicketSerializer.assigned_agent` read-only, written only through the action.
- **Story 23 (`TKT-4`, Status & Escalation) completed:** [23-story-status-escalation-SUPPORTOS-35.md](23-story-status-escalation-SUPPORTOS-35.md). Verified landed: the hand-authored transition graph `apps/tickets/status.py::VALID_TRANSITIONS`/`is_valid_transition` (`backend/apps/tickets/status.py:15-29`), `Ticket.status` read-only on the serializer, and `TicketViewSet.set_status` (`backend/apps/tickets/views.py:231-270`) — the no-op-rejection and illegal-transition logic this story extracts into a shared helper (see Backend Task 1).
- **Story 24 (`TKT-5`, Ticket History) completed:** [24-story-ticket-history-SUPPORTOS-36.md](24-story-ticket-history-SUPPORTOS-36.md). Verified landed: `TicketActivity` (`backend/apps/tickets/models.py:167-220`, `Kind.STATUS_CHANGED`/`Kind.ASSIGNED`) and `apps/tickets/history.py::build_history`. This story writes to the identical model through the identical helpers — no new `Kind`, no new log shape.
- **Story 62 (`DSN-7`, Cross-Feature Consistency Remediation) completed:** [../design-intelligence-ui-ux-system/62-story-cross-feature-consistency-remediation-SUPPORTOS-98.md](../design-intelligence-ui-ux-system/62-story-cross-feature-consistency-remediation-SUPPORTOS-98.md). This is the story that makes `DataTable` (`frontend/src/shared/ui/data-table/DataTable.tsx`) the *one* table pattern with 23 real consumers today (verified: `grep -rl "DataTable" frontend/src --include="*.tsx"` outside `shared/ui/data-table/`/`shared/ui/chart/`), which is exactly why Task 1's selection support goes into that one file rather than a ticket-specific fork — every sibling list screen inherits it for free, unchanged, because it is entirely opt-in.
- **Story 98 (`ORG-4`, SUPPORTOS-129) completed:** [../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md](../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md). The most recent story to touch `TicketListPage.tsx`, and it changes this plan's line numbers directly — read it before touching that file. Confirmed current: `departmentFilter`/`branchFilter`/`onlyMine` state (`frontend/src/features/tickets/components/TicketListPage.tsx:52-90`), the single filter-reset `useEffect` (lines 99-110) this story's selection-clearing hooks into, and `ScopedQuerysetMixin.scoped_actions = ("list",)` (`backend/apps/core/scoping.py:101-102`) — confirming a `detail=False` custom `@action` is **not** scoped, the same unscoped behaviour every existing `@action` on `TicketViewSet` (`assign`, `set_status`, `escalate`, `history`, …) already relies on.
- **No dependency on a not-yet-planned story.** `TKT-6` (Internal Notes) and everything after it in the backlog are unrelated to this work. The intake's own "Dependencies: TKT-3, TKT-4, DSN-7" is fully satisfied by the four items above.

---

## Story Goal

1. **Row selection in the shared `DataTable`** — an opt-in `selection` prop adds a leading checkbox column (per-row + "select all on this page") to any consumer that asks for it, with zero behavioural change to the other 22 consumers that do not.
2. **Three bulk endpoints** — `POST /api/tickets/bulk-assign/`, `POST /api/tickets/bulk-status/`, `POST /api/tickets/bulk-priority/`, each `tickets.manage`-gated, each reusing the exact single-ticket validation/logging path (`apply_assignment`, a new `apply_status_change` extracted from `set_status`, and `priority`'s existing plain-field write), each returning one `{"id", "ok", "error"?}` row per requested ticket id instead of failing the whole batch on one bad row.
3. **A ticket-specific bulk-action bar** on `/tickets`, visible only under `tickets.manage`, wired to the three endpoints through a shared confirm step and a toast summary that distinguishes "all succeeded" / "partial" / "all failed" — with the specific per-row failures listed inline, not just a count.

**Explicitly not in this story** (three sub-tasks named in the intake, nothing more):

- **No bulk delete and no ticket merge.** The intake's three sub-tasks name assign/status/priority only. A recent commit message on this branch (`feat(ticket-management): add intake documents for bulk ticket actions, saved views, and ticket merge handling`) lists "ticket merge handling" alongside this work, but no merge intake exists under `.squad/stories/ticket-management/` today — it is a separate, not-yet-planned story, not part of `SUPPORTOS-130`.
- **No saved views.** Same reasoning — mentioned in that commit message, not in this story's intake.
- **No cross-page selection.** "Select-all-on-page" is the intake's own literal wording; selecting across a page boundary would require either fetching every matching id up front or tracking an open-ended id set server cannot bound. See `## Edge Cases & Failure Modes`.
- **No generalised "any list screen gets a bulk bar for free."** `DataTable` gains the reusable *mechanism* (checkboxes, selection state plumbing); the bulk-action *bar itself* — which buttons it offers, what each one does — is feature-specific and ships only for tickets, exactly as the intake's own outcome says ("a reusable selection pattern, adopted first by tickets").

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-130/intake.md` — three task blocks (`🔑` on the DataTable task), no attachments, no acceptance-criteria list.
2. `backend/apps/tickets/views.py`, full file (396 lines) — `permission_map` (lines 61-84), `TicketViewSet.get_queryset` (lines 132-181, note the `if self.action != "list": return queryset` early-return at line 137 that already makes every existing `@action` unscoped), `assign` (197-229, the `apply_assignment` call this story's `bulk_assign` mirrors), `set_status` (231-270, the inline validation Backend Task 1 extracts), `escalate` (272-293, the last mutation action — the three new bulk actions are inserted directly after it, before `history` at line 295).
3. `backend/apps/tickets/status.py`, full file (29 lines) — `VALID_TRANSITIONS`/`is_valid_transition`, unchanged by this story; Backend Task 1 adds `apply_status_change` alongside them.
4. `backend/apps/tickets/assignment.py`, full file (73 lines) — `apply_assignment(ticket, agent, actor)` (lines 45-73): already shared by a human-driven action and an automated task (SLA-2's `auto_assign_ticket`), already logs `TicketActivity` and calls `notify()` only on a real change. `bulk_assign` reuses this exact function — a *third* caller, no new logging path.
5. `backend/apps/tickets/models.py` — `Ticket.Priority`/`Ticket.Status` (lines 35-45), `TicketActivity` (167-220, `Kind.STATUS_CHANGED`/`Kind.ASSIGNED` — no `Kind.PRIORITY_CHANGED` exists and none is added, see `## Product rules`).
6. `backend/apps/tickets/serializers.py` — `TicketSerializer.Meta.fields`/`read_only_fields` (lines 61-95): confirms `priority` is a **plain writable field**, unlike `assigned_agent`/`status`/`escalated`/`escalated_at` — it has no dedicated action and no activity-log entry even for a single-ticket edit through `TicketFormPage`. `bulk_priority` matches that existing behaviour exactly (no no-op check, no `TicketActivity` row) rather than inventing stricter behaviour bulk-only.
7. `backend/apps/core/permissions.py` — `HasPermission._required_permission` (lines 140-148): confirms `permission_map` is keyed by the `@action`'s own method name, and a missing entry falls through to authenticated-only, not denied — the same trap every prior `ticket-management` story's `## Migration / Rollback` names.
8. `backend/apps/core/scoping.py` — `ScopedQuerysetMixin` (lines 78-108, `scoped_actions = ("list",)`): confirms the three new `detail=False` bulk actions are **not** scope-filtered — the same behaviour every existing `TicketViewSet` action other than `list` already has, and consistent with `CONVENTIONS.md` §33's "a scope filter is not an access boundary."
9. `backend/apps/tickets/urls.py`, full file (18 lines) — `SimpleRouter`; confirm no edit is needed (the three new actions are router-generated, `detail=False`, exactly like `assignable-agents`).
10. `frontend/src/shared/ui/data-table/DataTable.tsx`, full file (180 lines) — read in full. `DataTableProps<T>` (lines 25-35), the header row (72-114), the three body branches — loading skeleton (117-127), error (129-146), empty (148-154), success rows (156-172) — every one of which needs a leading cell/column added and `colSpan={columns.length}` (140, 150) widened when `selection` is passed.
11. `frontend/src/shared/ui/data-table/types.ts`, full file (29 lines) — `ColumnDef<T>`, `SortState`. Frontend Task 1 adds a `DataTableSelection<T>` type here.
12. `frontend/src/shared/ui/data-table/useServerTable.ts`, full file (41 lines) — confirms sort/page state lives in the *page*, not in `DataTable` itself; this story's selection state follows the identical ownership split (selection lives in the page, `DataTable` only renders it and reports toggles).
13. `frontend/src/shared/ui/primitives/checkbox.tsx`, full file (27 lines) — the `Checkbox` primitive (Radix, already keyboard-accessible: Space toggles, Tab focuses, no extra wiring needed) both the header "select all" and each row checkbox use.
14. `frontend/src/shared/ui/confirm/useConfirm.ts` + `types.ts` (both full) — `useConfirm()` returns `Promise<boolean>`; `ConfirmOptions` (`title`, `description?`, `confirmLabel?`, `cancelLabel?`, `destructive?`). `frontend/src/features/tickets/components/TicketStatusControl.tsx` (full, 76 lines) is the exact worked example this story's bulk-status confirm copies — note its `destructive: true` only on a transition into a terminal status (`TICKET_STATUS_TRANSITIONS[nextStatus].length === 0`), the precedent Frontend Task 6 reuses for `bulk-status` → `closed`.
15. `frontend/src/shared/ui/toast/useToast.ts` + `types.ts` (both full) — `ToastTone = 'error' | 'success' | 'info'`; `ToastProvider.tsx` lines 61-93 confirm the toast container is `max-w-sm` — a long per-row failure list does not belong in the toast body itself (see Frontend Task 6's design note).
16. `frontend/src/features/tickets/components/TicketListPage.tsx`, full file (342 lines, current — already updated by Story 98/`ORG-4`) — `departmentFilter`/`branchFilter`/`onlyMine` state and the `useAuth()` import (lines 47, 82-87), the **one** filter-reset `useEffect` at lines 99-110 (`search, categoryFilter, statusFilter, priorityFilter, departmentFilter, branchFilter, onlyMine`) that Frontend Task 7 adds `setSelectedIds(new Set())` to, the `columns` array (123-213), and the `<DataTable ... />` call (323-338) whose `onSortChange`/`onPageChange` props (327-329) Frontend Task 7 wraps to also clear selection.
17. `frontend/src/features/tickets/components/TicketAssigneeControl.tsx` (full, 97 lines) and `TicketStatusControl.tsx` (full, 76 lines) — the `Select`-drives-a-mutation-directly shape (no `useAppForm`), the `UNASSIGNED` sentinel convention, and the "toast on success, rely on the shared mutation error handler on failure" pattern — all reused, except bulk actions' "failure" is a `200` with per-row `ok: false`, not a thrown error, so Frontend Task 6 builds its own summary toast instead of relying on that shared handler (see Edge Cases).
18. `frontend/src/features/tickets/api/useTicketMutations.ts`, full file (95 lines) — `useAssignTicket`/`useSetTicketStatus` (45-59): prefix-wide `ticketKeys.all` invalidation, the pattern the three new bulk mutations copy.
19. `frontend/src/features/tickets/api/useAssignableAgents.ts` + `getAssignableAgents.ts` — reused as-is for the bulk-assign picker's options; no change.
20. `frontend/src/features/tickets/types/ticket.ts`, full file (75 lines) — `TICKET_STATUSES`, `TICKET_PRIORITIES`, `TicketStatus`, `TicketPriority` — the bulk-status/bulk-priority `Select`s' option lists.
21. `frontend/src/shared/i18n/locales/en/common.json` + `ar/common.json` (both full) — the `table` block (lines 44-54 en / 44-58 ar): `rowCount`/`rowCount_other` (en) and the full `rowCount_zero/_one/_two/_few/_many/_other` set (ar) is the exact CLDR-plural precedent Frontend Task 8's new `table.selectedCount` key must follow for Arabic.
22. `frontend/src/features/tickets/locales/en.json` (full, 224 lines) — the `assign`/`status`/`escalation` blocks (63-96) as the shape the new `bulk` block follows; `ar.json` is the same file, translated.
23. `CONVENTIONS.md` §15 (import conventions — `@/` across feature boundaries, no deep imports into another feature), §19 ("Design system, theming & data tables," lines 401-547 — `DataTable is the only table pattern` and the equality-filter paragraph at 508-517, which Documentation Task 1 appends after), §22 (`permission_map` completeness, lines 835-1001), §23 ("Feature module conventions," 1001-1612 — read the closing paragraph at 1595-1608 to see where Documentation Task 2 appends).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Row selection is opt-in per screen, at the shared component.** | Intake, task 1 | `DataTableProps.selection?: DataTableSelection<T>` — every existing consumer omits it and is byte-identical. |
| **Selection state must never be silently stale across sort/filter changes.** | Intake, task 1, its own constraint | `TicketListPage` clears `selectedIds` in the same `useEffect` that already resets `page` on any filter change, and in the `onSortChange`/`onPageChange` wrappers — always cleared, never carried forward. See `## Edge Cases`. |
| **Bulk endpoints apply the SAME per-ticket permission and TKT-4 transition validation as the single-ticket actions — no bypass path.** | Intake, task 2 | `bulk_assign` calls `apply_assignment` (the same function `assign` calls); `bulk_status` calls a new `apply_status_change` that `set_status` is refactored to call too — one validation path, two callers, for both. |
| **A bulk endpoint returns a per-row result, never fails the whole batch on one bad row.** | Intake, task 2 | `apps/tickets/bulk.py::parse_ticket_ids`/`fetch_tickets`; each of the three actions loops ids and appends `{"id", "ok", "error"?}}`, catching `ValidationError` per row rather than letting it propagate. |
| **Every change writes to `TicketActivity` exactly as the single-ticket action does.** | Intake, task 2 | `bulk_assign`/`bulk_status` call the exact same helpers (`apply_assignment`, `apply_status_change`) that already create `TicketActivity` rows — no second logging call site. `bulk_priority` writes **no** activity row, because the single-ticket priority edit (a plain serializer field, `backend/apps/tickets/serializers.py:61-95`) writes none either — matching existing behaviour, not inventing new logging for a field that has none today. |
| **A confirm step gates destructive actions; a summary reports partial failure.** | Intake, task 3 | Every bulk mutation routes through `useConfirm()` before firing (bulk changes touch many tickets at once, which this story treats as the destructive-scale case `TicketStatusControl`'s own terminal-transition confirm already established for one ticket — `destructive: true` is reserved for `bulk-status` → a terminal status, mirroring that precedent exactly); the result toast distinguishes all-succeeded / partial / all-failed, with per-row failures listed inline below the bar. |
| Wire format is `snake_case` end to end. | §12 | `ticket_ids`, `assigned_agent`, `status`, `priority`. |
| No new permission constant. | §17, §22 | `bulk_assign`/`bulk_status`/`bulk_priority` all reuse `Permissions.TICKETS_MANAGE`. |

---

## Backend Tasks

**No new model, no migration.** `TicketActivity`'s `Kind` enum is unchanged (`STATUS_CHANGED`/`ASSIGNED` only — see `## Product rules` for why priority stays unlogged), and no new field is added to `Ticket`. `python manage.py makemigrations --check --dry-run` must report no changes after this story.

### 1 — Extract `apply_status_change` into `apps/tickets/status.py`

**File: `backend/apps/tickets/status.py`** — add imports and one new function, after the existing `is_valid_transition`:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from .models import Ticket, TicketActivity
```

(Replaces the existing `from .models import Ticket` line.)

```python
def apply_status_change(ticket: Ticket, new_status: str, actor) -> None:
    """Validates and applies a status change, then logs it — the SAME
    checks `TicketViewSet.set_status` used to run inline, now shared with
    TKT-7's `bulk_status`. Raises the identical `ValidationError`s a
    single-ticket call already raised (unrecognised value, no-op
    re-statement, illegal transition) so neither caller has a looser path.
    Mirrors `apps/tickets/assignment.py::apply_assignment`'s shape: one
    helper, multiple callers, one `TicketActivity` write site. See Story
    106 `## Prerequisites`.
    """
    if new_status not in Ticket.Status.values:
        raise ValidationError({"status": [_("Must be a valid status.")]})
    if new_status == ticket.status:
        raise ValidationError({"status": [_("Ticket is already in this status.")]})
    if not is_valid_transition(ticket.status, new_status):
        raise ValidationError(
            {
                "status": [
                    _("Cannot change status from %(current)s to %(new)s.")
                    % {"current": ticket.status, "new": new_status}
                ]
            }
        )

    old_status = ticket.status
    ticket.status = new_status
    ticket.save(update_fields=["status", "updated_at"])
    TicketActivity.objects.create(
        ticket=ticket,
        actor=actor,
        kind=TicketActivity.Kind.STATUS_CHANGED,
        from_value=old_status,
        to_value=new_status,
    )
```

**File: `backend/apps/tickets/views.py`** — replace `set_status`'s body (the inline logic at lines ~240-269) with a call to the new helper, keeping the docstring and the "field required" check:

```python
    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        """Change a ticket's status along a valid transition — TKT-4.
        Delegates validation/logging to `apps.tickets.status.apply_status_change`
        — the same helper TKT-7's `bulk_status` calls, so both enforce ONE
        path (Story 106 `## Prerequisites`). `status` must be present in
        the body — an omitted key is a 400.
        """
        if "status" not in request.data:
            raise ValidationError({"status": [_("This field is required.")]})

        ticket = self.get_object()
        apply_status_change(ticket, request.data.get("status"), actor=request.user)
        return Response(self.get_serializer(ticket).data)
```

Update the import block: replace `from .status import is_valid_transition` with `from .status import apply_status_change` (`views.py` no longer calls `is_valid_transition` directly — only `apply_status_change` does, inside `status.py`).

---

### 2 — The bulk request-parsing helper

**Create file: `backend/apps/tickets/bulk.py`**

```python
"""Shared plumbing for TKT-7's bulk ticket actions — parsing/validating
the `ticket_ids` list once and fetching every requested ticket in a
single query, so `TicketViewSet.bulk_assign`/`bulk_status`/`bulk_priority`
each stay a thin loop over the SAME per-ticket helpers the single-ticket
actions use (`apply_assignment`, `apply_status_change`, or a plain field
write for `priority`). Same "small, pure helper module, imported by
views.py" placement `assignment.py`/`status.py` already established
(Story 22/23).

A batch never fails whole because of one bad row (the intake's own
"returning a per-row result rather than failing the whole batch"): the
`ticket_ids` list ITSELF is validated up front — absent/empty/malformed/
oversized is a single 400 for the whole request, the same "a present-but-
malformed value is a 400, never a silent no-op" contract every filter in
this project already follows — but a PER-ID problem (not found, illegal
transition, ...) becomes one `{"id": ..., "ok": False, "error": ...}`
entry, never an exception that aborts the rest of the batch.
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# A generous but real ceiling on a hand-crafted request — `TicketListPage`'s
# "select all on this page" can only ever select `page_size` rows (25 by
# default, 100 at `DRF_MAX_PAGE_SIZE`; `backend/apps/core/pagination.py`),
# so this never bites through the UI. Chosen the same deliberate-round-
# number way `HISTORY_MAX_ENTRIES` (`apps/tickets/history.py`) was.
MAX_BULK_IDS = 200


def parse_ticket_ids(data) -> list[int]:
    """`ticket_ids` must be present, a non-empty list, at most
    `MAX_BULK_IDS` long, and every element must parse as an int. Any
    violation is ONE 400 for the whole request — this validates the
    request's shape, not a per-ticket outcome.
    """
    raw = data.get("ticket_ids")
    if not isinstance(raw, list) or not raw:
        raise ValidationError({"ticket_ids": [_("Must be a non-empty list of ticket ids.")]})
    if len(raw) > MAX_BULK_IDS:
        raise ValidationError(
            {
                "ticket_ids": [
                    _("Cannot act on more than %(max)s tickets at once.")
                    % {"max": MAX_BULK_IDS}
                ]
            }
        )
    ids = []
    for raw_id in raw:
        try:
            ids.append(int(raw_id))
        except (TypeError, ValueError):
            raise ValidationError({"ticket_ids": [_("Every id must be a number.")]}) from None
    return ids


def fetch_tickets(queryset, ticket_ids: list[int]) -> dict:
    """One query for every requested id, keyed by id for O(1) per-row
    lookup in the caller's loop. An id with no matching row (wrong id, or
    deleted between the page loading and the bulk request being sent) is
    simply absent from the returned dict — the caller reports that as a
    per-row "not found," never as a 404 for the whole request.
    """
    return {ticket.id: ticket for ticket in queryset.filter(pk__in=ticket_ids)}


def first_error_message(exc: ValidationError) -> str:
    """Flattens a DRF `ValidationError.detail` (normally `{field: [msg,
    ...]}`) to one string for a bulk result row — the first message of
    the first field. These are the EXACT messages `apply_status_change`/
    the single-ticket actions already raise, just surfaced per-row here
    instead of as the whole request's 400.
    """
    detail = exc.detail
    if isinstance(detail, dict):
        for messages in detail.values():
            if messages:
                return str(messages[0])
    if isinstance(detail, list) and detail:
        return str(detail[0])
    return str(detail)
```

---

### 3 — Views: the three bulk actions

**File: `backend/apps/tickets/views.py`** — extend the import block:

```python
from .bulk import fetch_tickets, first_error_message, parse_ticket_ids
```

Add three `permission_map` entries, alongside the existing `assign`/`set_status`/`escalate` ones:

```python
        # TKT-7: same reasoning as every entry above — keyed by the
        # @action's own method name, missing means authenticated-only not
        # denied. All three reuse tickets.manage, the same gate the
        # single-ticket assign/set_status/priority-edit already use.
        "bulk_assign": Permissions.TICKETS_MANAGE,
        "bulk_status": Permissions.TICKETS_MANAGE,
        "bulk_priority": Permissions.TICKETS_MANAGE,
```

Append three actions directly after `escalate` (after line 293), before `history`:

```python
    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        """Assign or unassign many tickets in one call — TKT-7. Same body
        contract as `assign` (`assigned_agent` required; an id assigns,
        `null` unassigns; validated against the SAME `assignable_agents()`
        queryset) applied to every id in `ticket_ids`, via the SAME
        `apply_assignment` helper `assign` itself calls — no second,
        looser validation or logging path. A not-found ticket id is a
        per-row failure, never a whole-request 400.
        """
        if "assigned_agent" not in request.data:
            raise ValidationError({"assigned_agent": [_("This field is required.")]})

        agent_id = request.data.get("assigned_agent")
        agent = None
        if agent_id is not None:
            try:
                agent_id = int(agent_id)
            except (TypeError, ValueError):
                raise ValidationError({"assigned_agent": [_("Must be a valid user id.")]}) from None
            agent = assignable_agents().filter(pk=agent_id).first()
            if agent is None:
                raise ValidationError(
                    {"assigned_agent": [_("That user cannot be assigned tickets.")]}
                )

        ticket_ids = parse_ticket_ids(request.data)
        tickets_by_id = fetch_tickets(self.get_queryset(), ticket_ids)

        results = []
        for ticket_id in ticket_ids:
            ticket = tickets_by_id.get(ticket_id)
            if ticket is None:
                results.append({"id": ticket_id, "ok": False, "error": str(_("Ticket not found."))})
                continue
            apply_assignment(ticket, agent, actor=request.user)
            results.append({"id": ticket_id, "ok": True})
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request):
        """Change the status of many tickets in one call — TKT-7. Each id
        is validated and logged through the SAME `apply_status_change`
        helper `set_status` calls, so a transition illegal for one
        ticket's current status is only THAT row's failure — tickets in
        different states legitimately react differently to the same
        requested target status.
        """
        if "status" not in request.data:
            raise ValidationError({"status": [_("This field is required.")]})
        new_status = request.data.get("status")

        ticket_ids = parse_ticket_ids(request.data)
        tickets_by_id = fetch_tickets(self.get_queryset(), ticket_ids)

        results = []
        for ticket_id in ticket_ids:
            ticket = tickets_by_id.get(ticket_id)
            if ticket is None:
                results.append({"id": ticket_id, "ok": False, "error": str(_("Ticket not found."))})
                continue
            try:
                apply_status_change(ticket, new_status, actor=request.user)
            except ValidationError as exc:
                results.append({"id": ticket_id, "ok": False, "error": first_error_message(exc)})
                continue
            results.append({"id": ticket_id, "ok": True})
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="bulk-priority")
    def bulk_priority(self, request):
        """Change the priority of many tickets in one call — TKT-7.
        `priority` is a plain writable field on `TicketSerializer` — unlike
        `status`/`assigned_agent` it has no dedicated single-ticket action
        and no activity-log entry even on an ordinary edit (Story 106
        `## Prerequisites`) — so this mirrors that: no no-op rejection, no
        `TicketActivity` row, just the field write.
        """
        if "priority" not in request.data:
            raise ValidationError({"priority": [_("This field is required.")]})
        new_priority = request.data.get("priority")
        if new_priority not in Ticket.Priority.values:
            raise ValidationError({"priority": [_("Must be a valid priority.")]})

        ticket_ids = parse_ticket_ids(request.data)
        tickets_by_id = fetch_tickets(self.get_queryset(), ticket_ids)

        results = []
        for ticket_id in ticket_ids:
            ticket = tickets_by_id.get(ticket_id)
            if ticket is None:
                results.append({"id": ticket_id, "ok": False, "error": str(_("Ticket not found."))})
                continue
            ticket.priority = new_priority
            ticket.save(update_fields=["priority", "updated_at"])
            results.append({"id": ticket_id, "ok": True})
        return Response({"results": results})
```

**No `apps/tickets/urls.py` change** (all three routes are router-generated, `detail=False`, like `assignable-agents`). Endpoints: `POST /api/tickets/bulk-assign/`, `POST /api/tickets/bulk-status/`, `POST /api/tickets/bulk-priority/`. None can shadow `/api/tickets/<pk>/` — DRF registers every `detail=False` dynamic route before the detail route, the same ordering Story 22 verified for `assignable-agents`.

---

## Frontend Tasks

### 4 — `DataTable`: opt-in row selection

**File: `frontend/src/shared/ui/data-table/types.ts`** — add, after `ColumnDef<T>`:

```ts
/** Multi-select wiring for `DataTable` — opt-in per screen (TKT-7).
 * Row identity is `rowKey(row)`, the SAME string `DataTableProps.rowKey`
 * already computes, so selection needs no separate id type.
 */
export type DataTableSelection<T> = {
  /** Currently-selected row keys. The CALLER owns clearing this on
   * sort/filter/page changes — `DataTable` itself never clears it. See
   * CONVENTIONS.md §19's "Bulk selection" paragraph. */
  selectedIds: ReadonlySet<string>
  onSelectionChange: (next: ReadonlySet<string>) => void
}
```

**File: `frontend/src/shared/ui/data-table/DataTable.tsx`** — add the import and prop:

```tsx
import { Checkbox } from '@/shared/ui/primitives/checkbox'
```

```ts
type DataTableProps<T> = {
  columns: readonly ColumnDef<T>[]
  query: UseQueryResult<Page<T>, unknown>
  rowKey: (row: T) => string
  sort: SortState
  onSortChange: (next: SortState) => void
  onPageChange: (page: number) => void
  caption: string
  empty?: ReactNode
  /** Adds a leading checkbox column (per-row + select-all-on-page). Omit
   * for a screen that has not adopted selection — every other consumer
   * of `DataTable` today is unaffected by this prop's existence. */
  selection?: DataTableSelection<T>
}
```

Inside the component, compute selection derivatives and widen `colSpan` (replacing every `columns.length` used as a `colSpan` value):

```tsx
export function DataTable<T>({
  columns,
  query,
  rowKey,
  sort,
  onSortChange,
  onPageChange,
  caption,
  empty,
  selection,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  const pageRowIds = query.isSuccess ? query.data.items.map(rowKey) : []
  const selectedOnPage = selection ? pageRowIds.filter((id) => selection.selectedIds.has(id)) : []
  const allOnPageSelected = pageRowIds.length > 0 && selectedOnPage.length === pageRowIds.length
  const someOnPageSelected = selectedOnPage.length > 0 && !allOnPageSelected
  const colSpan = columns.length + (selection ? 1 : 0)

  function toggleAllOnPage() {
    if (!selection) return
    const next = new Set(selection.selectedIds)
    if (allOnPageSelected) pageRowIds.forEach((id) => next.delete(id))
    else pageRowIds.forEach((id) => next.add(id))
    selection.onSelectionChange(next)
  }

  function toggleRow(id: string) {
    if (!selection) return
    const next = new Set(selection.selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.onSelectionChange(next)
  }

  // ... rest as below
```

Header row (replacing lines 74-114's `<TableRow>` open):

```tsx
          <TableRow>
            {selection ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={() => toggleAllOnPage()}
                  disabled={pageRowIds.length === 0}
                  aria-label={t('table.selectAllOnPage')}
                />
              </TableHead>
            ) : null}
            {columns.map((column) => (
              /* unchanged */
            ))}
          </TableRow>
```

Loading skeleton rows (lines 117-127) gain a matching leading cell:

```tsx
            ? Array.from({ length: 3 }, (_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {selection ? (
                    <TableCell>
                      <Skeleton className="size-4" />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    /* unchanged */
                  ))}
                </TableRow>
              ))
```

Error row (line 140) and empty row (line 150): change `colSpan={columns.length}` to `colSpan={colSpan}` in both places — no other change.

Success rows (lines 156-172) gain the per-row checkbox:

```tsx
            ? query.data.items.map((row) => {
                const id = rowKey(row)
                return (
                  <TableRow key={id}>
                    {selection ? (
                      <TableCell>
                        <Checkbox
                          checked={selection.selectedIds.has(id)}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label={t('table.selectRow', { id })}
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      /* unchanged */
                    ))}
                  </TableRow>
                )
              })
```

The per-row `aria-label` uses the row's own key (its numeric id, stringified) rather than inventing a new required "row label" prop — every id is unique, so no two checkboxes on one page ever share an announced label, even though the text itself ("Select row 42") is generic rather than reading the row's subject.

---

### 5 — `SelectionActionBar`: the reusable bar shell

**Create file: `frontend/src/shared/ui/data-table/SelectionActionBar.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

/**
 * The reusable shell for a `DataTable` bulk-action bar (TKT-7) — renders
 * nothing when `count` is 0, so a consuming page can mount it
 * unconditionally. The buttons/controls inside are entirely the caller's:
 * this component knows nothing about what a "bulk action" does, only how
 * to show a selection count and a way to clear it — the same "mechanism
 * here, feature-specific content at the call site" split `DataTable`
 * itself follows for column definitions.
 */
export function SelectionActionBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (count === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2">
      <span className="text-sm font-medium">{t('table.selectedCount', { count })}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button type="button" variant="ghost" size="sm" onClick={onClear} className="ms-auto">
        {t('table.clearSelection')}
      </Button>
    </div>
  )
}
```

`ms-auto` (logical margin-inline-start: auto) pushes "Clear" to the trailing edge in both directions — no `rtl:` override needed, consistent with CONVENTIONS.md §19's logical-utilities rule.

---

### 6 — Bulk result types and API layer

**Create file: `frontend/src/features/tickets/types/bulkActionResult.ts`**

```ts
/** Mirrors the `{"results": [...]}` shape every `apps.tickets.bulk`-backed
 * action returns — one row per requested ticket id, `error` present only
 * when `ok` is false. See Story 106 `## Prerequisites`. */
export type BulkActionResultRow = {
  id: number
  ok: boolean
  error?: string
}

export type BulkActionResult = {
  results: BulkActionResultRow[]
}
```

**Create file: `frontend/src/features/tickets/api/bulkAssignTickets.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { BulkActionResult } from '../types/bulkActionResult'

/** Same contract as `assignTicket.ts` — `assignedAgent: null` unassigns
 * every selected ticket. A 200 with per-row `ok`/`error` is the NORMAL
 * outcome for a partial failure; only a malformed request (empty
 * `ticket_ids`, a non-assignable agent) is a thrown `ApiRequestError`. */
export function bulkAssignTickets(
  ticketIds: number[],
  assignedAgent: number | null,
): Promise<BulkActionResult> {
  return api.post<BulkActionResult>('/tickets/bulk-assign/', {
    ticket_ids: ticketIds,
    assigned_agent: assignedAgent,
  })
}
```

**Create file: `frontend/src/features/tickets/api/bulkSetTicketStatus.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { BulkActionResult } from '../types/bulkActionResult'
import type { TicketStatus } from '../types/ticket'

export function bulkSetTicketStatus(
  ticketIds: number[],
  status: TicketStatus,
): Promise<BulkActionResult> {
  return api.post<BulkActionResult>('/tickets/bulk-status/', { ticket_ids: ticketIds, status })
}
```

**Create file: `frontend/src/features/tickets/api/bulkSetTicketPriority.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { BulkActionResult } from '../types/bulkActionResult'
import type { TicketPriority } from '../types/ticket'

export function bulkSetTicketPriority(
  ticketIds: number[],
  priority: TicketPriority,
): Promise<BulkActionResult> {
  return api.post<BulkActionResult>('/tickets/bulk-priority/', { ticket_ids: ticketIds, priority })
}
```

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — append, following `useAssignTicket`/`useSetTicketStatus`'s exact prefix-wide-invalidation shape (add the three new imports to the existing import block):

```ts
export function useBulkAssignTickets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketIds, assignedAgent }: { ticketIds: number[]; assignedAgent: number | null }) =>
      bulkAssignTickets(ticketIds, assignedAgent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useBulkSetTicketStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketIds, status }: { ticketIds: number[]; status: TicketStatus }) =>
      bulkSetTicketStatus(ticketIds, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useBulkSetTicketPriority() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketIds, priority }: { ticketIds: number[]; priority: TicketPriority }) =>
      bulkSetTicketPriority(ticketIds, priority),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
```

(Add `TicketPriority` to the existing `import type { TicketInput, TicketStatus } from '../types/ticket'` line.) Unlike `useAssignTicket(id)`/`useSetTicketStatus(id)`, these three take no `id` parameter — they are not per-ticket, the same shape `useCreateTicket`/`useDeleteTicket` already use.

---

### 7 — `TicketListPage`: adopt selection, clear it predictably

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`**

Add selection state alongside the existing filter state (after `onlyMine` at line 87):

```tsx
  // TKT-7: page-scoped only — cleared on every sort/filter/page change
  // below, never carried forward silently. See CONVENTIONS.md §19's
  // "Bulk selection" paragraph.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const canBulkAct = can('tickets.manage')
```

(`useAuth()` at line 47 already destructures `user`; extend it to `const { user, can } = useAuth()`.)

Extend the existing filter-reset effect (lines 99-110) to also clear selection — a filter change narrows/reorders the result set exactly the way a page/sort change does, so a stale selected id could silently point at a row no longer even in view:

```tsx
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [
    search,
    categoryFilter,
    statusFilter,
    priorityFilter,
    departmentFilter,
    branchFilter,
    onlyMine,
    setPage,
  ])
```

Wrap the sort/page handlers passed to `DataTable` so both also clear selection (`useServerTable`'s own `setSort` already resets `page`; this adds the selection half):

```tsx
  function handleSortChange(next: SortState) {
    setSelectedIds(new Set())
    setSort(next)
  }

  function handlePageChange(next: number) {
    setSelectedIds(new Set())
    setPage(next)
  }
```

(Add `import type { SortState } from '@/shared/ui/data-table/types'`.)

Pass selection to `DataTable` only under `tickets.manage`, and render the bar above it:

```tsx
      <TicketBulkActionBar
        selectedIds={selectedIds}
        onDone={() => setSelectedIds(new Set())}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        caption={t('title')}
        selection={
          canBulkAct ? { selectedIds, onSelectionChange: setSelectedIds } : undefined
        }
        empty={
          search ? (
            <Empty title={t('noSearchResults')} />
          ) : (
            <Empty title={t('empty')} description={t('emptyDescription')} />
          )
        }
      />
```

`TicketBulkActionBar` itself (Task 8) reads `can('tickets.manage')` internally and renders nothing when it is false, so a `tickets.view`-only caller sees neither checkboxes nor a bar — the entire feature is invisible, not merely disabled, to anyone who could not act on the result anyway.

Add the import: `import { TicketBulkActionBar } from './TicketBulkActionBar'`.

---

### 8 — `TicketBulkActionBar`: the ticket-specific bar content

**Create file: `frontend/src/features/tickets/components/TicketBulkActionBar.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { SelectionActionBar } from '@/shared/ui/data-table/SelectionActionBar'
import { useToast } from '@/shared/ui/toast/useToast'

import {
  useBulkAssignTickets,
  useBulkSetTicketPriority,
  useBulkSetTicketStatus,
} from '../api/useTicketMutations'
import { useAssignableAgents } from '../api/useAssignableAgents'
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types/ticket'
import type { BulkActionResultRow } from '../types/bulkActionResult'
import type { TicketPriority, TicketStatus } from '../types/ticket'

const UNASSIGNED = 'unassigned'

/**
 * The ticket-specific content rendered inside the shared
 * `SelectionActionBar` — three `Select`s (assign / status / priority),
 * each an immediate-mutation control gated by `useConfirm()` before it
 * fires, mirroring `TicketAssigneeControl`/`TicketStatusControl`'s shape
 * scaled from one ticket to N. Rendered only under `tickets.manage`
 * (checked here AND at the `TicketListPage` call site that decides
 * whether `DataTable` even offers checkboxes — see Story 106 Frontend
 * Task 7).
 */
export function TicketBulkActionBar({
  selectedIds,
  onDone,
}: {
  selectedIds: ReadonlySet<string>
  onDone: () => void
}) {
  const { t } = useTranslation('tickets')
  const { can } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const agentsQuery = useAssignableAgents()
  const assignMutation = useBulkAssignTickets()
  const statusMutation = useBulkSetTicketStatus()
  const priorityMutation = useBulkSetTicketPriority()
  const [lastFailures, setLastFailures] = useState<BulkActionResultRow[]>([])

  if (!can('tickets.manage')) return null

  const ticketIds = Array.from(selectedIds, Number)
  const isPending = assignMutation.isPending || statusMutation.isPending || priorityMutation.isPending

  function report(results: BulkActionResultRow[]) {
    const failures = results.filter((row) => !row.ok)
    setLastFailures(failures)
    if (failures.length === 0) {
      toast({ tone: 'success', message: t('bulk.allSucceeded', { count: results.length }) })
    } else if (failures.length === results.length) {
      toast({ tone: 'error', message: t('bulk.allFailed', { count: results.length }) })
    } else {
      toast({
        tone: 'error',
        message: t('bulk.partialSuccess', {
          okCount: results.length - failures.length,
          total: results.length,
        }),
      })
    }
    onDone()
  }

  async function handleAssign(value: string) {
    const agent = value === UNASSIGNED ? null : Number(value)
    const agentName =
      value === UNASSIGNED
        ? t('fields.unassigned')
        : ((agentsQuery.data ?? []).find((candidate) => candidate.id === agent)?.name ?? '')
    const confirmed = await confirm({
      title: t('bulk.assignConfirmTitle', { count: ticketIds.length, agent: agentName }),
      description: t('bulk.confirmDescription'),
    })
    if (!confirmed) return
    assignMutation.mutate(
      { ticketIds, assignedAgent: agent },
      { onSuccess: (data) => report(data.results) },
    )
  }

  async function handleStatus(value: string) {
    const status = value as TicketStatus
    const confirmed = await confirm({
      title: t('bulk.statusConfirmTitle', { count: ticketIds.length, status: t(`statuses.${status}`) }),
      description: t('bulk.confirmDescription'),
      // Same "terminal state" signal TicketStatusControl already uses for
      // one ticket — closed has no further transitions, so this reserves
      // the destructive styling for the one status change that is
      // effectively irreversible from the list itself.
      destructive: status === 'closed',
    })
    if (!confirmed) return
    statusMutation.mutate({ ticketIds, status }, { onSuccess: (data) => report(data.results) })
  }

  async function handlePriority(value: string) {
    const priority = value as TicketPriority
    const confirmed = await confirm({
      title: t('bulk.priorityConfirmTitle', {
        count: ticketIds.length,
        priority: t(`priorities.${priority}`),
      }),
      description: t('bulk.confirmDescription'),
    })
    if (!confirmed) return
    priorityMutation.mutate({ ticketIds, priority }, { onSuccess: (data) => report(data.results) })
  }

  return (
    <SelectionActionBar count={selectedIds.size} onClear={onDone}>
      <Select onValueChange={(value) => void handleAssign(value)} disabled={isPending}>
        <SelectTrigger aria-label={t('bulk.assignLabel')} size="sm">
          <SelectValue placeholder={t('bulk.assignLabel')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>{t('fields.unassigned')}</SelectItem>
          {(agentsQuery.data ?? []).map((agent) => (
            <SelectItem key={agent.id} value={String(agent.id)}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(value) => void handleStatus(value)} disabled={isPending}>
        <SelectTrigger aria-label={t('bulk.statusLabel')} size="sm">
          <SelectValue placeholder={t('bulk.statusLabel')} />
        </SelectTrigger>
        <SelectContent>
          {TICKET_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`statuses.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(value) => void handlePriority(value)} disabled={isPending}>
        <SelectTrigger aria-label={t('bulk.priorityLabel')} size="sm">
          <SelectValue placeholder={t('bulk.priorityLabel')} />
        </SelectTrigger>
        <SelectContent>
          {TICKET_PRIORITIES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`priorities.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {lastFailures.length > 0 ? (
        <ul className="basis-full text-sm text-destructive">
          {lastFailures.map((row) => (
            <li key={row.id}>{t('bulk.failureDetail', { id: row.id, error: row.error })}</li>
          ))}
        </ul>
      ) : null}
    </SelectionActionBar>
  )
}
```

**Design note on the toast + inline list split:** `ToastProvider`'s container is `max-w-sm` (`frontend/src/shared/ui/toast/ToastProvider.tsx:61`) — a toast is the right place for the one-line headline ("6 of 8 tickets updated"), not for a per-ticket breakdown of *why* the other two failed. `lastFailures` renders that breakdown inline, under the bar's controls, and is replaced (not appended) by the next bulk action — it is a transient summary of the *last* action, not a running log (`TicketActivity`/`.history/` already owns the durable log).

Every `Select` here fires `onValueChange` with no prior "current value" (unlike `TicketAssigneeControl`/`TicketStatusControl`, which show the ticket's existing single value) — a bulk `Select` has no one current value to display across N possibly-different tickets, so it always renders its `placeholder` and resets to unselected after firing (Radix's own uncontrolled behaviour here, since no `value` prop is passed).

---

### 9 — Locale keys

**File: `frontend/src/shared/i18n/locales/en/common.json`** — extend the `table` block:

```json
    "selectAllOnPage": "Select all on this page",
    "selectRow": "Select row {{id}}",
    "selectedCount": "{{count}} selected",
    "selectedCount_other": "{{count}} selected",
    "clearSelection": "Clear selection"
```

**File: `frontend/src/shared/i18n/locales/ar/common.json`** — same keys, translated, following `rowCount`'s existing six-way Arabic plural precedent (`_zero`/`_one`/`_two`/`_few`/`_many`/`_other`) for `selectedCount`:

```json
    "selectAllOnPage": "تحديد الكل في هذه الصفحة",
    "selectRow": "تحديد الصف {{id}}",
    "selectedCount_zero": "لم يتم تحديد أي عنصر",
    "selectedCount_one": "تم تحديد عنصر واحد",
    "selectedCount_two": "تم تحديد عنصرين",
    "selectedCount_few": "تم تحديد {{count}} عناصر",
    "selectedCount_many": "تم تحديد {{count}} عنصرًا",
    "selectedCount_other": "تم تحديد {{count}} عنصر",
    "clearSelection": "إلغاء التحديد"
```

**File: `frontend/src/features/tickets/locales/en.json`** — new top-level `bulk` block, placed after `escalation` (after line 96):

```json
  "bulk": {
    "assignLabel": "Bulk assign",
    "statusLabel": "Bulk status",
    "priorityLabel": "Bulk priority",
    "assignConfirmTitle": "Assign {{count}} tickets to {{agent}}?",
    "statusConfirmTitle": "Change the status of {{count}} tickets to {{status}}?",
    "priorityConfirmTitle": "Change the priority of {{count}} tickets to {{priority}}?",
    "confirmDescription": "This applies to every ticket you selected. A row can still fail if the change isn't valid for its current state — you'll see a summary after.",
    "allSucceeded": "{{count}} tickets updated.",
    "allSucceeded_one": "1 ticket updated.",
    "partialSuccess": "{{okCount}} of {{total}} tickets updated.",
    "allFailed": "The update failed for all {{count}} selected tickets.",
    "failureDetail": "#{{id}}: {{error}}"
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "bulk": {
    "assignLabel": "تعيين جماعي",
    "statusLabel": "تغيير الحالة جماعيًا",
    "priorityLabel": "تغيير الأولوية جماعيًا",
    "assignConfirmTitle": "تعيين {{count}} تذكرة إلى {{agent}}؟",
    "statusConfirmTitle": "تغيير حالة {{count}} تذكرة إلى {{status}}؟",
    "priorityConfirmTitle": "تغيير أولوية {{count}} تذكرة إلى {{priority}}؟",
    "confirmDescription": "سينطبق هذا على كل تذكرة حددتها. قد يفشل تغيير أحد الصفوف إذا لم يكن التغيير صالحًا لحالته الحالية — سترى ملخصًا بعد التنفيذ.",
    "allSucceeded": "تم تحديث {{count}} تذكرة.",
    "allSucceeded_one": "تم تحديث تذكرة واحدة.",
    "partialSuccess": "تم تحديث {{okCount}} من أصل {{total}} تذكرة.",
    "allFailed": "فشل التحديث لجميع التذاكر المحددة ({{count}}).",
    "failureDetail": "‎#{{id}}: {{error}}"
  },
```

No `resources.ts` change — `tickets` and `common` are already registered namespaces.

---

## Documentation Tasks

### 10 — `CONVENTIONS.md` §19: the selection pattern

**File: `CONVENTIONS.md`** — append after the equality-filter paragraph (ends line 517), before the "Runtime branding" paragraph:

> **Bulk selection is an opt-in prop on `DataTable`, never a second table component.** `DataTableSelection<T>` (Story 106, `TKT-7`) adds a leading checkbox column — per-row plus select-all-on-page — only when a consumer passes `selection`; every other `DataTable` call site is unaffected, both at compile time (the prop is optional) and at runtime (no `selection` means no checkbox column is rendered at all). Selection is **page-scoped only**: it holds row keys for whatever page/sort/filter state produced them, and the owning page is responsible for clearing it on every sort, filter, or page change — `DataTable` itself never clears it, and never tries to reconcile a stale selection against a new result set. `TicketListPage` clears `selectedIds` in the same effect that already resets `page` to 1 on a filter change, plus in its `onSortChange`/`onPageChange` wrappers — always cleared, never silently carried across a result-set change that could no longer contain the same rows. **The bulk-action bar itself is not part of `DataTable`.** `SelectionActionBar` (`shared/ui/data-table/`) is a reusable, content-agnostic shell — a count, a clear button, a slot — and the buttons inside it are entirely feature-specific (`TicketBulkActionBar`, ticket-only today). This mirrors the same "shared mechanism, feature-specific content" split `ColumnDef`/`columns` already establish between `DataTable` and its callers.

### 11 — `CONVENTIONS.md` §23: the bulk-endpoint pattern

**File: `CONVENTIONS.md`** — append to the end of §23 (after the paragraph ending at line 1608, before the `---`/`## 24.` boundary):

> **A bulk endpoint reuses the single-item's validation/logging helper and reports one result per row — it never gets its own looser rule, and it never fails the whole request for one bad row.** `TicketViewSet.bulk_assign`/`bulk_status` (Story 106, `TKT-7`) call the exact same `apply_assignment`/`apply_status_change` functions `assign`/`set_status` call — a bulk caller and a single-ticket caller can never drift, because there is only one function that decides whether a change is legal and only one call site that writes a `TicketActivity` row. `apps/tickets/bulk.py::parse_ticket_ids` validates the REQUEST's shape up front (empty/malformed/oversized `ticket_ids` is one 400), but a per-ticket problem — not found, an illegal transition for that ticket's current state, ... — is caught per iteration and turned into `{"id", "ok": False, "error"}`, never an exception that aborts the rows after it. **A field with no single-ticket action gets no bulk-only escalation, either.** `bulk_priority` writes no `TicketActivity` row and rejects no no-op, because the single-ticket priority edit (a plain writable serializer field, not an action) does neither — a bulk endpoint's job is to apply the SAME rule N times, not to invent a stricter one because it now touches more rows at once.

---

## Edge Cases & Failure Modes

- **Selecting rows, then changing sort, a filter, or the page — selection is cleared, not carried forward and not silently applied to the wrong rows.** This is a deliberate simplification of the intake's "survive... or be cleared explicitly, never left silently stale": surviving a filter change would require tracking selected ids that may no longer even match the query, or deciding what "survive" means when a selected id scrolls off the new result set entirely. Clearing is unambiguous, always correct, and documented at every clearing site (`## Product rules`, Frontend Task 7).
- **"Select all on this page" only ever selects the current page's rows** (`page_size`, default 25, capped at 100 — `backend/apps/core/pagination.py`). There is no "select all N results across every page" — the intake's own literal wording is "select-all-on-page." A queue with 400 open tickets needs multiple bulk passes, one page at a time; this is a named non-goal, not an oversight (see `## Story Goal`).
- **A bulk status change where some selected tickets can legally make the transition and others cannot** (different current statuses, or the target status equals a ticket's current status) — each ticket's row in the response reports its own `ok`/`error` independently; the UI's toast/inline list reflects exactly that split. No row's failure affects any other row's outcome, verified by `bulk_status` catching `ValidationError` per iteration rather than per request.
- **A `ticket_id` that does not exist, or existed when the page loaded but was deleted before the bulk request was sent** — reported as `{"id": ..., "ok": False, "error": "Ticket not found."}`, the same as any other per-row failure; the request as a whole still returns `200`.
- **Duplicate ids inside one `ticket_ids` list.** `fetch_tickets` returns one ticket object per unique id, so both occurrences of a duplicate id share the SAME in-memory `Ticket` instance across the loop. For `bulk_assign`/`bulk_priority` this is harmless (both occurrences apply the identical change, both report `ok: true`). For `bulk_status` the SECOND occurrence sees the already-mutated in-memory object and fails as a no-op ("Ticket is already in this status") — a real, if minor, asymmetry, accepted because the frontend's `selectedIds` is a `Set` and can never itself produce a duplicate id in the request body; only a hand-crafted request could trigger this.
- **An empty selection** — `TicketBulkActionBar` renders nothing (`SelectionActionBar` returns `null` at `count === 0`), and the three mutations are never callable with an empty `ticketIds` array from the UI. A hand-crafted request with `ticket_ids: []` is rejected as a whole-request `400` by `parse_ticket_ids` (empty is explicitly disallowed, not treated as a no-op success).
- **A very large selection** (only reachable via a hand-crafted request, since the UI caps at one page) — `parse_ticket_ids` rejects anything over `MAX_BULK_IDS` (200) with a single `400`, before any ticket is fetched or changed.
- **Permission denial** — uniform, not per-row: `tickets.manage` gates the whole bulk action via `permission_map`, the same as every existing mutation action on this viewset. There is no per-ticket permission variance in this app's authorization model (`permissions_for` resolves role-held permissions globally, not per object — `backend/apps/core/permissions.py:56-71`), so "apply per-ticket permission... to every row" (intake) is satisfied by gating the action once with the same permission the single-ticket action already requires, not by re-checking per row.
- **Keyboard accessibility of the new checkboxes** — the `Checkbox` primitive (Radix) is natively focusable and toggles on Space with no extra wiring; the header checkbox and every row checkbox carry an explicit `aria-label` (`table.selectAllOnPage` / `table.selectRow`) since neither has visible text. Verified manually at `## Verification Steps` — no automated a11y tooling exists in this project (§16).
- **RTL correctness** — the checkbox column is simply the first entry in the `<TableRow>`'s children array; the browser's own table layout under `dir="rtl"` places it at the visual trailing (right) edge with no direction-specific code, the same way every other `DataTable` column already handles direction. `SelectionActionBar`'s "Clear" button uses `ms-auto` (logical), not a physical `ml-auto`/`mr-auto`.
- **A bulk mutation's own 400 (malformed `ticket_ids`, a non-assignable agent, an unrecognised status/priority)** — this is a whole-request failure, not a per-row one, and is surfaced by the SAME shared mutation-error toast every other mutation in this app already uses (CONVENTIONS.md §21) — `TicketBulkActionBar` does not build its own toast for this case, only for the `200`-with-partial-failure case, which the shared handler cannot see (it never throws).
- **Concurrent edits** — no optimistic locking anywhere in this project (the same accepted limitation every prior `ticket-management` story documents for single-ticket writes); a bulk action's last write wins per ticket, exactly like a single-ticket one.
- **Arabic plural forms for `table.selectedCount`** — must follow the same six-way CLDR set `table.rowCount` already uses in `ar/common.json` (`_zero/_one/_two/_few/_many/_other`), not a bare `{{count}} محدد` that reads wrong at `count === 1` or `count === 2`.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16 — *"Changes are verified by running the commands in README.md and driving the app directly."*). No test file is added, modified, or removed anywhere in this story.

1. `python manage.py check` and `python manage.py test` — the existing backend suite must still pass, same count before and after.
2. `python manage.py makemigrations --check --dry-run` — must report no changes (no model/field is added by this story).
3. `ruff format --check .` / `ruff check .` over `apps/tickets/status.py`, `apps/tickets/bulk.py`, `apps/tickets/views.py`.
4. Real HTTP: all three bulk endpoints' happy paths, their per-row partial-failure behaviour (mixed valid/invalid ids and states in one request), their whole-request `400`s (malformed `ticket_ids`, invalid target value), and permission gating (`403`/`401`) — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new `DataTable` selection prop, `SelectionActionBar`, and `TicketBulkActionBar`.
6. An `en`/`ar` key-set comparison for `shared/i18n/locales/{en,ar}/common.json` and `features/tickets/locales/{en,ar}.json` (a throwaway script, not a checked-in test, matching every prior story's step).
7. A bilingual browser walkthrough of `/tickets` with selection, all three bulk actions, and the confirm/toast/failure-list UI, in both English and Arabic — `## Verification Steps`.

---

## Migration / Rollback

**No migration.** No model or field changes anywhere in this story — `python manage.py makemigrations --check --dry-run` must report no changes both before and after.

**Rollback is `git revert` of the commit(s).** Nothing persisted by this story is stored anywhere except `TicketActivity` rows created by ordinary use of the (unchanged) assignment/status-change logic — a revert removes the new endpoints and UI; any `TicketActivity` rows already written by real bulk usage remain, exactly as reverting Story 22/23 would leave existing single-ticket activity rows in place.

**Half-applied states to avoid:**

- **`permission_map` missing one of the three new entries** (`bulk_assign`/`bulk_status`/`bulk_priority`). Does **not** deny — falls through to authenticated-only, so any signed-in user (including one holding only `customers.view`) could bulk-mutate tickets. The single highest-risk mistake in this story; `## Verification Steps` checks all three explicitly.
- **`set_status`'s refactor accidentally changing its error messages or its `TicketActivity` write.** `apply_status_change` must raise the byte-identical messages the old inline code raised (verification compares them) and must still write exactly one `TicketActivity` row per real transition — a silent behaviour change here would also silently change `bulk_status`, since both now share the one function.
- **`bulk_priority` gaining a `TicketActivity` write or a no-op rejection that the single-ticket priority edit does not have.** Would make bulk priority *stricter* than editing a ticket's priority through the normal form — the opposite of "as safe and auditable as individual" (intake); the single-ticket behaviour is the baseline both must match, not a floor bulk is free to raise unilaterally.
- **`DataTable`'s `colSpan` calculations left at `columns.length`** instead of `columns.length + (selection ? 1 : 0)` after adding the checkbox column — the empty-state and error-state rows would render one column short, visibly misaligned under the new leading `<TableHead>`, on every one of `DataTable`'s 23 existing consumers, not just tickets, if the change is made carelessly.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration produced:** `python manage.py makemigrations --check --dry-run` exits 0 with no output, before and after this story's changes.
3. **Backend regression:** `python manage.py test` passes with the same count as before this story.
4. **`set_status`'s refactor is behaviour-preserving.** Re-run Story 23's own status-transition verification (every legal transition in sequence, every illegal transition including the no-op and closed-terminal cases) against the now-refactored `set_status` — same requests, same responses, same `TicketActivity` rows as before this story.
5. **Bulk assign.** Create three tickets. With a `tickets.manage` token: `POST /api/tickets/bulk-assign/` `{"ticket_ids": [t1, t2, t3], "assigned_agent": <agent id>}` → `200`, `results` has three `{"ok": true}` rows; `GET` each ticket confirms `assigned_agent`/`assigned_agent_name`, and `GET /api/tickets/<id>/history/` on each shows one new `assigned` activity row. Re-run the identical request → still three `ok: true` (assigning to the same agent is a no-op for `apply_assignment` but not a per-row failure). Include one non-existent id in the list → that row alone is `{"ok": false, "error": "Ticket not found."}`, the other two still succeed.
6. **Bulk status, mixed outcomes in one request.** Two tickets at `open`, one at `closed`. `POST /api/tickets/bulk-status/` `{"ticket_ids": [...], "status": "in_progress"}` → the two `open` tickets succeed (`ok: true`, one new `status_changed` activity row each), the `closed` ticket fails (`ok: false`, an error naming the illegal transition) — all in the SAME response, `200` overall.
7. **Bulk priority.** `POST /api/tickets/bulk-priority/` `{"ticket_ids": [...], "priority": "urgent"}` → all rows `ok: true`; confirm via `GET .../history/` that **no** new activity row was created for any of them (priority is unlogged, matching the single-ticket edit — see `## Edge Cases`).
8. **Whole-request `400`s.** `{"ticket_ids": []}` → `400` naming `ticket_ids`. `{"ticket_ids": ["abc"]}` → `400`. Omit `assigned_agent`/`status`/`priority` entirely on each endpoint → `400` naming that field. `{"status": "not_a_status", "ticket_ids": [t1]}` → `400`. `{"ticket_ids": [<201 ids>], "status": "open"}` (over `MAX_BULK_IDS`) → `400`.
9. **Permission gating.** With a `customers.view`-only token (the throwaway-role technique every prior `ticket-management` story's verification uses): all three bulk endpoints with a valid body → `403`. With no token → `401` on all three.
10. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as a `tickets.manage` user:
    - `/tickets` — a leading checkbox column appears in each row and the header; selecting two or three rows reveals the bulk-action bar with its selected count.
    - Changing the search, any filter, the sort, or the page — in each case, the bar disappears (selection cleared) and the checkboxes are all unchecked again.
    - Bulk-assign to an agent — a confirm dialog names the count and the agent; confirming shows a success toast and the list (after refetch) reflects the new assignee for every selected row.
    - Bulk status to a terminal status (`closed`) on a mixed selection where at least one row cannot legally transition — the confirm dialog renders with **destructive** styling; confirming shows a **partial-failure** toast, and the inline failure list under the bar names the failing ticket id and the exact rejection reason.
    - Bulk priority — same immediate-mutation shape, all rows succeed, toast reads "N tickets updated."
    - Sign in as a user with `tickets.view` but **not** `tickets.manage` — `/tickets` shows **no** checkbox column and **no** bulk bar at all.
    - Switch to Arabic — every label, confirm dialog, and toast translates; the checkbox column renders at the visual right edge; `selectedCount` reads correct Arabic plural forms at 1, 2, 3, and 11 selected rows.
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Every other `DataTable` consumer is visually and behaviourally unchanged.** Spot-check two or three of the other 22 consumers (e.g. `CustomerListPage`, `UserListPage`) — no checkbox column, no layout shift, `colSpan` still correct on their own empty/error states.
13. **Clean up** every ticket, customer, and any throwaway role/user created during verification.

---

## Done Criteria

- [ ] `apps/tickets/status.py::apply_status_change` extracted, raising the same messages the old inline `set_status` logic raised, logging the same `TicketActivity` row; `TicketViewSet.set_status` refactored to call it — verified behaviour-identical (Verification Step 4).
- [ ] `apps/tickets/bulk.py` — `MAX_BULK_IDS`, `parse_ticket_ids`, `fetch_tickets`, `first_error_message`.
- [ ] `TicketViewSet.bulk_assign`/`bulk_status`/`bulk_priority` (`detail=False`, `POST`) — each returns `{"results": [...]}`, one row per requested id, never raising for a per-row problem; `permission_map` gains all three keyed to `TICKETS_MANAGE`.
- [ ] `bulk_assign` reuses `apply_assignment`; `bulk_status` reuses `apply_status_change`; `bulk_priority` writes the plain field with no no-op check and no `TicketActivity` row, matching the single-ticket priority edit's own (lack of) behaviour.
- [ ] **No migration, no new permission constant, no `apps/tickets/urls.py` change.**
- [ ] `DataTableSelection<T>` (`shared/ui/data-table/types.ts`) and the optional `selection` prop on `DataTable` — checkbox column in the header (select-all-on-page, indeterminate state) and every row, `colSpan` widened on the loading/error/empty branches; every existing `DataTable` consumer unaffected (Verification Step 12).
- [ ] `SelectionActionBar` (`shared/ui/data-table/`) — a reusable, content-agnostic bar shell, renders nothing at `count === 0`.
- [ ] `types/bulkActionResult.ts`, `api/bulkAssignTickets.ts`/`bulkSetTicketStatus.ts`/`bulkSetTicketPriority.ts`, and `useBulkAssignTickets`/`useBulkSetTicketStatus`/`useBulkSetTicketPriority` in `useTicketMutations.ts` (prefix-wide invalidation).
- [ ] `TicketBulkActionBar.tsx` — three `Select`s, each gated by `useConfirm()` before firing (`destructive: true` only for bulk-status → `closed`), a result toast distinguishing all-succeeded/partial/all-failed, and an inline per-row failure list for the last action.
- [ ] `TicketListPage.tsx` — `selectedIds` state, cleared in the existing filter-reset effect and in wrapped `onSortChange`/`onPageChange` handlers; `selection` passed to `DataTable` only when `can('tickets.manage')`.
- [ ] `shared/i18n/locales/{en,ar}/common.json` — `table.selectAllOnPage`, `table.selectRow`, `table.selectedCount` (full Arabic CLDR plural set), `table.clearSelection`.
- [ ] `features/tickets/locales/{en,ar}.json` — the new `bulk` block; identical key sets in both languages.
- [ ] `CONVENTIONS.md` §19 gains the bulk-selection paragraph; §23 gains the bulk-endpoint-reuses-the-single-item-helper paragraph.
- [ ] `python manage.py test` passes at the same count as before this story; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: all three bulk endpoints' happy paths (Step 5-7); mixed-outcome per-row results in one request (Step 6); whole-request `400`s including the `MAX_BULK_IDS` ceiling (Step 8); `403`/`401` permission gating on all three (Step 9).
- [ ] Both languages walk through cleanly in the browser, including the destructive-confirm styling, the partial-failure toast + inline list, and the `tickets.view`-only "no checkboxes, no bar at all" variant (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every other `DataTable` consumer spot-checked unchanged (Step 12).
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 13).
- [ ] `.squad/plans/ticket-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to the next story.**
