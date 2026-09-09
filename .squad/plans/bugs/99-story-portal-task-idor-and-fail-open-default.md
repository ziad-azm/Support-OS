# Story 99 — Portal Task IDOR & the Fail-Open Permission Default

## Prerequisites

- **Story 32 (`AGENT-3`) implemented:** [../agent-workspace/32-story-tasks-reminders-SUPPORTOS-47.md](../agent-workspace/32-story-tasks-reminders-SUPPORTOS-47.md). Verified landed: `TaskViewSet` (`backend/apps/agents/views.py:18-62`) and `TaskSerializer` (`backend/apps/agents/serializers.py:9-39`). **That story's `## Prerequisites` line 14 is the decision this story reverses** — read it before writing any code.
- **Story 34 (`AGENT-5`) implemented:** [../agent-workspace/34-story-team-collaboration-SUPPORTOS-65.md](../agent-workspace/34-story-team-collaboration-SUPPORTOS-65.md). Verified landed: `InternalNoteSerializer.mentioned_users` (`backend/apps/agents/serializers.py:57-64`) — **the exact fix pattern this story applies, already present 18 lines below the defect, in the same file.**
- **Story 84 (`AUTH-3`) implemented:** `RedirectPortalOnly` (`frontend/src/shared/auth/RedirectPortalOnly.tsx`) is live and wraps the whole staff route tree (`frontend/src/app/router.tsx:111`). **It does not fix this bug** — see `## What discovery changed` item 1.
- **Intake:** `.squad/stories/bugs/qa-report-1/intake.md`.
- **Attachment (read F-1 and F-4 in full):** `.squad/stories/bugs/qa-report-1/attachments/QA-REPORT-1.md`.
- **No frontend change of any kind.** `git status --short frontend/` must be empty at the end of this story.

---

## What discovery changed

Four things were verified against the running code and a live API before this plan was written. Three of them change what gets built.

### 1. The vulnerability survives `RedirectPortalOnly` — it is an API bug, not a routing bug

`Sidebar.tsx:263-267` carries this comment against the deliberately ungated `/tasks` link:

```
Deliberately ungated, unlike every other link in this file:
TaskViewSet scopes to request.user's own rows (personal, safe
for any staff account), and after Story 84 a portal-only
account never reaches this sidebar at all — RedirectPortalOnly
sends it to /portal before RootLayout ever renders.
```

That is true and it is **not the defence anyone thinks it is.** `RedirectPortalOnly` guards the React router. The exploit never loads the React app: it presents the portal customer's own JWT directly to `POST /api/tasks/`.

Reproduced live against `runserver` on `:8009` with a portal customer holding exactly `portal.access` + `knowledge_base.view`, **with Story 84 already in the tree**:

| Request | Result |
|---|---|
| `GET /api/tickets/143/` | **403** — correctly denied |
| `GET /api/portal/tickets/143/` | **404** — correctly denied |
| `POST /api/tasks/` `{"title":"x","ticket":143,"due_at":"2030-01-01T00:00:00Z"}` | **201**, body contains `"ticket_subject": "Requesting a refund for last month"` |

Ticket 143 belongs to customer 107, not the caller. Iterating `ticket` over the id range enumerates every ticket subject in the system.

**The executor must not "fix" this in the frontend.** No sidebar, router, or `<Can>` change closes it.

### 2. Story 32's deferral reasoned about the picker, not about the API

Story 32 `## Prerequisites` line 14 justified skipping the check like this:

> *Task's own picker (`useTicketOptions`, task 12) calls `GET /api/tickets/?page_size=100`, itself gated `tickets.view` … a caller without it simply sees an empty picker.*

The reasoning is sound for the *UI* and irrelevant to the *API*. An empty picker constrains what the form offers; it constrains nothing about what a hand-written request may send, because `TaskSerializer.ticket` is DRF's auto-generated relation over `Ticket.objects.all()`.

### 3. Story 34 already solved this exact class, in this exact file, and nobody went back

`backend/apps/agents/serializers.py:57-64`:

```python
    # Explicit `queryset=`, not DRF's auto-generated `User.objects.all()`:
    # validates against the same candidate pool `TicketViewSet.assign`
    # already validates assignment against, so a hand-crafted request
    # cannot mention (and notify) an agent who holds no `tickets.manage`.
    # See Story 34 `## Prerequisites`.
    mentioned_users = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=assignable_agents()
    )
