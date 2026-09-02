# integrations — plan overview

Entry point for the **integrations** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 80 | [80-story-public-rest-api-docs-SUPPORTOS-89.md](80-story-public-rest-api-docs-SUPPORTOS-89.md) | Public REST API & Docs (INT-1) | SUPPORTOS-89 | `AUTH-1`/`AUTH-2` (complete) — no `integrations` story |

## Dependency notes

`EPIC 14` (`SupportOs backlog.MD` lines 858-882) is four stories; **only `INT-1` is
planned so far.**

Story 80 (`INT-1`, `SUPPORTOS-89`) is the app's first real code — `apps/integrations/`
is a bare `startapp` scaffold until it lands — and it is the story every later
`integrations` story reads first, for two reasons:

- **It establishes external auth once.** `apps/integrations/authentication.py::ApiKeyAuthentication`
  resolves a key to an `accounts.User` and lets the existing `AUTHZ` stack
  (`apps/core/permissions.py`, [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md))
  do all authorization. `CONVENTIONS.md` § 29 records the standing rule that follows
  from it: **an API key is an identity, not a permission set** — no story may add a
  per-key scope list.
- **It establishes how this API documents itself.** `drf-spectacular` plus
  `apps/integrations/schema.py::envelope_postprocessing_hook` and
  `DefaultPageNumberPagination.get_paginated_response_schema` mean a later story's
  endpoint is documented correctly by simply existing in a router. A story whose view
  returns something other than a serializer annotates that view with
  `extend_schema`; it never adds a second post-processing hook.

Still unplanned in this epic:

- `INT-2` (ERP Integration, backlog line 868) — depends on `CUST-1` and `SLA-0` (both
  complete); needs an async sync service and a field-mapping config **UI**.
- `INT-3` (Messaging Providers Config, line 874) — depends on `COMM-1`/`COMM-2`/`COMM-4`
  (all complete); moves the `EMAIL_*`/`WHATSAPP_*`/`SMS_*` credentials currently read
  from `ENV` in `config/settings/base.py` into a secured central config with a **UI**.
- `INT-4` (Outbound Webhooks, line 880) — depends on `SLA-0` (complete); event
  subscriptions dispatched asynchronously, with a **UI**.

Two follow-ups Story 80 deliberately leaves out and names as such (see its
`## Story Goal`): per-key rate limiting (a throttle scope keyed on `request.auth`), and
an audit trail for key issuance/revocation (which would need a third nullable FK on
`accounts.AuditLog` — see `CONVENTIONS.md` § 22).
