# SupportOS — Customer Support CRM Backlog (SDD / Squad Kit)

**Project:** SupportOS — an all-in-one customer support platform.

**Frontend:** React · Vite · TypeScript · Tailwind CSS · shadcn/ui · React Router · TanStack Query · React Hook Form · Zod · Axios · i18next
**Backend:** Django · Django REST Framework · PostgreSQL (locally installed; **Docker optional, not required** for initial dev)
**Method:** Spec-Driven Development. Order = implementation dependency order. Foundations are built once and reused everywhere.

---

## How to read this backlog

- **EPIC → STORY → TASK.** Each story has a user story, description, dependencies, and tasks. Each task has: what to implement, constraints, dependencies, expected outcome.
- **🔑 = Reusable Foundation.** A 🔑 task produces a shared spec/module that later tasks **reference and reuse**. Later tasks must NOT re-implement these.
- **Shared Specs (defined once, referenced by ID everywhere):**
  - `ARCH` — architecture & folder structure (EPIC 0)
  - `CONV` — codebase conventions (EPIC 0)
  - `ENV` — environment/config strategy, local Postgres (EPIC 0)
  - `API` — API layer: Axios client, TanStack Query, error model, response envelope (EPIC 0)
  - `AUTHZ` — auth/authorization conventions (EPIC 2)
  - `I18N` — i18n/RTL foundation (EPIC 1)
  - `UI` — design system: Tailwind + shadcn shared primitives & states (EPIC 1)
  - `FORM` — form + validation conventions: RHF + Zod (EPIC 1)

- **Token-efficiency rule for every implementation task (applies globally — do not repeat in each task):**
  1. **Inspect before modify:** read the relevant existing files and the referenced Shared Specs first; reuse existing code/abstractions; change only what's necessary.
  2. **Reference, don't repeat:** depend on the Shared Specs by ID instead of restating architectural rules.
  3. **No duplication:** if a shared component/util/hook exists, use it; do not recreate it.
  4. **Minimal report on completion:** report only → _what changed · files changed · tests performed · blockers · next recommended task_. No long explanations unless asked.

---

---

# EPIC 0 — Project Foundation & Architecture

**Description:** Establishes the repository, backend and frontend skeletons, local (non-Docker) PostgreSQL setup, the shared API layer, error handling, and the project's coding standards. Everything else depends on this epic. Produces the reusable specs `ARCH`, `CONV`, `ENV`, `API`.

---

### STORY (FND-1) — Repository & Local Dev Bootstrap

**As a developer, I want a monorepo that runs locally without Docker, so that anyone can start developing in minutes.**
**Description:** One repository with `/backend` (Django) and `/frontend` (React/Vite) that runs against a **locally installed PostgreSQL**. Docker files may exist but are optional and never required to run the app.
**Dependencies:** none.

- **Task: Create monorepo structure & docs** 🔑 (defines `ARCH` scaffold)
  - Implement: `/backend`, `/frontend`, root `README` with exact local-run steps (install local Postgres, create DB, run migrations, start both servers), `.gitignore`, `main`+`develop` branches.
  - Constraints: no Docker requirement in the run steps; Docker files (if added) marked optional/future.
  - Depends on: none.
  - Outcome: a fresh clone runs both apps locally following the README only.

- **Task: Environment & config strategy** 🔑 (defines `ENV`)
  - Implement: `.env.example` for backend (DB name/user/password/host/port, secret key, JWT settings) and frontend (`VITE_API_BASE_URL`); a settings split (`base`/`dev`/`prod`) reading env vars; documented local Postgres connection.
  - Constraints: no secrets committed; local Postgres is the default; must work without Docker.
  - Depends on: FND-1 repo task.
  - Outcome: both apps read all config from env; local Postgres connects on `dev`.

---

### STORY (FND-2) — Backend Foundation (Django + DRF)

**As a developer, I want a domain-organized Django + DRF backend, so that features live in clear business boundaries.**
**Description:** Django project organized by domain apps (one app per business area), DRF configured with a **standard response envelope and error model** that all endpoints follow.
**Dependencies:** FND-1.

- **Task: Django project & domain app layout** 🔑 (defines backend half of `ARCH`)
  - Implement: Django project + empty domain apps (`customers`, `tickets`, `communications`, `agents`, `sla`, `knowledge_base`, `portal`, `reports`, `ai`, `integrations`, `accounts`, `organization`); shared `core` app for cross-cutting utilities.
  - Constraints: organize by domain, not by technical layer; avoid premature abstractions.
  - Depends on: FND-1.
  - Outcome: importable domain apps with a documented placement rule for new code.

- **Task: DRF base config, response envelope & error model** 🔑 (defines backend half of `API`)
  - Implement: DRF setup; a **consistent success/error response shape**; a global exception handler mapping errors to that shape; pagination defaults; base viewset/serializer conventions.
  - Constraints: every future endpoint reuses this envelope + exception handler — no per-feature error formats.
  - Depends on: Django project task.
  - Outcome: `GET /api/health/` returns the standard envelope; errors are uniform.