```

"**A hand-crafted request cannot …**" is precisely the standard `TaskSerializer.ticket` fails. Story 34 raised the bar for `mentioned_users` two stories after Story 32 set it low for `ticket`, and the two fields now sit 43 lines apart in the same module under two different rules. **This story makes them consistent.**

Note the sibling that is genuinely safe and must not be touched: `NotificationSerializer.ticket_subject` has the identical field shape, but `NotificationViewSet` (`backend/apps/notifications/views.py:11-13`) is `ListModelMixin + RetrieveModelMixin` only — it has **no create or update action to send a foreign `ticket` through**, and rows are written solely by `apps.notifications.services.notify`. Same shape, no exposure.

### 4. F-4's flip is verified to change the behaviour of **zero** existing views

CONVENTIONS.md §13 (line 212) defers the flip because *"right now there is exactly one authenticated endpoint, so the change would trade real regression risk for no real safety."* That sentence is now years stale, and the regression risk was measured, not assumed. Every view in the project was enumerated:

| View group | Where its permission comes from | Affected by the flip? |
|---|---|---|
| Every `BaseModelViewSet` subclass | `backend/apps/core/views.py:30` — `[IsAuthenticated, HasPermission]` | No |
| 14 explicit `AllowAny` views (accounts ×4, communications ×6, core ×2, organization ×2) | their own `permission_classes` | No |
| Every other `APIView` (reports, settings, ERP, portal chatbot, KB search …) | their own `permission_classes` | No |
| `SchemaView` + Swagger + Redoc | `SpectacularAPIView.permission_classes = spectacular_settings.SERVE_PERMISSIONS` — verified at `.venv/Lib/site-packages/drf_spectacular/views.py:54`, driven by `API_DOCS_PUBLIC` (`config/settings/base.py:620, 638-642`) | No |
| `ThrottledTokenObtainPairView` / `ThrottledTokenRefreshView` (`backend/apps/accounts/throttled_token_views.py:23, 30`) — **declare `throttle_classes` and nothing else** | `TokenViewBase.permission_classes = ()` — verified at `.venv/Lib/site-packages/rest_framework_simplejwt/views.py:15` | **No** |

The token views were the one real hazard: had simplejwt fallen through to the global default, flipping it would have made obtaining a token require already holding one — a bootstrap deadlock that locks every user out of the product. It does not; `TokenViewBase` sets an **empty tuple**, which short-circuits the default entirely.

An exhaustive scan for view classes carrying no `permission_classes` of their own returned exactly one hit — `SchemaView` — and it is covered by the row above.

---

## Story Goal

Close the one confirmed cross-tenant data leak in the API, and turn the project's fail-open authorization default into a fail-closed one.

1. A portal customer can no longer read another customer's ticket subject — or learn that a ticket id exists — through `POST`/`PATCH /api/tasks/`.
2. `TaskSerializer.ticket` validates against a candidate pool, matching the rule `InternalNoteSerializer.mentioned_users` has enforced since Story 34.
3. `DEFAULT_PERMISSION_CLASSES` becomes `IsAuthenticated`, so a future view that forgets `permission_classes` is closed rather than public.
4. The two documents that record the old decisions — CONVENTIONS.md §13 and `BaseModelViewSet`'s docstring — are corrected in the same change, so the next reader is not told the opposite of what the code does.

**Not in scope:** every other finding in the attachment. F-2 (role-grant drift), F-5/F-6 (contrast), F-7 (dashboard chart), F-8/F-9 (ticket queue), F-10 (schema) and F-11..F-20 (polish) are separate stories — see [00-overview.md](00-overview.md). Do not widen this one.

---

## Context — Read These Files First

1. `backend/apps/agents/serializers.py` (89 lines, full file) — **the whole story is in this file.** `TaskSerializer` at lines 9-39; the comment to rewrite at lines 10-13; `InternalNoteSerializer.mentioned_users` at lines 57-64 is the pattern to copy, including the shape of its comment.
2. `backend/apps/agents/views.py` — `TaskViewSet` at lines 18-62. Note `permission_classes = [IsAuthenticated]` (line 31) and `get_queryset` scoping to `owner=self.request.user` (line 37). The owner scoping is correct and stays; it is the writable `ticket` relation that is unguarded.
3. `backend/apps/tickets/assignment.py` lines 22-40 — `assignable_agents()`, the precedent for "a module-level callable returning the candidate queryset, shared by the picker and the validator so the two cannot drift." Read its docstring; the new helper follows its reasoning.
4. `backend/apps/core/views.py` lines 12-31 — `BaseModelViewSet`. **Lines 25-27 are a docstring that this story falsifies** (`"DEFAULT_PERMISSION_CLASSES stays AllowAny project-wide"`). Lines 34-62 are `CustomerScopedModelViewSet`; line 55 is `customer_field`.
5. `backend/apps/core/permissions.py` lines 107-138 — `HasPermission.has_object_permission`. Read the docstring: it already implements "tighten only when `request.user` has a linked `Customer`" via `customer_profile`, and explains why it opts in on `customer_field` rather than defaulting. **Task 1's helper reuses the same `customer_profile` probe.**
6. `backend/config/settings/base.py` lines 276-293 — the `DEFAULT_AUTHENTICATION_CLASSES` / `DEFAULT_PERMISSION_CLASSES` block. Lines 276-280 are a stale comment referring to "AUTH-2 tightens permissions … Until then the API stays open by default"; lines 291-293 are the setting itself.
7. `backend/apps/customers/models.py` lines 69-76 — `Customer.user`, `related_name="customer_profile"`, `SET_NULL`, **nullable**. Most `Customer` rows have no linked user; this is why the helper probes from the *user* side, not the customer side.
8. `CONVENTIONS.md` §13 (lines 191-215) — "Auth conventions". The "Standing note on the project-wide default" paragraph starts at line 204; the deferral sentence to replace is at lines 212-215.
9. `.squad/stories/bugs/qa-report-1/attachments/QA-REPORT-1.md` — F-1 and F-4 with the live reproduction transcript and the full `AllowAny` inventory.
10. Grep for `customer_profile` in `backend/apps/` — three call sites today (`core/permissions.py:132`, `core/views.py:59`, and the portal app). The new helper is the fourth and must read the same way.

---

## Product rules (from story)

| Current behaviour | New behaviour |
|---|---|
| `POST /api/tasks/` accepts any `ticket` id in the database from any authenticated caller, and returns that ticket's `subject` in `ticket_subject`. | A caller with a linked `Customer` may only reference tickets belonging to **their own** customer. Any other id is a **400 validation error**, indistinguishable from a nonexistent id. |
| A staff caller (no `customer_profile`) may reference any ticket. | **Unchanged.** Staff behaviour is byte-identical. |
| A view that omits `permission_classes` is public. | A view that omits `permission_classes` requires authentication. The 14 deliberately public views keep their explicit `AllowAny`. |

---

## Backend Tasks

### 1 — Narrow `TaskSerializer.ticket` to a per-caller candidate pool

**File: `backend/apps/agents/serializers.py`**

Add a module-level helper above `TaskSerializer`, then override `get_fields`.

The helper is deliberately **not** a bare queryset constant like `assignable_agents()`, because the candidate pool here depends on *who is asking* — `assignable_agents()` is caller-independent, this is not. Keep it a plain function taking the user, so it is testable by hand in a shell and reusable if a second task-shaped resource ever links a ticket.

```python
def linkable_tickets(user) -> QuerySet:
    """Tickets `user` may reference from a personal record — AGENT-3 / F-1.

    The caller-dependent sibling of `apps.tickets.assignment.assignable_agents`:
    same job (an explicit `queryset=` so a hand-crafted request cannot reach a
    row the caller could not otherwise read), but the pool narrows per caller
    rather than being one fixed set.

    A portal caller is identified exactly as `HasPermission.has_object_permission`
    identifies one (`apps/core/permissions.py:132`) — by a linked
    `customers.Customer` via `customer_profile`. Staff have none, so they keep
    the full queryset and their behaviour is unchanged.

    Story 32 deliberately left this field unguarded, reasoning that the picker
    is already gated on `tickets.view`. That is true of the picker and untrue
    of the API: verified live, a `portal.access`-only account could POST a
    foreign ticket id and read its subject back out of `ticket_subject`.
    Story 34 had already applied this exact defence to
    `InternalNoteSerializer.mentioned_users` (below); this brings the two
    writable relations in this module under one rule.
    """
    queryset = Ticket.objects.all()
    customer = getattr(user, "customer_profile", None)
    if customer is None:
        return queryset
    return queryset.filter(customer=customer)
