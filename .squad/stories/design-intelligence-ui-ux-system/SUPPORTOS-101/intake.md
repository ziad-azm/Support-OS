> **Fetched from jira:** [SUPPORTOS-101](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-101)  
> *Fetched 2026-08-30T14:46:44.624Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-10) — Forms & Data-Entry UX Remediation  
**Type:** Story  
**Status:** To Do

### Description

As a user filling in forms, I want clear, forgiving, consistent data entry, so that I always know what's expected and how to fix mistakes. Description: Fixes the register's form findings at the FORM foundation so every form inherits the improvement — validation timing (on-blur/submit, not aggressive on-change), readable localized error messaging, error summary + focus-to-first-error, logical field grouping/order, autofocus, and clear submit/loading/disabled states. Dependencies: FORM-1, DSN-6.

	Task: Improve validation & error UX in the shared form foundation 🔑 (all forms inherit) — Implement: standardize validation trigger timing, localized (via I18N) inline messages, an error-summary + focus-first-error behavior, and consistent submit/pending/disabled states in the shared RHF+Zod field components. Constraints: change FORM shared components only; no per-feature validation. Outcome: every form in the app gets consistent, forgiving data-entry UX from one change.

	Task: Field grouping, order & focus review — Implement: apply the register's per-form layout/order/autofocus fixes using shared field components. Constraints: composition-level, no bespoke fields. Outcome: forms read logically and are keyboard-friendly.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-101/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-101` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-10) — Forms & Data-Entry UX Remediation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user filling in forms, I want clear, forgiving, consistent data entry, so that I always know what's expected and how to fix mistakes. Description: Fixes the register's form findings at the FORM foundation so every form inherits the improvement — validation timing (on-blur/submit, not aggressive on-change), readable localized error messaging, error summary + focus-to-first-error, logical field grouping/order, autofocus, and clear submit/loading/disabled states. Dependencies: FORM-1, DSN-6.

	Task: Improve validation & error UX in the shared form foundation 🔑 (all forms inherit) — Implement: standardize validation trigger timing, localized (via I18N) inline messages, an error-summary + focus-first-error behavior, and consistent submit/pending/disabled states in the shared RHF+Zod field components. Constraints: change FORM shared components only; no per-feature validation. Outcome: every form in the app gets consistent, forgiving data-entry UX from one change.

	Task: Field grouping, order & focus review — Implement: apply the register's per-form layout/order/autofocus fixes using shared field components. Constraints: composition-level, no bespoke fields. Outcome: forms read logically and are keyboard-friendly.
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
