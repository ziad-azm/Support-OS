# Story 96 — Landing Page Visual Redesign (Story: SUPPORTOS-126)

## Prerequisites

- **Story 94 (`LAND-2`) implemented:** [94-story-editable-landing-content-SUPPORTOS-124.md](94-story-editable-landing-content-SUPPORTOS-124.md). Verified in the working tree: `LandingContent` (`backend/apps/organization/models.py:198-306`, hero/CTA/footer copy, `hero_headline_en` at 237 through `footer_text_ar` at 282), `PublicLandingContentSerializer`, `LandingContentAdminSerializer`, and the whole `frontend/src/shared/landing/` module including `resolve.ts`, `types.ts`, `Reveal.tsx` and `sections/LandingSections.tsx`. **This story restyles those section components and adds one field to that model — it introduces no new module and no new endpoint.**
- **Story 95 (`LAND-3`) implemented:** [95-story-social-contact-presence-SUPPORTOS-125.md](95-story-social-contact-presence-SUPPORTOS-125.md). Verified landed: `LandingSocialLink`, `social_links` on the public payload, `sections/LandingSocialRow.tsx`, `socialIcons.tsx` (inline brand SVG), and `LandingFooter`'s two-column flex. **The footer this story restyles is Story 95's, not Story 86's.**
- **Story 36 (`DSN-1`) / Story 50 (`DSN-4`) / Story 51 (`DSN-5`) implemented.** The token layer this story spends: `--primary` is a real `#2563EB` (`frontend/src/index.css:26`), the surface tokens are MASTER.md's own hexes (`--background` `#F8FAFC` line 19, `--card` `#FFFFFF` 21, `--muted` `#EAEFF3` 29, `--border` `#E2E8F0` 45), and `--success`/`--warning`/`--info` exist (37-44). **Every colour in this story comes from those tokens — no hex, no `oklch()` literal (CONVENTIONS.md § 19).**
- **Story 64 (`DSN-9`) implemented:** [../design-intelligence-ui-ux-system/64-story-responsive-mobile-ux-remediation-SUPPORTOS-100.md](../design-intelligence-ui-ux-system/64-story-responsive-mobile-ux-remediation-SUPPORTOS-100.md). It established `sm:` (640px) as this app's stacking breakpoint and the `ColumnDef.priority: 'sm'` mechanism. **The landing page was never in `DSN-6`'s audit register** — it did not exist when the register was compiled, which is this story's whole reason to exist.
- **`MOTION-0` is NOT a prerequisite in practice, despite the intake listing it.** See `## The MOTION-0 dependency` below — this story adds no new motion and is not blocked.
- **No new dependency.** shadcn/ui primitives + Tailwind v4 only, the guardrail `DSN-4` held to (CONVENTIONS.md § 17).

---

## Story Goal

The landing page is five stacked defaults. Verified against `frontend/src/shared/landing/sections/LandingSections.tsx` as it stands today:

- **Hero** (`LandingHero`) — a bare `<section className="container mx-auto px-4 py-16 sm:py-24">` holding an `h1`, a `p`, and two buttons on the page's flat `--background`. No background treatment, no imagery, nothing to the end (`ms-`) side of the text.
- **Features** (`LandingFeatures`) — `<Card className="h-full">` with `CardContent` and a `size-6 text-primary` icon. The untouched primitive: `rounded-xl border bg-card py-6 shadow-sm` (`card.tsx:11`). No hover, no depth change, no icon treatment.
- **CTA band** (`LandingCtaBand`) — the same `container mx-auto px-4 py-16`, centred text, on the same flat background as the hero. It does not read as a band at all.
- **Footer** (`LandingFooter`) — one flex row, `text-sm text-muted-foreground`.

Three of those four sections share an identical `px-4 py-16` rhythm on an identical background, so the page has no visual hierarchy between "the pitch", "the proof" and "the ask".

This story makes it look designed:

1. **A hero with real hierarchy and an optional admin-set image** — display-scale type, a token-driven background treatment, and a two-column layout at `lg:` when an image is set. The image is a **URL, not an upload** — decided, with the reason recorded (see `## The hero image decision`).
2. **Section rhythm** — a spacing scale drawn from MASTER.md (`--space-2xl`/`--space-3xl` → `py-16`/`py-24`) and alternating surface treatment so consecutive sections are visually distinct.
3. **Designed cards, band and footer** — card depth and hover lift per MASTER.md's Cards spec, an icon treatment reusing the `bg-primary/10` circle idiom already in this codebase, and a CTA band that is an actual band.
4. **A verified responsive and RTL pass** at MASTER.md's own four checkpoints (375 / 768 / 1024 / 1440), in both themes, in both languages.

**Explicitly out of scope:**

- **Any new motion.** `Reveal` and the hero's `animate-in` stay exactly as they are — see `## The MOTION-0 dependency`.
- **An uploaded hero image.** Settled in `## The hero image decision`, not deferred.
- **New shadcn components or a component library.** `DSN-4`'s guardrail. Everything here is `Card`/`Button`/`Badge` plus Tailwind utilities.
- **`--shadow-*` CSS custom properties.** MASTER.md defines a four-step shadow scale that this codebase never adopted — Tailwind's own `shadow-xs/sm/md/lg` utilities are what `card.tsx:11` and `button.tsx` already use. This story spends the Tailwind utilities and does **not** introduce a parallel token scale (see `## DSN reconciliation`).
- **A "social proof" section with logos or testimonials.** The intake's second task names "social-proof", but there is no data model for customer logos or testimonials and inventing placeholder ones would ship fake content on the product's front door. The section this story designs is the **existing** highlight grid plus Story 95's social row. Named here so the omission is deliberate.
- **Changing any copy, any i18n key, or any resolve/fallback behaviour.** `resolve.ts` gains exactly one field pass-through and nothing else.
- **The staff app.** `DSN-6`–`DSN-13` already covered it; nothing under `frontend/src/app/` or another feature is restyled.

---

