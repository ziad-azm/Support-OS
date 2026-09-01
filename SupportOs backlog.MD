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
  - `DSN` — AI-generated design intelligence: palette, typography, UI patterns, UX/accessibility guidelines, chart guidance (EPIC 8, extends `UI`)

- **Token-efficiency rule for every implementation task (applies globally — do not repeat in each task):**
  1. **Inspect before modify:** read the relevant existing files and the referenced Shared Specs first; reuse existing code/abstractions; change only what's necessary.
  2. **Reference, don't repeat:** depend on the Shared Specs by ID instead of restating architectural rules.
  3. **No duplication:** if a shared component/util/hook exists, use it; do not recreate it.
  4. **Minimal report on completion:** report only → _what changed · files changed · blockers · next recommended task_. No long explanations unless asked.

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
  - Implement: one doc covering — folder structure & file placement; naming conventions; TypeScript conventions; API communication conventions (reference `API`); error/loading/empty handling; validation approach (reference `FORM`); reusable-component rule (reference `UI`); shared utilities; env/config (reference `ENV`); logging strategy (frontend + backend); API response conventions; frontend/backend boundaries; auth conventions (reference `AUTHZ`); linting/formatting; import conventions; explicit "check for existing implementation before writing new code" rule.
  - Constraints: concise and reference-based; later tasks link to `CONV` rather than repeating rules.
  - Depends on: FND-1/2/3.
  - Outcome: a single source of truth every task cites.

- **Task: Linting, formatting & CI checks** 🔑
  - Implement: ESLint + Prettier (frontend), Black + Ruff/isort (backend), pre-commit hooks, and a CI job running lint for both apps.
  - Constraints: enforce `CONV` import/naming rules automatically.
  - Depends on: CONV task.
  - Outcome: consistent style enforced on every commit.

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

### STORY (TKT-6) — Category Management UI

**⏭ Next up.**
**Description:** `TKT-2` already shipped the `Category` model and its management API — but no in-app screen, so Django Admin has been the only way to add/edit/delete a category. This story closes that gap with a small, dedicated screen inside the app itself.
**Dependencies:** TKT-2.

- **Task: Category CRUD UI** — Implement a simple list + create/edit/delete screen for `Category`, reusing the existing `UI` table/primitives and `FORM` (RHF+Zod), calling `TKT-2`'s already-built `Category` API — no backend change needed. Constraints: reuse `AUTHZ` (`tickets.manage`, matching the permission other ticket-admin actions already use); no new permission string unless a real gap is found. Outcome: categories are managed from the app, Django Admin no longer required for day-to-day use.

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

# EPIC 8 — Design Intelligence & UI/UX System

**Description:** Applies AI-driven design intelligence (via the `ui-ux-pro-max` skill) to generate and codify a tailored design system — palette, typography, UI patterns, accessibility/UX guidelines, and chart guidance — layered on top of `UI` (EPIC 1) and retrofitted across already-built screens (EPIC 0-7) before Knowledge Base and later features add more UI. Also runs the dedicated _audit → fix → verify_ pass (`DSN-6`–`DSN-13`) over the entire built product (EPICs 0–11) from a professional UI/UX perspective — cross-feature consistency, usability, interaction/feedback, responsiveness, forms, information architecture, and bilingual content quality — before AI Features and later epics add more surface.
**Depends on:** Internationalization & Design System (`UI`, `I18N`), Agent Workspace (existing built screens).

### STORY (DSN-0) — Design Intelligence Foundation

**As a developer, I want an AI-generated design system tailored to a customer-support SaaS product, so that all future UI work reuses a consistent, justified set of design decisions instead of ad-hoc choices.**

- **Task: Generate tailored design system via `ui-ux-pro-max` skill** 🔑 (reused by Knowledge Base, Portal, Reports charts, Branding) — Run the skill against SupportOS's product type (B2B customer-support platform) to produce a recommended UI style, color palette, typography pairing, layout patterns, and anti-patterns to avoid. Codify the output as the `DSN` shared spec, extending `UI` (does not replace it). Outcome: one authoritative, reusable design-system spec.
- **Task: Reconcile `DSN` with existing `UI` tokens** — Map the generated palette/typography onto the existing Tailwind/shadcn tokens from EPIC 1; document any deltas and how they're resolved. Constraints: no visual regression without an explicit decision. Outcome: `DSN` and `UI` stay in sync, not competing sources of truth.

