# Story 05 — Internationalization & RTL Foundation (Story: SUPPORTOS-9)

## Prerequisites

- **Story 03 completed:** [../project-foundation-architecture/03-story-frontend-foundation-SUPPORTOS-4.md](../project-foundation-architecture/03-story-frontend-foundation-SUPPORTOS-4.md) — the feature structure, the single API layer, and `src/shared/ui/`. `frontend/src/README.md` already reserves `src/shared/i18n/` for **this** story.
- **Story 04 completed:** [../project-foundation-architecture/04-story-codebase-conventions-SUPPORTOS-5.md](../project-foundation-architecture/04-story-codebase-conventions-SUPPORTOS-5.md) — `CONVENTIONS.md`, the oxlint config this story extends, and Prettier at `printWidth: 100`.
- This is the **first** story of EPIC 1 and the first outside `project-foundation-architecture`. It is a dependency of **UI-1** and **FORM-1**, so the conventions it sets are consumed immediately after.
- Verified frontend baseline: **no Tailwind, no shadcn, no i18next** installed. `frontend/package.json` dependencies are exactly `@tanstack/react-query`, `axios`, `react`, `react-dom`, `react-router`.
- Verified backend baseline: `LANGUAGE_CODE = "en-us"` and `USE_I18N = True` (`backend/config/settings/base.py:135,137`). **No** `LANGUAGES`, **no** `LOCALE_PATHS`, **no** `LocaleMiddleware`.
- **GNU gettext is not installed on this machine** — `msgfmt`, `msgmerge`, and `xgettext` are all absent from `PATH`. This bounds task 7; read its note before starting it.

---

## Story Goal

Make the app fully usable in English and Arabic, with correct layout direction, and make "no hardcoded user-facing strings" a rule the tooling helps enforce.

1. `react-i18next` initialised from statically bundled resources, with **per-feature namespaces** for `en` and `ar` and a **compile-time-typed** `t()`.
2. `<html lang>` and `<html dir>` track the active language, and the CSS uses logical properties so a direction flip needs no per-component work.
3. A language switcher that persists the choice and survives a reload without a flash of the wrong direction.
4. Shared date/number/currency helpers bound to the active locale — features never call `Intl` inline.
5. Every user-facing string currently hardcoded in the app is moved into a namespace. That inventory is enumerated in task 6; it is not left as "find them all".
6. Backend responses localise through `Accept-Language`.

**The scope tension in this story, and how it is resolved.** The intake's task 2 asks for "Tailwind logical properties usage", but **Tailwind does not exist yet** — it belongs to **UI-1**, which depends on *this* story (`SupportOs backlog.MD` lines 173–203). It cannot be installed here without inverting the dependency. So task 3 does the two things that are actually possible now: it writes the logical-property rule into `CONVENTIONS.md` as the binding convention UI-1 must follow (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`, never `ml-*`/`text-left`), and it applies real CSS logical properties in the plain CSS that exists today. Adding Tailwind here is **out of scope**.

**Explicitly out of scope:**

- **Tailwind CSS and shadcn/ui** → **UI-1**. This story constrains how UI-1 must use them; it does not install them.
- **Translating the UI copy of features that do not exist.** Only `health` exists. Its namespace is the worked example.
- **Automated tests.** Per standing project policy, no test file is created and no test runner is added. See `## Test Plan`.
- **A translation-management service or a runtime HTTP backend for locales.** Resources are bundled at build time; `i18next-http-backend` is not installed.
- **Compiling `.mo` files for our own two backend messages.** Impossible here — gettext tooling is absent. Task 7 sets up everything else and documents the one remaining step.
- **Pluralisation rules beyond what i18next provides by default**, and **RTL-aware icon mirroring** (UI-1, once icons exist).
- **`ar` as the default language.** `en` stays the fallback and the default for a first-time visitor.

---

## Context — Read These Files First

1. `.squad/stories/internationalization-design-system/SUPPORTOS-9/intake.md` — the source story. Three task blocks in the fenced **Description**. **No attachments, no acceptance criteria** — Done Criteria derive from the three **Outcome** lines.
2. `frontend/src/README.md` — § Reserved directories names `src/shared/i18n/` as this story's. § The API layer (~line 55) lists the four sanctioned `import.meta.env` read sites; task 1 does **not** add a fifth (see the note there).
3. `CONVENTIONS.md` — read § 3 (TypeScript: `erasableSyntaxOnly` forbids `enum`; `verbatimModuleSyntax` needs `import type`), § 5 (error/loading/empty), § 9 (env), § 15 (imports). Section headings are **cited by number** elsewhere in the repo — `frontend/.oxlintrc.json` references "CONVENTIONS.md §15". Task 8 appends `## 18.` and **must not renumber** anything.
4. `frontend/src/shared/lib/api/errors.ts` — `ApiRequestError` (lines 7–52) and `toApiRequestError` (lines 62–104). Note the three hardcoded English messages at **lines 55, 71, 78**. Task 6 changes how these are consumed, not how they are produced.
5. `frontend/src/shared/lib/api/client.ts` — the request interceptor at **lines 32–38** (task 7 adds `Accept-Language` here) and the two hardcoded messages at **lines 56** and **113**.
6. `frontend/src/app/providers.tsx` — all 28 lines. Line 15 pushes `error.message` into a toast; task 6 changes that to a translated lookup. Task 1 adds the i18n import.
7. `frontend/index.html` — all 13 lines. Line 2 is `<html lang="en">` with **no `dir`**, and line 7 is `<title>frontend</title>`, a leftover Vite default. Task 3 fixes both.
8. `frontend/src/index.css` — all 23 lines, the minimal reset from story 03. Task 3 adds direction-neutral base rules here.
9. `backend/config/settings/base.py` — `MIDDLEWARE` (the block starting at the `corsheaders` entry) and the i18n block at **lines 135–138**. Task 7 inserts `LocaleMiddleware` between `SessionMiddleware` and `CommonMiddleware`, and extends the i18n block.
10. `backend/apps/core/exceptions.py` — **lines 19–20**, `VALIDATION_MESSAGE` and `INTERNAL_MESSAGE`. Task 7 wraps both in `gettext_lazy`.
11. Grep `frontend/src` for `'[A-Z]` before starting task 6 and compare against that task's table. If the grep finds a user-facing string the table does not list, the table is incomplete — add it rather than skipping it.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **No hardcoded user-facing strings anywhere.** | Intake, description + task 1 constraints | `react/jsx-no-literals` in `frontend/.oxlintrc.json` (task 8) — a **partial** net, see the verified limitation below — plus the task 6 inventory and `CONVENTIONS.md` § 18. |
| **Every feature adds its own namespace files.** | Intake, task 1 constraints | `src/features/<feature>/locales/{en,ar}.json`, registered in `src/shared/i18n/resources.ts`. `health` is the worked example. |
| Shared components **render correctly in both directions**. | Intake, task 2 constraints | Logical properties only in `index.css`; the rule for UI-1 written into `CONVENTIONS.md` § 18. Verified by the direction check in Verification Step 6. |
| Use **logical (start/end) spacing, not left/right**. | Intake, task 2 constraints | `CONVENTIONS.md` § 18 states the Tailwind class mapping UI-1 must follow. No `left`/`right` physical property in `index.css`. |
| Features **format via the shared helpers**, not inline. | Intake, task 3 constraints | `src/shared/lib/format.ts` + `useFormatters()`. `CONVENTIONS.md` § 18 forbids inline `Intl` and `toLocaleString` in features. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | `VITE_DEFAULT_LANGUAGE` is the only new variable, and it lands in `.env.example` **and** the README table together. |

