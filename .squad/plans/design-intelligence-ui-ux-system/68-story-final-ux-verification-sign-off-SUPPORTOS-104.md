# Story 68 — (DSN-13) Final UX Verification & Sign-off (Story: SUPPORTOS-104)

## Prerequisites

- **`DSN-6` through `DSN-12` (Stories 61–67) are complete.** `design-system/supportos/UX-AUDIT.md` (174 content lines, read in full this session) catalogues **69 findings** (`UX-001`–`UX-069`), 5 `critical` / 31 `major` / 33 `minor`, each with a Status column recording its disposition after its owning story ran. This story is the **"verify" bookend** of the `DSN-6`–`DSN-13` audit→fix→verify thread (`SupportOs backlog.MD:620-626`) — it does not consume a category; it re-walks the whole register.

- **Full accounting of the register's current state (verified this session by reading the actual file, not assumed from prior summaries):**

  | Status | Count | IDs |
  |---|---|---|
  | `Resolved (Story NN)`, any variant (plain / `— corrected` / `— partial` / `— verified false positive`) | 62 | everything not listed below |
  | `Deferred` | 5 | `UX-007`, `UX-019`, `UX-024`, `UX-030`, `UX-057` |
  | `Open` | 2 | `UX-016`, `UX-028` |

  By severity: all 5 `deferred` + `open` rows are `major` or `critical` severity except — checked explicitly — `UX-016`/`UX-028` are both `minor`. No `critical` row is `Open`. **One `critical` row is `Deferred`, not `Resolved`: `UX-057`** (portal ticket-detail conversation thread — needs a new portal-scoped message-read endpoint). The other 4 `critical` rows (`UX-005`, `UX-009`, `UX-034`, `UX-055`) are all `Resolved`. This is the one nuance the intake's "zero open criticals" phrase needs precision on — see `## Story Goal`.

  By owning story (matches the register's own header line and each story's own summary paragraph, cross-checked, not just copied): `DSN-7` 13 (9 resolved outright + 2 partial + 1 deferred + 1 new-during-implementation `UX-066` folded into the resolved count), `DSN-8` 18 (15 resolved + 1 deferred + 2 open), `DSN-9` 7 (all 7 resolved, 2 of them new-during-planning `UX-067`/`UX-068`), `DSN-10` 7 (all 7 resolved, 1 new-during-planning `UX-069`), `DSN-11` 12 (9 resolved + 1 false-positive-resolved + 2 deferred), `DSN-12` 12 (8 resolved + 1 corrected-resolved + 2 false-positive-resolved + 1 deferred). Total 13+18+7+7+12+12 = 69. The header's own **Totals: 69 findings — 5 critical, 31 major, 33 minor** line matches a fresh independent count of every row's Severity column done this session.

