# bugs — plan overview

Entry point for the **bugs** feature. Stories execute in order by their `NN` prefix.

Unlike every other feature folder, this one is not an epic from `SupportOs backlog.MD`. It holds remediation stories cut from defect reports — currently one: the full-stack QA, security and UI/UX review at `.squad/stories/bugs/qa-report-1/attachments/QA-REPORT-1.md`, which found 20 issues (F-1..F-20) against commit `640a6d9`.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 99 | [99-story-portal-task-idor-and-fail-open-default.md](99-story-portal-task-idor-and-fail-open-default.md) | Portal Task IDOR & the Fail-Open Permission Default (F-1, F-4) | — | Story 32 (`AGENT-3`), Story 34 (`AGENT-5`), Story 84 (`AUTH-3`) |
| 100 | [100-story-role-grant-drift-and-sync-command.md](100-story-role-grant-drift-and-sync-command.md) | Role-Grant Drift & the `sync_role_permissions` Command (F-2) | — | Story 99; Story 48/49 (`SEC-1`/`SEC-2`), Story 87/89 (`ORG-1`/`ORG-2`) |
| 101 | [101-story-link-contrast-tokens.md](101-story-link-contrast-tokens.md) | Link Contrast: a `--primary-text` Token, Bounded for Brand Overrides (F-5, F-6) | — | Story 90 (`ORG-3`), Story 51 (`DSN-4`/`DSN-5`) |
| 102 | [102-story-management-dashboard-defects.md](102-story-management-dashboard-defects.md) | Management Dashboard: Chart Rendering & Surrounding Controls (F-7, F-11, F-12, F-13, F-14, F-19) | — | Story 101; Story 57/60 (`RPT-2`/`RPT-5`) |
| 103 | [103-story-ticket-queue-status-and-sla.md](103-story-ticket-queue-status-and-sla.md) | Ticket Queue: Status Filter and SLA Visibility (F-8, F-9) | — | Story 98 (`ORG-4`), Story 28 (`SLA-1`), Story 57 (`RPT-2`) |
| 104 | [104-story-openapi-schema-completeness.md](104-story-openapi-schema-completeness.md) | OpenAPI Schema Completeness (F-10) | — | Story 80 (`INT-1`) |
| 105 | — (no plan file, see below) | QA Polish (F-15, F-16, F-17, F-18, F-20) | — | — |

**qa-report-1 is now fully worked through.** Every finding F-1..F-20 is either fixed or consciously deferred with the deferral recorded in code. The two deferrals are F-3 (an authorization-matrix test — blocked by CONVENTIONS.md §16, see the dependency note below) and F-15 (see Story 105 below).

## Story 105 shipped without a plan file

The five findings left after 104 — F-15, F-16, F-17, F-18, F-20 — were implemented directly rather than planned first. They were small, independent, and each fully specified by its own report entry; a plan document would have been longer than the diff. Recorded here so a later reader does not go looking for `105-story-qa-polish.md`.

| Finding | Outcome | Where |
|---|---|---|
| F-16 | Fixed — `title` attribute so a truncated org name is recoverable on hover | `frontend/src/shared/branding/BrandMark.tsx` |
| F-17 | Fixed — `?ordering=` now 400s on an unrecognized field instead of silently falling back to the view's default order | new `backend/apps/core/filters.py::StrictOrderingFilter`, wired into `DEFAULT_FILTER_BACKENDS` |
| F-18 | **Verified false positive**, documented not suppressed | `frontend/src/features/live-chat/components/LiveChatWidget.tsx` |
| F-20 | Fixed — explicit `manualChunks` so the Recharts vendor chunk is named for Recharts | `frontend/vite.config.ts` |
| F-15 | **Deferred**, reasoning recorded in code | `frontend/src/features/reports/components/ManagementDashboardPage.tsx` |

**F-17 is the one with a rule behind it.** `apps.core.scoping`'s docstring states the project's contract for filter parameters — *"NEVER a silent no-op: a typo'd filter that quietly returns everything is the harder bug to find"* — and `apply_scope_filters` 400s an unrecognized `?department=`/`?branch=` accordingly. `rest_framework.filters.OrderingFilter` was the last filter backend still exempt from that contract. `StrictOrderingFilter` is a drop-in subclass; only `remove_invalid_fields`'s failure mode changes.