```

Import `Ticket` from `apps.tickets.models` and `QuerySet` from `django.db.models`. **`apps.agents.models` already imports `Ticket` from `apps.tickets.models`** — verify before adding the import; this is the same safe reverse-direction import `apps/tickets/assignment.py:1-10` documents.

Then on `TaskSerializer`:

```python
    def get_fields(self):
        """Binds `ticket`'s queryset to the caller — see `linkable_tickets`.

        `get_fields`, not a `validate_ticket`: DRF resolves a
        `PrimaryKeyRelatedField` against its queryset *before* any
        `validate_<field>` runs, so a rejection here is DRF's own
        "object does not exist" 400 rather than a second, different error
        shape. It also means the browsable-API/OPTIONS choice list narrows
        for free.
        """
        fields = super().get_fields()
        request = self.context.get("request")
        if request is not None:
            fields["ticket"].queryset = linkable_tickets(request.user)
        return fields
```

**Guard `request is not None`.** A serializer instantiated outside a request (a shell, a management command, `apps/agents/tasks.py`'s reminder job) has no `request` in context and must keep the default queryset rather than raising `AttributeError`.

Rewrite the field's comment at lines 10-13 — the current text (*"No extra permission check on this field — see Story 32"*) becomes false the moment this task lands, and leaving it is worse than having never written it:

```python
    # Read-only convenience, the same role `NotificationSerializer.ticket_subject`
    # plays (Story 31) — `default=""` covers a null `ticket` (the link is
    # optional; most tasks have none). The WRITABLE `ticket` relation below is
    # what gates this: `get_fields` binds it to `linkable_tickets(request.user)`,
    # so a portal caller can never name a ticket that is not their own and
    # therefore never reads a subject that is not theirs. Story 32 left this
    # open; F-1 (qa-report-1) closed it.
    ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")
