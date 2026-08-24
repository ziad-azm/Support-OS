> **Fetched from jira:** [SUPPORTOS-9](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-9)  
> *Fetched 2026-08-24T17:16:03.530Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (I18N-1) — Internationalization & RTL Foundation  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a user, I want the app fully usable in Arabic and English with correct layout direction, so that language is never a limitation. Description: i18n is a day-one foundation: translation structure, runtime language switching, RTL/LTR layout, and localized date/number formatting. No hardcoded user-facing strings anywhere. Dependencies: FND-3.

	Task: i18next setup & translation structure 🔑 (defines I18N)
	
		Implement: react-i18next; per-feature namespace structure for en and ar; a typed t() usage convention; lint rule/guidance against hardcoded strings.

		Constraints: every feature adds its own namespace files; strings never hardcoded.

		Depends on: FND-3.

		Outcome: translation keys resolve in both languages; adding a feature = adding its namespace.

	
	

	Task: RTL/LTR layout system & language switcher 🔑 (part of I18N)
	
		Implement: direction-aware layout (html dir/lang), Tailwind logical properties usage, a language switcher persisting choice, and direction-correct defaults.

		Constraints: shared components must render correctly in both directions; use logical (start/end) spacing, not left/right.

		Depends on: i18next setup task.

		Outcome: switching language flips layout direction correctly app-wide.

	
	

	Task: Locale formatting utilities 🔑 (part of I18N)
	
		Implement: shared date/number/currency formatting helpers bound to the active locale; backend LANGUAGE/locale settings for any server-rendered/localized text.

		Constraints: features format via these helpers, not inline.

		Depends on: i18next setup task.

		Outcome: dates/numbers display correctly per locale everywhere.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/internationalization-design-system/SUPPORTOS-9/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `internationalization-design-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-9` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(I18N-1) — Internationalization & RTL Foundation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want the app fully usable in Arabic and English with correct layout direction, so that language is never a limitation. Description: i18n is a day-one foundation: translation structure, runtime language switching, RTL/LTR layout, and localized date/number formatting. No hardcoded user-facing strings anywhere. Dependencies: FND-3.

	Task: i18next setup & translation structure 🔑 (defines I18N)
	
		Implement: react-i18next; per-feature namespace structure for en and ar; a typed t() usage convention; lint rule/guidance against hardcoded strings.

		Constraints: every feature adds its own namespace files; strings never hardcoded.

		Depends on: FND-3.

		Outcome: translation keys resolve in both languages; adding a feature = adding its namespace.

	
	

	Task: RTL/LTR layout system & language switcher 🔑 (part of I18N)
	
		Implement: direction-aware layout (html dir/lang), Tailwind logical properties usage, a language switcher persisting choice, and direction-correct defaults.

		Constraints: shared components must render correctly in both directions; use logical (start/end) spacing, not left/right.

		Depends on: i18next setup task.

		Outcome: switching language flips layout direction correctly app-wide.

	
	

	Task: Locale formatting utilities 🔑 (part of I18N)
	
		Implement: shared date/number/currency formatting helpers bound to the active locale; backend LANGUAGE/locale settings for any server-rendered/localized text.

		Constraints: features format via these helpers, not inline.

		Depends on: i18next setup task.

		Outcome: dates/numbers display correctly per locale everywhere.
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
