# public-landing-page — plan overview

Entry point for the **public-landing-page** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 86 | [86-story-animated-public-landing-page-SUPPORTOS-120.md](86-story-animated-public-landing-page-SUPPORTOS-120.md) | Animated Public Landing Page (LAND-1) | SUPPORTOS-120 | Stories 05, 06 (`I18N`/`UI`, complete), Story 42 (`/portal` tree, complete), Story 84 (`RedirectPortalOnly`, complete) |
| 94 | [94-story-editable-landing-content-SUPPORTOS-124.md](94-story-editable-landing-content-SUPPORTOS-124.md) | Editable Landing Content, Admin CMS (LAND-2) | SUPPORTOS-124 | Story 86 (this feature, landed), Story 90 (`BrandingView` public-read path, landed), Stories 87/89 (ordered-row admin pattern, landed), Story 40 (`Article` bilingual columns, landed), Story 07 (`FORM`) |
| 95 | [95-story-social-contact-presence-SUPPORTOS-125.md](95-story-social-contact-presence-SUPPORTOS-125.md) | Social Media & Contact Presence (LAND-3) | SUPPORTOS-125 | Story 94 (this feature, **implemented** — extends its model set, public serializer and `shared/landing/` module), Story 19 (`/contact` web form, landed), Story 11 (`ContactDetail` channel+value shape, landed) |
| 96 | [96-story-landing-visual-redesign-SUPPORTOS-126.md](96-story-landing-visual-redesign-SUPPORTOS-126.md) | Landing Page Visual Redesign (LAND-4) | SUPPORTOS-126 | Stories 94/95 (this feature, **implemented** — restyles their section components), Stories 36/50/51 (`DSN` token layer, landed), Story 64 (`DSN-9` breakpoints, landed). **NOT blocked on `MOTION-0`** — see below |
| 97 | [97-story-shared-motion-foundation-SUPPORTOS-128.md](97-story-shared-motion-foundation-SUPPORTOS-128.md) | Shared Motion Foundation (MOTION-0) | SUPPORTOS-128 | Story 86 (`LAND-1`, the motion it extracts), Story 94 (already moved `Reveal` out of `features/`), Story 37 (`DSN-2` reduced-motion policy), Story 51/63 (`DSN-5`/`DSN-8`, button feedback already done) |

## Dependency notes

`EPIC 15`'s `LAND-1` is a single story with three tasks — landing page content &
layout, entrance motion & micro-interactions, and routing reconciliation with
`AUTH-3`. **All three are covered by Story 86**, which is now implemented.

`LAND-2` (`SUPPORTOS-124`) is **Story 94**, and its five tasks — content model +
public read endpoint, API-with-bundle-fallback rendering, editable highlights, the
admin editor, and the live preview — are all covered by that one plan. It is
**implemented**.

`LAND-3` (`SUPPORTOS-125`) is **Story 95** — an admin-managed social/contact link
list riding Story 94's existing public payload, rendered in the landing footer and
on `/contact`. It is **implemented**.

`LAND-4` (`SUPPORTOS-126`) is **Story 96** — the visual redesign of the page the
three stories above built. It is **implemented**.

`MOTION-0` (`SUPPORTOS-128`) is **Story 97** — the shared motion vocabulary the
whole app consumes, extracted from the motion `LAND-1` improvised. Planned, not yet
implemented. **With it, `EPIC 15` is fully planned.**

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

---

## Story 95 (`LAND-3`) — the three findings that shaped it

**`/contact` is finished, so the CTA does not move.** The intake's third task says to
resolve this *by inspection* rather than assume. Inspected: `router.tsx:61-67` routes
`/contact` to `WebFormPage` (149 lines) — a working name/email/subject/description/
category form that creates a ticket and renders a success card with its id. So the
intake's "either wire the real contact channels into it **or** repoint the CTA"
resolves to the first branch. The real gap is narrower than "unfinished": the page
tells a visitor how to open a ticket and start a live chat, but never shows the
organization's own phone, email, or social channels. Story 95 adds those beneath the
form and leaves the CTA target alone (it is admin-configurable through Story 94's
`hero_secondary_cta_target` anyway).

