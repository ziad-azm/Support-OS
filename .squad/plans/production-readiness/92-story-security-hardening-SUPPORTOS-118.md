# Story 92 — Security Hardening (PROD-3) (Story: SUPPORTOS-118)

## Prerequisites

- **Story 91 (`PROD-2`, `SUPPORTOS-117`) is complete and committed** (`f164c78`) — [91-story-performance-caching-SUPPORTOS-117.md](91-story-performance-caching-SUPPORTOS-117.md). It is a **hard** prerequisite, not a courtesy ordering, and the reason is verified below: **DRF's rate limiting is backed by `django.core.cache`** (`rest_framework/throttling.py:6,62` — `cache = default_cache`). Before `PROD-2` configured Redis, that cache was Django's default `LocMemCache`: per-process, per-worker, wiped on reload. **Every throttle this story adds would have been per-worker** — N gunicorn/daphne workers would have allowed N× the configured rate — **and the one throttle this project already had has been silently under-enforced for exactly that reason since `SEC-7` shipped it.** `PROD-2` is what makes rate limiting real.
- **Story 88 (`PROD-1`, `SUPPORTOS-116`) is complete and committed** (`3da9f28`). Its `AccessLogMiddleware` is how a throttled request is observed: a 429 lands in the access log with its `request_id` and `http_status`, so a real attack is visible rather than inferred. Its `SENSITIVE_KEY_RE` scrubber and Sentry `before_send` are the secret-handling mechanism this story audits rather than rebuilds.
- **This story is a security *audit* first and a change second.** The audit below was run against the live codebase — 121 routes enumerated programmatically, 45 serializers instantiated and inspected, `manage.py check --deploy` run against production settings. **Three of the intake's four named axes came back essentially clean**, and this plan says so rather than inventing work to fill them. The fourth — rate limiting — is a genuine, wide gap.
- **Verified live: `manage.py check --deploy` against `config.settings.prod` reports ZERO Django security warnings.** All 36 reported issues are `drf_spectacular.W002` "unable to guess serializer" notices on plain `APIView`s — schema-generation noise, not security. Django's own deployment checklist is already satisfied: `SECURE_SSL_REDIRECT`, `SECURE_HSTS_*`, `SECURE_PROXY_SSL_HEADER`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` are all set in `prod.py:11-17`, and `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS`, `SECURE_REFERRER_POLICY`, `SECURE_CROSS_ORIGIN_OPENER_POLICY`, `SESSION_COOKIE_HTTPONLY` are all covered by Django 5.2's own secure-by-default values. **This story adds no `SECURE_*` setting**, because there is nothing left to add.
- **Verified live: the frontend already handles 429 end to end, so this story changes no frontend file.** `throttled` is in `API_ERROR_CODES` (`frontend/src/shared/lib/api/types.ts:18`) and translated in both languages (`locales/en/errors.json:16`, `locales/ar/errors.json:16`). DRF's `Throttled.default_code` is `"throttled"`, and `envelope_exception_handler` reads `default_code` (`apps/core/exceptions.py:46`), so a throttled request already returns `{"success": false, "error": {"code": "throttled", …}}` with DRF's own `Retry-After` header and already surfaces as a correct toast. **Verified by inspection, not assumed.**

---

## Audit findings

Every finding below was produced by running code against this repository, not by reading it. The two throwaway audit scripts are reproduced in `## Verification Steps` so any of it can be re-derived.

### Axis 1 — Authz coverage: **already complete. No fix required.**

All 121 `/api/` route entries were enumerated from `get_resolver()`, each resolved to its view class, and each checked for authentication classes, permission classes, and `permission_map` coverage of every action the router bound.

| Result | Count |
|---|---:|
| Route entries audited | 121 |
| Public (unauthenticated) endpoints | 18 |
| Authenticated-only (no `HasPermission`) | 13 |
| **Actions genuinely missing a `permission_map` entry** | **0** |

The first pass reported 19 apparent `permission_map` gaps — `AuditLogViewSet.create/update/partial_update/destroy`, `ErpOrderViewSet`/`ErpSyncRunViewSet`/`WebhookDeliveryViewSet` write actions, `ApiKeyViewSet.update`, `AttachmentViewSet.update/partial_update`. **Every one is a false positive**, and the reason is the same in all cases: the router binds a route for a verb the view has *dropped* via `http_method_names`, so the verb 405s at Django's own `dispatch` **before `HasPermission` is ever consulted** (`AuditLogViewSet` at `apps/accounts/views.py:387` is explicit about doing this deliberately for exactly the immutability reason). Once the audit accounts for `http_method_names`, the gap count is **zero**.

The 13 authenticated-only endpoints are each correct by design: `MeView` and `ChangePasswordView` act on the caller's own account; `TaskViewSet` and `NotificationViewSet` are owner-scoped in `get_queryset` (`apps/agents/views.py:36-43`) and their `@action`s reach rows only through that scoped `get_object()`; the four token endpoints must be reachable pre-authentication.

**So "enforce authz coverage" is already enforced. The deliverable is a guard that keeps it that way** — task 9 — not a fix.

### Axis 2 — Rate limiting: **the real gap, and the reason this story exists.**

**Exactly one endpoint in the entire API is throttled.** `grep -rn "throttle" backend/apps backend/config` returns `PasswordResetRequestView` (`apps/accounts/views.py:93-94`, `ScopedRateThrottle` at `5/hour`) and nothing else. `DEFAULT_THROTTLE_CLASSES` is not set at all; `DEFAULT_THROTTLE_RATES` holds one entry (`config/settings/base.py:305`).

| Unthrottled endpoint | Exposure |
|---|---|
| `POST /api/auth/token/` | **Credential stuffing / password brute force, unlimited.** Stock `TokenObtainPairView`, no throttle. |
| `POST /api/auth/token/refresh/` | Refresh-token guessing; also the rotation/blacklist path. |
| `POST /api/auth/invite/confirm/` | Signed-token brute force. |
| `POST /api/auth/password-reset/confirm/` | Signed-token brute force (the *request* half is throttled; the *confirm* half is not). |
| `POST /api/auth/change-password/` | Current-password brute force against a hijacked session. |
| `POST /api/live-chat/start/` | **Anonymous, creates a `Customer` + `Ticket`.** Unbounded storage/queue exhaustion and agent-queue flooding. |
| `POST /api/web-form/submit/` | **Anonymous, creates a `Customer` + `Ticket` + `Message`.** Same. |
| `POST /api/webhooks/{email,whatsapp,sms}/inbound/` | Anonymous ticket/message creation; signature-verification CPU burn. |
| `POST /api/tickets/<id>/{summarize,suggest-reply,suggest-solutions}/` | **Real money.** Each call hits Anthropic/Gemini via `apps/ai/client.py`. |
| `GET/POST /api/portal/chatbot/`, `…/handoff/` | **Real money**, callable in a loop by any portal customer. |

**And a finding that governs all of the above: every IP-keyed throttle in this project is currently bypassable by a client-supplied header.** `REST_FRAMEWORK["NUM_PROXIES"]` is **not set** (verified: `grep -rn NUM_PROXIES backend/config` → no match), so DRF's default `None` takes the branch at `rest_framework/throttling.py:40`:

```python
return ''.join(xff.split()) if xff else remote_addr
```

