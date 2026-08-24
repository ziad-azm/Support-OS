# project-foundation-architecture — plan overview

Entry point for the **project-foundation-architecture** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md) | Repository & Local Dev Bootstrap | SUPPORTOS-2 | — |

## Dependency notes

This feature maps to **EPIC 0 — Project Foundation & Architecture** in `SupportOs backlog.MD` (lines 35–139). Everything in every other epic depends on it, so the stories are strictly sequential:

`FND-1` (story 01) → `FND-2` → `FND-3` → `FND-4`

**Shared specs produced here** (referenced by ID from every later story — later stories must **not** re-implement them):

| Spec | Established by | What it fixes |
|---|---|---|
| `ARCH` (scaffold) | Story 01 | Monorepo shape: `backend/` (Django) + `frontend/` (React/Vite). Backend domain-app layout and frontend feature layout are filled in by FND-2 and FND-3. |
| `ENV` | Story 01 | Config strategy: backend settings split `base`/`dev`/`prod` reading env via `django-environ`; `backend/.env.example` + `frontend/.env.example` as the committed contract; local PostgreSQL is the default and **Docker is never required**. |
| `API` | FND-2 (backend envelope) + FND-3 (Axios/TanStack Query) | Not yet planned. |
| `CONV` | FND-4 | Not yet planned. Owns lint/format/test-runner conventions, so story 01 deliberately avoids adding ruff, black, pytest, or vitest. |

**Cross-story contracts set by story 01:**

- `frontend/src/config/env.ts` is the **only** module that reads `import.meta.env`. FND-3's Axios instance must import `env.apiBaseUrl` from it rather than reading `import.meta.env` directly.
- `JWT_SIGNING_KEY`, `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, and `JWT_REFRESH_TOKEN_LIFETIME_DAYS` are staged in `backend/config/settings/base.py` so **AUTH-1** adds `djangorestframework-simplejwt` and a `SIMPLE_JWT` mapping without introducing new config plumbing.
- Branches: `main` (stable) and `develop` (integration); feature work branches off `develop`.
