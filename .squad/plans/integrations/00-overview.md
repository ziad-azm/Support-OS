# integrations — plan overview

Entry point for the **integrations** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 80 | [80-story-public-rest-api-docs-SUPPORTOS-89.md](80-story-public-rest-api-docs-SUPPORTOS-89.md) | Public REST API & Docs (INT-1) | SUPPORTOS-89 | `AUTH-1`/`AUTH-2` (complete) — no `integrations` story |
| 81 | [81-story-erp-integration-SUPPORTOS-90.md](81-story-erp-integration-SUPPORTOS-90.md) | ERP Integration (INT-2) | SUPPORTOS-90 | Story 80 (same app modules) + `CUST-1`, `SLA-0` (both complete) |

## Dependency notes

`EPIC 14` (`SupportOs backlog.MD` lines 858-882) is four stories; **`INT-1` and
`INT-2` are planned, `INT-3` and `INT-4` are not.**

**Story 80 (`INT-1`, `SUPPORTOS-89`) — implemented.** The app's first real code, and
the story every later `integrations` story reads first:

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

**Story 81 (`INT-2`, `SUPPORTOS-90`) — planned, not implemented.** Depends on Story 80
only because it appends to the same app modules (`models.py`, `serializers.py`,
`views.py`, `urls.py`, `admin.py`) — there is no runtime coupling to API keys. Its real
dependencies are `CUST-1` (Story 10, the `Customer` import target) and `SLA-0`
(Story 27, the Celery foundation), both complete. Three things it settles for the rest
of the epic, recorded as `CONVENTIONS.md` § 30:

- **A foreign system's field names are configuration, never code** — `ErpConnection`'s
  two `JSONField` maps, applied only by `apps/integrations/erp_sync.py`.
- **A field map may only target an explicit allowlist**, enforced in three places
  (model `clean()`, serializer, and `apply_field_map` itself). `Customer.external_id`
  and `Customer.user` are deliberately excluded.
- **An unconfigured integration is a no-op, not an error, and its schedule ships
  enabled** — the same two-independent-opt-ins split § 24 already records for `SLA-3`.

It also resolves a gap the backlog leaves open: **orders have no domain owner anywhere
in this project** (verified — `"order"` appears once in the whole backlog, inside
`INT-2`'s own task text), so Story 81 introduces them as ERP-owned, read-only
reference data (`ErpOrder`), never as a SupportOS-managed entity.

Still unplanned in this epic:

- `INT-3` (Messaging Providers Config, line 876) — depends on `COMM-1`/`COMM-2`/`COMM-4`
  (all complete); moves the `EMAIL_*`/`WHATSAPP_*`/`SMS_*` credentials currently read
  from `ENV` in `config/settings/base.py` into a secured central config with a **UI**.
  **It inherits two open questions from Story 81**: whether `ErpConnection`'s singleton
  shape should be promoted to a per-provider row (Story 81 declined to do so
  speculatively), and encryption at rest for a stored credential — Story 81's
  `ErpConnection.auth_token` is plain text and write-only, and its § 30 names `INT-3`
  as the owner of that decision.
- `INT-4` (Outbound Webhooks, line 880) — depends on `SLA-0` (complete); event
  subscriptions dispatched asynchronously, with a **UI**. Reuses Story 81's
  `apps/integrations/tasks.py` home and, for the outbound HTTP itself, the same
  stdlib-`urllib` client shape (this project has no `requests`/`httpx` dependency).

Follow-ups the two planned stories deliberately leave out and name as such:

- **Per-key rate limiting** for the public API (Story 80) — a throttle scope keyed on
  `request.auth`.
- **An audit trail for key issuance/revocation and for sync runs** — both stories
  declined to add a third nullable FK to `accounts.AuditLog` (`CONVENTIONS.md` § 22);
  `ApiKey` and `ErpSyncRun` rows are the durable records instead.
- **Showing a customer's ERP orders to an agent** (Story 81) — `ErpOrder` is synced and
  API-readable, but is not rendered on `CustomerProfilePage`, a ticket, or the agent
  context panel. That is `CUST-3`/agent-workspace surface area.
- **Delete propagation and conflict resolution beyond last-write-wins** (Story 81).
