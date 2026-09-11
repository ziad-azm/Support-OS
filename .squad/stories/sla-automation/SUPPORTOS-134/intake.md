> **Fetched from jira:** [SUPPORTOS-134](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-134)  
> *Fetched 2026-09-11T18:58:16.198Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SLA-6) — Waiting-on-Customer Status & SLA Clock Pause  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As an agent, I want the SLA clock to stop while I am waiting on the customer, so that our targets measure our responsiveness rather than theirs. Description: Verified gap: Ticket.Status offers only open, in_progress, resolved, closed — there is no "waiting on customer" state, so a ticket blocked on a customer reply keeps accruing SLA time and eventually breaches for a delay the team did not cause. With SLA-5, this is the second of the two reasons current breach figures overstate the problem. The state also gives the escalation job (SLA-3) a way to tell "idle because blocked" from "idle because neglected". Dependencies: TKT-4, SLA-1, SLA-5.

	Task: pending_customer status + transition rules — Add the status to TKT-4's enum and its valid-transition graph, entered from in_progress and left automatically when the customer replies (via COMM-0's inbound message path) or manually by an agent. Constraints: extend TKT-4's existing transition validation rather than adding a parallel state machine; every automatic transition is logged through TKT-5's activity log. Outcome: a ticket can be explicitly blocked on the customer.

	Task: Pause and resume the SLA clock — Implement accumulated paused time on the ticket and subtract it when computing response/resolution status, so time in pending_customer does not count against a target. Constraints: consume SLA-5's working-time function rather than adding a second time calculation; store accumulated pause explicitly so history stays auditable and recomputation is not required. Outcome: SLA attainment reflects only time the team owned the ticket.

	Task: Surface the paused state in UI and reports — Show the status and a paused-SLA indicator on the ticket list and detail via UI/DSN semantics, and separate paused time in RPT-2's SLA reporting. Constraints: reuse existing badge semantics (DSN-4) — no new colour vocabulary. Outcome: paused tickets are obvious to agents and correctly excluded from breach figures.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-automation/SUPPORTOS-134/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `sla-automation`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-134` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SLA-6) — Waiting-on-Customer Status & SLA Clock Pause
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent, I want the SLA clock to stop while I am waiting on the customer, so that our targets measure our responsiveness rather than theirs. Description: Verified gap: Ticket.Status offers only open, in_progress, resolved, closed — there is no "waiting on customer" state, so a ticket blocked on a customer reply keeps accruing SLA time and eventually breaches for a delay the team did not cause. With SLA-5, this is the second of the two reasons current breach figures overstate the problem. The state also gives the escalation job (SLA-3) a way to tell "idle because blocked" from "idle because neglected". Dependencies: TKT-4, SLA-1, SLA-5.

	Task: pending_customer status + transition rules — Add the status to TKT-4's enum and its valid-transition graph, entered from in_progress and left automatically when the customer replies (via COMM-0's inbound message path) or manually by an agent. Constraints: extend TKT-4's existing transition validation rather than adding a parallel state machine; every automatic transition is logged through TKT-5's activity log. Outcome: a ticket can be explicitly blocked on the customer.

	Task: Pause and resume the SLA clock — Implement accumulated paused time on the ticket and subtract it when computing response/resolution status, so time in pending_customer does not count against a target. Constraints: consume SLA-5's working-time function rather than adding a second time calculation; store accumulated pause explicitly so history stays auditable and recomputation is not required. Outcome: SLA attainment reflects only time the team owned the ticket.

	Task: Surface the paused state in UI and reports — Show the status and a paused-SLA indicator on the ticket list and detail via UI/DSN semantics, and separate paused time in RPT-2's SLA reporting. Constraints: reuse existing badge semantics (DSN-4) — no new colour vocabulary. Outcome: paused tickets are obvious to agents and correctly excluded from breach figures.
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