With `NUM_PROXIES = None`, the throttle identity is **the entire `X-Forwarded-For` header, which the client controls**. An attacker who varies that header gets a fresh throttle bucket on every request. This already defeats the existing `password_reset_request` throttle, and it would defeat every throttle this story adds. **`NUM_PROXIES` must be set correctly before any of the rest is worth anything** — and it must match the real deployment topology, which `prod.py:15`'s `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` confirms includes at least one proxy. This is task 1.

### Axis 3 — Input validation: **solid, with one real gap.**

Audited and found **already correct** — do not "fix" these:

- **Request body size is bounded by Django's own defaults**, verified in effect: `DATA_UPLOAD_MAX_MEMORY_SIZE = 2621440` (2.5 MB), `DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000`, `FILE_UPLOAD_MAX_MEMORY_SIZE = 2621440`.
- **The anonymous write endpoints validate explicitly.** `LiveChatStartView.post` (`apps/communications/views.py:241-256`) requires `name`, caps it at 200 to match `Customer.name`/`Ticket.subject`, caps `email` at 254, and calls `validate_optional_email` — with a comment recording that an over-length value would otherwise reach Postgres as an unhandled `DataError` 500. `WebFormSubmissionView` does the same.
- **Chatbot input is capped** at `max_length=2000` (`apps/portal/serializers.py:115`).
- **Attachment upload has a size cap**: `MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024`, enforced in `perform_create` (`apps/customers/views.py:290,330`).
- **Path traversal on upload is already prevented by Django**, verified in `django/db/models/fields/files.py:357`: `generate_filename` calls `validate_file_name(filename, allow_relative_path=True)`, which raises `SuspiciousFileOperation` for `..` and absolute paths. `attachment_upload_path` interpolating the raw filename (`apps/customers/models.py:166`) is therefore **not** a traversal hole.

The **one real gap**: `AttachmentViewSet` validates file *size* but **not file type** — no extension or content-type allowlist exists. Any authenticated holder of `customers.manage` can store an `.svg`, `.html`, or executable. **State the severity honestly: this is defense-in-depth, not a live XSS hole**, because `download` serves every file with `as_attachment=True` (`apps/customers/views.py:357-361`), which sets `Content-Disposition: attachment` and stops the browser rendering it inline. Task 7.

A second, smaller one: because Django raises `SuspiciousFileOperation` rather than a DRF `ValidationError`, a crafted filename yields an unhandled **500** instead of a clean 400. Also task 7.

### Axis 4 — Secret handling: **clean.**

All 45 serializer classes in `apps/` were instantiated and every field whose *name* matches `PROD-1`'s own `SENSITIVE_KEY_RE` was checked for `write_only`:

| Result | Count |
|---|---:|
| Serializer classes inspected | 45 |
| Credential-named fields found | 16 |
| **Fields readable on output** | **5 — all `has_*` booleans** |

The five readable ones are `has_host_password`, `has_auth_token` (×2), `has_access_token`, `has_secret` — deliberate "is this configured?" flags that expose a boolean, never a value. **Zero actual credential leaks.** Every stored credential (`EmailProviderConfig.host_password`, `WhatsAppProviderConfig.access_token`, `SmsProviderConfig.auth_token`, `ErpConnection.auth_token`, `WebhookSubscription.secret`) is `write_only`; `ApiKey` stores only `sha256` and is `editable=False` (`apps/integrations/models.py:36`); passwords go through `set_password`. `PROD-1`'s § 34 already covers logs and Sentry events.

The one hardening left on this axis is not a leak but an inventory disclosure: **`API_DOCS_PUBLIC` defaults to `True`** (`config/settings/base.py`), publishing `/api/schema/`, `/api/docs/`, and `/api/redoc/` — the complete endpoint inventory — to anonymous callers. `INT-1` made that default deliberately, and it is right for development; for a production deployment whose goal is *"reduced attack surface"*, the default belongs the other way round. Task 8.

---

## Story Goal

Close the one wide gap the audit actually found, and make the three clean axes stay clean:

1. **Throttle identity becomes trustworthy.** `NUM_PROXIES` is set explicitly from the environment, so a throttle keys on the real client address instead of a header the client controls.
2. **A layered rate-limit posture.** A generous global baseline for every endpoint, plus tight named scopes on the five categories the audit flagged: credential endpoints, anonymous writers, inbound webhooks, AI-cost endpoints, and password recovery.
3. **`/api/health/` is explicitly exempt**, because throttling a load-balancer probe converts a burst of traffic into a reported outage.
4. **Attachments get a content-type allowlist**, and a crafted filename returns 400 instead of 500.
5. **The API's own inventory stops being public by default in production.**
6. **Authz coverage is enforced by a system check**, so the zero-gap result the audit measured cannot silently regress — it fails `manage.py check`, which is already a gate and already runs in CI.
7. **The audit is written down** (`CONVENTIONS.md` § 36) — including the three negative results, so the next security story starts from evidence instead of re-deriving it.

### What this story does not do

- **No new `SECURE_*` setting, and no CSP.** `check --deploy` is already clean; a Content-Security-Policy header governs the *frontend's* document, which Django does not serve (Vite/static hosting does) — adding `django-csp` would protect nothing this app returns. Out of scope and stated so.
- **No authz fixes.** Measured: zero gaps. Task 9 adds a guard, not a change in behaviour.
- **No change to any endpoint's permission, and no endpoint made non-public.** The 18 public endpoints are each deliberately public and documented; this story rate-limits them, it does not close them.
- **No credential encryption at rest, and no secrets manager.** `CONVENTIONS.md` § 29-32 already recorded plaintext-but-`write_only` as this project's deliberate posture across five credentials; re-litigating it is a separate decision, not a hardening pass.
- **No frontend changes.** 429 is already handled and translated.
- **No CAPTCHA on the anonymous endpoints.** A rate limit is the proportionate control the intake asks for; a CAPTCHA is a product/UX decision with a third-party dependency.
- **No IP allowlisting for inbound webhooks.** Provider IP ranges change and are deployment configuration, not application code; signature verification (already present for WhatsApp/SMS) plus a rate limit is the application-level control.
- **No per-username login throttle in addition to per-IP.** Stated as a known limitation in `## Edge Cases`, with the reasoning, rather than half-built.

---

## Context — Read These Files First

