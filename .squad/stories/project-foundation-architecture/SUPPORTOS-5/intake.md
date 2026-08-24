> **Fetched from jira:** [SUPPORTOS-5](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-5)  
> *Fetched 2026-08-24T18:25:54.839Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (FND-4) — Codebase Conventions & Foundation Spec  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a team, we want one written conventions spec, so that every developer (and the AI) follows the same patterns and avoids duplication. Description: A single living document (CONV) that all later tasks reference instead of re-deriving standards. This is the anti-duplication, low-token backbone of the project. Dependencies: FND-1, FND-2, FND-3.

	Task: Author the CONV spec 🔑 (defines CONV)
	
		Implement: one doc covering — folder structure & file placement; naming conventions; TypeScript conventions; API communication conventions (reference API); error/loading/empty handling; validation approach (reference FORM); reusable-component rule (reference UI); shared utilities; env/config (reference ENV); logging strategy (frontend + backend); API response conventions; frontend/backend boundaries; auth conventions (reference AUTHZ); linting/formatting; import conventions; explicit "check for existing implementation before writing new code" rule.

		Constraints: concise and reference-based; later tasks link to CONV rather than repeating rules.

		Depends on: FND-1/2/3.

		Outcome: a single source of truth every task cites.

	
	

	Task: Linting, formatting & CI checks 🔑
	
		Implement: ESLint + Prettier (frontend), Black + Ruff/isort (backend), pre-commit hooks, and a CI job running lint for both apps.

		Constraints: enforce CONV import/naming rules automatically.

		Depends on: CONV task.

		Outcome: consistent style enforced on every commit.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/project-foundation-architecture/SUPPORTOS-5/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `project-foundation-architecture`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-5` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(FND-4) — Codebase Conventions & Foundation Spec
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a team, we want one written conventions spec, so that every developer (and the AI) follows the same patterns and avoids duplication. Description: A single living document (CONV) that all later tasks reference instead of re-deriving standards. This is the anti-duplication, low-token backbone of the project. Dependencies: FND-1, FND-2, FND-3.

	Task: Author the CONV spec 🔑 (defines CONV)
	
		Implement: one doc covering — folder structure & file placement; naming conventions; TypeScript conventions; API communication conventions (reference API); error/loading/empty handling; validation approach (reference FORM); reusable-component rule (reference UI); shared utilities; env/config (reference ENV); logging strategy (frontend + backend); API response conventions; frontend/backend boundaries; auth conventions (reference AUTHZ); linting/formatting; import conventions; explicit "check for existing implementation before writing new code" rule.

		Constraints: concise and reference-based; later tasks link to CONV rather than repeating rules.

		Depends on: FND-1/2/3.

		Outcome: a single source of truth every task cites.

	
	

	Task: Linting, formatting & CI checks 🔑
	
		Implement: ESLint + Prettier (frontend), Black + Ruff/isort (backend), pre-commit hooks, and a CI job running lint for both apps.

		Constraints: enforce CONV import/naming rules automatically.

		Depends on: CONV task.

		Outcome: consistent style enforced on every commit.
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
