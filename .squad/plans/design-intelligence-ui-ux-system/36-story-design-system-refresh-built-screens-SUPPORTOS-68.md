# Story 36 — (DSN-1) Design System Refresh Across Built Screens (Story: SUPPORTOS-68)

## Prerequisites

- **`DSN-0` (Story 35, Design Intelligence Foundation) is complete** — `.claude/skills/ui-ux-pro-max/` is installed, `design-system/supportos/MASTER.md` is generated and persisted, and `CONVENTIONS.md` § 25 (lines 1395-1494) records the token reconciliation this story executes. This story turns those decisions into real `frontend/` changes.
- **This story is token/style-only — "no re-architecture of existing components" (intake).** Verified: `frontend/src/index.css` is the single styling source (`CONVENTIONS.md` § 19, lines 383-386 — "Every colour, radius, and font stack comes from a token — no hex, `rgb()`, `oklch()`, or bare `px` in a component"). Grepped `frontend/src/` for `#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(` — the **only** match anywhere in `frontend/src/` is `index.css` itself. This confirms every screen consumes colors exclusively through the CSS variables this story edits; no per-page or per-component file needs a color change.
- **Two of § 25's four "adopt" decisions are direct token swaps** (`--primary`/`--primary-foreground`, `--destructive`); **one is a resolved "defer"** (`--secondary`/`--secondary-foreground` — resolved below, this story's own judgment call, see task 1); **one is font** (`--font-sans`). **`--accent`/`--accent-foreground` and `--font-arabic` are "Keep current"** (§ 25) — not touched. **`--chart-1`…`--chart-5` are "Defer to `DSN-3`"** (§ 25) — not touched; no chart exists yet in this codebase (Reports & Analytics, `EPIC 11`, is unplanned). **`--radius`'s "Defer"** is also resolved below (task 2) as a two-line component-level fix, not a token-scale change.
- **§ 25's own flagged "conflict" on `--secondary` is resolved by reading real code, not by picking one of MASTER.md's two conflicting samples.** `frontend/src/shared/ui/primitives/button.tsx` line 15-16 already has a **separate `outline` variant** (`border bg-background ... hover:bg-accent`) distinct from the `secondary` variant (line 17: `bg-secondary text-secondary-foreground`). MASTER.md's `.btn-secondary` CSS sample (an outline button) describes a generic "secondary button" concept that this codebase already implements as its own `outline` variant — it is not describing the `--secondary` token at all. MASTER.md's color-table pairing (`Secondary #64748B` / `On Secondary #FFFFFF`) is therefore the correct, non-conflicting source for the `--secondary`/`--secondary-foreground` tokens; the `outline` variant's own styling (`bg-background`, neutral, untouched by § 25) is unaffected.
- **Contrast-verified before writing this plan, not assumed.** Using the WCAG relative-luminance formula against the real rendered hex values: white text on `#2563EB` (new `--primary`) is **5.17:1**; white text on `#64748B` (new `--secondary`) is **4.76:1**; white text on `#DC2626` (new `--destructive`) is **4.83:1** — all clear the 4.5:1 minimum MASTER.md's own Pre-Delivery Checklist requires (`CONVENTIONS.md` § 25's "UX & accessibility guidance", line 1457-1459). This is why task 1 below reuses the **same** value in `:root` and `.dark` for these three token pairs (see task 1's own note on why the light/dark divergence pattern used by the *neutral* theme does not carry over to a chromatic one).
- **`frontend/src/shared/ui/primitives/button.tsx` line 14's `dark:bg-destructive/60`** (the destructive button's existing dark-mode treatment — an opacity modifier on `--destructive`, not a separate value) **was verified, not assumed, to still pass contrast** with the new `--destructive`: alpha-blending `#DC2626` at 60% over this project's dark background (`oklch(0.145 0 0)` ≈ `rgb(10,10,10)`) yields `rgb(136,27,27)`, and white text against that blend is **9.46:1** — higher than the current shipped default's **6.47:1**. No change to `button.tsx`'s destructive variant classes is needed.
- **No backend change, no test file** (`CONVENTIONS.md` § 16 — this project does not author automated tests). This story's entire surface is `frontend/src/index.css`, `frontend/index.html`, two primitive files (`dialog.tsx`, `alert-dialog.tsx`, one class each), and `CONVENTIONS.md` § 25 (marking decisions resolved).

---

## Story Goal