1. `.squad/stories/production-readiness/SUPPORTOS-118/intake.md` — one description line, no acceptance criteria, empty `attachments/`. `SupportOs backlog.MD:963-965` (`STORY (PROD-3)`) is the same text: *"Enforce authz coverage, rate limiting, input validation audit, secret handling review. Outcome: reduced attack surface."* Four named axes; the audit above shows which one carries the work.
2. [91-story-performance-caching-SUPPORTOS-117.md](91-story-performance-caching-SUPPORTOS-117.md) `## Prerequisites` and `CONVENTIONS.md` § 35 — the Redis cache (`CACHES["default"]`, `REDIS_CACHE_URL`, database 1) that DRF throttling silently depends on, and `apps/core/cache.py`'s "a cache outage degrades, never 500s" posture. **Read § 35's cache-outage rule before task 2** — a throttle whose backing store is down must decide fail-open or fail-closed, and that decision is this story's, not the cache module's.
3. `backend/.venv/Lib/site-packages/rest_framework/throttling.py` — **read four specific places.** Line 6 and 62 (`cache = default_cache`) prove the Redis dependency. Lines 23-40 (`get_ident`) are the `NUM_PROXIES` finding — note that with `num_proxies is None` the function returns the whole `X-Forwarded-For`. Lines 205-250 (`ScopedRateThrottle`) show `throttle_scope` resolution and that the key is `request.user.pk` when authenticated and `get_ident(request)` otherwise. Lines 169-200 (`AnonRateThrottle`/`UserRateThrottle`) are the two baseline classes task 2 builds on.
4. `backend/config/settings/base.py` **lines 285-306** (the tail of `REST_FRAMEWORK`) — `DEFAULT_AUTHENTICATION_CLASSES` (JWT then API-key), `DEFAULT_PERMISSION_CLASSES = AllowAny`, and the `DEFAULT_THROTTLE_RATES` block with its single `password_reset_request` entry and the `SEC-7` comment claiming it is *"the only throttled view in this project today"* — still true, and this story is what changes it.
5. `backend/apps/accounts/views.py` **lines 80-102** (`PasswordResetRequestView`) — the **existing, working** `throttle_classes = [ScopedRateThrottle]` + `throttle_scope = "password_reset_request"` pair at lines 93-94. This is the template every new throttle in tasks 3-6 copies; do not invent a second mechanism. Also read lines 38-60 (`LogoutView`), 62-79 (`InviteConfirmView`), 103-122 (`PasswordResetConfirmView`), 123-143 (`ChangePasswordView`) — the four other account endpoints, and note line 125's comment that `ChangePasswordView` deliberately has *no* `authentication_classes` override unlike its neighbours.
6. `backend/apps/accounts/urls.py` (all 31 lines) — `TokenObtainPairView`/`TokenRefreshView` are wired **straight from `rest_framework_simplejwt.views`** with no subclass. Task 3 changes that, and `CONVENTIONS.md` § 21's finding that *"the stock simplejwt views need no subclassing"* is what task 3 is knowingly amending — read it so the amendment is deliberate.
7. `backend/.venv/Lib/site-packages/rest_framework_simplejwt/views.py` **lines 14-22 and 53-62** — `TokenObtainPairView(TokenViewBase)`, `TokenViewBase(generics.GenericAPIView)` with `permission_classes = ()` and `authentication_classes = ()`. A plain DRF `GenericAPIView`, so a subclass that adds only `throttle_classes`/`throttle_scope` inherits every behaviour unchanged — including the envelope, which `EnvelopeJSONRenderer` applies from the outside.
8. `backend/apps/core/views.py` **lines 65-87** (`HealthView`) — `authentication_classes = []`, `permission_classes = [AllowAny]`, and a DB probe returning 503 when the database is unreachable. **Throttles are applied independently of permissions, so a global default WILL throttle this view unless it is exempted**, and a throttled health probe reads as a dead service. Task 2's exemption is not optional.
9. `backend/apps/communications/views.py` — **lines 107-141** (`EmailInboundWebhookView`, `?token=` shared secret), **142-190** (`WhatsAppInboundWebhookView`, HMAC `verify_signature`), **191-227** (`SMSInboundWebhookView`), **228-266** (`LiveChatStartView`, the anonymous `Customer`+`Ticket` creator, with its explicit length validation at 241-256), **269-283** (`WebFormCategoriesView`), **284-350** (`WebFormSubmissionView`). Tasks 4 and 5 attach throttles to six of these; read the validation already present so you do not duplicate it.
10. `backend/apps/customers/views.py` **lines 285-361** — `MAX_ATTACHMENT_SIZE_BYTES` and its comment (a size bound was added because none existed), `AttachmentViewSet` with `parser_classes = [MultiPartParser]` and `http_method_names` narrowed at line 306, `perform_create` at 328-339 (**where task 7's type check goes, beside the existing size check**), and `download` at 351-361 (`as_attachment=True` — the mitigation that makes task 7 defense-in-depth rather than an XSS fix).
11. `backend/apps/customers/models.py` **lines 160-166** (`attachment_upload_path`) and **line 221** (`file = models.FileField(..., upload_to=attachment_upload_path)`) — the raw-filename interpolation that Django's own `validate_file_name` already makes safe.
12. `backend/apps/tickets/views.py` **lines 311-350** — the three AI actions (`summarize`, `suggest_reply`, `suggest_solutions`), all `@action(detail=True, methods=["post"])`, all reaching `apps/ai/` and therefore a paid provider call. Task 6 throttles these; note their `permission_map` entries at lines 80-82 already exist and must not change.
13. `backend/apps/portal/views.py` **lines 164-224** (`PortalChatbotView`, `PortalChatbotHandoffView`) — correctly gated on `Permissions.PORTAL_ACCESS` plus a `customer_profile` check, and **unthrottled despite every `POST` costing a provider call**. Task 6's second half.
14. `backend/apps/core/exceptions.py` **lines 29-50** (`envelope_exception_handler`) — `code = getattr(exc, "default_code", "error")` at line 46 is why DRF's `Throttled` already produces `{"code": "throttled"}` with no mapping work. Confirm this before assuming a new error code is needed; it is not.
15. `backend/apps/core/apps.py` (all 6 lines, `CoreConfig`) — deliberately bare, and `PROD-1`'s § 34 explains why Sentry was *not* put in `ready()`. Task 9 **does** use `ready()`, for the opposite reason: a system check must be *registered* at app-load time, which is exactly what `ready()` is for.
16. `backend/config/tests/test_settings.py` **lines 96-99** (`test_cors_middleware_is_first`) and `MigrationStateTests` — the two settings-pinning tests. Task 1/2 change `REST_FRAMEWORK`; re-run these and confirm nothing pins the throttle keys.
17. `CONVENTIONS.md` § 22 (lines 787-902, authorization) — the grant-on-omission rule (*"an action absent from `permission_map` is authenticated-only, not forbidden"*) that makes task 9's check worth having, and § 13 (lines 191-219) for why `DEFAULT_PERMISSION_CLASSES` stays `AllowAny`.
18. `CONVENTIONS.md` § 34 (lines 2310-2399, `PROD-1`) and § 35 (lines 2400-end, `PROD-2`) — the two sections § 36 sits beside, and the model for recording negative results as prominently as positive ones.
19. `README.md` **§ Environment variables** (backend table) and **§ Performance & caching (PROD-2)** — where task 10's rows and the new § Security note go, and the format both prior stories used.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **A throttle must key on an identity the client cannot forge.** | The `NUM_PROXIES` finding | `REST_FRAMEWORK["NUM_PROXIES"]` from `DJANGO_NUM_PROXIES`, defaulting to `0`. |
| **Every endpoint has some limit; the sensitive ones have a tight one.** | Intake ("rate limiting") | `DEFAULT_THROTTLE_CLASSES` baseline + five named `throttle_scope`s. |
| **A liveness probe is never throttled.** | Operational safety | `HealthView.throttle_classes = []`. |
| **A throttle protects the service; it must not become the outage.** | Operational safety | Generous baseline rates; `## Edge Cases` records the fail-open decision when Redis is down. |
| **An inbound webhook carries real customer data — throttle it loosely.** | Intake outcome, weighed against data loss | Webhook scope rate set well above any provider's real burst; `## Edge Cases` states the trade. |
| **An endpoint that spends money is limited per user, not per IP.** | Intake ("reduced attack surface"), AI cost | `ScopedRateThrottle` keys on `request.user.pk` when authenticated (`throttling.py:238-241`). |
| **Uploaded content is allowlisted by type, never denylisted.** | Intake ("input validation audit") | `ALLOWED_ATTACHMENT_TYPES` in `perform_create`. |
| **The API does not publish its own inventory in production.** | Intake ("reduced attack surface") | `API_DOCS_PUBLIC` default `False` in `prod.py`. |
| **Authz coverage is enforced mechanically, not by review.** | Intake ("enforce authz coverage") | `apps/core/checks.py`, registered in `CoreConfig.ready()`, failing `manage.py check`. |
| **No credential is ever readable through the API.** | Intake ("secret handling review") | Audited: every credential field `write_only`; task 9's check does not cover this, task 10's § 36 records the audit script so it can be re-run. |

---

## Backend Tasks

### 1 — Make throttle identity trustworthy

**This must land first.** Every other throttle in this story is bypassable without it.

**File: `backend/config/settings/base.py`** — add to the `REST_FRAMEWORK` dict, immediately after the existing `DEFAULT_THROTTLE_RATES` entry:

```python
    # PROD-3, and this is load-bearing: DRF's `BaseThrottle.get_ident`
    # (rest_framework/throttling.py:23-40) falls back to
    # `''.join(xff.split())` — the ENTIRE, CLIENT-SUPPLIED X-Forwarded-For
    # header — when NUM_PROXIES is None, which was this project's state.
    # An attacker varying that header gets a fresh throttle bucket per
    # request, defeating every IP-keyed limit including SEC-7's existing
    # password-reset one.
    #
    # 0 means "trust REMOTE_ADDR, ignore X-Forwarded-For" — correct when
    # nothing proxies the app. Set DJANGO_NUM_PROXIES to the real number of
    # trusted proxies in front of Django (1 for a single nginx/ALB); DRF
    # then takes the Nth-from-last XFF entry, which a client cannot forge
    # past a proxy that appends rather than trusts.
    #
    # prod.py already assumes a proxy exists (SECURE_PROXY_SSL_HEADER), so
    # a production deploy almost certainly needs 1, not the 0 default. The
    # default is the SAFE one, not the likely one: 0 under-counts distinct
    # clients behind a proxy (throttling them as one), while a too-high
    # value trusts forged header entries. Under-throttling a shared NAT is
    # a support ticket; trusting a forged header is a bypass.
    "NUM_PROXIES": env.int("DJANGO_NUM_PROXIES", default=0),
```

### 2 — Throttle scopes and the baseline

**File: `backend/config/settings/base.py`** — replace the single-entry `DEFAULT_THROTTLE_RATES` with the full scope table, and add `DEFAULT_THROTTLE_CLASSES`:

```python
    # PROD-3: a generous global baseline, so no endpoint is completely
    # unlimited, plus tight named scopes on what the PROD-3 audit flagged.
    # These are the baseline only — a view with its own `throttle_classes`
    # replaces them entirely rather than stacking, which is why every
    # sensitive endpoint in tasks 3-6 declares its own.
    #
    # Backed by CACHES["default"] (Redis, PROD-2). Before PROD-2 this was
    # LocMemCache and every rate below would have been PER WORKER.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # Deliberately generous: a busy agent's page loads fire several
        # requests each, and the point of the baseline is to stop a runaway
        # client, not to shape normal use. The named scopes do the real work.
        "anon": "300/hour",
        "user": "2000/hour",
        # SEC-7's original, unchanged.
        "password_reset_request": "5/hour",
        # Credential endpoints. Keyed per IP for an anonymous caller.
        "auth_credentials": "10/minute",
        # Anonymous endpoints that CREATE rows (Customer/Ticket/Message).
        "anon_write": "10/hour",
        # Inbound provider webhooks. Set high on purpose — see `## Edge
        # Cases`: a dropped webhook is lost customer data, so this bound
        # exists to stop a flood, not to shape a provider's real burst.
        "webhook_inbound": "600/minute",
        # Endpoints that spend money on a paid AI provider, per user.
        "ai": "30/hour",
    },
