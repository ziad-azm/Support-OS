# Story 101 — Link Contrast: a `--primary-text` Token, Bounded for Brand Overrides

## Prerequisites

- **Story 99 and 100 implemented:** [99-story-portal-task-idor-and-fail-open-default.md](99-story-portal-task-idor-and-fail-open-default.md), [100-story-role-grant-drift-and-sync-command.md](100-story-role-grant-drift-and-sync-command.md). Independent of both; ships after them only to keep the diffs separate.
- **Story 90 (`ORG-3`, Custom Branding) implemented:** `shared/branding/` — `branding.ts`, `contrast.ts`, `config.ts`, and the anti-FOUC block in `index.html`. This story extends all four.
- **Story 51 (`DSN-4`/`DSN-5` theme work) implemented:** the `:root`/`.dark` token blocks in `frontend/src/index.css`, including the convention of recording a **verified contrast ratio** in each token's comment.
- **Intake:** `.squad/stories/bugs/qa-report-1/intake.md`; **attachment:** `QA-REPORT-1.md` (F-5, F-6).
- **No backend change of any kind.** `git status --short backend/` must be empty at the end of this story.

---

## Scope boundary with DSN-17

`SupportOs backlog.MD` gained **DSN-17 — Measured Colour & Contrast Audit (Light + Dark)**, which overlaps this story's subject. The split is deliberate and must be respected:

| This story (bugs/101) | DSN-17 |
|---|---|
| Fixes the **two measured failures** in F-5/F-6 | Measures **every** token pair in both themes and fixes whatever else the matrix condemns |
| Adds the `--primary-text` token and the brand-override derivation | Reuses that same split for any other token that needs it |
| — | Server-side `primary_color` validation and the Organization-Settings admin warning |
| — | The CI contrast check alongside `check:rtl` |

Do not build DSN-17's audit, admin warning or CI gate here.

---

## What discovery changed

### 1. A blanket `text-primary` swap would be wrong — only 14 of 34 uses are text

`grep -rn "text-primary\b" src/` returns 34 hits. Classified by what they actually colour:

- **14 are text** and need AA's 4.5:1 — 11 inline `<Link className="font-medium text-primary underline-offset-4 hover:underline">` in feature/shared screens, plus three shared declarations: `TableLink.tsx:18`, `button.tsx:21` (`link` variant) and `badge.tsx:22` (`link` variant).
- **12 are icons** (`<SearchXIcon className="size-6 text-primary" />` and friends) — non-text UI, which AA holds to **3:1**, and `--primary` already measures 3.69:1 on the dark background. **They pass and must not change.**
- **6 are not this token at all** — `text-primary-foreground` on a `bg-primary` fill (`badge.tsx:12`, `button.tsx:13`, `checkbox.tsx:12`, `input.tsx:11`, `LiveChatWidget.tsx:165`, `PortalChatbotPage.tsx:91`), plus `radio-group.tsx:28` where `text-primary` colours the indicator dot — non-text again.
- **2 are comments** (`config.ts:17`, `TableLink.tsx:7`).

Changing all 34 would over-correct: icons would lighten for no accessibility gain and drift from the brand fill they sit beside.

### 2. The exact replacement value is computed, not chosen by eye

Verified by implementing the oklch→sRGB transform and round-tripping the existing token: `oklch(0.546 0.215 262.881)` renders exactly `#2563EB`, which confirms the maths against the file's own recorded hex.

Searching lightness at the same hue, with chroma tapered to stay in gamut:

| Candidate | Hex | dark `--card` #171D26 | dark `--background` #0A1018 |
|---|---|---|---|
| current `--primary` | `#2563EB` | **3.28:1** ❌ | **3.69:1** ❌ |
| `oklch(0.63 0.205 …)` | `#4280FF` | 4.65:1 ✅ | 5.24:1 ✅ |
| **`oklch(0.69 0.19 …)`** | **`#5A95FF`** | **5.79:1** ✅ | **6.52:1** ✅ |
| `oklch(0.75 0.191 …)` | `#6BA8FF` | 6.99:1 ✅ | 7.88:1 ✅ |