```

### 2 — Flip the project-wide permission default

**File: `backend/config/settings/base.py`**

Replace lines 291-293 and the stale comment at 276-280.

```python
    # Fail CLOSED. A view that declares no `permission_classes` of its own now
    # requires authentication instead of being public. Verified before the flip
    # that this changes NO existing view: every domain view sets
    # `permission_classes` explicitly (14 of them deliberately `AllowAny`),
    # `SpectacularAPIView` takes its own from
    # `SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"]` (drf_spectacular/views.py:54),
    # and simplejwt's `TokenViewBase` sets `permission_classes = ()`
    # (rest_framework_simplejwt/views.py:15) — so login does NOT deadlock on
    # this default. See CONVENTIONS.md §13. F-4 (qa-report-1).
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
```

Leave the `DEFAULT_AUTHENTICATION_CLASSES` block and its "JWTAuthentication stays FIRST" comment (lines 281-290) **untouched** — it is about authenticator ordering and is unrelated.

**Do not add `AllowAny` to any view in this task.** All 14 already declare it. If a verification step finds a view that needs one, that is a discovery, not a routine edit — report it.

### 3 — Correct `BaseModelViewSet`'s docstring

**File: `backend/apps/core/views.py`**

Lines 25-27 currently read:

```
    `DEFAULT_PERMISSION_CLASSES` stays `AllowAny` project-wide (see
    CONVENTIONS.md §13) — this base is what makes a domain endpoint closed by
    default, not the global setting.
```

Replace with:

```
    `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated` project-wide (see
    CONVENTIONS.md §13). This base still carries the authorization half —
    the global default only guarantees a caller is signed in; `HasPermission`
    plus this viewset's `permission_map` is what makes a domain endpoint
    closed by *permission*, not merely by authentication.
