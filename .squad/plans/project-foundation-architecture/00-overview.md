# project-foundation-architecture — plan overview

Entry point for the **project-foundation-architecture** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md) | Repository & Local Dev Bootstrap | SUPPORTOS-2 | — |
| 02 | [02-story-backend-foundation-drf-SUPPORTOS-3.md](02-story-backend-foundation-drf-SUPPORTOS-3.md) | Backend Foundation (Django + DRF) | SUPPORTOS-3 | Story 01 |
| 03 | [03-story-frontend-foundation-SUPPORTOS-4.md](03-story-frontend-foundation-SUPPORTOS-4.md) | Frontend Foundation (React + Vite + TS) | SUPPORTOS-4 | Stories 01, 02 |

## Dependency notes

This feature maps to **EPIC 0 — Project Foundation & Architecture** in `SupportOs backlog.MD` (lines 35–139). Everything in every other epic depends on it, so the stories are strictly sequential:

`FND-1` (story 01) → `FND-2` → `FND-3` → `FND-4`

**Shared specs produced here** (referenced by ID from every later story — later stories must **not** re-implement them):

| Spec | Established by | What it fixes |
|---|---|---|
| `ARCH` (scaffold) | Story 01 | Monorepo shape: `backend/` (Django) + `frontend/` (React/Vite). |
| `ARCH` (backend half) | Story 02 | Domain apps under `backend/apps/` — one app per business area, never per technical layer. Placement rule written down in `backend/apps/README.md`. |
| `ARCH` (frontend half) | Story 03 | Feature-based layout: `src/features/<feature>/{api,components,types}`, `src/shared/{ui,lib,hooks}`, `src/app`. Placement rule in `frontend/src/README.md`. |
| `ENV` | Story 01 | Config strategy: backend settings split `base`/`dev`/`prod` reading env via `django-environ`; `backend/.env.example` + `frontend/.env.example` as the committed contract; local PostgreSQL is the default and **Docker is never required**. |
| `API` (backend half) | Story 02 | The response envelope `{success, data, error, meta}`, enforced by a renderer plus a global exception handler; error-code → HTTP-status table; pagination under `meta.pagination`. |
| `API` (frontend half) | Story 03 | One Axios instance + one QueryClient in `src/shared/lib/api/`; the envelope mirrored in TypeScript; every failure normalised to `ApiRequestError`. |
| `CONV` | FND-4 | Not yet planned. Owns lint/format conventions and coverage gates. Stories 01–03 avoid ruff, black, pytest, ESLint, and Prettier; story 03 does add **vitest**, which stories 01 and 02 both deferred to it by name. |

**Cross-story contracts set by story 01:**

- `frontend/src/config/env.ts` is the **only** module that reads `import.meta.env`. FND-3's Axios instance must import `env.apiBaseUrl` from it rather than reading `import.meta.env` directly.
- `JWT_SIGNING_KEY`, `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, and `JWT_REFRESH_TOKEN_LIFETIME_DAYS` are staged in `backend/config/settings/base.py` so **AUTH-1** adds `djangorestframework-simplejwt` and a `SIMPLE_JWT` mapping without introducing new config plumbing.
- Branches: `main` (stable) and `develop` (integration); feature work branches off `develop`.

**Cross-story contracts set by story 02:**

- The envelope `{success, data, error, meta}` is the API's only response shape. Views **return plain payloads** — `apps.core.renderers.EnvelopeJSONRenderer` wraps successes and `apps.core.exceptions.envelope_exception_handler` wraps failures. No story may introduce a per-feature error format.
- `apps.core` is the only home for cross-cutting backend utilities; `apps.core.models.TimeStampedModel` is the abstract base for every domain model.
- `backend/config/api_urls.py` is the single extension point for the `/api/` tree — one `include()` line per app that exposes endpoints.
- **Open security follow-up:** story 02 leaves `DEFAULT_PERMISSION_CLASSES = AllowAny` and no authentication classes. Any story adding an endpoint before **AUTH-2** must set `permission_classes` explicitly on that view; AUTH-2 owns flipping the global default to `IsAuthenticated` and auditing every view.

**Known open item carried from story 01:** its Verification Step 3 (`migrate` against local PostgreSQL) is unverified — PostgreSQL 17 is running, but the `supportos` role and database have not been created. Story 02's DB-touching tests are blocked until README § 2 is run.

**Cross-story contracts set by story 03:**

- **One** Axios instance (`frontend/src/shared/lib/api/client.ts`) and **one** QueryClient. Features call `api.get/post/put/patch/delete/getPage` — never `httpClient`, never `fetch`, never a second `axios.create`. A test greps `src/` to enforce it.
- Every network failure reaches callers as `ApiRequestError` (`code`, `status`, `fields`, `message`), including four client-only codes the backend never sends: `network_error`, `timeout`, `invalid_envelope`, `unknown_error`.
- `QueryBoundary` is the only place a query's `isPending`/`isError` is branched on. `Loading`, `Empty`, and `ErrorState` are reused, never reimplemented per feature.
- `setAuthTokenProvider` in `client.ts` is the seam **AUTH-1** fills; `setToastSink`/`pushToast` is the seam that lets the QueryClient toast from outside React.
- **UI-1** replaces the internals of `src/shared/ui/` with shadcn primitives **without changing their props**, so features written against them today keep working.
- `src/shared/i18n/` is reserved for **I18N-1** and deliberately not created.
