# sla-automation — plan overview

Entry point for the **sla-automation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 27 | [27-story-background-jobs-foundation-SUPPORTOS-49.md](27-story-background-jobs-foundation-SUPPORTOS-49.md) | Background Jobs Foundation | SUPPORTOS-49 | Story 02 (`FND-2`) |

## Dependency notes

This feature maps to **EPIC 7 — SLA & Automation** in `SupportOs backlog.MD` (lines 450-490). It depends on `project-foundation-architecture`'s `FND-2` (Story 02, complete) — see [`../project-foundation-architecture/00-overview.md`](../project-foundation-architecture/00-overview.md).

**Story 27 (SLA-0, Background Jobs Foundation) is pure infrastructure — no `apps.sla` domain code at all.** It adds the shared Celery application (`config/celery.py`, sitting alongside `config/asgi.py`/`wsgi.py` as project wiring, not inside any app) and `django-celery-beat` as the database-backed scheduler. Redis is the local broker/result backend, installed as a local service exactly like PostgreSQL — never Docker, matching this project's existing "Docker optional, future" stance. `apps.sla` itself (already scaffolded, empty, in `INSTALLED_APPS`) gets its first real content in `SLA-1`.

**This story also unblocks `agent-workspace`'s `AGENT-3` (Tasks & Reminders)**, whose own dependency line names `SLA-4` (Alerts & Notifications) — `SLA-0` → `SLA-4` is the chain that needs to complete before `AGENT-3`'s "due notifications... trigger via shared notification system" task can be built for real, rather than against a system that does not exist yet.

**Remaining stories in this epic**, per `SupportOs backlog.MD` lines 462-489: `SLA-1` (Response & Resolution Targets, depends on `TKT-2`, complete — plannable now), `SLA-2` (Automatic Assignment, depends on `TKT-3` + this story), `SLA-3` (Escalation Rules, depends on `SLA-1` + this story), `SLA-4` (Alerts & Notifications, depends only on this story — the one `AGENT-3` is waiting on). `SLA-1` and `SLA-4` are the two most immediately valuable next stories; `SLA-4` in particular is the direct unblock for `agent-workspace`.