---

## Frontend Tasks

### 1 — Dependencies and the i18n bootstrap

**Install.** From `frontend/`:

```powershell
npm install i18next react-i18next i18next-browser-languagedetector
```

Range pins land in `package.json`, per `CONVENTIONS.md` § 17. **Do not** install `i18next-http-backend` — resources are bundled.

**Create file: `frontend/src/shared/i18n/config.ts`**

The single place the language contract is defined, so nothing else hardcodes `'en'` or `'ar'`.

```ts
/**
 * The language contract. Everything else imports from here — no module
 * hardcodes a language tag or the storage key.
 */
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const FALLBACK_LANGUAGE: Language = 'en'

/** Also read by the inline anti-FOUC script in index.html — keep in sync. */
export const LANGUAGE_STORAGE_KEY = 'supportos.language'

export const RTL_LANGUAGES: readonly Language[] = ['ar']

/**
 * Intl locale tag per language, with the numbering system and calendar pinned.
 *
 * Verified: bare `ar` resolves to Western digits (`latn`) and the Gregorian
 * calendar, while `ar-EG` and `ar-SA` resolve to Arabic-Indic digits (`arab`).
 * Because ICU differs by tag — and browser ICU can differ from Node's — both
 * are pinned explicitly rather than left to resolution. See § "The Arabic
 * numeral decision" in the plan.
 */
export const INTL_LOCALE: Record<Language, string> = {
  en: 'en-US',
  ar: 'ar',
}

export function isRtl(language: string): boolean {
  return RTL_LANGUAGES.includes(language as Language)
}

export function isSupported(language: string): language is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
}
```

`as const` arrays plus indexed access, **not** `enum` — `erasableSyntaxOnly` forbids `enum` (`CONVENTIONS.md` § 3).

**Create file: `frontend/src/shared/i18n/index.ts`**

```ts
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { applyDirection, watchDirection } from './direction'
import { FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './config'
import { resources } from './resources'

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: FALLBACK_LANGUAGE,
    defaultNS: 'common',
    // Resources are bundled, so init is synchronous and no Suspense boundary
    // is needed. Turning this on later requires a <Suspense> around the tree.
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

applyDirection(i18next.resolvedLanguage ?? FALLBACK_LANGUAGE)
watchDirection(i18next)

export { i18next }
```

`interpolation.escapeValue: false` is correct **only** because React escapes on render — never render an interpolated value with `dangerouslySetInnerHTML`.

**File: `frontend/src/main.tsx`**

Add `import './shared/i18n'` **above** the `AppProviders` import. It must be a bare side-effect import placed before any component that calls `useTranslation()` is imported, or the first render sees an uninitialised instance.

Prettier will not reorder imports and oxlint has no import-order rule for the frontend, so the ordering is yours to get right — put it directly after the React imports with a comment saying why it is first.

---

### 2 — Namespaces, resources, and a typed `t()`

**Namespace layout.** Two shared namespaces plus one per feature:

```text
src/shared/i18n/locales/en/common.json    app-wide UI copy
src/shared/i18n/locales/en/errors.json    error copy, keyed by ApiRequestError.code
src/shared/i18n/locales/ar/common.json
src/shared/i18n/locales/ar/errors.json
src/features/health/locales/en.json       the `health` namespace
src/features/health/locales/ar.json
```

A feature's locale files live **inside the feature**, which is what "each feature self-contained" (story 03) requires. Shared copy lives in `shared/i18n/locales/`.

**Create file: `frontend/src/shared/i18n/locales/en/errors.json`**

Keys are `ApiRequestError.code` values verbatim, so a lookup is `t('errors:' + code)` with no mapping table. The four client-only codes come from `src/shared/lib/api/types.ts` `CLIENT_ERROR_CODES`; the rest from `API_ERROR_CODES`.

```json
{
  "network_error": "Cannot reach the server. Check your connection and try again.",
  "timeout": "The request timed out. Please try again.",
  "invalid_envelope": "The server returned an unexpected response.",
  "unknown_error": "Something went wrong. Please try again.",
  "validation_error": "The submitted data is invalid.",
  "parse_error": "The request could not be read.",
  "not_authenticated": "Please sign in to continue.",
  "authentication_failed": "Sign-in failed. Check your details and try again.",
  "permission_denied": "You do not have permission to do that.",
  "not_found": "That could not be found.",
  "method_not_allowed": "That action is not allowed here.",
  "not_acceptable": "The requested format is not available.",
  "unsupported_media_type": "That file type is not supported.",
  "throttled": "Too many requests. Please wait and try again.",
  "internal_error": "Something went wrong on our end. Please try again."
}
```