`oklch(0.69 0.19 262.881)` is chosen over the first passing value: 4.65:1 leaves almost no margin, and any later darkening of `--card` would silently push it under. **Light mode needs no new value** — `--primary` as text already measures 5.17:1 on `--card` and 4.94:1 on `--background`.

### 3. The brand override needs a per-theme value, and inline styles cannot provide one

`branding.ts`'s own comment records the constraint: *"Inline style beats both `:root` and `.dark` (a class selector on this same element), so one value covers both themes."* That is exactly what makes F-6 unfixable by writing one more inline property — a single value cannot be correct in both themes, and the theme can change at runtime without branding re-running.

**The fix is to invert it:** branding writes two *source* variables inline (`--brand-text-light`, `--brand-text-dark`), and `index.css` selects between them per theme. Inline still wins for the source values; the theme still chooses.

### 4. A dependency-free derivation is sufficient — verified against real brand colours

Rather than adding a colour library (`CONVENTIONS.md` §0/§17: check first), blend the brand colour toward white for dark mode and toward black for light mode in fixed steps until AA is met. Measured across the plausible cases, blending against the harder surface in each theme and then confirming both:

| Brand | Dark result | ratio (card/bg) | Light result | ratio (card/bg) |
|---|---|---|---|---|
| `#2563EB` default blue | `#5182EF` | 4.67 / 5.26 ✅ | `#2563EB` unchanged | 5.17 / 4.94 ✅ |
| `#1E3A8A` corporate navy | `#7284B6` | 4.59 / 5.17 ✅ | `#1E3A8A` unchanged | 10.36 / 9.90 ✅ |
| `#7A1F2B` maroon | `#AF7980` | 4.73 / 5.33 ✅ | unchanged | 10.20 / 9.75 ✅ |
| `#14532D` forest | `#668F76` | 4.64 / 5.23 ✅ | unchanged | 9.11 / 8.71 ✅ |
| `#E879F9` shipped pink | unchanged | 6.88 / 7.76 ✅ | `#A255AE` | 4.72 / 4.51 ✅ |
| `#FACC15` yellow | unchanged | 11.06 / 12.46 ✅ | `#8A700C` | 4.77 / 4.56 ✅ |
| `#111111` near-black | `#888888` | 4.78 / 5.38 ✅ | unchanged | 18.88 / 18.05 ✅ |

Every case clears AA on **both** surfaces of its theme. Blending desaturates — navy becomes a muted periwinkle in dark mode — and that is the unavoidable trade: a colour that dark **cannot** be both itself and legible on near-black. An unreadable link is the worse outcome.

---

## Story Goal

Make brand-coloured text legible in both themes, whether the colour is the shipped default or an organization's own.

1. A `--primary-text` token exists, correct per theme, and every **text** use of the brand colour consumes it.
2. Icon and fill uses keep `--primary` — they pass at 3:1 and must not drift from the fill they sit beside.
3. An org-supplied `primary_color` produces a derived, AA-clearing text colour in **both** themes, applied at boot with no flash.
4. Every new value carries its measured ratio in a comment, matching the convention `--success-foreground` already set.

---

## Context — Read These Files First