- **Task: Local PostgreSQL wiring & migration workflow** 🔑
  - Implement: connect Django to local Postgres via `ENV`; document `makemigrations`/`migrate`; initial migration.
  - Constraints: local install only; no Docker dependency.
  - Depends on: `ENV`, Django project task.
  - Outcome: migrations run against local Postgres.

---

### STORY (FND-3) — Frontend Foundation (React + Vite + TS)

**As a developer, I want a scalable feature-based React app with a shared API layer, so that features stay consistent and isolated.**
**Description:** React/Vite/TS app with a **feature-based structure**, React Router, and a single shared API layer (Axios + TanStack Query) with centralized error handling. No per-feature API clients.
**Dependencies:** FND-1, FND-2 (`API` envelope/error model).

- **Task: Scaffold React app & feature-based structure** 🔑 (defines frontend half of `ARCH`)
  - Implement: Vite + TS app; structure = `src/features/<feature>/{components,api,hooks,types}`, plus `src/shared/{ui,lib,hooks,i18n}`, `src/app` (router/providers); React Router with route boundaries.
  - Constraints: no dumping ground `components`/`utils`; each feature self-contained; shared code only under `src/shared`.
  - Depends on: FND-1.
  - Outcome: documented structure with a placement rule for new files.

- **Task: Shared API layer (Axios + TanStack Query)** 🔑 (defines frontend half of `API`)
  - Implement: one configured Axios instance (base URL from `ENV`, interceptors for auth token + the standard error model); TanStack Query client + query/mutation conventions; typed API response helpers matching the backend envelope.
  - Constraints: **the only** API client in the app; all data fetching goes through TanStack Query; no `fetch`/ad-hoc Axios in features.
  - Depends on: `API` (backend envelope), scaffold task.
  - Outcome: features call the backend through one consistent, typed, error-handled layer.

- **Task: Global error, loading & empty-state handling** 🔑 (part of `UI`/`API`)
  - Implement: error boundary, standardized query error/loading/empty rendering, and a toast system wired to API errors.
  - Constraints: features reuse these patterns; no per-feature error/loading implementations.
  - Depends on: shared API layer task.
  - Outcome: one consistent way to show loading/error/empty across the app.

---

### STORY (FND-4) — Codebase Conventions & Foundation Spec

**As a team, we want one written conventions spec, so that every developer (and the AI) follows the same patterns and avoids duplication.**
**Description:** A single living document (`CONV`) that all later tasks reference instead of re-deriving standards. This is the anti-duplication, low-token backbone of the project.
**Dependencies:** FND-1, FND-2, FND-3.

- **Task: Author the CONV spec** 🔑 (defines `CONV`)
  - Implement: one doc covering — folder structure & file placement; naming conventions; TypeScript conventions; API communication conventions (reference `API`); error/loading/empty handling; validation approach (reference `FORM`); reusable-component rule (reference `UI`); shared utilities; env/config (reference `ENV`); logging strategy (frontend + backend); API response conventions; frontend/backend boundaries; auth conventions (reference `AUTHZ`); testing conventions; linting/formatting; import conventions; explicit "check for existing implementation before writing new code" rule.
  - Constraints: concise and reference-based; later tasks link to `CONV` rather than repeating rules.
  - Depends on: FND-1/2/3.
  - Outcome: a single source of truth every task cites.

- **Task: Linting, formatting & CI checks** 🔑
  - Implement: ESLint + Prettier (frontend), Black + Ruff/isort (backend), pre-commit hooks, and a CI job running lint + tests for both apps.
  - Constraints: enforce `CONV` import/naming rules automatically.
  - Depends on: CONV task.
  - Outcome: consistent style enforced on every commit.

- **Task: Testing conventions & harness** 🔑
  - Implement: backend test setup (pytest/DRF test client) and frontend test setup (Vitest + React Testing Library), with example tests and the documented testing pattern in `CONV`.
  - Constraints: features write tests following this pattern; no bespoke harnesses.
  - Depends on: CONV task.
  - Outcome: both apps have a ready, documented test approach.

---

---

# EPIC 1 — Internationalization & Design System

**Description:** Builds bilingual (Arabic/English) + RTL support and the shared UI/design system **before any feature UI**. Produces `I18N`, `UI`, and `FORM`. Every later feature must consume these — no feature re-implements i18n, UI primitives, or validation.

---

### STORY (I18N-1) — Internationalization & RTL Foundation

**As a user, I want the app fully usable in Arabic and English with correct layout direction, so that language is never a limitation.**
**Description:** i18n is a day-one foundation: translation structure, runtime language switching, RTL/LTR layout, and localized date/number formatting. No hardcoded user-facing strings anywhere.
**Dependencies:** FND-3.

