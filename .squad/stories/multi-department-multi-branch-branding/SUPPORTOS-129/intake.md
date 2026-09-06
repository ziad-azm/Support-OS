> **Fetched from jira:** [SUPPORTOS-129](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-129)  
> *Fetched 2026-09-06T09:34:57.765Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:**  (ORG-4) — Ticket List Scoped to the Caller's Own Department/Branch  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As an agent, I want my Tickets and My Tickets lists to only show tickets in my own department and branch, so that I am not scrolling past other teams' or other locations' work to find mine. Description: ORG-1/ORG-2 built a real, reusable scoping mechanism (apps.core.scoping.ScopeFilter, CONVENTIONS.md §33) but only ever exposed it through two separate, single-dimension pages — DepartmentQueuePage/BranchQueuePage (frontend/src/features/tickets/components/), each sending exactly one of ?department=/?branch= and never both together, plus two sidebar links shown only when the caller has that one field set. An agent who holds both a department and a branch — the ordinary case for someone doing hands-on ticket work — has no view scoped to the intersection: "Department queue" shows every branch's tickets in their department, "Branch queue" shows every department's tickets in their branch, and neither combines. Measured against this project's own seed data: 12 tickets match the department alone, 17 match the branch alone, and only 6 match both — the two existing pages can only ever show the agent the wrong two numbers, never the right one. This story removes both pages and instead scopes the two lists every agent already uses — the plain TicketListPage and MyTicketsPage — automatically, reusing ScopeFilter's existing AND-composition (CONVENTIONS.md §33: "Multiple scopes compose with AND") rather than adding new filtering logic.

