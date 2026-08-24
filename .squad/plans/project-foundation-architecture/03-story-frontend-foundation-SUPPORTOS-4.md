# Story 03 — Frontend Foundation (React + Vite + TS) (Story: SUPPORTOS-4)

## Prerequisites

- **Story 01 completed:** [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md) — `frontend/` runs, and `frontend/src/config/env.ts` is the only module that reads `import.meta.env`.
- **Story 02 completed:** [02-story-backend-foundation-drf-SUPPORTOS-3.md](02-story-backend-foundation-drf-SUPPORTOS-3.md) — the response envelope this story types against is live at `987c4e0`. `GET /api/health/` returns it, and `CORS_ALLOWED_ORIGINS` already includes `http://localhost:5173`.
- **The backend must be running** for Verification Steps 5–8: `cd backend && .\.venv\Scripts\Activate.ps1 && python manage.py runserver`. Local PostgreSQL is reachable (story 01's blocker is closed).
- Verified frontend toolchain, from `frontend/package.json`: React **19.2.8**, Vite **8.2.2**, TypeScript **~6.0.2**, `@vitejs/plugin-react` 6.1.0, **oxlint** 1.79 (not ESLint — do not add ESLint), `@types/node` 24.13.
- **Three tsconfig constraints that change how you write code here** (`frontend/tsconfig.app.json` lines 11–23):
  - `erasableSyntaxOnly: true` — **no `enum`**, no parameter properties, no namespaces. Union types plus `as const` objects instead.
  - `verbatimModuleSyntax: true` — type-only imports **must** use `import type { … }`.
  - `noUnusedLocals` / `noUnusedParameters` — an unused import fails `npm run build`.

---

## Story Goal

Turn the Vite starter into a feature-based app whose every network call goes through one typed, error-handled layer.

1. A documented feature-based structure: `src/features/<feature>/{components,api,hooks,types}`, `src/shared/{ui,lib,hooks}`, `src/app` (router and providers), with a written placement rule.
2. React Router with route-level error boundaries.
3. **One** Axios instance and **one** QueryClient. Every response is validated against story 02's envelope, and every failure — envelope error, non-envelope HTTP error, or network failure — arrives at the caller as a single normalised `ApiRequestError`.
4. One way to render loading, error, and empty states, plus a toast system wired to API errors.
5. A `health` feature that calls `GET /api/health/` through the whole stack — the reference implementation for every future feature, and this story's own end-to-end proof.

**Three additions beyond the intake's three tasks, each stated rather than smuggled:**

- **`strict: true` in `frontend/tsconfig.app.json`.** It is absent today (verified — `grep strict frontend/tsconfig*.json` returns nothing), so every file written between now and FND-4 accumulates implicit `any`. Enabling it costs minutes now and a sweep later. FND-4 still owns the wider TypeScript conventions.
- **Vitest.** Story 01 and story 02 both deferred frontend tests with the words "an automated version lands with FND-3's test setup" — this is that story. FND-4 still owns coverage thresholds and naming conventions.
- **A `@/` path alias** to `src/`, so `shared/lib/api` imports do not become `../../../shared/lib/api`.

**Explicitly out of scope:**

- **Tailwind CSS and shadcn/ui** → **UI-1** (`SupportOs backlog.MD` lines 173–203), which depends on FND-3 *and* I18N-1. The components this story builds are deliberately minimal and near-unstyled; UI-1 rebuilds them on shadcn primitives **without changing their props**. Do not add Tailwind here.
- **i18next and RTL** → **I18N-1** (lines 147–171). Every user-facing string in this story is a plain English literal, and `src/shared/i18n/` is **not** created — I18N-1 owns it. This is the one place the intake's structure list is deliberately not fully materialised; see task 2.
- **React Hook Form and Zod** → **FORM-1** (lines 205–219). No forms in this story.
- **Real authentication.** The request interceptor gets a token *seam* (`setAuthTokenProvider`) but no storage, no refresh, no route guards → **AUTH-1** (lines 228–246).
- **Any business feature.** `health` is the only feature, and it exists as the reference pattern.
- **ESLint, Prettier, coverage gates** → FND-4.

---

## Context — Read These Files First

1. `.squad/stories/project-foundation-architecture/SUPPORTOS-4/intake.md` — the source story. The fenced **Description** block holds the three tasks. Note the structure spec is mangled by the tracker's export (`{{src/features/<feature>/{components,api,hooks,types}}}`); read it as `src/features/<feature>/{components,api,hooks,types}` plus `src/shared/{ui,lib,hooks,i18n}` plus `src/app`. **No attachments, no acceptance criteria** — Done Criteria derive from the three **Outcome** lines.
2. `frontend/src/config/env.ts` — all 22 lines. `env.apiBaseUrl` (line 21) is the **only** sanctioned source of the API base URL, and line 17 already strips trailing slashes. The Axios instance must import from here; **do not** read `import.meta.env` anywhere else.
3. `frontend/src/main.tsx` — all 15 lines. Task 4 rewrites this. Note the existing `import.meta.env.DEV` log on lines 7–9 — keep that behaviour.
4. `frontend/tsconfig.app.json` — lines 2–24. You are adding `strict` and `paths`. Re-read the three constraints listed in Prerequisites before writing any TypeScript.
5. `frontend/vite.config.ts` — all 7 lines. Task 1 adds `resolve.alias` and the Vitest `test` block.
6. `backend/apps/core/envelope.py` — the authoritative envelope shape. The docstring (lines 1–15) is the contract this story mirrors in TypeScript. **If these two files disagree, the backend is right.**
7. `backend/apps/core/exceptions.py` — read `VALIDATION_MESSAGE`, `INTERNAL_MESSAGE`, `NON_FIELD_KEY` (lines 19–21) and `envelope_exception_handler` (lines 24–46). `error.fields` is always an object; `error.debug` exists only when `DEBUG` is true.
8. `backend/apps/core/pagination.py` — `get_paginated_response` (lines 22–38) gives the exact `meta.pagination` keys: `count`, `page`, `page_size`, `num_pages`, `next`, `previous`. Snake_case — do **not** camelCase them in the TypeScript types; they are wire format.
9. `README.md` § **API conventions** — the error-code table and the "never build an envelope in a view" rule. Task 8 adds the frontend half of this section.
10. `backend/apps/README.md` — the backend placement rule. Task 2's `frontend/src/README.md` is its mirror; match its tone and its "files are created on demand" stance.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **No dumping-ground** `components/` or `utils/`. | Intake, task 1 constraints | `src/features/<feature>/` and `src/shared/{ui,lib,hooks}` only. Written down in `frontend/src/README.md`. |
| Each feature **self-contained**; shared code only under `src/shared`. | Intake, task 1 constraints | Placement rule + the "a feature never imports from another feature" rule in task 2. |
| **The only** API client in the app. | Intake, task 2 constraints | One `axios.create()` in `src/shared/lib/api/client.ts`. Enforced by test 14, which greps `src/` for stray `axios.create`/`fetch(`. |
| All data fetching goes through **TanStack Query**; no `fetch`/ad-hoc Axios in features. | Intake, task 2 constraints | Features export query/mutation hooks from their `api/` folder; `health` is the worked example. |
| Features **reuse** the error/loading/empty patterns; no per-feature implementations. | Intake, task 3 constraints | `QueryBoundary`, `Loading`, `Empty`, `ErrorState` in `src/shared/ui/`. |
| Config from `ENV`. | Story 01 `ENV` contract | `env.apiBaseUrl` from `src/config/env.ts`; no new `import.meta.env` reads. |

---

## Frontend Tasks

No backend changes are required. `GET /api/health/` and the CORS allow-list already serve this story exactly as they are.

### 1 — Dependencies, path alias, strict mode, Vitest

**Install.** From `frontend/`:

```powershell
npm install react-router @tanstack/react-query axios
npm install -D @tanstack/react-query-devtools vitest jsdom @testing-library/react @testing-library/jest-dom axios-mock-adapter
```

Use **`react-router`** (v7), not `react-router-dom` — v7 merged the DOM exports into the base package and `react-router-dom` is a compatibility shim.

**File: `frontend/package.json`**

Add two scripts alongside the existing `dev`/`build`/`lint`/`preview`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**File: `frontend/tsconfig.app.json`**

Add `strict` and `paths` to `compilerOptions`. Keep every existing option:

```jsonc
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    },
```

`moduleResolution: "bundler"` resolves `paths` without a `baseUrl`. Add `"vitest/globals"` to the existing `types` array so `describe`/`it`/`expect` typecheck:

```jsonc
    "types": ["vite/client", "vitest/globals"],
```

**File: `frontend/vite.config.ts`**

Replace the whole file. Vite needs the alias too — TypeScript `paths` only informs the compiler:

```ts
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

`tsconfig.node.json` already has `"types": ["node"]`, so `node:url` typechecks in this file.

**Create file: `frontend/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

`src/test/` is infrastructure, not a feature — note it in the placement rule (task 2) so nobody files it as one.

---

### 2 — The feature-based structure and its placement rule

**Create these directories** (they are created by the files that populate them — do not add empty placeholders):

```text
src/
├── app/                       router, providers, root shell
├── features/
│   └── health/
│       ├── api/               endpoint functions + query hooks
│       ├── components/        presentational pieces
│       └── types/             feature-local types
├── shared/
│   ├── ui/                    cross-feature presentational components
│   ├── lib/
│   │   └── api/               the single Axios instance, envelope types, QueryClient
│   └── hooks/                 cross-feature hooks
├── config/                    env.ts (story 01)
└── test/                      Vitest setup
```

`src/features/health/hooks/` is **not** created — the health feature's hooks live in `api/` because they are query hooks. That is the convention, and task 2's document says so.

**`src/shared/i18n/` is deliberately not created.** The intake lists it, but this story adds no i18n code and an empty directory is a promise the codebase has not made. It is listed as *reserved for I18N-1* in the structure document instead.

**Create file: `frontend/src/README.md`**

The frontend half of `ARCH`, mirroring `backend/apps/README.md`. It must state:

1. **Organise by feature, not by technical layer.** There is no top-level `components/`, `utils/`, `services/`, or `helpers/`. A feature owns its components, its API calls, its hooks, and its types.
2. **Where new code goes**, as a stop-at-first-match list:
   - Used by exactly one feature → that feature's folder.
   - Used by two or more features → `src/shared/` (`ui` for components, `hooks` for hooks, `lib` for everything else).
   - App-wide wiring (router, providers, root shell) → `src/app/`.
   - Reads or writes the network → `src/shared/lib/api/` **only**; features import from there.
3. **A feature never imports from another feature.** If two features need the same thing, it moves to `src/shared/`. A `features/a` → `features/b` import is a design smell to fix, not to work around.
4. **`src/shared` is not a dumping ground.** Something used once lives in its feature. Moving code into `shared` later is easy; untangling `shared` is not.
5. **Files are created on demand.** A feature gets a `types/` folder when it has a shared type, a `components/` folder when it has a component. Do not pre-create empty modules.
6. **Reserved directories:** `src/shared/i18n/` (I18N-1), and note that UI-1 will replace the internals of `src/shared/ui/` with shadcn primitives **without changing their props** — so features written against them today keep working.
7. **`src/test/`** holds test infrastructure, not tests. Tests live beside the code they cover as `*.test.ts(x)`.
8. A pointer that `CONV` (FND-4) references this file rather than restating it.

---

### 3 — The single API layer

Four modules under `frontend/src/shared/lib/api/`. Read them in order; each builds on the last.

**Create file: `frontend/src/shared/lib/api/types.ts`**

The TypeScript mirror of `backend/apps/core/envelope.py`. Keys stay snake_case — they are wire format.

```ts
/**
 * Mirror of the backend response envelope (`backend/apps/core/envelope.py`).
 * If the two ever disagree, the backend is authoritative.
 */

/** Codes the backend can emit — see README § API conventions. */
export const API_ERROR_CODES = [
  'validation_error',
  'parse_error',
  'not_authenticated',
  'authentication_failed',
  'permission_denied',
  'not_found',
  'method_not_allowed',
  'not_acceptable',
  'unsupported_media_type',
  'throttled',
  'internal_error',
] as const

/** Codes this client synthesises when there is no envelope to read. */
export const CLIENT_ERROR_CODES = [
  'network_error',
  'timeout',
  'invalid_envelope',
  'unknown_error',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number]
export type ErrorCode = ApiErrorCode | ClientErrorCode

export type ApiErrorBody = {
  code: string
  message: string
  /** Always an object — `{}` when the error is not field-scoped. */
  fields: Record<string, string[]>
  /** Present only when the backend runs with DEBUG=True. Never depend on it. */
  debug?: { exception: string; traceback: string[] }
}

export type ApiPagination = {
  count: number
  page: number
  page_size: number
  num_pages: number
  next: string | null
  previous: string | null
}

export type ApiMeta = { pagination?: ApiPagination } | null

export type ApiSuccess<T> = {
  success: true
  data: T
  error: null
  meta: ApiMeta
}

export type ApiFailure = {
  success: false
  data: null
  error: ApiErrorBody
  meta: null
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export type Page<T> = {
  items: T[]
  pagination: ApiPagination
}
```

Use `as const` arrays plus indexed access for the code unions — **not** `enum`, which `erasableSyntaxOnly` forbids.

**Create file: `frontend/src/shared/lib/api/errors.ts`**

One error type for every failure mode, so callers and UI never branch on Axios internals.

```ts
import { AxiosError } from 'axios'

import type { ApiErrorBody, ErrorCode } from './types'

/**
 * The only error the API layer throws. Normalises three unrelated failures —
 * a backend envelope error, an HTTP error whose body is not an envelope, and a
 * transport failure with no response at all — into one shape.
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | string
  readonly status: number | null
  readonly fields: Record<string, string[]>
  readonly debug?: ApiErrorBody['debug']

  constructor(init: {
    code: ErrorCode | string
    message: string
    status?: number | null
    fields?: Record<string, string[]>
    debug?: ApiErrorBody['debug']
  }) {
    super(init.message)
    this.name = 'ApiRequestError'
    this.code = init.code
    this.status = init.status ?? null
    this.fields = init.fields ?? {}
    this.debug = init.debug
  }

  /** Field-level messages, for a form to attach to inputs (FORM-1 consumes this). */
  get fieldErrors(): Record<string, string[]> {
    return this.fields
  }

  /** Messages with no field to attach to. */
  get nonFieldErrors(): string[] {
    return this.fields.non_field_errors ?? []
  }

  get isValidation(): boolean {
    return this.code === 'validation_error'
  }

  get isAuth(): boolean {
    return this.code === 'not_authenticated' || this.code === 'authentication_failed'
  }

  /** Transport-level failure — worth retrying; a 4xx is not. */
  get isTransport(): boolean {
    return this.code === 'network_error' || this.code === 'timeout'
  }
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

/** Turn anything Axios (or the network) throws into an ApiRequestError. */
export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error

  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiRequestError({
        code: 'timeout',
        message: 'The request timed out. Please try again.',
      })
    }

    if (!error.response) {
      return new ApiRequestError({
        code: 'network_error',
        message: 'Cannot reach the server. Check your connection and try again.',
      })
    }

    const status = error.response.status
    const body = error.response.data as { error?: unknown } | undefined

    if (body && isApiErrorBody(body.error)) {
      const apiError = body.error
      return new ApiRequestError({
        code: apiError.code,
        message: apiError.message,
        status,
        fields: apiError.fields ?? {},
        debug: apiError.debug,
      })
    }

    // An HTTP error whose body is not an envelope: a proxy page, an HTML 500
    // from outside the /api/ tree, a gateway error.
    return new ApiRequestError({
      code: 'unknown_error',
      message: GENERIC_MESSAGE,
      status,
    })
  }

  return new ApiRequestError({
    code: 'unknown_error',
    message: error instanceof Error ? error.message : GENERIC_MESSAGE,
  })
}
```

**Create file: `frontend/src/shared/lib/api/client.ts`**

The one Axios instance in the app.

```ts
import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

import { env } from '@/config/env'

import { ApiRequestError, toApiRequestError } from './errors'
import type { ApiEnvelope, ApiPagination, Page } from './types'

const DEFAULT_TIMEOUT_MS = 15_000

/** The single Axios instance. Do not create another one anywhere in src/. */
export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

type TokenProvider = () => string | null

let tokenProvider: TokenProvider = () => null

/**
 * Seam for AUTH-1. It supplies the real token source; this story ships the hook
 * point only, so no auth storage decision is made prematurely.
 */
export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

httpClient.interceptors.request.use((config) => {
  const token = tokenProvider()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiRequestError(error)),
)

function unwrap<T>(envelope: unknown): ApiSuccessParts<T> {
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    typeof (envelope as { success?: unknown }).success !== 'boolean'
  ) {
    // Most often a misconfigured VITE_API_BASE_URL: a 200 that is not our API.
    throw new ApiRequestError({
      code: 'invalid_envelope',
      message:
        'The server returned an unexpected response. Check VITE_API_BASE_URL in frontend/.env.',
    })
  }

  const body = envelope as ApiEnvelope<T>
  if (!body.success) {
    throw new ApiRequestError({
      code: body.error.code,
      message: body.error.message,
      fields: body.error.fields ?? {},
      debug: body.error.debug,
    })
  }

  return { data: body.data, meta: body.meta }
}

type ApiSuccessParts<T> = { data: T; meta: ApiMeta }

/**
 * Typed request helpers. Every feature calls these — never httpClient directly,
 * and never fetch().
 */
export const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.get<ApiEnvelope<T>>(url, config)
    return unwrap<T>(response.data).data
  },

  async post<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.post<ApiEnvelope<T>>(url, payload, config)
    return unwrap<T>(response.data).data
  },

  async put<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.put<ApiEnvelope<T>>(url, payload, config)
    return unwrap<T>(response.data).data
  },

  async patch<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.patch<ApiEnvelope<T>>(url, payload, config)
    return unwrap<T>(response.data).data
  },

  async delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.delete<ApiEnvelope<T>>(url, config)
    // 204 has an empty body by design (backend renderer returns b"").
    if (!response.data) return undefined as T
    return unwrap<T>(response.data).data
  },

  /** List endpoints: returns items plus the pagination block from `meta`. */
  async getPage<T>(url: string, config?: AxiosRequestConfig): Promise<Page<T>> {
    const response = await httpClient.get<ApiEnvelope<T[]>>(url, config)
    const { data, meta } = unwrap<T[]>(response.data)
    const pagination = meta?.pagination
    if (!pagination) {
      throw new ApiRequestError({
        code: 'invalid_envelope',
        message: 'Expected a paginated response but meta.pagination was missing.',
      })
    }
    return { items: data, pagination }
  },
}
```

Add `ApiMeta` to the type import from `./types`. **Both** the response interceptor and `unwrap` produce `ApiRequestError` — the interceptor for HTTP/transport failures, `unwrap` for a 200 whose body is wrong. A caller only ever catches `ApiRequestError`.

**Create file: `frontend/src/shared/lib/api/queryClient.ts`**

```ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { ApiRequestError } from './errors'

const MAX_RETRIES = 2

/**
 * Retry transport failures and 5xx; never retry a 4xx — a 404 or a validation
 * error will not become true by asking again.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (!(error instanceof ApiRequestError)) return false
  if (error.isTransport) return true
  return error.status !== null && error.status >= 500
}

export type QueryMeta = {
  /** Opt a query into the global error toast. Default: render inline instead. */
  toastOnError?: boolean
}

export function createQueryClient(onError: (error: ApiRequestError) => void): QueryClient {
  const handle = (error: unknown) => {
    onError(error instanceof ApiRequestError ? error : new ApiRequestError({
      code: 'unknown_error',
      message: 'Something went wrong. Please try again.',
    }))
  }

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    // Mutations always toast: they are user-initiated, so silence reads as
    // success. Queries render inline via QueryBoundary and toast only when the
    // query opts in with meta.toastOnError.
    mutationCache: new MutationCache({ onError: handle }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        if ((query.meta as QueryMeta | undefined)?.toastOnError) handle(error)
      },
    }),
  })
}
```

**Create file: `frontend/src/shared/lib/api/queryKeys.ts`**

```ts
/**
 * Query-key convention: [feature, resource, ...discriminators].
 * Features export their own key factory; this module holds only the helper so
 * the shape stays uniform and invalidation can target a whole feature.
 */
export function featureKey(feature: string) {
  return {
    all: [feature] as const,
    resource: (resource: string, ...rest: readonly unknown[]) =>
      [feature, resource, ...rest] as const,
  }
}
```

---

### 4 — Shared UI: loading, empty, error, toast, error boundary

All under `frontend/src/shared/ui/`. Keep them minimal and near-unstyled — **UI-1 replaces the internals on shadcn primitives without changing these props.** Say that in each file's docstring.

**Create file: `frontend/src/shared/ui/Loading.tsx`** — a `role="status"` element with an accessible label; props `{ label?: string }`.

**Create file: `frontend/src/shared/ui/Empty.tsx`** — props `{ title?: string; description?: string; action?: ReactNode }`.

**Create file: `frontend/src/shared/ui/ErrorState.tsx`** — props `{ error: ApiRequestError; onRetry?: () => void }`. Renders `error.message`, and when `error.debug` is present (backend `DEBUG=True` only) renders the traceback inside a collapsed `<details>`. Never render `error.debug` unconditionally.

**Create file: `frontend/src/shared/ui/QueryBoundary.tsx`**

The single component that turns a TanStack Query result into UI. This is the "one consistent way" the intake asks for.

```tsx
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

import { ApiRequestError } from '@/shared/lib/api/errors'

import { Empty } from './Empty'
import { ErrorState } from './ErrorState'
import { Loading } from './Loading'

type QueryBoundaryProps<T> = {
  query: UseQueryResult<T, unknown>
  children: (data: T) => ReactNode
  /** Treat this data as "nothing to show" and render the empty state. */
  isEmpty?: (data: T) => boolean
  loading?: ReactNode
  empty?: ReactNode
}

export function QueryBoundary<T>({
  query,
  children,
  isEmpty,
  loading,
  empty,
}: QueryBoundaryProps<T>) {
  if (query.isPending) return <>{loading ?? <Loading />}</>

  if (query.isError) {
    const error =
      query.error instanceof ApiRequestError
        ? query.error
        : new ApiRequestError({ code: 'unknown_error', message: 'Something went wrong.' })
    return <ErrorState error={error} onRetry={() => void query.refetch()} />
  }

  const data = query.data as T
  if (isEmpty?.(data)) return <>{empty ?? <Empty />}</>

  return <>{children(data)}</>
}
```

Use `query.isPending` (TanStack Query v5), **not** the v4 `isLoading`. An array-returning query passes `isEmpty={(rows) => rows.length === 0}`.

**Create file: `frontend/src/shared/ui/toast/ToastProvider.tsx`** and **`frontend/src/shared/ui/toast/useToast.ts`**

A context holding `{ id, tone: 'error' | 'success' | 'info', message }[]`, a `push` that auto-dismisses after ~6s, and a fixed-position list rendered with `role="status"` / `aria-live="polite"`. `useToast()` returns `{ toast, dismiss }`. Keep the state in the provider; **do not** reach for a library — UI-1 may swap the renderer behind this same hook.

`ToastProvider` must expose its `push` to non-React code so the QueryClient's `onError` can call it. Use a module-level setter (`setToastSink`) that `ToastProvider` registers on mount, mirroring `setAuthTokenProvider`. Document that this is the one sanctioned escape from React context, and why: the QueryClient is constructed outside the tree.

**Create file: `frontend/src/shared/ui/AppErrorBoundary.tsx`**

A class component (React has no hook equivalent) with `componentDidCatch` logging to `console.error` and a fallback offering a reload. This catches render-time crashes — **not** query errors, which `QueryBoundary` handles. Note that distinction in the docstring; conflating them is the usual mistake.

---

### 5 — App shell: providers and router

**Create file: `frontend/src/app/providers.tsx`**

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { createQueryClient } from '@/shared/lib/api/queryClient'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary'
import { ToastProvider } from '@/shared/ui/toast/ToastProvider'
import { pushToast } from '@/shared/ui/toast/toastSink'

export function AppProviders({ children }: { children: ReactNode }) {
  // useState, not a module constant: one client per app instance, and tests get
  // a fresh cache per render.
  const [queryClient] = useState(() =>
    createQueryClient((error) => pushToast({ tone: 'error', message: error.message })),
  )

  return (
    <AppErrorBoundary>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        </QueryClientProvider>
      </ToastProvider>
    </AppErrorBoundary>
  )
}
```

`ToastProvider` wraps `QueryClientProvider` so the sink is registered before any query can fail.

**Create file: `frontend/src/app/router.tsx`**

`createBrowserRouter` with a root route, a `RouteErrorBoundary` as every route's `errorElement` (the "route boundaries" the intake asks for), a lazy `health` route, and a catch-all `*` → `NotFoundPage`.

```tsx
import { createBrowserRouter } from 'react-router'

import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { HealthPage } = await import('@/features/health/components/HealthPage')
          return { element: <HealthPage /> }
        },
      },
      {
        path: '*',
        lazy: async () => {
          const { NotFoundPage } = await import('./NotFoundPage')
          return { element: <NotFoundPage /> }
        },
      },
    ],
  },
])
```

**Create file: `frontend/src/app/RootLayout.tsx`** — an `<Outlet />` inside a minimal `<main>`; no navigation chrome (UI-1 owns layout).
**Create file: `frontend/src/app/RouteErrorBoundary.tsx`** — uses `useRouteError()` and `isRouteErrorResponse()`; renders `ErrorState` for an `ApiRequestError`, otherwise a generic message.
**Create file: `frontend/src/app/NotFoundPage.tsx`** — "Page not found." plus a link to `/`.

**File: `frontend/src/main.tsx`**

Replace the whole file. Keep the existing DEV log from lines 7–9.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { AppProviders } from './app/providers'
import { router } from './app/router'
import { env } from './config/env'
import './index.css'

if (import.meta.env.DEV) {
  console.info('[SupportOS] API base URL:', env.apiBaseUrl)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
```

