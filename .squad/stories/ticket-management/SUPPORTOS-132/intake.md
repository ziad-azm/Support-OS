> **Fetched from jira:** [SUPPORTOS-132](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-132)  
> *Fetched 2026-09-11T18:55:16.736Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (TKT-9) — Ticket Merge & Duplicate Handling  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As an agent, I want to merge duplicate tickets, so that one issue has one thread and one history. Description: Verified gap: nothing detects or resolves duplicates, yet they are produced structurally — COMM-1/COMM-4/COMM-5 each create a ticket per inbound message, so a customer who emails and then submits the web form about the same problem generates two. Today the only remedy is closing one by hand and losing its conversation context. Dependencies: TKT-1, TKT-5, COMM-0.

	Task: Merge API — Implement merging a source ticket into a target: move messages, attachments and internal notes onto the target, record the merge in both tickets' TKT-5 history, and close the source with a pointer to the target. Constraints: never hard-delete the source — the merge stays auditable and reversible by inspection; apply AUTHZ permission checks to both tickets, not just one. Outcome: duplicates are consolidated without losing conversation history.

	Task: Duplicate candidate suggestion — Surface likely duplicates on the ticket detail screen (same customer, near in time, similar subject), reusing KB-3's existing text-similarity retrieval rather than adding a second search mechanism. Constraints: suggestion only, never auto-merge; AI-0 may improve ranking later but must not be a dependency of this task. Outcome: agents notice duplicates before working them twice.

	Task: Merge UI — Implement target selection and a confirm step showing exactly what will move, via the shared confirm dialog. Constraints: reuse UI; make the irreversible parts explicit in the confirm copy per DSN-12. Outcome: merging is deliberate and its effect is obvious beforehand.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-management/SUPPORTOS-132/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-132` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(TKT-9) — Ticket Merge & Duplicate Handling
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent, I want to merge duplicate tickets, so that one issue has one thread and one history. Description: Verified gap: nothing detects or resolves duplicates, yet they are produced structurally — COMM-1/COMM-4/COMM-5 each create a ticket per inbound message, so a customer who emails and then submits the web form about the same problem generates two. Today the only remedy is closing one by hand and losing its conversation context. Dependencies: TKT-1, TKT-5, COMM-0.

	Task: Merge API — Implement merging a source ticket into a target: move messages, attachments and internal notes onto the target, record the merge in both tickets' TKT-5 history, and close the source with a pointer to the target. Constraints: never hard-delete the source — the merge stays auditable and reversible by inspection; apply AUTHZ permission checks to both tickets, not just one. Outcome: duplicates are consolidated without losing conversation history.

	Task: Duplicate candidate suggestion — Surface likely duplicates on the ticket detail screen (same customer, near in time, similar subject), reusing KB-3's existing text-similarity retrieval rather than adding a second search mechanism. Constraints: suggestion only, never auto-merge; AI-0 may improve ranking later but must not be a dependency of this task. Outcome: agents notice duplicates before working them twice.

	Task: Merge UI — Implement target selection and a confirm step showing exactly what will move, via the shared confirm dialog. Constraints: reuse UI; make the irreversible parts explicit in the confirm copy per DSN-12. Outcome: merging is deliberate and its effect is obvious beforehand.
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