```

**File: `backend/apps/core/views.py`** — exempt `HealthView` (lines 65-87). Add beside its existing `authentication_classes`/`permission_classes`:

```python
    # PROD-3: throttles apply independently of permissions, so the global
    # AnonRateThrottle baseline would otherwise rate-limit the load
    # balancer's own liveness probe — and a 429 to a health check reads as
    # a dead service, turning a traffic burst into a reported outage. This
    # view returns no data and touches one indexed connection check.
    throttle_classes: list = []
```

Do the same for `ApiNotFoundView` (`apps/core/views.py:114-134`): it exists to turn an unmatched path into an enveloped 404, and throttling a 404 handler only converts scanner noise into a different status code while consuming the same work.

### 3 — Throttle the credential endpoints

**Create file: `backend/apps/accounts/throttled_token_views.py`:**

```python
"""Throttled subclasses of simplejwt's token views. PROD-3 (Story 92).

`CONVENTIONS.md` § 21 recorded that "the stock simplejwt views need no
subclassing" — true for the response shape, which `EnvelopeJSONRenderer`
handles from the outside, and still true here. These subclasses add
`throttle_classes`/`throttle_scope` and NOTHING else: no serializer
override, no `post()` override, no response shaping. `TokenViewBase` is a
plain `generics.GenericAPIView` (verified, rest_framework_simplejwt/
views.py:14-22), so every other behaviour is inherited unchanged.

Login was completely unthrottled before this — see CONVENTIONS.md § 36.
"""

from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_credentials"


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_credentials"
```

**File: `backend/apps/accounts/urls.py`** — import the two subclasses instead of the stock views and use them at the `token/` and `token/refresh/` paths. **The `name=` kwargs (`token_obtain`, `token_refresh`) must not change** — `reverse()` call sites and the frontend's URLs both depend on the paths staying identical.

**File: `backend/apps/accounts/views.py`** — add the same two lines to `InviteConfirmView` (line 62), `PasswordResetConfirmView` (line 103), and `ChangePasswordView` (line 123), copying the shape `PasswordResetRequestView` already uses at lines 93-94:

```python
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_credentials"
```

`ScopedRateThrottle` is already imported at line 10. **`LogoutView` (line 38) gets no scope** — it is idempotent, blacklists a token the caller already holds, and the `anon` baseline from task 2 now covers it; a tight limit there would break a user who signs out and back in repeatedly during testing.

### 4 — Throttle the anonymous writers

**File: `backend/apps/communications/views.py`** — add to `LiveChatStartView` (line 228) and `WebFormSubmissionView` (line 284):

```python
    # PROD-3: both create a Customer AND a Ticket (WebForm also a Message)
    # from wholly anonymous input — unbounded storage growth and agent-queue
    # flooding. 10/hour per client is well above a real visitor opening a
    # chat or filing a form, and far below a script.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon_write"
```

`WebFormCategoriesView` (line 269) stays on the `anon` baseline — it is a read-only category list, and the widget fetches it once per page load.

### 5 — Throttle the inbound webhooks

**File: `backend/apps/communications/views.py`** — add to `EmailInboundWebhookView` (line 107), `WhatsAppInboundWebhookView` (line 142), and `SMSInboundWebhookView` (line 191):

```python
    # PROD-3: anonymous, and each creates a Ticket/Message. Rate is
    # deliberately HIGH — a dropped webhook is lost customer data, and
    # providers retry only for a bounded window. This bound exists to stop
    # a flood from exhausting the database, not to shape a provider's
    # legitimate burst. See CONVENTIONS.md § 36.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "webhook_inbound"
