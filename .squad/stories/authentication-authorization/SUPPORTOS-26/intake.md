> **Fetched from jira:** [SUPPORTOS-26](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-26)  
> *Fetched 2026-08-24T20:04:16.057Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (AUTH-1) — Authentication (JWT)  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a user, I want to log in and stay authenticated securely, so that my access is protected. Description: JWT auth (login/refresh/logout) with the token wired into the shared Axios layer and route guards on the frontend. Dependencies: FND-2, FND-3, UI-1, FORM-1.

	Task: Backend JWT auth endpoints 🔑 (part of AUTHZ)
	
		Implement: djangorestframework-simplejwt login/refresh; a User model strategy (extend Django auth); auth using the standard API envelope.

		Constraints: reuse API error model; no custom response shapes.

		Depends on: FND-2.

		Outcome: working token issuance/refresh via standard API.

	
	

	Task: Frontend auth flow & guards 🔑 (part of AUTHZ)
	
		Implement: login form (RHF+Zod, i18n), token storage + refresh in the Axios interceptor, protected route guards, and an auth context/hook.

		Constraints: reuse shared API layer + FORM + UI; single source of auth state.

		Depends on: backend JWT task, FND-3, FORM-1.

		Outcome: users log in and reach protected routes; tokens refresh transparently.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/authentication-authorization/SUPPORTOS-26/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `authentication-authorization`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-26` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(AUTH-1) — Authentication (JWT)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want to log in and stay authenticated securely, so that my access is protected. Description: JWT auth (login/refresh/logout) with the token wired into the shared Axios layer and route guards on the frontend. Dependencies: FND-2, FND-3, UI-1, FORM-1.

	Task: Backend JWT auth endpoints 🔑 (part of AUTHZ)
	
		Implement: djangorestframework-simplejwt login/refresh; a User model strategy (extend Django auth); auth using the standard API envelope.

		Constraints: reuse API error model; no custom response shapes.

		Depends on: FND-2.

		Outcome: working token issuance/refresh via standard API.

	
	

	Task: Frontend auth flow & guards 🔑 (part of AUTHZ)
	
		Implement: login form (RHF+Zod, i18n), token storage + refresh in the Axios interceptor, protected route guards, and an auth context/hook.

		Constraints: reuse shared API layer + FORM + UI; single source of auth state.

		Depends on: backend JWT task, FND-3, FORM-1.

		Outcome: users log in and reach protected routes; tokens refresh transparently.
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