- **Task: i18next setup & translation structure** 🔑 (defines `I18N`)
  - Implement: react-i18next; per-feature namespace structure for `en` and `ar`; a typed `t()` usage convention; lint rule/guidance against hardcoded strings.
  - Constraints: every feature adds its own namespace files; strings never hardcoded.
  - Depends on: FND-3.
  - Outcome: translation keys resolve in both languages; adding a feature = adding its namespace.

- **Task: RTL/LTR layout system & language switcher** 🔑 (part of `I18N`)
  - Implement: direction-aware layout (html `dir`/`lang`), Tailwind logical properties usage, a language switcher persisting choice, and direction-correct defaults.
  - Constraints: shared components must render correctly in both directions; use logical (start/end) spacing, not left/right.
  - Depends on: i18next setup task.
  - Outcome: switching language flips layout direction correctly app-wide.

- **Task: Locale formatting utilities** 🔑 (part of `I18N`)
  - Implement: shared date/number/currency formatting helpers bound to the active locale; backend `LANGUAGE`/locale settings for any server-rendered/localized text.
  - Constraints: features format via these helpers, not inline.
  - Depends on: i18next setup task.
  - Outcome: dates/numbers display correctly per locale everywhere.

---

### STORY (UI-1) — Design System & Shared Components

**As a developer, I want a shared, direction-aware component library, so that features reuse consistent UI instead of duplicating it.**
**Description:** Tailwind + shadcn/ui foundation plus the shared business-agnostic primitives and standard states. Built once; every feature reuses these.
**Dependencies:** FND-3, I18N-1.

- **Task: Tailwind + shadcn/ui setup & theme tokens** 🔑 (defines `UI` base)
  - Implement: Tailwind config with design tokens (colors, spacing, radius, typography), shadcn/ui initialized, dark-mode-ready theme, RTL-aware base styles.
  - Constraints: prefer shadcn primitives over hand-built ones; tokens are the single styling source.
  - Depends on: FND-3, I18N RTL task.
  - Outcome: themed, direction-aware styling foundation.

- **Task: Shared UI primitives** 🔑 (part of `UI`)
  - Implement (via shadcn where sensible): Button, Input, Select, Dialog/Modal, Dropdown, Table, Pagination, Toast/notifications, Tabs, Badge, Card.
  - Constraints: all i18n- and RTL-aware; **reuse-first** — features must use these, not re-create them.
  - Depends on: Tailwind/shadcn task.
  - Outcome: a documented primitive set covering common UI needs.

- **Task: Standard states & patterns** 🔑 (part of `UI`)
  - Implement: reusable Loading, Empty, Error states, and a Confirmation dialog pattern; wire them to the `API` error/loading conventions.
  - Constraints: features render these states via shared components only.
  - Depends on: shared primitives task, FND-3 error/loading task.
  - Outcome: consistent loading/empty/error/confirm UX everywhere.

- **Task: Data table + pagination pattern** 🔑 (part of `UI`)
  - Implement: a reusable table pattern (sorting, pagination, empty/loading) built on the primitives + TanStack Query conventions.
  - Constraints: all list screens use this pattern; no bespoke tables per feature.
  - Depends on: shared primitives task, shared API layer.
  - Outcome: one table pattern reused by every list view.

---

### STORY (FORM-1) — Forms & Validation Foundation

**As a developer, I want one form + validation pattern, so that all forms behave and validate consistently.**
**Description:** React Hook Form + Zod as the single forms/validation approach, with shared form components and shared Zod schema conventions (reused for both client and shape alignment with DRF serializers).
**Dependencies:** UI-1, I18N-1.

- **Task: RHF + Zod form foundation** 🔑 (defines `FORM`)
  - Implement: shared Form field components bound to RHF, a Zod resolver setup, localized validation messages (via `I18N`), and reusable schema helpers.
  - Constraints: **the only** form/validation approach; no alternative validation per feature; messages never hardcoded.
  - Depends on: UI primitives, I18N.
  - Outcome: features build forms by composing shared field components + a Zod schema.

---

---

# EPIC 2 — Authentication & Authorization

**Description:** Secure login, token handling, roles, and granular permissions. Produces `AUTHZ`, reused by every protected feature and endpoint.
**Depends on:** EPIC 0 (`API`,`ENV`,`CONV`), EPIC 1 (`UI`,`I18N`,`FORM`).

---

### STORY (AUTH-1) — Authentication (JWT)

**As a user, I want to log in and stay authenticated securely, so that my access is protected.**
**Description:** JWT auth (login/refresh/logout) with the token wired into the shared Axios layer and route guards on the frontend.
**Dependencies:** FND-2, FND-3, UI-1, FORM-1.

- **Task: Backend JWT auth endpoints** 🔑 (part of `AUTHZ`)
  - Implement: `djangorestframework-simplejwt` login/refresh; a `User` model strategy (extend Django auth); auth using the standard `API` envelope.
  - Constraints: reuse `API` error model; no custom response shapes.
  - Depends on: FND-2.
  - Outcome: working token issuance/refresh via standard API.

