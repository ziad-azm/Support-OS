# Story 84 — Role-Based Post-Login Landing (Story: SUPPORTOS-123)

## Prerequisites

- **Story 09 completed:** [09-story-roles-permissions-authorization-SUPPORTOS-27.md](09-story-roles-permissions-authorization-SUPPORTOS-27.md). Verified landed: `AuthUser.role` (`frontend/src/shared/auth/types.ts:15`, `{ slug, name } | null`), populated on `/api/auth/me/` via `UserSerializer`/`RoleSerializer` (`backend/apps/accounts/serializers.py`), and already fetched into `AuthProvider`'s `user` state on boot and on login (`frontend/src/shared/auth/AuthProvider.tsx:31,56`). No backend or `/auth/me/` change is needed for this story — the data this story displays already reaches the client.
- **Scope was narrowed against the intake in this planning session.** The intake (`.squad/stories/authentication-authorization/SUPPORTOS-123/intake.md`) carries only the title, no description, no acceptance criteria, and no backlog entry (`SupportOs backlog.MD` has no `AUTH-3` reference — verified by grep). The user, asked directly, chose to **keep the post-login redirect unchanged** (every authenticated staff user still lands on `/`, the existing `HomePage`) rather than add per-role redirect targets, and to close the gap between the title and current behavior with a **visible role indicator on that landing screen**. See `## Story Goal`.

---

## Story Goal

`frontend/src/app/HomePage.tsx` is the post-login landing screen (`index: true` under `/`, `frontend/src/app/router.tsx:72-77`) and already adapts *what it shows* per permission via `<Can>` (lines 130, 152, 166, 174, 182, 190, 237 — ticket/customer/knowledge-base/reports/users cards each hide when the signed-in role lacks the permission). What it does **not** do today is tell the person which role produced that adaptation.

This story adds one thing: **the signed-in user's role name, shown as a badge next to the greeting on `HomePage`**, sourced from `user.role.name` (already present, no fetch added). Nothing else changes.

**Explicitly out of scope** (decided in this planning session, not inferred):
- **No change to the post-login redirect.** `LoginPage.tsx:32` (`from = ... ?? '/'`) is unchanged; every role still lands on `/`.
- **No reordering or per-role variation of `HomePage`'s sections.** The existing `<Can>` gating is the only per-role behavior.
- **No backend or database change.** `Role` gains no new field; `/api/auth/me/` response shape is unchanged.
- **No i18n key for the role's own name.** `Role.name` (`admin`/`manager`/`agent` seed data — "Admin"/"Manager"/"Agent") is displayed verbatim, matching how `RoleFormPage.tsx:51` and `UserFormPage.tsx:50` already show `role.name` with no translation lookup.

---

## Context — Read These Files First

1. `frontend/src/app/HomePage.tsx` — all 271 lines. `Badge` is already imported (line 21) and used for ticket-status badges (line 253); this story adds a second, unrelated use of the same component. The greeting header is lines 124-127; `user`/`can` come from `useAuth()` at line 100; `name` at line 103 already handles `user` being `null` defensively (`user ? ... : ''`) — follow the same defensive style for `role`.
2. `frontend/src/shared/ui/PageHeader.tsx` — all 20 lines. `PageHeader({ title, action })` renders `title` and `action` side-by-side in a `flex items-center justify-between` row (line 15). `action` is "whatever the caller already wraps" (docstring, line 11) — this story passes the role `Badge` as `action`, not a new prop on `PageHeader` itself.
3. `frontend/src/shared/ui/primitives/badge.tsx` — `badgeVariants` (line 7): `secondary` (line 13) is the neutral, non-status variant — distinct from the semantic `success`/`warning`/`destructive`/`info` variants already spoken for by ticket-status and SLA badges elsewhere in the app. `overflow-hidden whitespace-nowrap` (line 8) is on the shared `badgeVariants` string, not per-variant.
4. `frontend/src/shared/auth/types.ts` — all 31 lines. `AuthRole` (line 2: `{ slug, name }`) and `AuthUser.role: AuthRole | null` (line 15).
5. `frontend/src/shared/i18n/locales/en/common.json:55-57` and `frontend/src/shared/i18n/locales/ar/common.json:59-61` — `home.greeting`/`home.subtitle`, the two keys already used by `HomePage`. No new key is added by this story.
6. `.squad/plans/authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md` § Verification Step 6 — the three dev accounts this story's manual verification reuses (`agent@supportos.local` / role `agent`, `mgr@supportos.local` / role `manager`, `admin@supportos.local` / superuser, `role: null`). Re-run that step's shell command if they no longer exist in the local dev database.

