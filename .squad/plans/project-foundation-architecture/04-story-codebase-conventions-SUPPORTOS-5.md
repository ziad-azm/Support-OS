# Story 04 — Codebase Conventions & Foundation Spec (Story: SUPPORTOS-5)

## Prerequisites

- **Story 01 completed:** [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md) — the `ENV` contract and the root `README.md` this story references.
- **Story 02 completed:** [02-story-backend-foundation-drf-SUPPORTOS-3.md](02-story-backend-foundation-drf-SUPPORTOS-3.md) — `backend/apps/README.md` (the `ARCH` backend half) and the response envelope.
- **Story 03 completed:** [03-story-frontend-foundation-SUPPORTOS-4.md](03-story-frontend-foundation-SUPPORTOS-4.md) — `frontend/src/README.md` (the `ARCH` frontend half) and the single API layer.
- This is the **last** story in EPIC 0. It writes down what stories 01–03 built; it does not add features. If a rule below contradicts the code, the code is right and the rule is a bug in this story.
- Verified repository state: branch `develop`, remote `origin` → `https://github.com/ziad-azm/Support-OS.git` (so the CI job in task 6 will actually run). No `.github/` directory yet. No root `package.json` — the repo is polyglot with two independent app roots.
- Verified tooling baseline: backend has **no** lint or format tooling (`backend/requirements.txt` is 5 runtime deps, lines 3–7). Frontend has **oxlint 1.79** already configured and passing (`frontend/.oxlintrc.json`), and **no** formatter.

---

## Story Goal

Produce the `CONV` spec — one document every later task cites instead of re-deriving standards — and make the mechanical half of it enforced automatically rather than remembered.

1. `CONVENTIONS.md` at the repo root: the single source of truth, **reference-based**. It links to `backend/apps/README.md`, `frontend/src/README.md`, and `README.md` § API conventions rather than restating them.
2. A real logging strategy for both apps, replacing the current accidental one (see the verified finding below).
3. Formatting and linting configured for both apps, with the import rules from stories 02–03 enforced by the linter instead of by review.
4. A pre-commit hook and a GitHub Actions job that run those checks on every commit and every push.

**Three deliberate deviations from the intake's literal wording.** Each is stated here rather than buried, and each is a single-file revert if you disagree:

- **The intake says "ESLint + Prettier (frontend)". This plan keeps oxlint and adds Prettier only.** The intake's actual *constraint* is "enforce CONV import/naming rules automatically", and I verified oxlint can do exactly that: `no-restricted-imports` with a `patterns` group correctly flags `src/app/router.tsx:15` importing `@/features/health/…`, and an `overrides` entry exempts it. Adding ESLint alongside oxlint means six more dependencies, a second flat config, and two linters with overlapping rule sets. Prettier is still added because oxlint does not format.
- **The intake says "Black + Ruff/isort (backend)". This plan uses `ruff format` + `ruff check` only.** `ruff format` is a Black-compatible formatter and `ruff check --select I` replaces isort, so one tool and one config file cover all three roles. If you want Black specifically, add `black>=24` to `backend/requirements-dev.txt` and swap `ruff format` for `black` in tasks 4–6; nothing else changes.
- **The intake says "pre-commit hooks". This plan uses `core.hooksPath` with a committed `.githooks/pre-commit` script, not the `pre-commit` framework.** The framework's git hook shells out to a `pre-commit` executable that must be on `PATH`; installed into `backend/.venv` it is only on `PATH` while that venv is active, so commits from a plain terminal would fail. A committed shell script calling the tools by their in-project paths has no such trap, needs no extra global install, and is version-controlled. The framework remains a reasonable alternative if you later want per-file staging and auto-fix restaging.

**Explicitly out of scope:**

- **Automated tests of any kind.** Per standing project policy, this story writes no test files, adds no test runner, and adds no test step to CI. The 54 backend tests committed in stories 01–02 predate that policy and are **left alone**. See the `## Test Plan` section, which records this rather than pretending otherwise.
- **Type-aware linting.** `oxlint-tsgolint` and `"typeAware": true` are a measurable slowdown and a separate decision; `tsc -b` in `npm run build` already provides full type checking.
- **`FORM`, `UI`, `AUTHZ`, and `I18N` conventions as *content*.** Those specs do not exist yet (FORM-1, UI-1, AUTH-1/2, I18N-1). `CONVENTIONS.md` gets a forward-reference placeholder for each, not invented rules.
- **Dependency pinning / lockfile strategy beyond stating the policy.** `backend/requirements.txt` line 1 defers the lockfile choice to this story; task 1 records the policy in prose. Introducing `pip-tools`, `uv`, or a hash-pinned lockfile is not in this story.
- **A `docs/` site, ADRs, or a CHANGELOG.**

---