- **Task: Frontend auth flow & guards** 🔑 (part of `AUTHZ`)
  - Implement: login form (RHF+Zod, i18n), token storage + refresh in the Axios interceptor, protected route guards, and an auth context/hook.
  - Constraints: reuse shared API layer + `FORM` + `UI`; single source of auth state.
  - Depends on: backend JWT task, FND-3, FORM-1.
  - Outcome: users log in and reach protected routes; tokens refresh transparently.

---

### STORY (AUTH-2) — Roles, Permissions & Authorization

**As an admin, I want roles and granular permissions, so that access matches each person's job.**
**Description:** Role model + permission checks enforced uniformly on the backend and reflected in the frontend (hiding/disabling unauthorized actions).
**Dependencies:** AUTH-1.

- **Task: Backend roles & permission enforcement** 🔑 (part of `AUTHZ`)
  - Implement: roles (Admin, Manager, Agent, plus extensible), a reusable DRF permission layer mapping actions→roles, applied via base viewset conventions.
  - Constraints: one permission mechanism reused by all endpoints; no per-feature ad-hoc checks.
  - Depends on: AUTH-1.
  - Outcome: endpoints enforce role permissions consistently.

- **Task: Frontend authorization helpers** 🔑 (part of `AUTHZ`)
  - Implement: a `can(permission)` hook/util and guard components to conditionally render/disable actions.
  - Constraints: features gate UI via these helpers; no bespoke role checks.
  - Depends on: backend permission task.
  - Outcome: UI reflects permissions consistently.

---

---

# EPIC 3 — Customer Management

**Description:** Customer profiles, contact details, interaction history, and notes/attachments — the record everything else attaches to.
**Depends on:** EPIC 0, 1, 2 (all foundations). _(These prerequisites apply to every feature epic below and are not repeated per task.)_

---

### STORY (CUST-1) — Customer Profiles

**As an agent, I want to create and view customer profiles, so that each customer has one record.**
**Dependencies:** AUTH-2, `API`, `UI`, `FORM`, `I18N`.

- **Task: `Customer` model & CRUD API** — Implement Customer model + DRF CRUD using base viewset/envelope/permissions. Constraints: reuse `AUTHZ`, `API`. Outcome: standard customer CRUD endpoints.
- **Task: Customer list & profile UI** — Implement list (shared table pattern) + profile view. Constraints: reuse `UI` table/states, `I18N`. Outcome: browse and view customers.
- **Task: Create/edit customer form** — Implement form via `FORM` (RHF+Zod) with i18n messages. Constraints: reuse `FORM`, shared fields. Outcome: create/edit customers.

### STORY (CUST-2) — Contact Details

**As an agent, I want multiple contact channels per customer, so that I can reach them correctly.**
**Dependencies:** CUST-1.

- **Task: `ContactDetail` model & API** — Implement channel-typed contacts (email/phone/WhatsApp) related to Customer + CRUD. Reuse `API`,`AUTHZ`. Outcome: contact CRUD.
- **Task: Contact details UI** — Implement add/edit/remove within profile using shared primitives + `FORM`. Outcome: manage contacts inline.

### STORY (CUST-3) — Interaction History

**As an agent, I want a customer's full timeline, so that I have context.**
**Dependencies:** CUST-1, TKT-1, COMM-\*.

- **Task: Interaction aggregation API** — Implement endpoint aggregating tickets + messages chronologically. Reuse `API`. Outcome: unified timeline data.
- **Task: Timeline UI** — Implement timeline on profile using shared states. Reuse `UI`,`I18N`. Outcome: chronological history view.

### STORY (CUST-4) — Notes & Attachments

**As an agent, I want notes and files on a customer, so that context is shared.**
**Dependencies:** CUST-1.

- **Task: `Note` & `Attachment` models + upload API** — Implement models + file upload via `API` conventions; document storage location via `ENV`. Outcome: notes/files persistence.
- **Task: Notes & attachments UI** — Implement add/list/download using shared primitives. Outcome: manage notes/files on profile.

---

---

# EPIC 4 — Ticket Management

**Description:** The core support workflow — create/track tickets, categories, priorities, assignment, status, escalation, and full history.
**Depends on:** foundations + Customer Management.

### STORY (TKT-1) — Create & Track Tickets

**As an agent, I want to create and track tickets, so that every issue is recorded to resolution.**
**Dependencies:** CUST-1, AUTH-2.

- **Task: `Ticket` model & CRUD API** 🔑 (core ticket domain reused by many epics) — Implement Ticket (subject, description, customer FK, timestamps, status, priority placeholders) + CRUD via base conventions. Outcome: ticket CRUD other epics build on.
- **Task: Ticket list & detail UI** — Implement list (shared table) + detail view. Reuse `UI`,`I18N`. Outcome: browse/view tickets.
- **Task: Create/edit ticket form** — Implement via `FORM`, customer selector reusing customer API. Outcome: create/edit tickets.

### STORY (TKT-2) — Categories & Priorities

**Dependencies:** TKT-1.

