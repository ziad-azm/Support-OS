# Story 90 — Custom Branding (Story: SUPPORTOS-114)

## Prerequisites

- **SEC-4 completed:** [../security-administration/53-story-system-configuration-SUPPORTOS-75.md](../security-administration/53-story-system-configuration-SUPPORTOS-75.md). It shipped `OrganizationSettings.name` (`backend/apps/organization/models.py:103`) and `.logo_url` (`:104`), `OrganizationSettingsSerializer`, `SettingsView` (`backend/apps/organization/views.py:70-88`), `OrganizationSettingsAdmin`, `Permissions.SETTINGS_MANAGE`, and the frontend `features/organization/` module with its `/settings` screen. The backlog line for this story is *"Branding settings + dynamic theming — Implement logo/colors/name via system config applied through `UI` tokens"* (`SupportOs backlog.MD:944`), and its only stated dependency is SEC-4.
- **ORG-2 completed:** [89-story-multi-branch-SUPPORTOS-113.md](89-story-multi-branch-SUPPORTOS-113.md). It removed the **last** JSON list column from `OrganizationSettings`, deleted `SettingsPage.tsx`'s local `StringListField`, and left that screen editing scalars only (`name`, `logo_url`, and the two SLA defaults). **This story is the only one left in the epic that edits `SettingsPage`** — task 20 adds one field to a form that is now four `TextField`s and nothing else. ORG-2 is not a functional dependency (branding touches neither `Department` nor `Branch` nor `apps/core/scoping.py`), but it is a **file-level** one: this plan's line numbers for `models.py`, `serializers.py`, and `SettingsPage.tsx` are all post-ORG-2.
- **DSN-0 through DSN-5 completed:** [../design-intelligence-ui-ux-system/00-overview.md](../design-intelligence-ui-ux-system/00-overview.md), especially Story 36 (token reconciliation) and Story 51 (app shell). The token layer this story writes into is `frontend/src/index.css` — `:root` (`:10-73`), `.dark` (`:75-123`), and `@theme inline` (`:125-172`). `CONVENTIONS.md` §19 (381-500) is the governing rule: *"Every colour, radius, and font stack comes from a token — no hex, `rgb()`, `oklch()`, or bare `px` in a component."* Task 23 records the one runtime exception this story introduces.
- **LAND-1 completed:** [../public-landing-page/86-story-public-landing-page-SUPPORTOS-121.md](../public-landing-page/86-story-public-landing-page-SUPPORTOS-121.md). `LandingPage.tsx` and `PublicLayout.tsx` (`frontend/src/app/PublicLayout.tsx:26-38`) are the public shell whose header task 18 rebrands.
- **PORTAL-0 completed:** [../customer-portal/42-story-portal-foundation-SUPPORTOS-66.md](../customer-portal/42-story-portal-foundation-SUPPORTOS-66.md). `PortalLayout.tsx:29` is the customer-facing brand surface (task 17) — the *"brand-matched portal/app"* half of the intake's outcome.
- **AUTH-1 completed:** [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md). `LoginPage.tsx` (task 19) and, critically, the Axios request interceptor (`frontend/src/shared/lib/api/client.ts:62-77`) which attaches `Authorization` **only when a token exists** — so a pre-login `GET /api/branding/` is an ordinary anonymous request with no 401-refresh path to trip over. Verified.

### Verified findings that shape this story

- 🔑 **`name` and `logo_url` are rendered NOWHERE today.** `grep -rn "logo_url\|logoUrl" frontend/src backend/apps` returns hits in exactly three frontend files — `features/organization/components/SettingsPage.tsx`, `features/organization/types/settings.ts`, and one *comment* in `features/integrations/components/ErpSettingsPage.tsx:48` — plus the model/serializer/migration on the backend. **SEC-4 shipped the storage; nothing ever consumed it.** This story is where those two fields first become visible, which is why it is much more than "add a colour column".
- 🔑 **Four brand surfaces are hardcoded, and none of them reads the database:**
  | Surface | File | Renders today |
  |---|---|---|
  | Staff shell | `frontend/src/app/Sidebar.tsx:164` | `t('app.name')` — a **locale string** |
  | Public landing | `frontend/src/features/landing/components/LandingPage.tsx:31` | `t('app.name', { ns: 'common' })` |
  | Customer portal | `frontend/src/features/portal/components/PortalLayout.tsx:29` | `t('shell.title')` — the **`portal`** namespace, a different key |
  | Browser tab | `frontend/index.html:7` | `<title>SupportOS</title>`, static |
  `common.json`'s `app` block is `{"name": "SupportOS"}` in both `en` and `ar`. `LoginPage.tsx:53-56` has **no brand at all** — a `LogInIcon` in a `bg-primary/10` circle above `t('login.title')`, which is the natural logo slot. `grep -rn "document.title" frontend/src` returns **nothing**: no code manages the tab title.
- 🔑 **`GET /api/settings/` is gated on `settings.manage`, which is admin-only** (`backend/apps/organization/views.py:81`). That blocks branding for **two** classes of caller, not one: an anonymous visitor on `/` or `/login` (no session at all), **and every authenticated non-admin** — an agent's sidebar must show the org name and logo, and an agent does not hold `settings.manage`. A **separate public read endpoint is therefore mandatory, not an optimisation.** Relaxing `SettingsView`'s own permission is not the fix — see the next finding.
- 🔑 **Reusing `OrganizationSettingsSerializer` for that public endpoint would leak the SLA defaults to anonymous callers.** Its `Meta.fields` (`backend/apps/organization/serializers.py:55-63`) includes `default_response_target_minutes` and `default_resolution_target_minutes`. Task 3 declares a **separate narrow serializer** with exactly three fields; do not import or subclass the settings one.
- 🔑 **`frontend/src/shared/theme/` is the precedent to copy for runtime token application**, not to invent around. `theme.ts` (56 lines) owns a module-level `current`, a `localStorage` read/write in try/catch, an `apply()` that is *"the only place the `dark` class is written"*, a `Set` of listeners, and an `initTheme()` that `index.ts` calls as an import side effect; `useTheme.ts` exposes it through `useSyncExternalStore`; `main.tsx:10` imports the module for its side effect; and `frontend/index.html:26-35` re-applies it before first paint to avoid a flash. `shared/branding/` (tasks 7-14) is that same six-part shape.
- 🔑 **An inline style on `<html>` beats both `:root` and `.dark`.** The `.dark` block is a class selector on `document.documentElement`; an inline `style` property on that same element wins the cascade over both. So **one** brand value covers both themes with no dark-mode variant — which is exactly what `--primary` already does today: `index.css:87` sets the dark value identical to `:root`'s, commented *"same as :root, see Story 36"*. Confirmed by reading both blocks.
- 🔑 **DRF carries a model field's `validators` into the auto-generated serializer field.** Verified against the installed DRF (`.venv/Lib/site-packages/rest_framework/utils/field_mapping.py`): `get_field_kwargs` opens with `validator_kwarg = list(model_field.validators)` (`:93`) and assigns `kwargs['validators'] = validator_kwarg` (`:246`). A `RegexValidator` on `OrganizationSettings.primary_color` is therefore enforced on the API path **with no `validate_primary_color` method** — the opposite of `clean()`, which DRF never calls and which is why `Role.clean()`/`RoleAdminSerializer.validate_permissions` must be written twice (CONVENTIONS.md §22). Task 1 relies on this; task 2 must **not** add a redundant validator.
- **A failing query does not toast.** `createQueryClient` (`frontend/src/shared/lib/api/queryClient.ts:62-66`) toasts a query error only when the query opts in with `meta.toastOnError`. Branding must not opt in: a branding fetch that fails on the login page must fall back silently, never show an error to someone trying to sign in.
- **Query defaults are `staleTime: 30_000`, `refetchOnWindowFocus: false`, retry on transport/5xx only** (`queryClient.ts:47-57`). Task 10 raises `staleTime` for branding deliberately.
- **`shared/auth/` is the precedent for a shared *domain* module that owns PascalCase components** — `Can.tsx`, `RequireAuth.tsx`, `RequirePermission.tsx` all live there, and its `index.ts` performs import-time side effects (`setAuthTokenProvider`). So `shared/branding/BrandMark.tsx` (task 11) is in keeping with §19's `shared/ui/` rule rather than an exception to it: `shared/ui/` is for generic primitives, `shared/<domain>/` for a domain's own component. State this in the file header.
- **No `tailwind.config.js` exists** (§19: *"Tailwind v4 is CSS-first… adding one creates a second source of truth"*). Nothing in this story adds one; the brand colour reaches Tailwind through `@theme inline`'s existing `--color-primary: var(--primary)` mapping (`index.css:132`), so `bg-primary`/`text-primary`/`border-primary` all follow the runtime override with **zero utility-class changes anywhere in the app.**