```

### 6 — Throttle what spends money

**File: `backend/apps/tickets/views.py`** — the three AI actions at lines 311-350 need a *per-action* throttle, which a class-level `throttle_classes` cannot express (it would also throttle `list`/`retrieve`). Use `@action`'s own `throttle_classes` kwarg plus a small scoped class.

**Create file: `backend/apps/core/throttling.py`:**

```python
"""Named throttle classes. PROD-3 (Story 92). See CONVENTIONS.md § 36.

`ScopedRateThrottle` reads `throttle_scope` off the VIEW, which cannot vary
per `@action` on a viewset — a class attribute would throttle `list` and
`retrieve` too. These subclasses carry the scope themselves, so they can be
passed to a single `@action(throttle_classes=[...])` without affecting any
other action on the same viewset.

Keyed on `request.user.pk` when authenticated (rest_framework/
throttling.py:238-241), so one user cannot spend another's budget.
"""

from rest_framework.throttling import SimpleRateThrottle


class AiRateThrottle(SimpleRateThrottle):
    """Every request through this costs a paid provider call
    (`apps/ai/client.py`). Per user, not per IP."""

    scope = "ai"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
```

Then on each of the three actions in `apps/tickets/views.py`, add the kwarg — leaving `detail`, `methods`, `url_path` and the `permission_map` entries untouched:

```python
    @action(
        detail=True,
        methods=["post"],
        url_path="summarize",
        throttle_classes=[AiRateThrottle],
    )
```

…and identically for `suggest-reply` (line 326) and `suggest-solutions` (line 340).

**File: `backend/apps/portal/views.py`** — `PortalChatbotView` (line 164) and `PortalChatbotHandoffView` (line 205) are plain `APIView`s where a class attribute is correct:

```python
    throttle_classes = [AiRateThrottle]
```

**`PortalChatbotView.get` is included deliberately**: `get_or_start_session` can *create* a session, and the scope is shared with `post` so a client cannot alternate verbs to double its budget.

### 7 — Attachment content-type allowlist

**File: `backend/apps/customers/views.py`** — add beside `MAX_ATTACHMENT_SIZE_BYTES` (line 290):

```python
# PROD-3. An allowlist, never a denylist: a denylist is a list of the
# extensions someone thought of. Covers what a support attachment actually
# is — documents, images, archives, plain text.
#
# Severity, stated honestly: this is defense-in-depth, NOT a live XSS fix.
# `download` already serves every file with `as_attachment=True`
# (Content-Disposition: attachment), so a stored .svg/.html is downloaded
# rather than rendered inline. This closes the "we store and redistribute
# arbitrary executables" half of the problem.
ALLOWED_ATTACHMENT_EXTENSIONS = frozenset(
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".csv", ".txt", ".log", ".md",
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff",
        ".zip", ".gz", ".tar", ".7z",
        ".eml", ".msg",
    }
)
```

and extend `perform_create` (lines 328-339), **after** the existing size check so the cheaper check still runs first:

```python
        extension = Path(file_obj.name).suffix.lower()
        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            raise ValidationError(
                {"file": [_("Files of type “%(ext)s” are not accepted.") % {"ext": extension}]}
            )
```

`from pathlib import Path` goes in the stdlib import group.

**Same file** — turn a crafted filename into a 400 rather than a 500. Django's `validate_file_name` raises `SuspiciousFileOperation` from inside `serializer.save()`, which `envelope_exception_handler` does not recognise and therefore renders as `internal_error`:

```python
        try:
            serializer.save(
                uploaded_by=self.request.user,
                original_filename=file_obj.name,
                size=file_obj.size,
            )
        except SuspiciousFileOperation as exc:
            # Django rejects `..`/absolute paths in the generated upload path
            # (django/db/models/fields/files.py:357). Already SAFE — the file
            # is never written — but the raw exception is an unhandled 500;
            # this makes it the 400 it always was semantically.
            raise ValidationError({"file": [_("This file name is not accepted.")]}) from exc
```

with `from django.core.exceptions import SuspiciousFileOperation` added to the Django import group.

### 8 — Stop publishing the API inventory in production

**File: `backend/config/settings/prod.py`** — append:

```python
# PROD-3: /api/schema/, /api/docs/ and /api/redoc/ publish the complete
# endpoint inventory. INT-1 made them public by default, which is right for
# development and wrong for a deployment whose goal is a reduced attack
# surface. Still overridable — a genuinely public API can set
# API_DOCS_PUBLIC=True — and the routes are never removed, only narrowed to
# IsAuthenticated (apps/integrations/urls.py), so an authenticated
# integrator keeps them.
API_DOCS_PUBLIC = env.bool("API_DOCS_PUBLIC", default=False)
SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] = (
    ["rest_framework.permissions.AllowAny"]
    if API_DOCS_PUBLIC
    else ["rest_framework.permissions.IsAuthenticated"]
)
```

The second statement is required, and this is the trap: `SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"]` was already computed in `base.py` from `base.py`'s own `API_DOCS_PUBLIC`. Re-reading the env var in `prod.py` without recomputing that key changes a variable nothing reads afterwards. **Verify with the check in `## Verification Steps` step 8, not by inspection.**

### 9 — A system check that keeps authz coverage at zero gaps

The audit measured zero `permission_map` gaps. This is what stops that regressing, without adding a test file (`CONVENTIONS.md` § 16).

**Create file: `backend/apps/core/checks.py`:**

```python
"""Authz coverage as a Django system check. PROD-3 (Story 92).

The PROD-3 audit found ZERO actions missing a `permission_map` entry across
121 routes. `HasPermission` grants on omission (CONVENTIONS.md § 22), so a
future viewset that forgets an entry is authenticated-only rather than
denied — a silent widening with no error to see. This turns that into a
`manage.py check` failure, which is already a gate and already runs in CI.

Registered from `CoreConfig.ready()`: a check must be registered at
app-load time. (Contrast PROD-1's Sentry init, which deliberately does NOT
use `ready()` because it must run even earlier — see CONVENTIONS.md § 34.)
"""

from django.core.checks import Warning as CheckWarning

from .permissions import HasPermission

# Actions that are correct to leave unmapped, with the reason. An entry here
# is a deliberate decision; anything else is a finding.
EXEMPT = {
    # Owner-scoped personal resources: every row is filtered to
    # request.user in get_queryset, so there is no domain permission to
    # hold. Documented on the viewsets themselves.
    "TaskViewSet",
    "NotificationViewSet",
}


def check_permission_map_coverage(app_configs, **kwargs):
    from django.urls import get_resolver

    def walk(resolver, prefix=""):
        for pattern in resolver.url_patterns:
            if hasattr(pattern, "url_patterns"):
                yield from walk(pattern, prefix + str(pattern.pattern))
            else:
                yield prefix + str(pattern.pattern), pattern.callback

    problems = []
    seen = set()
    for path, callback in walk(get_resolver()):
        if not path.startswith("api/"):
            continue
        view = getattr(callback, "cls", None)
        if view is None or view.__name__ in EXEMPT:
            continue
        permissions = getattr(view, "permission_classes", [])
        if HasPermission not in permissions:
            continue
        permission_map = getattr(view, "permission_map", {}) or {}
        # Only the verbs the view actually serves: a verb dropped via
        # `http_method_names` 405s at Django's dispatch before
        # HasPermission runs, which is how AuditLogViewSet closes its
        # write actions. Not a gap.
        allowed = {m.lower() for m in getattr(view, "http_method_names", [])}
        for method, action in (getattr(callback, "actions", None) or {}).items():
            if action in permission_map or (allowed and method.lower() not in allowed):
                continue
            key = (view.__name__, action)
            if key in seen:
                continue
            seen.add(key)
            problems.append(
                CheckWarning(
                    f"{view.__name__}.{action} has no `permission_map` entry, so it is "
                    f"authenticated-only rather than permission-gated "
                    f"(HasPermission grants on omission — CONVENTIONS.md § 22).",
                    hint=(
                        "Add an entry to the viewset's `permission_map`, drop the verb via "
                        "`http_method_names`, or add the view to "
                        "`apps.core.checks.EXEMPT` with a comment saying why."
                    ),
                    obj=f"{view.__module__}.{view.__name__}",
                    id="core.W001",
                )
            )
    return problems
```

