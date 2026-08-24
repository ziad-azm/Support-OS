# Backend app layout (`ARCH`, backend half)

This is a decision record, not a tutorial. It exists so nobody has to re-derive
where a new file goes.

## One app per business area

Each directory here is a **business area**, not a technical layer. There is no
top-level `serializers/`, `views/`, `services/`, or `utils/` package, and there
never will be — that shape scatters one feature across five directories and
makes every change a multi-package edit.

## Where new code goes

Work down this list and stop at the first match:

1. **Belongs to exactly one business area** → that app.
2. **Needed by two or more apps** → `apps/core`.
3. **Needed by two or more apps but only as a type, enum, or constant** →
   `apps/core`. Do not copy it into each app.
4. **Genuinely a new business area** → a new app, plus a row in the table below.
   Adding an app is a reviewed decision, not a reflex; most new code belongs in
   an app that already exists.

If you are unsure between an app and `core`, put it in the app. Moving code
into `core` later is easy; untangling `core` after it becomes a dumping ground
is not.

## What `core` is for

`apps/core` holds cross-cutting machinery that every app depends on:

- `envelope.py` — the API response shape (`Envelope`, `success_envelope`,
  `error_envelope`).
- `renderers.py` — `EnvelopeJSONRenderer`, which wraps every success response.
- `exceptions.py` — `envelope_exception_handler`, which wraps every error.
- `pagination.py` — `DefaultPageNumberPagination`.
- `views.py` — `BaseModelViewSet`, the single inheritance point for domain
  viewsets, and `HealthView`.
- `serializers.py` — `BaseModelSerializer`.
- `models.py` — `TimeStampedModel`, the abstract base for every domain model.

`core` is **not** a dumping ground. It holds no business logic and nothing that
only one app uses. A helper used by exactly one app lives in that app.

## Files are created on demand

An app gets a `serializers.py` when it has a serializer and a `urls.py` when it
has a route. Do not pre-create empty modules — an empty file is a promise the
codebase has not made yet.

Every app that exposes endpoints adds **one** `include()` line to
`backend/config/api_urls.py`. That file is the single place to read the API
surface.

## The apps

| App | Owns |
|---|---|
| `accounts` | Users, profiles, credentials, sessions. |
| `organization` | Tenant/company records, teams, org-level settings. |
| `customers` | Customer records, contacts, interaction history. |
| `tickets` | Tickets, categories, priorities, status transitions, history. |
| `communications` | Channel adapters and messages (email, WhatsApp, chat, SMS, web forms). |
| `agents` | Agent workspace: assignment views, tasks, quick replies, collaboration. |
| `sla` | SLA policies, timers, breach detection, escalation rules. |
| `knowledge_base` | Articles, categories, search. |
| `portal` | Customer-facing self-service surface. |
| `reports` | Aggregations, dashboards, exports. |
| `ai` | AI-assisted features (suggestions, summarisation, classification). |
| `integrations` | Third-party system connectors and webhooks. |

## Nested app names

Because the apps live under the `apps` package, each `apps.py` must declare the
full dotted path:

```python
class CustomersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.customers"
```

Django derives the app **label** from the last component, so the label stays
`customers` and table names stay `customers_*`. Do not set `label` explicitly.
Leaving `startapp`'s generated `name = "customers"` in place fails at startup
with `ModuleNotFoundError: No module named 'customers'`.

## Related specs

The full conventions document is `CONV` (FND-4) and references this file rather
than restating it. The response envelope this layout serves is documented in the
root `README.md` under **API conventions**.