---

## Story Goal

Make the organisation's own name, logo, and brand colour reach every screen — staff app, customer portal, login, and public landing — through the existing token layer, so the product looks like the customer's product rather than SupportOS.

1. **A brand colour is configurable.** `OrganizationSettings.primary_color` — one `#RRGGBB` field, validated identically on both sides, blank meaning "use the DSN default".
2. **Branding is publicly readable, and only branding is.** `GET /api/branding/` returns exactly `name`, `logo_url`, `primary_color` to anonymous callers. Writes stay where they are: `PATCH /api/settings/`, `settings.manage`.
3. **Tokens are written at runtime, in one place.** `shared/branding/` sets exactly **two** custom properties on `document.documentElement` — `--primary` and a `--primary-foreground` derived from it by WCAG relative luminance so brand-coloured buttons stay legible. Everything else stays in `index.css`.
4. **No flash of the default blue.** The resolved values are cached in `localStorage` and re-applied by the inline script in `index.html` before first paint, exactly as the theme already is.
5. **All four surfaces show the real brand.** `Sidebar`, `PortalLayout`, `LandingPage`, and `LoginPage` render one shared `BrandMark`; the browser tab title follows the org name.
6. **An admin can set and reset it.** `/settings` gains a colour field with a live swatch and the derived-foreground preview; clearing it restores the DSN default.

### Explicitly not in scope

- **No logo file upload.** `logo_url` stays a URL. This is SEC-4's own recorded decision, quoted in the model docstring (`models.py:97-101`): *"combining a file upload with this model's JSON list fields in one request would need an unprecedented parsing path in this codebase"*. ORG-2 removed the JSON lists, so half of that reason is gone — but the other half (no `MultiPartParser` anywhere on this model, no storage/validation/resizing story for it) stands, and an upload pipeline is a story, not a task. Recorded as a follow-up.
- **Not a palette editor. One colour, not twenty tokens.** An admin sets `--primary` only. `--background`, `--foreground`, `--card`, `--muted`, and `--border` stay fixed. Reason: `--primary` is the only token that reads as "brand" (buttons, links, focus accents, the login mark), while the surface/text tokens are what make the app *readable* — Story 51 derived them as a set with verified contrast ratios, and letting an admin set them individually is how you ship an unreadable app. The contrast-pairing problem also multiplies: one editable colour needs one derived foreground (task 8), six need fifteen checked pairs.
- **No dark-mode-specific brand colour.** One value, both themes — the choice `index.css:87` already made for `--primary`.
- **No favicon swap.** `/favicon.svg` is a build-time asset served by Vite, and swapping it needs an uploaded file (same blocker as the logo). The tab *title* does follow the brand (task 15); the icon does not.
- **No email-template or PDF-export branding.** `apps/accounts/tasks.py`'s invite mail and the RPT-1 CSV export are untouched. Both are separate render paths with their own template layers.
- **No per-department or per-branch branding.** `OrganizationSettings` is a singleton by construction (`save()` forces `pk=1`, `models.py:145-147`); one brand per deployment. ORG-1/ORG-2's org units carry no visual identity.
- **`--ring` is not rebranded.** The focus ring stays `#475569` (`index.css:47-49`), verified in Story 51 at 4.03:1 against `--background`. Tying it to an arbitrary brand colour would put a WCAG 2.4.11 floor at the mercy of a colour picker.

---

## Context — Read These Files First

