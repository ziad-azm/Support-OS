> **Fetched from jira:** [SUPPORTOS-97](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-97)  
> *Fetched 2026-08-30T14:45:45.196Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-6) — Full UI/UX Audit & Issue Register  
**Type:** Story  
**Status:** To Do

### Description

As a product team, we want one professional audit of the entire built UI, so that inconsistencies and usability issues are found and prioritized once, and every fix traces back to a recorded finding. Description: A single systematic review of every already-built route (EPICs 0–11) through ui-ux-pro-max plus a Nielsen heuristic pass, cataloguing what's inconsistent or hard to use. This is the "identify" half — it produces the register the remediation stories act on, so the app is never re-scanned from scratch. Dependencies: DSN-0, DSN-4, DSN-5 (audit reflects the current refreshed UI).

	Task: Produce the prioritized UX issue register 🔑 (consumed by DSN-7–DSN-13) — Implement: walk every built route via ui-ux-pro-max + a heuristic checklist (consistency, feedback, error prevention, recognition-over-recall, minimalism, match to real workflow); record each finding in design-system/supportos/UX-AUDIT.md with a stable ID, screen, category (consistency / interaction / responsive / form / IA / content / bilingual), severity (critical/major/minor), and recommended fix + owning DSN story. Constraints: catalogue only — no code changes here beyond trivially obvious one-liners; reference DSN/UI/I18N, don't restate them. Outcome: one authoritative, ID'd issue register that all remediation references.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-97/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-97` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-6) — Full UI/UX Audit & Issue Register
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a product team, we want one professional audit of the entire built UI, so that inconsistencies and usability issues are found and prioritized once, and every fix traces back to a recorded finding. Description: A single systematic review of every already-built route (EPICs 0–11) through ui-ux-pro-max plus a Nielsen heuristic pass, cataloguing what's inconsistent or hard to use. This is the "identify" half — it produces the register the remediation stories act on, so the app is never re-scanned from scratch. Dependencies: DSN-0, DSN-4, DSN-5 (audit reflects the current refreshed UI).

	Task: Produce the prioritized UX issue register 🔑 (consumed by DSN-7–DSN-13) — Implement: walk every built route via ui-ux-pro-max + a heuristic checklist (consistency, feedback, error prevention, recognition-over-recall, minimalism, match to real workflow); record each finding in design-system/supportos/UX-AUDIT.md with a stable ID, screen, category (consistency / interaction / responsive / form / IA / content / bilingual), severity (critical/major/minor), and recommended fix + owning DSN story. Constraints: catalogue only — no code changes here beyond trivially obvious one-liners; reference DSN/UI/I18N, don't restate them. Outcome: one authoritative, ID'd issue register that all remediation references.
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