- **Task: `Category` model + priority + API** — Implement categories and priority field with management endpoints. Reuse `AUTHZ`. Outcome: classify tickets.
- **Task: Category/priority UI & filters** — Implement selectors + list filters via shared table pattern. Outcome: filter/sort by category/priority.

### STORY (TKT-3) — Assignment

**Dependencies:** TKT-1, AUTH-2.

- **Task: Assignment API** — Implement `assigned_agent` + assign/reassign endpoint with permission checks. Outcome: assign tickets.
- **Task: Assignment UI & "my tickets"** — Implement assignment control + agent-scoped filter. Reuse authorization helpers. Outcome: clear ownership + personal queue.

### STORY (TKT-4) — Status & Escalation

**Dependencies:** TKT-1.

- **Task: Status/escalation API** — Implement status enum with valid transitions + escalation level/flag endpoints. Outcome: controlled status/escalation.
- **Task: Status/escalation UI** — Implement status control + escalate action using shared confirm dialog. Outcome: transparent progress + escalation.

### STORY (TKT-5) — Ticket History

**Dependencies:** TKT-1.

- **Task: `TicketActivity` log & API** 🔑 (reusable activity-log pattern) — Implement change logging (status/assignment/replies) + history endpoint. Outcome: auditable ticket timeline pattern reusable elsewhere.
- **Task: History timeline UI** — Implement activity timeline reusing timeline/state components. Outcome: full ticket history view.

---

---

# EPIC 5 — Communication Channels

**Description:** Unify email, WhatsApp, live chat, SMS, and web forms into tickets. A shared message model + channel-adapter pattern is built once and reused per channel.
**Depends on:** Ticket Management.

### STORY (COMM-0) — Messaging Core & Channel Adapter Pattern

**As a developer, I want one message model and channel-adapter interface, so that each channel plugs in consistently.**
**Dependencies:** TKT-1.

- **Task: `Message` model + channel adapter interface** 🔑 (defines the messaging foundation) — Implement a unified Message model (ticket FK, direction, channel, body, metadata) and an adapter interface each channel implements (inbound→ticket, outbound send). Constraints: channels reuse this; no per-channel bespoke models. Outcome: reusable messaging spine.
- **Task: Shared conversation UI** 🔑 — Implement a channel-agnostic conversation/thread + reply component (reusing `UI`,`FORM`,`I18N`). Outcome: one conversation view all channels reuse.

### STORY (COMM-1) — Email

**Dependencies:** COMM-0.

- **Task: Email adapter (inbound parse + outbound send)** — Implement the email adapter against the shared interface + provider config via `ENV`. Outcome: email ↔ tickets.
- **Task: Email in conversation UI** — Wire email into the shared conversation view. Outcome: reply by email in-ticket.

### STORY (COMM-2) — WhatsApp

**Dependencies:** COMM-0.

- **Task: WhatsApp adapter** — Implement provider (WhatsApp Business API) adapter + webhook intake. Outcome: WhatsApp ↔ tickets.
- **Task: WhatsApp in conversation UI** — Reuse shared conversation view. Outcome: reply via WhatsApp.

### STORY (COMM-3) — Live Chat

**Dependencies:** COMM-0.

- **Task: Real-time chat backend (Django Channels)** — Implement WebSocket chat persisting to Message/ticket via the adapter pattern. Outcome: real-time chat as tickets.
- **Task: Live-chat widget + agent console** — Implement customer widget + agent console reusing shared conversation UI. Outcome: real-time support.

### STORY (COMM-4) — SMS

**Dependencies:** COMM-0.

- **Task: SMS adapter** — Implement provider send/receive adapter. Outcome: SMS ↔ tickets.
- **Task: SMS in conversation UI** — Reuse shared conversation view. Outcome: reply via SMS.

### STORY (COMM-5) — Web Forms

**Dependencies:** COMM-0, TKT-2.

- **Task: Web form intake API** — Implement configurable form submission → ticket creation. Outcome: forms create tickets.
- **Task: Embeddable/portal web form** — Implement form via `FORM`+`I18N`, reusing validation. Outcome: structured request capture.

---

---

# EPIC 6 — Agent Workspace

**Description:** The agent's home base — assigned tickets, customer context, tasks/reminders, quick replies, and team collaboration.
**Depends on:** Ticket Management, Communication Channels.

### STORY (AGENT-1) — Assigned Tickets Workspace

**Dependencies:** TKT-3.

- **Task: Agent queue API** — Implement filtered "my tickets" (status/priority/SLA) reusing ticket API. Outcome: focused queue data.
- **Task: Agent queue UI** — Implement queue using shared table pattern + filters. Outcome: agent work list.

### STORY (AGENT-2) — Customer Context Panel

**Dependencies:** CUST-1, TKT-1.

- **Task: Combined context API** — Implement ticket+customer+recent-history endpoint. Outcome: one call for context.
- **Task: Context side panel UI** — Implement reusable side panel beside ticket detail. Outcome: context without screen switching.

### STORY (AGENT-3) — Tasks & Reminders

