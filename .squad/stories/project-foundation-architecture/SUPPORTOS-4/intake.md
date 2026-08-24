> **Fetched from jira:** [SUPPORTOS-4](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-4)  
> *Fetched 2026-08-24T17:14:42.025Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (FND-3) — Frontend Foundation (React + Vite + TS)  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a developer, I want a scalable feature-based React app with a shared API layer, so that features stay consistent and isolated. Description: React/Vite/TS app with a feature-based structure, React Router, and a single shared API layer (Axios + TanStack Query) with centralized error handling. No per-feature API clients. Dependencies: FND-1, FND-2 (API envelope/error model).

	Task: Scaffold React app & feature-based structure 🔑 (defines frontend half of ARCH)
	
		Implement: Vite + TS app; structure = {{src/features/<feature>/
{components,api,hooks,types}
}}, plus {{src/shared/

{ui,lib,hooks,i18n}
}}, src/app (router/providers); React Router with route boundaries.

		Constraints: no dumping ground components/utils; each feature self-contained; shared code only under src/shared.

		Depends on: FND-1.

		Outcome: documented structure with a placement rule for new files.

	
	

	Task: Shared API layer (Axios + TanStack Query) 🔑 (defines frontend half of API)
	
		Implement: one configured Axios instance (base URL from ENV, interceptors for auth token + the standard error model); TanStack Query client + query/mutation conventions; typed API response helpers matching the backend envelope.

		Constraints: the only API client in the app; all data fetching goes through TanStack Query; no fetch/ad-hoc Axios in features.

		Depends on: API (backend envelope), scaffold task.

		Outcome: features call the backend through one consistent, typed, error-handled layer.

	
	

	Task: Global error, loading & empty-state handling 🔑 (part of UI/API)
	
		Implement: error boundary, standardized query error/loading/empty rendering, and a toast system wired to API errors.

		Constraints: features reuse these patterns; no per-feature error/loading implementations.

		Depends on: shared API layer task.

		Outcome: one consistent way to show loading/error/empty across the app.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/project-foundation-architecture/SUPPORTOS-4/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `project-foundation-architecture`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-4` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(FND-3) — Frontend Foundation (React + Vite + TS)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want a scalable feature-based React app with a shared API layer, so that features stay consistent and isolated. Description: React/Vite/TS app with a feature-based structure, React Router, and a single shared API layer (Axios + TanStack Query) with centralized error handling. No per-feature API clients. Dependencies: FND-1, FND-2 (API envelope/error model).

	Task: Scaffold React app & feature-based structure 🔑 (defines frontend half of ARCH)
	
		Implement: Vite + TS app; structure = { {src/features/<feature>/
{components,api,hooks,types}
}}, plus { {src/shared/

{ui,lib,hooks,i18n}
}}, src/app (router/providers); React Router with route boundaries.

		Constraints: no dumping ground components/utils; each feature self-contained; shared code only under src/shared.

		Depends on: FND-1.

		Outcome: documented structure with a placement rule for new files.

	
	

	Task: Shared API layer (Axios + TanStack Query) 🔑 (defines frontend half of API)
	
		Implement: one configured Axios instance (base URL from ENV, interceptors for auth token + the standard error model); TanStack Query client + query/mutation conventions; typed API response helpers matching the backend envelope.

		Constraints: the only API client in the app; all data fetching goes through TanStack Query; no fetch/ad-hoc Axios in features.

		Depends on: API (backend envelope), scaffold task.

		Outcome: features call the backend through one consistent, typed, error-handled layer.

	
	

	Task: Global error, loading & empty-state handling 🔑 (part of UI/API)
	
		Implement: error boundary, standardized query error/loading/empty rendering, and a toast system wired to API errors.

		Constraints: features reuse these patterns; no per-feature error/loading implementations.

		Depends on: shared API layer task.

		Outcome: one consistent way to show loading/error/empty across the app.
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
