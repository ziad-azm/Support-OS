# SupportOS conventions (`CONV`)

This is the single source of truth every later task cites instead of re-deriving a
standard. It is deliberately **reference-based** — where a rule is already written
down elsewhere in the repo, this document links to it rather than repeating it.

**If the code and this document disagree, the code wins.** Fix this document in the
same PR that changes the code.

---

## 0. Before you write new code

1. Search for an existing implementation before adding a new one — `grep` the symbol
   or concept you need, and check the two shared homes first:
   - Backend: `backend/apps/core/`
   - Frontend: `frontend/src/shared/`
2. Read the relevant placement doc (`backend/apps/README.md` or
   `frontend/src/README.md`) and the shared spec it points to.
3. Extend what exists rather than duplicating it.
4. Only then write new code.

---

## 1. Folder structure & file placement

Backend: organised by domain app, one per business area, never by technical layer.
Frontend: organised by feature, never by technical layer. Both are decision records,
not tutorials — read them for the actual placement rule.

- Backend: [`backend/apps/README.md`](backend/apps/README.md)
- Frontend: [`frontend/src/README.md`](frontend/src/README.md)

---

## 2. Naming conventions

- **Python:** `snake_case` modules and functions, `PascalCase` classes,
  `UPPER_SNAKE` constants. App labels match the domain word already chosen in
  [`backend/apps/README.md`](backend/apps/README.md) § The apps.
- **TypeScript:** `PascalCase` for components and types, `camelCase` for
  functions/variables, `UPPER_SNAKE` for module-level constants.
- **Files:** React components `PascalCase.tsx`; everything else `camelCase.ts`.
  Hooks start with `use`. Backend modules `snake_case.py`. **One scoped
  exception:** files under `frontend/src/shared/ui/primitives/` keep the
  shadcn registry's own lowercase-kebab names (`dropdown-menu.tsx`), because
  renaming them breaks `shadcn add` and `shadcn diff`. Everything we author —
  including everything else in `shared/ui/` — is `PascalCase.tsx`.
- **No abbreviations** that are not already in the domain vocabulary — `sla` is
  fine (it is a domain term), `cust` is not.

---

## 3. TypeScript conventions

Three `frontend/tsconfig.app.json` settings are non-obvious and will bite if you
forget them:

- **`strict` is on.** Every new file must satisfy it.
- **`erasableSyntaxOnly` forbids `enum`, parameter properties, and namespaces.**
  Use an `as const` array plus indexed access instead. See
  `frontend/src/shared/lib/api/types.ts` for the worked example
  (`API_ERROR_CODES`).
- **`verbatimModuleSyntax` requires `import type` for type-only imports.** A value
  used with `instanceof` (e.g. `AxiosError`) is **not** type-only and must stay a
  normal import — mixing this up is the most common build break.

**Named exports only.** No default exports, so a symbol has exactly one name
everywhere it is imported.

---

## 4. API communication

The full contract — envelope shape, error codes, retries, query keys — is
documented once, in [`README.md`](README.md) § API conventions and §
Consuming the API from the frontend. Two rules that are easy to break:

- Backend views **return plain payloads** and never build an envelope
  themselves — the renderer and exception handler do that.
- Frontend features call `api.*` from `@/shared/lib/api/client` and never
  `httpClient` directly, `fetch`, or a second `axios.create`.

---

## 5. Error, loading & empty states

`QueryBoundary` for a single-resource query; `DataTable`
(`shared/ui/data-table/`) for a paginated list. `DataTable` does not wrap
`QueryBoundary` because `QueryBoundary`'s branches return a `<div>`, which is
not a valid child of `<tbody>` — it renders the same `Loading`/`Empty`/
`ErrorState` inside a `<TableCell colSpan>` instead. Either way, **never
hand-roll an `isPending`/`isError` branch in a feature.**

---

## 6. Validation

`FORM` is React Hook Form + Zod, established by story 07 and specified in
§ 20. `useAppForm` (`frontend/src/shared/ui/form/useAppForm.ts`) is the
**only** entry point — a feature never calls `useForm` or imports
`@hookform/resolvers` itself. Validation messages come from the i18next
`validation` namespace via a Zod error map, never from a literal string in a
schema. Compose the shared field components in `shared/ui/form/` with a
schema built from the helpers in `shared/validation/schemas.ts`.

---

## 7. Reusable components

`UI` is Tailwind CSS v4 + shadcn/ui, established by story 06 and specified in
§ 19. `frontend/src/shared/ui/` is the reuse-first home: `primitives/` is the
CLI-managed shadcn set, everything above it is ours. Features compose these;
they never restyle a primitive or hand-build a button, dialog, or table. The
props of `Loading`, `Empty`, `ErrorState`, and `QueryBoundary` are a **stable
contract** — story 06 restyled all four without changing one.

---

## 8. Shared utilities

Same stop-at-first-match placement rule as folder structure (§1): used by one
feature/app → keep it there; used by two or more → move it to `shared`.

The asymmetry that makes this cheap to follow: moving code **into** `shared`
later is easy. Untangling `shared` after it becomes a dumping ground is not.
Default to keeping code in its feature or app until a second consumer
actually appears.

---

## 9. Environment & config

Full variable reference: [`README.md`](README.md) § Environment variables.

- A new environment variable lands in the app's `.env.example` **and** the
  README table, in the same commit.
- The frontend reads `import.meta.env` in exactly these files — nowhere else:
  `frontend/src/config/env.ts`, `frontend/src/main.tsx`,
  `frontend/src/app/providers.tsx`, `frontend/src/shared/lib/logger.ts`.

---

## 10. Logging

**Backend:** `logging.getLogger(__name__)` at module scope. Never `print()`.

**Frontend:** `logger` from `@/shared/lib/logger`. Never a bare `console.*`
call — `debug`/`info` are stripped outside dev; `warn`/`error` always emit.

**Levels** (both apps, same meanings):

| Level | Meaning |
|---|---|
| DEBUG | Local detail, useful only while developing this exact code path. |
| INFO | Normal lifecycle events. |
| WARNING | Recoverable, but worth noticing. |
| ERROR | Needs attention — something failed. |
| CRITICAL | Data loss or the app cannot continue. |

**Never log secrets.** No request bodies, tokens, passwords, or
`POSTGRES_PASSWORD` in a log call, ever — including inside an exception
traceback you're about to log.

---

## 11. API response conventions

The envelope shape (`{success, data, error, meta}`) is documented once, in
[`README.md`](README.md) § API conventions. It is the **only** response
shape in this API. Wire keys are `snake_case` deliberately — they are not
renamed in transit.

---

## 12. Frontend/backend boundaries

- The backend owns validation and authorization. A frontend-side check is UX
  only — it is never the enforcement point, and the backend must reject
  anything the frontend's check would have caught.
- Wire format is `snake_case` end to end. Do not camelCase it on the way in
  or out.
- The frontend never hardcodes a host. It builds every URL from
  `env.apiBaseUrl` (`frontend/src/config/env.ts`).
- A new endpoint is registered once, in `backend/config/api_urls.py`, and
  consumed through a feature's `api/` folder — never called inline from a
  component.

---

## 13. Auth conventions

`AUTHZ` is complete. Both halves have landed:

- **Authentication** — AUTH-1. Who are you? See **§ 21**.
- **Authorization** — AUTH-2. What may you do? See **§ 22**.

Auth lives in `frontend/src/shared/auth/` and `backend/apps/accounts/`, with
the permission vocabulary and the one DRF permission class in
`backend/apps/core/permissions.py`. Never build a second auth flow, a second
token store, a second `useAuth()`-shaped hook, or a second permission check
— extend what is there.

**Standing note on the project-wide default, now narrowed.**
`DEFAULT_PERMISSION_CLASSES` is still `AllowAny`, and that is a decision
rather than an unfinished task. A viewset subclassing `BaseModelViewSet` is
**closed by default** (`IsAuthenticated + HasPermission`), so the hazard is
now limited to a plain `APIView` that sets neither a base nor explicit
`permission_classes` — such a view is public. **Any `APIView` that must be
protected still sets `permission_classes` explicitly on itself.**

Flipping the global default to `IsAuthenticated` is a one-line change and
would work today (`HealthView` and `ApiNotFoundView` both set `AllowAny`
explicitly). It is deliberately deferred until there are enough endpoints for
the default to be load-bearing — right now there is exactly one authenticated
endpoint, so the change would trade real regression risk for no real safety.

---

## 14. Linting & formatting

| | Backend | Frontend |
|---|---|---|
| Format | `ruff format .` | `npm run format` (Prettier) |
| Lint | `ruff check .` | `npm run lint` (oxlint) |
| Line length | 100 | 100 |

Run from `backend/` or `frontend/` respectively, with the backend venv
active. Both numbers are 100 by measurement, not convention — see
`backend/pyproject.toml` and `frontend/.prettierrc.json` for why.

**Formatting is never a review comment.** If the pre-commit hook or CI
passed, the formatting is correct by definition — do not request a manual
style change on top of it.

---

## 15. Import conventions

- **Frontend:** `@/` for any import crossing out of the current
  feature/shared folder; relative (`./`, `../`) for imports within the same
  feature. No deep import into another feature's internals — go through
  `shared/` instead. Enforced by `no-restricted-imports` in
  `frontend/.oxlintrc.json`.
- **Backend:** import order is stdlib → third-party → first-party
  (`apps`, `config`) → relative, enforced by ruff's `I` (isort) rules.
- **No circular imports** between `shared/` modules in either app.

---

## 16. Verification (this project does not author automated tests)

This project does not write automated tests. Changes are verified by running
the commands in [`README.md`](README.md) and driving the app directly.

The 54 backend tests under `backend/apps/core/tests/` and
`backend/config/tests/` predate this policy and are kept, but they are not
extended and no new test file is added anywhere in the repo.

---

## 17. Dependencies

- **Backend:** range pins (`>=x,<y`) in `backend/requirements.txt`
  (runtime) and `backend/requirements-dev.txt` (tooling). No lockfile.
- **Frontend:** `frontend/package-lock.json` is committed.
- Before adding a dependency, check whether an existing one already does the
  job (§0).

---

## 18. Internationalization & RTL

**No hardcoded user-facing strings.** Every one goes in an i18next namespace.
`react/jsx-no-literals` in `frontend/.oxlintrc.json` only catches **direct
JSX text children** — verified against the real tree, it flagged 1 of 4
patterns:

| Pattern | Flagged? |
|---|---|
| `<p>text</p>` | **yes** |
| `{cond ? <p>text</p> : null}` | no |
| `{cond && <p>text</p>}` | no |
| `<span>{'text'}</span>` | no |

Do not assume lint catches everything — conditional rendering is ubiquitous
and this rule misses all of it. Grep by hand when in doubt.

**Namespaces.** `common` and `errors` are shared, at
`frontend/src/shared/i18n/locales/{en,ar}/`. Each feature owns
`src/features/<feature>/locales/{en,ar}.json` and registers them in
`src/shared/i18n/resources.ts`. Adding a feature = adding its namespace
files plus one line per language in `resources.ts`.

