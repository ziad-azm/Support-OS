# Story 07 — Forms & Validation Foundation (Story: SUPPORTOS-12)

## Prerequisites

- **Story 06 completed:** [06-story-design-system-shared-components-SUPPORTOS-11.md](06-story-design-system-shared-components-SUPPORTOS-11.md). Verified landed: `frontend/src/shared/ui/primitives/` (thirteen components incl. `input.tsx`, `label.tsx`, `select.tsx`), `shared/lib/cn.ts`, `components.json` with the SupportOS aliases, `Direction.DirectionProvider` in `app/providers.tsx`, `shared/theme/`, `shared/ui/confirm/`, `shared/ui/data-table/`, `scripts/check-rtl.mjs` + the `check:rtl` CI gate, and `CONVENTIONS.md` § 19. **This story consumes § 19's primitive-patching discipline and extends its `check:rtl` gate.**
- **Story 05 completed:** [05-story-i18n-rtl-foundation-SUPPORTOS-9.md](05-story-i18n-rtl-foundation-SUPPORTOS-9.md) — the `common`/`errors` namespaces, the typed `t()` via `CustomTypeOptions`, and § 18's "no hardcoded user-facing strings" rule this story's message catalogue must satisfy.
- **Story 03 completed:** [../project-foundation-architecture/03-story-frontend-foundation-SUPPORTOS-4.md](../project-foundation-architecture/03-story-frontend-foundation-SUPPORTOS-4.md) — `ApiRequestError` and, specifically, the `fieldErrors` getter at `frontend/src/shared/lib/api/errors.ts:32` whose doc comment reads *"(FORM-1 consumes this)"*. **This story is what makes that comment true.**
- **Story 02 completed:** the backend envelope and `envelope_exception_handler`. `backend/apps/core/exceptions.py:22` defines `NON_FIELD_KEY = "non_field_errors"`, which is the form-level error channel this story reads.
- **`CONVENTIONS.md` § 6 (lines 97–104) currently reads "`FORM` (React Hook Form + Zod) is defined by **FORM-1**, not yet planned."** This story makes that sentence false; task 10 replaces it. Do not leave it.
- Verified frontend baseline: **no `react-hook-form`, no `zod`, no `@hookform/resolvers`, and no form anywhere in `src/`.** Grepped `frontend/src` for `useForm`, `Controller`, and `zod` — the only hits are `useFormatters` (a formatter hook, unrelated) in `shared/hooks/useFormatters.ts` and `shared/ui/data-table/DataTablePagination.tsx:5`. Clean slate.
- Verified toolchain (unchanged from story 06): Node **v24.15.0**, Vite **8.2.2**, React **19.2.8**, TypeScript **~6.0.2**, oxlint **1.79.0**, `tailwindcss` **4.3.3**, `radix-ui` **1.6.7**.
- This story is the last of EPIC 1 (`SupportOs backlog.MD` lines 203–213). **AUTH-1's login form is the first real consumer** — see the note in `## Story Goal` about shipping without one.

---

## Story Goal

Make "there is exactly one way to build a form" true, and make its messages localised by construction rather than by discipline.

1. React Hook Form + Zod installed, with a **single** `zodResolver` entry point so no feature picks its own validation library.
2. Validation messages resolved through **i18next**, in a new `validation` namespace, for both `en` and `ar` — never Zod's raw English, and never a hardcoded string in a schema.
3. Shared field components (`TextField`, `TextareaField`, `SelectField`, `CheckboxField`, `SwitchField`, `RadioGroupField`) that bind a label, control, description, and error message to RHF in one line each, and are correct in RTL.
4. **Server-side field errors land on the right inputs.** A `validation_error` envelope's `fields` map is applied to RHF, so a backend rejection reads like a client-side one.
5. Reusable schema helpers so field-shape decisions (required text, email, optional text, positive int) are made once, and so schema field names line up with DRF serializer fields with no mapping layer.
6. The `check:rtl` gate extended to catch the one RTL bug class story 06's version is blind to — a physical `translate-x`, which this story is the first to depend on.

### The four findings that shape this story

**1. Zod's built-in messages are developer-speak, in both languages.** Zod 4 ships 51 locales including `ar`, so "just use `z.config(z.locales.ar())`" is tempting. Verified against `zod@4.4.3`, here is what a blank required field and a missing field actually produce:

| Case | `en` | `ar` |
|---|---|---|
| `z.string().min(1)` on `''` | `Too small: expected string to have >=1 characters` | `أصغر من اللازم: يفترض لـ string أن يكون >= 1 حرف` |
| missing key | `Invalid input: expected string, received undefined` | `مدخلات غير مقبولة: يفترض إدخال string، ولكن تم إدخال undefined` |

Those are the two most common errors in any form, and both leak type-system vocabulary — the Arabic one leaks the literal token `undefined` to an Arabic-speaking user. **Zod's locales are unusable as user-facing form copy.** They are, however, a fine safety net for exotic codes.

**2. The two are composable, and that is the design.** Verified: `z.config()` accepts `customError` *and* a spread locale, and `customError` returning `undefined` **falls through** to the locale.

```js
z.config({ ...z.locales.ar(), customError: (issue) => issue.code === 'too_small' ? 'OURS' : undefined })
// too_small      -> "OURS"                          (ours)
// invalid_format -> "بريد إلكتروني غير مقبول"        (Zod's locale)
```

So task 2 writes an i18next map for the codes forms actually produce and returns `undefined` for the rest. Every message is translated; only the ones a user really sees cost us a translation.

**3. `zodResolver` throws the issue detail away, so messages must resolve at parse time.** Verified — for `z.object({ email: z.string().min(3) })` against `{ email: 'a' }`, `@hookform/resolvers@5.9.1` hands RHF exactly:

```json
{ "email": { "message": "Too small: expected string to have >=3 characters", "type": "too_small" } }
```

`minimum`, `origin`, and `input` are **gone**. So render-time translation with interpolation is impossible through the resolver, and the error map must return a finished, interpolated string. The consequence: a message is frozen in RHF's error state at validation time, and a language switch does **not** retranslate errors already on screen. Task 3 fixes that with an explicit re-validation on `languageChanged` — it is not left as a latent bug.

**4. `switch.tsx`'s thumb moves the wrong way in Arabic, and `check:rtl` cannot see it.** Verified in the registry source: the thumb is positioned with `data-[state=checked]:translate-x-[calc(100%-2px)]`. `translate-x` is physical and does not flip with direction, so in RTL the track's "on" end is on the left while the thumb still travels right. Story 06's `scripts/check-rtl.mjs` greps for physical *utilities* (`ml-`, `right-`, `text-left`) and has no `translate-x` pattern, so it passes this file clean. Task 5 closes the hole.

### Shipping without a consumer — stated plainly

**No screen in this repo needs a form.** `health` is the only feature and its one endpoint is a `GET`. Story 06 shipped `DataTable` the same way and the overview records that as a known gap; this story is the second and last foundation to do it, because **AUTH-1's login form is the immediate next consumer** (`SupportOs backlog.MD`, EPIC 2) and building FORM-1 inside AUTH-1 would bury a shared spec in a feature.

So verification uses a **throwaway harness that is deleted before committing** — the same shape story 06 used for `DataTable`, which worked. `CONVENTIONS.md` § 20 carries the copyable worked example AUTH-1 starts from. **Expect the first real form to need adjustments**, and say so in the story report.

