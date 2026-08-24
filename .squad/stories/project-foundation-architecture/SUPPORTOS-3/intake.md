> **Fetched from jira:** [SUPPORTOS-3](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-3)  
> *Fetched 2026-08-24T17:14:25.514Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (FND-2) — Backend Foundation (Django + DRF)  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a developer, I want a domain-organized Django + DRF backend, so that features live in clear business boundaries. Description: Django project organized by domain apps (one app per business area), DRF configured with a standard response envelope and error model that all endpoints follow. Dependencies: FND-1.

	Task: Django project & domain app layout 🔑 (defines backend half of ARCH)
	
		Implement: Django project + empty domain apps (customers, tickets, communications, agents, sla, knowledge_base, portal, reports, ai, integrations, accounts, organization); shared core app for cross-cutting utilities.

		Constraints: organize by domain, not by technical layer; avoid premature abstractions.

		Depends on: FND-1.

		Outcome: importable domain apps with a documented placement rule for new code.

	
	

	Task: DRF base config, response envelope & error model 🔑 (defines backend half of API)
	
		Implement: DRF setup; a consistent success/error response shape; a global exception handler mapping errors to that shape; pagination defaults; base viewset/serializer conventions.

		Constraints: every future endpoint reuses this envelope + exception handler — no per-feature error formats.

		Depends on: Django project task.

		Outcome: GET /api/health/ returns the standard envelope; errors are uniform.

	
	

	Task: Local PostgreSQL wiring & migration workflow 🔑
	
		Implement: connect Django to local Postgres via ENV; document makemigrations/migrate; initial migration.

		Constraints: local install only; no Docker dependency.

		Depends on: ENV, Django project task.

		Outcome: migrations run against local Postgres.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/project-foundation-architecture/SUPPORTOS-3/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `project-foundation-architecture`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-3` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(FND-2) — Backend Foundation (Django + DRF)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want a domain-organized Django + DRF backend, so that features live in clear business boundaries. Description: Django project organized by domain apps (one app per business area), DRF configured with a standard response envelope and error model that all endpoints follow. Dependencies: FND-1.

	Task: Django project & domain app layout 🔑 (defines backend half of ARCH)
	
		Implement: Django project + empty domain apps (customers, tickets, communications, agents, sla, knowledge_base, portal, reports, ai, integrations, accounts, organization); shared core app for cross-cutting utilities.

		Constraints: organize by domain, not by technical layer; avoid premature abstractions.

		Depends on: FND-1.

		Outcome: importable domain apps with a documented placement rule for new code.

	
	

	Task: DRF base config, response envelope & error model 🔑 (defines backend half of API)
	
		Implement: DRF setup; a consistent success/error response shape; a global exception handler mapping errors to that shape; pagination defaults; base viewset/serializer conventions.

		Constraints: every future endpoint reuses this envelope + exception handler — no per-feature error formats.

		Depends on: Django project task.

		Outcome: GET /api/health/ returns the standard envelope; errors are uniform.

	
	

	Task: Local PostgreSQL wiring & migration workflow 🔑
	
		Implement: connect Django to local Postgres via ENV; document makemigrations/migrate; initial migration.

		Constraints: local install only; no Docker dependency.

		Depends on: ENV, Django project task.

		Outcome: migrations run against local Postgres.
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
