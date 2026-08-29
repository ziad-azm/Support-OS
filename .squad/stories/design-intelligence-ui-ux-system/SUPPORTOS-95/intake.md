> **Fetched from jira:** [SUPPORTOS-95](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-95)  
> *Fetched 2026-08-29T17:53:41.620Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-5) — App Shell Redesign: Sidebar Navigation & Theme Backgrounds  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a user, I want a proper sidebar and a considered light/dark background palette instead of a bare top bar and flat grayscale surfaces, so that navigating the app feels like a real product, not a scaffold. Description: Complements DSN-4. That story polishes existing components in place; this one changes the app shell itself — the current top-bar nav (frontend/src/app/RootLayout.tsx) becomes a sidebar, and the base surface tokens (background/card/muted/border — not just the accent colors DSN-1 already retinted) get a real light/dark treatment. This is the one story in EPIC 8 that is not token-only — converting the nav from a header to a sidebar is a deliberate layout restructuring, done carefully to preserve every existing permission gate, i18n label, and route unchanged. Dependencies: DSN-0. Complements DSN-4 (either order is fine; both build on DSN's spec).

	Task: Sidebar navigation shell — Replace RootLayout.tsx's top <nav> with a collapsible sidebar (start-side in LTR, end-side in RTL, per I18N's logical-direction rules), preserving every existing <Can permission="...">-gated link, i18n label, the notification bell, and logout exactly as they behave today — only the container markup and layout change, not the route/permission logic. Outcome: real app-shell navigation instead of a single crowded header row.

	Task: Light/dark background & surface refresh — Beyond DSN-1's accent-only swap (-primary/secondary/destructive), retint the base surface tokens (background, foreground, card, muted, -border) in frontend/src/index.css for both :root and .dark per DSN's guidance, so the new sidebar and every page have real depth/contrast instead of shadcn's default flat grayscale. Outcome: light and dark mode both look designed, not just recolored accents on a gray canvas.

	Task: Button & input primitive polish — Refine the shared primitives every form and screen already composes from (shared/ui/primitives/button.tsx, input.tsx, select.tsx, and the shared field components in shared/ui/form/) with DSN's guidance on shadows, hover/focus/active states, and sizing. Constraints: component-level only — no per-feature overrides — so every consuming screen inherits the polish automatically. Outcome: every button and input in the app feels considered, not default shadcn.

	Task: Full-app QA pass — Verify the sidebar and new theme across every already-built route, in both languages/directions (ar/RTL, en/LTR) and both color modes (light/dark), confirming permission-gated links still show/hide correctly and no screen is left half-migrated. Outcome: one consistent, polished shell everywhere.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-95/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-95` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-5) — App Shell Redesign: Sidebar Navigation & Theme Backgrounds
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want a proper sidebar and a considered light/dark background palette instead of a bare top bar and flat grayscale surfaces, so that navigating the app feels like a real product, not a scaffold. Description: Complements DSN-4. That story polishes existing components in place; this one changes the app shell itself — the current top-bar nav (frontend/src/app/RootLayout.tsx) becomes a sidebar, and the base surface tokens (background/card/muted/border — not just the accent colors DSN-1 already retinted) get a real light/dark treatment. This is the one story in EPIC 8 that is not token-only — converting the nav from a header to a sidebar is a deliberate layout restructuring, done carefully to preserve every existing permission gate, i18n label, and route unchanged. Dependencies: DSN-0. Complements DSN-4 (either order is fine; both build on DSN's spec).

	Task: Sidebar navigation shell — Replace RootLayout.tsx's top <nav> with a collapsible sidebar (start-side in LTR, end-side in RTL, per I18N's logical-direction rules), preserving every existing <Can permission="...">-gated link, i18n label, the notification bell, and logout exactly as they behave today — only the container markup and layout change, not the route/permission logic. Outcome: real app-shell navigation instead of a single crowded header row.

	Task: Light/dark background & surface refresh — Beyond DSN-1's accent-only swap (-primary/secondary/destructive), retint the base surface tokens (background, foreground, card, muted, -border) in frontend/src/index.css for both :root and .dark per DSN's guidance, so the new sidebar and every page have real depth/contrast instead of shadcn's default flat grayscale. Outcome: light and dark mode both look designed, not just recolored accents on a gray canvas.

	Task: Button & input primitive polish — Refine the shared primitives every form and screen already composes from (shared/ui/primitives/button.tsx, input.tsx, select.tsx, and the shared field components in shared/ui/form/) with DSN's guidance on shadows, hover/focus/active states, and sizing. Constraints: component-level only — no per-feature overrides — so every consuming screen inherits the polish automatically. Outcome: every button and input in the app feels considered, not default shadcn.

	Task: Full-app QA pass — Verify the sidebar and new theme across every already-built route, in both languages/directions (ar/RTL, en/LTR) and both color modes (light/dark), confirming permission-gated links still show/hide correctly and no screen is left half-migrated. Outcome: one consistent, polished shell everywhere.
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
