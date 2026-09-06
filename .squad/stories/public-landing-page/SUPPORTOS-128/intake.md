> **Fetched from jira:** [SUPPORTOS-128](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-128)  
> *Fetched 2026-09-06T09:32:42.621Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (MOTION-0) — Shared Motion Foundation  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a developer, I want one shared motion vocabulary, so that animation across the app is consistent, accessible and not reinvented per screen. Description: LAND-1 introduced this app's only motion — Reveal.tsx (56 lines, a scroll-triggered reveal) and an inline animate-in fade-in slide-in-from-bottom-4 duration-700 on the hero — as landing-page-local code. tw-animate-css is already a devDependency, so the primitive layer exists; what does not exist is a shared decision about durations, easings, which interactions animate, and how prefers-reduced-motion is honoured app-wide. DSN-8 polished interaction states but never defined motion. Dependencies: DSN, UI, LAND-1.

	Task: Motion tokens & reduced-motion policy 🔑 (every later animation consumes this) — Define a small motion scale (durations, easings, distances) as design tokens extending DSN, plus a single documented prefers-reduced-motion strategy applied once rather than per component. Constraints: check tw-animate-css and Tailwind v4's built-ins before adding any animation dependency — the same "check for an existing animation utility first" constraint LAND-1 was given (CONVENTIONS.md § 0/§ 17); record the outcome in CONVENTIONS.md and design-system/supportos/MASTER.md so it is discoverable. Outcome: one motion vocabulary, reduced-motion respected everywhere by construction.

	Task: Promote Reveal to a shared primitive — Move features/landing/components/Reveal.tsx into the shared UI layer and re-express it on the motion tokens. Constraints: keep the landing page's current behaviour identical after the move; no feature-local copies left behind. Outcome: scroll-reveal is available to any screen instead of one feature.

	Task: App-wide micro-interaction pass — Apply the motion foundation to the interactions that already exist: route and page transitions, dialog and sheet enter/exit, toast entrance, dropdown and popover motion, table row and skeleton loading states, button press feedback. Constraints: shared-component level only — animate the UI primitives once so every consumer inherits it, never per feature screen; motion must not delay perceived interactivity or fight DSN-8's pending/disabled states; nothing moves under prefers-reduced-motion: reduce. Outcome: the whole app feels responsive and alive, from one change set.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/public-landing-page/SUPPORTOS-128/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `public-landing-page`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-128` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(MOTION-0) — Shared Motion Foundation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want one shared motion vocabulary, so that animation across the app is consistent, accessible and not reinvented per screen. Description: LAND-1 introduced this app's only motion — Reveal.tsx (56 lines, a scroll-triggered reveal) and an inline animate-in fade-in slide-in-from-bottom-4 duration-700 on the hero — as landing-page-local code. tw-animate-css is already a devDependency, so the primitive layer exists; what does not exist is a shared decision about durations, easings, which interactions animate, and how prefers-reduced-motion is honoured app-wide. DSN-8 polished interaction states but never defined motion. Dependencies: DSN, UI, LAND-1.

	Task: Motion tokens & reduced-motion policy 🔑 (every later animation consumes this) — Define a small motion scale (durations, easings, distances) as design tokens extending DSN, plus a single documented prefers-reduced-motion strategy applied once rather than per component. Constraints: check tw-animate-css and Tailwind v4's built-ins before adding any animation dependency — the same "check for an existing animation utility first" constraint LAND-1 was given (CONVENTIONS.md § 0/§ 17); record the outcome in CONVENTIONS.md and design-system/supportos/MASTER.md so it is discoverable. Outcome: one motion vocabulary, reduced-motion respected everywhere by construction.

	Task: Promote Reveal to a shared primitive — Move features/landing/components/Reveal.tsx into the shared UI layer and re-express it on the motion tokens. Constraints: keep the landing page's current behaviour identical after the move; no feature-local copies left behind. Outcome: scroll-reveal is available to any screen instead of one feature.

	Task: App-wide micro-interaction pass — Apply the motion foundation to the interactions that already exist: route and page transitions, dialog and sheet enter/exit, toast entrance, dropdown and popover motion, table row and skeleton loading states, button press feedback. Constraints: shared-component level only — animate the UI primitives once so every consumer inherits it, never per feature screen; motion must not delay perceived interactivity or fight DSN-8's pending/disabled states; nothing moves under prefers-reduced-motion: reduce. Outcome: the whole app feels responsive and alive, from one change set.
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
