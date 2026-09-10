# Story 104 — OpenAPI Schema Completeness

## Prerequisites

- **Stories 99-103 implemented.** Independent of all of them.
- **Story 80 (`INT-1`) implemented:** `drf_spectacular` wiring, `SchemaView`, `apps/integrations/schema.py`'s `envelope_postprocessing_hook`, and `SPECTACULAR_SETTINGS` in `config/settings/base.py`. This story continues that work.
- **Intake:** `.squad/stories/bugs/qa-report-1/intake.md`; **attachment:** `QA-REPORT-1.md` (F-10).
- **No frontend change of any kind.** `git status --short frontend/` must be empty at the end.

---

## What discovery changed

### 1. The count in the report was wrong — it is 31 views, not 26

Measured: **31 × W002** and **7 × W001** = the 38 issues `check --deploy` reports. The attachment says 26; that was an undercount from reading a truncated listing. The full set:

`AgentPerformanceReportView` `ApiNotFoundView` `BrandingView` `ChangePasswordView` `CsatBreakdownReportView` `CsatTrendReportView` `DashboardKpiReportView` `EmailInboundWebhookView` `HealthView` `InviteConfirmView` `KnowledgeBaseSearchView` `LandingContentAdminView` `LandingContentView` `LiveChatStartView` `LogoutView` `MeView` `PasswordResetConfirmView` `PasswordResetRequestView` `PermissionCatalogView` `PortalChatbotHandoffView` `PortalChatbotView` `SMSInboundWebhookView` `SettingsView` `SlaBreachRateReportView` `SlaTrendReportView` `TicketBreakdownReportView` `TicketVolumeReportView` `WebFormCategoriesView` `WebFormSubmissionView` `WebhookEventCatalogView` `WhatsAppInboundWebhookView`

### 2. Most of these views already build a real serializer — they just never declare it

This is the finding that makes the story tractable and the documentation honest. Verified by reading the view bodies:

```
LogoutView            -> LogoutSerializer(data=request.data)
InviteConfirmView     -> InviteConfirmSerializer(...)
PasswordResetRequest  -> PasswordResetRequestSerializer(...)
PasswordResetConfirm  -> PasswordResetConfirmSerializer(...)
ChangePasswordView    -> ChangePasswordSerializer(...)
MeView                -> UserSerializer(request.user)
BrandingView          -> BrandingSerializer(...)
SettingsView          -> OrganizationSettingsSerializer(...)
LandingContentView    -> PublicLandingContentSerializer(...)
LandingContentAdmin   -> LandingContentAdminSerializer(...)
```

For these, the fix is `@extend_schema(request=X, responses=X)` naming the serializer the view **already uses**. That is documentation of fact. **Do not invent a serializer where one exists**, and do not create model serializers for views that genuinely return ad-hoc dicts.

### 3. The 7 W001s are three different problems, and they matter more than the W002s

W002 means a view is *omitted*. W001 means the emitted schema is *wrong* — spectacular's own words: *"will very likely result in an incorrect schema."* Fix these first.

| Count | Problem | Cause |
|---|---|---|
| 2 | `TaskViewSet` / `NotificationViewSet` — *"could not derive type of path parameter `id`"* | Both scope via `get_queryset()` reading `self.request.user`, which fails at schema-generation time (no request). Neither declares a class-level `queryset`, so spectacular cannot introspect the pk type and defaults `id` to **string** — wrong for an integer pk. |
| 4 | `Category` / `CategoryRequest` / `PatchedCategoryRequest` / `PaginatedCategoryList` collide | `apps.tickets.serializers.CategorySerializer` and `apps.knowledge_base.serializers.CategorySerializer` both claim the component name `Category`. |
| 1 | `status` enum resolved to `Status6f2Enum` | Several models declare a `status` choice set; spectacular generates a hash-suffixed name. |

### 4. Two views should be excluded, not documented — and that is the correct fix

- `ApiNotFoundView` is the `re_path(r"^")` catch-all that turns any unmatched `/api/` path into an enveloped 404. It is not an endpoint; documenting it would put a wildcard path in the schema.
- `HealthView` is an infrastructure liveness probe for a load balancer, not part of the API contract.

`@extend_schema(exclude=True)` is drf-spectacular's sanctioned mechanism for exactly this. Excluding them is a deliberate decision to record in a comment, **not** a way to make a warning disappear — every other view gets documented.

---

## Story Goal

Make the generated schema complete and correct, so a client generated from it actually covers the API.

1. Zero W001 — no component-name collisions, no untyped path parameters, no hash-suffixed enum names.
2. Zero W002 — every view either documented or deliberately excluded with a stated reason.
3. Documentation reflects what each view **actually** does; no invented request or response shapes.

**Not in scope:** changing any endpoint's behaviour, request shape or response shape. This story is annotations, two `queryset` declarations and settings — if any test of behaviour changes, something is wrong.

---

## Context — Read These Files First