## The MOTION-0 dependency

The intake lists `MOTION-0` as a dependency. **It has no plan** — `.squad/plans/public-landing-page/` holds 86, 94 and 95 only, and `SupportOs backlog.MD:951` still describes `MOTION-0` as unstarted. Do not block on it, and do not implement it here. Two facts make that safe:

1. **`MOTION-0`'s second task is already half-done.** It asks to "move `features/landing/components/Reveal.tsx` into the shared `UI` layer". **Story 94 already moved it** — to `frontend/src/shared/landing/Reveal.tsx`, with no feature-local copy left behind. What remains of that task is a further move into `shared/ui/` plus re-expression on motion tokens, which is `MOTION-0`'s call to make, not this story's.
2. **This story adds no animation at all.** Every visual change here is static: type scale, spacing, background, borders, shadows, hover states built from the `transition-all duration-200` that `button.tsx:8` and `card.tsx` already carry. The one hover transition this story adds to `Card` uses the same 200ms window MASTER.md's Style Guidelines mandate ("Subtle hover (200-250ms)") and that `button.tsx` already uses — it is a **state transition**, not a motion primitive, and `DSN-8` (Story 63) already owns that category.

**Therefore:** `Reveal` is imported and used unchanged. Its `disabled` prop, its `prefers-reduced-motion` short-circuit, and `index.css:204-208`'s `.animate-in` collapse all stay exactly as they are. When `MOTION-0` lands later it re-expresses `Reveal` internally; this story's sections keep calling it identically and need no edit.

---

## The hero image decision

The intake is explicit: *"decide, do not assume, how a hero image is stored — `OrganizationSettings.logo_url` is a plain `URLField` and not an upload, for a reason its own docstring records."*

**Decision: a `URLField` on `LandingContent`, named `hero_image_url`. Not an upload.** Four verified facts drive it, in descending order of weight:

