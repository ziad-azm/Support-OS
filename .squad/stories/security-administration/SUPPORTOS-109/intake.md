> **Fetched from jira:** [SUPPORTOS-109](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-109)  
> *Fetched 2026-09-01T18:27:02.138Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SEC-7) — Forgot Password / Self-Service Reset  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

As a user, I want to reset my own password when I forget it, so that I'm not locked out waiting on an admin. Description: Moved here from the now-removed Password Self-Service epic (was ACCT-1). AUTH-1 shipped login/refresh/logout only; LoginPage's current "Locked out or forgot your password? Ask an admin to reset it" copy is the whole story today. This story adds a real self-service flow: request a reset by email, receive a time-limited link, set a new password. Shares its token mechanism with SEC-5's invite flow — one signed-token utility, two triggers (admin invite vs. self-service "forgot"). Dependencies: AUTH-1, SLA-4, SEC-5 (reuses its token utility).

	Task: Backend password-reset request & confirm endpoints — Implement a request-reset endpoint (email → signed, time-limited token, sent via SLA-4's existing email delivery, reusing SEC-5's token utility) and a confirm-reset endpoint (token + new password) through the standard API envelope/error model. Constraints: rate-limit the request endpoint; never reveal whether an email is registered; no second token/email mechanism. Outcome: secure, working self-service password reset.

	Task: Frontend forgot/reset password UI — Implement a "Forgot password?" link on LoginPage → request form (FORM) → a confirmation screen, plus a reset-confirm page (opened from the emailed link) to set a new password. Constraints: reuse FORM/UI/I18N; update LoginPage's existing admin-reset copy once this ships. Outcome: users recover access without admin involvement.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/security-administration/SUPPORTOS-109/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `security-administration`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-109` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SEC-7) — Forgot Password / Self-Service Reset
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a user, I want to reset my own password when I forget it, so that I'm not locked out waiting on an admin. Description: Moved here from the now-removed Password Self-Service epic (was ACCT-1). AUTH-1 shipped login/refresh/logout only; LoginPage's current "Locked out or forgot your password? Ask an admin to reset it" copy is the whole story today. This story adds a real self-service flow: request a reset by email, receive a time-limited link, set a new password. Shares its token mechanism with SEC-5's invite flow — one signed-token utility, two triggers (admin invite vs. self-service "forgot"). Dependencies: AUTH-1, SLA-4, SEC-5 (reuses its token utility).

	Task: Backend password-reset request & confirm endpoints — Implement a request-reset endpoint (email → signed, time-limited token, sent via SLA-4's existing email delivery, reusing SEC-5's token utility) and a confirm-reset endpoint (token + new password) through the standard API envelope/error model. Constraints: rate-limit the request endpoint; never reveal whether an email is registered; no second token/email mechanism. Outcome: secure, working self-service password reset.

	Task: Frontend forgot/reset password UI — Implement a "Forgot password?" link on LoginPage → request form (FORM) → a confirmation screen, plus a reset-confirm page (opened from the emailed link) to set a new password. Constraints: reuse FORM/UI/I18N; update LoginPage's existing admin-reset copy once this ships. Outcome: users recover access without admin involvement.
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