**Every key in `en` must exist in `ar`.** `en` is the typed source of
truth — `CustomTypeOptions.resources` in `i18next.d.ts` is derived from the
`en` map, so a key that exists only in `ar` typechecks fine and is simply
unreachable. A missing `ar` key falls back silently to English with no
warning; compare key sets by hand (see the plan's Verification Step 3) when
adding a namespace.

**What stays in English:** logs (`shared/lib/logger.ts`), programmer errors
thrown at development time (e.g. `useToast()` used outside its provider),
and pre-i18n setup failures (`config/env.ts` — thrown before i18next can
even initialise). Nobody but a developer reads these.

**Errors translate by `code`, never by message.** The API layer
(`shared/lib/api/{errors,client,queryClient}.ts`) is not React and its
modules are evaluated once, so translating a message at module scope would
freeze it at import time and never update on a language switch.
`ApiRequestError` keeps an English `message` as a fallback; the UI looks up
copy against the `errors` namespace by `code`:

```ts
const message = t(`errors:${error.code}`, { defaultValue: error.message })
```

Apply this in a component with `useTranslation()` — never inside the API
layer itself.

**Direction:** `dir` and `lang` on `<html>` are written by exactly one
module, `frontend/src/shared/i18n/direction.ts`. No component sets
`direction` or writes `document.documentElement` itself — including
`LanguageSwitcher`, which only calls `i18n.changeLanguage()` and lets the
detector persist the choice and `direction.ts` react to it.

**Logical properties only.** No `left`, `right`, `margin-left`,
`padding-right`, `text-align: left`, or `text-align: right` anywhere in
CSS. **The class mapping UI-1 must follow once Tailwind lands:**

| Use | Never use |
|---|---|
| `ms-*` / `me-*` | `ml-*` / `mr-*` |
| `ps-*` / `pe-*` | `pl-*` / `pr-*` |
| `start-*` / `end-*` | `left-*` / `right-*` |
| `text-start` / `text-end` | `text-left` / `text-right` |
| `border-s-*` / `border-e-*` | `border-l-*` / `border-r-*` |

This rule predates Tailwind deliberately — I18N-1 had to land before UI-1
could, so the constraint is written down here rather than in a Tailwind
config that does not exist yet.

**Bidirectional text.** An Arabic string containing a Latin run (a product
name, an email, a ticket ID) can render with confusing punctuation
placement — this is the Unicode bidi algorithm, not a bug to fix in CSS.
Where it matters, wrap the Latin run in an element with `dir="ltr"`.

**Formatting:** use `useFormatters()` (`shared/hooks/useFormatters.ts`) in
components, or the pure functions in `shared/lib/format.ts` elsewhere. Never
call `Intl` or `toLocaleString` directly in a feature.

Both `numberingSystem` (`latn`) and `calendar` (`gregory`) are pinned
explicitly on every call for Arabic. Verified: bare `ar` resolves to Western
digits and the Gregorian calendar, but `ar-EG` and `ar-SA` resolve to
Arabic-Indic digits — relying on resolution makes output depend on the tag
and on the browser's ICU build. **This is a product decision, not a
technical one**, made for a support CRM where Arabic screens mix ticket
IDs, timestamps, and amounts with Latin-script data. To reverse it: change
`INTL_LOCALE.ar` in `shared/i18n/config.ts` to `'ar-EG'` and drop
`numberingSystem` from `format.ts`.

**Backend.** User-facing strings in `apps/core/exceptions.py` use
`gettext_lazy` (`from django.utils.translation import gettext_lazy as _`),
never plain `gettext` — a non-lazy call at module scope binds at import
time and freezes the language. The frontend sends `Accept-Language` from
the active language on every request (`shared/lib/api/client.ts`).

DRF's and Django's own messages (`NotFound`, `PermissionDenied`, etc.)
ship pre-compiled Arabic `.mo` files already — verified working. Our own
custom messages need `python manage.py compilemessages`, which needs GNU
gettext installed; the committed `.po` at `backend/locale/ar/LC_MESSAGES/`
is the source of record until then.

**Forward constraint:** TanStack Query keys do not include the language.
The moment an API response carries user-facing prose (not just machine
codes like `health.status`), `language` must join that query's key, or a
cached response keeps showing stale-language text after a switch.

---

## 19. Design system, theming & data tables

**Tailwind v4 is CSS-first.** Tokens live in `@theme inline` in
`frontend/src/index.css`; there is no `tailwind.config.js` and adding one
creates a second source of truth. Every colour, radius, and font stack comes
from a token — no hex, `rgb()`, `oklch()`, or bare `px` in a component.

**Where a component goes:** `shared/ui/primitives/` is CLI-managed
(`npx shadcn@latest add <name>`), lowercase-kebab, and locally patched — see
below. `shared/ui/` is ours, `PascalCase.tsx`. `components.json` redirects the
CLI's `@/components/ui` and `@/lib/utils` defaults; **do not** let a
`shadcn add` recreate a top-level `components/` or `lib/`.

**Registry output is not RTL-clean, and every patched file says so in a
header comment.** Verified against the live registry: 9 of 12 components
shipped physical direction classes, 3 shipped `"use client"`, and
`dialog.tsx` shipped two hardcoded English strings. **After every
`shadcn add`, run `npm run check:rtl` and re-read the new file for JSX
literals.** `shadcn diff` will always report the patched files as changed.

**The one sanctioned physical idiom:** `left-[50%]` + `translate-x-[-50%]`
overlay centring, because it is symmetric. `start-[50%]` would break it —
`start` flips with direction, `translate-x` does not.
`scripts/check-rtl.mjs` allowlists exactly this, and nothing else.

**Radix reads direction from a React context, never from `<html dir>`.**
Verified: `useDirection()` in `@radix-ui/react-direction` falls back to the
literal `'ltr'`. `Direction.DirectionProvider` in `app/providers.tsx`, fed by
`shared/i18n/useDirection.ts`, is what makes Select/DropdownMenu/Tabs behave
in Arabic. **Remove it and every primitive silently reverts to LTR keyboard
and placement behaviour with no error and no visual clue in English.**

**Directional icons mirror; non-directional icons do not.** Chevrons and
arrows flip (`rtl:rotate-180`, or swap the icon). Checkmarks, spinners, and
X's do not. There is no blanket `[dir=rtl] svg { transform: scaleX(-1) }` and
there must not be.

**Two document-level writers, one attribute each.**
`shared/i18n/direction.ts` owns `<html dir>` and `<html lang>`.
`shared/theme/theme.ts` owns `<html class="dark">`. No component writes
either. Both are mirrored by the inline anti-FOUC script in `index.html`, and
**all four copies of the two storage keys are commented as needing to stay in
sync**.

**Toast stays ours, and why.** `sonner` is not installed:
`shared/ui/toast/toastSink.ts` is how `createQueryClient`'s `onError` reaches
a toast from outside React, and it has no sonner equivalent. `useToast()` and
`pushToast()` are the API; the renderer behind them may change.

**`useConfirm()`** returns `Promise<boolean>` and resolves `false` on cancel,
`Escape`, and overlay dismiss. Copy is passed in already translated — the
module never guesses. Same Context/Provider/hook/types shape as
`shared/ui/toast/`.

**`DataTable` is the only table pattern.** Sorting and pagination are
**server-side**: `?page=`, `?page_size=`, and `?ordering=field` / `-field`
(DRF's `OrderingFilter`, enabled in `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS`).
A `ColumnDef<T>`'s `id` doubles as the ordering field name and must match the
serializer field. `@tanstack/react-table` is **not** installed and must not
be added to get client-side models we would bypass — pagination and sorting
here are server-side, and `@tanstack/react-table@9.1.2` is a rewrite
(`useTable` + `tableFeatures()`, plus a `@tanstack/react-store` runtime
dependency).

Worked example:

```tsx
const { page, sort, params, setPage, setSort } = useServerTable({ pageSize: 25 })
const query = useQuery({
  queryKey: ticketKeys.resource('list', params),
  queryFn: () => api.getPage<Ticket>('/tickets/', { params }),
})

const columns: ColumnDef<Ticket>[] = [
  { id: 'subject', header: t('tickets:subject'), cell: (row) => row.subject, sortable: true },
  {
    id: 'created_at',
    header: t('tickets:createdAt'),
    cell: (row) => date(row.created_at),
    sortable: true,
    align: 'end',
  },
]

<DataTable
  columns={columns}
  query={query}
  rowKey={(row) => String(row.id)}
  sort={sort}
  onSortChange={setSort}
  onPageChange={setPage}
  caption={t('tickets:listCaption')}
/>
```

**Changing the sort resets to page 1.** Page 2 of a re-ordered result set is
a different set of rows — `useServerTable.setSort` does this automatically.

**A stack trace or any Latin-only code run inside an RTL document needs
`dir="ltr"`** on its element. `ErrorState`'s `<pre>` is the worked example,
and it is the first real instance of § 18's bidi rule.

**Cross-reference forward:** `Select`, `Input`, and `Label` ship as
primitives here. FORM-1 binds them to React Hook Form + Zod; **`Select` is
not a native form control** and integrates through `Controller`, not
`register()`.

**An equality filter on a list screen is local component state merged into
the query params at the call site, exactly like free-text `search`** — not a
`useServerTable` feature. `TicketListPage`'s category/priority filters
(Story 18, `TKT-2`) are the worked example: each filter is a plain `Select`
(the `LanguageSwitcher` pattern — controlled `value`/`onValueChange`, not
React Hook Form's `Controller`, since a filter is not a form field) with a
non-empty sentinel value (`"all"`) standing in for "no filter," because
Radix's `Select.Item` requires a non-empty `value`. **Changing a filter
resets the page** the same way changing `search` already does — a filtered
result set can be narrower than the page the user was on.

---

## 20. Forms & validation

**React Hook Form + Zod is the only approach.** `useAppForm`
(`frontend/src/shared/ui/form/useAppForm.ts`) is the **only** entry point —
no feature calls `useForm` directly, and `@hookform/resolvers` is imported
in exactly one file, `shared/validation/resolver.ts`. Compose the shared
field components in `shared/ui/form/` (`TextField`, `TextareaField`,
`SelectField`, `CheckboxField`, `SwitchField`, `RadioGroupField`) with a
schema built from `shared/validation/schemas.ts`'s helpers
(`requiredString`, `optionalString`, `email`, `optionalEmail`,
`positiveInt`, `choice`, `requiredBoolean`).

**Why Zod's own copy is unusable for forms.** Verified against `zod@4.4.3`:
a blank required field renders `Too small: expected string to have >=1
characters` (Arabic: `أصغر من اللازم: يفترض لـ string أن يكون >= 1 حرف`),
and a missing key renders `Invalid input: expected string, received
undefined` — leaking the literal token `undefined` to an Arabic user. Those
are the two most common messages in any form.

**The error-map-plus-locale-fallback design.** `shared/validation/config.ts`
calls `z.config({ ...locale(), customError: zodErrorMap })` exactly once.
`zodErrorMap` (`shared/validation/errorMap.ts`) returns a translated string
for the issue codes a form actually produces (via the `validation` i18next
namespace, keyed on Zod's own issue codes the way `errors` is keyed on
`ApiRequestError.code`) and `undefined` for everything else, which **falls
through** to Zod's own locale underneath. Never call `z.config()` a second
time anywhere — it replaces the map and the locale together, silently
disabling every translation.

**Messages resolve at parse time, not at render time.** `zodResolver`
reduces a Zod issue to `{ message, type }` for React Hook Form — `minimum`,
`origin`, and `input` are dropped. So a message must be a finished,
interpolated string by the time the map returns it, and a language switch
cannot retranslate an error already on screen on its own. `useAppForm`
calls `trigger()` on `languageChanged`, **guarded on `isSubmitted`** so a
switch never paints a pristine form red.

**A `custom` issue keeps its own message.** `z.string().refine(fn, { error:
'...' })` sets `issue.message` before the map runs; returning `undefined`
for `code === 'custom'` preserves it. That is how a feature adds a one-off
rule with its own copy.

**Field names are `snake_case`, matching the DRF serializer — no mapping
layer.** § 12's "wire format is snake_case end to end" means a schema key,
an RHF field path, and a serializer field are the same string, so
`applyServerErrors` (`shared/validation/serverErrors.ts`) can call
`form.setError(field, …)` directly from a `validation_error` envelope's
`fields` map.

**Server errors are applied untranslated.** The backend already localised
them via `Accept-Language` (§ 18); running them through `t()` would look up
a full sentence as a translation key. They are also **not** retranslated on
a language switch — `trigger()` clears them instead, which is correct: only
the server can re-issue a server error.

**The nested-serializer limitation.** `_as_message_list`
(`backend/apps/core/exceptions.py`) flattens a nested serializer one level
into `"child: message"` strings under the **parent** key, so a path like
`address.city` never exists on the wire. `applyServerErrors` does not parse
that string apart — a message can itself contain `": "` — and surfaces such
errors at form level instead. True nested field errors need the backend to
emit dotted paths.

**A `validation_error` toasts *and* fills the fields — a known rough edge.**
`MutationCache.onError` (`shared/lib/api/queryClient.ts`) toasts every
mutation failure, so a rejected submit shows a generic toast on top of the
inline field errors. Accepted for now; suppressing it means changing the
shared `queryClient`.

**Radix-backed controls are not native form controls.** `Select`,
`Checkbox`, `Switch`, and `RadioGroup` report changes via
`onValueChange`/`onCheckedChange`, not `onChange`, and have no DOM `ref`.
Their field components wire `field.value`/`field.onChange` explicitly inside
`FormField`'s `Controller` — spreading `{...field}` onto one of these
silently does nothing.

**The `translate-x` RTL trap.** A physical `translate-x` does not flip with
direction, so a thumb, slider, or drawer animated with it moves the wrong
way in RTL — verified in `primitives/switch.tsx`'s checked-state thumb
position, which shipped this way from the shadcn registry. `check-rtl.mjs`
(§ 19) has a `translate-x` pattern for exactly this, with two sanctioned
exemptions: a line carrying its own `rtl:` counterpart, and Radix's
`data-[side=left|right]:translate-x-*` popper-positioning idiom, which is
anchor-relative screen-space positioning, not text direction.

**Worked example**, from a schema to a submitted form with server-error
handling:

```tsx
const schema = z.object({
  subject: requiredString(),
  priority: choice(['low', 'medium', 'high']),
})

function TicketForm() {
  const { t } = useTranslation(['tickets', 'validation'])
  const form = useAppForm({
    schema,
    defaultValues: { subject: '', priority: 'medium' },
  })
  const [formErrors, setFormErrors] = useState<string[]>([])

  const { mutate } = useMutation({
    mutationFn: (values: z.output<typeof schema>) => api.post('/tickets/', values),
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutate(values))}>
        <TextField control={form.control} name="subject" label={t('tickets:subject')} />
        <SelectField
          control={form.control}
          name="priority"
          label={t('tickets:priority')}
          options={[
            { value: 'low', label: t('tickets:priorityLow') },
            { value: 'medium', label: t('tickets:priorityMedium') },
            { value: 'high', label: t('tickets:priorityHigh') },
          ]}
        />
        {formErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t('validation:form.submitFailed')}
              {formErrors.map((message, i) => (
                <p key={i}>{message}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit">{t('tickets:submit')}</Button>
      </form>
    </Form>
  )
}
```

**`nullablePositiveInt(max?)`** (Story 53) is `positiveInt`'s coerced-number
validator combined with `nullableEmail`/`nullableString`'s `'' -> null`
transform — for a nullable numeric database column edited through a text
input, the same shape `OrganizationSettings.default_response_target_minutes`/
`default_resolution_target_minutes` need.

---

## 21. Authentication (JWT)

AUTH-1 (Story 08). `backend/apps/accounts/` and `frontend/src/shared/auth/`
are the only places auth logic lives — no feature reimplements login, token
storage, or a guard.

**The stock `djangorestframework-simplejwt` views need no subclassing.**
`EnvelopeJSONRenderer` wraps *any* non-`Envelope` response body in
`success_envelope(data)`. `TokenObtainPairView`/`TokenRefreshView` return a
plain `{access, refresh}` dict, so the envelope contract holds with zero
custom serializers or views — `apps/accounts/urls.py` wires the library's
views directly.

**The exception handler's error `code` comes from the exception *class*, not
the raised instance.** Verified against the real endpoints:

| Case | `code` |
|---|---|
| Wrong login credentials | `authentication_failed` |
| Missing/blank login field | `validation_error`, `fields: {"password": [...]}` |
| Bad/expired refresh token | `token_not_valid` |
| Bad/expired access token on any protected endpoint | `token_not_valid` |
| No token at all | `not_authenticated` |

A bad login and an expired session are **different, already-meaningful**
codes. The login serializer's dynamic field name (`get_user_model().USERNAME_FIELD`,
which is `"email"`) is why a missing-password validation error lands on the
frontend with field name `email`/`password` — the same strings the Zod login
schema uses — with zero name-mapping. This is § 12's snake_case-end-to-end
rule paying off a second time (the first was FORM-1's `applyServerErrors`).

**Token storage: in-memory access token, `localStorage` refresh token — a
deliberate trade-off, not an oversight.** The access token is never
persisted, so it is not readable by an XSS payload that survives a reload.
The refresh token must survive a reload to keep the user signed in, so it is
the one piece of auth state in `localStorage['supportos.refreshToken']`. An
httpOnly-cookie refresh token would be more XSS-resistant but needs no
client-side "token storage" logic at all — the intake explicitly asked for
storage and refresh *in the Axios interceptor*, which only makes sense for a
client-held token. If a future story moves to a cookie-based refresh flow,
`shared/auth/tokenStorage.ts` and `refresh.ts` are the two files to replace;
nothing else should need to change.

**Two seams on `httpClient`, not one.** `client.ts` exposes
`setAuthTokenProvider` (reads the current access token for every outgoing
request) and `setUnauthorizedHandler` (attempts one silent refresh on a
`token_not_valid` 401, retries the original request once). Both are wired in
`shared/auth/index.ts`'s side-effect import — never call `httpClient`'s
interceptors directly from a feature. The refresh-retry interceptor is
registered **before** the existing error-normalising one, so it still sees
the raw envelope's `error.code` rather than an already-wrapped
`ApiRequestError`. It exempts the refresh endpoint itself from retrying (a
`token_not_valid` from `/auth/token/refresh/` must not trigger another
refresh — that is the infinite-recursion case).

**`refreshAccessToken()` is a single-flight promise, verified necessary.**
`SIMPLE_JWT` sets `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION`
together: every successful refresh issues a new refresh token and blacklists
the one it consumed. Confirmed with real requests — reusing an
already-rotated-away refresh token fails with `token_not_valid` /
`"Token is blacklisted"`, not a generic error. If two 401s fired two
independent refresh calls, the second would present a token the first had
already spent, logging the user out for no real security reason.
`shared/auth/refresh.ts` holds one in-flight promise; every caller —
`AuthProvider`'s boot sequence and the interceptor's `unauthorizedHandler`
alike — awaits the same call.

**`LogoutView` takes no `Authorization` header on purpose.** The refresh
token in the request body *is* the credential being revoked; requiring a
still-valid access token would make logout impossible in exactly the case it
exists for (the access token already expired). It swallows `TokenError` so a
second logout call with an already-blacklisted token is a no-op 200, not an
error.

**AUTH-1 fills in *authentication* only** (does this token identify a real
user?). *Authorization* — what that user may then do — is § 22. `MeView`
sets `permission_classes = [IsAuthenticated]` explicitly, which is still how
a plain `APIView` gets protected; a **viewset** inherits its defaults from
`BaseModelViewSet` instead. See § 13 for the standing note on the global
`AllowAny` default.

**A known rough edge, accepted rather than engineered around:** a failed
login also fires the shared `MutationCache.onError` toast (the same
translated `authentication_failed` copy `LoginPage` would otherwise have had
to render itself) — this is a feature, not a duplicate, and is why
`LoginPage`'s own `onError` only handles `validation_error` field errors and
does nothing else.

**A single-use, expiring token is `is_active` plus a password-state check,
not a nonce.** `InviteConfirmSerializer` (Story 70, `SEC-5`) signs only a
user id and an expiry (`apps.accounts.tokens`, the same
`django.core.signing.dumps`/`loads(..., max_age=...)` shape
`live_chat_adapter`'s session token already established) — what makes it
single-use is requiring `not user.has_usable_password()` in `validate`,
never `is_active=False` alone. `is_active` is a general-purpose field any
`BaseModelViewSet.update` can flip for unrelated reasons; gating only on it
would let a stale-but-still-valid token reactivate an account an admin
disabled for cause after the original invite was already spent.
`has_usable_password()` only flips back to `True` through the one endpoint
that calls `set_password`, so it is the actual "has this token already been
used" signal. Reach for this pattern whenever a token grants a one-time
state transition on a field a normal admin action can also independently
flip.

**When a token's account has no natural "already used" state to gate on,
bake a digest of that state into the token's own payload instead.**
SEC-5's invite token (the entry directly above) is single-use because the
account itself transitions from pending to active. SEC-7's password-reset
token has no such transition available — the account is already active,
with a usable password, throughout. `password_fingerprint`
(`apps/accounts/tokens.py`) closes this by embedding a one-way digest of
`user.password` in the signed payload: once `set_password()` changes that
value, every previously-issued token's baked-in digest silently stops
matching, with no second stored "used" flag anywhere. The digest, never
the hash (or a slice of it) directly — `signing.dumps` signs, it does not
encrypt, so anything in the payload is visible to whoever holds the
token. This is the same technique Django's own `default_token_generator`
uses; reach for it whenever this project needs a single-use token for a
resource with no natural pending→active transition to check instead.

**A plain `APIView` that needs `request` inside its serializer must pass
`context={"request": request}` explicitly — a `ModelViewSet`'s
`get_serializer()` does this for free, a bare `APIView` does not.**
`ChangePasswordView` (Story 73, `SEC-8`) is the first plain `APIView` in
this codebase whose serializer reads `self.context["request"].user`
(`apps.portal.serializers.FeedbackSerializer.validate_ticket` did this
earlier, but only ever through a `ModelViewSet`'s auto-injected context).
Instantiating the serializer as
`Serializer(data=request.data, context={"request": request})` is the whole
fix — easy to forget once, since every existing `APIView` in
`apps/accounts/views.py` before this story happened to resolve its target
user from a signed token instead of from `request.user` directly, so
none of them needed to.

---

## 22. Authorization (roles & permissions)

AUTH-2 (Story 09). `backend/apps/core/permissions.py` is the vocabulary and
the one permission class; `accounts.Role` and `User.role` are the data;
`frontend/src/shared/auth/` gates the UI. Nothing else checks a role.

**The vocabulary is code; the mapping is data.** Three pieces, and where each
lives is forced, not chosen:

| Thing | Lives in | Why not the other place |
|---|---|---|
| Permission **strings** (`users.view`, …) | Code — `apps/core/permissions.py` | Code enforces a permission. A DB-defined string no view checks grants nothing — it would be a lie in the admin UI. |
| Role → permission **mapping** | Data — `Role.permissions` (JSON) | SEC-2 builds a UI over it. A Python dict has no UI. |
| User → role **assignment** | Data — `User.role` (FK) | Operational; an admin assigns it, and SEC-1 builds that screen. |

`Role.clean()` validates the mapping against the code registry, so the two
halves cannot drift.

**Views declare permissions, never roles.** A view names `customers.manage`;
only a `Role` row names permissions in bulk. This is what lets the org chart
be re-cut without editing a single view — `allowed_roles = ["admin"]` in a
view would have to change every time a role is added or renamed.

**The `permission_map` convention.** Subclass `BaseModelViewSet` and declare
action → permission:

```python
class CustomerViewSet(BaseModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }
```

Add the permission constants to `Permissions` in the same change as the
viewset that declares them — never a string literal at the call site. A plain
`APIView` has no `self.action`, so for those `permission_map` may be keyed by
lowercased HTTP method instead.

**An unmapped action grants; it does not deny.** An action absent from
`permission_map` falls through to `IsAuthenticated`-only. This is deliberate:
a missing entry is far more often an unfinished map than an intent to forbid,
and a silent 403 on a working endpoint is the harder bug to find. **Never
rely on omission as a deny** — write the entry.

**Superuser is the one bypass, and `/auth/me/` mirrors it.** `is_superuser`
short-circuits Django's `has_perm` to `True` for any string (verified,
including a made-up one), and `permissions_for` keeps that behaviour.
`UserSerializer.get_permissions` therefore returns the **entire registry**
for a superuser, through that same function. If it returned only
role-derived permissions, the API would permit actions the UI hides — for a
superuser, who has every permission and no role at all.

**`Role.clean()` guards forms, not programmatic writes.** Django runs
`clean()` from `full_clean()`, which `ModelForm` (and so the admin) calls. A
bare `Role.objects.create(permissions=["bogus"])` in a shell or a migration
bypasses it entirely, and DRF serializers do not call model `clean()`
either. `RoleAdminSerializer.validate_permissions` (Story 49, `SEC-2`) is
that independent check for the API path — it repeats `Role.clean()`'s
logic rather than calling it, because the two paths (admin form, API
serializer) have no shared validation entry point in DRF.

**Renaming a permission's string value is a data migration, not a
refactor.** `Role.permissions` stores the strings. Changing
`Permissions.USERS_MANAGE`'s *value* leaves every role row pointing at the
old string — which grants nothing, and then fails `clean()` on the next admin
save. Migrate the stored rows in the same change.

**Row-level rules are the named extension point.** `HasPermission`
implements `has_permission` only. The first feature that needs "an agent may
edit *their own* ticket" adds `has_object_permission` to that same class —
not a second permission class, and not a check inside a view.

**Frontend: `can()` and nothing else.** `useAuth().can(permission)`, the
`<Can permission=…>` component, and the `RequirePermission` route guard are
the only sanctioned ways to gate UI. They read `user.permissions` — the flat
list the backend already resolved — and **never** derive from `user.role`.
Hiding a control is UX; the endpoint behind it enforces the same permission
independently (§ 12).

`ApiRequestError.isForbidden` (403) is **separate from** `isAuth` (401). A
forbidden action must not send the user to the login screen: signing in again
does not grant a permission, and treating the two alike produces an infinite
login loop for an under-privileged user.

**Forward constraint: the query cache is not permission-aware.** TanStack
Query keys include neither the user nor their role, so if an account's role
— or a role's own permission set — changes while the app is open, cached
results computed under the old permissions persist until refetched — the
same class of constraint § 18 records for language. `queryClient.clear()`
on such an event is the fix; it is not built. A role's permission content
can now change through `RoleFormPage` (Story 49, `SEC-2`) with no Django
admin involved, which makes the "plus a reload" half of this constraint the
only thing still standing between an edit and a stale in-session user.

**A row that must reference one of several target types uses one nullable
FK per type, not a `GenericForeignKey`.** `AuditLog` (Story 52, `SEC-3`)
needs to point at either a `User` or a `Role`. `apps/notifications
/models.py`'s own precedent already established "a plain FK to the one
target type that exists today, not a `GenericForeignKey`" for a
single-target case (`Notification.ticket`); `AuditLog.target_user`/
`target_role` is the direct generalization of that same reasoning to two
target types — two plain, independently nullable FKs, exactly one
populated per row, rather than introducing the one `GenericForeignKey`/
`ContentType` relation this codebase has never used. A `target_label`
snapshot field (mirroring `TicketActivity`'s own from/to snapshot
rationale) keeps the row meaningful after `SET_NULL` fires on either FK.

---

## 23. Feature module conventions

Story 10 (Customer Profiles, `CUST-1`) is the first feature story — the first
consumer of `BaseModelViewSet`, `DataTable`, `useAppForm`, and `can()`/`<Can>`
all at once. What it established is the template every later feature copies.

**The backend shape of a feature.** One Django app under `apps/`, with:

- `models.py` — extends `apps.core.models.TimeStampedModel`.
- `serializers.py` — extends `apps.core.serializers.BaseModelSerializer`, with
  `class Meta(BaseModelSerializer.Meta)` (inheriting, not just naming the same
  class) so `read_only_fields` applies.
- `views.py` — extends `apps.core.views.BaseModelViewSet` with a **fully
  populated** `permission_map` (§ 22 — every action mapped, because an
  unmapped one grants rather than denies).
- `urls.py` — a `DefaultRouter` (or `SimpleRouter`, if the router's
  auto-generated API-root view at the include's prefix is unwanted — see the
  worked example below).
- One `include()` line in `config/api_urls.py`, added **above** the catch-all
  `re_path`, which must stay last.

**A feature story grants its own permissions.** The permission constants go
into `apps/core/permissions.py` in the same change as the viewset that
declares them (§ 22). The role grant itself is a **cross-app data migration
in the feature app**, depending on `("accounts", "0003_seed_roles")`:

```python
# apps/<feature>/migrations/000N_grant_<feature>_permissions.py
dependencies = [
    ("<feature>", "000{N-1}_initial"),
    ("accounts", "0003_seed_roles"),
]
```

It grants by **set union**, never assignment — `role.permissions =
sorted(set(role.permissions) | set(new_permissions))` — so it never wipes a
grant made by another story, and is safe to re-run. The reverse migration
uses set *difference* for the same reason. Story 10's
`apps/customers/migrations/0002_grant_customer_permissions.py` is the worked
example.

**`ordering_fields`/`search_fields` are the contract with `DataTable`.** A
`ColumnDef.id` marked `sortable: true` must appear in the viewset's
`ordering_fields`, or the header toggles `aria-sort` and changes nothing else
— `OrderingFilter` silently drops a field it does not recognise. The same
`id` is also what a column's data comes from, so it must match the
serializer's field name exactly. `search_fields` needs no such pairing — it
is server-only, reached through `DataTable`'s consumer wiring a `search` query
param, not through `ColumnDef`.

**The frontend shape of a feature**, under `src/features/<feature>/`:

- `types/` — the TypeScript mirror of the serializer (§ 12, `snake_case`
  verbatim), plus a `<Thing>Input` write shape when create/update differ from
  the read shape (e.g. omitting server-managed fields).
- `api/` — one file per network call (`get<Thing>.ts`, `create<Thing>.ts`, …),
  `<feature>Keys.ts` (`featureKey('feature')`), a `use<Thing>`/`use<Things>`
  query hook per resource, and `use<Thing>Mutations.ts` for the create/update
  /delete hooks.
- `components/` — the screens.
- `locales/{en,ar}.json` — registered in `shared/i18n/resources.ts`.

**Every mutation invalidates its feature's whole key prefix**
(`<feature>Keys.all`), never an individual page or detail key. A create
changes which rows land on which page, an edit can change sort position, and
a delete shifts every later page — invalidating one cache entry would leave
the others stale.

**PATCH for edits, not PUT.** Verified against this project's DRF: a PUT
request with an optional field absent still drops that key from
`validated_data` entirely (DRF does not treat a full-update method as
"clear what's missing"), so the instance keeps its old value regardless of
HTTP semantics. PATCH's "only what I sent" contract is what an edit form
actually means, and it is what a client must use consistently: a field is
*cleared* by sending its value explicitly (`null` for a nullable field, `''`
for a blank-but-non-nullable one), never by omitting the key.

**`nullableString`/`nullableEmail` vs `optionalString`/`optionalEmail`**
(`shared/validation/schemas.ts`). Both pairs transform an empty input, but to
different things, and the difference is not stylistic:

| Helper | Transforms `''` to | Use for |
|---|---|---|
| `optionalString` / `optionalEmail` | `undefined` | A genuinely absent value — a query parameter, a field that should not appear in the payload at all when empty. |
| `nullableString` / `nullableEmail` | `null` | A **nullable database column**, so a cleared field round-trips as an explicit `null` the server can act on. |

The reason the `null`-transforming pair exists at all: `JSON.stringify` drops
an `undefined`-valued key, and DRF treats an absent key as "leave unchanged"
on a PATCH. So `optionalEmail()` on a nullable column would make a user who
clears the field silently fail to clear it — the value round-trips as if
nothing changed. Reach for `nullableString`/`nullableEmail` whenever the
column is `null=True`; keep `optionalString`/`optionalEmail` for a field that
is truly meant to be absent rather than explicitly empty.

**A unique nullable column needs blank→`NULL` normalisation in two places,**
because the two write paths do not share validation:

1. The model's `clean()` — guards the admin and any `full_clean()` caller.
2. The serializer (a `validate_<field>` method, or an equivalent) — guards
   the API path, because **DRF does not call model `clean()`.**

Verified against this project's Postgres 17: a unique column accepts any
number of `NULL`s but rejects a second `''` — `''` collides with itself,
`NULL` does not. Skipping either normalisation point leaves the path it does
not cover exposed to an `IntegrityError` (an unhandled 500) the moment a
second record is saved with that field left empty.

**One more verified trap this story surfaced:** if the unique field must also
be **explicitly declared** on the serializer (as it is here, to add
`allow_blank`/`allow_null`), `ModelSerializer` does **not** auto-derive a
`UniqueValidator` from the model's `unique=True` for it — that derivation
only applies to a field the serializer generates on its own. An explicitly
declared unique field needs its own `validators=[UniqueValidator(queryset=...)]`,
or a duplicate value also reaches the database's constraint directly as an
unhandled `IntegrityError` rather than a `validation_error`. This is safe to
combine with `allow_null=True`: DRF's own empty-value handling skips a
field's validators entirely when the incoming value is explicit `None`, so
two `null` writes never collide against each other through the validator
either — matching Postgres's own behaviour. See
`apps/customers/serializers.py::CustomerSerializer.email` for the worked
example.

**A child resource of an existing feature reuses the parent's permissions.**
A sub-resource that is part of an existing domain record (e.g. `ContactDetail`
on `Customer`) does not get its own permission constants — it is gated by the
parent feature's existing `permission_map` values. Add a new constant only
when the sub-resource is a genuinely separate authorization concern.

**A non-paginated, per-parent child resource may invalidate its own scoped
query key instead of the whole feature prefix**, when a write cannot affect a
sibling query's result set (no shared pagination, no shared sort). State the
reasoning at the call site — this is a documented exception, not the default;
the default (this section's own rule above) is still prefix-wide invalidation
for anything paginated or sorted.
`frontend/src/features/customers/api/useContactDetailMutations.ts` (Story 11,
`CUST-2`) is the worked example.

**A `PROTECT` foreign key needs the shared exception handler to translate
`ProtectedError`.** `apps/core/exceptions.py::_to_drf_exception` only
translates the exception types it explicitly lists; a new `on_delete=PROTECT`
relation is not automatically safe. Verify the referenced model's `destroy`
endpoint against a row that is actually protected before shipping the new FK
— `Ticket.customer` (Story 12, `TKT-1`) is the worked example, verified live
against `accounts.Role`/`User.role`, the only precedent before it.

**A resource that is read as a whole (not worked from row to row) splits
into two independently permission-gated route trees, not one gated-button
list page.** `FAQ` (Story 39, `KB-1`) is the first such case: `FaqBrowsePage`
(`knowledge_base.view`) is a fixed, unpaginated read of every row, and
`FaqListPage`/`FaqFormPage` (`knowledge_base.manage`, under
`/knowledge-base/manage`) are the `DataTable`-based CRUD surface every prior
feature already has. Contrast `CustomerListPage`/`TaskListPage`, where the
same table serves both browsing and management because the resource is
genuinely worked row by row — the deciding factor is whether a table is the
right reading shape at all, not whether the resource has an admin/non-admin
split in permissions (every feature already has that).

**A resource with its own draft/published split filters `get_queryset` by
whether the caller holds the resource's `manage` permission, not by action
name.** `ArticleViewSet.get_queryset` (Story 40, `KB-2`) returns every row
when the caller holds `knowledge_base.manage`, and only `status="published"`
rows otherwise — for `list` **and** `retrieve` alike, so a view-only caller
gets a 404, not a 403, on a draft's direct id (its existence is not
confirmed to someone who cannot manage it). Contrast
`TicketViewSet.get_queryset`'s `category`/`priority`/`assigned_to_me`
filters (Story 18/22/29), which narrow the same visible set identically for
every caller — this is the project's first queryset filter keyed on the
caller's permission level rather than a request parameter.

**A bilingual CONTENT field is returned in both languages by the API, and
the reader picks which one to render by `i18n.language` client-side, never
by `Accept-Language` server-side content negotiation.** `Article`
(Story 40, `KB-2`) is the first model with genuinely translated content —
every prior model's content is single-language, with only its surrounding
UI chrome translated (`Customer.name` is never translated). Returning both
`title_en`/`title_ar` and `body_en`/`body_ar` together means an editor sees
and edits both language sections on one screen regardless of their own UI
language, and a reader's language switch re-renders instantly with no
refetch.

**Two features may independently call the same backend endpoint.** This is
not the code duplication `frontend/src/README.md`'s "a feature never imports
from another feature" rule targets — each feature's `api/` layer owns exactly
the shape it needs (a full CRUD+search client in `customers`, a minimal
id+name selector in `tickets`), and the alternative (importing across
`features/`) is what `no-restricted-imports` forbids outright.
`frontend/src/features/tickets/api/getCustomerOptions.ts` is the worked
example.

**A component "shared across channels/variants" is not automatically a
`shared/` component.** When every real consumer of a "reusable" UI piece
renders in the same place (one parent screen), the reuse axis is *handling
every variant uniformly*, not *appearing on multiple screens* — it belongs in
the feature that owns that screen, not in `src/shared/ui/` or a separate
feature folder built to match a domain name.
`frontend/src/features/tickets/components/TicketConversation.tsx` (Story 13,
`COMM-0`) is the worked example: it renders every message channel identically
and lives in `tickets` (the one screen that ever shows it), not in a
`features/communications/` folder that would have needed to import it back
out — which `no-restricted-imports` forbids.

**A channel/provider dispatch table is a decorator plus a dict, wired
through `AppConfig.ready()` — not more.**
`apps/communications/adapters.py::register_adapter`/`get_adapter` (Story 14,
`COMM-1`) is the worked example: a concrete `ChannelAdapter` subclass
registers itself with `@register_adapter` at import time, and
`CommunicationsConfig.ready()` is what guarantees that import actually
happens once per process. **A dispatched side effect (an outbound send) must
not fail the request that triggered it** — `MessageViewSet.perform_create`
catches and logs any `adapter.send()` failure; the record it was attached to
is already committed. The next channel story (COMM-2, WhatsApp) copies both
shapes.

**A channel adapter's identity/routing key is whatever the channel actually
offers — not a pattern copied from the previous channel.** Email routes by a
`+<ticket id>` address tag; WhatsApp has no such per-conversation address, so
it routes by matching the sender's number against `ContactDetail(channel=...)`
(`CUST-2`, Story 11) and continuing the customer's most recent non-closed
ticket. **When a third-party protocol dictates a response shape this API's
envelope cannot express** (Meta's plain-text webhook-verification echo),
scope the exception to exactly the one view/method that needs it —
`PlainTextRenderer` (`apps/core/renderers.py`) plus a `get_renderers()`
override, not a global renderer change. **An outbound integration with no
safe "don't actually send" backend to swap** (unlike Django's mail backends)
should refuse to run at all against unconfigured settings, in every
environment, rather than attempting a live call with blank credentials.
`apps/communications/whatsapp_adapter.py` (Story 15, `COMM-2`) is the worked
example for all three.

**Real-time delivery for a channel with no external provider is a WebSocket
broadcast to a per-record channel-layer group, not a third-party API call.**
`LiveChatAdapter.send()` (Story 16, `COMM-3`) bridges from synchronous view
code to the (async) channel layer via `asgiref.sync.async_to_sync`;
`TicketChatConsumer` (async) bridges back to synchronous Django ORM/adapter
calls via `channels.db.database_sync_to_async` — both are Channels' own
documented utilities for this exact shape, not project inventions. **A
browser cannot set custom headers on a WebSocket handshake** — auth (a JWT,
or an anonymous signed session token) travels in the query string on every
WS connection this project makes, and a connection should be
**permission-checked, not just authenticated**, whenever the equivalent REST
endpoint would be. **A signed, unpersisted session token**
(`django.core.signing`, no new model field) is the pattern for a lightweight
anonymous identity that does not warrant a real customer account — reach for
it before adding a session/account model for a single-conversation
credential.

**A viewset with no create/update/destroy surface and no domain permission to
gate does not extend `BaseModelViewSet`.** `apps/notifications/views.py::NotificationViewSet`
(Story 31, `SLA-4`) is the first such case: `Notification` rows are created
only by `apps.notifications.services.notify`, and every action is scoped to
`request.user`'s own rows rather than a `tickets.manage`-style permission
string. It extends `mixins.ListModelMixin, mixins.RetrieveModelMixin,
viewsets.GenericViewSet` directly, with `permission_classes = [IsAuthenticated]`
and no `permission_map`. Reach for this shape only when both conditions
hold — a domain resource that is merely read-only but still permission-gated
would still extend `BaseModelViewSet` with a `permission_map` naming only its
`view` permission.

**A webhook signature scheme can depend on more than the raw request body —
verify what it actually signs before choosing how to check it.** Meta's
`X-Hub-Signature-256` (Story 15, `COMM-2`) is computed over raw request
bytes alone; Twilio's `X-Twilio-Signature` (Story 17, `COMM-4`) is computed
over the exact webhook URL plus every decoded POST parameter. When a
provider's algorithm depends on the URL, pin it as an explicit setting
(`SMS_WEBHOOK_URL`) rather than reconstructing it from the request — a
reverse proxy or tunnel rewriting `Host` would otherwise break verification
silently, not loudly. **A webhook's payload shape (JSON vs. form-encoded)
determines its `parser_classes`, and this project's `DEFAULT_PARSER_CLASSES`
is JSON-only** (`config/settings/base.py`) — a view receiving a
form-encoded provider payload must declare `parser_classes = [FormParser]`
itself, scoped to that one view, the same way `PlainTextRenderer` (Story 15)
was scoped to one view's `GET` method rather than changing a global default.

**A foreign key has three deletion behaviours in this project, chosen by
what the relationship means, not by default.** `PROTECT` (`Ticket.customer`,
Story 12) is for an identity relationship that must not silently vanish.
`CASCADE` (`Message.ticket`, Story 13) is for a child with no existence
independent of its parent. `SET_NULL` (`Ticket.category`, Story 18, `TKT-2`)
is for a classification tag: deleting the referenced row should leave the
referencing row intact, just unset — the FK must be `null=True` for Django
to allow `SET_NULL`, making this the project's first nullable foreign key.

**An optional equality filter on a list endpoint is validated when present,
never required.** Contrast `MessageViewSet`/`ContactDetailViewSet`'s
`ticket`/`customer` query params (Story 13/11), which raise
`ValidationError` when *absent* because the endpoint is meaningless without
them. `TicketViewSet`'s `category`/`priority` filters (Story 18) do the
opposite: silently skip filtering when the param is absent, but still raise
`ValidationError` for a present-but-malformed value (a non-numeric
`category`, an unrecognised `priority`) — a list screen's default
(unfiltered) view must keep working, but garbage input should not silently
do nothing either.

**A channel with no outbound delivery mechanism still implements
`ChannelAdapter.send()` — by always raising.** `WebFormAdapter.send()`
(Story 19, `COMM-5`) unconditionally raises `ValueError`, caught and logged
by `MessageViewSet.perform_create`'s existing `except Exception` (Story 14)
— the same "record now, deliver best-effort" contract every channel's own
failure path already has, not a special case. **A resource that must stay
permission-gated for authenticated use can still have a separate, narrower
public view over the same model** — `WebFormCategoriesView` (Story 19)
reads the same `Category` table `CategoryViewSet` (Story 18) does, without
loosening `CategoryViewSet`'s own `tickets.view` gate; add a second,
explicitly public view rather than widen an existing authenticated one.
**Not every channel routes a new inbound message into the customer's most
recent open ticket** — that rule (Email/WhatsApp/SMS/Live Chat) assumes an
ongoing conversation; a one-shot structured intake (a web form) should
always start a new ticket instead, because there is no "conversation" for a
later message to continue.

**An aggregate read that spans several apps belongs to the app that owns
the *question*, not the apps that own the rows.** `apps/customers/timeline.py`
(Story 20, `CUST-3`) reads `Ticket` and `Message` to answer "what has
happened with this customer," because `backend/apps/README.md`'s
app-purpose table assigns interaction history to `customers`. That is a
reverse-direction cross-app import (the models dependency runs
`customers ← tickets ← communications`) and it is safe **as long as no
model imports across apps** — Django loads every model before any view or
helper module, so only a model-level cycle can actually deadlock. **A
custom `@action` on a `ModelViewSet` is gated by its own method name in
`permission_map`** (`"timeline": …`), and — like any unmapped action — a
missing entry falls through to authenticated-only rather than denying, so
the entry is load-bearing. **When an aggregate's payload contains data
another domain's endpoints gate separately, check that permission
explicitly too** (`permissions_for(request.user)`), rather than letting the
aggregate become a way around it. **A heterogeneous feed is a `<ul>`, not a
`DataTable`** — § 19's rule covers homogeneous, server-sortable, paginated
rows; a merged timeline of two record shapes has none of those properties,
and its React key must combine the discriminator with the id
(`${kind}-${id}`), because ids are only unique within a kind.

**A file is served through a permission-gated action, never through
Django's own static/media URL mechanism.** `AttachmentViewSet.download`
(Story 21, `CUST-4`) returns a `FileResponse`, which bypasses
`EnvelopeJSONRenderer` entirely because it is not a
`rest_framework.response.Response` — verified against
`APIView.finalize_response`, which only attaches the envelope machinery to
that one class. No `MEDIA_URL` is configured at all, because Django's own
media serving carries no permission check. **A `FileField` is marked
`write_only` on its serializer** so DRF never calls `.url` (which would
raise without `MEDIA_URL`) — the read side exposes `original_filename`/
`size` instead. **A `FormData` upload through the project's shared
`httpClient` needs an explicit `Content-Type: undefined` override**,
because the instance's default JSON header would otherwise make axios
`JSON.stringify` the `FormData` instead of sending it as multipart —
verified against the installed axios's `transformRequest`. **An
authenticated file download cannot be a plain `<a href>` link** (a browser
navigation carries no `Authorization` header); fetch it as a blob through
the same authenticated `httpClient` instead, then trigger the save via a
temporary `URL.createObjectURL` link. **A verb a resource does not support
is removed from `http_method_names`**, not merely left out of
`permission_map` — an unmapped action is authenticated-only, not
forbidden, so narrowing the allowed HTTP methods is the only way to make an
unsupported verb a clean `405`.

**A field that has its own action endpoint should be read-only on the
resource's serializer.** `Ticket.assigned_agent` (Story 22, `TKT-3`) is
written only by `POST /tickets/<id>/assign/`; keeping it in
`read_only_fields` means a full-payload `PATCH` from the edit form can
never clear it as a side effect — a real bug class, since this project's
forms send every field they own on every save. **A `detail=False` `@action`
does not shadow the detail route**: DRF registers dynamic list routes
before `^{prefix}/{lookup}/` (`rest_framework/routers.py`), so
`/api/tickets/assignable-agents/` resolves to the action even though
`{lookup}` would match that literal string — ordering, not the regex, is
what makes it safe. **When a picker offers a restricted set of values, the
write endpoint must validate against the same queryset the picker reads**
— `apps/tickets/assignment.py::assignable_agents()` backs both, so a
hand-crafted request cannot assign a ticket to a user the picker would
never have offered. **A single control that fires a mutation immediately
is not a form** — § 20's `useAppForm`-is-the-only-entry-point rule governs
forms with a submit step and client-side validation; a lone `Select` that
saves on change uses the plain primitive, like `LanguageSwitcher` and the
ticket list's filters.

**A finite set of valid state changes is a hand-authored graph in a small
helper module, not inline `if`-chains in the view.**
`apps/tickets/status.py::VALID_TRANSITIONS`/`is_valid_transition` (Story 23,
`TKT-4`) is the same shape `apps/tickets/assignment.py` (Story 22)
established for a different business rule: a pure function, imported by the
viewset, easy to unit-reason-about and to extend without touching
request-handling code. **Re-stating a resource's current state is rejected,
not treated as a no-op success** — `TicketViewSet.set_status`/`escalate`
both compare the requested value against the current one before consulting
the transition graph, so "change status to what it already is" and
"escalate an already-escalated ticket" are both a `400`, consistent with
this project's preference for explicit, intentional writes over
silently-accepted no-ops. **A frontend picker that mirrors a backend
validation graph duplicates it as a plain data structure with a comment
pointing at the source of truth** — `TICKET_STATUS_TRANSITIONS`
(`frontend/src/features/tickets/types/ticket.ts`) is the same duplication
`TICKET_STATUSES` already makes of `Ticket.Status` (§3), narrowing what the
UI *offers* while the backend remains the sole enforcer of what it
*accepts*.

**A system-written audit log snapshots values at write time; it does not
store a live reference that can later resolve to nothing.** `TicketActivity`
(Story 24, `TKT-5`) is the project's first model written only as a side
effect of other actions (`assign`/`set_status`), never through its own
request body. Its `actor` follows the established `SET_NULL` pattern for a
reference that must survive account deletion, but its `from_value`/
`to_value` go further: an assignment change stores a **name snapshot**
(`User.get_full_name()` at write time), not a user id, so the log stays
correct even after the referenced user is gone — the standard audit-log
tradeoff of a point-in-time copy over a live foreign key. A status change,
by contrast, stores the **raw enum value** (not a snapshot label), because
status values are a fixed set the frontend must still translate via the
same `statuses.<value>` i18n keys every other status display uses — a
deliberate asymmetry driven by whether the underlying value can change
independently of the log entry. **Not every logged event needs a new
table.** `apps/tickets/history.py::build_history` extends
`apps/customers/timeline.py::build_timeline`'s (Story 20)
merge-two-querysets-into-one-feed shape to a second worked example: replies
are represented by the *existing* `Message` rows, merged into the read
rather than duplicated into the new `TicketActivity` table, because
`Message` already is the record of them and a second copy would just be a
drift risk. **A same-feature derived view invalidated by prefix gets the
update for free; a scoped-invalidation mutation does not.**
`useTicketHistory`'s query key is a child of `ticketKeys.all`, so
`useAssignTicket`/`useSetTicketStatus`'s existing prefix-wide invalidation
already refreshes it with no new code — but `useCreateMessage`'s narrower,
*scoped* invalidation (Story 11's documented exception) does not reach a
sibling key by construction, and had to be extended explicitly. When adding
a new aggregate view, check whether every mutation that should refresh it
uses prefix-wide or scoped invalidation before assuming it already works.

**A payload that spans two permission domains checks both explicitly,
regardless of which domain's action it hangs off.** `TicketViewSet.context`
(Story 26, `AGENT-2`) is the mirror image of `CustomerViewSet.timeline`
(Story 20, `CUST-3`): where `timeline` is a `customers.view`-gated action
whose payload reaches into `tickets`-gated data and re-checks `tickets.view`,
`context` is a `tickets.view`-gated action whose payload includes a full
customer record and re-checks `customers.view`. The direction of the anchor
(which app the `@action` lives in) is decided by what the endpoint is
*about* — here, "context for the ticket currently open" — not by which
domain's data makes up more of the response. **Reusing another domain's own
serializer for a sub-payload, not just its models, avoids a second
declaration of the same shape.** `apps/tickets/context.py::build_ticket_context`
calls `apps.customers.serializers.CustomerSerializer(customer).data`
directly rather than hand-assembling a dict of customer fields — the same
"reuse the target domain's already-built piece" instinct
`apps/customers/timeline.py` (Story 20) established for `Ticket`/`Message`,
extended here to a serializer, not just querysets. **The project's first
two-column/side-panel page layout uses the same arbitrary-value
`grid-cols-[...]` syntax already present in this codebase's own UI
primitives** (`alert.tsx`, `card.tsx`) — `TicketDetailPage`'s new grid is
that idiom's first use at the page level, not a new pattern.

**A derived status with a real deadline is computed fresh on every read,
never cached or persisted, when nothing forces otherwise.**
`apps/sla/policy.py::compute_sla_status` (Story 28, `SLA-1`) derives a
ticket's response/resolution due times and `met`/`breached`/`pending`
status entirely from `SLAPolicy` + `Ticket.created_at` + `Message`/
`TicketActivity` — no new `Ticket` field, no migration, no state that can
drift from reality. A "pending" ticket becomes "breached" automatically
the moment real time passes its deadline, with nothing to update — the
same reason this project prefers computing over caching wherever the read
is cheap enough to redo. **The event log is the source of truth for "when
did X first happen," never a row's own `updated_at`.**
`compute_sla_status` reads the first matching `TicketActivity` row for
"when was this ticket resolved," not `Ticket.updated_at`, which bumps on
any later save (an escalate call, a reassignment) and would silently
misreport how long resolution actually took — the same lesson
`TicketActivity` (Story 24) exists to generalize. **A reverse cross-app
import can run in either direction depending on which side owns the
*question*.** `apps/tickets/context.py` (Story 26) reads *from*
`apps.customers` because "what is this ticket's customer context" is
framed from the ticket; `apps/sla/policy.py` is read *by*
`apps.tickets.views` because "what is this ticket's SLA status" is framed
from SLA policy data. Both are safe for the identical reason: neither
app's `models.py` imports back into the other, so only a one-way
leaf-module dependency exists either way.

**A helper shared by a manual write path and an automatic one lives where
the manual path already put it, not duplicated for the automatic
caller.** `apps/tickets/assignment.py::apply_assignment` (Story 29,
`SLA-2`) is called by both `TicketViewSet.assign` (a human `actor`) and
`auto_assign_ticket` (`actor=None`, a system action) — one function
decides what "an assignment changed" means and how it gets logged, so a
future third caller inherits the same correctness rather than a fresh
chance to drift. **A background task fired from inside a request's
`perform_create`/`perform_update` must not be allowed to fail that
request.** `TicketViewSet.perform_create`'s `try/except Exception:
logger.exception(...)` around `auto_assign_ticket.delay(...)` is the same
shape `MessageViewSet.perform_create` (Story 14) already established for
`adapter.send()` — the record the request is about is already committed,
so a failure in triggering the *next* step (an outbound send, a queued
task) is logged, never returned as an error to a caller who already got
what they asked for. **`apps/<app>/tasks.py` (§24) is where a story's
first real `@shared_task` goes, with no additional Celery wiring** —
`app.autodiscover_tasks()` (Story 27, `config/celery.py`) already finds it
by that filename inside any installed app.

**A second owner-scoped personal resource, this time full CRUD.**
`TaskViewSet` (Story 32, `AGENT-3`) follows `NotificationViewSet`'s (Story
31, `SLA-4`) precedent of skipping `BaseModelViewSet`/`permission_map`
entirely for a resource with no domain-permission concept — every action
is scoped to `request.user`'s own rows via `get_queryset`, and
`IsAuthenticated` alone is the gate. Unlike `NotificationViewSet`
(list/retrieve-only, system-managed rows), `TaskViewSet` is a full
`viewsets.ModelViewSet`, so its serializer must mark any action-only field
(`completed_at`, mirroring `Notification.read_at`) explicitly
`read_only_fields` — `NotificationViewSet` never needed this because it
has no create/update action to bypass through in the first place.
**`TextField` (`shared/ui/form/TextField.tsx`) now also accepts
`type="datetime-local"`** — the first form field in this project editing a
date+time value; converting between its timezone-less input value and the
server's UTC-offset ISO string uses the browser's own `Date` local
getters/`toISOString()`, no new dependency.

**A shared resource in an owner-scoped app follows the shape of what it
*is*, not the shape of its siblings.** `QuickReply` (Story 33, `AGENT-4`)
lives in `apps.agents` beside `Task` (Story 32) and `Notification` lives in
`apps.notifications`, but unlike either — both owner-scoped, no domain
permission — `QuickReplyViewSet` extends `BaseModelViewSet` and reuses
`Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`, the same call `CategoryViewSet`
already made for the identical reason: a quick reply is part of the
ticket-reply permission domain, not a separate one, regardless of which
Python app its model lives in. **`QuickReplyAdmin` is this project's fifth
"admin is the de facto config UI, no frontend CRUD screen" resource**, after
`Category`, `SLAPolicy`, `AssignmentRule`, and `EscalationRule` — the
pattern now clearly established: a shared, infrequently-edited
configuration list gets a real API (for whatever needs to read it) plus an
editable admin, not a bespoke management page, until a story's own intake
actually asks for one.

**A third resource in `apps.agents`, and the third instance of the
admin-editability split.** `InternalNote` (Story 34, `AGENT-5`) reuses
`apps.customers.models.Note`'s exact shape (Story 21) one app over — a
ticket-scoped, author-tracked, editable free-text note — plus an explicit
`mentioned_users` set, validated against the same `assignable_agents()`
queryset `TicketViewSet.assign` already validates assignment against, so a
hand-crafted request cannot notify an agent ineligible to work the ticket.
`InternalNoteAdmin` follows `TaskAdmin`'s (Story 32) "read-only ops
visibility" precedent, not `NoteAdmin`'s (Story 21, predates the
distinction) fully-editable one — the deciding factor is always whether the
resource has a real frontend management surface (it does,
`InternalNotesSection`), not whether it is shaped like a note. **A
`notify(...)` call's `body` argument must fit `Notification.body`'s
`CharField(max_length=500)`** — every prior caller passed an already-bounded
string (`Ticket.subject`); `InternalNote.body` is the first unconstrained
source text, truncated (`note.body[:500]`) at the call site before reaching
`notify(...)`, since a longer string would fail as a database-level
constraint violation on Postgres, not just a Python-level oversight.

**A resource that must never be hard-deleted removes the HTTP verb, not
just the permission mapping.** `UserViewSet` (Story 48, `SEC-1`) is the
first case: `accounts.User` is referenced by `agents.Task.owner` and
`notifications.Notification.recipient` with `on_delete=CASCADE`, so a
`DELETE` would silently remove a person's tasks and notifications.
Per this section's own grant-on-omission rule, leaving `destroy` out of
`permission_map` is not a deny — it falls through to authenticated-only.
Dropping `"delete"` from the viewset's `http_method_names` is what actually
disables the verb: Django's `View.dispatch()` gates on
`request.method.lower() in self.http_method_names` before a DRF viewset's
router-bound `self.delete` (set by `ViewSetMixin.as_view()`) is ever
reached, so the request 405s as `method_not_allowed` with no new error
code. Reach for this whenever a resource has a `CASCADE`-related model that
must survive a parent record's removal and there is no row-level rule
(`has_object_permission`) that could express "always deny" instead.

**A queryset filter can exclude rows that belong to a different feature's
identity, keyed on the owning relation, not on a denormalised field.**
`UserViewSet.get_queryset` (Story 48, `SEC-1`) excludes portal-customer
accounts from the staff user-admin screen by filtering on
`customer_profile__isnull=True` (the `Customer.user` OneToOne's reverse
accessor) rather than on `role.slug == "customer"` — the FK relation is
the actual grant of portal access; a role is just data an admin could
otherwise leave stale. The same reasoning as `ArticleViewSet.get_queryset`
filtering by the caller's *own* permission (Story 40) rather than by
action name: filter on the fact that is actually true, not on a proxy for it.

**A multi-select checklist bound to a `string[]` field composes `FormField`
directly, not a new shared field component, when there is exactly one
consumer.** `RoleFormPage`'s permissions checklist (Story 49, `SEC-2`) binds
many `Checkbox` primitives to one `permissions: string[]` value via
`FormField`'s own render prop — the same primitive `CheckboxField` (a
single-boolean field) is built on, generalised for a list instead of
extracted into a new `shared/ui/form/CheckboxListField.tsx`. The options
themselves are grouped by a computed transform of a code identifier (the
permission string's area prefix), not translated copy — the same category
of content `RoleListPage`'s `slug` column already shows untranslated.

**A "there is exactly one row" configuration table is a small, self-built
singleton, not a new dependency.** `OrganizationSettings` (Story 53,
`SEC-4`) is this codebase's first singleton model: `save()` forces `pk=1`,
`delete()` is a no-op, and `load()` (`get_or_create(pk=1)`) is the only
supported way to get an instance. No third-party package (e.g.
`django-solo`) is installed for this — the pattern is small enough to
own directly, the same "no new dependency" bias every other story in this
project has followed. `MeView` (Story 08) is the closer-to-hand precedent
for the *API* shape this pairs with: a `GET`/`PATCH` endpoint with no id
in the URL, because there is exactly one relevant object.

**A verb removed for a CASCADE risk (§ 23's own earlier entry) can be
reinstated once the risk is actually guarded, not just documented.**
`UserViewSet` (Story 48, `SEC-1`) dropped `"delete"` from
`http_method_names` because a hard delete would have silently cascaded
onto `agents.Task.owner`. Story 71 (`SEC-6`) adds `"delete"` back — not by
loosening anything, but by making the one still-real CASCADE risk
(`Task`, which cannot be reassigned — its own model docstring rules that
out) a `ValidationError` raised *before* `super().destroy()` runs, the
same PROTECT-style guard `RoleViewSet.destroy` already uses for a system
role. The other CASCADE relationship, `notifications.Notification.recipient`,
needed no guard at all — its own docstring already treats "deleted with
its recipient" as correct, not a hazard. The lesson: a removed HTTP verb
is not necessarily a permanent decision — re-examine it once a real guard
exists, rather than treating "we once removed this verb" as settled.

---

## 24. Background jobs (Celery, SLA-0)

The shared Celery application instance is `config/celery.py` — project
bootstrapping/wiring, the same category as `config/asgi.py`/`wsgi.py`, not a
domain app (`apps/README.md`'s "needed by two or more apps → `apps/core`"
rule governs business logic, not process wiring). A feature story that
needs a background task adds `apps/<app>/tasks.py` with `@shared_task`
functions — `app.autodiscover_tasks()` (`config/celery.py`) finds it with no
further wiring.

**Redis is the broker and result backend, installed as a local service —
never Docker, never a hardcoded default that silently degrades.**
`REDIS_URL` is read the same way every other environment-differing value
in this project is (`env(...)`, `README.md` § "Environment variables"), and
Redis is installed locally exactly like PostgreSQL (`README.md` § 1 vs § 6)
— this project's `Docker (optional, future)` stance extends to Celery's
infrastructure too, not just the web/database stack.

**The periodic-task schedule lives in the database
(`django-celery-beat`'s `DatabaseScheduler`), never a hardcoded
`beat_schedule` dict.** A new scheduled job is a `PeriodicTask` row (added
via `/admin/`, a data migration, or a management command), not a settings
deploy — the same "vocabulary is code, mapping is data" split
`CONVENTIONS.md` § 22 already establishes for permissions.

**Celery's default worker pool does not run on native Windows** (no
`fork()`) — `celery -A config worker --pool=solo` is required there;
macOS/Linux use the default pool. Any story documenting a Celery command
for local dev must carry this caveat, the same way `README.md` § 6 does.

**`SLA-3` is the first story to actually use the "data migration" option
this section already named for adding a `PeriodicTask` row.**
`apps/sla/migrations/0004_seed_escalation_schedule.py` seeds an
`IntervalSchedule` (every 5 minutes) and an enabled `PeriodicTask`
pointing at `apps.sla.tasks.evaluate_escalations`, so the job is live the
moment this story ships — no manual `/admin/` step is required before it
can even start looking for at-risk/idle tickets. What it finds (or
whether it finds anything at all) stays entirely config-driven through
`EscalationRule` (`EscalationRuleAdmin`, § 23) — the schedule existing and
the criteria being configured are two independent opt-ins, not one.

**`SLA-4` is the second feature to add its own `tasks.py` module**
(`apps/notifications/tasks.py::send_notification_email`, after
`apps/sla/tasks.py`, Stories 29-30) — confirming `app.autodiscover_tasks()`
needs no per-app registration; any `apps/<app>/tasks.py` is picked up
automatically.

---

## 25. Design intelligence (DSN, EPIC 8)

`DSN` extends `UI` (§ 19) — it does not replace it. It is generated by the
`ui-ux-pro-max` Claude Code skill (installed at
`.claude/skills/ui-ux-pro-max/`, Story 35/`DSN-0`) and persisted to
**`design-system/supportos/MASTER.md`** at the repo root (the skill nests
persisted output under `design-system/<project-slug>/`, not flat
`design-system/MASTER.md`). Read that file for the full recommended UI
style, component CSS specs, spacing/shadow scale, and anti-patterns — this
section curates only the decisions that affect code: the token
reconciliation below, the UX/accessibility guidance, and chart-type guidance
for future dashboards.

**No token in `frontend/src/index.css` changes as part of this section.**
Every decision below is a commitment for `DSN-1` (Design System Refresh
Across Built Screens, `SupportOs backlog.MD:508`) to carry out, not
something this story applies.

**A naming quirk in the generated output, resolved here so `DSN-1` does not
have to re-derive it:** `design-system/supportos/MASTER.md`'s color table
labels `#475569` "Primary" and `#2563EB` "Accent/CTA" — but that same file's
own `.btn-primary` component spec uses `background: #2563EB` (the
"Accent/CTA" hex), not `#475569`. The vivid blue is the actual call-to-action
color; the slate is a neutral text/border/ring tone. The reconciliation below
maps shadcn's `--primary` (which drives default button styling, per § 19) to
`#2563EB`, not to the hex literally labeled "Primary" in the source table.

**The product-description query ("...knowledge base...", quoted from
`README.md:3-4`) pulled a `Category: Knowledge Base/Documentation`
classification and a "FAQ/Documentation Landing" page pattern** — appropriate
for the future customer-portal/KB pages (`EPIC 9`, `EPIC 10`) but not for the
already-built, table-and-detail agent-facing screens (`EPIC 0`-`7`), which
are dashboard/CRUD UI, not a landing page. The **Style** section ("Minimalism
& Swiss Style" — its own "Best For" list names "dashboards" and "professional
tools" explicitly) applies project-wide; the **Page Pattern** section applies
only when a future story builds an actual FAQ/landing page. `DSN-1` should
generate a page-specific override (`search.py --design-system --page
<name>`) for the agent workspace/ticket screens rather than force-fitting the
landing pattern onto them.

### Token reconciliation (`DSN` vs current `UI`)

Current values are shadcn's untouched default "neutral" theme (`oklch(... 0
0)`, i.e. zero chroma / greyscale) — verified against `frontend/src/index.css`
lines 9-46, never customized since Story 06.

| Token (`frontend/src/index.css`) | Current value | `DSN`-recommended value | Decision | Reason |
|---|---|---|---|---|
| `--primary` (line 17) / `--primary-foreground` (line 18) | `oklch(0.205 0 0)` (near-black) / `oklch(0.985 0 0)` (near-white) | `#2563EB` / `#FFFFFF` (MASTER.md "Accent/CTA", the hex its own `.btn-primary` actually uses) | **Adopted (Story 36)** | Gives buttons/links a real brand color instead of the greyscale shadcn default; unambiguous match to the CTA role shadcn's `--primary` plays. Shipped as `oklch(0.546 0.215 262.881)` in both `:root` and `.dark` (frontend/src/index.css) — see Story 36 for the light/dark-parity rationale. |
| `--secondary` (line 19) / `--secondary-foreground` (line 20) | `oklch(0.97 0 0)` (light grey) / `oklch(0.205 0 0)` (near-black) | Conflicting spec: color table gives `#64748B`/`#FFFFFF` (filled slate), but the same file's `.btn-secondary` sample is an **outline** button in `#475569` text/border on transparent | **Adopted (Story 36) — filled treatment** | Resolved by reading `button.tsx`: this codebase already has a separate `outline` variant distinct from `secondary` (line 15-16), so MASTER.md's outline `.btn-secondary` sample describes that variant, not this token — the color-table pairing (`#64748B`/`#FFFFFF`) applies cleanly to `--secondary`/`--secondary-foreground` with no conflict. Shipped as `oklch(0.554 0.041 257.417)` / `oklch(1 0 0)`, same value in both themes. |
| `--accent` (line 23) / `--accent-foreground` (line 24) | `oklch(0.97 0 0)` / `oklch(0.205 0 0)` (subtle hover surface) | *(none — DSN's palette has no separate "subtle hover surface" role; its "Accent/CTA" was already consumed by `--primary` above)* | **Keep current** | Reusing `#2563EB` a second time for hover/highlight backgrounds would give one hex two different UI meanings (CTA button vs. subtle surface) in the same interface. |
| `--destructive` (line 25) | `oklch(0.577 0.245 27.325)` (red) | `#DC2626` (MASTER.md "Destructive") | **Adopted (Story 36)** | Same role, same color family, no conflict; also satisfies MASTER.md's own pre-delivery checklist item on text contrast. Shipped as `oklch(0.577 0.215 27.325)` in both `:root` and `.dark` — verified 9.46:1 white-text contrast against the existing `dark:bg-destructive/60` treatment (`button.tsx` line 14). |
| `--chart-1` … `--chart-5` (lines 29-33) | five achromatic-to-hued shadcn defaults | Not in MASTER.md — no fixed 5-color chart palette exists anywhere in `DSN` (confirmed by `DSN-3`, Story 38) | **Resolved (Story 38) — keep current** | Already a mutually-distinguishable five-hue qualitative palette, untouched by Story 36's retint; no `DSN`-sourced alternative exists to adopt instead. See "Chart-type guidance" below for the separate, bounded status-zone colors (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) Bullet/Gauge charts need, which are not `--chart-1..5` slots. |
| `--font-sans` (line 44) | `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | Atkinson Hyperlegible (Google Fonts, `@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap')`) | **Adopted (Story 36), English UI only** | An accessibility/dyslexia-friendly font fits MASTER.md's own "Enterprise apps... professional tools" framing and its Pre-Delivery Checklist's contrast/a11y emphasis. Loaded via `<link>` in `frontend/index.html` (not a CSS `@import`), first in the `--font-sans` fallback chain. |
| `--font-arabic` (line 45) | `'Segoe UI', Tahoma, 'Noto Naskh Arabic', system-ui, sans-serif` | *(same Atkinson Hyperlegible pairing — MASTER.md does not distinguish a bilingual/Arabic typeface)* | **Keep current** | Atkinson Hyperlegible is a Latin-only accessibility font with no Arabic glyph coverage; `CONVENTIONS.md` § 18 requires a font stack that renders Arabic, which the generated pairing does not provide. The skill's query did not mention bilingual/RTL requirements. |
| `--success`/`--success-foreground`, `--warning`/`--warning-foreground`, `--info`/`--info-foreground` (new) | *(did not exist)* | *(none — `MASTER.md`'s Color Palette table has no semantic-status role)* | **Adopted (Story 50)** | No DSN source exists for badge semantics; `#16A34A`/`#D97706`/`#0284C7` sourced from the `ui-ux-pro-max` skill's own `colors.csv` (the most-repeated "success green" across the dataset; amber and a `--primary`-distinct blue chosen by hue-family convention, no exact hex available). All three pair with **black**, not white, text — verified 6.37:1/6.59:1/5.13:1; white text fails 4.5:1 on all three. |
| `--background`/`--foreground`/`--card`/`--card-foreground`/`--muted`/`--muted-foreground`/`--border` (surface tokens), plus tied `--input`/`--popover` | shadcn's untouched greyscale defaults | `MASTER.md`'s Color Palette table, directly (light mode only — no dark-mode row exists in the generated output) | **Adopted (Story 51)** | Light-mode values are MASTER.md's own hexes, converted and contrast-verified (13.98:1–7.24:1 across all text pairs). Dark-mode values have no DSN source — independently derived at the same ~257° hue family, contrast-verified (17.02:1–5.88:1). `--input`/`--popover` follow `--border`/`--card` respectively, preserving an equality already present in the pre-Story-51 code. |
| `--ring` (new) | shadcn default, `oklch(0.708 0 0)` / `oklch(0.556 0 0)` | `#475569` (MASTER.md's own "Ring" row — never adopted by any prior story) | **Adopted (Story 51), light only** | Verified 7.24:1 against the new light `--background` (WCAG 2.4.11 non-text minimum is 3:1). Dark `--ring` is unchanged — verified 4.03:1/3.57:1 against the new dark `--background`/`--card`, still clearing 3:1, so no dark-mode value was invented. |
| `--radius` (line 10) | `0.625rem` (one value, `sm`/`md`/`lg`/`xl` derived via `calc()`, § "@theme inline" lines 115-118) | MASTER.md's component CSS uses differentiated per-component radii: `8px` (buttons/inputs), `12px` (cards), `16px` (modals) | **Resolved (Story 36) — component-level, not token-scale** | `card.tsx` (`rounded-xl`, 14px) and `input.tsx` (`rounded-md`, 8px) already land within 2px / exactly on MASTER.md's 12px/8px targets — no change. `dialog.tsx` and `alert-dialog.tsx` moved from `rounded-lg` (10px) to `rounded-xl` (14px), within 2px of the 16px modal target. The single derived `--radius` scale is unchanged; only which Tailwind radius utility two primitives use was adjusted. |

### UX & accessibility guidance (from `design-system/supportos/MASTER.md` and the `ux-guidelines.csv` catalog)

Audited and applied by `DSN-2` (Story 37, `SupportOs backlog.MD:514`) against
every already-built screen:

- **Contrast:** minimum 4.5:1 for normal text (MASTER.md Pre-Delivery
  Checklist; `ux-guidelines.csv` "Color Contrast", severity High) — verified
  in Story 36 for the tokens it changed; untouched shadcn defaults were
  already compliant.
- **Error messages must be announced, not shown by color alone**
  (`ux-guidelines.csv` "Error Messages", severity High) — **fixed**: 11
  duplicated unattached-error `<p>` blocks replaced by
  `shared/ui/form/FormErrorSummary.tsx` (`role="alert"`); toast error tone
  now `role="alert"`/`aria-live="assertive"` instead of sharing `status`/
  `polite` with success toasts. Per-field `FormMessage` deliberately left
  as-is — already discoverable via `aria-describedby` + focus-on-error, and
  adding `role="alert"` there risks re-announcing on every keystroke during
  re-validation.
- **Focus states visible for keyboard navigation**, `prefers-reduced-motion`
  respected, no emoji used as icons (SVG icon set only) — focus states
  already shadcn-default-compliant across all primitives (unaudited change);
  **fixed**: reduced-motion now respected for dialog/alert-dialog/select
  entrance-exit animations (`index.css`); loading spinners/skeletons
  deliberately keep animating (`ux-guidelines.csv` "Continuous Animation").
- **Wide tables get a horizontal-scroll wrapper or card layout on mobile** —
  **confirmed already compliant**, `shared/ui/primitives/table.tsx:10`.
- **Bulk row actions** (checkbox column + action bar) — **not implemented**,
  Low severity; a feature addition, not a fix — out of scope for this story.
- **Anti-patterns to avoid:** poor navigation, no search entry point, missing
  `cursor: pointer` on clickable elements, instant (non-transitioned) state
  changes, layout-shifting hover transforms — **fixed**: `cursor-pointer`
  added to the shared `Button` base classes (Tailwind v4 Preflight no longer
  sets this by default); the rest were already compliant.

**Also audited and fixed, beyond the original bullet list above:**
- **Heading hierarchy** — `CardTitle` (`shared/ui/primitives/card.tsx`) now
  supports `asChild`; `TicketDetailPage` and `CustomerProfilePage` (and
  10 more section-level titles) render real `<h1>`/`<h2>` elements instead
  of a styled `<div>`.
- **Accessible authentication** (WCAG 2.2, `ux-guidelines.csv` row 107,
  Critical) — login form now sets `autoComplete="email"`/
  `"current-password"`; paste was already not blocked.
- **Truncated text with no full-value access** — `AlertTitle` (via
  `ErrorState`), `SelectField`'s `SelectTrigger`, and
  `CustomerContextPanel`'s timeline entry body now carry a `title` attribute.
  6 standalone `SelectTrigger` usages outside `SelectField` (ticket
  assignee/status controls, list-page filters, the quick-reply picker) are
  **not** covered — noted as a follow-up, `TicketAssigneeControl.tsx` being
  the one with real unbounded text (agent names).

**Also confirmed already compliant, no change needed:** alt text (no `<img>`
anywhere), icon-only buttons (all 5 already have `aria-label`), no bare
`div`/`span onClick` anywhere, RTL (`check-rtl.mjs`, CI-wired, zero
violations), sortable table headers (`DataTable.tsx`, already a model
implementation), field `aria-describedby`/`aria-invalid` wiring, and
touch target size (`icon-xs` = 24px, meets WCAG 2.2's minimum exactly).

### Chart-type guidance (for `RPT-0`)

Recorded by `DSN-3` (Story 38, `SupportOs backlog.MD:520`) against each
`RPT-*` report's actual data shape (`SupportOs backlog.MD:600-633`), queried
fresh from `charts.csv` — not a generic chart-type list. `RPT-0`
(Reporting Foundation, Story 55) implements its shared chart wrapper
against this table; no chart library, component, or token exists yet.

| Report | Data shape | Chart type | Library options | Color guidance |
|---|---|---|---|---|
| `RPT-1` Ticket Reports — trend over time | Trend Over Time | Line Chart (Area as secondary) | Chart.js, Recharts, ApexCharts | Primary `#0080FF`; multi-series needs distinct color **and** distinct line style (solid/dashed/dotted), never hue alone |
| `RPT-1` Ticket Reports — by status/category/channel | Compare Categories | Bar Chart, horizontal or vertical | Chart.js, Recharts, D3.js | One distinct color per bar (from `--chart-1..5`, see below); always sort descending by value |
| `RPT-2` SLA Performance — response/resolution time trend | Trend Over Time | Line Chart | Chart.js, Recharts, ApexCharts | Same as `RPT-1`'s trend row |
| `RPT-2` SLA Performance — breach rate vs. target | Performance vs Target | Gauge Chart (single KPI) or Bullet Chart (3+ KPIs in a grid) | D3.js, ApexCharts, Custom SVG | Qualitative zones `#FFCDD2`/`#FFF9C4`/`#C8E6C9` (bad/ok/good); performance bar `#1976D2`; target marker a black 3px line — zones must carry a text label, never color alone |
| `RPT-3` Agent Performance — handled/resolution/CSAT per agent | Compare Categories (ranked) | Horizontal Bar Chart | Chart.js, Recharts, D3.js | Same as `RPT-1`'s category row; ≤15 agents before switching to a paginated table |
| `RPT-4` Customer Satisfaction — trend over time | Trend Over Time | Line Chart | Chart.js, Recharts, ApexCharts | Same as `RPT-1`'s trend row |
| `RPT-4` Customer Satisfaction — satisfied/neutral/dissatisfied breakdown | Part-to-Whole (≤5 categories) | Waffle Chart — **not** Pie/Donut (`charts.csv` rates Pie/Donut `risk:high` for accessibility vs. Waffle's `risk:low` for the same use case) | D3.js, React-Waffle, Custom CSS Grid | Distinct accessible color pair per category, always labeled with percentage text; 10×10 grid standard |
| `RPT-5` Management Dashboards — combined KPIs (open tickets, SLA health, CSAT, agent load) | Performance vs Target (Compact), 4 KPIs | Bullet Chart grid (`charts.csv`'s own "ideal for 3-10 bullet charts in a grid" range) | D3.js, Plotly, Custom SVG | Same qualitative-zone + target-marker colors as `RPT-2`'s breach-rate row — `RPT-5` reuses `RPT-0`'s charts (`SupportOs backlog.MD:633`), not a new chart type |

**Accessibility floor, every row (`charts.csv`, all `risk:low` except Waffle
which is also `risk:low`):** a visible data table or text summary fallback;
color always paired with a text label, distinct line style, or shape — never
color alone. Keyboard: focus reveals the same detail hover does; sortable
headers expose `aria-sort`.

**`--chart-1`…`--chart-5` (`frontend/src/index.css` lines 29-33, 67-71):
kept as the current shadcn defaults**, used for the Line/Bar rows' multi-series
and multi-category color needs above. No `DSN`-sourced 5-swatch categorical
palette exists to adopt instead (`design-system/supportos/MASTER.md` has none;
no single `charts.csv` row supplies a general-purpose set). The Bullet/Gauge
qualitative zones (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) and Waffle's category pairs
are a **separate**, bounded, chart-specific color need — not `--chart-1..5`
slots — and are recorded in the table above for `RPT-0` to name as its own
tokens when it exists.

### Badge semantics, iconography, and page-header hierarchy (`DSN-4`, Story 50)

`success`/`warning`/`info` variants added to `badge.tsx` (§ above) — applied to
ticket status (`open`→info, `in_progress`→warning, `resolved`→success,
`closed`→outline), ticket priority (`low`→outline, `medium`→secondary,
`high`→warning, `urgent`→destructive), task completion state
(pending→warning, completed→success), one SLA dimension (`met`→success;
`breached` stays `destructive`; `pending` stays `secondary` — no `at_risk`
value exists in `SlaDimensionStatus` to justify a warning), and ticket
escalation (`false`→success, `true` stays `destructive`). Deliberately
**not** applied to article draft/published status or any `direction`/
`channel`/`category`/mention/`activity_kind`/`is_system`/`is_active` badge —
not one of the intake's four named categories.

The ticket-status/priority mapping is duplicated in
`features/tickets/lib/statusBadge.ts` and `features/portal/lib/statusBadge.ts`
rather than shared — `no-restricted-imports` forbids the cross-feature
import, the same boundary `features/portal/types/portalTicket.ts` already
documents for its own duplicated `TicketStatus`/`TicketPriority` types.

`lucide-react` icons added to: every list page's "New X" action, every
`RootLayout` nav link, and (via `Empty.tsx`'s new optional `icon` prop, a
generic `InboxIcon` default) every empty state. `Notification.kind` gained
its first-ever visual indicator (an icon, not a badge — no badge existed to
recolor) in `NotificationBell.tsx`'s dropdown rows.

`PageHeader` (`shared/ui/PageHeader.tsx`) replaces 13 duplicated list-page
header blocks, establishing the first real two-level heading hierarchy
(`text-2xl` page titles above `CardTitle`'s `text-lg` section titles,
Story 37) — everything previously read at one flat size. `Card`/`FormItem`
spacing was audited and found already exactly matching `MASTER.md`'s
24px/8px spacing scale — no change. `table.tsx`'s cell padding moved from
8px to 12px horizontal, a bounded judgment call — no DSN table spec exists
to size against precisely.

### App shell: sidebar navigation & primitive polish (`DSN-5`, Story 51)

`RootLayout.tsx`'s top `<nav>` became `app/Sidebar.tsx` — a hand-built `<aside>`
(not the official shadcn CLI `sidebar` component, which solves an SSR-cookie
hydration problem this client-only SPA does not have), collapsible to an
icon-only rail via `useState` + `localStorage`
(`supportos.sidebar.collapsed`), positioned by plain DOM order in a `flex`
row rather than a direction-branched class — flexbox already reverses
visually under `dir="rtl"` with the sidebar first in markup. Every
`<Can>`-gated link, `t(...)` key, and route from the prior top nav moved
across unchanged. `PortalLayout.tsx` (the customer-facing shell) is
untouched — a deliberately separate, simpler top nav since Story 42.

`button.tsx`/`input.tsx`/`select.tsx` gained MASTER-guided polish:
`font-semibold` and a `shadow-xs` + `-translate-y-px` hover lift (with an
`active:translate-y-0` press-back, this story's own addition — MASTER
defines no `:active` state) on the three filled button variants;
`border-color` added to `input.tsx`/`select.tsx`'s transition-property list,
fixing a real, verified "instant state change" on focus (the property was
silently excluded before this story); `duration-200` added throughout,
matching MASTER's 200ms. No height/padding/radius change — this project's
existing button/input/select height-alignment invariant (`h-9` shared
across all three) is verified compliant with MASTER's radius target already
and takes precedence over MASTER's literal padding numbers, which would
have broken that alignment.

---

## 26. Customer portal identity & scoping

`PORTAL-0` (Story 42). A customer's portal login is not a second identity or
authorization system — it is `AUTHZ` (§ 13/§ 22), extended.

**A customer is a `User` row, not a second identity system.**
`customers.Customer.user` (nullable `OneToOneField` to `accounts.User`,
`related_name="customer_profile"`) links a CRM identity to a login-capable
account. A `Customer` with `user = None` — the default — cannot log in. There
is no separate customer credential table and no separate JWT configuration.

**The `customer` role carries exactly one permission, `portal.access`**
(`apps/core/permissions.py`), seeded the same way `admin`/`manager`/`agent`
are (`apps/accounts/migrations/0004_seed_customer_role.py`). Granting a
customer more portal-facing permissions later is a new `Permissions` constant
plus a role-permission grant migration — the same two-step pattern
`apps/customers/migrations/0002_grant_customer_permissions.py` already used
for staff roles.

**`CustomerScopedModelViewSet` (`apps/core/views.py`) is the base for every
portal viewset.** Its `get_queryset()` override — filtering to the caller's
`customer_profile` via `customer_field` (default `"customer"`) — is the
PRIMARY scoping mechanism: DRF's `get_object()` filters through
`get_queryset()` before any per-object check runs, so `list`, `retrieve`,
`update`, and `destroy` are all covered by this one override. `HasPermission`
also gained `has_object_permission`, a secondary, defense-in-depth layer that
only matters for a custom `@action` that fetches an object directly (e.g.
`Model.objects.get(pk=...)`) instead of through `self.get_object()`. **A
custom `@action` on a `CustomerScopedModelViewSet` subclass must route
through `self.get_object()`/`self.get_queryset()` — never a raw manager
query — or it bypasses the primary defence and leaves only the
object-permission check to catch a leak.**

**`has_object_permission` only tightens for a view that declares
`customer_field` — it must never assume every model has a `customer`
relation.** Fixed live by Story 46 (Access FAQs, `PORTAL-4`): the original
version defaulted `customer_field` to `"customer"` for *any* view once the
caller had a `customer_profile`, which produced a false `403` on
`ArticleViewSet.retrieve` — a plain `BaseModelViewSet` subclass with no
`customer` FK at all — the first time a portal customer got real `retrieve`
access to a non-`CustomerScopedModelViewSet` endpoint. The check now does
`if not hasattr(view, "customer_field"): return True` before reading it, so
it is a true no-op for every viewset that does not opt into row-scoping,
not just for a caller with no `customer_profile`.

**`CustomerScopedModelViewSet` declares no `permission_map` of its own.**
Per `HasPermission`'s existing grant-on-omission rule, a subclass that ships
without declaring one is authenticated-only, not closed — every `PORTAL-N`
viewset must declare its own `permission_map` (typically
`{"list": Permissions.PORTAL_ACCESS, ...}`), the same as any other
`BaseModelViewSet` subclass.

**The frontend gate is `RequirePermission permission="portal.access"` — no
new guard component.** `AuthUser`, `useAuth()`, `RequireAuth`, and
`RequirePermission` all work unmodified for a customer account, because a
customer is simply a `User` row with a different `role`.

**The portal route tree is a sibling of `RootLayout`'s, not nested inside
it.** `frontend/src/app/router.tsx` has two top-level route objects: the
existing `path: '/'` tree (`RootLayout`, staff nav, `NotificationBell`) and
`path: 'portal'` (`PortalLayout`). Nesting the portal under `RootLayout`
would wrap every customer-facing page in staff chrome — a customer must
never see staff navigation or the agent notification bell. Both trees share
one `AuthProvider`/`Direction.DirectionProvider`/`QueryClientProvider` stack
(`frontend/src/app/providers.tsx`, wrapped around the single `RouterProvider`
in `main.tsx`), so direction, i18n, and auth state all work identically in
both — only the visual shell differs.

**Provisioning is a staff-facing action on the customer profile — `CUST-5`
(Story 85).** `CustomerViewSet.portal_access` (`POST` grants, `DELETE`
revokes, gated on `customers.manage`) is the primary path: grant creates or
reuses a `User(role=customer, is_staff=False)` in exactly the same
`is_active=False` + unusable-password pending state `SEC-5`'s
`UserAdminSerializer.create` leaves for a new staff account, and dispatches
the same `send_invite_email` task; revoke unlinks `Customer.user` and sets
`User.is_active = False` together. Django admin's `Customer.user` field
(Story 42) is unchanged and still usable as a manual fallback — the same
role Django admin keeps for `Role`/`User` after `SEC-1`/`SEC-2` shipped their
own screens over those. Still no self-service registration: only a staff
member with `customers.manage` can grant or revoke.

---

## 27. Reporting (RPT-0)

`RPT-0` (Story 55) is the shared foundation `RPT-1`…`RPT-5` build on. See
§ 25 above for the chart-type specification it implements against.

1. **`apps/reports/aggregation.py` is the only place a report query is
   bucketed or grouped.** `bucketed_counts`/`grouped_counts` take a
   **queryset** and a field name, so a report view never writes its own
   `Trunc*`/`values().annotate()` chain — that chain is where the classic
   Django aggregation bugs live (see point 3 below).
2. **A trend series is always gap-filled.** `bucketed_counts` returns one
   row per bucket across the whole requested range, `value: 0` included,
   even when nothing fell in it. A missing bucket would otherwise draw a
   straight line across a real zero and silently misrepresent the trend.
   A nullable `series_field` maps NULL to `null_label` before the series
   keys are sorted — without it the sort compares `str` with `None` and
   raises (`RPT-1`'s origin channel, `RPT-3`'s `assigned_agent`).
3. **Two quiet aggregation failures this project has already hit once,
   fixed permanently in `aggregation.py`, never to be re-solved per
   report:** Django's `TruncWeek` truncates to **Monday**, so a gap-fill
   spine that steps in 7-day increments from an arbitrary start (instead of
   snapping to Monday first) never matches the database's own keys and the
   whole series reads as zeros. And a model's default `Meta.ordering`
   (e.g. `Ticket.Meta.ordering = ("-created_at",)`) silently joins itself
   into a `GROUP BY` and fragments an aggregate into one row per record
   unless `.order_by()` is called explicitly — every aggregate chain in
   `aggregation.py` ends in one.
4. **The export query parameter is `?export=csv`, never `?format=csv`.**
   DRF's `DefaultContentNegotiation` reads `?format=` as a renderer
   override and raises `Http404` when no renderer matches
   (`rest_framework/negotiation.py:41-45,80-89`) — this project registers
   exactly one renderer, format `"json"` (`config/settings/base.py:229`).
   Worse, `APIView.initial()` negotiates content **before** it checks
   permissions (`rest_framework/views.py:404-420`), so `?format=csv` would
   404 before a view body or permission check ever ran. `BaseReportView`
   (`apps/reports/views.py`) names the parameter `export` instead.
5. **A report response is a flat list of dicts; the CSV and the JSON are
   the same rows.** `BaseReportView.get` calls `get_report` once and
   branches only on how to render the result — an exported file can never
   disagree with the chart the user was looking at.
6. **`frontend/src/shared/ui/chart/` is the only home for chart
   components.** `no-restricted-imports` (`.oxlintrc.json`) forbids one
   feature importing another's code, so a chart built inside one `RPT-*`
   feature could never be reused by a sibling report. Every chart is
   rendered inside `ChartFrame`, which is what supplies § 25's required
   data-table fallback — a report screen never renders `LineChart`/
   `BarChart` directly.
7. **No chart library.** Two of the four chart types this epic needs
   (Bullet, Waffle) have no mainstream React library implementation, and
   § 25 lists only D3/Plotly/Custom SVG/Custom CSS Grid for them — so no
   single library covers the epic, and adopting one for Line/Bar alone
   would still leave Bullet/Waffle custom and add a dependency whose
   output must be overridden anyway to satisfy § 25's accessibility floor
   and this project's RTL discipline. Plain SVG, per `LineChart.tsx`/
   `BarChart.tsx`. `RPT-1`…`RPT-5` inherit this decision; it is not
   reopened per report.
8. **A report's dimensions are a whitelist, never a field name off the
   query string.** `apps/reports/tickets.py::DIMENSION_FIELDS` maps the
   four wire values to queryset fields; `parse_dimension` rejects
   everything else. An endpoint that resolved `?dimension=` directly
   would be a general-purpose data-extraction API for anyone with
   `reports.view`.
9. **A bucket is a calendar date, so format it in UTC.** `bucketed_counts`
   emits `YYYY-MM-DD`, which JS parses as UTC midnight — rendered through
   `useFormatters().date()` with no options it shows the **previous day**
   anywhere west of Greenwich (verified: `'2026-01-01'` → "Dec 31, 2025"
   in `America/New_York`). Every bucket label passes
   `{ dateStyle: 'medium', timeZone: 'UTC' }`.
10. **An average metric is never gap-filled with a false zero.**
    `bucketed_counts`'s `value: 0` gap-fill (point 2 above) is correct
    for a *count* — zero tickets is a real, meaningful zero — but wrong
    for an *average*: `apps/reports/sla.py::sla_trend` reports average
    response/resolution minutes, and a bucket with no achieved values in
    it is **omitted** rather than reported as "0 minutes", which would
    falsely claim instant response. Any future average-shaped report
    follows this, not `bucketed_counts`'s gap-fill.
11. **A gauge-shaped KPI can always reuse `GaugeChart` with zero code
    changes — frame it as a 0-1 "badness" fraction.** `GaugeChart`'s
    zone thresholds (`GOOD_THRESHOLD = 0.1`, `WARN_THRESHOLD = 0.25`)
    and orientation (0 = best, 1 = worst) are fixed, not props. `RPT-5`'s
    four dashboard KPIs — an open-ticket rate, a pooled SLA breach rate,
    a CSAT *dissatisfaction* rate (the inverse of `RPT-3`'s own "%
    satisfied"), and an unassigned-backlog rate — all fit this contract
    by construction: whichever raw quantity a KPI starts from, define
    its gauge input as *the share that is going wrong*, never *the
    share that is going right*. This is why `CsatRisk` shows
    dissatisfaction, not satisfaction, even though "% satisfied" is the
    more intuitive framing in isolation — a single dashboard-wide
    reading direction beats four gauges that each need to be read
    differently.

---

## 28. AI service foundation (AI-0)

`AI-0` (Story 74) is the shared foundation `AI-1`…`AI-5` build on — see
§ EPIC 13 in `SupportOs backlog.MD`.

**`apps/ai/client.py` is the only place `anthropic` is imported.** A
feature calls `generate_completion(...)`; it never constructs its own
`anthropic.Anthropic()` client or reads `settings.ANTHROPIC_API_KEY`
directly. This is what "single AI integration point" (the backlog's own
phrase) means in code: one client, one call signature, one exception
type (`apps.ai.exceptions.AIServiceError`) every consumer catches instead
of an `anthropic.*` exception class.

**`apps/ai/prompts.py::ground_with_knowledge_base` is how an AI feature
reads the knowledge base — never a second call into
`apps.knowledge_base.search.search_knowledge_base` with `include_drafts`
left to the caller's judgment.** It is hardcoded to `include_drafts=False`:
an AI-generated answer must never surface unpublished KB content, unlike
`KnowledgeBaseSearchView`'s permission-elevated human-facing search
(§ `KB-3`).

**No AI credential is ever logged, and neither is a prompt or a
response.** Ticket content, KB content, and customer data can appear in
any of the three; § 10's "never log secrets, never log request bodies"
rule applies to `apps/ai/client.py`'s own error logging exactly as it
does everywhere else — log the exception class or provider status code,
never the payload.

**`AI_MODEL` is an environment variable, not a per-feature constant.** A
story that needs a different model tier for its own task passes `model=`
to `generate_completion` explicitly; it does not add a second
`AI_*_MODEL` environment variable.

---

## 29. Public API & API keys (INT-1)

`INT-1` (Story 80) makes the existing `/api/` tree the public API. There is
no separate external surface, and there must never be one: a second tree
would need its own serializers, its own permission map, and its own
envelope, and would drift from the first within one story.

**An API key is an identity, not a permission set.**
`apps.integrations.authentication.ApiKeyAuthentication` returns the
`accounts.User` a key was issued for, and every existing `permission_map`,
`HasPermission` check, and `CustomerScopedModelViewSet` queryset filter
then applies to it unchanged (§ 22). **Never add a scope or permission
list to `ApiKey`** — § 13's "never build a second permission check" applies
directly. Narrow a key by issuing it against a narrowly-roled user.

**`apps/integrations/keys.py` is the only place a key is minted, hashed, or
compared.** Only `prefix` (the lookup column) and `sha256(secret)` are
stored; the plaintext exists for the duration of one `POST
/api/api-keys/` response and is never logged, never re-derivable, and
never returned again. Plain `sha256` rather than a password hasher is
deliberate — the secret is 256 bits of `secrets.token_hex`, so a slow KDF
defends nothing and would cost its full price on every API-key request.

**Revocation is a flag, never a delete.** `ApiKey.is_active = False` keeps
`last_used_at` and the issue date, which are the only record that a
credential ever existed. `ApiKeyViewSet.perform_destroy` is what `DELETE`
does; the OpenAPI description says so explicitly, because a `DELETE` that
does not delete would otherwise surprise an integrator.

**A new endpoint is documented by existing in the router — but its response
shape is documented by two shared pieces, not by the view.**
`apps.integrations.schema.envelope_postprocessing_hook` wraps every `2xx`
payload in the success envelope and attaches the shared `ErrorEnvelope` to
`400/401/403/404/500`;
`apps.core.pagination.DefaultPageNumberPagination.get_paginated_response_schema`
supplies the `meta.pagination` shape for list endpoints. A story that adds
an endpoint returning something other than a serializer (a bare dict, a
file) annotates it with `drf_spectacular.utils.extend_schema` on that view
— it does **not** add a second post-processing hook.

**`DEFAULT_RENDERER_CLASSES` stays a one-element list.** The doc views each
declare their own `renderer_classes`, which is why serving YAML and HTML
from under `/api/` does not need — and must not get — a global renderer
addition. `config/tests/test_settings.py::DrfSettingsTests
.test_only_the_envelope_renderer_is_registered` pins this.

---

## 30. ERP sync (INT-2)

`INT-2` (Story 81) is this project's first sync with a system it does not
own. Three rules follow from that and apply to `INT-3`/`INT-4` too.

**A foreign system's field names are configuration, never code.**
`ErpConnection.customer_field_map`/`order_field_map` translate ERP field
names to SupportOS ones, and `apps/integrations/erp_sync.py` is the only
module that applies them. A story that integrates a second external
system adds its own map to its own config row — it does not hardcode a
vendor's field name in a serializer or a task.

**A field map may only target an explicit allowlist.**
`CUSTOMER_SYNCABLE_FIELDS`/`ORDER_SYNCABLE_FIELDS`
(`apps/integrations/erp_sync.py`) are enforced in three places, on
purpose: `ErpConnection.clean()` (admin/`full_clean`),
`ErpConnectionSerializer` (the API path — DRF does not call model
`clean()`, § 22), and `apply_field_map` itself (a map written through the
ORM bypasses both). `Customer.external_id` and `Customer.user` are
deliberately **absent** from the allowlist: one is the correlation key the
upsert depends on, the other is the portal-login link a bulk import must
never re-point.

**An unconfigured integration is a no-op, not an error, and its schedule
ships enabled.** `run_erp_sync` returns immediately unless
`ErpConnection.is_configured()`, which is what lets
`0003_seed_erp_sync_schedule` seed an *enabled* `PeriodicTask` — the
schedule existing and the connection being configured are two independent
opt-ins, the same split § 24 already records for `SLA-3`.

**A per-record failure never aborts a run; a connection-level failure
does.** `erp_sync` counts a bad record into `ErpSyncRun.failed_count` and
carries on — imperfect upstream data is the normal case, and one
over-long name must not strand the other 4,999 records. An `ErpError`
(host down, non-2xx, non-JSON body) ends the run as `failed`. Either way
the `ErpSyncRun` row is the record; **no `AuditLog` row is written**, for
the same reason § 29 gives for API keys.

**A credential this project must replay cannot be hashed — so it is
write-only instead.** `ErpConnection.auth_token` is stored in plain text
(it is sent on every outbound call, unlike INT-1's `ApiKey`, which only
ever needs a digest), is `write_only` in its serializer, and is reported
to the UI only as the boolean `has_auth_token`. A blank token on `PATCH`
leaves the stored value alone, so saving the form cannot wipe it.
**Encryption at rest is not implemented** and is `INT-3`'s to decide — its
own task text is "secure central config for … credentials". Until then,
DB access is token access; § 10's never-log rule is what keeps it out of
logs.

---

## 31. Messaging provider config (INT-3)

`INT-3` (Story 82) moves the three outbound channel adapters'
credentials (`apps.communications.{email,whatsapp,sms}_adapter`) from
`ENV`-only settings to a DB-backed singleton per provider
(`EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig`,
`apps/communications/models.py`), each following the `pk=1`/`load()`
shape `organization.OrganizationSettings` and `integrations.ErpConnection`
already established.

**Scope is deliberately narrow: only the three channel adapters' `send()`
methods read this config.** `apps.accounts.tasks` (invite, password
reset) and `apps.notifications.tasks` (notification email) still read
Django's own `EMAIL_*` settings, unchanged — confirmed with the user
during planning. This means an operator using one SMTP account for
everything configures it in two places today. Unifying the two is a
legitimate follow-up; it is not something a future story should assume
already happened just because "messaging provider config" sounds like it
would cover it.

**A credential shared between an adapter's outbound send and a webhook's
inbound verification has exactly one stored value, read by both.**
`SmsProviderConfig.auth_token` is the one example today —
`SMSAdapter.send()` and `SMSInboundWebhookView.post()` both read it,
because Twilio's own Auth Token is genuinely dual-purpose. A future
provider whose API has the same shared-secret design should follow this,
not add two fields that can drift apart. A verification-only secret with
no adapter involvement (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET`, `EMAIL_INBOUND_WEBHOOK_TOKEN`) stays an `ENV`
setting — it is not "a credential reused by a channel adapter."

**Encryption at rest is not implemented, again, on purpose.** `INT-1`
(`ApiKey.hashed_key`, a digest — different case), `INT-2`
(`ErpConnection.auth_token`), and now `INT-3`
(`EmailProviderConfig.host_password`, `WhatsAppProviderConfig
.access_token`, `SmsProviderConfig.auth_token`) all store a live,
replayable credential in a plain `CharField`, `write_only` in its
serializer and never returned by the API. No encryption library is
installed in this project. Adding one is a single cross-cutting decision
that should encrypt all four fields at once — it is not a per-story
choice, and no story should quietly add its own encryption scheme for
just its own field.

**A removed `ENV` setting is removed everywhere at once: `config/settings/base.py`, `.env.example`, and the `README.md` table, in the same
change that removes its last Python reader.** `WHATSAPP_API_BASE_URL`/
`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`/`SMS_API_BASE_URL`/
`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` are the first
settings this project has ever removed rather than added — verified live
that each had zero remaining Python consumers before deletion. An
`ENV`-var removal without checking every consumer first is exactly the
mistake this rule exists to prevent.


---

## 32. Outbound webhooks & the signals exception (INT-4)

`INT-4` (Story 83) is the **first and, until a future story explicitly
says otherwise, only** place in this project that uses Django model
signals (`post_save`/`pre_save`/`@receiver`). Every other "something
happened, tell someone" hook in this codebase — `apps.notifications
.services.notify`, `apps.tickets.assignment.apply_assignment`,
`apps.tickets.escalation.apply_escalation` — is an explicit call at the
call site, and that stays the default. Signals were the deliberate
exception here, confirmed with the user during planning, because a
single domain event (a `Ticket` being created, say) has eight distinct
call sites across five channel adapters, the staff API, the portal API,
and the AI chatbot handoff, with more likely in the future — an explicit
call site at all eight, forever, is the wrong trade for "a ticket was
created" to keep meaning exactly that.

**Before adding a second signal receiver anywhere in this codebase, read
`apps/integrations/signals.py` first and ask whether the explicit-call-site
convention still fits better** — it usually does. Signals earn their cost
(implicit control flow, and — for change-detection specifically — an
extra query per update, see below) only when a project-wide, no-gaps
guarantee is the actual requirement, not merely a convenience.

**Detecting a field *change* via signals costs a query `post_save` alone
does not.** `post_save`'s own `created` flag answers "was this just
created" for free; answering "did `status` just change" needs the
*previous* value, which `apps/integrations/signals.py::_capture_ticket_changes`
gets via a `pre_save` re-fetch (`Ticket.objects.get(pk=instance.pk)`).
This runs on **every** `Ticket` UPDATE project-wide, not just ones a
webhook subscriber cares about — an accepted, deliberate cost of a
signals-only design with no new dependency (`django-model-utils`'
`FieldTracker` is not installed). A story adding a fourth tracked field
extends `_TRACKED_TICKET_FIELDS`, not a second re-fetch.

**The webhook event vocabulary is code; the subscription's chosen subset
is data** — the same split § 22 established for permissions.
`apps.integrations.models.WEBHOOK_EVENTS` is the vocabulary,
`WebhookSubscription.events` is the mapping, and adding a new event is a
two-line change: one entry in `WEBHOOK_EVENTS`, one new signal receiver
(or branch in an existing one) in `signals.py` — never a hardcoded event
string at a dispatch call site, because there is deliberately only one
dispatch call site (`webhook_dispatch.dispatch_event`).

**A one-shot event retries; a recurring sync does not.**
`apps.integrations.tasks.deliver_webhook` retries a failed delivery three
times with backoff before giving up — contrast `run_erp_sync` (Story 81),
which never retries, because an ERP sync failure self-heals on the next
hourly run. A webhook fires once for one real moment in time; if that
delivery is never retried and never succeeds, the moment it was
reporting is simply never communicated. A future one-shot async task
should default to retrying; a future recurring/scheduled one should
default to not.

---

## 33. Organizational scoping (ORG-1)

Two scoping primitives exist, and they answer different questions:

| Module | Scopes by | Caller can opt out? | Use for |
|---|---|---|---|
| `apps.core.views.CustomerScopedModelViewSet` | **who is calling** (`request.user.customer_profile`) | No — it is a security boundary | Every portal-facing viewset |
| `apps.core.scoping` | **what the caller asked for** (`?<param>=`) | Yes — absent means no filter | Staff-facing list narrowing, reports |

Never reach for the second where the first is meant. A `?department=`
filter is a convenience; it authorizes nothing.

**Declaring a scope.** A viewset lists its scopes as data and inherits the
parsing:

```python
class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    queryset = Ticket.objects.all()
    scope_filters = (ScopeFilter(param="department", field="department"),)
```

`ScopedQuerysetMixin` must come **before** `BaseModelViewSet` in the bases,
and the viewset must have a real `queryset` class attribute (its own
`get_queryset` override, if any, reaches the mixin through `super()`).
Only `list` is scoped; widen with `scoped_actions` deliberately.

A plain `APIView` (every `BaseReportView` subclass) calls
`apply_scope_filters(queryset, request.query_params, SCOPES)` directly
instead of inheriting anything.

**The param contract**, identical everywhere: absent/empty means no
filter; a numeric id filters by that id; the literal `"none"` filters for
rows with no value; anything else is a **400**. A malformed filter is
never a silently-unfiltered list.

**`Department` replaced `OrganizationSettings.departments`.** SEC-4 shipped
departments and branches as `JSONField` string lists, explicitly as a
placeholder until something referenced an individual one. ORG-1 promoted
the departments half to `organization.Department` with a data migration
(`0004_migrate_settings_departments`) and dropped the column. **`branches`
is still a JSON list** — ORG-2 promotes it the same way, and until it does,
no code may add a second consumer of that column.

**Frontend:** department options live in `src/shared/departments/`, not in
a feature — three features need the same list and `no-restricted-imports`
(§15) forbids reaching across features for it. `features/organization/`
owns only the management screens and the write path.