**Create file: `frontend/src/shared/i18n/locales/en/common.json`**

```json
{
  "app": { "name": "SupportOS" },
  "actions": { "retry": "Retry", "reload": "Reload", "dismiss": "Dismiss", "goHome": "Go home" },
  "states": {
    "loading": "Loading…",
    "empty": { "title": "Nothing here yet" },
    "error": { "generic": "Something went wrong.", "render": "Something went wrong. Please reload the page.", "route": "Something went wrong loading this page." },
    "notFound": "Page not found."
  },
  "debug": { "details": "Debug details" },
  "language": { "label": "Language", "en": "English", "ar": "العربية" }
}
```

`language.ar` is `"العربية"` in **both** locale files — a language name is written in its own language in a switcher, never translated.

**Create file: `frontend/src/features/health/locales/en.json`**

```json
{
  "title": "System health",
  "status": "Status",
  "database": "Database",
  "value": { "ok": "OK", "degraded": "Degraded", "error": "Error" },
  "testToast": "Test toast",
  "toastFired": "Toast system is wired up."
}
```

**Create the three `ar` counterparts** with the same key structure. Every key present in `en` must exist in `ar` — a missing key silently falls back to English, which reads as a bug, not a translation gap. Verification Step 3 checks this by key-set comparison.

**Create file: `frontend/src/shared/i18n/resources.ts`**

```ts
import healthAr from '@/features/health/locales/ar.json'
import healthEn from '@/features/health/locales/en.json'

import arCommon from './locales/ar/common.json'
import arErrors from './locales/ar/errors.json'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'

/**
 * The whole resource map, explicitly registered.
 *
 * Deliberately not `import.meta.glob`: an explicit map is greppable, fully
 * typed under `strict`, and shows every namespace in one place. Adding a
 * feature costs two imports and one line per language — that is the
 * "every feature adds its own namespace" checklist item.
 */
export const resources = {
  en: { common: enCommon, errors: enErrors, health: healthEn },
  ar: { common: arCommon, errors: arErrors, health: healthAr },
} as const

export type AppResources = (typeof resources)['en']
```

This file is the **one** sanctioned place that imports across a feature boundary from outside `src/app/`. `no-restricted-imports` (story 04) will flag the two `@/features/health/locales/*` imports, so task 8 adds an override for it. That override is the cost of explicit registration; it is scoped to this single file.

**Enable `resolveJsonModule`.** `frontend/tsconfig.app.json` does not set it. Add `"resolveJsonModule": true` to `compilerOptions`, or every JSON import fails to typecheck.

**Create file: `frontend/src/shared/i18n/i18next.d.ts`**

The typed `t()` the intake asks for — a wrong key becomes a **build error**, not a runtime miss.

```ts
import type { AppResources } from './resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: AppResources
  }
}
```

Types come from the **`en`** map, so `en` is the source of truth for the key set and a key that exists only in `ar` is invisible to the compiler. That asymmetry is intentional — English is the fallback language.

---

### 3 — Direction: `<html dir>`, `<html lang>`, and logical CSS

**Create file: `frontend/src/shared/i18n/direction.ts`**

```ts
import type { i18n } from 'i18next'

import { isRtl } from './config'

/** Set `lang` and `dir` on <html>. The only place either attribute is written. */
export function applyDirection(language: string): void {
  const root = document.documentElement
  root.lang = language
  root.dir = isRtl(language) ? 'rtl' : 'ltr'
}

/**
 * Keep the attributes in step with the active language.
 *
 * An i18next event subscription rather than a React effect: direction is a
 * document-level concern, so it must not depend on a component being mounted.
 */
export function watchDirection(instance: i18n): void {
  instance.on('languageChanged', applyDirection)
}
```

**File: `frontend/index.html`**

Three changes:

- Line 2: `<html lang="en">` → `<html lang="en" dir="ltr">`. This is the pre-hydration default; `applyDirection` corrects it at boot.
- Line 7: `<title>frontend</title>` → `<title>SupportOS</title>`. A leftover Vite default.
- Add an **inline anti-FOUC script** in `<head>`, before the module script. Without it, a returning Arabic user gets a visible LTR→RTL flip on every load, because the bundle only runs after paint.

```html
<script>
  // Anti-FOUC: set dir/lang before first paint. The bundle re-applies this
  // authoritatively at boot; this only avoids a visible flip.
  // Key must match LANGUAGE_STORAGE_KEY in src/shared/i18n/config.ts.
  try {
    var l = JSON.parse(localStorage.getItem('supportos.language') || '""') || localStorage.getItem('supportos.language')
    if (l === 'ar') {
      document.documentElement.lang = 'ar'
      document.documentElement.dir = 'rtl'
    }
  } catch (e) {}
</script>
```

**Confirm the stored value's shape before trusting this script.** `i18next-browser-languagedetector` writes the raw language string (`ar`), not JSON — the `JSON.parse` above is defensive only. After task 4, read the key in devtools (`localStorage.getItem('supportos.language')`) and simplify the script to match what is actually stored. Do not leave the speculative branch in if it is not needed.

**File: `frontend/src/index.css`**

Keep the existing reset. Add direction-neutral base rules, using **logical** properties only:

```css
/* Logical properties only — never `left`/`right`/`margin-left`. A direction
   flip must need no per-component work. See CONVENTIONS.md §18. */

body {
  /* `dir` on <html> drives this; do not set direction per component. */
  text-align: start;
}

/* Arabic glyphs need a font stack that actually has them. */
html[lang='ar'] body {
  font-family:
    'Segoe UI',
    Tahoma,
    'Noto Naskh Arabic',
    system-ui,
    sans-serif;
}
```

**There must be no `left`, `right`, `margin-left`, `margin-right`, `padding-left`, `padding-right`, or `text-align: left/right` anywhere in `frontend/src`.** Verification Step 6 greps for them.

---

### 4 — The language switcher

**Create file: `frontend/src/shared/ui/LanguageSwitcher.tsx`**