## Context — Read These Files First

1. `.squad/stories/project-foundation-architecture/SUPPORTOS-5/intake.md` — the source story. **No attachments, no acceptance criteria.** Read the two task blocks in the fenced **Description**. Note that this intake's CONV task list does **not** include "testing conventions" — the tracker item and `SupportOs backlog.MD` were both edited to remove it. Do not reintroduce it as testing *scope*; task 1 only records the no-automated-tests policy as a fact a new developer needs.
2. `backend/apps/README.md` — all 93 lines, headings at lines 6, 13, 29, 46, 56, 73, 89. This is the backend half of `ARCH`. `CONVENTIONS.md` **links** to it; do not copy its content.
3. `frontend/src/README.md` — all 73 lines, headings at lines 6, 12, 24, 30, 35, 40, 48, 53, 69. The frontend half of `ARCH`. **Line 48 starts a `## src/test/` section describing a directory that no longer exists** — story 03's test infrastructure was removed. Task 7 deletes that section.
4. `README.md` — § **API conventions** (line 233) through § **Consuming the API from the frontend**, and § **Environment variables** (line ~334). `CONVENTIONS.md` links here for the envelope, error codes, retry policy, and env contract.
5. `backend/config/settings/base.py` — read `DEBUG`/`ALLOWED_HOSTS` (lines 26–27) and the tail of the file where `REST_FRAMEWORK` ends. Task 2 appends a `LOGGING` block. Note line 156 is 92 characters — the longest line in the backend, which is why task 4 sets `line-length = 100` rather than 88.
6. `backend/apps/core/exceptions.py` — line 17 `logger = logging.getLogger(__name__)` and `_internal_error_response` (~lines 96–115), which calls `logger.exception(...)` for every unhandled 500. This is the code task 2's logging config exists to serve.
7. `frontend/.oxlintrc.json` — all 9 lines. Two rules today (`react/rules-of-hooks`, `react/only-export-components`). Task 3 extends it.
8. `frontend/src/main.tsx` line 11 and `frontend/src/shared/ui/AppErrorBoundary.tsx` line 20 — the only two direct `console.*` calls in the frontend. Task 2 routes both through the new logger.
9. Grep for `CONV` across `.squad/plans/` and both app `README.md` files before writing task 1 — stories 02 and 03 both promise that "`CONV` (FND-4) references this file rather than restating it". Task 1 must honour that promise, not invert it.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Concise and reference-based**; later tasks link to CONV rather than repeating rules. | Intake, CONV task constraints | `CONVENTIONS.md` links to the three existing docs for anything already written down. A section that restates `backend/apps/README.md` is a defect. |
| A **single source of truth** every task cites. | Intake, CONV task outcome | One file, at the repo root, linked from `README.md`. |
| Lint **enforces CONV import/naming rules automatically**. | Intake, lint task constraints | `no-restricted-imports` in `.oxlintrc.json` enforces the no-cross-feature-import rule from `frontend/src/README.md` line 24. `ruff` `I`/`N` rule sets enforce backend import order and naming. |
| **Consistent style enforced on every commit.** | Intake, lint task outcome | `.githooks/pre-commit` + the GitHub Actions job in task 6. |
| No secrets committed; config from `ENV`. | Story 01 `ENV` contract | Unchanged. Task 2 adds `DJANGO_LOG_LEVEL` and `VITE_LOG_LEVEL` through the same contract, `.env.example` and README table together. |

---

## Implementation tasks

### 1 — Author `CONVENTIONS.md` (the `CONV` spec)

**Create file: `CONVENTIONS.md`** (repo root)

The constraint that governs every line of this file: **reference, do not restate.** Stories 02 and 03 already wrote the placement rules down, and both promise CONV will link rather than duplicate. A CONV that copies them creates two sources of truth that drift.

Open with a one-paragraph statement of what the document is and the rule for using it: *cite `CONVENTIONS.md` §<section> instead of re-deriving a standard; if the code and this document disagree, the code wins and this document gets fixed in the same PR.*

Sections, in this order, matching the intake's list:

1. **`## 0. Before you write new code`** — put this first, not last, because it is the highest-leverage rule. State it as a checklist: search for an existing implementation (`grep` the symbol, check `src/shared/` and `backend/apps/core/`); read the relevant `README.md` and the shared spec it points to; extend rather than duplicate; only then write. Name the two shared homes explicitly so the search has an address.
2. **`## 1. Folder structure & file placement`** — three sentences plus links to `backend/apps/README.md` and `frontend/src/README.md`. Nothing else.
3. **`## 2. Naming conventions`** — new content, and the one place naming is defined:
   - Python: `snake_case` modules and functions, `PascalCase` classes, `UPPER_SNAKE` constants, app labels singular-or-plural matching the domain word already chosen in `backend/apps/README.md` § The apps.
   - TypeScript: `PascalCase` for components and types, `camelCase` for functions/variables, `UPPER_SNAKE` for module constants.
   - Files: React components `PascalCase.tsx`, everything else `camelCase.ts`. Hooks start with `use`. Backend modules `snake_case.py`.
   - No abbreviations that are not already in the domain vocabulary (`sla` is fine; `cust` is not).
