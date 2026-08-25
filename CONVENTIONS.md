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
  Hooks start with `use`. Backend modules `snake_case.py`.
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

Use `frontend/src/shared/ui/QueryBoundary.tsx` for every query result. Never
hand-roll an `isPending`/`isError` branch in a feature.

---

## 6. Validation

`FORM` (React Hook Form + Zod) is defined by **FORM-1**, not yet planned.

Until then: no forms exist in this codebase. Do not introduce a second
validation approach ahead of FORM-1.

---

## 7. Reusable components

`UI` (Tailwind + shadcn/ui) is defined by **UI-1**, not yet planned.

Until then: `frontend/src/shared/ui/` holds minimal, near-unstyled
components. UI-1 will replace their internals with shadcn primitives
**without changing their props**, so build against them now — the props are
the stable contract.

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

`AUTHZ` is defined by **AUTH-1** (JWT) and **AUTH-2** (roles/permissions),
neither planned yet.

Two live seams already exist so neither reinvents its own hook point:

- `setAuthTokenProvider` in `frontend/src/shared/lib/api/client.ts`.
- The `JWT_SIGNING_KEY` / `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` /
  `JWT_REFRESH_TOKEN_LIFETIME_DAYS` variables already staged in
  `backend/config/settings/base.py`.

**Open security note:** `DEFAULT_PERMISSION_CLASSES` is `AllowAny` and no
authentication classes are configured, until AUTH-2 lands. **Any endpoint
added before then must set `permission_classes` explicitly on its own
view.**

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
