> **Fetched from jira:** [SUPPORTOS-100](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-100)  
> *Fetched 2026-08-30T14:46:09.766Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-9) — Responsive & Mobile UX Remediation  
**Type:** Story  
**Status:** To Do

### Description

As a user on a phone or tablet, I want every screen to be fully usable, so that the "responsive" requirement holds in practice, not just in theory. Description: Fixes the register's responsive findings across all built routes at mobile/tablet breakpoints — sidebar collapse behavior (from DSN-5), dense tables that need a card/stacked view on small screens, touch-target sizing, and overflow/scroll issues, in both LTR and RTL. Dependencies: DSN-5 (shell), DSN-6.

	Task: Add responsive behavior to the shared table & layout patterns — Implement: give the shared DataTable/list pattern a small-screen presentation (stacked/card or prioritized columns) and fix page-shell overflow at each breakpoint. Constraints: shared-pattern level so all lists inherit it; verify RTL. Outcome: list-heavy screens work on mobile everywhere at once.

	Task: Per-screen responsive fixes & touch targets — Implement: resolve remaining register responsive items (forms, side panels, dialogs, chart placeholders) and enforce minimum touch-target sizing via shared primitives. Constraints: styling/layout only. Outcome: no broken or cramped screen on mobile/tablet.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-100/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-100` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-9) — Responsive & Mobile UX Remediation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user on a phone or tablet, I want every screen to be fully usable, so that the "responsive" requirement holds in practice, not just in theory. Description: Fixes the register's responsive findings across all built routes at mobile/tablet breakpoints — sidebar collapse behavior (from DSN-5), dense tables that need a card/stacked view on small screens, touch-target sizing, and overflow/scroll issues, in both LTR and RTL. Dependencies: DSN-5 (shell), DSN-6.

	Task: Add responsive behavior to the shared table & layout patterns — Implement: give the shared DataTable/list pattern a small-screen presentation (stacked/card or prioritized columns) and fix page-shell overflow at each breakpoint. Constraints: shared-pattern level so all lists inherit it; verify RTL. Outcome: list-heavy screens work on mobile everywhere at once.

	Task: Per-screen responsive fixes & touch targets — Implement: resolve remaining register responsive items (forms, side panels, dialogs, chart placeholders) and enforce minimum touch-target sizing via shared primitives. Constraints: styling/layout only. Outcome: no broken or cramped screen on mobile/tablet.
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