1. `backend/config/settings/base.py` — `SPECTACULAR_SETTINGS` (from ~line 622): `TITLE`, `SERVE_PERMISSIONS`, `POSTPROCESSING_HOOKS`. `ENUM_NAME_OVERRIDES` goes here.
2. `backend/apps/accounts/views.py` lines 38-176 — the six auth `APIView`s and the serializers each already constructs.
3. `backend/apps/organization/views.py` lines 86-200 — `BrandingView`, `SettingsView`, `LandingContentView`, `LandingContentAdminView`, and their serializers.
4. `backend/apps/reports/views.py` lines 52-100 — `BaseReportView.get`, which returns `Response(rows)` where `rows` is `list[dict]` from each subclass's `get_report`, or a CSV attachment when `?export=csv`. Eight subclasses.
5. `backend/apps/agents/views.py` (`TaskViewSet`) and `backend/apps/notifications/views.py` (`NotificationViewSet`) — both scope in `get_queryset` and declare no class-level `queryset`.
6. `backend/apps/knowledge_base/serializers.py` — the `CategorySerializer` that collides with the tickets one.
7. `backend/apps/core/views.py` — `HealthView` (65-94), `PermissionCatalogView` (97-118), `ApiNotFoundView` (121-144).
8. `backend/apps/integrations/schema.py` — `envelope_postprocessing_hook`. Every documented response is wrapped by it; **do not** hand-write the envelope into any `@extend_schema`.

---

## Backend Tasks

### 1 — Fix the two untyped path parameters

**Files: `backend/apps/agents/views.py`, `backend/apps/notifications/views.py`**

Add a class-level `queryset` alongside the existing `get_queryset`:

```python
    # Schema-introspection only — `get_queryset` below is what actually runs
    # and scopes every action to `request.user`. Without this, spectacular
    # cannot resolve the model at generation time (there is no request, so
    # `get_queryset` raises) and types the `id` path parameter as a STRING
    # (W001). DRF calls `get_queryset()` for every real request, so this
    # attribute never widens access.
    queryset = Task.objects.none()
```

**`.none()`, not `.all()`.** If a future refactor ever dropped `get_queryset`, `.none()` fails closed and `.all()` would expose every row — the same fail-closed reasoning as Story 99's `DEFAULT_PERMISSION_CLASSES`. Verify with a live request that both viewsets still return only the caller's own rows.

### 2 — Resolve the `Category` component collision

**File: `backend/apps/knowledge_base/serializers.py`**

```python
@extend_schema_serializer(component_name="ArticleCategory")
class CategorySerializer(BaseModelSerializer):
```

`component_name`, **not** a class rename. The rename would touch every import and call site across the KB app for a schema-only concern; `extend_schema_serializer` is drf-spectacular's own mechanism for precisely this collision. The knowledge-base one is renamed rather than the tickets one because ticket categories are the older and more widely referenced concept.

### 3 — Override the colliding enum name

**File: `backend/config/settings/base.py`**

Add to `SPECTACULAR_SETTINGS`:

```python
    # Several models declare a `status` choice set, so spectacular falls back
    # to a hash-suffixed name (`Status6f2Enum`) that is stable but
    # meaningless in a generated client. Name the ticket one explicitly; the
    # others keep their generated names until they collide too.
    "ENUM_NAME_OVERRIDES": {
        "TicketStatusEnum": "apps.tickets.models.Ticket.Status",
    },
```

Verify the resulting name in the generated schema; if the override does not resolve, spectacular silently keeps the hashed name — **check the output, do not assume**.

### 4 — Document the views that already have serializers

Add `@extend_schema` naming the serializer each view **already constructs** (see `## What discovery changed` item 2). For `MeView`, `responses=UserSerializer` and `request=None` (it is a GET). For the write views, `request=XSerializer` with `responses` matching what the view actually returns — several return `204` or a bare envelope, so declare that rather than echoing the request serializer back.

**Read each view body before annotating it.** An annotation that disagrees with the code is worse than no annotation: it is confidently wrong.

### 5 — Document the ad-hoc views

For views returning a computed structure with no serializer:

- **The eight report views** — `BaseReportView.get` returns `list[dict]`, shape varying per subclass. Annotate each with `responses=OpenApiTypes.OBJECT` inside a list, and document the `?export=csv` variant. Put whatever is common on the base via `@extend_schema_view` or a shared decorator rather than repeating it eight times.
- **`PermissionCatalogView`** returns `sorted(ALL_PERMISSIONS)` — a list of strings.
- **`WebhookEventCatalogView`**, **`WebFormCategoriesView`**, **`KnowledgeBaseSearchView`**, **`PortalChatbotView`/`HandoffView`**, **`LiveChatStartView`**, **`WebFormSubmissionView`** — declare request/response from the actual code.
- **The three inbound webhooks** (`Email`/`WhatsApp`/`SMS`) — document them. They are called by providers rather than API consumers, but they are real endpoints on this service's surface and a reader of the schema should see they exist. `request=None` where the payload is provider-defined, with a description saying so.

