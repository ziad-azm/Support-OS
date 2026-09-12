# Story 113 — (DSN-16) Motion Completion & Micro-Interaction Craft (Story: SUPPORTOS-138)

## Prerequisites

- **`MOTION-0` (Story 97, `SUPPORTOS-128`) is implemented — verified against current code, not against `.squad/plans/public-landing-page/00-overview.md`, which still says "Planned, not yet implemented" (stale; not corrected by this plan, out of scope for a `design-intelligence-ui-ux-system` story to edit another feature's overview).** `frontend/src/index.css` carries the full `--motion-fast|base|slow|reveal` / `--ease-entrance|exit|state` token set and the documented reduced-motion policy exactly as Story 97's own plan specifies; `frontend/src/shared/ui/Reveal.tsx` exists (the `shared/landing/` copy is gone); `ToastProvider.tsx`, `dropdown-menu.tsx`, `select.tsx` and `table.tsx` all carry token-driven durations; `frontend/src/app/RootLayout.tsx` already has the route-change fade. `CONVENTIONS.md` § 25 already has a `### Motion vocabulary (\`MOTION-0\`, Story 97)` subsection (line 2034).
- **This story's own intake premise is partly stale as a result, and this plan corrects it against real code rather than re-doing settled work:**
  - The intake's "Route and page transition" task is **already fully delivered** by `RootLayout.tsx`'s existing fade — verified, not assumed. No new work; `## Story Goal` explains why this task closes with zero code changes.
  - The intake's "the confirm dialog (currently zero)" is a **verified false positive**: `ConfirmProvider.tsx` renders `AlertDialogContent` (`alert-dialog.tsx:57`), which already carries `duration-200` (= `--motion-base`) and the full `animate-in`/`animate-out` set — the "0" was a count of literal motion references inside `ConfirmProvider.tsx`'s own file, not of the primitive it composes. The confirm dialog already animates.
  - `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `button.tsx`, `input.tsx`, `table.tsx` (row hover) are **already correct** per Story 97's own "What is already done" list — this story re-touches none of them.
- **`DSN-8` (Story 63) is implemented** — its state/feedback polish (submit-pending states, toast-on-error) is consumed, not re-touched, by this story's data-state work.
- **A pre-existing global-sequence collision, unrelated to this story: two different plan files are both numbered `112`** (`design-intelligence-ui-ux-system/112-story-form-presentation-dialog-vs-full-page-SUPPORTOS-137.md` and `sla-automation/112-story-waiting-on-customer-status-sla-clock-pause-SUPPORTOS-134.md`), from two planning sessions run in parallel. This plan takes the next actually-free number, **113**, and does not attempt to renumber either existing `112` file — that decision belongs to whoever reconciles the two sessions, not to this story.

---

## Story Goal

Finish `MOTION-0`'s deferred micro-interaction pass, verified against **current** code rather than the intake's snapshot of it. Four outcomes:

1. **Primitive-level motion pass — the real remaining gap is four primitives, not the intake's longer list.** `checkbox.tsx`, `switch.tsx`, `radio-group.tsx` and `tabs.tsx` are the ones that "still have none or nearly none" (Tailwind's own un-stated ~150ms default, not a named token) — `checkbox.tsx`'s `transition-shadow` does not even cover the property that visually changes on check (`background-color`/`border-color`). Everything else Task 1 names (dialog/alert-dialog, dropdown, select, button, the confirm dialog) is already done, per `## Prerequisites`.
2. **Route and page transition — already done.** Verified, not re-implemented. Zero code change.
3. **Data-state motion — a container-level cross-fade on `DataTable`, not per-row animation.** `DataTable.tsx`'s skeleton→content, empty→populated, and filtered/refetched-content transitions are all instances of the same thing: the table's visible content changed for a reason other than user interaction. One `<TableBody>`-level fade (mirroring `RootLayout.tsx`'s own re-trigger pattern) covers all three, satisfying the intake's own "must not animate 25 elements independently if a container-level transition reads the same" escape hatch. Two sub-asks are named out of scope with a concrete reason, not silently dropped — see `## Story Goal`'s own scope table below.
4. **Motion quality pass — a verification walk, reusing `DSN-13`'s route set**, recording this story's own scope decisions in `CONVENTIONS.md` beside the token vocabulary.

**Scope table for Task 3's four named sub-asks:**

| Sub-ask | Disposition |
|---|---|
| Skeleton→content handoff (cross-fade) | **Built** — `DataTable.tsx`'s container-level fade, Task 3 |
| Row enter/exit when a list filters or a bulk action changes results | **Built, at container level, not per-row** — the same fade; a true per-row FLIP/exit animation is not attempted (see `## Edge Cases`) |
| Optimistic-update settle | **Out of scope — no target exists.** `grep -rln "onMutate" frontend/src` returns nothing: this codebase has zero optimistic updates anywhere (every `useMutation` waits for the server response before the cache updates, confirmed by `MutationCache.onError`'s own global-toast design in `shared/lib/api/queryClient.ts`). Nothing to animate. |
| Empty→populated | **Built** — the same `DataTable.tsx` fade covers this transition too (its content-signature includes the empty state) |

**Also out of scope, named with a reason (not silently dropped):**

- **`QueryBoundary.tsx`'s own loading→content cross-fade.** 43 files call `<QueryBoundary>` (`grep -rln "<QueryBoundary" frontend/src | wc -l`). Its `children(data)` render prop is caller-controlled JSX; the only non-invasive way to fade it is wrapping it in a new `<div>`, which changes `QueryBoundary`'s DOM output shape — a real risk to an unaudited number of grid/flex layouts that may depend on `children(data)`'s elements being direct children of whatever wraps the `<QueryBoundary>` call site (`CONVENTIONS.md` § 7 calls `QueryBoundary`'s contract "stable" — "Story 06 restyled all four without changing one"). Auditing 43 call sites is a scope of its own; not attempted here.
- **`sheet`/`popover`/`tooltip` motion.** Still do not exist as primitives — `ls frontend/src/shared/ui/primitives/` lists 17 files, none of them. Same call `MOTION-0` already made; this story does not create components in order to animate them.
- **The View Transitions API for route transitions.** Moot — the route transition already shipped with the "class re-trigger, no remount" mechanism `MOTION-0`'s own plan rejected the View Transitions API in favor of (per-`<Link>` wiring would violate the shared-component-only constraint).

---

## Context — Read These Files First

1. `frontend/src/index.css` lines 20-45 (`:root`'s `--motion-*` tokens) and lines 205-225 (`@theme inline`'s `--ease-*` tokens) — confirm the tokens exist; this story consumes them, adds none.
2. `frontend/src/shared/ui/primitives/checkbox.tsx` (27 lines, full file) — line 12's `transition-shadow` covers only the focus-ring box-shadow, not the `data-[state=checked]:border-primary data-[state=checked]:bg-primary` background/border change on the same line. Task 1's edit site.
3. `frontend/src/shared/ui/primitives/switch.tsx` (39 lines, full file) — line 24 (root: `transition-all`, no duration) and line 32 (thumb: `transition-transform`, no duration, plus the existing `rtl:` counterpart on the checked-state translate — do not touch that part). Task 1's edit site.
4. `frontend/src/shared/ui/primitives/radio-group.tsx` (43 lines, full file) — line 28 (`RadioGroupItem`: `transition-[color,box-shadow]`, no duration). The `Indicator` (line 33-38) has no transition at all and stays that way — matches `checkbox.tsx`'s own indicator (`transition-none`, deliberate, not touched by this story either). Task 1's edit site.
5. `frontend/src/shared/ui/primitives/tabs.tsx` (83 lines, full file) — line 62 (`TabsTrigger`: `transition-all`, no duration) and line 65 (the `line`-variant underline: `after:transition-opacity`, no duration). Task 1's edit site.
6. `frontend/src/shared/ui/data-table/DataTable.tsx` (235 lines, full file) — the three conditional blocks inside the single `<TableBody>` (lines 154-170 pending/skeleton, 172-189 error, 191-197 empty, 199-227 success-with-items) all render into the **same persistent `<TableBody>` element** (line 154, closes 228) — nothing unmounts/remounts `<TableBody>` itself between these states, which is what makes a container-level fade on it (not per-row) both correct and cheap. Task 3's edit site.
7. `frontend/src/app/RootLayout.tsx` (full file, ~45 lines) — the exact pattern Task 3 reuses: derived `renderedPathname`/`animating` state compared during render (not inside an effect, avoiding an extra commit), flipped `true` on the next frame via `requestAnimationFrame` inside a `useEffect` keyed on the value that changed. Read the code comment explaining why a `key`-based remount was rejected — the same reasoning applies to `DataTable.tsx`: rows must not remount, only fade.
8. `frontend/src/shared/ui/QueryBoundary.tsx` (48 lines, full file) — read to confirm the `children(data)` render-prop shape that makes wrapping it risky (see `## Story Goal`'s scope-out). Not edited.
9. `frontend/src/shared/ui/toast/ToastProvider.tsx` line 78, `frontend/src/shared/ui/primitives/dropdown-menu.tsx` lines 39/207, `frontend/src/shared/ui/primitives/select.tsx` line 62, `frontend/src/shared/ui/primitives/table.tsx` line 49, `frontend/src/app/RootLayout.tsx` (whole file) — confirm each already carries a `duration-(--motion-*)` token; **do not edit any of these five**, `## Verification Steps` checks their diff is empty.
10. `frontend/src/shared/ui/primitives/dialog.tsx` lines 37, 65 and `alert-dialog.tsx` lines 32, 57 — confirm `duration-200` (bare number, equal to `--motion-base`) and the full `animate-in`/`animate-out` set are present; **do not edit either file**.
11. `CONVENTIONS.md` lines 2034-2077 (the `### Motion vocabulary (\`MOTION-0\`, Story 97)` subsection) and lines 2078-2123 (`### Form presentation: dialog vs. full page (\`DSN-15\`, Story 112)`, this feature's immediately-preceding subsection) — Task 4's insertion point is directly after line 2123, before `## 26.` (line 2124), matching the doc's own chronological-append convention (subsections are ordered by story sequence, not grouped by topic).
12. `.squad/plans/design-intelligence-ui-ux-system/97-story-shared-motion-foundation-SUPPORTOS-128.md` (MOTION-0's own plan, referenced throughout this one) and `.squad/plans/design-intelligence-ui-ux-system/68-story-final-ux-verification-sign-off-SUPPORTOS-104.md` (`DSN-13`'s verification route set, reused by Task 4).
13. `frontend/src/features/tickets/components/TicketBulkActionBar.tsx` (full file, 177 lines) — confirms `TKT-7`'s bulk actions (assign/status/priority) are **mutations that change a ticket's fields, not row deletions**; a bulk-actioned ticket that no longer matches the current list filter disappears only once the list's own query refetches — the same "content changed" case `DataTable.tsx`'s fade already covers, not a distinct mechanism.

---

## Frontend Tasks

### 1 — Primitive-level motion: checkbox, switch, radio, tabs

**File: `frontend/src/shared/ui/primitives/checkbox.tsx`** line 12 — the property list does not cover the property that changes on check:

```diff
        'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs
-       transition-shadow outline-none focus-visible:border-ring
+       transition-[background-color,border-color,box-shadow] duration-(--motion-fast) ease-state outline-none focus-visible:border-ring
        focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary',
```

`ease-state`, not `ease-entrance`: a checkbox toggling is a property changing in place, not something arriving — the same semantic split `index.css`'s token comments already document. **The `CheckboxPrimitive.Indicator`'s `transition-none` (line 19) is untouched** — the checkmark icon itself stays instant, matching this story's own choice for the radio dot (see below).

**File: `frontend/src/shared/ui/primitives/switch.tsx`** — two edits, both appending a token, no property-list change (both already cover the properties that change):

```diff
  // line 24, root
-       ...border border-transparent shadow-xs transition-all outline-none...
+       ...border border-transparent shadow-xs transition-all duration-(--motion-fast) ease-state outline-none...
```

```diff
  // line 32, thumb
-       'pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4...'
+       'pointer-events-none block rounded-full bg-background ring-0 transition-transform duration-(--motion-fast) ease-state group-data-[size=default]/switch:size-4...'
```

The existing `rtl:data-[state=checked]:-translate-x-[calc(100%-2px)]` counterpart (same line) is untouched — this story adds timing, not direction logic.

**File: `frontend/src/shared/ui/primitives/radio-group.tsx`** line 28 — append the token to the existing property list, no property added (the checked-state visual is carried entirely by the `Indicator`'s mount, per `## Context`, so only the focus-ring transition needs timing):

```diff
        'aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs
-       transition-[color,box-shadow] outline-none focus-visible:border-ring...'
+       transition-[color,box-shadow] duration-(--motion-fast) ease-state outline-none focus-visible:border-ring...'
```

**The `RadioGroupIndicator` (lines 33-38) is left without a transition**, matching `checkbox.tsx`'s own deliberate `transition-none` on its indicator — an instant checkmark/dot is this codebase's established choice for a selection indicator's own appearance, not an oversight to fix here.

**File: `frontend/src/shared/ui/primitives/tabs.tsx`** — two edits:

```diff
  // line 62, TabsTrigger
-       "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full..."
+       "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all duration-(--motion-fast) ease-state group-data-[orientation=vertical]/tabs:w-full..."
```

```diff
  // line 65, the `line`-variant underline
-       'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0...'
+       'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity after:duration-(--motion-fast) after:ease-state group-data-[orientation=horizontal]/tabs:after:inset-x-0...'
```

Tailwind's variant/pseudo-element prefixes compose with the CSS-variable duration shorthand the same way they compose with any other utility — `after:duration-(--motion-fast)` targets the `::after` pseudo-element's own `transition-duration`, matching the pattern already used for `after:bg-foreground`/`after:opacity-0` on the same element.

**Deliberately NOT edited in this task** (Verification step confirms each diff is empty): `button.tsx`, `input.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `skeleton.tsx`, `Sidebar.tsx`, `ToastProvider.tsx`, `table.tsx` — all already correct per `## Prerequisites`.

---

### 2 — Route and page transition

**No code change.** `RootLayout.tsx` already fades `<main>` on every `pathname` change without remounting the routed subtree, exactly matching this story's own intake wording ("navigation reads as movement rather than replacement... must never delay perceived interactivity"). Verified, not re-implemented. `## Verification Steps` step 5 confirms it live.

---

### 3 — Data-state motion: a container-level `DataTable` cross-fade

**File: `frontend/src/shared/ui/data-table/DataTable.tsx`**

Add a content-signature tracker mirroring `RootLayout.tsx`'s own `renderedPathname`/`animating` pattern — derived during render (not inside an effect, avoiding an extra commit), flipped back on via a `requestAnimationFrame`-scheduled effect:

```diff
- import type { ReactNode } from 'react'
+ import { useEffect, useState } from 'react'
+ import type { ReactNode } from 'react'
  import type { UseQueryResult } from '@tanstack/react-query'
  import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
  import { useTranslation } from 'react-i18next'
```

Inside `DataTable`, after the existing `colSpan` computation (before the `toggleAllOnPage` function):

```tsx
  // A single signature standing in for "what the table currently shows" —
  // pending, error, empty, or the sorted set of row ids on this page.
  // Re-triggers one container-level fade (DSN-16, Story 113) whenever it
  // changes, covering skeleton→content, empty→populated, and a
  // filter/bulk-action-driven refetch alike — the same "content changed
  // for a reason other than the user reading/clicking" case in each. NOT
  // per-row: animating 25 individual <TableRow>s independently is exactly
  // what the intake's own "cheap at list scale" constraint forbids: see
  // `## Edge Cases & Failure Modes` for why a true per-row exit is not
  // attempted at all.
  const contentSignature = query.isPending
    ? 'pending'
    : query.isError
      ? 'error'
      : query.isSuccess
        ? query.data.items.length === 0
          ? 'empty'
          : query.data.items.map(rowKey).join(',')
        : 'idle'

  const [renderedSignature, setRenderedSignature] = useState(contentSignature)
  const [animating, setAnimating] = useState(false)
  if (renderedSignature !== contentSignature) {
    setRenderedSignature(contentSignature)
    setAnimating(false)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimating(true))
    return () => cancelAnimationFrame(frame)
  }, [contentSignature])
```

Apply it to the existing `<TableBody>` (the element whose children are the three conditional blocks — it never itself unmounts between them):

```diff
- <TableBody>
+ <TableBody
+   className={cn(animating && 'animate-in fade-in duration-(--motion-base) ease-entrance')}
+ >
```

`cn` is already imported (line 8, used elsewhere in this file for `column.align`/`column.priority`). `ease-entrance`, not `ease-state`: new content arriving is an entrance, the same semantic `dropdown-menu.tsx`/`select.tsx` already use for their own popover content. `--motion-base` (200ms), not `--motion-fast`: this is page-level content settling, not a hover/press response — the same duration tier the route-change fade itself uses.

**No prop added, no consumer touched.** Every one of `DataTable`'s ~20 call sites inherits this from one file, per the intake's own "shared-component level only" constraint.

---

## Documentation Task

### 4 — Motion quality pass and record the vocabulary's completion

**Verification walk, not new code.** Reuse `DSN-13`'s verification route set (`.squad/plans/design-intelligence-ui-ux-system/68-story-final-ux-verification-sign-off-SUPPORTOS-104.md`) — walk every route in `frontend/src/app/router.tsx` and confirm: no animation exceeds its token's duration, no two overlapping animations fight for the same element, nothing moves under `prefers-reduced-motion: reduce` except the exempt `animate-spin`/`animate-pulse`, no cumulative layout shift, and `en`/LTR + `ar`/RTL both read correctly. Record any deliberate exception found during the walk in `CONVENTIONS.md` beside the token vocabulary — this task does not pre-suppose any exception exists; if the walk finds none, say so.

**File: `CONVENTIONS.md`** — add a new subsection immediately after line 2123 (the end of `### Form presentation: dialog vs. full page (\`DSN-15\`, Story 112)`), before `## 26.` (line 2124):

```markdown
### Motion completion & micro-interaction craft (`DSN-16`, Story 113)

`MOTION-0` (Story 97) shipped the token vocabulary, the reduced-motion
policy, `Reveal`'s promotion, and — verified against current code rather
than assumed from this story's own intake, which pre-dated a re-check —
the toast entrance, dropdown/select duration, table-row hover duration, and
the route-change fade on `<main>`, all already complete. This story closes
the two genuine gaps that remained:

- **`checkbox.tsx`/`switch.tsx`/`radio-group.tsx`/`tabs.tsx`** now carry an
  explicit `duration-(--motion-fast) ease-state` (or the matching
  property-list fix on `checkbox.tsx`, which transitioned only its focus
  ring, not its checked-state background/border) — a property changing in
  place, hence `ease-state`, not `ease-entrance`. `dialog`/`alert-dialog`/
  `dropdown-menu`/`select`/`button`/`input`/`table` (row hover) needed no
  change — `MOTION-0` already covered them.
- **`DataTable.tsx` gained one container-level cross-fade** on `<TableBody>`
  (`animate-in fade-in duration-(--motion-base) ease-entrance`, re-triggered
  on a content-signature change built from `query`'s pending/error/empty/
  row-id state) — covering skeleton→content, empty→populated, and a
  filter- or bulk-action-driven refetch alike, in one place inherited by
  every `DataTable` consumer. **Not per-row**: animating each `<TableRow>`
  independently at list scale is exactly what a container-level fade is for
  avoiding; a genuine per-row exit animation is not attempted at all — see
  below.

**Deliberately not built, each for a concrete reason:**
- **A true per-row exit animation** (a row visibly leaving when a filter or
  bulk action removes it from view) needs a leaving-state machine — React
  unmounts a removed `<tr>` before any CSS transition on it could run — the
  same category of gap as `ToastProvider`'s own exit, which `MOTION-0`
  named out of scope for the identical reason. Would need an animation
  library this codebase has never added.
- **`QueryBoundary.tsx`'s own loading→content fade.** 43 files call it; its
  `children(data)` render prop is caller JSX, so a non-invasive fade needs
  wrapping it in a new `<div>` — an unaudited risk against `CONVENTIONS.md`
  § 7's "stable contract" call on this exact component.
- **Optimistic-update settle.** No optimistic update exists anywhere in
  this codebase (`grep -rln "onMutate" frontend/src` — no hits) — nothing
  to animate.
- **`sheet`/`popover`/`tooltip` motion, and the View Transitions API for
  routing** — both already named out of scope by `MOTION-0` for the same
  reasons (the primitives do not exist; the API needs per-`<Link>` wiring
  the shared-component-only constraint forbids). Still true.
```

---

## Edge Cases & Failure Modes

- **`DataTable`'s fade re-triggers on every sort/page change, not just filter/bulk-action changes.** This is intended, not a bug: a sort or page change is exactly as much "the content changed for a reason other than reading/clicking" as a filter is — the same signature-based design covers all of them uniformly, with no special-casing needed.
- **The content signature string grows with page size.** Joining every row id on the current page (`query.data.items.map(rowKey).join(',')`) is a plain string built once per render from an already-paginated page (this app's server pagination caps page size well below any performance concern) — not a per-row cost multiplied by anything.
- **A true per-row exit animation was not attempted.** See `CONVENTIONS.md`'s new subsection above — this is a named, reasoned omission, not a silent gap. If a future story wants it, it needs an explicit "add an animation library" decision first, the same category of decision `UX-018`'s combobox and `recharts` each went through individually.
- **`animate-in` on `<TableBody>` under `prefers-reduced-motion: reduce`.** Already covered — `index.css`'s existing reduced-motion rule collapses every `.animate-in` to 0.01ms regardless of which element carries it; no new reduced-motion rule is needed for this story's addition.
- **The `TableBody` fade and a route-change fade overlapping** (navigating to a list page for the first time). Both fade `opacity` on non-overlapping elements (`<main>` vs. `<TableBody>` inside it) using the same `--motion-base` duration — they run concurrently, not in conflict, and neither shifts layout.
- **`transition-[background-color,border-color,box-shadow]` on `checkbox.tsx` vs. the untouched `CheckboxPrimitive.Indicator`'s `transition-none`.** The two are independent elements (the root button vs. the checkmark icon inside it) — the root now smoothly tints while the checkmark itself still pops in instantly, matching the same split this story keeps for `radio-group.tsx`'s indicator.
- **`ease-state` vs. `ease-entrance` on primitives this task touches.** Every edit in Task 1 uses `ease-state` (a value changing in place); `DataTable`'s Task 3 fade uses `ease-entrance` (new content arriving) — the same semantic distinction `index.css`'s own token comments document, applied consistently rather than picked per file.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or removed. Verification is `## Verification Steps` below.

---

## Verification Steps

1. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **No backend change:** `git status --short backend/` is empty.
3. **No new dependency:** `git diff frontend/package.json frontend/package-lock.json` is empty.
4. **The four touched primitives feel state-timed, not instant or laggy:** toggle a `Checkbox`, a `Switch`, a `RadioGroupItem`, and switch a `line`-variant `Tabs` trigger (e.g. `MarkdownField`'s write/preview tabs) — each transitions its color/position/underline in ~150ms, neither instant nor sluggish.
5. **Route fade still holds, unchanged:** navigate between sidebar links — `<main>` still fades in each time; confirm via `git diff --stat` that `RootLayout.tsx` shows **no change**.
6. **`DataTable` fade on all three transitions:** open any list page fresh (skeleton→content fades); type a search term that returns zero rows then clear it (empty→populated fades); on a page with more than one page of results, change the sort or page (content-changed fades). None of these shift layout or delay the ability to click a row mid-fade.
7. **Reduced motion, both halves:** emulate `prefers-reduced-motion: reduce`. (a) The `DataTable` fade, the four Task 1 transitions' motion, and the route fade all collapse to instant — no content stuck at a partial opacity. (b) `Loading`'s spinner and `Skeleton`'s pulse still animate — the DSN-2 carve-out `MOTION-0` already protects is unaffected by this story's additions.
8. **Untouched files stay untouched:** `git diff --stat` shows **no change** to `button.tsx`, `input.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `skeleton.tsx`, `Sidebar.tsx`, `ToastProvider.tsx`, `table.tsx`, `QueryBoundary.tsx`.
9. **RTL:** switch to Arabic. The `Switch` thumb still travels the correct direction (unchanged — this story added no direction logic), tab underline and `DataTable` fade are direction-neutral (opacity/color/position changes only), and `check:rtl` (already covered by step 1) stays clean.
10. **`CONVENTIONS.md` reflects the actual outcome:** `grep -n "Motion completion" CONVENTIONS.md` returns a hit, positioned after the `DSN-15` subsection and before `## 26.`.

---

## Done Criteria

- [ ] `checkbox.tsx` — property list widened to `[background-color,border-color,box-shadow]` plus `duration-(--motion-fast) ease-state`; `CheckboxPrimitive.Indicator`'s `transition-none` untouched.
- [ ] `switch.tsx` — `duration-(--motion-fast) ease-state` added to both the root and the thumb; the existing `rtl:` translate counterpart untouched.
- [ ] `radio-group.tsx` — `duration-(--motion-fast) ease-state` added to `RadioGroupItem`'s existing property list; the `Indicator` untouched.
- [ ] `tabs.tsx` — `duration-(--motion-fast) ease-state` added to `TabsTrigger`; `after:duration-(--motion-fast) after:ease-state` added to the `line`-variant underline.
- [ ] No change to `button.tsx`, `input.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `skeleton.tsx`, `Sidebar.tsx`, `ToastProvider.tsx`, `table.tsx`, `RootLayout.tsx`, `QueryBoundary.tsx`.
- [ ] `DataTable.tsx` — content-signature tracker added; `<TableBody>` carries the conditional `animate-in fade-in duration-(--motion-base) ease-entrance` class; no new prop, no consumer file touched.
- [ ] `CONVENTIONS.md` — new `### Motion completion & micro-interaction craft (\`DSN-16\`, Story 113)` subsection added after the `DSN-15` subsection, recording what was built, what was already done, and what was deliberately left out (with reasons).
- [ ] No backend file changed; `git diff frontend/package.json frontend/package-lock.json` empty.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified live per `## Verification Steps` 4-9, in both `en`/LTR and `ar`/RTL, with `prefers-reduced-motion: reduce` emulated for step 7.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-17` (Measured Colour & Contrast Audit, `SUPPORTOS-139`) remains unplanned. The stale "Planned, not yet implemented" line for `MOTION-0` in `.squad/plans/public-landing-page/00-overview.md` is a pre-existing documentation gap this story's research surfaced but does not fix — flagged for the user to correct in that feature's own overview.