Shared UI, so features and UI-1's future layout both consume it. Minimal and near-unstyled, matching the story-03 components — **UI-1 replaces the internals without changing the props.**

- Renders a `<select>` (native, so it is keyboard- and screen-reader-correct with no work) labelled from `common:language.label`.
- One `<option>` per `SUPPORTED_LANGUAGES`, labelled `common:language.<code>`.
- `onChange` calls `void i18n.changeLanguage(next)`. The detector's `caches: ['localStorage']` persists it and `watchDirection` flips `dir` — **the component itself must not touch `localStorage` or `document.documentElement`.** Two writers of the same state is how they drift.
- Uses `useTranslation()` for its own copy.

**File: `frontend/src/app/RootLayout.tsx`**

Render `<LanguageSwitcher />` above the `<Outlet />`. This is the only chrome this story adds; UI-1 owns real layout and will move it into a header.

---

### 5 — Locale formatting utilities

**Create file: `frontend/src/shared/lib/format.ts`**

Pure functions taking an explicit locale, so non-React code can format too.

```ts
import { INTL_LOCALE, FALLBACK_LANGUAGE, isSupported } from '@/shared/i18n/config'

/**
 * Shared formatters. Features never call `Intl` or `toLocaleString` directly —
 * see CONVENTIONS.md §18.
 *
 * `numberingSystem` and `calendar` are pinned on every call: bare `ar`
 * resolves to Western digits and the Gregorian calendar, but `ar-EG`/`ar-SA`
 * resolve to Arabic-Indic digits, so relying on resolution makes output
 * depend on the tag and on the browser's ICU build.
 */
const NUMBERING_SYSTEM = 'latn'
const CALENDAR = 'gregory'

function localeFor(language: string): string {
  return INTL_LOCALE[isSupported(language) ? language : FALLBACK_LANGUAGE]
}

export function formatNumber(
  value: number,
  language: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(localeFor(language), {
    numberingSystem: NUMBERING_SYSTEM,
    ...options,
  }).format(value)
}

export function formatCurrency(
  value: number,
  language: string,
  currency: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return formatNumber(value, language, { style: 'currency', currency, ...options })
}

export function formatDate(
  value: Date | string | number,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    numberingSystem: NUMBERING_SYSTEM,
    calendar: CALENDAR,
    ...options,
  }).format(new Date(value))
}

export function formatDateTime(
  value: Date | string | number,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return formatDate(value, language, options)
}
```

**Create file: `frontend/src/shared/hooks/useFormatters.ts`**

The ergonomic form features actually use — the first occupant of `src/shared/hooks/`, which story 03 created and left empty.

```ts
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/shared/lib/format'

/** Formatters bound to the active language. Re-memoised on language change. */
export function useFormatters() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language

  return useMemo(
    () => ({
      number: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(v, language, o),
      currency: (v: number, c: string, o?: Intl.NumberFormatOptions) =>
        formatCurrency(v, language, c, o),
      date: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) =>
        formatDate(v, language, o),
      dateTime: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) =>
        formatDateTime(v, language, o),
    }),
    [language],
  )
}
```

#### The Arabic numeral decision

Verified with this project's Node/ICU: `Intl.NumberFormat('ar').format(1234567.89)` → `1,234,567.89`, while `'ar-EG'` and `'ar-SA'` → `١٬٢٣٤٬٥٦٧٫٨٩`.

This plan pins **Western digits** (`numberingSystem: 'latn'`) and the **Gregorian calendar** for Arabic. Rationale: SupportOS is a support CRM whose Arabic screens are full of ticket numbers, IDs, timestamps, and currency amounts that get read aloud, compared, and copy-pasted alongside Latin-script data; mixed digit systems in one table is a usability problem, and Gulf/Egyptian business software overwhelmingly uses Western digits. **This is a product call, not a technical one** — if you want Arabic-Indic digits, change `INTL_LOCALE.ar` to `'ar-EG'` and drop `NUMBERING_SYSTEM` from `format.ts`; nothing else changes.

---

### 6 — Retire the hardcoded strings

This is the task most likely to be done half-way, so the inventory is enumerated. It was produced by grepping `frontend/src` for capitalised quoted literals and by running `react/jsx-no-literals` against the real tree.

| File | Line | String | Becomes |
|---|---|---|---|
| `app/NotFoundPage.tsx` | 6 | `Page not found.` | `t('states.notFound')` |
| `app/NotFoundPage.tsx` | 7 | `Go home` | `t('actions.goHome')` |
| `app/RouteErrorBoundary.tsx` | 26 | `Something went wrong loading this page.` | `t('states.error.route')` |
| `shared/ui/AppErrorBoundary.tsx` | 29 | `Something went wrong. Please reload the page.` | see the class-component note below |
| `shared/ui/AppErrorBoundary.tsx` | 31 | `Reload` | same |
| `shared/ui/ErrorState.tsx` | 16 | `Retry` | `t('actions.retry')` |
| `shared/ui/ErrorState.tsx` | 21 | `Debug details` | `t('debug.details')` |
| `shared/ui/Loading.tsx` | 5 | `label = 'Loading…'` | default becomes `undefined`; component falls back to `t('states.loading')` |
| `shared/ui/Empty.tsx` | 8 | `title = 'Nothing here yet'` | default becomes `undefined`; falls back to `t('states.empty.title')` |
| `shared/ui/toast/ToastProvider.tsx` | 57 | `aria-label="Dismiss"` | `t('actions.dismiss')` |
| `shared/ui/QueryBoundary.tsx` | 37 | `Something went wrong.` | `t('states.error.generic')` |
| `features/health/components/HealthPage.tsx` | 15 | `System health` | `t('health:title')` |
| `features/health/components/HealthPage.tsx` | 20–21 | `status:` / `database:` labels | `t('health:status')` / `t('health:database')` |
| `features/health/components/HealthPage.tsx` | 26 | `Toast system is wired up.` | `t('health:toastFired')` |
| `features/health/components/HealthPage.tsx` | 27 | `Test toast` | `t('health:testToast')` |

**Deliberately left in English — these are not user-facing:**

