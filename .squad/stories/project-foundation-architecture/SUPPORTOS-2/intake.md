> **Fetched from jira:** [SUPPORTOS-2](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-2)  
> *Fetched 2026-08-24T17:02:22.876Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (FND-1) — Repository & Local Dev Bootstrap  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a developer, I want a monorepo that runs locally without Docker, so that anyone can start developing in minutes. Description: One repository with /backend (Django) and /frontend (React/Vite) that runs against a locally installed PostgreSQL. Docker files may exist but are optional and never required to run the app. Dependencies: none.

	Task: Create monorepo structure & docs 🔑 (defines ARCH scaffold)
	
		Implement: /backend, /frontend, root README with exact local-run steps (install local Postgres, create DB, run migrations, start both servers), .gitignore, main+develop branches.

		Constraints: no Docker requirement in the run steps; Docker files (if added) marked optional/future.

		Depends on: none.

		Outcome: a fresh clone runs both apps locally following the README only.

	
	

	Task: Environment & config strategy 🔑 (defines ENV)
	
		Implement: .env.example for backend (DB name/user/password/host/port, secret key, JWT settings) and frontend (VITE_API_BASE_URL); a settings split (base/dev/prod) reading env vars; documented local Postgres connection.

		Constraints: no secrets committed; local Postgres is the default; must work without Docker.

		Depends on: FND-1 repo task.

		Outcome: both apps read all config from env; local Postgres connects on dev.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/project-foundation-architecture/SUPPORTOS-2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `project-foundation-architecture`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-2` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(FND-1) — Repository & Local Dev Bootstrap
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want a monorepo that runs locally without Docker, so that anyone can start developing in minutes. Description: One repository with /backend (Django) and /frontend (React/Vite) that runs against a locally installed PostgreSQL. Docker files may exist but are optional and never required to run the app. Dependencies: none.

	Task: Create monorepo structure & docs 🔑 (defines ARCH scaffold)
	
		Implement: /backend, /frontend, root README with exact local-run steps (install local Postgres, create DB, run migrations, start both servers), .gitignore, main+develop branches.

		Constraints: no Docker requirement in the run steps; Docker files (if added) marked optional/future.

		Depends on: none.

		Outcome: a fresh clone runs both apps locally following the README only.

	
	

	Task: Environment & config strategy 🔑 (defines ENV)
	
		Implement: .env.example for backend (DB name/user/password/host/port, secret key, JWT settings) and frontend (VITE_API_BASE_URL); a settings split (base/dev/prod) reading env vars; documented local Postgres connection.

		Constraints: no secrets committed; local Postgres is the default; must work without Docker.

		Depends on: FND-1 repo task.

		Outcome: both apps read all config from env; local Postgres connects on dev.
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