---

## Frontend Tasks

### 1 — Show the signed-in user's role next to the HomePage greeting

**File: `frontend/src/app/HomePage.tsx`**

Replace the header line (line 126):

```tsx
<PageHeader title={t('home.greeting', { name })} />
```

with:

```tsx
<PageHeader
  title={t('home.greeting', { name })}
  action={user?.role ? <Badge variant="secondary">{user.role.name}</Badge> : undefined}
/>
```

No new import — `Badge` is already imported at line 21 and `user` already destructured from `useAuth()` at line 100.

**No badge when `user.role` is `null`.** That covers both the not-yet-assigned case and the superuser case (`admin@supportos.local` is a superuser with `role: null` — Story 09's `## Story Goal`, "Superuser is the one bypass"). Inventing a label such as "Administrator" for that case is **not** done here — `AuthUser` carries no `is_superuser` field (`UserSerializer.fields` omits it, verified in `backend/apps/accounts/serializers.py`), so the frontend has no field-backed way to distinguish "superuser" from "staff user with no role assigned yet" without guessing from the `permissions` array. Showing nothing for `role: null` is the behavior that matches the data actually available.

---

## Edge Cases & Failure Modes

- **`user` is momentarily `null`.** `HomePage` only renders under `RequireAuth` (`router.tsx:70`), so `status` is `'authenticated'` and `user` is set by the time it mounts — but the type is still `AuthUser | null`. `user?.role` degrades to `undefined` → no badge, no crash. Same defensive pattern the existing `name` line (124) already uses.
- **`role: null`** (superuser, or a user created but not yet assigned a role via Django admin — Story 09's admin registration is still the only assignment path pending SEC-1). No badge renders; the header looks exactly as it does today. This is the correct default, not a gap — see task 1's note above.
- **A future SEC-2-created role with a long `name`.** `badgeVariants` sets `overflow-hidden whitespace-nowrap` (`badge.tsx:8`) with no ellipsis, so an unusually long name clips rather than wraps the header row. Acceptable: every other badge in the app today carries short, code-controlled strings (ticket statuses); this is the first badge showing an admin-editable string, and truncation-without-ellipsis is a cosmetic limit worth knowing, not a defect this story fixes.
- **RTL.** `PageHeader`'s `action` slot already renders on the visual trailing side in Arabic for every other page that passes one (buttons, via `<Can>`); this story adds no new RTL-specific logic. Verify with `npm run check:rtl` and by switching languages via `LanguageSwitcher` during manual verification.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added, changed, or removed. Verification is the build/lint gates plus the manual walkthrough in `## Verification Steps`.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build`. Confirms `user?.role` / `AuthRole.name` typecheck against the existing `AuthUser` type with no changes needed there.
2. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`. All exit 0.
3. **Manual, three accounts:** with the backend running (`python manage.py runserver` from `backend/`) and `npm run dev` from `frontend/`:
   - Log in as `agent@supportos.local` → badge reads **"Agent"** next to the greeting.
   - Log in as `mgr@supportos.local` → badge reads **"Manager"**.
   - Log in as `admin@supportos.local` (superuser) → **no badge** renders; header layout is unchanged from before this story.
   - If any of these three accounts no longer exists locally, recreate them with the shell command in Story 09 § Verification Step 6.
4. **Regression:** for each of the three accounts above, confirm `HomePage`'s existing stat tiles, quick-link cards, and the two "what's next" lists are unchanged from current behavior (still gated the same way by `<Can>`, still linking to the same routes).
5. **RTL sanity:** switch language via `LanguageSwitcher` while on `HomePage` as `mgr@supportos.local`; confirm the badge sits on the correct trailing side of the header and does not overlap or wrap the greeting text.

---

## Done Criteria

- [ ] `HomePage.tsx`'s header passes `action={user?.role ? <Badge variant="secondary">{user.role.name}</Badge> : undefined}` to `PageHeader`.
- [ ] No change to `PageHeader.tsx`, `AuthUser`/`AuthRole` types, `/api/auth/me/`, or any backend file.
- [ ] No change to the post-login redirect (`LoginPage.tsx`'s `from` still defaults to `/`).
- [ ] Badge shows "Agent" for `agent@supportos.local`, "Manager" for `mgr@supportos.local`, and does not render for `admin@supportos.local` (superuser, `role: null`).
- [ ] `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0 from `frontend/`.
- [ ] `00-overview.md` updated with this story.