```

The distinction matters and must survive the edit: the global default now covers authentication, and this base is what still covers authorization.

### 4 — Update CONVENTIONS.md §13

**File: `CONVENTIONS.md`**

Replace the "Standing note on the project-wide default, now narrowed." paragraph (lines 204-215) with a note recording what the default now is and what closed it. Keep the section's existing structure and the §21/§22 cross-references above it.

The replacement must state: the default is `IsAuthenticated` as of this story; the 14 public endpoints opt out explicitly with `AllowAny`; `SpectacularAPIView` and simplejwt's token views resolve their own permissions and are unaffected; and — the load-bearing sentence — **an `APIView` that must be public now says so explicitly, rather than being public by silence.**

Delete the deferral sentence at lines 212-215 outright. "Right now there is exactly one authenticated endpoint" has been false for the entire life of the project as it stands and must not survive as a justification for anything.

---

## Frontend Tasks

**No frontend changes required.**

This is stated explicitly because the instinct on reading "a portal customer can reach `/tasks`" is to gate the sidebar link or add a `<RequirePermission>`. **That would not fix the bug** — see `## What discovery changed` item 1. The `/tasks` sidebar link and its comment at `frontend/src/app/Sidebar.tsx:263-273` are correct as written and stay untouched; `RedirectPortalOnly` stays as it is.

`git status --short frontend/` is empty at the end of this story — Verification step 1.

---

## Edge Cases & Failure Modes

