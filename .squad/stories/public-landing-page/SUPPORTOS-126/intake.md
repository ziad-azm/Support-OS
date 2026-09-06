> **Fetched from jira:** [SUPPORTOS-126](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-126)  
> *Fetched 2026-09-06T09:32:22.995Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (LAND-4) — Landing Page Visual Redesign  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a visitor, I want the landing page to look designed rather than assembled, so that the product's front door reflects its quality. Description: LAND-1 was scoped to "content & layout" and delivered exactly that — a header, a plain hero, a four-card grid, a CTA band and a footer, built from unadorned Card/Button primitives with a single animate-in on the hero. This is the same gap DSN-4 closed for the staff app ("screens still read as unstyled shadcn defaults"), applied to the one screen DSN-6–DSN-13's audit thread never covered, because the landing page did not exist yet when DSN-6's register was compiled. Dependencies: LAND-2, LAND-3, MOTION-0, DSN.

	Task: Hero and section visual treatment — Redesign the hero and the section rhythm per DSN guidance (design-system/supportos/MASTER.md) — real typographic hierarchy, spacing scale, background treatment, and support for an admin-set hero image or illustration. Constraints: stay inside the existing shadcn/ui + Tailwind v4 primitive set, the same guardrail DSN-4 held to — no new component library; the brand colour must keep flowing from ORG-3's primary_color token rather than hard-coded hexes; decide, do not assume, how a hero image is stored — OrganizationSettings.logo_url is a plain URLField and not an upload, for a reason its own docstring records (Story 53), so an uploaded hero image is a scope decision this task must settle explicitly. Outcome: a hero that looks intentional.

	Task: Feature, social-proof and CTA section design — Give the (now admin-managed) highlight cards, the CTA band and the footer a designed treatment — iconography, semantic colour, card depth and borders per DSN. Constraints: reuse the shared Card/Badge/Button primitives and DSN-4's semantic variants; no per-section bespoke components. Outcome: the page reads as one designed system, not five stacked defaults.

	Task: Responsive and RTL pass on the redesigned page — Verify the redesign across the breakpoints DSN-9 established for the app and in Arabic/RTL. Constraints: logical CSS properties only (npm run check:rtl enforces this in CI); verify in both light and dark themes, since the page carries a ThemeToggle. Outcome: the front door holds up on a phone and in Arabic.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/public-landing-page/SUPPORTOS-126/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `public-landing-page`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-126` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(LAND-4) — Landing Page Visual Redesign
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a visitor, I want the landing page to look designed rather than assembled, so that the product's front door reflects its quality. Description: LAND-1 was scoped to "content & layout" and delivered exactly that — a header, a plain hero, a four-card grid, a CTA band and a footer, built from unadorned Card/Button primitives with a single animate-in on the hero. This is the same gap DSN-4 closed for the staff app ("screens still read as unstyled shadcn defaults"), applied to the one screen DSN-6–DSN-13's audit thread never covered, because the landing page did not exist yet when DSN-6's register was compiled. Dependencies: LAND-2, LAND-3, MOTION-0, DSN.

	Task: Hero and section visual treatment — Redesign the hero and the section rhythm per DSN guidance (design-system/supportos/MASTER.md) — real typographic hierarchy, spacing scale, background treatment, and support for an admin-set hero image or illustration. Constraints: stay inside the existing shadcn/ui + Tailwind v4 primitive set, the same guardrail DSN-4 held to — no new component library; the brand colour must keep flowing from ORG-3's primary_color token rather than hard-coded hexes; decide, do not assume, how a hero image is stored — OrganizationSettings.logo_url is a plain URLField and not an upload, for a reason its own docstring records (Story 53), so an uploaded hero image is a scope decision this task must settle explicitly. Outcome: a hero that looks intentional.

	Task: Feature, social-proof and CTA section design — Give the (now admin-managed) highlight cards, the CTA band and the footer a designed treatment — iconography, semantic colour, card depth and borders per DSN. Constraints: reuse the shared Card/Badge/Button primitives and DSN-4's semantic variants; no per-section bespoke components. Outcome: the page reads as one designed system, not five stacked defaults.

	Task: Responsive and RTL pass on the redesigned page — Verify the redesign across the breakpoints DSN-9 established for the app and in Arabic/RTL. Constraints: logical CSS properties only (npm run check:rtl enforces this in CI); verify in both light and dark themes, since the page carries a ThemeToggle. Outcome: the front door holds up on a phone and in Arabic.
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
