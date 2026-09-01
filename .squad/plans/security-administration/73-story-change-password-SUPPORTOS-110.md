# Story 73 — Change Password (Story: SUPPORTOS-110)

## Prerequisites

- **Story 08 completed** (`AUTH-1`, [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md)) — this story's whole premise is that the caller is already authenticated; no token, no email, no anonymous path exists here at all, unlike SEC-5/SEC-7.
- **Story 06/07 completed** (`FORM`, [../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md](../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md), [../internationalization-design-system/07-story-forms-validation-foundation-SUPPORTOS-12.md](../internationalization-design-system/07-story-forms-validation-foundation-SUPPORTOS-12.md)) — `useAppForm`/`TextField`/`FormErrorSummary`/`SubmitButton`, reused unmodified.
- **Story 72 completed:** [72-story-forgot-password-self-service-reset-SUPPORTOS-109.md](72-story-forgot-password-self-service-reset-SUPPORTOS-109.md) (`SEC-7`). Read as the current baseline for `apps/accounts/serializers.py`/`views.py`/`urls.py` and `frontend/src/features/auth/` — this story's own serializer/view/locale namespace all sit beside SEC-5's/SEC-7's, not Story 48's now-stale plan body.
- Verified backend baseline (this session, live): `python manage.py test` reports **54** passing, matching `CONVENTIONS.md` § 16's own citation.
- Verified: `backend/apps/portal/serializers.py:74` (`FeedbackSerializer.validate_ticket`) is the only existing serializer in this codebase that reads `self.context["request"].user` — and it is always instantiated through a `ModelViewSet`'s `get_serializer()`, which auto-injects `context={'request': ..., 'view': ..., 'format': ...}`. This story's `ChangePasswordView` is a plain `APIView` (matching `InviteConfirmView`/`PasswordResetRequestView`/`PasswordResetConfirmView`, none of which read `request` from serializer context), so it is the **first** place in this codebase that must pass `context={"request": request}` explicitly when instantiating a serializer — a standard DRF pattern, not a new mechanism, but genuinely new to this file. See `## Backend Tasks` task 2.
- Verified: `backend/apps/accounts/views.py:121-129` (`MeView`) is the exact `permission_classes = [IsAuthenticated]`, no `authentication_classes` override, precedent this story's `ChangePasswordView` copies — `DEFAULT_AUTHENTICATION_CLASSES` (`JWTAuthentication`, `base.py:267-269`) already applies project-wide, so nothing further needs declaring for authentication itself.

---

## Story Goal

Let a signed-in user change their own password directly — no token, no email, no admin — completing the credential lifecycle SEC-5/SEC-6/SEC-7 built the rest of.

1. **Backend** — `POST /api/auth/change-password/` (current password + new password), `IsAuthenticated` only. Requires the caller's current password even though they already hold a valid session — both an extra confirmation and a real check, since a valid access token alone is not proof the person at the keyboard is the account owner (a left-open or stolen session). Reuses `django.contrib.auth.password_validation.validate_password` and `User.check_password`/`set_password` — the exact same primitives `PasswordResetConfirmSerializer`/`InviteConfirmSerializer` already use, no new hashing or validation mechanism.
2. **Frontend** — `PreferencesPage.tsx` (the personal, ungated settings screen every authenticated user reaches) gains a "Password" card alongside the existing language/theme controls, via a new `ChangePasswordSection` built from `useAppForm`/`TextField` like every other form in this app.

### One verified finding that shapes this story beyond the intake's own wording