1. `backend/apps/organization/models.py:77-157` — `OrganizationSettings`. The docstring (78-101), which task 1 extends: note it already describes this model as holding *"branding (`name`, `logo_url`)"* (93) and states the no-upload decision (97-101). `name` (103) and `logo_url` (104) are the two fields this story finally surfaces. `clean()` (124-143) validates only the SLA-target comparison after ORG-2 — task 1 adds **nothing** to it (see the DRF-validators finding). The singleton `save`/`delete`/`load` (145-157) are untouched.
2. `backend/apps/organization/serializers.py:37-73` — `OrganizationSettingsSerializer`. `Meta.fields` (55-63) is the tuple task 2 extends, and **the tuple task 3 must not reuse** — lines 60-61 are the SLA defaults that must stay out of the public payload. The docstring (38-52) already records that this serializer carries "branding and the two org-wide SLA defaults, and nothing else"; task 3's new class sits beside it.
3. `backend/apps/organization/views.py:70-88` — `SettingsView`. `permission_map` (81) is the `settings.manage` gate on **both** `get` and `patch`; task 4's `BrandingView` is its public read-only sibling, not a modification of it. Read the docstring's "keyed by lowercased HTTP method rather than a DRF `action`" note (72-79) — task 4 needs no `permission_map` at all.
4. `backend/apps/core/views.py:65-87` — `HealthView`. The exact shape task 4 copies for a genuinely public endpoint: **`authentication_classes: list = []`** *and* `permission_classes = [AllowAny]`, plus its docstring rule *"Returns a plain dict: never build an envelope in a view, or the renderer will pass the hand-made one through and the shape drifts."* Contrast `PermissionCatalogView` (`:90-113`), which is the *gated* plain-`APIView` shape.
5. `backend/apps/organization/urls.py:1-18` — the `SimpleRouter`-plus-`path()` urlconf. Task 5 adds one `path()` line beside the existing `settings/` one; the router registrations for departments/branches are untouched.
6. `frontend/src/index.css:10-73` (`:root`) and `:75-123` (`.dark`) — the token blocks. The two lines this story overrides at runtime are **`--primary` (26 in `:root`, 87 in `.dark`)** and **`--primary-foreground` (27 and 88)**. Read the comment on 87 (*"same as :root, see Story 36"*) — it is the justification for one brand value across both themes.
7. `frontend/src/index.css:125-172` — `@theme inline`. `--color-primary: var(--primary)` (132) and `--color-primary-foreground: var(--primary-foreground)` (133) are why overriding the two custom properties reaches every `bg-primary`/`text-primary`/`border-primary` utility in the app with no class changes. **Do not edit this block.**
8. `frontend/src/shared/theme/config.ts:1-21` — the contract module task 7 mirrors: a `THEMES` const, a `FALLBACK_*`, a `*_STORAGE_KEY` with the comment *"Also read by the inline anti-FOUC script in index.html — keep in sync"*, and the class/media-query constants. Nothing hardcodes a key elsewhere.
9. `frontend/src/shared/theme/theme.ts:1-56` — the runtime module task 9 mirrors, function for function: `read()` (6-14, `localStorage` in try/catch with a fallback and the *"Private mode, or storage disabled"* comment), module-level `current` (16), `apply()` (22-26, *"the only place the `dark` class is written"*), `getTheme`/`setTheme`/`subscribeTheme` (28-48), `initTheme()` (50-56).
10. `frontend/src/shared/theme/useTheme.ts:1-9` and `index.ts:1-8` — the `useSyncExternalStore` hook and the side-effect `index.ts` that calls `initTheme()` at import. Tasks 9 and 12 copy both.
11. `frontend/src/main.tsx:1-19` — the side-effect import block and its comment explaining ordering (*"must run before any component calling useTranslation() or useTheme() is imported"*). Task 13 adds one line; the ordering rationale in that comment tells you where.
12. `frontend/index.html:1-43` — `<title>SupportOS</title>` (7) and the anti-FOUC script (14-37). Task 14 extends that script. Read its existing comments closely: it documents that the language key is *"a bare string… no JSON.parse needed here"* — task 14's branding key **is** JSON, so the new block must say so and parse defensively.
13. `frontend/src/app/Sidebar.tsx:162-176` — the sidebar header: `t('app.name')` at 164, rendered only when not `collapsed`, inside a `flex items-center gap-2 border-b px-3 py-3` row that also holds the collapse toggle. Task 16 replaces the `<span>` and must keep the collapsed-state behaviour and the `flex-1 truncate` layout.
14. `frontend/src/features/portal/components/PortalLayout.tsx:21-30` — the portal header. `t('shell.title')` at 29 (the `portal` namespace, **not** `common:app.name` — the two brand strings differ today). Task 17 replaces it.
15. `frontend/src/features/landing/components/LandingPage.tsx:26-40` — the landing header, `t('app.name', { ns: 'common' })` at 31, beside `LanguageSwitcher`/`ThemeToggle`/a login CTA. Task 18 replaces the `<span>`.
16. `frontend/src/features/auth/components/LoginPage.tsx:50-57` — the centred mark: a `size-12 rounded-full bg-primary/10` circle wrapping `<LogInIcon className="size-6 text-primary" />`, above `<h1>{t('login.title')}</h1>`. Task 19 puts the logo here and keeps the icon as the no-logo fallback. Note both existing classes already track `--primary`, so this block rebrands itself once task 9 runs.
17. `frontend/src/features/organization/components/SettingsPage.tsx:1-110` — post-ORG-2 this file is a `schema` (18-40) with a `superRefine` URL check, `toDefaults` (44-51), `toSettingsInput` (53-55), and a form of four `TextField`s. Read the `superRefine` block (25-40) and its comment: it is the precedent task 20 follows for a format check that reuses an existing translated Zod error rather than inventing a message.
18. `frontend/src/features/organization/types/settings.ts:1-19` — both shapes task 21 extends.
19. `frontend/src/features/organization/api/useUpdateSettings.ts:1-13` and `settingsKeys.ts` — the mutation invalidates `settingsKeys.all` only. Task 20 must **also** invalidate the branding key, or saving a colour leaves the running app on the old one until reload.
20. `frontend/src/shared/lib/api/client.ts:62-77` and `:156-160` — the request interceptor (token attached only when present; `Accept-Language` and `X-Request-ID` always) and `api.get<T>` (which unwraps the envelope and returns `.data`). Task 10's fetcher is a one-liner on top of this.
21. `frontend/src/shared/lib/api/queryClient.ts:47-66` — the query defaults (`staleTime: 30_000`, no focus refetch) and the `meta.toastOnError` opt-in. Task 10 sets a longer `staleTime` and deliberately omits the opt-in.
22. `frontend/src/app/providers.tsx:33-55` — the provider tree. `QueryClientProvider` (46) is the innermost wrapper around `{children}`; task 15's `<BrandingSync />` must go **inside** it (a react-query hook cannot run above it) and above the router, so it mounts once for every route including the public ones.
23. `frontend/src/shared/auth/index.ts:1-29` — a shared domain module that both performs import-time side effects and exports PascalCase components. The precedent for `shared/branding/`'s own `index.ts` (task 12).
24. `frontend/src/shared/departments/` and `frontend/src/shared/branches/` (5 files each) — the shared-query module shape (`types.ts`, `<domain>Keys.ts`, `get<Domain>.ts`, `use<Domain>.ts`, `index.ts`) that task 10 follows for the fetch half of `shared/branding/`.
25. `CONVENTIONS.md` §19 (381-500) — the token rule task 23 amends, in particular *"Every colour… comes from a token — no hex, `rgb()`, `oklch()`, or bare `px` in a component"*. §22 (787-902) for the validation-split rule the DRF-validators finding narrows. §18 (272-380) for RTL, which the logo `<img>` must not break.
26. `design-system/supportos/MASTER.md:21-26` — the DSN colour roles. `Accent/CTA #2563EB` (25) is the value `--primary` carries today and the default a blank `primary_color` restores.

---

## Product rules (from story)

| Rule | Current behaviour | New behaviour | Enforcement point |
|---|---|---|---|
| **The org's name is data, not a translation.** | `Sidebar`/`LandingPage` render `common:app.name` ("SupportOS"); `PortalLayout` renders `portal:shell.title`. | All three render `OrganizationSettings.name`, falling back to `common:app.name` when it is blank. | Tasks 11, 16-18. The locale key **stays** — it is the fallback for a fresh deployment that has configured nothing, and the default for the `<title>`. |
| **A logo appears wherever the name does.** | No logo anywhere, despite `logo_url` being editable since SEC-4. | `BrandMark` renders `<img src={logo_url}>` when set, the name as text otherwise, and the name as text again if the image fails to load. | Task 11. One component, four call sites — a second copy of this fallback chain is how one surface ends up silently blank. |
| **One brand colour, two derived tokens.** | `--primary` is fixed at DSN `#2563EB`. | `primary_color` overrides `--primary`; `--primary-foreground` is derived from it by relative luminance, never stored and never configurable. | Tasks 8, 9. Storing a foreground would let an admin pick an illegible pair; deriving it means every brand colour is legible by construction. |
| **Blank means default, not blank.** | n/a | An empty `primary_color` **removes** the two inline properties, so `index.css`'s `:root`/`.dark` values apply again. It must never set them to `''`. | Task 9's `apply()`. `style.removeProperty`, not `setProperty(name, '')` — see `## Edge Cases`. |
| **Exactly `#RRGGBB`.** | n/a | Seven characters, case-insensitive, validated by one regex used on the model **and** re-checked in the browser. Three-digit shorthand, `rgb()`, and bare names are rejected. | Task 1's `RegexValidator` (carried into DRF automatically — verified) and task 7's `HEX_COLOR_RE`. One canonical form means the cached value, the CSS value, and the stored value are the same string. |
| **Reading branding is public. Writing it is admin-only.** | `GET /api/settings/` requires `settings.manage`, so neither an anonymous visitor nor an agent can read the brand. | `GET /api/branding/` is `AllowAny` with no authentication; `PATCH /api/settings/` is unchanged at `settings.manage`. | Tasks 3-5. The public endpoint is **read-only and has no write verb at all** — not a permissive settings endpoint. |
| **Public means branding, and nothing else.** | — | The public payload is exactly `name`, `logo_url`, `primary_color`. The two SLA defaults are not in it. | Task 3's separate serializer. Verification Step 5 asserts the exact key set, so a later field added to `OrganizationSettingsSerializer` cannot leak through by inheritance. |
| **Branding must never block or interrupt rendering.** | — | A failed or slow branding fetch leaves the app on the cached value, or the DSN default. No spinner, no error boundary, no toast. | Task 10 omits `meta.toastOnError`; task 15 renders nothing. A branding error on the login page must be invisible to the person signing in. |
| **No flash of the wrong brand.** | The theme already avoids this via `index.html`. | The resolved `--primary`/`--primary-foreground` and the name are cached in `localStorage` and re-applied before first paint. | Tasks 9, 14. The inline script does **no** colour math — it reads two already-resolved strings, the same way the theme script reads one. |
| **The token layer stays the single styling source.** | §19: no colour literals in a component. | Still true. The brand hex is written by **one** module (`shared/branding/branding.ts`), into the **two** custom properties `index.css` already declares. No component gains a colour literal, and no utility class changes. | Task 23 records this as §19's one sanctioned runtime override, with the module named. |

---

## Backend Tasks

### 1 — `primary_color` on `OrganizationSettings`

**File: `backend/apps/organization/models.py`**

