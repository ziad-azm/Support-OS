> **Fetched from jira:** [SUPPORTOS-55](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-55)  
> *Fetched 2026-08-26T20:08:05.706Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (PORTAL-0) — Portal Access & Customer Auth  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Task: Customer auth + scoped access 🔑 — Implement customer login and a scoping rule limiting portal data to the logged-in customer (reuse AUTHZ). Outcome: secure customer boundary reused by all portal stories.

	Task: Portal shell UI 🔑 — Implement portal layout (bilingual/RTL, responsive) reusing UI/I18N. Outcome: portal frame for all portal features.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-portal/SUPPORTOS-55/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `customer-portal`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-55` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(PORTAL-0) — Portal Access & Customer Auth
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Task: Customer auth + scoped access 🔑 — Implement customer login and a scoping rule limiting portal data to the logged-in customer (reuse AUTHZ). Outcome: secure customer boundary reused by all portal stories.

	Task: Portal shell UI 🔑 — Implement portal layout (bilingual/RTL, responsive) reusing UI/I18N. Outcome: portal frame for all portal features.
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
