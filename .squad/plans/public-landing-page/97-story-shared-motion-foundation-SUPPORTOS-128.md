# Story 97 — Shared Motion Foundation (Story: SUPPORTOS-128)

## Prerequisites

- **Story 86 (`LAND-1`) implemented.** It introduced this app's only bespoke motion: `Reveal` (a scroll-triggered reveal) and an inline `animate-in fade-in slide-in-from-bottom-4 duration-700` on the landing hero.
- **Story 94 (`LAND-2`) implemented — and it already did half of this story's Task 2.** The intake says "Move `features/landing/components/Reveal.tsx` into the shared `UI` layer". That file **no longer exists**: Story 94 moved it to `frontend/src/shared/landing/Reveal.tsx` and left no feature-local copy. Verified — `grep -rn "Reveal" frontend/src` returns only `shared/landing/Reveal.tsx`, its barrel export, and `sections/LandingSections.tsx`'s import. What remains is the move from `shared/landing/` (a domain folder) to `shared/ui/` (the generic-primitive folder) plus re-expression on tokens. See `## Task 2 is half-done` below.
- **Story 96 (`LAND-4`) implemented:** [96-story-landing-visual-redesign-SUPPORTOS-126.md](96-story-landing-visual-redesign-SUPPORTOS-126.md). It restyled `LandingSections.tsx` around `Reveal` without changing it, and recorded in that file's docstring that it "adds NO new motion … See that story's `## The MOTION-0 dependency`". **This story is the other half of that promise.**
- **Story 37 (`DSN-2`) implemented.** It wrote the current `prefers-reduced-motion` block (`frontend/src/index.css:196-208`) and made the deliberate carve-out this story must preserve — see `## The reduced-motion conflict`.
- **Story 51 (`DSN-5`) and Story 63 (`DSN-8`) implemented.** Between them, **button press feedback already exists** and must not be re-implemented — see `## What is already done`.
- **No new dependency.** `tw-animate-css@1.4.0` + Tailwind v4.3.3 built-ins cover every animation in this story — verified against the installed packages, not assumed. See `## The dependency check`.

---

## Story Goal

There is no shared motion vocabulary. Verified against the working tree:

- **Durations are ad-hoc.** `duration-200` appears in `button.tsx`, `input.tsx`, `select.tsx` and `Sidebar.tsx:210`; `duration-700` appears once, inside `Reveal.tsx`; `dialog.tsx:65` and `alert-dialog.tsx:57` carry a bare `duration-200`; `dropdown-menu.tsx` and `select.tsx`'s content carry **no** duration at all and silently inherit `tw-animate-css`'s default. Four different sources of truth for "how long should this take".
- **`@theme inline` (`index.css:125-172`) has no motion entry.** It defines `--color-*`, `--radius-*` and `--font-*` and stops. There is no `--ease-*`, no duration token, nothing an author could reach for.
- **The reduced-motion policy is one hard-coded CSS rule** (`index.css:204-208`) that collapses `.animate-in`/`.animate-out`. It works, but nothing declares *why* those two classes and not others, and nothing extends it to the two non-`animate-in` motions this story adds.
- **Three interactions have no motion at all:** the toast (`ToastProvider.tsx:63-88` — zero animation classes), the skeleton (`skeleton.tsx:7` — `animate-pulse` and nothing else), and route changes (`RootLayout.tsx:11` renders a bare `<Outlet />`).

This story delivers:

1. **A motion scale as real tokens**, sourced from `MASTER.md`'s own numbers, added to `@theme inline` so `ease-*` utilities and duration variables are reachable by name instead of by memory.
2. **One documented reduced-motion policy** covering every motion class this app uses — including the two this story adds — with the existing loading-feedback carve-out preserved and, for the first time, explained in the CSS itself.
3. **`Reveal` promoted to `shared/ui/`** and re-expressed on the tokens, with landing-page behaviour byte-for-byte identical.
4. **A micro-interaction pass on the primitives that genuinely lack one** — toast entrance, dialog/dropdown/select duration normalisation, table-row and skeleton timing, and a route-change fade — every one at the shared-component level.

**Explicitly out of scope:**

- **`sheet` and `popover` motion.** The intake's Task 3 names both. **Neither primitive exists** — `frontend/src/shared/ui/primitives/` holds 18 files and neither is among them (verified). This story does not create components in order to animate them.
- **Button press feedback.** Already shipped — see `## What is already done`.
- **Toast *exit* animation.** The intake says "toast entrance", and entrance is what ships. Exit is not a styling change: `ToastProvider.dismiss` (line 30) removes the toast from state synchronously, so an exit animation needs a leaving-state machine and a timer. Named here so the omission is deliberate, not overlooked.
- **The View Transitions API.** See `## The route-transition decision`.
- **Any feature screen.** Shared-component level only, the intake's own constraint. No file under `frontend/src/features/` is touched except the one `Reveal` import path in `LandingSections.tsx`.
- **Any behaviour change.** Nothing here alters what renders, only how it arrives.

---

## The dependency check

The intake's binding constraint: *"check `tw-animate-css` and Tailwind v4's built-ins before adding any animation dependency — the same 'check for an existing animation utility first' constraint LAND-1 was given (CONVENTIONS.md § 0/§ 17)."* Done, against the installed packages:

