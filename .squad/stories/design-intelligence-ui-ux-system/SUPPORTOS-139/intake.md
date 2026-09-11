> **Fetched from jira:** [SUPPORTOS-139](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-139)  
> *Fetched 2026-09-11T19:04:56.542Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-17) — Measured Colour & Contrast Audit (Light + Dark)  
**Type:** Story  
**Status:** To Do

### Description

As any user — including one with low vision — I want every colour in both themes to be genuinely legible, so that the theme I choose does not decide whether I can read the app. Description: DSN-4 and DSN-5 chose the palette and the dark theme; DSN-2 produced accessibility guidelines. Neither ever measured the shipped tokens pair by pair, and measurement finds real failures. -primary (#2563EB) is defined identically in both themes (frontend/src/index.css, commented "same as :root"), and it is used as text via text-primary in 34 places — every DataTable link, "Forgot password?", every auth link. Measured against WCAG 2.x, where AA body text requires 4.5:1: on the dark background (#0A1018) it reaches 3.69:1, and on the dark card (#171D26) only 3.28:1 — both fail. secondary (#64748B) as text on a dark card measures 3.56:1 and also fails. The token was verified for its button-fill use (white on blue, ≈8.6:1) and never for its text use, and dark mode is the default in every shipped screenshot. Separately, an org-supplied brand colour overrides -primary with no bound in the text direction: a corporate navy (#1E3A8A) renders links at 1.81:1 in dark mode, and the pink currently shipped (#E879F9) fails in light mode at 2.35:1. Those two specific failures are fixed by bugs/101 (F-5/F-6 in QA-REPORT-1.md); this story is the systematic pass that finds the rest, and the two must not duplicate each other. Dependencies: DSN-4, DSN-5, DSN-2, bugs/101.

	Task: Measure every token pair in both themes — Walk every semantic token (foreground, muted-foreground, primary, secondary, destructive, success, warning, info, border, ring, and each foreground partner) against every surface it is actually rendered on (background, card, popover, muted, and each solid fill), in both light and dark, and record the computed ratio next to each token — the convention index.css already follows for -success-foreground (/* 6.37:1, verified */) but applies to only a handful. Constraints: measure the shipped values, do not re-derive the palette; distinguish the AA thresholds correctly — 4.5:1 body text, 3:1 large text, 3:1 non-text/UI boundaries — since applying 4.5:1 to a border is as wrong as applying 3:1 to body copy. Outcome: a complete, recorded contrast matrix instead of spot checks.

	Task: Fix every measured failure — Correct the pairs that fail, at token level. Constraints: the likely shape is separating the "colour as fill" token from the "colour as text" token rather than darkening or lightening one value and breaking the other use — bugs/101 establishes exactly that split for --primary; extend the same approach to any other token the matrix condemns rather than inventing a second mechanism. No call-site-by-call-site colour overrides; every fix lands in index.css and is inherited. Outcome: no token pair in either theme fails its applicable AA threshold.

	Task: Bound the org-supplied brand colour in both directions — shared/branding/contrast.ts's foregroundFor() already picks black or white for text on the brand colour, which is correct and stays; what is unbounded is the brand colour used as text on the page. Derive a theme-appropriate text variant by clamping lightness per theme, validate primary_color server-side, and warn the admin in Organization Settings when their chosen colour cannot reach 4.5:1 in either theme. Constraints: an admin must never be able to make the app unreadable by entering a legitimate corporate colour; keep foregroundFor()'s existing button behaviour untouched. Outcome: any brand colour an organization can enter produces a legible app in both themes.

	Task: Make contrast a standing check, not a one-off — Add a contrast assertion to the same gate set as npm run check:rtl — a script that recomputes the matrix from index.css and fails on a regression. Constraints: reuse the existing script/gate pattern in frontend/scripts/, no new toolchain; it must run without a browser so it can gate in CI. Outcome: the next token added or edited cannot silently reintroduce a failure, which is exactly how the current ones arrived.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-139/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-139` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-17) — Measured Colour & Contrast Audit (Light + Dark)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As any user — including one with low vision — I want every colour in both themes to be genuinely legible, so that the theme I choose does not decide whether I can read the app. Description: DSN-4 and DSN-5 chose the palette and the dark theme; DSN-2 produced accessibility guidelines. Neither ever measured the shipped tokens pair by pair, and measurement finds real failures. -primary (#2563EB) is defined identically in both themes (frontend/src/index.css, commented "same as :root"), and it is used as text via text-primary in 34 places — every DataTable link, "Forgot password?", every auth link. Measured against WCAG 2.x, where AA body text requires 4.5:1: on the dark background (#0A1018) it reaches 3.69:1, and on the dark card (#171D26) only 3.28:1 — both fail. secondary (#64748B) as text on a dark card measures 3.56:1 and also fails. The token was verified for its button-fill use (white on blue, ≈8.6:1) and never for its text use, and dark mode is the default in every shipped screenshot. Separately, an org-supplied brand colour overrides -primary with no bound in the text direction: a corporate navy (#1E3A8A) renders links at 1.81:1 in dark mode, and the pink currently shipped (#E879F9) fails in light mode at 2.35:1. Those two specific failures are fixed by bugs/101 (F-5/F-6 in QA-REPORT-1.md); this story is the systematic pass that finds the rest, and the two must not duplicate each other. Dependencies: DSN-4, DSN-5, DSN-2, bugs/101.

	Task: Measure every token pair in both themes — Walk every semantic token (foreground, muted-foreground, primary, secondary, destructive, success, warning, info, border, ring, and each foreground partner) against every surface it is actually rendered on (background, card, popover, muted, and each solid fill), in both light and dark, and record the computed ratio next to each token — the convention index.css already follows for -success-foreground (/* 6.37:1, verified */) but applies to only a handful. Constraints: measure the shipped values, do not re-derive the palette; distinguish the AA thresholds correctly — 4.5:1 body text, 3:1 large text, 3:1 non-text/UI boundaries — since applying 4.5:1 to a border is as wrong as applying 3:1 to body copy. Outcome: a complete, recorded contrast matrix instead of spot checks.

	Task: Fix every measured failure — Correct the pairs that fail, at token level. Constraints: the likely shape is separating the "colour as fill" token from the "colour as text" token rather than darkening or lightening one value and breaking the other use — bugs/101 establishes exactly that split for --primary; extend the same approach to any other token the matrix condemns rather than inventing a second mechanism. No call-site-by-call-site colour overrides; every fix lands in index.css and is inherited. Outcome: no token pair in either theme fails its applicable AA threshold.

	Task: Bound the org-supplied brand colour in both directions — shared/branding/contrast.ts's foregroundFor() already picks black or white for text on the brand colour, which is correct and stays; what is unbounded is the brand colour used as text on the page. Derive a theme-appropriate text variant by clamping lightness per theme, validate primary_color server-side, and warn the admin in Organization Settings when their chosen colour cannot reach 4.5:1 in either theme. Constraints: an admin must never be able to make the app unreadable by entering a legitimate corporate colour; keep foregroundFor()'s existing button behaviour untouched. Outcome: any brand colour an organization can enter produces a legible app in both themes.

	Task: Make contrast a standing check, not a one-off — Add a contrast assertion to the same gate set as npm run check:rtl — a script that recomputes the matrix from index.css and fails on a regression. Constraints: reuse the existing script/gate pattern in frontend/scripts/, no new toolchain; it must run without a browser so it can gate in CI. Outcome: the next token added or edited cannot silently reintroduce a failure, which is exactly how the current ones arrived.
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