### Explicitly out of scope

- **Any actual form screen.** Login is AUTH-1. Do not add a form to `health`.
- **A backend endpoint that accepts writes.** There is nothing to POST to; task 7's server-error bridge is verified against a hand-built envelope and a `curl` against a deliberately-invalid request, not against a new view.
- **Generating Zod schemas from DRF serializers** (or the reverse). The intake asks for schema conventions "reused for both client and shape alignment with DRF serializers" — that means **matching field names and shapes by convention**, which § 12's snake_case-end-to-end rule already gives us for free. A codegen pipeline is a much larger story and is not this one.
- **File upload / multipart.** The API layer sends `application/json` only (`shared/lib/api/client.ts:16`). A `File` field needs a parser change on both sides.
- **Multi-step / wizard forms, field arrays, and dynamic schema composition.** `useFieldArray` ships with RHF and is available; no shared abstraction is built over it until a feature needs one.
- **Async / server-side uniqueness validation as you type.** The submit round-trip is the enforcement point (§ 12: "The backend owns validation").
- **`sonner`, `@tanstack/react-table`** — still not installed, still out (§ 19).
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/internationalization-design-system/SUPPORTOS-12/intake.md` — the source story: **one** task block in the fenced Description, **no attachments, no acceptance criteria**. Done Criteria derive from its single **Outcome** line plus its three **Constraints**.
2. `CONVENTIONS.md` — read § 3 (lines 54–71; `erasableSyntaxOnly` forbids `enum`, `verbatimModuleSyntax` needs `import type`), § 4 (lines 73–84), **§ 6 (lines 97–104; the placeholder task 10 replaces)**, § 12 (lines 173–186; **"Wire format is `snake_case` end to end"** — the rule that makes task 7 need no name mapping), § 16 (lines 238–247), § 17 (lines 249–257), § 18 (lines 259–366), and **all of § 19 (lines 368–end)** — especially the primitive-patching discipline and the `check:rtl` allowlist.
3. `frontend/src/shared/lib/api/errors.ts` — `ApiRequestError`. **Line 13** declares `readonly fields: Record<string, string[]>`; **line 32** is the `fieldErrors` getter whose comment names FORM-1; **line 37** is `nonFieldErrors`; **line 41** is `isValidation`. **Line 91** is where `fields` is populated from the envelope. Task 7 consumes all of these and changes none of them.
4. `frontend/src/shared/lib/api/types.ts` — `'validation_error'` in `API_ERROR_CODES` (**line 8**) and `ApiErrorBody.fields` (**line 37**). The wire shape task 7 reads.
5. `backend/apps/core/exceptions.py` — the authority on what `fields` contains. **Line 20** `VALIDATION_MESSAGE`, **line 22** `NON_FIELD_KEY = "non_field_errors"`, the validation branch at **lines 35–40**, `_normalise_fields` at **lines 62–66**, and `_as_message_list` at **lines 69–75**. **Read line 74 carefully** — a nested serializer is flattened to `"child: message"` strings under the *parent* key, which bounds what task 7 can do.
6. `frontend/src/shared/i18n/resources.ts` — all 22 lines. The namespace registry task 2 adds `validation` to, and `AppResources` (line 22), which is what makes a mistyped key a build error.
7. `frontend/src/shared/i18n/config.ts` — `SUPPORTED_LANGUAGES` (line 5), `Language` (line 7), `FALLBACK_LANGUAGE` (line 9), `isSupported` (line 34). Task 2's locale registry is keyed off these; **do not add a second list of languages**.
8. `frontend/src/shared/i18n/index.ts` — all 31 lines. Lines 9–26 are the i18next `init`; lines 28–29 wire direction. Task 3 subscribes to the same `languageChanged` event these use, and task 1 imports the exported `i18next` instance (line 31).
9. `frontend/src/shared/i18n/useDirection.ts` — created by story 06. The precedent for "read i18next state in React via `useSyncExternalStore`", which task 3 follows rather than reinventing.
10. `frontend/src/shared/ui/primitives/input.tsx` and `label.tsx` — the two controls the shadcn `form` component builds on, both already patched and present.
11. `frontend/src/shared/ui/confirm/` — all four files. **The file-shape precedent this story copies** for `shared/ui/form/`: a `types.ts`, a context, a provider/component set, and a hook, each small and each in the module that owns it.
12. `frontend/scripts/check-rtl.mjs` — all of it. Task 5 adds one pattern and one line-level exemption; read the `CENTERING` const first and understand *why* it skips a whole line before changing anything.
13. `frontend/.oxlintrc.json` — the four `overrides` entries story 06 left. `react/jsx-no-literals` is `"error"` and `**/shared/ui/primitives/**` already has `react/only-export-components` off, which is what lets `form.tsx` export the `useFormField` hook beside its components. Task 6 adds no override.
14. Before task 4, run the sweep grep from § 19 against the newly generated primitives and compare with task 4's table. If a physical class appears that the table does not list, **add it** — the registry moves.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **RHF + Zod is the only form/validation approach.** | Intake, task constraints | One `zodResolver` wrapper (`shared/validation/resolver.ts`) and `CONVENTIONS.md` § 6 + § 20. No feature calls `zodResolver` or `useForm` directly with its own options. |
| **No alternative validation per feature.** | Intake, task constraints | § 20 states it; `shared/validation/schemas.ts` gives the field shapes so nobody needs to reach past it. |
| **Validation messages are never hardcoded.** | Intake, task constraints + § 18 | The i18next error map (task 2). A literal `message:`/`error:` string in a schema is the failure mode, and Verification Step 6 greps for it. |
| **Features compose shared field components + a Zod schema.** | Intake, Outcome | `shared/ui/form/` (task 6) and § 20's worked example. |
| **Every user-facing string in a namespace, `en` and `ar` in step.** | § 18 | New `validation` namespace, registered in `resources.ts`; key-set parity checked in Verification Step 5. |
| **Logical properties only.** | § 18 lines 306–320, § 19 | `npm run check:rtl`, **extended by task 5** to cover `translate-x`. |
| **Wire format is `snake_case` end to end.** | § 12 lines 173–186 | Schema field names are `snake_case`, so `setError(field)` in task 7 needs **no** name mapping. § 20 records this as the reason. |
| **The backend owns validation; the client check is UX only.** | § 12 | Task 7 — a server `validation_error` always wins and is displayed, even when the client schema passed. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | **This story adds no environment variable.** `.env.example` and the README env table are unchanged. |

---

## Frontend Tasks

### 1 — Dependencies and the Zod bootstrap

**Install.** From `frontend/`:

```powershell
npm install react-hook-form zod @hookform/resolvers
```

Verified current versions and peer ranges: `react-hook-form` **7.86.0** (peer `react: … || ^19` ✓), `zod` **4.4.3**, `@hookform/resolvers` **5.9.1** (peers `zod: ^3.25.0 || ^4.0.0` ✓ and `react-hook-form: ^7.55.0` ✓). All three are runtime dependencies, not devDependencies.

**Zod 4, not 3.** `4.4.3` is `latest`. The API differences that matter here are real and the plan uses the v4 forms throughout: top-level format functions (`z.email()`, `z.url()`, `z.uuid()` — verified present, and `z.string().email()` still exists but is the legacy spelling), and `z.config({ customError })` as the global error map (v3's `z.setErrorMap` is superseded).

**Create file: `frontend/src/shared/validation/config.ts`**

The single place Zod is configured, so no feature calls `z.config()` again.

```ts
import * as z from 'zod'

import { FALLBACK_LANGUAGE } from '@/shared/i18n/config'
import type { Language } from '@/shared/i18n/config'

import { zodErrorMap } from './errorMap'

/**
 * Zod's own locale, used as the FALLBACK beneath our error map.
 *
 * Keyed off `Language` so adding a language to `shared/i18n/config.ts` is a
 * type error here until its locale is registered — there is one list of
 * languages in this codebase, not two.
 */
