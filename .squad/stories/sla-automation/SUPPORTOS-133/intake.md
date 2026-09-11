> **Fetched from jira:** [SUPPORTOS-133](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-133)  
> *Fetched 2026-09-11T18:57:22.278Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SLA-5) — Business Hours & Holiday Calendar  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a support manager, I want SLA targets measured in working hours, so that targets reflect the hours we actually staff. Description: Verified gap, and it makes current SLA figures wrong rather than merely imprecise. SLA-1 computes both due times as plain wall-clock arithmetic — apps/sla/policy.py adds timedelta(minutes=target) to ticket.created_at and nothing else — so a ticket raised at 17:00 on Thursday with a four-hour response target is already breached before anyone is due back at work. There is no business-hours, working-week or holiday concept anywhere in the codebase or this backlog. A commercial support product cannot report credible SLA attainment without one. Dependencies: SLA-1, SEC-4, ORG-2.

	Task: BusinessCalendar model + working-time arithmetic 🔑 (reused by SLA due times, escalation, and reporting) — Implement a calendar of weekly working windows plus dated holiday exceptions, and a working-time function that advances a timestamp by N working minutes and measures elapsed working minutes between two timestamps. Constraints: timezone-aware, honouring ENV's configured timezone; this function is the single implementation every consumer calls — no second copy in escalation or reports. Outcome: a reusable working-time primitive.

	Task: Apply working time to SLA due times & escalation — Change SLA-1's due-time computation and SLA-3's escalation thresholds to consume the working-time function instead of raw timedelta. Constraints: a calendar is optional — an organization or policy with none configured keeps today's 24/7 wall-clock behaviour exactly, so this is additive and not a breaking change to existing data; recompute derived due times on ticket save rather than retroactively rewriting history. Outcome: SLA and escalation both respect working hours.

	Task: Calendar management UI + per-policy assignment — Implement an admin screen to define working windows and holidays, and let an SLAPolicy (and optionally a Branch, per ORG-2) select a calendar. Constraints: reuse UI/FORM/I18N; support a per-branch calendar so regional offices can differ. Outcome: managers configure real working hours without code.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-automation/SUPPORTOS-133/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `sla-automation`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-133` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SLA-5) — Business Hours & Holiday Calendar
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a support manager, I want SLA targets measured in working hours, so that targets reflect the hours we actually staff. Description: Verified gap, and it makes current SLA figures wrong rather than merely imprecise. SLA-1 computes both due times as plain wall-clock arithmetic — apps/sla/policy.py adds timedelta(minutes=target) to ticket.created_at and nothing else — so a ticket raised at 17:00 on Thursday with a four-hour response target is already breached before anyone is due back at work. There is no business-hours, working-week or holiday concept anywhere in the codebase or this backlog. A commercial support product cannot report credible SLA attainment without one. Dependencies: SLA-1, SEC-4, ORG-2.

	Task: BusinessCalendar model + working-time arithmetic 🔑 (reused by SLA due times, escalation, and reporting) — Implement a calendar of weekly working windows plus dated holiday exceptions, and a working-time function that advances a timestamp by N working minutes and measures elapsed working minutes between two timestamps. Constraints: timezone-aware, honouring ENV's configured timezone; this function is the single implementation every consumer calls — no second copy in escalation or reports. Outcome: a reusable working-time primitive.

	Task: Apply working time to SLA due times & escalation — Change SLA-1's due-time computation and SLA-3's escalation thresholds to consume the working-time function instead of raw timedelta. Constraints: a calendar is optional — an organization or policy with none configured keeps today's 24/7 wall-clock behaviour exactly, so this is additive and not a breaking change to existing data; recompute derived due times on ticket save rather than retroactively rewriting history. Outcome: SLA and escalation both respect working hours.

	Task: Calendar management UI + per-policy assignment — Implement an admin screen to define working windows and holidays, and let an SLAPolicy (and optionally a Branch, per ORG-2) select a calendar. Constraints: reuse UI/FORM/I18N; support a per-branch calendar so regional offices can differ. Outcome: managers configure real working hours without code.
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
