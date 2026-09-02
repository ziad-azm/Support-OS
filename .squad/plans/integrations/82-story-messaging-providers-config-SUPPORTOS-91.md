# Story 82 — Messaging Providers Config (INT-3) (Story: SUPPORTOS-91)

## Prerequisites

- **`COMM-1`/`COMM-2`/`COMM-4` (Email, WhatsApp, SMS — Stories 14, 15, 17) are complete.** [../communication-channels/14-story-email-SUPPORTOS-39.md](../communication-channels/14-story-email-SUPPORTOS-39.md), [../communication-channels/15-story-whatsapp-SUPPORTOS-40.md](../communication-channels/15-story-whatsapp-SUPPORTOS-40.md), [../communication-channels/17-story-sms-SUPPORTOS-42.md](../communication-channels/17-story-sms-SUPPORTOS-42.md). Each adapter's `send()` currently reads its provider credentials directly off Django `settings.*` — `apps/communications/whatsapp_adapter.py:109-114` and `apps/communications/sms_adapter.py:90-96` each read a plain-ENV block with no DB layer. This story replaces those two blocks (plus part of email's) with a DB-backed singleton per channel, following `apps.organization.OrganizationSettings`/`apps.integrations.ErpConnection`'s own `pk=1`/`load()`/`save()`/`delete()`-no-op pattern.
- **`config/settings/base.py` line 343 already names this exact story as the intended destination.** The `--- Email (COMM-1) ---` block's own comment reads: *"Provider config stays ENV-only for this story; INT-3 (SupportOs backlog.MD:661-665) is where a DB-backed config UI eventually lands."* This plan is that landing.
- **Scope decision, confirmed with the user this session:** the new DB config is read **only** by the three `ChannelAdapter.send()` methods (and, for SMS only, the one inbound view forced to share its credential — see below) — never by `apps/accounts/tasks.py` (invite, password-reset email) or `apps/notifications/tasks.py` (notification email). Those two keep reading Django's existing `EMAIL_*` settings unchanged. This matches the backlog task's literal wording — "credentials **reused by channel adapters**" — and keeps this story's diff inside `apps/communications/` (plus one permission and one grant migration). Unifying every outbound email path onto one config is a legitimate follow-up, not this story; `## Edge Cases` states the resulting two-SMTP-config reality explicitly rather than hiding it.
- **`apps/integrations/{models,serializers,views,urls,admin}.py`'s `ErpConnection`/`ErpConnectionSerializer`/`ErpConnectionView`/`ErpConnectionAdmin` (Story 81, INT-2) are the direct structural precedent** this story copies three times over — singleton model, `write_only` credential field + `has_*` boolean, plain `GET`/`PATCH` `APIView`, admin with `has_add_permission`/`has_delete_permission` both `False`. `CONVENTIONS.md` § 30's own closing paragraph explicitly hands this story the encryption-at-rest question ("Encryption at rest is not implemented and is `INT-3`'s to decide"); this plan's `## Edge Cases` makes that decision (no — same reasoning INT-1/INT-2 already gave, extended to a third and fourth stored credential) rather than deferring it again.
- **Verified live, this session — a real coupling that shapes task 5.** `apps/communications/views.py:201-207` (`SMSInboundWebhookView.post`) reads `settings.SMS_AUTH_TOKEN` to verify Twilio's `X-Twilio-Signature` — the **same** credential `SMSAdapter.send()` (`sms_adapter.py:90-96, 113`) uses for outbound Basic Auth. Twilio's Auth Token is genuinely dual-purpose in their own model. Moving `SMS_AUTH_TOKEN` to the DB config without also switching `SMSInboundWebhookView` to read it from there would leave inbound signature verification checking a stale/blank value the moment an operator rotates the token through the new UI — a real, live bug, not a hypothetical one. Task 5 updates both call sites together. No equivalent coupling exists for WhatsApp (`WHATSAPP_ACCESS_TOKEN`, send-only, vs `WHATSAPP_WEBHOOK_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`, inbound-only — three genuinely separate values) or Email (`EmailInboundWebhookView` uses its own independent `EMAIL_INBOUND_WEBHOOK_TOKEN`).
- **Verified live: every one of the settings this story removes has exactly one Python consumer, and every one it keeps has a consumer this story does not touch.** `grep -rn` across `backend/apps/` and `backend/config/` found `WHATSAPP_API_BASE_URL`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` used only in `whatsapp_adapter.py`, and `SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` used only in `sms_adapter.py` + `views.py` (the coupling above). `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS` have **zero** direct Python reads anywhere in `apps/` — they are consumed implicitly by Django's own SMTP backend (`django.core.mail.get_connection()` → `smtp.EmailBackend.__init__`, which falls back to `settings.EMAIL_HOST` etc. for any kwarg not explicitly passed) whenever `EmailMessage(...).send()` runs with no explicit `connection=`, which is exactly what `apps/accounts/tasks.py` and `apps/notifications/tasks.py` still do. **These six settings are not removed.**
- **Verified live: `django.core.mail.backends.base.BaseEmailBackend.__init__(self, fail_silently=False, **kwargs)` silently absorbs any extra keyword argument**, and `console.EmailBackend.__init__(self, *args, **kwargs)` (dev's backend) does the same after popping `stream`. This is what makes task 4's `get_connection(host=..., port=..., username=..., password=..., use_tls=...)` call safe to make unconditionally — in dev it resolves to the console backend and those kwargs are harmlessly ignored (the message still prints to stdout, exactly as today); in prod it resolves to the SMTP backend and they are the actual connection parameters. `EMAIL_BACKEND` itself (the dev/prod console-vs-SMTP switch) is **not** touched — it stays a hardcoded, environment-level setting (`config/settings/dev.py`/`prod.py`), the same "local dev can never accidentally send a real email" invariant the existing comment already documents.

---

## Story Goal

Give SupportOS one place to configure the credentials `EmailAdapter`, `WhatsAppAdapter`, and `SMSAdapter` send through, replacing the ENV-only config those three adapters read today:

1. **Three DB-backed singleton config models** in `apps/communications/models.py` — `EmailProviderConfig`, `WhatsAppProviderConfig`, `SmsProviderConfig` — each following the exact `pk=1`/`load()`/`save()`/`delete()`-no-op shape `OrganizationSettings` and `ErpConnection` already established. No new `enabled` toggle on any of them: matching the **existing** behavior exactly, blank required fields are what "not configured" already means (`WhatsAppAdapter.send`/`SMSAdapter.send`'s current `if not (...): raise ValueError(...)` guards), and this story preserves that semantic rather than inventing a second one.
2. **Three adapters updated to read the DB config instead of `settings.*`** — `EmailAdapter.send()` (task 4), `WhatsAppAdapter.send()` (task 5), `SMSAdapter.send()` (task 5) — with **no other behavior change**: same guard-then-send shape, same error messages (reworded to name the new source), same stdlib `urllib` HTTP calls for WhatsApp/SMS.
3. **`SMSInboundWebhookView` switches to the same DB-stored `auth_token`** its own adapter now uses, closing the coupling named in `## Prerequisites`.
4. **A real config UI** — `/settings/channels`, gated on a new `Permissions.COMMUNICATIONS_MANAGE`, with three cards (Email / WhatsApp / SMS), each its own form against its own endpoint, following `ErpSettingsPage.tsx`'s multi-resource-one-page shape (Story 81).
5. **The now-fully-unused `WHATSAPP_API_BASE_URL`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`/`SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` settings, `.env.example` lines, and README rows are removed** — not left as dead config nobody reads, matching this codebase's own hygiene standard (verified: zero remaining Python consumers after tasks 4-5 land). `EMAIL_*`/`WHATSAPP_WEBHOOK_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/`SMS_WEBHOOK_URL` all stay — see `## Prerequisites`.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig` | "Provider config models" (backlog, `INT-3`). |
| `EmailAdapter.send()`/`WhatsAppAdapter.send()`/`SMSAdapter.send()` reading the new models | "…reused by channel adapters" (backlog, `INT-3`). |
| `SMSInboundWebhookView` reading `SmsProviderConfig.load().auth_token` | Correctness requirement forced by Twilio's dual-purpose Auth Token — see `## Prerequisites`, verified live. |
| `Permissions.COMMUNICATIONS_MANAGE` + `accounts/migrations/0010_grant_communications_permission.py` | § 22's two-halves rule, the same shape `API_KEYS_MANAGE`/`INTEGRATIONS_MANAGE` (Stories 80-81) already establish. |
| `ChannelSettingsPage.tsx` at `/settings/channels` | "+ UI… Outcome: one place to connect channels" (backlog, `INT-3`). |
| Settings/`.env.example`/README cleanup | No orphaned, unread ENV config — matches this project's own discipline (§ 0, § 17). |

