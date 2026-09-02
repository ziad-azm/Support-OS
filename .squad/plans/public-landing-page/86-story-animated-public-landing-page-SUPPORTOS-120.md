# Story 86 — Animated Public Landing Page (Story: SUPPORTOS-120)

## Prerequisites

- **Story 05 completed:** [../internationalization-design-system/05-story-i18n-rtl-foundation-SUPPORTOS-9.md](../internationalization-design-system/05-story-i18n-rtl-foundation-SUPPORTOS-9.md). Verified landed: `frontend/src/shared/i18n/resources.ts` is the explicit namespace map (94 lines, one import pair plus one line per language per feature), `frontend/src/shared/i18n/direction.ts` is the only writer of `<html dir>`/`<html lang>`, and `frontend/src/shared/i18n/config.ts` exports `SUPPORTED_LANGUAGES = ['en', 'ar']`. This story adds one namespace (`landing`) to that map and writes no direction code of its own.
- **Story 06 completed:** [../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md](../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md). Verified landed: `frontend/src/shared/ui/primitives/` (the shadcn set — `button.tsx` and `card.tsx` are used here), `LanguageSwitcher.tsx`, `ThemeToggle.tsx`, and the token set in `frontend/src/index.css`. **Every colour on the landing page comes from a token** — no hex, `oklch()`, or bare `px` (CONVENTIONS.md § 19).
- **Story 42 completed:** [../customer-portal/42-story-portal-access-customer-auth-SUPPORTOS-55.md](../customer-portal/42-story-portal-access-customer-auth-SUPPORTOS-55.md). Verified landed and untouched by this story: the `/portal` tree is a top-level sibling in `frontend/src/app/router.tsx` (lines 560-668), with its own `RequireAuth` (line 571) and `RequirePermission permission="portal.access"` (line 574).
- **Story 84 completed:** [../authentication-authorization/84-story-role-based-post-login-landing-SUPPORTOS-123.md](../authentication-authorization/84-story-role-based-post-login-landing-SUPPORTOS-123.md). Verified landed: `frontend/src/shared/auth/RedirectPortalOnly.tsx` (35 lines) wraps the staff index route (`router.tsx:72-83`) and sends a `permissions === ['portal.access']` account to `/portal`. **This story is `LAND-1`'s "Routing reconciliation with AUTH-3" task** (`SupportOs backlog.MD:917`) — Story 84's guard keeps working unchanged, but the route it wraps moves from `/` to `/home`, and its docstring must be corrected to say so.
- **No backend changes.** The landing page is anonymous, static, and calls no API. Nothing under `backend/` is read or written by this story.

---

## Story Goal

`/` is currently the **staff dashboard**, gated by `RequireAuth` (`frontend/src/app/router.tsx:70`). A signed-out visitor typing the app's URL is bounced straight to `/login` — a bare centred card with an email field, a password field, and no statement of what SupportOS is. `PublicLayout` (`frontend/src/app/PublicLayout.tsx`, 17 lines) already exists as the "no staff chrome" shell for `/login`, `/chat`, `/contact`, `/set-password`, `/forgot-password`, and `/reset-password`, but it is a centred-card shell, not a landing page.

This story makes `/` a **genuinely public landing page** and moves the staff dashboard to `/home`:

1. **A signed-out visitor at `/`** sees a real introduction — a hero (product name, one-line value proposition, "Log in" and "Get a demo" calls to action), four feature highlights (omni-channel tickets, SLA automation, AI-assisted replies, reporting), a closing call-to-action band, and a footer. Fully bilingual (English/Arabic) and RTL-correct.
2. **A signed-in staff member at `/`** is redirected to `/home` — the exact `HomePage` they see today, unchanged in content.
3. **A signed-in `portal.access`-only customer at `/`** is redirected to `/home`, which Story 84's `RedirectPortalOnly` then forwards to `/portal` — same destination as today, one extra hop.
4. **Motion is tasteful and reduced-motion-safe** — a hero entrance and scroll-triggered section reveals built from `tw-animate-css` classes that are already installed and already collapsed under `prefers-reduced-motion` by `frontend/src/index.css:204-208`. **No new dependency** (CONVENTIONS.md § 17).

**Explicitly out of scope:**

- **Any backend change.** No new endpoint, no new model, no CMS-editable copy — the landing copy is i18n JSON, like every other string in this app.
- **A third shell type.** `LAND-1`'s own constraint (`SupportOs backlog.MD:915`): reuse `PublicLayout`. This story gives it a `variant` prop rather than adding a `LandingLayout`.
- **The `path: '*'` catch-all's placement** (`router.tsx:551-557`). It sits inside the `path: '/'` tree outside `RequireAuth`, so an anonymous visitor hitting a bad URL already renders `RootLayout` + `Sidebar` + `NotFoundPage`. That is pre-existing behaviour, unchanged here — see `## Edge Cases & Failure Modes`.
- **Marketing assets** — no `<img>`, no logo file, no screenshots. There is no `<img>` anywhere in this codebase today (CONVENTIONS.md § 25, "no `<img>` anywhere") and this story does not introduce the first one. Feature highlights use `lucide-react` icons, the project's only icon source.
- **A public `/pricing`, `/about`, or `/demo` page.** "Get a demo" points at the existing public `/contact` web form (`router.tsx:32-38`).

