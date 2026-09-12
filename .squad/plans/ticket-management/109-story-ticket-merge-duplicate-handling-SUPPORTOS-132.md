# Story 109 — Ticket Merge & Duplicate Handling (Story: SUPPORTOS-132)

## Prerequisites

- **Story 12 (`TKT-1`) completed:** [12-story-create-track-tickets-SUPPORTOS-32.md](12-story-create-track-tickets-SUPPORTOS-32.md). The intake names it directly. `Ticket` (`backend/apps/tickets/models.py`, 348 lines, current — after Story 108) is the record this story adds a `merged_into` pointer field to.
- **Story 24 (`TKT-5`, Ticket History) completed:** [24-story-ticket-history-SUPPORTOS-36.md](24-story-ticket-history-SUPPORTOS-36.md). The intake names it directly ("record the merge in both tickets' TKT-5 history"). `TicketActivity` (`backend/apps/tickets/models.py:167-220`, generic `kind`/`from_value`/`to_value`) and `apps/tickets/history.py::build_history` are reused as-is: this story adds two new `Kind` values and two new `TicketActivity.objects.create(...)` call sites, no new model, no change to `build_history`'s merge shape.
- **Story 13 (`COMM-0`, Messaging Core / Channel Adapter) completed:** [../communication-channels/13-story-messaging-core-channel-adapter-SUPPORTOS-37.md](../communication-channels/13-story-messaging-core-channel-adapter-SUPPORTOS-37.md). The intake names it directly. `Message` (`backend/apps/communications/models.py:8-67`, `ticket` FK `on_delete=CASCADE`) is the model this story's "move messages" reassigns the FK of — via a bulk `.update(ticket=target)`, not a per-row loop.
- **Story 41 (`KB-3`, Knowledge Base Search) completed:** [../knowledge-base/41-story-knowledge-base-search-SUPPORTOS-54.md](../knowledge-base/41-story-knowledge-base-search-SUPPORTOS-54.md). The intake names it directly ("reusing KB-3's existing text-similarity retrieval rather than adding a second search mechanism"). **Verified, not assumed:** `backend/apps/knowledge_base/search.py::search_knowledge_base` (126 lines, read in full) is a plain function, but it is **model-locked to `FAQ`/`Article`** — it builds a `SearchVector` over `question`/`answer` and `title_en`/`body_en`/`title_ar`/`body_ar`, fields `Ticket` does not have. It cannot be called directly for ticket-to-ticket duplicate detection. The reusable *mechanism* KB-3 established is `django.contrib.postgres.search`'s `SearchVector`/`SearchQuery`/`SearchRank` (Postgres full-text search) — not `TrigramSimilarity`, and not `Ticket.subject`'s own `ticket_subject_trgm` `GinIndex` (`models.py:160`, `gin_trgm_ops`), which accelerates the UNRELATED `?search=` `ILIKE` filter and is a different Postgres feature (trigram, not full-text ranking). This story's `apps/tickets/duplicates.py` (Backend Task 3) follows `search_knowledge_base`'s exact annotate/order-by/slice code shape, applied to `Ticket.subject`/`Ticket.description` — the same search *technology*, a new but structurally identical function, not a second technology and not a literal call into `apps.knowledge_base`.
- **Story 67 (`DSN-12`, Microcopy & Bilingual Quality Review) completed:** [../design-intelligence-ui-ux-system/67-story-microcopy-bilingual-quality-review-SUPPORTOS-103.md](../design-intelligence-ui-ux-system/67-story-microcopy-bilingual-quality-review-SUPPORTOS-103.md). The intake names it directly ("make the irreversible parts explicit in the confirm copy per DSN-12"). Its own worked example (`UX-023`: `InternalNotesSection.tsx`'s delete-confirm title changed from "Delete this note?" to "Remove this note?" to match the action's own "Remove" label, establishing a "confirm copy must name the specific, concrete consequence, not a vague verb" bar) is the precedent this story's merge confirm copy follows: the description names exact counts (message/note totals) and states plainly that the action cannot be undone from the UI, per `## Product rules`.
- **Story 106 (`TKT-7`, Bulk Ticket Actions) — recent context, not a formal dependency:** [106-story-bulk-ticket-actions-SUPPORTOS-130.md](106-story-bulk-ticket-actions-SUPPORTOS-130.md). Its own `## Story Goal` explicitly named "ticket merge" as **out of scope** for that story (a stray commit message had bundled the phrase, but no merge intake existed at the time). This story is that follow-up. `apps/tickets/status.py::apply_status_change` (extracted by Story 106) is reused as-is to close the source ticket.
- **Story 108 (`TKT-8`, Saved Views & Filter Presets) — recent context, not a formal dependency:** [108-story-saved-views-filter-presets-SUPPORTOS-131.md](108-story-saved-views-filter-presets-SUPPORTOS-131.md). Most recently touched `apps/tickets/views.py`/`serializers.py` and confirmed, still current: **this app has no per-object permission variance beyond `tickets.manage`** (its own `## Context` item 4, re-verified this session against `apps/core/permissions.py:107-138`) and **`ScopedQuerysetMixin` scopes only `list`, never a detail action** (its own `## Context` item 9, re-verified this session against `apps/core/scoping.py:90-108`). Both facts directly drive this story's `## Product rules` AUTHZ design (below) — there is genuinely no live mechanism today by which a caller holding `tickets.manage` could see one ticket but not another.
- **Verified, not assumed: no "merged" or "duplicate" concept exists anywhere in this codebase today.** `grep -rin "merge\|duplicate" backend/apps/tickets` returns nothing on `Ticket`/`TicketActivity` beyond `build_history`'s own English word "merges" (its two-queryset-into-one-feed sense, unrelated). `Ticket.merged_into` does not exist.
- **Verified, not assumed: `Attachment` is customer-scoped, not ticket-scoped, and no ticket-scoped attachment model exists anywhere.** `grep -rn "class Attachment" backend` finds exactly one model: `backend/apps/customers/models.py:221-260` (`CUST-4`, Story 21) — `customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="attachments", ...)`. There is no FK to `Ticket` or `Message` anywhere on it, and `grep -rn "attachment" frontend/src/features/tickets -i` returns zero files — the ticket detail screen has no attachment concept at all; attachments surface only via the customer record. This directly drives the same-customer merge restriction and the "no attachment move" decision in `## Story Goal`.

---

## Story Goal

1. **Merge API** — `POST /api/tickets/<source_id>/merge/` moves every `Message` and `InternalNote` from a source ticket onto a target ticket, closes the source (via the existing `apply_status_change` transition graph), records a merge event in **both** tickets' `TicketActivity` history, and sets a permanent `Ticket.merged_into` pointer on the source. The source row is never deleted.
2. **Duplicate candidate suggestion** — `GET /api/tickets/<id>/duplicate-candidates/` returns the same customer's other tickets, near in time, ranked by subject/description similarity to this ticket via Postgres full-text search (the same `SearchVector`/`SearchQuery`/`SearchRank` mechanism KB-3 established) — a plain read, never an auto-merge.
3. **Merge UI** — a new "Possible duplicates" section on the ticket detail page lists candidates from (2); each has a "Merge" action that opens the **shared** `useConfirm()` dialog, its description composed from the exact message/internal-note counts about to move, before calling (1).

### Not in scope (firm calls, justified; genuine open questions are in `## Edge Cases & Failure Modes`, not here)