1. **`frontend/src/index.css`** — `--primary`/`--primary-foreground`, `--secondary`/`--secondary-foreground`, and `--destructive` move from shadcn's greyscale defaults to `DSN`'s palette, using the **same** value in `:root` and `.dark` (justified above); `--font-sans` gains `'Atkinson Hyperlegible'` as its first fallback.
2. **`frontend/index.html`** — loads the Atkinson Hyperlegible Google Font via `<link rel="preconnect">` + `<link rel="stylesheet">` (not a render-blocking CSS `@import`), matching MASTER.md's own "fast loading" key effect (`CONVENTIONS.md` § 25).
3. **`frontend/src/shared/ui/primitives/dialog.tsx`** and **`alert-dialog.tsx`** — both modal-content wrappers move from `rounded-lg` (10px, the current derived `--radius-lg`) to `rounded-xl` (14px, `--radius-xl`), landing within 2px of MASTER.md's 16px modal guidance — the same margin `--radius-xl`'s card usage (`card.tsx`, `rounded-xl`) already sits from MASTER.md's 12px card guidance. `--radius`'s single-scale token architecture is **not** changed.
4. **`CONVENTIONS.md` § 25** — the reconciliation table's "Decision" cells for `--primary`, `--secondary`, `--destructive`, `--font-sans`, and `--radius` are updated to record what actually shipped (the resolved secondary/radius calls, and the light/dark-parity choice), so a future reader does not have to re-derive this story's reasoning from `git log`.
5. **Visual check across every already-built route** (`frontend/src/app/router.tsx`, full list in `## Verification Steps`) — confirms the retrofit is visually consistent everywhere via the shared tokens, with no per-page code change required.

