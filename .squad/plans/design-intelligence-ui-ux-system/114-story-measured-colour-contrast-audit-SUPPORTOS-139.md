# Story 114 — (DSN-17) Measured Colour & Contrast Audit (Light + Dark) (Story: SUPPORTOS-139)

## Prerequisites

- **`DSN-4` (Story 50), `DSN-5` (Story 51), `DSN-2` (Story 37) are implemented** — they chose the palette, the dark theme, and produced accessibility guidelines respectively, but (per this story's own intake) never *measured* the shipped tokens pair by pair.
- **`bugs/101` (`.squad/plans/bugs/101-story-link-contrast-tokens.md`) is implemented** — verified directly in `frontend/src/index.css` (lines 50-57, 119-128) and `frontend/src/shared/branding/contrast.ts`. It fixed exactly the two measured failures named in `QA-REPORT-1.md` (F-5/F-6): `--primary` used as text failed AA in dark mode (3.28:1/3.69:1) and an org-supplied brand colour had no bound in the text direction. Its fix — a `--primary-text` token, split from the `--primary` fill token, resolved via `var(--brand-text-light|dark, …)` so `shared/branding/` can override it per-org — is the exact mechanism this story's own intake says to "extend... to any other token the matrix condemns rather than inventing a second mechanism." Its own `## Scope boundary with DSN-17` section draws the line this plan respects: bugs/101 fixed F-5/F-6 only; this story measures **everything else** and must not duplicate it.
- **`shared/branding/contrast.ts` already exports `relativeLuminance`-based building blocks** (`foregroundFor`, `brandTextFor`, plus private `contrastRatio`/`mix`/`readableOn`) — all **hex**-based, since branding always deals in an admin-supplied hex. This story's own measurement work is **oklch**-based (the tokens in `index.css`), so it does not import from `contrast.ts` — see `## Context` item 6 for why a second, self-contained conversion is the right call here, not a gap.
- **No backend change is required for "validate `primary_color` server-side."** `backend/apps/organization/models.py:14-17`'s `HEX_COLOR_VALIDATOR` (`^#(?:[0-9a-fA-F]{6})$`, exactly six hex digits, no shorthand, no alpha) is already the complete validation this field needs — it is what makes `shared/branding/contrast.ts`'s hex-slicing safe, and legibility itself is guaranteed by `brandTextFor()`'s blend-toward-white/black algorithm, which **always converges** (its own doc comment: "Unreachable in practice — `toward` is pure white or black, which clears AA against every surface of its opposite theme"). There is no hex value `HEX_COLOR_VALIDATOR` currently accepts that can produce an illegible app — verified, not assumed. This story's "bound the org-supplied brand colour" task is therefore a **frontend warning**, not a new backend constraint.

---

## Story Goal

**A complete, measured contrast matrix for every semantic token pair in both themes — computed via a real oklch→sRGB→WCAG-luminance conversion, not eyeballed** (see `## Product rules` for the full table). Two genuine, previously-unmeasured failures were found and are fixed at token level; everything else the matrix covers already passes and is recorded as such, not re-touched.

1. **`--secondary` used as text fails AA in dark mode** (3.56:1 on `--card`, 4.01:1 on `--background` — both under 4.5:1), exactly as the intake states, verified independently. **No current call site uses `text-secondary` as body text** (`grep -rn "text-secondary\b" frontend/src` returns only `bg-secondary text-secondary-foreground` fill usage in `badge.tsx`/`button.tsx`) — so this is a real token-level defect with zero live call sites to migrate, unlike `--primary-text`'s 14. A `--secondary-text` token is added anyway, per the intake's own explicit instruction to extend `--primary-text`'s mechanism to "any other token the matrix condemns."
2. **A second, previously-unmeasured failure the intake did not name: every interactive control's resting-state border fails WCAG 1.4.11's 3:1 non-text/UI-boundary threshold in both themes.** `Input`, `SelectTrigger`, `Checkbox`, and `RadioGroupItem` all render `border-input` with no distinguishing fill in their unchecked/resting state (`bg-transparent` in light; a translucent `bg-input/30` wash in dark that is itself nearly indistinguishable from the page) — so the border is each control's **sole** visual boundary, which is exactly what 1.4.11 requires 3:1 for. Measured: light `--input` (currently mirroring `--border`, `#E2E8F0`) on `--background` is **1.18:1**; dark (a 10%-white-alpha overlay) composites to roughly **1.3:1**. `--border` itself (Card outlines, `TableRow` dividers, the `SelectContent` popover's own border) is **not** touched — each of those has its own distinct fill (`bg-card`/`bg-popover`) providing the boundary cue by another means, or is purely decorative grouping, so 1.4.11 does not apply there. A new `--input-border` token gives the two roles (fill vs. resting-state boundary) `--input` was quietly serving at once their own values — the same "split the token, don't compromise one value for two jobs" principle `bugs/101` already established for `--primary`.
3. **The org-supplied brand colour is bounded going forward, not just fixed for the shipped default.** `shared/branding/contrast.ts`'s `brandTextFor()` already guarantees a legible result; what is missing is telling the admin **when** their exact colour needed adjusting. `OrganizationSettings`'s existing live preview gains a warning, reusing `brandTextFor()` with no new derivation logic.
4. **A standing `npm run check:contrast` gate**, matching `check:rtl`'s exact shape (a dependency-free Node script, wired into the same CI job), so a future token edit that reintroduces a failure is caught before merge instead of measured again by hand.