- **Merge is restricted to two tickets belonging to the SAME customer — enforced, `400` otherwise.** Two independent, concrete reasons, both verified this session: (a) `Attachment` is a `Customer`-scoped model with no `Ticket`/`Message` FK at all (see `## Prerequisites`) — for a same-customer merge this makes "move attachments" a documented no-op (the attachments already belong to, and are visible via, the one shared customer record on both tickets' `CustomerContextPanel`/customer detail page); for a cross-customer merge, "move attachments" would have no defined meaning at all (move the CUSTOMER's whole attachment library too? Leave it silently behind, contradicting the intake's own "move attachments" wording?) — an undefined operation this story does not invent an answer for. (b) The intake's own motivating scenario is explicitly same-customer ("a customer who emails and then submits the web form about the same problem generates two [tickets]") — cross-customer "duplicates" are not the gap this story closes.
- **No hard delete of the source ticket, ever — not even an admin override.** The intake's own constraint ("never hard-delete the source — the merge stays auditable and reversible by inspection"). `TicketViewSet.destroy` (the ordinary `DELETE /tickets/<id>/`, gated `tickets.manage`) is untouched by this story and still works on a merged-away ticket if a caller explicitly chooses it — merge itself provides no delete path.
- **No automatic or scheduled merge.** Every merge is one agent's explicit action through the UI (or a hand-crafted authenticated request) — nothing scans for duplicates and merges them unattended. AI-0 is explicitly excluded as a dependency by the intake ("AI-0 may improve ranking later but must not be a dependency of this task") — this story ships with zero AI involvement anywhere in the ranking or the decision.
- **No merging more than two tickets in one call.** The intake's own three sub-tasks describe a source and a target, singular. A "merge N tickets at once" batch operation is undeclared scope; an agent who needs to consolidate three duplicates merges twice, sequentially — the second merge's target is simply the first merge's already-widened target.
- **No un-merge / undo action.** The intake's own wording — "reversible by inspection" — means a human can read the `TicketActivity` trail and the `merged_into` pointer to understand what happened and manually recreate content if truly necessary, not that the UI offers a one-click reversal. Building a real undo (moving messages/notes back, reopening the source, deleting the two log rows) is a materially different, larger feature no task in the intake asks for.
- **No AI-ranked duplicate suggestions.** The intake explicitly excludes `AI-0` as a dependency of this task. Ranking is pure Postgres `SearchRank` over `subject`/`description`, nothing else.
- **No standalone "search for any ticket to merge into" picker.** Verified: no general ticket-search/typeahead component exists anywhere in this frontend today (`CustomerOption`-style pickers exist only for customers). Building one is bigger, undeclared scope. Target selection is driven entirely by the duplicate-candidates list (`## Backend Tasks` Task 3 deliberately does **not** filter out low-ranked rows, so every one of the customer's other recent tickets — not just close text matches — stays selectable; see that task's own reasoning). A true duplicate that falls outside the near-in-time window (90 days, Task 3) cannot be merged through this UI — see `## Edge Cases & Failure Modes`.
- **No change to `Task`/`Feedback`'s ticket links.** `apps/agents/models.py::Task.ticket` (`SET_NULL`, optional follow-up link) and `apps/tickets/models.py::Feedback.ticket` (`OneToOneField`, a CSAT rating of that specific interaction) are untouched by a merge — the intake names messages, attachments, and internal notes only. A task linked to the source still points at the (now closed) source; a feedback rating still rates the source ticket's own interaction, not the target's.
- **The source's own PRE-merge `TicketActivity` history (its past status/assignment changes) is not copied or moved to the target.** It stays on the source, exactly as it happened — an accurate record of what occurred on that ticket before the merge. Only one new activity row is added to each of the two tickets (see `## Product rules`).

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-132/intake.md` — three task blocks, no attachments, no acceptance-criteria list, no out-of-scope section (this plan supplies both).
2. `backend/apps/tickets/models.py`, full file (348 lines, current — after Story 108). `Ticket` (27-164, especially the `SET_NULL` FK comment-block style at 60-120 — `merged_into` copies it); `TicketActivity` (167-220, `Kind.STATUS_CHANGED`/`Kind.ASSIGNED`, the exact `kind`/`from_value`/`to_value` shape the two new `Kind`s reuse verbatim); confirms `SavedView` (275-348) is the current last model — `merged_into` is added to `Ticket` itself, not a new model.
3. `backend/apps/tickets/views.py`, full file (576 lines, current). `permission_map` (162-192, the "keyed by the `@action`'s own method name, missing means authenticated-only" rule every entry follows — `merge`/`duplicate_candidates` are two new entries); `assign` (305-337) and `set_status` (339-352) as the "validate + call one shared helper + return `self.get_serializer(...)`" shape `merge` copies; `history` (475-486) and `context`/`sla` (488-513) as the `detail=True`, `GET`, read-only-action shape `duplicate_candidates` copies; `get_queryset` (240-289, confirms the early `if self.action != "list": return queryset` — `self.get_queryset()` inside `merge`/`duplicate_candidates` therefore returns the plain, unscoped `Ticket.objects.select_related(...).all()`, not a department/branch-filtered one).
4. `backend/apps/tickets/status.py`, full file (69 lines, current — after Story 106). `apply_status_change(ticket, new_status, actor)` (35-69): validates and closes in one call, already raising a clean `ValidationError` for a no-op re-statement — `apply_merge` (Backend Task 2) must skip this call entirely when the source is already `closed`, not call it and catch the exception.
5. `backend/apps/tickets/assignment.py`, full file (74 lines). `apply_assignment` (45-74) — the "small pure helper, validation + mutation + one `TicketActivity.objects.create` call, imported by `views.py`" shape `apps/tickets/merge.py` (Backend Task 2) follows exactly.
6. `backend/apps/tickets/history.py`, full file (60 lines). `from apps.communications.models import Message` (line 14) is the **verified-safe reverse-direction import** precedent (`apps.tickets` importing a sibling app's model) this story's `apply_merge` reuses for the identical `Message` import, and extends by ALSO importing `apps.agents.models.InternalNote` — a new direction (`apps.tickets` → `apps.agents`; today only `apps.agents` imports `apps.tickets.models.Ticket`, never the reverse). Neither `apps/tickets/models.py` nor `apps/agents/models.py` imports the other, so this is not a real import cycle, but it is the FIRST time `apps.tickets` imports anything from `apps.agents` — `## Verification Steps` checks `python manage.py check` explicitly for this reason.
7. `backend/apps/communications/models.py` lines 8-67 — `Message` (`ticket` FK, `on_delete=CASCADE`, no `author`/actor field at all — confirmed in Story 24 `## Prerequisites` too). Moving a message is exactly `Message.objects.filter(ticket=source).update(ticket=target)` — no other field references the ticket.
8. `backend/apps/agents/models.py` lines 89-133 — `InternalNote` (`ticket` FK `CASCADE`, `author` `SET_NULL`, `body`, `mentioned_users` M2M). The M2M table has no `ticket` column of its own — moving `InternalNote.ticket` via `.update()` needs no M2M-table change.
9. `backend/apps/agents/serializers.py` lines 105-130 — `InternalNoteSerializer.immutable_fields = ("ticket",)`. This is a **serializer-level** guard on `PATCH`/`POST` through the API; `apply_merge`'s bulk `.update(ticket=target)` operates on the ORM directly and is unaffected by it (the same way `apply_status_change`'s direct `ticket.status = new_status; ticket.save(...)` bypasses `TicketSerializer.read_only_fields` today).
10. `backend/apps/knowledge_base/search.py`, full file (126 lines) — read in full; see `## Prerequisites` for why this cannot be called directly and what is reused instead. `_combined_query`'s "OR three configs together" trick (31-43) is **not** reused — `Ticket` has no per-language field split (unlike `Article`), so a single `config="simple"` `SearchQuery`/`SearchVector` pair is the correct, simpler analogue, matching `FAQ`'s own `config="simple"` choice (`FAQ` also has no bilingual field split).
11. `backend/apps/core/permissions.py`, full file (149 lines). `HasPermission.has_object_permission` (107-138) — confirmed it only ever tightens for a portal customer via `customer_field`, which `TicketViewSet` does not declare; `_required_permission` (140-148) — confirms `permission_map` gates by action name only, never by which specific object(s) the action touches. This is the concrete basis for `## Product rules`'s AUTHZ row below.
12. `backend/apps/core/scoping.py`, full file (109 lines). `ScopedQuerysetMixin.scoped_actions = ("list",)` (102) and `get_queryset` (104-108) — confirms `merge`/`duplicate_candidates` (both custom `@action`s, not `list`) never pass through `apply_scope_filters` at all, the same unscoped behaviour `assign`/`set_status`/`history`/`context`/`sla`/every `bulk_*` action already has (Story 98's own finding, reused by Story 106/108).
13. `backend/apps/tickets/migrations/0012_savedview.py` — the latest tickets migration; this story's migration depends on it. `backend/apps/tickets/migrations/0006_ticketactivity.py`, full file (35 lines) — confirms `TicketActivity.kind` is a plain `CharField(choices=[...])` with **no DB-level `CHECK` constraint** (Postgres does not enforce Django `choices=` at the schema level for a `CharField`); adding two new `Kind` values still produces a migration (an `AlterField` updating the field's `choices=` metadata, which Django's migration autodetector tracks even though it has zero effect on the actual column).
14. `backend/apps/tickets/serializers.py`, full file (181 lines, current). `TicketSerializer` (74-181) — `category_name`/`department_name`/`branch_name`'s identical `source="<fk>.<field>", read_only=True, allow_null=True` pattern (91-100) is what `merged_into_subject` (Backend Task 1) copies; `read_only_fields` (148-153) is where `merged_into`/`merged_into_subject` are added.
15. `frontend/src/features/tickets/components/TicketDetailPage.tsx`, full file (228 lines, current). The `<div className="flex flex-col gap-4">` render order (213-217: `TicketSlaSection`, `TicketConversation`, `SuggestedSolutionsPanel`, `TicketHistorySection`, `InternalNotesSection`) — `TicketDuplicateCandidatesSection` (Frontend Task 5) is inserted directly after the header `<Card>` (ends line 212) and before `TicketSlaSection` (213), so an agent sees "you might be duplicating work" before anything else. `handleDelete` (43-52) is the exact `confirm()` → `mutateAsync` → `navigate(...)` shape the new merge handler copies.
16. `frontend/src/features/tickets/components/InternalNotesSection.tsx` lines 105-120 (`NoteRow.handleDelete`) — the simplest existing `useConfirm()` call in this feature (title + description + `destructive: true`, no rich content), confirming `ConfirmOptions.description` is a single already-translated string (`frontend/src/shared/ui/confirm/types.ts`, full file, 11 lines) — the merge confirm's per-ticket counts are interpolated into that ONE string via i18n, not passed as a second prop (`useConfirm()` has no such prop).
17. `frontend/src/features/tickets/api/useMessages.ts` (11 lines) and `frontend/src/features/tickets/api/useInternalNotes.ts` (11 lines), both full files — `useMessages(ticketId)`/`useInternalNotes(ticketId)` both key off `ticketKeys.resource('messages'|'internalNotes', ticketId)` and return `Page<T>` (`frontend/src/shared/lib/api/types.ts:72-75`, `pagination.count` is the total row count). `TicketDuplicateCandidatesSection` calls both hooks itself for the SAME `ticketId` `TicketConversation`/`InternalNotesSection` already query on the same page — React Query's cache dedupes the network request by key, so this costs no extra request in the common case, and gives the merge confirm dialog its exact "N messages, M notes" counts with zero new backend endpoint.
18. `frontend/src/features/tickets/api/useTicketMutations.ts`, full file (133 lines, current — after Story 106). `useAssignTicket`/`useEscalateTicket`'s per-ticket-`id`, prefix-wide-`ticketKeys.all`-invalidation shape (48-70) is what `useMergeTicket(id)` (Frontend Task 6) copies — one invalidation covers BOTH the source's and the target's cached detail/history, since `ticketKeys.resource('history', anyId)` is a child of the invalidated `ticketKeys.all` prefix (the exact reasoning Story 24 already verified for `useAssignTicket`).
19. `frontend/src/features/tickets/types/ticket.ts`, full file (75 lines) — `Ticket` type (23-46); `merged_into`/`merged_into_subject` are added, mirroring `category`/`category_name`'s `number | null`/`string | null` pair exactly (32-33).
20. `frontend/src/features/tickets/types/ticketHistoryEntry.ts` (Story 24, full file) — `TicketActivityKind = 'status_changed' | 'assigned'` (line 15-ish) gains `'merged_into' | 'merged_from'`; `TicketHistoryActivityEntry` itself needs no shape change (`from_value`/`to_value` are already generic strings).
21. `frontend/src/features/tickets/components/TicketHistorySection.tsx`, full file (Story 24, ~185 lines) — `ActivityRow`'s binary `status_changed`/else-`assigned` branching (the `from`/`to` translation block) is extended to a third/fourth case for the two new kinds — see Frontend Task 4.
22. `frontend/src/features/tickets/locales/en.json`, full file (266 lines, current — after Story 108). The `history` block (151-161) — where the two new `kinds` entries and two new sentence keys are added; the `internalNotes.delete`/`categories.delete`/`savedViews.delete` blocks' identical `{title, description}` shape (201-204, 226-229, 257-260) is the precedent a new `merge` block's `confirmTitle`/`confirmDescription` follows; `ar.json` is the same file, translated (every prior story in this feature mirrors `en.json`'s key structure into `ar.json` with translated values — Story 108 `## Context` item 20 records the same note).
23. `CONVENTIONS.md` §22 (`permission_map` completeness — a missing entry is authenticated-only, not denied) and §23 (feature module conventions — read the closing paragraph, appended after by Story 108, to see where this story's own paragraph appends).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Merging moves messages, internal notes; closes the source; records the merge in both tickets' history.** | Intake, task 1 | `apps/tickets/merge.py::apply_merge` — one `transaction.atomic()` block, four steps (see Backend Task 2). |
| **The source is never hard-deleted.** | Intake, task 1, explicit constraint | `apply_merge` never calls `.delete()`; `TicketViewSet.merge` has no `destroy`-adjacent code path. |
| **Merge is same-customer only.** | This story's design, per `## Story Goal` | `apply_merge` raises `ValidationError` when `source.customer_id != target.customer_id`. |
| **AUTHZ is checked once, globally (`tickets.manage`), but BOTH tickets are fetched through the SAME queryset — never a raw, unchecked ORM lookup for either side.** | Intake, task 1 ("apply AUTHZ permission checks to both tickets, not just one"); this story's concrete reading of it, justified in `## Prerequisites` | `permission_map["merge"] = TICKETS_MANAGE` (checked once — this app has no per-object permission variance beyond it, verified). `source = self.get_object()`; `target = self.get_queryset().filter(pk=target_id).first()` — the SAME `self.get_queryset()`, not `Ticket.objects.get(pk=target_id)`, so a future scoping change protects both sides symmetrically with no code change here. |
| **A ticket cannot be merged into itself, into an already-merged-away ticket, or if it is itself already merged away.** | This story's design (edge-case closure the intake's prose implies but does not spell out) | Three explicit checks at the top of `apply_merge`, each a distinct `ValidationError` message. |
| **The merge is atomic — a partial move (e.g. messages moved, notes not) can never persist.** | This story's design | The whole of `apply_merge`'s body runs inside one `transaction.atomic()` block; `select_for_update()` on the re-fetched source closes the concurrent-merge race (see `## Edge Cases`). |
| **Duplicate suggestion is same customer, near in time (±90 days), ranked by subject/description similarity — reusing KB-3's full-text-search mechanism, not a second one.** | Intake, task 2 | `apps/tickets/duplicates.py::find_duplicate_candidates` — `SearchVector`/`SearchQuery`/`SearchRank`, the identical Postgres feature `search_knowledge_base` uses; see `## Prerequisites`. |
| **Suggestion is read-only; it never auto-merges.** | Intake, task 2, explicit constraint | `duplicate_candidates` is a `GET` action; nothing in it calls `apply_merge`. |
| **AI-0 is not a dependency.** | Intake, task 2, explicit constraint | `find_duplicate_candidates` imports nothing from `apps.ai`. |
| **The confirm step shows exactly what will move, via the shared confirm dialog.** | Intake, task 3 | `useConfirm()` (not a new dialog) with a `description` interpolating the SOURCE ticket's live message/internal-note counts (`useMessages`/`useInternalNotes`, already-cached). |
| **The confirm copy states plainly that the action cannot be undone from the UI — DSN-12's bar for concrete, specific irreversibility language.** | Intake, task 3 ("make the irreversible parts explicit... per DSN-12") | `tickets:merge.confirmDescription` i18n string, both `en`/`ar`. |
| Wire format is `snake_case` end to end. | §12 | `target_id`, `merged_into`, `merged_into_subject`. |
| No new permission constant. | §17, §22 | `merge`/`duplicate_candidates` both reuse `Permissions.TICKETS_MANAGE`/`TICKETS_VIEW`. |

---

## Backend Tasks

### 1 — `Ticket.merged_into` and two new `TicketActivity.Kind` values

**File: `backend/apps/tickets/models.py`** — add a field to `Ticket`, directly after `escalated_at` (before `class Meta:`, line 137):

```python
    # Self-referential SET_NULL, nullable: a permanent pointer left on the
    # SOURCE ticket after TKT-9's merge closes it — never cleared, never
    # followed automatically by any other code path. SET_NULL (not CASCADE
    # or PROTECT): deleting the TARGET ticket later (TicketViewSet.destroy,
    # untouched by this story) must not delete or block deleting the
    # source — the source's own history/messages/notes still exist and
    # still mean something even if the ticket they were consolidated into
    # is later removed. See Story 109 `## Story Goal`.
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_tickets",
        verbose_name=_("merged into"),
    )
```

Extend `TicketActivity.Kind` (line 178, after `ASSIGNED`):

```python
        # TKT-9: recorded once on EACH side of a merge — the source gets
        # MERGED_INTO (to_value = a snapshot of the TARGET), the target
        # gets MERGED_FROM (to_value = a snapshot of the SOURCE). Two kinds,
        # not one with a direction flag, matching this model's own
        # "one Kind per semantic event" precedent (STATUS_CHANGED/ASSIGNED
        # are also two kinds, not one "changed" kind with a field name).
        MERGED_INTO = "merged_into", _("Merged into another ticket")
        MERGED_FROM = "merged_from", _("Merged from another ticket")
```

**Migration:** from `backend/`, venv active: `python manage.py makemigrations tickets`. Expect **one** new file, `apps/tickets/migrations/0013_ticket_merged_into_ticketactivity_kind.py` or Django's equivalent auto-name, containing an `AddField` (`Ticket.merged_into`, self-FK) and an `AlterField` (`TicketActivity.kind`, updated `choices=`) — the `AlterField` has no real schema effect (see `## Context`, item 13) but Django's autodetector still emits it because the field's `choices=` kwarg changed. Depends on `("tickets", "0012_savedview")`.

**File: `backend/apps/tickets/admin.py`** — no change needed to register `merged_into`: extend `TicketAdmin.list_display`/`readonly_fields` only if it already lists individual fields (verify against the current file before editing; if `TicketAdmin` uses `list_display` with a small curated set, add `"merged_into"` to it so ops can see the pointer without opening `/admin/tickets/ticketactivity/`).

---

### 2 — The merge helper

**Create file: `backend/apps/tickets/merge.py`**

```python
"""Merging a duplicate ticket into another — TKT-9. Same shape as
`apps/tickets/assignment.py`/`apps/tickets/status.py`: a small, validating,
mutating helper imported by `views.py`, so a future second caller (there is
none today — see Story 109 `## Story Goal`, "no bulk merge") can never
bypass the checks or the logging.

Reverse-direction imports: `Message` from `apps.communications` mirrors the
identical import `apps/tickets/history.py` already makes safely (Story 24).
`InternalNote` from `apps.agents` is the FIRST import in this direction —
today only `apps.agents.models` imports `apps.tickets.models.Ticket`, never
the reverse. Neither models module imports the other's non-model code, so
this is not a real cycle; `python manage.py check` is the verification
(see Story 109 `## Verification Steps`).
"""

from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.agents.models import InternalNote
from apps.communications.models import Message

from .models import Ticket, TicketActivity
from .status import apply_status_change


def apply_merge(source: Ticket, target: Ticket, actor) -> None:
    """Validates, then merges `source` into `target`: moves every Message
    and InternalNote, closes `source` (unless already closed), sets
    `source.merged_into`, and logs one TicketActivity row on EACH ticket.
    Raises `ValidationError` (never a bare exception) for every rejected
    case, so `TicketViewSet.merge`'s `except` handling stays uniform with
    every other action in this file.
    """
    if source.pk == target.pk:
        raise ValidationError({"target_id": [_("A ticket cannot be merged into itself.")]})
    if source.customer_id != target.customer_id:
        raise ValidationError(
            {"target_id": [_("Cannot merge tickets that belong to different customers.")]}
        )

    with transaction.atomic():
        # Re-fetch and lock the source row inside the transaction: closes
        # the race where two concurrent merge requests for the SAME source
        # both pass the `merged_into_id is None` check below before either
        # commits (see Story 109 `## Edge Cases & Failure Modes`). The
        # SECOND request then blocks here until the first commits, re-reads
        # a now-non-null `merged_into_id`, and cleanly raises instead of
        # silently overwriting the first merge's pointer.
        source = Ticket.objects.select_for_update().get(pk=source.pk)
        if source.merged_into_id is not None:
            raise ValidationError({"target_id": [_("This ticket has already been merged.")]})
        if target.merged_into_id is not None:
            raise ValidationError(
                {
                    "target_id": [
                        _("Cannot merge into a ticket that was itself merged into another ticket.")
                    ]
                }
            )

        Message.objects.filter(ticket=source).update(ticket=target)
        InternalNote.objects.filter(ticket=source).update(ticket=target)
        # Attachment is deliberately NOT touched: it is a Customer-scoped
        # model (`apps.customers.models.Attachment`), never a Ticket-scoped
        # one — see Story 109 `## Prerequisites`/`## Story Goal`. Since
        # source and target share the same customer (checked above), every
        # attachment is already visible on both tickets' customer panel;
        # there is nothing to move.

        source.merged_into = target
        source.save(update_fields=["merged_into", "updated_at"])
        if source.status != Ticket.Status.CLOSED:
            apply_status_change(source, Ticket.Status.CLOSED, actor=actor)

        TicketActivity.objects.create(
            ticket=source,
            actor=actor,
            kind=TicketActivity.Kind.MERGED_INTO,
            to_value=f"#{target.id} — {target.subject}"[:150],
        )
        TicketActivity.objects.create(
            ticket=target,
            actor=actor,
            kind=TicketActivity.Kind.MERGED_FROM,
            to_value=f"#{source.id} — {source.subject}"[:150],
        )
```

---

### 3 — The duplicate-candidate helper

**Create file: `backend/apps/tickets/duplicates.py`**

```python
"""Duplicate-candidate suggestion for the ticket merge flow — TKT-9.
Reuses the SAME Postgres full-text-search mechanism (SearchVector/
SearchQuery/SearchRank) `apps.knowledge_base.search::search_knowledge_base`
already established for KB-3 — applied to `Ticket.subject`/`description`
instead of FAQ/Article fields, since that function is model-locked and
cannot be called directly here. See Story 109 `## Prerequisites`.
"""

from datetime import timedelta

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

from .models import Ticket

DEFAULT_LIMIT = 10
# A generous but real window ("near in time," the intake's own wording) —
# the same "deliberate round number" precedent `HISTORY_MAX_ENTRIES`/
# `MAX_BULK_IDS` already set in this app. Symmetric: the true duplicate may
# have been filed either before or after this ticket.
NEAR_IN_TIME_DAYS = 90


def find_duplicate_candidates(ticket: Ticket, *, limit: int = DEFAULT_LIMIT) -> list[Ticket]:
    """The SAME customer's other, not-already-merged-away tickets, filed
    within `NEAR_IN_TIME_DAYS` of this one, ordered by full-text rank
    against THIS ticket's own subject (highest first) and then recency.

    Deliberately does NOT filter out `rank == 0` rows the way
    `search_knowledge_base` filters `rank__gt=0`: this list doubles as the
    merge dialog's ONLY target picker (no separate ticket-search UI exists
    — see `## Story Goal`), so every one of the customer's other recent
    tickets stays selectable even when its text does not literally overlap
    with this one. Rank only affects ORDER, never membership.
    """
    window_start = ticket.created_at - timedelta(days=NEAR_IN_TIME_DAYS)
    window_end = ticket.created_at + timedelta(days=NEAR_IN_TIME_DAYS)
    search_query = SearchQuery(ticket.subject, config="simple")
    vector = SearchVector("subject", weight="A", config="simple") + SearchVector(
        "description", weight="B", config="simple"
    )
    return list(
        Ticket.objects.filter(
            customer_id=ticket.customer_id,
            merged_into__isnull=True,
            created_at__gte=window_start,
            created_at__lte=window_end,
        )
        .exclude(pk=ticket.pk)
        .annotate(rank=SearchRank(vector, search_query))
        .order_by("-rank", "-created_at")[:limit]
    )
```

---

### 4 — Serializer: `merged_into`/`merged_into_subject`

**File: `backend/apps/tickets/serializers.py`** — add to `TicketSerializer`, after `assigned_agent_name` (line 109):

```python
    # Same verified-safe dotted-source + `allow_null=True` pattern as
    # `category_name`/`department_name`/`branch_name` above. `merged_into`
    # itself needs no declaration — DRF derives `required=False,
    # allow_null=True` from the model field's own `null=True, blank=True`.
    merged_into_subject = serializers.CharField(
        source="merged_into.subject", read_only=True, allow_null=True
    )
```

Add `"merged_into"`/`"merged_into_subject"` to `Meta.fields` (after `"escalated_at"`, before `"created_at"`) and to `read_only_fields` (alongside `assigned_agent`/`status`/`escalated`/`escalated_at`, line 148-153) — `merged_into` is written **only** through `TicketViewSet.merge`, never through the ordinary create/edit form, the same rule every other action-only field in this serializer already follows.

---

### 5 — Views: `merge` and `duplicate_candidates` actions

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from .duplicates import find_duplicate_candidates
from .merge import apply_merge
```

Add two `permission_map` entries, alongside `history`/`context`/`sla` (line 186-188):

```python
        "merge": Permissions.TICKETS_MANAGE,
        "duplicate_candidates": Permissions.TICKETS_VIEW,
```

Append two actions directly after `escalate` (after line 375, before `bulk_assign`):

```python
    @action(detail=True, methods=["post"], url_path="merge")
    def merge(self, request, pk=None):
        """Merge this ticket (the SOURCE) into another (the TARGET) — TKT-9.
        `target_id` must be present and a valid ticket id. Both AUTHZ and
        the customer/self/already-merged checks are enforced inside
        `apply_merge` — see Story 109 `## Product rules`.
        """
        if "target_id" not in request.data:
            raise ValidationError({"target_id": [_("This field is required.")]})
        try:
            target_id = int(request.data.get("target_id"))
        except (TypeError, ValueError):
            raise ValidationError({"target_id": [_("Must be a valid ticket id.")]}) from None

        source = self.get_object()
        # SAME queryset `get_object()` itself filters through — not a raw
        # `Ticket.objects.get(...)` — so the target is fetched under the
        # identical visibility rule the source already was. See Story 109
        # `## Product rules` (AUTHZ row).
        target = self.get_queryset().filter(pk=target_id).first()
        if target is None:
            raise ValidationError({"target_id": [_("Ticket not found.")]})

        apply_merge(source, target, actor=request.user)
        return Response(self.get_serializer(source).data)

    @action(detail=True, methods=["get"], url_path="duplicate-candidates")
    def duplicate_candidates(self, request, pk=None):
        """Likely duplicates of this ticket — TKT-9. Suggestion only; never
        merges anything. Gated `tickets.view` alone, the same reasoning
        `history`/`context`/`sla` use — a read, no separate permission.
        """
        ticket = self.get_object()
        candidates = find_duplicate_candidates(ticket)
        return Response(
            [
                {
                    "id": candidate.id,
                    "subject": candidate.subject,
                    "status": candidate.status,
                    "priority": candidate.priority,
                    "created_at": candidate.created_at,
                    "rank": candidate.rank,
                }
                for candidate in candidates
            ]
        )
```

**No `apps/tickets/urls.py` change** — both are router-generated `detail=True` actions, like `history`/`context`/`sla`. Endpoints: `POST /api/tickets/<id>/merge/`, `GET /api/tickets/<id>/duplicate-candidates/`.

---

### 6 — Admin: `TicketActivityAdmin` picks up the new kinds for free

**File: `backend/apps/tickets/admin.py`** — no code change. `TicketActivityAdmin.list_filter = ("kind",)` (established by Story 24) already renders whatever `Kind.choices` contains — `MERGED_INTO`/`MERGED_FROM` appear in its filter dropdown automatically once Task 1's migration lands. Verify this while implementing; do not add a second registration.

---

## Frontend Tasks

### 1 — `Ticket` type: `merged_into`/`merged_into_subject`

**File: `frontend/src/features/tickets/types/ticket.ts`** — add to the `Ticket` type, after `branch_name` (line 37):

```ts
  merged_into: number | null
  merged_into_subject: string | null
```

`TicketInput` is unchanged — `merged_into` is action-only, never sent from the create/edit form, the same rule `assigned_agent`/`status` already follow.

---

### 2 — Duplicate-candidate type and API layer

**Create file: `frontend/src/features/tickets/types/duplicateCandidate.ts`**

```ts
import type { TicketPriority, TicketStatus } from './ticket'

/** Mirrors the plain array `TicketViewSet.duplicate_candidates` returns —
 * TKT-9. Not a `Ticket` — deliberately narrower, the same "small,
 * purpose-built shape" `assignable-agents` already returns rather than a
 * full resource. */
export type DuplicateCandidate = {
  id: number
  subject: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  /** Full-text rank against the CURRENT ticket's subject — higher is a
   * closer textual match. Order only; never filtered on in the UI. */
  rank: number
}
```

**Create file: `frontend/src/features/tickets/api/getDuplicateCandidates.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { DuplicateCandidate } from '../types/duplicateCandidate'

export function getDuplicateCandidates(ticketId: number): Promise<DuplicateCandidate[]> {
  return api.get<DuplicateCandidate[]>(`/tickets/${ticketId}/duplicate-candidates/`)
}
```

**Create file: `frontend/src/features/tickets/api/useDuplicateCandidates.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getDuplicateCandidates } from './getDuplicateCandidates'
import { ticketKeys } from './ticketKeys'

export function useDuplicateCandidates(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('duplicate-candidates', ticketId),
    queryFn: () => getDuplicateCandidates(ticketId),
  })
}
```

**Create file: `frontend/src/features/tickets/api/mergeTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

export function mergeTicket(sourceId: number, targetId: number): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${sourceId}/merge/`, { target_id: targetId })
}
```

**File: `frontend/src/features/tickets/api/useTicketMutations.ts`** — append, mirroring `useEscalateTicket`'s per-`id`, prefix-wide-invalidation shape (extend the import block with `mergeTicket`):

```ts
// Prefix-wide invalidation covers BOTH sides of the merge: the source's
// own detail/history AND the target's — ticketKeys.resource('history',
// targetId) is a child of the invalidated ticketKeys.all prefix, the same
// reasoning Story 24 already verified for useAssignTicket. TKT-9.
export function useMergeTicket(sourceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (targetId: number) => mergeTicket(sourceId, targetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
```

---

### 3 — History entry types: two new activity kinds

**File: `frontend/src/features/tickets/types/ticketHistoryEntry.ts`** — widen the union:

```ts
export type TicketActivityKind = 'status_changed' | 'assigned' | 'merged_into' | 'merged_from'
```

No other change in this file — `TicketHistoryActivityEntry`'s `from_value`/`to_value` are already generic strings.

---

### 4 — `TicketHistorySection`: render the two new kinds

**File: `frontend/src/features/tickets/components/TicketHistorySection.tsx`** — `ActivityRow`'s existing `from`/`to` translation block branches on `entry.activity_kind === 'status_changed'` vs. else-`assigned`. Replace it with a three-way branch (verify the exact current line numbers before editing — Story 24's own numbers have shifted after Stories 106/108 touched sibling files in this feature, though not this one directly):

```tsx
function ActivityRow({ entry }: { entry: TicketHistoryActivityEntry }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()

  // TKT-9: merged_into/merged_from carry no translatable from/to pair —
  // `to_value` is already a rendered snapshot string ("#45 — Login
  // issue"), the same "point-in-time snapshot over a live reference"
  // choice `assigned`'s name snapshot already established (Story 24
  // `## Prerequisites`). Rendered as one sentence with a single
  // interpolated `ref`, not the two-value `statusChanged`/
  // `assigneeChanged` template.
  if (entry.activity_kind === 'merged_into' || entry.activity_kind === 'merged_from') {
    return (
      <li className="flex flex-col gap-1 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{t(`history.kinds.${entry.activity_kind}`)}</Badge>
          <span>{dateTime(entry.occurred_at)}</span>
        </div>
        <p>
          {t(entry.activity_kind === 'merged_into' ? 'history.mergedInto' : 'history.mergedFrom', {
            ref: entry.to_value,
          })}
          {entry.actor_name ? ` ${t('history.by', { actor: entry.actor_name })}` : null}
        </p>
      </li>
    )
  }

  const from =
    entry.activity_kind === 'status_changed'
      ? t(`statuses.${entry.from_value}`)
      : entry.from_value || t('fields.unassigned')
  const to =
    entry.activity_kind === 'status_changed'
      ? t(`statuses.${entry.to_value}`)
      : entry.to_value || t('fields.unassigned')

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{t(`history.kinds.${entry.activity_kind}`)}</Badge>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      <p>
        {t(
          entry.activity_kind === 'status_changed' ? 'history.statusChanged' : 'history.assigneeChanged',
          { from, to },
        )}
        {entry.actor_name ? ` ${t('history.by', { actor: entry.actor_name })}` : null}
      </p>
    </li>
  )
}
```

---

### 5 — `TicketDuplicateCandidatesSection`: the new section

**Create file: `frontend/src/features/tickets/components/TicketDuplicateCandidatesSection.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useDuplicateCandidates } from '../api/useDuplicateCandidates'
import { useInternalNotes } from '../api/useInternalNotes'
import { useMessages } from '../api/useMessages'
import { useMergeTicket } from '../api/useTicketMutations'
import { ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'
import type { DuplicateCandidate } from '../types/duplicateCandidate'

/**
 * "Possible duplicates" — TKT-9 task 2/3. Read-only suggestions plus a
 * "Merge" action per row; the confirm step itself is the SHARED
 * `useConfirm()` dialog (no new Dialog component — see Story 109
 * `## Product rules`). Rendered only under `tickets.manage`: a caller who
 * could not act on a merge gains nothing from seeing the list, the same
 * "entire feature invisible, not merely disabled" reasoning
 * `TicketBulkActionBar` already established (Story 106). Gating is done
 * at the `TicketDetailPage` call site (Frontend Task 6), not inside this
 * component, matching that same precedent.
 */
export function TicketDuplicateCandidatesSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useDuplicateCandidates(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('merge.sectionTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          query={query}
          isEmpty={(candidates) => candidates.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('merge.empty')}</p>}
        >
          {(candidates) => (
            <ul className="flex flex-col gap-2">
              {candidates.map((candidate) => (
                <CandidateRow key={candidate.id} ticketId={ticketId} candidate={candidate} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function CandidateRow({
  ticketId,
  candidate,
}: {
  ticketId: number
  candidate: DuplicateCandidate
}) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  // Same query keys TicketConversation/InternalNotesSection already use
  // for this ticketId — React Query dedupes by key, so this reuses their
  // cached fetch rather than issuing a second request. See Story 109
  // `## Context`, item 17.
  const messagesQuery = useMessages(ticketId)
  const notesQuery = useInternalNotes(ticketId)
  const mergeMutation = useMergeTicket(ticketId)

  async function handleMerge() {
    const messageCount = messagesQuery.data?.pagination.count ?? 0
    const noteCount = notesQuery.data?.pagination.count ?? 0
    const confirmed = await confirm({
      title: t('merge.confirmTitle', { id: candidate.id, subject: candidate.subject }),
      description: t('merge.confirmDescription', {
        messageCount,
        noteCount,
        id: candidate.id,
      }),
      destructive: true,
    })
    if (!confirmed) return
    mergeMutation.mutate(candidate.id, {
      onSuccess: () => toast({ tone: 'success', message: t('merge.merged') }),
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <Link to={`/tickets/${candidate.id}`} className="font-medium hover:underline">
          {candidate.subject}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={ticketStatusVariant(candidate.status)}>
            {t(`statuses.${candidate.status}`)}
          </Badge>
          <Badge variant={ticketPriorityVariant(candidate.priority)}>
            {t(`priorities.${candidate.priority}`)}
          </Badge>
          <span>{date(candidate.created_at)}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mergeMutation.isPending}
        onClick={() => void handleMerge()}
      >
        {t('merge.action')}
      </Button>
    </li>
  )
}
```

> Verify `ticketStatusVariant`/`ticketPriorityVariant`'s exact export names against `frontend/src/features/tickets/lib/statusBadge.ts` before wiring — `TicketDetailPage.tsx` line 16 already imports both from that path for its own badges; this reuses the identical import.

---

### 6 — Ticket detail: render the section, the "merged" banner, and the header "Merge" hint

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`**

Add the import, alongside the other section imports (keep the block alphabetized, per the existing style):

```tsx
import { TicketDuplicateCandidatesSection } from './TicketDuplicateCandidatesSection'
```

Insert, directly after the header `<Card>` closes (after line 212) and before `<TicketSlaSection ticketId={ticket.id} />` (line 213) — gated `tickets.manage`, and only when the ticket has NOT itself already been merged away (nothing to suggest merging for a ticket that is already someone else's merge target's source):

```tsx
                <Can permission="tickets.manage">
                  {ticket.merged_into === null ? (
                    <TicketDuplicateCandidatesSection ticketId={ticket.id} />
                  ) : null}
                </Can>
```

Add a "merged away" banner directly under the header `<CardHeader>`'s title, before the `<dl>` (after line 105), visible to everyone who can already see the ticket:

```tsx
                    {ticket.merged_into !== null ? (
                      <Alert>
                        <AlertTitle>{t('merge.mergedBanner', { id: ticket.merged_into, subject: ticket.merged_into_subject })}</AlertTitle>
                        <AlertDescription>
                          <Link to={`/tickets/${ticket.merged_into}`} className="hover:underline">
                            {t('merge.viewTarget', { id: ticket.merged_into })}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    ) : null}
```

> Verify `Alert`/`AlertTitle`/`AlertDescription`'s exact export shape against `frontend/src/shared/ui/primitives/alert.tsx` before wiring (already used elsewhere in this app, per the `grep` hit in `## Context` of Story 67 — `frontend/src/app/RouteErrorBoundary.tsx` and `CONVENTIONS.md` line 697); add the import alongside the other primitive imports.

No change to the "Delete" button's `Can permission="tickets.manage"` block (line 196-210) — a merged-away ticket can still be edited/deleted through the existing controls; this story does not add new restrictions to them (see `## Story Goal`).

---

### 7 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — extend the `history` block (after `"by": "by {{actor}}"`, line 160):

```json
    "kinds": {
      "status_changed": "Status changed",
      "assigned": "Assignment changed",
      "merged_into": "Merged",
      "merged_from": "Merged"
    },
```

(Replaces the existing 2-entry `kinds` object at lines 154-157.)

```json
    "mergedInto": "Merged into {{ref}}",
    "mergedFrom": "Merged from {{ref}}",
```

Add a new top-level `merge` block, placed after `history` (after line 161, before `sla`):

```json
  "merge": {
    "sectionTitle": "Possible duplicates",
    "empty": "No likely duplicates found for this customer.",
    "action": "Merge",
    "confirmTitle": "Merge this ticket into #{{id}} — {{subject}}?",
    "confirmDescription": "This moves {{messageCount}} message(s) and {{noteCount}} internal note(s) onto ticket #{{id}}, and closes this ticket. This cannot be undone from here — the merge stays visible in both tickets' history.",
    "merged": "Ticket merged.",
    "mergedBanner": "This ticket was merged into #{{id}} — {{subject}}.",
    "viewTarget": "View ticket #{{id}}"
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
    "kinds": {
      "status_changed": "تغيير الحالة",
      "assigned": "تغيير التعيين",
      "merged_into": "دمج",
      "merged_from": "دمج"
    },
    "mergedInto": "تم الدمج في {{ref}}",
    "mergedFrom": "تم الدمج من {{ref}}",
```

```json
  "merge": {
    "sectionTitle": "تذاكر مكررة محتملة",
    "empty": "لم يتم العثور على تذاكر مكررة محتملة لهذا العميل.",
    "action": "دمج",
    "confirmTitle": "دمج هذه التذكرة في #{{id}} — {{subject}}؟",
    "confirmDescription": "سينقل هذا {{messageCount}} رسالة و{{noteCount}} ملاحظة داخلية إلى التذكرة #{{id}}، ويغلق هذه التذكرة. لا يمكن التراجع عن هذا من هنا — يبقى الدمج ظاهرًا في سجل كلا التذكرتين.",
    "merged": "تم دمج التذكرة.",
    "mergedBanner": "تم دمج هذه التذكرة في #{{id}} — {{subject}}.",
    "viewTarget": "عرض التذكرة #{{id}}"
  },
```

Both remain the new last key set before `categories`/`slaStatuses`/`savedViews` (or wherever `history`/`sla` currently sit relative to them — insert immediately after `history` in both files, matching where it was added in `en.json`).

---

## Documentation Tasks

### 8 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 108's paragraph):

> **A model that reuses another app's search technology is not the same as calling that app's function.** TKT-9 (Story 109) needed KB-3's "text-similarity retrieval" for duplicate ticket detection, but `apps.knowledge_base.search::search_knowledge_base` is model-locked to `FAQ`/`Article` — it cannot be called for `Ticket`. The reusable unit was the *mechanism* (Postgres `SearchVector`/`SearchQuery`/`SearchRank`), not the function: `apps/tickets/duplicates.py::find_duplicate_candidates` is a new, small function following the identical annotate/order-by/slice shape, not a fork of a copy-pasted one and not a literal cross-app call. When an intake says "reuse X's retrieval/search/pattern," check whether X's actual code is a general-purpose function (call it) or a domain-specific one built for a different model (reuse its *technique* in a new, model-appropriate function, and say so explicitly in the plan). **A self-referential pointer field left by an irreversible-in-the-UI-but-auditable action is `SET_NULL`, not `PROTECT` or `CASCADE`.** `Ticket.merged_into` (TKT-9) never blocks deleting the target it points to and never cascades a delete backward onto the source — the same reasoning every other "this reference should not force or block a delete" field in this app already uses (`Ticket.category`, `Ticket.assigned_agent`), applied for the first time to a self-referential FK.

---

## Edge Cases & Failure Modes

- **Merging a ticket into itself** (`target_id` equals the source's own id) — rejected with a `400` (`target_id: "A ticket cannot be merged into itself."`) at the top of `apply_merge`, before any query touches `Message`/`InternalNote`. Enforced in `backend/apps/tickets/merge.py::apply_merge`.
- **Merging a source that has already been merged** (`source.merged_into_id` is already set — an agent double-clicks "Merge," or revisits a stale page) — rejected with a `400` (`target_id: "This ticket has already been merged."`), checked AFTER re-fetching the source under `select_for_update()` inside the transaction, not from the (possibly stale) object the view already loaded via `self.get_object()`.
- **Merging into a target that was itself merged away** (chains: A → B, then someone tries C → A) — rejected with a `400` naming the target explicitly, preventing a merge chain from ever forming. A caller who wants C consolidated onto B must merge C → B directly (B is still a valid, live target).
- **Merging tickets with different customers** — rejected with a `400`. See `## Story Goal` for the two independent, verified reasons this is a firm scope boundary, not a placeholder to loosen later without redesigning the attachment story.
- **A message/note move failing partway through** (e.g. a `Message` row locked by an unrelated long-running transaction, or a database error mid-`.update()`) — the entire body of `apply_merge` runs inside one `transaction.atomic()` block; any exception rolls back every write in it (the `Message`/`InternalNote` updates, the `merged_into` save, the status change, both `TicketActivity` rows) as a unit. There is no code path that commits some of the four steps and not others.
- **A source ticket with many messages/notes** — `Message.objects.filter(ticket=source).update(ticket=target)` and the equivalent for `InternalNote` are each a single bulk `UPDATE ... WHERE ticket_id = ...` statement, not a per-row Python loop — cost is one query per model regardless of row count, the same reasoning `bulk_assign`'s use of `fetch_tickets`'s single `filter(pk__in=...)` query already established for "one query covering N rows," just applied to an `UPDATE` instead of a `SELECT`.
- **Concurrent merge requests targeting the SAME source ticket** (two agents both click "Merge" on the same duplicate into two different targets within the same second) — closed by `select_for_update()`: the second request's transaction blocks on the source row until the first commits, then re-reads `merged_into_id` (now non-null) and cleanly rejects with the "already merged" error, rather than silently overwriting the first merge's `merged_into` pointer while the messages/notes have already physically moved to the FIRST target. See `apps/tickets/merge.py::apply_merge`'s comment.
- **Permission denial when the caller can see one ticket but not the other via scoping** — verified NOT currently reachable in this app: `ScopedQuerysetMixin` scopes only the `list` action (`apps/core/scoping.py:102`), and neither `merge` nor `duplicate_candidates` is `list`; `HasPermission.has_object_permission` only ever tightens for a portal customer (`apps/core/permissions.py:107-138`), and `TicketViewSet` never declares `customer_field`. Both `source` and `target` are still fetched through the identical `self.get_queryset()` (`## Product rules`), so if a future story DOES extend scoping to detail actions, this code needs no change to inherit that protection symmetrically on both sides.
- **What happens to the source's OWN pre-merge `TicketActivity` history** — it is neither moved nor copied. It remains attached to the (now closed) source ticket exactly as it happened; only the new `MERGED_INTO` row is appended to it. Opening the source ticket after a merge still shows its full original history plus the merge event at the top; the target's history shows only its own original history plus the new `MERGED_FROM` event — the two histories are never interleaved.
- **A true duplicate that falls outside the 90-day "near in time" window** (or, less likely, far enough from the top-`DEFAULT_LIMIT`-slice that it never returns even with rank-based ordering, if a customer has an unusually large number of other tickets) — cannot be merged through this UI: there is no free-text/search picker as an escape hatch (a firm scope call, see `## Story Goal`). A follow-up story would need to either widen the window, raise the limit, or add a real picker — left as a genuinely open question, not resolved here.
- **`merged_into_subject` reads the TARGET's subject at RENDER time, not a snapshot** (unlike `TicketActivity.to_value`, which IS a point-in-time snapshot) — if the target's subject is edited after the merge, the banner on the source updates to the new subject on next fetch; this is a live FK read (`source="merged_into.subject"`), not a frozen copy, and is intentional: the banner's job is "where do I go now," which should always reflect the target's CURRENT identity, unlike the audit trail's own snapshot fields, which must not drift.
- **Arabic ticket subjects in a `to_value` snapshot** (`f"#{target.id} — {target.subject}"`) round-trip correctly — `to_value` is free-form prose (a subject line, possibly Arabic) rendered without a forced `dir`, the same reasoning every other free-text render in this feature already uses (`TicketHistorySection`'s message bodies, `InternalNotesSection`'s note bodies).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16, reaffirmed by every prior `ticket-management` story's own Test Plan — Stories 12/24/106/108 each state this explicitly). No test file is added or modified.

1. `python manage.py check` — verifies the new `apps.tickets.merge` → `apps.agents.models.InternalNote` reverse-direction import (`## Context`, item 6) does not create a real circular-import failure.
2. `python manage.py test` — the existing suite must still pass unchanged (no new tests are added, per the project's own convention; this only confirms nothing else broke).
3. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** once Task 1's migration is generated and applied.
4. `ruff format --check .` / `ruff check .` over the new Python (`apps/tickets/merge.py`, `apps/tickets/duplicates.py`, and the edited `models.py`/`views.py`/`serializers.py`).
5. Real HTTP, covering every branch named in `## Edge Cases & Failure Modes` — see `## Verification Steps` for the concrete request sequence.
6. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the three new components/files.
7. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test — the same tool every prior story in this feature already used).

---

## Migration / Rollback

**One migration** (Backend Task 1): `AddField` for `Ticket.merged_into` (self-FK, `SET_NULL`, nullable) plus an `AlterField` for `TicketActivity.kind` (updated `choices=` metadata only — no real schema change, since Django `CharField.choices` is not DB-enforced). Depends on `("tickets", "0012_savedview")`.

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0012` to unapply, if reverting only this story's migration.

**Half-applied states to avoid:**

- **`Ticket.merged_into` added without `null=True, blank=True`.** A self-referential FK with no default cannot be added to a table with existing rows without one — `makemigrations` would either prompt for a one-off default (breaking a non-interactive run) or, if forced, corrupt every existing ticket's `merged_into` to a bogus value. The same trap every prior nullable-FK story in this feature has already documented (`Ticket.category`/`assigned_agent`/`department`/`branch`, `SavedView.owner` is the one exception because it is NOT nullable and the table starts empty).
- **`permission_map` missing `"merge"` or `"duplicate_candidates"`.** Does **not** deny — falls through to authenticated-only, so any signed-in user (including a `customers.view`-only one) could trigger an actual data-moving merge with no `tickets.manage` check at all. `## Verification Steps` checks this explicitly for BOTH new actions, not just one.
- **The customer/self/already-merged checks placed in the VIEW instead of inside `apply_merge`.** There is only one caller of `apply_merge` today, so this would work — until a second caller is ever added (there is none planned, but `apply_assignment`/`apply_status_change`'s own history shows single-caller helpers do eventually gain a second one, e.g. `apply_status_change` being written for `set_status` and reused by `bulk_status` a few stories later). Keeping validation inside the helper is the same defensive choice this codebase has already made twice.
- **`select_for_update()` omitted from `apply_merge`.** Without it, the "already merged" check still exists but is NOT race-safe — see `## Edge Cases & Failure Modes`'s concurrent-merge case. This is a genuine, not merely theoretical, correctness bug to avoid, not stylistic ceremony.
- **The `Message`/`InternalNote` moves placed AFTER the `apply_status_change`/`merged_into` save** instead of before. Functionally equivalent inside one atomic transaction (everything commits or rolls back together either way), but the ordering in Backend Task 2 (move content first, THEN close and log) matches this project's general "commit the primary/data change first, the state-transition and audit second" convention (the same ordering `MessageViewSet.perform_create`'s save-then-send and `TicketViewSet.assign`'s save-then-log already use).

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces one file with an `AddField` + `AlterField`; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports the same passing count as before this story (no new tests added).
4. **A same-customer merge moves content, closes the source, and logs both sides.** Create a customer with two open tickets, A (source) and B (target); add 2 messages and 1 internal note to A. `POST /tickets/<A>/merge/` `{"target_id": <B>}` → `200`, response is A's own updated resource (`merged_into: <B>`, `status: "closed"`). `GET /tickets/<B>/` → unaffected fields unchanged. `GET /messages/?ticket=<B>` → contains the 2 messages that were on A; `GET /messages/?ticket=<A>` → empty. `GET /internal-notes/?ticket=<B>` → contains the 1 note; `GET /internal-notes/?ticket=<A>` → empty. `GET /tickets/<A>/history/` → a new `kind: "activity"`, `activity_kind: "merged_into"` entry with `to_value` containing `#<B>` and B's subject, PLUS a `status_changed` entry (open → closed) from the same call. `GET /tickets/<B>/history/` → a new `activity_kind: "merged_from"` entry with `to_value` containing `#<A>` and A's subject.
5. **Merging an already-closed source skips the redundant status change but still logs the merge.** Repeat step 4 with a THIRD ticket, C, already `closed` before merging. `POST /tickets/<C>/merge/` `{"target_id": <B>}` → `200`; `GET /tickets/<C>/history/` → exactly one new entry (`merged_into`), no `status_changed` entry from this call (it was already closed).
6. **Rejections, one request each, confirming the exact `target_id` field error:** merge A into itself (`target_id: <A>`) → `400`; merge A into a different customer's ticket → `400`; re-merge A (already merged from step 4) into any target → `400`; merge some ticket into A itself (A is now a merged-away source) → `400` ("cannot merge into a ticket that was itself merged").
7. **Duplicate candidates: same customer, near in time, ranked.** With the customer/tickets from step 4 (plus one more ticket, D, for a DIFFERENT customer with a similar subject), `GET /tickets/<A>/duplicate-candidates/` → contains B (and C, D excluded — D is a different customer). Create a ticket E for the SAME customer with a subject that closely matches A's, dated within 90 days → E ranks above a same-customer ticket with an unrelated subject.
8. **Duplicate candidates never filters out low-rank rows.** Create ticket F for the same customer with a subject sharing NO words with A's, also within 90 days → F still appears in `GET /tickets/<A>/duplicate-candidates/` (rank near/at 0, but present, ordered last among rank-tied rows by recency).
9. **Permission gating, both new actions.** With a `tickets.view`-only token (reuse the throwaway-role technique from prior stories in this feature): `GET .../duplicate-candidates/` → `200`; `POST .../merge/` → `403`. With no token → `401` on both.
10. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as a `tickets.manage` user, using the customer/tickets set up above:
    - `/tickets/<A_id>` (before merging) — a "Possible duplicates" card appears above the SLA section, listing B/E/F with status/priority badges and a "Merge" button on each.
    - Click "Merge" on B's row → the shared confirm dialog opens, its description naming the exact message/note counts about to move and stating the action cannot be undone.
    - Confirm → toast "Ticket merged.", navigation lands on `/tickets/<A_id>` still (or verify the actual post-merge behavior implemented — the plan calls for staying with an updated banner, not a forced navigate to the target; confirm this matches Frontend Task 6 as implemented) showing the "merged into #B" banner with a working link to B.
    - Open `/tickets/<B_id>` — its History card shows the new "Merged" entry; its Conversation/Internal Notes sections show A's moved content.
    - Switch to Arabic — the confirm dialog, the banner, the section title, and the history sentence all translate, including interpolated `{{id}}`/`{{subject}}`/`{{messageCount}}`/`{{noteCount}}` values, and everything reads correctly in RTL.
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Clean up** every ticket, customer, message, and internal note created for steps 4-10, plus any throwaway role/user reused from a prior story's verification.

---

## Done Criteria

- [ ] `Ticket.merged_into` — self-`ForeignKey`, `SET_NULL`, nullable; `TicketActivity.Kind` gains `MERGED_INTO`/`MERGED_FROM`.
- [ ] One migration (`AddField` + `AlterField`), depending on `0012_savedview`. `python manage.py makemigrations --check --dry-run` reports no changes after.
- [ ] `apps/tickets/merge.py::apply_merge` — validates (self-merge, cross-customer, already-merged on either side), moves `Message`/`InternalNote` via bulk `.update()`, closes the source through `apply_status_change` (skipped if already closed), sets `merged_into`, writes one `TicketActivity` row on EACH ticket — all inside one `transaction.atomic()` block with `select_for_update()` on the re-fetched source.
- [ ] `apps/tickets/duplicates.py::find_duplicate_candidates` — same customer, ±90 days, `SearchVector`/`SearchQuery`/`SearchRank` ranked (KB-3's mechanism, not `search_knowledge_base` itself), never filters out `rank == 0` rows.
- [ ] `TicketViewSet.merge` (`POST`, detail, `url_path="merge"`) and `TicketViewSet.duplicate_candidates` (`GET`, detail, `url_path="duplicate-candidates"`); `permission_map` gains both, `TICKETS_MANAGE`/`TICKETS_VIEW` respectively; target is fetched via `self.get_queryset()`, not a raw ORM call.
- [ ] `TicketSerializer` gains read-only `merged_into`/`merged_into_subject`.
- [ ] **No `apps/tickets/urls.py` change, no new permission constant, no ticket-scoped attachment handling (documented no-op), no auto-merge, no bulk/multi-ticket merge, no undo action.**
- [ ] `types/duplicateCandidate.ts`, `api/getDuplicateCandidates.ts`/`useDuplicateCandidates.ts`, `api/mergeTicket.ts`; `useTicketMutations.ts` gains `useMergeTicket(sourceId)` with prefix-wide `ticketKeys.all` invalidation.
- [ ] `types/ticket.ts` gains `merged_into`/`merged_into_subject`; `types/ticketHistoryEntry.ts`'s `TicketActivityKind` gains `'merged_into' | 'merged_from'`.
- [ ] `TicketHistorySection.tsx`'s `ActivityRow` renders the two new kinds as a single-`ref` sentence, distinct from the existing two-value `from`/`to` templates.
- [ ] `TicketDuplicateCandidatesSection.tsx` — new Card, read-only list, one "Merge" button per row wired to the SHARED `useConfirm()` (no new Dialog component), its description built from live message/internal-note counts.
- [ ] `TicketDetailPage.tsx` renders the new section (gated `tickets.manage`, hidden once the ticket is itself merged away) and a "merged into" banner (visible to anyone who can see the ticket).
- [ ] `en.json`/`ar.json` — the extended `history.kinds`/`history.mergedInto`/`history.mergedFrom` keys and the new `merge` block; identical key sets in both languages.
- [ ] `CONVENTIONS.md` §23 gains the "reusing a technique vs. calling a function" / "self-referential SET_NULL" paragraph.
- [ ] `python manage.py test` reports the same passing count as before this story; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0; `python manage.py check` passes (confirms the new cross-app import is safe).
- [ ] Verified by real HTTP: a same-customer merge moves content/closes/logs both sides (Step 4); an already-closed source skips the redundant status change (Step 5); every rejection case returns the specific `target_id` error (Step 6); duplicate candidates are same-customer/near-in-time/ranked and never hide low-rank rows (Steps 7-8); `403`/`401` permission gating on both new actions (Step 9).
- [ ] Both languages walk through cleanly in the browser, including the confirm dialog's interpolated counts and the merged-ticket banner (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 12).
- [ ] `.squad/plans/ticket-management/00-overview.md` updated with this story's row.