**Dependencies:** AUTH-1, SLA-4 (notifications).

- **Task: `Task`/`Reminder` model + API** — Implement personal tasks (optional ticket link, due date). Outcome: reminders persistence.
- **Task: Tasks/reminders UI + due notifications** — Implement UI reusing primitives; trigger via shared notification system. Outcome: follow-ups don't get lost.

### STORY (AGENT-4) — Quick Replies

**Dependencies:** COMM-0.

- **Task: `QuickReply` model + API** — Implement reusable reply templates. Outcome: template store.
- **Task: Quick-reply picker in conversation** — Implement picker inside shared conversation view. Outcome: faster replies.

### STORY (AGENT-5) — Team Collaboration

**Dependencies:** TKT-5, SLA-4.

- **Task: Internal notes + @mentions API** — Implement private notes + mentions on tickets (reuse activity-log pattern). Outcome: private collaboration.
- **Task: Collaboration UI + mention notifications** — Implement internal-note UI + notify mentioned agents. Outcome: agents solve together.

---

---

# EPIC 7 — SLA & Automation

**Description:** Response/resolution targets, automatic assignment, escalation rules, and alerts — built on a shared background-job foundation.
**Depends on:** Ticket Management.

### STORY (SLA-0) — Background Jobs Foundation

**As a developer, I want a shared async/scheduled-job foundation, so that automation, escalation, and notifications reuse it.**
**Dependencies:** FND-2.

- **Task: Celery + scheduler setup** 🔑 (reused by SLA, escalation, notifications, AI, integrations) — Implement Celery worker + beat with local broker documented in `ENV`; **must remain runnable locally without Docker** (document local broker option). Outcome: reusable async/scheduled task foundation.

### STORY (SLA-1) — Response & Resolution Targets

**Dependencies:** TKT-2.

- **Task: `SLAPolicy` model + computation** — Implement policies per priority/category; compute due times + breach status. Outcome: SLA tracking.
- **Task: SLA config UI + on-ticket indicators** — Implement admin config + ticket badges reusing primitives. Outcome: visible SLA status.

### STORY (SLA-2) — Automatic Assignment

**Dependencies:** TKT-3, SLA-0.

- **Task: Assignment rules engine** — Implement rules (category/load/round-robin) applied on ticket creation. Outcome: auto-routing.
- **Task: Assignment rules UI** — Implement config UI. Outcome: manageable routing.

### STORY (SLA-3) — Escalation Rules

**Dependencies:** SLA-1, SLA-0.

- **Task: Escalation evaluation job** — Implement scheduled job (via SLA-0) escalating at-risk/idle tickets. Outcome: automatic escalation.
- **Task: Escalation rules UI** — Implement config UI. Outcome: manageable escalation.

### STORY (SLA-4) — Alerts & Notifications

**As a developer, I want one notification system, so that all features send alerts consistently.**
**Dependencies:** SLA-0.

- **Task: Notification model + delivery** 🔑 (reused by tasks, collaboration, SLA, AI) — Implement in-app + email delivery triggered from events. Outcome: shared notification service.
- **Task: Notification center UI** 🔑 — Implement reusable notification center + toasts. Outcome: consistent alerts everywhere.

---

---

# EPIC 8 — Knowledge Base

**Description:** FAQs, help articles/guides, and search — powering self-service and AI suggestions later.
**Depends on:** foundations, AUTH-2.

### STORY (KB-1) — FAQs

- **Task: `FAQ` model + API** — Implement CRUD (admin) reusing `AUTHZ`. Outcome: FAQ management.
- **Task: FAQ UI** — Implement admin + display views reusing primitives/`I18N`. Outcome: browse FAQs.

### STORY (KB-2) — Help Articles & Guides

- **Task: `Article` model + API** — Implement rich-text articles (category, status, bilingual fields). Outcome: article store.
- **Task: Article editor + reader UI** — Implement editor (admin) + reader reusing primitives. Outcome: publish/read guides.

### STORY (KB-3) — Knowledge Base Search

**Dependencies:** KB-1, KB-2.

- **Task: Full-text search API** 🔑 (reused by AI suggestions) — Implement Postgres full-text search across FAQs/articles. Outcome: ranked search + reusable retrieval for AI.
- **Task: Search UI** — Implement search + results reusing primitives/states. Outcome: quick answer discovery.

---

---

# EPIC 9 — Customer Portal

**Description:** Self-service portal — submit/track tickets, history, FAQs, feedback. Reuses ticket, KB, and messaging foundations with customer-scoped access.
**Depends on:** Ticket Management, Knowledge Base, AUTH-2.

### STORY (PORTAL-0) — Portal Access & Customer Auth

- **Task: Customer auth + scoped access** 🔑 — Implement customer login and a scoping rule limiting portal data to the logged-in customer (reuse `AUTHZ`). Outcome: secure customer boundary reused by all portal stories.
- **Task: Portal shell UI** 🔑 — Implement portal layout (bilingual/RTL, responsive) reusing `UI`/`I18N`. Outcome: portal frame for all portal features.