**Delete file: `frontend/src/App.tsx`**
**Delete file: `frontend/src/App.css`**
**Delete file: `frontend/src/assets/hero.png`**
**Delete file: `frontend/src/assets/react.svg`**
**Delete file: `frontend/src/assets/vite.svg`**

Story 01 deliberately kept the Vite demo so its diff stayed reviewable; this is the story that removes it. `frontend/src/assets/` becomes empty — delete the directory too.

**File: `frontend/src/index.css`** — replace the Vite demo styles with a minimal reset (box-sizing, system font stack, sensible `body` margin) and nothing more. Tailwind arrives in UI-1 and will own this file.

**File: `frontend/README.md`** — replace the Vite boilerplate with a short pointer: run steps live in the root `README.md`, structure rules in `src/README.md`.

---

### 6 — The `health` reference feature

This is the worked example every future feature copies, and this story's end-to-end proof.

**Create file: `frontend/src/features/health/types/health.ts`**

```ts
/** Mirrors `apps.core.views.HealthView` — the payload inside `data`. */
export type HealthStatus = {
  status: 'ok' | 'degraded'
  database: 'ok' | 'error'
}
```

**Create file: `frontend/src/features/health/api/healthKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const healthKeys = featureKey('health')
```

**Create file: `frontend/src/features/health/api/getHealth.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { HealthStatus } from '../types/health'

export function getHealth(): Promise<HealthStatus> {
  return api.get<HealthStatus>('/health/')
}
```

