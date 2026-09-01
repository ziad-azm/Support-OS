> **Fetched from jira:** [SUPPORTOS-108](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-108)  
> *Fetched 2026-09-01T18:26:52.077Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SEC-6) — User Account Deletion  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

As an admin, I want to permanently delete a user account, so that stale or mistaken accounts don't linger indefinitely. Description: Moved here from the former Account Lifecycle & Credential Management epic (was ACCT-4) — it extends this epic's own SEC-1 screen directly. SEC-1 deliberately shipped deactivation-only for User — a hard DELETE would cascade onto agents.Task.owner and notifications.Notification.recipient (both on_delete=CASCADE), silently destroying unrelated data (see security-administration/48-story-users-roles-admin-SUPPORTOS-72.md's own verified finding). Verified against every FK to User in the codebase — Task.owner/Notification.recipient are the only two CASCADE relationships; every other reference (Customer.user, Note.author, Attachment.uploaded_by, Ticket.assigned_agent, TicketActivity.actor, InternalNote.author, AssignmentRule.last_assigned_agent, AuditLog.actor/target_user) is already SET_NULL and safe. This story completes the lifecycle by adding a safe delete path instead of leaving deactivation as the permanent ceiling. Dependencies: SEC-1.

	Task: Safe user-deletion backend flow — Implement a delete action on UserViewSet that first reassigns or nullifies the target's owned Task and Notification rows (or blocks the delete with a clear error while unhandled dependent records exist — a product decision to confirm before building), writes an audit-log entry via SEC-3's pattern recording the deletion and what happened to dependent data, then removes the User row. Constraints: reuse AUTHZ permissions, API envelope, SEC-3's audit-log pattern; must never silently cascade-delete a customer's own ticket/interaction history through any indirect FK. Outcome: a user can be permanently removed without silently destroying unrelated data.

	Task: Delete-user UI & confirmation — Implement a destructive "Delete" action on the Users admin screen (SEC-1) with a confirmation dialog (reusing the shared confirm pattern) that states plainly what happens to the user's owned tasks/notifications before the irreversible action proceeds. Outcome: admins remove accounts with an explicit, informed confirmation.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/security-administration/SUPPORTOS-108/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `security-administration`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-108` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SEC-6) — User Account Deletion
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an admin, I want to permanently delete a user account, so that stale or mistaken accounts don't linger indefinitely. Description: Moved here from the former Account Lifecycle & Credential Management epic (was ACCT-4) — it extends this epic's own SEC-1 screen directly. SEC-1 deliberately shipped deactivation-only for User — a hard DELETE would cascade onto agents.Task.owner and notifications.Notification.recipient (both on_delete=CASCADE), silently destroying unrelated data (see security-administration/48-story-users-roles-admin-SUPPORTOS-72.md's own verified finding). Verified against every FK to User in the codebase — Task.owner/Notification.recipient are the only two CASCADE relationships; every other reference (Customer.user, Note.author, Attachment.uploaded_by, Ticket.assigned_agent, TicketActivity.actor, InternalNote.author, AssignmentRule.last_assigned_agent, AuditLog.actor/target_user) is already SET_NULL and safe. This story completes the lifecycle by adding a safe delete path instead of leaving deactivation as the permanent ceiling. Dependencies: SEC-1.

	Task: Safe user-deletion backend flow — Implement a delete action on UserViewSet that first reassigns or nullifies the target's owned Task and Notification rows (or blocks the delete with a clear error while unhandled dependent records exist — a product decision to confirm before building), writes an audit-log entry via SEC-3's pattern recording the deletion and what happened to dependent data, then removes the User row. Constraints: reuse AUTHZ permissions, API envelope, SEC-3's audit-log pattern; must never silently cascade-delete a customer's own ticket/interaction history through any indirect FK. Outcome: a user can be permanently removed without silently destroying unrelated data.

	Task: Delete-user UI & confirmation — Implement a destructive "Delete" action on the Users admin screen (SEC-1) with a confirmation dialog (reusing the shared confirm pattern) that states plainly what happens to the user's owned tasks/notifications before the irreversible action proceeds. Outcome: admins remove accounts with an explicit, informed confirmation.
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