---

## Product rules (from story)

| Visitor at `/` | Today | After this story |
|---|---|---|
| Signed out, no refresh token | `RequireAuth` → `<Navigate to="/login">` — a bare login card | **`LandingPage`**, painted on the first frame with no spinner |
| Signed out, stale/expired refresh token | `<Loading />` during refresh, then `/login` | `<Loading />` during refresh, then `LandingPage` |
| Signed-in staff | `HomePage` at `/` | `<Navigate to="/home">` → the same `HomePage`, unchanged |
| Signed-in `portal.access`-only | `HomePage` route → `RedirectPortalOnly` → `/portal` | `<Navigate to="/home">` → `RedirectPortalOnly` → `/portal` (one extra hop, same destination) |
| Any visitor at `/login`, `/chat`, `/contact`, `/set-password`, `/forgot-password`, `/reset-password` | Centred card in `PublicLayout` | **Unchanged** — same centring, now inside a scroll container |

---

## Context — Read These Files First

1. `frontend/src/app/router.tsx` — read lines 8-63 (the pathless `PublicLayout` tree; note its comment at 10-15 explaining why it is pathless and separate from the staff tree, and that it has **no index route** — `/` does not match it today), lines 64-83 (the staff tree: `path: '/'` at 65, `RootLayout` at 66, `RequireAuth` at 70, `RedirectPortalOnly` at 73, `index: true` at 76 loading `HomePage` at 78), and lines 551-557 (the `*` catch-all, a direct child of `path: '/'`, **outside** `RequireAuth`). These three regions are the only ones this story edits.
2. `frontend/src/app/PublicLayout.tsx` — all 17 lines. The wrapper is one div: `className="flex min-h-dvh items-center justify-center bg-background px-4 py-6"` (line 13). Two problems for a landing page, both fixed in Task 1 — the horizontal padding forbids full-bleed section bands, and `min-h-dvh` inside a body that is `overflow-hidden` (see next item) means content taller than the viewport is **clipped with no scrollbar**.
3. `frontend/src/index.css` — read lines 175-209 (`@layer base`). Two facts drive this story's layout: `html, body { @apply h-full overflow-hidden }` (lines 179-182) — **the document itself never scrolls in this app**, every scrolling region is a nested `overflow-y-auto` container (`RootLayout.tsx:11`, `Sidebar.tsx:170`) — and the `@media (prefers-reduced-motion: reduce)` block (lines 204-208) that already collapses `.animate-in`/`.animate-out` to `0.01ms`. Also read lines 10-72 (`:root` tokens) for the names to use: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border`.
4. `frontend/src/shared/auth/RedirectPortalOnly.tsx` — all 35 lines. **This is the shape to copy** for the new `RedirectAuthenticated`: a path-less layout route element that reads `useAuth()`, branches on `status`, and returns either `<Navigate … replace />` or `<Outlet />`. Its docstring's first line ("Wraps ONLY the `/` index route") becomes wrong when the index route moves — Task 4 corrects it.
5. `frontend/src/shared/auth/AuthProvider.tsx` — read lines 16-45 (the `boot` effect). **The single most important detail for the landing page's first paint:** `if (!getRefreshToken()) { setStatus('unauthenticated'); return }` (lines 20-23) — a visitor with no stored refresh token settles without a network round-trip, but still after one painted frame, because this is a `useEffect`. The new guard therefore consults `getRefreshToken()` directly during `status === 'loading'` rather than rendering `<Loading />` and flashing a spinner at a first-time visitor.
6. `frontend/src/shared/auth/tokenStorage.ts` — read lines 1-26. `getRefreshToken()` (lines 21-26) reads `localStorage['supportos.refreshToken']` inside a `try`/`catch` returning `null`. Safe to call during render: no side effects, no throw.
7. `frontend/src/shared/auth/RequireAuth.tsx` (20 lines) and `frontend/src/shared/auth/RequirePermission.tsx` (30 lines) — the two existing guards. `RequirePermission`'s line 28 is `if (!can(permission)) return <Navigate to="/" replace />`, and its docstring (lines 18-19) says "A permission miss redirects to `/`, not to a 403 page". Both become wrong once `/` is the landing page; Task 4 retargets them to `/home`.
8. `frontend/src/shared/auth/index.ts` — all 27 lines. The barrel `router.tsx:6` imports from. Exports are grouped at lines 19-27; this story adds one line after line 23.
9. `frontend/src/features/auth/components/LoginPage.tsx` — read lines 30-33 (`const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'`) and line 36 (`onSuccess: () => navigate(from, { replace: true })`). The `?? '/'` default is the post-login landing target and must become `'/home'`. Also read lines 88-107 — the "Not a staff member?" help block linking `/contact` and `/chat`; the landing page's closing band mirrors this copy and reuses the same two destinations.
10. `frontend/src/app/HomePage.tsx` — read lines 1-23 (imports) and lines 24-52 (`QuickLinkCard`). **Not modified by this story** — only the route path that renders it changes. Read it to match card idiom: `Card`/`CardContent` from `@/shared/ui/primitives/card`, a `lucide-react` icon at `size-5 text-muted-foreground`, `transition-colors hover:bg-accent`.
11. `frontend/src/features/portal/components/PortalLayout.tsx` — read lines 26-30 and 105-118. The precedent for a non-`RootLayout` header bar: `<header className="border-b">` around a `container mx-auto flex flex-wrap items-center gap-4 px-4 py-3` row, `ms-auto` (logical, never `ml-auto`) to push the trailing controls, and `<LanguageSwitcher />` + `<ThemeToggle />` as the last two items. The landing header copies this shape.
12. `frontend/src/shared/ui/primitives/button.tsx` — read lines 7-40 (`buttonVariants`). Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; sizes include `lg` (`h-10 rounded-md px-6`). Note the base class already carries `transition-all duration-200 cursor-pointer`, and `default`/`secondary` already carry `hover:-translate-y-px active:translate-y-0` — **the CTA hover micro-interaction already exists; do not re-implement it**.
13. `frontend/src/shared/i18n/resources.ts` — read lines 1-33 (the feature imports, alphabetical by feature) and lines 51-93 (the `en`/`ar` maps). Adding the `landing` namespace is exactly two imports plus one line in each map. Note `frontend/.oxlintrc.json` lines 39-42 exempt this file from the `no-restricted-imports` cross-feature ban.
14. `frontend/.oxlintrc.json` — read lines 4-23. `react/jsx-no-literals: error` catches direct JSX text children only; CONVENTIONS.md § 18 documents the three patterns it misses (`{cond ? <p>text</p> : null}`, `{cond && <p>text</p>}`, `<span>{'text'}</span>`). Grep the new files by hand.
15. `frontend/scripts/check-rtl.mjs` — read lines 12-31 (`PATTERNS`). Run by `npm run check:rtl`. Forbids `pl-`/`pr-`/`ml-`/`mr-`/`border-l`/`border-r`/`rounded-l*`/`rounded-r*`/`left-`/`right-`/`text-left`/`text-right`/`translate-x-`. The landing page uses logical utilities throughout.
16. `CONVENTIONS.md` — § 17 (dependencies: check an existing one first), § 18 (no hardcoded strings; every `en` key must exist in `ar`; logical properties only; directional icons mirror, non-directional do not), § 19 (tokens are the single styling source), § 25 (the `design-system/supportos/MASTER.md` guidance and the forbidden-patterns list), and § 16 (**this project does not author automated tests**).
17. `design-system/supportos/MASTER.md` — read lines 165-200. Style: "Minimalism & Swiss Style — Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based". Key effects: "Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy". Forbidden: emojis as icons, missing `cursor:pointer`, **layout-shifting hovers (no scale transforms)**, low-contrast text, instant state changes, invisible focus states. CONVENTIONS.md § 25 notes this file's "FAQ/Documentation Landing" page pattern was generated for a future landing page — **this is that story**, so its section order (hero → categories → CTA) informs the layout below.
18. `SupportOs backlog.MD` — read lines 905-919 (`EPIC 15`, `STORY (LAND-1)` and its three tasks). This plan implements all three tasks in one story.

