> **Fetched from jira:** [SUPPORTOS-110](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-110)  
> *Fetched 2026-09-01T18:27:16.507Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SEC-8) — Change Password  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

As a signed-in user, I want to change my own password, so that I can update my credentials without having to forget them first. Description: Moved here from the now-removed Password Self-Service epic (was ACCT-2). Verified gap: PreferencesPage.tsx (the personal, ungated settings screen every authenticated user reaches) has only language and theme — no password field at all. This is the one credential action that doesn't require a token/email round-trip, since the user is already authenticated; it belongs beside SEC-7, not folded into it. Dependencies: AUTH-1, FORM.

	Task: Change-password endpoint — Implement a POST action (current password + new password) on the authenticated user's own account, through the standard API envelope/error model. Constraints: require the current password; reuse AUTHZ's existing password-hashing/validation, no new mechanism. Outcome: a signed-in user can change their password directly.

	Task: Change-password UI in Preferences — Add a change-password form to PreferencesPage.tsx via FORM, alongside the existing language/theme controls. Outcome: one place for every personal account setting, credentials included.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/security-administration/SUPPORTOS-110/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `security-administration`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-110` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SEC-8) — Change Password
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a signed-in user, I want to change my own password, so that I can update my credentials without having to forget them first. Description: Moved here from the now-removed Password Self-Service epic (was ACCT-2). Verified gap: PreferencesPage.tsx (the personal, ungated settings screen every authenticated user reaches) has only language and theme — no password field at all. This is the one credential action that doesn't require a token/email round-trip, since the user is already authenticated; it belongs beside SEC-7, not folded into it. Dependencies: AUTH-1, FORM.

	Task: Change-password endpoint — Implement a POST action (current password + new password) on the authenticated user's own account, through the standard API envelope/error model. Constraints: require the current password; reuse AUTHZ's existing password-hashing/validation, no new mechanism. Outcome: a signed-in user can change their password directly.

	Task: Change-password UI in Preferences — Add a change-password form to PreferencesPage.tsx via FORM, alongside the existing language/theme controls. Outcome: one place for every personal account setting, credentials included.
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
