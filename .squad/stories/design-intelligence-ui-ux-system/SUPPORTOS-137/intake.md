> **Fetched from jira:** [SUPPORTOS-137](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-137)  
> *Fetched 2026-09-11T19:04:40.095Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-15) — Form Presentation: Dialog vs Full Page  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As a user, I want the interface to respond with motion that feels considered rather than absent, so that state changes read as cause and effect instead of sudden replacement. Description: MOTION-0 delivered the foundation and it is genuinely good — a documented 150/200/300ms scale plus --motion-reveal (frontend/src/index.css), a single prefers-reduced-motion: reduce policy, and Reveal promoted to shared/ui/Reveal.tsx. What it did not finish is its own third task, the app-wide micro-interaction pass. Measured across the shared primitives: dialog.tsx carries 1 duration/motion reference, dropdown-menu.tsx 2, select.tsx 2, ToastProvider.tsx 1, and ConfirmProvider.tsx 0. There is no route or page transition anywhere — a grep of app/ for any transition mechanism returns nothing, so every navigation is an instant hard swap. There are also no sheet, popover or tooltip primitives at all, so three of the surfaces MOTION-0's task list named do not yet exist to animate. This story finishes the pass to a senior bar and is explicitly not a licence to add decorative animation. Dependencies: MOTION-0, DSN-8, UI.

	Task: Finish the primitive-level motion pass — Apply the motion tokens to every shared primitive that still has none or nearly none: dialog and alert-dialog enter/exit, dropdown, select, tabs, checkbox/switch/radio state changes, button press feedback, and the confirm dialog (currently zero). Constraints: shared-component level only — animate the primitive once so every consumer inherits it, never per feature screen; transform and opacity only, never animating layout properties (width/height/top/left) which force reflow and drop frames; nothing exceeds the 300ms ceiling MOTION-0 set; nothing moves under prefers-reduced-motion: reduce. Outcome: every interactive primitive responds visibly, from one change set.

	Task: Route and page transition — Introduce a single, restrained route transition so navigation reads as movement rather than replacement. Constraints: it must never delay perceived interactivity — content is interactive the moment it paints, the transition is decoration over it, not a gate in front of it; must not fight DSN-8's pending/skeleton states or double up with them; must be direction-correct under RTL per I18N; check the browser View Transition API and what React Router already offers before adding any dependency (CONVENTIONS.md § 0/§ 17), matching the constraint LAND-1 and MOTION-0 were both given. Outcome: navigation feels continuous instead of abrupt.

	Task: Data-state motion — lists, tables and loading — Animate the transitions the app makes constantly and currently makes instantly: skeleton→content handoff (cross-fade, not a hard swap), row enter/exit when a list filters or a TKT-7 bulk action removes rows, optimistic-update settle, and empty→populated state changes. Constraints: motion must be cheap at list scale — a 25-row table must not animate 25 elements independently if a container-level transition reads the same; must not shift layout while a user is reading or clicking; reuse DSN-8's existing state components rather than introducing parallel ones. Outcome: data changes read as changes, not as flicker.

	Task: Motion quality pass — Walk the whole app and verify the result to a craft standard rather than a checklist: no animation exceeding its token's duration, no two overlapping animations fighting for the same element, no motion on an element the user is actively interacting with, no cumulative layout shift introduced, correct behaviour in both LTR and RTL, and a genuine full stop under prefers-reduced-motion: reduce (not merely a shortened duration). Constraints: reuse DSN-13's verification route set; record any deliberate exception in CONVENTIONS.md beside the motion tokens. Outcome: motion that a senior front-end reviewer would sign off, verified on real screens.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-137/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-137` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-15) — Form Presentation: Dialog vs Full Page
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want the interface to respond with motion that feels considered rather than absent, so that state changes read as cause and effect instead of sudden replacement. Description: MOTION-0 delivered the foundation and it is genuinely good — a documented 150/200/300ms scale plus --motion-reveal (frontend/src/index.css), a single prefers-reduced-motion: reduce policy, and Reveal promoted to shared/ui/Reveal.tsx. What it did not finish is its own third task, the app-wide micro-interaction pass. Measured across the shared primitives: dialog.tsx carries 1 duration/motion reference, dropdown-menu.tsx 2, select.tsx 2, ToastProvider.tsx 1, and ConfirmProvider.tsx 0. There is no route or page transition anywhere — a grep of app/ for any transition mechanism returns nothing, so every navigation is an instant hard swap. There are also no sheet, popover or tooltip primitives at all, so three of the surfaces MOTION-0's task list named do not yet exist to animate. This story finishes the pass to a senior bar and is explicitly not a licence to add decorative animation. Dependencies: MOTION-0, DSN-8, UI.

	Task: Finish the primitive-level motion pass — Apply the motion tokens to every shared primitive that still has none or nearly none: dialog and alert-dialog enter/exit, dropdown, select, tabs, checkbox/switch/radio state changes, button press feedback, and the confirm dialog (currently zero). Constraints: shared-component level only — animate the primitive once so every consumer inherits it, never per feature screen; transform and opacity only, never animating layout properties (width/height/top/left) which force reflow and drop frames; nothing exceeds the 300ms ceiling MOTION-0 set; nothing moves under prefers-reduced-motion: reduce. Outcome: every interactive primitive responds visibly, from one change set.

	Task: Route and page transition — Introduce a single, restrained route transition so navigation reads as movement rather than replacement. Constraints: it must never delay perceived interactivity — content is interactive the moment it paints, the transition is decoration over it, not a gate in front of it; must not fight DSN-8's pending/skeleton states or double up with them; must be direction-correct under RTL per I18N; check the browser View Transition API and what React Router already offers before adding any dependency (CONVENTIONS.md § 0/§ 17), matching the constraint LAND-1 and MOTION-0 were both given. Outcome: navigation feels continuous instead of abrupt.

	Task: Data-state motion — lists, tables and loading — Animate the transitions the app makes constantly and currently makes instantly: skeleton→content handoff (cross-fade, not a hard swap), row enter/exit when a list filters or a TKT-7 bulk action removes rows, optimistic-update settle, and empty→populated state changes. Constraints: motion must be cheap at list scale — a 25-row table must not animate 25 elements independently if a container-level transition reads the same; must not shift layout while a user is reading or clicking; reuse DSN-8's existing state components rather than introducing parallel ones. Outcome: data changes read as changes, not as flicker.

	Task: Motion quality pass — Walk the whole app and verify the result to a craft standard rather than a checklist: no animation exceeding its token's duration, no two overlapping animations fighting for the same element, no motion on an element the user is actively interacting with, no cumulative layout shift introduced, correct behaviour in both LTR and RTL, and a genuine full stop under prefers-reduced-motion: reduce (not merely a shortened duration). Constraints: reuse DSN-13's verification route set; record any deliberate exception in CONVENTIONS.md beside the motion tokens. Outcome: motion that a senior front-end reviewer would sign off, verified on real screens.
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