### STORY (PORTAL-1) — Submit Tickets

**Dependencies:** PORTAL-0, TKT-1.

- **Task: Customer-scoped create API + UI** — Reuse ticket create + `FORM`. Outcome: customers open tickets.

### STORY (PORTAL-2) — Track Requests

**Dependencies:** PORTAL-0.

- **Task: Scoped ticket list/detail + UI** — Reuse ticket API (scoped) + shared table/states. Outcome: live status tracking.

### STORY (PORTAL-3) — View History

**Dependencies:** PORTAL-2.

- **Task: Historical tickets view** — Extend scoped list with closed tickets. Outcome: past-request history.

### STORY (PORTAL-4) — Access FAQs

**Dependencies:** PORTAL-0, KB-1/2.

- **Task: KB in portal** — Surface KB content within the portal shell. Outcome: self-service answers.

### STORY (PORTAL-5) — Submit Feedback (CSAT)

**Dependencies:** PORTAL-2.

- **Task: `Feedback`/CSAT model + API + form** 🔑 (feeds Reports CSAT) — Implement post-resolution rating + comment via `FORM`. Outcome: satisfaction capture reused by reporting.

---

---

# EPIC 10 — Reports & Analytics

**Description:** Ticket, SLA, agent, and CSAT reporting plus management dashboards — built on a shared reporting/aggregation foundation.
**Depends on:** Ticket Management, SLA, Portal (CSAT).

### STORY (RPT-0) — Reporting Foundation

- **Task: Aggregation + export utilities** 🔑 (reused by all reports) — Implement shared query/aggregation helpers + CSV/export and a reusable chart wrapper (reusing `UI`). Outcome: one reporting pattern for all reports.

### STORY (RPT-1) — Ticket Reports

- **Task: Ticket metrics API + report UI** — Volume/trends by status/category/channel/time using RPT-0. Outcome: ticket analytics.

### STORY (RPT-2) — SLA Performance

**Dependencies:** SLA-1.

- **Task: SLA metrics API + report UI** — Response/resolution times, breach rates via RPT-0. Outcome: SLA analytics.

### STORY (RPT-3) — Agent Performance

- **Task: Agent metrics API + report UI** — Handled/resolution time/CSAT per agent via RPT-0. Outcome: agent analytics.

### STORY (RPT-4) — Customer Satisfaction

**Dependencies:** PORTAL-5.

- **Task: CSAT metrics API + report UI** — Aggregate satisfaction trends via RPT-0. Outcome: CSAT analytics.

### STORY (RPT-5) — Management Dashboards

**Dependencies:** RPT-1..4.

- **Task: Combined KPI API + dashboard UI** — Open tickets, SLA health, CSAT, agent load in one dashboard reusing RPT-0 charts. Outcome: at-a-glance overview.

---

---

# EPIC 11 — AI Features

**Description:** AI assistance — ticket summaries, suggested replies, auto-categorization, suggested solutions, and a customer chatbot. Built on a shared AI-service foundation grounded in the knowledge base.
**Depends on:** Ticket Management, Knowledge Base, Communication Channels.

### STORY (AI-0) — AI Service Foundation

- **Task: AI provider client + prompt/util layer** 🔑 (reused by all AI stories) — Implement one server-side AI client (keys via `ENV`), shared prompt-building utilities, and KB grounding via KB-3 search. Constraints: single AI integration point; features call it, don't re-integrate. Outcome: reusable AI foundation.

### STORY (AI-1) — Ticket Summaries

- **Task: Summary endpoint + UI action** — Summarize ticket conversation via AI-0; add "summarize" action in ticket detail. Outcome: quick ticket comprehension.

### STORY (AI-2) — Suggested Replies

**Dependencies:** AI-0, COMM-0.

- **Task: Suggested-reply endpoint + UI** — Draft replies from ticket + KB context; surface in shared conversation view. Outcome: faster quality replies.

### STORY (AI-3) — Automatic Categorization

**Dependencies:** AI-0, TKT-2.

- **Task: AI categorization on intake** — Auto-tag category/priority (agent-overridable) via AI-0. Outcome: less manual triage.

### STORY (AI-4) — Suggested Solutions

**Dependencies:** AI-0, KB-3.

- **Task: Solution-suggestion endpoint + panel** — Match ticket to KB solutions; show panel in ticket detail. Outcome: faster resolutions.

### STORY (AI-5) — AI Chatbot

**Dependencies:** AI-0, KB-3, PORTAL-0.

- **Task: Chatbot backend (grounded + handoff)** — Implement KB-grounded chatbot with human/ticket handoff via AI-0. Outcome: instant self-service.
- **Task: Chatbot widget** — Implement portal widget reusing conversation UI. Outcome: customer-facing bot.

---

---

# EPIC 12 — Integrations

**Description:** Public API, ERP, messaging-provider config, and outbound webhooks — reusing existing endpoints and provider config patterns.
**Depends on:** foundations, relevant domains.