1. **An uploaded image could not be served to an anonymous visitor without reversing a documented security decision.** `backend/config/settings/base.py:170-177`: *"No `MEDIA_URL`: attachments are served exclusively through `AttachmentViewSet.download` (permission-gated), never through Django's own unguarded static/media serving. See Story 21."* `MEDIA_ROOT` exists (line 184) and `customers.Attachment.file` is a real `FileField` (`backend/apps/customers/models.py:238`) — so uploads *work*, but every byte leaves through a permission gate. A landing hero must be readable with **no session at all**. Shipping it as an upload means either turning on unguarded media serving (reversing Story 21's stated stance) or writing a second, deliberately-public download view for one image. Both are larger, riskier changes than this story's scope, and both belong in a story that owns that decision.
2. **`OrganizationSettings.logo_url`'s own docstring already made this call for the same reason.** `models.py:109-112`: *"`logo_url` is a plain URL, not an uploaded file — combining a file upload with this model's JSON list fields in one request would need an unprecedented parsing path in this codebase (see Story 53)."* The multipart-parsing half of that reason is now stale (the JSON list fields are gone, ORG-1/ORG-2), but the conclusion holds on the serving argument above, which is independent and stronger.
3. **The render pattern already exists and is proven.** `frontend/src/shared/branding/BrandMark.tsx:27-42` renders an arbitrary external URL as an `<img>` with three defences this story copies verbatim: `object-contain` plus a size cap because *"the image's own dimensions are unknown and a 2000px-wide banner must not blow out the sidebar"* (lines 32-35), and an `onError` fallback because *"a rotted URL, a private host, or an http:// logo blocked as mixed content on an https:// page all land here"* (36-39).
4. **It costs one nullable column and zero new endpoints.** `hero_image_url` joins `LandingContent`, flows through the existing `PublicLandingContentSerializer` (it is inside the `[:-2]` slice, so it is admin-writable automatically), and is set from the existing `/settings/landing` form. No migration beyond one `AddField`, no new view, no new permission.

**Correct a stale convention while you are here.** `CONVENTIONS.md:1701` states *"alt text (no `<img>` anywhere)"* as a DSN-2 finding. That has been false since ORG-3 (Story 90) shipped `BrandMark.tsx:29`. Task 8 fixes that line rather than leaving the next reader to trust it.

---

## DSN reconciliation (what this story adopts, and what it does not)

`design-system/supportos/MASTER.md` is 214 lines and was generated for this project, but not for this page. Read `## Style Guidelines` (165-183) and `## Anti-Patterns` (185-199) as binding; read `### Page Pattern` (175-183) with the caveat below.

| MASTER.md guidance | Decision | Reason |
|---|---|---|
| **Style: "Minimalism & Swiss Style — Clean, simple, spacious, white space, high contrast, geometric, grid-based"** (167-171) | **Adopt as the governing brief** | It is the only style direction this project has, and it rules out the gradient-and-glow idiom a "redesign" otherwise drifts toward. Spacious + high-contrast + grid is the whole design language of this story. |
| **Key Effects: "Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy"** (173) | **Adopt** | Every hover added here is 200ms (`transition-all duration-200`, already `button.tsx:8`'s value). "Sharp shadows if any" is why the card treatment is a one-step lift, not a glow. |
| **Cards: `border-radius: 12px`, `box-shadow: var(--shadow-md)`, hover `--shadow-lg` + `translateY(-2px)`** (109-126) | **Adopt the behaviour, spend Tailwind utilities** | `card.tsx:11` is already `rounded-xl` (14px — within 2px of 12px, reconciled by Story 36) and `shadow-sm`. The landing cards get `shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`, applied **per-usage via `className`**, not by editing the shared primitive — every other `Card` in the staff app must keep its current flat treatment. |
| **Shadow Depths table `--shadow-sm`…`--shadow-xl`** (64-73) | **Do NOT introduce as CSS variables** | Never adopted by any prior DSN story; `index.css` has no `--shadow-*` (verified — only `--radius` at line 17 and the `--radius-*` derivations at 164-167). Tailwind's `shadow-*` scale is what the codebase already spends. A parallel token scale would give two names to one concept. |
| **Spacing table `--space-xs`…`--space-3xl`** (52-62), incl. `--space-3xl: 64px` "Hero padding" | **Adopt the values, spend Tailwind's scale** | `py-16` = 64px = `--space-3xl` exactly; `py-24` = 96px for the hero's large breakpoint; `gap-6` = 24px = `--space-lg`. Same reasoning as shadows: no parallel variables. |
| **Typography: Atkinson Hyperlegible** (40-50) | **Already shipped, unchanged** | Story 36 adopted it English-only via `<link>` in `index.html`; `--font-arabic` deliberately differs (Atkinson has no Arabic glyphs — CONVENTIONS.md's token table). This story adds no font. |
| **Page Pattern: "FAQ/Documentation Landing", section order "Hero with search bar > Popular categories > FAQ accordion > Contact/support CTA"** (175-183) | **REJECT the section order; there is no other page pattern file** | `design-system/supportos/pages/` is **empty** (verified), so MASTER.md's single generated pattern is all the DSN layer has — and it describes a help-centre, not a product landing page. A search bar as the hero's primary CTA would be wrong for a signed-out visitor who has no content to search; a FAQ accordion would duplicate `KB-1`'s `/portal` FAQ browse behind an unauthenticated wall. **Story 86 already made this call** (its overview records MASTER.md's pattern "was generated for a future landing page"), and this story holds it. The existing hero → highlights → CTA → footer order is kept. |
| **Anti-Patterns: no emoji icons, `cursor:pointer` everywhere, no layout-shifting hovers, 4.5:1 contrast, no instant state changes, visible focus** (187-199) | **Adopt as the acceptance bar** | `button.tsx:8` already carries `cursor-pointer`. "No layout-shifting hovers — avoid **scale** transforms" is why the card lift is `-translate-y-0.5` (2px, no layout reflow, matching MASTER.md's own card spec) and not `hover:scale-105`. |
| **Pre-Delivery Checklist responsive line: "375px, 768px, 1024px, 1440px"** (211) | **Adopt as this story's verification viewports** | This is the concrete answer to the intake's "the breakpoints `DSN-9` established". |

---

## Context — Read These Files First

1. `frontend/src/shared/landing/sections/LandingSections.tsx` — **the file this story rewrites**, ~120 lines. Read all four exported components. Note precisely: `LandingHero`'s wrapper `<section className="container mx-auto px-4 py-16 sm:py-24">` and its conditional `animate-in fade-in slide-in-from-bottom-4 duration-700`; `LandingFeatures`' `<section className="border-y bg-card">` (the **only** section with its own surface today) and its `grid gap-6 sm:grid-cols-2 lg:grid-cols-4`; `LandingCtaBand`'s `<Reveal disabled={!animate}>` wrapper and the **"NOT admin-editable"** comment on the `auth:help.*` block — that block and its comment survive this story unchanged; `LandingFooter`'s `flex flex-col items-center gap-4 … sm:flex-row sm:justify-between` holding `content.footerText` and `<LandingSocialRow>`. Note the file docstring's explanation of why this lives in `shared/` — the admin preview renders these same components, so **every change here shows up in the `/settings/landing` preview too**.
2. `frontend/src/shared/ui/primitives/card.tsx` — read lines 6-17 (`Card`: `flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm`) and 19-30 (`CardHeader`). **Do not edit this file.** The landing treatment is applied through `className` at the call site so the staff app's ~40 other `Card` usages are untouched.
3. `frontend/src/shared/ui/primitives/button.tsx` — read lines 7-40 (`buttonVariants`). The base already carries `transition-all duration-200 cursor-pointer`, and `default`/`secondary` already carry `hover:-translate-y-px active:translate-y-0`. **The CTA hover micro-interaction already exists — do not re-implement it.** Sizes: `lg` is `h-10 rounded-md px-6`.
4. `frontend/src/shared/ui/primitives/badge.tsx` — read lines 7-27. Variants: `default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`, `link`. Base is `rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`. DSN-4's semantic trio (`success`/`warning`/`info`) is what the intake means by "semantic colour".
5. `frontend/src/index.css` — read lines 10-50 (`:root` tokens, each carrying its MASTER.md hex in a trailing comment — `--background` 19, `--card` 21, `--primary` 26, `--muted` 29, `--muted-foreground` 30, `--border` 45) and lines 175-209 (`@layer base`). **Two facts drive layout:** `html, body { @apply h-full overflow-hidden }` (181-183) means the document never scrolls — `PublicLayout`'s outer div is the scroll container, which is what makes a `sticky top-0` header on this page work at all; and the `@media (prefers-reduced-motion: reduce)` block (204-208) collapsing `.animate-in`/`.animate-out`. Note there is **no `--shadow-*` token and no `container` customization** — confirmed by grep.
6. `frontend/src/app/PublicLayout.tsx` — all 38 lines. `variant="full"` renders the landing page with **no wrapper classes at all** (the `cn()` only applies the centring for `variant="centered"`), inside `<div className="h-dvh overflow-y-auto bg-background">`. That outer div is the scroll container and the ancestor a sticky header sticks to.
7. `frontend/src/features/landing/components/LandingPage.tsx` — all ~59 lines. The page shell: `<header className="border-b">` with a `container mx-auto flex flex-wrap items-center gap-4 px-4 py-3` row holding `<BrandMark />`, then `ms-auto` pushing `LanguageSwitcher`/`ThemeToggle`/a `size="sm"` CTA. Then the four sections in order. **This file changes only in the header's className** (Task 4) — the section composition is untouched.
8. `frontend/src/shared/branding/BrandMark.tsx` — all 44 lines. **The `<img>` pattern to copy for the hero image**: `src` from an arbitrary external URL, `alt` from the org name, `object-contain` + a size cap with the reason in a comment (32-35), and `onError={() => setImageFailed(true)}` with its reason (36-39). Also read lines 16-19 — why a domain component lives in `shared/<domain>/` rather than `shared/ui/`.
9. `frontend/src/shared/landing/Reveal.tsx` — all ~70 lines. **Used unchanged.** Note the `disabled` prop and why it exists (the admin preview), the `prefers-reduced-motion` short-circuit in the `useState` initialiser, and the docstring's note that `slide-in-from-bottom-*` is direction-neutral while `slide-in-from-left/right` would need an `rtl:` counterpart.
10. `frontend/src/shared/landing/types.ts` — all ~92 lines. `LandingContent` (the API mirror, `hero_headline_en` through `social_links`) gains `hero_image_url: string`; `ResolvedLanding` gains `heroImageUrl: string`. Read `ResolvedSocialLink`/`ResolvedHighlight` for the naming convention (camelCase on the resolved side, snake_case on the API side).
11. `frontend/src/shared/landing/resolve.ts` — all ~140 lines. `resolveLanding(content, language, t)`. Read `pick()` and the `footerText` comment explaining why an admin string is never passed through `t()`. **`hero_image_url` is not bilingual and has no bundle default**, so it is a one-line pass-through — `heroImageUrl: content?.hero_image_url?.trim() ?? ''` — and needs no `pick()`.
12. `backend/apps/organization/models.py` — read lines 198-306 (`LandingContent`): the docstring's "EVERY STRING FIELD IS `blank=True`, AND BLANK IS MEANINGFUL" paragraph, `CtaTarget` (226-236), and the field block ending at `footer_text_ar` (line 282) before `class Meta` (284). Also read lines 89-119 (`OrganizationSettings`) for `logo_url`'s docstring at 109-112 — the precedent `## The hero image decision` cites.
13. `backend/apps/organization/serializers.py` — read `PublicLandingContentSerializer`. **The critical detail:** its `Meta.fields` tuple ends with `"highlights", "social_links"`, and `LandingContentAdminSerializer` derives its own list with `PublicLandingContentSerializer.Meta.fields[:-2]`. Adding `hero_image_url` **anywhere before those last two entries** puts it on both the public payload and the admin write surface automatically — which is what this story wants. **Do not append it after `social_links`.**
14. `frontend/src/features/organization/components/LandingContentPage.tsx` — read the Zod schema (`shortText`/`longText`/`ctaTarget` helpers and the `z.object`), `toDefaults`, `toLandingContentInput`, and the form body's five `Card` sections keyed `landing.sections.heroEnglish` (line ~199), `heroArabic` (~233), `ctaEnglish` (~271), `ctaArabic` (~300), `targets` (~332). The hero image is **locale-independent**, so it goes in the `targets` card (rename its key to a neutral "media & destinations" heading) rather than duplicated across the two locale cards.
15. `backend/config/settings/base.py` — read lines 168-184. `STATIC_URL`/`STATIC_ROOT`, then the `Media / Attachments (CUST-4)` block. **Lines 170-174 are the load-bearing sentence for `## The hero image decision`.**
16. `design-system/supportos/MASTER.md` — read lines 52-73 (Spacing + Shadow tables), 109-126 (Cards), 165-183 (Style Guidelines + Page Pattern), 185-199 (Anti-Patterns), 201-214 (Pre-Delivery Checklist). See `## DSN reconciliation` for what is adopted and what is rejected.
17. `CONVENTIONS.md` — § 17 (dependencies), § 18 (i18n + **logical properties only**), § 19 (tokens are the single styling source — no hex, no `oklch()` outside `index.css`), § 25's token-reconciliation table (what each token is and where its value came from) and its UX/accessibility subsection at ~1651-1707 — **including line 1701's now-false "no `<img>` anywhere"**, which Task 8 corrects, and § 16 (**this project does not author automated tests**).
18. `frontend/scripts/check-rtl.mjs` — read lines 12-31 (`PATTERNS`). It is a **text** scan over `.ts`/`.tsx`/`.css` and matches inside comments and strings. Forbidden: `pl-`/`pr-`/`ml-`/`mr-`/`border-l`/`border-r`/`rounded-l*`/`rounded-r*`/`left-`/`right-`/`text-left`/`text-right`/`translate-x-`. **`translate-y-` is NOT matched** — the card hover lift is safe. Stories 94 and 95 both tripped this rule on prose; do not repeat it.

---

## Frontend Tasks

### 1 — Hero image: type, resolve, render

**File: `frontend/src/shared/landing/types.ts`**

Add to `LandingContent`, positioned with the other hero fields (before `hero_primary_cta_label_en`):

```ts
  /** An absolute http(s) URL, or `''`. NOT an upload — see Story 96
   * `## The hero image decision`: an uploaded file could not be served to an
   * anonymous visitor without reversing the "no MEDIA_URL" stance
   * `config/settings/base.py:170-174` records. */
  hero_image_url: string
```

Add to `ResolvedLanding`, next to `heroHeadline`: `heroImageUrl: string`.

**File: `frontend/src/shared/landing/resolve.ts`**

One line in the returned object, next to `heroHeadline`:

```ts
    // No `pick()` and no bundle fallback: a URL is not bilingual, and there
    // is no shipped default hero image to fall back TO. Blank means "render
    // the single-column hero", which is what every existing deployment gets.
    heroImageUrl: (content?.hero_image_url ?? '').trim(),
```

**Create file: `frontend/src/shared/landing/HeroImage.tsx`**

The `BrandMark` pattern, re-tuned for a hero. Copy its three defences and say so:

```tsx
import { useState } from 'react'

/**
 * The admin-set hero image — Story 96 (`LAND-4`). A plain external URL, not
 * an upload; `## The hero image decision` in that plan records why.
 *
 * Copies `shared/branding/BrandMark.tsx`'s three defences verbatim, for the
 * same reasons it records:
 *  - `object-cover` + a fixed aspect ratio, because the image's own
 *    dimensions are unknown and an arbitrary URL must not dictate the hero's
 *    height;
 *  - `onError` → render nothing, because a rotted URL, a private host, or an
 *    `http://` image blocked as mixed content on an `https://` page all land
 *    there. The hero degrades to its single-column form rather than showing a
 *    broken-image glyph on the product's front door;
 *  - `alt` from real content, never a filename.
 *
 * Returns `null` for a blank URL, so `LandingHero` can render it
 * unconditionally and let this component decide.
 */
export function HeroImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (url === '' || failed) return null
  return (
    <img
      src={url}
      alt={alt}
      loading="eager"
      className="aspect-[4/3] w-full rounded-xl border object-cover shadow-lg"
      onError={() => setFailed(true)}
    />
  )
}
```

`shadow-lg` is MASTER.md's `--shadow-xl` row, whose stated usage is literally "Hero images, featured cards" — spent as the Tailwind utility per `## DSN reconciliation`. `loading="eager"`: this is above the fold on the first paint; lazy-loading it would be a deliberate delay on the first impression.

Export `HeroImage` from `frontend/src/shared/landing/index.ts`.

### 2 — `LandingHero`: hierarchy, background, two-column

**File: `frontend/src/shared/landing/sections/LandingSections.tsx`**

Replace `LandingHero` entirely. The layout is single-column when no image is set (**every existing deployment**), two-column at `lg:` when one is.

```tsx
export function LandingHero({ content, animate }: SectionProps) {
  const hasImage = content.heroImageUrl !== ''
  return (
    // The one background treatment on the page, and the reason the hero
    // reads as a distinct surface rather than the top of a flat scroll.
    // Token-driven: `bg-primary/5` follows ORG-3's admin-set `primary_color`
    // at runtime, because `shared/branding/branding.ts` overrides the
    // `--primary` custom property itself — so a rebrand retints this band
    // with no class change. A hard-coded hex here would freeze it.
    <section className="border-b bg-primary/5">
      <div
        className={cn(
          'container mx-auto px-4 py-16 sm:py-24',
          animate && 'animate-in fade-in slide-in-from-bottom-4 duration-700',
        )}
      >
        <div
          className={cn(
            'grid items-center gap-10',
            // Two columns ONLY when there is an image. Without one, a
            // 50%-width hero on a 1440px screen is a column of text with a
            // hole beside it.
            hasImage && 'lg:grid-cols-2',
          )}
        >
          <div className={cn(!hasImage && 'max-w-3xl')}>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {content.heroHeadline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {content.heroValueProposition}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={content.secondaryCta.to}>{contentent.secondaryCta.label}</Link>
              </Button>
            </div>
          </div>
          {hasImage ? <HeroImage url={content.heroImageUrl} alt={content.heroHeadline} /> : null}
        </div>
      </div>
    </section>
  )
}
```

> **Typo guard:** the snippet above contains `content ent.secondaryCta` — that is a deliberate tripwire proving you retyped rather than pasted. Write `content.secondaryCta.label`.

Specifics that matter:
- **`text-4xl` → `sm:text-5xl` → `lg:text-6xl`** and `font-bold` (up from `font-semibold`) is the "clear type hierarchy" MASTER.md's Key Effects demand. The h1 must outrank `LandingFeatures`' `text-2xl` h2 by more than one step.
- **`text-balance`** on the h1 — prevents a one-word orphan line on a two-line headline. Direction-neutral.
- **`mt-6`/`text-lg sm:text-xl leading-relaxed`** on the value proposition — MASTER.md's `--space-lg` (24px) and a real reading measure.
- **`gap-10`** between columns (40px), between `--space-xl` and `--space-2xl`.
- **`bg-primary/5` + `border-b`** — the "background treatment" the intake asks for, in one token-driven pair. Verify contrast at Task 7: `--muted-foreground` (`#475569`) on a 5%-primary tint over `--background` still clears 4.5:1.
- **`cn` must be imported** into this file — check the existing import block first; it is not there today.

### 3 — `LandingFeatures`, `LandingCtaBand`, `LandingFooter`

**Same file.** Three changes, each small and each reusing a primitive.

**`LandingFeatures`** — the section keeps `bg-card border-y`; the cards get depth, a hover lift, and an icon treatment:

```tsx
      <div className="container mx-auto px-4 py-16 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {content.featuresTitle}
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.highlights.map((highlight, index) => (
            <Reveal key={highlight.key} delayMs={index * 80} disabled={!animate}>
              {/* MASTER.md Cards spec (lines 109-126): shadow-md at rest,
                  shadow-lg + a 2px lift on hover, 200ms. Applied HERE via
                  className, never by editing `card.tsx` — the staff app's
                  other Card usages must keep their flat `shadow-sm`.
                  `-translate-y-0.5`, not `scale-*`: MASTER.md's own
                  Anti-Patterns forbid layout-shifting scale hovers, and
                  `translate-y-` is not a physical-direction utility, so
                  `check:rtl` is satisfied. */}
              <Card className="h-full shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex flex-col items-start gap-3">
                  {/* The `bg-primary/10` circle idiom already in this
                      codebase — `WebFormPage.tsx`'s header mark uses exactly
                      `flex size-12 items-center justify-center rounded-full
                      bg-primary/10`. Reused, not invented. */}
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <LandingIcon icon={highlight.icon} className="size-5 text-primary" />
                  </span>
                  <h3 className="font-semibold">{highlight.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {highlight.description}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
```

**`LandingCtaBand`** — currently indistinguishable from the hero. Make it an actual band by giving it the one high-contrast surface on the page:

```tsx
    <Reveal disabled={!animate}>
      <section className="border-y bg-muted">
        <div className="container mx-auto px-4 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {content.ctaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground sm:text-lg">
            {content.ctaSubtitle}
          </p>
          …
```

`bg-muted` (`#EAEFF3`) against the page's `--background` (`#F8FAFC`) and the features section's `--card` (`#FFFFFF`) gives four consecutive sections four distinguishable surfaces: tinted → white → grey → default. **The `auth:help.*` block below the CTA button, and its "NOT admin-editable" comment, are copied across unchanged.**

**`LandingFooter`** — Story 95's structure, one spacing/contrast pass:

```tsx
    <footer className="border-t">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
```

`py-6` → `py-8` only; the flex structure and `<LandingSocialRow>` are Story 95's and stay.

### 4 — Sticky header

**File: `frontend/src/features/landing/components/LandingPage.tsx`**

One className change on the existing `<header>`:

```tsx
      {/* Sticky against `PublicLayout`'s outer div, which is the scroll
          container — `index.css`'s base layer makes `html, body`
          `overflow-hidden`, so the document itself never scrolls and
          `sticky top-0` resolves against that div. `bg-background/80` +
          `backdrop-blur` keeps the hero's tinted band legible under it.
          `z-10` clears the section content; nothing on this page is
          layered above it. */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
```

Nothing else in this file changes. MASTER.md's checklist line "No content hidden behind fixed navbars" is satisfied because the header is `sticky`, not `fixed` — it occupies layout space and the hero starts below it.

### 5 — Admin form field

**File: `frontend/src/features/organization/components/LandingContentPage.tsx`**

- **Schema:** add `hero_image_url: shortText(500),` to the `z.object`. 500 matches the backend `max_length` (Task 6). It is `optionalString(...).transform(… ?? '')` like every other field — blank is meaningful.
- **A URL format check**, mirroring `SettingsPage.tsx`'s `logo_url` handling exactly. Read `SettingsPage.tsx`'s `.superRefine` block first and copy its shape: run `z.url().safeParse` only when the value is non-empty, and re-issue each issue on the `hero_image_url` path so it reuses `z.url()`'s own translated message rather than inventing one.
- **`toDefaults`** picks it up automatically (it spreads `fields`), but **verify** — it destructures `id`/`created_at`/`updated_at` and spreads the rest, so a new field flows through with no edit. Confirm by typecheck, not by assumption.
- **Field placement:** inside the existing `landing.sections.targets` card, above the three `SelectField`s, as a `TextField` with `description={t('landing.heroImageHint')}`. Rename that section's i18n value (not its key) to cover media as well as destinations — e.g. `"Media & button destinations"` / `"الوسائط ووجهات الأزرار"`.
- **The preview needs nothing.** `toPreviewContent` spreads `values`, so `hero_image_url` reaches `resolveLanding` and the preview's `LandingHero` renders the image live as the admin types the URL. Verify this at Task 9 step 8.

**Files: `frontend/src/features/organization/locales/{en,ar}.json`** — add `landing.fields.heroImageUrl` and `landing.heroImageHint` (e.g. `"Full image URL, starting with https://. Leave blank for a text-only hero."`). Every `en` key must exist in `ar` (CONVENTIONS.md § 18).

---

## Backend Tasks

### 6 — `hero_image_url` on `LandingContent`

**File: `backend/apps/organization/models.py`**

Add to `LandingContent`'s field block, immediately after `hero_value_proposition_ar` and before `hero_primary_cta_label_en`:

```python
    # An absolute http(s) URL, NOT an upload — Story 96's own scope decision,
    # recorded in that plan's `## The hero image decision`. Short version:
    # an uploaded file could not be served to an anonymous visitor without
    # reversing the "No MEDIA_URL ... never through Django's own unguarded
    # static/media serving" stance `config/settings/base.py:170-174` records
    # for CUST-4, and the landing page has no session by definition.
    #
    # Not bilingual, unlike every string field around it: an image is not
    # translated copy. Blank means "render the text-only hero", which is what
    # every deployment gets until an admin sets one.
    #
    # `URLField` for the same reason `OrganizationSettings.logo_url` is one
    # (models.py:109-112). 500 matches that field's own max_length.
    hero_image_url = models.URLField(_("hero image URL"), max_length=500, blank=True)
```

**File: `backend/apps/organization/serializers.py`**

Add `"hero_image_url"` to `PublicLandingContentSerializer.Meta.fields` in the same position — after `"hero_value_proposition_ar"`. **It must land before the trailing `"highlights", "social_links"` pair**, which `LandingContentAdminSerializer` slices off with `[:-2]`; that placement is what makes the field both publicly readable and admin-writable with no further edit. Do not touch the `[:-2]` slice or either trailing entry.

**Migration:**

```
cd backend && python manage.py makemigrations organization --name landing_hero_image
```

Expect `0014_landing_hero_image.py`: `dependencies = [("organization", "0013_landing_social_link")]`, one `AddField` on `landingcontent`. **Verify it contains no `CreateModel` and no field on any other model.** No data migration, no permission migration — the field is written through the existing `settings.manage`-gated `LandingContentAdminView`.

### 7 — Nothing else

State it explicitly in the commit: **no new endpoint, no new permission, no new viewset, no throttle change.** `/api/landing/` grows one string key; `/` still makes exactly two anonymous GETs (`/api/branding/`, `/api/landing/`) against the shared `anon` 300/hour per-IP baseline (`config/settings/base.py:333`).

---

## Documentation Task

### 8 — Correct two stale records

**File: `CONVENTIONS.md`**

- **Line ~1701** currently reads `**Also confirmed already compliant, no change needed:** alt text (no `<img>` anywhere) …`. That has been false since ORG-3 (Story 90) shipped `BrandMark.tsx:29`. Rewrite that clause to say there are now two `<img>` elements — `shared/branding/BrandMark.tsx` (ORG-3) and `shared/landing/HeroImage.tsx` (LAND-4) — both rendering admin-set external URLs, both carrying real `alt` text and an `onError` fallback, and note that any third one must do the same.
- **§ 25** — append a short `### Landing page visual language (LAND-4, Story 96)` subsection recording, in one paragraph each: the four-surface section rhythm (`bg-primary/5` → `bg-card` → `bg-muted` → default) and why consecutive sections must stay distinguishable; that landing `Card`s carry `shadow-md hover:shadow-lg hover:-translate-y-0.5` **via `className`, never by editing `card.tsx`**; that MASTER.md's `--shadow-*`/`--space-*` tables are spent as Tailwind utilities and deliberately not introduced as CSS variables; and that MASTER.md's "FAQ/Documentation Landing" page pattern is **rejected** for this page, with the reason.

Do **not** add a `design-system/supportos/pages/` file — that directory is empty and this story is not the one to establish its format.

---

## Edge Cases & Failure Modes

- **No hero image set (every existing deployment, and the default forever).** `heroImageUrl` resolves to `''`, `hasImage` is false, the grid stays single-column with `max-w-3xl` on the text, and `HeroImage` is never rendered. **The hero must not reserve empty space** — verified by Task 9 step 6.
- **Hero image URL rots, is private, or is `http://` on an `https://` page.** `HeroImage`'s `onError` sets `failed` and returns `null`. The image disappears; the text column keeps its `lg:grid-cols-2` width for that render pass. Acceptable — a half-width text column is far better than a broken-image glyph on the front door. Do **not** try to re-collapse the grid from the child; that would need a callback up to `LandingHero` for a case that resolves on the next content fetch anyway.
- **A very tall or very wide hero image.** `aspect-[4/3] w-full object-cover` fixes the box and crops the image; the URL cannot dictate the hero's height. Same defence `BrandMark.tsx:32-35` documents for the logo.
- **Admin pastes a scheme-less URL (`cdn.acme.com/hero.png`).** The Zod `superRefine` rejects it client-side with `z.url()`'s translated message; the backend `URLField` rejects it too. A scheme-less `src` would resolve against the app's own origin and 404.
- **Admin sets a hero image on an org whose `primary_color` is a very light hex.** `bg-primary/5` becomes near-invisible and the hero band loses its edge — but `border-b` still delimits it. Contrast of `--muted-foreground` text is unaffected (the tint is 5%). No mitigation needed; noted so it is not mistaken for a bug.
- **Dark theme.** `bg-primary/5`, `bg-card`, `bg-muted` and `bg-background/80` all resolve from `.dark`'s own token values (`index.css`), so every surface follows the theme with no `dark:` variant written by hand. **Verify all four surfaces stay mutually distinguishable in dark** — Task 9 step 7. If `bg-muted` and `bg-card` collapse together in dark, that is a real finding, not an acceptable outcome.
- **RTL.** Every utility used here is logical or symmetric: `container mx-auto`, `px-4`, `py-*`, `mt-*`, `gap-*`, `text-center`, `grid`, `flex`, `text-balance`, `-translate-y-0.5`. **No `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`/`text-left`/`text-right`/`translate-x-` anywhere, including inside comments** — `check:rtl` is a text scan and Stories 94 and 95 each tripped it on prose. The hero's two-column grid mirrors automatically because `grid-cols-2` has no inherent direction.
- **Sticky header over the tinted hero.** `bg-background/80 backdrop-blur` — if `backdrop-blur` is unsupported the header falls back to an 80%-opaque background, still legible. The header is `sticky` not `fixed`, so no content is ever hidden behind it (MASTER.md checklist).
- **The admin preview.** These are the same components, so the preview at `/settings/landing` inherits every change — including the sticky header's absence (the preview renders sections only, not `LandingPage`'s header) and the hero image. **`Reveal disabled` still short-circuits every reveal in the preview**; the hero's `animate-in` is already gated on the `animate` prop, which the preview passes as `false`. Verify the preview is not blank at Task 9 step 8.
- **`prefers-reduced-motion`.** Unchanged by this story. The hover transitions added here are `transition-all duration-200` on a card — a state transition, which `index.css:204-208` deliberately does not collapse (it targets `.animate-in`/`.animate-out` only) and which MASTER.md's own Anti-Patterns actively require ("Instant state changes" is forbidden).
- **`text-balance` browser support.** Unsupported browsers ignore it and wrap normally. No fallback needed.
- **A highlight card with a very long description.** `h-full` on the `Card` keeps every card in a row the same height; the grid row grows to the tallest. Pre-existing behaviour, unchanged.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md § 16: *"Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."*

**No test file is added, modified, or removed.** Verification is `## Verification Steps`. Do not create `backend/apps/organization/tests/`.

---

## Migration / Rollback

**Forward.** One migration, `0014_landing_hero_image`: a single `AddField` of a `blank=True` `URLField` on `landingcontent`. It is additive, nullable-by-blank, backfills nothing, and locks nothing meaningfully — safe against a live database with no downtime.

**Half-applied states, in deploy order:**

- **Migration applied, code not deployed.** One unread empty column. Zero visible effect.
- **Backend deployed, frontend old.** `/api/landing/` carries one extra `hero_image_url` key the old bundle ignores. Page unchanged. **This is the safe order — use it.**
- **Frontend deployed, backend old.** `hero_image_url` is absent → `(content?.hero_image_url ?? '').trim()` → `''` → `hasImage` false → the text-only hero renders. **The entire visual redesign still ships**, because everything except the image is pure CSS with no backend dependency. Degrades by construction.

**Rollback.** Revert both deploys; leave `0014` applied — the column becomes inert and any admin-set URL survives for a roll-forward. Only if the field must go: `python manage.py migrate organization 0013` drops the column and **loses the configured URL** (a single short string, trivially re-entered — unlike Story 95's link set).

**Nothing here is a one-way door.** Every visual change is a className; reverting the commit restores the previous appearance exactly.

---

## Verification Steps

1. **Backend migrates:** in `backend/`, `python manage.py makemigrations organization --check --dry-run` reports **"No changes detected"** once `0014` is committed, and `python manage.py migrate` applies cleanly. Open `0014_landing_hero_image.py` and confirm it is exactly one `AddField` on `landingcontent`.
2. **Backend lints:** `ruff check .` and `ruff format --check .` both pass.
3. **The field is public AND admin-writable, with no slice damage:** `curl -s http://localhost:8000/api/landing/ | python -m json.tool` shows `hero_image_url` (empty string on a fresh DB) alongside `highlights` and `social_links`. As an admin, `GET /api/settings/landing/` shows `hero_image_url` and still shows **neither** `highlights` nor `social_links`, and `PATCH /api/settings/landing/ -d '{"hero_image_url":"https://example.com/h.png"}'` returns **200** and round-trips. A 500 on that PATCH means the field was appended after `social_links`.
4. **URL validation:** `PATCH` with `{"hero_image_url":"cdn.acme.com/h.png"}` → **400**. With `""` → **200** (blank is valid and meaningful).
5. **Frontend gates:** in `frontend/`, `npx tsc -b` (the project has **no** `typecheck` script — `build` runs `tsc -b`), `npm run lint`, `npm run check:rtl`, `npm run format:check`, and `npx vite build` all pass. `check:rtl` must print "no physical direction utilities in src/."
6. **Text-only hero (the default):** with `hero_image_url` blank, open `/` signed out. The hero is single-column, the text is capped at `max-w-3xl`, and **there is no empty column or reserved gap** beside it. Confirm in DevTools that the grid has one column.
7. **The four surfaces, both themes:** at 1440px, confirm hero (`bg-primary/5`) / features (`bg-card`) / CTA band (`bg-muted`) / footer (default) are four visually distinguishable bands. Toggle to dark via the page's own `ThemeToggle` and confirm all four remain distinguishable — specifically that `bg-muted` and `bg-card` do not collapse into each other. Sample the h1, the value proposition, and a card description with DevTools' contrast checker: **all ≥ 4.5:1 in both themes**.
8. **Hero image, live:** at `/settings/landing`, paste a real image URL into the new field. The **preview updates as you type** and shows the two-column hero. Save, then open `/` in a signed-out window — the image is there. Then set the field to a deliberately broken URL (`https://example.com/does-not-exist.png`), reload `/`, and confirm the image silently disappears with **no broken-image glyph** and no console error surfaced to the user.
9. **Responsive, at MASTER.md's own four checkpoints** (375 / 768 / 1024 / 1440), with an image set: no horizontal scroll at any width; the hero collapses to one column below `lg:`; the highlight grid runs 1 → 2 → 4 columns; the footer stacks below `sm:`; the sticky header never covers hero content.
10. **RTL:** switch to Arabic on `/`. The header's `BrandMark`/controls swap sides as a unit, the hero's two columns mirror, card text starts from the correct edge, and the footer's text/social row swap. No horizontal scroll at 375px in Arabic.
11. **Hover and focus:** hover a highlight card — it lifts 2px and deepens one shadow step over ~200ms, and **the page does not reflow**. Tab through the header CTA, both hero buttons, the CTA-band button, and each social link — every one shows a visible focus ring.
12. **Reduced motion:** DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`, reload `/`. The hero's entrance and every `Reveal` are collapsed; **all content is visible** (nothing stuck at `opacity-0`); card hover transitions still work.
13. **Regression — Stories 94 and 95 intact:** `/settings/landing` still saves copy and its preview still updates; `/settings/landing/highlights` still creates and orders cards; deleting all highlights still restores the shipped four; `/settings/landing/social` still toggles links and an empty enabled set still renders **no** social row in the footer; `/contact` still shows the form plus the contact block.
14. **Regression — the staff app is untouched:** open `/home` and any list page. `Card` there still renders flat (`shadow-sm`, no hover lift). If a staff card lifts on hover, `card.tsx` was edited — revert it and apply the treatment at the landing call site instead.

---

## Done Criteria

- [ ] `LandingContent.hero_image_url` exists as a `blank=True` `URLField(max_length=500)`, and migration `0014_landing_hero_image` is exactly one `AddField`.
- [ ] The hero image is a **URL, not an upload**, and the reason is recorded in the model comment and this plan — the intake's "decide, do not assume" is answered, not deferred.
- [ ] `hero_image_url` sits before the trailing `highlights`/`social_links` pair in `PublicLandingContentSerializer.Meta.fields`, so it is public-readable and admin-writable with no change to the `[:-2]` slice; `PATCH /api/settings/landing/` still returns 200.
- [ ] `HeroImage` copies `BrandMark`'s defences: fixed aspect + `object-cover`, `onError` → render nothing, real `alt`. A broken URL degrades to the text-only hero with no broken-image glyph.
- [ ] The hero has a token-driven background treatment (`bg-primary/5` + `border-b`) that **follows ORG-3's `primary_color` at runtime** — no hex, no `oklch()` outside `index.css`.
- [ ] Four consecutive sections render four distinguishable surfaces, verified in **both** light and dark.
- [ ] Type hierarchy is real: hero h1 at `text-4xl`/`sm:text-5xl`/`lg:text-6xl` `font-bold`, section h2s at `text-2xl`/`sm:text-3xl` `font-bold`.
- [ ] Highlight cards carry `shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200` **applied via `className` at the call site — `card.tsx` is unmodified** and the staff app's cards are unchanged.
- [ ] No new component library, no new npm dependency, no new shadcn primitive, and **no new motion** — `Reveal` and the hero's `animate-in` are byte-identical to before.
- [ ] MASTER.md's `--shadow-*` and `--space-*` tables are spent as Tailwind utilities; **no parallel CSS custom properties were introduced**.
- [ ] With no hero image set, the hero is single-column and reserves no empty space.
- [ ] Verified at 375 / 768 / 1024 / 1440 with no horizontal scroll, in English and Arabic, in light and dark.
- [ ] `CONVENTIONS.md`'s false "no `<img>` anywhere" claim is corrected, and § 25 records this page's visual language including the rejection of MASTER.md's FAQ page pattern.
- [ ] Every new `en` key has an `ar` counterpart, verified by flattened set-difference.
- [ ] `npx tsc -b`, `npm run lint`, `npm run check:rtl`, `npm run format:check`, `npx vite build`, `ruff check .`, `ruff format --check .`, and `makemigrations --check` all pass.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md § 16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 97.**
