> **Fetched from jira:** [SUPPORTOS-11](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-11)  
> *Fetched 2026-08-24T20:02:11.670Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (UI-1) — Design System & Shared Components  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a developer, I want a shared, direction-aware component library, so that features reuse consistent UI instead of duplicating it. Description: Tailwind + shadcn/ui foundation plus the shared business-agnostic primitives and standard states. Built once; every feature reuses these. Dependencies: FND-3, I18N-1.

	Task: Tailwind + shadcn/ui setup & theme tokens 🔑 (defines UI base)
	
		Implement: Tailwind config with design tokens (colors, spacing, radius, typography), shadcn/ui initialized, dark-mode-ready theme, RTL-aware base styles.

		Constraints: prefer shadcn primitives over hand-built ones; tokens are the single styling source.

		Depends on: FND-3, I18N RTL task.

		Outcome: themed, direction-aware styling foundation.

	
	

	Task: Shared UI primitives 🔑 (part of UI)
	
		Implement (via shadcn where sensible): Button, Input, Select, Dialog/Modal, Dropdown, Table, Pagination, Toast/notifications, Tabs, Badge, Card.

		Constraints: all i18n- and RTL-aware; reuse-first — features must use these, not re-create them.

		Depends on: Tailwind/shadcn task.

		Outcome: a documented primitive set covering common UI needs.

	
	

	Task: Standard states & patterns 🔑 (part of UI)
	
		Implement: reusable Loading, Empty, Error states, and a Confirmation dialog pattern; wire them to the API error/loading conventions.

		Constraints: features render these states via shared components only.

		Depends on: shared primitives task, FND-3 error/loading task.

		Outcome: consistent loading/empty/error/confirm UX everywhere.

	
	

	Task: Data table + pagination pattern 🔑 (part of UI)
	
		Implement: a reusable table pattern (sorting, pagination, empty/loading) built on the primitives + TanStack Query conventions.

		Constraints: all list screens use this pattern; no bespoke tables per feature.

		Depends on: shared primitives task, shared API layer.

		Outcome: one table pattern reused by every list view.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/internationalization-design-system/SUPPORTOS-11/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `internationalization-design-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-11` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(UI-1) — Design System & Shared Components
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want a shared, direction-aware component library, so that features reuse consistent UI instead of duplicating it. Description: Tailwind + shadcn/ui foundation plus the shared business-agnostic primitives and standard states. Built once; every feature reuses these. Dependencies: FND-3, I18N-1.

	Task: Tailwind + shadcn/ui setup & theme tokens 🔑 (defines UI base)
	
		Implement: Tailwind config with design tokens (colors, spacing, radius, typography), shadcn/ui initialized, dark-mode-ready theme, RTL-aware base styles.

		Constraints: prefer shadcn primitives over hand-built ones; tokens are the single styling source.

		Depends on: FND-3, I18N RTL task.

		Outcome: themed, direction-aware styling foundation.

	
	

	Task: Shared UI primitives 🔑 (part of UI)
	
		Implement (via shadcn where sensible): Button, Input, Select, Dialog/Modal, Dropdown, Table, Pagination, Toast/notifications, Tabs, Badge, Card.

		Constraints: all i18n- and RTL-aware; reuse-first — features must use these, not re-create them.

		Depends on: Tailwind/shadcn task.

		Outcome: a documented primitive set covering common UI needs.

	
	

	Task: Standard states & patterns 🔑 (part of UI)
	
		Implement: reusable Loading, Empty, Error states, and a Confirmation dialog pattern; wire them to the API error/loading conventions.

		Constraints: features render these states via shared components only.

		Depends on: shared primitives task, FND-3 error/loading task.

		Outcome: consistent loading/empty/error/confirm UX everywhere.

	
	

	Task: Data table + pagination pattern 🔑 (part of UI)
	
		Implement: a reusable table pattern (sorting, pagination, empty/loading) built on the primitives + TanStack Query conventions.

		Constraints: all list screens use this pattern; no bespoke tables per feature.

		Depends on: shared primitives task, shared API layer.

		Outcome: one table pattern reused by every list view.
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
