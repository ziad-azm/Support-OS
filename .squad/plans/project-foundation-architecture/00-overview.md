# project-foundation-architecture — plan overview

Entry point for the **project-foundation-architecture** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md) | Repository & Local Dev Bootstrap | SUPPORTOS-2 | — |
| 02 | [02-story-backend-foundation-drf-SUPPORTOS-3.md](02-story-backend-foundation-drf-SUPPORTOS-3.md) | Backend Foundation (Django + DRF) | SUPPORTOS-3 | Story 01 |

## Dependency notes

This feature maps to **EPIC 0 — Project Foundation & Architecture** in `SupportOs backlog.MD` (lines 35–139). Everything in every other epic depends on it, so the stories are strictly sequential:

`FND-1` (story 01) → `FND-2` → `FND-3` → `FND-4`

**Shared specs produced here** (referenced by ID from every later story — later stories must **not** re-implement them):

| Spec | Established by | What it fixes |
|---|---|---|
| `ARCH` (scaffold) | Story 01 | Monorepo shape: `backend/` (Django) + `frontend/` (React/Vite). |
| `ARCH` (backend half) | Story 02 | Domain apps under `backend/apps/` — one app per business area, never per technical layer. Placement rule written down in `backend/apps/README.md`. |
| `ENV` | Story 01 | Config strategy: backend settings split `base`/`dev`/`prod` reading env via `django-environ`; `backend/.env.example` + `frontend/.env.example` as the committed contract; local PostgreSQL is the default and **Docker is never required**. |
| `API` (backend half) | Story 02 | The response envelope `{success, data, error, meta}`, enforced by a renderer plus a global exception handler; error-code → HTTP-status table; pagination under `meta.pagination`. |
| `API` (frontend half) | FND-3 | Not yet planned. Axios instance + TanStack Query, typed against story 02's envelope. |
| `CONV` | FND-4 | Not yet planned. Owns lint/format/test-runner conventions, so stories 01 and 02 deliberately avoid adding ruff, black, pytest, or vitest. |

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
