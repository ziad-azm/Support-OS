> **Fetched from jira:** [SUPPORTOS-125](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-125)  
> *Fetched 2026-09-06T09:31:54.064Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (LAND-3) — Social Media & Contact Presence  
**Type:** Story  
**Status:** In Progress  
**Assignee:** Ziad Hosny

### Description

As an organization admin, I want to manage the social and contact links shown on the public site, so that visitors can reach us on the channels we actually use. Description: There is no social or contact presence on the landing page today — the footer renders only footer.copyright, and the hero's secondary CTA points at /contact, a route whose current content should be confirmed as part of this story rather than assumed. Which networks an organization uses is exactly the kind of per-deployment list that must not be hard-coded. Dependencies: LAND-2 (public content endpoint).

	Task: Social link model + admin management — Implement an ordered, admin-managed list of social and contact links (platform, URL, sort order, enabled flag) served through LAND-2's public read path. Constraints: a real model with a fixed platform choice set mapped to curated lucide-react icons — not a JSONField (see CONVENTIONS.md § 33) and not free-text icon names; validate URLs server-side; an empty list must render no social row at all rather than an empty shell. Outcome: an admin turns channels on and off without a deploy.

	Task: Social & contact block on the landing page — Render the enabled links in the landing footer, and wherever DSN guidance places them in LAND-4's redesign, with accessible labels — an icon-only link needs an aria-label or a visible text alternative, per DSN-2's accessibility bar. Constraints: reuse UI primitives and I18N; external links open safely (rel="noopener noreferrer"); verify the layout in RTL, which check:rtl enforces in CI. Outcome: a visitor can find the organization off-site.

	Task: Reconcile the /contact CTA — Confirm what /contact currently renders (the hero's secondary "Get a demo" CTA at LandingPage.tsx:56 links to it) and make it consistent with the admin-managed contact details from this story — either wiring the real contact channels into it or repointing the CTA. Constraints: resolve by inspection first; do not assume the route is missing or complete. Outcome: no CTA on the front door leads somewhere unfinished.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/public-landing-page/SUPPORTOS-125/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `public-landing-page`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-125` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `In Progress`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(LAND-3) — Social Media & Contact Presence
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an organization admin, I want to manage the social and contact links shown on the public site, so that visitors can reach us on the channels we actually use. Description: There is no social or contact presence on the landing page today — the footer renders only footer.copyright, and the hero's secondary CTA points at /contact, a route whose current content should be confirmed as part of this story rather than assumed. Which networks an organization uses is exactly the kind of per-deployment list that must not be hard-coded. Dependencies: LAND-2 (public content endpoint).

	Task: Social link model + admin management — Implement an ordered, admin-managed list of social and contact links (platform, URL, sort order, enabled flag) served through LAND-2's public read path. Constraints: a real model with a fixed platform choice set mapped to curated lucide-react icons — not a JSONField (see CONVENTIONS.md § 33) and not free-text icon names; validate URLs server-side; an empty list must render no social row at all rather than an empty shell. Outcome: an admin turns channels on and off without a deploy.

	Task: Social & contact block on the landing page — Render the enabled links in the landing footer, and wherever DSN guidance places them in LAND-4's redesign, with accessible labels — an icon-only link needs an aria-label or a visible text alternative, per DSN-2's accessibility bar. Constraints: reuse UI primitives and I18N; external links open safely (rel="noopener noreferrer"); verify the layout in RTL, which check:rtl enforces in CI. Outcome: a visitor can find the organization off-site.

	Task: Reconcile the /contact CTA — Confirm what /contact currently renders (the hero's secondary "Get a demo" CTA at LandingPage.tsx:56 links to it) and make it consistent with the admin-managed contact details from this story — either wiring the real contact channels into it or repointing the CTA. Constraints: resolve by inspection first; do not assume the route is missing or complete. Outcome: no CTA on the front door leads somewhere unfinished.
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