CONVENTIONS.md §33 draws a firm, deliberate line: apps.core.scoping scopes by what the caller asked for, opt-in, and "a ?department= filter is a convenience; it authorizes nothing." Applying it automatically, with no way for the agent to turn it off, is what this story asks for — and that functions as a real access restriction in practice, even though it is wired through the same "convenience" query-param mechanism. This story must not quietly blur that line: it should either (a) keep the existing ?department=/?branch= params available and unrestricted for anyone who still wants to pass them explicitly (e.g. a manager checking another team's queue), with only the default, no-params-supplied view changing to the caller's own scope, or (b) explicitly promote this to a real access boundary and say so — the implementer must pick one, not land in between by accident. Dependencies: ORG-1, ORG-2.

	Task: Decide, and document, who gets auto-scoped 🔑 (every other task depends on this answer) — Settle explicitly whether the new default applies to every staff role or only specific ones (an ordinary agent almost certainly should get it; whether manager/admin should too, given they plausibly need cross-department/branch oversight, is the open question). Record the decision and its reasoning in CONVENTIONS.md §33, the same way every other scoping decision already living there is documented. Outcome: a written, deliberate answer instead of an implicit one baked silently into a query param default.

	Task: Auto-scope TicketListPage and MyTicketsPage to the caller's own department/branch — For a caller this rule applies to (per the task above), the request these two pages already send via useTickets() includes department=<user.department.id> and/or branch=<user.branch.id> whenever the caller has that field set — reusing ScopeFilter's existing AND-composition, no new backend filtering code. Constraints: a caller with only a department set gets scoped by department alone; only a branch, by branch alone; both, by their intersection; neither, today's unscoped list — unchanged. Outcome: an agent with both set sees exactly the intersection count, not the department-only or branch-only count.

	Task: Remove the Department queue and Branch queue pages — Delete DepartmentQueuePage.tsx/BranchQueuePage.tsx, their tickets/department/tickets/branch routes (app/router.tsx), their two sidebar links (app/Sidebar.tsx), and the departmentQueue./branchQueue. locale keys ({{features/tickets/locales/
{en,ar}
.json}}). Constraints: confirm nothing else links to either route before deleting it. Outcome: no orphaned single-dimension queue screens once the two lists above make them redundant.

	Task: Confirm the assignment/routing side stays consistent — apps.sla.tasks.auto_assign_ticket and any assignment-rule logic already reason about an agent's department/branch when routing a new ticket to them. Confirm this story's list-side scoping does not silently diverge from that assignment-side logic — e.g. a ticket auto-assigned to an agent whose own department/branch no longer matches it, because either changed after assignment, must not become invisible to that agent on the very lists this story scopes. Constraints: read apps/sla/tasks.py/apps/sla/models.py before assuming a mismatch does or does not already exist — verify, do not guess. Outcome: a ticket assigned to an agent is never invisible to them.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/multi-department-multi-branch-branding/SUPPORTOS-129/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `multi-department-multi-branch-branding`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-129` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(ORG-4) — Ticket List Scoped to the Caller's Own Department/Branch
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent, I want my Tickets and My Tickets lists to only show tickets in my own department and branch, so that I am not scrolling past other teams' or other locations' work to find mine. Description: ORG-1/ORG-2 built a real, reusable scoping mechanism (apps.core.scoping.ScopeFilter, CONVENTIONS.md §33) but only ever exposed it through two separate, single-dimension pages — DepartmentQueuePage/BranchQueuePage (frontend/src/features/tickets/components/), each sending exactly one of ?department=/?branch= and never both together, plus two sidebar links shown only when the caller has that one field set. An agent who holds both a department and a branch — the ordinary case for someone doing hands-on ticket work — has no view scoped to the intersection: "Department queue" shows every branch's tickets in their department, "Branch queue" shows every department's tickets in their branch, and neither combines. Measured against this project's own seed data: 12 tickets match the department alone, 17 match the branch alone, and only 6 match both — the two existing pages can only ever show the agent the wrong two numbers, never the right one. This story removes both pages and instead scopes the two lists every agent already uses — the plain TicketListPage and MyTicketsPage — automatically, reusing ScopeFilter's existing AND-composition (CONVENTIONS.md §33: "Multiple scopes compose with AND") rather than adding new filtering logic.

CONVENTIONS.md §33 draws a firm, deliberate line: apps.core.scoping scopes by what the caller asked for, opt-in, and "a ?department= filter is a convenience; it authorizes nothing." Applying it automatically, with no way for the agent to turn it off, is what this story asks for — and that functions as a real access restriction in practice, even though it is wired through the same "convenience" query-param mechanism. This story must not quietly blur that line: it should either (a) keep the existing ?department=/?branch= params available and unrestricted for anyone who still wants to pass them explicitly (e.g. a manager checking another team's queue), with only the default, no-params-supplied view changing to the caller's own scope, or (b) explicitly promote this to a real access boundary and say so — the implementer must pick one, not land in between by accident. Dependencies: ORG-1, ORG-2.

	Task: Decide, and document, who gets auto-scoped 🔑 (every other task depends on this answer) — Settle explicitly whether the new default applies to every staff role or only specific ones (an ordinary agent almost certainly should get it; whether manager/admin should too, given they plausibly need cross-department/branch oversight, is the open question). Record the decision and its reasoning in CONVENTIONS.md §33, the same way every other scoping decision already living there is documented. Outcome: a written, deliberate answer instead of an implicit one baked silently into a query param default.

	Task: Auto-scope TicketListPage and MyTicketsPage to the caller's own department/branch — For a caller this rule applies to (per the task above), the request these two pages already send via useTickets() includes department=<user.department.id> and/or branch=<user.branch.id> whenever the caller has that field set — reusing ScopeFilter's existing AND-composition, no new backend filtering code. Constraints: a caller with only a department set gets scoped by department alone; only a branch, by branch alone; both, by their intersection; neither, today's unscoped list — unchanged. Outcome: an agent with both set sees exactly the intersection count, not the department-only or branch-only count.

	Task: Remove the Department queue and Branch queue pages — Delete DepartmentQueuePage.tsx/BranchQueuePage.tsx, their tickets/department/tickets/branch routes (app/router.tsx), their two sidebar links (app/Sidebar.tsx), and the departmentQueue./branchQueue. locale keys ({ {features/tickets/locales/
{en,ar}
.json}}). Constraints: confirm nothing else links to either route before deleting it. Outcome: no orphaned single-dimension queue screens once the two lists above make them redundant.

	Task: Confirm the assignment/routing side stays consistent — apps.sla.tasks.auto_assign_ticket and any assignment-rule logic already reason about an agent's department/branch when routing a new ticket to them. Confirm this story's list-side scoping does not silently diverge from that assignment-side logic — e.g. a ticket auto-assigned to an agent whose own department/branch no longer matches it, because either changed after assignment, must not become invisible to that agent on the very lists this story scopes. Constraints: read apps/sla/tasks.py/apps/sla/models.py before assuming a mismatch does or does not already exist — verify, do not guess. Outcome: a ticket assigned to an agent is never invisible to them.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