4. **`## 3. TypeScript conventions`** — the three tsconfig facts that are non-obvious and bite, verified in `frontend/tsconfig.app.json`: `strict` is on; `erasableSyntaxOnly` forbids `enum`, parameter properties, and namespaces (use `as const` arrays plus indexed access — point at `frontend/src/shared/lib/api/types.ts` as the worked example); `verbatimModuleSyntax` requires `import type` for type-only imports, and a value used with `instanceof` is **not** type-only. Add: named exports only, no default exports, so a symbol has one name everywhere.
5. **`## 4. API communication`** — link to `README.md` § API conventions and § Consuming the API from the frontend. State only the two rules that are easy to break: backend views return plain payloads and never build an envelope; frontend features call `api.*` and never `httpClient`, `fetch`, or a second `axios.create`.
6. **`## 5. Error, loading & empty states`** — link to `frontend/src/shared/ui/QueryBoundary.tsx`. One rule: never hand-roll an `isPending`/`isError` branch in a feature.
7. **`## 6. Validation`** — a forward-reference stub: *`FORM` is defined by FORM-1 (React Hook Form + Zod). Until then, no forms exist. Do not introduce a second validation approach.*
8. **`## 7. Reusable components`** — a forward-reference stub to `UI` (UI-1), plus the live rule from story 03: `src/shared/ui/` components keep their props when UI-1 rebuilds their internals on shadcn, so build against them now.
9. **`## 8. Shared utilities`** — the stop-at-first-match placement list, by reference to the two `README.md` files. State the asymmetry that makes the rule cheap to follow: moving code *into* `shared` later is easy, untangling `shared` is not, so default to keeping it in the feature.
10. **`## 9. Environment & config`** — link to `README.md` § Environment variables. Two rules: every new variable lands in `.env.example` **and** the README table in the same commit; the frontend reads `import.meta.env` only in `frontend/src/config/env.ts`.
11. **`## 10. Logging`** — the strategy task 2 implements. Backend: module-level `logging.getLogger(__name__)`, never `print()`; levels defined (DEBUG local detail, INFO lifecycle, WARNING recoverable, ERROR needs attention, CRITICAL data loss); never log secrets, tokens, passwords, or full request bodies. Frontend: `logger` from `@/shared/lib/logger`, never bare `console.*`; `debug`/`info` are stripped outside dev.
12. **`## 11. API response conventions`** — link to `README.md` § API conventions. Do not restate the envelope shape; state that it is the only response shape and that `snake_case` wire keys are deliberate.
13. **`## 12. Frontend/backend boundaries`** — new content, the rules that prevent slow drift: the backend owns validation and authorization (the frontend's copy is UX, never the enforcement point); wire format is `snake_case` and is not renamed in transit; the frontend never constructs a URL from a hardcoded host — it uses `env.apiBaseUrl`; a new endpoint is documented in `backend/config/api_urls.py` and consumed through a feature's `api/` folder, never inline in a component.
14. **`## 13. Auth conventions`** — forward-reference stub to `AUTHZ` (AUTH-1/AUTH-2), plus the two live seams so nobody reinvents them: `setAuthTokenProvider` in `frontend/src/shared/lib/api/client.ts` and the `JWT_*` env variables already staged in `backend/config/settings/base.py`. **Include the open security note:** `DEFAULT_PERMISSION_CLASSES` is `AllowAny` until AUTH-2, so any endpoint added before then must set `permission_classes` explicitly on its own view.
15. **`## 14. Linting & formatting`** — the commands from tasks 3–6 and the line-length decision (100 for both apps). One rule: formatting is never a review comment; if the hook passed, the formatting is correct by definition.
16. **`## 15. Import conventions`** — `@/` for cross-area frontend imports, relative for within-feature; import order (stdlib / third-party / first-party / relative) enforced by ruff `I` and Prettier's ordering left alone; no deep imports into another feature; no circular imports between `shared/` modules.
17. **`## 16. Verification (this project does not author automated tests)`** — the honest record, in three sentences: this project does not write automated tests; changes are verified by running the commands in `README.md` and driving the app; the 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate that policy and are kept but not extended. A new developer will ask where the tests are, and CONV is where that question gets answered.
18. **`## 17. Dependencies`** — closes the promise made in `backend/requirements.txt` line 1: range pins (`>=x,<y`) for the backend with no lockfile; `package-lock.json` committed for the frontend; adding a dependency requires checking whether an existing one already does the job (rule §0).

**File: `README.md`** — add a link to `CONVENTIONS.md` in § Repository layout's tree and one line under the intro pointing new contributors at it.

---

### 2 — Logging strategy for both apps

**The gap this closes, verified rather than assumed.** With `DJANGO_SETTINGS_MODULE=config.settings.prod`, `settings.LOGGING` is `{}`, the `apps.core.exceptions` logger has **no handlers**, the root logger has **no handlers**, and the effective level is `WARNING`. Story 02's `logger.exception(...)` for unhandled 500s therefore reaches stderr only through Python's `lastResort` fallback: no timestamp, no level, no logger name, and **anything below `WARNING` is silently discarded**. That is not a logging strategy; it is a default nobody chose.

**File: `backend/config/settings/base.py`**

Append after the `REST_FRAMEWORK` block:

```python
# --- Logging -------------------------------------------------------------
# Without this, `apps.*` loggers have no handler and fall through to Python's
# lastResort handler: WARNING+ only, no timestamp, no level, no logger name.
DJANGO_LOG_LEVEL = env("DJANGO_LOG_LEVEL", default="INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        # Our own code. `apps.core.exceptions` logs every unhandled 500 here.
        "apps": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # 4xx/5xx raised by Django itself; ERROR keeps normal 404 noise out.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
```

`disable_existing_loggers: False` is required — `True` would silence loggers already created at import time, including `apps.core.exceptions`'s module-level one.

**File: `backend/.env.example`** — add `DJANGO_LOG_LEVEL=INFO` to the existing `# --- API / CORS ---` block or a new `# --- Logging ---` block.

**Create file: `frontend/src/shared/lib/logger.ts`**

```ts
/**
 * The only sanctioned console access in the app. `debug` and `info` are
 * stripped outside dev so production consoles stay readable; `warn` and
 * `error` always emit.
 *
 * Not a logging service — when one is added it goes behind this module, and
 * no call site changes.
 */
const PREFIX = '[SupportOS]'

const isDev = import.meta.env.DEV

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) console.debug(PREFIX, ...args)
  },
  info(...args: unknown[]): void {
    if (isDev) console.info(PREFIX, ...args)
  },
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args)
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args)
  },
}
```

This adds a third sanctioned `import.meta.env` read site. Story 03's rule listed exactly three files (`config/env.ts`, `main.tsx`, `app/providers.tsx`); update that list in `frontend/src/README.md` (task 7) and in `CONVENTIONS.md` §9 to include `shared/lib/logger.ts`. Leaving it stale would make the doc wrong on its first day.

**File: `frontend/src/main.tsx`** — replace the `console.info` on line 11 with `logger.info('API base URL:', env.apiBaseUrl)` and drop the `import.meta.env.DEV` guard, which `logger.info` now owns. Keep the `import { env }` line; the log is the reason it is there.

**File: `frontend/src/shared/ui/AppErrorBoundary.tsx`** — replace the `console.error` on line 20 with `logger.error('Unhandled render error:', error, info.componentStack)`. Drop the now-duplicated `[SupportOS]` string literal — the logger adds the prefix.

---

### 3 — Frontend linting and formatting

**File: `frontend/.oxlintrc.json`**

Replace with the config below. The `no-restricted-imports` rule and the `**/app/**` override are the mechanical enforcement of `frontend/src/README.md` § "A feature never imports from another feature".

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc", "import"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }],
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["@/features/*", "@/features/*/**"],
            "message": "A feature must not import from another feature, and must use relative paths within itself. Move shared code to src/shared/. See CONVENTIONS.md §15."
          }
        ]
      }
    ],
    "no-console": "error",
    "eqeqeq": "error",
    "no-var": "error",
    "import/no-duplicates": "error"
  },
  "overrides": [
    {
      "files": ["**/app/**"],
      "rules": {
        "no-restricted-imports": "off"
      }
    },
    {
      "files": ["**/shared/lib/logger.ts"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

**Two verified facts that make or break this file:**

- **Override globs must be `**/`-prefixed.** I tested all four shapes against the real tree: `**/app/**` suppresses the violation, `**/router.tsx` suppresses it, and **`src/app/*` and `app/**` silently do not** — oxlint reports the error as if no override existed. Use `**/app/**`. Do not "tidy" it to `src/app/**`.
- **`no-console: "error"` will fail on the two existing call sites** in `main.tsx` and `AppErrorBoundary.tsx` until task 2 has replaced them, and on `logger.ts` itself forever without the second override. Do task 2 before task 3, or the lint run blocks you.

`no-restricted-imports` also forbids a feature importing *its own* files via `@/features/health/…`, which is intended: within a feature, imports are relative. `frontend/src/features/health/components/HealthPage.tsx` already does this correctly (`import { useHealth } from '../api/useHealth'`).

**Install Prettier.** From `frontend/`:

```powershell
npm install -D prettier
```

**Create file: `frontend/.prettierrc.json`**

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "arrowParens": "always"
}
```

These are not defaults — they are the style the codebase already has, measured. The existing files use **no semicolons and single quotes**, so Prettier's defaults (`semi: true`, double quotes) would reformat every line of every file and bury this story's real diff. `printWidth: 100` was chosen against the actual data: only 3 lines in `frontend/src/` exceed 90 characters and the longest is 96, so at 100 **nothing reflows**.

**Create file: `frontend/.prettierignore`**

```text
dist
node_modules
package-lock.json
```

**File: `frontend/package.json`** — add:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

Run `npm run format` once. Then `npm run lint` and `npm run build` must both still pass.

---

### 4 — Backend linting and formatting

**Create file: `backend/requirements-dev.txt`**

```text
# Dev-only tooling. Runtime deps live in requirements.txt.
-r requirements.txt
ruff>=0.8,<1
```

Story 01 deliberately shipped a single `requirements.txt` because there was no dev tooling to separate. There is now, and a production install must not pull a linter.

**Create file: `backend/pyproject.toml`**

```toml
# Ruff serves as formatter (Black-compatible), linter, and import sorter.
# See CONVENTIONS.md §14.

[tool.ruff]
line-length = 100
target-version = "py312"
extend-exclude = [".venv", "**/migrations/*"]

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "F",   # pyflakes
    "I",   # isort — import order, enforcing CONVENTIONS.md §15
    "N",   # pep8-naming — enforcing CONVENTIONS.md §2
    "UP",  # pyupgrade
    "B",   # flake8-bugbear
    "DJ",  # flake8-django
]

[tool.ruff.lint.isort]
known-first-party = ["apps", "config"]

[tool.ruff.lint.per-file-ignores]
# Settings modules re-export via star imports by design.
"config/settings/dev.py" = ["F403", "F405"]
"config/settings/prod.py" = ["F403", "F405"]
```

`line-length = 100`, not Black's 88, measured against the real tree: **11 backend lines exceed 88 but only 1 exceeds 100** (`backend/apps/core/tests/test_exceptions.py:46`, at 101 characters). 100 keeps this story's diff to a single line instead of eleven, and matches the frontend's `printWidth` so CONV states one number for both apps.

`**/migrations/*` is excluded because Django generates those files and reformatting them creates noise on every `makemigrations`.

**Install and run.** From `backend/` with the venv active:

```powershell
pip install -r requirements-dev.txt
ruff format .
ruff check --fix .
ruff check .
```

Then confirm nothing broke: `python manage.py check` and `python manage.py test` (still 54 passing — this story must not change test outcomes).

---

### 5 — Pre-commit hook

**Create file: `.githooks/pre-commit`**

A `sh` script (git runs hooks through its bundled shell on Windows). It must:

1. Resolve the repo root with `git rev-parse --show-toplevel` so it works from any subdirectory.
2. Run the backend checks **only if `backend/.venv` exists**, using the venv's tools by path — `backend/.venv/Scripts/ruff.exe` on Windows, `backend/.venv/bin/ruff` elsewhere — so no `PATH` activation is required. Skip with a printed notice if the venv is absent.
3. Run the frontend checks **only if `frontend/node_modules` exists**, via `npm --prefix frontend run …`. Skip with a printed notice otherwise.
4. Use the **check** variants, never the write variants: `ruff format --check`, `ruff check`, `prettier --check`, `oxlint`. A hook that rewrites files mid-commit stages a different tree than the one the developer reviewed.
5. Exit non-zero on the first failure with the exact command to fix it (`cd backend && ruff format .` / `cd frontend && npm run format`).

Both linters run whole-tree rather than on staged files only: oxlint completes on this `src/` in well under a second and ruff is comparable, so per-file staging logic is not worth its own failure modes.

**Enable it** — this is a per-clone step, so it belongs in the README:

```powershell
git config core.hooksPath .githooks
```

On macOS/Linux the file also needs `chmod +x .githooks/pre-commit`; record `git update-index --chmod=+x .githooks/pre-commit` so the executable bit is committed once and every clone inherits it.

**File: `README.md`** — add the `core.hooksPath` line to § 3 Backend setup or a new § "Enable the pre-commit hook" between § 4 and § 5, plus a note that `--no-verify` skips it and why that should be rare.

---

### 6 — CI: lint both apps

**Create file: `.github/workflows/lint.yml`**

Triggered on `push` and `pull_request` for `main` and `develop` (the two branches story 01 created). Two independent jobs so a frontend failure does not mask a backend one:

- **`backend`** — `actions/checkout`, `actions/setup-python` pinned to **3.12** (the verified local version), `pip install -r backend/requirements-dev.txt`, then `ruff format --check .` and `ruff check .` with `working-directory: backend`.
- **`frontend`** — `actions/checkout`, `actions/setup-node` pinned to **20** with `cache: npm` and `cache-dependency-path: frontend/package-lock.json`, `npm ci`, then `npm run lint`, `npm run format:check`, and `npm run build`, all with `working-directory: frontend`.

Include `npm run build` in the frontend job: it runs `tsc -b`, so CI type-checks as well as lints, which is the whole reason type-aware linting is out of scope.

**No test step in either job** — see the Test Plan section. Do not add one.

`setup-python` needs no database and `manage.py check` is deliberately **not** run in CI: it imports settings, which requires `DJANGO_SECRET_KEY` and the `POSTGRES_*` variables, and wiring CI secrets is not in this story. Ruff is a static check and needs none of them. Note this limitation in the workflow file as a comment so the omission reads as a decision rather than an oversight.

---

### 7 — Fix the two documents this story invalidates

**File: `frontend/src/README.md`**

- **Delete the `## src/test/` section (line 48 and its body).** It documents a directory that no longer exists — story 03's Vitest setup was removed. Leaving it makes the `ARCH` doc wrong.
- Update the API-layer section (line 53 onward) to list `logger.ts` alongside the `api/` modules under `src/shared/lib/`.
- Update the sanctioned `import.meta.env` read sites to four files, adding `shared/lib/logger.ts`.
- Add a line pointing at `CONVENTIONS.md` as the umbrella spec.

**File: `backend/apps/README.md`** — its § Related specs (line 89) says CONV "will reference this file"; change the tense now that `CONVENTIONS.md` exists, and link to it.

**File: `README.md`** — beyond the additions in tasks 1, 2, and 5: add `format` / `format:check` to any command listing, and add a `CONVENTIONS.md` row to § Repository layout.

---

## Edge Cases & Failure Modes

- **oxlint override glob silently not matching.** Verified: `src/app/*` and `app/**` produce **no error and no effect** — the violation still fires and you are left thinking the rule is broken. Only `**/`-prefixed globs work (`**/app/**`). There is no warning for an override that matches nothing, so a typo here fails open, permitting cross-feature imports. Verification Step 4 exists specifically to catch this.
- **`no-console: "error"` blocks its own implementation.** `logger.ts` must call `console.*`; without the `**/shared/lib/logger.ts` override the lint run can never pass. And running task 3 before task 2 fails on `main.tsx` and `AppErrorBoundary.tsx`. Order: task 2, then task 3.
- **Prettier's defaults would rewrite the entire codebase.** The repo uses no semicolons and single quotes; Prettier defaults to the opposite. Running `prettier --write` with an empty config produces a diff touching every line of every file, which buries the real change and makes review impossible. `.prettierrc.json` must exist **before** the first `--write`.
- **`printWidth`/`line-length` churn.** Measured: 3 frontend lines >90 (max 96) and 11 backend lines >88 (max 101). At 100/100 the reflow is 1 line total. Choosing 88 instead means an 11-line reformat mixed into this story's diff for no benefit.
- **`disable_existing_loggers: True` would silence the 500 logger.** `apps.core.exceptions` creates its logger at import time (line 17), before `LOGGING` is applied. The `False` in task 2 is load-bearing, not boilerplate.
- **Double-logging via `propagate`.** Each named logger sets `propagate: False`. Omitting it sends every record to both its own handler and the root handler, printing each line twice. Verification Step 3 checks the count, not just the presence, of output.
- **`django.request` at `INFO` floods the console.** Django logs every 4xx there. At `ERROR` a normal 404 is quiet while a 500 still surfaces. If you need 404s while debugging, raise it temporarily via `DJANGO_LOG_LEVEL` — do not lower the committed default.
- **Logging secrets.** `logger.exception` on an unhandled 500 includes the traceback, and a traceback can contain local variables in some configurations. Never pass request bodies, tokens, or `POSTGRES_PASSWORD` into a log call. CONV §10 states this; nothing enforces it, which is exactly why it is written down.
- **Ruff reformatting migrations.** `**/migrations/*` is excluded. Without it, every `makemigrations` produces a file ruff wants to reformat, so the hook fails on generated code the developer did not write.
- **Ruff `N` breaking Django conventions.** `pep8-naming` flags some Django idioms — notably `setUp` in `TestCase` subclasses and model `Meta` inner classes. Run `ruff check .` and read the output before assuming a hit is a real violation; add a targeted `per-file-ignores` entry rather than dropping `N` wholesale. The 54 existing tests use `setUp` in `apps/core/tests/test_exceptions.py` and `test_pagination.py`, so expect hits there.
- **Ruff `F403`/`F405` on the settings split.** `dev.py` and `prod.py` use `from .base import *` deliberately. The `per-file-ignores` entries cover exactly those two files; do not silence the rules globally, or a real unused-import bug elsewhere goes unseen.
- **The hook fails on a fresh clone.** `backend/.venv` and `frontend/node_modules` do not exist until setup. The script must **skip with a notice**, not fail — otherwise the first commit after cloning is blocked before the developer has reached the setup steps.
- **`core.hooksPath` is per-clone, not committed.** Git deliberately does not let a repository configure its own hooks path, so a new clone has no hook until someone runs the command. CI is therefore the real gate; the hook is a fast local convenience. Say so in the README so nobody assumes the hook protects the branch.
- **Executable bit on Windows.** A hook committed without the executable bit fails on macOS/Linux with "permission denied". `git update-index --chmod=+x` records it in the index from a Windows checkout.
- **CI cannot run `manage.py check` or the tests.** Both import settings, which require `DJANGO_SECRET_KEY` and the `POSTGRES_*` variables; the test run additionally needs a live PostgreSQL service. CI is lint-and-build only, by decision. The workflow comments this so a future reader does not "fix" it by adding a step that fails.
- **`npm ci` requires the lockfile to match `package.json`.** Adding Prettier changes both; commit them together or CI fails with `EUSAGE` on the next push.
- **CONV drifting from the code it describes.** The real failure mode for a document like this: it is accurate the day it is written and wrong three stories later. Two mitigations are built in — the opening rule that the code wins and CONV is fixed in the same PR, and task 7, which fixes the two documents *this* story invalidates rather than leaving them for someone to trip over.

---

## Test Plan

**This project does not author automated tests.** No test file is created by this story, no test runner is added, and no test step goes into the CI workflow. This section records that policy rather than omitting the heading, so the absence reads as a decision.

What replaces it here is mechanical and already listed in Verification Steps: the linters and formatters *are* the automated check for everything this story is about, and CI runs them on every push.

Two constraints on the existing suite:

- **`python manage.py test` must still report 54 passing.** Task 4 runs `ruff format` and `ruff check --fix` across `backend/`, which rewrites files under `apps/core/tests/` and `config/tests/`. Formatting must not change behaviour; if the count or the result moves, `--fix` altered semantics and the change needs reverting file by file. This is the sharpest signal in the story that the reformat was safe.
- **No new tests are added to that suite**, and none of the 54 are deleted. They predate the no-tests policy and stay as they are.

---

## Migration / Rollback

**No schema, no data, no API change.** This story adds documents and configuration, plus one mechanical reformat of both codebases.

**The reformat is the only wide-blast-radius step.** `ruff format .` and `prettier --write .` touch many files at once. Do them as their **own commit**, separate from the config that caused them, so the review of tasks 1–7 is not drowned in whitespace. Recommended sequence: commit the configs and the hand-written code first, then run the formatters and commit the result with a message that says formatting-only.

**Rollback:** revert the commits. `.githooks/` becoming inert needs one extra step — `git config --unset core.hooksPath` — or git will keep looking for a hook directory that no longer exists and fail every commit with "cannot exec". That is the one rollback footgun here.

**Half-applied states to avoid:**

- Task 3 before task 2 → `no-console` fails on `main.tsx`, `AppErrorBoundary.tsx`, and `logger.ts`, and the frontend lint is red until task 2 lands.
- Formatters run before their config files exist → a whole-codebase restyle to the wrong style, which then has to be undone before the right one can be applied.
- Hook enabled before the formatters have been run once → every commit is blocked by pre-existing formatting the developer did not introduce.

---

## Verification Steps

1. **Backend lint and format clean:** from `backend/` with the venv active — `ruff format --check .` and `ruff check .` — both exit 0.
2. **Backend behaviour unchanged:** from `backend/` — `python manage.py check` reports no issues, and `python manage.py test` reports **54 passing**. The reformat must not move that number.
3. **Backend logging is configured, not accidental:** from `backend/` —

   ```powershell
   python -c "import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.dev'); django.setup(); import logging; l=logging.getLogger('apps.core.exceptions'); print('handlers:', l.handlers); l.info('probe')"
   ```

   The logger now has a handler (it had **none** before this story), and the `probe` line prints **once** with a timestamp, `INFO`, and the logger name. Printing twice means a missing `propagate: False`; printing without a timestamp means `LOGGING` was not picked up.
4. **The import boundary is actually enforced:** from `frontend/` — add a temporary line `import { useHealth } from '@/features/health/api/useHealth'` to `src/shared/ui/Loading.tsx`, run `npm run lint`, and confirm it **fails** with the `no-restricted-imports` message. Delete the line. This is the one step that proves the override glob is right and the rule is not silently inert.
5. **Frontend lint, format, and build clean:** from `frontend/` — `npm run lint`, `npm run format:check`, and `npm run build` all exit 0.
6. **Frontend logger works end to end:** `npm run dev` with the backend running, open <http://localhost:5173/>, and confirm the console shows `[SupportOS] API base URL: http://localhost:8000/api` — emitted by `logger.info`, not a bare `console.info`. Grep confirms it: `grep -rn "console\." frontend/src/` returns **only** `shared/lib/logger.ts`.
7. **The hook blocks a bad commit:** `git config core.hooksPath .githooks`, then introduce a formatting violation (a stray double-quoted string with a semicolon in a `.ts` file), `git add` it, and `git commit`. The commit is **rejected** with the fix command. Repair with `npm run format` and confirm the commit then succeeds.
8. **The hook is safe on a fresh clone:** temporarily rename `frontend/node_modules` aside, attempt a commit, and confirm the hook **skips the frontend checks with a notice** instead of failing. Restore the directory.
9. **CI workflow is valid:** `git push` the branch and confirm both jobs appear and pass on `https://github.com/ziad-azm/Support-OS`. If you would rather not push, at minimum validate the YAML parses (`python -c "import yaml,io; yaml.safe_load(io.open('.github/workflows/lint.yml'))"`) and state in the hand-off that CI is unverified.
10. **CONV is reference-based, not a duplicate:** confirm `CONVENTIONS.md` links to `backend/apps/README.md`, `frontend/src/README.md`, and `README.md` § API conventions, and that it does **not** restate the app table, the placement list, or the envelope shape. A section that can be deleted without losing information is a defect.
11. **The invalidated docs are fixed:** `grep -n "src/test" frontend/src/README.md` returns **nothing**, and `grep -n "logger" frontend/src/README.md` shows the new read-site list.

---

## Done Criteria

- [ ] `CONVENTIONS.md` exists at the repo root with all 18 sections from task 1, is reference-based, and is linked from `README.md`.
- [ ] `CONVENTIONS.md` §0 leads with the "check for an existing implementation before writing new code" rule, naming `src/shared/` and `backend/apps/core/` as the two places to search.
- [ ] `CONVENTIONS.md` §6, §7, and §13 are forward-reference stubs for `FORM`, `UI`, and `AUTHZ` — no invented rules for specs that do not exist yet.
- [ ] `CONVENTIONS.md` §13 carries the open `AllowAny` security note from story 02.
- [ ] `CONVENTIONS.md` §16 records that this project authors no automated tests and that the 54 existing backend tests are kept but not extended.
- [ ] `backend/config/settings/base.py` defines `LOGGING` with a formatter carrying timestamp/level/logger name, `disable_existing_loggers: False`, and `propagate: False` on each named logger; `DJANGO_LOG_LEVEL` is in `.env.example` **and** the README env table.
- [ ] `frontend/src/shared/lib/logger.ts` is the **only** file under `frontend/src/` containing `console.` (Verification Step 6).
- [ ] `frontend/.oxlintrc.json` enforces the no-cross-feature-import rule, and a deliberately added violation fails `npm run lint` (Verification Step 4).
- [ ] `frontend/.prettierrc.json` sets `semi: false`, `singleQuote: true`, `printWidth: 100` — matching the existing style, so the format run reflows nothing.
- [ ] `backend/pyproject.toml` configures ruff as formatter, linter, and import sorter with `line-length = 100`, excludes migrations, and ignores `F403`/`F405` only in the two settings modules.
- [ ] `backend/requirements-dev.txt` exists and `requirements.txt` still contains only runtime dependencies.
- [ ] `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, and `npm run build` all exit 0.
- [ ] `python manage.py test` still reports **54 passing**, and no test file was added or deleted.
- [ ] `.githooks/pre-commit` rejects a formatting violation, skips gracefully when `backend/.venv` or `frontend/node_modules` is missing, and uses only `--check` variants.
- [ ] `README.md` documents `git config core.hooksPath .githooks` and states that the hook is per-clone so CI is the real gate.
- [ ] `.github/workflows/lint.yml` has separate backend and frontend jobs, pins Python 3.12 and Node 20, runs no test step, and comments why `manage.py check` is absent.
- [ ] `frontend/src/README.md` no longer documents `src/test/`, and its `import.meta.env` read-site list includes `shared/lib/logger.ts`.
- [ ] `backend/apps/README.md` § Related specs links to `CONVENTIONS.md` in the present tense.
- [ ] `00-overview.md` updated with this story.

**This is the last story in EPIC 0. STOP HERE. Report to the user, then confirm which EPIC 1 story to plan next — I18N-1 is the stated dependency for UI-1, so it should come first.**