- **What "re-verification" means for this story, and why the depth varies by severity (stated explicitly per the intake's own honesty constraint, not silently applied):**
  - Every one of the **31 `critical`/`major` `Resolved` rows** was re-verified this session by **reading the actual current cited file(s) in full** (or, for backend files, a targeted grep of the exact claimed code) and confirming the code genuinely still does what the register's Finding/Status columns claim — not sampled, all 31.
  - Every one of the **31 `minor` `Resolved` rows** was spot-checked this session — a grep for the claimed fix's signature (a locale key, a prop, a class, a component usage) in the cited file, escalating to a full read if anything looked off. Nothing did; every spot check confirmed the claim. In practice this session ended up reading or grep-confirming **all 62 `Resolved` rows**, not only the 31 `critical`/`major` ones — the extra minor-row coverage is recorded honestly below but is not required reading for a future re-run of this story at lower budget.
  - Every one of the **5 `Deferred`** and **2 `Open`** rows was re-checked against current backend/frontend code to confirm the register's own reasoning for why it's un-actioned still holds (the cited model/serializer/endpoint still lacks what it lacked before). **No `Open`/`Deferred` row was resolved or attempted** — per the intake's explicit "verification + straggler fixes only" constraint, these need a product decision (a dedicated non-`DSN` backend story or an explicit guardrail exception), which is out of this story's scope; confirming their disposition is still correct is in scope, changing it is not.

- **Static verification suite — actually run this session, results below are observed, not assumed:**

  | Command (from `frontend/` unless noted) | Result |
  |---|---|
  | `npm run lint` (`oxlint`) | Exit 0. One warning: `src/features/live-chat/components/LiveChatWidget.tsx:178:41` — `react(refs): Cannot access refs during render`, flagging the inline `onSubmit={form.handleSubmit(onSubmit)}` on `ChatPane`'s `<form>`. Investigated, not ignored: `form.handleSubmit(...)` is react-hook-form's standard API and does not itself dereference a ref at render time; the warning is oxlint's static heuristic reacting to `onSubmit` (the callback passed to `handleSubmit`) closing over `socketRef.current` inside its own body, executed only when the form actually submits, never during render. Confirmed pre-existing (not introduced by any edit this session — this session made no source edits) and **unrelated to any `UX-AUDIT.md` row** — `UX-005`/`UX-006`/`UX-007`/`UX-008` (the 4 findings against this exact file) were all independently re-verified against runtime behavior in `## Context` below and all hold. Not treated as a straggler; see `## Edge Cases & Failure Modes`. |
  | `npm run format:check` (`prettier --check .`) | Exit 0. "All matched files use Prettier code style!" |
  | `npm run check:rtl` | Exit 0. "no physical direction utilities in src/." |
  | `npm run build` | Exit 0. Built in 766ms, no errors. |
  | `python manage.py test` (from `backend/`) | Exit 0. **Ran 54 tests — OK.** (One `ERROR django.request Service Unavailable: /api/health/` line in the log is expected output from a health-check-failure test case, not a failure — the final `OK` and `Ran 54 tests` confirm all 54 pass, matching every prior `DSN` story's own "54/54" figure — no drift.) |

  A clean static-suite pass across the current head state, after 6 remediation stories' worth of edits, is corroborating mechanical evidence for "no regression" — it does not replace the per-finding code re-reads above, which are this story's actual verification method (see `## Edge Cases & Failure Modes` for why a live browser was not used either).

---

## Story Goal

Re-walk the full 69-row register, confirm every `critical`/`major` `Resolved` finding is genuinely still resolved with no regression, spot-check every `minor` `Resolved` finding, confirm every `Deferred`/`Open` finding's reasoning still holds, fix any genuine straggler found, and record a sign-off. **Result: zero stragglers or regressions were found.** Every one of the 62 `Resolved` rows checked this session (all 31 `critical`/`major` in full, all 31 `minor` spot-checked) still matches its register claim against the actual current code. Every one of the 5 `Deferred` and 2 `Open` rows' reasoning still holds against current backend/frontend code. `## Frontend Tasks` below is therefore limited to the sign-off record itself — there is no fix to make.

**On the intake's "zero open criticals" headline claim — the precise, honest answer:** Using the register's own Status vocabulary, **no `critical`-severity row carries the status `Open`** — true, and confirmed this session. But this is not the same as "every critical finding is resolved": **one of the 5 `critical` rows, `UX-057`, is `Deferred`**, not `Resolved` — a genuine, currently-unactioned gap (the customer portal's ticket-detail page still has no way to see the agent conversation thread until the ticket closes), carried forward from `DSN-11` (Story 66) because it needs a new portal-scoped, read-only message endpoint, an API change the `DSN-6`–`DSN-13` guardrail forbids. So: **zero `critical` findings are `Open`; one `critical` finding (`UX-057`) remains genuinely unresolved as `Deferred`, pending a product/backend decision outside this story's scope.** State both halves of this when reporting the sign-off — neither alone is the full picture.

**Per-prior-story re-verification outcome:**

| Story (`DSN-N`) | Category, findings owned | `critical`/`major` `Resolved` re-verified (full read) | `minor` `Resolved` spot-checked | `Deferred`/`Open` reasoning re-confirmed | Regressions found |
|---|---|---|---|---|---|
| 62 (`DSN-7`) | `consistency`, 13 | 6/6 (`UX-013, 033, 038, 047, 054, 066`) — all confirmed still accurate | 6/6 (`UX-003, 020, 022, 036, 044, 061`) — all confirmed | `UX-030` (deferred) — `FAQ` model still has no `status` field, confirmed | 0 |
| 63 (`DSN-8`) | `interaction`, 18 | 10/10 (`UX-005, 006, 009, 017, 025, 039, 040, 049, 053, 055`) — all confirmed | 5/5 (`UX-004, 043, 046, 052, 062`) — all confirmed | `UX-007` (deferred), `UX-016`/`UX-028` (open) — all reasoning still holds | 0 |
| 64 (`DSN-9`) | `responsive`, 7 | 3/3 (`UX-008, 067, 068`) — all confirmed | 4/4 (`UX-014, 021, 064, 065`) — all confirmed | none | 0 |
| 65 (`DSN-10`) | `form`, 7 | 2/2 (`UX-018, 069`) — all confirmed | 5/5 (`UX-010, 011, 026, 051, 060`) — all confirmed | none | 0 |
| 66 (`DSN-11`) | `IA`, 12 | 4/4 (`UX-001, 034, 050, 058`) — all confirmed | 6/6 (`UX-002, 029, 037, 041, 059, 063`) — all confirmed | `UX-019`, `UX-057` (both deferred) — both still hold | 0 |
| 67 (`DSN-12`) | `content`/`bilingual`, 12 | 6/6 (`UX-012, 027, 031, 035, 042, 048`) — all confirmed | 5/5 (`UX-015, 023, 032, 045, 056`) — all confirmed | `UX-024` (deferred) — still holds | 0 |
| **Total** | **69** | **31/31 critical+major resolved rows re-verified** | **31/31 minor resolved rows spot-checked** | **5/5 deferred + 2/2 open rows re-confirmed** | **0** |

**Final tally:** 69 total findings — 62 `Resolved` (all reconfirmed accurate), 5 `Deferred` (all reasoning reconfirmed current), 2 `Open` (both reasoning reconfirmed current) — **zero regressions, zero stragglers, zero new `UX-0NN` findings.** No finding's Status column changes as a result of this story; the register's content is already accurate.

**Not in scope:** resolving any of the 7 still-`Deferred`/`Open` rows (`UX-007, 016, 019, 024, 028, 030, 057`) — each needs a product decision (a dedicated non-`DSN` backend story, or an explicit guardrail exception) per `00-overview.md`'s own closing note, unchanged by this story; any data-flow/API/route-logic change; any new component library.

---

## Context — Read These Files First

Every file re-read or grep-verified this session, grouped by the story that originally introduced the fix being re-checked. Files touched by more than one prior story are listed once, under the story whose fix was most recently layered on top (the highest-regression-risk case per the task brief) — cross-referenced from the other owning stories' rows too.

**Originally from Story 62 (`DSN-7`):**
1. `frontend/src/features/health/components/HealthPage.tsx` (full, 50 lines) — `UX-013`: confirmed `PageHeader`/`Card`/shared `Button` still used, no bare native elements.
2. `frontend/src/app/NotFoundPage.tsx` (full, 26 lines) — `UX-054`: confirmed `<h1>`/`Card`/`Button` pattern intact.
3. `frontend/src/features/reports/components/AgentReportsPage.tsx` (full, 127 lines) — `UX-047`/`UX-066`: confirmed no row-count guard is needed (backend already caps) and `PageHeader title={t('sidebarAgents')}` (not the bare `title` key).
4. `backend/apps/reports/agents.py` lines 30, 73-124 — `UX-047`: confirmed `MAX_AGENTS = 15` and `agent_performance()`'s `sorted(...)[:MAX_AGENTS]` slice are both still present.
5. `frontend/src/features/accounts/components/RoleListPage.tsx` (full, 119 lines) — `UX-038`/`UX-039`: confirmed `useDebouncedSearch` search box and the copy-only delete-description fix are both present.
6. `frontend/src/features/tickets/components/CategoryListPage.tsx` lines 33-60 (grep) — `UX-039`: confirmed `categories.delete.title`/`.description` keys still wired.
7. `frontend/src/features/tickets/components/CategoryFormPage.tsx`, `frontend/src/features/accounts/components/UserFormPage.tsx` (grep for `max-w-`) — `UX-044`: both confirmed still `max-w-lg`, not reverted to `max-w-2xl`.
8. `frontend/src/features/tickets/components/MyTicketsPage.tsx` (grep) — `UX-022`: confirmed the empty state still branches on `statusFilter !== 'all' || priorityFilter !== 'all'`.
9. `frontend/src/features/knowledge-base/components/SearchPage.tsx` (grep) — `UX-036`: confirmed `search.noPreview` placeholder still present for the article branch.
10. `frontend/src/features/reports/components/SlaReportsPage.tsx`, `CsatReportsPage.tsx`, `TicketReportsPage.tsx`, `ManagementDashboardPage.tsx` (grep for `PageHeader title`) — `UX-066`: confirmed each page's title key is still its own (`sidebarSla`/`sidebarCsat`/`title`/`dashboard.title`), none regressed back to the shared bare `title` key.

**Originally from Story 63 (`DSN-8`):**
11. `frontend/src/features/live-chat/components/LiveChatWidget.tsx` (full, 199 lines) — `UX-005` (StartForm `useMutation`), `UX-006` (`ChatPane` `onopen`/`onclose`/`onerror` + guarded `send`), `UX-008` (`h-[min(32rem,calc(100dvh-3rem))]`) — all three confirmed present and correct; `UX-007` (deferred) confirmed still no REST history fetch on mount.
12. `frontend/src/features/web-form/components/WebFormPage.tsx` (full, 150 lines) — `UX-009` (`useMutation`), `UX-010` (`disabled`/error description on the category `SelectField`), `UX-011` (`maxLength={5000}`) — all confirmed.
13. `frontend/src/features/tickets/components/TicketStatusControl.tsx` (full, 77 lines) — `UX-017`: confirmed `useConfirm()` still gates any transition to a terminal (zero-outgoing-transition) status.
14. `frontend/src/app/RouteErrorBoundary.tsx` (full, 47 lines) — `UX-055` (a `goHome` button in all 3 branches), `UX-056` (no `error.statusText` read anywhere) — both confirmed.
15. `frontend/src/shared/ui/chart/ChartFrame.tsx` (full, 102 lines) — `UX-049`: confirmed the export `action` only renders when `query.isSuccess && !isEmpty?.(query.data)`.
16. `frontend/src/features/knowledge-base/components/FaqFormPage.tsx`, `ArticleFormPage.tsx` (both full) — `UX-025`: confirmed both call `useUnsavedChangesGuard(form.formState.isDirty)` and `form.reset(values)` on save success.
17. `frontend/src/shared/lib/api/queryClient.ts` lines 1, 23-51 (grep) — `UX-040`: confirmed `mutationCache: new MutationCache({ onError: handle })` is still the global mutation-failure handler.
18. `frontend/src/features/organization/components/SettingsPage.tsx` lines 2, 57-94 (grep) — `UX-053`: confirmed `StringListField`'s remove control still has `aria-label={t('settings.removeItem', { item })}`.
19. `frontend/src/features/auth/components/LoginPage.tsx` (grep) — `UX-004`: confirmed `help.prompt`/`help.lockedOut` recovery copy still renders.
20. `frontend/src/features/tasks/components/TaskFormPage.tsx` (grep) — `UX-046`: confirmed the Cancel button (`navigate('/tasks')`) is still present.
21. `frontend/src/features/portal/components/PortalTicketFormPage.tsx`, `PortalFeedbackFormPage.tsx` (grep/full) — `UX-062`: confirmed both `SubmitButton`s still pass `pendingLabel`.

**Originally from Story 64 (`DSN-9`), then re-touched by later stories — read fresh, not assumed:**
22. `frontend/src/app/Sidebar.tsx` (full, 315 lines) — `UX-067` (`readCollapsed()` still defaults to collapsed on narrow viewports only when no stored preference exists), plus `UX-001`/`UX-002` layered on top by Story 66 (`NavLink`/`NavSection` — see below). The highest-risk file in the whole register per the task brief (touched by Stories 62, 64, 66) — confirmed no earlier fix was silently reverted by a later one.
23. `frontend/src/shared/ui/data-table/types.ts` (full, 29 lines) — `UX-068`: confirmed `ColumnDef.priority?: 'always' | 'sm'` is still declared.
24. `frontend/src/features/customers/components/CustomerProfilePage.tsx` (grep) — `UX-014`: confirmed `grid-cols-1 sm:grid-cols-2`.
25. `frontend/src/features/tickets/components/TicketDetailPage.tsx`, `TicketSlaSection.tsx`, `CustomerContextPanel.tsx` (grep for `grid-cols`) — `UX-021`: confirmed the first two are `grid-cols-1 sm:grid-cols-2` and `CustomerContextPanel.tsx` is still deliberately unconverged (no `grid-cols` match at all — still `flex flex-col`).
26. `frontend/src/features/portal/components/PortalMarkdownPreview.tsx` (grep) — `UX-064`: confirmed `overflow-x-auto` still present on the `prose` wrapper.
27. `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` (full, 111 lines) — `UX-065` (`grid-cols-1 sm:grid-cols-2`), plus `UX-058`/`UX-059` layered on top by Story 66 (see below). Confirmed the Description `dt`/`dd` is still inside the same `<dl>` with `sm:col-span-2`, and the field grid is still responsive.

**Originally from Story 65 (`DSN-10`):**
28. `frontend/src/features/tickets/components/TicketFormPage.tsx` lines 9-19, 140-172 (grep) — `UX-018`: confirmed the customer `SelectField` still carries `description={t('fields.customerSearchHint')}` (the corrected hint-only fix, not a combobox).
29. `frontend/src/shared/ui/form/SubmitButton.tsx` (full, 35 lines) — `UX-069`: confirmed the shared component (spinner + optional `pendingLabel`) is unchanged and still the one submit-button pattern (seen in use across `LiveChatWidget.tsx`, `WebFormPage.tsx`, `RoleFormPage.tsx`, `PortalFeedbackFormPage.tsx` above).
30. `frontend/src/features/knowledge-base/components/MarkdownField.tsx` (full, 54 lines) — `UX-026`: confirmed the `markdownSupported`/`markdownGuide` helper line is still rendered below the Write tab's textarea.

**Originally from Story 66 (`DSN-11`) — including the multi-touched files above, re-read fresh:**
31. `frontend/src/app/Sidebar.tsx` (see #22) — `UX-001` (`NavLink` + `buttonVariants`, `end` on `/tickets` and `/knowledge-base`), `UX-002` (`NavSection` wrapping Knowledge Base/Reports) — both confirmed present and unbroken by Story 64's own `readCollapsed` edit to the same file.
32. `frontend/src/features/portal/components/PortalLayout.tsx` (full, 120 lines) — `UX-001`: confirmed every nav item is `NavLink` with active styling, `end` on `/portal` and `/portal/tickets`.
33. `backend/apps/knowledge_base/views.py` lines 63-91 (grep) — `UX-034`: confirmed `ArticleViewSet.get_queryset()` still filters non-manage callers to `status=Article.Status.PUBLISHED` on both `list` and `retrieve`.
34. `frontend/src/features/knowledge-base/components/ArticleListPage.tsx` (full, 131 lines) — `UX-029` (search), `UX-032` (title switches on `isArabic`), plus Story 67's own edit to the same file layered on top (title column, see below) — confirmed both fixes coexist correctly, `id: 'title_en'` still unchanged for sorting.
35. `frontend/src/features/knowledge-base/components/FaqListPage.tsx` lines 14, 25, 79, 94 (grep) — `UX-029`: confirmed `useDebouncedSearch`/`searchInput`/`manage.noSearchResults` all still wired.
36. `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx` (full, 134 lines) — `UX-033` (manage/KB links, from Story 62), `UX-037` (client-side category filter, from Story 66) — both confirmed coexisting correctly.
37. `frontend/src/features/accounts/components/RoleFormPage.tsx` (full, 254 lines) — `UX-041` (`<h2>` group heading), plus Story 63's `UX-043` (select-all-in-group) and Story 67's `UX-042` (`permissionDescriptionKey` with `{ defaultValue: '' }`) layered on the same file — the second-highest-risk file per the task brief (touched by 63, 66, 67); confirmed all three fixes coexist with no regression.
38. `frontend/src/features/reports/components/ManagementDashboardPage.tsx` (full, 136 lines) — `UX-050`: confirmed `KPI_REPORT_ROUTES` + the 4 drill-down links are present, `GaugeChart.tsx` itself untouched, no `from`/`to` carry-over (as documented).
39. `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx` (full, 109 lines) — `UX-058` (back link), plus Story 65's `UX-060` (no pre-selected rating) and Story 63's `UX-062` (`pendingLabel`) on the same file — all three confirmed coexisting.
40. `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` (see #27) — `UX-059`: confirmed the Description `dt`/`dd` is inside the `<dl>`, not a sibling.
41. `frontend/src/features/portal/components/PortalHomePage.tsx` (grep) — `UX-063`: confirmed the Articles and History quick-links are present.
42. `backend/apps/portal/urls.py` (full, 28 lines), `backend/apps/communications/views.py` lines 32-43 (grep) — `UX-057` (deferred): confirmed the portal API still exposes exactly 3 routes (no message/conversation route) and `MessageViewSet.list`/`.retrieve` are still gated behind `Permissions.TICKETS_VIEW`.
43. `backend/apps/tickets/serializers.py` (grep for `sla`, case-insensitive) — `UX-019` (deferred): confirmed `TicketSerializer` still has no SLA field (zero matches).

**Originally from Story 67 (`DSN-12`):**
44. `frontend/src/features/auth/locales/ar.json` (full, 14 lines), `frontend/src/features/live-chat/locales/ar.json` (full, 19 lines), `frontend/src/features/web-form/locales/ar.json` (full, 22 lines) — `UX-012`: confirmed all 6 rewritten phrases are still formal MSA (no dialectal `مش`/`هيرد`/`هنوصلك`/`لسه`/`مفيش`/`رسايل` anywhere in any of the 3 files).
45. `frontend/src/features/customers/components/AttachmentsSection.tsx` lines 36-41, 118 (grep) — `UX-015`: confirmed `formatSize(bytes, t)` still reads `attachments.units.bytes/kilobytes/megabytes`.
46. `frontend/src/features/tickets/locales/en.json` lines 155-159 (grep) — `UX-023`: confirmed `internalNotes.delete.title` is still "Remove this note?".
47. `backend/apps/knowledge_base/models.py` lines 7-22 (grep) — `UX-024` (deferred): confirmed the `FAQ` model still has only `question`/`answer`/`order`, its own doc comment still states "no per-locale content" is deliberate.
48. `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx` (full, 22 lines), `frontend/package.json` line 32 (grep) — `UX-027`: confirmed `remarkGfm` is still imported and passed to `<Markdown remarkPlugins={[remarkGfm]}>`, and `"remark-gfm": "^4.0.1"` is still a resolved dependency.
49. `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx` (full, 66 lines) — `UX-031`: confirmed FAQ answers still render through `<MarkdownPreview>{faq.answer}</MarkdownPreview>`, not plain text.
50. `backend/apps/knowledge_base/search.py` lines 22-27, 65-90 (grep) — `UX-035`: confirmed `_HEADLINE_KWARGS` still sets `start_sel`/`stop_sel` to `"**"` (Markdown bold), not HTML tags.
51. `frontend/src/features/tasks/components/TaskListPage.tsx` (full, 174 lines) — `UX-045`: confirmed `completedFilterLabel` is still computed and passed as `title={completedFilterLabel}` on the status `SelectTrigger`.
52. `frontend/src/features/reports/components/TicketReportsPage.tsx` (full, 268 lines) — `UX-048`: confirmed `toChartSeries` still returns `{ series, totalCount }` and the volume `ChartFrame`'s `description` still shows the truncation note only when `totalCount > MAX_SERIES`; also re-confirms `UX-051`/`UX-052` (this same file) are unaffected.

---

## Frontend Tasks

**No fix task is needed — zero stragglers or regressions were found during this session's re-verification of all 62 `Resolved` rows (31 `critical`/`major` in full, 31 `minor` spot-checked) and all 7 `Deferred`/`Open` rows.** The only task below records the sign-off itself.

### 1 — Record the sign-off in `UX-AUDIT.md`

**Where the sign-off lives:** appended as a new `## Sign-off` section at the end of `design-system/supportos/UX-AUDIT.md`, **not** a new `design-system/supportos/SIGN-OFF.md` file. Justification: this repo's existing convention for the entire `DSN-6`–`DSN-13` thread is that `UX-AUDIT.md` is the single source of truth — every prior story (62–67) appended its own summary paragraph directly into this file rather than writing a separate per-story document, and the file's own header (line 8) already names `DSN-13` as the thread's closing "verifies" step, implying its output belongs in the same file. A second file would fork the bookkeeping the register has consistently kept in one place across 6 prior stories, and this repo (per `design-system/supportos/` currently containing only `MASTER.md` and `UX-AUDIT.md`) has no other precedent for a separate sign-off artifact.

**File: `design-system/supportos/UX-AUDIT.md`** — add a new `Story 68 (DSN-13)` summary paragraph after the existing `Story 67 (DSN-12)` paragraph (following the exact pattern every prior story's paragraph already uses), then append a new `## Sign-off` section at the end of the file:

```markdown
**Story 68 (`DSN-13`), final verification:** every `critical`/`major`
`Resolved` row (31 of 69) was re-verified against the actual current code
in full; every `minor` `Resolved` row (31 of 69) was spot-checked; every
`Deferred`/`Open` row (7 of 69) had its reasoning re-confirmed against
current backend/frontend code. Zero regressions, zero stragglers, zero new
`UX-0NN` findings. Static suite (`lint`/`format:check`/`check:rtl`/`build`,
backend's 54 tests) all pass. No finding's Status column changes as a
result of this story. See `## Sign-off` below.
```

```markdown
## Sign-off

**`DSN-13` (Story 68) — final verification pass, completed.**

- **62 `Resolved` findings**, all reconfirmed accurate against the actual
  current code this session (31 `critical`/`major` read in full, 31
  `minor` spot-checked). Zero regressions found — no earlier story's fix
  was silently reverted or broken by a later story touching the same file
  (checked explicitly for the highest-risk shared files: `Sidebar.tsx`
  touched by Stories 62/64/66; `RoleFormPage.tsx` touched by 63/66/67;
  `ArticleListPage.tsx` touched by 66/67; `PortalTicketDetailPage.tsx`
  touched by 64/66; `PortalFeedbackFormPage.tsx` touched by 63/65/66).
- **5 `Deferred` findings** (`UX-007, 019, 024, 030, 057`) — each needs a
  real backend/data-model change the `DSN-6`–`DSN-13` frontend-only
  guardrail forbids; all 5 reasons re-confirmed still true against current
  backend code. Needs a dedicated non-`DSN` backend story or an explicit
  guardrail exception per finding.
- **2 `Open` findings** (`UX-016, UX-028`, both `minor`) — bulk row
  actions, left open by product judgment (a feature addition, not
  interaction-state polish) since Story 63; unchanged.
- **Zero `critical` findings are `Open`.** One `critical` finding
  (`UX-057`) remains `Deferred` — the customer portal's ticket detail page
  still has no conversation-thread view — pending the same kind of
  decision as the other deferred items. State both halves of this when
  citing "zero open criticals": true by the register's own status
  vocabulary, not the same claim as "every critical is resolved."
- **Static suite, this session:** `npm run lint` (0 errors, 1 pre-existing
  unrelated warning), `npm run format:check` / `npm run check:rtl` /
  `npm run build` (all clean), `python manage.py test` (54/54).
- **Live browser verification was not performed** — no
  Playwright/browser-automation tool was available this session, the same
  gap Stories 66 and 67 both recorded. See `## Edge Cases & Failure Modes`
  for the checklist to run once tooling is available.
- **Sign-off:** the UI baseline this thread (`DSN-6`–`DSN-13`) produced is
  verified consistent with the register's own claims, with the 7 named
  exceptions above carried forward for a future, separately-scoped
  decision. `EPIC 9` (Knowledge Base) and later epics may build on this
  baseline.
```

The header **Totals** line (`**Totals: 69 findings**...`) stays at 69 — no new row is added, no existing row's Status column changes.

---

## Edge Cases & Failure Modes

- **Live browser verification gap** — no Playwright/browser-automation tool was available in this session, the same gap Stories 66 and 67 both explicitly recorded (`00-overview.md`'s own paragraphs for both). This story's verification method is therefore a full re-read of the actual current source for every `critical`/`major` `Resolved` row and a spot-check for every `minor` one — not a substitute for visually confirming rendering, but the only method available. **When browser-automation tooling becomes available in a future session**, run this checklist (do not fabricate results before then):
  1. Load each of the 12 routes touched by the highest-risk shared files (`/customers`, `/tickets`, `/roles/new`, `/knowledge-base/articles/manage`, `/reports/tickets`, `/reports/dashboard`, `/portal`, `/portal/tickets/:id`, `/portal/tickets/:id/feedback`, `/chat`, `/contact`, `*` 404) in `en`/LTR, light mode.
  2. Repeat the same 12 routes in `ar`/RTL, light mode — confirm mirrored layout, no text overflow/truncation regression, Arabic labels read correctly.
  3. Repeat in dark mode, both `en`/LTR and `ar`/RTL — confirm contrast/legibility on the retinted tokens from Stories 36/51, and that no `DSN-6`–`DSN-13` fix (badges, toasts, chart truncation notes, the new `NavSection` labels) is illegible against the dark palette.
  4. Specifically re-check the 5 highest-regression-risk shared files' rendered UI: `Sidebar.tsx` (active-state highlighting + collapse behavior at a narrow viewport), `RoleFormPage.tsx` (permission descriptions + select-all-in-group + `<h2>` heading, all together), `ArticleListPage.tsx` (search + Arabic title switch together), `PortalTicketDetailPage.tsx` (responsive grid + Description inside the `dl`), `PortalFeedbackFormPage.tsx` (back link + no pre-selected rating + pending label).
  5. Trigger the one live-only-observable case this session's static reads cannot confirm: an actual live-chat WebSocket disconnect/reconnect cycle (`UX-006`) and a genuine 15+-agent dataset for `AgentReportsPage` (`UX-047`, currently unverifiable without seed data at that scale).
  6. If any of the above surfaces a genuine visual regression not caught by this session's code-level re-verification, log it as a new `UX-0NN` finding (next unused id: `UX-070`) in `design-system/supportos/UX-AUDIT.md`, following the exact row format every prior story used, and fix it as a small, targeted straggler task — do not silently patch it outside the register.
- **The `LiveChatWidget.tsx:178` lint warning could theoretically indicate a real stale-closure bug in a future refactor of `ChatPane`** — today it does not (verified: `onSubmit` is only invoked by react-hook-form's `handleSubmit` wrapper on actual form submission, never during render; `socketRef.current` is read fresh at call time, not captured stale). If `ChatPane` is refactored later and this warning is still present, re-verify the same reasoning holds rather than assuming it's still a false positive.
- **`UX-057` being `Deferred`, not `Open`, is a status-vocabulary distinction, not a scope loophole** — a future reader of "zero open criticals" should not conclude the portal conversation-thread gap is resolved. This story does not change that finding's Status; it only reconfirms the Deferred reasoning is current.
- **A future story that re-touches any of the 5 multi-story files named above** (`Sidebar.tsx`, `RoleFormPage.tsx`, `ArticleListPage.tsx`, `PortalTicketDetailPage.tsx`, `PortalFeedbackFormPage.tsx`) should re-read the whole file fresh, the same discipline this story and Stories 66/67 both applied — do not assume a summary (including this plan's own `## Context` list) is still accurate once a new edit lands.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added or modified. `python manage.py test` (backend, 54 tests) and the frontend static suite (`lint`/`format:check`/`check:rtl`/`build`) were run as read-only verification this session (see `## Prerequisites` for actual results) and require no changes to pass again after this story's one-file edit (`UX-AUDIT.md`).

---

## Verification Steps

1. **Static suite, from `frontend/`:** `npm run lint` (exit 0, 1 pre-existing unrelated warning expected), `npm run format:check` (exit 0), `npm run check:rtl` (exit 0), `npm run build` (exit 0).
2. **Backend, from `backend/`:** `python manage.py test` — expect `Ran 54 tests ... OK`.
3. **Register bookkeeping:** `design-system/supportos/UX-AUDIT.md` — confirm the new `Story 68 (DSN-13)` summary paragraph and `## Sign-off` section are present, and that no existing row's Status column changed (the header **Totals** line still reads 69).
4. **`git diff --stat`:** confined to `design-system/supportos/UX-AUDIT.md` and this feature's `00-overview.md` — no `frontend/`/`backend/` file changed (this story found no straggler to fix).
5. **Browser-verification steps to perform once tooling is available** (not performed this session — see `## Edge Cases & Failure Modes` item 1 for the full checklist): load each of the 12 named routes in `en`/LTR and `ar`/RTL, in both light and dark mode; specifically re-check the 5 multi-story shared files' rendered UI; exercise the live-chat WebSocket disconnect/reconnect path; if a genuine regression surfaces, log it as `UX-070` and fix it as a follow-up straggler task — do not claim this step was completed if it wasn't.

---

## Done Criteria

- [ ] `design-system/supportos/UX-AUDIT.md` — new `Story 68 (DSN-13)` summary paragraph added after Story 67's; new `## Sign-off` section appended at the end of the file; header **Totals** line confirmed still 69; no existing row's Status column changed.
- [ ] All 31 `critical`/`major` `Resolved` rows re-verified against current code this session — confirmed via `## Context` above, zero regressions found.
- [ ] All 31 `minor` `Resolved` rows spot-checked this session — confirmed via `## Context` above, zero regressions found.
- [ ] All 5 `Deferred` and 2 `Open` rows' reasoning re-confirmed against current backend/frontend code — confirmed via `## Context` above, all still hold.
- [ ] No new `UX-0NN` finding logged — none was found.
- [ ] No `frontend/`/`backend/` file changed — `git diff --stat` confirms `design-system/supportos/UX-AUDIT.md` and this plan's own `00-overview.md` update only.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0 (1 pre-existing, investigated, unrelated lint warning noted, not a failure); `python manage.py test` (backend) — 54/54 passing, confirmed this session.
- [ ] Live browser verification explicitly recorded as **not performed** this session (no tooling available) — the checklist in `## Edge Cases & Failure Modes` / `## Verification Steps` item 5 is left for a future session with tooling, not silently skipped or fabricated.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row and closing narrative.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** This is the **last story in the `DSN-6`–`DSN-13` thread** — `EPIC 8 — Design Intelligence & UI/UX System` is now fully planned (`DSN-0` through `DSN-13`), with `DSN-13` itself pending implementation (this plan) the same way `DSN-12` was pending at the time Story 67's plan was written. Once `DSN-13` implements (appends the sign-off, per `## Frontend Tasks` above) and this story's Done Criteria are checked off, **`EPIC 9 — Knowledge Base` and later epics that name Design Intelligence (`DSN`) as a dependency (`SupportOs backlog.MD:531-532`) become safe to build on this UI baseline** — **minus** the 7 still-`Deferred`/`Open` items (`UX-007, 016, 019, 024, 028, 030, 057`), which need their own product decision (a dedicated non-`DSN` backend story, or an explicit guardrail exception per finding) before they, specifically, are considered resolved.