const ZOD_LOCALES: Record<Language, () => z.core.$ZodConfig> = {
  en: z.locales.en,
  ar: z.locales.ar,
}

/**
 * Point Zod at a language. Called once at boot and again on every
 * `languageChanged` (see ./index.ts).
 *
 * `customError` wins; returning `undefined` from it falls through to the
 * spread locale. Verified against zod@4.4.3 — that fallthrough is the whole
 * reason we only have to translate the codes forms actually produce.
 */
export function applyZodLocale(language: string): void {
  const locale = ZOD_LOCALES[language as Language] ?? ZOD_LOCALES[FALLBACK_LANGUAGE]
  z.config({ ...locale(), customError: zodErrorMap })
}
```

**Create file: `frontend/src/shared/validation/index.ts`**

Side-effect bootstrap plus the public surface, mirroring `shared/i18n/index.ts` and `shared/theme/index.ts`.

```ts
import { i18next } from '@/shared/i18n'

import { applyZodLocale } from './config'

applyZodLocale(i18next.resolvedLanguage ?? i18next.language)
i18next.on('languageChanged', applyZodLocale)

export { applyZodLocale } from './config'
export { zodResolver } from './resolver'
export * from './schemas'
export { applyServerErrors, isValidationError } from './serverErrors'
```

**File: `frontend/src/main.tsx`** — add `import './shared/validation'` directly below the existing `import './shared/theme'`, inside the same side-effect comment block. It must run after `./shared/i18n` (it reads the instance) and before any component that builds a schema.

**Create file: `frontend/src/shared/validation/resolver.ts`**

The one entry point, so `@hookform/resolvers` is imported in exactly one file and swapping it later is a one-file change.

```ts
import { zodResolver as hookformZodResolver } from '@hookform/resolvers/zod'

/**
 * The project's only resolver. Features pass a schema to `useAppForm`
 * (shared/ui/form/useAppForm.ts) and never import from
 * `@hookform/resolvers` themselves — see CONVENTIONS.md §20.
 */
export const zodResolver = hookformZodResolver
```

---

### 2 — The i18next error map and the `validation` namespace

**Create file: `frontend/src/shared/validation/errorMap.ts`**

Returns a finished, interpolated string for the codes a form actually produces, and `undefined` for everything else so Zod's locale handles the tail.

```ts
import * as z from 'zod'

import { i18next } from '@/shared/i18n'

/** Origins we have authored size copy for. Anything else falls through. */
const SIZED_ORIGINS = ['string', 'number', 'array', 'set', 'file'] as const

function isBlank(input: unknown): boolean {
  return input === undefined || input === null || input === ''
}

/**
 * Maps a Zod issue to a translated message, or `undefined` to fall through to
 * Zod's own locale (registered alongside this in ./config.ts).
 *
 * Called at PARSE time, not at import time, so `t()` reads the language that
 * is active when validation runs — the opposite of the module-scope trap in
 * CONVENTIONS.md §18. The consequence is that a message is frozen into RHF's
 * error state until the next validation; ./index.ts re-validates on a
 * language change to compensate.
 */
export const zodErrorMap: z.core.$ZodErrorMap = (issue) => {
  const t = i18next.getFixedT(null, 'validation')

  // "Required" covers two distinct Zod codes and is by far the most common
  // message in any form. Zod's own copy for both is developer-speak
  // ("expected string, received undefined"), so both are captured here.
  if (issue.code === 'invalid_type' && isBlank(issue.input)) return t('required')
  if (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1) {
    return t('required')
  }

  switch (issue.code) {
    case 'too_small':
      if (!(SIZED_ORIGINS as readonly string[]).includes(issue.origin)) return undefined
      return t(`too_small.${issue.origin}`, { minimum: Number(issue.minimum) })

    case 'too_big':
      if (!(SIZED_ORIGINS as readonly string[]).includes(issue.origin)) return undefined
      return t(`too_big.${issue.origin}`, { maximum: Number(issue.maximum) })

    case 'invalid_type':
      return t(`invalid_type.${issue.expected}`, { defaultValue: t('invalid') })

    // `format` discriminates email/url/uuid/... — fall through for a format
    // we have no copy for rather than inventing one.
    case 'invalid_format':
      return t(`invalid_format.${issue.format}`, { defaultValue: undefined as unknown as string })

    case 'invalid_value':
      return t('invalid_value')

    case 'not_multiple_of':
      return t('not_multiple_of', { divisor: issue.divisor })

    default:
      // unrecognized_keys, invalid_union, invalid_key, invalid_element, custom
      // — schema-authoring or exotic cases. Zod's locale handles them.
      return undefined
  }
}
```

`i18next.getFixedT(null, 'validation')` binds the **namespace** but not the language — `null` means "current language, resolved per call". Do **not** capture `t` at module scope with a language bound.

**A `custom` issue carries its own message.** `z.string().refine(..., { error: ... })` sets `issue.message` before the map runs, and returning `undefined` for `custom` preserves it. That is how a feature adds a one-off rule — see § 20.

**Create file: `frontend/src/shared/i18n/locales/en/validation.json`**

Keys mirror Zod's issue codes so a lookup needs no mapping table, exactly as the `errors` namespace mirrors `ApiRequestError.code`.

```json
{
  "required": "This field is required.",
  "invalid": "This value is not valid.",
  "invalid_value": "Choose one of the available options.",
  "not_multiple_of": "Must be a multiple of {{divisor}}.",
  "too_small": {
    "string": "Must be at least {{minimum}} characters.",
    "number": "Must be {{minimum}} or more.",
    "array": "Select at least {{minimum}} items.",
    "set": "Select at least {{minimum}} items.",
    "file": "Must be at least {{minimum}} bytes."
  },
  "too_big": {
    "string": "Must be at most {{maximum}} characters.",
    "number": "Must be {{maximum}} or less.",
    "array": "Select at most {{maximum}} items.",
    "set": "Select at most {{maximum}} items.",
    "file": "Must be at most {{maximum}} bytes."
  },
  "invalid_type": {
    "number": "Enter a number.",
    "boolean": "Choose yes or no.",
    "date": "Enter a valid date."
  },
  "invalid_format": {
    "email": "Enter a valid email address.",
    "url": "Enter a valid URL.",
    "uuid": "Enter a valid identifier.",
    "datetime": "Enter a valid date and time.",
    "date": "Enter a valid date.",
    "time": "Enter a valid time.",
    "regex": "This value is not in the expected format.",
    "starts_with": "This value does not start as expected.",
    "ends_with": "This value does not end as expected.",
    "includes": "This value is missing something required."
  },
  "form": {
    "submitFailed": "The submitted data is invalid. Check the highlighted fields.",
    "unexpected": "Something went wrong submitting the form. Please try again."
  }
}
```

**Create `frontend/src/shared/i18n/locales/ar/validation.json`** with the identical key set. `too_small.string` / `too_big.string` / `too_small.array` interpolate a **count**, so if the Arabic reads poorly with a bare number, use i18next pluralisation (`_zero`/`_one`/`_two`/`_few`/`_many`/`_other`) as story 06 did for `table.rowCount` — **and pass both `count` and the display value**, because i18next selects the plural form from `count` only. If you keep the simple form, every key must still exist in both files.

**File: `frontend/src/shared/i18n/resources.ts`** — register the namespace. Add two imports beside the existing four and one entry per language to the map at lines 17–20:

```ts
import arValidation from './locales/ar/validation.json'
import enValidation from './locales/en/validation.json'

