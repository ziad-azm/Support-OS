> **Fetched from jira:** [SUPPORTOS-37](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-37)  
> *Fetched 2026-08-26T16:59:57.708Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (COMM-0) — Messaging Core & Channel Adapter Pattern  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

As a developer, I want one message model and channel-adapter interface, so that each channel plugs in consistently. Dependencies: TKT-1.

	Task: Message model + channel adapter interface 🔑 (defines the messaging foundation) — Implement a unified Message model (ticket FK, direction, channel, body, metadata) and an adapter interface each channel implements (inbound→ticket, outbound send). Constraints: channels reuse this; no per-channel bespoke models. Outcome: reusable messaging spine.

	Task: Shared conversation UI 🔑 — Implement a channel-agnostic conversation/thread + reply component (reusing UI,FORM,I18N). Outcome: one conversation view all channels reuse.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/communication-channels/SUPPORTOS-37/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `communication-channels`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-37` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(COMM-0) — Messaging Core & Channel Adapter Pattern
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want one message model and channel-adapter interface, so that each channel plugs in consistently. Dependencies: TKT-1.

	Task: Message model + channel adapter interface 🔑 (defines the messaging foundation) — Implement a unified Message model (ticket FK, direction, channel, body, metadata) and an adapter interface each channel implements (inbound→ticket, outbound send). Constraints: channels reuse this; no per-channel bespoke models. Outcome: reusable messaging spine.

	Task: Shared conversation UI 🔑 — Implement a channel-agnostic conversation/thread + reply component (reusing UI,FORM,I18N). Outcome: one conversation view all channels reuse.
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