**`lucide-react` has no brand icons, so the intake's icon constraint cannot be met
literally.** Verified against the installed 1.34.0: all 6098 exports, and no
Facebook, X, Instagram, LinkedIn, YouTube, GitHub, Twitch or Slack. Lucide removed
its brand set. The "fixed choice set, no free-text icon names" half of the constraint
stands and is preserved; the "mapped to curated lucide-react icons" half is met only
for the generic platforms (`website`→`GlobeIcon`, `email`→`MailIcon`,
`phone`→`PhoneIcon`, `whatsapp`→`MessageCircleIcon`). Brand marks become **inline
SVG paths checked into one module** — no new dependency (CONVENTIONS.md § 17), inline
`<svg>` already has precedent (`shared/ui/chart/GaugeChart.tsx:72`), and § 25's "no
`<img>` anywhere" still holds because an inline `<svg>` is not an `<img>`. Source is
Simple Icons (CC0). The alternative — adding `react-icons` for ten glyphs — was
rejected on size.

**`customers.ContactDetail` already solved this data shape, so Story 95 copies it
rather than inventing one.** That model (CUST-2) pairs a `Channel` `TextChoices` with
ONE generic `value` column, and puts per-channel format validation in the
**serializer** because "DRF does not call model `clean()`". `LandingSocialLink` is
that model for the organization's own presence: a `Platform` choice set, one `value`,
plus `is_enabled` and `order`. No FK between them and no shared base — same shape,
different table, different audience.

**The one edit that can break Story 94.** `PublicLandingContentSerializer.Meta.fields`
ends in `highlights`, and `LandingContentAdminSerializer` derives its own list by
slicing that one entry off with `[:-1]`. Adding a second read-only nested field makes
that slice wrong, and a wrong slice makes the admin serializer try to write a
`SerializerMethodField` — a 500 on every landing-copy save. Story 95 widens it to
`[:-2]`, updates both comments, and asserts the result in its verification steps
rather than trusting the edit.

Deliberately left out and named as such: a second bilingual label column (platform
names are proper nouns), any change to `customers.ContactDetail`, LAND-4's eventual
placement of the block (the row ships as a standalone component so it can be moved
without a rewrite), click analytics, link-health checks, and uploaded brand logos.

---

## Story 96 (`LAND-4`) — the four decisions it makes, and why

**The hero image is a URL, not an upload — decided, because the intake demanded a
decision.** `config/settings/base.py:170-174` records that this project has **no
`MEDIA_URL`**: uploads exist (`customers.Attachment.file` is a real `FileField`)
but every byte leaves through `AttachmentViewSet.download`, permission-gated, "never
through Django's own unguarded static/media serving". A landing hero must be
readable with **no session at all**, so shipping it as an upload means either
reversing that stance or writing a second deliberately-public download view for one
image — both bigger decisions than this story owns. Meanwhile `logo_url` already
proves the URL path works end to end, and `BrandMark.tsx:27-42` already proves the
render pattern (external URL + `object-contain` + size cap + `onError` fallback,
each with its reason in a comment). So: one `blank=True` `URLField` on
`LandingContent`, zero new endpoints.

**`MOTION-0` is listed as a dependency but does not block this story.** It has no
plan, and `SupportOs backlog.MD:951` still describes it as unstarted. Two facts make
proceeding safe: its second task ("move `Reveal.tsx` into the shared layer") was
**already half-done by Story 94**, which moved it to `shared/landing/Reveal.tsx` with
no feature-local copy left behind; and Story 96 **adds no animation at all** — every
change is static type, spacing, surface and border, plus one 200ms card-hover state
transition that `DSN-8` already owns the category for. `Reveal` and the hero's
`animate-in` come out of this story byte-identical.

**MASTER.md's page pattern is rejected; its style guidance is adopted.**
`design-system/supportos/pages/` is **empty**, so MASTER.md's single generated
"FAQ/Documentation Landing" pattern — section order "Hero with search bar > Popular
categories > FAQ accordion > Contact/support CTA" — is the only page-level direction
the `DSN` layer has, and it describes a help centre, not a product front door. A
search bar as the hero CTA is wrong for a signed-out visitor with nothing to search;
a FAQ accordion would duplicate `KB-1`'s portal browse outside the session. Story 86
already made this call and Story 96 holds it. What **is** adopted is everything
above that section: Swiss-minimalist style, the 200-250ms hover window, the Cards
spec (`shadow-md` → `shadow-lg` + a 2px lift), the spacing values, the Anti-Patterns
list, and the Pre-Delivery Checklist's own four responsive checkpoints
(375/768/1024/1440), which is the concrete answer to "the breakpoints `DSN-9`
established".

