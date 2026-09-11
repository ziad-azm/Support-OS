> **Fetched from jira:** [SUPPORTOS-131](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-131)  
> *Fetched 2026-09-11T19:55:17.052Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (TKT-8) — Saved Views & Filter Presets  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As an agent, I want to save a filter combination and return to it, so that my working queues are one click away. Description: Verified gap: TKT-2 shipped filters and ORG-4 defaults them to the caller's own department/branch, but nothing persists a combination. Every agent rebuilds "my open urgent tickets" or "unassigned in my branch" by hand each session, and there is no way to share a team queue definition. Dependencies: TKT-2, TKT-3, ORG-4.

	Task: SavedView model + API — Implement named, per-user saved filter/sort combinations with an optional shared/team flag, stored as the same query parameters the list already accepts. Constraints: store the filter payload, never a raw SQL fragment or a frozen result set; a shared view is readable by others but editable only by its owner or a manager, via AUTHZ. Outcome: filter combinations persist and can be shared.

	Task: Saved-view UI on the ticket list — Implement save/rename/delete plus a view switcher on the list screen, with the caller's default view applied on load. Constraints: reuse UI/FORM; a saved view is a starting point the agent can still change, never a lock — the same "default, not a boundary" rule ORG-4 established. Outcome: one-click access to personal and team queues.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-management/SUPPORTOS-131/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-131` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(TKT-8) — Saved Views & Filter Presets
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent, I want to save a filter combination and return to it, so that my working queues are one click away. Description: Verified gap: TKT-2 shipped filters and ORG-4 defaults them to the caller's own department/branch, but nothing persists a combination. Every agent rebuilds "my open urgent tickets" or "unassigned in my branch" by hand each session, and there is no way to share a team queue definition. Dependencies: TKT-2, TKT-3, ORG-4.

	Task: SavedView model + API — Implement named, per-user saved filter/sort combinations with an optional shared/team flag, stored as the same query parameters the list already accepts. Constraints: store the filter payload, never a raw SQL fragment or a frozen result set; a shared view is readable by others but editable only by its owner or a manager, via AUTHZ. Outcome: filter combinations persist and can be shared.

	Task: Saved-view UI on the ticket list — Implement save/rename/delete plus a view switcher on the list screen, with the caller's default view applied on load. Constraints: reuse UI/FORM; a saved view is a starting point the agent can still change, never a lock — the same "default, not a boundary" rule ORG-4 established. Outcome: one-click access to personal and team queues.
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
