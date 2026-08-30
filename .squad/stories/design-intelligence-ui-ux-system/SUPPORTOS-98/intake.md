> **Fetched from jira:** [SUPPORTOS-98](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-98)  
> *Fetched 2026-08-30T14:45:53.011Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-7) — Cross-Feature Consistency Remediation  
**Type:** Story  
**Status:** To Do

### Description

As a user, I want every screen to behave and read the same way, so that patterns I learn in one feature carry everywhere. Description: Fixes the register's consistency findings — divergent patterns that crept in as features were built independently (button order/placement, primary-action naming, page-header structure, modal-vs-inline choices, table column/date conventions, badge usage). Fixes land in shared components so consistency is structural, not per-screen. Dependencies: DSN-6.

	Task: Standardize page & action patterns at the shared level — Implement: from the register's consistency items, converge page-header layout, primary/secondary button order & placement, and action naming onto one pattern via the shared layout/primitive components; align date/number display on the I18N formatters. Constraints: change shared components, not individual screens; update register entries to resolved. Outcome: one consistent interaction vocabulary app-wide.

	Task: Consolidate divergent UI patterns — Implement: replace any one-off tables/dialogs/dropdowns that bypassed the UI primitives with the shared ones flagged in the register. Constraints: reuse-first, no new variants unless the register proves a real gap. Outcome: no duplicated UI patterns remain.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-98/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-98` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-7) — Cross-Feature Consistency Remediation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want every screen to behave and read the same way, so that patterns I learn in one feature carry everywhere. Description: Fixes the register's consistency findings — divergent patterns that crept in as features were built independently (button order/placement, primary-action naming, page-header structure, modal-vs-inline choices, table column/date conventions, badge usage). Fixes land in shared components so consistency is structural, not per-screen. Dependencies: DSN-6.

	Task: Standardize page & action patterns at the shared level — Implement: from the register's consistency items, converge page-header layout, primary/secondary button order & placement, and action naming onto one pattern via the shared layout/primitive components; align date/number display on the I18N formatters. Constraints: change shared components, not individual screens; update register entries to resolved. Outcome: one consistent interaction vocabulary app-wide.

	Task: Consolidate divergent UI patterns — Implement: replace any one-off tables/dialogs/dropdowns that bypassed the UI primitives with the shared ones flagged in the register. Constraints: reuse-first, no new variants unless the register proves a real gap. Outcome: no duplicated UI patterns remain.
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