**File: `backend/apps/core/apps.py`** — register it:

```python
    def ready(self):
        from django.core.checks import register

        from .checks import check_permission_map_coverage

        register(check_permission_map_coverage)
```

**A `Warning`, not an `Error`**, deliberately: `manage.py check` exits non-zero on `ERROR` but zero on `WARNING`, and an over-eager `Error` here would block a legitimate future design (a viewset that is genuinely authenticated-only) until someone edited `EXEMPT`. A warning is visible in every `check` run and in CI output without becoming a hostage. **The check must report zero warnings on this codebase today** — that is `## Verification Steps` step 9, and it is the assertion that the audit's zero-gap result is real.

### 10 — Env, README, CONVENTIONS

**File: `backend/.env.example`** — add after the `# --- Cache (PROD-2) ---` block:

```
# --- Security (PROD-3) ---
# Number of TRUSTED proxies in front of Django. 0 = none, trust REMOTE_ADDR
# and ignore X-Forwarded-For. Set to 1 behind a single nginx/ALB. Getting
# this wrong breaks rate limiting: too low throttles a whole NAT as one
# client, too high trusts a forged X-Forwarded-For entry.
DJANGO_NUM_PROXIES=0
# Publish /api/schema/, /api/docs/, /api/redoc/ to anonymous callers.
# Defaults True in dev, False in prod.
API_DOCS_PUBLIC=True
```

**File: `README.md`** — two rows in the backend env table, after the `REDIS_CACHE_URL` row:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DJANGO_NUM_PROXIES` | no | `0` | Trusted proxies in front of Django (`PROD-3`). **Rate limiting keys on this** — see `CONVENTIONS.md` § 36. `0` trusts `REMOTE_ADDR`; `1` is right behind a single nginx/ALB. |
| `API_DOCS_PUBLIC` | no | `True` (dev), `False` (prod) | Whether `/api/schema/`, `/api/docs/`, `/api/redoc/` are anonymous. Narrowed to `IsAuthenticated` when `False`, never removed. |

Also add a **§ Security (PROD-3)** section after § Performance & caching, recording: the throttle scopes and their rates in a table; that `DJANGO_NUM_PROXIES` must match the deployment or rate limiting is wrong in one direction or the other; that `/api/health/` is deliberately exempt; and that `manage.py check` runs the authz-coverage check.

**File: `CONVENTIONS.md`** — append **§ 36**. Renumber nothing. It records:

- **The audit results as a table**, including all three negative findings, each as prominently as the positive one: **authz coverage was already complete** (121 routes, 0 real gaps — every apparent gap was a verb dropped via `http_method_names`); **secret handling was already clean** (45 serializers, 16 credential-named fields, 0 readable except `has_*` booleans); **`check --deploy` was already clean** (0 security warnings; all 36 issues drf-spectacular noise). **Do not re-do this work; re-run the scripts.**
- **`NUM_PROXIES` is load-bearing for every throttle.** With it unset, DRF keys throttles on the entire client-supplied `X-Forwarded-For`, making every IP-keyed limit bypassable by rotating a header. Any future story that adds a throttle inherits this.
- **DRF throttling is backed by `CACHES["default"]`**, so it depends on `PROD-2`'s Redis. On LocMemCache a rate is per-worker. **A throttle added before a shared cache exists is not a throttle.**
- **`/api/health/` and `/api/` (the 404 catch-all) are exempt**, and why throttling a liveness probe manufactures an outage.
- **The layering rule**: a view's own `throttle_classes` *replaces* `DEFAULT_THROTTLE_CLASSES`, it does not stack — so a sensitive endpoint must declare the tight scope itself and will lose the baseline.
- **`ScopedRateThrottle` keys per user when authenticated, per IP otherwise**, which is why the AI scope is per-user (one customer cannot spend another's budget) and the credential scope is per-IP (the caller has no identity yet).
- **A webhook throttle is set loose on purpose** — a dropped webhook is lost customer data.
- **Uploads are allowlisted by extension, never denylisted**, and `as_attachment=True` on download is what makes that defense-in-depth rather than an XSS fix. **Do not remove `as_attachment=True`.**
- **`permission_map` coverage is a system check** (`core.W001`), a `Warning` not an `Error`, with `EXEMPT` requiring a written reason.
- **The known limitation, recorded rather than hidden**: login throttling is per-IP, so a distributed credential-stuffing attack across many source addresses is not stopped by it. Mitigating that needs a per-username counter or an account-lockout policy, both of which have real UX and lockout-DoS trade-offs a future story should decide deliberately.

---

## Edge Cases & Failure Modes

- **Redis unreachable → DRF throttling fails OPEN, and this story accepts that.** `SimpleRateThrottle.allow_request` calls `self.cache.get(...)` with no exception handling (`throttling.py:123`), so a Redis outage raises inside the throttle and — unlike `apps/core/cache.py`, which swallows — becomes a **500 on every throttled endpoint**. That is worse than not throttling. **Task 2 must therefore not leave this to chance**: `DEFAULT_THROTTLE_CLASSES` entries and the scoped classes must tolerate a dead cache. The concrete requirement: subclass so that a cache failure logs at WARNING (per § 10) and returns `True` (allow). A security control that converts a cache blip into a total outage will be turned off by the first operator who meets it, and then there is no control at all. **This is the single most important behaviour in the story** and is verification step 10.
- **`DJANGO_NUM_PROXIES` set too low behind a real proxy → an entire office NATs to one throttle bucket.** With `0` behind nginx, every request's `REMOTE_ADDR` is the proxy, so all users share one `anon`/`auth_credentials` budget and a shared-IP customer sees spurious 429s. Detectable: a spike of 429s in `PROD-1`'s access log with `req_user_id` spread across many users. The default is `0` because the failure mode is *visible over-throttling* rather than a *silent bypass*.
- **`DJANGO_NUM_PROXIES` set too high → the bypass comes back.** Setting `2` behind one proxy makes DRF read an XFF entry the client wrote. Only ever set it to the number of proxies that *append* to XFF and are actually in the path.
- **A view's own `throttle_classes` replaces the default; it does not stack.** Every endpoint in tasks 3-6 loses `AnonRateThrottle`/`UserRateThrottle` and gets only its named scope. Intended — the named rates are tighter — but it means a scope typo silently removes all throttling from that view rather than falling back. Verification step 4 checks each endpoint actually 429s.
- **A `throttle_scope` with no matching key in `DEFAULT_THROTTLE_RATES` raises `ImproperlyConfigured` at request time**, not at boot — `ScopedRateThrottle.allow_request` resolves the rate lazily (`throttling.py:221-234`). So a typo is a 500 on first use, not a startup failure. Verification step 4's per-endpoint check is what catches it.
- **`/api/health/` throttled → manufactured outage.** Covered by task 2's explicit `throttle_classes = []`. If a future story adds a global throttle mixin, this exemption must survive it.
- **Webhook throttle too tight → permanent customer data loss.** Providers retry for a bounded window; past it, a customer's inbound email or WhatsApp message is simply gone, with no user-visible error. `600/minute` is far above any real provider burst for a single tenant. **Never tighten this scope without measuring the provider's actual delivery rate first.**
- **AI throttle is per user, so a shared service account concentrates the budget.** An integration that calls `summarize` through one API key (`ApiKeyAuthentication` resolves to a real `User`) spends that user's 30/hour for everyone. Correct behaviour — the cost is attributable — but worth knowing before an integrator reports it as a bug.
- **`PortalChatbotView.get` is throttled and it is a GET.** Deliberate: `get_or_start_session` can create a session and the scope is shared with `post`, so alternating verbs cannot double the budget. It does mean a customer reloading the chat panel repeatedly consumes AI budget without sending a message. Accepted; 30/hour is generous for a human.
- **Login throttling is per-IP only.** A distributed credential-stuffing attack from many addresses is not stopped. Recorded in § 36 as a known limitation with the two real options (per-username counter; account lockout) and their trade-offs, rather than half-implemented here.
- **`auth_credentials` at `10/minute` shared across five endpoints.** A user who fails login twice, then resets their password, then confirms, consumes one bucket. Generous enough for that sequence and far below a script. But note the sharing: it is one scope, so the budgets are *not* independent per endpoint.
- **The attachment allowlist rejects files users legitimately send.** A support attachment could be `.heic`, `.mov`, `.dwg`, or a bare extensionless file (`Path("README").suffix` is `""`, which is not in the set and is therefore rejected). This *will* generate support requests. The list is a starting point in one obvious constant, and § 36 says to extend it rather than switch to a denylist.
- **Extension checking is not content sniffing.** A `.png` containing HTML still passes. `as_attachment=True` on download is what actually contains that, which is precisely why § 36 forbids removing it. Real content inspection (`python-magic`/libmagic) is a new binary dependency and is deliberately not added.
- **`API_DOCS_PUBLIC=False` in prod breaks any unauthenticated consumer of `/api/schema/`** — a client-generator in CI, or an external integrator's tooling. The routes still exist and answer for an authenticated caller; only anonymous access is removed. The env var is the escape hatch, and this is a **behaviour change on deploy**, called out in `## Migration / Rollback`.
- **The new system check runs on every `manage.py check`, including in the migration path.** It calls `get_resolver()`, which imports the whole URL conf and therefore every view module. If a view module has an import error, `check` now reports a confusing URL-resolution traceback in addition to the real error. Acceptable — `check` already imports models — but do not move this check to `ready()` itself, where it would run before the URL conf is safely importable.
- **`EXEMPT` is a string set, matched on class name.** Two viewsets with the same class name in different apps would both be exempted. There are none today (verified: all 121 route views have distinct names), and the hint text tells a future author to add a reason.
- **Existing tests may now hit throttles.** DRF throttles are cache-backed and the test settings share `CACHES`, so a test making 11 rapid credential requests would 429. The 54 existing tests do not (verification step 2 proves it), but a future test author needs `cache.clear()` between cases — recorded in § 36.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16 — *"no new test file is added anywhere in the repo"*). No test file is added, changed, or removed.

