> **Fetched from jira:** [SUPPORTOS-67](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-67)  
> *Fetched 2026-08-28T11:50:31.529Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (DSN-0) — Design Intelligence Foundation  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

As a developer, I want an AI-generated design system tailored to a customer-support SaaS product, so that all future UI work reuses a consistent, justified set of design decisions instead of ad-hoc choices.

	Task: Generate tailored design system via ui-ux-pro-max skill 🔑 (reused by Knowledge Base, Portal, Reports charts, Branding) — Run the skill against SupportOS's product type (B2B customer-support platform) to produce a recommended UI style, color palette, typography pairing, layout patterns, and anti-patterns to avoid. Codify the output as the DSN shared spec, extending UI (does not replace it). Outcome: one authoritative, reusable design-system spec.

	Task: Reconcile DSN with existing UI tokens — Map the generated palette/typography onto the existing Tailwind/shadcn tokens from EPIC 1; document any deltas and how they're resolved. Constraints: no visual regression without an explicit decision. Outcome: DSN and UI stay in sync, not competing sources of truth.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-67/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `design-intelligence-ui-ux-system`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-67` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(DSN-0) — Design Intelligence Foundation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a developer, I want an AI-generated design system tailored to a customer-support SaaS product, so that all future UI work reuses a consistent, justified set of design decisions instead of ad-hoc choices.

	Task: Generate tailored design system via ui-ux-pro-max skill 🔑 (reused by Knowledge Base, Portal, Reports charts, Branding) — Run the skill against SupportOS's product type (B2B customer-support platform) to produce a recommended UI style, color palette, typography pairing, layout patterns, and anti-patterns to avoid. Codify the output as the DSN shared spec, extending UI (does not replace it). Outcome: one authoritative, reusable design-system spec.

	Task: Reconcile DSN with existing UI tokens — Map the generated palette/typography onto the existing Tailwind/shadcn tokens from EPIC 1; document any deltas and how they're resolved. Constraints: no visual regression without an explicit decision. Outcome: DSN and UI stay in sync, not competing sources of truth.
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
