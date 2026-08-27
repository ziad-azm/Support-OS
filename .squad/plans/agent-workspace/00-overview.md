# agent-workspace — plan overview

Entry point for the **agent-workspace** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 25 | [25-story-assigned-tickets-workspace-SUPPORTOS-45.md](25-story-assigned-tickets-workspace-SUPPORTOS-45.md) | Assigned Tickets Workspace | SUPPORTOS-45 | Story 22 (`TKT-3`) |

## Dependency notes

This feature maps to **EPIC 6 — Agent Workspace** in `SupportOs backlog.MD` (lines 406-444). It depends on `ticket-management` (`TKT-3`, Story 22 — `assigned_agent`, `assign`, and the `?assigned_to_me=true` filter) and `communication-channels`, per the epic's own `Depends on` line — see [`../ticket-management/00-overview.md`](../ticket-management/00-overview.md) and [`../communication-channels/00-overview.md`](../communication-channels/00-overview.md).

**Story 25 (AGENT-1, Assigned Tickets Workspace) deliberately puts its frontend code inside `frontend/src/features/tickets/`, not a new `frontend/src/features/agent-workspace/` folder.** The `.squad/plans/agent-workspace/` folder is this plan's own per-epic organizational home — it does not dictate where the *application* code lives. The queue is ticket data, filtered: every type and reusable piece it needs (`Ticket`, `TICKET_STATUSES`, `DataTable`, `useTickets`) already lives in `features/tickets`, and a separate feature folder would either force duplicating all of it or violate `no-restricted-imports` (`CONVENTIONS.md` §15) reaching back for it. The backend side is a single new optional `status` equality filter on the already-existing `TicketViewSet.get_queryset` — no new app, no new endpoint, "reusing ticket API" read literally.

**The intake's third filter axis, SLA, is explicitly out of scope for this story** — no `SLAPolicy` model or breach data exists anywhere in this codebase yet; that is `EPIC 7`'s (`SLA-1`, depending on the also-unbuilt `SLA-0` Celery foundation). Story 25 ships the two filters (`status`, `priority`) that have real data behind them and documents SLA filtering as a deliberate follow-up once `EPIC 7` exists, not a silent omission.

**A correction to an earlier plan's backlog citation.** Story 22's plan referred to *"`AGENT-4` (Auto-Assignment Rules, lines 471-474)"* — that was wrong even at the time: those lines are `SLA-2` (*"Automatic Assignment"*, `EPIC 7`), and the real `AGENT-4` (line 432) is *"Quick Replies"*. Story 25 re-verified every backlog citation against the file directly rather than trusting a prior plan's summary; future stories in this feature should do the same.

**Remaining stories in this epic**, per `SupportOs backlog.MD` lines 418-444: `AGENT-2` (Customer Context Panel, depends on `CUST-1`/`TKT-1`, both complete), `AGENT-3` (Tasks & Reminders, blocked on `SLA-4` notifications — `EPIC 7`, unbuilt), `AGENT-4` (Quick Replies, depends only on `COMM-0`, complete), and `AGENT-5` (Team Collaboration, depends on `TKT-5`'s activity-log pattern — Story 24, complete — and `SLA-4`, unbuilt). `AGENT-2` and `AGENT-4` are the two immediately plannable next stories; `AGENT-3`/`AGENT-5` need `EPIC 7`'s notification foundation first.
