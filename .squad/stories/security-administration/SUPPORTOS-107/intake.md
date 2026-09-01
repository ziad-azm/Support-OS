> **Fetched from jira:** [SUPPORTOS-107](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-107)  
> *Fetched 2026-09-01T18:26:42.363Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SEC-5) — New User Invitation & First-Login Password Setup  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

As a newly-added staff member, I want to set my own password the first time I sign in, so that my credentials are never known to anyone else. Description: Moved here from the former Account Lifecycle & Credential Management epic (was ACCT-1) — it extends this epic's own SEC-1 screen directly. Verified gap: UserAdminSerializer/UserFormPage.tsx's create form has a required password field the admin fills in directly — there is no invite email, no temporary/forced-reset password, and no self-service "set your password" step. The admin ends up knowing (and having to relay out-of-band) every new user's first password. This story replaces that with an invite: the admin creates the account with no password, the new user gets a signed, time-limited "set your password" link by email, and the account stays unusable until they do. Dependencies: SEC-1, SLA-4 (email delivery), AUTH-1.

	Task: Backend invite issuance & first-password-set endpoint 🔑 (the token mechanism the Password Self-Service epic's forgot-password story reuses) — Implement UserAdminSerializer's create path so a new User is created with an unusable password and is_active=False (or an equivalent "pending" state) until first login is completed; issue a signed, time-limited invite token sent via SLA-4's email delivery; add a confirm endpoint (token + new password) that sets the password and activates the account, through the standard API envelope/error model. Constraints: token single-use and expiring; reuse SLA-4's email delivery — no second email-sending mechanism. Outcome: a new account is unusable until its owner sets their own password.

	Task: Frontend invite-confirm UI & admin-form update — Implement a "set your password" page (opened from the emailed link) via FORM; update UserFormPage.tsx's create form to drop the direct password field, since the admin no longer sets one. Outcome: admins create accounts without ever handling a new user's password.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/security-administration/SUPPORTOS-107/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `security-administration`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-107` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SEC-5) — New User Invitation & First-Login Password Setup
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a newly-added staff member, I want to set my own password the first time I sign in, so that my credentials are never known to anyone else. Description: Moved here from the former Account Lifecycle & Credential Management epic (was ACCT-1) — it extends this epic's own SEC-1 screen directly. Verified gap: UserAdminSerializer/UserFormPage.tsx's create form has a required password field the admin fills in directly — there is no invite email, no temporary/forced-reset password, and no self-service "set your password" step. The admin ends up knowing (and having to relay out-of-band) every new user's first password. This story replaces that with an invite: the admin creates the account with no password, the new user gets a signed, time-limited "set your password" link by email, and the account stays unusable until they do. Dependencies: SEC-1, SLA-4 (email delivery), AUTH-1.

	Task: Backend invite issuance & first-password-set endpoint 🔑 (the token mechanism the Password Self-Service epic's forgot-password story reuses) — Implement UserAdminSerializer's create path so a new User is created with an unusable password and is_active=False (or an equivalent "pending" state) until first login is completed; issue a signed, time-limited invite token sent via SLA-4's email delivery; add a confirm endpoint (token + new password) that sets the password and activates the account, through the standard API envelope/error model. Constraints: token single-use and expiring; reuse SLA-4's email delivery — no second email-sending mechanism. Outcome: a new account is unusable until its owner sets their own password.

	Task: Frontend invite-confirm UI & admin-form update — Implement a "set your password" page (opened from the emailed link) via FORM; update UserFormPage.tsx's create form to drop the direct password field, since the admin no longer sets one. Outcome: admins create accounts without ever handling a new user's password.
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