Add the module-level regex above `Department` (there is no module-level helper left after ORG-2 deleted `_validate_string_list`, so this is the file's only one):

```python
# Exactly `#RRGGBB`. Anchored, case-insensitive. Three-digit shorthand,
# `rgb()`, and colour names are all rejected on purpose: this string is
# written straight into a CSS custom property and cached in localStorage,
# so one canonical form means the stored value, the cached value, and the
# painted value are the same seven characters. Mirrored on the frontend as
# `HEX_COLOR_RE` (src/shared/branding/config.ts).
HEX_COLOR_VALIDATOR = RegexValidator(
    regex=r"^#(?:[0-9a-fA-F]{6})$",
    message=_("Enter a colour as #RRGGBB."),
)
```

Import it with `from django.core.validators import RegexValidator`.

Then add the field to `OrganizationSettings`, immediately after `logo_url` (line 104):

```python
    # The brand's accent colour — ORG-3. Overrides the `--primary` design
    # token at runtime (src/shared/branding/), which `@theme inline` maps to
    # `--color-primary`, so every `bg-primary`/`text-primary` utility in the
    # app follows it with no class changes.
    #
    # Blank means "use the DSN default" (`#2563EB`, MASTER.md line 25), NOT
    # "no colour" — the frontend removes its inline override rather than
    # writing an empty value. See Story 90 `## Product rules`.
    #
    # No companion `primary_foreground_color`: the readable text colour is
    # DERIVED from this one by WCAG relative luminance
    # (src/shared/branding/contrast.ts). Storing it would let an admin
    # configure an illegible pair.
    primary_color = models.CharField(
        _("brand colour"),
        max_length=7,
        blank=True,
        validators=[HEX_COLOR_VALIDATOR],
    )
```

**Do not add anything to `clean()`.** DRF carries a model field's `validators` into the generated serializer field (verified — see `## Prerequisites`), and Django's own admin forms run them through `full_clean()`. This is the case where the §22 write-it-twice rule does **not** apply, and the docstring should say so.

Extend the `OrganizationSettings` docstring's branding sentence (line 93) to name the third field and the derivation:

```python
    scalars — branding (`name`, `logo_url`, `primary_color`) and the two
    org-wide SLA defaults. There is no JSON column left, which is why
    `clean()` no longer validates a list shape.

    `primary_color` is read publicly through `BrandingView`, unlike every
    other field here: the login page and the public landing page have no
    session, and even a signed-in agent lacks `settings.manage`. That is
    why the public serializer is a separate, narrower class — see
    `serializers.py`.
```

**Generate:**

```powershell
cd backend
python manage.py makemigrations organization
```

Expect `apps/organization/migrations/0011_organizationsettings_primary_color.py`, one `AddField`, `dependencies = [("organization", "0010_grant_branch_permissions")]`. **No data migration:** existing rows get `""`, which already means "DSN default", so every deployment keeps exactly today's appearance until an admin sets a colour.

---

### 2 — `primary_color` on the settings serializer

**File: `backend/apps/organization/serializers.py`** — add `"primary_color"` to `OrganizationSettingsSerializer.Meta.fields` (55-63), immediately after `"logo_url"` (58).

**Add no validator method.** The model field's `RegexValidator` is already on the generated serializer field. Adding `validate_primary_color` would double the error message for one bad value.

---

### 3 — `BrandingSerializer` — narrow, public, read-only

**File: `backend/apps/organization/serializers.py`** — add **above** `OrganizationSettingsSerializer` (so the file reads public-surface-first):

```python
class BrandingSerializer(serializers.ModelSerializer):
    """The public face of `OrganizationSettings` — ORG-3.

    THREE FIELDS, DELIBERATELY. This is served to anonymous callers
    (`BrandingView`), so it is a separate class rather than a subclass of
    `OrganizationSettingsSerializer` below: that one carries
    `default_response_target_minutes`/`default_resolution_target_minutes`,
    and inheriting from it would publish the organisation's SLA policy to
    the internet the next time someone added a field to it. A narrow
    hand-listed tuple is the whole safety mechanism here.

    Not `BaseModelSerializer`: the timestamps that base exists for are not
    part of a branding payload either.

    Read-only by construction — `BrandingView` defines no write verb, and
    branding is written through `PATCH /api/settings/` under
    `settings.manage`. Narrow-public-mirror of a wider internal serializer,
    the same shape `accounts.DepartmentBriefSerializer`/
    `BranchBriefSerializer` use for `/auth/me/`.
    """

    class Meta:
        model = OrganizationSettings
        fields = ("name", "logo_url", "primary_color")
```

No `id`: a singleton's primary key is `1` and tells a caller nothing.

---

### 4 — `BrandingView` — the public read endpoint

**File: `backend/apps/organization/views.py`** — add **above** `SettingsView` (70); extend the imports on lines 8-9 for `BrandingSerializer`, and add `AllowAny` to the `rest_framework.permissions` import on line 1:

```python
class BrandingView(APIView):
    """Public branding — ORG-3. The only endpoint in this app reachable
    without a session.

    `authentication_classes = []` AND `permission_classes = [AllowAny]`,
    the same explicit-open pair `HealthView` (apps/core/views.py:65-87)
    uses. Both are needed: `AllowAny` alone would still run
    authentication, so a stale or malformed `Authorization` header on a
    visitor's first request would 401 the login page's own branding.

    WHY THIS EXISTS AT ALL, rather than relaxing `SettingsView` below:
    two different callers need branding and neither can have
    `settings.manage`. An anonymous visitor on `/` or `/login` has no
    session; a signed-in agent has one but is not an admin. Widening
    `SettingsView` would have published the SLA defaults to both.

    GET only, so any other verb 405s through Django's own
    `http_method_not_allowed` — no `http_method_names` override needed,
    the same reasoning `SettingsView` records for itself. No
    `permission_map`: `HasPermission` is not in the permission classes, so
    there is nothing to key.

    Returns the serializer's plain dict; the renderer builds the envelope
    (apps/core/views.py:65-70's rule).
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(BrandingSerializer(OrganizationSettings.load()).data)
```

`load()` (`models.py:155-157`) is `get_or_create(pk=1)`, so a deployment where nobody has opened `/settings` yet returns three empty strings rather than a 404 — which the frontend reads as "use every default".

---

### 5 — Route it

**File: `backend/apps/organization/urls.py`** — extend the import on line 4 and add one entry to `urlpatterns` (15-17), before the `settings/` path:

```python
urlpatterns = router.urls + [
    # Public (see BrandingView). Deliberately a sibling of `settings/`
    # rather than nested under it — nesting a public path inside a path
    # whose siblings are all admin-gated is how one gets opened by
    # accident later.
    path("branding/", BrandingView.as_view(), name="branding"),
    path("settings/", SettingsView.as_view(), name="settings"),
]
```

No change to `config/api_urls.py`: `apps.organization.urls` is already included at `path("")` (`:15`), so this lands at `/api/branding/`.

---

### 6 — Django admin

**File: `backend/apps/organization/admin.py`** — **no change required.** `OrganizationSettingsAdmin` declares only `readonly_fields` and the three singleton overrides; with no `fields`/`fieldsets`, `primary_color` appears on the change form automatically, and its `RegexValidator` runs through the admin form's `full_clean()`. State this explicitly in the implementation notes rather than adding a no-op edit.

---

## Frontend Tasks

### 7 — `shared/branding/config.ts` — the contract

**Create file: `frontend/src/shared/branding/config.ts`** — `shared/theme/config.ts`'s counterpart:

```ts
/**
 * The branding contract. Everything else imports from here — no module
 * hardcodes the storage key or a token name.
 */

/** Mirrors `apps.organization.models.HEX_COLOR_VALIDATOR`. */
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Also read by the inline anti-FOUC script in index.html — keep in sync.
 * Unlike the theme and language keys, this one holds JSON. */
export const BRANDING_STORAGE_KEY = 'supportos.branding'

/** The two custom properties this module is allowed to write, and the only
 * runtime exception to CONVENTIONS.md §19's "colours come from tokens"
 * rule. Declared in index.css (`:root` lines 26-27, `.dark` 87-88) and
 * mapped to Tailwind by `@theme inline` (132-133) — which is why
 * overriding them reaches every `bg-primary`/`text-primary` utility with
 * no class changes. */
export const PRIMARY_TOKEN = '--primary'
export const PRIMARY_FOREGROUND_TOKEN = '--primary-foreground'

/** Picked for contrast against the brand colour, never configured. */
export const ON_LIGHT = '#000000'
export const ON_DARK = '#FFFFFF'
```

The two hex literals here are the **token layer**, not a component — the same role `index.css`'s `oklch()` literals play. §19's prohibition is on colour literals *in components*; task 23 records this.

### 8 — `shared/branding/contrast.ts` — the derived foreground

**Create file: `frontend/src/shared/branding/contrast.ts`**:

```ts
import { ON_DARK, ON_LIGHT } from './config'

/** WCAG 2.x relative luminance (w3.org/TR/WCAG21/#dfn-relative-luminance).
 * Channel-wise sRGB de-gamma, then the standard 0.2126/0.7152/0.0722
 * weighting — green dominates because human vision does. */
function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** Black or white, whichever is readable ON `hex`.
 *
 * 0.179 is the crossover where black and white text hit the same contrast
 * ratio against a background; above it black wins, below it white does.
 * Using it means every brand colour an admin can enter produces a legible
 * button, which is why `primary_color` has no stored companion. */
export function foregroundFor(hex: string): string {
  return relativeLuminance(hex) > 0.179 ? ON_LIGHT : ON_DARK
}
```

Keep this file free of DOM access — it is pure arithmetic, and task 9 is the only caller.

### 9 — `shared/branding/branding.ts` — the runtime module

**Create file: `frontend/src/shared/branding/branding.ts`** — `shared/theme/theme.ts`'s counterpart, function for function. Requirements, not a transcription:

- `export type Branding = { name: string; logo_url: string; primary_color: string }` (in `types.ts`, task 10) and a module-level `current: Branding` seeded from `read()`.
- **`read()`** — `JSON.parse` of `BRANDING_STORAGE_KEY` inside try/catch, returning `EMPTY_BRANDING` (three empty strings) on absence, malformed JSON, **or** a parsed value that is not an object with three string fields. Carry `theme.ts:10-13`'s comment about private mode. A corrupt cache must degrade to defaults, never throw at boot.
- **`apply(branding)`** — the only place `--primary`/`--primary-foreground` are written:

```ts
function apply(branding: Branding): void {
  const root = document.documentElement
  const colour = HEX_COLOR_RE.test(branding.primary_color) ? branding.primary_color : null
  if (colour === null) {
    // removeProperty, NOT setProperty(token, ''): an empty inline value
    // still shadows index.css's `:root`/`.dark` declarations, which would
    // paint every primary surface transparent instead of restoring the
    // DSN default. Blank means default, not blank (`## Product rules`).
    root.style.removeProperty(PRIMARY_TOKEN)
    root.style.removeProperty(PRIMARY_FOREGROUND_TOKEN)
    return
  }
  // Inline style beats both `:root` and `.dark` (a class selector on this
  // same element), so one value covers both themes — the choice
  // index.css:87 already made for --primary.
  root.style.setProperty(PRIMARY_TOKEN, colour)
  root.style.setProperty(PRIMARY_FOREGROUND_TOKEN, foregroundFor(colour))
}
```

  Note the re-validation: a value that reached the database by `loaddata` or raw SQL, bypassing the validator, must not be written into a CSS property.
- **`setBranding(next)`** — assign `current`, write the cache (try/catch, `theme.ts:34-38`'s comment), `apply(next)`, notify listeners.
- **`getBranding()` / `subscribeBranding(listener)`** — the `useSyncExternalStore` pair.
- **`initBranding()`** — `apply(current)` only. **No fetch here**: this module must not import the API client (a boot-time network call before `AppProviders` mounts is exactly the coupling `shared/theme` avoids). Task 15 owns fetching.

### 10 — The fetch half of `shared/branding/`

**Create four files**, following `shared/branches/`'s shape:

- **`types.ts`** — `Branding` (three strings, mirroring `apps.organization.serializers.BrandingSerializer`) and `EMPTY_BRANDING`.
- **`brandingKeys.ts`** — `export const brandingKeys = featureKey('branding')`, with a comment that `features/organization`'s settings mutation invalidates this prefix (task 20).
- **`getBranding.ts`** — `api.get<Branding>('/branding/')`. One line, plus a comment that this is the app's only unauthenticated GET from `src/` and needs no token.
- **`useBranding.ts`**:

```ts
export function useBranding() {
  return useQuery({
    queryKey: brandingKeys.resource('current'),
    queryFn: fetchBranding,
    // Branding changes when an admin saves /settings, which invalidates
    // this key directly — polling for it is pointless. The default 30s
    // (queryClient.ts:51) would refetch on every route change.
    staleTime: Infinity,
    // No `meta.toastOnError` on purpose: a branding failure must be
    // invisible. The login page falls back to the cached value or the DSN
    // default; it must never show an error to someone signing in.
  })
}
```

### 11 — `shared/branding/BrandMark.tsx`

**Create file: `frontend/src/shared/branding/BrandMark.tsx`** — one component, four call sites:

```tsx
/**
 * The organisation's logo, or its name, or the product default — in that
 * order. ORG-3's single brand surface: `Sidebar`, `PortalLayout`,
 * `LandingPage`, and `LoginPage` all render this, because a second copy of
 * this fallback chain is how one surface ends up silently blank when a
 * logo URL rots.
 *
 * A PascalCase component inside `shared/<domain>/` rather than
 * `shared/ui/`, the same placement `shared/auth/Can.tsx` established:
 * `shared/ui/` is for generic primitives, a domain folder owns its own
 * component (CONVENTIONS.md §19/§23).
 */
