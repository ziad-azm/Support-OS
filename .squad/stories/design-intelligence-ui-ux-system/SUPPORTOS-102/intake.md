> **Fetched from jira:** [SUPPORTOS-102](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-102)  
> *Fetched 2026-08-30T14:46:54.058Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-11) — Navigation & Information Architecture Review  
**Type:** Story  
**Status:** To Do

### Description

As a user, I want to always know where I am and how to get where I'm going, so that finding features and moving between them is effortless. Description: Fixes the register's IA findings — nav grouping/labels and active-state clarity (on the DSN-5 sidebar), consistent page titles/breadcrumbs, discoverability of admin/config areas, and sane back/deep-link behavior. Preserves every existing permission-gated route exactly. Dependencies: DSN-5, DSN-6.

	Task: Refine navigation structure & wayfinding — Implement: group/label sidebar items and make active/current state unambiguous; add consistent page titles/breadcrumbs via the shared shell. Constraints: presentation only — routes and Can-gates unchanged. Outcome: clear, learnable navigation.

	Task: Fix IA discoverability & back/deep-link behavior — Implement: resolve register items on hard-to-find admin/config surfaces and inconsistent back/deep-link handling. Constraints: no route logic changes. Outcome: features are discoverable and navigation is predictable.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-102/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-102` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-11) — Navigation & Information Architecture Review
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want to always know where I am and how to get where I'm going, so that finding features and moving between them is effortless. Description: Fixes the register's IA findings — nav grouping/labels and active-state clarity (on the DSN-5 sidebar), consistent page titles/breadcrumbs, discoverability of admin/config areas, and sane back/deep-link behavior. Preserves every existing permission-gated route exactly. Dependencies: DSN-5, DSN-6.

	Task: Refine navigation structure & wayfinding — Implement: group/label sidebar items and make active/current state unambiguous; add consistent page titles/breadcrumbs via the shared shell. Constraints: presentation only — routes and Can-gates unchanged. Outcome: clear, learnable navigation.

	Task: Fix IA discoverability & back/deep-link behavior — Implement: resolve register items on hard-to-find admin/config surfaces and inconsistent back/deep-link handling. Constraints: no route logic changes. Outcome: features are discoverable and navigation is predictable.
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
