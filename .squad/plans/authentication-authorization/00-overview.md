# authentication-authorization — plan overview

Entry point for the **authentication-authorization** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 08 | [08-story-authentication-jwt-SUPPORTOS-26.md](08-story-authentication-jwt-SUPPORTOS-26.md) | Authentication (JWT) | SUPPORTOS-26 | Stories 05, 06, 07 (`I18N`, `UI`, `FORM`); FND-2/FND-3 |
| 09 | [09-story-roles-permissions-authorization-SUPPORTOS-27.md](09-story-roles-permissions-authorization-SUPPORTOS-27.md) | Roles, Permissions & Authorization | SUPPORTOS-27 | Story 08 |
| 84 | [84-story-role-based-post-login-landing-SUPPORTOS-123.md](84-story-role-based-post-login-landing-SUPPORTOS-123.md) | Role-Based Post-Login Landing | SUPPORTOS-123 | Stories 09, 42 |

**EPIC 2 is complete.** Stories 08-09 are implemented and verified. Story 84 (`SUPPORTOS-123`, backed by `SupportOs backlog.MD` STORY (AUTH-3) — Role-Based Post-Login Landing) is planned, not yet implemented.

**Story 84's scope note:** an earlier planning pass on this same ticket ran against an empty-description Jira fetch and produced a narrower plan (a role-name badge on `HomePage`, no redirect change). The intake has since been filled in with the real scope, matching AUTH-3: a `portal.access`-only account is redirected from `/` to the existing `/portal` tree (Story 42), both on post-login and on a direct hit of `/`; every other account is unaffected. No backend change. See the story file's `## Story Goal` for the full scope, including what stays explicitly out (STORY (CUST-5) — Portal Access Management is the separate, already-planned story for granting/revoking portal access itself: [../customer-management/85-story-portal-access-management-SUPPORTOS-122.md](../customer-management/85-story-portal-access-management-SUPPORTOS-122.md)).

## Dependency notes

This feature maps to **EPIC 2 — Authentication & Authorization** in `SupportOs backlog.MD` (lines 215–258). It depends on EPIC 0 (`API`, `ENV`, `CONV`) and EPIC 1 (`UI`, `I18N`, `FORM`) being complete, which they are — see [`../internationalization-design-system/00-overview.md`](../internationalization-design-system/00-overview.md).

`AUTH-1` (story 08) → `AUTH-2` (story 09). **With story 09 planned, EPIC 2 is fully planned and `AUTHZ` is whole.**

Story 09 depends on story 08's `User` model and `JWTAuthentication` wiring. It does **not** tighten `DEFAULT_PERMISSION_CLASSES` — see the note below.

**The EPIC 13 boundary that shapes story 09.** `SupportOs backlog.MD` line 684 assigns the *user/role admin API + UI* to **SEC-1**, and line 691 assigns the *role→permission mapping UI* to **SEC-2**. So AUTH-2 ships the models and the mechanism; the screens over them are a later epic's. That boundary is also what forces story 09's central data-model decision (see below) — a mapping SEC-2 must edit through a UI cannot live in a Python dict.

**Shared specs produced here:**

| Spec | Established by | What it fixes |
|---|---|---|
| `AUTHZ` (authentication half) | Story 08 | A custom email-based `User` model; JWT obtain/refresh/logout/me endpoints through the standard envelope with zero response-shape customisation; global `JWTAuthentication`; a frontend `shared/auth/` module (in-memory access token, persisted refresh token, single-flight silent-refresh-and-retry interceptor) as the single source of auth state; a `RequireAuth` route guard; a `LoginPage` built on `FORM`. |
| `AUTHZ` (authorization half) | Story 09 | A `Role` model with three seeded roles; a code-defined permission vocabulary (`apps/core/permissions.py`) with a DB-backed role→permission mapping; `User.role`; one `HasPermission` DRF class driven by a declarative `permission_map`; `BaseModelViewSet` carrying it by default; `/auth/me/` exposing role + a flat permission list; and `can()` / `<Can>` / `RequirePermission` on the frontend. |

**Verified findings that shaped story 08:**

- **The stock `simplejwt` views need no subclassing.** `EnvelopeJSONRenderer` wraps any non-`Envelope` response body automatically, so `TokenObtainPairView`/`TokenRefreshView` satisfy "no custom response shapes" as shipped.
- **The exception handler's error `code` comes from the exception class, not the raised instance** — verified empirically. Bad login credentials and a bad/expired token land on two different, already-partially-covered codes: `authentication_failed` (existing) and `token_not_valid` (new).
- **The login serializer's dynamic field name matches `FORM`'s server-error bridge with zero mapping**, once `USERNAME_FIELD = "email"` is set — the same payoff § 12's snake_case-end-to-end rule already produced for story 07.
- **Introducing `AUTH_USER_MODEL` required a one-time local database reset**, verified safe (0 users, 0 sessions) because this is the first story to touch real data models in this project.
- **A naive refresh interceptor breaks itself under concurrency** once `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` are on — a second parallel refresh call presents a token the first call already blacklisted. Story 08's `refreshAccessToken()` is a single-flight promise specifically because of this.

