# project-foundation-architecture — plan overview

Entry point for the **project-foundation-architecture** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md) | Repository & Local Dev Bootstrap | SUPPORTOS-2 | — |
| 02 | [02-story-backend-foundation-drf-SUPPORTOS-3.md](02-story-backend-foundation-drf-SUPPORTOS-3.md) | Backend Foundation (Django + DRF) | SUPPORTOS-3 | Story 01 |
| 03 | [03-story-frontend-foundation-SUPPORTOS-4.md](03-story-frontend-foundation-SUPPORTOS-4.md) | Frontend Foundation (React + Vite + TS) | SUPPORTOS-4 | Stories 01, 02 |
| 04 | [04-story-codebase-conventions-SUPPORTOS-5.md](04-story-codebase-conventions-SUPPORTOS-5.md) | Codebase Conventions & Foundation Spec | SUPPORTOS-5 | Stories 01, 02, 03 |

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
| `CONV` | Story 04 | `CONVENTIONS.md` at the repo root — the single, reference-based source of truth. Also lands the logging strategy, ruff (backend), Prettier + extended oxlint (frontend), a pre-commit hook, and a GitHub Actions lint job. |

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

**Cross-story contracts set by story 04:**

- `CONVENTIONS.md` is the single source of truth every later task **cites** rather than re-derives. It is deliberately reference-based: it links to `backend/apps/README.md`, `frontend/src/README.md`, and `README.md` § API conventions instead of restating them. If the code and `CONVENTIONS.md` disagree, **the code wins** and the document is fixed in the same PR.
- Line length is **100** for both apps — `line-length` in `backend/pyproject.toml`, `printWidth` in `frontend/.prettierrc.json`. Both were measured against the real tree to reflow ~1 line total.
- The no-cross-feature-import rule from story 03 is now **enforced by the linter**, not by review: `no-restricted-imports` in `.oxlintrc.json` with an `**/app/**` override. oxlint override globs **must** be `**/`-prefixed — `src/app/*` silently does nothing.
- Logging: backend code uses `logging.getLogger(__name__)` and never `print()`; frontend code uses `logger` from `@/shared/lib/logger` and never bare `console.*`. `logger.ts` is the fourth and final sanctioned `import.meta.env` read site.
- CI (`.github/workflows/lint.yml`) is the real style gate — `core.hooksPath` is per-clone and git will not let a repo configure its own hooks path.

**Deliberate deviations from the SUPPORTOS-5 intake, each a single-file revert:** oxlint kept instead of adding ESLint (verified it enforces the import boundary); `ruff format` instead of Black (one tool covers format + lint + isort); a committed `.githooks/` script instead of the `pre-commit` framework (whose executable must be on `PATH`, which `backend/.venv` does not guarantee).

**Verified gap this story closes:** with `LOGGING` unset, `settings.LOGGING` is `{}`, the `apps.core.exceptions` logger has **no handlers**, and story 02's `logger.exception` for unhandled 500s reaches stderr only via Python's `lastResort` fallback — no timestamp, no level, no logger name, and everything below `WARNING` silently dropped.

**Note on testing:** per standing project policy this project authors no automated tests. Story 03's planned Vitest setup was removed, and story 04 adds no test step to CI. The 54 backend tests from stories 01–02 predate the policy and are kept but not extended.
