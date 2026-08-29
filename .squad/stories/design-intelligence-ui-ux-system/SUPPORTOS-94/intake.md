> **Fetched from jira:** [SUPPORTOS-94](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-94)  
> *Fetched 2026-08-29T13:18:00.725Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-4) — Comprehensive Visual Redesign of Built Screens  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a user, I want the app to look polished and visually considered instead of flat and generic, so that using it feels trustworthy and professional. Description: DSN-1 only swapped color/font/radius tokens — a deliberate narrow scope, not a full redesign. Screens still read as unstyled shadcn defaults: uniform-gray status/priority badges with no semantic color, no iconography, no density/hierarchy polish on tables and forms. This story goes past the token swap to make every already-built screen actually look designed, using DSN's guidance (design-system/supportos/MASTER.md) and the ui-ux-pro-max skill, while staying inside the existing shadcn/ui + Tailwind v4 primitive set — visual/styling only, no new component library and no re-architecture of data flow or logic. Dependencies: DSN-0, DSN-1.

	Task: Semantic status/priority color-coding — Extend the shared Badge primitive's variants (or add new ones) so ticket status, priority, notification kind, and task state render with distinct, meaningful colors (e.g. success/warning/danger/info) per DSN's palette, instead of one uniform gray pill. Constraints: reuse the existing badge.tsx primitive and DSN tokens; no per-feature badge reimplementation. Outcome: status is scannable at a glance across every list view.

	Task: Iconography pass — Add icons (via the icon library already bundled with shadcn) to primary actions, nav items, status badges, and empty states per DSN guidance. Constraints: reuse one icon set consistently; no mixed icon libraries. Outcome: improved scannability and a less "bare" feel.

	Task: Spacing, density & table polish — Apply DSN's spacing scale and visual-hierarchy guidance to the shared DataTable pattern, page headers, and form layouts every already-built screen composes from. Constraints: shared-component-level changes only, so every consuming screen inherits the fix. Outcome: consistent, less flat layout app-wide with no per-page rework.

	Task: Full-app visual QA pass — Walk every already-built route (same list as DSN-1's ## Verification Steps) confirming the refresh landed consistently; log and fix any straggler screen. Outcome: no unstyled screen left behind.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-94/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-94` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-4) — Comprehensive Visual Redesign of Built Screens
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want the app to look polished and visually considered instead of flat and generic, so that using it feels trustworthy and professional. Description: DSN-1 only swapped color/font/radius tokens — a deliberate narrow scope, not a full redesign. Screens still read as unstyled shadcn defaults: uniform-gray status/priority badges with no semantic color, no iconography, no density/hierarchy polish on tables and forms. This story goes past the token swap to make every already-built screen actually look designed, using DSN's guidance (design-system/supportos/MASTER.md) and the ui-ux-pro-max skill, while staying inside the existing shadcn/ui + Tailwind v4 primitive set — visual/styling only, no new component library and no re-architecture of data flow or logic. Dependencies: DSN-0, DSN-1.

	Task: Semantic status/priority color-coding — Extend the shared Badge primitive's variants (or add new ones) so ticket status, priority, notification kind, and task state render with distinct, meaningful colors (e.g. success/warning/danger/info) per DSN's palette, instead of one uniform gray pill. Constraints: reuse the existing badge.tsx primitive and DSN tokens; no per-feature badge reimplementation. Outcome: status is scannable at a glance across every list view.

	Task: Iconography pass — Add icons (via the icon library already bundled with shadcn) to primary actions, nav items, status badges, and empty states per DSN guidance. Constraints: reuse one icon set consistently; no mixed icon libraries. Outcome: improved scannability and a less "bare" feel.

	Task: Spacing, density & table polish — Apply DSN's spacing scale and visual-hierarchy guidance to the shared DataTable pattern, page headers, and form layouts every already-built screen composes from. Constraints: shared-component-level changes only, so every consuming screen inherits the fix. Outcome: consistent, less flat layout app-wide with no per-page rework.

	Task: Full-app visual QA pass — Walk every already-built route (same list as DSN-1's ## Verification Steps) confirming the refresh landed consistently; log and fix any straggler screen. Outcome: no unstyled screen left behind.
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
