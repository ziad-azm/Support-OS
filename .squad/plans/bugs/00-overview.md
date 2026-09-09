# bugs — plan overview

Entry point for the **bugs** feature. Stories execute in order by their `NN` prefix.

Unlike every other feature folder, this one is not an epic from `SupportOs backlog.MD`. It holds remediation stories cut from defect reports — currently one: the full-stack QA, security and UI/UX review at `.squad/stories/bugs/qa-report-1/attachments/QA-REPORT-1.md`, which found 20 issues (F-1..F-20) against commit `640a6d9`.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 99 | [99-story-portal-task-idor-and-fail-open-default.md](99-story-portal-task-idor-and-fail-open-default.md) | Portal Task IDOR & the Fail-Open Permission Default (F-1, F-4) | — | Story 32 (`AGENT-3`), Story 34 (`AGENT-5`), Story 84 (`AUTH-3`) |

## Planned next — the remaining phases of qa-report-1

Written from the intake's own recommended slicing (`.squad/stories/bugs/qa-report-1/intake.md`, `## Extra notes`). These are **not yet written as plan files**; the row is the commitment, not the plan.

| NN | Working title | Findings | Depends on | Notes |
|----|---------------|----------|------------|-------|
| 100 | Role-Grant Drift & the `sync_role_permissions` Command | F-2 | Story 99 | The five grant migrations target slug `admin`; this database has only `super_admin`, so all five applied and granted nothing. Creates the project's **first** `management/commands/` package. |
| 101 | Link Contrast Tokens (`--primary-text`) | F-5, F-6 | — | Default `text-primary` measures **3.69:1** on dark `--background` and **3.28:1** on dark `--card`. One token, two declarations, 34 call sites. |
| 102 | Management Dashboard Defects | F-7, F-11, F-12, F-13, F-14, F-19 | 101 (shares the token work) | `GaugeChart` clips its first label at `y=-4` and renders at 1:1 inside a ~1160px container. Shared by the SLA and agent report pages — verify every consumer. |
| 103 | Ticket Queue: Status Filter & SLA Visibility | F-8, F-9 | Story 98 (`ORG-4`) | The backend already implements and validates `?status=` (`apps/tickets/views.py:141-145`); the frontend never sends it. `sla_status` must hold the **4-query** baseline. |
| 104 | OpenAPI Schema Completeness | F-10 | Story 80 (`INT-1`) | 26 views are omitted from the schema entirely; `CategorySerializer` collides across two apps. |
| 105 | QA Polish | F-15, F-16, F-17, F-18, F-20 | — | Locale-aware dates, brand-name tooltip, `?ordering=` silent no-op, one `oxlint` warning, chunk naming. |

## Dependency notes

**Story 99 is deliberately first and deliberately alone.** It carries the review's only confirmed cross-tenant data leak (F-1) plus the one-line default flip (F-4). The intake's own guidance is that security "ship[s] first and alone"; nothing in 100–105 is a prerequisite for it, and it is a prerequisite only for 100 in the weak sense that both touch authorization and should not be reviewed as one diff.

**F-1 is an API defect that the frontend cannot fix.** `RedirectPortalOnly` (Story 84, [`../authentication-authorization/`](../authentication-authorization/00-overview.md)) already stops a portal-only account from reaching the staff shell, and the `/tasks` sidebar link's comment (`frontend/src/app/Sidebar.tsx:263-267`) cites exactly that as its safety argument. The leak was reproduced live **with Story 84 in the tree**, against `POST /api/tasks/` with a raw JWT. Story 99 therefore makes **no frontend change at all**, and says so explicitly so that a later reader does not "re-fix" it in the router.

**Story 99 closes a gap Story 34 had already closed next door.** `InternalNoteSerializer.mentioned_users` (`backend/apps/agents/serializers.py:57-64`) binds an explicit `queryset=assignable_agents()` precisely so *"a hand-crafted request cannot mention (and notify) an agent who holds no `tickets.manage`."* `TaskSerializer.ticket`, 43 lines above it in the same module, was left on DRF's auto-generated `Ticket.objects.all()` by Story 32, whose `## Prerequisites` justified the omission by pointing at the *picker* being gated. The picker was gated; the API was not. Story 99 brings the two writable relations in that module under one rule.

**F-4's flip was measured, not assumed.** CONVENTIONS.md §13 lines 212-215 defer it on the grounds that *"right now there is exactly one authenticated endpoint."* Story 99's discovery enumerated every view in the project and confirmed the flip changes the behaviour of **zero** of them — the load-bearing case being simplejwt's `TokenViewBase.permission_classes = ()` (`rest_framework_simplejwt/views.py:15`), without which flipping the default would deadlock login. That deferral sentence is deleted by Story 99, not merely amended.

**F-3 — the review's root-cause finding — is not in any story here.** The report argues that an authorization-matrix test would have caught F-1 the day Story 32 shipped, and a role-integrity test would have caught F-2 five migrations ago. CONVENTIONS.md §16 is an explicit project policy against authoring tests, so the recommendation is recorded in the attachment and in each story's `## Test Plan`, and acted on nowhere. Overturning §16 is a project-level decision, not something a bug story can carry.

**Stories 100–105 are independent of each other** apart from 102 depending on 101's token, and may be planned and executed in any order once 99 lands. 103 should be read against [`../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md`](../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md), which last touched `TicketListPage`'s filter block and established the `'all'`/`'none'` sentinel convention a status filter must follow.
