# communication-channels — plan overview

Entry point for the **communication-channels** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 13 | [13-story-messaging-core-channel-adapter-SUPPORTOS-37.md](13-story-messaging-core-channel-adapter-SUPPORTOS-37.md) | Messaging Core & Channel Adapter Pattern | SUPPORTOS-37 | Story 12 (`TKT-1`) |

## Dependency notes

This feature maps to **EPIC 5 — Communication Channels** in `SupportOs backlog.MD` (lines 353-397). It depends on ticket-management's `TKT-1` (Story 12), complete — see [`../ticket-management/00-overview.md`](../ticket-management/00-overview.md).

`COMM-0` (story 13) → `COMM-1` (Email) / `COMM-2` (WhatsApp) / `COMM-3` (Live Chat) / `COMM-4` (SMS), each depending only on `COMM-0` and sequenceable in any order → `COMM-5` (Web Forms), which additionally needs `TKT-2` (Categories & Priorities, not yet planned).

**Story 13 is the third feature domain in the project**, after customer-management and ticket-management, and reuses two patterns Story 12 established: `SimpleRouter` for every domain router after the first (`apps.customers.urls`'s `DefaultRouter` still owns the API root), and a child resource reusing its parent domain's permissions rather than inventing new ones (here, `Message` reuses `tickets.*` — no new permission constants).

**A placement decision worth reading before touching this feature again.** The intake's "Shared conversation UI" task sounds like it belongs in a `features/communications/` frontend folder matching the feature slug — story 13 deliberately does **not** create one. Its only real consumer is the ticket detail page (every channel renders through the *same* component there, which is the actual reuse the intake means — channel-agnostic rendering, not reuse across multiple screens), so the component lives in `features/tickets/components/TicketConversation.tsx`, calling `/api/messages/` directly the same way Story 12's `getCustomerOptions.ts` calls `/api/customers/` — a feature owning exactly the data shape it needs from another domain's endpoint, never importing that domain's frontend code (`CONVENTIONS.md` §15). The **backend** `Message` model still lives in `apps/communications/`, matching `backend/apps/README.md`'s app-purpose table.

**Scope boundary.** `Message` is deliberately minimal — `ticket` FK, `direction`, `channel`, `body`, `metadata` — and `ChannelAdapter` is an interface with zero concrete subclasses. COMM-1 through COMM-4 each provide exactly one real channel adapter; none of that is pre-empted here.

**Open question for whoever plans CUST-3 next (SUPPORTOS-30, Interaction History):** its intake lists `CUST-1, TKT-1, COMM-*` as dependencies. After story 13, both `Ticket` and `Message` exist as real, queryable models — whether "COMM-*" is satisfied by COMM-0's messaging spine alone or needs at least one real channel (COMM-1+) wired up is a product call story 13 does not make.

**Note on testing:** per standing project policy this project authors no automated tests. Story 13 adds none. Its checks are the backend's `manage.py check`/`test`/`ruff`, the frontend's `lint`/`format:check`/`check:rtl`/`build`, an `en`/`ar` key-set comparison, real HTTP across four verbs × three permission states plus the required-filter guard, and a bilingual walkthrough of the conversation view including a manually-created inbound message (no real adapter exists yet to create one automatically).