The leading slash with `baseURL` ending in `/api` yields `http://localhost:8000/api/health/`. Keep the **trailing** slash — Django's `APPEND_SLASH` would otherwise 301 every call.

**Create file: `frontend/src/features/health/api/useHealth.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { healthKeys } from './healthKeys'
import { getHealth } from './getHealth'

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.resource('status'),
    queryFn: getHealth,
  })
}
```

**Create file: `frontend/src/features/health/components/HealthPage.tsx`**

Calls `useHealth()` and renders through `QueryBoundary`, showing `status` and `database`. Add a button calling `useToast().toast(...)` so the toast system is demonstrably wired. **No `fetch`, no `axios` import** — that is the whole point of the example.

---

### 7 — Tests

**Create `*.test.ts(x)` files beside the code they cover.** Vitest with `globals: true`, so no imports of `describe`/`it`/`expect`.

1. **`src/shared/lib/api/errors.test.ts`** — `toApiRequestError` for: an `AxiosError` with an envelope error body (code/message/fields preserved); a `403` whose body is HTML (→ `unknown_error`, status 403); no `response` (→ `network_error`); `code: 'ECONNABORTED'` (→ `timeout`); a plain `Error` (→ `unknown_error`); an existing `ApiRequestError` (returned unchanged).
2. **`src/shared/lib/api/errors.test.ts`** (same file) — the getters: `isValidation`, `isAuth`, `isTransport`, `nonFieldErrors` defaulting to `[]` when `fields` has no `non_field_errors` key.
3. **`src/shared/lib/api/client.test.ts`** — with `axios-mock-adapter` on `httpClient`, so the real interceptor chain runs:
   - `api.get` returns the unwrapped `data` from a success envelope.
   - A `200` whose body is **not** an envelope (e.g. `'<!doctype html>'`) throws `invalid_envelope` — the misconfigured-`VITE_API_BASE_URL` case.
   - A `400` envelope error throws `ApiRequestError` with `code: 'validation_error'` and the `fields` object intact.
   - A network failure throws `network_error`.
   - `api.getPage` returns `{ items, pagination }` from `meta.pagination`.
   - `api.getPage` throws `invalid_envelope` when `meta.pagination` is absent.
   - `api.delete` resolves for a `204` with an empty body.
   - `setAuthTokenProvider` causes an `Authorization: Bearer …` header; the default provider sends none.
