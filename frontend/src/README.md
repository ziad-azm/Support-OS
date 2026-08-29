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

**Exception in spirit, not in mechanism:** two features may still each call
the same _backend_ endpoint independently, each with its own minimal local
type — that is not the same thing as one feature importing another's
frontend code, and is not a violation of this rule. See
`frontend/src/features/tickets/api/getCustomerOptions.ts`.

## `src/shared` is not a dumping ground

Something used once lives in its feature. Moving code into `shared` later is
easy; untangling `shared` after it becomes a dumping ground is not.

## Files are created on demand

A feature gets a `types/` folder when it has a shared type, a `components/`
folder when it has a component. Do not pre-create empty modules.

## Design system

`src/shared/ui/primitives/` is the shadcn/ui set, CLI-managed
(`npx shadcn@latest add <name>`) and locally patched for RTL and i18n —
lowercase-kebab file names, the one scoped exception to this file's naming
rule. Everything else in `src/shared/ui/` is ours: `PascalCase.tsx`,
including `data-table/` (the one table pattern, server-driven) and
`confirm/` (the `useConfirm()` pattern). `src/shared/theme/` holds the
light/dark/system theme, mirroring `shared/i18n/`'s shape. The four
components `Loading`, `Empty`, `ErrorState`, and `QueryBoundary` were
restyled with the shadcn treatment **without changing their props** — the
promise this file made when they were reserved held. See `CONVENTIONS.md`
§ 19 for the full rules.

## Forms & validation

`src/shared/validation/` holds the Zod bootstrap: `config.ts` (the only
`z.config()` call), `errorMap.ts` (the i18next-backed error map, with Zod's
own locale as the fallback), `resolver.ts` (the only `@hookform/resolvers`
import), `schemas.ts` (shared field-shape helpers), and `serverErrors.ts`
(applies a `validation_error` envelope's `fields` map onto a form).
`src/shared/ui/form/` holds `useAppForm` (the only form entry point) and the
six shared field components (`TextField`, `TextareaField`, `SelectField`,
`CheckboxField`, `SwitchField`, `RadioGroupField`), following the same
file-shape precedent as `shared/ui/confirm/`. See `CONVENTIONS.md` § 20 for
the full rules and a worked example. `schemas.ts` also holds
`nullableString`/`nullableEmail` beside `optionalString`/`optionalEmail` —
reach for the nullable pair on a **nullable** database column, where a
cleared field must round-trip as an explicit `null`; keep the optional pair
for a value that is genuinely absent rather than empty. See `CONVENTIONS.md`
§ 23.

## Authentication & authorization

`src/shared/auth/` is the single source of auth state: `tokenStorage.ts`
(in-memory access token, `localStorage`-persisted refresh token),
`refresh.ts` (`refreshAccessToken()`, a single-flight promise), `AuthContext.ts`
/ `AuthProvider.tsx` / `useAuth.ts` (the `useToast`/`useConfirm` context
precedent), and `RequireAuth.tsx` (a path-less layout route guard).
`index.ts`'s side-effect import wires `client.ts`'s two auth seams
(`setAuthTokenProvider`, `setUnauthorizedHandler`) — nothing else should call
either directly. `src/features/auth/` holds `LoginPage`, built from
`useAppForm` + `TextField` like any other form. See `CONVENTIONS.md` § 21
for the full design.

Authorization lives beside it: `permissions.ts` (`hasPermission`, the pure
resolution), `Can.tsx` (declarative gating of a control), and
`RequirePermission.tsx` (a route guard, nested inside `RequireAuth`).
`useAuth().can(permission)` is the hook form. All three read
`user.permissions` — the flat list the backend already resolved, superuser
bypass included — and **never** derive from `user.role`. A feature that reads
`user.role` directly is bypassing `can()`. See `CONVENTIONS.md` § 22.

`src/shared/ui/form/SwitchField.tsx` got its first production consumer in
`features/accounts/components/UserFormPage.tsx` (Story 48, `SEC-1`)'s
active/inactive toggle — the fifth field component to ship with a real call
site, after `TextField`/`SelectField` (Customer/Article/Ticket forms).

## Internationalization

`src/shared/i18n/` holds the i18next bootstrap: `config.ts` (the language
contract), `index.ts` (init), `direction.ts` (the only place `<html
dir/lang>` is written), `useDirection.ts` (the React-readable form of the
same state, read by Radix's `DirectionProvider` and the data table's
pagination chevrons), `resources.ts` (the namespace registry), and
`i18next.d.ts` (the typed `t()`). `common`/`errors`/`validation` locale JSON
live under `shared/i18n/locales/{en,ar}/`; each feature's own copy lives at
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
- `lib/cn.ts` — the shadcn `cn()` class-merge helper (`clsx` + `tailwind-merge`).
  Every primitive and every component we author uses this to compose classes.

Features call `api.get/post/put/patch/delete/getPage` and TanStack Query hooks
built on top of them. No `fetch`, no ad-hoc Axios, ever, in a feature.

`shared/hooks/` follows the same "a module owns its own hook" precedent as
`shared/ui/toast/useToast.ts`: `useFormatters.ts` is its first occupant,
`useServerTable` lives beside `DataTable` in `shared/ui/data-table/`,
`useConfirm` lives beside `ConfirmProvider` in `shared/ui/confirm/`,
`useAppForm` lives beside the field components in `shared/ui/form/`, and
`useAuth` lives beside `AuthProvider` in `shared/auth/` — not all hooks live
in `shared/hooks/`.

`import.meta.env` is read in exactly four files, nowhere else: `config/env.ts`,
`main.tsx`, `app/providers.tsx`, and `shared/lib/logger.ts`.

## Related specs

The full conventions document is [`CONVENTIONS.md`](../../CONVENTIONS.md) (`CONV`)
and references this file rather than restating it. The response envelope this
layout serves is documented in the root `README.md` under **API conventions**.
Internationalization rules are in `CONVENTIONS.md` § 18; the design system,
theming, and data-table rules are in § 19; forms and validation are in § 20;
authentication is in § 21; authorization is in § 22.