**Not in scope** (per § 25's own "Keep current" / "Defer" decisions, unchanged by this story): `--accent`/`--accent-foreground`, `--font-arabic`, `--chart-1`…`--chart-5`, the `--radius` token scale itself, `alert.tsx`/`tabs.tsx` (both also use `rounded-lg`, but map to no DSN-defined component role — buttons/inputs/cards/modals only — so they are deliberately left alone; see `## Edge Cases & Failure Modes`), and the "Page Pattern" / FAQ-landing content §25 already flagged as inapplicable to these screens.

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-68/intake.md` — one task, no attachments, no acceptance criteria.
2. `SupportOs backlog.MD` lines 508-512 (`STORY (DSN-1)`) — `Dependencies: DSN-0`; the task text this story implements verbatim.
3. `CONVENTIONS.md` lines 1395-1494 (`## 25. Design intelligence`) — the full `DSN` spec, especially the token reconciliation table (lines 1441-1450) this story executes, and the resolved-vs-deferred status of each row.
4. `frontend/src/index.css` — `:root` lines 9-46 (light tokens: `--primary` line 17, `--primary-foreground` line 18, `--secondary` line 19, `--secondary-foreground` line 20, `--destructive` line 25, `--font-sans` line 44) and `.dark` lines 48-80 (`--primary` line 55, `--primary-foreground` line 56, `--secondary` line 57, `--secondary-foreground` line 58, `--destructive` line 63) — the exact lines task 1 edits. `@theme inline` lines 82-122 needs **no** change — it already maps every `--color-*`/`--font-*` name to the `:root`/`.dark` variable, so a value-only edit propagates with no mapping change.
5. `frontend/src/shared/ui/primitives/button.tsx` lines 7-20 (`buttonVariants`) — confirms exactly which token pairs each variant consumes: `default` → `bg-primary text-primary-foreground` (line 12), `destructive` → `bg-destructive text-white ... dark:bg-destructive/60` (line 14, hardcoded `text-white`, not a `--destructive-foreground` token — none exists in this codebase), `secondary` → `bg-secondary text-secondary-foreground` (line 17), `outline` → `border bg-background` (line 15-16, untouched, resolves the § 25 "conflict" per Prerequisites above).
6. `frontend/src/shared/ui/primitives/badge.tsx` lines 7-20 (`badgeVariants`) — same token pairs (`default`, `secondary`, `destructive`), confirming ticket/task/notification status badges are covered by the same token edit with no separate change.
7. `frontend/src/shared/ui/primitives/dialog.tsx` line 65 and `frontend/src/shared/ui/primitives/alert-dialog.tsx` line 57 — the two modal-content class strings task 3 edits (`rounded-lg` → `rounded-xl`); both are otherwise structurally identical wrappers (`fixed top-[50%] left-[50%] ... translate-x-[-50%] translate-y-[-50%] ...`).
8. `frontend/src/shared/ui/primitives/card.tsx` line 10 (`rounded-xl`, unchanged — already at the target radius family) and `input.tsx` line 11 (`rounded-md`, unchanged — already an exact 8px match to MASTER.md's input guidance) — read to confirm no further radius edit is needed beyond the two modal files.
9. `frontend/index.html` lines 1-8 — the `<head>` task 2's font `<link>` tags are inserted into, after `<title>` (line 7) and before the anti-FOUC `<script>` (line 8); no existing `<link>` for any font exists today.
10. `design-system/supportos/MASTER.md` lines 17-50 (Color Palette table, Typography section) — the generated source values task 1 applies.
11. `frontend/src/app/router.tsx` (full file, 165 lines) — the exact route list `## Verification Steps` checks: `/login`, `/chat`, `/contact`, `/` (`HealthPage`), `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/tickets`, `/tickets/new`, `/tickets/my-tickets`, `/tickets/:id`, `/tickets/:id/edit`, `/tasks`, `/tasks/new`, `/tasks/:id/edit`, and the `*` `NotFoundPage`.

---

## Implementation Tasks

### 1 — Retint `--primary`, `--secondary`, `--destructive` in `frontend/src/index.css`

**File: `frontend/src/index.css`**

In `:root` (replace lines 17-20 and line 25):

```css
  --primary: oklch(0.546 0.215 262.881); /* #2563EB — DSN Accent/CTA, MASTER.md line 25 */
  --primary-foreground: oklch(1 0 0); /* #FFFFFF */
  --secondary: oklch(0.554 0.041 257.417); /* #64748B — DSN Secondary, MASTER.md line 23 */
  --secondary-foreground: oklch(1 0 0); /* #FFFFFF */
```

```css
  --destructive: oklch(0.577 0.215 27.325); /* #DC2626 — DSN Destructive, MASTER.md line 34 */
```

In `.dark` (replace lines 55-58 and line 63) — **identical values to `:root`**, not shadcn's old inverted-for-dark pattern:

```css
  --primary: oklch(0.546 0.215 262.881); /* same as :root — see Prerequisites re: chromatic tokens vs. the neutral theme's invert-for-dark pattern */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.554 0.041 257.417);
  --secondary-foreground: oklch(1 0 0);
```

```css
  --destructive: oklch(0.577 0.215 27.325); /* same as :root — verified 9.46:1 at button.tsx's existing dark:bg-destructive/60 */
```

Do **not** change `--accent`/`--accent-foreground` (lines 23-24, 61-62) or `--chart-1`…`--chart-5` (lines 29-33, 67-71) in either block — both are "Keep current"/"Defer to `DSN-3`" per `CONVENTIONS.md` § 25.

In `:root`'s font block (replace line 44):

```css
  --font-sans: 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica,
    Arial, sans-serif;
```

Do **not** change `--font-arabic` (line 45) — "Keep current" per § 25 (no Arabic glyph coverage in Atkinson Hyperlegible).

---

### 2 — Load the Atkinson Hyperlegible font

**File: `frontend/index.html`** — insert after line 7 (`<title>SupportOS</title>`), before line 8 (the anti-FOUC `<script>`):

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap"
      rel="stylesheet"
    />
```

A `<link rel="stylesheet">` in `<head>` is used instead of MASTER.md's own `@import url(...)` sample (which would have to go inside `frontend/src/index.css`, where it would render-block behind the two existing `@import`s) — `<link>` lets the browser fetch the font in parallel with the app bundle, and `&display=swap` (already in the URL) ensures the existing system-font fallback in `--font-sans` renders immediately with no invisible-text flash while the web font loads.

---

### 3 — Modal corner radius

**File: `frontend/src/shared/ui/primitives/dialog.tsx`** line 65 — change `rounded-lg` to `rounded-xl` in the content wrapper's class string (leave every other class on that line unchanged).

**File: `frontend/src/shared/ui/primitives/alert-dialog.tsx`** line 57 — the same change, same reason: both are modal-content wrappers and must stay visually consistent with each other.

Do **not** touch `frontend/src/shared/ui/primitives/alert.tsx` line 7 or `tabs.tsx` line 28 — both also use `rounded-lg`, but neither is a button, input, card, or modal (the only four component roles MASTER.md's Component Specs section defines radii for); changing them would be inventing a fifth mapping with no source to justify it.

---

### 4 — Mark `CONVENTIONS.md` § 25's decisions resolved

**File: `CONVENTIONS.md`** — in the token reconciliation table (lines 1441-1450), update the **Decision** and **Reason** cells for the five rows this story acted on (leave the `--accent`, `--chart-*`, and `--font-arabic` rows exactly as they are):

- `--primary` / `--primary-foreground` row (line 1443): change `**Adopt in DSN-1**` to `**Adopted (Story 36)**`; append to the Reason cell: `Shipped as \`oklch(0.546 0.215 262.881)\` in both \`:root\` and \`.dark\` (frontend/src/index.css) — see Story 36 for the light/dark-parity rationale.`
- `--secondary` / `--secondary-foreground` row (line 1444): change `**Defer**` to `**Adopted (Story 36) — filled treatment**`; replace the Reason cell with: `Resolved by reading \`button.tsx\`: this codebase already has a separate \`outline\` variant distinct from \`secondary\` (line 15-16), so MASTER.md's outline \`.btn-secondary\` sample describes that variant, not this token — the color-table pairing (\`#64748B\`/\`#FFFFFF\`) applies cleanly to \`--secondary\`/\`--secondary-foreground\` with no conflict. Shipped as \`oklch(0.554 0.041 257.417)\` / \`oklch(1 0 0)\`, same value in both themes.`
- `--destructive` row (line 1446): change `**Adopt in DSN-1**` to `**Adopted (Story 36)**`; append: `Shipped as \`oklch(0.577 0.215 27.325)\` in both \`:root\` and \`.dark\` — verified 9.46:1 white-text contrast against the existing \`dark:bg-destructive/60\` treatment (\`button.tsx\` line 14).`
- `--font-sans` row (line 1448): change `**Adopt in DSN-1, English UI only**` to `**Adopted (Story 36), English UI only**`; append: `Loaded via \`<link>\` in \`frontend/index.html\` (not a CSS \`@import\`), first in the \`--font-sans\` fallback chain.`
- `--radius` row (line 1450): change `**Defer**` to `**Resolved (Story 36) — component-level, not token-scale**`; replace the Reason cell with: `\`card.tsx\` (\`rounded-xl\`, 14px) and \`input.tsx\` (\`rounded-md\`, 8px) already land within 2px / exactly on MASTER.md's 12px/8px targets — no change. \`dialog.tsx\` and \`alert-dialog.tsx\` moved from \`rounded-lg\` (10px) to \`rounded-xl\` (14px), within 2px of the 16px modal target. The single derived \`--radius\` scale is unchanged; only which Tailwind radius utility two primitives use was adjusted.`

---

## Edge Cases & Failure Modes

- **The Google Font fails to load (offline dev, blocked network, ad blocker)** — `&display=swap` in the font URL (task 2) means the browser paints text immediately in the `--font-sans` fallback chain's next entry (`system-ui`) and swaps to Atkinson Hyperlegible only once/if it arrives; there is no invisible-text period and no layout-blocking failure mode to handle in code.
- **Arabic/RTL screens are completely unaffected** — `--font-arabic` (line 45) and the `html[lang='ar'] body { font-family: var(--font-arabic); }` rule (index.css lines 140-142) are untouched; switching the language toggle to Arabic must show no visual difference from before this story.
- **Hover/opacity-modifier states inherit the new colors automatically** — `hover:bg-primary/90`, `hover:bg-secondary/80` (`button.tsx`), `hover:bg-primary/90`/`hover:bg-secondary/90` (`badge.tsx`) are Tailwind opacity modifiers on the token itself, not separate hardcoded values; no additional edit is needed, but visually confirm the hover states still read as intentional darkening/lightening rather than muddiness now that the base hue is chromatic instead of grey.
- **A future change must not reintroduce a hardcoded color** — the `frontend/src/` grep for `#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(` (Prerequisites) must still return only `index.css` after this story's edits; re-run it as part of `## Verification Steps` rather than assuming it still holds.
- **`alert.tsx` and `tabs.tsx` still use `rounded-lg`, deliberately unchanged** — a future reviewer who notices dialog/alert-dialog now differ from alert/tabs should find the reasoning in `CONVENTIONS.md` § 25's updated `--radius` row (task 4) and in `## Story Goal` above, not have to re-derive it.
- **`--destructive-foreground` does not exist in this codebase** (`button.tsx`/`badge.tsx` hardcode `text-white` for the destructive variant) — this story does not introduce that token; it is out of scope ("token/style updates only, no re-architecture").
- **Any future story that edits `--chart-*` or `--accent*`** should treat them as still open (`DSN-3`, unplanned) — this story's `git diff` must show zero lines touching those tokens.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or removed.

1. No backend impact: this story touches only `frontend/` and `CONVENTIONS.md` — `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no accidental drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — none of the four files this story touches contain a physical-direction class or a new component, so `check:rtl` is expected to be a clean no-op re-run, not a new finding.
3. Manual visual verification only (this story's actual "test") — `## Verification Steps` below.

---

## Verification Steps

1. **Grep re-confirms no hardcoded color was introduced:** from the repo root, `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` returns matches only in `frontend/src/index.css`.
2. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
3. **Font loads correctly:** `npm run dev` (from `frontend/`), open the app, DevTools Network tab shows a request to `fonts.googleapis.com`/`fonts.gstatic.com` succeeding, and the page's body text visibly renders in Atkinson Hyperlegible (distinct from the prior system-font look) once loaded.
4. **Visual pass over every already-built route** (`frontend/src/app/router.tsx`): `/login`, `/chat`, `/contact`, `/` (`HealthPage`), `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/tickets`, `/tickets/new`, `/tickets/my-tickets`, `/tickets/:id`, `/tickets/:id/edit`, `/tasks`, `/tasks/new`, `/tasks/:id/edit`, and a `*` 404 route — buttons/links/status badges now render in the blue/slate/red palette instead of greyscale, in **both** light and dark theme (toggle via the existing theme switch) and in **both** English and Arabic (toggle via the existing language switch — Arabic screens must look visually identical to before this story, only the Latin-text screens change font).
5. **Contrast spot-check in the running app:** a default-variant button (`bg-primary text-primary-foreground`), a secondary-variant button/badge, and a destructive-variant button — inspect each with a browser contrast checker (e.g. DevTools' own contrast ratio readout on the text color) and confirm ≥4.5:1, matching the numbers computed in `## Prerequisites`.
6. **Dialog and Alert Dialog corners visibly match each other:** open any `Dialog` (e.g. a form modal) and any `AlertDialog` (e.g. a delete-confirmation prompt) in the app and confirm both render with the same, slightly larger corner radius than before — `Card` and `Input` corners are unchanged.
7. **`CONVENTIONS.md` § 25 reads correctly:** the five updated rows (task 4) show `Adopted (Story 36)`/`Resolved (Story 36)` — no row is left saying `Adopt in DSN-1` or `Defer` for a decision this story actually made; `--accent`, `--font-arabic`, and `--chart-*` rows are untouched.
8. **No regression outside scope:** `git diff --stat` shows changes confined to `frontend/src/index.css`, `frontend/index.html`, `frontend/src/shared/ui/primitives/dialog.tsx`, `frontend/src/shared/ui/primitives/alert-dialog.tsx`, and `CONVENTIONS.md` — nothing under `backend/`, no other primitive, no feature-level component.

---

## Done Criteria

- [ ] `frontend/src/index.css` — `--primary`/`--primary-foreground`, `--secondary`/`--secondary-foreground`, `--destructive` updated in both `:root` and `.dark` to the same DSN-derived oklch values; `--font-sans` gains `'Atkinson Hyperlegible'` as its first entry; `--accent`, `--font-arabic`, `--chart-1..5`, `--radius` untouched.
- [ ] `frontend/index.html` — Google Fonts `preconnect` + `stylesheet` `<link>` tags added after `<title>`.
- [ ] `frontend/src/shared/ui/primitives/dialog.tsx` line 65 and `alert-dialog.tsx` line 57 — `rounded-lg` → `rounded-xl`; `card.tsx`, `input.tsx`, `alert.tsx`, `tabs.tsx` untouched.
- [ ] `CONVENTIONS.md` § 25 — the five resolved rows (`--primary`, `--secondary`, `--destructive`, `--font-sans`, `--radius`) updated per task 4; other rows unchanged.
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(" frontend/src` still matches only `index.css`.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) all exit 0.
- [ ] Visual pass complete across every route in `frontend/src/app/router.tsx`, in both themes and both languages, with contrast spot-checked ≥4.5:1 on default/secondary/destructive buttons.
- [ ] `python manage.py test` (from `backend/`) unaffected — no backend file changed.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** This unblocks nothing further by itself — `DSN-2` (UX Guidelines & Accessibility Audit) and `DSN-3` (Dashboard Chart Design Guidance) both depend only on `DSN-0` (already complete), not on this story, and remain unplanned pending their own intake.
