# Frontend structure (`ARCH`, frontend half)

This is a decision record, not a tutorial. It exists so nobody has to re-derive
where a new file goes.

## Organise by feature, not by technical layer

There is no top-level `components/`, `utils/`, `services/`, or `helpers/`, and
there never will be. A feature owns its components, its API calls, its hooks,
and its types.

## Where new code goes

Work down this list and stop at the first match:

1. **Used by exactly one feature** → that feature's folder
   (`src/features/<feature>/{api,components,types}`).
2. **Used by two or more features** → `src/shared/` — `ui` for components,
   `hooks` for hooks, `lib` for everything else.
3. **App-wide wiring** (router, providers, root shell) → `src/app/`.
4. **Reads or writes the network** → `src/shared/lib/api/` **only**. Features
   import from there; they never call Axios or `fetch` themselves.

## A feature never imports from another feature

If two features need the same thing, move it to `src/shared/`. A
`features/a` → `features/b` import is a design smell to fix, not to work
around.

## `src/shared` is not a dumping ground

Something used once lives in its feature. Moving code into `shared` later is
easy; untangling `shared` after it becomes a dumping ground is not.

## Files are created on demand

A feature gets a `types/` folder when it has a shared type, a `components/`
folder when it has a component. Do not pre-create empty modules.

## Reserved directories

- **`src/shared/ui/`** — UI-1 will replace the internals of these components
  with shadcn primitives **without changing their props**, so features written
  against them today keep working after that story lands.

## Internationalization

`src/shared/i18n/` holds the i18next bootstrap: `config.ts` (the language
contract), `index.ts` (init), `direction.ts` (the only place `<html
dir/lang>` is written), `resources.ts` (the namespace registry), and
`i18next.d.ts` (the typed `t()`). `common`/`errors` locale JSON live under
`shared/i18n/locales/{en,ar}/`; each feature's own copy lives at
`src/features/<feature>/locales/{en,ar}.json` and is registered in
`resources.ts`. See `CONVENTIONS.md` § 18 for the full rules (no hardcoded
strings, logical CSS properties, locale formatting).

## The API layer

`src/shared/lib/` is the **only** place that talks to the network or the console:

- `lib/api/client.ts` — the one Axios instance (`httpClient`) and the typed
  `api.*` request helpers. Never create a second `axios.create()`.
- `lib/api/types.ts` — the TypeScript mirror of the backend envelope
  (`backend/apps/core/envelope.py`).
- `lib/api/errors.ts` — `ApiRequestError`, the one error type every failure
  normalises to.
- `lib/api/queryClient.ts` — the app's single `QueryClient` factory and retry
  policy.
- `lib/api/queryKeys.ts` — the `[feature, resource, ...]` key convention.
- `lib/logger.ts` — the only sanctioned `console.*` access. Never call
  `console.*` directly outside this file.
- `lib/format.ts` — locale-bound date/number/currency helpers. Prefer the
  `shared/hooks/useFormatters.ts` hook in components; never call `Intl` or
  `toLocaleString` directly in a feature.

Features call `api.get/post/put/patch/delete/getPage` and TanStack Query hooks
built on top of them. No `fetch`, no ad-hoc Axios, ever, in a feature.

`import.meta.env` is read in exactly four files, nowhere else: `config/env.ts`,
`main.tsx`, `app/providers.tsx`, and `shared/lib/logger.ts`.

## Related specs

The full conventions document is [`CONVENTIONS.md`](../../CONVENTIONS.md) (`CONV`)
and references this file rather than restating it. The response envelope this
layout serves is documented in the root `README.md` under **API conventions**.
Internationalization rules are in `CONVENTIONS.md` § 18.