**MASTER.md's `--shadow-*` and `--space-*` tables are spent as Tailwind utilities,
not introduced as CSS variables.** `index.css` has no `--shadow-*` today (verified —
only `--radius` and its derivations), and `card.tsx`/`button.tsx` already spend
Tailwind's `shadow-*` scale. Adding a parallel token scale would give one concept two
names. The card treatment is applied **per-usage via `className`**, never by editing
`card.tsx`, so the staff app's ~40 other `Card` usages keep their flat `shadow-sm`.

One stale record gets corrected on the way through: `CONVENTIONS.md:1701` still
claims there is "no `<img>` anywhere", which ORG-3 falsified when it shipped
`BrandMark.tsx:29`. Story 96 rewrites that clause rather than leaving the next reader
to trust it.

Deliberately left out and named as such: a social-proof section (no model exists for
customer logos or testimonials, and inventing placeholders would ship fake content on
the front door), any new shadcn component or dependency, any copy or i18n change
beyond the two new admin-form keys, and the staff app.

---

## Story 97 (`MOTION-0`) — the five things discovery settled

**Task 2 was already half-done, and the plan says so instead of failing on it.** The
intake asks to "move `features/landing/components/Reveal.tsx` into the shared UI
layer". That file has not existed since **Story 94**, which moved it to
`shared/landing/Reveal.tsx` with no feature-local copy left behind — exactly what
Story 96's plan predicted when it declined to block on `MOTION-0`. What actually
remains is the shorter move from `shared/landing/` (a domain folder) to `shared/ui/`
(where generic primitives live), plus re-expressing the one `duration-700` literal as
a token. Two lines and a delete.

**Two of the intake's named targets do not exist.** Task 3 lists "dialog and sheet
enter/exit" and "dropdown and popover motion". `frontend/src/shared/ui/primitives/`
holds 18 files and **neither `sheet.tsx` nor `popover.tsx` is among them**. The plan
does not create components in order to animate them; it names the omission.

**Button press feedback is already shipped, twice over.** `button.tsx:8` carries
`transition-all duration-200 cursor-pointer` with `hover:-translate-y-px
active:translate-y-0` on the filled variants (Story 51, `DSN-5`), and Story 63
(`DSN-8`) then recorded in its own Prerequisites that "no task in this plan re-touches
`button.tsx`/`input.tsx`/`select.tsx`". Story 97 re-touches none of them either, and a
verification step checks their diff is empty.

**The intake's "nothing moves under `prefers-reduced-motion`" contradicts a
documented DSN-2 decision — and DSN-2 is right.** `CONVENTIONS.md:1672-1674` records
that "loading spinners/skeletons **deliberately keep animating**". Freezing
`animate-spin`/`animate-pulse` turns a loading state into an indistinguishable broken
one, which is worse for exactly the users the preference protects. The plan holds the
carve-out, restates it as policy — *no **decorative** motion; loading feedback
exempt* — and finally writes the reasoning into the CSS rather than leaving it in a
plan file. A verification step checks both halves.

**Route transitions get the boring mechanism, deliberately.** Two obvious approaches
were checked and rejected: the **View Transitions API** (`react-router@8.3.0` does
export `useViewTransitionState`, but driving it needs a `viewTransition` prop at every
`<Link>` — precisely the per-screen change the intake's own "shared-component level
only" constraint forbids), and **keying the `<Outlet/>` wrapper on `pathname`** (three
characters shorter and wrong: changing a `key` remounts the routed subtree, and React
Router deliberately keeps a component mounted across a param change like
`/tickets/1` → `/tickets/2`). What ships is a class re-trigger on `<main>` — no
remount, no added latency, and it reuses `.animate-in` so the existing reduced-motion
rule already covers it.

Also settled by inspection: `tw-animate-css@1.4.0` already provides the entire
enter/exit engine (`--animate-in`/`--animate-out` plus the `--tw-enter-*`/`--tw-exit-*`
custom properties), Tailwind v4 provides the `--ease-*` and `--animate-*` theme
namespaces — so **no animation dependency is added, and none is needed**. Tailwind v4
has **no `--duration-*` namespace**, which is why the duration scale ships as `:root`
variables consumed via `duration-(--motion-base)` while the easings ship as `@theme`
entries that generate real utilities. And `tw-animate-css` being a devDependency
despite `index.css` importing it is **correct** — Tailwind inlines it at build time —
so the plan says not to "fix" it.