1. `frontend/src/index.css` — `:root` `--primary` at line 48; `.dark` `--primary` at line 109 (commented *"same as :root"* — the defect); the `@theme inline` block mapping `--primary` → `--color-primary` at line 154. Note the ratio-in-comment convention on `--success-foreground`.
2. `frontend/src/shared/branding/branding.ts` — `apply()` is *"the only place `--primary`/`--primary-foreground` are written"*; note `removeProperty` vs `setProperty(token, '')` and why. `BrandingCache` holds **already-resolved** CSS values so the anti-FOUC script does no colour maths.
3. `frontend/src/shared/branding/contrast.ts` — `relativeLuminance()` and `foregroundFor()`. The new derivation reuses the luminance function; **`foregroundFor()` itself must not change** — it solves the other direction (text *on* the brand) and is correct.
4. `frontend/src/shared/branding/config.ts` — `PRIMARY_TOKEN`/`PRIMARY_FOREGROUND_TOKEN` and the comment naming them *"the only two custom properties this module is allowed to write"*. That statement becomes false and must be updated with the change.
5. `frontend/index.html` lines 36-54 — the anti-FOUC block reading `supportos.branding` and setting `--primary`/`--primary-foreground`. Keys must stay in sync with `config.ts`.
6. `frontend/src/shared/ui/data-table/TableLink.tsx` — the shared table link; its doc comment names the exact class string `buttonVariants.link` uses, so the two must stay aligned.
7. Grep `text-primary\b` across `src/` and classify each hit against `## What discovery changed` item 1 before editing anything.

---

## Frontend Tasks

### 1 — Add the `--primary-text` token

**File: `frontend/src/index.css`**

In `:root`, beside `--primary`/`--primary-foreground`, completing the triad — the fill, the text *on* the fill, and the brand *as* text:

```css
  /* The brand colour used AS TEXT (links), as opposed to `--primary` (a
     fill) and `--primary-foreground` (text on that fill). Light mode needs
     no separate value: `--primary` measures 5.17:1 on --card and 4.94:1 on
     --background, both clearing AA's 4.5:1 for body text.
     `var(--brand-text-light, …)` is the hook `shared/branding` writes when
     an org supplies its own colour — see `.dark` below and branding.ts. */
  --primary-text: var(--brand-text-light, oklch(0.546 0.215 262.881));
```

In `.dark`:

```css
  /* NOT "same as :root" — that is exactly the F-5 defect. `--primary`
     (#2563EB) as text measures 3.28:1 on this theme's --card (#171D26) and
     3.69:1 on --background (#0A1018); AA body text needs 4.5:1. Lightened
     at the same hue, chroma tapered to stay in gamut:
     oklch(0.69 0.19 262.881) = #5A95FF — 5.79:1 on --card and 6.52:1 on
     --background, both verified. Chosen over the first passing value
     (#4280FF, 4.65:1) for margin: 4.65 leaves nothing if --card is ever
     darkened. `--primary` itself is UNCHANGED — it is a fill, and as a
     fill it is correct. */
  --primary-text: var(--brand-text-dark, oklch(0.69 0.19 262.881));
```

And in `@theme inline`, beside the existing `--color-primary` mapping:

```css
  --color-primary-text: var(--primary-text);
```

That generates the `text-primary-text` utility. Verbose, but it preserves the file's 1:1 token→utility naming; do not invent a shorter alias.

### 2 — Point the 14 text call sites at it

Replace `text-primary` with `text-primary-text` in exactly these, and nowhere else:

**Shared (3 — these cover every data table and every `link`-variant button/badge):**
- `shared/ui/data-table/TableLink.tsx:18`, and update its doc comment, which currently claims the class string matches `buttonVariants`' `link` variant.
- `shared/ui/primitives/button.tsx:21` — `link` variant.
- `shared/ui/primitives/badge.tsx:22` — `link` variant.

**Inline links (11):** `ForgotPasswordPage.tsx:41,102` · `LoginPage.tsx:103,121,125` · `ResetPasswordPage.tsx:56` · `SetPasswordPage.tsx:56` · `LiveChatWidget.tsx:96` · `WebFormPage.tsx:144` · `LandingSections.tsx:164,170`

**Leave every icon `text-primary` alone** — `NotFoundPage.tsx:13`, `ForgotPasswordPage.tsx:73`, `LoginPage.tsx:37`, `ResetPasswordPage.tsx:88`, `SetPasswordPage.tsx:88`, `LiveChatWidget.tsx:63,141`, `LandingHighlightFormPage.tsx:193`, `LandingSocialLinkFormPage.tsx:165`, `WebFormPage.tsx:91`, `LandingSections.tsx:121`, `radio-group.tsx:28` — and every `text-primary-foreground`.

