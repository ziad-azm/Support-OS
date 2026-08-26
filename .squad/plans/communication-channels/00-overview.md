# communication-channels — plan overview

Entry point for the **communication-channels** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 13 | [13-story-messaging-core-channel-adapter-SUPPORTOS-37.md](13-story-messaging-core-channel-adapter-SUPPORTOS-37.md) | Messaging Core & Channel Adapter Pattern | SUPPORTOS-37 | Story 12 (`TKT-1`) |
| 14 | [14-story-email-SUPPORTOS-39.md](14-story-email-SUPPORTOS-39.md) | Email | SUPPORTOS-39 | Story 13 (`COMM-0`) |

## Dependency notes

This feature maps to **EPIC 5 — Communication Channels** in `SupportOs backlog.MD` (lines 353-397). It depends on ticket-management's `TKT-1` (Story 12), complete — see [`../ticket-management/00-overview.md`](../ticket-management/00-overview.md).

`COMM-0` (story 13) → `COMM-1` (Email) / `COMM-2` (WhatsApp) / `COMM-3` (Live Chat) / `COMM-4` (SMS), each depending only on `COMM-0` and sequenceable in any order → `COMM-5` (Web Forms), which additionally needs `TKT-2` (Categories & Priorities, not yet planned).

**Story 13 is the third feature domain in the project**, after customer-management and ticket-management, and reuses two patterns Story 12 established: `SimpleRouter` for every domain router after the first (`apps.customers.urls`'s `DefaultRouter` still owns the API root), and a child resource reusing its parent domain's permissions rather than inventing new ones (here, `Message` reuses `tickets.*` — no new permission constants).

**A placement decision worth reading before touching this feature again.** The intake's "Shared conversation UI" task sounds like it belongs in a `features/communications/` frontend folder matching the feature slug — story 13 deliberately does **not** create one. Its only real consumer is the ticket detail page (every channel renders through the *same* component there, which is the actual reuse the intake means — channel-agnostic rendering, not reuse across multiple screens), so the component lives in `features/tickets/components/TicketConversation.tsx`, calling `/api/messages/` directly the same way Story 12's `getCustomerOptions.ts` calls `/api/customers/` — a feature owning exactly the data shape it needs from another domain's endpoint, never importing that domain's frontend code (`CONVENTIONS.md` §15). The **backend** `Message` model still lives in `apps/communications/`, matching `backend/apps/README.md`'s app-purpose table.

**Scope boundary.** `Message` is deliberately minimal — `ticket` FK, `direction`, `channel`, `body`, `metadata` — and `ChannelAdapter` is an interface with zero concrete subclasses. COMM-1 through COMM-4 each provide exactly one real channel adapter; none of that is pre-empted here.

**Open question for whoever plans CUST-3 next (SUPPORTOS-30, Interaction History):** its intake lists `CUST-1, TKT-1, COMM-*` as dependencies. After story 13, both `Ticket` and `Message` exist as real, queryable models — whether "COMM-*" is satisfied by COMM-0's messaging spine alone or needs at least one real channel (COMM-1+) wired up is a product call story 13 does not make. **Story 14 (COMM-1, Email) now provides that first real channel**, if that reading is the one whoever plans CUST-3 next chooses.

**Story 14 (COMM-1, Email) adds the first concrete `ChannelAdapter` subclass and the registry COMM-0 deferred.** `apps/communications/adapters.py::register_adapter`/`get_adapter` is the minimal channel → adapter-class dispatch table, wired through `CommunicationsConfig.ready()`; `EmailAdapter` (`email_adapter.py`) is its first entry. `MessageViewSet.perform_create` dispatches every outbound message to whichever adapter is registered for its `channel`, catching and logging a send failure without failing the request — the pattern COMM-2 (WhatsApp), COMM-3 (Live Chat), and COMM-4 (SMS) each copy.

**Story 14 touches zero frontend files.** COMM-0's `TicketConversation.tsx` already offered `email` as one of five channel choices in its reply form — story 14's entire job is making the *backend* behind that already-existing choice real (an adapter that actually sends, and a webhook that actually receives), not building new UI.

**Provider config is `ENV`-only through story 14**, deliberately not pre-empting `INT-3` (Messaging Providers Config, `SupportOs backlog.MD:661-665`), which depends on `COMM-1/2/4` and is where a DB-backed credentials UI eventually replaces these environment variables.

**Note on testing:** per standing project policy this project authors no automated tests. Neither story adds one. Story 13's checks are the backend's `manage.py check`/`test`/`ruff`, the frontend's `lint`/`format:check`/`check:rtl`/`build`, an `en`/`ar` key-set comparison, real HTTP across four verbs × three permission states plus the required-filter guard, and a bilingual walkthrough of the conversation view including a manually-created inbound message. Story 14's checks are the same backend gates plus real HTTP against the inbound webhook (fail-closed with no token, first-contact ticket creation, tagged-ticket attachment, stale-tag fallback) and outbound dispatch verified against the local dev server's console-backend output — no real SMTP credentials are needed to verify any of it.