**Not here, and why:**

- **No change to `apps/accounts/tasks.py` or `apps/notifications/tasks.py`.** Confirmed with the user this session (`## Prerequisites`) — those stay on Django's existing `EMAIL_*` settings. `## Edge Cases` names the resulting two-SMTP-config reality plainly.
- **No `enabled` toggle on any of the three models.** `ErpConnection` (INT-2) has one because a scheduled background job needed an independent "configured but not yet turned on" state. Nothing here runs on a schedule — `send()` is called synchronously from `MessageViewSet.perform_create` whenever an agent replies, and "required fields blank" already is, and remains, the off state. Adding a second switch nobody asked for would be exactly the un-asked-for complexity § 0 warns against.
- **No encryption at rest for `host_password`/`access_token`/`auth_token`.** Stored as plain `CharField`s, `write_only` in their serializers, never returned by the API — the identical posture `ErpConnection.auth_token` (Story 81) already takes, and the identical reasoning: no encryption library is installed, and adding one is a cross-cutting decision that would apply uniformly to all of `ErpConnection.auth_token` and these three new fields at once, not to one story's fields in isolation. `CONVENTIONS.md` § 30 named this story as where that question would be decided; it is decided here the same way. See `## Edge Cases`.
- **No "send a test message" action.** The backlog task is "Provider config models + UI"; a live test-send is a real, separable feature this task text does not name, and `OrganizationSettings`'s own `SettingsPage.tsx` sets the precedent that a config-only page has no such action either.
- **No new inbound-webhook behavior beyond the one forced `SMS_AUTH_TOKEN` change.** `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `EMAIL_INBOUND_WEBHOOK_TOKEN`, and `SMS_WEBHOOK_URL` all stay exactly as they are — none of them is read by any adapter's `send()`/`receive()` method (verified live, `## Prerequisites`), so none of them is a "credential reused by channel adapters." Moving them would be widening scope to "every provider-related secret," which the task text does not ask for and which conflates two different security boundaries (an operational send credential vs. a deployment-level webhook shared secret set once in the provider's own console).
- **No multi-account support.** Each model is a `pk=1` singleton — one Email account, one WhatsApp Business number, one Twilio account — matching the backlog's singular "one place to connect channels" and the exact scope every existing adapter already has (each reads exactly one set of ENV values today).

---

## Context — Read These Files First