- **Serializer used with no request in context** (`apps/agents/tasks.py`'s due-reminder job, a `manage.py shell` session, a future management command). `self.context.get("request")` returns `None`, the `if request is not None` guard skips the rebind, and `ticket` keeps DRF's default full queryset. Enforced by the guard in task 1; without it every non-HTTP serializer instantiation raises `AttributeError` on `None.user`.
- **Anonymous user reaching the serializer.** Cannot happen through the API — `TaskViewSet.permission_classes = [IsAuthenticated]` (`views.py:31`) rejects first — but `getattr(AnonymousUser(), "customer_profile", None)` returns `None` anyway, so the helper degrades to the full queryset rather than raising. Safe by construction, not by the caller being careful.
- **A staff user who also has a linked `Customer` row.** `Customer.user` is a `OneToOneField` to `accounts.User` with no constraint preventing a staff account from being linked. Such a caller **is treated as a portal caller** and is narrowed to that customer's tickets. This is the same rule `HasPermission.has_object_permission` already applies (`permissions.py:132-138` tightens on the presence of `customer_profile`, not on role), so this story introduces no new inconsistency — but it is a real behaviour change for that account shape. **No such account exists in the seed data** (verified: 2 of 12 customers have a linked user, both `customer`-role). Note it in the helper docstring rather than special-casing it.
- **`Customer.user` is `SET_NULL` and nullable** (`customers/models.py:69-76`). If a customer's login is unlinked while they hold a session, `customer_profile` becomes `None` mid-token-lifetime and the helper widens to the full queryset for the remaining token life. The caller still cannot *read* a foreign ticket — `TicketViewSet.permission_map["retrieve"]` requires `tickets.view`, which they do not hold — but they could once more link one to a task and read its subject. Acceptable and bounded by `SIMPLE_JWT`'s access-token lifetime; unlinking a portal login is a deliberate staff action taken through Django admin, not a routine event.
- **PATCH of an existing task's `ticket`.** `get_fields` runs for update as well as create, so the same narrowing applies to `partial_update` — a portal caller cannot re-point an existing task at a foreign ticket. Note that `TaskSerializer` declares **no** `immutable_fields` (unlike `InternalNoteSerializer.immutable_fields = ("ticket",)`, `serializers.py:70`); a task's ticket link is deliberately re-pointable by its owner. Do not add `immutable_fields` here — that would be a behaviour change beyond this story's scope.
- **The 400 must not distinguish "not yours" from "does not exist."** DRF's `PrimaryKeyRelatedField` emits the same `does_not_exist` message for both, which is the desired outcome: a caller who can tell the two apart can still enumerate which ticket ids exist. Do **not** replace it with a custom "you do not own this ticket" message.
- **`ticket: null` and an omitted `ticket`.** Both must keep working — `Task.ticket` is `null=True, blank=True` (`apps/agents/models.py:28-35`) and most tasks have no link at all. Narrowing a queryset does not affect null handling, but it is the single most likely thing to break by accident. Verification step 6.
- **Flipping the default breaks an unlisted view.** The inventory in `## What discovery changed` item 4 was produced by an exhaustive scan, and one hit (`SchemaView`) was accounted for. If Verification step 8 finds a 401 where a 200 is expected, **stop and report** — do not paper over it by adding `AllowAny` to whatever view surfaced.
- **`API_DOCS_PUBLIC` interaction.** `prod.py:31` defaults it to `False`, so `/api/schema/` and `/api/docs/` already require authentication in production and are unaffected by this story in either environment. Confirm dev still serves them anonymously (Verification step 8) — that is `base.py:620`'s `default=True`, not the DRF default.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md §16 (lines 251-259): *"Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."*

**No test file is added, modified, or removed.** Verification is `## Verification Steps` below.

Note for whoever revisits this: the attachment's F-3 argues that an authorization-matrix test would have caught this defect on the day Story 32 shipped, and would catch the next one. That recommendation is recorded in `.squad/stories/bugs/qa-report-1/attachments/QA-REPORT-1.md` §5 and is deliberately **not** acted on here, because §16 is a project-level policy this story has no standing to overturn.

---

## Migration / Rollback

**No model change, therefore no migration.** `makemigrations --check --dry-run` must report **"No changes detected"** — Verification step 2.

**Deploy ordering is unconstrained.** Task 1 tightens a validation rule on an existing endpoint; task 2 changes a default that provably no current view consults. Neither alters the wire format, so backend and frontend may ship in either order, and an old frontend against a new backend behaves identically (the ticket picker was already empty for a portal caller — that is Story 32's own argument, and it remains true).

**Rollback is `git revert` of the single commit.** Nothing is persisted and no data is rewritten: the candidate pool is computed per request from `request.user`, and the permission default is read at import time. Reverting restores both the leak and the fail-open default together.

**The one thing a half-applied state can do:** if task 2 lands without task 1 — for example by cherry-picking the settings line alone — nothing improves, because the leak has never depended on the global default (`TaskViewSet` sets `permission_classes` explicitly). The reverse split is harmless. **Ship the two tasks together**; there is no ordering hazard, only a false sense of having fixed something.

---

## Verification Steps

1. **Frontend untouched:** `git status --short frontend/` is empty.
2. **No migration:** in `backend/`, `python manage.py makemigrations --check --dry-run` reports **"No changes detected"**.
3. **Backend gates:** in `backend/`, `python -m ruff check .` reports "All checks passed!" and `python -m ruff format --check .` reports all files formatted (177 before this story; the count may rise only if a file is added — it should not be).
4. **System checks:** `python manage.py check` reports **0 issues**, and `DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy` reports **zero security warnings** and no more than the 38 pre-existing `drf_spectacular` warnings. **The count must not rise** — F-10 is a separate story, but this story must not make it worse.
5. **The headline check — F-1 is closed.** Start `python manage.py runserver 8009 --noreload`. Obtain a JWT for a portal customer (a `User` with the `customer` role and a linked `Customer`; `sara.ahmed@example.com` and `omar.khaled@example.com` are the two seeded ones). Pick a ticket id **not** belonging to that customer, then:
   - `POST /api/tasks/` with `{"title":"probe","ticket":<foreign id>,"due_at":"2030-01-01T00:00:00Z"}` returns **400**, and the response body contains **no** `ticket_subject` and **no** ticket subject text anywhere.
   - The same `POST` with a ticket id that **does** belong to that customer returns **201** and echoes that customer's own `ticket_subject`.
   - `PATCH` of an existing task, re-pointing `ticket` to the foreign id, also returns **400**.
6. **Nulls still work.** As the same portal customer, `POST /api/tasks/` with `{"title":"no link","due_at":"2030-01-01T00:00:00Z"}` (no `ticket` key) returns **201** with `"ticket": null` and `"ticket_subject": ""`. Repeat with an explicit `"ticket": null` — also **201**.
7. **Staff are unaffected.** With an agent JWT (`agent1@supportos.local`), `POST /api/tasks/` linking **any** ticket in the system returns **201** with the correct `ticket_subject`, `GET /api/tasks/` lists only that agent's own rows, and `POST /api/tasks/<id>/complete/` and `/reopen/` behave as before.
8. **F-4 changed nothing that was working.** With the server restarted on the new setting, and **unauthenticated**:
   - `GET /api/health/` → **200**
   - `GET /api/branding/` → **200**
   - `GET /api/landing-content/` → **200**
   - `POST /api/auth/token/` with valid credentials → **200 with tokens** (this is the bootstrap check — if it 401s, the flip is wrong and must be reverted immediately)
   - `POST /api/auth/token/refresh/` with a valid refresh token → **200**
   - `POST /api/auth/password-reset/request/` → **200**
   - `GET /api/schema/` and `GET /api/docs/` → **200** under `config.settings.dev` (`API_DOCS_PUBLIC` defaults `True` there)
   - `GET /api/tickets/` → **401** (unchanged)
   - `GET /api/nope/` → **404** in the envelope shape (unchanged — `ApiNotFoundView` sets `AllowAny` explicitly)
9. **The docs no longer contradict the code.** `grep -n "AllowAny" CONVENTIONS.md` returns no line claiming the project-wide default *is* `AllowAny`; `grep -rn "stays .AllowAny. project-wide" backend/apps/core/views.py` returns **zero** hits; and `grep -n "exactly one authenticated endpoint" CONVENTIONS.md` returns **zero** hits.
10. **The two writable relations now read alike.** In `backend/apps/agents/serializers.py`, `TaskSerializer`'s `ticket` and `InternalNoteSerializer`'s `mentioned_users` both carry a comment naming the hand-crafted-request threat and both bind an explicit queryset. A reader should not be able to tell which one was written first.
11. **Regression sweep — the rest of the portal boundary still holds.** With the portal-customer JWT from step 5, `GET` each of `/api/customers/`, `/api/audit-logs/`, `/api/users/`, `/api/internal-notes/`, `/api/quick-replies/`, `/api/webhooks/subscriptions/`, `/api/api-keys/`, `/api/settings/` → all **403**; `/api/notifications/` and `/api/tasks/` → **200** (own rows only); `/api/tickets/<foreign id>/` → **403**; `/api/portal/tickets/<foreign id>/` → **404**. This is the same sweep that found F-1 and is the regression gate for it.
12. **Query counts did not regress.** Measure with `settings.DEBUG=True`, driving each endpoint through Django's test `Client` with a JWT and reading `len(connection.queries)`.
    - `GET /api/tickets/?page_size=25` still issues **4** queries — untouched by this story.
    - `GET /api/tasks/?page_size=25` measured **2** before this story (count + page; `select_related("ticket")` already covers the join). `linkable_tickets` adds **at most one** `customer_profile` lookup, so **2 or 3 is correct and 3 is expected**. The gate is not the absolute number: the count must be **identical for `page_size=1` and `page_size=25`** — the probe reads `request.user` once per serializer instantiation and Django caches the reverse one-to-one on that instance, so it must **not** scale with row count. A count that grows with rows means the probe was put somewhere per-row and the task is wrong.

---

## Done Criteria

- [ ] A portal customer POSTing `/api/tasks/` with another customer's ticket id receives **400**, and no ticket subject for that ticket appears anywhere in the response. Verified against a running server, not by reading the diff.
- [ ] The same caller can still create a task linked to one of **their own** tickets, and a task with no ticket at all (omitted **and** explicit `null`).
- [ ] `PATCH` is narrowed identically to `POST` — an existing task cannot be re-pointed at a foreign ticket.
- [ ] Staff behaviour on `/api/tasks/` is **unchanged**: any ticket linkable, own rows only in `list`, `complete`/`reopen` unaffected.
- [ ] `TaskSerializer.ticket` binds an explicit per-caller queryset via `get_fields`, guarded against a missing `request` in context, and the helper documents why Story 32's picker-based reasoning did not hold for the API.
- [ ] The now-false comment at `serializers.py:10-13` ("No extra permission check on this field") is rewritten, not left standing.
- [ ] `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated`, and **every** endpoint in Verification step 8 returns the status recorded there — `POST /api/auth/token/` **must** still return tokens to an unauthenticated caller.
- [ ] No view gained an `AllowAny` it did not already have; all 14 pre-existing ones are untouched.
- [ ] `BaseModelViewSet`'s docstring no longer claims the global default is `AllowAny`, and still explains that the base carries the **authorization** half.
- [ ] CONVENTIONS.md §13 records the new default and the explicit-opt-out rule; the "exactly one authenticated endpoint" deferral sentence is deleted.
- [ ] `ruff check`, `ruff format --check`, `manage.py check`, `makemigrations --check --dry-run` all pass; `check --deploy` still reports zero security warnings and no new `drf_spectacular` warnings.
- [ ] `git status --short frontend/` is empty — no sidebar, router, or `<Can>` change was made.
- [ ] The portal-boundary regression sweep (Verification step 11) passes in full.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md §16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 100.**