**With `request.user` known before field validation even runs (unlike SEC-5/SEC-7's confirm steps, where the user is only resolved during object-level `validate()` after a token lookup), `validate_password` can — and should — be called with `user=request.user`, strengthening `UserAttributeSimilarityValidator` over the precedent it's copying.** `InviteConfirmSerializer.validate_password`/`PasswordResetConfirmSerializer.validate_password` (`serializers.py`) both call `validate_password(value)` with no `user` argument, because in both flows the target user is not known yet at the point the field validator runs (it is resolved afterward, from the token, inside `validate()`). This story's `ChangePasswordSerializer` has no such ordering constraint — `self.context["request"].user` is available from the moment the serializer is instantiated — so `validate_new_password` passes `user=self.context["request"].user` explicitly, letting `AUTH_PASSWORD_VALIDATORS`' `UserAttributeSimilarityValidator` (`base.py:130-143`) actually check the new password against the caller's real email/name, something the two earlier flows structurally could not do. Not a required fix — those flows are unaffected and unchanged — but a real, available improvement this story adopts.

### Explicitly out of scope

- **Rate-limiting `/api/auth/change-password/`.** Considered and deliberately not built: the intake explicitly asks for throttling on SEC-7's request endpoint but says nothing about it here, and the two endpoints have very different attack costs — SEC-7's is fully anonymous (only an email address needed), while this endpoint requires an already-valid, authenticated session (a much higher bar an attacker must already have cleared some other way). See `## Edge Cases`.
- **Invalidating other active sessions/tokens after a password change.** JWT access tokens are stateless and carry no live password-hash check (Story 08's own design) — this story does not add one. See `## Edge Cases`.
- **Rejecting a "new" password identical to the current one.** Not one of `AUTH_PASSWORD_VALIDATORS`, not asked for by the intake — a harmless no-op if it happens. See `## Edge Cases`.
- **An `AuditLog` entry for this action.** Consistent with `InviteConfirmSerializer.save()`/`PasswordResetConfirmSerializer.save()`, neither of which writes one either — `AuditLog` covers an admin acting on *another* account, not a user acting on their own. See `## Story Goal` finding.
- **Automated tests.** Standing policy (`CONVENTIONS.md` § 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-110/intake.md` — one description, two task blocks (change-password endpoint; change-password UI in Preferences), no attachments, no acceptance criteria. Its own "the one credential action that doesn't require a token/email round-trip... belongs beside SEC-7, not folded into it" line is why this is its own story, not a SEC-7 addendum.
2. `backend/apps/accounts/serializers.py` (all 316 lines, current post-SEC-7 state) — `InviteConfirmSerializer` (171-209) and `PasswordResetConfirmSerializer` (239-277) are the exact `token`/`password`-style `Serializer` (not `ModelSerializer`) shape task 1's `ChangePasswordSerializer` follows, including the `validate_password`/`validate`/`save()`-bypasses-`create`/`update` pattern. Note both existing `validate_password` methods call `validate_password(value)` with no `user` — see `## Story Goal`'s own finding for why this story's version differs.
3. `backend/apps/accounts/views.py` (all 408 lines, current post-SEC-7 state) — `MeView` (121-129) is the `IsAuthenticated`-only precedent task 2's `ChangePasswordView` copies exactly. `PasswordResetConfirmView` (101-118) is the closest sibling `APIView` shape (`serializer.is_valid(raise_exception=True)`, `serializer.save()`, `Response(None, status=status.HTTP_200_OK)`) — task 2 copies it, swapping only the permission class and dropping the `authentication_classes: list = []` override (this endpoint needs the caller authenticated, not anonymous).
4. `backend/apps/accounts/urls.py` (all 31 lines) — the `auth/`-prefixed, router-free module every credential endpoint lives in; task 3 adds one more `path()`, following `password-reset/request/`'s exact placement pattern.
5. `backend/apps/portal/serializers.py:67-84` (`FeedbackSerializer.validate_ticket`) — the only existing `self.context["request"].user` read in this codebase; see `## Prerequisites` for why task 1 still needs to pass `context` manually (this precedent's caller is a `ModelViewSet`, which does that automatically; task 2's `APIView` does not).
6. `backend/config/settings/base.py:130-143` (`AUTH_PASSWORD_VALIDATORS`) — the four validators every password-setting path in this app already runs through `validate_password`; unchanged, just now additionally handed `user=` by this story (`## Story Goal` finding). `base.py:233-281` (the `--- DRF ---` block, `REST_FRAMEWORK` dict, including SEC-7's `DEFAULT_THROTTLE_RATES`) — task 2's `ChangePasswordView` deliberately adds **no** entry here; see `## Edge Cases` for why.
7. `frontend/src/app/PreferencesPage.tsx` (all 36 lines, in full) — the entire current file; task 6 adds one more `<Card>`-equivalent sibling (`ChangePasswordSection`) after the existing language/theme `Card`, and extends the import list.
8. `frontend/src/features/auth/components/SetPasswordPage.tsx` (all 118 lines) and `ResetPasswordPage.tsx` (all 118 lines) — the `useAppForm` + two `TextField`s + `FormErrorSummary` + `SubmitButton` shape task 5's `ChangePasswordSection` follows, minus the outer success/invalid-link states (this form stays on-page and resets itself on success instead — a section, not a route).
9. `frontend/src/features/accounts/components/UserFormPage.tsx:189` (`UserEditForm`'s `useToast()`/`toast({ tone: 'success', message: ... })` call) — the exact success-toast shape task 5 copies (this story's form has no separate "success screen" to navigate to, unlike `SetPasswordPage`/`ResetPasswordPage` — the toast plus an in-place reset is the entire success UX).
10. `frontend/src/features/auth/api/confirmPasswordReset.ts` (10 lines) — the exact `api.post<void>(url, input)` shape task 7's `changePassword.ts` copies.
11. `frontend/src/features/auth/locales/en.json`/`ar.json` (both 46 lines, current post-SEC-7 state) — task 8 appends one more top-level object, `changePassword`, after `resetPassword`.
12. `CONVENTIONS.md` § 16 (lines 251-258, no automated tests — the **54** figure verified live this session), § 21 (lines 651-769, Authentication/JWT — the SEC-7 fingerprint-token entry Story 72 appended is what task 4 adds a sibling entry beside; ends line 769, before the `---` at 771).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **A signed-in user can change their own password directly.** | Intake | `POST /api/auth/change-password/`, `IsAuthenticated`. |
| **Require the current password.** | Intake constraint | `ChangePasswordSerializer.validate_current_password` calls `user.check_password(value)`, raising a field error on `current_password` if it fails. |
| **Reuse AUTHZ's existing password-hashing/validation — no new mechanism.** | Intake constraint | `django.contrib.auth.password_validation.validate_password` (same `AUTH_PASSWORD_VALIDATORS`) and `User.set_password`/`check_password` — the exact primitives every other password-setting path in this app already uses. |
| **Through the standard API envelope/error model.** | Intake constraint | `ChangePasswordView` is a plain `APIView` behind `envelope_exception_handler`, unmodified. |
| **One place for every personal account setting, credentials included.** | Intake | `ChangePasswordSection` renders inside `PreferencesPage.tsx`, beside `LanguageSwitcher`/`ThemeToggle` — no new route, no new page. |

---

## Backend Tasks

### 1 — `ChangePasswordSerializer`

**File: `backend/apps/accounts/serializers.py`** — add immediately after `PasswordResetConfirmSerializer` (current lines 239-277), before `AuditLogSerializer`:

```python
class ChangePasswordSerializer(serializers.Serializer):
    """SEC-8's change-password step — the only credential action needing
    no token/email round-trip, since the caller is already authenticated.
    Still requires the caller's current password: a valid access token
    alone is not proof the person at the keyboard is the account owner (a
    left-open or stolen session), and it is the one signal this endpoint
    can check that the other confirm flows have no equivalent for.

    `validate_new_password` passes `user=` to `validate_password` — unlike
    `InviteConfirmSerializer`/`PasswordResetConfirmSerializer` above,
    which cannot, because in both of those flows the target user is only
    resolved during object-level `validate()`, after token verification.
    Here `self.context["request"].user` is known from the start, so
    `UserAttributeSimilarityValidator` gets a real user to compare
    against. See the plan's `## Story Goal`.
    """

    current_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError(_("Current password is incorrect."))
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
```

No new import needed — `validate_password` is already imported at the top of this file (line 4).

---

### 2 — `ChangePasswordView`

**File: `backend/apps/accounts/views.py`**

Extend the existing `from .serializers import (...)` block to include `ChangePasswordSerializer` (alphabetically, first entry, before `AuditLogSerializer`).

Insert immediately after `PasswordResetConfirmView` (current lines 101-118), before `MeView`:

```python
class ChangePasswordView(APIView):
    """SEC-8's change-password step. `IsAuthenticated` only — no
    `authentication_classes` override, unlike every other view in this
    file so far: this is the first credential action that requires the
    caller already be signed in rather than anonymous, the same posture
    `MeView` below already has. Passes `context={"request": request}`
    explicitly when instantiating the serializer — the first plain
    `APIView` in this codebase that needs to (`## Prerequisites`); a
    `ModelViewSet`'s own `get_serializer()` would do this automatically,
    but nothing here is a `ModelViewSet`.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)
```

---

### 3 — Routing

**File: `backend/apps/accounts/urls.py`** — add one `path()`, after `password-reset/confirm/`:

```python
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
```

Extend the `from .views import (...)` block to include `ChangePasswordView` (alphabetically, first entry). Endpoint: `POST /api/auth/change-password/`.

---

## Documentation Tasks

### 4 — Append to `CONVENTIONS.md` § 21

**File: `CONVENTIONS.md`** — append after the existing last entry in § 21 (ends line 769, before the `---` at line 771). Do **not** renumber § 0-§ 27.

```markdown

**A plain `APIView` that needs `request` inside its serializer must pass
`context={"request": request}` explicitly — a `ModelViewSet`'s
`get_serializer()` does this for free, a bare `APIView` does not.**
`ChangePasswordView` (Story 73, `SEC-8`) is the first plain `APIView` in
this codebase whose serializer reads `self.context["request"].user`
(`apps.portal.serializers.FeedbackSerializer.validate_ticket` did this
earlier, but only ever through a `ModelViewSet`'s auto-injected context).
Instantiating the serializer as
`Serializer(data=request.data, context={"request": request})` is the whole
fix — easy to forget once, since every existing `APIView` in
`apps/accounts/views.py` before this story happened to resolve its target
user from a signed token instead of from `request.user` directly, so
none of them needed to.
```

---

## Frontend Tasks

### 5 — `ChangePasswordSection.tsx`

**Create file: `frontend/src/features/auth/components/ChangePasswordSection.tsx`**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { changePassword } from '../api/changePassword'

const schema = z.object({
  current_password: requiredString(128),
  new_password: requiredString(128),
})
type FormValues = z.output<typeof schema>

export function ChangePasswordSection() {
  const { t } = useTranslation('auth')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema,
    defaultValues: { current_password: '', new_password: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => changePassword(values),
    onSuccess: () => {
      toast({ tone: 'success', message: t('changePassword.success') })
      form.reset()
      setFormErrors([])
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('changePassword.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <TextField
              control={form.control}
              name="current_password"
              label={t('changePassword.currentPassword')}
              type="password"
              autoComplete="current-password"
            />
            <TextField
              control={form.control}
              name="new_password"
              label={t('changePassword.newPassword')}
              type="password"
              autoComplete="new-password"
            />
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>
              {t('changePassword.submit')}
            </SubmitButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

A wrong-current-password error (`fields.current_password`) and a weak-new-password error (`fields.new_password`) both attach directly via `applyServerErrors` — this form has fields named exactly `current_password`/`new_password`, matching the backend's snake_case field names one-to-one (`CONVENTIONS.md` § 12), so neither ever lands in the `unattached` fallback.

---

### 6 — Wire into `PreferencesPage.tsx`

**File: `frontend/src/app/PreferencesPage.tsx`** — replace the file in full:

```tsx
import { useTranslation } from 'react-i18next'

import { ChangePasswordSection } from '@/features/auth/components/ChangePasswordSection'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { PageHeader } from '@/shared/ui/PageHeader'

/**
 * A personal-preferences page open to every authenticated user (unlike
 * `/settings`, `features/organization/components/SettingsPage.tsx`, which
 * is an org-admin form gated behind `settings.manage`). Hosts the
 * `LanguageSwitcher`/`ThemeToggle` moved out of `Sidebar.tsx`'s footer
 * (SUPPORTOS-105 task 4) — both components are unchanged, still own their
 * state via `i18n.changeLanguage`/`useTheme()`, zero props either way —
 * plus `ChangePasswordSection` (SEC-8), the one remaining personal
 * account setting this page was missing.
 */
export function PreferencesPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('preferences.title')} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('language.label')}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('theme.label')}</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
      <ChangePasswordSection />
    </div>
  )
}
```

---

### 7 — API layer

**Create file: `frontend/src/features/auth/api/changePassword.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type ChangePasswordInput = { current_password: string; new_password: string }

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return api.post<void>('/auth/change-password/', input)
}
```

---

### 8 — Locale changes

**File: `frontend/src/features/auth/locales/en.json`** — add a new top-level object, after `resetPassword`:

```json
"changePassword": {
  "title": "Password",
  "currentPassword": "Current password",
  "newPassword": "New password",
  "submit": "Change password",
  "success": "Password changed."
}
```

**File: `frontend/src/features/auth/locales/ar.json`** — the identical structural change:

```json
"changePassword": {
  "title": "كلمة المرور",
  "currentPassword": "كلمة المرور الحالية",
  "newPassword": "كلمة المرور الجديدة",
  "submit": "تغيير كلمة المرور",
  "success": "تم تغيير كلمة المرور."
}
```

---

## Edge Cases & Failure Modes

- **A wrong current password is a field error on `current_password`, not a generic 400 and not a 500.** `ChangePasswordSerializer.validate_current_password` raises before `validate_new_password` or `save()` ever run — no partial state, nothing is changed on a failed attempt.
- **A weak or too-short new password is a field error on `new_password`, checked against the caller's actual email/name via `user=`** (`## Story Goal`'s finding) — a strictly stronger check than `InviteConfirmSerializer`/`PasswordResetConfirmSerializer` can perform, since they lack a resolved user at field-validation time.
- **No rate limit on this endpoint — a deliberate, considered decision, not an oversight.** Unlike SEC-7's fully anonymous request endpoint (any caller who knows an email address), this endpoint requires an already-valid, authenticated session — a materially higher attack cost. An attacker who has already stolen a live access token could attempt to brute-force the current password to lock the real owner out permanently, but the same attacker already has full API access as that user for the token's lifetime regardless; the practical marginal risk this specific endpoint adds is narrow, and the intake's own silence on throttling here (contrasted with its explicit ask for SEC-7) reads as a deliberate scope boundary, not an omission.
- **Other active sessions/tokens are not invalidated by a password change.** JWT access tokens are stateless (Story 08's own design) and carry no live password-hash check — a still-valid access token keeps working for its own remaining lifetime after this endpoint succeeds. Not solved here, matching the same accepted-risk posture `CONVENTIONS.md` § 21 already documents for token rotation generally.
- **Submitting a "new" password identical to the current one succeeds — a harmless no-op, not specially rejected.** None of `AUTH_PASSWORD_VALIDATORS` (`base.py:130-143`) checks for this, and the intake does not ask for it.
- **No `AuditLog` row is written.** Consistent with `InviteConfirmSerializer.save()`/`PasswordResetConfirmSerializer.save()`, neither of which writes one either — self-service actions on one's own account are outside `AuditLog`'s scope (admin-on-another-account actions only). See `## Story Goal`.
- **A request with no `Authorization` header (or an expired/invalid access token) is a clean `401 not_authenticated`/`token_not_valid`, not a 500** — `permission_classes = [IsAuthenticated]` is the same, already-proven gate `MeView` uses.
- **`current_password`/`new_password` never leak into a log line or an error `message`.** Both fields are `write_only`; the only place `current_password`'s value is ever used is the `check_password()` comparison, never echoed back or logged.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. No migration ships (no model change).
2. `ruff format --check .` / `ruff check .` on the new and changed Python (`serializers.py`, `views.py`, `urls.py`).
3. `npm run build` — typechecks `ChangePasswordSection.tsx`, `changePassword.ts`, the rewritten `PreferencesPage.tsx`, and every new `t('auth:changePassword...')` key.
4. `npm run lint` (`react/jsx-no-literals` over `ChangePasswordSection.tsx`/the changed `PreferencesPage.tsx`), `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison script (the same one Story 10 Verification Step 4 introduced), run against `frontend/src/features/auth/locales/{en,ar}.json`.
6. Real HTTP against the full change-password flow — wrong current password, weak new password, a successful change, and confirming the old password stops working while the new one logs in — plus a real browser walkthrough in both languages: Verification Steps 4-9 below.

---

## Migration / Rollback

**No schema migration in this story.** No model changes — `User.password` already exists; `ChangePasswordSerializer` reads/writes it through the exact same `check_password`/`set_password` API every other password-setting path in this app already uses.

**Rollback of the code:** revert the commits. No `pip install`/`npm install` — no new dependency.

**Half-applied states to avoid:**

- **Task 2 (`ChangePasswordView` references `ChangePasswordSerializer`) before task 1 (`serializers.py`)** → `ImportError` at Django startup. Ship together.
- **Task 3 (`urls.py`) before task 2 (`views.py`)** → `ImportError` at Django startup (`urls.py` imports `ChangePasswordView`, which would not yet exist). Ship together.
- **Task 6 (`PreferencesPage.tsx` imports `ChangePasswordSection`) before task 5 (`ChangePasswordSection.tsx` exists)** → the import fails, `tsc -b` fails.
- **Task 5 before task 7 (`changePassword.ts`)** → the import fails, `tsc -b` fails.
- **Task 5/6 before task 8 (locale keys)** → every new `t('auth:changePassword...')` call fails `tsc -b`, the same failure mode `CONVENTIONS.md` § 23 already documents for a components-before-locales ordering.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **`en`/`ar` key sets match** for `features/auth/locales` (`## Test Plan` item 5).
4. **A wrong current password is rejected.** Sign in as `admin@supportos.local` to get a token, then:

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/change-password/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"current_password\":\"WrongPassword!\",\"new_password\":\"N3wStr0ngPass!\"}'
   ```

   Expect `400 validation_error`, `fields.current_password`. Confirm `admin@`'s existing password still works via `/api/auth/token/`.
5. **A weak new password is rejected even with the correct current password.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/change-password/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"current_password\":\"<the real current password>\",\"new_password\":\"123\"}'
   ```

   Expect `400 validation_error`, `fields.new_password`.
6. **A valid change succeeds; the old password stops working, the new one logs in.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/change-password/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"current_password\":\"<current>\",\"new_password\":\"N3wStr0ngPass!\"}'
   ```

   Expect `200`. Then `POST /api/auth/token/` with the OLD password → `401 authentication_failed`. Then with `N3wStr0ngPass!` → `200`, a real token pair. (Change it back afterward — via this same endpoint, now that you know it works — to avoid breaking later manual testing sessions.)
7. **No `Authorization` header is a clean 401, not a 500.** Repeat step 6's request with no `Authorization` header → `401 not_authenticated`.
8. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in:
    - `/preferences` shows a "Password" card below the language/theme card.
    - Submitting the wrong current password shows an inline error on that field; nothing navigates away.
    - Submitting a weak new password (correct current) shows an inline error on the new-password field.
    - A valid change shows a success toast and both fields clear; signing out and back in with the new password succeeds.
    - Switch to Arabic: the "Password" card, its labels, and the toast are all translated, `dir="rtl"`.
9. **No hardcoded strings.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\auth\components\ChangePasswordSection.tsx,src\app\PreferencesPage.tsx -Pattern "'[A-Z][a-z]{3,}"
    ```

    Must return only non-user-facing hits.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `ChangePasswordSerializer` exists (`serializers.py`), requires and verifies `current_password` via `check_password`, validates `new_password` via `validate_password(value, user=...)`, and `save()` calls `set_password`/`save(update_fields=["password"])` — no new hashing/validation mechanism.
- [ ] `ChangePasswordView` reachable at `POST /api/auth/change-password/`, `IsAuthenticated` only, passes `context={"request": request}` explicitly to the serializer.
- [ ] No rate limiting added to this endpoint (deliberate — see `## Edge Cases`); no new `Permissions` constant; no new migration of any kind.
- [ ] `ChangePasswordSection.tsx` renders inside `PreferencesPage.tsx` as its own card, using `useAppForm`/`TextField`/`FormErrorSummary`/`SubmitButton` — no new shared form component.
- [ ] `changePassword.ts` posts via the shared `api.post` helper — no second Axios instance, no `fetch()`.
- [ ] `changePassword.*` added to both `auth` locale files; `en`/`ar` key sets match (Verification Step 3).
- [ ] Verified by real HTTP: wrong-current-password rejection (Step 4), weak-new-password rejection (Step 5), a successful change with the old password subsequently failing and the new one succeeding (Step 6), 401 with no `Authorization` header (Step 7).
- [ ] Both languages walk through cleanly in the browser (Step 8); no hardcoded strings (Step 9).
- [ ] `CONVENTIONS.md` § 21 gains the appended `context={"request": ...}`-on-a-plain-`APIView` entry (§ 0-§ 27 unrenumbered).
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story's row; `.squad/plans/00-index.md`'s `security-administration` NN range updated to include `73`.