export const resources = {
  en: { common: enCommon, errors: enErrors, validation: enValidation, health: healthEn },
  ar: { common: arCommon, errors: arErrors, validation: arValidation, health: healthAr },
} as const
```

`AppResources` (line 22) is derived from the `en` map, so every `t('validation:…')` key becomes compile-checked for free. **No `i18next.d.ts` change is needed.**

---

### 3 — Retranslating errors on a language switch

The problem is verified and specific: `zodResolver` reduces each issue to `{ message, type }`, so the message string sits frozen in RHF's error state. Switch to Arabic with errors on screen and they stay English until the next validation.

**File: `frontend/src/shared/validation/index.ts`** — already re-applies the Zod locale on `languageChanged` (task 1). That fixes *future* validations. This task fixes the *displayed* ones.

**Create file: `frontend/src/shared/ui/form/useAppForm.ts`**

The wrapper every feature calls instead of `useForm`. It wires the resolver and the re-validation in one place, so no feature has to remember either.

```ts
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { DefaultValues, FieldValues, UseFormProps, UseFormReturn } from 'react-hook-form'
import type * as z from 'zod'

import { i18next } from '@/shared/i18n'
import { zodResolver } from '@/shared/validation/resolver'

type UseAppFormOptions<TSchema extends z.ZodType> = Omit<
  UseFormProps<z.output<TSchema>>,
  'resolver' | 'defaultValues'
> & {
  schema: TSchema
  defaultValues: DefaultValues<z.output<TSchema>>
}

/**
 * The project's only form entry point. Binds the shared resolver and
 * re-validates on a language change.
 *
 * Why the re-validation: `zodResolver` stores a finished message string in
 * RHF's error state (verified — the issue's `minimum`/`origin` are dropped),
 * so a language switch cannot retranslate what is already displayed. Firing
 * `trigger()` re-runs the schema, which re-enters the error map, which reads
 * the new language. Guarded on `isSubmitted` so a switch never *introduces*
 * errors on a form the user has not tried to submit yet.
 */
export function useAppForm<TSchema extends z.ZodType>({
  schema,
  ...options
}: UseAppFormOptions<TSchema>): UseFormReturn<z.output<TSchema>> {
  const form = useForm<z.output<TSchema>>({
    ...options,
    resolver: zodResolver(schema),
  } as UseFormProps<z.output<TSchema>>)

  const { trigger, formState } = form
  const { isSubmitted } = formState

  useEffect(() => {
    const retranslate = () => {
      if (isSubmitted) void trigger()
    }
    i18next.on('languageChanged', retranslate)
    return () => {
      i18next.off('languageChanged', retranslate)
    }
  }, [trigger, isSubmitted])

  return form
}
```

**`isSubmitted`, not `isDirty` or an unconditional `trigger()`.** An unconditional re-validation would paint a pristine form red the moment someone switches language — a worse bug than a stale message. Reading `isSubmitted` off `formState` also subscribes the component to it, which is what RHF's proxy-based state requires.

**A server error set by task 7 is *not* retranslated, and that is correct** — the backend already localised it via `Accept-Language`, and `trigger()` clears it. Task 7's doc comment states this; § 20 records it.

---

### 4 — The `form` primitive and the four field controls

**Add the components.** From `frontend/`:

```powershell
npx shadcn@latest add form textarea checkbox switch radio-group
```

Five files land in `frontend/src/shared/ui/primitives/`. Verified `registryDependencies`: `form` needs `button` and `label`, both already present — nothing else is pulled in. **Do not add `field`** — that is the newer non-RHF Field primitive family and it would sit unused beside `form`, giving two ways to lay out a field.

**Then run the sweep. Every row below was verified against the live registry.**

#### 4a — `"use client"`

Verified present in **four** of the five: `form.tsx`, `checkbox.tsx`, `switch.tsx`, `radio-group.tsx` (`textarea.tsx` is clean). Delete the directive and the blank line after it, and add the § 19 header comment naming what changed.

#### 4b — Physical direction classes

Verified: **exactly one hit**, and it is the sanctioned exception.

| File | Generated | Action |
|---|---|---|
| `radio-group.tsx` (indicator) | `absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2` | **Leave as generated.** Symmetric centring — `start-1/2` would break it. Verified that `scripts/check-rtl.mjs`'s existing `CENTERING` regex already matches this line, so the gate passes it without a script change. |

`form.tsx`, `textarea.tsx`, `checkbox.tsx`, and `switch.tsx` ship **no** physical direction utilities.

#### 4c — The `translate-x` bug the gate cannot see

**File: `frontend/src/shared/ui/primitives/switch.tsx`** — the `SwitchPrimitive.Thumb` className. Generated:

```
data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0
```

`translate-x` does not flip with direction, so in Arabic the thumb travels toward the wrong end of the track. Add an RTL counterpart on the same line:

```
data-[state=checked]:translate-x-[calc(100%-2px)] rtl:data-[state=checked]:-translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0
```

**Both utilities set `--tw-translate-x`, so this depends on the `rtl:`-variant rule winning the cascade.** Verify it visually (Verification Step 8) rather than assuming. **If the thumb still moves the wrong way**, the documented fallback is a rule in `frontend/src/index.css`'s `@layer base`, which beats variant-ordering questions outright:

```css
  /* Radix's switch thumb is positioned with a physical translate-x, which
     does not flip with direction. See CONVENTIONS.md §20. */
  [dir='rtl'] [data-slot='switch-thumb'][data-state='checked'] {
    --tw-translate-x: calc(-100% + 2px);
  }
```

Use one mechanism or the other, not both.

#### 4d — Hardcoded English

Verified: **none** of the five ships a JSX text literal, so `react/jsx-no-literals` stays green. `form.tsx` throws `"useFormField should be used within <FormField>"` — a programmer error thrown at development time, which § 18 keeps in English deliberately. **Leave it.**

#### 4e — `form.tsx`'s `FormMessage` needs no i18n change

`FormMessage` renders `String(error?.message ?? '')`. Because task 2's error map returns a finished translated string, that is already localised copy and the component stays as generated apart from 4a's directive removal. **Do not** add a `t()` call in `FormMessage` — it would double-translate an already-translated string and break server errors, which arrive pre-translated from the backend.

---

### 5 — Close the `translate-x` hole in the RTL gate

Task 4c found an RTL bug in a file `npm run check:rtl` reports clean. The gate is the reason § 19's rule is enforceable rather than aspirational, so it gets the pattern.

**File: `frontend/scripts/check-rtl.mjs`** — add one entry to `PATTERNS` and one line-level exemption. Keep the existing patterns and the `CENTERING` const exactly as they are.

```js
  // Physical horizontal translate. Does not flip with direction, so a thumb /
  // slider / drawer animated with it moves the wrong way in RTL. Exempt when
  // the line also carries an `rtl:` counterpart (see RTL_HANDLED below), or
  // when it is the symmetric centring idiom (see CENTERING above).
  /(?<![\w-])-?translate-x-(?!0(?![\w.]))/g,
