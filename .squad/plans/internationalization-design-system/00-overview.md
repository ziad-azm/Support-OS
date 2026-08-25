# internationalization-design-system — plan overview

Entry point for the **internationalization-design-system** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 05 | [05-story-i18n-rtl-foundation-SUPPORTOS-9.md](05-story-i18n-rtl-foundation-SUPPORTOS-9.md) | Internationalization & RTL Foundation | SUPPORTOS-9 | Stories 03, 04 |
| 06 | [06-story-design-system-shared-components-SUPPORTOS-11.md](06-story-design-system-shared-components-SUPPORTOS-11.md) | Design System & Shared Components | SUPPORTOS-11 | Stories 03, 04, 05 |
| 07 | [07-story-forms-validation-foundation-SUPPORTOS-12.md](07-story-forms-validation-foundation-SUPPORTOS-12.md) | Forms & Validation Foundation | SUPPORTOS-12 | Stories 05, 06 |

## Dependency notes

This feature maps to **EPIC 1 — Internationalization & Design System** in `SupportOs backlog.MD` (lines 141–219). It builds bilingual (Arabic/English) + RTL support and the shared UI/design system **before any feature UI**, and produces the `I18N`, `UI`, and `FORM` shared specs.

The whole epic depends on EPIC 0 being complete — see [`../project-foundation-architecture/00-overview.md`](../project-foundation-architecture/00-overview.md) (stories 01–04).

Sequencing inside the epic is fixed by the backlog's own dependency lines:

`I18N-1` (story 05) → `UI-1` (story 06) → `FORM-1` (story 07)

**With story 07 planned, EPIC 1 is fully planned.** The next story is AUTH-1 (EPIC 2), which is the first consumer of both `UI` and `FORM`.

**I18N-1 must come first.** UI-1 depends on FND-3 *and* I18N-1, and FORM-1 depends on UI-1 *and* I18N-1. That ordering is why story 05 cannot install Tailwind even though its intake mentions "Tailwind logical properties usage" — Tailwind belongs to UI-1, which comes after. Story 05 instead writes the logical-property rule into `CONVENTIONS.md` § 18 as the binding constraint UI-1 must follow.

**That constraint paid off, and it is why story 06 is shaped the way it is.** Story 06 verified that shadcn's own generated components break § 18 in nine of twelve files. Because the rule was already written down — and because story 06 turns it into a CI gate (`npm run check:rtl`) rather than another convention — the violations are a fifteen-row sweep with a machine check behind it, not something discovered later by an Arabic-speaking user.

**Shared specs produced here:**