### 6 — Exclude the two non-endpoints

`@extend_schema(exclude=True)` on `HealthView` and `ApiNotFoundView`, each with a comment giving the reason (item 4 above).

---

## Frontend Tasks

**No frontend changes required.** The frontend does not consume the generated schema; it hand-writes its API types.

---

## Edge Cases & Failure Modes

- **An annotation that lies.** The main risk of this whole story. Every `@extend_schema` must be written from the view body, not from the view name. Verification step 4 spot-checks a sample against real responses.
- **`queryset = Task.objects.none()` masking `get_queryset`.** If a future edit removes `get_queryset`, the viewset returns nothing rather than everything. Deliberate; state it in the comment so nobody "fixes" it to `.all()`.
- **The envelope hook double-wrapping.** `envelope_postprocessing_hook` wraps every response, and `DefaultPageNumberPagination.get_paginated_response_schema` already emits a full envelope (which is why the hook skips already-enveloped schemas). A hand-written envelope in an `@extend_schema` would be wrapped twice. **Never write `success`/`data`/`error`/`meta` into an annotation.**
- **`ENUM_NAME_OVERRIDES` pointing at the wrong path.** A bad dotted path is silently ignored, leaving the hashed name. Check the generated schema for `Status6f2Enum`.
- **Excluding a view hides a real endpoint.** Only `HealthView` and `ApiNotFoundView` may be excluded. If the warning count reaches zero partly because something else was excluded, the story failed.
- **CSV responses.** The report views return a file attachment when `?export=csv`. Do not document that as JSON.
- **A new warning class appears.** Fixing W002 can surface W001 collisions that were previously masked by the view being skipped entirely. The gate is the **total**, not just W002.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md §16. **No test file is added, modified, or removed.** Verification is below.

`manage.py spectacular --fail-on-warn` is the closest thing to a test here and is used in verification.

---

## Migration / Rollback

**No model change, no migration, no behaviour change.** Annotations, two `queryset` attributes and two settings keys.

**Rollback is `git revert`.** Nothing persisted; the schema regenerates from code on every request to `/api/schema/`.

---

## Verification Steps

1. **Frontend untouched:** `git status --short frontend/` is empty.
2. **Gates:** `ruff check`, `ruff format --check`, `manage.py check`, `makemigrations --check --dry-run` all pass.
3. **THE GATE — zero warnings.** `DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy` reports **0** `drf_spectacular` issues (down from 38), and **0 security warnings** as before. Equivalently, `python manage.py spectacular --fail-on-warn > /dev/null` exits 0.
4. **The schema is honest.** Generate it and spot-check at least four annotated endpoints against a real response from a running server — one auth view, one report view, one settings view, one webhook. The documented request/response must match what the endpoint actually accepts and returns.
5. **No wildcard path, no health probe** in the generated schema (`ApiNotFoundView`, `HealthView` excluded); **every other** view from the 31 IS present.
6. **`id` is an integer.** In the generated schema, the `id` path parameter for `/api/tasks/{id}/` and `/api/notifications/{id}/` is `type: integer`, not `string`.
7. **No hashed enum names:** `grep -c "Status6f2Enum"` against the generated schema is **0**.
8. **No duplicate component names:** the schema contains both a ticket `Category` and an `ArticleCategory` component, with no name reused for two different shapes.
9. **Behaviour is unchanged — the real risk of task 1.** With an agent JWT, `GET /api/tasks/` and `GET /api/notifications/` still return **only the caller's own rows**, and `GET /api/tasks/{id}/` for another user's task still 404s. Re-run Story 99's portal sweep unchanged.
10. **The envelope is not doubled.** Pick two annotated endpoints and confirm the schema shows one `success`/`data`/`error`/`meta` wrapper, not two.
11. **Docs still render.** `/api/schema/`, `/api/docs/` and the redoc route all return 200 in dev and load without console errors.

---

## Done Criteria

- [ ] `check --deploy` reports **0** `drf_spectacular` issues (was 38) and still 0 security warnings.
- [ ] `spectacular --fail-on-warn` exits 0.
- [ ] All 31 previously-omitted views are documented, except `HealthView` and `ApiNotFoundView`, which are explicitly excluded with a stated reason.
- [ ] Every annotation names the serializer the view actually uses, or an accurate ad-hoc shape; none invents a shape.
- [ ] `TaskViewSet` and `NotificationViewSet` declare `queryset = …objects.none()`, and both still return only the caller's own rows.
- [ ] `id` is typed `integer` for both viewsets in the schema.
- [ ] The KB serializer emits component `ArticleCategory`; no component name is reused.
- [ ] `Status6f2Enum` no longer appears in the schema.
- [ ] No response schema carries a doubled envelope.
- [ ] `/api/schema/` and `/api/docs/` render.
- [ ] No endpoint behaviour, request shape or response shape changed.
- [ ] `git status --short frontend/` is empty.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md §16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 105.**