### 3 — Derive an AA-clearing brand text colour per theme

**File: `frontend/src/shared/branding/contrast.ts`** — add, without touching `foregroundFor()`:

```ts
/** Blend `hex` toward `target` by `t` (0-1) in sRGB. */
function mix(hex: string, target: string, t: number): string

/** The smallest blend of `hex` toward `toward` that reaches `ratio` against
 * BOTH surfaces. Returns `hex` unchanged when it already passes. */
function readableOn(hex, surfaces: readonly string[], toward: string): string

/** The brand colour made legible AS TEXT in each theme. Blends toward white
 * for dark, black for light — verified to clear 4.5:1 on both surfaces of
 * each theme for every brand colour tested (Story 101). */
export function brandTextFor(hex: string): { light: string; dark: string }
```

Surfaces are the four already in `index.css`: dark `#0A1018`/`#171D26`, light `#F8FAFC`/`#FFFFFF`. Put them in `config.ts` as named constants, not literals in the algorithm.

Blend in fixed steps (40 is ample — it converged in every measured case) and **always verify against both surfaces**, not just the harder one; the "harder" surface differs by which end you blend toward.

**File: `frontend/src/shared/branding/config.ts`** — add `BRAND_TEXT_LIGHT_TOKEN = '--brand-text-light'` and `BRAND_TEXT_DARK_TOKEN = '--brand-text-dark'`, plus the surface constants. **Correct the comment** that says only two custom properties are written — it is now four.

**File: `frontend/src/shared/branding/branding.ts`** — in `apply()`, set both new tokens alongside the existing two, and `removeProperty` both on the no-colour path. Extend `BrandingCache` with the two resolved values (`brandTextLight`, `brandTextDark`) and its type guard, so the anti-FOUC script still does zero colour maths.

**File: `frontend/index.html`** — extend the anti-FOUC block to apply the two cached values. Without this, a branded org gets one frame of unreadable links on every cold load — the exact flash the block exists to prevent.

**A stale cache must not break the page.** The type guard rejects a cache missing the new keys, which falls back to `EMPTY_BRANDING` and the CSS defaults. Confirm that path rather than assuming it.

---

## Backend Tasks

**No backend changes required.** `primary_color` validation and the admin-facing warning are DSN-17's, not this story's — see `## Scope boundary with DSN-17`.

---

## Edge Cases & Failure Modes

- **A stale `supportos.branding` cache** written before this story lacks `brandTextLight`/`brandTextDark`. `isBrandingCache` must reject it, yielding `EMPTY_BRANDING` and the CSS defaults — degraded to default branding for one load, never a crash or an unstyled page. The next `setBranding` rewrites it.
- **`primary_color` is blank** (the common case — most orgs set none). `apply()` takes the `removeProperty` path for all four tokens, `var(--brand-text-*, …)` falls back to the CSS default, and nothing changes from today.
- **A brand colour that already passes** in a theme returns unchanged from `readableOn` at `t=0` — verified for pink in dark and navy in light. No gratuitous shifting of a colour that was already fine.
- **A brand colour that cannot pass without becoming grey** (near-black `#111111` → `#888888` in dark). Legible, and visibly not the brand. That is the correct trade and DSN-17's admin warning is where the org gets told; this story must not silently refuse the colour.
- **Theme switched at runtime.** No JS runs: `--primary-text` resolves through `.dark`, which selects the right source variable. This is the whole reason for the two-variable design and must be verified by toggling the theme with a brand colour set.
- **Icons beside links.** After task 2 an icon (`--primary`) and a link (`--primary-text`) sit adjacent in dark mode at visibly different lightness — e.g. `LoginPage.tsx:37` versus `:103`. This is intended: 3:1 for the icon, 4.5:1 for the text. Confirm it reads as deliberate rather than broken; if it does not, the fix belongs in DSN-17's systematic pass, not here.
- **`text-primary-text` looks like a typo** to a future reader. The token comment in `index.css` is what explains it; do not "tidy" it into `text-primary` and silently reintroduce the defect.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md §16. **No test file is added, modified, or removed.** Verification is below.

