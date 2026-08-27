# sla-automation — plan overview

Entry point for the **sla-automation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 27 | [27-story-background-jobs-foundation-SUPPORTOS-49.md](27-story-background-jobs-foundation-SUPPORTOS-49.md) | Background Jobs Foundation | SUPPORTOS-49 | Story 02 (`FND-2`) |
| 28 | [28-story-response-resolution-targets-SUPPORTOS-50.md](28-story-response-resolution-targets-SUPPORTOS-50.md) | Response & Resolution Targets | SUPPORTOS-50 | Story 18 (`TKT-2`) |

## Dependency notes

This feature maps to **EPIC 7 — SLA & Automation** in `SupportOs backlog.MD` (lines 450-490). It depends on `project-foundation-architecture`'s `FND-2` (Story 02, complete) — see [`../project-foundation-architecture/00-overview.md`](../project-foundation-architecture/00-overview.md).

**Story 27 (SLA-0, Background Jobs Foundation) is pure infrastructure — no `apps.sla` domain code at all.** It adds the shared Celery application (`config/celery.py`, sitting alongside `config/asgi.py`/`wsgi.py` as project wiring, not inside any app) and `django-celery-beat` as the database-backed scheduler. Redis is the local broker/result backend, installed as a local service exactly like PostgreSQL — never Docker, matching this project's existing "Docker optional, future" stance. `apps.sla` itself (already scaffolded, empty, in `INSTALLED_APPS`) gets its first real content in `SLA-1`.

**This story also unblocks `agent-workspace`'s `AGENT-3` (Tasks & Reminders)**, whose own dependency line names `SLA-4` (Alerts & Notifications) — `SLA-0` → `SLA-4` is the chain that needs to complete before `AGENT-3`'s "due notifications... trigger via shared notification system" task can be built for real, rather than against a system that does not exist yet.

**Story 28 (SLA-1, Response & Resolution Targets) does NOT depend on Story 27 (SLA-0)** — its own backlog dependency line names only `TKT-2`. SLA status is computed live on read (`apps/sla/policy.py::compute_sla_status`, reading `SLAPolicy` + `Ticket.created_at` + `Message`/`TicketActivity`), never persisted on `Ticket` and never evaluated by a scheduled job — no Celery task is needed until `SLA-3` (Escalation Rules) adds one. `SLAPolicy` config is Django-admin-only (`SLAPolicyAdmin`, the same "admin doubles as the config UI" call `CategoryAdmin` made in Story 18 for `Category`); the only new API surface is `GET /tickets/<id>/sla/`, gated `tickets.view` alone, feeding a new "SLA Status" card on `TicketDetailPage` — scoped to the detail page only, not the ticket list, to avoid an N+1 query cost across a paginated queue.

**Remaining stories in this epic**, per `SupportOs backlog.MD` lines 469-489: `SLA-2` (Automatic Assignment, depends on `TKT-3` + Story 27), `SLA-3` (Escalation Rules, depends on this story + Story 27), `SLA-4` (Alerts & Notifications, depends only on Story 27, complete — the one `AGENT-3` is waiting on). `SLA-4` is the most immediately valuable next story, being the direct unblock for `agent-workspace`.
