> **Fetched from jira:** [SUPPORTOS-130](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-130)  
> *Fetched 2026-09-11T18:52:47.987Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (TKT-7) — Bulk Ticket Actions  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As an agent, I want to act on many tickets at once, so that clearing a queue is not one ticket at a time. Description: Verified gap: the ticket list has no row selection at all, so assigning ten tickets to a colleague, closing a batch of resolved duplicates, or re-prioritising after an incident is ten separate round-trips through the detail screen. This is the most repeated manual action in day-to-day queue work. Dependencies: TKT-3, TKT-4, DSN-7.

	Task: Row selection in the shared table pattern 🔑 (reusable by every list screen) — Add optional multi-select (per-row plus select-all-on-page) and a contextual bulk-action bar to the shared DataTable, opt-in per screen. Constraints: shared-component level so other lists inherit it; keyboard-accessible and RTL-correct per I18N/DSN; selection state must survive sort/filter changes predictably or be cleared explicitly, never left silently stale. Outcome: a reusable selection pattern, adopted first by tickets.

	Task: Bulk assign / status / priority endpoints — Implement bulk operations that apply per-ticket permission and TKT-4 transition validation to every row, returning a per-row result rather than failing the whole batch on one invalid item. Constraints: reuse AUTHZ and the existing single-ticket transition rules — no bypass path; every change writes to TKT-5's activity log exactly as the single-ticket action does. Outcome: batch changes as safe and auditable as individual ones.

	Task: Bulk-action UI with partial-failure reporting — Wire the action bar to the endpoints, with a confirm step for destructive actions (shared confirm dialog) and a clear summary when some rows succeed and others do not. Constraints: reuse UI toast/confirm primitives. Outcome: agents clear queues quickly and always know exactly what changed.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-management/SUPPORTOS-130/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-130` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(TKT-7) — Bulk Ticket Actions
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent, I want to act on many tickets at once, so that clearing a queue is not one ticket at a time. Description: Verified gap: the ticket list has no row selection at all, so assigning ten tickets to a colleague, closing a batch of resolved duplicates, or re-prioritising after an incident is ten separate round-trips through the detail screen. This is the most repeated manual action in day-to-day queue work. Dependencies: TKT-3, TKT-4, DSN-7.

	Task: Row selection in the shared table pattern 🔑 (reusable by every list screen) — Add optional multi-select (per-row plus select-all-on-page) and a contextual bulk-action bar to the shared DataTable, opt-in per screen. Constraints: shared-component level so other lists inherit it; keyboard-accessible and RTL-correct per I18N/DSN; selection state must survive sort/filter changes predictably or be cleared explicitly, never left silently stale. Outcome: a reusable selection pattern, adopted first by tickets.

	Task: Bulk assign / status / priority endpoints — Implement bulk operations that apply per-ticket permission and TKT-4 transition validation to every row, returning a per-row result rather than failing the whole batch on one invalid item. Constraints: reuse AUTHZ and the existing single-ticket transition rules — no bypass path; every change writes to TKT-5's activity log exactly as the single-ticket action does. Outcome: batch changes as safe and auditable as individual ones.

	Task: Bulk-action UI with partial-failure reporting — Wire the action bar to the endpoints, with a confirm step for destructive actions (shared confirm dialog) and a clear summary when some rows succeed and others do not. Constraints: reuse UI toast/confirm primitives. Outcome: agents clear queues quickly and always know exactly what changed.
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