**Everything else the matrix covers already passes and needs no change** (see the "Verdict" column in `## Product rules`): `--foreground`/`--muted-foreground` in both themes; `--primary`/`--secondary`/`--success`/`--warning`/`--info`/`--destructive` as **fills** against their own `-foreground` partner; `--primary-text` (both themes, `bugs/101`'s own fix); `--ring` as a non-text boundary (already ≥3:1 in both themes, per Story 51's own verification, reconfirmed here).

---

## Context — Read These Files First

1. `frontend/src/index.css` lines 40-103 (`:root`) and 105-163 (`.dark`) — every token this story measures or edits. Note the established comment convention (`--success-foreground`'s `/* 6.37:1, verified */`) this story extends to every token, and `--primary-text`'s existing triad shape (lines 50-57, 119-128) — the exact pattern `--secondary-text` copies, minus the brand-override indirection (only `--primary` is org-overridable; `--secondary` is not, so `--secondary-text` needs no `var(--brand-text-*, …)` hook).
2. `frontend/src/index.css` lines 77-83 (`:root`'s `--border`/`--input`/`--ring`) and 142-149 (`.dark`'s, with the comment explaining `--border`/`--input` are alpha-over-background overlays, "already recompose correctly... with no edit needed" — true for `--border`, and this story's own finding is that it was never actually true for `--input`'s *border* role). Lines 188-190 in `@theme inline` map `--color-border`/`--color-input`/`--color-ring` — the insertion point for the new `--color-input-border` mapping.
3. `frontend/src/shared/ui/primitives/input.tsx` line 11, `select.tsx` line 37, `checkbox.tsx` line 12, `radio-group.tsx` line 28 — all four already use `border-input` as their **sole** resting-state boundary (`bg-transparent` or no background at all until checked). `frontend/src/shared/ui/primitives/button.tsx` line 17 — the `outline` variant's **light**-mode treatment (`border bg-background`, no fill distinct from the page) is wired to plain `--border`, not `--input`, even though its own **dark**-mode treatment on the same line (`dark:border-input dark:bg-input/30`) already correctly reaches for the input-boundary token. This is an existing internal inconsistency this story's Task 2 also closes.
4. `frontend/src/shared/ui/primitives/select.tsx` line 62 (`SelectContent`, plain `border` — has its own `bg-popover` fill, correctly exempt) and `frontend/src/shared/ui/primitives/card.tsx` line 10 (`Card`, plain `border` — has its own `bg-card` fill, correctly exempt) and `frontend/src/shared/ui/primitives/table.tsx` line 49 (`TableRow`, plain `border-b` divider — decorative grouping, not a UI-component boundary, correctly exempt). Confirms which consumers of `--border` are **not** in scope for a value change.
5. `frontend/src/shared/branding/contrast.ts` (full file, 94 lines) — `relativeLuminance`, `contrastRatio` (private), `mix`, `readableOn`, and the two exported functions `foregroundFor`/`brandTextFor`. Task 3 calls `brandTextFor` from `SettingsPage.tsx`; nothing in this file is edited.
6. **Why this story's own measurement tooling does not import `contrast.ts`:** that module's functions are hex-only (branding always starts from an admin-supplied hex) and it lives in `frontend/src/`, which is bundled by Vite/TypeScript — a plain `node scripts/*.mjs` script (this story's Task 4) cannot `import` a `.ts` file without adding a TypeScript execution toolchain, which the intake explicitly forbids ("no new toolchain"). `index.css`'s tokens are also **oklch**, not hex, requiring an oklch→sRGB conversion `contrast.ts` has never needed. `scripts/check-contrast.mjs` therefore duplicates the ~10-line WCAG relative-luminance formula in plain JS, the same self-contained, no-dependency shape `scripts/check-rtl.mjs` already has — not a code-reuse gap, a deliberate runtime boundary.
7. `frontend/src/features/organization/components/SettingsPage.tsx` lines 100-179 — the existing `primaryColorDraft` live preview (a swatch + a save-button preview using `foregroundFor()`, i.e. the *fill* direction). Task 3's insertion point is directly after this block.
8. `backend/apps/organization/models.py` lines 8-17 (`HEX_COLOR_VALIDATOR`) and lines 258-263 (`primary_color` field) — confirms the validator's exact regex and that it is unchanged by this story.
9. `frontend/scripts/check-rtl.mjs` (full file, ~90 lines) — the structural and tonal precedent Task 4's new script matches: a `walk()`/regex/`process.exit(1)` shape, no dependency, one clear failure message format.
10. `.github/workflows/lint.yml` lines 32-52 — the `frontend` CI job Task 4 adds one step to, in the same position `check:rtl` already occupies (after `format:check`, before `build`).
11. `frontend/package.json`'s `"scripts"` block — `"check:rtl": "node scripts/check-rtl.mjs"` is the exact naming/invocation pattern `"check:contrast"` matches.

---

## Product rules — the measured matrix

**Method:** every token's `oklch(L C H)` declaration in `frontend/src/index.css` converted to sRGB hex via the standard OKLab→linear-sRGB→gamma-encoded-sRGB transform, then WCAG 2.x relative luminance and contrast ratio computed per w3.org/TR/WCAG21/#dfn-relative-luminance. Cross-checked against every ratio this codebase already claims in a comment (`--success-foreground` 6.37:1, `--primary-text` dark 5.79:1/6.52:1, `--ring` dark 4.03:1/3.57:1, `--ring` light 7.24:1) — **all matched exactly**, confirming the conversion.

**Text pairs (AA body text: 4.5:1):**

| Token (as text) | Light on `background`/`card`/`muted` | Dark on `background`/`card`/`muted` | Verdict |
|---|---|---|---|
| `--foreground` | 13.98 / 14.63 / 12.64 | 17.02 / 15.10 / 13.04 | ✅ both, no change |
| `--muted-foreground` | 7.24 / 7.58 / 6.55 | 7.68 / 6.81 / 5.88 | ✅ both, no change |
| `--primary-text` (`bugs/101`) | 4.94 / 5.17 / — | 6.52 / 5.79 / — | ✅ both, no change (fixed by `bugs/101`) |
| `--secondary` (as text — no live call site) | 4.55 / 4.76 / 4.11 | 4.01 / 3.56 / 3.07 | ❌ **dark fails on all three; light fails on `muted` only** — fixed by Task 1's new `--secondary-text` |

**Fill + its own `-foreground` (AA body text: 4.5:1 — button/badge label size, not large-text-exempt):**

| Fill | Foreground | Light ratio | Dark ratio | Verdict |
|---|---|---|---|---|
| `--primary` | `--primary-foreground` (white) | 5.17 | 5.17 (same hex both themes) | ✅ |
| `--secondary` | `--secondary-foreground` (white) | 4.76 | 4.76 | ✅ |
| `--destructive` | literal `text-white` (`button.tsx:14`, not a token) | 4.83 | 4.83 (same hex; dark's `dark:bg-destructive/60` button treatment measures separately and higher — not a token-pair concern) | ✅ |
| `--success` | `--success-foreground` (black) | 6.37 | 6.37 | ✅ (already commented) |
| `--warning` | `--warning-foreground` (black) | 6.59 | 6.59 | ✅ (already commented) |
| `--info` | `--info-foreground` (black) | 5.13 | 5.13 | ✅ (already commented) |

**Non-text / UI-boundary pairs (WCAG 1.4.11: 3:1, only where the border is the sole boundary cue):**

| Token | Consumer | Light on `background` | Dark on `background`/`card` | Verdict |
|---|---|---|---|---|
| `--ring` (focus indicator) | every `focus-visible:ring-*` | 7.24 | 4.03 / 3.57 | ✅ both, no change (Story 51's own verification, reconfirmed) |
| `--input` (resting-state control border) | `Input`, `SelectTrigger`, `Checkbox`, `RadioGroupItem`, `button.tsx`'s `outline` variant (light-mode gap, see `## Context` item 3) | **1.18** | **≈1.3** (10%-white-alpha composite) | ❌ **fails in both themes** — fixed by Task 1's new `--input-border` |
| `--border` (decorative: `Card`, `TableRow`, `SelectContent`) | has its own distinct fill (`bg-card`/`bg-popover`) or is non-interactive grouping | 1.18 | ≈1.3 | **N/A — 1.4.11 does not apply**; not changed |

---

## Frontend Tasks

### 1 — Two new tokens in `frontend/src/index.css`

**`--secondary-text`** — in `:root`, beside `--secondary` (after line 59):

```css
  /* The dark palette's neutral slate used AS TEXT. No brand-override hook
     (unlike --primary-text) — --secondary is not org-configurable.
     Light mode needs no change: --secondary already measures 4.55:1 on
     --background and 4.76:1 on --card (DSN-17, Story 114). */
  --secondary-text: oklch(0.554 0.041 257.417); /* = --secondary; 4.55:1 on background, 4.76:1 on card, verified */
```

In `.dark`, beside `--secondary` (after line 130):

```css
  /* NOT "same as :root" — --secondary as text measures 4.01:1 on
     --background and 3.56:1 on --card, both under AA's 4.5:1 (DSN-17,
     Story 114). No current call site uses `text-secondary` as body text
     (verified: `grep -rn "text-secondary\b" frontend/src` returns only
     fill usage) — added pre-emptively, extending `bugs/101`'s
     `--primary-text` mechanism to the next token the matrix condemned, per
     that story's own instruction. Lightened at the same hue, chroma
     unchanged (still in gamut): oklch(0.65 0.041 257.417) = #8090A9 —
     5.89:1 on --card and 5.23:1 on --background, both verified. */
  --secondary-text: oklch(0.65 0.041 257.417);
```

**`--input-border`** — in `:root`, beside `--input` (after line 80):

```css
  /* `--input` (above) is a FILL — the translucent `bg-input/30`/`bg-input/50`
     wash behind an input/select in dark mode. This is its own, separate
     role: the BORDER colour of a control whose resting state has no fill
     distinct from the page (`Input`, `SelectTrigger`, `Checkbox`,
     `RadioGroupItem` all render `bg-transparent` until checked/focused),
     making the border their sole boundary cue — WCAG 1.4.11 requires 3:1
     for exactly this case. Measured: mirroring `--border`'s value (as it
     did before this token existed) reached only 1.18:1 against
     `--background`. Same hue family as `--foreground`/`--ring` (257°),
     darkened until AA's non-text 3:1 clears with margin (DSN-17,
     Story 114). */
  --input-border: oklch(0.65 0.02 257); /* #88909C — 3.08:1 on background, 3.22:1 on card, verified */
```

In `.dark`, beside `--input` (after line 148):

```css
  /* Same split as :root — --input stays the translucent fill; this is its
     border-only counterpart. A FIXED value, not an alpha overlay: an
     alpha-over-background composite's effective contrast depends on
     whatever is behind it, which is how the 10%-white overlay silently
     drifted to ≈1.3:1 against both `--background` and `--card` without
     anyone measuring it — a fixed hex lets 3:1 be verified once and stay
     true regardless of what the token composites over. Same 257° hue
     family, lightened until 3:1 clears both surfaces (DSN-17, Story 114). */
  --input-border: oklch(0.52 0.02 257); /* #626A75 — 3.49:1 on background, 3.09:1 on card, verified */
```

**File: `frontend/src/index.css`** `@theme inline` block — add both mappings beside their existing siblings:

```diff
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
+ --color-secondary-text: var(--secondary-text);
```

```diff
  --color-border: var(--border);
  --color-input: var(--input);
+ --color-input-border: var(--input-border);
  --color-ring: var(--ring);
```

This generates `text-secondary-text` and `border-input-border` (plus unused `bg-input-border`/etc., harmless — Tailwind only emits utilities a class actually requests). Verbose naming, matching `--primary-text`/`text-primary-text`'s own precedent (`bugs/101`): "preserves the file's 1:1 token→utility naming; do not invent a shorter alias."

---

### 2 — Point the four interactive-control primitives, and `Button`'s outline variant, at `--input-border`

**File: `frontend/src/shared/ui/primitives/input.tsx`** line 11 — `border-input` → `border-input-border`.

**File: `frontend/src/shared/ui/primitives/select.tsx`** line 37 (`SelectTrigger` only — **not** line 62's `SelectContent`, which keeps plain `border`, see `## Context` item 4) — `border-input` → `border-input-border`.

**File: `frontend/src/shared/ui/primitives/checkbox.tsx`** line 12 — `border-input` → `border-input-border`.

**File: `frontend/src/shared/ui/primitives/radio-group.tsx`** line 28 — `border-input` → `border-input-border`.

**File: `frontend/src/shared/ui/primitives/button.tsx`** line 17, the `outline` variant — both the light- and dark-mode border now reach for the same token, closing the internal inconsistency `## Context` item 3 names (the dark half already correctly used the input-boundary role; the light half did not):

```diff
- outline:
-   'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
+ outline:
+   'border-input-border border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50',
```

`dark:border-input` is dropped entirely (not replaced with `dark:border-input-border`) — `border-input-border` alone, unconditional on theme, already resolves to the correct per-theme value via `:root`/`.dark`, the same way every other token-driven class in this file works; a `dark:`-prefixed duplicate would be redundant, not more correct.

**Not touched:** `card.tsx`, `select.tsx`'s `SelectContent` (line 62), `table.tsx`'s `TableRow` (line 49) — each keeps plain `border` (`--border`), per `## Product rules`' "N/A" verdict. `Switch`'s track (`border-transparent`, no visible border at all) is also untouched — nothing to fix.

---

### 3 — Warn the admin when their brand colour needed adjusting

**File: `frontend/src/features/organization/components/SettingsPage.tsx`** — extend the import and add a warning directly after the existing preview block (after line 179):

```diff
- import { foregroundFor } from '@/shared/branding/contrast'
+ import { brandTextFor, foregroundFor } from '@/shared/branding/contrast'
```

```tsx
{HEX_COLOR_RE.test(primaryColorDraft)
  ? (() => {
      const derived = brandTextFor(primaryColorDraft)
      const needsLight = derived.light !== primaryColorDraft
      const needsDark = derived.dark !== primaryColorDraft
      if (!needsLight && !needsDark) return null
      return (
        <p role="status" className="text-sm text-muted-foreground">
          {needsLight && needsDark
            ? t('settings.colorAdjustedBoth', { light: derived.light, dark: derived.dark })
            : needsLight
              ? t('settings.colorAdjustedLight', { light: derived.light })
              : t('settings.colorAdjustedDark', { dark: derived.dark })}
        </p>
      )
    })()
  : null}
```

Placed as a sibling immediately after the existing `role="group"` preview `<div>` (still inside the same `HEX_COLOR_RE.test(primaryColorDraft) ? (...) : null` conditional structure — wrap both in a fragment). **No new derivation logic** — `brandTextFor()` already exists and already runs this exact comparison internally (`readableOn`'s own "returns `hex` unchanged when it already passes" contract); this task only surfaces its result as UI copy, per the intake's "no new mechanism" instruction.

Add to `frontend/src/features/organization/locales/en.json`/`ar.json`, beside the existing `settings.colorHint`/`settings.colorPreview` keys:

- `settings.colorAdjustedLight`: `"In light mode, this colour will render as {{light}} for text to stay readable."`
- `settings.colorAdjustedDark`: `"In dark mode, this colour will render as {{dark}} for text to stay readable."`
- `settings.colorAdjustedBoth`: `"This colour will render as {{light}} in light mode and {{dark}} in dark mode for text to stay readable."`

**`foregroundFor()`'s existing button-label preview is untouched** — this task adds a second, independent piece of information (the text-legibility direction), it does not change the fill-legibility preview already there.

---

## Backend Tasks

**No backend changes required.** `HEX_COLOR_VALIDATOR` (`backend/apps/organization/models.py:14-17`) already fully validates the format `brandTextFor()`'s hex parsing needs, and legibility itself is guaranteed by the blend algorithm, not by a validation gate — see `## Prerequisites`. `git status --short backend/` must be empty at the end of this story.

---

### 4 — A standing contrast check

**Create file: `frontend/scripts/check-contrast.mjs`**:

```js
// Fails the build if a measured token pair drops below its WCAG threshold.
// The rule this enforces is CONVENTIONS.md's DSN-17 entry; a plain Node
// script, not a lint rule, because oxlint cannot compute colour maths, and
// self-contained (no import from src/shared/branding/contrast.ts) because
// that module is hex-only and this script must read index.css's oklch
// tokens directly without a TypeScript toolchain — see the plan's own
// `## Context` item 6.
import { readFileSync } from 'node:fs'

const CSS_PATH = 'src/index.css'
const AA_TEXT_RATIO = 4.5
const AA_NONTEXT_RATIO = 3

function oklchToHex(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b
  const ll = l_ ** 3
  const mm = m_ ** 3
  const ss = s_ ** 3
  const r = 4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss
  const g = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss
  const bl = -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss
  const enc = (v) => {
    const c2 = Math.min(1, Math.max(0, v))
    return c2 <= 0.0031308 ? 12.92 * c2 : 1.055 * Math.pow(c2, 1 / 2.4) - 0.055
  }
  const toHex = (v) =>
    Math.round(enc(v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function relativeLuminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Extracts `--token: oklch(L C H);` pairs from one `{ ... }` block. Skips
 * alpha-form values (`oklch(1 0 0 / 10%)`) deliberately — `--border`/
 * `--input`'s alpha-overlay role is a FILL, not a checked pair here. */
function parseTokens(block) {
  const tokens = {}
  const re = /--([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g
  let match
  while ((match = re.exec(block))) {
    const [, name, l, c, h] = match
    tokens[name] = oklchToHex(Number(l), Number(c), Number(h))
  }
  return tokens
}

const css = readFileSync(CSS_PATH, 'utf8')
const rootMatch = css.match(/:root\s*{([\s\S]*?)\n}/)
const darkMatch = css.match(/\.dark\s*{([\s\S]*?)\n}/)
if (!rootMatch || !darkMatch) {
  console.error('check:contrast — could not locate :root/.dark blocks in index.css.')
  process.exit(1)
}

const light = parseTokens(rootMatch[1])
const dark = parseTokens(darkMatch[1])

const TEXT_PAIRS = [
  ['foreground', ['background', 'card', 'muted']],
  ['muted-foreground', ['background', 'card', 'muted']],
  ['primary-text', ['background', 'card']],
  ['secondary-text', ['background', 'card']],
]

const FILL_PAIRS = [
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['success', 'success-foreground'],
  ['warning', 'warning-foreground'],
  ['info', 'info-foreground'],
]

const NONTEXT_PAIRS = [
  ['ring', ['background', 'card']],
  ['input-border', ['background', 'card']],
]

let failures = 0

function check(theme, tokens, name, surfaceName, ratio, threshold) {
  if (ratio < threshold) {
    failures += 1
    console.log(
      `${theme} --${name} on --${surfaceName}: ${ratio.toFixed(2)}:1 (needs ${threshold}:1)`,
    )
  }
}

for (const [theme, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [name, surfaces] of TEXT_PAIRS) {
    if (!tokens[name]) continue
    for (const surface of surfaces) {
      if (!tokens[surface]) continue
      check(theme, tokens, name, surface, contrastRatio(tokens[name], tokens[surface]), AA_TEXT_RATIO)
    }
  }
  for (const [fill, fg] of FILL_PAIRS) {
    if (!tokens[fill] || !tokens[fg]) continue
    check(theme, tokens, `${fill}+${fg}`, fill, contrastRatio(tokens[fg], tokens[fill]), AA_TEXT_RATIO)
  }
  for (const [name, surfaces] of NONTEXT_PAIRS) {
    if (!tokens[name]) continue
    for (const surface of surfaces) {
      if (!tokens[surface]) continue
      check(
        theme,
        tokens,
        name,
        surface,
        contrastRatio(tokens[name], tokens[surface]),
        AA_NONTEXT_RATIO,
      )
    }
  }
}

if (failures > 0) {
  console.log(
    `\n${failures} contrast ${failures === 1 ? 'failure' : 'failures'} found. See CONVENTIONS.md's DSN-17 entry.`,
  )
  process.exit(1)
}
console.log('check:contrast — every measured token pair clears its AA threshold.')
```

**File: `frontend/package.json`** — add beside the existing `"check:rtl"` entry:

```diff
    "check:rtl": "node scripts/check-rtl.mjs",
+   "check:contrast": "node scripts/check-contrast.mjs"
```

**File: `.github/workflows/lint.yml`** — add one step to the `frontend` job, in the same position `check:rtl` occupies:

```diff
      - name: check:rtl (logical CSS properties)
        run: npm run check:rtl
+     - name: check:contrast (WCAG token pairs)
+       run: npm run check:contrast
      - name: build (typechecks via tsc -b)
        run: npm run build
```

---

## Documentation Task

### 5 — Record the audit in `CONVENTIONS.md`

**File: `CONVENTIONS.md`** — add a new subsection to § 25, after `### Motion completion & micro-interaction craft (\`DSN-16\`, Story 113)` and before `## 26.`:

```markdown
### Measured colour & contrast audit (`DSN-17`, Story 114)

Every semantic token pair in both themes, measured by a real oklch→sRGB→WCAG
conversion (`frontend/scripts/check-contrast.mjs`), not eyeballed — see that
script and this story's own plan file for the full matrix. Two genuine
failures were found beyond the two `bugs/101` already fixed (`--primary` as
text):

- **`--secondary` used as text failed AA in dark mode** (3.56:1 on `--card`)
  and on `--muted` in light mode (4.11:1) — no current call site renders it
  as body text, but a `--secondary-text` token was added anyway, extending
  `--primary-text`'s split-the-token mechanism per this story's own
  instruction, not waiting for a defect to land first.
- **Every interactive control's resting-state border failed WCAG 1.4.11's
  3:1 non-text/UI-boundary threshold in both themes** (`--input`, mirroring
  `--border`'s subtle value, measured ~1.2-1.3:1) — `Input`/`SelectTrigger`/
  `Checkbox`/`RadioGroupItem` all rely on that border alone in their resting
  state. A new `--input-border` token (separate from `--input`'s existing
  translucent-fill role) fixes this; `--border` itself is unchanged — every
  one of its consumers (`Card`, `TableRow`, `SelectContent`) has its own
  distinct fill or is non-interactive, so 1.4.11 does not apply to it.

`--foreground`/`--muted-foreground`/`--ring`/`--primary-text` (both themes)
and every fill+its-own-foreground pair already passed and needed no change.

The org-supplied brand colour (`shared/branding/`) already always resolves
legible via `brandTextFor()`'s blend algorithm (`bugs/101`) — this story
adds a warning in Organization Settings surfacing *when* an admin's exact
colour needed adjusting, reusing that same function with no new derivation.

`npm run check:contrast` (wired into `.github/workflows/lint.yml` beside
`check:rtl`) now gates every future token edit against the same matrix.
```

---

## Edge Cases & Failure Modes

- **`--input-border`'s value is a fixed hex, not an alpha overlay, unlike the `--border`/`--input` convention Story 51 established.** This is deliberate, not an inconsistency to "fix": an alpha-over-background composite's effective contrast depends on whatever is behind it, which is exactly how the 10%-white overlay silently reached an unmeasured ~1.3:1 in the first place. A token that must clear a specific, verifiable ratio needs a value whose contrast does not depend on context.
- **`border-input-border` looks like a typo to a future reader** (`border-input` minus the `-border` reads like the thing it replaced). The token's own `index.css` comment is what explains the split; do not "simplify" it back to `border-input` and silently reintroduce the 1.18:1 boundary.
- **`--secondary-text` has no known consumer today.** If a future screen adopts `text-secondary-text`, it is already correct in both themes. If one never does, the token costs nothing (Tailwind emits no CSS for an unused utility) — this is not dead code to prune.
- **`button.tsx`'s `outline` variant's `dark:border-input` removal.** Verify the class list still resolves the same computed dark-mode border colour as before this story (via `border-input-border`, now unconditional rather than `dark:`-prefixed) — a visual regression check, not a logic risk, since `border-input-border` already carries the correct per-theme value via `:root`/`.dark`.
- **`SettingsPage.tsx`'s new warning and the existing preview can both be visible at once** (a brand colour that passes as a fill/button-label but needs adjusting as text, or vice versa) — this is expected; they answer two different questions (fill-legibility vs. text-legibility) and are not mutually exclusive.
- **`check-contrast.mjs`'s regex skips any token not in plain `oklch(L C H)` form** (alpha-form values, `--chart-*`, `--sidebar-*`, anything not listed in `TEXT_PAIRS`/`FILL_PAIRS`/`NONTEXT_PAIRS`). This is intentional — the script checks the specific pairs this story measured, not every token in the file; a future story adding a new text/fill/boundary token must add its own pair to the three arrays, the same way a new lint rule is opted into deliberately.
- **A brand colour whose blended result happens to equal the original hex exactly** (already legible, `readableOn` returns it unchanged) correctly shows no warning in `SettingsPage.tsx` — `derived.light !== primaryColorDraft` is a plain string comparison against `brandTextFor`'s own "unchanged when already passing" contract, not a new heuristic.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or removed. `scripts/check-contrast.mjs` is a CI **gate**, not a test file, matching `scripts/check-rtl.mjs`'s own precedent.

---

## Verification Steps

1. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run check:contrast`, `npm run build` all exit 0.
2. **No backend change:** `git status --short backend/` is empty.
3. **No new dependency:** `git diff frontend/package.json frontend/package-lock.json` shows only the new `"check:contrast"` script line, no dependency section change.
4. **`check:contrast` actually catches a regression:** temporarily edit `--input-border`'s light value back to `--border`'s old value, run `npm run check:contrast`, confirm it fails and names the exact pair; revert the edit.
5. **The four primitives visibly gained a more legible resting-state border:** in light mode, an empty `Input`, an unchecked `Checkbox`, an unselected `RadioGroupItem`, a closed `SelectTrigger`, and an `outline`-variant `Button` all show a clearly visible (not near-invisible) border against the page background; repeat in dark mode.
6. **`Card`/`SelectContent`/`TableRow` are visually unchanged** — their borders still read as subtle dividers, not upgraded to the new, more-visible boundary treatment.
7. **Brand-colour warning:** in Organization Settings, enter a colour that already passes in both themes (e.g. the shipped default `#2563EB`) — no warning appears. Enter `#1E3A8A` (navy) or `#E879F9` (pink) — the appropriate light/dark/both warning appears, naming the adjusted hex(es), alongside the existing fill preview (both visible, independently).
8. **RTL:** switch to Arabic — the warning text renders correctly (a translated string, no layout concern); the four primitives' more-visible borders are direction-neutral (a border-width/colour change, not a positional one).
9. **CI wiring:** `.github/workflows/lint.yml`'s `frontend` job lists `check:contrast` as a step, in the same position as the local verification order.

---

## Done Criteria

- [ ] `--secondary-text` added to `:root`/`.dark`/`@theme inline`, each value carrying its measured ratio in a comment.
- [ ] `--input-border` added to `:root`/`.dark`/`@theme inline`, each value carrying its measured ratio in a comment; `--input`'s existing fill role untouched.
- [ ] `input.tsx`, `select.tsx` (`SelectTrigger` only), `checkbox.tsx`, `radio-group.tsx`, and `button.tsx`'s `outline` variant all use `border-input-border`; `card.tsx`, `select.tsx`'s `SelectContent`, and `table.tsx` are unchanged.
- [ ] `SettingsPage.tsx` shows a brand-colour-adjustment warning (reusing `brandTextFor()`, no new derivation) alongside the existing fill preview; new `en`/`ar` locale keys added.
- [ ] No backend file changed — `git status --short backend/` empty.
- [ ] `frontend/scripts/check-contrast.mjs` created; `"check:contrast"` added to `package.json`; the step added to `.github/workflows/lint.yml`'s `frontend` job.
- [ ] `CONVENTIONS.md` § 25 — new "Measured colour & contrast audit (`DSN-17`, Story 114)" subsection added after the `DSN-16` subsection.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run check:contrast`, `npm run build` all exit 0.
- [ ] No new dependency (`git diff frontend/package.json frontend/package-lock.json` shows only the one script line).
- [ ] Verified live per `## Verification Steps` 4-8, in both `en`/LTR and `ar`/RTL.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** With this story planned, every `DSN`/`MOTION` story named in `SupportOs backlog.MD`'s `EPIC 8` (`DSN-0` through `DSN-17`, plus `MOTION-0`) is now planned. `DSN-0` through `DSN-14`, `MOTION-0`, `DSN-15`, and `DSN-16` are implemented; this story (`DSN-17`) is planned, not yet implemented.