The **54 existing backend tests must still pass**, and three are load-bearing here:

1. `backend/config/tests/test_settings.py::DrfSettingsTests` — asserts the exception handler, renderer, and pagination keys of `REST_FRAMEWORK`. Tasks 1-2 add three keys to that same dict; nothing in the test pins the full key set, but confirm rather than assume.
2. `backend/config/tests/test_settings.py::MigrationStateTests` — **this story adds no migration at all**; if this fails, something changed a model that should not have.
3. `backend/apps/core/tests/test_health.py` — exercises `HealthView`, including the 503 branch. It must still pass with task 2's `throttle_classes = []` in place, and it is the closest thing the repo has to a regression guard on the health-check exemption.

Task 9's system check is the story's own durable guard and replaces what a test would otherwise assert about authz coverage. Everything else is `## Verification Steps`.

---

## Migration / Rollback

**No database migration.** This story adds no model, field, table, or index. `makemigrations --check --dry-run` must report `No changes detected`.

**Two behaviour changes land on deploy, both intentional:**

1. **Requests now get 429s.** Every rate above is generous, but a load test, a scraper, or a misconfigured integration that previously succeeded will now be limited. `PROD-1`'s access log shows exactly which endpoint and which client (`http_status`, `http_path`, `req_user_id`).
2. **`/api/schema/`, `/api/docs/`, `/api/redoc/` stop answering anonymous callers in production** (task 8). Set `API_DOCS_PUBLIC=True` to restore, per-environment, with no redeploy of code.

**Deploy order matters exactly once:** `DJANGO_NUM_PROXIES` must be set to the correct value for the environment **in the same deploy** as the throttles. Deploying throttles with a wrong `NUM_PROXIES` gives either a bypass (too high) or NAT-wide over-throttling (too low).

**Rollback, in order — each step is independent and needs no code change:**

