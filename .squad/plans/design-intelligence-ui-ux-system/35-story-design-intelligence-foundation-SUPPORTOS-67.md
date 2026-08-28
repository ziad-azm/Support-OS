# Story 35 — (DSN-0) Design Intelligence Foundation (Story: SUPPORTOS-67)

## Prerequisites

- **First story in this feature folder — no prior `NN` in `design-intelligence-ui-ux-system/`.** The intake (`.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-67/intake.md`) has exactly two tasks and no attachments/acceptance criteria.
- **`EPIC 1 — Internationalization & Design System` (Story 06, `internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md`) is complete** — `UI` (Tailwind v4 + shadcn/ui) already exists: tokens live in `frontend/src/index.css` (144 lines, read below), documented in `CONVENTIONS.md` § 19 (line 381). This story extends `UI`, it does not replace it (`SupportOs backlog.MD:498`, `**Depends on:** ... UI, I18N`).
- **This is a tooling + documentation story, not an app-code story.** Its entire deliverable is (a) the `ui-ux-pro-max` skill installed into this repo for Claude Code, (b) that skill's design-system generator run once and persisted, and (c) a new curated `CONVENTIONS.md` section that becomes the `DSN` shared spec other stories reference by ID — the same shape `SLA-0` (Story 27, `sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md`) used for a pure-foundation story with zero domain code. No `backend/` change, no `apps/` model, no API, no `frontend/` component change.
- **No token value in `frontend/src/index.css` changes in this story.** The intake's second task says "no visual regression without an explicit decision" — read literally: this story documents the generated palette/typography and a per-token adopt/defer/keep decision, but does not edit `index.css` or any component. Applying an adopted change to `index.css` and to already-built screens is `SupportOs backlog.MD:508` (`STORY (DSN-1) — Design System Refresh Across Built Screens`, `Dependencies: DSN-0`) — a separate future story in this same feature folder, not yet planned.
- **Node.js/npm (README.md § 4, `frontend/` setup) and Python (README.md § 3, `backend/` setup) are already project prerequisites.** This story reuses both toolchains for a new purpose — `npm install -g` for the skill's CLI, and the system Python (not the Django `backend/.venv`) to run the skill's own standalone search script, which per its own docs is dependency-free (no `pip install` needed). Neither touches `backend/requirements.txt` or `frontend/package.json`.
- **Nothing under `.claude/` is currently gitignored.** Verified: `.gitignore` excludes `.venv/`, `node_modules/`, `frontend/dist/`, `.env*`, and editor/OS files only (repo root `.gitignore`); `.claude/commands/` already exists and is tracked. The skill files this story generates under `.claude/skills/ui-ux-pro-max/` and the persisted `design-system/` folder are committed for the same reason `.claude/commands/` is — every future developer/agent session needs the same tool available, not just the one that ran the install.

---

## Story Goal

1. **The `ui-ux-pro-max` skill is installed into this repository for Claude Code**, project-scoped (not `--global`) so the generated skill files live in `.claude/skills/ui-ux-pro-max/` and are committed — every future story (`DSN-1..3`, and per `SupportOs backlog.MD:505`'s own 🔑 note, eventually Knowledge Base/Portal/Reports/Branding) can reuse it without reinstalling.
2. **The skill's design-system generator has been run once against SupportOS's real product description** (quoted from `README.md:3-4`, not a generic placeholder) and persisted to `design-system/MASTER.md` at the repo root, per the skill's own documented `--persist` behaviour.
3. **`CONVENTIONS.md` gains a new `## 25. Design intelligence (DSN, EPIC 8)` section** — the authoritative, referenced-by-ID `DSN` spec. It:
   - points to `design-system/MASTER.md` for the full generated output (style, palette, typography, patterns, anti-patterns, accessibility checklist, chart guidance) — it does not duplicate that file's content wholesale, the same "one generated source, one curated pointer" split `CONVENTIONS.md` § 22 already uses for permissions ("vocabulary is code, mapping is data");
   - reconciles the generated palette/typography against the tokens already in `frontend/src/index.css`, **token by token**, with an explicit **adopt in DSN-1 / defer / keep current** decision and a one-line reason for each — this is the intake's second task ("Reconcile `DSN` with existing `UI` tokens... document any deltas and how they're resolved");
   - carries forward the skill's UX/accessibility anti-pattern checklist and its chart-type guidance (for `SupportOs backlog.MD:522`'s `STORY (DSN-3)`, itself feeding `RPT-0`), summarized, with the pointer to `design-system/MASTER.md` for full detail.
4. **`README.md`'s existing "## Design system" section (line 327) gains one short paragraph** pointing to `design-system/MASTER.md` and `CONVENTIONS.md` § 25, matching how that section already points to § 19 and § 20 rather than restating their content.

