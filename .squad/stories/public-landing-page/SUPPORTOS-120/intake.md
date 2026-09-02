> **Fetched from jira:** [SUPPORTOS-120](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-120)  
> *Fetched 2026-09-02T20:53:01.451Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Public Landing Page  
**Type:** Epic  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

A real front door for the product — right now / is gated by RequireAuth with no public route in between, so a signed-out visitor opening the app lands straight on the bare login form with zero introduction to what SupportOS is. Confirmed live: PublicLayout (/login, /reset-password, ...) exists but is a minimal centered-card shell, not a landing page — no route currently renders anything else for a visitor. Depends on: UI, I18N (EPIC 1).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/public-landing-page/SUPPORTOS-120/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `public-landing-page`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-120` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Epic`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Public Landing Page
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
A real front door for the product — right now / is gated by RequireAuth with no public route in between, so a signed-out visitor opening the app lands straight on the bare login form with zero introduction to what SupportOS is. Confirmed live: PublicLayout (/login, /reset-password, ...) exists but is a minimal centered-card shell, not a landing page — no route currently renders anything else for a visitor. Depends on: UI, I18N (EPIC 1).
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