**F-18 was not silenced.** `oxlint`'s `react/refs` rule flags `onSubmit` because `form.handleSubmit(onSubmit)` appears in the render body and `onSubmit`'s body reads `socketRef.current`. `handleSubmit(fn)` returns a *new* function that calls `fn` only on submit, so the ref is never read during render. Confirmed by isolation: removing the `.current` reads silences it, and `useCallback` — which changes identity, not call timing — does **not**, so the rule is matching on "referenced function's body touches `.current`", not on real timing. No `oxlint-disable` comment exists anywhere in this codebase; the finding is documented in place instead, matching the precedent DSN-8 set for its own verified false positive. **The warning is expected to keep appearing in `npm run lint` output.**

**F-15 is deferred, not missed.** A native `<input type="date">` draws its own picker chrome in the browser/OS locale, ignoring the page's `lang`/`dir` — an Arabic visitor still sees `mm/dd/yyyy`, and no prop on the element changes it (the stored value is always ISO `yyyy-mm-dd`; only the OS-drawn on-screen text differs). A real fix needs a custom calendar widget: a new dependency plus a `popover` primitive that does not exist in `shared/ui/primitives/` today, plus real RTL and keyboard-navigation work. That is out of proportion to a polish pass, so it is recorded in place and left — the same call this feature already made for F-3.

## Dependency notes

**Story 99 is deliberately first and deliberately alone.** It carries the review's only confirmed cross-tenant data leak (F-1) plus the one-line default flip (F-4). The intake's own guidance is that security "ship[s] first and alone"; nothing in 100–105 is a prerequisite for it, and it is a prerequisite only for 100 in the weak sense that both touch authorization and should not be reviewed as one diff.

**F-1 is an API defect that the frontend cannot fix.** `RedirectPortalOnly` (Story 84, [`../authentication-authorization/`](../authentication-authorization/00-overview.md)) already stops a portal-only account from reaching the staff shell, and the `/tasks` sidebar link's comment (`frontend/src/app/Sidebar.tsx:263-267`) cites exactly that as its safety argument. The leak was reproduced live **with Story 84 in the tree**, against `POST /api/tasks/` with a raw JWT. Story 99 therefore makes **no frontend change at all**, and says so explicitly so that a later reader does not "re-fix" it in the router.

**Story 99 closes a gap Story 34 had already closed next door.** `InternalNoteSerializer.mentioned_users` (`backend/apps/agents/serializers.py:57-64`) binds an explicit `queryset=assignable_agents()` precisely so *"a hand-crafted request cannot mention (and notify) an agent who holds no `tickets.manage`."* `TaskSerializer.ticket`, 43 lines above it in the same module, was left on DRF's auto-generated `Ticket.objects.all()` by Story 32, whose `## Prerequisites` justified the omission by pointing at the *picker* being gated. The picker was gated; the API was not. Story 99 brings the two writable relations in that module under one rule.

**F-4's flip was measured, not assumed.** CONVENTIONS.md §13 lines 212-215 defer it on the grounds that *"right now there is exactly one authenticated endpoint."* Story 99's discovery enumerated every view in the project and confirmed the flip changes the behaviour of **zero** of them — the load-bearing case being simplejwt's `TokenViewBase.permission_classes = ()` (`rest_framework_simplejwt/views.py:15`), without which flipping the default would deadlock login. That deferral sentence is deleted by Story 99, not merely amended.

**F-3 — the review's root-cause finding — is not in any story here.** The report argues that an authorization-matrix test would have caught F-1 the day Story 32 shipped, and a role-integrity test would have caught F-2 five migrations ago. CONVENTIONS.md §16 is an explicit project policy against authoring tests, so the recommendation is recorded in the attachment and in each story's `## Test Plan`, and acted on nowhere. Overturning §16 is a project-level decision, not something a bug story can carry.

**Story 100 turned out bigger than the intake described, in a way worth recording.** The intake said "Super Admin is missing 8 permissions." Discovery found the real shape: **six permissions were held by no role at all**, and only four of those were the silent-no-op victims of `0008`-`0011`. The other two — `departments.manage`, `branches.manage` — were **never granted by any migration to anyone**, because `ORG-1`/`ORG-2` added the permission strings and the viewsets that enforce them and shipped no grant migration. A fix that only replayed the skipped grants would have left the product with permissions no role could hold. Two further findings shaped the story: a **freshly-migrated database seeds `admin` while this one carries `super_admin`**, so the repair keys on both slugs; and the project owner's account is a **superuser with `role = None`**, which bypasses `permissions_for` entirely and is precisely why six broken admin areas went unnoticed for five releases.

**Stories 100–105 were independent of each other** apart from 102 depending on 101's token, and were planned and executed in `NN` order once 99 landed. 103 should be read against [`../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md`](../multi-department-multi-branch-branding/98-story-ticket-list-own-scope-SUPPORTOS-129.md), which last touched `TicketListPage`'s filter block and established the `'all'`/`'none'` sentinel convention a status filter must follow.