---

## Frontend Tasks

### 1 — Give `PublicLayout` a `full` variant and make it the scroll container

**File: `frontend/src/app/PublicLayout.tsx`**

Replace the whole file. The outer div becomes the scroll container (`h-dvh overflow-y-auto`) because `index.css:179-182` makes `html`/`body` `overflow-hidden` — without this, a landing page taller than the viewport is silently clipped. The inner div keeps the existing centring for the six current pages, using `min-h-full` (of the `h-dvh` parent) instead of `min-h-dvh` so centred content taller than the viewport scrolls instead of having its top cut off by `items-center`.

```tsx
import { Outlet } from 'react-router'

import { cn } from '@/shared/lib/cn'

/**
 * Shell for routes reachable with no session: `/` (the landing page),
 * `/login`, `/chat`, `/contact`, `/set-password`, `/forgot-password`,
 * `/reset-password`. Deliberately NOT `RootLayout` — no staff `Sidebar`, no
 * nav, no authenticated-only chrome. A visitor who isn't signed in (or isn't
 * staff at all, e.g. an anonymous customer starting a chat) should see a
 * clean, standalone screen, not the full app shell with nav links it has no
 * business rendering for them.
 *
 * `variant` exists so the landing page (Story 86, `LAND-1`) reuses this shell
 * instead of introducing a third layout type — the backlog's own constraint.
 * `centered` is every auth/form page: one card, middle of the screen.
 * `full` is edge-to-edge: the landing page paints its own full-bleed section
 * bands and owns its horizontal padding.
 *
 * The OUTER div is the scroll container, not `body`: `index.css`'s base layer
 * sets `html, body { h-full overflow-hidden }`, so the document never scrolls
 * and any region taller than the viewport must scroll itself. Before this
 * story the centred card was always short enough to hide that; the landing
 * page is not.
 */
export function PublicLayout({ variant = 'centered' }: { variant?: 'centered' | 'full' }) {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div
        className={cn(
          variant === 'centered' && 'flex min-h-full items-center justify-center px-4 py-6',
        )}
      >
        <Outlet />
      </div>
    </div>
  )
}
```