### STORY (DSN-1) — Design System Refresh Across Built Screens

**Dependencies:** DSN-0.

- **Task: Apply refreshed tokens to existing screens** — Retrofit already-built screens (EPICs 0-7) with `DSN`'s palette/typography via `UI` primitives only. Constraints: token/style updates only, no re-architecture of existing components. Outcome: visually consistent app before new features add more surface.

### STORY (DSN-2) — UX Guidelines & Accessibility Audit

**Dependencies:** DSN-0.

- **Task: Run UX/anti-pattern + accessibility checklist** — Apply the skill's UX guidelines and pre-delivery accessibility checklist across built screens; log and fix flagged issues (contrast, text resilience, focus states, RTL per `I18N`). Outcome: accessibility/UX debt cleared before it compounds.

### STORY (DSN-3) — Dashboard Chart Design Guidance

**Dependencies:** DSN-0.

- **Task: Capture chart-type guidance for future dashboards** 🔑 (reused by Reports & Analytics `RPT-0`) — Record the skill's chart-type recommendations (by data shape/use case) as part of `DSN`, for the shared chart wrapper built later in Reports & Analytics. Outcome: chart choices are justified up front, not picked ad hoc when `RPT-0` is built.

### STORY (DSN-4) — Comprehensive Visual Redesign of Built Screens

**As a user, I want the app to look polished and visually considered instead of flat and generic, so that using it feels trustworthy and professional.**
**Description:** DSN-1 only swapped color/font/radius tokens — a deliberate narrow scope, not a full redesign. Screens still read as unstyled shadcn defaults: uniform-gray status/priority badges with no semantic color, no iconography, no density/hierarchy polish on tables and forms. This story goes past the token swap to make every already-built screen actually look designed, using `DSN`'s guidance (`design-system/supportos/MASTER.md`) and the `ui-ux-pro-max` skill, while staying inside the existing shadcn/ui + Tailwind v4 primitive set — visual/styling only, no new component library and no re-architecture of data flow or logic.
**Dependencies:** DSN-0, DSN-1.