**Not in scope for this story** (explicitly deferred to `DSN-1`/`DSN-2`/`DSN-3`, `SupportOs backlog.MD:508-524`): editing `frontend/src/index.css` token values, retrofitting any existing screen, running the accessibility/anti-pattern checklist against built screens, or building the Reports chart wrapper.

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-67/intake.md` — two tasks, no attachments, no acceptance criteria.
2. `SupportOs backlog.MD` lines 496-524 (`EPIC 8 — Design Intelligence & UI/UX System`) — `STORY (DSN-0)` (lines 501-506) is this story; `DSN-1`/`DSN-2`/`DSN-3` (lines 508-524) all declare `Dependencies: DSN-0` and are this story's downstream consumers.
3. `frontend/src/index.css` (144 lines) — the **entire current `UI` token set** to reconcile against: `:root` (lines 9-46) and `.dark` (lines 48-80) custom properties, and the `@theme inline` block (lines 82-122) that maps them to Tailwind utility names. Every current value is `oklch(... 0 0)` (achromatic/greyscale) — the default shadcn "neutral" theme, never customized since Story 06 — which is exactly what task 3 below's reconciliation table must state as the "current value" baseline.
4. `CONVENTIONS.md` lines 381-479 (`## 19. Design system, theming & data tables`) — "Tokens live in `@theme inline`... there is no `tailwind.config.js`" (lines 383-384); this is the rule the new § 25 must not contradict — any adopted palette change still lands as a token in `index.css`, never a new config file.
5. `CONVENTIONS.md` lines 1344-1391 (current end of file, `## 24. Background jobs (Celery, SLA-0)`) — the precedent and exact structural pattern (`---` separator, `## N. Title (SHORT-CODE, STORY-ID)` heading, then prose/tables) for the new `## 25.` section this story appends after line 1391.
6. `CONVENTIONS.md` lines 735-833 (`## 22. Authorization (roles & permissions)`) — read for the "vocabulary is code, mapping is data" framing (cited at line 1369) that § 25's "pointer to `design-system/MASTER.md`, curated decisions in `CONVENTIONS.md`" split follows.
7. `README.md` lines 1-16 — the exact product-description sentence ("SupportOS is an all-in-one customer support platform: customers, tickets, multi-channel communications, agent workspace, SLAs, knowledge base, and reporting in one system.") that task 2's skill invocation quotes verbatim as its product-type argument.
8. `README.md` lines 327-338 (`## Design system`) — the exact section and tone (two short paragraphs, each ending in a pointer to a `CONVENTIONS.md` section number) that task 4's new paragraph is appended to.
9. `README.md` lines 262-314 (`## 6. Run Celery (optional, SLA-0)`) — precedent for documenting an **optional, install-once dev tool** in this README (Redis install per OS, a "confirm it worked" smoke-test command) — task 2's skill-invocation documentation follows the same shape, scaled down.
10. Repo-root `.gitignore` — confirms no existing rule excludes `.claude/` or `design-system/`; both are new, tracked, top-level paths after this story.

---

## Implementation Tasks

### 1 — Install the `ui-ux-pro-max` skill for Claude Code

From the repo root (`e:\Work\AZM\SupportOS`):

```bash
npm install -g ui-ux-pro-max-cli
uipro init --ai claude
```

**Do not pass `--global`** — the project-scoped form writes the skill files into this repo's own `.claude/skills/ui-ux-pro-max/` (per the package's documented "Project Structure Created": `.claude/skills/ui-ux-pro-max/` for the Claude Code target), so they are committed and available to every future session working on this repo, not only the machine that ran the install. This mirrors why `.claude/commands/` is already tracked rather than left to each developer's global config.

No entry is added to `frontend/package.json` or `backend/requirements.txt` — `ui-ux-pro-max-cli` is a global dev-time CLI, not a runtime dependency of either app.

---

### 2 — Generate and persist the design system

