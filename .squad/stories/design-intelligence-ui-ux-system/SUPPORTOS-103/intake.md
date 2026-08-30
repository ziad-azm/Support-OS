> **Fetched from jira:** [SUPPORTOS-103](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-103)  
> *Fetched 2026-08-30T14:47:08.492Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-12) — Microcopy & Bilingual (AR/EN) Quality Review  
**Type:** Story  
**Status:** To Do

### Description

As an Arabic or English user, I want labels, empty states, and error messages that read naturally and mirror correctly, so that the product feels professionally localized, not machine-translated. Description: Fixes the register's content and bilingual findings — inconsistent terminology/tone, weak empty-state and error copy, and Arabic/English parity + RTL mirroring gaps. A professional bilingual pass over the I18N strings; complements DSN-2's structural RTL checklist by focusing on language quality and parity. Dependencies: I18N-1, DSN-6.

	Task: Terminology, tone & empty/error copy pass — Implement: standardize terminology and improve empty-state/error/confirmation copy in the I18N namespaces (both languages). Constraints: edit translation resources only; no hardcoded strings introduced. Outcome: consistent, helpful microcopy everywhere.

	Task: Arabic/English parity & RTL correctness review — Implement: verify every key exists and reads naturally in both languages and that AR mirrors correctly (icons, directionality, number/date rendering) per I18N; fix gaps. Constraints: content/direction only. Outcome: true bilingual parity, professionally localized.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-103/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-103` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-12) — Microcopy & Bilingual (AR/EN) Quality Review
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an Arabic or English user, I want labels, empty states, and error messages that read naturally and mirror correctly, so that the product feels professionally localized, not machine-translated. Description: Fixes the register's content and bilingual findings — inconsistent terminology/tone, weak empty-state and error copy, and Arabic/English parity + RTL mirroring gaps. A professional bilingual pass over the I18N strings; complements DSN-2's structural RTL checklist by focusing on language quality and parity. Dependencies: I18N-1, DSN-6.

	Task: Terminology, tone & empty/error copy pass — Implement: standardize terminology and improve empty-state/error/confirmation copy in the I18N namespaces (both languages). Constraints: edit translation resources only; no hardcoded strings introduced. Outcome: consistent, helpful microcopy everywhere.

	Task: Arabic/English parity & RTL correctness review — Implement: verify every key exists and reads naturally in both languages and that AR mirrors correctly (icons, directionality, number/date rendering) per I18N; fix gaps. Constraints: content/direction only. Outcome: true bilingual parity, professionally localized.
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