- `shared/lib/logger.ts` — the `[SupportOS]` prefix and all log text. Logs are for developers.
- `shared/ui/toast/useToast.ts` — `'useToast() must be used within a <ToastProvider>.'` A programmer error thrown at development time.
- `config/env.ts` line 14 — `'Copy frontend/.env.example to frontend/.env and fill it in.'` A setup error for a developer, thrown before the app can boot; i18n is not initialised yet, so translating it is impossible anyway.
- `shared/lib/api/client.ts` lines 56, 113 and `shared/lib/api/errors.ts` lines 55, 71, 78 — see the architecture note below. These stay as English **fallbacks**; the UI translates the `code`.

#### Error messages: translate the code, not the message

`errors.ts`, `client.ts`, and `queryClient.ts` are not React modules, so `useTranslation()` is unavailable. Calling i18next's standalone `t()` at module scope — which is where `GENERIC_MESSAGE` lives (`errors.ts:55`) — would bind the string at **import time** and never update on a language switch.

So `ApiRequestError` keeps carrying an English `message`, and **the UI translates `error.code`**:

```ts
const message = t(`errors:${error.code}`, { defaultValue: error.message })
```

`defaultValue` makes the English message the graceful fallback for a code we have no copy for — including any future backend code this frontend has not been taught yet. Apply this in exactly two places:

- **`shared/ui/ErrorState.tsx`** — replaces `{error.message}` on line 13.
- **`app/providers.tsx`** — line 15's `pushToast({ tone: 'error', message: error.message })`. `AppProviders` is a component, so `useTranslation()` is available; take `t` from it and translate before pushing.

This also means the toast and the inline error state show the *same* copy for the same failure, which they do not today.

#### `AppErrorBoundary` is a class component

It cannot call `useTranslation()`. Two of the inventory's strings live there. Do **not** convert it to a function component — React has no hook equivalent to `componentDidCatch`, which is why story 03 made it a class.

Instead, extract its fallback UI into a small function component in the same file (`ErrorBoundaryFallback`) that calls `useTranslation()`, and have `render()` return `<ErrorBoundaryFallback />`. The class keeps the lifecycle method; the hook lives in the child. State this reasoning in a comment — the next reader will otherwise "simplify" it back.

**One ordering constraint.** `AppErrorBoundary` wraps `ToastProvider` and everything else in `providers.tsx`. Its fallback renders **outside** any i18n React context, but `useTranslation()` reads from the i18next singleton via `initReactI18next`, not from a React provider, so it still resolves. That works only because task 1 imports `./shared/i18n` for its side effect in `main.tsx` — if that import is ever removed, this boundary silently renders raw keys.

---

### 7 — Backend locale settings

**File: `backend/config/settings/base.py`**

Insert `LocaleMiddleware` into `MIDDLEWARE` **between** `SessionMiddleware` and `CommonMiddleware` — Django requires it after session (it may read the session) and before common (which can redirect):

```python
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Must sit after SessionMiddleware and before CommonMiddleware.
    # Resolves the active language from the Accept-Language header.
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
```

Extend the i18n block at lines 135–138:

```python
LANGUAGE_CODE = "en-us"
LANGUAGES = [
    ("en", "English"),
    ("ar", "Arabic"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = env("DJANGO_TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True
```

**File: `backend/apps/core/exceptions.py`** — wrap the two messages at lines 19–20:

```python
from django.utils.translation import gettext_lazy as _

VALIDATION_MESSAGE = _("The submitted data is invalid.")
INTERNAL_MESSAGE = _("An unexpected error occurred.")
```

**Verified safe:** a `gettext_lazy` proxy passes through `EnvelopeJSONRenderer` and serialises to the active language (tested with a string DRF already ships: `en` → `"Not found."`, `ar` → `"غير موجود."`). And `lazy == "plain string"` evaluates `True`, so the existing assertions in `backend/apps/core/tests/test_exceptions.py` keep passing. Use `gettext_lazy`, **not** `gettext` — a non-lazy call at module scope binds at import time and would freeze the language for the process.

**Create file: `backend/locale/ar/LC_MESSAGES/django.po`** — a hand-written catalogue for exactly those two strings, with the standard PO header (`Content-Type: text/plain; charset=UTF-8`, `Plural-Forms` for Arabic).

**The gettext-tooling limit, stated plainly.** `msgfmt`, `msgmerge`, and `xgettext` are **not installed on this machine** (verified). So:

- `django-admin makemessages` and `compilemessages` **cannot be run here**, and the `.po` above cannot be compiled to the `.mo` Django actually loads.
- **Our two messages therefore stay English until someone compiles them.** On Windows, install the [gettext binaries](https://mlocati.github.io/articles/gettext-iconv-windows.html), add them to `PATH`, then `python manage.py compilemessages`. `ubuntu-latest` GitHub runners already have gettext, so CI could do it.
- **Everything DRF raises is already Arabic without any of that** — DRF ships pre-compiled `.mo` files (`rest_framework/locale/ar/LC_MESSAGES/django.mo` is present and verified working). That covers `not_found`, `not_authenticated`, `permission_denied`, `method_not_allowed`, `throttled`, and the rest of the standard set. So this task delivers most of its value immediately; only our own two custom strings wait on tooling.

Do **not** commit a `.mo` you did not generate, and do not skip the `.po` — it is the source of record.

**File: `frontend/src/shared/lib/api/client.ts`** — make the backend honour the user's choice. Extend the request interceptor at lines 32–38:

```ts
import { i18next } from '@/shared/i18n'

httpClient.interceptors.request.use((config) => {
  const token = tokenProvider()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  const language = i18next.resolvedLanguage ?? i18next.language
  if (language) {
    config.headers.set('Accept-Language', language)
  }
  return config
})
```

Read the language from the i18next **instance**, not a hook — this is a non-React module. There is no circular import: `shared/i18n` does not import the API layer.

**Add `Accept-Language` to the CORS allow-list.** `django-cors-headers` permits a default header set; confirm `Accept-Language` is accepted and, if a preflight rejects it, add `CORS_ALLOW_HEADERS` with the default list plus `accept-language` in `base.py`. Verification Step 8 exercises a real preflight, which is the only way to catch this.

---

### 8 — Lint rule, `CONVENTIONS.md` § 18, and doc updates

**File: `frontend/.oxlintrc.json`**

Add the hardcoded-string rule and two overrides. Keep every existing rule and the existing `**/app/**` and `**/shared/lib/logger.ts` overrides:

```jsonc
    "react/jsx-no-literals": "error",
```

New overrides to add to the existing `overrides` array:

```jsonc
    {
      "files": ["**/shared/i18n/resources.ts"],
      "rules": {
        "no-restricted-imports": "off"
      }
    }
```

`resources.ts` must import each feature's locale JSON, which the story-04 boundary rule forbids. The override is scoped to that one file.

**The rule's verified limitation — do not oversell it.** `react/jsx-no-literals` in oxlint flags **only direct JSX text children**. Isolated in a scratch file, of four cases it caught **one**:

| Pattern | Flagged? |
|---|---|
| `<p>text</p>` | **yes** |
| `{cond ? <p>text</p> : null}` | no |
| `{cond && <p>text</p>}` | no |
| `<span>{'text'}</span>` | no |

Conditional rendering is ubiquitous, so this rule is a tripwire, not a guarantee — it is exactly why it missed `ErrorState.tsx`'s `Retry` and `Debug details` (both inside `{onRetry ? … }`) while catching the seven literals in `NotFoundPage`, `RouteErrorBoundary`, `AppErrorBoundary`, and `HealthPage`. Task 6's table exists because the linter cannot be trusted to find everything, and `CONVENTIONS.md` § 18 must say so rather than implying the rule covers the rule.

**File: `CONVENTIONS.md`** — append `## 18. Internationalization & RTL`. **Append; do not renumber** — `.oxlintrc.json` cites "CONVENTIONS.md §15" and other files cite by number. It must cover:

1. **No hardcoded user-facing strings.** Every one goes in a namespace. `react/jsx-no-literals` catches direct JSX children only — state the four-case table above so nobody assumes lint is sufficient.
2. **Namespaces:** `common` and `errors` are shared; each feature owns `src/features/<feature>/locales/{en,ar}.json` and registers them in `src/shared/i18n/resources.ts`. Adding a feature = adding its namespace files plus one line per language.
3. **Every key in `en` must exist in `ar`.** `en` is the typed source of truth; a missing `ar` key falls back silently to English.
4. **What stays in English:** logs, programmer errors, and pre-i18n setup failures. With the reason: nobody but a developer reads them.
5. **Errors:** translate `error.code` against the `errors` namespace with `defaultValue: error.message`. Never translate at module scope in the API layer — it binds at import time.
6. **Direction:** `dir`/`lang` on `<html>` are written by `shared/i18n/direction.ts` and nowhere else. Never set `direction` per component.
7. **Logical properties only.** No `left`/`right`/`margin-left`/`text-align: left` in CSS. **The rule UI-1 must follow:** `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`, `border-s-*`/`border-e-*` — never `ml-*`, `mr-*`, `left-*`, `text-left`. Note that Tailwind arrives in UI-1 and this rule predates it deliberately.
8. **Formatting:** `useFormatters()` in components, `shared/lib/format.ts` elsewhere. Never inline `Intl` or `toLocaleString` in a feature. Record the Western-digits/Gregorian decision and how to reverse it.
9. **Backend:** user-facing strings use `gettext_lazy`; the frontend sends `Accept-Language`; DRF's standard messages are already translated, ours need `compilemessages`.

**File: `frontend/src/README.md`** — update § Reserved directories: `src/shared/i18n/` is no longer reserved, it exists. Add `shared/i18n/` and `shared/lib/format.ts` to the module list, note `shared/hooks/useFormatters.ts` as the first occupant of `shared/hooks/`, and point at `CONVENTIONS.md` § 18.

**File: `README.md`** — add `VITE_DEFAULT_LANGUAGE` to the frontend env table if task 1 exposes it (it is optional; the detector's `navigator` fallback covers first-time visitors, so **prefer not to add the variable at all** and leave the table unchanged). Add a short § "Languages" noting `en`/`ar`, the switcher, and that direction follows the language automatically.

---

## Edge Cases & Failure Modes

- **`react/jsx-no-literals` misses conditional JSX.** Verified: 1 of 4 patterns flagged. `{cond ? <p>text</p> : null}` and `{cond && <p>text</p>}` pass clean. This is why task 6 enumerates strings by hand and why Verification Step 5 greps rather than trusting `npm run lint`.
- **Arabic keys missing from `ar` fall back silently.** i18next returns the `en` string with no warning at default log level. It looks like a rendering bug, not a missing translation. Verification Step 3 compares key sets programmatically.
- **The typed `t()` only types `en`.** `CustomTypeOptions.resources` is `typeof resources.en`, so a key added to `ar` alone typechecks fine and is simply never reachable. Intentional, and stated in `CONVENTIONS.md` § 18.
- **Module-scope translation freezes the language.** `errors.ts:55` is a module const. Wrapping it in `t()` binds it at import time, so it would show the boot language forever, even after a switch. This is the whole reason task 6 translates `error.code` in the UI instead. Do not "improve" the API layer by translating in it.
- **Class components cannot use hooks.** `AppErrorBoundary` holds two of the inventory's strings. Converting it to a function component to get `useTranslation()` would delete `componentDidCatch` and break story 03's crash handling. Extract the fallback into a child component instead.
- **`useTranslation()` outside a React provider.** `AppErrorBoundary`'s fallback renders above every other provider. It works because `initReactI18next` registers the singleton globally, not via React context — but **only** if `main.tsx` still imports `./shared/i18n` for its side effect. Remove that import and this boundary renders raw keys with no error.
- **Flash of wrong direction on reload.** The bundle runs after first paint, so a returning Arabic user sees an LTR frame flip to RTL. The inline `<head>` script in task 3 prevents it, at the cost of duplicating the storage key string in HTML. Both copies are commented as needing to stay in sync.
- **The anti-FOUC script guesses the stored format.** `i18next-browser-languagedetector` stores a bare string, but the script defensively tries `JSON.parse` first. **Verify the actual stored value in devtools after task 4 and simplify.** A speculative branch left in place is a bug waiting to matter.
- **Arabic digits vs Western digits.** Verified: `'ar'` → `1,234,567.89`; `'ar-EG'`/`'ar-SA'` → `١٬٢٣٤٬٥٦٧٫٨٩`. Because the resolution differs by tag, `numberingSystem` and `calendar` are pinned on **every** `Intl` call rather than trusted. A browser's ICU build can differ from Node's.
- **`ar-SA` and the Islamic calendar.** This project's ICU resolved `ar-SA` to `gregory`, but `ar-SA` is the tag most likely to resolve to `islamic-umalqura` in other ICU builds, which would render wildly unexpected dates. `INTL_LOCALE.ar` is `'ar'` and `calendar` is pinned to `'gregory'`; do not switch the tag to `ar-SA` without re-checking `resolvedOptions().calendar`.
- **`resolveJsonModule` is off.** `frontend/tsconfig.app.json` does not set it, so every locale JSON import fails `tsc -b` until task 2 adds it. The failure is at build, not at dev-server start, so `npm run dev` can look fine while `npm run build` is broken.
- **`no-restricted-imports` blocks `resources.ts`.** Registering feature namespaces means importing `@/features/*/locales/*.json` from `shared/`, which story 04's boundary rule forbids. Without task 8's override, `npm run lint` fails. Note that this is the *rule working correctly* — the override is a deliberate, single-file exemption, not a bug fix.
- **Bidirectional text mixing.** An Arabic sentence containing a Latin token (`SupportOS`, an email, a ticket ID) can render with the punctuation in a confusing position. This is a Unicode bidi algorithm behaviour, not a bug to fix in CSS. Where it matters, wrap the Latin run in an element with `dir="ltr"`. Note it in `CONVENTIONS.md` § 18 so the first person to hit it does not go hunting.
- **`Accept-Language` rejected by CORS preflight.** `django-cors-headers` allows a default header list; a non-default header on a cross-origin request fails the preflight, and the browser reports it as an opaque network error while `curl` succeeds. Verification Step 8 runs a real preflight with the header.
- **Django's `LocaleMiddleware` and `Accept-Language` region tags.** The frontend sends `ar`; Django matches it against `LANGUAGES`. If the frontend ever sends `ar-EG`, Django falls back to the base `ar` — fine. But sending `en-US` when `LANGUAGES` lists only `en` also resolves to `en`. Do not add region-tagged entries to `LANGUAGES` without a reason.
- **`gettext_lazy` in a JSON response.** Verified working through `EnvelopeJSONRenderer`. The risk is a *different* renderer or a manual `json.dumps` of an envelope, which would raise `TypeError: Object of type __proxy__ is not JSON serializable`. Never `json.dumps` an envelope directly.
- **`compilemessages` unavailable.** Our two custom messages stay English until gettext is installed. Graceful — Django falls back to the msgid — but it means an Arabic user sees two English strings among otherwise-Arabic errors. Documented rather than hidden.
- **Language switch does not refetch API data.** TanStack Query caches by key, and the language is not in any query key. After a switch, cached responses keep their old-language `message` until refetched. For this story only `health` exists and its payload is machine codes, so nothing visible is stale — but the moment a backend response contains user-facing prose, `language` must join the query key. Record this in `CONVENTIONS.md` § 18 as a forward constraint.

---

## Test Plan

**This project does not author automated tests.** No test file is created, no test runner is added, and no test step goes into CI. This section records that policy so the absence reads as a decision.

The mechanical checks that stand in for it are `npm run build` (which typechecks the locale JSON imports and every `t()` key through `CustomTypeOptions`), `npm run lint` (which catches direct JSX literals), and the greps in Verification Steps 3, 5, and 6.

**Constraint on the existing suite:** `python manage.py test` must still report **54 passing**. Task 7 changes `backend/apps/core/exceptions.py`, and `test_exceptions.py` asserts against `VALIDATION_MESSAGE` and `INTERNAL_MESSAGE`. Those assertions survive because a `gettext_lazy` proxy compares equal to its resolved string — verified. If the count moves, the lazy wrapping broke something and needs investigating rather than the test being edited.

---

## Migration / Rollback

**No schema, no data migration.** This story adds frontend modules and translation catalogues, plus three targeted backend settings changes.

**Rollback:** revert the commits, then re-run `npm install` in `frontend/` — `package.json` and `package-lock.json` change together, and a reverted lockfile against a stale `node_modules` produces `Cannot find module 'i18next'` at dev-server start.

**One piece of state outlives a rollback:** `localStorage['supportos.language']` stays in every browser that used the switcher. Harmless — nothing reads the key after a revert — but a returning user's browser keeps it until cleared.

**Half-applied states to avoid:**

- Task 2 before adding `resolveJsonModule` → every locale import fails `tsc -b`, and because the dev server transpiles without typechecking, `npm run dev` looks healthy while `npm run build` is red.
- Task 6 before task 2 → `t('states.notFound')` typechecks against a resource map that has no such key, so the build fails on keys rather than on imports. Do namespaces first.
- Task 8's `jsx-no-literals` before task 6 → `npm run lint` fails on the seven known literals until they are translated. Order: 6, then 8.
- Task 7's `gettext_lazy` without `LOCALE_PATHS` → harmless (the msgid is returned), but it looks like the wrapping did nothing. Do both together.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build` — exits 0. This is the real check on the typed `t()`: a mistyped key is a compile error, and the locale JSON imports only resolve with `resolveJsonModule`.
2. **Lint and format clean:** from `frontend/` — `npm run lint` and `npm run format:check` — both exit 0. Lint passing proves the seven known JSX literals are gone and the `resources.ts` import override is in place.
3. **`en` and `ar` key sets match**, for all four namespace pairs:

   ```powershell
   node -e "const a=require('./src/shared/i18n/locales/en/common.json'),b=require('./src/shared/i18n/locales/ar/common.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,p+k+'.'):[p+k]);const A=f(a).sort(),B=f(b).sort();console.log('missing in ar:',A.filter(k=>!B.includes(k)));console.log('extra in ar:',B.filter(k=>!A.includes(k)))"
   ```

   Both arrays must be empty. Repeat for `errors` and for `features/health/locales/{en,ar}.json`.
4. **English renders, then Arabic renders:** `npm run dev` with the backend up, open <http://localhost:5173/>. The health page shows English copy. Switch the language: **every** visible string becomes Arabic, and `document.documentElement` shows `lang="ar" dir="rtl"` in the inspector.
5. **No hardcoded user-facing strings remain.** From `frontend/`:

   ```powershell
   Select-String -Path src\**\*.tsx -Pattern "'[A-Z][a-z]{3,}"
   ```

   Every remaining hit must be one of task 6's four documented English exemptions (`logger.ts`, `useToast.ts`, `config/env.ts`, the API-layer fallbacks). This grep exists because `jsx-no-literals` provably misses conditional JSX.
6. **No physical CSS properties:** from `frontend/` — grep `src` for `margin-left`, `margin-right`, `padding-left`, `padding-right`, `text-align: left`, `text-align: right`, and the bare `left:`/`right:` properties. **Zero** hits.
7. **Direction survives a reload with no flash:** with Arabic selected, hard-reload. The page renders RTL on the **first** frame — no visible LTR flip. Then check `localStorage.getItem('supportos.language')` in the console and confirm the anti-FOUC script's parsing matches the stored shape.
8. **Backend localises through `Accept-Language`.** With the backend running:

   ```powershell
   curl.exe -s -H "Accept-Language: ar" http://127.0.0.1:8000/api/nope/
   curl.exe -s -H "Accept-Language: en" http://127.0.0.1:8000/api/nope/
   ```

   The `ar` call returns `"message":"غير موجود."`; the `en` call returns `"message":"Not found."`. Then confirm the browser path works too — a real preflight:

   ```powershell
   curl.exe -s -i -X OPTIONS http://127.0.0.1:8000/api/health/ -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: accept-language"
   ```

   The response must include `access-control-allow-headers` covering `accept-language`.
9. **Number and date formatting:** in the browser console with Arabic active, render a page using `useFormatters()` (or evaluate `formatNumber(1234567.89, 'ar')`). Output is `1,234,567.89` with Western digits and a Gregorian date — **not** `١٬٢٣٤٬٥٦٧٫٨٩`.
10. **Backend regression:** from `backend/` — `python manage.py check` clean, `python manage.py test` reports **54 passing**, and `ruff format --check .` / `ruff check .` both exit 0 (task 7 edits Python, so story 04's gates apply).

---

## Done Criteria

- [ ] `i18next`, `react-i18next`, and `i18next-browser-languagedetector` are in `frontend/package.json`; `i18next-http-backend` is **not**.
- [ ] `src/shared/i18n/` contains `config.ts`, `index.ts`, `direction.ts`, `resources.ts`, `i18next.d.ts`, and `locales/{en,ar}/{common,errors}.json`.
- [ ] `src/features/health/locales/{en,ar}.json` exist and are registered in `resources.ts` — the worked example of "a feature adds its own namespace".
- [ ] `t()` is **compile-time typed**: a mistyped key fails `npm run build`.
- [ ] `resolveJsonModule` is set in `frontend/tsconfig.app.json`.
- [ ] `en` and `ar` key sets are identical for all four namespace pairs (Verification Step 3).
- [ ] `<html lang>` and `<html dir>` track the active language, written **only** by `shared/i18n/direction.ts`; `index.html` carries `dir="ltr"` and the anti-FOUC script, and its title is `SupportOS`.
- [ ] A hard reload with Arabic selected shows **no** LTR flash, and the anti-FOUC script matches the actual stored value's shape.
- [ ] `LanguageSwitcher` persists the choice and does **not** write `localStorage` or `document.documentElement` itself.
- [ ] `shared/lib/format.ts` and `shared/hooks/useFormatters.ts` exist; `numberingSystem: 'latn'` and `calendar: 'gregory'` are pinned on every `Intl` call; Arabic numbers render as `1,234,567.89`.
- [ ] Every string in task 6's inventory table is translated, and the only English literals left under `src/` are the four documented exemptions (Verification Step 5).
- [ ] `ErrorState` and the error toast both derive their copy from `t('errors:' + code)` with `defaultValue: error.message`, so both show the same text for the same failure.
- [ ] `AppErrorBoundary` is still a class with `componentDidCatch`; only its fallback was extracted into a hook-using child.
- [ ] No `left`/`right`/`margin-left`/`padding-right`/`text-align: left|right` anywhere in `frontend/src` (Verification Step 6).
- [ ] Backend: `LocaleMiddleware` sits between `SessionMiddleware` and `CommonMiddleware`; `LANGUAGES` lists `en` and `ar`; `LOCALE_PATHS` points at `backend/locale`.
- [ ] `VALIDATION_MESSAGE` and `INTERNAL_MESSAGE` use `gettext_lazy`, and `backend/locale/ar/LC_MESSAGES/django.po` is committed as the source of record.
- [ ] `curl -H "Accept-Language: ar" .../api/nope/` returns `"غير موجود."` (Verification Step 8).
- [ ] The frontend sends `Accept-Language` from the active language, and a preflight advertising that header is accepted.
- [ ] `CONVENTIONS.md` has a new `## 18. Internationalization & RTL` — **appended, with §0–§17 unrenumbered** — including the logical-property class mapping UI-1 must follow and the honest statement of what `jsx-no-literals` does and does not catch.
- [ ] `frontend/src/README.md` no longer lists `src/shared/i18n/` as reserved.
- [ ] `npm run build`, `npm run lint`, `npm run format:check`, `ruff format --check .`, and `ruff check .` all exit 0; `python manage.py test` still reports **54 passing**.
- [ ] `00-overview.md` for this feature updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 06 (UI-1 — Design System & Shared Components), which depends on this story's logical-property and namespace conventions.**