| Need | Already provided by | Verified how |
|---|---|---|
| Enter/exit keyframe engine (`animate-in`/`animate-out`, `fade-*`, `zoom-*`, `slide-in-from-*`) | `tw-animate-css@1.4.0` | Its own `@theme inline` block defines `--animate-in`, `--animate-out`, plus the `--tw-enter-*`/`--tw-exit-*` custom properties those keyframes read. Imported at `index.css:2`. |
| Per-element duration/delay/fill-mode on an enter animation | `tw-animate-css` | Defines `--tw-animation-duration`, `--tw-animation-delay`, `--tw-animation-fill-mode`, `--tw-animation-iteration-count` — which is why `duration-700 fill-mode-backwards` already works on `Reveal`. |
| Named easing utilities (`ease-<name>`) | Tailwind v4 | `--ease-*` is a first-class theme namespace in v4. Tailwind ships `--ease-in`, `--ease-out`, `--ease-in-out`; adding a key to `@theme` generates the matching utility. |
| Named animation utilities (`animate-<name>`) | Tailwind v4 + `tw-animate-css` | `--animate-*` is a v4 theme namespace; `tw-animate-css` already uses it for `--animate-accordion-down`, `--animate-collapsible-up`, `--animate-caret-blink`. |
| `animate-pulse`, `animate-spin` | Tailwind v4 core | Already in use — `skeleton.tsx:7`, `Loading.tsx:17`. |

**Outcome: no new dependency, and none is needed.** Record that conclusion in both `CONVENTIONS.md` and `MASTER.md` (Task 6) so the next author does not re-litigate it.

**One thing to note and leave alone:** `tw-animate-css` is a **devDependency** (`package.json:48`), not a runtime dependency, even though `index.css:2` imports it. That is correct, not a bug — Tailwind resolves and inlines the CSS at build time, so nothing imports it at runtime. Do not "fix" this by promoting it.

**There is no `--duration-*` theme namespace in Tailwind v4.** Duration utilities take a bare number (`duration-200`) or a CSS variable via the shorthand (`duration-(--motion-base)`). That shapes Task 1: easings become `@theme` entries and generate utilities; durations become plain `:root` custom properties consumed through the variable shorthand, with Tailwind's numeric utilities still valid where the number matches a token.

---

## The reduced-motion conflict

The intake says: *"nothing moves under `prefers-reduced-motion: reduce`."* Taken literally that **contradicts a documented DSN-2 decision**, and the decision is right.

`CONVENTIONS.md:1672-1674` records: *"**fixed**: reduced-motion now respected for dialog/alert-dialog/select entrance-exit animations (`index.css`); loading spinners/skeletons **deliberately keep animating** (`ux-guidelines.csv` 'Continuous Animation')."* The same reasoning is in the CSS comment at `index.css:200-202`.

**Resolution — hold the carve-out, and finally explain it in the CSS:**

- **Decorative motion is collapsed.** Everything whose only job is to look pleasant: `animate-in`/`animate-out` (dialogs, dropdowns, selects, toasts, `Reveal`), the route fade, and the CSS transitions this story touches.
- **Loading feedback keeps animating.** `animate-spin` (`Loading.tsx`) and `animate-pulse` (`skeleton.tsx`) are the *only* signal that work is in progress. Freezing them turns a loading state into an indistinguishable broken state — strictly worse for the user reduced-motion is meant to protect. This is not motion for its own sake, which is what the preference is asking to remove.

So the honest phrasing, which Task 6 writes into both docs, is: **"no *decorative* motion under `prefers-reduced-motion: reduce`; loading feedback is exempt, deliberately."** Do not silently widen the CSS rule to `*` or to `animate-pulse`/`animate-spin`.

---

## The route-transition decision

The intake's Task 3 lists "route and page transitions". Two candidate mechanisms were checked against the installed code, and one is rejected:

**Rejected — the View Transitions API.** `react-router@8.3.0` exports `useViewTransitionState` and `UNSAFE_ViewTransitionContext` (verified by enumerating the package's exports); driving it requires either a `viewTransition` prop on every `<Link>` or `navigate(..., { viewTransition: true })` at every call site. That is precisely the *per-screen* change the intake's own constraint forbids ("shared-component level only — animate the UI primitives once so every consumer inherits it, never per feature screen"). It is also still `UNSAFE_`-prefixed in this version.

**Rejected — keying the `<Outlet />` wrapper on `location.pathname`.** It is the obvious three-line version and it is wrong here: changing a `key` **remounts the whole routed subtree**. React Router deliberately keeps a component mounted across a param change (`/tickets/1` → `/tickets/2`); a pathname key would force a remount there, discarding component state and re-running every effect. A motion story must not change mount semantics.

**Adopted — a class re-trigger on `<main>`, no remount.** `RootLayout` toggles an `animate-in fade-in` class off and back on when `useLocation().pathname` changes. The wrapper never remounts (no `key` change), only its `className` changes; the incoming content is already rendered, so the fade adds **zero perceived latency** — satisfying the intake's "motion must not delay perceived interactivity". It uses `.animate-in`, so `index.css`'s existing reduced-motion rule already collapses it with no extra CSS. Exact implementation in Task 5.

---

## What is already done

Two items on the intake's Task 3 list are complete. Verify before touching, then leave alone:

- **Button press feedback.** `button.tsx:8` carries `transition-all duration-200 cursor-pointer` in the base, and the `default`/`destructive`/`secondary` variants carry `hover:-translate-y-px active:translate-y-0`. Shipped by Story 51 (`DSN-5`). Story 63 (`DSN-8`) then recorded explicitly in its own Prerequisites: *"No task in this plan re-touches `button.tsx`/`input.tsx`/`select.tsx`."* **This story re-touches none of the three either.**
- **Dialog / alert-dialog enter-exit.** `dialog.tsx:37,65` and `alert-dialog.tsx:32,57` already carry the full `data-[state=open]:animate-in fade-in-0 zoom-in-95` / `data-[state=closed]:animate-out fade-out-0 zoom-out-95` set **plus** `duration-200`. The only gap is that `dropdown-menu.tsx` and `select.tsx`'s content have the same animation set with **no duration**, so those two alone drift to the library default. Task 4 normalises the two that drift; it does not restyle the two that are already correct.

---

## Context — Read These Files First

1. `frontend/src/index.css` — read lines 125-172 (`@theme inline`: `--color-*`, then `--radius-sm/md/lg/xl` at 164-167, then `--font-sans`/`--font-arabic`). **This is where the `--ease-*` tokens go**, and the `--radius-*` group is the formatting precedent to match. Then read lines 174-209 (`@layer base`): the `html, body { @apply h-full overflow-hidden }` rule at 181-183, and — the important one — the `@media (prefers-reduced-motion: reduce)` block at 204-208 with its comment at 196-203 naming `animate-spin`/`animate-pulse` as deliberately untouched. Line 2 is `@import 'tw-animate-css'`.
2. `frontend/src/shared/landing/Reveal.tsx` — all ~70 lines. **The file Task 3 moves.** Note every behaviour that must survive byte-for-byte: the `disabled` prop and its docstring reason (Story 94's admin preview), the `prefers-reduced-motion` short-circuit inside the `useState` initialiser (line ~37), the `IntersectionObserver` with `rootMargin: '0px 0px -10% 0px'` and its `observer.disconnect()` on first intersection, the inline `animationDelay` style, and the exact class pair `'animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-700'` / `'opacity-0'`. Read the docstring paragraph on `slide-in-from-bottom-*` being direction-neutral — it stays true and stays in the file.
3. `frontend/src/shared/landing/index.ts` — the barrel. It currently re-exports `Reveal` (line ~18). Task 3 removes that line; the export moves to `shared/ui/`.
4. `frontend/src/shared/landing/sections/LandingSections.tsx` — read the import block (line ~10, `import { Reveal } from '../Reveal'`) and the two usages: `<Reveal key={highlight.key} delayMs={index * 80} disabled={!animate}>` (~101) and `<Reveal disabled={!animate}>` (~136). **Only the import path changes.** Read the file docstring's paragraph beginning "Story 96 adds NO new motion" — Task 3 updates that sentence to point at this story.
5. `frontend/src/shared/ui/toast/ToastProvider.tsx` — all ~89 lines. The toast list is a hand-built `<div className="fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2">` (line 63) mapping `toasts` to a `<div>` with `role`/`aria-live`/`data-tone` (65-77). **Not Radix**, so there is no `data-[state]` to hook — the entrance class goes straight on the item. Note `dismiss` (30-38) removes from state synchronously, which is why exit is out of scope. Note the container is anchored `bottom-4 end-4` (logical `end`, correct in RTL) — which is why the entrance must slide from the **bottom**, a direction-neutral axis, not from the end side.
6. `frontend/src/shared/ui/primitives/dropdown-menu.tsx` — read lines 39 and 207 (`DropdownMenuContent` and `DropdownMenuSubContent`). Both carry the full `data-[side=*]:slide-in-from-*` + `data-[state=open]:animate-in fade-in-0 zoom-in-95` + `data-[state=closed]:animate-out fade-out-0 zoom-out-95` set and **no duration**. Note `data-[side=left]:slide-in-from-right-2` — `check:rtl` does **not** flag `slide-in-from-right-2` (the hyphen before `right` defeats its `(?<![\w-])` lookbehind), which is why the suite passes today. Do not "fix" these into logical names; they mirror Radix's own `data-side`.
7. `frontend/src/shared/ui/primitives/select.tsx` — read line 37 (`SelectTrigger`: `transition-[color,box-shadow,border-color] duration-200` — already correct, do not touch) and line 62 (`SelectContent`: same animation set as dropdown, same missing duration).
8. `frontend/src/shared/ui/primitives/dialog.tsx` (lines 37, 65) and `alert-dialog.tsx` (lines 32, 57) — **already carry `duration-200`.** Read them to confirm, then leave them alone; Task 4 changes only how that 200 is spelled, and only if it can be done without churn (see the task).
9. `frontend/src/shared/ui/primitives/skeleton.tsx` — all 13 lines. `'animate-pulse rounded-md bg-accent'`. `animate-pulse` is loading feedback and is **exempt** from the reduced-motion collapse (see `## The reduced-motion conflict`) — Task 4 does not remove it.
10. `frontend/src/shared/ui/primitives/table.tsx` — read line 49 (`TableRow`: `border-b transition-colors hover:bg-muted/50 …`). `transition-colors` with no duration inherits Tailwind's 150ms default.
11. `frontend/src/shared/ui/primitives/button.tsx` (lines 7-40), `input.tsx`, `tabs.tsx` (lines 62, 65) — read to confirm they already carry `duration-200` / `transition-all`, then **do not edit any of them** (see `## What is already done`).
12. `frontend/src/app/RootLayout.tsx` — all 15 lines. `<div className="flex h-dvh overflow-hidden bg-background">` wrapping `<Sidebar />` and `<main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6"><Outlet /></main>`. **`<main>` is the element Task 5 animates**, and it is also the app's scroll container for staff routes.
13. `frontend/src/app/Sidebar.tsx` — read line 210 (`transition-[width] duration-200` on the aside) and line 150 (`transition-transform` on the chevron). Already correct; Task 4 leaves both.
14. `design-system/supportos/MASTER.md` — read line 173 (Key Effects: "Subtle hover (200-250ms), smooth transitions"), line 196 (Anti-Pattern: "**Instant state changes** — Always use transitions (150-300ms)"), lines 208 and 211 (Pre-Delivery Checklist: "Hover states with smooth transitions (150-300ms)", "`prefers-reduced-motion` respected"), and the repeated `transition: all 200ms ease` in the component CSS at lines 87, 104, 117, 135. **This is the entire source for the duration scale** — a 150-300ms band with 200ms as the repeated concrete value. Note it specifies no easing beyond the CSS keyword `ease`.
15. `CONVENTIONS.md` — § 0 and § 17 (the "check for an existing utility first" rule this story's `## The dependency check` answers), § 19 (tokens are the single styling source), § 25's UX/accessibility subsection at ~1665-1680 (**the reduced-motion carve-out at 1672-1674**), and the `### Landing page visual language (LAND-4, Story 96)` subsection at line 1812 — the new motion subsection goes **after** it, before `## 26. Customer portal identity & scoping` at line 1846. Also § 16 (**this project does not author automated tests**).
16. `frontend/scripts/check-rtl.mjs` — read lines 12-31. Text scan over `.ts`/`.tsx`/`.css`, matches inside comments and strings. `translate-x-` is forbidden; `translate-y-` is not; `slide-in-from-left/right-*` is not matched (hyphen lookbehind). Stories 94 and 95 each tripped this rule on prose — do not repeat it.

---

## Frontend Tasks

### 1 — Motion tokens

**File: `frontend/src/index.css`**

Two additions. First, in `:root` (after `--radius: 0.625rem;`, line ~17), the duration scale — plain custom properties, because **Tailwind v4 has no `--duration-*` theme namespace** (`## The dependency check`):

```css
  /* --- Motion scale (MOTION-0, Story 97) --------------------------------
     Sourced from MASTER.md, not invented: its Anti-Patterns require
     "transitions (150-300ms)" (line 196) and its Key Effects call for
     "subtle hover (200-250ms)" (line 173), while its own component CSS
     repeats `transition: all 200ms ease` four times (lines 87/104/117/135).
     So: 150 / 200 / 300 are the band's floor, its repeated value, and its
     ceiling — three tokens, no more.

     NOT `@theme` entries: Tailwind v4 has no `--duration-*` namespace, so
     these cannot generate `duration-*` utilities. Consume them with the
     CSS-variable shorthand — `duration-(--motion-fast)`. Tailwind's numeric
     utilities stay valid where the number matches (`duration-200` ===
     `duration-(--motion-base)`); prefer the token in new code.

     `--motion-reveal` is deliberately outside the 150-300ms band: a
     scroll-triggered reveal is not an interaction response, and 700ms is
     the value `Reveal` has shipped with since LAND-1. Kept as a token so
     the one long duration in the app is named rather than magic. */
  --motion-fast: 150ms;
  --motion-base: 200ms;
  --motion-slow: 300ms;
  --motion-reveal: 700ms;
```

Second, in `@theme inline` (after the `--radius-*` group at lines 164-167, before `--font-sans`), the easings — these **do** generate utilities, because `--ease-*` is a real v4 namespace:

```css
  /* MASTER.md specifies no easing beyond the CSS `ease` keyword, so these
     are named aliases for the standard curves rather than invented
     cubic-beziers: `ease-entrance` for things arriving (decelerate in),
     `ease-exit` for things leaving (accelerate out), `ease-state` for a
     property changing in place. Generates `ease-entrance` / `ease-exit` /
     `ease-state` utilities (MOTION-0, Story 97). */
  --ease-entrance: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-state: cubic-bezier(0.4, 0, 0.2, 1);
```

Those three curves are CSS's own `ease-out`, `ease-in` and `ease-in-out` written explicitly — the same values Tailwind's built-in `--ease-out`/`--ease-in`/`--ease-in-out` carry. **Naming them by role, not by curve, is the point:** an author picks `ease-entrance` without deciding which mathematical curve an entrance wants.

### 2 — One reduced-motion policy, explained

**File: `frontend/src/index.css`**

Replace the `@media (prefers-reduced-motion: reduce)` block at lines 196-208 (comment included). It must now cover the two motions this story adds and state the carve-out as policy rather than as an aside:

```css
  /* --- Reduced-motion policy (MOTION-0, Story 97) ------------------------
     ONE rule for the whole app, applied here rather than per component —
     that is the entire point of this block, and no component should ship
     its own `prefers-reduced-motion` media query.

     DECORATIVE MOTION IS COLLAPSED. Everything whose only job is to look
     pleasant: every `tw-animate-css` enter/exit (dialogs, alert-dialogs,
     dropdowns, selects, the toast entrance, `shared/ui/Reveal`), and the
     route-change fade on `<main>`. Collapsed to 0.01ms rather than removed,
     so `animationend` listeners still fire.

     LOADING FEEDBACK IS EXEMPT, DELIBERATELY. `animate-spin` (`Loading`)
     and `animate-pulse` (`Skeleton`) are the only signal that work is in
     progress — freezing them turns a loading state into an
     indistinguishable broken one, which is strictly worse for the very
     users this preference protects. Recorded by DSN-2 (Story 37,
     CONVENTIONS.md § 25, `ux-guidelines.csv` "Continuous Animation") and
     held here. Do NOT widen this rule to `*` or to those two classes.

     CSS TRANSITIONS are collapsed too (Story 97's addition): a 200ms
     colour or transform transition is decorative by the same test. The
     `!important` is required to beat the utilities' own specificity. */
  @media (prefers-reduced-motion: reduce) {
    .animate-in,
    .animate-out {
      animation-duration: 0.01ms !important;
    }

    /* Not `*` — that would catch `animate-spin`/`animate-pulse` via
       `animation-duration` too. Transitions only, and only on elements
       that actually declare one. */
    *,
    *::before,
    *::after {
      transition-duration: 0.01ms !important;
      transition-delay: 0ms !important;
    }
  }
```

> **Verify the exemption survives.** After this edit, emulate reduced motion and confirm `Loading`'s spinner still spins and `Skeleton` still pulses (Verification step 8). If either freezes, the transition rule was written as an `animation-*` override by mistake.

### 3 — Promote `Reveal` to `shared/ui/`

**Create file: `frontend/src/shared/ui/Reveal.tsx`** — `frontend/src/shared/landing/Reveal.tsx` moved verbatim, with exactly two changes:

- The `duration-700` class becomes the token: `duration-(--motion-reveal)`.
- The docstring gains a paragraph recording the move and the token:

```
 * Promoted from `shared/landing/` to `shared/ui/` by MOTION-0 (Story 97) —
 * a scroll reveal is a generic primitive, not a landing-page concern, and
 * `shared/ui/` is where generic primitives live (the same placement rule
 * `shared/branding/BrandMark.tsx` records in reverse for domain
 * components). Behaviour is unchanged from LAND-1: same observer, same
 * `rootMargin`, same `disabled` escape hatch, same reduced-motion
 * short-circuit. Only the 700ms literal became `--motion-reveal`.
```

**Everything else is byte-identical** — the `disabled` prop, the `useState` initialiser's `matchMedia` short-circuit, the `IntersectionObserver` with `rootMargin: '0px 0px -10% 0px'`, the `observer.disconnect()`, the inline `animationDelay`, and the `opacity-0` fallback class. A placement note in `shared/ui/` rather than `shared/ui/primitives/`: `primitives/` is the shadcn-generated set; `Reveal` is hand-written, like its siblings `Loading.tsx`, `Empty.tsx` and `PageHeader.tsx`.

**Delete `frontend/src/shared/landing/Reveal.tsx`.** The intake's "no feature-local copies left behind" is the binding constraint — verify with `grep -rn "from '.*landing/Reveal'" frontend/src` returning nothing.

**File: `frontend/src/shared/landing/index.ts`** — remove the `export { Reveal } from './Reveal'` line. `shared/landing` no longer owns it.

**File: `frontend/src/shared/landing/sections/LandingSections.tsx`** — change the import from `'../Reveal'` to `'@/shared/ui/Reveal'`. **The two `<Reveal …>` usages are unchanged**, props and all. Also update the docstring sentence that reads "Story 96 adds NO new motion — every hover here is a 200ms state transition (`DSN-8`'s category), not a `Reveal`/`animate-in` addition. See that story's `## The MOTION-0 dependency`." to note that MOTION-0 (Story 97) has since landed and `Reveal` now comes from `shared/ui/`.

**Check for other consumers first.** `grep -rn "Reveal" frontend/src` — today the only importer is `LandingSections.tsx`. If that is still true, this is a two-line change plus a delete.

### 4 — Primitive micro-interaction pass

Four edits, each at the shared level, each a class change.

**File: `frontend/src/shared/ui/toast/ToastProvider.tsx`** — the toast has no entrance at all. Add one to the item `className` (line ~76), inside the existing `cn(...)`:

```tsx
              'animate-in fade-in slide-in-from-bottom-2 duration-(--motion-base) ease-entrance',
```

`slide-in-from-bottom-2`, not from the end side: the container is anchored `bottom-4 end-4`, and a bottom-axis slide is direction-neutral, so it reads correctly in both LTR and RTL without an `rtl:` counterpart. Entrance only — exit is out of scope (`## Story Goal`).

**File: `frontend/src/shared/ui/primitives/dropdown-menu.tsx`** — both content classes (lines 39 and 207) carry the animation set with no duration. Append `duration-(--motion-fast) ease-entrance` to each. 150ms, not 200ms: a menu that opens under the cursor should feel instant, and MASTER.md's band floor is exactly this case.

**File: `frontend/src/shared/ui/primitives/select.tsx`** — same change on `SelectContent` (line 62) only: append `duration-(--motion-fast) ease-entrance`. **Do not touch `SelectTrigger` (line 37)** — it already carries `transition-[color,box-shadow,border-color] duration-200` from Story 51.

**File: `frontend/src/shared/ui/primitives/table.tsx`** — `TableRow` (line 49) has `transition-colors` with no duration. Append `duration-(--motion-fast)`. A row-hover tint is the highest-frequency transition in the staff app; it must not lag the pointer.

**Deliberately NOT edited**, and Verification step 9 checks each is untouched:

- `button.tsx`, `input.tsx` — already correct (`## What is already done`), and `DSN-8` explicitly promised not to re-touch them.
- `dialog.tsx`, `alert-dialog.tsx` — already carry `duration-200`, which **is** `--motion-base`. Rewriting `duration-200` to `duration-(--motion-base)` across two files is churn for no behavioural gain; the token comment in Task 1 already records that the two spellings are equal. Leave them.
- `skeleton.tsx` — `animate-pulse` is exempt loading feedback (`## The reduced-motion conflict`). No change.
- `Sidebar.tsx`, `tabs.tsx` — already carry `duration-200` / `transition-all`.

### 5 — Route-change fade

**File: `frontend/src/app/RootLayout.tsx`**

Per `## The route-transition decision`: re-trigger a class, never remount. Replace the component body:

```tsx
export function RootLayout() {
  const { pathname } = useLocation()
  // Re-trigger the entrance animation on every route change WITHOUT
  // remounting the routed subtree. A `key={pathname}` on this wrapper
  // would be three characters shorter and wrong: changing a key remounts
  // everything below it, and React Router deliberately KEEPS a component
  // mounted across a param change (`/tickets/1` -> `/tickets/2`). A motion
  // story must not change mount semantics. Toggling the class off for one
  // frame and back on restarts the CSS animation with no remount.
  //
  // Zero perceived latency: the incoming content is already rendered when
  // this runs — it fades in, it is never delayed. `.animate-in` means
  // `index.css`'s reduced-motion rule already collapses it, with no extra
  // CSS here.
  const [animating, setAnimating] = useState(false)
  useEffect(() => {
    setAnimating(false)
    const frame = requestAnimationFrame(() => setAnimating(true))
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <main
        className={cn(
          'flex-1 overflow-x-hidden overflow-y-auto px-4 py-6',
          animating && 'animate-in fade-in duration-(--motion-base) ease-entrance',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
```

Imports to add: `useEffect`/`useState` from `react`, `useLocation` from `react-router`, `cn` from `@/shared/lib/cn`.

Two things this must not do, both checked at Verification step 7: it must not reset `<main>`'s scroll position (it does not — no remount, and `overflow-y-auto` stays on the same element), and it must not fade on a query-string-only change (it does not — the effect keys on `pathname`, not `search`).

**`PublicLayout.tsx` is deliberately not given this treatment.** Its `variant="full"` consumer is the landing page, which already runs its own hero `animate-in` on mount; stacking a second fade over it would double-animate the front door.

---

## Documentation Task

### 6 — Record the vocabulary in both places

The intake requires the outcome be recorded in **both** files, "so it is discoverable".

**File: `CONVENTIONS.md`** — add a `### Motion vocabulary (MOTION-0, Story 97)` subsection to § 25, **after** the `### Landing page visual language (LAND-4, Story 96)` subsection (line 1812) and before `## 26.` (line 1846). Cover, one short paragraph each:

- **The token set** — `--motion-fast|base|slow` (150/200/300, MASTER.md's band) and `--motion-reveal` (700ms, outside the band because a scroll reveal is not an interaction response); `ease-entrance`/`ease-exit`/`ease-state` as role-named aliases for the standard curves. Note that durations are `:root` variables consumed via `duration-(--motion-base)` because **Tailwind v4 has no `--duration-*` namespace**, while easings are `@theme` entries that do generate utilities.
- **The reduced-motion policy** — one rule in `index.css`, never per component; decorative motion collapsed; `animate-spin`/`animate-pulse` exempt, with DSN-2's reasoning restated in one sentence.
- **The dependency conclusion** — `tw-animate-css@1.4.0` plus Tailwind v4's `--ease-*`/`--animate-*` namespaces cover everything; no animation dependency was added and none is needed; `tw-animate-css` is correctly a devDependency because Tailwind inlines it at build time.
- **What is deliberately unanimated** — `sheet`/`popover` do not exist in this codebase; toast exit needs a leaving-state machine, not a class; route transitions use a class re-trigger rather than the View Transitions API or a remounting `key`, and why.

Also **correct the DSN-2 line at ~1672-1674** in place: it currently scopes the reduced-motion fix to "dialog/alert-dialog/select entrance-exit animations". After Task 2 the rule also covers dropdown, toast, `Reveal`, the route fade, and all CSS transitions. Rewrite the clause to say so and point at the new subsection.

**File: `design-system/supportos/MASTER.md`** — add a `### Motion` subsection under `## Global Rules`, immediately after `### Shadow Depths` (which ends at line 73), matching the existing table format:

| Token | Value | Usage |
|---|---|---|
| `--motion-fast` | `150ms` | Menus, popovers, row hover — anything under the pointer |
| `--motion-base` | `200ms` | Default state change: buttons, inputs, cards, dialogs, toasts |
| `--motion-slow` | `300ms` | Large surfaces; the band's ceiling |
| `--motion-reveal` | `700ms` | Scroll-triggered reveal only — not an interaction response |
| `ease-entrance` | `cubic-bezier(0, 0, 0.2, 1)` | Arriving |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Leaving |
| `ease-state` | `cubic-bezier(0.4, 0, 0.2, 1)` | Changing in place |

Add two lines under the table: that these derive from MASTER.md's own "150-300ms" Anti-Pattern (line 196) and repeated `200ms ease` component CSS, and that `prefers-reduced-motion` is honoured once globally in `index.css` with loading feedback exempt.

---

## Edge Cases & Failure Modes

- **`prefers-reduced-motion: reduce` freezes the spinner or skeleton.** The failure mode this story most has to avoid. Task 2's transition rule targets `transition-duration`/`transition-delay` only — never `animation-duration` on `*` — so `animate-spin`/`animate-pulse` are untouched. Verification step 8 checks both directly.
- **The global transition override is too broad.** `*, *::before, *::after { transition-duration: 0.01ms }` under reduced motion is intentional and standard: it affects only elements that already declare a transition, and collapsing one is exactly what the preference asks for. It does not disable `:hover` styles — the end state still applies, it just arrives instantly.
- **Route fade remounts the page.** It must not. `animating` is a boolean in `className`, never a `key`. Verification step 7 navigates `/tickets/1` → `/tickets/2` and confirms the component did not remount (scroll position and any open panel state survive).
- **Route fade double-fires on a query-string change.** It does not: the effect's dependency is `pathname`, so `?page=2` does not re-trigger. A filter change on a list page must not flash the whole page.
- **Route fade flashes on first mount.** `animating` starts `false` and flips `true` on the first `requestAnimationFrame`, so the very first paint of the app also fades in once. Acceptable and desirable — it matches every subsequent navigation. If it reads as a flash of empty content, it is not: the content is rendered at `opacity` 0→1 within 200ms, never absent.
- **`duration-(--motion-base)` does not compile.** Tailwind v4's CSS-variable shorthand requires the parenthesis form exactly — `duration-(--motion-base)`, not `duration-[var(--motion-base)]` (which also works but is verbose) and not `duration-(--motion-base )`. If a duration silently does nothing, check for that first; `npx vite build` will not error on an unrecognised utility, so **Verification step 5 inspects the generated CSS**, not just the build's exit code.
- **A token is referenced before it is defined.** `--motion-*` live in `:root` (Task 1), which `index.css` declares before `@theme inline`. A utility using `duration-(--motion-base)` resolves at runtime against the cascade, so ordering inside the file does not matter — but the variable must exist in `:root`, not inside `@theme inline`, or `duration-(...)` gets an undefined value and falls back to `0s`.
- **Toast entrance in RTL.** `slide-in-from-bottom-2` is a vertical axis — direction-neutral by construction, the same reasoning `Reveal`'s docstring already records for `slide-in-from-bottom-4`. The container's `end-4` anchor is already logical. Nothing to mirror.
- **`Reveal`'s move breaks the admin preview.** `LandingContentPage.tsx` passes `animate={false}` down to the sections, which pass `disabled` to `Reveal`. The prop, the short-circuit and the observer are unchanged by the move, so the preview behaves identically. Verification step 10 confirms the preview is not blank.
- **A stale import of the deleted `shared/landing/Reveal`.** `tsc -b` fails on it — this is compile-time-caught, not a runtime risk. Verification step 4 also greps for the old path explicitly.
- **`check:rtl` trips on prose.** It is a text scan and matches inside comments. This story's comments mention `slide-in-from-bottom`, `translate-y`, and `left`/`right` only in words like "leaving" — none of which match its patterns. Stories 94 and 95 each tripped this; re-read Context item 16 before writing comments.
- **Dropdown/select feel *too* fast at 150ms.** That is the intended trade: MASTER.md's band floor exists for exactly this case. If a reviewer disagrees, the change is one token swap to `--motion-base` in two files — which is the whole point of having tokens.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md § 16: *"Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."*

**No test file is added, modified, or removed.** Verification is `## Verification Steps` below.

---

## Migration / Rollback

**No backend change of any kind.** No model, no migration, no serializer, no endpoint, no permission. `makemigrations --check` must still report "No changes detected" — Verification step 1.

**Frontend only, and every change is a class or a token.** Rollback is `git revert` of the single commit; there is no persisted state, no schema, and no API contract involved. Nothing here is a one-way door.

**Half-deployed states do not exist** — this ships as one frontend bundle. There is no ordering constraint with the backend because the backend is untouched.

**The one irreversible-ish item is a file move.** `shared/landing/Reveal.tsx` → `shared/ui/Reveal.tsx`. If it must be undone, move the file back and restore the two import lines; the component's contents are unchanged apart from one class and one docstring paragraph, so a revert is clean.

---

## Verification Steps

1. **Backend untouched:** in `backend/`, `python manage.py makemigrations --check --dry-run` reports **"No changes detected"**, and `git status --short backend/` is empty.
2. **Frontend gates:** in `frontend/`, `npx tsc -b` (the project has **no** `typecheck` script — `build` runs `tsc -b`), `npm run lint`, `npm run check:rtl`, `npm run format:check`, and `npx vite build` all pass. `check:rtl` must print "no physical direction utilities in src/."
3. **No new dependency:** `git diff frontend/package.json frontend/package-lock.json` is **empty**.
4. **The move is complete:** `frontend/src/shared/landing/Reveal.tsx` does not exist; `grep -rn "landing/Reveal" frontend/src` returns nothing; `grep -rn "from '@/shared/ui/Reveal'" frontend/src` returns exactly one hit (`LandingSections.tsx`).
5. **The tokens actually compile** — the step a green build does not prove. After `npx vite build`, grep the emitted CSS for the resolved values: `grep -o "\-\-motion-[a-z]*:[^;]*" dist/assets/*.css` shows all four durations, and `grep -c "cubic-bezier(0, 0, 0.2, 1)" dist/assets/*.css` is ≥ 1 (proving `ease-entrance` generated a real utility and was used). If a `duration-(--motion-*)` utility was mistyped it silently emits nothing — this is how you catch it.
6. **Motion is visible where it was added:** open `/home`. Trigger a toast (save anything) — it fades and slides up from the bottom. Open any `SelectField` and any dropdown menu — both open in ~150ms. Hover a `DataTable` row — the tint arrives in ~150ms, not instantly and not laggily.
7. **Route fade, without a remount:** navigate between sidebar links — `<main>`'s content fades in each time. Then, the critical check: on a ticket detail page scroll down, navigate `/tickets/1` → `/tickets/2` via a link, and confirm **the page did not remount** (React DevTools shows no unmount, and any expanded panel keeps its state). Then change a list page's filter (a query-string-only change) and confirm **no fade fires**.
8. **Reduced motion — both halves.** DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`, reload. (a) Decorative motion is gone: dialogs, dropdowns, the toast, the route fade and the landing `Reveal` all appear instantly, and **all content is visible** — nothing stuck at `opacity-0`. (b) **Loading feedback still animates**: `Loading`'s spinner still spins and `Skeleton` still pulses. Both halves must hold; (b) failing is a regression against DSN-2.
9. **The untouched files are untouched:** `git diff --stat` shows **no change** to `button.tsx`, `input.tsx`, `skeleton.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `tabs.tsx`, or `Sidebar.tsx`. If any appears, revert that hunk — `## What is already done` explains why each is excluded.
10. **Landing page and admin preview unchanged in behaviour:** open `/` signed out — the hero entrance and the scroll reveals behave exactly as before this story (same 700ms, same stagger). Open `/settings/landing` — the preview renders every section **visibly** (no `opacity-0` ghosts), proving `disabled` still short-circuits after the move.
11. **RTL:** switch to Arabic. The toast still enters from the bottom at the start-side-anchored container, the dropdown/select still open on the correct side, and the route fade is unchanged (opacity has no direction). No horizontal scroll at 375px.
12. **Docs are discoverable:** `grep -n "Motion vocabulary" CONVENTIONS.md` and `grep -n "### Motion" design-system/supportos/MASTER.md` each return a hit, and CONVENTIONS.md's DSN-2 reduced-motion line no longer claims the rule covers only "dialog/alert-dialog/select".

---

## Done Criteria

- [ ] A motion scale exists as tokens — `--motion-fast|base|slow|reveal` in `:root`, `--ease-entrance|exit|state` in `@theme inline` — each sourced from `MASTER.md`'s own numbers, with the sourcing recorded in the CSS comment.
- [ ] **No animation dependency was added.** `package.json`/`package-lock.json` show an empty diff, and the `tw-animate-css` + Tailwind-v4 check is written down in `CONVENTIONS.md`.
- [ ] `prefers-reduced-motion: reduce` is honoured by **one** rule in `index.css`, never per component, and it now covers CSS transitions as well as `animate-in`/`animate-out`.
- [ ] **`animate-spin` and `animate-pulse` still animate under reduced motion** — DSN-2's deliberate carve-out is preserved and is now explained in the CSS itself.
- [ ] `Reveal` lives at `frontend/src/shared/ui/Reveal.tsx`, re-expressed on `--motion-reveal`; `shared/landing/Reveal.tsx` is deleted; no import of the old path remains; the landing page's reveal behaviour is identical.
- [ ] The toast has an entrance (bottom-axis, direction-neutral); dropdown, select-content and table-row carry an explicit token duration.
- [ ] Route changes fade `<main>` **without remounting the routed subtree**, and do not fire on a query-string-only change.
- [ ] `button.tsx`, `input.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `skeleton.tsx`, `tabs.tsx` and `Sidebar.tsx` are **unmodified** — each already correct, and `DSN-8` promised not to re-touch the first two.
- [ ] `sheet`/`popover` motion, toast exit, and the View Transitions API are each **named as out of scope with a reason**, not silently dropped.
- [ ] The vocabulary is recorded in **both** `CONVENTIONS.md` § 25 and `design-system/supportos/MASTER.md`, and DSN-2's now-narrow reduced-motion line is corrected.
- [ ] `npx tsc -b`, `npm run lint`, `npm run check:rtl`, `npm run format:check`, `npx vite build`, and `makemigrations --check` all pass; the emitted CSS is grepped to prove the tokens compiled.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md § 16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to the next story.**
