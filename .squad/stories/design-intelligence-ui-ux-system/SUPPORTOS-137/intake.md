> **Fetched from jira:** [SUPPORTOS-137](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-137)  
> *Fetched 2026-09-12T11:25:17.492Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-15) — Form Presentation: Dialog vs Full Page  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a user, I want a short form to open in place rather than throwing me onto another screen, so that I keep my list, my filters and my scroll position. Description: Verified against current code, and the imbalance is total: the app has 17 full-page form routes — RoleFormPage, UserFormPage, CustomerFormPage, ArticleFormPage, CategoryFormPage (two of them), FaqFormPage, BranchFormPage, DepartmentFormPage, LandingHighlightFormPage, LandingSocialLinkFormPage, PortalFeedbackFormPage, PortalTicketFormPage, TaskFormPage, TicketFormPage, WebFormPage, WebhookSubscriptionFormPage — and zero dialogs anywhere in features/. The dialog.tsx primitive exists and is fully built, but its only consumer in the entire codebase is shared/ui/confirm/ConfirmProvider.tsx; no form has ever used it. So a two-field form like Department (name + description) or Category (name) costs a full route change, a fresh page mount, and the loss of the list's filters and scroll position — the same cost as editing a whole ticket. DSN-10 fixed validation and error UX inside forms and never asked where a form should appear; DSN-11 reviewed navigation structure, not form presentation. This is the uncovered half. Dependencies: DSN-10, DSN-11, UI, FORM.

	Task: Decide and document the presentation rule 🔑 (every later form follows it) — Establish, and record in CONVENTIONS.md beside the FORM conventions, when a form is a dialog (few fields, single entity, no nested navigation — e.g. Category, Department, Branch, FAQ, Quick Reply, Landing highlight/social link), when it stays a full page (many fields, multi-section, file upload, or a form a user deep-links and shares — e.g. Ticket, Article, User, Webhook subscription), and whether a sheet/drawer tier is worth introducing at all for the middle ground. Constraints: this is a written rule with worked examples, not per-screen taste; decide the sheet question explicitly rather than leaving it open — a third tier nobody can define the boundary of is worse than two clear ones. Outcome: a rule any future form obeys without re-litigating it.

	Task: Shared FormDialog pattern 🔑 (all dialog forms inherit) — Build one shared wrapper over the existing dialog.tsx primitive that composes with FORM (RHF+Zod) and inherits every DSN-10 behaviour — validation timing, error summary, focus-to-first-error, submit/pending/disabled states — so a dialog form is not a second, weaker form implementation. Constraints: must not fork FORM; correct focus trap and initial-focus per DSN-2; RTL-correct per I18N; Escape/overlay-dismiss must run the same unsaved-changes guard as a cancel button, never silently discard input. Outcome: a dialog form is exactly as good as a page form, from one component.

	Task: Migrate the qualifying forms, without breaking their routes — Convert the forms the rule classifies as dialogs, opening them over their list screen. Constraints, and this is the load-bearing one: the existing routes must keep working. /categories/new, /departments/:id/edit and friends are bookmarkable, shareable, and reachable from DSN-11's navigation — a direct hit on one of those URLs must still render the form (over its list, or standalone), and closing the dialog must restore the list URL rather than pushing a dead history entry. Preserve every existing permission gate and useConfirm() interaction untouched. Outcome: short forms open in place while every existing URL, deep link and back-button path still behaves.

	Task: Verify against the surfaces this affects — Re-check the migrated screens for the register's existing concerns: mobile behaviour per DSN-9 (a dialog on a 375px viewport is a different problem from a dialog on a desktop), keyboard-only operation, and screen-reader announcement of the dialog. Constraints: reuse DSN-13's verification route set; no new audit register. Outcome: the new pattern is confirmed on real screens, not assumed from the component.

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
- **Status:** `Done`
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
As a user, I want a short form to open in place rather than throwing me onto another screen, so that I keep my list, my filters and my scroll position. Description: Verified against current code, and the imbalance is total: the app has 17 full-page form routes — RoleFormPage, UserFormPage, CustomerFormPage, ArticleFormPage, CategoryFormPage (two of them), FaqFormPage, BranchFormPage, DepartmentFormPage, LandingHighlightFormPage, LandingSocialLinkFormPage, PortalFeedbackFormPage, PortalTicketFormPage, TaskFormPage, TicketFormPage, WebFormPage, WebhookSubscriptionFormPage — and zero dialogs anywhere in features/. The dialog.tsx primitive exists and is fully built, but its only consumer in the entire codebase is shared/ui/confirm/ConfirmProvider.tsx; no form has ever used it. So a two-field form like Department (name + description) or Category (name) costs a full route change, a fresh page mount, and the loss of the list's filters and scroll position — the same cost as editing a whole ticket. DSN-10 fixed validation and error UX inside forms and never asked where a form should appear; DSN-11 reviewed navigation structure, not form presentation. This is the uncovered half. Dependencies: DSN-10, DSN-11, UI, FORM.

	Task: Decide and document the presentation rule 🔑 (every later form follows it) — Establish, and record in CONVENTIONS.md beside the FORM conventions, when a form is a dialog (few fields, single entity, no nested navigation — e.g. Category, Department, Branch, FAQ, Quick Reply, Landing highlight/social link), when it stays a full page (many fields, multi-section, file upload, or a form a user deep-links and shares — e.g. Ticket, Article, User, Webhook subscription), and whether a sheet/drawer tier is worth introducing at all for the middle ground. Constraints: this is a written rule with worked examples, not per-screen taste; decide the sheet question explicitly rather than leaving it open — a third tier nobody can define the boundary of is worse than two clear ones. Outcome: a rule any future form obeys without re-litigating it.

	Task: Shared FormDialog pattern 🔑 (all dialog forms inherit) — Build one shared wrapper over the existing dialog.tsx primitive that composes with FORM (RHF+Zod) and inherits every DSN-10 behaviour — validation timing, error summary, focus-to-first-error, submit/pending/disabled states — so a dialog form is not a second, weaker form implementation. Constraints: must not fork FORM; correct focus trap and initial-focus per DSN-2; RTL-correct per I18N; Escape/overlay-dismiss must run the same unsaved-changes guard as a cancel button, never silently discard input. Outcome: a dialog form is exactly as good as a page form, from one component.

	Task: Migrate the qualifying forms, without breaking their routes — Convert the forms the rule classifies as dialogs, opening them over their list screen. Constraints, and this is the load-bearing one: the existing routes must keep working. /categories/new, /departments/:id/edit and friends are bookmarkable, shareable, and reachable from DSN-11's navigation — a direct hit on one of those URLs must still render the form (over its list, or standalone), and closing the dialog must restore the list URL rather than pushing a dead history entry. Preserve every existing permission gate and useConfirm() interaction untouched. Outcome: short forms open in place while every existing URL, deep link and back-button path still behaves.

	Task: Verify against the surfaces this affects — Re-check the migrated screens for the register's existing concerns: mobile behaviour per DSN-9 (a dialog on a 375px viewport is a different problem from a dialog on a desktop), keyboard-only operation, and screen-reader announcement of the dialog. Constraints: reuse DSN-13's verification route set; no new audit register. Outcome: the new pattern is confirmed on real screens, not assumed from the component.
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