### 2 — New guard: send a signed-in visitor off the landing page

**Create file: `frontend/src/shared/auth/RedirectAuthenticated.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { getRefreshToken } from './tokenStorage'
import { useAuth } from './useAuth'

/**
 * Wraps ONLY the `/` index route (the public landing page, Story 86). A
 * signed-in account is sent to `/home` — the staff dashboard, which
 * `RedirectPortalOnly` then forwards to `/portal` for a `portal.access`-only
 * account. A signed-out visitor gets `<Outlet/>`: the landing page.
 *
 * The `loading` branch is deliberately NOT a plain `<Loading />`, unlike
 * `RequireAuth`/`RequirePermission`. `AuthProvider`'s boot effect settles a
 * visitor with no stored refresh token to 'unauthenticated' immediately and
 * with no network call — but it is a `useEffect`, so it runs AFTER the first
 * paint. Rendering a spinner in that window would flash a loading state at
 * every first-time visitor on the product's front door. `getRefreshToken()`
 * is the same synchronous check `AuthProvider` itself makes first
 * (`AuthProvider.tsx`), so consulting it here reaches the identical
 * conclusion one frame earlier, with no risk of showing the landing page to
 * someone who is about to be recognised as signed in.
 */
export function RedirectAuthenticated() {
  const { status } = useAuth()

  if (status === 'loading') {
    if (!getRefreshToken()) return <Outlet />
    return <Loading />
  }
  if (status === 'authenticated') return <Navigate to="/home" replace />

  return <Outlet />
}
```

**File: `frontend/src/shared/auth/index.ts`**

Add one export line after `export { RedirectPortalOnly } from './RedirectPortalOnly'` (line 23):

```ts
export { RedirectAuthenticated } from './RedirectAuthenticated'
```

### 3 — The landing page

#### 3a — `Reveal`: the scroll-triggered reveal wrapper

**Create file: `frontend/src/features/landing/components/Reveal.tsx`**

A component, not a hook: no feature in this codebase has a `hooks/` folder (the 16 features use `api`/`components`/`lib`/`locales`/`types` only), and this is used exclusively by `LandingPage.tsx`, so `src/shared/hooks/` is wrong per `frontend/src/README.md`'s "used by exactly one feature" rule.

```tsx
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

/**
 * Reveals its children once they scroll into view, using the `tw-animate-css`
 * classes already installed for the shadcn primitives — no new dependency
 * (CONVENTIONS.md § 17), and `index.css`'s `prefers-reduced-motion` block
 * already collapses `.animate-in` to 0.01ms.
 *
 * The reduced-motion check here is belt-and-braces on top of that CSS rule:
 * it skips the `opacity-0` starting state entirely, so a reduced-motion
 * visitor never depends on an IntersectionObserver callback to see content.
 *
 * `slide-in-from-bottom-*` is vertical and therefore direction-neutral —
 * `slide-in-from-left/right` would need an `rtl:` counterpart and is not used
 * anywhere on this page.
 */
export function Reveal({ children, delayMs = 0 }: { children: ReactNode; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (revealed) return
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [revealed])

  return (
    <div
      ref={ref}
      style={revealed && delayMs > 0 ? { animationDelay: `${String(delayMs)}ms` } : undefined}
      className={cn(
        revealed
          ? 'animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-700'
          : 'opacity-0',
      )}
    >
      {children}
    </div>
  )
}
```

#### 3b — `LandingPage`

**Create file: `frontend/src/features/landing/components/LandingPage.tsx`**