export function BrandMark({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const branding = useBranding().data ?? getBranding()
  const [imageFailed, setImageFailed] = useState(false)
  const name = branding.name || t('app.name')

  if (branding.logo_url !== '' && !imageFailed) {
    return (
      <img
        src={branding.logo_url}
        alt={name}
        // Height-capped and `object-contain`: `logo_url` is an arbitrary
        // external URL, so the image's own dimensions are unknown and a
        // 2000px-wide banner must not blow out the sidebar.
        className={cn('h-6 w-auto max-w-32 object-contain', className)}
        // A rotted URL, a private host, or an http:// logo blocked as
        // mixed content on an https:// page all land here. Falling back to
        // the name is the difference between a rebrand and a blank header.
        onError={() => setImageFailed(true)}
      />
    )
  }
  return <span className={cn('truncate font-semibold', className)}>{name}</span>
}
```

`useBranding().data ?? getBranding()` is deliberate: the cached value paints immediately on first render, and the fetched value replaces it. **No RTL classes** — `h-`/`w-`/`max-w-`/`object-contain` are all direction-neutral, which is what keeps `npm run check:rtl` green.

### 12 — `shared/branding/index.ts`

**Create file: `frontend/src/shared/branding/index.ts`** — `shared/theme/index.ts`'s counterpart: call `initBranding()` at import, then re-export `getBranding`, `setBranding`, `subscribeBranding`, `useBranding`, `useBrandingStore` (the `useSyncExternalStore` hook), `BrandMark`, and `type Branding`.

### 13 — Boot order

**File: `frontend/src/main.tsx`** — add `import './shared/branding'` to the side-effect block, **after** `'./shared/theme'` (10) and before `'./shared/validation'`. Extend that block's comment (5-8) with the reason: branding writes inline custom properties on `<html>` and must run before the first component render, exactly as the theme class must; it comes after `shared/theme` because both write to `document.documentElement` and the theme's class is what decides which `index.css` block the un-overridden tokens come from.

### 14 — Anti-FOUC

**File: `frontend/index.html`** — extend the existing script (14-37) with a third block, inside the same `try`:

```js
        // Same idea again, for branding: paint the brand colour before
        // first paint. The bundle re-applies this authoritatively at boot
        // (src/shared/branding/branding.ts). Key must match
        // BRANDING_STORAGE_KEY in src/shared/branding/config.ts.
        //
        // UNLIKE the two keys above, this one holds JSON, not a bare
        // string — hence JSON.parse. The values are already RESOLVED
        // (the module computed the foreground and validated the hex before
        // caching), so there is no colour maths here and no second copy of
        // contrast.ts to drift.
        var brand = JSON.parse(window.localStorage.getItem('supportos.branding') || 'null')
        if (brand && typeof brand.primary === 'string' && brand.primary) {
          document.documentElement.style.setProperty('--primary', brand.primary)
          document.documentElement.style.setProperty('--primary-foreground', brand.primaryForeground)
        }
```

**This fixes the cache shape:** the cached object is `{ name, logo_url, primary, primaryForeground }` — the raw `name`/`logo_url` for `BrandMark`, plus the two **resolved** CSS values so this script stays arithmetic-free. Task 9's `setBranding` writes that shape and `read()` parses it; `config.ts` documents it.

Also change `<title>SupportOS</title>` (7) to the neutral product default and let task 15 own it at runtime — leave the tag itself in place so a JS-disabled or pre-boot view still has a title.

### 15 — `BrandingSync` — fetch, apply, and the tab title

**Create file: `frontend/src/app/BrandingSync.tsx`**:

```tsx
/**
 * Fetches branding once per session and pushes it into
 * `shared/branding`'s store, which writes the two custom properties and
 * refreshes the cache for the next cold start. Renders nothing.
 *
 * Lives in `app/` and is mounted inside `QueryClientProvider` (a
 * react-query hook cannot run above it) and above the router, so it
 * covers every route — including `/`, `/login`, and `/portal`, which is
 * the whole point: those are the surfaces that cannot read
 * `/api/settings/`.
 *
 * Deliberately NOT inside `shared/branding/`: that module must stay
 * free of any API-client import so it can run as a boot-time side effect
 * before providers exist. Same split `shared/theme` keeps.
 */
export function BrandingSync() {
  const { data } = useBranding()
  const { t } = useTranslation('common')

  useEffect(() => {
    if (data) setBranding(data)
  }, [data])

  useEffect(() => {
    // The one place document.title is written — nothing managed it before
    // this story (index.html's static tag was it).
    document.title = data?.name || t('app.name')
  }, [data, t])

  return null
}
```

**File: `frontend/src/app/providers.tsx`** — render `<BrandingSync />` immediately before `{children}` inside `QueryClientProvider` (47).

### 16 — Staff shell

**File: `frontend/src/app/Sidebar.tsx`** — replace the `<span>` on 164 with `<BrandMark className="flex-1" />`, keeping the `{collapsed ? null : …}` conditional and the surrounding row (163-176) untouched. When collapsed the sidebar is 16 units wide and shows icons only — a logo there would be squeezed, so the existing conditional is correct as-is. `truncate font-semibold` moves into `BrandMark`'s text branch (task 11), so pass only `flex-1`.

### 17 — Customer portal

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — replace the `<span>` on 29 with `<BrandMark />`. **Keep `portal:shell.title` in the locale files** — it is still the portal's own document heading in other contexts and removing it is not this story's business; note in the diff that the header no longer reads it.

### 18 — Public landing

**File: `frontend/src/features/landing/components/LandingPage.tsx`** — replace the `<span>` on 31 with `<BrandMark />`. This is the first render of `BrandMark` with no session at all, so it is the one that proves task 4's `authentication_classes = []`.

### 19 — Login

**File: `frontend/src/features/auth/components/LoginPage.tsx`** — in the centred mark (52-56), render the logo when there is one and keep the existing `LogInIcon` circle as the fallback:

```tsx
        <BrandLoginMark />
        <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
```

Add `BrandLoginMark` as a small local component in the same file (single consumer — the same "compose, don't generalise" rule §23 applies to `TicketConversation`): when `logo_url` is set it renders `<BrandMark className="h-12 max-w-48" />`; otherwise it renders today's `size-12 rounded-full bg-primary/10` circle with `<LogInIcon className="size-6 text-primary" />` unchanged. Both `bg-primary/10` and `text-primary` already track `--primary`, so the fallback rebrands itself with no edit — worth a one-line comment so nobody "fixes" it later.

### 20 — The settings form

**File: `frontend/src/features/organization/components/SettingsPage.tsx`** — five edits:

1. `schema` (18-40): add `primary_color: optionalString(7).transform((value) => value ?? '')`, then extend the existing `.superRefine` (32-40) with a second check that a non-empty value matches `HEX_COLOR_RE`, adding the issue on `['primary_color']`. Follow the `logo_url` precedent exactly, including its comment's reasoning about reusing an existing translated error rather than inventing a message — here the message is a new key (`settings.invalidColor`) because Zod has no hex-colour primitive to borrow from.
2. `toDefaults` (44-51): add `primary_color: settings.primary_color`.
3. A `TextField` for `primary_color` after the `logo_url` one (~102-105), with `type="color"`'s **caveat**: a native colour input cannot express "unset" and always reports a value (defaulting to `#000000`), which would make "clear the brand colour" impossible. Use a **text** field plus a swatch, not `type="color"`.
4. A live preview beside the field: a small square filled with the current value and a sample "button" using the derived foreground from `foregroundFor` (task 8), so an admin sees the contrast decision before saving. Render it only while the value passes `HEX_COLOR_RE`; a half-typed `#12` shows nothing rather than a flash of black. **Do not** call `setBranding` from the form — repainting the whole app on every keystroke is how a colour picker becomes a strobe. The app repaints on save, via edit 5.
5. **File: `frontend/src/features/organization/api/useUpdateSettings.ts`** — invalidate `brandingKeys.all` alongside `settingsKeys.all`. Without this, an admin saves a new colour and the running app keeps the old one until a reload — the single most likely "it didn't work" report from this story.

### 21 — Settings types

**File: `frontend/src/features/organization/types/settings.ts`** — add `primary_color: string` to both `OrganizationSettings` (3-11) and `SettingsInput` (14-19).

### 22 — Locales

**File: `frontend/src/features/organization/locales/{en,ar}.json`** — add to `settings.fields`: `primaryColor` ("Brand colour" / "لون العلامة"). Add to `settings`: `colorHint` (explaining `#RRGGBB` and that empty restores the default), `invalidColor` ("Enter a colour as #RRGGBB."), and `colorPreview` (an aria-label for the swatch).

`common:app.name` **stays unchanged in both languages** — it is now the documented fallback, not dead weight. No new namespace; `shared/i18n/resources.ts` is untouched.

### 23 — `CONVENTIONS.md` §19 amendment

**File: `CONVENTIONS.md`** — append a subsection to **§19** (381-500), not a new top-level section: §19 already owns *"Every colour… comes from a token"*, and this story creates that rule's one sanctioned exception, so the exception belongs beside the rule rather than four sections away.

> **Runtime branding is the one exception, and it is bounded (ORG-3).**
> `src/shared/branding/` is the only module allowed to write a colour at
> runtime, it writes exactly two custom properties — `--primary` and
> `--primary-foreground` — and it writes them as an inline style on
> `<html>`, which beats both `:root` and `.dark`. No component gains a
> colour literal and no utility class changes: `@theme inline`'s
> `--color-primary: var(--primary)` mapping is what carries the override
> to every `bg-primary`/`text-primary` in the app.
>
> `--primary-foreground` is **derived**, never configured
> (`contrast.ts`, WCAG relative luminance, 0.179 crossover), so every
> brand colour an admin can enter yields a legible pair. `--background`,
> `--foreground`, `--card`, `--muted`, `--border`, and `--ring` are not
> brandable — Story 51 derived them as a set with verified contrast
> ratios, and `--ring` in particular carries a WCAG 2.4.11 floor.
>
> **Branding is read publicly** (`GET /api/branding/`, `AllowAny`) because
> the login and landing pages have no session and a non-admin agent has no
> `settings.manage`. That endpoint serves a **separate three-field
> serializer**, never `OrganizationSettingsSerializer` — which carries the
> org's SLA defaults. Do not widen it, and do not make the public view
> inherit from the private one.
>
> Values are cached in `localStorage` and re-applied by `index.html`'s
> inline script before first paint, the same anti-FOUC contract the theme
> and language already use. The cache holds **resolved** CSS values so that
> script needs no colour maths.

---

## Edge Cases & Failure Modes

- **A fresh deployment has configured nothing.** `OrganizationSettings.load()` returns a row with three empty strings, `apply()` removes both properties, `BrandMark` falls back to `common:app.name`, and the tab title reads "SupportOS". Identical to today's appearance — which is the point: this story must be invisible until someone uses it.
- **`primary_color` is cleared after having been set.** `apply()` takes the `colour === null` branch and calls **`removeProperty`**. Using `setProperty(token, '')` instead leaves an empty inline declaration that still shadows `index.css`, painting every primary button transparent — a broken app from a "reset to default" action. Enforced in task 9; Verification Step 11 checks it explicitly.
- **A malformed colour reaches the browser anyway** (`loaddata`, a raw SQL fix, a future serializer that forgets the validator). `apply()` re-tests `HEX_COLOR_RE` and treats a failure as "unset" rather than writing garbage into a CSS property. Defence in depth: the regex lives on the model *and* in `config.ts`.
- **A corrupt `localStorage` entry.** `read()` catches both a `JSON.parse` throw and a well-formed-but-wrong shape (e.g. `{"primary": 42}`), returning `EMPTY_BRANDING`. A bad cache must never crash the boot path, which runs before any error boundary exists.
- **`localStorage` is unavailable** (private mode, blocked site data). Both `read()` and the cache write are in try/catch; branding still applies normally after the fetch — the only loss is FOUC protection on a cold start. Same degradation `shared/theme` accepts.
- **The inline script runs with no cache and the fetch is slow.** The app paints DSN blue, then repaints to the brand colour when the query resolves. Visible once per browser, then never again. Accepted deliberately over blocking first paint on a network round-trip.
- **`/api/branding/` is down or 500s.** `useBranding` retries per `shouldRetry` (transport/5xx, max 2), then fails silently — no `meta.toastOnError`. `BrandMark`'s `?? getBranding()` keeps the cached value on screen. A branding outage must not stop anyone logging in.
- **A stale or malformed `Authorization` header on a visitor's first request.** This is why task 4 sets `authentication_classes = []` and not just `AllowAny`: with authentication classes still active, JWT parsing runs before the permission check and a bad token 401s the request — meaning the login page loses its own branding exactly when a user's session has just expired. Verification Step 6 sends a garbage bearer token specifically to catch this.
- **`logo_url` points at a dead host, a private network, or an `http://` URL on an `https://` page.** All three surface as an image load error; `onError` flips to the name. Mixed content is blocked by the browser with no network error, so `onError` is the only signal available — which is why the fallback is on the `<img>` and not on a fetch.
- **`logo_url` points at a 2000×600 banner.** `h-6 w-auto max-w-32 object-contain` caps it in the sidebar and portal header; the login mark uses `h-12 max-w-48`. Without the cap a wide logo pushes the collapse toggle off the sidebar.
- **`logo_url` points at an SVG containing script.** An `<img>` element does not execute script in a referenced SVG (unlike an inline `<svg>` or an `<object>`), so `<img src>` is the safe way to render an admin-supplied vector. Do not "improve" this into an inline fetch-and-inject.
- **A very light brand colour** (`#FFFF00`, luminance ≈ 0.93). `foregroundFor` returns black. A very dark one (`#000080`, ≈ 0.02) returns white. The 0.179 crossover is what makes both legible; verify one of each by eye (Verification Step 12) because an off-by-one in `channel()`'s `slice` offsets would still return *a* colour and only look subtly wrong.
- **A brand colour equal to `--destructive`** (`#DC2626`-ish). Nothing prevents it, and a red "Save" button beside a red "Delete" button is confusing but not broken. Out of scope to police; noted so nobody treats it as a bug.
- **An admin saves a colour while another admin has `/settings` open.** Task 20 edit 5 invalidates `brandingKeys.all` only in the saving browser; the other tab keeps its colour until a reload (`staleTime: Infinity`, `refetchOnWindowFocus: false`). Acceptable for a per-deployment setting changed a handful of times ever; stated so it is not mistaken for a cache bug.
- **The public endpoint reveals the organisation's name and logo to anyone.** By design — the login page shows both to any visitor by definition. The safety boundary is the *field list*, not the audience: Verification Step 5 asserts the response has exactly three keys, so the two SLA defaults stay private.
- **`GET /api/branding/` with a `POST`/`PATCH`.** Only `get` is defined, so Django's `http_method_not_allowed` returns 405. There is no write path to the public endpoint at all.
- **Dark mode plus a brand colour.** The inline `<html>` style outranks the `.dark` block, so the same brand colour applies in both themes and the derived foreground with it. Toggle the theme with a brand colour set (Verification Step 12) — if the colour reverts on toggle, `apply()` is writing to a stylesheet rather than an inline style.
- **RTL.** `BrandMark` uses only `h-`/`w-`/`max-w-`/`object-contain`/`truncate`; the login mark adds nothing physical. `npm run check:rtl` is the gate. A logo is not mirrored in RTL — correct, logos are not directional.
- **`document.title` and language switching.** When `name` is blank the title comes from `common:app.name`, so task 15's effect depends on `t` and re-runs on a language change. With a configured name the title is language-independent, which is right — a brand name is not translated.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` from `backend/` — the existing suite must still pass. `MigrationStateTests.test_no_pending_migrations` catches task 1 shipping a model change without its migration.
2. `ruff format --check .` and `ruff check .` from `backend/` — covers the new migration, the `RegexValidator` import, and `BrandingSerializer`/`BrandingView`.
3. `npm run build` from `frontend/` — typechecks the new `shared/branding/` module (six files), `BrandingSync`, and the `OrganizationSettings`/`SettingsInput` type changes. **Adding `primary_color` to `SettingsInput` makes `toSettingsInput`'s spread a compile error until `schema` and `toDefaults` both carry it** — that is the gate for task 20 edits 1-2.
4. `npm run lint` — `no-restricted-imports` proves `shared/branding/`'s placement: `features/auth`, `features/landing`, `features/portal`, and `app/` all import it, and four features reaching for one another's copy would fail here.
5. `npm run format:check` and `npm run check:rtl`.
6. The `en`/`ar` key-set comparison (the script from [../customer-management/10-story-customer-profiles-SUPPORTOS-28.md](../customer-management/10-story-customer-profiles-SUPPORTOS-28.md) Verification Step 4) against `features/organization/locales/{en,ar}.json`.
7. Real HTTP and a real browser — Verification Steps 3-14 below. Two of them (5 and 6) are the security-relevant ones and must not be skipped.

---

## Migration / Rollback

**Forward:** one additive migration.

```powershell
cd backend
python manage.py migrate
```

`organization/0011_organizationsettings_primary_color` adds one nullable-in-effect (`blank=True`, defaulting to `""`) column. **No data migration and no backfill:** `""` already means "DSN default", so every existing row is correct on arrival and every deployment looks exactly as it did before until an admin sets a colour.

**Rollback:**

```powershell
cd backend
python manage.py migrate organization 0010
```

Reversing drops the column. **The configured colour is lost** — there is nowhere else to put it, and unlike ORG-1/ORG-2's promotions there is no prior representation to demote into. Record the value first if it matters:

```powershell
python manage.py shell -c "from apps.organization.models import OrganizationSettings; print(OrganizationSettings.load().primary_color)"
```

**Half-applied states:**

- **Migration applied, frontend not deployed.** `primary_color` sits in the database and on `/api/settings/`; nothing reads it. `/api/branding/` 404s (no route yet), and the old frontend never calls it. Zero visible change — this story is safely deployable backend-first.
- **Frontend deployed, migration not applied.** `GET /api/branding/` raises on the missing column → 500. `useBranding` retries twice, then fails silently; `BrandMark` falls back to the locale name and `apply()` leaves the DSN default in place. **Degraded, not broken** — every screen still renders, which is the property tasks 10/11's fallbacks exist for. Still: apply the migration first.
- **Frontend deployed, `index.html` not updated** (a cached `index.html` with the old inline script). Branding applies after the fetch instead of before first paint — one brand-colour flash per load until the HTML is re-fetched. Cosmetic.
- **A stale `localStorage` cache after an admin changes the colour.** The next cold start paints the *previous* brand for one frame, then the fetch corrects it and rewrites the cache. Self-healing in one load.

---

## Verification Steps

1. **Backend builds:** from `backend/` — `python manage.py check` exits 0, then `ruff format --check .` and `ruff check .` both exit 0.
2. **Migration inspection:** `python manage.py makemigrations --check --dry-run` reports no pending changes; open `organization/0011_*` and confirm one `AddField` with `blank=True`, `max_length=7`, and the validator, and `dependencies` naming `0010_grant_branch_permissions`.
3. **Validation, both paths.** As an `admin`: `PATCH /api/settings/ {"primary_color": "#1E88E5"}` → 200. Then each of `"1E88E5"` (no `#`), `"#1E8"` (shorthand), `"#GGGGGG"` (non-hex), `"red"`, and `"rgb(1,2,3)"` → **400** with a `primary_color` field error, **not** 500. Then `{"primary_color": ""}` → 200 (blank is valid and means default). Finally set the same bad value through Django admin at `/admin/organization/organizationsettings/1/change/` and confirm the form rejects it — the validator must cover both paths from one declaration.
4. **Case-insensitivity:** `"#1e88e5"` and `"#1E88E5"` both → 200. The stored string round-trips unchanged (the regex accepts both cases; nothing normalises).
5. 🔒 **The public payload is exactly three keys.** `GET /api/branding/` with **no** `Authorization` header → 200, and the response `data` has exactly `{"name", "logo_url", "primary_color"}`. Assert the key set, not just the presence of the three: `default_response_target_minutes` and `default_resolution_target_minutes` must be **absent**. Compare against `GET /api/settings/` as an admin, which must still return all seven.
6. 🔒 **Anonymous, and hostile-header, access.** `GET /api/branding/` with no header → 200 (step 5). Then with `Authorization: Bearer garbage` → **still 200**, not 401 — this is what `authentication_classes = []` buys, and it is the difference between a branded and an unbranded login page for a user whose session just expired. Then as an `agent` (who lacks `settings.manage`) → 200. Then confirm `POST /api/branding/` → **405** and `GET /api/settings/` as that same agent → **403**.
7. **Reset semantics over HTTP.** `PATCH /api/settings/ {"primary_color": ""}` → 200, then `GET /api/branding/` returns `"primary_color": ""`.
8. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
9. **Branding with no session, in a browser.** With `primary_color` set to a strongly non-blue value (`#B45309`), a `name` set, and a working `logo_url`, open a **private window** and visit `/` and `/login`:
    - the landing header and the login mark both show the logo;
    - primary buttons ("Sign in", the landing CTAs) are the brand colour, not DSN blue;
    - the browser tab reads the configured name;
    - the Network tab shows exactly one `GET /api/branding/` with **no** `Authorization` header.
10. **No flash on reload.** Reload `/login` and watch the "Sign in" button through the first paint — it must be brand-coloured immediately, never blue-then-brand. Then clear `localStorage` and reload: one flash is expected and acceptable. Then set `localStorage['supportos.branding'] = '{"oops":1}'` and reload — the page must render on defaults, with no console error.
11. **Reset restores the default and does not blank the UI.** On `/settings`, clear the colour field and save. Every primary button returns to DSN blue **immediately**, without a reload (this proves task 20 edit 5's invalidation). Crucially, no primary surface goes transparent or white — that failure means `apply()` used `setProperty(token, '')` instead of `removeProperty`.
12. **Contrast and dark mode.** Set `#FFFF00` → button text must be **black** and readable. Set `#000080` → **white**. With a colour set, toggle light/dark via `ThemeToggle` — the brand colour must survive both (if it reverts, `apply()` is not writing an inline style). Re-check the derived text colour in both themes.
13. **All four surfaces, both languages.** As an `admin` with branding configured, check the logo and name on: `/home` (sidebar — and collapse the sidebar to confirm the logo hides with the name, leaving the toggle in place), `/portal` (as a portal customer), `/` and `/login` (signed out). Then switch to Arabic and re-check all four for RTL and missing keys.
14. **Fallback chain.** Set `logo_url` to a URL that 404s → all four surfaces show the **name**, not a broken-image icon. Clear `logo_url` → same. Clear `name` too → all four show "SupportOS" from the locale file, and the tab title with it. Then stop the backend and reload `/login` → the page still renders, still branded from cache, and **no error toast appears**.
15. **Regression:** `/settings` still saves the org name, logo URL, and both SLA defaults; `/settings/departments` and `/settings/branches` are untouched; `/api/settings/` still 403s for a non-admin; `ThemeToggle` and `LanguageSwitcher` still work on every public page; `npm run check:rtl` still green.

---

## Done Criteria

- [ ] `OrganizationSettings.primary_color` exists — `CharField(max_length=7, blank=True)` with a `#RRGGBB` `RegexValidator` — and `organization/0011_*` is one additive `AddField` with no data migration.
- [ ] The same validator rejects a malformed colour on **both** `PATCH /api/settings/` (400, field error) and the Django admin form, from one declaration; no `validate_primary_color` method exists.
- [ ] `GET /api/branding/` returns 200 with **exactly** `name`, `logo_url`, `primary_color` — to an anonymous caller, to a caller sending a garbage bearer token, and to a non-admin agent.
- [ ] `BrandingSerializer` neither subclasses nor imports `OrganizationSettingsSerializer`, and the two SLA defaults appear nowhere in the public response.
- [ ] `POST /api/branding/` is 405; `GET /api/settings/` still 403s for a non-admin.
- [ ] `src/shared/branding/` holds the module (config, contrast, runtime store, keys, fetcher, hook, `BrandMark`, index) and imports **no** API client from the boot-time path.
- [ ] Exactly two custom properties are written at runtime, as an inline style on `<html>`; `index.css`'s `:root`, `.dark`, and `@theme inline` blocks are unmodified.
- [ ] `--primary-foreground` is derived by relative luminance — `#FFFF00` yields black text, `#000080` yields white — and is neither stored nor configurable.
- [ ] Clearing the colour calls `removeProperty` and restores DSN blue with no reload and no transparent surfaces.
- [ ] A brand colour survives a light/dark toggle.
- [ ] `index.html`'s inline script applies the cached brand colour before first paint, parses its JSON defensively, and contains no colour arithmetic.
- [ ] `BrandMark` renders logo → name → `common:app.name`, falls back on image error, and is the single implementation used by `Sidebar`, `PortalLayout`, `LandingPage`, and `LoginPage`.
- [ ] `document.title` follows the configured name and falls back to the locale string.
- [ ] Saving a colour on `/settings` repaints the running app immediately (branding key invalidated), and typing in the field does **not** repaint the app.
- [ ] A branding fetch failure is silent — no toast, no error boundary, no blocked render — on the login page with the backend stopped.
- [ ] Every new `t(...)` key exists in both `en.json` and `ar.json`; all four surfaces render correctly in Arabic; `npm run check:rtl` passes.
- [ ] `CONVENTIONS.md` §19 carries the bounded-runtime-branding subsection naming the one module, the two properties, the derived foreground, the non-brandable tokens, and the separate public serializer.
- [ ] `python manage.py check`, `python manage.py test`, `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, and `npm run build` all exit 0.

**This is the last story in EPIC 16. Report to the user and confirm the epic is complete before moving on.**
