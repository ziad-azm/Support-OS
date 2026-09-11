> **Fetched from jira:** [SUPPORTOS-135](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-135)  
> *Fetched 2026-09-11T19:02:18.636Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SEC-9) — Two-Factor Authentication (2FA)  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As an administrator, I want staff accounts protected by a second factor, so that a leaked password alone cannot expose customer data. Description: Verified gap: the backlog has no second-factor story anywhere, and AUTH-1's JWT flow authenticates on password alone. Every staff account in this product can read customer PII, ticket history and conversation transcripts, so a stolen or reused password is a complete compromise of that data. SEC-7/SEC-8 cover changing and resetting a password, not proving a second factor. Dependencies: AUTH-1, SEC-1, FORM.

	Task: TOTP enrolment & verification — Implement time-based one-time-password enrolment (shared secret + QR provisioning URI) and a verification step inserted into the existing token-issue flow, so a 2FA-enabled account exchanges credentials for a short-lived challenge rather than a token pair. Constraints: extend AUTH-1's existing token views — do not build a second auth flow (AUTHZ, CONV); secrets stored encrypted and never returned after enrolment. Outcome: staff accounts can require a second factor at sign-in.

	Task: Recovery codes & account-recovery path — Implement single-use recovery codes issued at enrolment, plus an admin-side reset for a user who has lost their device. Constraints: recovery-code use and admin reset both write to SEC-3's audit log; an admin reset must never reveal the secret. Outcome: 2FA cannot permanently lock a legitimate user out.

	Task: 2FA UI + org-level enforcement policy — Add enrolment/disable to PreferencesPage.tsx via FORM, and an org setting (via SEC-4) to require 2FA for chosen roles. Constraints: reuse UI/I18N; enforcement is per-role, not global, so portal customers are unaffected. Outcome: an organization can mandate 2FA for staff while leaving portal logins simple.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/security-administration/SUPPORTOS-135/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `security-administration`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-135` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SEC-9) — Two-Factor Authentication (2FA)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an administrator, I want staff accounts protected by a second factor, so that a leaked password alone cannot expose customer data. Description: Verified gap: the backlog has no second-factor story anywhere, and AUTH-1's JWT flow authenticates on password alone. Every staff account in this product can read customer PII, ticket history and conversation transcripts, so a stolen or reused password is a complete compromise of that data. SEC-7/SEC-8 cover changing and resetting a password, not proving a second factor. Dependencies: AUTH-1, SEC-1, FORM.

	Task: TOTP enrolment & verification — Implement time-based one-time-password enrolment (shared secret + QR provisioning URI) and a verification step inserted into the existing token-issue flow, so a 2FA-enabled account exchanges credentials for a short-lived challenge rather than a token pair. Constraints: extend AUTH-1's existing token views — do not build a second auth flow (AUTHZ, CONV); secrets stored encrypted and never returned after enrolment. Outcome: staff accounts can require a second factor at sign-in.

	Task: Recovery codes & account-recovery path — Implement single-use recovery codes issued at enrolment, plus an admin-side reset for a user who has lost their device. Constraints: recovery-code use and admin reset both write to SEC-3's audit log; an admin reset must never reveal the secret. Outcome: 2FA cannot permanently lock a legitimate user out.

	Task: 2FA UI + org-level enforcement policy — Add enrolment/disable to PreferencesPage.tsx via FORM, and an org setting (via SEC-4) to require 2FA for chosen roles. Constraints: reuse UI/I18N; enforcement is per-role, not global, so portal customers are unaffected. Outcome: an organization can mandate 2FA for staff while leaving portal logins simple.
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
