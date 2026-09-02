# public-landing-page — plan overview

Entry point for the **public-landing-page** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 86 | [86-story-animated-public-landing-page-SUPPORTOS-120.md](86-story-animated-public-landing-page-SUPPORTOS-120.md) | Animated Public Landing Page (LAND-1) | SUPPORTOS-120 | Stories 05, 06 (`I18N`/`UI`, complete), Story 42 (`/portal` tree, complete), Story 84 (`RedirectPortalOnly`, complete) |

## Dependency notes

`EPIC 15` (`SupportOs backlog.MD` lines 905-919) is a single story, `LAND-1`, with
three tasks — landing page content & layout, entrance motion & micro-interactions,
and routing reconciliation with `AUTH-3`. **All three are covered by Story 86**; the
epic is fully planned, not yet implemented.

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