### STORY (INT-1) — Public REST API & Docs

- **Task: API keys/token auth + OpenAPI docs** 🔑 — Implement external auth (API keys) reusing `AUTHZ` + generate Swagger/OpenAPI. Outcome: documented external API.

### STORY (INT-2) — ERP Integration

**Dependencies:** CUST-1, SLA-0.

- **Task: ERP sync service + config UI** — Implement import/export sync (async via SLA-0) with field mapping + config. Outcome: customer/order sync.

### STORY (INT-3) — Messaging Providers Config

**Dependencies:** COMM-1/2/4.

- **Task: Provider config models + UI** 🔑 — Implement secure central config for email/SMS/WhatsApp credentials reused by channel adapters. Outcome: one place to connect channels.

### STORY (INT-4) — Outbound Webhooks

**Dependencies:** SLA-0.

- **Task: Webhook subscriptions + dispatch + UI** — Implement event subscriptions firing async on domain events. Outcome: external systems notified.

---

---

# EPIC 13 — Security & Administration

**Description:** User/role administration UI, permission management, audit logs, and system configuration. Builds admin surfaces on the `AUTHZ` foundation and the reusable activity-log pattern.
**Depends on:** EPIC 2.

### STORY (SEC-1) — Users & Roles Admin

- **Task: User/role admin API + UI** — Implement management screens over `AUTHZ` models. Outcome: manage users/roles.

### STORY (SEC-2) — Permissions Management

**Dependencies:** SEC-1.

- **Task: Permission config API + UI** — Implement role→permission mapping UI enforced by `AUTHZ`. Outcome: granular access control.

### STORY (SEC-3) — Audit Logs

- **Task: Audit-log service + viewer** 🔑 (reuses activity-log pattern) — Implement immutable logging of sensitive actions + filtered viewer. Outcome: traceability.

### STORY (SEC-4) — System Configuration

- **Task: Settings model + admin UI** 🔑 (backs branding/departments/branches/SLA defaults) — Implement central configurable settings. Outcome: org-level configuration.

---

---

# EPIC 14 — Multi-Department / Multi-Branch / Branding

**Description:** Organizational scoping (departments, branches) and custom branding. Scoping is a cross-cutting concern applied via a shared pattern; branding builds on system configuration.
**Depends on:** Ticket Management, SEC-4.

### STORY (ORG-1) — Multi-Department

- **Task: `Department` model + scoping pattern** 🔑 (reused by branch + reports) — Implement departments linking agents/tickets + a reusable scoping/filter mechanism. Outcome: department-scoped data.
- **Task: Department management UI** — Implement admin UI + scoped queues/reports. Outcome: function-based organization.

### STORY (ORG-2) — Multi-Branch

**Dependencies:** ORG-1.

- **Task: `Branch` model + scoping** — Implement branches associating users/customers/tickets reusing the scoping pattern. Outcome: branch-segmented data.
- **Task: Branch management UI** — Implement admin UI + branch-level access/reports. Outcome: branch structure.

### STORY (ORG-3) — Custom Branding

**Dependencies:** SEC-4.

- **Task: Branding settings + dynamic theming** — Implement logo/colors/name via system config applied through `UI` tokens. Outcome: brand-matched portal/app.

---

---

# EPIC 15 — Production Readiness

**Description:** Hardening for deployment — observability, performance, security review, and optional Docker packaging (future-ready, still not required for local dev).
**Depends on:** all prior epics.

### STORY (PROD-1) — Observability & Logging

- **Task: Structured logging + error monitoring** — Implement the `CONV` logging strategy end-to-end + error tracking. Outcome: diagnosable production issues.

### STORY (PROD-2) — Performance & Caching

- **Task: Query optimization + caching pass** — Add pagination/index review + caching where measured. Constraints: optimize by evidence, no premature tuning. Outcome: responsive at scale.

### STORY (PROD-3) — Security Hardening

- **Task: Security review** — Enforce authz coverage, rate limiting, input validation audit, secret handling review. Outcome: reduced attack surface.

### STORY (PROD-4) — Optional Docker Packaging

- **Task: Docker/compose (optional)** — Provide optional containerization for parity. Constraints: **must not** become required for local dev; local (non-Docker) path stays first-class. Outcome: future-ready deployment.

---

## Foundation Map (what must exist before features)

- `ARCH`, `CONV`, `ENV`, `API` → EPIC 0
- `I18N`, `UI`, `FORM` → EPIC 1
- `AUTHZ` → EPIC 2
- Messaging core (Message + adapter + conversation UI) → EPIC 5 (COMM-0)
- Background jobs (SLA-0), Notifications (SLA-4) → EPIC 7
- KB search retrieval (KB-3) → EPIC 8
- Reporting foundation (RPT-0) → EPIC 10
- AI service foundation (AI-0) → EPIC 11
- Org scoping pattern (ORG-1), System config (SEC-4) → EPIC 13/14

**Rule for every later task:** consume these foundations by reference; never re-implement them.
