> **Fetched from jira:** [SUPPORTOS-124](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-124)  
> *Fetched 2026-09-06T09:27:08.182Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (LAND-2) — Editable Landing Content (Admin CMS)  
**Type:** Story  
**Status:** To Do

### Description

As an organization admin, I want to edit the landing page's headline, value proposition, feature highlights and calls to action from inside the app, so that I can change how SupportOS introduces itself without a developer, a rebuild or a deploy. Description: The content model is the whole story here, and two existing constraints decide its shape before any UI is drawn. First, bilingual: every landing string today exists twice, in landing/locales/en.json and ar.json — an admin-editable version must store both locales per field, or the Arabic side of the page silently freezes while the English side becomes editable. Second, public read: the landing page has no session, and OrganizationSettings's own docstring records why that matters — primary_color "is read publicly through BrandingView, unlike every other field here … That is why the public serializer is a separate, narrower class." Landing content joins primary_color as deliberately-public data and must go through that same narrow public path, never by widening OrganizationSettingsSerializer. Dependencies: SEC-4 (OrganizationSettings singleton), ORG-3 (BrandingView public read path), I18N, FORM.

	Task: Landing content model + public read endpoint 🔑 (every later landing-CMS task reads through this) — Implement per-locale storage for the landing page's editable copy (hero headline, value proposition, both CTA labels and targets, the CTA band, footer text), exposed on a public, unauthenticated read path and written only under settings.manage. Constraints: extend the existing public BrandingView/BrandingSerializer surface (apps/organization/) or add a sibling public view next to it — do not widen OrganizationSettingsSerializer, which is admin-only by design; store English and Arabic as separate fields per string, mirroring the title_en/title_ar/body_en/body_ar split the knowledge_base Article model already establishes, rather than inventing a second bilingual pattern; blank means "fall back to the shipped landing/locales default", never "render empty". Outcome: one public content endpoint the landing page reads, and one admin-writable record behind it.

	Task: Landing page reads content from the API with bundle fallback — Rewire LandingPage.tsx to render admin-set copy when present and the existing {{landing/locales/
{en,ar}
.json}} strings when not, picking the locale half that matches the active i18n language. Constraints: reuse API (TanStack Query) — the page must still render correctly (from bundle defaults) if the request fails or the org has never edited anything, since this is the first impression for an unauthenticated visitor; no loading spinner in place of the hero. Outcome: an admin edit changes the live page, and a backend hiccup degrades to today's behaviour instead of a blank front door.

	Task: Editable feature highlights — Replace the hard-coded four-entry FEATURES array (LandingPage.tsx:13-18) with an admin-managed, ordered list of highlight cards (bilingual title + description, chosen icon, sort order). Constraints: the icon must be picked from a fixed, curated lucide-react set — the icon library DSN-4 standardized on — not a free-text name an admin could break the page with; reuse the ordered-row admin pattern Department/Branch (ORG-1/ORG-2) already established; no JSONField — ORG-1 and ORG-2 deliberately promoted this codebase's last two JSON list columns to real models, and CONVENTIONS.md § 33 recorded that constraint. Outcome: an admin can add, reorder, retitle and remove landing highlights without touching code.

	Task: Landing content admin editor UI — Build the editing surface for all of the above. Constraints: this belongs on the admin /settings surface (features/organization/components/SettingsPage.tsx), correctly gated behind settings.manage — unlike DSN-14's personal-preferences case, org marketing copy is admin-only by intent, so no new ungated route; reuse FORM (RHF + Zod) and the shared field components, including DSN-10's error-summary and focus-first-error behaviour; the existing settings form is already long, so give landing content its own section or tab rather than appending fields to the org form. Outcome: one place an admin edits the public face of the product.

	Task: Live preview of unsaved landing content — Give the editor a preview so an admin can see the page as it will look before saving. Constraints: render the real LandingPage presentation components against draft form values — do not fork a second copy of the landing markup that can drift; honour the active locale and theme. Outcome: editing marketing copy is not a publish-and-hope operation.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/public-landing-page/SUPPORTOS-124/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `public-landing-page`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-124` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(LAND-2) — Editable Landing Content (Admin CMS)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an organization admin, I want to edit the landing page's headline, value proposition, feature highlights and calls to action from inside the app, so that I can change how SupportOS introduces itself without a developer, a rebuild or a deploy. Description: The content model is the whole story here, and two existing constraints decide its shape before any UI is drawn. First, bilingual: every landing string today exists twice, in landing/locales/en.json and ar.json — an admin-editable version must store both locales per field, or the Arabic side of the page silently freezes while the English side becomes editable. Second, public read: the landing page has no session, and OrganizationSettings's own docstring records why that matters — primary_color "is read publicly through BrandingView, unlike every other field here … That is why the public serializer is a separate, narrower class." Landing content joins primary_color as deliberately-public data and must go through that same narrow public path, never by widening OrganizationSettingsSerializer. Dependencies: SEC-4 (OrganizationSettings singleton), ORG-3 (BrandingView public read path), I18N, FORM.

	Task: Landing content model + public read endpoint 🔑 (every later landing-CMS task reads through this) — Implement per-locale storage for the landing page's editable copy (hero headline, value proposition, both CTA labels and targets, the CTA band, footer text), exposed on a public, unauthenticated read path and written only under settings.manage. Constraints: extend the existing public BrandingView/BrandingSerializer surface (apps/organization/) or add a sibling public view next to it — do not widen OrganizationSettingsSerializer, which is admin-only by design; store English and Arabic as separate fields per string, mirroring the title_en/title_ar/body_en/body_ar split the knowledge_base Article model already establishes, rather than inventing a second bilingual pattern; blank means "fall back to the shipped landing/locales default", never "render empty". Outcome: one public content endpoint the landing page reads, and one admin-writable record behind it.

	Task: Landing page reads content from the API with bundle fallback — Rewire LandingPage.tsx to render admin-set copy when present and the existing { {landing/locales/
{en,ar}
.json}} strings when not, picking the locale half that matches the active i18n language. Constraints: reuse API (TanStack Query) — the page must still render correctly (from bundle defaults) if the request fails or the org has never edited anything, since this is the first impression for an unauthenticated visitor; no loading spinner in place of the hero. Outcome: an admin edit changes the live page, and a backend hiccup degrades to today's behaviour instead of a blank front door.

	Task: Editable feature highlights — Replace the hard-coded four-entry FEATURES array (LandingPage.tsx:13-18) with an admin-managed, ordered list of highlight cards (bilingual title + description, chosen icon, sort order). Constraints: the icon must be picked from a fixed, curated lucide-react set — the icon library DSN-4 standardized on — not a free-text name an admin could break the page with; reuse the ordered-row admin pattern Department/Branch (ORG-1/ORG-2) already established; no JSONField — ORG-1 and ORG-2 deliberately promoted this codebase's last two JSON list columns to real models, and CONVENTIONS.md § 33 recorded that constraint. Outcome: an admin can add, reorder, retitle and remove landing highlights without touching code.

	Task: Landing content admin editor UI — Build the editing surface for all of the above. Constraints: this belongs on the admin /settings surface (features/organization/components/SettingsPage.tsx), correctly gated behind settings.manage — unlike DSN-14's personal-preferences case, org marketing copy is admin-only by intent, so no new ungated route; reuse FORM (RHF + Zod) and the shared field components, including DSN-10's error-summary and focus-first-error behaviour; the existing settings form is already long, so give landing content its own section or tab rather than appending fields to the org form. Outcome: one place an admin edits the public face of the product.

	Task: Live preview of unsaved landing content — Give the editor a preview so an admin can see the page as it will look before saving. Constraints: render the real LandingPage presentation components against draft form values — do not fork a second copy of the landing markup that can drift; honour the active locale and theme. Outcome: editing marketing copy is not a publish-and-hope operation.
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
