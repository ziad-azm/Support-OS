# public-landing-page — plan overview

Entry point for the **public-landing-page** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 86 | [86-story-animated-public-landing-page-SUPPORTOS-120.md](86-story-animated-public-landing-page-SUPPORTOS-120.md) | Animated Public Landing Page (LAND-1) | SUPPORTOS-120 | Stories 05, 06 (`I18N`/`UI`, complete), Story 42 (`/portal` tree, complete), Story 84 (`RedirectPortalOnly`, complete) |
| 94 | [94-story-editable-landing-content-SUPPORTOS-124.md](94-story-editable-landing-content-SUPPORTOS-124.md) | Editable Landing Content, Admin CMS (LAND-2) | SUPPORTOS-124 | Story 86 (this feature, landed), Story 90 (`BrandingView` public-read path, landed), Stories 87/89 (ordered-row admin pattern, landed), Story 40 (`Article` bilingual columns, landed), Story 07 (`FORM`) |

## Dependency notes

`EPIC 15`'s `LAND-1` is a single story with three tasks — landing page content &
layout, entrance motion & micro-interactions, and routing reconciliation with
`AUTH-3`. **All three are covered by Story 86**, which is now implemented.

`LAND-2` (`SUPPORTOS-124`) is **Story 94**, and its five tasks — content model +
public read endpoint, API-with-bundle-fallback rendering, editable highlights, the
admin editor, and the live preview — are all covered by that one plan. It is
planned, not yet implemented.

**Story 86 is frontend-only.** No backend module, model, endpoint, or setting is
read or written. The landing copy lives in a new `landing` i18n namespace
(`frontend/src/features/landing/locales/{en,ar}.json`), not in a database — the same
posture every other user-facing string in this project takes (`CONVENTIONS.md` § 18).

**The one structural decision it makes, and why.** `/` today is the staff dashboard
behind `RequireAuth` (`frontend/src/app/router.tsx:70`), so there is no URL a
signed-out visitor can reach that is not a form. Story 86 makes `/` public and moves
the dashboard to **`/home`** — the alternative (keeping the dashboard on `/` and
putting the landing page on `/welcome`) was rejected because a product's front door
that only exists at a secondary URL is not a front door. Three consequences the plan
handles explicitly rather than leaving to discovery:

- **`RequirePermission`'s miss target moves from `/` to `/home`.** Verified no loop
  against its only two consumers (the staff tree and `/portal`).
- **`LoginPage`'s `from` default moves from `/` to `/home`.** A staff member who
  logged in from the landing page's own CTA carries no `from` state.
- **`RedirectPortalOnly` (Story 84) keeps working untouched** — only the route it
  wraps is renamed, and its docstring is corrected to say `/home`. A portal-only
  account still ends on `/portal`, now via one extra `replace` hop.

**Two live constraints found in the code during planning**, both of which would
silently break a landing page written without them:

- **`html, body { h-full overflow-hidden }`** (`frontend/src/index.css:179-182`) —
  the document never scrolls in this app. `PublicLayout` becomes the scroll container
  (`h-dvh overflow-y-auto`) or everything below the fold is unreachable, with no
  scrollbar and no error.
- **`AuthProvider`'s boot runs in a `useEffect`**, so `status` is `'loading'` on the
  first painted frame for *every* visitor, signed in or not. The new
  `RedirectAuthenticated` guard consults `getRefreshToken()` synchronously in that
  window — the same check `AuthProvider` makes first — so a first-time visitor never
  sees a spinner on the product's front door.

**Motion adds no dependency.** `tw-animate-css` is already installed and already
imported by `frontend/src/index.css:2` for the shadcn primitives, and `index.css`'s
`prefers-reduced-motion` block (lines 204-208) already collapses `.animate-in` to
`0.01ms`. The scroll reveals are an `IntersectionObserver` in a local
`Reveal` component that additionally short-circuits to "revealed" under reduced
motion, so a reduced-motion visitor never depends on an observer callback to see
content.

Deliberately left out and named as such:

- **Moving the `path: '*'` catch-all** out of the staff tree (`router.tsx:551-557`).
  It renders `RootLayout` + `Sidebar` for an anonymous visitor hitting a bad URL —
  pre-existing, and a routing decision worth its own story now that a public tree
  exists.
- **Marketing assets** — no `<img>`, logo file, or screenshot. There is no `<img>`
  anywhere in this codebase (`CONVENTIONS.md` § 25) and Story 86 does not add the
  first one.
- **A public `/pricing`, `/about`, or `/demo` page.** "Get a demo" points at the
  existing public `/contact` web form (`WEB-1`, Story 19).

---

## Story 94 (`LAND-2`) — the four decisions it makes, and why

**A second singleton model, not fourteen more columns on `OrganizationSettings`.**
That model's own docstring now says it "holds only scalars — branding and the two
org-wide SLA defaults", and `OrganizationSettingsSerializer` publishes all of them
to `settings.manage` holders. Landing copy has a different audience and its own
public read path, so it gets `LandingContent` (same `pk=1` mechanism, copied) and
`LandingHighlight` (a real model — CONVENTIONS.md § 33: ORG-1 and ORG-2 promoted
this codebase's last two JSON list columns, and "a future story wanting a list of
things on that model should create a model, not a column").

**A sibling public view, not a wider `BrandingSerializer`.** `/api/branding/` is
fetched on *every* route by `<BrandingSync>` because it drives the brand colour and
the document title; landing copy is needed on exactly one route. Merging them would
ship ~20 unused strings to every signed-in agent's first paint and break that
serializer's "THREE FIELDS, DELIBERATELY" contract. `/api/landing/` copies
`BrandingView`'s `authentication_classes = []` + `AllowAny` pair verbatim and
declares no `throttle_classes`, so it inherits the `anon` baseline rather than
replacing it (CONVENTIONS.md § 36). The visible cost — `/` now spends two requests
from a shared 300/hour per-IP anon bucket — is named in the plan's edge cases.

**Blank means "fall back", and the fallback lives on the frontend.** The bundle
strings are i18n resources; copying them into Python would create a second source of
truth for the same sentence. So the API returns the empty string it stores and
`src/shared/landing/resolve.ts` is the single place `''` becomes the shipped
default — per field, per locale. An admin who fills in only English gets an English
override and the shipped Arabic, which is precisely the "or the Arabic side silently
freezes" failure the intake names.

**The landing presentation moves to `src/shared/landing/sections/`.** Not a
refactor for its own sake: `no-restricted-imports` (`.oxlintrc.json:8-19`) forbids
`features/organization/` importing from `features/landing/`, so the only way the
admin preview can render the *real* markup instead of a fork that drifts is for that
markup to live in `shared/`. `Reveal` moves with it and gains a `disabled` prop — an
`IntersectionObserver` keyed on the viewport leaves sections stuck at `opacity-0`
inside a bounded preview panel, and a blank preview is worse than an unanimated one.

Deliberately left out of Story 94 and named as such: a rich-text or Markdown editor
for marketing copy, uploaded images (still no `<img>` in this codebase), free-text
icon names, per-branch landing content, drag-and-drop reordering, and any new
permission string — writes reuse `settings.manage`.