```

and, beside `CENTERING`:

```js
/**
 * A line that already carries an `rtl:` variant has handled its own
 * direction, so a physical `translate-x` on it is deliberate. This is why
 * primitives/switch.tsx passes: it pairs the checked translate with an
 * `rtl:` negation on the same line.
 */
const RTL_HANDLED = /\brtl:/
```

In the per-line loop, skip the `translate-x` pattern when `RTL_HANDLED` matches. The narrowest change that does it — keep the existing `CENTERING` early-return above it:

```js
    if (CENTERING.test(line)) return
    for (const pattern of PATTERNS) {
      if (pattern.source.includes('translate-x') && RTL_HANDLED.test(line)) continue
      for (const match of line.matchAll(pattern)) {
```

`translate-x-0` is excluded by the negative lookahead — it is a no-op reset and flipping it is meaningless.

**Run the gate before and after task 4c.** Before: it must name `primitives/switch.tsx`. After: zero. That before/after is the proof both the fix and the new pattern are real — Verification Step 4 requires it.

---

### 6 — The shared field components

**Create `frontend/src/shared/ui/form/`** — the file shape mirrors `shared/ui/confirm/` (a `types.ts`, small components, the hook beside them).

**`types.ts`** — the props every field shares, so six components do not each invent a spelling:

```ts
import type { ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'

export type FieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  /** Must match the Zod schema key, which matches the DRF serializer field. */
  name: FieldPath<TFieldValues>
  /** Already translated by the caller — these components never guess copy. */
  label: string
  description?: string
  placeholder?: string
  disabled?: boolean
  children?: ReactNode
}
```

**`TextField.tsx`** — the reference implementation the other five follow. Composes `FormField` → `FormItem` → `FormLabel` → `FormControl`(`Input`) → `FormDescription` → `FormMessage`, and forwards `type` for `email`/`password`/`number`. Accepts `FieldProps<T> & { type?: 'text' | 'email' | 'password' | 'number' }`.

**`TextareaField.tsx`**, **`SelectField.tsx`** (takes `options: readonly { value: string; label: string }[]`, labels already translated), **`CheckboxField.tsx`**, **`SwitchField.tsx`**, **`RadioGroupField.tsx`** — same shape.

Two details that apply to all six:

- **`Select`, `Checkbox`, `Switch`, and `RadioGroup` are not native form controls.** They are Radix components with `value`/`onValueChange` (or `checked`/`onCheckedChange`) rather than a DOM `ref` + `onChange`, so each of these fields must render inside `FormField`'s `Controller` and wire `field.value` / `field.onChange` explicitly. `TextField` and `TextareaField` can spread `{...field}` because `Input`/`Textarea` are real DOM elements. Story 06's `LanguageSwitcher` doc comment already warned that `Select` needs `Controller`; this is where that lands.
- **Checkbox and Switch put the label beside the control, not above it**, so their `FormItem` needs `flex flex-row items-center gap-2` and the label must not be the grid's first row. Use `gap-2` and logical utilities only — **no `ml-*`/`mr-*`** (`check:rtl` enforces it).

**`index.ts`** — re-export the six fields plus `useAppForm`, so a feature's import is one line:

```ts
export { useAppForm } from './useAppForm'
export { TextField } from './TextField'
export { TextareaField } from './TextareaField'
export { SelectField } from './SelectField'
export { CheckboxField } from './CheckboxField'
export { SwitchField } from './SwitchField'
export { RadioGroupField } from './RadioGroupField'
```

**`FormRoot`** is not needed — shadcn's `Form` *is* `FormProvider`. Features that use `useAppForm` and pass `control` explicitly do not need the provider at all; `form.tsx`'s `useFormField` reads `useFormContext`, so **a field rendered outside `<Form>` will throw**. Either always wrap in `<Form {...form}>`, or always pass `control`. **Pick the `<Form>` wrapper** — it is what the shadcn components expect, and § 20's example shows it.

---

### 7 — Server-side field errors

The half of "validate consistently" that has nothing to do with Zod: a backend rejection must land on the same inputs, in the same red text, as a client-side one.

**Create file: `frontend/src/shared/validation/serverErrors.ts`**

```ts
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

import { ApiRequestError } from '@/shared/lib/api/errors'

/** The backend's form-level bucket — `backend/apps/core/exceptions.py:22`. */
const NON_FIELD_KEY = 'non_field_errors'

export function isValidationError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.isValidation
}

/**
 * Apply a `validation_error` envelope's `fields` map to a form.
 *
 * Messages are passed through UNTRANSLATED because the backend already
 * localised them via `Accept-Language` (CONVENTIONS.md §18). Do not run these
 * through `t()`, and note they are NOT retranslated on a language switch —
 * `useAppForm`'s `trigger()` clears them instead, which is correct: only the
 * server can re-issue a server error.
 *
 * Field names need no mapping. Wire format is snake_case end to end
 * (CONVENTIONS.md §12), so a serializer field, a Zod key, and an RHF path are
 * the same string.
 *
 * Returns the messages that could NOT be attached to a field, for the caller
 * to surface as form-level copy.
 */
export function applyServerErrors<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  error: ApiRequestError,
): string[] {
  const unattached: string[] = [...error.nonFieldErrors]
  const known = new Set(Object.keys(form.getValues()))
  let firstField: Path<TFieldValues> | null = null

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages.join(' ')
    if (field === NON_FIELD_KEY) continue
    // A field the form does not have (a serializer-only field, or a nested
    // one the backend flattened) would be set and never rendered — an error
    // the user cannot see or clear. Surface it at form level instead.
    if (!known.has(field)) {
      unattached.push(message)
      continue
    }
    const path = field as Path<TFieldValues>
    form.setError(path, { type: 'server', message })
    firstField ??= path
  }

  if (firstField) form.setFocus(firstField)
  return unattached
}
```

**The nested-serializer limitation, stated because the wire makes it unavoidable.** `_as_message_list` (`backend/apps/core/exceptions.py:74`) flattens a nested serializer one level into `` `${key}: ${msg}` `` strings under the **parent** key. So a nested error arrives as `{"address": ["city: This field is required."]}`, **not** `{"address.city": [...]}`. There is no `address.city` on the wire, so `setError('address.city')` is impossible. Nested-object forms therefore show nested errors on the parent field or at form level. **Do not "fix" this in the frontend by parsing the `"child: message"` string** — it is ambiguous (a message may itself contain `": "`). If a feature needs true nested field errors, change `_normalise_fields` to emit dotted paths; that is a backend story, not a parse in the client.

**`setFocus` on the first server error** — a rejected submit usually scrolls the button into view with the offending field off-screen. Focusing it is the difference between "nothing happened" and a visible error.

**Wiring at the call site**, which § 20's example shows in full: catch the mutation error, `isValidationError(error)` → `applyServerErrors`, and render whatever it returns plus `t('validation:form.submitFailed')` in an `Alert`. Any **non**-validation error is already handled — `createQueryClient`'s `MutationCache.onError` toasts every mutation failure (`shared/lib/api/queryClient.ts:49`), so a 500 or a network drop needs no per-form code. **A `validation_error` will also toast**, which is the one wrinkle: the toast says "The submitted data is invalid." while the fields say what is wrong. Suppress the duplicate by giving the mutation `meta` and checking it, or accept it. **Accept it for now** and record it in § 20 as the known rough edge — suppressing it means touching the shared `queryClient`, which is out of scope here.

---

### 8 — Schema helpers

**Create file: `frontend/src/shared/validation/schemas.ts`**

Field shapes decided once. Every helper is a function so a schema reads declaratively and nobody re-derives "how do we do optional text".

```ts
import * as z from 'zod'