From the repo root, using the system Python (this script is dependency-free per the skill's own docs and does not need the Django `backend/.venv` active):

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "an all-in-one customer support platform: customers, tickets, multi-channel communications, agent workspace, SLAs, knowledge base, and reporting" --design-system --persist -p "SupportOS"
```

**Windows note:** if `python3` is not on `PATH` (common on Windows, where only `python` is registered — the same caveat `README.md` § 6 documents for Celery's `--pool=solo`), run the equivalent `python .claude/skills/ui-ux-pro-max/scripts/search.py ...` instead. Confirm which one resolves with `python3 --version` / `python --version` before running.

The product-type string is quoted verbatim from `README.md:3-4` so the generated recommendation is grounded in this project's actual, documented scope rather than a generic "SaaS dashboard" placeholder. `--persist` writes `design-system/MASTER.md` (plus any page-specific overrides) at the repo root, per the skill's own documented output.

---

### 3 — Codify the `DSN` shared spec in `CONVENTIONS.md`

**File: `CONVENTIONS.md`** — append a new top-level section after the current end of file (line 1391, end of `## 24. Background jobs`), preceded by the `---` separator every prior section uses (e.g. before `## 24.` at line 1345):

````markdown
---

## 25. Design intelligence (DSN, EPIC 8)

`DSN` extends `UI` (§ 19) — it does not replace it. It is generated once by the
`ui-ux-pro-max` Claude Code skill (installed at `.claude/skills/ui-ux-pro-max/`,
Story 35/`DSN-0`) and persisted to `design-system/MASTER.md` at the repo root.
Read that file for the full recommended UI style, layout patterns, and
anti-patterns to avoid — this section only curates the decisions that affect
code: the token reconciliation below, a summary of the UX/accessibility
checklist, and chart-type guidance for future dashboards.

**No token in `frontend/src/index.css` changes as part of this section.**
Every "Adopt" decision below is a commitment for `DSN-1` (Design System
Refresh Across Built Screens, `SupportOs backlog.MD:508`) to carry out, not
something this story applies.

### Token reconciliation (`DSN` vs current `UI`)

Current values are shadcn's untouched default "neutral" theme (`oklch(... 0
0)`, i.e. zero chroma / greyscale) — verified against `frontend/src/index.css`
lines 9-46, never customized since Story 06.

| Token (`frontend/src/index.css`) | Current value | `DSN`-recommended value | Decision | Reason |
|---|---|---|---|---|
| `--primary` (line 17) / `--primary-foreground` (line 18) | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | _fill from `design-system/MASTER.md`_ | _Adopt in DSN-1 / Defer / Keep current_ | |
| `--secondary` (line 19) / `--secondary-foreground` (line 20) | `oklch(0.97 0 0)` / `oklch(0.205 0 0)` | _fill from `design-system/MASTER.md`_ | | |
| `--accent` (line 23) / `--accent-foreground` (line 24) | `oklch(0.97 0 0)` / `oklch(0.205 0 0)` | _fill from `design-system/MASTER.md`_ | | |
| `--destructive` (line 25) | `oklch(0.577 0.245 27.325)` | _fill from `design-system/MASTER.md`_ | | |
| `--chart-1` … `--chart-5` (lines 29-33) | five achromatic-to-hued defaults | _fill from `design-system/MASTER.md`_ | | see § "Chart-type guidance" below |
| `--font-sans` (line 44) | `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | _fill from `design-system/MASTER.md`_ | | must keep an Arabic-capable fallback path — see `--font-arabic` |
| `--font-arabic` (line 45) | `'Segoe UI', Tahoma, 'Noto Naskh Arabic', system-ui, sans-serif` | _fill from `design-system/MASTER.md`_ | | `DSN`'s typography pairing is evaluated for Arabic glyph coverage before replacing this — `CONVENTIONS.md` § 18 requires it |
| `--radius` (line 10) | `0.625rem` | _fill from `design-system/MASTER.md`_ | | |

Every row's "current value" is cited from `frontend/src/index.css`; every
"`DSN`-recommended value" and "Decision" cell is filled in from the actual
`design-system/MASTER.md` output of task 2 above, not invented ahead of that
run.

### UX & accessibility checklist (summary)

See `design-system/MASTER.md` for the full generated checklist (anti-patterns,
text resilience, contrast, focus states). `DSN-2` (`SupportOs
backlog.MD:514`, UX Guidelines & Accessibility Audit) is the story that runs
this checklist against already-built screens and fixes what it flags —
nothing here is applied yet.

### Chart-type guidance (for `RPT-0`)

See `design-system/MASTER.md` for the skill's chart-type-by-data-shape
recommendations. `DSN-3` (`SupportOs backlog.MD:520`) is the story that
records these against `--chart-1`…`--chart-5` for the shared chart wrapper
built in Reports & Analytics (`RPT-0`, `SupportOs backlog.MD:797` Foundation
Map entry).
````

---

### 4 — Point `README.md` at the new spec

**File: `README.md`** — append one short paragraph to the end of the existing "## Design system" section (after the forms paragraph, line 344, before the `---` at line 346):

```markdown
`DSN` — an AI-generated design system tailored to SupportOS's own product
description, produced by the `ui-ux-pro-max` Claude Code skill — lives at
`design-system/MASTER.md`, with the token-by-token reconciliation against the
`UI` tokens above in `CONVENTIONS.md` § 25.
```

---

## Edge Cases & Failure Modes

