> **Fetched from jira:** [SUPPORTOS-27](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-27)  
> *Fetched 2026-08-24T20:04:46.025Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (AUTH-2) — Roles, Permissions & Authorization  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As an admin, I want roles and granular permissions, so that access matches each person's job. Description: Role model + permission checks enforced uniformly on the backend and reflected in the frontend (hiding/disabling unauthorized actions). Dependencies: AUTH-1.

	Task: Backend roles & permission enforcement 🔑 (part of AUTHZ)
	
		Implement: roles (Admin, Manager, Agent, plus extensible), a reusable DRF permission layer mapping actions→roles, applied via base viewset conventions.

		Constraints: one permission mechanism reused by all endpoints; no per-feature ad-hoc checks.

		Depends on: AUTH-1.

		Outcome: endpoints enforce role permissions consistently.

	
	

	Task: Frontend authorization helpers 🔑 (part of AUTHZ)
	
		Implement: a can(permission) hook/util and guard components to conditionally render/disable actions.

		Constraints: features gate UI via these helpers; no bespoke role checks.

		Depends on: backend permission task.

		Outcome: UI reflects permissions consistently.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/authentication-authorization/SUPPORTOS-27/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `authentication-authorization`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-27` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(AUTH-2) — Roles, Permissions & Authorization
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an admin, I want roles and granular permissions, so that access matches each person's job. Description: Role model + permission checks enforced uniformly on the backend and reflected in the frontend (hiding/disabling unauthorized actions). Dependencies: AUTH-1.

	Task: Backend roles & permission enforcement 🔑 (part of AUTHZ)
	
		Implement: roles (Admin, Manager, Agent, plus extensible), a reusable DRF permission layer mapping actions→roles, applied via base viewset conventions.

		Constraints: one permission mechanism reused by all endpoints; no per-feature ad-hoc checks.

		Depends on: AUTH-1.

		Outcome: endpoints enforce role permissions consistently.

	
	

	Task: Frontend authorization helpers 🔑 (part of AUTHZ)
	
		Implement: a can(permission) hook/util and guard components to conditionally render/disable actions.

		Constraints: features gate UI via these helpers; no bespoke role checks.

		Depends on: backend permission task.

		Outcome: UI reflects permissions consistently.
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