**Cross-story contracts set by story 09:**

- **Views declare *permissions*, never roles.** A view names `customers.manage`; only a `Role` row names permissions in bulk. A view that reads `request.user.role` is the failure this story exists to prevent — greppable, and grepped for in its verification.
- **The permission vocabulary is code; the role→permission mapping is data.** `apps/core/permissions.py` is the only place a permission string is defined; `Role.permissions` is the only place a role's grants are stored. `Role.clean()` validates the second against the first so they cannot drift.
- **`BaseModelViewSet` is closed by default.** Subclassing it gets `IsAuthenticated + HasPermission` for free; that is the "applied via base viewset conventions" contract, and it is why `DEFAULT_PERMISSION_CLASSES` can safely stay `AllowAny`.
- **An action absent from `permission_map` is authenticated-only, not forbidden.** Deliberate: an unfinished map is more common than an intent to deny, and a silent 403 is the harder bug. Never rely on omission as a deny.
- **`/auth/me/`'s `permissions` list is the single source for the frontend.** `can()` reads it and never derives from `role` — because a superuser has every permission and no role.
- **A 403 is not an auth failure.** `ApiRequestError.isForbidden` is separate from `isAuth`; signing in again does not grant a permission.

**Verified findings that shaped story 09:**

- **Django's `auth.Permission` was unusable as the vocabulary, and the reason is measurable.** All **32** permissions that exist today belong to `accounts`/`admin`/`auth`/`contenttypes`/`sessions`/`token_blacklist` — there is not one domain model (`customers`, `tickets`, `sla`, … are empty apps). Since `auth.Permission` rows require a `ContentType`, building on them would mean inventing placeholder models or having no domain vocabulary until CUST-1. A code-defined string registry is decoupled from model existence, which is exactly what lets the mechanism ship before the domain.
- **SEC-2 forces the code/data split.** Backlog line 691 promises a *UI* for the role→permission mapping. A UI cannot edit a Python dict, so the mapping must be a database field — while the vocabulary must stay code, because a permission no view checks grants nothing and would be a lie in that UI.
- **`is_superuser` short-circuits `has_perm` to `True` for any string** — verified: `superuser.has_perm("totally.made_up")` is `True`. This creates a real trap: if `/auth/me/` returned only role-derived permissions, the backend would permit actions the UI hides, for the only account that currently exists. `UserSerializer.get_permissions` therefore returns the whole registry for a superuser, via the same `permissions_for` the API enforces with.
- **DRF, not our code, decides 401-vs-403** (`rest_framework/views.py:178–180`): unauthenticated → `NotAuthenticated` (401), authenticated-but-unauthorized → `PermissionDenied` (403). Both bypass AUTH-1's `token_not_valid`-only refresh interceptor, so the two mechanisms compose with **no interceptor change** — and `permission_denied`/`not_authenticated` are already translated in both languages, so story 09 adds **no** error code (unlike AUTH-1, which needed `token_not_valid`).
- **Plain `APIView`s have no `self.action`** — DRF sets it in `ViewSet.initialize_request`, so `MeView` and friends need the HTTP-method fallback in `HasPermission`.
- **`BaseModelViewSet` still has zero subclasses**, three stories after story 02 reserved it for exactly this. Story 09 arms it; CUST-1 is the first consumer.

**Note on testing:** per standing project policy this project authors no automated tests. Stories 08 and 09 add none. Story 08's checks are `npm run build`/`lint`/`format:check`/`check:rtl`, the backend's `manage.py check`/`test`/`ruff`, and manual end-to-end walkthroughs of the real login/refresh/logout flow — the kind of correctness (silent refresh, concurrent-401 dedup, server-side token revocation) a static check cannot see. Story 09 adds real HTTP checks across three accounts (superuser, Admin-role, Agent-role), which is the only way to prove the same permission decides both the API and the UI.

**Known gap carried out of story 09:** `can()`, `<Can>`, and `RequirePermission` ship with **no production call site**, because the screens that would gate anything belong to SEC-1. This is the third foundation in a row to ship ahead of its UI consumer (after story 06's `DataTable` and story 07's form pattern). The backend half is different: every endpoint from CUST-1 onward inherits enforcement the moment it subclasses `BaseModelViewSet`, with no per-feature code.