| Spec | Established by | What it fixes |
|---|---|---|
| `I18N` | Story 05 | i18next with per-feature namespaces, a compile-time-typed `t()`, `<html dir>`/`lang` driven by the active language, a persisted language switcher, and locale-bound date/number/currency helpers. |
| `UI` | Story 06 | Tailwind CSS v4 (CSS-first tokens, no JS config) + shadcn/ui under `shared/ui/primitives/`, a light/dark/system theme, the Radix `DirectionProvider` bridge, restyled story-03 state components with unchanged props, a `useConfirm()` pattern, and one server-driven `DataTable`. |
| `FORM` | Story 07 | React Hook Form + Zod as the single approach, with one `useAppForm` entry point, validation messages resolved through an i18next `validation` namespace (Zod's own locale as the fallback beneath it), six shared field components, schema helpers, and a server-error bridge that applies a `validation_error` envelope's `fields` map onto the right inputs. |

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

**Cross-story contracts set by story 06:**

- **`shared/ui/primitives/` is CLI-managed; everything else in `shared/ui/` is ours.** The directory split is what lets shadcn's lowercase-kebab file names coexist with `CONVENTIONS.md` § 2's `PascalCase.tsx` rule without breaking `shadcn add`/`shadcn diff`.
- **Tokens are the single styling source.** Tailwind v4 is CSS-first — `@theme inline` in `src/index.css`, no `tailwind.config.js`. No colour literal outside the `:root`/`.dark` blocks.
- **Two document-level writers, one attribute each.** `shared/i18n/direction.ts` owns `<html dir>`/`<html lang>`; `shared/theme/theme.ts` owns `<html class="dark">`. Both are mirrored by the inline anti-FOUC script in `index.html`.
- **Radix direction comes from a React context, not the DOM.** `Direction.DirectionProvider` in `app/providers.tsx` is mandatory and its absence is invisible in English.
- **The story-03 state components' props are frozen.** `Loading`, `Empty`, `ErrorState`, and `QueryBoundary` were restyled without a prop change, so anything written against them still works.
- **One table pattern, server-driven.** `?page=` / `?page_size=` / `?ordering=field|-field`. A `ColumnDef<T>`'s `id` doubles as the ordering field name and must match the serializer field.
- **`npm run check:rtl` is a CI gate**, not a convention — the first machine check of § 18's logical-property rule.

**Verified findings that shaped story 06:**

- **Radix is LTR-blind without a `DirectionProvider`.** Read from the installed `@radix-ui/react-direction`: `useDirection()` returns `localDir || globalDir || 'ltr'` and never inspects the DOM. `<html dir="rtl">` alone buys Radix nothing — Select, DropdownMenu, and Tabs keep LTR keyboard and placement behaviour in Arabic, silently.
- **shadcn's registry output is not RTL-clean.** All twelve planned entries were fetched from `ui.shadcn.com/r/styles/new-york-v4/` and grepped: **9 of 12** ship physical direction classes (`text-left`, `pl-8`, `right-2`, `ml-auto`, `-right-1`), 7 ship a pointless `"use client"`, and `dialog.tsx` ships two hardcoded `Close` literals that fail `react/jsx-no-literals`. Story 06 enumerates all fifteen fixes by file and site.
- **One physical idiom must stay physical.** `left-[50%]` + `translate-x-[-50%]` overlay centring is symmetric; `start-[50%]` would push every dialog off-screen in Arabic, because `start` flips with direction and `translate-x` does not.
- **`radix-ui` is one package with one export path.** The registry imports `{ Slot }` / `{ Dialog as DialogPrimitive }` from `radix-ui`, not from `@radix-ui/react-*`. Mixing the two ships two `DirectionContext` instances, so a provider from one is invisible to a consumer from the other.
- **TanStack Table was rejected, with reasons.** Pagination and sorting are server-side (`apps/core/pagination.py`, `api.getPage`), so its client-side row models are the part we must not use — and `@tanstack/react-table@9.1.2` is a rewrite (`useTable` + `tableFeatures()`, plus a `@tanstack/react-store` runtime dependency). The intake asked for "the primitives + **TanStack Query** conventions" and never named TanStack Table.
- **`sonner` was rejected too.** `shared/ui/toast/toastSink.ts` is how `createQueryClient`'s `onError` reaches a toast from outside React; sonner has no equivalent seam. The existing provider is restyled instead, and dark mode gets a 60-line `shared/theme/` module rather than `next-themes`.
- **`?ordering=` was a fiction.** `REST_FRAMEWORK` had no `DEFAULT_FILTER_BACKENDS`, so the param would have been silently ignored. Story 06 adds `rest_framework.filters.OrderingFilter` — one key, no new dependency, inert until a list view exists.

**Cross-story contracts set by story 07:**

- **`useAppForm` is the only form entry point.** No feature calls `useForm` or imports `@hookform/resolvers` directly. It binds the shared resolver and the language-switch re-validation so neither has to be remembered.
- **Validation messages resolve through i18next, at parse time.** A new `validation` namespace, keyed on Zod's issue codes the way `errors` is keyed on `ApiRequestError.code`. Zod's own locale sits underneath as the fallback for codes we have not authored.
- **`z.config()` is called in exactly one file** (`shared/validation/config.ts`), keyed off the single `Language` list in `shared/i18n/config.ts`. A second caller anywhere silently disables our translations everywhere.
- **Schema field names are `snake_case`**, matching the DRF serializer, so a serializer field, a Zod key, and an RHF path are the same string and the server-error bridge needs **no** mapping layer. This is § 12's snake_case-end-to-end rule paying off.
- **Server `validation_error` field errors are applied untranslated.** The backend already localised them via `Accept-Language`; running them through `t()` would look up a sentence as a key.
- **`check:rtl` now covers `translate-x`** — the physical-transform bug class the story-06 version was blind to.

**Verified findings that shaped story 07:**

- **Zod's built-in locales are unusable as form copy.** Verified against `zod@4.4.3`: a blank required field renders `Too small: expected string to have >=1 characters` (`ar`: `أصغر من اللازم: يفترض لـ string أن يكون >= 1 حرف`), and a missing key renders `Invalid input: expected string, received undefined` — leaking the literal token `undefined` to an Arabic user. Those are the two most common messages in any form, which is why story 07 authors its own map rather than calling `z.config(z.locales.ar())` and declaring victory.
- **But the two compose, and that is the design.** Verified: `z.config({ ...z.locales.ar(), customError })` lets `customError` win where it returns a string and **fall through to the locale where it returns `undefined`**. So only the codes a form actually produces cost a translation; the exotic tail is still localised for free.
- **`zodResolver` throws the issue detail away.** Verified with `@hookform/resolvers@5.9.1`: RHF receives `{ message, type }` only — `minimum`, `origin`, and `input` are dropped. So messages must be fully resolved at parse time, which means a language switch cannot retranslate errors already on screen. Story 07 re-validates on `languageChanged`, guarded on `isSubmitted` so a switch never paints a pristine form red.
- **Radix's switch thumb moves the wrong way in RTL, and the story-06 gate could not see it.** `switch.tsx` positions the thumb with `data-[state=checked]:translate-x-[calc(100%-2px)]`; `translate-x` is physical and does not flip. `check-rtl.mjs` greps for physical *utilities*, not transforms, so it passed the file clean. Story 07 fixes the file **and** adds the pattern — a gate that missed a real bug is the strongest argument for extending it.
- **Nested serializer errors cannot reach a nested field.** `_as_message_list` (`apps/core/exceptions.py:74`) flattens one level into `"child: message"` strings under the *parent* key, so `address.city` never appears on the wire. Story 07 refuses to parse that string back apart (a message can itself contain `": "`) and surfaces such errors at form level instead; dotted paths would be a backend change.
- **No backend change was needed.** The `validation_error` + `fields` contract has been in place since story 02, so FORM-1 is a pure frontend story — the first in this epic.

**Note on testing:** per standing project policy this project authors no automated tests. Stories 05, 06, and 07 add none. Story 05's checks are `npm run build` (which typechecks every `t()` key), `npm run lint`, and the greps in its Verification Steps; story 06 adds `npm run check:rtl` as a real CI gate; story 07 extends that gate and leans on bilingual, bi-directional manual walkthroughs for everything a static check cannot see.

**Known gaps carried out of this epic — both foundations, both awaiting their first consumer:**

- **`DataTable` (story 06)** ships with no production consumer, because no paginated endpoint exists yet. The first list feature is where it earns its keep.
- **The form pattern (story 07)** ships with no production consumer, because no screen needs a form and no endpoint accepts writes. **AUTH-1's login form is the immediate next consumer**, and both foundations should be expected to need adjustment when they first meet real data.
