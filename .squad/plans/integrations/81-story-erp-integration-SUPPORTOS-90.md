# Story 81 — ERP Integration (INT-2) (Story: SUPPORTOS-90)

## Prerequisites

- **Story 80 (`INT-1`, `SUPPORTOS-89`) is complete and implemented** — [80-story-public-rest-api-docs-SUPPORTOS-89.md](80-story-public-rest-api-docs-SUPPORTOS-89.md). `apps/integrations/` is no longer a scaffold: it owns `models.py` (`ApiKey`, 70 lines), `authentication.py`, `keys.py`, `schema.py`, `serializers.py`, `urls.py`, `views.py`, `admin.py`, and `migrations/0001_initial.py`. This story **appends** to those modules; it rewrites none of them. `CONVENTIONS.md` § 29 (Public API & API keys) is INT-1's standing section — this story adds § 30 beside it and renumbers nothing.
- **`CUST-1` (Customer Profiles, Story 10, `SUPPORTOS-28`) is complete** — [../customer-management/10-story-customer-profiles-SUPPORTOS-28.md](../customer-management/10-story-customer-profiles-SUPPORTOS-28.md). `apps/customers/models.py::Customer` (lines 7-66) is the import target. Its `email` field (lines 24-26: `unique=True, null=True, blank=True`, with `clean()` normalising blank→`NULL` at lines 57-66) is the **exact precedent** task 1's new `external_id` copies, including the reason `null=True` is load-bearing: Postgres permits many `NULL`s in a unique column but rejects a second `''`.
- **`SLA-0` (Background Jobs Foundation, Story 27, `SUPPORTOS-49`) is complete** — [../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md](../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md). `config/celery.py`'s `app.autodiscover_tasks()` finds any `apps/<app>/tasks.py` with no further wiring; `apps/sla/tasks.py` and `apps/notifications/tasks.py` are the two existing precedents (`CONVENTIONS.md` § 24). This story adds the third, `apps/integrations/tasks.py`.
- **Verified live, this session — the intake's "order" has no domain model anywhere.** `grep -rn "class Order"` across `backend/apps/` returns nothing, and `"order"` as a domain noun appears exactly **once** in the whole 884-line backlog: on line 870, inside `INT-2`'s own task text. No `ORDER-*` story, no epic, and no other story references one. **This story therefore introduces orders as ERP-owned, read-only reference data** (`ErpOrder`), never as a SupportOS-managed entity — see `## Story Goal`.
- **Verified live: this project has no HTTP client dependency.** `backend/requirements.txt` (15 lines) lists no `requests` and no `httpx`, and every outbound HTTP call in the codebase uses the **standard library**: `apps/communications/whatsapp_adapter.py` lines 4-5, 134-149 and `apps/communications/sms_adapter.py` lines 4-6, 108-127 both build a `urllib.request.Request` and call `urllib.request.urlopen(request, timeout=10)` inside a `try/except urllib.error.URLError`. Task 4's ERP client copies that shape exactly. **This story adds no dependency** (§ 17, § 0).
- **The intake names no specific ERP product**, gives no endpoint contract, no sample payload, and no acceptance criteria, and its `attachments/` directory is empty. This story therefore implements a **generic JSON-over-HTTP ERP contract** (task 4) and makes the vendor-specific part configuration rather than code — which is precisely what the intake's own "field mapping" asks for. The assumed contract is stated explicitly in `## Story Goal` and its failure modes in `## Edge Cases`; a real ERP that differs is absorbed by the field maps and the three id-field settings, not by editing the client.
- **Verified live: `apps/sla` exposes no API at all** — `apps/sla/views.py` is a single comment line, there is no `apps/sla/urls.py`, and `config/api_urls.py` has no `sla` include. SLA rule configuration is Django-admin-only (`SLAPolicyAdmin`/`AssignmentRuleAdmin`/`EscalationRuleAdmin`, each docstring calling itself "the de facto config UI for now"). **INT-2 does not follow that precedent** — the intake asks for a config UI in as many words, so this story builds a real one (`apps/organization`'s `SettingsView` + `SettingsPage.tsx` is the pattern it follows instead).

---

## Story Goal

Give SupportOS a configurable, scheduled, two-way ERP sync so a support agent works against customer and order data the ERP already owns, without anyone re-typing it:

1. **A configurable connection** — `integrations.ErpConnection`, a singleton (`pk=1`, `load()`) copying `organization.OrganizationSettings` exactly: base URL, auth token, an `enabled` master switch, and — the intake's "field mapping" — two `JSONField` maps translating ERP field names to SupportOS field names, plus the three id-field names (`customer_external_id_field`, `order_external_id_field`, `order_customer_ref_field`) that tell the sync how to correlate records.
2. **Import: ERP → SupportOS.** Customers upsert onto `customers.Customer` by a new `Customer.external_id` correlation key; orders upsert onto a new, read-only `integrations.ErpOrder` mirror. **The ERP is the system of record for both** — SupportOS never invents an order, and an import never touches a field outside the story's explicit allowlist.
3. **Export: SupportOS → ERP.** Customers created in SupportOS (those with no `external_id` yet) are pushed to the ERP, and the id the ERP returns is stored back as their `external_id`. Orders are **never** exported — nothing in SupportOS creates one.
4. **Async via SLA-0.** `apps/integrations/tasks.py::run_erp_sync` is a `@shared_task`, scheduled by a seeded `PeriodicTask` row (following `apps/sla/migrations/0004_seed_escalation_schedule.py`), and also triggerable on demand from the UI. Every run writes an `integrations.ErpSyncRun` row with per-entity counters, so "did the sync work?" is answerable without reading a log file.
5. **A real config UI** — `/settings/erp`, gated on a new `Permissions.INTEGRATIONS_MANAGE`: the connection form, both field-map editors, a **Sync now** button, the run history, and a recently-synced-orders preview that proves the mapping actually landed real data.

### The assumed ERP contract

The intake specifies no vendor, so task 4 implements this and **nothing more**. Every name below is configurable except the three paths.

| Call | Purpose |
|---|---|
| `GET {base_url}/customers` | Import customers. Response is either a bare JSON array or `{"results": [...]}` — both accepted. |
| `GET {base_url}/orders` | Import orders. Same two accepted response shapes. |
| `POST {base_url}/customers` | Export one SupportOS-originated customer. Response `{"<customer_external_id_field>": "..."}` supplies the id stored back onto `Customer.external_id`. |

`Authorization: Bearer <auth_token>` on all three. **A vendor whose field names differ needs no code change** — that is what `customer_field_map`/`order_field_map` are for. A vendor whose *paths* or *auth scheme* differ needs `erp_client.py` edited, and `## Edge Cases` says so out loud.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `ErpConnection` + `customer_field_map`/`order_field_map` | "field mapping + config" (backlog, `INT-2`). |
| `Customer.external_id`; `ErpOrder` | "Outcome: customer/order sync" — the correlation key and the order mirror the outcome is impossible without. |
| `erp_client.py`, `erp_sync.py`, `tasks.py`, the `PeriodicTask` seed | "Implement import/export sync (async via SLA-0)" (backlog, `INT-2`). |
| `ErpSyncRun` | An async job nobody can observe is an async job nobody will trust. Also the config UI's history table. |
| `ErpSettingsPage.tsx` + `Permissions.INTEGRATIONS_MANAGE` | "+ config UI" (backlog, `INT-2`), gated per § 22. |
| `CONVENTIONS.md` § 30 | Same reason § 29 (INT-1) and § 24 (SLA-0) exist: `INT-3`/`INT-4` read it before inventing a second sync mechanism or a second credential store. |

**Not here, and why:**

- **No order UI outside the ERP settings page.** `ErpOrder` rows are not shown on `CustomerProfilePage`, on a ticket, or in the agent context panel. Putting a customer's orders in front of an agent is a genuinely useful follow-up, but it is `CUST-3`/agent-workspace surface area, and the intake's outcome is *sync*, not *display*. The settings-page preview exists to verify the mapping, not to serve agents.
- **No order write-back of any kind.** `ErpOrder` has no create/update/delete endpoint and no admin add form. The ERP owns it.
- **No encryption at rest for `auth_token`.** It is stored as a plain `CharField` and never returned by the API (`write_only`, with a `has_auth_token` boolean for the UI). No encryption library is installed, and adding one is a cross-cutting decision that belongs to `INT-3` — whose own task text is "**secure** central config for … credentials". `## Edge Cases` records the exposure plainly.
- **No multi-ERP support.** `ErpConnection` is a singleton, exactly like `OrganizationSettings`. The backlog says "ERP Integration", singular; a `ForeignKey`-per-connection model with one row in it would be speculative generality (§ 0).
- **No conflict resolution beyond last-write-wins, and no delete propagation.** An import overwrites the mapped SupportOS fields; a record that disappears from the ERP is left in place, not deleted. Both are stated in `## Edge Cases` rather than silently implemented.
- **No `AuditLog` row per sync.** Same reason INT-1 gave: `accounts.AuditLog` addresses its target via `target_user`/`target_role` (§ 22), and an `ErpSyncRun` is neither. `ErpSyncRun` **is** this story's durable record.
- **No new dependency, and no new environment variable.** Every value is DB-stored config, because a config UI is the ask. Timeouts and page caps are module constants, the same call `apps/integrations/authentication.py::LAST_USED_WRITE_INTERVAL` (INT-1) made.

---

## Context — Read These Files First

1. `.squad/stories/integrations/SUPPORTOS-90/intake.md` — one description line, no acceptance criteria, empty `attachments/`. `SupportOs backlog.MD` lines 866-870 is the same text.
2. `backend/apps/customers/models.py` lines 7-66 (`Customer`) — read in full. Lines 15-31 are the four fields the customer field map may target; lines 18-26 (`email`, `unique=True, null=True, blank=True`) and lines 57-66 (`clean()`) are the exact unique-when-present + blank→`NULL` pattern task 1 copies for `external_id`. Lines 38-45 (`user`, the portal link) are the field the allowlist must **exclude**.
3. `backend/apps/customers/serializers.py` lines 11-54 (`CustomerSerializer`) — its `fields` tuple (line 48) is what task 1 extends. The long comment at lines 12-41 explains why an explicit `UniqueValidator` is **not** redundant with the model's `unique=True` when a field is overridden — read it before touching `external_id`'s serializer field, because the same trap applies.
4. `backend/apps/organization/models.py` (all 106 lines) — **the singleton precedent task 3 copies literally**: `save()` forcing `pk=1` (lines 96-98), `delete()` as a no-op (lines 100-104), `load()` via `get_or_create(pk=1)` (lines 106-108), the module-level `_validate_string_list` helper (lines 8-12), and `clean()` (lines 74-94). Task 3's `_validate_field_map` is the direct analogue for a `str→str` dict.
5. `backend/apps/organization/{serializers,views,urls}.py` (all three, short) — `OrganizationSettingsSerializer` repeats `clean()`'s validation for the API path because **DRF does not call model `clean()`** (§ 22); `SettingsView` is the `get`/`patch`-only plain `APIView` with `permission_map` keyed by lowercased HTTP method that task 9's `ErpConnectionView` copies; `urls.py` is the router-free `path()`-only module task 10 mirrors.
6. `backend/apps/communications/sms_adapter.py` lines 4-6 and 108-127, and `backend/apps/communications/whatsapp_adapter.py` lines 4-5 and 130-149 — the two existing stdlib-`urllib` outbound-HTTP call sites. Task 4 copies the `Request(...)` → `urlopen(request, timeout=...)` → `except urllib.error.URLError` shape, including the "if not configured, raise rather than call" guard at `whatsapp_adapter.py:108-114`.
7. `backend/apps/sla/tasks.py` (all 74 lines) — both `@shared_task`s. `auto_assign_ticket` (lines 18-44) is the "fetch by id, return early if gone, no-op rather than error" shape; `evaluate_escalations` (lines 47-74) is the scheduled task whose **"nothing configured → normal no-op, not an error"** contract (lines 57-60) task 6 copies exactly for an unconfigured ERP.
8. `backend/apps/sla/migrations/0004_seed_escalation_schedule.py` (all 34 lines) — copy this file's structure for task 7: `apps.get_model("django_celery_beat", ...)`, `IntervalSchedule.objects.get_or_create`, `PeriodicTask.objects.get_or_create(name=..., defaults={...})`, the reverse deleting only the `PeriodicTask` (never the shared `IntervalSchedule` — its comment explains why), and the `("django_celery_beat", "0019_alter_periodictasks_options")` dependency.
9. `backend/apps/integrations/{models,serializers,views,urls,admin}.py` — current post-INT-1 state. `models.py` is 70 lines ending at `ApiKey.is_usable()`; task 3 appends below it. `urls.py` is 32 lines with a `SimpleRouter` at line 12 (one `register` call, line 13) and three doc `path()`s (lines 20-32); task 10 adds registrations and paths **without disturbing the doc routes**. `views.py`'s `SchemaView` (INT-1's YAML-renderer fix) and `ApiKeyViewSet` stay untouched.
10. `backend/apps/core/permissions.py` lines 18-40 (`Permissions`, ending `API_KEYS_MANAGE`/`REPORTS_VIEW`) and 43-48 (`ALL_PERMISSIONS`, derived from `vars(Permissions)` — so task 2 edits **one line and no list**).
11. `backend/apps/accounts/migrations/0008_grant_api_keys_permission.py` (INT-1's, 39 lines) and `0006_grant_audit_log_permission.py` — task 2's migration is `0009`, structurally identical. Note both target `slug="admin"` with a `.first()` `None` guard; `## Edge Cases` records what that means in a database where the seeded role was renamed.
12. `backend/apps/accounts/views.py` lines 364-390 (`AuditLogViewSet`) — the read-only viewset shape tasks 9's `ErpSyncRunViewSet`/`ErpOrderViewSet` copy: `http_method_names = ["get", "head", "options"]` so every unsafe verb 405s at Django's dispatch level, plus `permission_map` with only `list`/`retrieve`, and `get_queryset()` doing explicit query-param filtering with a `ValidationError` on a bad value.
13. `backend/apps/core/serializers.py` (all 39 lines) — `BaseModelSerializer` makes `id`/`created_at`/`updated_at` read-only for every subclass, and `immutable_fields` is the opt-in "writable on create, immutable after" hook. Every serializer in task 8 inherits `BaseModelSerializer.Meta`.
14. `frontend/src/features/organization/` (all 9 files) — **the feature this story's frontend clones**. `components/SettingsPage.tsx` (all 213 lines) is the `QueryBoundary` → `useAppForm` → `Card`/`TextField` → `FormErrorSummary`/`SubmitButton` config-form shape task 14 follows, and its local `StringListField` (lines 62-137, bound through `FormField`'s render prop, with the docstring explaining why it is *not* in `shared/ui/form/`) is the exact precedent for task 15's `FieldMapField`. `api/{getSettings,updateSettings,settingsKeys,useSettings,useUpdateSettings}.ts` (4-14 lines each) and `types/settings.ts` are the five-file API-layer shape tasks 12-13 mirror.
15. `frontend/src/features/audit-log/components/AuditLogListPage.tsx` (all 129 lines) — the read-only `DataTable` + `useServerTable` + `ColumnDef` + `Empty` shape task 14's run-history and orders tables use, including `useFormatters()`'s `dateTime` for every timestamp (§ 18 — never a raw ISO string in the UI).
16. `frontend/src/app/router.tsx` lines 444-456 — the `RequirePermission` → `children` → lazy-`import` block for `/settings`; task 16 adds a sibling block for `/settings/erp` gated on `integrations.manage`.
17. `frontend/src/app/Sidebar.tsx` line 124 (the Administration section's `can(...) || can(...)` visibility gate — task 17 extends it) and lines 255-262 (the `/settings` `SidebarLink` inside `<Can permission="settings.manage">` — task 17 adds a sibling).
18. `frontend/src/shared/i18n/resources.ts` (all 84 lines) — the explicit two-import-plus-one-line-per-language namespace map (its docstring at lines 35-43 says why it is deliberately not `import.meta.glob`); task 19 registers the new `integrations` namespace in both language blocks.
19. `frontend/src/shared/validation/schemas.ts` — the helper set task 14's Zod schema draws on (`requiredString`, `optionalString`, `nullablePositiveInt`, `requiredBoolean`); never a bare `z.string()` with a literal message (§ 6).
20. `CONVENTIONS.md` § 24 (lines 1514-1561, background jobs — read the `DatabaseScheduler`/`PeriodicTask` rule and the Windows `--pool=solo` caveat), § 22 (lines 787-901, authorization), § 23 (feature module conventions), and § 29 (lines 1983-2027, INT-1's section and the current end of the file — task 21 appends § 30 after line 2027).
21. `backend/config/celery.py` (all 40 lines) — confirms `app.autodiscover_tasks()` needs no per-app registration for task 6's new `tasks.py`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Sync runs asynchronously, not in a request.** | Intake ("async via SLA-0") | `apps/integrations/tasks.py::run_erp_sync` (`@shared_task`); the manual trigger endpoint only calls `.delay(...)` and returns `202`. |
| **ERP field names are configuration, not code.** | Intake ("field mapping") | `ErpConnection.customer_field_map`/`order_field_map`, applied by `erp_sync.apply_field_map`. |
| **A map may only target a field this story allows.** | Safety boundary this story sets | `CUSTOMER_SYNCABLE_FIELDS`/`ORDER_SYNCABLE_FIELDS` in `apps/integrations/erp_sync.py`, enforced in `ErpConnection.clean()` **and** `ErpConnectionSerializer` (§ 22's two-path split). |
| **Both directions, customers and orders.** | Intake ("import/export sync", "customer/order sync") | `erp_sync.import_customers`/`import_orders`/`export_customers`. Orders import-only — see `## Story Goal`. |
| **The ERP is the system of record for orders.** | Follows from orders having no domain owner (`## Prerequisites`) | `ErpOrder` has no writable endpoint; `ErpOrderAdmin.has_add_permission` returns `False`, the same posture `ApiKeyAdmin` (INT-1) takes. |
| **An unconfigured or disabled ERP is a silent no-op, never an error.** | `evaluate_escalations`'s own established contract (§ 24) | `run_erp_sync` returns early when `ErpConnection.load()` is not `enabled` or has a blank `base_url`. |
| **The auth token is never returned by the API.** | § 10 ("never log secrets"), INT-1's § 29 posture | `ErpConnectionSerializer.auth_token` is `write_only`; `has_auth_token` is the read-side boolean. A blank/omitted token on `PATCH` leaves the stored value untouched. |
| **Only an operator who may manage integrations can configure or trigger a sync.** | § 22 | `Permissions.INTEGRATIONS_MANAGE` on every new endpoint; granted to `admin` by `accounts/0009`. |
| Every user-facing string is translated, both languages. | § 18 | `frontend/src/features/integrations/locales/{en,ar}.json`, registered in `resources.ts`. |

---

## Backend Tasks

### 1 — `Customer.external_id`, the correlation key

**File: `backend/apps/customers/models.py`** — add one field to `Customer`, after `company` (line 31) and before `user` (line 38):

```python
    # The ERP's own id for this customer — INT-2's correlation key, and the
    # only thing that makes an import an upsert rather than a duplicate
    # factory. Unique WHEN PRESENT, `null=True`/`blank=True`, normalised
    # blank->NULL in `clean()` below: exactly the same three-part pattern
    # `email` above already uses, for exactly the same verified reason —
    # Postgres allows any number of NULLs in a unique column but rejects a
    # second blank string, so a `""` reaching this column is an
    # IntegrityError (a 500), not a validation message. Most rows have no
    # ERP counterpart: a customer created in SupportOS has this blank until
    # `export_customers` pushes it and stores the id the ERP returns.
    external_id = models.CharField(
        _("ERP external id"), max_length=100, unique=True, null=True, blank=True
    )
```

Extend `clean()` (lines 57-66) so it normalises the new field too:

```python
        if not self.email:
            self.email = None
        if not self.external_id:
            self.external_id = None
```

**File: `backend/apps/customers/serializers.py`** — add `"external_id"` to `CustomerSerializer.Meta.fields` (line 48), after `"company"`, and declare the field explicitly so blank round-trips safely:

```python
    # Same three reasons as `email` above, and the same trap: overriding a
    # field opts it out of ModelSerializer's auto-derived UniqueValidator
    # (verified against DRF 3.18 — see this class's own comment), so the
    # validator must be declared by hand or a duplicate ERP id becomes an
    # IntegrityError instead of a 400.
    external_id = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
        validators=[UniqueValidator(queryset=Customer.objects.all())],
    )
```

and the matching normaliser beside `validate_email`:

```python
    def validate_external_id(self, value):
        return value or None
```

Generate the migration:

```powershell
python manage.py makemigrations customers
```

Expect `apps/customers/migrations/0006_customer_external_id.py`.

---

### 2 — The permission

**File: `backend/apps/core/permissions.py`** — add one constant to `Permissions`, after `API_KEYS_MANAGE` (line 39):

```python
    INTEGRATIONS_MANAGE = "integrations.manage"
```

`ALL_PERMISSIONS` derives itself from `vars(Permissions)` (lines 43-48), so nothing else in this file changes.

**Not** reusing `API_KEYS_MANAGE`: that gates credentials for callers coming *in* to SupportOS (INT-1); this gates an outbound connection to a third-party system and the ability to fire a data-mutating sync. Separate concerns, separate strings — and `INT-3`/`INT-4` will both want this same one.

**Create file: `backend/apps/accounts/migrations/0009_grant_integrations_permission.py`** — structurally identical to `0008_grant_api_keys_permission.py`:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: configuring the ERP connection means holding a third-party
# credential and being able to fire a job that rewrites customer records in
# bulk — at least as sensitive as editing a role, the same reasoning
# 0006/0008 record for their own grants. INT-2 (Story 81).
GRANTS = {
    "admin": [Permissions.INTEGRATIONS_MANAGE],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) | set(permissions))
        role.save(update_fields=["permissions"])


def revoke(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) - set(permissions))
        role.save(update_fields=["permissions"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_grant_api_keys_permission"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

Task 2's constant must land **before** this runs — `Role.clean()` rejects any string absent from `ALL_PERMISSIONS`.

---

### 3 — The three models

**File: `backend/apps/integrations/models.py`** — append below `ApiKey.is_usable()` (line 70). Extend the import block at lines 1-5 with `from django.core.exceptions import ValidationError` and `from decimal import Decimal` is **not** needed (no Decimal literal here).

```python
def _validate_field_map(value, field_name: str, allowed: frozenset[str]) -> None:
    """A field map is a flat `{erp_field: supportos_field}` of non-empty
    strings, and every target must be in `allowed`.

    The allowlist is the story's safety boundary, not decoration: without
    it an operator could map an ERP column onto `user` and have a bulk
    import silently re-point portal logins, or onto `external_id` and
    break the correlation key the upsert depends on. The module-level
    helper mirrors `apps.organization.models._validate_string_list`
    exactly, including being called from both `clean()` (admin/`full_clean`
    path) and the serializer (API path) — DRF does not call model
    `clean()` (CONVENTIONS.md § 22).
    """
    if not isinstance(value, dict):
        raise ValidationError({field_name: _("Must be an object mapping ERP field to field.")})
    for source, target in value.items():
        if not isinstance(source, str) or not source.strip():
            raise ValidationError({field_name: _("Every ERP field name must be a non-empty string.")})
        if not isinstance(target, str) or not target.strip():
            raise ValidationError({field_name: _("Every mapped field must be a non-empty string.")})
        if target not in allowed:
            raise ValidationError(
                {
                    field_name: _("Cannot map to '%(target)s'. Allowed: %(allowed)s.")
                    % {"target": target, "allowed": ", ".join(sorted(allowed))}
                }
            )


class ErpConnection(TimeStampedModel):
    """The one ERP connection — INT-2.

    A singleton in exactly the way `organization.OrganizationSettings`
    is: `load()` is the only supported way in, `save()` forces `pk=1`,
    `delete()` is a no-op. The backlog says "ERP Integration", singular
    (SupportOs backlog.MD:868); a connection table with one row in it
    would be speculative generality (CONVENTIONS.md § 0). `INT-3` may
    well need many provider rows — it can promote this then, with a real
    second consumer in hand.

    `customer_field_map`/`order_field_map` are the intake's "field
    mapping": `{erp_field_name: supportos_field_name}`, validated against
    the allowlists in `apps/integrations/erp_sync.py`. They are what lets
    a different ERP vendor be a configuration change rather than a code
    change — see Story 81 `## Story Goal`.

    `auth_token` is stored in plain text and never returned by the API
    (`ErpConnectionSerializer` declares it `write_only`). Unlike INT-1's
    `ApiKey.hashed_key`, it cannot be hashed: this credential has to be
    replayed on every outbound call. Encryption at rest is deliberately
    out of scope — no encryption library is installed and that choice
    belongs to `INT-3` ("secure central config for … credentials",
    SupportOs backlog.MD:876). See Story 81 `## Edge Cases`.
    """

    # Master switch, default False: an ERP nobody has configured must not
    # be contacted just because the seeded PeriodicTask (Story 81 task 7)
    # is enabled. The same two-independent-opt-ins split § 24 records for
    # SLA-3's schedule vs its EscalationRule criteria.
    enabled = models.BooleanField(_("enabled"), default=False)
    base_url = models.URLField(_("base URL"), max_length=500, blank=True)
    auth_token = models.CharField(_("auth token"), max_length=500, blank=True)
    # Import is the primary direction; export is separately opt-in because
    # it WRITES to a system this project does not own.
    export_enabled = models.BooleanField(_("export enabled"), default=False)
    customer_field_map = models.JSONField(_("customer field map"), default=dict, blank=True)
    order_field_map = models.JSONField(_("order field map"), default=dict, blank=True)
    # Which key in the ERP's payload carries its own record id, and which
    # key on an order points back at its customer. Configurable for the
    # same reason the field maps are — "id" is a convention, not a
    # standard.
    customer_external_id_field = models.CharField(
        _("customer id field"), max_length=100, default="id"
    )
    order_external_id_field = models.CharField(_("order id field"), max_length=100, default="id")
    order_customer_ref_field = models.CharField(
        _("order customer reference field"), max_length=100, default="customer_id"
    )
    last_sync_at = models.DateTimeField(_("last sync at"), null=True, blank=True)

    class Meta:
        verbose_name = _("ERP connection")
        verbose_name_plural = _("ERP connection")

    def __str__(self) -> str:
        return str(_("ERP connection"))

    def is_configured(self) -> bool:
        """Both halves, not just `enabled`: a switched-on connection with
        no URL has nothing to call. `run_erp_sync` gates on this.
        """
        return bool(self.enabled and self.base_url)

    def clean(self) -> None:
        from .erp_sync import CUSTOMER_SYNCABLE_FIELDS, ORDER_SYNCABLE_FIELDS

        super().clean()
        _validate_field_map(self.customer_field_map, "customer_field_map", CUSTOMER_SYNCABLE_FIELDS)
        _validate_field_map(self.order_field_map, "order_field_map", ORDER_SYNCABLE_FIELDS)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # Nothing sensible for "delete the ERP connection" to mean — the
        # row comes back with defaults (and `enabled=False`) on the next
        # `load()`. A silent no-op, matching OrganizationSettings.delete.
        pass

    @classmethod
    def load(cls) -> "ErpConnection":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class ErpOrder(TimeStampedModel):
    """An order, mirrored from the ERP — INT-2, and read-only here.

    The intake's outcome names "customer/order sync", but **no story in
    this project owns orders**: `grep -rn "class Order"` finds nothing and
    the backlog mentions the noun exactly once, in INT-2's own task text
    (verified — Story 81 `## Prerequisites`). So an order is ERP-owned
    reference data, never a SupportOS entity: nothing in this codebase
    creates, edits, or exports one, `ErpOrderViewSet` is `GET`-only, and
    `ErpOrderAdmin` disables adding — the same read-and-nothing-else
    posture `ApiKeyAdmin` (INT-1) takes for a different reason.

    `status` is a plain `CharField`, deliberately **not** `TextChoices`:
    the vocabulary belongs to the ERP, and enumerating a foreign system's
    states here would be wrong the first time the ERP adds one. It also
    keeps this field out of drf-spectacular's enum-naming collision set
    (Story 80 verification recorded a live collision on fields named
    "status").

    `raw` keeps the whole original payload, so an operator who discovers
    a mis-mapped field can see what the ERP actually sent without
    re-running the import.
    """

    # CASCADE: an order mirror has no meaning without the customer it
    # belongs to — the same reasoning `notifications.Notification.recipient`
    # and `integrations.ApiKey.user` (INT-1) both record.
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="erp_orders",
        verbose_name=_("customer"),
    )
    external_id = models.CharField(_("ERP external id"), max_length=100, unique=True)
    order_number = models.CharField(_("order number"), max_length=100, blank=True)
    status = models.CharField(_("status"), max_length=50, blank=True)
    total_amount = models.DecimalField(
        _("total amount"), max_digits=14, decimal_places=2, null=True, blank=True
    )
    currency = models.CharField(_("currency"), max_length=3, blank=True)
    placed_at = models.DateTimeField(_("placed at"), null=True, blank=True)
    raw = models.JSONField(_("raw payload"), default=dict, blank=True)
    synced_at = models.DateTimeField(_("synced at"))

    class Meta:
        verbose_name = _("ERP order")
        verbose_name_plural = _("ERP orders")
        ordering = ("-placed_at", "-id")

    def __str__(self) -> str:
        return self.order_number or self.external_id


class ErpSyncRun(TimeStampedModel):
    """One execution of `run_erp_sync` — INT-2's observability record.

    An async job nobody can inspect is an async job nobody will trust,
    and this is also what the config UI's history table renders. It is
    this story's answer to "why no AuditLog row": `accounts.AuditLog`
    addresses its target through `target_user`/`target_role` (§ 22) and a
    sync run is neither, so rather than add a third nullable FK to
    another app's model, the run itself is the durable record — the same
    call INT-1 made and documented.

    The choices field is named `state`, not `status`, on purpose: Story
    80's verification recorded a live drf-spectacular warning
    ("enum naming encountered a … collision for fields named 'status'")
    from the existing `tickets`/`knowledge_base` components, and adding a
    third `status` enum would deepen a known problem for no gain. The
    pre-existing collision is untouched and stays out of scope.
    """

    class Direction(models.TextChoices):
        IMPORT = "import", _("Import")
        EXPORT = "export", _("Export")

    class State(models.TextChoices):
        RUNNING = "running", _("Running")
        SUCCESS = "success", _("Success")
        FAILED = "failed", _("Failed")

    direction = models.CharField(_("direction"), max_length=10, choices=Direction.choices)
    state = models.CharField(
        _("state"), max_length=10, choices=State.choices, default=State.RUNNING
    )
    # SET_NULL and nullable: a scheduled run has no human behind it at
    # all, and an operator who triggered one may later be deleted — the
    # same asymmetry `AuditLog.actor` already draws.
    triggered_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="erp_sync_runs",
        verbose_name=_("triggered by"),
    )
    created_count = models.PositiveIntegerField(_("created"), default=0)
    updated_count = models.PositiveIntegerField(_("updated"), default=0)
    skipped_count = models.PositiveIntegerField(_("skipped"), default=0)
    failed_count = models.PositiveIntegerField(_("failed"), default=0)
    started_at = models.DateTimeField(_("started at"))
    finished_at = models.DateTimeField(_("finished at"), null=True, blank=True)
    # Free text, not a code: this carries whatever the ERP or the network
    # said. Never the auth token — see `erp_client._request`.
    error_message = models.TextField(_("error message"), blank=True)

    class Meta:
        verbose_name = _("ERP sync run")
        verbose_name_plural = _("ERP sync runs")
        ordering = ("-started_at",)

    def __str__(self) -> str:
        return f"{self.get_direction_display()} {self.started_at:%Y-%m-%d %H:%M}"
```

Generate the migration:

```powershell
python manage.py makemigrations integrations
```

Expect `apps/integrations/migrations/0002_erpconnection_erporder_erpsyncrun.py` (Django names it from the models; accept whatever it generates and do not hand-edit).

---

### 4 — The ERP HTTP client

**Create file: `backend/apps/integrations/erp_client.py`**

```python
"""Outbound HTTP to the ERP — INT-2 (Story 81).

`urllib.request` from the standard library, not `requests`/`httpx`:
neither is a dependency of this project, and every existing outbound call
uses stdlib urllib — `apps/communications/whatsapp_adapter.py:130-149`
and `apps/communications/sms_adapter.py:108-127`. Adding an HTTP library
for a third call site would fail CONVENTIONS.md § 0/§ 17's
"check whether an existing one already does the job" test.

The intake names no ERP product and gives no contract, so the one
implemented here is the generic shape documented in Story 81
`## Story Goal`: `GET /customers`, `GET /orders`, `POST /customers`,
bearer-token auth, and a response that is either a bare JSON array or an
object with a `results` list. A vendor whose FIELD NAMES differ needs no
change here — that is what `ErpConnection.customer_field_map` is for. A
vendor whose PATHS or AUTH SCHEME differ needs this module edited, and
that is the honest boundary of what can be built without a named vendor.
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

# Matches the 10s both existing adapters use, with headroom: an ERP list
# endpoint is a heavier query than sending one message. A module constant,
# not an ENV var — the same internal-tuning-knob call
# `apps.integrations.authentication.LAST_USED_WRITE_INTERVAL` (INT-1) and
# `apps.accounts.tokens.RESET_TOKEN_MAX_AGE_SECONDS` (SEC-7) both make.
ERP_TIMEOUT_SECONDS = 15
# A hard ceiling on one run, so a misconfigured ERP that paginates
# forever (or returns its entire history) cannot turn a scheduled job
# into an unbounded one. A run that hits this logs and stops; the next
# run picks up from the ERP again.
ERP_MAX_RECORDS_PER_RUN = 5000

CUSTOMERS_PATH = "customers"
ORDERS_PATH = "orders"


class ErpError(Exception):
    """Any ERP call failure — unreachable host, non-2xx, or a body that is
    not JSON. The one exception type `erp_sync`/`tasks` catch, so no
    caller imports `urllib.error`. Mirrors the single-error-type contract
    `apps.ai.exceptions.AIServiceError` (AI-0) established.
    """


def _url(connection, path: str) -> str:
    return f"{connection.base_url.rstrip('/')}/{path.lstrip('/')}"


def _request(connection, path: str, *, method: str = "GET", payload: dict | None = None):
    """One JSON call. Returns the decoded body.

    Never logs `connection.auth_token`, the request body, or the response
    body — § 10's "never log secrets, never log request bodies" applies
    here exactly as § 29 records it for AI prompts. Only the method, the
    path, and the status/reason ever reach a log line.
    """
    url = _url(connection, path)
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept": "application/json"}
    if connection.auth_token:
        headers["Authorization"] = f"Bearer {connection.auth_token}"
    if data is not None:
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=ERP_TIMEOUT_SECONDS) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        # A subclass of URLError, so it must be caught FIRST or the
        # status code is lost. `exc.reason` only — never `exc.read()`,
        # which is the ERP's response body.
        raise ErpError(f"ERP {method} {path} failed: HTTP {exc.code} {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise ErpError(f"ERP {method} {path} failed: {exc.reason}") from exc

    if not body:
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ErpError(f"ERP {method} {path} returned a body that is not JSON.") from exc


def _records(body) -> list[dict]:
    """Accept both shapes named in `## Story Goal` — a bare array, or
    `{"results": [...]}` (the shape this project's own API uses under
    `data`). Anything else is a contract violation, not an empty result:
    silently returning `[]` for an unrecognised body would make a broken
    connection look like an ERP with no customers.
    """
    if isinstance(body, list):
        records = body
    elif isinstance(body, dict) and isinstance(body.get("results"), list):
        records = body["results"]
    else:
        raise ErpError("ERP response was neither a list nor an object with a 'results' list.")
    if len(records) > ERP_MAX_RECORDS_PER_RUN:
        logger.warning(
            "ERP returned %s records, capping this run at %s",
            len(records),
            ERP_MAX_RECORDS_PER_RUN,
        )
        records = records[:ERP_MAX_RECORDS_PER_RUN]
    return [record for record in records if isinstance(record, dict)]


def fetch_customers(connection) -> list[dict]:
    return _records(_request(connection, CUSTOMERS_PATH))


def fetch_orders(connection) -> list[dict]:
    return _records(_request(connection, ORDERS_PATH))


def push_customer(connection, payload: dict) -> dict:
    """Create one customer in the ERP. Returns the decoded response, from
    which `export_customers` reads the new external id.
    """
    body = _request(connection, CUSTOMERS_PATH, method="POST", payload=payload)
    return body if isinstance(body, dict) else {}
```

---

### 5 — Mapping and upsert (HTTP-independent)

**Create file: `backend/apps/integrations/erp_sync.py`**

```python
"""Field mapping and upsert logic — INT-2 (Story 81).

Deliberately HTTP-independent: every function here takes already-decoded
records, so the mapping rules can be exercised from a shell against a
literal dict with no ERP and no network — the same "plain, HTTP-free
function" reasoning `apps/knowledge_base/search.py` (KB-3) records for
itself. `erp_client` does the talking; this module does the deciding.
"""

import logging

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.customers.models import Customer

from .erp_client import ErpError, fetch_customers, fetch_orders, push_customer
from .models import ErpOrder, ErpSyncRun

logger = logging.getLogger(__name__)

# The safety boundary a field map may not cross. `external_id` is absent
# on purpose — it is the correlation key the upsert matches on, set from
# `ErpConnection.customer_external_id_field`, never a mappable target.
# `user` is absent too: the portal-login link is a staff-only decision
# (`apps/customers/models.py:38-45`, Story 42), and a bulk import must
# never be able to re-point it.
CUSTOMER_SYNCABLE_FIELDS = frozenset({"name", "email", "phone", "company"})
ORDER_SYNCABLE_FIELDS = frozenset(
    {"order_number", "status", "total_amount", "currency", "placed_at"}
)

# Order fields that must be coerced out of the JSON string the ERP sends.
_ORDER_DATETIME_FIELDS = frozenset({"placed_at"})


def apply_field_map(record: dict, field_map: dict[str, str], allowed: frozenset[str]) -> dict:
    """Translate one ERP record into SupportOS field names.

    Skips a mapped source key the record does not carry (a partial ERP
    payload is normal), and re-checks `allowed` even though
    `ErpConnection.clean()`/the serializer already did — a map written
    directly through the ORM or a shell bypasses both, and this is the
    layer that actually assigns to a model.
    """
    mapped: dict = {}
    for source, target in field_map.items():
        if target not in allowed or source not in record:
            continue
        mapped[target] = record[source]
    return mapped


def _coerce_datetimes(values: dict, fields: frozenset[str]) -> dict:
    for field in fields:
        raw = values.get(field)
        if isinstance(raw, str):
            parsed = parse_datetime(raw)
            # An unparseable timestamp drops the field rather than failing
            # the whole record — the rest of the order is still useful.
            if parsed is None:
                values.pop(field)
            else:
                values[field] = parsed
    return values


def import_customers(connection, run: ErpSyncRun) -> None:
    """Upsert every ERP customer onto `customers.Customer`, matched by
    `external_id`. A record with no id is counted as skipped, not failed:
    it is the ERP's omission, not an error on this side.
    """
    id_field = connection.customer_external_id_field
    for record in fetch_customers(connection):
        external_id = record.get(id_field)
        if external_id in (None, ""):
            run.skipped_count += 1
            continue
        values = apply_field_map(record, connection.customer_field_map, CUSTOMER_SYNCABLE_FIELDS)
        # Blank email must become NULL before it reaches a unique column
        # — `Customer.clean()`'s own rule (apps/customers/models.py:57-66),
        # which `update_or_create` does not run.
        if "email" in values and not values["email"]:
            values["email"] = None
        if not values:
            run.skipped_count += 1
            continue
        try:
            _customer, created = Customer.objects.update_or_create(
                external_id=str(external_id), defaults=values
            )
        except Exception:
            # One bad record (a duplicate email, an over-long name) must
            # not abort the run — a partial sync is the normal outcome of
            # imperfect upstream data. Logged without the payload (§ 10).
            logger.exception("ERP customer %s failed to import", external_id)
            run.failed_count += 1
            continue
        if created:
            run.created_count += 1
        else:
            run.updated_count += 1


def import_orders(connection, run: ErpSyncRun) -> None:
    """Upsert every ERP order onto `ErpOrder`, matched by `external_id`
    and linked to the `Customer` whose `external_id` the order references.

    An order whose customer has not been imported yet is **skipped, not
    failed** — on a first run the customer pass may simply not have
    reached it, and the next run picks it up. `import_customers` runs
    first for exactly this reason (`tasks.run_erp_sync`).
    """
    id_field = connection.order_external_id_field
    ref_field = connection.order_customer_ref_field
    for record in fetch_orders(connection):
        external_id = record.get(id_field)
        customer_ref = record.get(ref_field)
        if external_id in (None, "") or customer_ref in (None, ""):
            run.skipped_count += 1
            continue
        customer = Customer.objects.filter(external_id=str(customer_ref)).first()
        if customer is None:
            run.skipped_count += 1
            continue
        values = _coerce_datetimes(
            apply_field_map(record, connection.order_field_map, ORDER_SYNCABLE_FIELDS),
            _ORDER_DATETIME_FIELDS,
        )
        values["customer"] = customer
        values["raw"] = record
        values["synced_at"] = timezone.now()
        try:
            _order, created = ErpOrder.objects.update_or_create(
                external_id=str(external_id), defaults=values
            )
        except Exception:
            logger.exception("ERP order %s failed to import", external_id)
            run.failed_count += 1
            continue
        if created:
            run.created_count += 1
        else:
            run.updated_count += 1


def export_customers(connection, run: ErpSyncRun) -> None:
    """Push every SupportOS-originated customer (no `external_id` yet) to
    the ERP and store the id it returns.

    Inverts `customer_field_map` to build the outbound payload, so one
    configured mapping serves both directions. A duplicate ERP target key
    would make the inversion lossy; `ErpConnection.clean()` does not
    forbid that (the map is legitimately many-to-one on import), so the
    last one wins here and `## Edge Cases` says so.
    """
    id_field = connection.customer_external_id_field
    outbound = {target: source for source, target in connection.customer_field_map.items()}
    pending = Customer.objects.filter(external_id__isnull=True)
    for customer in pending.iterator():
        payload = {
            erp_field: getattr(customer, local_field)
            for local_field, erp_field in outbound.items()
            if getattr(customer, local_field, None) not in (None, "")
        }
        if not payload:
            run.skipped_count += 1
            continue
        try:
            response = push_customer(connection, payload)
        except ErpError:
            logger.exception("ERP export failed for customer %s", customer.pk)
            run.failed_count += 1
            continue
        new_id = response.get(id_field)
        if new_id in (None, ""):
            # The ERP accepted the record but told us nothing we can
            # correlate on. Counted as failed, not created: without an id
            # the next run would push a duplicate.
            logger.warning(
                "ERP accepted customer %s but returned no '%s'", customer.pk, id_field
            )
            run.failed_count += 1
            continue
        customer.external_id = str(new_id)
        customer.save(update_fields=["external_id", "updated_at"])
        run.created_count += 1
```

---

### 6 — The Celery task

**Create file: `backend/apps/integrations/tasks.py`**

```python
"""Background ERP sync — INT-2 (Story 81). The third `tasks.py` in this
project after `apps/sla/tasks.py` (SLA-2/3) and
`apps/notifications/tasks.py` (SLA-4); `app.autodiscover_tasks()`
(`config/celery.py`) finds it with no further wiring (CONVENTIONS.md
§ 24).
"""

import logging

from celery import shared_task
from django.utils import timezone

from .erp_client import ErpError
from .erp_sync import export_customers, import_customers, import_orders
from .models import ErpConnection, ErpSyncRun

logger = logging.getLogger(__name__)


@shared_task
def run_erp_sync(direction: str = ErpSyncRun.Direction.IMPORT, triggered_by_id: int | None = None):
    """Run one sync in `direction` and record it as an `ErpSyncRun`.

    A run against an unconfigured or disabled connection is a **normal
    no-op, not an error, and writes no run row** — the same contract
    `apps.sla.tasks.evaluate_escalations` states for itself when nothing
    is configured (apps/sla/tasks.py:57-60). That is what lets task 7
    ship an *enabled* PeriodicTask without it doing anything until an
    operator actually fills the form in: the schedule existing and the
    connection being configured are two independent opt-ins, exactly as
    § 24 records for SLA-3.

    `import` runs customers before orders, because
    `erp_sync.import_orders` links an order to an already-imported
    customer and skips one it cannot find.
    """
    connection = ErpConnection.load()
    if not connection.is_configured():
        logger.info("ERP sync skipped: connection is disabled or has no base URL.")
        return
    if direction == ErpSyncRun.Direction.EXPORT and not connection.export_enabled:
        logger.info("ERP export skipped: export_enabled is False.")
        return

    run = ErpSyncRun.objects.create(
        direction=direction,
        state=ErpSyncRun.State.RUNNING,
        triggered_by_id=triggered_by_id,
        started_at=timezone.now(),
    )
    try:
        if direction == ErpSyncRun.Direction.EXPORT:
            export_customers(connection, run)
        else:
            import_customers(connection, run)
            import_orders(connection, run)
    except ErpError as exc:
        # A connection-level failure (host down, 401, non-JSON body) ends
        # the run. Per-record failures never reach here — `erp_sync`
        # counts those into `failed_count` and carries on.
        run.state = ErpSyncRun.State.FAILED
        run.error_message = str(exc)
    except Exception as exc:
        logger.exception("ERP sync crashed")
        run.state = ErpSyncRun.State.FAILED
        run.error_message = str(exc)
    else:
        run.state = ErpSyncRun.State.SUCCESS
        connection.last_sync_at = timezone.now()
        connection.save(update_fields=["last_sync_at", "updated_at"])

    run.finished_at = timezone.now()
    run.save(
        update_fields=[
            "state",
            "error_message",
            "created_count",
            "updated_count",
            "skipped_count",
            "failed_count",
            "finished_at",
            "updated_at",
        ]
    )
```

---

### 7 — Schedule the import

**Create file: `backend/apps/integrations/migrations/0003_seed_erp_sync_schedule.py`** — copy `apps/sla/migrations/0004_seed_escalation_schedule.py`'s structure exactly:

```python
from django.db import migrations


def seed_erp_sync_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = IntervalSchedule.objects.get_or_create(every=1, period="hours")
    PeriodicTask.objects.get_or_create(
        name="INT-2: ERP import sync",
        defaults={
            "task": "apps.integrations.tasks.run_erp_sync",
            "interval": schedule,
            # Enabled, like SLA-3's own seeded task: `run_erp_sync`
            # returns immediately unless `ErpConnection.is_configured()`,
            # so this is live-but-inert until an operator fills in
            # /settings/erp. See CONVENTIONS.md § 24 and Story 81 task 6.
            "enabled": True,
        },
    )


def unseed_erp_sync_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="INT-2: ERP import sync").delete()
    # The `every=1, period="hours"` IntervalSchedule row is deliberately
    # left in place on reverse — this migration owns only the PeriodicTask
    # it created, and a shared IntervalSchedule may back some other task.
    # The same reasoning sla/0004's own reverse records.


class Migration(migrations.Migration):
    dependencies = [
        ("integrations", "0002_erpconnection_erporder_erpsyncrun"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_erp_sync_schedule, unseed_erp_sync_schedule),
    ]
```

**Hourly, not every 5 minutes** (SLA-3's interval): an ERP list call is a heavy, external, rate-limited request, and no part of this story's outcome needs sub-hour freshness. An operator who wants it faster changes the `IntervalSchedule` in `/admin/` — the whole point of § 24's database-scheduler rule. **No export is scheduled**: writing to a system this project does not own stays a deliberate, manual action (task 9's trigger endpoint).

Correct the dependency name if `makemigrations` (task 3) produced a different `0002_*` filename.

---

### 8 — Serializers

**File: `backend/apps/integrations/serializers.py`** — append below `ApiKeyUpdateSerializer`. Extend the imports with `from apps.core.serializers import BaseModelSerializer` and the new models.

```python
class ErpConnectionSerializer(BaseModelSerializer):
    """Read/write over the one `ErpConnection` row.

    `auth_token` is `write_only`: the API never hands a stored credential
    back, the same posture INT-1's `ApiKeySerializer` takes for
    `hashed_key` (§ 29). `has_auth_token` is what the UI renders instead,
    so an operator can see whether one is configured without seeing it.

    An omitted-or-blank `auth_token` on `PATCH` leaves the stored value
    untouched (`update` below) — without that, saving any other field
    from a form that cannot display the current token would silently wipe
    it, and the next sync would start failing with a 401.

    `validate_customer_field_map`/`validate_order_field_map` mirror
    `ErpConnection.clean()` for the API path, because DRF does not call
    model `clean()` — the same split `OrganizationSettingsSerializer`/
    `OrganizationSettings.clean()` already establishes (§ 22).
    """

    auth_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_auth_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = ErpConnection
        fields = (
            "id",
            "enabled",
            "base_url",
            "auth_token",
            "has_auth_token",
            "export_enabled",
            "customer_field_map",
            "order_field_map",
            "customer_external_id_field",
            "order_external_id_field",
            "order_customer_ref_field",
            "last_sync_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*BaseModelSerializer.Meta.read_only_fields, "last_sync_at")

    def get_has_auth_token(self, obj) -> bool:
        return bool(obj.auth_token)

    def _validate_field_map(self, value, allowed):
        if not isinstance(value, dict):
            raise serializers.ValidationError(_("Must be an object mapping ERP field to field."))
        for source, target in value.items():
            if not isinstance(source, str) or not source.strip():
                raise serializers.ValidationError(
                    _("Every ERP field name must be a non-empty string.")
                )
            if not isinstance(target, str) or not target.strip():
                raise serializers.ValidationError(
                    _("Every mapped field must be a non-empty string.")
                )
            if target not in allowed:
                raise serializers.ValidationError(
                    _("Cannot map to '%(target)s'. Allowed: %(allowed)s.")
                    % {"target": target, "allowed": ", ".join(sorted(allowed))}
                )
        return value

    def validate_customer_field_map(self, value):
        return self._validate_field_map(value, CUSTOMER_SYNCABLE_FIELDS)

    def validate_order_field_map(self, value):
        return self._validate_field_map(value, ORDER_SYNCABLE_FIELDS)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        enabled = attrs.get("enabled", getattr(self.instance, "enabled", False))
        base_url = attrs.get("base_url", getattr(self.instance, "base_url", ""))
        if enabled and not base_url:
            raise serializers.ValidationError(
                {"base_url": [_("A base URL is required to enable the connection.")]}
            )
        return attrs

    def update(self, instance, validated_data):
        # See this class's docstring: a blank token means "leave it".
        if not validated_data.get("auth_token"):
            validated_data.pop("auth_token", None)
        return super().update(instance, validated_data)


class ErpSyncRunSerializer(BaseModelSerializer):
    """Read-only history. `state_display`/`direction_display` come from
    Django's own `get_FOO_display()`, the same translated-label approach
    `AuditLogSerializer.action_display` (SEC-3) uses.
    """

    direction_display = serializers.CharField(source="get_direction_display", read_only=True)
    state_display = serializers.CharField(source="get_state_display", read_only=True)
    triggered_by_name = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = ErpSyncRun
        fields = (
            "id",
            "direction",
            "direction_display",
            "state",
            "state_display",
            "triggered_by_name",
            "created_count",
            "updated_count",
            "skipped_count",
            "failed_count",
            "started_at",
            "finished_at",
            "error_message",
            "created_at",
            "updated_at",
        )

    def get_triggered_by_name(self, obj) -> str | None:
        return obj.triggered_by.get_full_name() if obj.triggered_by else None


class ErpOrderSerializer(BaseModelSerializer):
    """Read-only. `raw` is deliberately excluded: it is the whole ERP
    payload, kept for an operator debugging a mapping through
    `/admin/` or a shell, and re-publishing it through the API would
    hand every reader whatever unmapped fields the ERP happens to
    include.
    """

    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = ErpOrder
        fields = (
            "id",
            "customer",
            "customer_name",
            "external_id",
            "order_number",
            "status",
            "total_amount",
            "currency",
            "placed_at",
            "synced_at",
            "created_at",
            "updated_at",
        )
```

Add `from django.utils.translation import gettext_lazy as _` and the `erp_sync` allowlist imports at the top of the module.

---

### 9 — Views

**File: `backend/apps/integrations/views.py`** — append below `ApiKeyViewSet`. `SchemaView` and `ApiKeyViewSet` stay exactly as INT-1 left them.

```python
class ErpConnectionView(APIView):
    """The one ERP connection record. `GET`/`PATCH` only, no id in the
    path — the same singleton shape `apps.organization.views.SettingsView`
    established, with `permission_map` keyed by lowercased HTTP method
    because a plain `APIView` has no DRF `action`
    (`apps/core/permissions.py`'s own note). Any other verb 405s through
    Django's `http_method_not_allowed`; only two methods are defined, so
    no `http_method_names` override is needed.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.INTEGRATIONS_MANAGE,
        "patch": Permissions.INTEGRATIONS_MANAGE,
    }

    @extend_schema(responses={200: ErpConnectionSerializer})
    def get(self, request):
        return Response(ErpConnectionSerializer(ErpConnection.load()).data)

    @extend_schema(request=ErpConnectionSerializer, responses={200: ErpConnectionSerializer})
    def patch(self, request):
        connection = ErpConnection.load()
        serializer = ErpConnectionSerializer(connection, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(
    summary="Trigger an ERP sync now",
    request=None,
    responses={202: ErpSyncRunSerializer(many=False)},
    description=(
        "Enqueues `run_erp_sync` and returns 202 immediately — the run happens "
        "on a Celery worker (INT-2). `direction` may be `import` (default) or "
        "`export`. Poll `GET /api/erp/sync-runs/` for the outcome."
    ),
)
class ErpSyncTriggerView(APIView):
    """Fires the sync on demand. Returns `202 Accepted` with no run row:
    the `ErpSyncRun` is created by the worker, not here, so a response
    body promising one would be a lie whenever the worker is down. The
    UI refetches the history list instead.

    Deliberately does NOT run the sync inline. A synchronous ERP crawl in
    a request thread is precisely what "async via SLA-0" (the intake)
    rules out.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"post": Permissions.INTEGRATIONS_MANAGE}

    def post(self, request):
        direction = request.data.get("direction", ErpSyncRun.Direction.IMPORT)
        if direction not in ErpSyncRun.Direction.values:
            raise ValidationError({"direction": [_("Must be 'import' or 'export'.")]})
        connection = ErpConnection.load()
        if not connection.is_configured():
            raise ValidationError(
                {"non_field_errors": [_("Enable the connection and set a base URL first.")]}
            )
        # Best-effort dispatch, matching the commit-first idiom
        # `UserViewSet.perform_create` uses around `send_invite_email.delay`
        # (Story 48): a down Redis/worker must surface as a clean error,
        # never a 500 traceback.
        try:
            run_erp_sync.delay(direction, request.user.id)
        except Exception:
            logger.exception("Failed to queue ERP sync")
            raise ValidationError(
                {"non_field_errors": [_("Could not queue the sync. Is the worker running?")]}
            ) from None
        return Response(None, status=status.HTTP_202_ACCEPTED)


class ErpSyncRunViewSet(BaseModelViewSet):
    """Read-only history. `http_method_names` drops every unsafe verb, the
    same `AuditLogViewSet` (SEC-3) precedent for a table that is a record
    rather than a resource: an omitted `permission_map` entry is merely
    authenticated-only under `HasPermission`'s grant-on-omission rule,
    which would be the wrong default here.
    """

    http_method_names = ["get", "head", "options"]
    queryset = ErpSyncRun.objects.select_related("triggered_by").all()
    serializer_class = ErpSyncRunSerializer

    permission_map = {
        "list": Permissions.INTEGRATIONS_MANAGE,
        "retrieve": Permissions.INTEGRATIONS_MANAGE,
    }

    ordering_fields = ("started_at", "direction", "state")


class ErpOrderViewSet(BaseModelViewSet):
    """Read-only mirror of ERP-owned orders — never writable from this
    API (Story 81 `## Product rules`). Supports `?customer=<id>` so the
    settings page (and, later, a customer-facing panel) can scope the
    list; an invalid value is a 400, not a silently unfiltered page, the
    same `AuditLogViewSet.get_queryset` precedent.
    """

    http_method_names = ["get", "head", "options"]
    queryset = ErpOrder.objects.select_related("customer").all()
    serializer_class = ErpOrderSerializer

    permission_map = {
        "list": Permissions.INTEGRATIONS_MANAGE,
        "retrieve": Permissions.INTEGRATIONS_MANAGE,
    }

    ordering_fields = ("placed_at", "order_number", "status", "synced_at")
    search_fields = ("order_number", "external_id", "customer__name")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            try:
                customer_id = int(customer_id)
            except ValueError:
                raise ValidationError(
                    {"customer": [_("Must be a valid customer id.")]}
                ) from None
            queryset = queryset.filter(customer_id=customer_id)
        return queryset
```

Extend `views.py`'s imports with: `from django.utils.translation import gettext_lazy as _`, `from rest_framework.exceptions import ValidationError`, `from rest_framework.permissions import IsAuthenticated`, `from rest_framework.views import APIView`, `from apps.core.permissions import HasPermission, Permissions`, the three new models, the three new serializers, and `from .tasks import run_erp_sync`.

---

### 10 — Routing

**File: `backend/apps/integrations/urls.py`** — register three routes and add one path. **Leave lines 15-32 (the doc routes) exactly as they are**; the new `path()` goes inside the same list.

```python
router.register("erp/sync-runs", ErpSyncRunViewSet, basename="erp-sync-run")
router.register("erp/orders", ErpOrderViewSet, basename="erp-order")
```

and, in `urlpatterns`, before the `schema/` path:

```python
    path("erp/connection/", ErpConnectionView.as_view(), name="erp-connection"),
    path("erp/sync/", ErpSyncTriggerView.as_view(), name="erp-sync"),
```

Extend the `from .views import (...)` line to include `ErpConnectionView`, `ErpOrderViewSet`, `ErpSyncRunViewSet`, `ErpSyncTriggerView`.

Endpoints: `GET|PATCH /api/erp/connection/`, `POST /api/erp/sync/`, `GET /api/erp/sync-runs/`, `GET /api/erp/orders/[?customer=<id>]`.

**No change to `config/api_urls.py`** — `apps.integrations.urls` is already included there (INT-1, line 24), and `apps/README.md`'s "one `include()` per app" rule means this story adds none.

---

### 11 — Django admin

**File: `backend/apps/integrations/admin.py`** — append below `ApiKeyAdmin`.

```python
@admin.register(ErpConnection)
class ErpConnectionAdmin(admin.ModelAdmin):
    """A lower-level fallback beside `/settings/erp` — the same
    both-paths-exist call `RoleAdmin` documents for `Role.permissions`.
    Adding is disabled: this is a singleton, `load()` creates the one row,
    and an admin "Add" button would offer a second that `save()` would
    silently collapse onto `pk=1`.
    """

    list_display = ("__str__", "enabled", "base_url", "export_enabled", "last_sync_at")
    readonly_fields = ("last_sync_at", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        # `ErpConnection.delete()` is already a no-op; hiding the button
        # keeps the admin from promising an action that does nothing.
        return False


@admin.register(ErpOrder)
class ErpOrderAdmin(admin.ModelAdmin):
    """Read-only: the ERP owns every field (Story 81 `## Product rules`).
    `raw` is visible here on purpose — this is where an operator debugging
    a field map looks to see what the ERP actually sent.
    """

    list_display = ("order_number", "external_id", "customer", "status", "placed_at", "synced_at")
    list_filter = ("status", "currency")
    list_select_related = ("customer",)
    search_fields = ("order_number", "external_id", "customer__name")
    readonly_fields = tuple(
        field.name for field in ErpOrder._meta.fields if field.name != "id"
    )

    def has_add_permission(self, request) -> bool:
        return False


@admin.register(ErpSyncRun)
class ErpSyncRunAdmin(admin.ModelAdmin):
    """Immutable record, same posture as `AuditLogAdmin`."""

    list_display = (
        "started_at",
        "direction",
        "state",
        "created_count",
        "updated_count",
        "skipped_count",
        "failed_count",
        "triggered_by",
    )
    list_filter = ("direction", "state")
    list_select_related = ("triggered_by",)
    readonly_fields = tuple(
        field.name for field in ErpSyncRun._meta.fields if field.name != "id"
    )

    def has_add_permission(self, request) -> bool:
        return False
```

---

## Frontend Tasks

### 12 — Types

**Create file: `frontend/src/features/integrations/types/erp.ts`**

```ts
/** Mirrors `apps.integrations.serializers.ErpConnectionSerializer`'s read
 *  shape. `auth_token` is absent by design — the API never returns it
 *  (write-only); `has_auth_token` is what the UI renders instead. */
export type ErpConnection = {
  id: number
  enabled: boolean
  base_url: string
  has_auth_token: boolean
  export_enabled: boolean
  customer_field_map: Record<string, string>
  order_field_map: Record<string, string>
  customer_external_id_field: string
  order_external_id_field: string
  order_customer_ref_field: string
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

/** The write shape. `auth_token` is send-only, and omitting it (or
 *  sending '') leaves the stored credential untouched server-side. */
export type ErpConnectionInput = {
  enabled: boolean
  base_url: string
  auth_token?: string
  export_enabled: boolean
  customer_field_map: Record<string, string>
  order_field_map: Record<string, string>
  customer_external_id_field: string
  order_external_id_field: string
  order_customer_ref_field: string
}

export const SYNC_DIRECTIONS = ['import', 'export'] as const
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number]

export const SYNC_STATES = ['running', 'success', 'failed'] as const
export type SyncState = (typeof SYNC_STATES)[number]

export type ErpSyncRun = {
  id: number
  direction: SyncDirection
  direction_display: string
  state: SyncState
  state_display: string
  triggered_by_name: string | null
  created_count: number
  updated_count: number
  skipped_count: number
  failed_count: number
  started_at: string
  finished_at: string | null
  error_message: string
  created_at: string
  updated_at: string
}

export type ErpOrder = {
  id: number
  customer: number
  customer_name: string
  external_id: string
  order_number: string
  status: string
  total_amount: string | null
  currency: string
  placed_at: string | null
  synced_at: string
  created_at: string
  updated_at: string
}
```

`as const` arrays plus indexed access, **never `enum`** — `erasableSyntaxOnly` forbids it (§ 3).

### 13 — API layer

Create seven files under `frontend/src/features/integrations/api/`, each mirroring its `features/organization/api/` counterpart:

- **`erpKeys.ts`** — `export const erpKeys = featureKey('erp')`
- **`getErpConnection.ts`** — `api.get<ErpConnection>('/erp/connection/')`
- **`updateErpConnection.ts`** — `api.patch<ErpConnection>('/erp/connection/', input)`
- **`triggerErpSync.ts`** — `api.post<void>('/erp/sync/', { direction })`
- **`getErpSyncRuns.ts`** / **`getErpOrders.ts`** — paginated list fetchers taking the `useServerTable` params object, copying `features/audit-log/api/getAuditLogs.ts`'s signature exactly (read that file before writing these — it is the paginated-list precedent, and `api.get` returns the unwrapped envelope `data` with `meta` handled by the client).
- **`useErpConnection.ts`**, **`useUpdateErpConnection.ts`**, **`useTriggerErpSync.ts`**, **`useErpSyncRuns.ts`**, **`useErpOrders.ts`** — the `useQuery`/`useMutation` hooks. Both mutations invalidate `erpKeys.all`; `useTriggerErpSync` **must** invalidate it too, so the history table refetches after a trigger.

Features call `api.*` from `@/shared/lib/api/client` and never `httpClient`, `fetch`, or a second `axios.create` (§ 4).

### 14 — The config page

**Create file: `frontend/src/features/integrations/components/ErpSettingsPage.tsx`**

Structure, following `SettingsPage.tsx` (lines 139-213) exactly:

```tsx
export function ErpSettingsPage() {
  const query = useErpConnection()
  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary query={query}>
        {(connection) => <ErpSettingsView connection={connection} />}
      </QueryBoundary>
    </div>
  )
}
```

`ErpSettingsView` renders, in order:

1. **`PageHeader`** with `title={t('erp.title')}`, and a **Sync now** `Button` calling `useTriggerErpSync()` with `direction: 'import'`. Disable it while `connection.enabled` is false or `mutation.isPending`. On success, `toast({ tone: 'success', message: t('erp.syncQueued') })`.
2. **The connection form** — `useAppForm` over this schema:

```ts
const schema = z.object({
  enabled: requiredBoolean(),
  base_url: optionalString(500).transform((value) => value ?? ''),
  auth_token: optionalString(500).transform((value) => value ?? ''),
  export_enabled: requiredBoolean(),
  customer_external_id_field: requiredString(100),
  order_external_id_field: requiredString(100),
  order_customer_ref_field: requiredString(100),
  customer_field_map: z.record(z.string(), z.string()),
  order_field_map: z.record(z.string(), z.string()),
})
```

   `base_url` gets the same non-empty-only `z.url()` `superRefine` that `SettingsPage.tsx` lines 34-48 applies to `logo_url` — reuse that block verbatim, including its comment about reusing `z.url()`'s own translated message rather than writing a new one.

   `auth_token` renders as `type="password"` with helper text driven by `connection.has_auth_token`: `t('erp.tokenSet')` when true, `t('erp.tokenUnset')` when false, plus `t('erp.tokenKeepHint')` explaining that leaving it blank keeps the existing one. **Never** prefill it — the API does not return it.
3. **Two `FieldMapField`s** (task 15), bound via `FormField`'s render prop, one per map, each passed its allowlist for the target dropdown: `['name','email','phone','company']` and `['order_number','status','total_amount','currency','placed_at']`. Keep these two arrays in `types/erp.ts` as `as const` exports so they sit beside the types they describe.
4. **`FormErrorSummary` + `SubmitButton`**, exactly as `SettingsPage` does.
5. **Run history** — `DataTable` over `useErpSyncRuns`, columns: `started_at` (via `useFormatters().dateTime`, sortable), `direction_display`, `state_display` (as a `Badge`: `success` → `variant="secondary"`, `failed` → `variant="destructive"`, `running` → `variant="outline"`), a combined counts cell (`t('erp.counts', { created, updated, skipped, failed })`), `triggered_by_name` falling back to `t('erp.scheduled')`, and `error_message`. `empty={<Empty title={t('erp.historyEmpty')} … />}`.
6. **Recently synced orders** — `DataTable` over `useErpOrders`, columns: `order_number`, `customer_name`, `status`, a `total_amount`+`currency` cell, `placed_at` (`dateTime`), `synced_at` (`dateTime`). This is the page's proof the field map worked; `empty` copy says so (`t('erp.ordersEmpty')`).

Every timestamp goes through `useFormatters()`; no raw ISO string reaches the DOM (§ 18). Every string comes from `t(...)`; `react/jsx-no-literals` fails the build otherwise.

### 15 — `FieldMapField`

**Create file: `frontend/src/features/integrations/components/FieldMapField.tsx`**

A local, single-consumer key→value editor, with a docstring stating the same reasoning `StringListField` (`SettingsPage.tsx` lines 62-71) records: **not** a new `shared/ui/form/` component, because it has exactly one consumer today (§ 8, § 23), and bound through `FormField`'s render prop because `useFieldArray` appears nowhere in this codebase.

Props: `{ label, value: Record<string,string>, onChange, allowedTargets: readonly string[], addLabel, sourcePlaceholder }`.

Render: existing pairs as rows of `<span>{source}</span> → <Select value={target}>` (options from `allowedTargets`) plus a ghost `XIcon` remove `Button`; then a draft row of an `Input` (ERP field name) + a `Select` (target) + an outlined `PlusIcon` **Add** `Button`. Adding trims the source, ignores an empty one, and overwrites a duplicate source key. `aria-label` on every icon-only button, from `t(...)`.

A `Select` rather than a free-text target input is the point: the backend's allowlist rejects anything else with a 400, so offering a text box would invite an error the UI can prevent.

### 16 — Route

**File: `frontend/src/app/router.tsx`** — add a sibling block after the `/settings` block (lines 444-456):

```tsx
          {
            element: <RequirePermission permission="integrations.manage" />,
            children: [
              {
                path: 'settings/erp',
                lazy: async () => {
                  const { ErpSettingsPage } =
                    await import('@/features/integrations/components/ErpSettingsPage')
                  return { element: <ErpSettingsPage /> }
                },
              },
            ],
          },
```

Its own `RequirePermission`, not nested inside `settings.manage`'s: the two permissions are independent, and nesting would silently require both.

### 17 — Sidebar

**File: `frontend/src/app/Sidebar.tsx`**

Extend the Administration section's visibility gate (line 124) with `|| can('integrations.manage')`, so a role holding only the new permission still sees the section.

Add a sibling link after the `/settings` one (lines 255-262):

```tsx
            <Can permission="integrations.manage">
              <SidebarLink
                to="/settings/erp"
                icon={PlugIcon}
                label={t('integrations:erp.navLabel')}
                collapsed={collapsed}
              />
            </Can>
```

Add `PlugIcon` to the existing `lucide-react` import (the icon set this app standardises on, § 25).

### 18 — Locales

**Create `frontend/src/features/integrations/locales/en.json`** and **`ar.json`** with an identical key structure under one top-level `erp` object: `title`, `navLabel`, `syncNow`, `syncQueued`, `scheduled`, `counts`, `tokenSet`, `tokenUnset`, `tokenKeepHint`, `historyTitle`, `historyEmpty`, `ordersTitle`, `ordersEmpty`, `saved`, plus `fields.*` for every form label, `maps.*` for the two map editors, and `actions.*`. Arabic is a real translation, not a copy of the English (§ 18).

### 19 — Register the namespace

**File: `frontend/src/shared/i18n/resources.ts`** — two imports (alphabetically, after the `customers` pair) and one line per language block:

```ts
import integrationsAr from '@/features/integrations/locales/ar.json'
import integrationsEn from '@/features/integrations/locales/en.json'
```

```ts
    integrations: integrationsEn,   // in `en`
    integrations: integrationsAr,   // in `ar`
```

That is the whole "every feature adds its own namespace" checklist item this file's own docstring (lines 35-43) describes.

---

## Documentation Tasks

### 20 — `README.md`

Append a `###` subsection at the end of § API conventions, after INT-1's "The public API, API keys, and OpenAPI docs" block and before `### Consuming the API from the frontend`:

````markdown
### ERP sync (INT-2)

`/settings/erp` (permission `integrations.manage`) configures one ERP connection: base URL,
bearer token, and two **field maps** translating the ERP's field names to SupportOS ones. Nothing
is contacted until **Enabled** is on and a base URL is set.

| Endpoint | What it does |
|---|---|
| `GET`/`PATCH` `/api/erp/connection/` | The singleton config. `auth_token` is write-only — send `""` (or omit it) to keep the stored one. |
| `POST /api/erp/sync/` | Enqueues a sync (`{"direction": "import"｜"export"}`); returns `202`. |
| `GET /api/erp/sync-runs/` | Run history with per-entity counters. |
| `GET /api/erp/orders/?customer=<id>` | The read-only order mirror. |

**Direction.** Import pulls ERP customers onto `customers.Customer` (upserted by
`Customer.external_id`) and ERP orders onto `integrations.ErpOrder`. Export pushes SupportOS
customers that have no `external_id` yet and stores the id the ERP returns. **Orders are never
exported** — the ERP owns them, and nothing in SupportOS creates one.

**The assumed ERP contract** is `GET /customers`, `GET /orders`, `POST /customers`, bearer auth,
each response either a bare JSON array or `{"results": [...]}`. Different field names are
configuration; different paths or auth mean editing `apps/integrations/erp_client.py`.

**Schedule.** `apps/integrations/migrations/0003_seed_erp_sync_schedule.py` seeds an hourly,
enabled `PeriodicTask` for the import. It is inert until the connection is configured. Change the
interval in `/admin/` (`django-celery-beat`), never in settings — `CONVENTIONS.md` § 24. **A
Celery worker must be running** for any sync to happen (`README.md` § 6; on Windows,
`celery -A config worker --pool=solo`).
````

Add one row to the § Backend environment-variable table? **No** — this story adds no environment variable. Say nothing there.

### 21 — `CONVENTIONS.md` § 30

Append after § 29 (which ends at line 2027, the end of the file). Renumber nothing.

```markdown

---

## 30. ERP sync (INT-2)

`INT-2` (Story 81) is this project's first sync with a system it does not
own. Three rules follow from that and apply to `INT-3`/`INT-4` too.

**A foreign system's field names are configuration, never code.**
`ErpConnection.customer_field_map`/`order_field_map` translate ERP field
names to SupportOS ones, and `apps/integrations/erp_sync.py` is the only
module that applies them. A story that integrates a second external
system adds its own map to its own config row — it does not hardcode a
vendor's field name in a serializer or a task.

**A field map may only target an explicit allowlist.**
`CUSTOMER_SYNCABLE_FIELDS`/`ORDER_SYNCABLE_FIELDS`
(`apps/integrations/erp_sync.py`) are enforced in three places, on
purpose: `ErpConnection.clean()` (admin/`full_clean`),
`ErpConnectionSerializer` (the API path — DRF does not call model
`clean()`, § 22), and `apply_field_map` itself (a map written through the
ORM bypasses both). `Customer.external_id` and `Customer.user` are
deliberately **absent** from the allowlist: one is the correlation key the
upsert depends on, the other is the portal-login link a bulk import must
never re-point.

**An unconfigured integration is a no-op, not an error, and its schedule
ships enabled.** `run_erp_sync` returns immediately unless
`ErpConnection.is_configured()`, which is what lets
`0003_seed_erp_sync_schedule` seed an *enabled* `PeriodicTask` — the
schedule existing and the connection being configured are two independent
opt-ins, the same split § 24 already records for `SLA-3`.

**A per-record failure never aborts a run; a connection-level failure
does.** `erp_sync` counts a bad record into `ErpSyncRun.failed_count` and
carries on — imperfect upstream data is the normal case, and one
over-long name must not strand the other 4,999 records. An `ErpError`
(host down, non-2xx, non-JSON body) ends the run as `failed`. Either way
the `ErpSyncRun` row is the record; **no `AuditLog` row is written**, for
the same reason § 29 gives for API keys.

**A credential this project must replay cannot be hashed — so it is
write-only instead.** `ErpConnection.auth_token` is stored in plain text
(it is sent on every outbound call, unlike INT-1's `ApiKey`, which only
ever needs a digest), is `write_only` in its serializer, and is reported
to the UI only as the boolean `has_auth_token`. A blank token on `PATCH`
leaves the stored value alone, so saving the form cannot wipe it.
**Encryption at rest is not implemented** and is `INT-3`'s to decide — its
own task text is "secure central config for … credentials". Until then,
DB access is token access; § 10's never-log rule is what keeps it out of
logs.
```

---

## Edge Cases & Failure Modes

- **No Celery worker running → the sync never happens, and the UI says so.** `ErpSyncTriggerView.post` wraps `.delay(...)` in `try/except` and returns a `400` with "Could not queue the sync. Is the worker running?" rather than a 500. The scheduled `PeriodicTask` simply never fires. On Windows the worker needs `--pool=solo` (§ 24).
- **Connection enabled with a blank `base_url` → rejected at the API.** `ErpConnectionSerializer.validate` raises a field error on `base_url`. `is_configured()` also guards the task, so even a row written directly through the ORM cannot make `run_erp_sync` call a blank URL.
- **A field map targeting `user`, `external_id`, or any unknown field → `400 validation_error`** on that map's field, from all three enforcement points (§ 30). This is the story's main safety boundary: without it a bulk import could re-point portal logins or destroy the correlation key.
- **The same ERP field mapped to two targets** is legal and works on import. **Two ERP fields mapped to the same target** is also legal, and on **export** the inversion in `export_customers` keeps only the last — dict inversion is lossy, `clean()` does not forbid the many-to-one case because it is legitimate on import, and the operator sees the result in the exported payload. Documented rather than silently prevented.
- **Blank email arriving from the ERP → normalised to `NULL` before the upsert.** `import_customers` does this explicitly because `update_or_create` does not run `Customer.clean()`. Without it, the second blank-email customer is an `IntegrityError` (a 500 in a worker, a `failed_count` here) — the exact failure `Customer.email`'s own comment (`apps/customers/models.py:18-26`) documents.
- **A duplicate email from the ERP → that one record's `failed_count`, run continues.** `Customer.email` is unique; the `except Exception` in `import_customers` catches the `IntegrityError`, logs it **without the payload**, and moves on.
- **An order whose customer is not in SupportOS → `skipped_count`, not `failed_count`.** `import_customers` runs first in the same task precisely so this is rare; a genuinely unknown customer is skipped and picked up on the next run once the ERP exposes them.
- **An unparseable `placed_at` → the field is dropped, the order still imports.** `_coerce_datetimes` pops it rather than failing the record.
- **An ERP that returns its whole history → capped at `ERP_MAX_RECORDS_PER_RUN` (5000)** with a `logger.warning`. Prevents one misconfigured run from becoming unbounded. The cap is per run, so a large ERP still converges across runs — but note it converges on **whatever the ERP returns first**, since the assumed contract has no pagination; a vendor with real pagination needs `erp_client` extended.
- **A non-JSON or unrecognised response body → `ErpError`, run marked `failed`, `error_message` recorded.** `_records` deliberately raises rather than returning `[]`: a broken connection must not look like an ERP with zero customers.
- **`HTTPError` must be caught before `URLError`** in `erp_client._request` — it is a subclass, and reversing the order loses the status code. The code does this; do not "simplify" it.
- **The auth token never reaches a log line, an error message, or a response body.** `_request` logs only method/path/status, `except` clauses use `exc.reason` and never `exc.read()`, and the serializer is `write_only`. **But it is stored unencrypted** — see § 30. Anyone with database or Django-admin access has the credential.
- **Saving the settings form does not wipe the token.** `ErpConnectionSerializer.update` pops a blank `auth_token`. The UI states this via `t('erp.tokenKeepHint')`.
- **Two overlapping runs (the hourly schedule fires while a manual run is in flight)** both execute; `update_or_create` on a unique `external_id` makes each record's write idempotent, so the outcome converges. No lock is taken — the counters on the two `ErpSyncRun` rows will simply both be non-zero. If this becomes a real problem the fix is a Celery lock, and it is not built.
- **A record deleted in the ERP stays in SupportOS.** Neither direction propagates deletes. Deliberate: a support system silently losing a customer because an ERP archived them is worse than a stale row.
- **Nobody holds `integrations.manage` until `accounts/0009` runs**, and only `admin` does afterward (plus superusers, via `permissions_for`'s short-circuit). **In a database where the seeded `admin` role was renamed, `0009` silently grants nothing** — `filter(slug="admin").first()` returns `None`. This is not hypothetical: Story 80's own live verification found this project's dev database has `super_admin` and no `admin` slug. Grant it through `/api/roles/<id>/` or `/admin/` there.
- **`makemigrations` must be run for both `customers` and `integrations`** (tasks 1 and 3), or `config/tests/test_settings.py::MigrationStateTests.test_no_pending_migrations` fails.
- **`ErpSyncRun.state` is named `state`, not `status`, on purpose** — Story 80's verification recorded a live drf-spectacular enum-naming collision on fields named `status` (from `tickets`/`knowledge_base`). That pre-existing collision is untouched and out of scope; this story simply does not deepen it.
- **`ErpOrder.raw` is not exposed by the API** (`ErpOrderSerializer` omits it) but **is** visible in `/admin/`. That is the intended asymmetry: it is a debugging aid for an operator, not payload for every API reader.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created and no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py makemigrations customers integrations` — expect `customers/0006_customer_external_id.py` and `integrations/0002_*`. Then `python manage.py makemigrations --check --dry-run` reports nothing pending (`accounts/0009` and `integrations/0003` are hand-written and data-only).
2. `python manage.py migrate`, then `python manage.py check`.
3. `python manage.py test` — must report **54** passing, `MigrationStateTests` and `DrfSettingsTests` included. This story changes neither the renderer list nor the exception handler.
4. `ruff format --check .` and `ruff check .` from `backend/`.
5. `python manage.py spectacular` — must still exit 0, and must **not** add a new `status` enum collision warning (see `## Edge Cases`). The four new endpoints appear in the schema, envelope-wrapped by INT-1's `envelope_postprocessing_hook`.
6. **The mapping layer, exercised without an ERP** — `erp_sync.py` is deliberately HTTP-free, so `python manage.py shell` can call `apply_field_map({...}, {...}, CUSTOMER_SYNCABLE_FIELDS)` against literal dicts and assert the allowlist drops a disallowed target. Verification Step 6.
7. **A real end-to-end sync against a local stub ERP** — Verification Steps 7-10. No third-party ERP account is needed; a 30-line `http.server` script is enough and stdlib-only, matching how this project already tests its other adapters.
8. `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` from `frontend/`, plus the `en`/`ar` key-set comparison for the new `integrations` namespace.
9. A browser walkthrough of `/settings/erp` in both languages — Verification Step 11.

---

## Migration / Rollback

**Four migrations ship:**

| Migration | Kind | Reverse |
|---|---|---|
| `customers/0006_customer_external_id` | Schema (one nullable unique column) | `migrate customers 0005` — drops the column and every stored correlation. |
| `accounts/0009_grant_integrations_permission` | Data | Its own `revoke()`. |
| `integrations/0002_erpconnection_erporder_erpsyncrun` | Schema (three tables) | `migrate integrations 0001` — drops all ERP config, mirrored orders, and run history. |
| `integrations/0003_seed_erp_sync_schedule` | Data (`PeriodicTask`) | Deletes only the `PeriodicTask` it created, never the shared `IntervalSchedule`. |

**Rollback of the code:** revert the commits, then `migrate integrations 0001`, `migrate accounts 0008`, `migrate customers 0005`. **Reverse `integrations/0003` before stopping the worker**, or an orphaned `PeriodicTask` keeps firing a task whose module no longer exists (Celery logs `NotRegistered` every hour). No `pip install`/`npm install` to undo — this story adds no dependency.

**Half-applied states to avoid:**

- **Task 2's constant after task 2's migration** → `Role.clean()` raises `Unknown permissions: integrations.manage` on the next role save through any form. Constant first, always.
- **Task 3's models referencing `erp_sync`'s allowlists before task 5 exists** → `ImportError` at startup. `ErpConnection.clean()` imports them **inside the method**, not at module scope, precisely to keep this from becoming a circular import (`erp_sync` imports `models`) — keep it that way.
- **Task 6/9 (`views.py` imports `run_erp_sync`) before task 6's `tasks.py` exists** → `ImportError` at startup. Ship 3, 5, 6, 8, 9, 10 together.
- **Task 7's dependency naming a `0002_*` file that `makemigrations` named differently** → `NodeNotFoundError` on every `migrate`. Read the generated filename and fix the dependency.
- **Task 1's model field without its `clean()` change** → a blank `external_id` reaching a unique column is an `IntegrityError`, the exact trap `email` already documents.
- **Task 10 registering `erp/...` routes above INT-1's doc paths** → harmless (different prefixes), but keep the doc paths untouched: they are `SchemaView`/Swagger/ReDoc and carry INT-1's YAML-renderer fix.
- **Tasks 14-17 before task 18/19 (locales + namespace registration)** → every `t('integrations:...')` call fails `tsc -b`, the components-before-locales ordering § 23 already warns about.
- **Task 16 before task 14** → the lazy `import()` target does not exist; `npm run build` fails.

---

## Verification Steps

1. **Backend builds and migrates:** from `backend/` with the venv active — `python manage.py makemigrations customers integrations`, `python manage.py migrate`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`. All clean.
2. **Backend gates:** `python manage.py test` reports **54** passing; `ruff format --check .` and `ruff check .` exit 0.
3. **Schema still generates:** `python manage.py spectacular --file "$env:TEMP\erp-schema.yaml"` exits 0. Confirm `/api/erp/connection/`, `/api/erp/sync/`, `/api/erp/sync-runs/`, `/api/erp/orders/` are present, each `2xx` body envelope-wrapped, and the list endpoints carrying `meta.pagination`. Confirm **no new** enum-collision warning appeared.
4. **Permission gating.** With `python manage.py runserver` up and a token for a role **without** `integrations.manage`:

   ```powershell
   curl.exe -s -w "`n%{http_code}`n" http://127.0.0.1:8000/api/erp/connection/ -H "Authorization: Bearer $agentToken"
   ```

   Expect `403 permission_denied`. Repeat with an `integrations.manage` holder → `200`, and confirm the body has `has_auth_token` and **no** `auth_token` key at all.
5. **Config validation.** Each of these is a `400 validation_error` on the named field:
   - `PATCH {"enabled": true, "base_url": ""}` → `base_url`.
   - `PATCH {"customer_field_map": {"erp_name": "user"}}` → `customer_field_map` (allowlist).
   - `PATCH {"customer_field_map": {"erp_name": "external_id"}}` → `customer_field_map`.
   - `PATCH {"order_field_map": {"x": ""}}` → `order_field_map`.
   Then `PATCH {"customer_field_map": {"full_name": "name", "email_address": "email"}}` → `200`.
6. **The token survives a save, and is never returned.** `PATCH {"auth_token": "erp-secret-123"}` → `200`. `GET` → `has_auth_token: true`, no `auth_token`. Then `PATCH {"base_url": "http://127.0.0.1:9001"}` (no token key) → `200`, and in `manage.py shell` confirm `ErpConnection.load().auth_token == "erp-secret-123"` — unchanged.
7. **The mapping layer, no ERP needed.** In `manage.py shell`:

   ```python
   from apps.integrations.erp_sync import CUSTOMER_SYNCABLE_FIELDS, apply_field_map
   apply_field_map(
       {"full_name": "Acme", "email_address": "a@b.com", "secret": "x"},
       {"full_name": "name", "email_address": "email", "secret": "user"},
       CUSTOMER_SYNCABLE_FIELDS,
   )
   ```

   Must return exactly `{"name": "Acme", "email": "a@b.com"}` — `user` dropped by the allowlist even though the map asked for it.
8. **A real import against a stub ERP.** Write a stdlib-only stub to the scratchpad and run it on port 9001:

   ```python
   # erp_stub.py — serves the assumed contract from `## Story Goal`
   import json
   from http.server import BaseHTTPRequestHandler, HTTPServer

   CUSTOMERS = [
       {"id": "E-1", "full_name": "Acme Corp", "email_address": "ops@acme.test"},
       {"id": "E-2", "full_name": "Globex", "email_address": ""},
   ]
   ORDERS = [
       {"id": "O-1", "customer_id": "E-1", "ref": "SO-1001",
        "state": "shipped", "amount": "125.50", "cur": "SAR",
        "created": "2026-08-01T10:00:00Z"},
       {"id": "O-2", "customer_id": "E-404", "ref": "SO-1002", "state": "open"},
   ]

   class H(BaseHTTPRequestHandler):
       def _send(self, payload):
           body = json.dumps(payload).encode()
           self.send_response(200)
           self.send_header("Content-Type", "application/json")
           self.send_header("Content-Length", str(len(body)))
           self.end_headers()
           self.wfile.write(body)

       def do_GET(self):
           self._send(CUSTOMERS if self.path.startswith("/customers") else {"results": ORDERS})

       def do_POST(self):
           self.rfile.read(int(self.headers.get("Content-Length", 0)))
           self._send({"id": "E-NEW-1"})

   HTTPServer(("127.0.0.1", 9001), H).serve_forever()
   ```

   Point the connection at it (`base_url=http://127.0.0.1:9001`, `enabled=true`), set both maps (`{"full_name":"name","email_address":"email"}` and `{"ref":"order_number","state":"status","amount":"total_amount","cur":"currency","created":"placed_at"}`), start a worker (`celery -A config worker --pool=solo -l info` on Windows), then `POST /api/erp/sync/ {"direction":"import"}` → `202`.

   Then `GET /api/erp/sync-runs/` and confirm the newest run: `state: "success"`, `created_count: 3` (two customers + `O-1`), `skipped_count: 1` (`O-2`, whose customer `E-404` is unknown — **skipped, not failed**). Confirm `Globex` has `email: null`, not `""`. Confirm `GET /api/erp/orders/` returns `SO-1001` with `total_amount: "125.50"`, `currency: "SAR"`, and a parsed `placed_at`.
9. **Idempotency.** Trigger the same import again → the new run reports `updated_count: 3`, `created_count: 0`, and `GET /api/erp/orders/` still returns exactly one row. Also confirm `ErpConnection.last_sync_at` advanced.
10. **Failure paths.**
    - Stop the stub, trigger an import → run `state: "failed"`, `error_message` naming the connection refusal, and **no** partial garbage in `ErpOrder`.
    - Set `enabled=false`, trigger → `400` from the endpoint ("Enable the connection…"); confirm **no** new `ErpSyncRun` row.
    - With `export_enabled=false`, `POST /api/erp/sync/ {"direction":"export"}` → the task no-ops and writes no run row (check the worker log for "export skipped").
    - Set `export_enabled=true`, create a customer through `/api/customers/` (so it has no `external_id`), trigger an export → run `state: "success"`, `created_count: 1`, and that customer now has `external_id: "E-NEW-1"`.
    - `POST /api/erp/sync/ {"direction":"sideways"}` → `400` on `direction`.
11. **The UI walkthrough, both languages.** `npm run dev` with the backend and worker up, signed in as an `integrations.manage` holder:
    - The sidebar Administration section shows the ERP link; `/settings/erp` loads.
    - The token field is empty with a "configured" hint; saving other fields keeps the token (re-check via step 6).
    - Both field-map editors add, change, and remove pairs; the target is a dropdown restricted to the allowlist, so a rejected mapping cannot be typed.
    - **Sync now** is disabled while **Enabled** is off; with it on, clicking shows the queued toast and the history table gains a row after a refetch.
    - The orders table shows the synced order with a formatted date and amount.
    - Switch to Arabic: every label, badge, empty state, and toast is translated and `dir="rtl"`; no raw ISO timestamp anywhere.
    - Sign in as a role **without** `integrations.manage`: the sidebar link is absent and `/settings/erp` is refused by `RequirePermission`.
12. **No hardcoded strings.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\integrations\components\*.tsx -Pattern "'[A-Z][a-z]{3,}"
    ```

    Only non-user-facing hits.
13. **Frontend gates, in CI order:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all exit 0. Plus the `en`/`ar` key-set comparison for `features/integrations/locales`.
14. **Regression:** the existing app is untouched — walk customers, tickets, and `/settings`, and confirm `/api/api-keys/`, `/api/docs/`, and `/api/schema/` (INT-1) all still behave. `GET /api/customers/` now carries an `external_id` field; confirm the customer list and form screens still render and save.

---

## Done Criteria

- [ ] `Customer.external_id` exists — `max_length=100`, `unique=True`, `null=True`, `blank=True` — with `Customer.clean()` normalising blank→`NULL` and `CustomerSerializer` declaring an explicit `UniqueValidator` plus `validate_external_id`; `customers/0006` committed.
- [ ] `Permissions.INTEGRATIONS_MANAGE` (`"integrations.manage"`) added; `accounts/0009_grant_integrations_permission.py` grants it to `admin` only and reverses cleanly.
- [ ] `ErpConnection` is a `pk=1` singleton (`load()`/`save()`/`delete()` matching `OrganizationSettings`), with both field maps, the three id-field names, `enabled`, `export_enabled`, `is_configured()`, and `clean()` validating both maps against the allowlists.
- [ ] `ErpOrder` exists, `customer` `CASCADE`, `external_id` unique, `status` a plain `CharField` (no `TextChoices`), `raw` retained; **no** create/update/delete endpoint and `has_add_permission` `False` in the admin.
- [ ] `ErpSyncRun` exists with `direction`, `state` (named `state`, not `status`), four counters, `started_at`/`finished_at`, `error_message`, and `triggered_by` `SET_NULL`.
- [ ] `integrations/0002` (three tables) and `integrations/0003` (an **enabled**, hourly `PeriodicTask` for `apps.integrations.tasks.run_erp_sync`, reverse deleting only the `PeriodicTask`) committed.
- [ ] `erp_client.py` uses **stdlib `urllib.request`** — no new dependency in `requirements.txt` — catches `HTTPError` before `URLError`, raises only `ErpError`, caps a run at `ERP_MAX_RECORDS_PER_RUN`, and never logs the token, the request body, or the response body.
- [ ] `erp_sync.py` is HTTP-independent and enforces `CUSTOMER_SYNCABLE_FIELDS`/`ORDER_SYNCABLE_FIELDS` in `apply_field_map` itself; `external_id` and `user` are absent from the customer allowlist (verified by Step 7).
- [ ] Import upserts customers **then** orders, normalises blank email to `NULL`, skips an order with an unknown customer (`skipped_count`), and counts a per-record failure into `failed_count` without aborting the run (verified by Step 8).
- [ ] Export pushes only customers with no `external_id` and stores the returned id back (verified by Step 10).
- [ ] `run_erp_sync` is a `@shared_task` in `apps/integrations/tasks.py`, no-ops with **no run row** when the connection is unconfigured/disabled or when export is off, marks `failed` with an `error_message` on `ErpError`, and advances `ErpConnection.last_sync_at` only on success.
- [ ] Four endpoints live and gated on `integrations.manage`: `GET|PATCH /api/erp/connection/`, `POST /api/erp/sync/` (returns `202`, never runs inline), `GET /api/erp/sync-runs/`, `GET /api/erp/orders/` (with `?customer=`), the last two `GET`-only via `http_method_names`.
- [ ] `auth_token` is `write_only`, absent from every response, preserved when blank on `PATCH`, and surfaced only as `has_auth_token` (verified by Steps 4 and 6).
- [ ] `/settings/erp` renders the connection form, both `FieldMapField` editors (target as an allowlist dropdown), **Sync now**, the run history, and the synced-orders preview; routed under its **own** `RequirePermission permission="integrations.manage"`, with the sidebar link and the Administration-section gate extended.
- [ ] `integrations` locale namespace added in both languages, really translated, registered in `resources.ts`; `en`/`ar` key sets match.
- [ ] `README.md` gains the "ERP sync (INT-2)" subsection; `CONVENTIONS.md` gains § 30 with § 0-§ 29 unrenumbered. **No new environment variable** in `.env.example` or the README table.
- [ ] `python manage.py check`, `python manage.py test` (**54** passing), `python manage.py spectacular` (exit 0, no new enum collision), `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all pass.
- [ ] `.squad/plans/integrations/00-overview.md` carries this story's row; `.squad/plans/00-index.md`'s `integrations` NN range includes `81`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 82.**
