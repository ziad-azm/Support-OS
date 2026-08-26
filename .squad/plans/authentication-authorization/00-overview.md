# authentication-authorization — plan overview

Entry point for the **authentication-authorization** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 08 | [08-story-authentication-jwt-SUPPORTOS-26.md](08-story-authentication-jwt-SUPPORTOS-26.md) | Authentication (JWT) | SUPPORTOS-26 | Stories 05, 06, 07 (`I18N`, `UI`, `FORM`); FND-2/FND-3 |

## Dependency notes

This feature maps to **EPIC 2 — Authentication & Authorization** in `SupportOs backlog.MD` (lines 215–258). It depends on EPIC 0 (`API`, `ENV`, `CONV`) and EPIC 1 (`UI`, `I18N`, `FORM`) being complete, which they are — see [`../internationalization-design-system/00-overview.md`](../internationalization-design-system/00-overview.md).

`AUTH-1` (story 08) → `AUTH-2` (not yet planned). AUTH-2 depends on AUTH-1's `User` model and `JWTAuthentication` wiring to add roles and tighten `DEFAULT_PERMISSION_CLASSES`, which story 08 deliberately leaves at `AllowAny`.

**Shared spec produced here:**

| Spec | Established by | What it fixes |
|---|---|---|
| `AUTHZ` (authentication half) | Story 08 | A custom email-based `User` model; JWT obtain/refresh/logout/me endpoints through the standard envelope with zero response-shape customisation; global `JWTAuthentication`; a frontend `shared/auth/` module (in-memory access token, persisted refresh token, single-flight silent-refresh-and-retry interceptor) as the single source of auth state; a `RequireAuth` route guard; a `LoginPage` built on `FORM`. Role/permission enforcement (`AUTHZ`'s other half) is AUTH-2. |

**Verified findings that shaped story 08:**

- **The stock `simplejwt` views need no subclassing.** `EnvelopeJSONRenderer` wraps any non-`Envelope` response body automatically, so `TokenObtainPairView`/`TokenRefreshView` satisfy "no custom response shapes" as shipped.
- **The exception handler's error `code` comes from the exception class, not the raised instance** — verified empirically. Bad login credentials and a bad/expired token land on two different, already-partially-covered codes: `authentication_failed` (existing) and `token_not_valid` (new).
- **The login serializer's dynamic field name matches `FORM`'s server-error bridge with zero mapping**, once `USERNAME_FIELD = "email"` is set — the same payoff § 12's snake_case-end-to-end rule already produced for story 07.
- **Introducing `AUTH_USER_MODEL` required a one-time local database reset**, verified safe (0 users, 0 sessions) because this is the first story to touch real data models in this project.
- **A naive refresh interceptor breaks itself under concurrency** once `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` are on — a second parallel refresh call presents a token the first call already blacklisted. Story 08's `refreshAccessToken()` is a single-flight promise specifically because of this.

**Note on testing:** per standing project policy this project authors no automated tests. Story 08 adds none; its checks are `npm run build`/`lint`/`format:check`/`check:rtl`, the backend's `manage.py check`/`test`/`ruff`, and manual bilingual, end-to-end walkthroughs of the actual login/refresh/logout flow — the kind of correctness (silent refresh, concurrent-401 dedup, server-side token revocation) a static check cannot see.
