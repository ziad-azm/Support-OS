> **Fetched from jira:** [SUPPORTOS-136](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-136)  
> *Fetched 2026-09-11T19:01:33.441Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (SEC-10) — Data Retention & Data-Subject Rights (PDPL / GDPR)  
**Type:** Story  
**Status:** Done  
**Assignee:** Ziad Hosny

### Description

As a compliance owner, I want retention limits and a way to export or erase a person's data, so that the product can be operated lawfully. Description: Verified gap: no retention, anonymization, export or erasure story exists anywhere in this backlog. The system stores customer names, emails, phone numbers, conversation transcripts and attachments indefinitely, with no defined lifetime. SEC-6 deletes a staff user account; it does not address a customer's personal data, which is the regulated category. Saudi PDPL — and GDPR for any EU-resident contact — both require a defined retention period and a means of honouring access and erasure requests. Dependencies: SEC-3, SEC-4, CUST-1, SLA-0.

	Task: Retention policy + scheduled purge/anonymization job — Implement configurable retention periods per data class (closed tickets, conversation messages, attachments, audit entries) and a scheduled job (via SLA-0) that anonymizes or purges past the limit. Constraints: anonymize in place where a record must survive for reporting, so RPT-* aggregates do not break; purging is irreversible and audited. Outcome: personal data has a defined, enforced lifetime.

	Task: Data-subject export & erasure for a customer — Implement an admin action producing a machine-readable export of everything held about one Customer (profile, tickets, messages, attachments, feedback), and a corresponding erasure action. Constraints: gate on a dedicated permission via AUTHZ; both actions write to SEC-3's audit log; erasure must respect any legal-hold or retention override. Outcome: access and erasure requests can be honoured without direct database work.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/security-administration/SUPPORTOS-136/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `security-administration`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-136` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `Done`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(SEC-10) — Data Retention & Data-Subject Rights (PDPL / GDPR)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a compliance owner, I want retention limits and a way to export or erase a person's data, so that the product can be operated lawfully. Description: Verified gap: no retention, anonymization, export or erasure story exists anywhere in this backlog. The system stores customer names, emails, phone numbers, conversation transcripts and attachments indefinitely, with no defined lifetime. SEC-6 deletes a staff user account; it does not address a customer's personal data, which is the regulated category. Saudi PDPL — and GDPR for any EU-resident contact — both require a defined retention period and a means of honouring access and erasure requests. Dependencies: SEC-3, SEC-4, CUST-1, SLA-0.

	Task: Retention policy + scheduled purge/anonymization job — Implement configurable retention periods per data class (closed tickets, conversation messages, attachments, audit entries) and a scheduled job (via SLA-0) that anonymizes or purges past the limit. Constraints: anonymize in place where a record must survive for reporting, so RPT-* aggregates do not break; purging is irreversible and audited. Outcome: personal data has a defined, enforced lifetime.

	Task: Data-subject export & erasure for a customer — Implement an admin action producing a machine-readable export of everything held about one Customer (profile, tickets, messages, attachments, feedback), and a corresponding erasure action. Constraints: gate on a dedicated permission via AUTHZ; both actions write to SEC-3's audit log; erasure must respect any legal-hold or retention override. Outcome: access and erasure requests can be honoured without direct database work.
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
