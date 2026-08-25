# internationalization-design-system — plan overview

Entry point for the **internationalization-design-system** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 05 | [05-story-i18n-rtl-foundation-SUPPORTOS-9.md](05-story-i18n-rtl-foundation-SUPPORTOS-9.md) | Internationalization & RTL Foundation | SUPPORTOS-9 | Stories 03, 04 |

## Dependency notes

This feature maps to **EPIC 1 — Internationalization & Design System** in `SupportOs backlog.MD` (lines 141–219). It builds bilingual (Arabic/English) + RTL support and the shared UI/design system **before any feature UI**, and produces the `I18N`, `UI`, and `FORM` shared specs.

The whole epic depends on EPIC 0 being complete — see [`../project-foundation-architecture/00-overview.md`](../project-foundation-architecture/00-overview.md) (stories 01–04).

Sequencing inside the epic is fixed by the backlog's own dependency lines:

`I18N-1` (story 05) → `UI-1` → `FORM-1`

**I18N-1 must come first.** UI-1 depends on FND-3 *and* I18N-1, and FORM-1 depends on UI-1 *and* I18N-1. That ordering is why story 05 cannot install Tailwind even though its intake mentions "Tailwind logical properties usage" — Tailwind belongs to UI-1, which comes after. Story 05 instead writes the logical-property rule into `CONVENTIONS.md` § 18 as the binding constraint UI-1 must follow.

**Shared specs produced here:**

| Spec | Established by | What it fixes |
|---|---|---|
| `I18N` | Story 05 | i18next with per-feature namespaces, a compile-time-typed `t()`, `<html dir>`/`lang` driven by the active language, a persisted language switcher, and locale-bound date/number/currency helpers. |
| `UI` | UI-1 | Not yet planned. Tailwind + shadcn/ui, theme tokens, shared primitives, and the standard loading/empty/error/confirm states. |
| `FORM` | FORM-1 | Not yet planned. React Hook Form + Zod as the single forms/validation approach, with localised messages via `I18N`. |

**Cross-story contracts set by story 05:**

- **No hardcoded user-facing strings.** Every one lives in a namespace. `common` and `errors` are shared; each feature owns `src/features/<feature>/locales/{en,ar}.json` and registers them in `src/shared/i18n/resources.ts`.
- **`en` is the typed source of truth.** `CustomTypeOptions.resources` is derived from the `en` map, so a mistyped key is a build error — but a key that exists only in `ar` is invisible to the compiler and unreachable.
- **Errors translate by `code`, never by message.** `t('errors:' + error.code, { defaultValue: error.message })`. The API layer is non-React and its modules are evaluated once, so translating inside it would freeze the language at import time.
- **Direction is written in exactly one place** — `src/shared/i18n/direction.ts`. No component sets `dir` or `direction`.
- **Logical properties only.** The rule UI-1 must follow: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end` — never `ml-*`, `mr-*`, `left-*`, `text-left`.
- **Formatting goes through `useFormatters()`** (components) or `shared/lib/format.ts` (elsewhere). Never inline `Intl` or `toLocaleString` in a feature.
- **Forward constraint for the first localized API payload:** TanStack Query keys do not include the language, so cached responses keep their old-language prose after a switch. The moment a response carries user-facing text, `language` must join the query key.

**Verified findings that shaped story 05:**

- **DRF already ships Arabic.** `rest_framework/locale/ar/LC_MESSAGES/django.mo` is present, and its standard messages translate correctly (`NotFound` → `"غير موجود."`). Adding `LocaleMiddleware` plus an `Accept-Language` header localises most backend errors for free.
- **`gettext_lazy` survives the response envelope.** Tested through `EnvelopeJSONRenderer`: it resolves per active language, and `lazy == "plain string"` is `True`, so story 02's existing assertions keep passing.
- **GNU gettext is not installed on this machine** (`msgfmt`, `msgmerge`, `xgettext` all absent), so `compilemessages` cannot run. Our own two custom backend messages stay English until someone with the tooling compiles the committed `.po`; every DRF message is already Arabic regardless.
- **`react/jsx-no-literals` is a partial net.** Isolated in a scratch file, it flags direct JSX children only — 1 of 4 patterns. It misses `{cond ? <p>text</p> : null}`, `{cond && <p>text</p>}`, and `{'text'}`. Story 05 therefore enumerates the hardcoded-string inventory by hand rather than trusting the linter.
- **Arabic numerals depend on the locale tag.** Bare `'ar'` resolves to Western digits and the Gregorian calendar; `'ar-EG'` and `'ar-SA'` resolve to Arabic-Indic digits. Story 05 pins `numberingSystem: 'latn'` and `calendar: 'gregory'` on every `Intl` call so output cannot drift with the browser's ICU build. **This is a product decision** — reversing it is a one-line change documented in the plan.

**Note on testing:** per standing project policy this project authors no automated tests. Story 05 adds none; its checks are `npm run build` (which typechecks every `t()` key), `npm run lint`, and the greps in its Verification Steps.
