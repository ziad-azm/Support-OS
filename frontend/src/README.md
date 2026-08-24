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

- **`src/shared/i18n/`** — reserved for **I18N-1**. Not created by this story;
  no i18n code exists yet.
- **`src/shared/ui/`** — UI-1 will replace the internals of these components
  with shadcn primitives **without changing their props**, so features written
  against them today keep working after that story lands.

## `src/test/`

Holds test infrastructure (Vitest setup), not tests. Tests live beside the
code they cover as `*.test.ts` / `*.test.tsx`.

## The API layer

`src/shared/lib/api/` is the **only** place that talks to the network:

- `client.ts` — the one Axios instance (`httpClient`) and the typed `api.*`
  request helpers. Never create a second `axios.create()`.
- `types.ts` — the TypeScript mirror of the backend envelope
  (`backend/apps/core/envelope.py`).
- `errors.ts` — `ApiRequestError`, the one error type every failure normalises
  to.
- `queryClient.ts` — the app's single `QueryClient` factory and retry policy.
- `queryKeys.ts` — the `[feature, resource, ...]` key convention.

Features call `api.get/post/put/patch/delete/getPage` and TanStack Query hooks
built on top of them. No `fetch`, no ad-hoc Axios, ever, in a feature.

## Related specs

The full conventions document is `CONV` (FND-4) and will reference this file
rather than restate it. The response envelope this layout serves is
documented in the root `README.md` under **API conventions**.