/**
 * Shared field shapes. Features compose these instead of re-deriving them, so
 * "what does required text mean" is answered once. Messages come from the
 * error map (./errorMap.ts) — NEVER pass a literal `error:` string here.
 * See CONVENTIONS.md §20.
 */

/** Required text. `.trim()` first, so "   " is blank, not 3 characters. */
export function requiredString(max = 255) {
  return z.string().trim().min(1).max(max)
}

/** Optional text. Normalises '' to undefined so a blank input is "not sent". */
export function optionalString(max = 255) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional()
}

export function email() {
  return z.email().max(254)
}

export function optionalEmail() {
  return z.union([z.literal(''), z.email().max(254)]).transform((v) => (v === '' ? undefined : v))
}

/** A number typed into a text input. `coerce` turns '42' into 42. */
export function positiveInt(max?: number) {
  const base = z.coerce.number().int().min(1)
  return max === undefined ? base : base.max(max)
}

/** A `<select>` over a fixed set. Matches a DRF `ChoiceField`. */
export function choice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values)
}

/** Opt-in boolean (a checkbox that must be ticked, e.g. accept-terms). */
export function requiredBoolean() {
  return z.literal(true)
}
```

`z.enum` on an `as const` tuple, **not** a TypeScript `enum` — `erasableSyntaxOnly` forbids `enum` (§ 3).

**`.trim()` before `.min(1)` is the important one.** Without it a whitespace-only value passes a required check on the client and is then rejected by DRF, which strips by default — a client/server disagreement that reads as a phantom failure.

**`z.coerce.number()` for numeric text inputs**, because `<input type="number">` still yields a string through RHF. Verified `z.coerce` is present in 4.4.3.

**Naming.** Schema keys are `snake_case` to match the serializer (§ 12). `z.output<typeof schema>` is the form's value type — use `z.output`, not `z.infer`, wherever a `.transform()` is involved, since input and output types differ there.

---

## Backend Tasks

**No backend changes required.**

Story 06 already enabled `OrderingFilter`; nothing in FORM-1 needs a settings change, a migration, or a new endpoint. The envelope contract this story consumes — `validation_error` plus `fields` — has been in place since story 02 (`backend/apps/core/exceptions.py:35–40`), and `BaseModelSerializer` (`apps/core/serializers.py:4–20`) is already the single inheritance point a future write endpoint will use.

Two things to **verify unchanged** rather than modify:

1. `python manage.py test` still reports **54 passing**. This story touches no Python, so a change here means something else broke.
2. `_normalise_fields` still emits flat `{field: [messages]}` — task 7's contract. If a future story makes it emit dotted paths, `applyServerErrors`'s `known.has(field)` guard is where nested support would be added.

**Do not** add a write endpoint to exercise the form. Verification uses a deliberately-invalid request against an existing route (Verification Step 9) plus a hand-built envelope in the harness.

---

## Edge Cases & Failure Modes

- **Zod's own messages are developer-speak in both languages.** Verified: a blank required field gives `Too small: expected string to have >=1 characters` / `أصغر من اللازم: يفترض لـ string أن يكون >= 1 حرف`, and a missing key leaks the literal token `undefined` to an Arabic user. This is why task 2 exists and why `required` is special-cased on **two** codes (`invalid_type` with blank input, and `too_small` with `minimum === 1`).
- **A message is frozen at validation time.** `zodResolver` reduces an issue to `{ message, type }` — verified — so `minimum`/`origin` are unavailable at render and a language switch cannot retranslate on its own. `useAppForm`'s `trigger()` on `languageChanged` is the fix, and it is guarded on `isSubmitted` so a switch never paints a pristine form red.
- **`z.config()` is global and last-write-wins.** A second call anywhere replaces the error map and the locale together. `shared/validation/config.ts` is the only sanctioned caller; a feature calling `z.config()` silently disables our translations everywhere.
- **The error map runs at parse time, not import time.** That is what makes it language-current, and it is the *opposite* of the `errors.ts:55` module-scope trap in § 18. Capturing `const t = i18next.getFixedT('en', 'validation')` at module scope would reintroduce exactly that bug — use `getFixedT(null, …)` inside the function.
- **`switch.tsx`'s thumb moves the wrong way in RTL and the gate is blind to it.** Verified in the registry source. `translate-x` is physical; story 06's `check-rtl.mjs` has no pattern for it. Task 5 adds one; task 4c fixes the file. **The `rtl:` override depends on cascade order** — verify visually, and use the documented `index.css` fallback if the variant loses.
- **`radio-group.tsx`'s centring must stay physical.** `left-1/2` + `-translate-x-1/2` is symmetric. Verified that the existing `CENTERING` regex already exempts that line, so it needs no script change — but task 5's new `translate-x` pattern would flag it if `CENTERING`'s early-return were moved below the pattern loop. Keep the ordering.
- **Radix controls have no DOM `ref`.** `Select`, `Checkbox`, `Switch`, and `RadioGroup` take `value`/`onValueChange` or `checked`/`onCheckedChange`. Spreading `{...field}` onto them silently does nothing — the field renders, accepts input, and submits `undefined`. Each must wire `field.value`/`field.onChange` explicitly inside `Controller`.
- **A field rendered outside `<Form>` throws.** `useFormField` reads `useFormContext`, so a field without the provider dies with `Cannot destructure property 'getFieldState' of null`. Always wrap in `<Form {...form}>`.
- **Whitespace-only input.** `.min(1)` without `.trim()` accepts `"   "`, which DRF then rejects because it strips by default. `requiredString()` trims first. A schema that hand-rolls `z.string().min(1)` reintroduces the mismatch.
- **`<input type="number">` yields a string.** Through RHF the value is `"42"`, so a bare `z.number()` fails with `invalid_type`. `positiveInt()` uses `z.coerce.number()`. An empty numeric input coerces to `NaN`, not `undefined` — for an optional number, union with `z.literal('')` and transform, the way `optionalEmail()` does.
- **A `.transform()` makes input and output types differ.** `z.infer` is the output type; a form whose `defaultValues` are typed from `z.infer` will not accept the pre-transform shape. Use `z.output<>` for the form's value type, and type `defaultValues` from it — `optionalString()` and `optionalEmail()` both transform.
- **Server errors for fields the form does not have.** A serializer-only field, or a nested one the backend flattened, would be `setError`-ed onto a path that renders nowhere — an error the user can neither see nor clear, blocking submit forever. `applyServerErrors` checks `form.getValues()` and returns those messages for form-level display instead.
- **Nested serializer errors cannot reach a nested field.** `_as_message_list` (`exceptions.py:74`) flattens to `"child: message"` under the parent key, so `address.city` does not exist on the wire. Do not parse the string — a message can itself contain `": "`. Dotted paths are a backend change.
- **A `validation_error` toasts *and* fills the fields.** `MutationCache.onError` (`queryClient.ts:49`) toasts every mutation failure, so a rejected submit shows "The submitted data is invalid." in a toast on top of the inline field errors. Accepted for this story and recorded in § 20; suppressing it means changing the shared `queryClient`.
- **Server errors are not retranslated.** They arrive already localised via `Accept-Language`, and `trigger()` clears rather than re-translates them. Running them through `t()` would look up a full sentence as a key and render the sentence back — harmless-looking, and wrong the moment a key happens to match.
- **`getFixedT(null, 'validation')` vs a namespace prefix.** `getFixedT` binds the namespace, so keys inside the map are written bare (`'required'`, `'too_small.string'`). Writing `t('validation:required')` there would look up namespace `validation` *inside* namespace `validation`. Pick one spelling; the plan uses the bound form.
- **Arabic plurals for size messages.** `too_small.string` interpolates a count. If Arabic needs the six plural categories, i18next selects the form from `count` **only** — pass `count` alongside the display value, as story 06 did for `table.rowCount`. Verification Step 5's key comparison will show the extra `ar` categories as expected extras, not typos.
- **The `validation` namespace must be registered before the first parse.** `resources.ts` is static so the namespace is present at init, but `main.tsx`'s import order still matters: `./shared/validation` reads the i18next instance, so it must come after `./shared/i18n`. Out of order, `applyZodLocale` runs against an uninitialised instance and every message falls back to Zod's English.
- **`react/only-export-components` and `form.tsx`.** It exports the `useFormField` hook beside its components. Story 06's fourth oxlint override (`**/shared/ui/primitives/**`) already covers it — **do not add a fifth override**, and do not move the hook out of the CLI-managed file.
- **RHF and the React Compiler lint rule.** Story 06 hit `react(preserve-manual-memoization)` on a `useMemo` whose deps read an optional property. RHF's `formState` is a proxy and `useEffect` deps on `trigger`/`isSubmitted` are plain values, so no warning is expected — but `npm run lint` is the check, and the fix is to hoist the value into a local before the dep array, never to disable the rule.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added, and no test step goes into CI. This section records that as a decision.

The mechanical checks that stand in for it:

1. `npm run build` — `tsc -b` typechecks every new `t('validation:…')` key through `CustomTypeOptions`, every `z.output<>` inference, and the generic `FieldProps<T>` / `useAppForm<TSchema>` signatures. A mistyped validation key is a compile error.
2. `npm run lint` — `react/jsx-no-literals` on the five new primitives and the six new field components.
3. `npm run check:rtl` — **extended by task 5**; it is the only machine check of § 19's rule and now covers `translate-x`.
4. `npm run format:check` — proves the generated primitives were reformatted to the repo's Prettier settings.
5. The `en`/`ar` key-set comparison in Verification Step 5.
6. Manual bilingual, bi-directional walkthroughs of the harness — Verification Steps 6–8.

**Constraint on the existing suite:** `python manage.py test` must still report **54 passing**. This story touches **no Python at all**, so any movement means something unrelated broke.

---

## Migration / Rollback

**No schema, no data migration, no backend change.** This story adds frontend modules, five generated primitives, one locale namespace, and one line in `scripts/check-rtl.mjs`.

**Rollback:** revert the commits, then re-run `npm install` in `frontend/`. `package.json` and `package-lock.json` change together, and a reverted lockfile against a stale `node_modules` produces `Cannot find module 'zod'` at dev-server start.

**Nothing outlives a rollback.** Unlike stories 05 and 06, this story writes no `localStorage` key.

**Half-applied states to avoid:**

- **Task 2 before task 1's `resources.ts` edit** → every `t('validation:…')` key fails `tsc -b`, because `AppResources` has no `validation` namespace yet. Register the namespace and author the JSON in one sitting.
- **Task 1 without the `main.tsx` import** → `applyZodLocale` never runs, `z.config` is never called, and **every message silently falls back to Zod's built-in English** — including in Arabic. The form works, looks fine to an English reader, and is wrong. This is the most likely way this story ships broken.
- **`./shared/validation` imported before `./shared/i18n` in `main.tsx`** → same symptom, different cause.
- **Task 4 before task 5** → `npm run check:rtl` passes while `switch.tsx` is genuinely broken in RTL. Add the pattern first so the gate names the file, then fix it. Order: 5, then 4c.
- **Task 5 before task 4c** → CI is red on `primitives/switch.tsx` until 4c lands. Do them together.
- **Task 6 before task 4** → the field components import `form`, `textarea`, `checkbox`, `switch`, and `radio-group` from `shared/ui/primitives/`, none of which exist yet.
- **Task 7 before task 6** → nothing to attach errors to; `applyServerErrors` typechecks but cannot be exercised.
- **Deleting the harness before running Verification Steps 6–9** → the only thing that exercises any of this. Delete it *after*, and confirm with Step 10.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build` — exits 0. The real check on the typed `t()`: a mistyped `validation` key and a bad `z.output<>` inference are both compile errors here.
2. **Lint and format clean:** from `frontend/` — `npm run lint` and `npm run format:check` — both exit 0.
3. **The extended gate passes:** from `frontend/` — `npm run check:rtl` — exits 0 and prints `no physical direction utilities in src/`.
4. **The new pattern actually fires.** Temporarily delete the `rtl:` counterpart from `primitives/switch.tsx`'s thumb className, run `npm run check:rtl`, and confirm it exits non-zero **naming that file and line**. Restore it. Then temporarily add `className="translate-x-4"` to any component and confirm it is flagged too. A gate nobody has seen fail is not a verified gate.
5. **`en` and `ar` key sets match** for the new namespace. From `frontend/`:

   ```powershell
   node -e "const a=require('./src/shared/i18n/locales/en/validation.json'),b=require('./src/shared/i18n/locales/ar/validation.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,p+k+'.'):[p+k]);const A=f(a).sort(),B=f(b).sort();console.log('missing in ar:',A.filter(k=>!B.includes(k)));console.log('extra in ar:',B.filter(k=>!A.includes(k)))"
   ```

   `missing in ar` must be empty. `extra in ar` is empty unless you used Arabic plural categories, in which case it lists exactly those suffixed keys.
6. **Client-side validation reads like product copy, in both languages.** Build the harness (below), `npm run dev`, and submit it empty. Every message is a real sentence — **`This field is required.`**, not `Too small: expected string to have >=1 characters`. Switch to Arabic **with the errors on screen**: every message becomes Arabic *without* a re-submit (that is task 3's `trigger()`), and none of them contains the token `undefined` or the word `string`.
7. **The fallthrough works.** Add a field with an exotic rule the map does not cover — `z.object({ a: z.string() }).strict()` fed an extra key, or `z.number().multipleOf(3)` — and confirm the message is Zod's **translated** copy, not raw English, in Arabic. That proves `customError` → `undefined` → `localeError` is wired.
8. **RTL is correct for every new control.** With Arabic active, in the harness: the checkbox and switch labels sit to the **right** of their controls; the radio indicator is centred in its circle (not offset); and — the one this story exists to catch — **the switch thumb travels toward the left end of the track when checked**, matching the RTL reading direction. If it travels right, task 4c's `rtl:` override lost the cascade; apply the `index.css` fallback and re-check.
9. **Server field errors land on the right inputs.** First confirm the wire shape with a deliberately-invalid request against a route that validates — with the backend running:

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/health/ -H "Content-Type: application/json" -H "Accept-Language: ar" -d "{}"
   ```

   Read the envelope: a `405` with `code: "method_not_allowed"` confirms the route rejects writes (there is no write endpoint yet — that is expected). Then, in the harness, feed `applyServerErrors` a hand-built `ApiRequestError` with `code: 'validation_error'` and `fields: { name: ['Server says no.'], unknown_field: ['Orphan.'], non_field_errors: ['Form-level.'] }`, and confirm: `name` shows `Server says no.` inline and **receives focus**; `Orphan.` and `Form-level.` both come back in the returned array and render at form level; nothing is attached to a field that does not exist.
10. **The harness is gone.** `git status` from the repo root shows no harness file and no uncommitted edit to `HealthPage.tsx`.
11. **Backend regression:** from `backend/` with the venv active — `python manage.py check` clean, `python manage.py test` reports **54 passing**, `ruff format --check .` and `ruff check .` both exit 0. This story touches no Python; any movement is a signal, not a pass.
12. **The full gate set, as CI runs it:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0, in that order.

**The harness** (task 8's equivalent of story 06's `ScratchDataTable`): create `frontend/src/features/health/components/ScratchForm.tsx` with a schema built from `requiredString()`, `email()`, `positiveInt()`, `choice()`, and `requiredBoolean()`; render every one of the six field components through `useAppForm` inside `<Form {...form}>`; add a button that calls `applyServerErrors` with the hand-built error from Step 9. Render it from `HealthPage`, walk Steps 6–9, then **delete the file and the `HealthPage` edit before committing.** A committed fixture with no consumer is the dumping-ground failure `frontend/src/README.md` exists to prevent.

---

## Done Criteria

- [ ] `react-hook-form`, `zod`, and `@hookform/resolvers` are in `frontend/package.json` **dependencies** (not devDependencies).
- [ ] `@hookform/resolvers` is imported in **exactly one** file, `shared/validation/resolver.ts` (grep to confirm).
- [ ] `shared/validation/` contains `config.ts`, `errorMap.ts`, `resolver.ts`, `schemas.ts`, `serverErrors.ts`, `index.ts`.
- [ ] `z.config()` is called in **exactly one** file, `shared/validation/config.ts`, and its locale registry is keyed off `Language` from `shared/i18n/config.ts` — **no second list of languages**.
- [ ] `main.tsx` side-effect-imports `./shared/validation` **after** `./shared/i18n`.
- [ ] `shared/i18n/locales/{en,ar}/validation.json` exist with identical key sets, and `validation` is registered in `resources.ts` for both languages.
- [ ] A blank required field reads **`This field is required.`** / its Arabic equivalent — **not** Zod's `Too small: …`. Both the `invalid_type`-with-blank-input and `too_small`-with-`minimum: 1` paths produce it.
- [ ] No message a user can see contains `undefined`, `string`, `number`, or `expected` (Verification Step 6).
- [ ] An issue code the map does not cover falls through to Zod's **translated** locale, verified in Arabic (Verification Step 7).
- [ ] `useAppForm` re-validates on `languageChanged`, **guarded on `isSubmitted`**, so a pristine form is never painted red by a language switch — and errors already on screen **do** retranslate without a re-submit.
- [ ] `shared/ui/primitives/` gains `form`, `textarea`, `checkbox`, `switch`, `radio-group`; `"use client"` is gone from the four that shipped it; each patched file carries the § 19 header comment.
- [ ] **`primitives/switch.tsx`'s thumb has an `rtl:` counterpart** (or the documented `index.css` fallback, not both), and the thumb visibly travels toward the **start** of the track in Arabic (Verification Step 8).
- [ ] `radio-group.tsx`'s `left-1/2` + `-translate-x-1/2` centring is **unchanged**.
- [ ] `scripts/check-rtl.mjs` has a `translate-x` pattern and an `RTL_HANDLED` line exemption; `translate-x-0` is excluded; the `CENTERING` early-return still runs **before** the pattern loop.
- [ ] Removing the `rtl:` counterpart makes `npm run check:rtl` **fail, naming the file** (Verification Step 4).
- [ ] `shared/ui/form/` contains `types.ts`, `useAppForm.ts`, `index.ts`, and the six field components; each takes already-translated `label`/`description` and **never guesses copy**.
- [ ] The four Radix-backed fields wire `field.value`/`field.onChange` explicitly and do **not** spread `{...field}` onto a Radix root.
- [ ] `applyServerErrors` attaches by `snake_case` name with **no mapping layer**, passes messages through **untranslated**, focuses the first errored field, and returns unattachable messages (including `non_field_errors` and fields absent from the form) instead of setting them.
- [ ] `schemas.ts` exports `requiredString`, `optionalString`, `email`, `optionalEmail`, `positiveInt`, `choice`, `requiredBoolean`; `requiredString` **trims before** `min(1)`; `choice` uses `z.enum` on an `as const` tuple, never a TS `enum`.
- [ ] **No literal message string** in any schema or helper — messages come only from the error map (grep for `message:` and `error:` inside `shared/validation/`).
- [ ] **No backend file changed.** `git status` shows nothing under `backend/`.
- [ ] `CONVENTIONS.md` § 6 is rewritten (it no longer says "not yet planned") and `## 20. Forms & validation` is **appended, with §0–§19 unrenumbered**. § 20 covers: RHF+Zod as the only approach; `useAppForm` as the only entry point; the error-map-plus-locale-fallback design and why Zod's own copy is unusable for forms; parse-time resolution and the `trigger()` consequence; snake_case names needing no mapping; the nested-serializer limitation; the duplicate-toast rough edge; the `translate-x` RTL trap; and a copyable worked example ending in `applyServerErrors`.
- [ ] `frontend/src/README.md` documents `shared/validation/` and `shared/ui/form/`; root `README.md` § Design system mentions the form pattern; **§ Environment variables is unchanged**.
- [ ] `ScratchForm.tsx` and every temporary verification edit are deleted; `git status` is clean of them.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`, `ruff format --check .`, and `ruff check .` all exit 0; `python manage.py test` still reports **54 passing**.
- [ ] `00-overview.md` for this feature updated with this story, and EPIC 1 marked complete.
- [ ] **The story report states plainly that FORM-1 ships with no production consumer** and that AUTH-1's login form is the first one and will likely need adjustments.

**STOP HERE. Report to the user and wait for confirmation. This completes EPIC 1 — the next story is AUTH-1 (EPIC 2, Authentication & Authorization), the first consumer of both this story's form pattern and story 06's primitives.**