DSN-17's fourth task adds the standing contrast check that would make this permanent; it is deliberately not built here.

---

## Migration / Rollback

**No backend, no migration, no persisted state beyond `localStorage`.** The cache gains two keys; an old cache is rejected by the type guard and rewritten on the next branding fetch, so there is no migration step and no coordinated deploy.

**Rollback is `git revert`.** The CSS token disappears, `text-primary-text` stops resolving — Tailwind emits no rule for an unmapped utility, so links would fall back to inherited colour. Therefore **revert the whole commit, never just `index.css`**: the token and its call sites must move together.

---

## Verification Steps

1. **Backend untouched:** `git status --short backend/` is empty.
2. **Gates:** in `frontend/`, `npx tsc -b`, `npm run lint`, `npm run check:rtl`, `npm run format:check` and `npx vite build` all pass.
3. **Only the intended call sites moved:** `grep -rn "text-primary\b" src/ | wc -l` drops from 34 to 20, and `grep -rn "text-primary-text" src/ | wc -l` is 14. Every remaining `text-primary` is an icon, an indicator, or a comment — confirm by reading the list, not by counting.
4. **The token resolves:** in the built app with dark mode active, a table link's computed colour is `#5A95FF` (or the brand-derived value), not `#2563EB`.
5. **Measured, not eyeballed:** compute the ratio of the rendered link colour against `--card` and `--background` in both themes; all four must be ≥ 4.5:1.
6. **Icons did not change:** an icon using `text-primary` still computes to `#2563EB` in dark mode.
7. **Default branding is unchanged:** with no `primary_color` set, light mode links stay `#2563EB` — byte-identical to today.
8. **Brand override, both themes:** set `primary_color` to `#1E3A8A` (navy). Links must be readable in **both** themes, and toggling the theme must change the link colour with no reload. Repeat with `#E879F9` (the shipped pink) and confirm light mode becomes readable.
9. **No flash on cold load:** with a brand colour set, hard-reload — links must never paint in the raw brand colour before correcting.
10. **Stale cache:** hand-edit `localStorage['supportos.branding']` to remove `brandTextDark`, reload, and confirm the app renders with default branding rather than crashing or painting unstyled.
11. **RTL:** switch to Arabic and confirm links render identically — this is a colour change with no directional component, so any difference indicates an unrelated regression.

---

## Done Criteria

- [ ] `--primary-text` exists in `:root` and `.dark`, each carrying its **measured** ratio in a comment; `.dark` no longer says "same as :root" for this purpose.
- [ ] Exactly 14 call sites moved to `text-primary-text`; all 12 icon uses and every `text-primary-foreground` are untouched.
- [ ] Link text measures ≥ 4.5:1 against both `--card` and `--background` in both themes, verified by computation.
- [ ] `--primary` itself is unchanged — fills, buttons and badges look identical to before.
- [ ] An org-supplied `primary_color` yields a derived text colour clearing 4.5:1 in both themes; navy and pink both verified.
- [ ] Switching theme with a brand colour set updates the link colour with **no** JavaScript and no reload.
- [ ] The anti-FOUC block applies the cached brand text colours; no flash of unreadable links on cold load.
- [ ] A cache written before this story is rejected safely and rewritten.
- [ ] `foregroundFor()` is unchanged and button-label contrast still behaves.
- [ ] `config.ts`'s "only two custom properties" comment is corrected.
- [ ] `tsc -b`, `lint`, `check:rtl`, `format:check`, `vite build` all pass.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md §16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 102.**