- **Task: Semantic status/priority color-coding** — Extend the shared `Badge` primitive's variants (or add new ones) so ticket status, priority, notification kind, and task state render with distinct, meaningful colors (e.g. success/warning/danger/info) per `DSN`'s palette, instead of one uniform gray pill. Constraints: reuse the existing `badge.tsx` primitive and `DSN` tokens; no per-feature badge reimplementation. Outcome: status is scannable at a glance across every list view.
- **Task: Iconography pass** — Add icons (via the icon library already bundled with shadcn) to primary actions, nav items, status badges, and empty states per `DSN` guidance. Constraints: reuse one icon set consistently; no mixed icon libraries. Outcome: improved scannability and a less "bare" feel.
- **Task: Spacing, density & table polish** — Apply `DSN`'s spacing scale and visual-hierarchy guidance to the shared `DataTable` pattern, page headers, and form layouts every already-built screen composes from. Constraints: shared-component-level changes only, so every consuming screen inherits the fix. Outcome: consistent, less flat layout app-wide with no per-page rework.
- **Task: Full-app visual QA pass** — Walk every already-built route (same list as DSN-1's `## Verification Steps`) confirming the refresh landed consistently; log and fix any straggler screen. Outcome: no unstyled screen left behind.

### STORY (DSN-5) — App Shell Redesign: Sidebar Navigation & Theme Backgrounds

**As a user, I want a proper sidebar and a considered light/dark background palette instead of a bare top bar and flat grayscale surfaces, so that navigating the app feels like a real product, not a scaffold.**
**Description:** Complements `DSN-4`. That story polishes existing components in place; this one changes the app **shell** itself — the current top-bar nav (`frontend/src/app/RootLayout.tsx`) becomes a sidebar, and the base surface tokens (background/card/muted/border — not just the accent colors `DSN-1` already retinted) get a real light/dark treatment. This is the one story in `EPIC 8` that is _not_ token-only — converting the nav from a header to a sidebar is a deliberate layout restructuring, done carefully to preserve every existing permission gate, i18n label, and route unchanged.
**Dependencies:** DSN-0. Complements DSN-4 (either order is fine; both build on `DSN`'s spec).

- **Task: Sidebar navigation shell** — Replace `RootLayout.tsx`'s top `<nav>` with a collapsible sidebar (start-side in LTR, end-side in RTL, per `I18N`'s logical-direction rules), preserving every existing `<Can permission="...">`-gated link, i18n label, the notification bell, and logout exactly as they behave today — only the container markup and layout change, not the route/permission logic. Outcome: real app-shell navigation instead of a single crowded header row.
- **Task: Light/dark background & surface refresh** — Beyond `DSN-1`'s accent-only swap (`--primary`/`--secondary`/`--destructive`), retint the base surface tokens (`--background`, `--foreground`, `--card`, `--muted`, `--border`) in `frontend/src/index.css` for both `:root` and `.dark` per `DSN`'s guidance, so the new sidebar and every page have real depth/contrast instead of shadcn's default flat grayscale. Outcome: light and dark mode both look designed, not just recolored accents on a gray canvas.
- **Task: Button & input primitive polish** — Refine the shared primitives every form and screen already composes from (`shared/ui/primitives/button.tsx`, `input.tsx`, `select.tsx`, and the shared field components in `shared/ui/form/`) with `DSN`'s guidance on shadows, hover/focus/active states, and sizing. Constraints: component-level only — no per-feature overrides — so every consuming screen inherits the polish automatically. Outcome: every button and input in the app feels considered, not default shadcn.
- **Task: Full-app QA pass** — Verify the sidebar and new theme across every already-built route, in both languages/directions (`ar`/RTL, `en`/LTR) and both color modes (light/dark), confirming permission-gated links still show/hide correctly and no screen is left half-migrated. Outcome: one consistent, polished shell everywhere.

**Thread guardrail (DSN-6 through DSN-13 below):** frontend visual/UX only, inside the existing shadcn/ui + Tailwind + `DSN`/`UI` primitives. No data-flow, API, or route-logic changes; no new component library; permission gates and i18n keys preserved exactly. Fixes land at the **shared-component/foundation level** wherever possible so every consuming screen inherits them (no per-page rework).

### STORY (DSN-6) — Full UI/UX Audit & Issue Register

**As a product team, we want one professional audit of the entire built UI, so that inconsistencies and usability issues are found and prioritized once, and every fix traces back to a recorded finding.**
**Description:** A single systematic review of every already-built route (EPICs 0–11) through `ui-ux-pro-max` plus a Nielsen heuristic pass, cataloguing what's inconsistent or hard to use. This is the "identify" half — it produces the register the remediation stories act on, so the app is never re-scanned from scratch.
**Dependencies:** DSN-0, DSN-4, DSN-5 (audit reflects the current refreshed UI).

- **Task: Produce the prioritized UX issue register** 🔑 (consumed by DSN-7–DSN-13) — Implement: walk every built route via `ui-ux-pro-max` + a heuristic checklist (consistency, feedback, error prevention, recognition-over-recall, minimalism, match to real workflow); record each finding in `design-system/supportos/UX-AUDIT.md` with a stable ID, screen, category (consistency / interaction / responsive / form / IA / content / bilingual), severity (critical/major/minor), and recommended fix + owning DSN story. Constraints: catalogue only — no code changes here beyond trivially obvious one-liners; reference `DSN`/`UI`/`I18N`, don't restate them. Outcome: one authoritative, ID'd issue register that all remediation references.

### STORY (DSN-7) — Cross-Feature Consistency Remediation

**As a user, I want every screen to behave and read the same way, so that patterns I learn in one feature carry everywhere.**
**Description:** Fixes the register's `consistency` findings — divergent patterns that crept in as features were built independently (button order/placement, primary-action naming, page-header structure, modal-vs-inline choices, table column/date conventions, badge usage). Fixes land in shared components so consistency is structural, not per-screen.
**Dependencies:** DSN-6.

- **Task: Standardize page & action patterns at the shared level** — Implement: from the register's `consistency` items, converge page-header layout, primary/secondary button order & placement, and action naming onto one pattern via the shared layout/primitive components; align date/number display on the `I18N` formatters. Constraints: change shared components, not individual screens; update register entries to resolved. Outcome: one consistent interaction vocabulary app-wide.
- **Task: Consolidate divergent UI patterns** — Implement: replace any one-off tables/dialogs/dropdowns that bypassed the `UI` primitives with the shared ones flagged in the register. Constraints: reuse-first, no new variants unless the register proves a real gap. Outcome: no duplicated UI patterns remain.

### STORY (DSN-8) — Interaction, State & Feedback Polish

**As a user, I want the app to respond clearly to what I do, so that every action feels acknowledged and nothing feels frozen or silent.**
**Description:** Fixes the register's `interaction` findings — inconsistent or missing hover/focus/active/disabled states, jarring or absent transitions, spinner-vs-skeleton inconsistency, and toast/confirm-dialog inconsistency. Distinct from `DSN-4` (static visual styling) — this is behavior and feedback over time.
**Dependencies:** DSN-6. Complements DSN-4/DSN-5.

- **Task: Unify component interaction states** — Implement: apply consistent hover/focus/active/disabled treatments per `DSN` to the shared button/input/select/row primitives; ensure keyboard focus is always visible and RTL-correct. Constraints: primitive-level only. Outcome: predictable, uniform feedback on every interactive element.
- **Task: Standardize loading, transition & notification feedback** — Implement: converge on the shared loading/empty/error states (skeletons for lists, inline for actions), add restrained transitions per `DSN`, and make all toasts/confirms use the shared patterns wired to the `API` error model. Constraints: reuse EPIC 1 state components; no per-feature spinners. Outcome: consistent, calm feedback throughout.

### STORY (DSN-9) — Responsive & Mobile UX Remediation

**As a user on a phone or tablet, I want every screen to be fully usable, so that the "responsive" requirement holds in practice, not just in theory.**
**Description:** Fixes the register's `responsive` findings across all built routes at mobile/tablet breakpoints — sidebar collapse behavior (from `DSN-5`), dense tables that need a card/stacked view on small screens, touch-target sizing, and overflow/scroll issues, in both LTR and RTL.
**Dependencies:** DSN-5 (shell), DSN-6.

- **Task: Add responsive behavior to the shared table & layout patterns** — Implement: give the shared `DataTable`/list pattern a small-screen presentation (stacked/card or prioritized columns) and fix page-shell overflow at each breakpoint. Constraints: shared-pattern level so all lists inherit it; verify RTL. Outcome: list-heavy screens work on mobile everywhere at once.
- **Task: Per-screen responsive fixes & touch targets** — Implement: resolve remaining register `responsive` items (forms, side panels, dialogs, chart placeholders) and enforce minimum touch-target sizing via shared primitives. Constraints: styling/layout only. Outcome: no broken or cramped screen on mobile/tablet.

### STORY (DSN-10) — Forms & Data-Entry UX Remediation

**As a user filling in forms, I want clear, forgiving, consistent data entry, so that I always know what's expected and how to fix mistakes.**
**Description:** Fixes the register's `form` findings at the `FORM` foundation so every form inherits the improvement — validation timing (on-blur/submit, not aggressive on-change), readable localized error messaging, error summary + focus-to-first-error, logical field grouping/order, autofocus, and clear submit/loading/disabled states.
**Dependencies:** FORM-1, DSN-6.

- **Task: Improve validation & error UX in the shared form foundation** 🔑 (all forms inherit) — Implement: standardize validation trigger timing, localized (via `I18N`) inline messages, an error-summary + focus-first-error behavior, and consistent submit/pending/disabled states in the shared RHF+Zod field components. Constraints: change `FORM` shared components only; no per-feature validation. Outcome: every form in the app gets consistent, forgiving data-entry UX from one change.
- **Task: Field grouping, order & focus review** — Implement: apply the register's per-form layout/order/autofocus fixes using shared field components. Constraints: composition-level, no bespoke fields. Outcome: forms read logically and are keyboard-friendly.

### STORY (DSN-11) — Navigation & Information Architecture Review

**As a user, I want to always know where I am and how to get where I'm going, so that finding features and moving between them is effortless.**
**Description:** Fixes the register's `IA` findings — nav grouping/labels and active-state clarity (on the `DSN-5` sidebar), consistent page titles/breadcrumbs, discoverability of admin/config areas, and sane back/deep-link behavior. Preserves every existing permission-gated route exactly.
**Dependencies:** DSN-5, DSN-6.

- **Task: Refine navigation structure & wayfinding** — Implement: group/label sidebar items and make active/current state unambiguous; add consistent page titles/breadcrumbs via the shared shell. Constraints: presentation only — routes and `Can`-gates unchanged. Outcome: clear, learnable navigation.
- **Task: Fix IA discoverability & back/deep-link behavior** — Implement: resolve register items on hard-to-find admin/config surfaces and inconsistent back/deep-link handling. Constraints: no route logic changes. Outcome: features are discoverable and navigation is predictable.

### STORY (DSN-12) — Microcopy & Bilingual (AR/EN) Quality Review

**As an Arabic or English user, I want labels, empty states, and error messages that read naturally and mirror correctly, so that the product feels professionally localized, not machine-translated.**
**Description:** Fixes the register's `content` and `bilingual` findings — inconsistent terminology/tone, weak empty-state and error copy, and Arabic/English parity + RTL mirroring gaps. A professional bilingual pass over the `I18N` strings; complements `DSN-2`'s structural RTL checklist by focusing on language quality and parity.
**Dependencies:** I18N-1, DSN-6.

- **Task: Terminology, tone & empty/error copy pass** — Implement: standardize terminology and improve empty-state/error/confirmation copy in the `I18N` namespaces (both languages). Constraints: edit translation resources only; no hardcoded strings introduced. Outcome: consistent, helpful microcopy everywhere.
- **Task: Arabic/English parity & RTL correctness review** — Implement: verify every key exists and reads naturally in both languages and that AR mirrors correctly (icons, directionality, number/date rendering) per `I18N`; fix gaps. Constraints: content/direction only. Outcome: true bilingual parity, professionally localized.

### STORY (DSN-13) — Final UX Verification & Sign-off

**As a product team, we want to confirm the review actually closed the issues, so that we enter later features (AI, Integrations, Admin, Branding) on a clean, consistent UI baseline.**
**Description:** Re-walks the register to confirm every critical/major item is resolved with no regressions, across both languages/directions and both color modes. The "verify" bookend of the audit→fix→verify thread.
**Dependencies:** DSN-7, DSN-8, DSN-9, DSN-10, DSN-11, DSN-12.

- **Task: Verify register to zero open criticals & sign off** — Implement: re-check each `UX-AUDIT.md` finding on its screen in `ar`/RTL + `en`/LTR and light/dark; mark resolved, log any regressions as new items, and record sign-off. Constraints: verification + straggler fixes only. Outcome: a clean, consistent UI baseline for all later feature work.

### STORY (DSN-14) — Post-Sign-off UX Findings

**As a product team, we want a running home for UI/UX issues users report after `DSN-13`'s sign-off, so that real-world feedback keeps improving the baseline instead of needing a new story per finding.**
**Description:** Reported by users once the app was in real use, after `DSN-6`–`DSN-13`'s audit→fix→verify thread had already closed — not part of the original `DSN-6` register. Each distinct finding is its own `Task` below, added as it comes in; this story accumulates rather than closing after one pass.
**Dependencies:** DSN-13.

- **Task: Fix sidebar scroll visibility on long pages** — Implement: reported via screenshot of `/tickets/:id` (staff ticket detail), dark theme — scrolling down a long page's content scrolls the sidebar (`app/Sidebar.tsx`, rendered inside `RootLayout.tsx`) out of view along with it, instead of the sidebar staying pinned to the viewport while only `<main>` scrolls. Confirm the actual current scroll structure of `RootLayout.tsx`/`Sidebar.tsx` against the reported symptom first — `Sidebar.tsx`'s `<aside>` is `h-dvh` with an internal `overflow-y-auto` `<nav>`, which reads as intended to stay viewport-pinned, so whether `RootLayout.tsx` (or a shared ancestor) actually isolates scroll to `<main>` or lets the whole page scroll as one unit isn't yet diagnosed. Not yet confirmed whether this reproduces on other long staff pages (`/customers/:id`, `/knowledge-base/articles/:id/edit`, etc.) or only on ticket detail. Constraints: layout/CSS-only, no route or permission-gate changes; verify across the same route set `DSN-9`/`DSN-13` already covered. Outcome: the sidebar stays reachable no matter how far the page is scrolled.
- **Task: Strengthen action-button affordance app-wide (icon + color, not just Roles)** — Implement: originally reported via screenshot of `/roles` (Roles list) — a deletable role's Actions cell renders `RoleListPage.tsx`'s existing `<Button size="sm" variant="ghost">` delete action with no visible border/background, reading ambiguously next to a system role's bordered "System" `Badge` in the same column. **Broadened by a second screenshot**, a different list's Actions column showing 8 rows that each just read "Delete" in plain bold ghost-button text with zero visual differentiation row-to-row and no badge/color/icon at all — user's own direction: "make it with color or have also bin icon." Verified against current code — every `DataTable` "Delete"/destructive action across the app (`RoleListPage.tsx`, `CategoryListPage.tsx`, `TaskListPage.tsx`, `FaqListPage.tsx`, `ArticleListPage.tsx`, and others) uses the identical `<Button size="sm" variant="ghost">{t('...actions.delete')}</Button>` pattern — not broken, but uniformly low-affordance app-wide, not a Roles-specific gap. Give destructive row actions a real affordance via the shared `Button`/`DataTable` pattern — e.g. a trash/bin icon (`lucide-react`'s `Trash2Icon`, already the icon set this app standardizes on per `DSN-4`) and/or a destructive-tone color treatment, not just plain text — applied once at the shared level so every `DataTable` consumer inherits it, not a one-off per screen. Constraints: shared-component level; no new component library; preserve existing `useConfirm()` gating on every delete action untouched. Outcome: every destructive row action is visually distinct and unambiguous at a glance, app-wide.
- **Task: Re-evaluate reports/charts on a real charting library** — Implement: reported via screenshot of `/reports/tickets` (Ticket Reports, "Ticket volume over time") — user's own words: "all reports not good want to use best lib to charts and reports". Verified against current code: every chart in the app (`LineChart`, `BarChart`, `GaugeChart`, `WaffleChart`, `ChartDataTable`, all under `frontend/src/shared/ui/chart/`) is hand-built inline SVG with no charting library dependency at all (`frontend/package.json` has no `recharts`/`chart.js`/`visx`/`d3`/`nivo` or similar) — `DSN-3`'s chart-type guidance (`CONVENTIONS.md` § 25) picked chart *types* per report but never evaluated adopting a real charting library for the *implementation*. This is a genuine "no new dependency" decision, the same category `UX-018` (Story 65) deferred rather than assumed — needs a product decision on which library (e.g. `recharts`, `visx`, `chart.js`) before a rebuild is planned, weighed against a possible narrower fix (polish the existing hand-built `LineChart`'s rendering — e.g. `/reports/tickets`'s "Last 30 days" default currently plots ~28 zero-value points before a 2-point spike, which reads as broken/empty at a glance) if a full library swap turns out to be disproportionate. Outcome: a scoped decision — adopt a charting library (and which one) or polish current charts — recorded before any rebuild starts, not silently assumed.
- **Task: Shrink the sidebar footer and move theme/language into a real settings surface** — Implement: reported via screenshot of the `Sidebar.tsx` footer block (`RootLayout.tsx`'s sidebar, bottom section) — user wants the notification-bell/email/language/theme/logout block made visually smaller, and wants a dedicated settings page to host the dark-mode toggle and language switcher instead of the sidebar footer, which should then drop them. Verified against current code: the footer (`Sidebar.tsx` lines 285-311) is 3 stacked rows (`NotificationBell` + email; `LanguageSwitcher` + `ThemeToggle`; the `Log out` button), each with its own `gap-3`/`p-3` padding — the visual bulk the screenshot shows. **Constraint that must be resolved before implementing, not assumed:** the only existing `/settings` route (`features/organization/components/SettingsPage.tsx`) is an **org-admin** form (name/logo/departments/branches/SLA targets) gated behind `settings.manage` — most staff users can't reach it, so moving a personal preference like theme/language there as-is would make it unreachable for non-admins. This needs either a new, ungated **user-preferences** page (or a tab/section within a broader settings area open to every authenticated user, separate from the admin-only org config) — not simply appending fields to the existing gated form. Constraints: preserve the theme/language state mechanism already in place (`ThemeToggle`/`LanguageSwitcher`, `i18n`/local storage), only relocate + restyle; no permission-gate regression (the new surface must stay open to every authenticated user, unlike `/settings`). Outcome: a visually lighter sidebar footer (bell, email, logout only) and a real, universally-reachable place for personal display preferences.
- **Task: Audit `Badge`/tag color usage app-wide for consistency** — Implement: user's own direction: "see all colors in tags please add comments with realted task" — a request to review every `Badge` usage across the app, not a specific defect reported yet. Verified against current code (not yet a full audit): the shared `badge.tsx` primitive (`frontend/src/shared/ui/primitives/badge.tsx`) declares 9 variants — `default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`, `link` — added incrementally across `DSN-4` (semantic status/priority color-coding) and later stories; no single pass has re-walked every current `Badge` call site (ticket status/priority, task state, article draft/published, role "System", audit-log action, SLA breach state, etc.) to confirm each still picks the semantically correct variant and that no two unrelated meanings share the same color by coincidence. Walk every `<Badge variant="...">` call site app-wide and confirm/correct variant choice against its actual semantic meaning (success = positive/resolved, warning = at-risk, destructive = breached/error, etc.), consistently. Constraints: shared-component level where a systemic mismatch is found; no new badge variant unless a real semantic gap is proven, matching `DSN-4`'s own original bar. Outcome: every tag/badge color in the app is semantically correct and consistent, confirmed by an actual walk of every call site, not assumed.
- **Task: Style primary-column table links so they read as links** — Implement: reported via screenshot of `/categories` (Category list), "Name" column — "Account Access", "Billing", "Bug Report", "Feature Request" render as plain white text with no color/underline; user's own words: "this is link but as ui ux i dont know that so can make it color or anything". Verified against current code: `CategoryListPage.tsx:48` renders `<Link to={...}>{row.name}</Link>` with no `className` at all — Tailwind's Preflight reset strips the browser's default link underline/color, so with nothing added back it's visually indistinguishable from static text. **Confirmed app-wide, not category-specific:** the identical bare, unstyled `<Link to=...>{row.field}</Link>` pattern (in a `DataTable` primary-column `cell`) also exists in `TaskListPage.tsx`, `FaqListPage.tsx`, `PortalTicketHistoryPage.tsx`, `PortalTicketListPage.tsx`, `CustomerListPage.tsx`, `MyTicketsPage.tsx`, `TicketListPage.tsx`, `RoleListPage.tsx`, `UserListPage.tsx` (a literal grep match — likely not fully exhaustive; `ArticleListPage.tsx`'s multi-line variant of the same pattern wasn't caught by the grep but should be checked too). Give every `DataTable` primary-column link a real, consistent link affordance (e.g. `text-primary` + `hover:underline`, or an underline by default) at the shared level — ideally a small shared style/class applied once, not 10+ per-file edits — so every consuming list inherits it. Constraints: shared-component/CSS-utility level preferred; preserve every existing `to`/route target exactly; verify contrast holds in both light/dark. Outcome: every clickable table-cell link is visually recognizable as a link, everywhere in the app, from one change.

---

# EPIC 9 — Knowledge Base

**Description:** FAQs, help articles/guides, and search — powering self-service and AI suggestions later. Built on the `DSN` design system from EPIC 8.
**Depends on:** foundations, AUTH-2, Design Intelligence (`DSN`).

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

# EPIC 10 — Customer Portal

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

# EPIC 11 — Reports & Analytics

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

# EPIC 12 — AI Features

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

# EPIC 13 — Integrations

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

# EPIC 14 — Security & Administration

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

# EPIC 15 — Multi-Department / Multi-Branch / Branding

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

# EPIC 16 — Production Readiness

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
- `DSN` design system + chart guidance (DSN-0, DSN-3) → EPIC 8
- KB search retrieval (KB-3) → EPIC 9
- Reporting foundation (RPT-0) → EPIC 11
- UX issue register (`design-system/supportos/UX-AUDIT.md`) → EPIC 8 (DSN-6); consumed by DSN-7–DSN-13
- Shared form UX behavior (validation timing, error summary, focus) → EPIC 8 (DSN-10), extends `FORM`
- Responsive table/shell patterns → EPIC 8 (DSN-9), extend `UI`/`DSN-5`
- AI service foundation (AI-0) → EPIC 12
- Org scoping pattern (ORG-1), System config (SEC-4) → EPIC 14/15

**Rule for every later task:** consume these foundations by reference; never re-implement them.