1. `.squad/stories/integrations/SUPPORTOS-91/intake.md` — one description line, no acceptance criteria, empty `attachments/`. `SupportOs backlog.MD` lines 872-876 (`STORY (INT-3)`) is the same text.
2. `backend/apps/communications/whatsapp_adapter.py` (all 149 lines) — read in full. Lines 4-5 (`import urllib.error`/`urllib.request`), 109-114 (the exact three-field blank-check `send()` refuses to run past), and 125-149 (the `Request`/`urlopen`/`except URLError` shape) are what task 5 keeps byte-for-byte, swapping only where the three values come from.
3. `backend/apps/communications/sms_adapter.py` (all 127 lines) — read in full. Lines 90-96 (the four-field blank-check), 108-127 (the `urlencode`/Basic-Auth/`Request` shape), and `verify_signature` (lines 17-27, unchanged — only its **caller** in `views.py` changes which value it's handed).
4. `backend/apps/communications/email_adapter.py` (all 84 lines) — read in full. Lines 71-84 (`send()`) is what task 4 rewrites; lines 1-10 and 73-74 (`TICKET_TAG_RE`, `receive()`) are untouched.
5. `backend/apps/communications/views.py` lines 185-217 (`SMSInboundWebhookView`) — task 5's second edit. Lines 101-217 in full for context on the sibling `EmailInboundWebhookView`/`WhatsAppInboundWebhookView`, both **untouched** (their tokens are inbound-only, per `## Prerequisites`).
6. `backend/apps/integrations/models.py` (current, post-Story-81) — `ErpConnection` (the `enabled`/`base_url`/`auth_token`/`is_configured`/`clean`/`save`/`delete`/`load` block) is the literal template task 3's three models follow, minus the `enabled` field (see `## Story Goal`) and minus `clean()`'s field-map validation (nothing here needs it).
7. `backend/apps/integrations/serializers.py` — `ErpConnectionSerializer` (the `write_only` credential field + `SerializerMethodField` `has_auth_token` + `update()`'s "blank means leave it alone" override) is the literal template task 4's three serializers follow.
8. `backend/apps/integrations/views.py` — `ErpConnectionView` (`GET`/`PATCH`-only plain `APIView`, `permission_map` keyed by lowercased HTTP method) is the literal template task 6's three views follow. `SchemaView`'s own docstring (same file) is forward context only — this story adds no new drf-spectacular-incompatible response shape, so no equivalent fix is needed here.
9. `backend/apps/integrations/admin.py` — `ErpConnectionAdmin` (`has_add_permission`/`has_delete_permission` both `False`, the "singleton with a lower-level admin fallback beside the UI" reasoning) is the literal template task 8 follows three times.
10. `backend/apps/core/permissions.py` lines 18-40 (`Permissions`, ending `INTEGRATIONS_MANAGE`/`REPORTS_VIEW`) and 43-48 (`ALL_PERMISSIONS`, derived from `vars(Permissions)` — task 1 edits one line, no list).
11. `backend/apps/accounts/migrations/0009_grant_integrations_permission.py` (Story 81's) — task 2's `0010` is structurally identical, targeting `slug="admin"` with the same `.first()` `None`-guard caveat `## Edge Cases` repeats.
12. `backend/config/settings/base.py` lines 339-406 (the `--- Email (COMM-1) ---`, `--- WhatsApp (COMM-2) ---`, `--- SMS (COMM-4) ---` blocks in full, including the Live Chat block sandwiched between WhatsApp and SMS at lines 378-389 — **do not disturb it**) — task 9 removes exactly seven lines across two of these three blocks and touches nothing else in the file.
13. `backend/config/settings/dev.py` (all 11 lines) — confirms `EMAIL_BACKEND` is hardcoded to the console backend here, untouched by this story; the comment at lines 8-10 is the "local dev can never accidentally send a real email" invariant `## Prerequisites` cites.
14. `backend/.env.example` lines 37-60 (the three blocks task 10 edits) and `README.md` lines 600-618 (the matching env-variable table rows task 11 edits) — read both before editing either, since the row text and the `.env.example` comments must stay in sync (§ "Environment variables" own rule: "when you add a variable, add it to the matching `.env.example` **and** the table below in the same commit" — the same rule applies symmetrically to removing one).
15. `frontend/src/features/integrations/` (all of it, post-Story-81) — **the feature this story's frontend clones**, structurally three times over instead of once. `components/ErpSettingsPage.tsx`'s `toDefaults`/`toInput` pair (the "never prefill a write-only credential; a blank value on `PATCH` means leave it" contract) and its `Card`-per-resource layout are what task 17's three form sections follow; `api/{getErpConnection,updateErpConnection,useErpConnection,useUpdateErpConnection}.ts` (4 files, each under 15 lines) are what tasks 15-16 each triple.
16. `frontend/src/app/router.tsx` lines 444-467 (the `settings`/`settings/erp` `RequirePermission` blocks, post-Story-81) — task 19 adds a third sibling block for `settings/channels`.
17. `frontend/src/app/Sidebar.tsx` line 112-122 (`useTranslation([...])` namespace array, post-Story-81 — already carries `'integrations'`) and lines 124-129 (`showAdministration`, already carries `can('integrations.manage')`) and lines 255-268 (the `/settings`/`/settings/erp` `SidebarLink`s) — task 20 extends the namespace array, the visibility gate, and adds a third `SidebarLink`.
18. `frontend/src/shared/i18n/resources.ts` (all ~86 lines, post-Story-81 — already carries the `integrations` pair) — task 22 registers a fourth new namespace, `communications`, the same two-imports-plus-one-line-per-language shape.
19. `CONVENTIONS.md` § 24 (background jobs — **not** relevant here beyond confirming nothing in this story needs a schedule), § 22 (authorization), § 29 (lines ~1983-2027, INT-1's section), and § 30 (lines ~2029-2078, INT-2's section and the current end of the file — task 21 appends § 31 after the current last line and renumbers nothing).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Provider credentials live in the database, not `ENV`, for the three channel adapters.** | Intake ("Provider config models") | `EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig`, each `pk=1`. |
| **The adapters that send outbound messages read the new config, not `settings.*`.** | Intake ("reused by channel adapters") | `EmailAdapter.send`/`WhatsAppAdapter.send`/`SMSAdapter.send`. |
| **Credentials are never returned by the API.** | Intake ("**secure** central config") — same posture INT-1/INT-2 already established | `host_password`/`access_token`/`auth_token` all `write_only`; each serializer exposes only a `has_*` boolean. |
| **A blank credential on `PATCH` leaves the stored one untouched.** | Same "secure config" requirement — a form that cannot display the current secret must not be able to silently wipe it | Each serializer's `update()` pops a blank credential field before calling `super().update()`, the exact `ErpConnectionSerializer.update` pattern. |
| **Only an operator who may manage messaging providers can view or edit any of the three configs.** | § 22 | `Permissions.COMMUNICATIONS_MANAGE` on all three views; granted to `admin` by `accounts/0010`. |
| **One screen shows all three providers.** | Intake outcome ("one place to connect channels") | `/settings/channels` renders all three cards from one page. |
| **Inbound SMS signature verification and outbound SMS sending use the same, single stored Auth Token.** | Correctness requirement forced by Twilio's shared-secret design — verified live, `## Prerequisites` | `SMSInboundWebhookView.post` reads `SmsProviderConfig.load().auth_token`. |

---

## Backend Tasks

### 1 — The permission

**File: `backend/apps/core/permissions.py`** — add one constant to `Permissions`, after `INTEGRATIONS_MANAGE` (added by Story 81) and before `REPORTS_VIEW`:

```python
    COMMUNICATIONS_MANAGE = "communications.manage"
```

`ALL_PERMISSIONS` derives itself from `vars(Permissions)`, so nothing else in this file changes.

---

### 2 — Grant it to `admin`

**Create file: `backend/apps/accounts/migrations/0010_grant_communications_permission.py`** — structurally identical to `0009_grant_integrations_permission.py`:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: this config holds live send credentials for three external
# messaging providers — at least as sensitive as editing a role, the same
# reasoning 0006/0008/0009 record for their own grants. INT-3 (Story 82).
GRANTS = {
    "admin": [Permissions.COMMUNICATIONS_MANAGE],
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
        ("accounts", "0009_grant_integrations_permission"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

Task 1's constant must land **before** this runs — `Role.clean()` rejects any string absent from `ALL_PERMISSIONS`.

---

### 3 — The three config models

**File: `backend/apps/communications/models.py`** — append below `Message` (current end of file, line 55). Extend the import block at lines 1-2 with nothing new (no `ValidationError` needed — none of the three models has a `clean()` this story requires; each is a flat set of scalar fields with no cross-field/allowlist validation the way `ErpConnection.customer_field_map` needed).

```python
class EmailProviderConfig(TimeStampedModel):
    """SMTP credentials for `EmailAdapter.send()` — INT-3.

    A singleton, the same `pk=1`/`load()`/`save()`/`delete()`-no-op shape
    `organization.OrganizationSettings` and `integrations.ErpConnection`
    already establish. Deliberately narrower than the Django-wide
    `EMAIL_*` settings it partially shadows: this row is read **only** by
    `EmailAdapter.send()` (the ticket-reply path). Invite emails
    (`apps.accounts.tasks`), password-reset emails (same module), and
    notification emails (`apps.notifications.tasks`) all continue reading
    `settings.EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_HOST_USER`/
    `EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS` unchanged — confirmed scope
    boundary, see Story 82 `## Prerequisites`.

    `host_password` is stored in plain text and never returned by the API
    (`EmailProviderConfigSerializer` declares it `write_only`) — the same
    posture `ErpConnection.auth_token` (Story 81) takes, for the same
    reason: no encryption library is installed in this project, and
    adding one is a cross-cutting decision, not a per-field one. See
    Story 82 `## Edge Cases`.
    """

    host = models.CharField(_("SMTP host"), max_length=255, blank=True)
    port = models.PositiveIntegerField(_("SMTP port"), default=587)
    host_user = models.CharField(_("SMTP username"), max_length=255, blank=True)
    host_password = models.CharField(_("SMTP password"), max_length=255, blank=True)
    use_tls = models.BooleanField(_("use TLS"), default=True)
    # Deliberately a field of ITS OWN — not a read of `settings.
    # DEFAULT_FROM_EMAIL` — so this config is fully self-contained and a
    # ticket-reply email never silently depends on the Django-wide value
    # invite/reset/notification emails also use.
    default_from_email = models.EmailField(_("from address"), max_length=254, blank=True)

    class Meta:
        verbose_name = _("email provider config")
        verbose_name_plural = _("email provider config")

    def __str__(self) -> str:
        return str(_("Email provider config"))

    def is_configured(self) -> bool:
        return bool(self.host and self.default_from_email)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # Nothing sensible for "delete the email provider config" to mean
        # — the row comes back with defaults on the next `load()`. Same
        # no-op posture `OrganizationSettings.delete`/`ErpConnection.delete`
        # already take.
        pass

    @classmethod
    def load(cls) -> "EmailProviderConfig":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class WhatsAppProviderConfig(TimeStampedModel):
    """Meta WhatsApp Business (Cloud) API credentials for
    `WhatsAppAdapter.send()` — INT-3. Replaces `settings.WHATSAPP_API_BASE_URL`/
    `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` one-for-one; the
    inbound-only `WHATSAPP_WEBHOOK_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET` stay
    ENV settings (`## Prerequisites`) — no adapter code reads either.

    `is_configured()`'s three-field check is the exact condition
    `WhatsAppAdapter.send` already enforced via `settings.*` (Story 15) —
    moved, not changed.
    """

    api_base_url = models.URLField(_("API base URL"), max_length=500, blank=True)
    phone_number_id = models.CharField(_("phone number id"), max_length=100, blank=True)
    access_token = models.CharField(_("access token"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("WhatsApp provider config")
        verbose_name_plural = _("WhatsApp provider config")

    def __str__(self) -> str:
        return str(_("WhatsApp provider config"))

    def is_configured(self) -> bool:
        return bool(self.api_base_url and self.phone_number_id and self.access_token)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        pass

    @classmethod
    def load(cls) -> "WhatsAppProviderConfig":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class SmsProviderConfig(TimeStampedModel):
    """Twilio Programmable Messaging credentials for `SMSAdapter.send()`
    **and** `SMSInboundWebhookView`'s inbound signature check — INT-3.
    Replaces `settings.SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/
    `SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` one-for-one; `SMS_WEBHOOK_URL`
    stays an ENV setting (`## Prerequisites`) — it names a fixed,
    deployment-level URL, not a rotatable credential.

    `auth_token` is deliberately the **one** field two different call
    sites read (`sms_adapter.py::SMSAdapter.send`,
    `views.py::SMSInboundWebhookView.post`) — Twilio's own Auth Token is
    dual-purpose (Basic Auth password for sending, HMAC key for verifying
    `X-Twilio-Signature` on receiving), so this row is the single source
    of truth for both, not two independent fields that could drift apart.
    See Story 82 `## Prerequisites` for the live bug this prevents.
    """

    api_base_url = models.URLField(_("API base URL"), max_length=500, blank=True)
    account_sid = models.CharField(_("account SID"), max_length=100, blank=True)
    auth_token = models.CharField(_("auth token"), max_length=500, blank=True)
    from_number = models.CharField(_("from number"), max_length=40, blank=True)

    class Meta:
        verbose_name = _("SMS provider config")
        verbose_name_plural = _("SMS provider config")

    def __str__(self) -> str:
        return str(_("SMS provider config"))

    def is_configured(self) -> bool:
        return bool(self.api_base_url and self.account_sid and self.auth_token and self.from_number)

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        pass

    @classmethod
    def load(cls) -> "SmsProviderConfig":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj
```

Generate the migration:

```powershell
python manage.py makemigrations communications
```

Expect `apps/communications/migrations/0002_emailproviderconfig_smsproviderconfig_whatsappproviderconfig.py` (Django names it from the three model names; accept whatever it generates and do not hand-edit).

---

### 4 — `EmailAdapter.send()`

**File: `backend/apps/communications/email_adapter.py`** — replace `send()` (current lines 71-84) in full, and extend the import block (lines 1-13):

```python
import re

from django.conf import settings
from django.core.mail import EmailMessage, get_connection

from apps.customers.models import Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import EmailProviderConfig, Message
```

```python
    def send(self, message: Message) -> None:
        customer = message.ticket.customer
        if not customer.email:
            raise ValueError(
                f"Cannot send email for ticket #{message.ticket_id}: "
                "its customer has no email address."
            )
        config = EmailProviderConfig.load()
        if not config.is_configured():
            raise ValueError(
                "Email sending is not configured (set it at /settings/channels)."
            )
        reply_to = (
            f"{settings.EMAIL_INBOUND_LOCAL_PART}+{message.ticket_id}"
            f"@{settings.EMAIL_INBOUND_DOMAIN}"
        )
        # `EMAIL_BACKEND` (console in dev, SMTP in prod) is still read from
        # Django settings — untouched, see Story 82 `## Prerequisites`. Only
        # host/port/username/password/use_tls come from the DB config; the
        # console backend accepts and ignores all five
        # (`django.core.mail.backends.base.BaseEmailBackend.__init__`
        # absorbs arbitrary kwargs), so this call is safe in every
        # environment without branching on which backend is active.
        connection = get_connection(
            host=config.host,
            port=config.port,
            username=config.host_user,
            password=config.host_password,
            use_tls=config.use_tls,
        )
        email = EmailMessage(
            subject=message.ticket.subject,
            body=message.body,
            from_email=config.default_from_email,
            to=[customer.email],
            reply_to=[reply_to],
            connection=connection,
        )
        email.send()
```

`TICKET_TAG_RE`, `receive()`, and the class docstring are unchanged.

---

### 5 — `WhatsAppAdapter.send()` and `SMSAdapter.send()`, plus `SMSInboundWebhookView`

**File: `backend/apps/communications/whatsapp_adapter.py`** — replace the blank-check + URL/headers construction (current lines 109-138) with:

```python
    def send(self, message: Message) -> None:
        config = WhatsAppProviderConfig.load()
        if not config.is_configured():
            raise ValueError(
                "WhatsApp sending is not configured (set it at /settings/channels)."
            )

        contact = ContactDetail.objects.filter(
            customer=message.ticket.customer, channel=ContactDetail.Channel.WHATSAPP
        ).first()
        if contact is None:
            raise ValueError(
                f"Cannot send WhatsApp message for ticket #{message.ticket_id}: "
                "its customer has no WhatsApp contact on file."
            )

        url = f"{config.api_base_url}/{config.phone_number_id}/messages"
        body = json.dumps(
            {
                "messaging_product": "whatsapp",
                "to": contact.value,
                "type": "text",
                "text": {"body": message.body},
            }
        ).encode()
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {config.access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError as exc:
            raise ValueError(
                f"WhatsApp send failed for ticket #{message.ticket_id}: {exc}"
            ) from exc
```

Update the import block: remove `from django.conf import settings` (no longer used anywhere in this file — verify with `grep -n settings apps/communications/whatsapp_adapter.py` after editing; it must return nothing) and add `from .models import Message, WhatsAppProviderConfig` (extending the existing `from .models import Message` line).

**File: `backend/apps/communications/sms_adapter.py`** — replace the blank-check + URL/credentials construction (current lines 90-113) with:

```python
    def send(self, message: Message) -> None:
        config = SmsProviderConfig.load()
        if not config.is_configured():
            raise ValueError("SMS sending is not configured (set it at /settings/channels).")

        contact = ContactDetail.objects.filter(
            customer=message.ticket.customer, channel=ContactDetail.Channel.PHONE
        ).first()
        if contact is None:
            raise ValueError(
                f"Cannot send SMS for ticket #{message.ticket_id}: "
                "its customer has no phone contact on file."
            )

        url = f"{config.api_base_url}/Accounts/{config.account_sid}/Messages.json"
        body = urllib.parse.urlencode(
            {"To": contact.value, "From": config.from_number, "Body": message.body}
        ).encode()
        credentials = base64.b64encode(f"{config.account_sid}:{config.auth_token}".encode()).decode()
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError as exc:
            raise ValueError(f"SMS send failed for ticket #{message.ticket_id}: {exc}") from exc
```

Update the import block: remove `from django.conf import settings` (verify with the same `grep` check — `verify_signature` above it does not use `settings` either) and add `from .models import Message, SmsProviderConfig`.

**File: `backend/apps/communications/views.py`** — in `SMSInboundWebhookView.post` (current lines 200-207), replace:

```python
        if not (settings.SMS_AUTH_TOKEN and settings.SMS_WEBHOOK_URL):
            raise PermissionDenied()
        signature = request.headers.get("X-Twilio-Signature", "")
        params = {key: request.data.get(key, "") for key in request.data}
        if not verify_sms_signature(
            settings.SMS_AUTH_TOKEN, settings.SMS_WEBHOOK_URL, params, signature
        ):
            raise PermissionDenied()
```

with:

```python
        sms_config = SmsProviderConfig.load()
        if not (sms_config.auth_token and settings.SMS_WEBHOOK_URL):
            raise PermissionDenied()
        signature = request.headers.get("X-Twilio-Signature", "")
        params = {key: request.data.get(key, "") for key in request.data}
        if not verify_sms_signature(
            sms_config.auth_token, settings.SMS_WEBHOOK_URL, params, signature
        ):
            raise PermissionDenied()
```

`settings.SMS_WEBHOOK_URL` stays exactly as it is — only the auth-token half of this check moves. Add `SmsProviderConfig` to the existing `from .models import Message` import at the top of `views.py`. `settings` itself stays imported in this file (still used by `EMAIL_INBOUND_WEBHOOK_TOKEN`/`WHATSAPP_WEBHOOK_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/`SMS_WEBHOOK_URL` in the sibling views).

---

### 6 — Serializers

**Create file: `backend/apps/communications/serializers.py` addition** — append below the existing `MessageSerializer` in `apps/communications/serializers.py`. Extend the imports:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig
```

```python
class EmailProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `EmailProviderConfig` row. `host_password`
    is `write_only`, the same posture `ErpConnectionSerializer.auth_token`
    (Story 81) takes; `has_host_password` is what the UI renders instead.
    A blank/omitted `host_password` on `PATCH` leaves the stored value
    untouched (`update` below) — without that, saving any other field
    from a form that cannot display the current password would silently
    wipe it, and the next ticket-reply email would start failing.
    """

    host_password = serializers.CharField(
        max_length=255, required=False, allow_blank=True, write_only=True
    )
    has_host_password = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = EmailProviderConfig
        fields = (
            "id",
            "host",
            "port",
            "host_user",
            "host_password",
            "has_host_password",
            "use_tls",
            "default_from_email",
            "created_at",
            "updated_at",
        )

    def get_has_host_password(self, obj) -> bool:
        return bool(obj.host_password)

    def update(self, instance, validated_data):
        if not validated_data.get("host_password"):
            validated_data.pop("host_password", None)
        return super().update(instance, validated_data)


class WhatsAppProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `WhatsAppProviderConfig` row. Same
    write-only-credential contract as `EmailProviderConfigSerializer`
    above, applied to `access_token`.
    """

    access_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_access_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = WhatsAppProviderConfig
        fields = (
            "id",
            "api_base_url",
            "phone_number_id",
            "access_token",
            "has_access_token",
            "created_at",
            "updated_at",
        )

    def get_has_access_token(self, obj) -> bool:
        return bool(obj.access_token)

    def update(self, instance, validated_data):
        if not validated_data.get("access_token"):
            validated_data.pop("access_token", None)
        return super().update(instance, validated_data)


class SmsProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `SmsProviderConfig` row. Same
    write-only-credential contract, applied to `auth_token` — the same
    field `SMSInboundWebhookView` now also reads (Story 82
    `## Prerequisites`), so a value saved here takes effect for both
    outbound sending and inbound signature verification at once.
    """

    auth_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_auth_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = SmsProviderConfig
        fields = (
            "id",
            "api_base_url",
            "account_sid",
            "auth_token",
            "has_auth_token",
            "from_number",
            "created_at",
            "updated_at",
        )

    def get_has_auth_token(self, obj) -> bool:
        return bool(obj.auth_token)

    def update(self, instance, validated_data):
        if not validated_data.get("auth_token"):
            validated_data.pop("auth_token", None)
        return super().update(instance, validated_data)
```

---

### 7 — Views

**File: `backend/apps/communications/views.py`** — append below the existing view classes (after `WebFormSubmissionView`, end of file). Extend the imports:

```python
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions

from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig
from .serializers import (
    EmailProviderConfigSerializer,
    MessageSerializer,
    SmsProviderConfigSerializer,
    WhatsAppProviderConfigSerializer,
)
```

(`AllowAny`, `IsAuthenticated`, `APIView` may already be imported for the inbound-webhook/live-chat views above — check the existing import block first and extend rather than duplicate; `Permissions` is already imported.)

```python
class EmailProviderConfigView(APIView):
    """The one email provider config record — INT-3. `GET`/`PATCH` only,
    no id in the path, the same singleton shape
    `apps.organization.views.SettingsView`/`apps.integrations.views
    .ErpConnectionView` (Story 81) already establish.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.COMMUNICATIONS_MANAGE,
        "patch": Permissions.COMMUNICATIONS_MANAGE,
    }

    def get(self, request):
        return Response(EmailProviderConfigSerializer(EmailProviderConfig.load()).data)

    def patch(self, request):
        config = EmailProviderConfig.load()
        serializer = EmailProviderConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WhatsAppProviderConfigView(APIView):
    """The one WhatsApp provider config record — INT-3."""

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.COMMUNICATIONS_MANAGE,
        "patch": Permissions.COMMUNICATIONS_MANAGE,
    }

    def get(self, request):
        return Response(WhatsAppProviderConfigSerializer(WhatsAppProviderConfig.load()).data)

    def patch(self, request):
        config = WhatsAppProviderConfig.load()
        serializer = WhatsAppProviderConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SmsProviderConfigView(APIView):
    """The one SMS provider config record — INT-3."""

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.COMMUNICATIONS_MANAGE,
        "patch": Permissions.COMMUNICATIONS_MANAGE,
    }

    def get(self, request):
        return Response(SmsProviderConfigSerializer(SmsProviderConfig.load()).data)

    def patch(self, request):
        config = SmsProviderConfig.load()
        serializer = SmsProviderConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
```

`Response` is already imported at the top of `views.py` (used throughout the existing views).

---

### 8 — Routing

**File: `backend/apps/communications/urls.py`** — extend the `from .views import (...)` block and add three paths. Full replacement:

```python
from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    EmailInboundWebhookView,
    EmailProviderConfigView,
    LiveChatStartView,
    MessageViewSet,
    SMSInboundWebhookView,
    SmsProviderConfigView,
    WebFormCategoriesView,
    WebFormSubmissionView,
    WhatsAppInboundWebhookView,
    WhatsAppProviderConfigView,
)

app_name = "communications"

# SimpleRouter, continuing the precedent apps/tickets/urls.py set (Story 12):
# apps.customers.urls already owns the DefaultRouter-generated root view at
# `/api/`. A third DefaultRouter here would collide the same way a second
# one would have.
router = SimpleRouter()
router.register("messages", MessageViewSet, basename="message")

urlpatterns = [
    path(
        "webhooks/email/inbound/", EmailInboundWebhookView.as_view(), name="email-inbound-webhook"
    ),
    path(
        "webhooks/whatsapp/inbound/",
        WhatsAppInboundWebhookView.as_view(),
        name="whatsapp-inbound-webhook",
    ),
    path("webhooks/sms/inbound/", SMSInboundWebhookView.as_view(), name="sms-inbound-webhook"),
    path("live-chat/start/", LiveChatStartView.as_view(), name="live-chat-start"),
    path("web-form/categories/", WebFormCategoriesView.as_view(), name="web-form-categories"),
    path("web-form/submit/", WebFormSubmissionView.as_view(), name="web-form-submit"),
    # INT-3 (Story 82) — provider config, grouped under one prefix so the
    # three endpoints read as one feature at a glance, matching the "one
    # place to connect channels" outcome.
    path("providers/email/", EmailProviderConfigView.as_view(), name="provider-email"),
    path("providers/whatsapp/", WhatsAppProviderConfigView.as_view(), name="provider-whatsapp"),
    path("providers/sms/", SmsProviderConfigView.as_view(), name="provider-sms"),
    *router.urls,
]
```

Endpoints: `GET|PATCH /api/providers/email/`, `GET|PATCH /api/providers/whatsapp/`, `GET|PATCH /api/providers/sms/`. **No change to `config/api_urls.py`** — `apps.communications.urls` is already included there with no prefix; `apps/README.md`'s "one `include()` per app" rule means this story adds none.

---

### 9 — Django admin

**File: `backend/apps/communications/admin.py`** — extend the import and append three admin classes below the existing `MessageAdmin`:

```python
from django.contrib import admin

from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "direction", "channel", "created_at")
    list_filter = ("direction", "channel")
    search_fields = ("body", "ticket__subject")
    readonly_fields = ("created_at", "updated_at")


@admin.register(EmailProviderConfig)
class EmailProviderConfigAdmin(admin.ModelAdmin):
    """A lower-level fallback beside `/settings/channels` — the same
    both-paths-exist call `ErpConnectionAdmin` (Story 81) documents.
    Adding is disabled: this is a singleton, `load()` creates the one
    row, and an "Add" button would offer a second `save()` would
    silently collapse onto `pk=1`.
    """

    list_display = ("__str__", "host", "default_from_email")
    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(WhatsAppProviderConfig)
class WhatsAppProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "api_base_url", "phone_number_id")
    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(SmsProviderConfig)
class SmsProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "api_base_url", "account_sid", "from_number")
    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
```

---

## Frontend Tasks

### 10 — Types

**Create file: `frontend/src/features/communications/types/providers.ts`**

```ts
/** Mirrors `apps.communications.serializers.EmailProviderConfigSerializer`'s
 *  read shape. `host_password` is absent by design — write-only. */
export type EmailProviderConfig = {
  id: number
  host: string
  port: number
  host_user: string
  has_host_password: boolean
  use_tls: boolean
  default_from_email: string
  created_at: string
  updated_at: string
}

export type EmailProviderConfigInput = {
  host: string
  port: number
  host_user: string
  host_password?: string
  use_tls: boolean
  default_from_email: string
}

export type WhatsAppProviderConfig = {
  id: number
  api_base_url: string
  phone_number_id: string
  has_access_token: boolean
  created_at: string
  updated_at: string
}

export type WhatsAppProviderConfigInput = {
  api_base_url: string
  phone_number_id: string
  access_token?: string
}

export type SmsProviderConfig = {
  id: number
  api_base_url: string
  account_sid: string
  has_auth_token: boolean
  from_number: string
  created_at: string
  updated_at: string
}

export type SmsProviderConfigInput = {
  api_base_url: string
  account_sid: string
  auth_token?: string
  from_number: string
}
```

### 11-16 — API layer

Create twelve files under `frontend/src/features/communications/api/`, each mirroring its `features/integrations/api/{getErpConnection,updateErpConnection,useErpConnection,useUpdateErpConnection}.ts` counterpart (Story 81) — four files per provider, three providers:

- **`providersKeys.ts`** — `export const providersKeys = featureKey('providers')`, shared by all three resources (invalidating `providersKeys.all` after any one save is acceptable — three independent small queries refetching together costs nothing noticeable and keeps this file singular).
- **`getEmailProviderConfig.ts`** — `api.get<EmailProviderConfig>('/providers/email/')`
- **`updateEmailProviderConfig.ts`** — `api.patch<EmailProviderConfig>('/providers/email/', input)`
- **`useEmailProviderConfig.ts`** — `useQuery({ queryKey: providersKeys.resource('email'), queryFn: getEmailProviderConfig })`
- **`useUpdateEmailProviderConfig.ts`** — `useMutation`, `onSuccess` invalidates `providersKeys.all`
- Repeat the same four-file shape for `WhatsappProviderConfig` (`getWhatsAppProviderConfig.ts`/`updateWhatsAppProviderConfig.ts`/`useWhatsAppProviderConfig.ts`/`useUpdateWhatsAppProviderConfig.ts`, hitting `/providers/whatsapp/`) and `SmsProviderConfig` (`getSmsProviderConfig.ts`/`updateSmsProviderConfig.ts`/`useSmsProviderConfig.ts`/`useUpdateSmsProviderConfig.ts`, hitting `/providers/sms/`).

Every file imports `api` from `@/shared/lib/api/client` and never `httpClient`/`fetch` (§ 4).

---

### 17 — The config page

**Create file: `frontend/src/features/communications/components/ChannelSettingsPage.tsx`**

Top-level structure — three independent `QueryBoundary`-wrapped sections, one per provider, each its own form (not one combined form across three resources, matching the three-separate-endpoints decision in `## Story Goal`):

```tsx
export function ChannelSettingsPage() {
  const { t } = useTranslation('communications')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('channels.title')} />
      <EmailProviderSection />
      <WhatsAppProviderSection />
      <SmsProviderSection />
    </div>
  )
}
```

Each `<X>ProviderSection` follows `ErpSettingsPage.tsx`'s `ErpSettingsView` shape exactly (Story 81): a `useQuery`-backed `QueryBoundary`, a `useAppForm` with a Zod schema, `toDefaults`/`toInput` helpers where the credential field always defaults to `''` (never prefilled — the API never returns it) and is stripped from the outbound payload when still blank, a `Card` with `TextField`/`SwitchField` rows, a `description` on the credential field driven by `has_<credential>` (`t('channels.tokenSet')`/`t('channels.tokenUnset')`/`t('channels.tokenKeepHint')`, the same three-key pair `ErpSettingsPage.tsx` uses for `has_auth_token`), `FormErrorSummary` + `SubmitButton`, and a success toast on save (`t('channels.saved')`).

**`EmailProviderSection` schema:**

```ts
const emailSchema = z.object({
  host: optionalString(255).transform((value) => value ?? ''),
  port: positiveInt(65535),
  host_user: optionalString(255).transform((value) => value ?? ''),
  host_password: optionalString(255).transform((value) => value ?? ''),
  use_tls: z.boolean(),
  default_from_email: optionalEmail().transform((value) => value ?? ''),
})
```

`positiveInt`/`optionalEmail`/`optionalString` are all existing helpers in `frontend/src/shared/validation/schemas.ts` — read that file's signatures before writing this schema (Story 81's `ErpSettingsPage.tsx` misused `requiredBoolean()` for a plain toggle field during its own implementation and had to be corrected to `z.boolean()`; use `z.boolean()` for `use_tls` directly, never `requiredBoolean()`, which asserts `z.literal(true)` and would make the switch permanently stuck on).

**`WhatsAppProviderSection` schema:**

```ts
const whatsappSchema = z.object({
  api_base_url: optionalString(500).transform((value) => value ?? ''),
  phone_number_id: optionalString(100).transform((value) => value ?? ''),
  access_token: optionalString(500).transform((value) => value ?? ''),
})
```

Apply the same non-empty-only `z.url()` `superRefine` `ErpSettingsPage.tsx`'s `base_url` field uses (Story 81), reused verbatim, to `api_base_url`.

**`SmsProviderSection` schema:**

```ts
const smsSchema = z.object({
  api_base_url: optionalString(500).transform((value) => value ?? ''),
  account_sid: optionalString(100).transform((value) => value ?? ''),
  auth_token: optionalString(500).transform((value) => value ?? ''),
  from_number: optionalString(40).transform((value) => value ?? ''),
})
```

Same `api_base_url` `z.url()` `superRefine` as WhatsApp.

Every timestamp (`created_at`/`updated_at`, if surfaced at all — these three forms have no history table the way `ErpSettingsPage.tsx` does, so neither is likely to render one) goes through `useFormatters()` if shown; every string comes from `t(...)` (§ 18, § "no hardcoded strings").

---

### 18 — Route

**File: `frontend/src/app/router.tsx`** — add a sibling block after the `settings/erp` block (Story 81, current lines ~457-468):

```tsx
          {
            element: <RequirePermission permission="communications.manage" />,
            children: [
              {
                path: 'settings/channels',
                lazy: async () => {
                  const { ChannelSettingsPage } =
                    await import('@/features/communications/components/ChannelSettingsPage')
                  return { element: <ChannelSettingsPage /> }
                },
              },
            ],
          },
```

Its own `RequirePermission`, matching Story 81's own reasoning for `settings/erp`: `communications.manage` is independent of `settings.manage`/`integrations.manage`, and nesting under either would silently require both.

### 19 — Sidebar

**File: `frontend/src/app/Sidebar.tsx`**

Extend the icon import (currently ending `...PlugIcon, SearchIcon...`) with `MessagesSquareIcon`.

Extend the Administration section's visibility gate (currently `can('settings.manage') || can('integrations.manage')`, Story 81) with `|| can('communications.manage')`.

Extend the `useTranslation([...])` namespace array (currently ending `...'organization', 'integrations', 'reports'`, Story 81) with `'communications'`, inserted after `'integrations'`.

Add a third `SidebarLink`, after the `/settings/erp` one:

```tsx
            <Can permission="communications.manage">
              <SidebarLink
                to="/settings/channels"
                icon={MessagesSquareIcon}
                label={t('communications:channels.navLabel')}
                collapsed={collapsed}
              />
            </Can>
```

### 20 — Locales

**Create `frontend/src/features/communications/locales/en.json`** and **`ar.json`**, one top-level `channels` object: `title`, `navLabel`, `saved`, `tokenSet`, `tokenUnset`, `tokenKeepHint`, plus `email.*`/`whatsapp.*`/`sms.*` sub-objects each with `title` and one key per field (`host`, `port`, `hostUser`, `hostPassword`, `useTls`, `defaultFromEmail` for email; `apiBaseUrl`, `phoneNumberId`, `accessToken` for whatsapp; `apiBaseUrl`, `accountSid`, `authToken`, `fromNumber` for sms), plus `actions.save`. Arabic is a real translation, matching `ar.json`'s existing quality bar in every other feature namespace — never a copy of the English strings.

### 21 — Register the namespace

**File: `frontend/src/shared/i18n/resources.ts`** — two imports (alphabetically, after the `auth`/before `customers` pair — `communications` sorts there) and one line per language block:

```ts
import communicationsAr from '@/features/communications/locales/ar.json'
import communicationsEn from '@/features/communications/locales/en.json'
```

```ts
    communications: communicationsEn,   // in `en`
    communications: communicationsAr,   // in `ar`
```

---

## Documentation Tasks

### 22 — `README.md`

**(a)** Append a `###` subsection after "ERP sync (INT-2)" (Story 81) and before `### Consuming the API from the frontend`:

````markdown
### Messaging provider config (INT-3)

`/settings/channels` (permission `communications.manage`) configures the three outbound
messaging providers `EmailAdapter`/`WhatsAppAdapter`/`SMSAdapter` send through — one screen, three
independent config rows.

| Endpoint | Provider |
|---|---|
| `GET`/`PATCH` `/api/providers/email/` | SMTP host/port/user/password, TLS, from address. |
| `GET`/`PATCH` `/api/providers/whatsapp/` | Meta WhatsApp Business (Cloud) API base URL, phone number id, access token. |
| `GET`/`PATCH` `/api/providers/sms/` | Twilio API base URL, Account SID, Auth Token, from number. |

Each credential field (`host_password`, `access_token`, `auth_token`) is write-only — the API
never returns it, only a `has_*` boolean. Sending `""` or omitting the field on `PATCH` leaves the
stored credential untouched.

**Scope, deliberately:** this config is read only by the three channel adapters' `send()` methods
— not by invite/password-reset email (`apps.accounts.tasks`) or notification email
(`apps.notifications.tasks`), which continue reading the `EMAIL_*` environment variables below
unchanged. An operator using the same SMTP account for both configures it in two places today; see
`CONVENTIONS.md` § 31.

**One coupling worth knowing:** Twilio's Auth Token is dual-purpose — `SmsProviderConfig.auth_token`
is used both by `SMSAdapter.send()` (outbound Basic Auth) and by `SMSInboundWebhookView` (inbound
`X-Twilio-Signature` verification). Rotating it in the UI takes effect for both immediately.
````

**(b)** Remove seven rows from the backend environment-variable table (lines 609-611, 614, 615-617 in the current numbering — re-locate by content, not line number, since Story 81 already shifted lines once): `WHATSAPP_API_BASE_URL`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `SMS_API_BASE_URL`, `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM_NUMBER`. **Keep** `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `SMS_WEBHOOK_URL` exactly as they are, and keep all six `EMAIL_*`/`DEFAULT_FROM_EMAIL` rows plus both `EMAIL_INBOUND_*` rows — update the `EMAIL_HOST` row's Purpose text to append: `" System email only (invite, password reset, notifications) — ticket-reply email now reads its own DB-stored config (INT-3)."` — the same clarifying suffix applied to the `EMAIL_PORT`/`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS`/`DEFAULT_FROM_EMAIL` rows' Purpose text, each shortened to `" System email only — see EMAIL_HOST row."` after the first.

### 23 — `.env.example`

**File: `backend/.env.example`** — in the `# --- WhatsApp (COMM-2) ---` block, remove the `WHATSAPP_API_BASE_URL=`, `WHATSAPP_PHONE_NUMBER_ID=`, `WHATSAPP_ACCESS_TOKEN=` lines, keeping `WHATSAPP_WEBHOOK_VERIFY_TOKEN=` and `WHATSAPP_APP_SECRET=`. In the `# --- SMS (COMM-4) ---` block, remove `SMS_API_BASE_URL=`, `SMS_ACCOUNT_SID=`, `SMS_AUTH_TOKEN=`, `SMS_FROM_NUMBER=`, keeping only `SMS_WEBHOOK_URL=`. Leave the `# --- Email (COMM-1) ---` block untouched in full.

### 24 — `CONVENTIONS.md` § 31

**File: `CONVENTIONS.md`** — append a new section at the end of the file (after § 30, Story 81's). **Do not renumber § 0-§ 30.**

```markdown

---

## 31. Messaging provider config (INT-3)

`INT-3` (Story 82) moves the three outbound channel adapters'
credentials (`apps.communications.{email,whatsapp,sms}_adapter`) from
`ENV`-only settings to a DB-backed singleton per provider
(`EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig`,
`apps/communications/models.py`), each following the `pk=1`/`load()`
shape `organization.OrganizationSettings` and `integrations.ErpConnection`
already established.

**Scope is deliberately narrow: only the three channel adapters' `send()`
methods read this config.** `apps.accounts.tasks` (invite, password
reset) and `apps.notifications.tasks` (notification email) still read
Django's own `EMAIL_*` settings, unchanged — confirmed with the user
during planning. This means an operator using one SMTP account for
everything configures it in two places today. Unifying the two is a
legitimate follow-up; it is not something a future story should assume
already happened just because "messaging provider config" sounds like it
would cover it.

**A credential shared between an adapter's outbound send and a webhook's
inbound verification has exactly one stored value, read by both.**
`SmsProviderConfig.auth_token` is the one example today —
`SMSAdapter.send()` and `SMSInboundWebhookView.post()` both read it,
because Twilio's own Auth Token is genuinely dual-purpose. A future
provider whose API has the same shared-secret design should follow this,
not add two fields that can drift apart. A verification-only secret with
no adapter involvement (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET`, `EMAIL_INBOUND_WEBHOOK_TOKEN`) stays an `ENV`
setting — it is not "a credential reused by a channel adapter."

**Encryption at rest is not implemented, again, on purpose.** `INT-1`
(`ApiKey.hashed_key`, a digest — different case), `INT-2`
(`ErpConnection.auth_token`), and now `INT-3`
(`EmailProviderConfig.host_password`, `WhatsAppProviderConfig
.access_token`, `SmsProviderConfig.auth_token`) all store a live,
replayable credential in a plain `CharField`, `write_only` in its
serializer and never returned by the API. No encryption library is
installed in this project. Adding one is a single cross-cutting decision
that should encrypt all four fields at once — it is not a per-story
choice, and no story should quietly add its own encryption scheme for
just its own field.

**A removed `ENV` setting is removed everywhere at once: `config/settings/base.py`, `.env.example`, and the `README.md` table, in the same
change that removes its last Python reader.** `WHATSAPP_API_BASE_URL`/
`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`/`SMS_API_BASE_URL`/
`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` are the first
settings this project has ever removed rather than added — verified live
that each had zero remaining Python consumers before deletion. An
`ENV`-var removal without checking every consumer first is exactly the
mistake this rule exists to prevent.
```

---

## Edge Cases & Failure Modes

- **Two SMTP configs can now legitimately disagree.** Ticket-reply email uses `EmailProviderConfig` (this story); invite/password-reset/notification email uses `settings.EMAIL_*` (unchanged). An operator who configures only one and expects both to work will be surprised — `README.md`'s new subsection (task 22) and the UI copy both state this plainly rather than let it be discovered as a bug report.
- **A blank `EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig` produces the exact same `ValueError` the adapters already raised via `settings.*`** — `MessageViewSet.perform_create`'s existing `except Exception: logger.exception(...)` (Story 13/14) still catches it, the outbound `Message` row is still committed, and the agent still sees their reply recorded. **No behavior change to this failure path** — only the error message's wording (naming `/settings/channels` instead of an ENV var) changes.
- **`SMSInboundWebhookView` fails closed identically before and after this story** — `if not (sms_config.auth_token and settings.SMS_WEBHOOK_URL): raise PermissionDenied()` is the same fail-closed shape as today, just reading `auth_token` from the DB row instead of `settings.SMS_AUTH_TOKEN`. An unconfigured `SmsProviderConfig` rejects every inbound SMS webhook exactly as an unset `SMS_AUTH_TOKEN` does today.
- **Rotating the SMS Auth Token through the UI takes effect for inbound verification immediately, with no restart** — both `SMSAdapter.send()` and `SMSInboundWebhookView.post()` call `SmsProviderConfig.load()` fresh on every use (no caching), unlike the `settings.*` values, which were fixed at process start. This is a **behavior improvement**, not just a relocation: today, rotating `SMS_AUTH_TOKEN` requires editing `.env` and restarting every process; after this story it requires one `PATCH`.
- **`EmailAdapter.send()`'s `get_connection(...)` call is safe in dev even though the console backend ignores every kwarg it's passed** — verified live (`## Prerequisites`) against the installed Django's `BaseEmailBackend.__init__`. A ticket-reply email in dev still prints to the console exactly as it does today; only the *values* it's constructed with changed source (DB instead of the same-named `EMAIL_HOST` etc., which — see above — remain in `settings.py` for the *other* email paths).
- **Nobody holds `communications.manage` until `accounts/0010` runs**, and only `admin` does afterward (plus superusers, via `permissions_for`'s short-circuit). **In a database where the seeded `admin` role was renamed** (confirmed live in this project's own dev database during Story 80/81's verification — `super_admin`, no `admin` slug), `0010` silently grants nothing — the same `.first()`-returns-`None` caveat `0006`/`0008`/`0009` all carry. Grant it through `/api/roles/<id>/` or `/admin/` there.
- **`makemigrations communications` must be run**, or `config/tests/test_settings.py::MigrationStateTests.test_no_pending_migrations` fails with `Model changes without a migration: ['communications']`.
- **A `port` value outside `1-65535`** is rejected client-side by `positiveInt(65535)` (task 17); server-side, `EmailProviderConfig.port` is a bare `PositiveIntegerField` with no upper bound, so a value above 65535 saved through a non-UI client (curl, the admin) is accepted by the database and only fails the first time `EmailAdapter.send()` actually tries to connect — the same "the model trusts the form, the network call is the real validator" posture `WhatsAppAdapter`/`SMSAdapter` already have for their own URLs.
- **`WhatsAppProviderConfigSerializer`/`SmsProviderConfigSerializer`'s `api_base_url`/similar fields have no format validation beyond `URLField`'s own** (no `z.url()` equivalent server-side) — matching `ErpConnection.base_url`'s identical, already-accepted posture (Story 81): the frontend's `z.url()` `superRefine` is the primary guard, the network call is the final one.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created and no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py makemigrations communications` — generates the one new migration; `python manage.py makemigrations --check --dry-run` then reports nothing pending (`accounts/0010` is hand-written and data-only).
2. `python manage.py migrate`, then `python manage.py check`.
3. `python manage.py test` — must report **54** passing, `MigrationStateTests` included. This story changes neither the envelope renderer nor the exception handler.
4. `ruff format --check .` and `ruff check .` from `backend/` — including confirming `grep -n settings apps/communications/whatsapp_adapter.py apps/communications/sms_adapter.py` returns nothing (the now-unused import removed cleanly; ruff's `F401` unused-import rule would otherwise catch a forgotten one).
5. `python manage.py spectacular` — must still exit 0; the three new endpoints appear, envelope-wrapped by `apps.integrations.schema.envelope_postprocessing_hook` (Story 80) exactly like every other endpoint in the project — no per-story schema work is needed here, unlike Story 80's own `SchemaView`/`OpenApiResponse` fixes, because these three views return a plain serializer body drf-spectacular can already introspect.
6. Real HTTP against all three config endpoints (blank-credential-preserved-on-save, permission gating, `has_*` never leaking a secret) plus a real outbound send through each of the three adapters — Verification Steps 4-11 below. No live Meta/Twilio/SMTP account is required for the config-CRUD half; the send-path half is verified against the same kind of stub the ERP story (81) used, or, for SMTP, Django's own console backend (dev already routes there).
7. `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` from `frontend/`, plus the `en`/`ar` key-set comparison for the new `communications` namespace.
8. A browser walkthrough of `/settings/channels` in both languages — Verification Step 12.

---

## Migration / Rollback

**Two migrations ship:**

| Migration | Kind | Reverse |
|---|---|---|
| `accounts/0010_grant_communications_permission` | Data | Its own `revoke()`. |
| `communications/000N_emailproviderconfig_smsproviderconfig_whatsappproviderconfig` | Schema (three tables) | `migrate communications 0001` — drops all three config rows. Every channel adapter then raises its existing "not configured" `ValueError` on the next send, the same failure mode an unset `ENV` var already produces today. |

**Rollback of the code:** revert the commits, then restore the seven removed `ENV` vars in `.env.example`/`config/settings/base.py`/`README.md` (or `git checkout` those three files to their pre-story state) before reverting the adapter changes — reverting the adapters first, with the `settings.*` reads still gone from `base.py`, would raise `AttributeError` on the very next send attempt. No `pip install`/`npm install` to undo — this story adds no dependency.

**Half-applied states to avoid:**

- **Task 1's constant after task 2's migration** → `Role.clean()` raises `Unknown permissions: communications.manage` on the next role save. Constant first, always.
- **Task 5 (adapters reference the new models) before task 3 (models exist)** → `ImportError` at Django startup. Ship 3, 4, 5, 6, 7, 8 together.
- **Task 5's `whatsapp_adapter.py`/`sms_adapter.py` import edits leaving `from django.conf import settings` in place after removing all `settings.*` reads** → not a runtime error, but a lint failure (`ruff`'s `F401`) and a misleading import; remove it, and re-verify with `grep` per task 5's own instruction, since neither file has any other `settings.*` use to justify keeping it.
- **Task 8 (`urls.py`) before tasks 6-7 (serializers, views) exist** → `ImportError` at Django startup.
- **`.env.example`/`base.py`/README edits (tasks 22-23) landing before the adapters stop reading those settings (task 5)** → `AttributeError: 'Settings' object has no attribute 'WHATSAPP_ACCESS_TOKEN'` on the next WhatsApp/SMS send. Remove the settings only after the adapters no longer read them — the natural order these tasks are numbered in.
- **Frontend tasks 17-19 before task 20/21 (locales + namespace registration)** → every `t('communications:...')` call fails `tsc -b`, the same components-before-locales ordering § 23 already warns about.

---

## Verification Steps

1. **Backend builds and migrates:** from `backend/` with the venv active — `python manage.py makemigrations communications`, `python manage.py migrate`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`. All clean.
2. **Backend gates:** `python manage.py test` reports **54** passing; `ruff format --check .` and `ruff check .` exit 0; `grep -n settings apps/communications/whatsapp_adapter.py apps/communications/sms_adapter.py` (from `backend/`) returns nothing.
3. **Schema still generates:** `python manage.py spectacular --file "$env:TEMP\comm-schema.yaml"` exits 0; confirm `/api/providers/email/`, `/api/providers/whatsapp/`, `/api/providers/sms/` are present and each `2xx` body is envelope-wrapped.
4. **Permission gating.** With `python manage.py runserver` up and a token for a role **without** `communications.manage`:

   ```powershell
   curl.exe -s -w "`n%{http_code}`n" http://127.0.0.1:8000/api/providers/email/ -H "Authorization: Bearer $agentToken"
   ```

   Expect `403 permission_denied`. Repeat with a `communications.manage` holder → `200`, and confirm the body has `has_host_password` and **no** `host_password` key. Repeat for `/api/providers/whatsapp/` (`has_access_token`, no `access_token`) and `/api/providers/sms/` (`has_auth_token`, no `auth_token`).
5. **A credential survives an unrelated save and is never returned.** `PATCH /api/providers/email/ {"host_password":"smtp-secret-1"}` → `200`. `GET` → `has_host_password: true`, no `host_password`. `PATCH {"port": 465}` (no password key) → `200`; in `manage.py shell`, `EmailProviderConfig.load().host_password == "smtp-secret-1"` — unchanged. Repeat the same shape for `access_token` and `auth_token`.
6. **A real outbound email send, through the new config, in dev.** With `EmailProviderConfig` configured (`host`/`default_from_email` non-blank — any values; the console backend ignores connection failures) and a customer with an email address on file, `POST /api/messages/ {"ticket": <id>, "direction": "outbound", "channel": "email", "body": "test"}` as an agent. Confirm the reply's content, `From`, and `Reply-To` (`{EMAIL_INBOUND_LOCAL_PART}+<ticket id>@{EMAIL_INBOUND_DOMAIN}`, unchanged) print to the `runserver` console — the exact same place a ticket-reply email already prints today, confirming `get_connection(...)`'s kwargs did not break the console backend.
7. **An unconfigured provider still fails the same way it does today.** With `WhatsAppProviderConfig` blank, `POST /api/messages/` with `channel: "whatsapp"` → the `Message` row is still created (`201`), and the `runserver` log shows a logged exception naming `/settings/channels` instead of `WHATSAPP_*` — confirming `MessageViewSet.perform_create`'s existing catch-and-log behavior (Story 13/14) is unchanged.
8. **A real WhatsApp/SMS send against a local stub**, following Story 81 Verification Step 8's exact pattern (a ~15-line `http.server` script echoing a `200`). Point `WhatsAppProviderConfig.api_base_url`/`SmsProviderConfig.api_base_url` at it, configure the remaining fields, send an outbound message on each channel, and confirm the stub receives the request with the expected `Authorization` header built from the DB-stored credential (not a stale `ENV` value).
9. **SMS inbound verification uses the DB token.** `PATCH /api/providers/sms/ {"auth_token": "new-token-1"}`. Build a valid Twilio-style signed request using `new-token-1` (reuse `sms_adapter.verify_signature`'s own algorithm from a shell) against `POST /api/webhooks/sms/inbound/` → `201` (or `200` for an empty body). Repeat signed with the **old** token (if any was previously set) → `403 permission_denied`, confirming the inbound view reads the *current* DB value, not a cached or `ENV` one.
10. **The seven removed settings are actually gone.** In `manage.py shell`: `from django.conf import settings; settings.WHATSAPP_API_BASE_URL` → `AttributeError`. Confirm the same for the other six. Confirm `settings.EMAIL_HOST` and `settings.SMS_WEBHOOK_URL` still resolve normally (untouched).
11. **System email is unaffected.** Trigger a password-reset email (`POST /api/auth/password-reset/request/`) and confirm it still sends via `settings.EMAIL_*` exactly as before this story — no dependency on `EmailProviderConfig` at all.
12. **The UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as a `communications.manage` holder:
    - The sidebar Administration section shows the Channels link; `/settings/channels` loads all three cards.
    - Each credential field is empty with a "configured"/"not configured" hint; saving other fields on one card keeps that card's credential (re-check via Step 5).
    - Each `api_base_url`/`host` field rejects a malformed URL client-side before submit.
    - Switch to Arabic: every label, hint, and toast is translated and `dir="rtl"`; no raw string anywhere.
    - Sign in as a role **without** `communications.manage`: the sidebar link is absent and `/settings/channels` is refused by `RequirePermission`.
13. **No hardcoded strings.** From `frontend/`: `Select-String -Path src\features\communications\components\*.tsx -Pattern "'[A-Z][a-z]{3,}"` — only non-user-facing hits.
14. **Frontend gates, in CI order:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all exit 0. Plus the `en`/`ar` key-set comparison for `features/communications/locales`.
15. **Regression:** existing tickets/customers/ERP (Story 81)/API keys (Story 80) screens and endpoints are untouched — walk `/tickets`, `/customers`, `/settings/erp`, `/api-keys` and confirm no change in behavior.

---

## Done Criteria

- [ ] `Permissions.COMMUNICATIONS_MANAGE` (`"communications.manage"`) added; `accounts/0010_grant_communications_permission.py` grants it to `admin` only and reverses cleanly.
- [ ] `EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig` exist in `apps/communications/models.py`, each a `pk=1` singleton (`load()`/`save()`/`delete()`-no-op matching `ErpConnection`), with **no** `enabled` field on any of them; one migration generated and committed.
- [ ] `EmailAdapter.send()` builds its connection via `get_connection(host=, port=, username=, password=, use_tls=)` from `EmailProviderConfig.load()`, still reads `settings.EMAIL_INBOUND_LOCAL_PART`/`DOMAIN` for the reply-to tag unchanged, and no longer reads any other `EMAIL_*` setting.
- [ ] `WhatsAppAdapter.send()`/`SMSAdapter.send()` read `WhatsAppProviderConfig`/`SmsProviderConfig` instead of `settings.WHATSAPP_*`/`SMS_*`; neither file imports `django.conf.settings` any longer (verified by `grep`).
- [ ] `SMSInboundWebhookView.post` reads `SmsProviderConfig.load().auth_token` (not `settings.SMS_AUTH_TOKEN`) while still reading `settings.SMS_WEBHOOK_URL` unchanged (verified by Step 9).
- [ ] `apps/accounts/tasks.py` and `apps/notifications/tasks.py` are **byte-for-byte unchanged** (verified by Step 11) — confirmed scope boundary from `## Prerequisites`.
- [ ] All three credential fields (`host_password`, `access_token`, `auth_token`) are `write_only`, absent from every `GET` response, preserved when blank on `PATCH`, surfaced only as `has_*` booleans (Step 5).
- [ ] Three endpoints live and gated on `communications.manage`: `GET|PATCH /api/providers/{email,whatsapp,sms}/` (Step 4).
- [ ] `WHATSAPP_API_BASE_URL`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`/`SMS_API_BASE_URL`/`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` removed from `config/settings/base.py`, `.env.example`, and the `README.md` table (Step 10); `EMAIL_*`/`WHATSAPP_WEBHOOK_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/`SMS_WEBHOOK_URL` all untouched.
- [ ] `/settings/channels` renders all three provider cards, routed under its **own** `RequirePermission permission="communications.manage"`, with the sidebar link and the Administration-section gate extended.
- [ ] `communications` locale namespace added in both languages, really translated, registered in `resources.ts`; `en`/`ar` key sets match.
- [ ] `README.md` gains the "Messaging provider config (INT-3)" subsection and the env-table edits; `CONVENTIONS.md` gains § 31 with § 0-§ 30 unrenumbered.
- [ ] `python manage.py check`, `python manage.py test` (**54** passing), `python manage.py spectacular` (exit 0), `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all pass.
- [ ] `.squad/plans/integrations/00-overview.md` carries this story's row; `.squad/plans/00-index.md`'s `integrations` NN range includes `82`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 83.**