4. **`src/shared/lib/api/queryClient.test.ts`** — `shouldRetry` behaviour: retries `network_error` and a 500, does **not** retry a 404 or `validation_error`, stops at `MAX_RETRIES`, and returns false for a non-`ApiRequestError`.
5. **`src/shared/ui/QueryBoundary.test.tsx`** — with Testing Library: pending → `Loading`; error → `ErrorState` with the error message; success → children; `isEmpty` true → `Empty`. Pass hand-built `UseQueryResult`-shaped objects rather than mounting a real query, so the test stays a unit test.
6. **`src/shared/ui/ErrorState.test.tsx`** — renders `error.message`; renders the traceback `<details>` only when `error.debug` is set.
7. **`src/features/health/api/useHealth.test.tsx`** — render the hook inside a `QueryClientProvider` with `axios-mock-adapter` returning a health envelope; assert the hook resolves to `{ status: 'ok', database: 'ok' }`. This is the integration test proving a feature reaches the backend contract through the shared layer.
8. **`src/shared/lib/api/singleClient.test.ts`** — the constraint test. Read every file under `src/` (Node `fs`, allowed by `tsconfig.node.json`'s `types: ["node"]` — put this test's `fs` usage behind `vitest`'s node environment via a `// @vitest-environment node` pragma) and assert:
   - `axios.create(` appears in exactly one file, `shared/lib/api/client.ts`.
   - `fetch(` appears in no file under `src/features/`.
   - `import.meta.env` appears only in `src/config/env.ts`, `src/main.tsx`, and `src/app/providers.tsx`.

   This is the only automated guard for the intake's "**the only** API client" constraint. Without it the rule is a comment.

---

### 8 — Document the frontend half of the API contract

**File: `README.md`** — extend the existing `## API conventions` section (added by story 02) with a `### Consuming the API from the frontend` subsection:

1. **The rule:** features call `api.get/post/put/patch/delete/getPage` from `@/shared/lib/api/client`. Never `httpClient` directly, never `fetch`, never a second `axios.create`. Enforced by test 8 above.
2. **Errors:** every failure arrives as `ApiRequestError` with `code`, `status`, `fields`, and `message`. The four client-only codes (`network_error`, `timeout`, `invalid_envelope`, `unknown_error`) are **not** in the backend table above — they are synthesised when there is no envelope to read.
3. **Rendering:** wrap query results in `QueryBoundary`. Do not hand-roll `isPending`/`isError` branches.
4. **Toasts:** mutations toast automatically; queries render inline and opt in with `meta: { toastOnError: true }`. Explain why — a user-initiated action that fails silently reads as success, whereas a toast per query error is noise.
5. **Retries:** transport failures and 5xx retry twice; 4xx never retries.
6. **Query keys:** `[feature, resource, ...discriminators]` via `featureKey`, so a feature's cache can be invalidated as a unit.
7. A pointer to `frontend/src/README.md` for file placement.

No new environment variables — `VITE_API_BASE_URL` already covers this story, so the env tables are unchanged.

---

## Edge Cases & Failure Modes

- **`VITE_API_BASE_URL` pointing at the wrong server.** Trigger: leaving it as `http://localhost:5173` (the Vite dev server), which serves `index.html` with a **200**. Without a shape check the app would treat HTML as data and fail deep inside a component. Handled by `unwrap` throwing `invalid_envelope` with a message naming the variable. Covered by test 3.
- **Trailing-slash redirects.** Trigger: calling `/health` instead of `/health/`. Django's `APPEND_SLASH` answers `301`, Axios follows it, and a `POST` silently becomes a `GET`. Always include the trailing slash in feature URLs. Stated in task 6.
- **Double slash in the URL.** `env.apiBaseUrl` already strips trailing slashes (`config/env.ts` line 17) and feature paths start with `/`, so exactly one slash joins them. Do not "fix" either side.
- **A `204 No Content` body.** The backend renderer returns `b""` for 204, so `response.data` is empty and `unwrap` would throw `invalid_envelope`. Handled by the early return in `api.delete`. Covered by test 3.
- **An HTTP error whose body is not an envelope.** Trigger: a `502` from a future reverse proxy, or an HTML `500` raised outside the `/api/` tree (story 02 documented that the envelope covers `/api/` only). `toApiRequestError` falls back to `unknown_error` with the real status attached, rather than crashing on `body.error.code`. Covered by test 1.
- **Network down vs. server error.** Trigger: backend not running. Axios reports no `response`, so the message must be "Cannot reach the server", not "Something went wrong" — the user's fix is different. Covered by test 1.
- **Retrying a 4xx.** TanStack Query's default retries **3 times on everything**. A 404 or a validation error retried three times wastes a second and confuses logs. `shouldRetry` restricts retries to transport failures and 5xx. Covered by test 4.
- **`error.debug` leaking to users.** `ErrorState` renders the traceback only when `error.debug` exists, which the backend sends only under `DEBUG=True`. Never render it unconditionally and never assume it is present. Covered by test 6.
- **Validation errors with no field.** The backend puts them under `non_field_errors` (`exceptions.py`, `NON_FIELD_KEY`). `ApiRequestError.nonFieldErrors` returns `[]` when absent, so a form never crashes on a missing key. Covered by test 2.
- **Toast fired from outside React.** The QueryClient is built in `useState` inside `AppProviders`, so its `onError` closure cannot use `useToast()`. Handled by the module-level `toastSink` that `ToastProvider` registers on mount. If a query somehow fails before mount the toast is dropped, not thrown — `pushToast` must no-op when no sink is registered.
- **`QueryBoundary` vs. `AppErrorBoundary`.** A query error is data, not a crash; it must render inline and stay retryable. A render-time throw is a crash and must hit the error boundary. Conflating them makes a failed fetch blank the page. Both docstrings say which is which.
- **`isPending` vs. `isLoading`.** TanStack Query v5 renamed v4's `isLoading`; `isLoading` still exists but means "pending **and** fetching", so a disabled or paused query never shows the loading state. Use `isPending`. Covered by test 5.
- **StrictMode double-invocation.** React 19 `StrictMode` mounts effects twice in dev. `useState(() => createQueryClient(...))` creates the client once per mount; a module-level `new QueryClient()` would be shared across HMR reloads and leak cache between edits. Do not hoist it.
- **`erasableSyntaxOnly` rejects `enum`.** Trigger: writing `enum ErrorCode {…}`. Symptom: `error TS1294` at build. Use the `as const` array plus indexed access in `types.ts`. This is why `API_ERROR_CODES` is shaped the way it is.
- **`verbatimModuleSyntax` rejects a value-position type import.** Trigger: `import { AxiosRequestConfig } from 'axios'`. Symptom: `TS1484`. Types need `import type`. Note that `AxiosError` in `errors.ts` is a **value** (used with `instanceof`) and must be a normal import — mixing these up is the most common build break in this story.
- **`noUnusedLocals` fails the build on a stray import.** `npm run build` runs `tsc -b` first, so an unused import is a hard failure, not a warning. Run the build before considering a task done.
- **Enabling `strict` breaks existing code.** Trigger: task 1. `src/config/env.ts` and the deleted demo files are the only pre-existing TypeScript; `env.ts` is already strict-clean (it narrows `typeof value !== 'string'`). If `tsc -b` reports errors after enabling it, fix them — do **not** disable `strict` again.
- **The `@/` alias must be declared twice.** TypeScript `paths` covers typechecking; Vite `resolve.alias` covers bundling; Vitest inherits Vite's. Setting only one gives a build that typechecks but fails at runtime, or vice versa. Both are in task 1.
- **CORS with credentials.** `withCredentials: true` on the Axios instance requires the server to send `Access-Control-Allow-Credentials` and a specific (not wildcard) origin. Story 02 set `CORS_ALLOW_CREDENTIALS=True` and an explicit allow-list, so this works — but a future wildcard origin would silently break every request. Covered by Verification Step 7.
- **Backend not running during `npm run build`.** The build must not need the API. Nothing in this story fetches at module scope, so `npm run build` succeeds with the backend down. Verification Step 4 runs it that way deliberately.

---

## Test Plan

Vitest, added in task 1. The numbered tests are specified in **task 7** above rather than duplicated here; this section states how they run and what else must hold.

- **Unit:** `errors.test.ts`, `queryClient.test.ts`, `queryKeys` (via the client tests) — no DOM, no network.
- **Integration:** `client.test.ts` and `useHealth.test.tsx` — real Axios instance and real interceptor chain, with `axios-mock-adapter` standing in for the transport. These are the tests that prove the envelope contract, so they must exercise `api.*`, never a hand-rolled mock of it.
- **Component:** `QueryBoundary.test.tsx`, `ErrorState.test.tsx` — Testing Library with jsdom.
- **Constraint:** `singleClient.test.ts` — the grep-based guard for "one API client". Runs in Vitest's `node` environment.
- **Backend regression:** `cd backend && python manage.py test` must stay at **54/54**. This story changes no backend file; if that number moves, something was edited that should not have been.

Run with `npm run test` in `frontend/`. Do not add coverage thresholds — FND-4 owns those.

---

## Migration / Rollback

**No schema, no data, no backend change.** This story is additive on the frontend plus the deletion of the Vite demo files.

**Rollback:** revert the commit. `npm install` must be re-run afterwards because `package.json` and `package-lock.json` change together; a reverted lockfile with a stale `node_modules` produces "Cannot find module '@tanstack/react-query'" at dev-server start.

**What could go wrong on a half-applied state.** The dangerous ordering is deleting `src/App.tsx` before `src/app/router.tsx` and its route components exist — `main.tsx` then imports a missing module and the dev server fails to boot with a resolution error that looks like a broken alias. Do tasks 3–6 before the deletions in task 5, and keep `npm run build` green as you go.

The second trap is enabling `strict` and the `@/` alias in task 1 while the rest of the story is unwritten: `tsc -b` will pass (there is almost nothing to check yet), so a build failure that appears three tasks later is really a task-1 misconfiguration. If `@/…` imports fail to resolve, check **both** `tsconfig.app.json` `paths` and `vite.config.ts` `resolve.alias` before suspecting the import.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build` — exits 0. This runs `tsc -b` first, so it proves `strict`, both alias declarations, and every `import type` are correct.
2. **Lint clean:** from `frontend/` — `npm run lint` — oxlint reports no errors (`react/rules-of-hooks` in particular).
3. **Frontend tests pass:** from `frontend/` — `npm run test` — all tests from task 7 green, including the single-client constraint test.
4. **Build does not need the API:** stop the backend, re-run `npm run build` — still exits 0. Nothing fetches at module scope.
5. **End-to-end, backend up:** start the backend (`python manage.py runserver`) and `npm run dev`. Open <http://localhost:5173/>. The health page shows **`status: ok`** and **`database: ok`**, and the console logs `[SupportOS] API base URL: http://localhost:8000/api`.
6. **Network tab shows one request to the right URL:** `GET http://localhost:8000/api/health/` → `200`, response body `{"success":true,"data":{"status":"ok","database":"ok"},"error":null,"meta":null}`.
7. **CORS with credentials works from the browser**, not just curl: the request in step 6 succeeds with no CORS error in the console. This is what `withCredentials: true` plus story 02's explicit allow-list buys.
8. **Transport failure renders, not crashes:** stop the backend, reload the page. The health page shows the error state with "Cannot reach the server…" and a retry control. Restart the backend, click retry, and the page recovers **without a reload**.
9. **Envelope mismatch is caught:** temporarily set `VITE_API_BASE_URL=http://localhost:5173` in `frontend/.env`, restart the dev server, reload. The error state reads "The server returned an unexpected response. Check VITE_API_BASE_URL…". **Restore the value afterwards.**
10. **Route boundaries work:** open <http://localhost:5173/nope>. The not-found page renders inside the layout — the app does not blank out.
11. **Backend regression:** from `backend/` — `python manage.py test` — still 54/54.

---

## Done Criteria

- [ ] `frontend/src/` has `app/`, `features/health/{api,components,types}`, `shared/{ui,lib/api,hooks}`, `config/`, and `test/`; no top-level `components/` or `utils/`.
- [ ] `frontend/src/README.md` documents the placement rule, the no-cross-feature-import rule, the reserved `shared/i18n/` directory, and UI-1's props-stable takeover of `shared/ui/`.
- [ ] Exactly **one** `axios.create` in the repo, in `src/shared/lib/api/client.ts`; no `fetch(` under `src/features/`; `import.meta.env` read only in `config/env.ts`, `main.tsx`, and `app/providers.tsx` — all asserted by a test.
- [ ] `src/shared/lib/api/types.ts` mirrors story 02's envelope with snake_case wire keys and no `enum`.
- [ ] Every failure — envelope error, non-envelope HTTP error, network failure, timeout, malformed 200 — reaches the caller as an `ApiRequestError` with `code`, `status`, `fields`, `message`.
- [ ] Retries: transport failures and 5xx retry twice; 4xx never retries.
- [ ] `QueryBoundary` is the only place `isPending`/`isError` is branched on; `Loading`, `Empty`, `ErrorState` are reused, not reimplemented.
- [ ] Mutations toast on error automatically; queries render inline and opt in via `meta.toastOnError`.
- [ ] `error.debug` renders only when present, and never unconditionally.
- [ ] `AppErrorBoundary` catches render crashes; route-level `errorElement` catches route crashes; neither is used for query errors.
- [ ] React Router serves `/` (health) and `*` (not found) with `errorElement` boundaries.
- [ ] The `health` feature reaches the backend through `api.get` only — no `axios`, no `fetch` in the feature.
- [ ] The Vite demo is gone: `App.tsx`, `App.css`, and `src/assets/` deleted; `index.css` is a minimal reset.
- [ ] `strict: true` is set and `npm run build` passes with it.
- [ ] `README.md` § API conventions documents the frontend rules, including the four client-only error codes.
- [ ] `npm run build`, `npm run lint`, and `npm run test` all pass (Verification Steps 1–3).
- [ ] The browser shows `status: ok` / `database: ok` against the running backend, and recovers from a backend restart via retry without a page reload (Verification Steps 5 and 8).
- [ ] `python manage.py test` is still 54/54 — no backend file changed.
- [ ] `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 04 (FND-4 — Codebase Conventions & Foundation Spec).**