Sections in order (MASTER.md's page pattern, adapted — hero → highlights → CTA): header bar, hero, feature highlights, closing CTA band, footer. Every string comes from the new `landing` namespace except the product name (`t('app.name', { ns: 'common' })`, the existing key `Sidebar.tsx:160` already uses) and the two help links, which reuse `auth:help.*`.

`useTranslation(['landing', 'common', 'auth'])` at the top; every `t()` call outside the `landing` namespace passes `{ ns: 'common' }` / `{ ns: 'auth' }` explicitly, matching `PortalLayout.tsx:113`.

Structural requirements the executor must hold to:

- **Header** — `<header className="border-b">` with an inner `container mx-auto flex flex-wrap items-center gap-4 px-4 py-3`, matching `PortalLayout.tsx:27-28`. Brand `<span className="font-semibold">{t('app.name', { ns: 'common' })}</span>`; then `<div className="ms-auto flex items-center gap-2">` holding `<LanguageSwitcher />`, `<ThemeToggle />`, and `<Button asChild size="sm"><Link to="/login">…</Link></Button>`. **`ms-auto`, never `ml-auto`** — `check-rtl.mjs` fails the build on the latter.
- **Hero** — inside `<section className="container mx-auto px-4 py-16 sm:py-24">`, with the entrance animation applied directly (`className="animate-in fade-in slide-in-from-bottom-4 duration-700"`), **not** via `Reveal`: the hero is above the fold and must not wait for an observer callback. One `<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">`, one `<p className="mt-4 max-w-2xl text-lg text-muted-foreground">` for the value proposition, then a CTA row `<div className="mt-8 flex flex-wrap items-center gap-3">` with two buttons: `<Button asChild size="lg"><Link to="/login">{t('hero.login')}</Link></Button>` and `<Button asChild size="lg" variant="outline"><Link to="/contact">{t('hero.demo')}</Link></Button>`. **Do not add a hover `scale` or `translate`** — `button.tsx:12` already ships `hover:-translate-y-px active:translate-y-0` on `default`, and MASTER.md forbids layout-shifting hovers.
- **Feature highlights** — a full-bleed band: `<section className="border-y bg-card">` containing `<div className="container mx-auto px-4 py-16">` with a `<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">`. Four entries from a module-level `const` array, each a `<Reveal delayMs={index * 80}>` wrapping a `Card`/`CardContent` with a `lucide-react` icon at `size-6 text-primary`, an `<h3 className="font-medium">`, and a `<p className="text-sm text-muted-foreground">`.

  ```tsx
  const FEATURES = [
    { key: 'tickets', icon: InboxIcon },
    { key: 'sla', icon: TimerIcon },
    { key: 'ai', icon: SparklesIcon },
    { key: 'reports', icon: BarChart3Icon },
  ] as const
  ```

  All four icons are verified present in the installed `lucide-react` (`inbox`, `timer`, `sparkles`, `bar-chart-3`); `InboxIcon` and `BarChart3Icon` are already imported by `HomePage.tsx:5,6`. **The `key` values must match the `features.<key>.{title,description}` keys in the locale files below.** The array is `as const` and module-level, so `react/only-export-components` is satisfied (`allowConstantExport`, `.oxlintrc.json:7`).
- **Closing CTA band** — `<section className="container mx-auto px-4 py-16 text-center">` in a `<Reveal>`: an `<h2>`, a `<p className="text-muted-foreground">`, a primary "Log in" button, and beneath it the "Not a staff member?" line reusing `t('help.prompt', { ns: 'auth' })` with `<Link to="/contact">` and `<Link to="/chat">` styled `text-primary underline-offset-4 hover:underline`, exactly as `LoginPage.tsx:88-107` renders them.
- **Footer** — `<footer className="border-t"><div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">{t('footer.copyright', { year: new Date().getFullYear() })}</div></footer>`. The year is interpolated, not concatenated, so the `ar` string can place it correctly.
- **If an arrow icon is used on any CTA** it must carry `rtl:rotate-180` — arrows are directional (CONVENTIONS.md § 19). Checkmarks and the four feature icons above are not, and must not be flipped.

#### 3c — The `landing` namespace

**Create file: `frontend/src/features/landing/locales/en.json`**

```json
{
  "hero": {
    "headline": "Support that keeps every promise",
    "valueProposition": "SupportOS brings every customer conversation, service-level target, and support metric into one bilingual workspace your team actually enjoys using.",
    "login": "Log in",
    "demo": "Get a demo"
  },
  "features": {
    "sectionTitle": "Everything your support team runs on",
    "tickets": {
      "title": "Omni-channel tickets",
      "description": "Email, WhatsApp, SMS, live chat, and web forms land in one queue with the full history attached."
    },
    "sla": {
      "title": "SLA automation",
      "description": "Response and resolution targets tracked automatically, with escalation before a breach rather than after it."
    },
    "ai": {
      "title": "AI-assisted replies",
      "description": "Summaries, suggested replies, and automatic categorisation, so agents spend their time on the hard part."
    },
    "reports": {
      "title": "Reporting that answers questions",
      "description": "Ticket volume, SLA health, agent performance, and CSAT on one dashboard you can act on."
    }
  },
  "cta": {
    "title": "Ready when you are",
    "subtitle": "Sign in to your workspace, or send us a request and we'll walk you through it.",
    "login": "Log in"
  },
  "footer": {
    "copyright": "© {{year}} SupportOS"
  }
}
```

**Create file: `frontend/src/features/landing/locales/ar.json`** — the same key set, translated. **Every key in `en` must exist in `ar`** (CONVENTIONS.md § 18: a missing `ar` key falls back to English silently, with no warning). `footer.copyright` keeps the `{{year}}` placeholder.

**File: `frontend/src/shared/i18n/resources.ts`**

Two imports, alphabetically between the `knowledgeBase` pair (lines 13-14) and the `liveChat` pair (lines 15-16):

```ts
import landingAr from '@/features/landing/locales/ar.json'
import landingEn from '@/features/landing/locales/en.json'
```

Then one line in each map — `landing: landingEn,` in `en` (after `liveChat`, line 63) and `landing: landingAr,` in `ar` (after `liveChat`, line 84). Adding the `en` entry is what makes `t('landing:…')` typecheck: `i18next.d.ts` derives `CustomTypeOptions.resources` from the `en` map.

### 4 — Routing reconciliation

**File: `frontend/src/app/router.tsx`**

**4a — Import.** Line 6 becomes:

```tsx
import {
  RedirectAuthenticated,
  RedirectPortalOnly,
  RequireAuth,
  RequirePermission,
} from '@/shared/auth'
```

**4b — Add the landing route as the FIRST top-level entry**, immediately after `createBrowserRouter([` (line 8), before the existing pathless public tree at line 9:

```tsx
  {
    // The public front door. A second `PublicLayout` instance rather than a
    // child of the tree below, because the landing page needs the `full`
    // variant (edge-to-edge section bands) while every page below it is a
    // centred card. Same shell component, no third layout type — see
    // `SupportOs backlog.MD` LAND-1's own constraint.
    element: <PublicLayout variant="full" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RedirectAuthenticated />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { LandingPage } = await import('@/features/landing/components/LandingPage')
              return { element: <LandingPage /> }
            },
          },
        ],
      },
    ],
  },
```

**4c — Move the staff dashboard from `/` to `/home`.** In the block at lines 72-83, change `index: true` (line 76) to `path: 'home'`. Everything else in that block — the `RedirectPortalOnly` wrapper, the `lazy`/`HomePage` import — stays byte-identical:

```tsx
          {
            element: <RedirectPortalOnly />,
            children: [
              {
                path: 'home',
                lazy: async () => {
                  const { HomePage } = await import('@/app/HomePage')
                  return { element: <HomePage /> }
                },
              },
            ],
          },
```

**This is the one line that makes the landing route reachable.** Leaving `index: true` in place would give two route branches matching `/` and make which one wins depend on React Router's internal ranking — do not rely on that.

**Do not touch** the `path: '*'` catch-all (551-557), the `/portal` tree (560-668), or any other route.

**File: `frontend/src/shared/auth/RedirectPortalOnly.tsx`**

Correct the docstring, which now names the wrong route. Line 8 currently reads `Wraps ONLY the \`/\` index route (\`app/router.tsx\`'s \`HomePage\` entry) — not`. Change it, and the "every other `/` child route … redirects back to `/`" sentence at lines 16-18, to name `/home`:

```
 * Wraps ONLY the `/home` route (`app/router.tsx`'s `HomePage` entry) — not
 * the whole staff route tree. …
 *
 * Deliberately scoped to that one route: every other `/` child route is
 * already gated by its own `RequirePermission`, and a permission miss there
 * redirects to `/home` (`RequirePermission.tsx`) — which this component then
 * forwards on to `/portal`. No loop: `/portal`'s own `RequireAuth` +
 * `RequirePermission permission="portal.access"` then passes and stops there.
```

**No functional change** — the component's body is untouched.

**File: `frontend/src/shared/auth/RequirePermission.tsx`**

Line 28: `if (!can(permission)) return <Navigate to="/" replace />` becomes `<Navigate to="/home" replace />`. Update the docstring at lines 18-20 to say `/home` instead of `/`, and record why:

```
 * A permission miss redirects to `/home` (the staff dashboard), not to a 403
 * page — there is no 403 route in this app, and inventing one is a decision
 * for the first feature that needs it. It is `/home` rather than `/` because
 * Story 86 made `/` the public landing page; sending a signed-in staff member
 * to a marketing page on a permission miss is wrong, and the extra `/` →
 * `/home` hop is avoidable. `replace` keeps the unauthorized URL out of
 * history.
```

**Verified no loop:** the only other consumer is the `/portal` tree (`router.tsx:574`). A `portal.access` miss there now lands on `/home` → `RedirectPortalOnly` → the account holds at least one non-portal permission (otherwise it would have passed the portal check), so `permissions.length === 1` is false → `HomePage` renders. Terminates in two hops, same as before.

**File: `frontend/src/features/auth/components/LoginPage.tsx`**

Line 32: `?? '/'` becomes `?? '/home'`, with the reason on the line above:

```tsx
  // `/home`, not `/`: Story 86 made `/` the public landing page. A staff
  // member who logged in from the landing page's CTA has no `from` state and
  // must land on the dashboard, not back where they started.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/home'
```

**Deliberately NOT changed:** `frontend/src/app/NotFoundPage.tsx:19` (`<Link to="/">`) and `frontend/src/app/RouteErrorBoundary.tsx:15` (`navigate('/')`). Both are "Go home" affordances shown to **either** an anonymous visitor or a signed-in one, and `/` is now correct for both: anonymous sees the landing page, signed-in is forwarded to `/home` by `RedirectAuthenticated`. Making them auth-aware would duplicate the guard's logic in two more places.

**No backend changes required.**

---

## Edge Cases & Failure Modes

- **First paint for a visitor with no session.** `AuthProvider`'s boot effect (`AuthProvider.tsx:16-45`) runs after the first paint, so `status` is `'loading'` on frame one for everybody. `RedirectAuthenticated` handles this by checking `getRefreshToken()` synchronously (`tokenStorage.ts:21-26`) — `null` means `AuthProvider` is about to reach `'unauthenticated'` with no network call, so the landing page renders immediately with no spinner flash. Enforced in `RedirectAuthenticated.tsx`'s `loading` branch.
- **A visitor whose refresh token is present but expired.** `getRefreshToken()` returns a string, so the guard renders `<Loading />` while `refreshAccessToken()` round-trips (`AuthProvider.tsx:24-27`). On failure `status` becomes `'unauthenticated'` and the landing page renders. Correct, and the spinner is warranted here — there is a real network call in flight.
- **`localStorage` throws (private mode, blocked site data).** `getRefreshToken()` already wraps its read in `try`/`catch` returning `null` (`tokenStorage.ts:22-25`), so the guard takes the no-token branch and shows the landing page — the same fallback `AuthProvider` itself takes.
- **Content taller than the viewport.** `index.css:179-182` sets `html, body { h-full overflow-hidden }` — the document never scrolls. Task 1's outer `h-dvh overflow-y-auto` on `PublicLayout` is what makes the landing page scrollable at all. **Without it, everything below the fold is unreachable, with no scrollbar and no error.** Verify by scrolling to the footer in a 720px-tall window.
- **A centred auth page taller than the viewport, after Task 1.** `min-h-full` + `items-center` inside a scroll container keeps the top reachable (unlike `min-h-dvh` + `items-center` on a clipped body). This is a strict improvement for `/set-password` and `/contact` on short viewports; confirm `/contact` still centres normally on a tall one.
- **`prefers-reduced-motion: reduce`.** Two independent defences: `index.css:204-208` already collapses `.animate-in` to `0.01ms` globally, and `Reveal` initialises `revealed` to `true` from `matchMedia`, so it never applies `opacity-0` and never depends on an observer callback firing. Verify with DevTools → Rendering → "Emulate CSS prefers-reduced-motion".
- **`IntersectionObserver` and an element already in view on load.** The observer fires on `observe()` for an already-intersecting target, so a section visible at load reveals on the first callback; `rootMargin: '0px 0px -10% 0px'` only delays the reveal until the element is 10% into the viewport. Verify the second section is not stuck at `opacity-0` on a tall desktop window.
- **RTL.** The header's trailing control cluster uses `ms-auto`; `check-rtl.mjs` fails the build on `ml-auto`/`pl-`/`left-`/`text-left` and friends (`scripts/check-rtl.mjs:12-31`). `slide-in-from-bottom-*` is vertical and needs no `rtl:` counterpart; `slide-in-from-left/right` would, and is not used. Any arrow icon needs `rtl:rotate-180`; the four feature icons are non-directional and must not be flipped.
- **Bidirectional text in the footer.** `footer.copyright`'s `{{year}}` is a Latin-digit run inside an Arabic string. `INTL_LOCALE.ar` pins `numberingSystem: 'latn'` project-wide (`shared/i18n/config.ts`), and this string is a plain interpolation, not a formatter call. If the `©` and the year render with confusing punctuation order in Arabic, wrap the year in an element with `dir="ltr"` per CONVENTIONS.md § 18 — verify visually before deciding.
- **A missing `ar` key.** Falls back to the English string **silently, with no console warning** (CONVENTIONS.md § 18). Compare the two files' key sets by hand — Verification Step 4.
- **Hardcoded strings that lint will not catch.** `react/jsx-no-literals` only flags direct JSX text children; `{cond && <p>text</p>}`, `{cond ? <p>text</p> : null}`, and `<span>{'text'}</span>` all pass (CONVENTIONS.md § 18's own table). Grep the three new `.tsx` files by hand — Verification Step 5.
- **An anonymous visitor hitting an unknown URL, e.g. `/nope`.** Matches `path: '*'` (`router.tsx:551-557`), a direct child of the `path: '/'` tree **outside** `RequireAuth`, so `RootLayout` + `Sidebar` render for a signed-out visitor with `user` null (`Sidebar.tsx:348-368` already guards its user/logout block with `user ? … : null`). **Pre-existing behaviour, deliberately unchanged by this story** — moving the catch-all is a routing decision worth its own story now that a public tree exists. `NotFoundPage`'s "Go home" link still resolves correctly for both visitor types.
- **A signed-in user cannot view the landing page.** By design: `RedirectAuthenticated` forwards every authenticated visit of `/` to `/home`. To see it while developing, log out or open a private window. Stated here so it is not filed as a bug.
- **Two `<Navigate>` hops for a portal-only account** (`/` → `/home` → `/portal`). Both use `replace`, so browser history holds one entry, not three. No loop: `/portal`'s own guards pass and stop there.

---

## Test Plan

**This project does not author automated tests** (CONVENTIONS.md § 16 — "no new test file is added anywhere in the repo"). No test file is added, changed, or removed. Verification is the build/lint/RTL gates plus the manual walkthrough in `## Verification Steps`.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build`. Confirms `PublicLayout`'s new prop typechecks at both call sites in `router.tsx`, and that `t('landing:…')` resolves against the regenerated `CustomTypeOptions.resources` (a key typo fails the build here, which is the point of registering `en` in `resources.ts`).
2. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`. All three exit 0. `check:rtl` is the one that catches an `ml-auto`/`pl-6`/`text-left` slip in the new markup.
3. **Signed-out landing:** from `frontend/` — `npm run dev`, then open `http://localhost:5173/` **in a private window** (or after `localStorage.clear()`). Confirm: the landing page paints with **no spinner flash**; the hero fades and slides in once; the four feature cards reveal as you scroll; the footer is reachable (the page scrolls — this is the `PublicLayout` scroll-container change); "Log in" goes to `/login`; "Get a demo" goes to `/contact`.
4. **Arabic + RTL:** switch the header's `LanguageSwitcher` to العربية. Confirm `<html dir="rtl" lang="ar">`, the header's control cluster moves to the left edge, the hero text is right-aligned, no horizontal scrollbar appears, and **no English string leaks through** — then diff the key sets directly:
   ```bash
   cd frontend && node -e "const a=require('./src/features/landing/locales/ar.json'),e=require('./src/features/landing/locales/en.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const A=new Set(f(a)),E=f(e);console.log('missing in ar:',E.filter(k=>!A.has(k)))"
   ```
   Expect `missing in ar: []`.
5. **No hardcoded strings:** from `frontend/` — `grep -nE ">[A-Za-z][A-Za-z ]{3,}<|\{'[A-Za-z][A-Za-z ]{3,}'\}" src/features/landing/components/*.tsx`. Every hit must be a `t(...)` call or an attribute, never literal user-facing prose. `npm run lint` catches only the direct-JSX-child case (CONVENTIONS.md § 18).
6. **Reduced motion:** DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", reload `/`. Confirm every section is visible immediately with no fade or slide, and nothing is stuck invisible.
7. **Dark mode:** toggle the header's `ThemeToggle` through Light / Dark / System on `/`. Confirm the hero, the `bg-card` highlights band, the CTA band, and the footer all read correctly in both themes with no hardcoded colour showing through.
8. **Signed-in staff redirect:** log in as a staff account (e.g. role `agent`). Confirm the post-login URL is `/home` (not `/`) and `HomePage` renders exactly as before this story — same greeting, stats, quick-link cards, sidebar. Then type `http://localhost:5173/` in the address bar: confirm it lands on `/home`, not the landing page.
9. **Signed-in portal-only redirect (Story 84 regression):** log in with a `customer`-role account (permissions `['portal.access']`). Confirm it ends on `/portal` (`PortalHomePage`). Then hit `http://localhost:5173/` directly and confirm it ends on `/portal` again, via `/home`, with no redirect loop — watch the URL bar for more than two hops.
10. **Permission-miss regression:** as a staff account **without** `customers.view`, navigate to `http://localhost:5173/customers`. Confirm it lands on `/home` (`HomePage`), not on the landing page and not in a loop.
11. **Existing public pages unchanged:** visit `/login`, `/contact`, `/chat`, `/forgot-password` signed out. Confirm each still renders as one centred card, vertically and horizontally centred on a tall window, with the same padding as before.
12. **Regression — "Go home" affordances:** signed out, visit `http://localhost:5173/nope` and click "Go home"; confirm the landing page. Signed in as staff, do the same; confirm `/home`.

---

## Done Criteria

- [ ] `http://localhost:5173/` renders a landing page for a signed-out visitor, with no spinner flash on first paint.
- [ ] The landing page has a header (brand, `LanguageSwitcher`, `ThemeToggle`, "Log in"), a hero with a headline, a one-line value proposition and two CTAs ("Log in" → `/login`, "Get a demo" → `/contact`), four feature highlights (omni-channel tickets, SLA automation, AI-assisted replies, reporting), a closing CTA band, and a footer.
- [ ] The page scrolls end-to-end — `PublicLayout`'s outer div is the scroll container (`h-dvh overflow-y-auto`), because `index.css` makes `body` `overflow-hidden`.
- [ ] The hero animates in on load; the highlight cards and CTA band reveal on scroll; both collapse to no motion under `prefers-reduced-motion: reduce`. **No new npm dependency was added** — `git diff frontend/package.json` is empty.
- [ ] `frontend/src/features/landing/locales/{en,ar}.json` exist with identical key sets, registered in `frontend/src/shared/i18n/resources.ts` as the `landing` namespace. The page renders fully in Arabic with `dir="rtl"` and no English leakage.
- [ ] `frontend/src/shared/auth/RedirectAuthenticated.tsx` exists, is exported from `frontend/src/shared/auth/index.ts`, and wraps only the `/` index route.
- [ ] `router.tsx`'s staff dashboard route is `path: 'home'` (no `index: true` remains in the `path: '/'` tree); the `RedirectPortalOnly` wrapper around it is otherwise unchanged; the `*` catch-all and the `/portal` tree are untouched.
- [ ] A staff account lands on `/home` after login and is redirected there from `/`; a `portal.access`-only account still ends on `/portal`.
- [ ] `RequirePermission`'s miss target is `/home`, and both it and `RedirectPortalOnly` have docstrings that name the correct routes.
- [ ] `LoginPage`'s `from` default is `'/home'`.
- [ ] `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0 from `frontend/`.
- [ ] `00-overview.md` (this feature) and `.squad/plans/00-index.md` both list this story.
- [ ] `SupportOs backlog.MD` `EPIC 15` / `STORY (LAND-1)` (lines 905-919) checked against this plan's final scope — all three of its tasks are covered here; update the backlog if the two drift.