- **`uipro init --ai claude` run with `--global` by mistake** — the skill installs into the operator's user-level Claude config instead of this repo's `.claude/skills/ui-ux-pro-max/`, so `git status` shows no new files and every other developer/agent on this repo cannot see it. Fix: re-run without `--global` from the repo root; confirm `.claude/skills/ui-ux-pro-max/` exists in the working tree before continuing to task 2.
- **`python3` not found on Windows** — `search.py` fails with "python3 is not recognized" rather than a script error. Retry with `python` (see task 2's Windows note); do not install a `python3` shim.
- **`search.py` run without `--persist`** — it prints the design system to stdout but writes no `design-system/MASTER.md`, so task 3's reconciliation table has nothing to read from. Re-run with `--persist` before proceeding.
- **The reconciliation table (§ 25) shipped with every "Decision" cell still saying "Adopt in DSN-1 / Defer / Keep current"** (i.e. the placeholder literal, not an actual choice) — this means task 2's real output was never read back into task 3. Each row must have one concrete decision picked, not the placeholder text.
- **`design-system/` accidentally added to `.gitignore`** (e.g. by a developer assuming generated output shouldn't be committed) — this would silently un-share the spec from every other session. Confirmed in Prerequisites: no such rule exists today; do not add one.
- **A future story treats `design-system/MASTER.md` itself as the spec to cite by ID** instead of `CONVENTIONS.md` § 25 — `README.md:14-16` already establishes `CONVENTIONS.md` as "the single source of truth... cite it instead of re-deriving a standard"; § 25 is the citable `DSN` spec, `design-system/MASTER.md` is its generated backing detail.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16).

1. No backend test impact: `python manage.py test` (from `backend/`) is unaffected — no `apps/` code changes. Re-run only to confirm the existing count still passes and this story introduced no accidental drift.
2. No frontend test/lint impact: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) are unaffected — no `frontend/src/**` code changes (only `README.md` and `CONVENTIONS.md` at the repo root change, plus new files under `.claude/skills/` and `design-system/`). Re-run once to confirm no incidental regression.
3. Manual verification only, per `## Verification Steps` below — this story's deliverable is documentation and generated reference files, not executable code.

---

## Verification Steps

1. **Skill installed and committed:** `.claude/skills/ui-ux-pro-max/` exists in the working tree after task 1; `git status` shows it as new/untracked, ready to `git add`.
2. **Design system generated and persisted:** `design-system/MASTER.md` exists at the repo root after task 2, and is non-empty.
3. **`CONVENTIONS.md` gains § 25 cleanly:** `## 25. Design intelligence (DSN, EPIC 8)` appears after the existing `## 24. Background jobs (Celery, SLA-0)` section, separated by `---`, with no existing section renumbered or altered.
4. **Reconciliation table is filled in, not left as placeholders:** every row in § 25's token table has a real `DSN`-recommended value (sourced from `design-system/MASTER.md`) and one concrete decision (`Adopt in DSN-1` / `Defer` / `Keep current`) with a reason.
5. **`README.md`'s "## Design system" section reads cleanly** with the new paragraph appended, still ending before the `---` that starts "## API conventions".
6. **No regressions:** `git diff` shows changes confined to `README.md`, `CONVENTIONS.md`, and new files under `.claude/skills/ui-ux-pro-max/` and `design-system/` — nothing under `backend/` or `frontend/src/` changed.
7. **Backend still runs unaffected:** `python manage.py runserver` (from `backend/`, venv active) starts normally — proving this story is additive documentation/tooling, not load-bearing for the app.
8. **Frontend still runs unaffected:** `npm run dev` (from `frontend/`) starts normally and the app renders with the exact same (still-default, still-greyscale) visual appearance as before this story — confirming no visual regression, since no token changed.

---

## Done Criteria

- [ ] `ui-ux-pro-max-cli` installed globally; `uipro init --ai claude` run from the repo root (not `--global`) — `.claude/skills/ui-ux-pro-max/` exists and is tracked.
- [ ] `design-system/MASTER.md` generated via `search.py --design-system --persist -p "SupportOS"` against the real `README.md` product description, and committed.
- [ ] `CONVENTIONS.md` — new `## 25. Design intelligence (DSN, EPIC 8)` section appended after § 24: points to `design-system/MASTER.md`, contains the fully-filled-in token reconciliation table (current value cited from `frontend/src/index.css`, `DSN`-recommended value from the generated output, an explicit per-row decision), a UX/accessibility checklist summary, and chart-type guidance summary.
- [ ] `README.md`'s "## Design system" section gains the one-paragraph pointer to `design-system/MASTER.md` and `CONVENTIONS.md` § 25.
- [ ] **No change to `frontend/src/index.css` or any component** — this story documents decisions, `DSN-1` applies them.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.
- [ ] `.squad/plans/00-index.md` gains a new `design-intelligence-ui-ux-system` row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** This unblocks `DSN-1` (Design System Refresh Across Built Screens), `DSN-2` (UX Guidelines & Accessibility Audit), and `DSN-3` (Dashboard Chart Design Guidance) — all three declare `Dependencies: DSN-0` (`SupportOs backlog.MD:510,516,522`) and are not yet planned.