1. **Loosen everything without a deploy:** raise the entries in `DEFAULT_THROTTLE_RATES`. (Requires a settings deploy — these are constants by design, per task 2's reasoning; the env-var escape hatches below do not.)
2. **Restore public docs:** `API_DOCS_PUBLIC=True`.
3. **Fix throttle identity:** `DJANGO_NUM_PROXIES=<n>`.
4. **Full revert** is a clean file-level revert: three new files (`apps/core/throttling.py`, `apps/core/checks.py`, `apps/accounts/throttled_token_views.py`) and additive edits everywhere else. The only edit that is not purely additive is `apps/accounts/urls.py` swapping two imported view classes — reverting restores the stock simplejwt views at identical paths and route names.

**Half-applied states:**

- **Throttles deployed, `NUM_PROXIES` not set** → limits are bypassable by header rotation. The app works; the control does not. This is the state the project is in *today* for its one existing throttle, which is why task 1 is first.
- **`NUM_PROXIES` set, throttles not** → no effect whatsoever. Safe to deploy alone, and the recommended first step.
- **Scoped classes deployed, `DEFAULT_THROTTLE_RATES` entry missing** → `ImproperlyConfigured` **500 on first request** to that endpoint (the rate is resolved lazily, not at boot). Ship tasks 2 and 3-6 together.
- **System check deployed alone** → zero behaviour change; it only reports.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `ruff format --check .`, `ruff check .`, `python manage.py check`, `python manage.py makemigrations --check --dry-run` (→ `No changes detected`), `python manage.py test`. All pass; **54 tests, 0 failures**.
2. **`check --deploy` stays clean:**
   ```bash
   DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_ALLOWED_HOSTS=example.com \
     python manage.py check --deploy 2>&1 | grep -v drf_spectacular
   ```
   Expect no `security.W*` line — the same clean result the audit recorded, proving this story introduced no regression.
3. **Throttle identity is not client-controlled.** With `DJANGO_NUM_PROXIES=0`, confirm a forged header cannot mint a fresh bucket:
   ```bash
   for i in $(seq 1 12); do
     curl -s -o /dev/null -w "%{http_code} " -X POST \
       -H "Content-Type: application/json" \
       -H "X-Forwarded-For: 10.0.0.$i" \
       -d '{"email":"nobody@example.com","password":"wrong"}' \
       http://localhost:8000/api/auth/token/
   done; echo
   ```
   Expect `401` up to the limit then `429` — **not twelve 401s**. Twelve 401s means `NUM_PROXIES` is unset or the throttle is not attached. Then repeat with `DJANGO_NUM_PROXIES=1` and confirm the bucket *does* follow the forged header (proving the setting is read), which is exactly why it must match the real topology.
4. **Every intended endpoint actually throttles.** For each of `/api/auth/token/`, `/api/auth/token/refresh/`, `/api/auth/invite/confirm/`, `/api/auth/password-reset/confirm/`, `/api/auth/change-password/`, `/api/live-chat/start/`, `/api/web-form/submit/`, `/api/webhooks/email/inbound/`, and `/api/tickets/1/summarize/`: loop past its rate and confirm a `429` whose body is `{"success": false, "error": {"code": "throttled", …}}` and whose response carries a `Retry-After` header. **A scope typo shows up here as a 200/500 instead of a 429** — that is the failure this step exists to catch.
5. **`/api/health/` is never throttled.** `for i in $(seq 1 400); do curl -s -o /dev/null -w "%{http_code} " http://localhost:8000/api/health/; done` — expect **400 × `200`, zero `429`**. This is the step that prevents a self-inflicted outage.
6. **The 404 catch-all is not throttled:** hit `/api/definitely-not-a-route/` 400 times and confirm every response is `404`, never `429`.
7. **Attachment type allowlist:** as a user with `customers.manage`, `POST /api/attachments/` with a `.pdf` (expect **201**), then a `.svg` and an `.exe` (expect **400** with `error.code == "validation_error"` and a `file` field message). Then confirm the size check still fires first for an over-10 MB `.pdf` (expect the size message, not the type message). Finally confirm a `.pdf` still downloads with `Content-Disposition: attachment` — `curl -s -D- -o/dev/null .../download/ | grep -i content-disposition`.
8. **Docs are private in prod, public in dev, and the recompute actually happened:**
   ```bash
   DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_ALLOWED_HOSTS=example.com python -c "
   import django; django.setup()
   from django.conf import settings
   print('API_DOCS_PUBLIC:', settings.API_DOCS_PUBLIC)
   print('SERVE_PERMISSIONS:', settings.SPECTACULAR_SETTINGS['SERVE_PERMISSIONS'])"
   ```
   Expect `False` and `['rest_framework.permissions.IsAuthenticated']`. **Checking only `API_DOCS_PUBLIC` would pass while the docs stayed public** — that is task 8's trap. Then run the same for `config.settings.dev` and expect `True` / `AllowAny`, and confirm live: `GET /api/schema/` anonymous → 200 in dev.
9. **The authz check reports zero warnings on this codebase.** `python manage.py check 2>&1 | grep core.W001` returns nothing. Then prove the check *works* by breaking it deliberately: temporarily delete the `"list"` entry from `TicketViewSet.permission_map`, re-run, and confirm a `core.W001` warning naming `TicketViewSet.list`. **Restore the entry afterwards.**
10. **Throttling fails open when Redis is down, not closed.** Stop Redis (or point `REDIS_CACHE_URL` at `redis://localhost:6399/1`) and request `/api/auth/token/`, `/api/tickets/`, and `/api/reports/dashboard/kpis/`. **Every one must return its normal status — never a 500.** Confirm a WARNING appears in `PROD-1`'s access log. Restart Redis and confirm throttling resumes by re-running step 4 on one endpoint. **This step must not be skipped**; it is the difference between a security control and an availability incident.
11. **Re-run the two audit scripts and confirm the negative findings still hold.** Recreate them from § 36's description (or from this story's `## Audit findings`) and confirm: the authz audit reports **0** actions missing a `permission_map` entry across ~121 routes, and the secret audit reports **0** readable credential fields other than the five `has_*` booleans across 45 serializers.
12. **Regression walkthrough:** from `frontend/` — `npm run dev`. Log in (confirm login still works and is not throttled by a single attempt), page through tickets, run a search, open a ticket and use **Summarize** once (confirm it works, then five more times and confirm a translated "Too many requests" toast rather than a silent failure), file a web-form submission, load `/reports` and the home dashboard, switch to العربية and confirm the Arabic 429 copy. Everything behaves as before, with limits only at the edges.
13. **Frontend gates unchanged:** `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0. **This story changes no frontend file**, so these are pure regression checks.

---

## Done Criteria

- [ ] `REST_FRAMEWORK["NUM_PROXIES"]` is set from `DJANGO_NUM_PROXIES` (default `0`), and a forged `X-Forwarded-For` cannot mint a fresh throttle bucket (verification step 3).
- [ ] `DEFAULT_THROTTLE_CLASSES` is set, and `DEFAULT_THROTTLE_RATES` carries `anon`, `user`, `password_reset_request`, `auth_credentials`, `anon_write`, `webhook_inbound`, and `ai`.
- [ ] All five credential endpoints throttle: `token/`, `token/refresh/`, `invite/confirm/`, `password-reset/confirm/`, `change-password/` — and `token/`/`token/refresh/` keep their existing paths **and** URL names.
- [ ] `live-chat/start/` and `web-form/submit/` throttle on `anon_write`; the three inbound webhooks throttle on `webhook_inbound`.
- [ ] The three ticket AI actions and both portal chatbot views throttle on `ai`, **keyed per user**, and no non-AI action on `TicketViewSet` is affected.
- [ ] **`/api/health/` returns 200 for 400 consecutive requests** and the `/api/` 404 catch-all is likewise never throttled.
- [ ] **Throttling fails open on a Redis outage** — no endpoint returns 500 with the cache backend unreachable (verification step 10).
- [ ] A 429 returns the standard envelope with `error.code == "throttled"` and a `Retry-After` header, and renders as translated copy in both `en` and `ar` **with no frontend change**.
- [ ] Attachments reject a non-allowlisted extension with a 400, accept `.pdf`, still enforce the 10 MB size cap first, still download with `Content-Disposition: attachment`, and a crafted filename yields a 400 rather than a 500.
- [ ] In `config.settings.prod`, `API_DOCS_PUBLIC` is `False` **and** `SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"]` is `IsAuthenticated`; dev is unchanged at `AllowAny`.
- [ ] `apps/core/checks.py` is registered from `CoreConfig.ready()`, reports **zero** `core.W001` warnings on this codebase, and demonstrably fires when a `permission_map` entry is removed.
- [ ] **No migration, no model change, no frontend file changed, and no `SECURE_*` setting added.**
- [ ] `backend/.env.example` and the `README.md` backend env table carry `DJANGO_NUM_PROXIES` and `API_DOCS_PUBLIC`; `README.md` has a § Security section with the scope/rate table.
- [ ] `CONVENTIONS.md` § 36 records the full audit — the rate-limit gap **and all three negative findings** (authz coverage already complete, secret handling already clean, `check --deploy` already clean), the `NUM_PROXIES` dependency, the cache dependency, the replaces-not-stacks layering rule, the health-check exemption, the allowlist-not-denylist rule with `as_attachment=True`, and the per-IP login-throttle limitation.
- [ ] All gates pass: `ruff format --check .`, `ruff check .`, `manage.py check`, `manage.py makemigrations --check --dry-run`, `manage.py test` (54 passing); `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 93 (`PROD-4` — Optional Docker Packaging).**
