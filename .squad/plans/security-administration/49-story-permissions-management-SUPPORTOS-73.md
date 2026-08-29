# Story 49 — Permissions Management (Story: SUPPORTOS-73)

## Prerequisites

- **Story 48 completed:** [48-story-users-roles-admin-SUPPORTOS-72.md](48-story-users-roles-admin-SUPPORTOS-72.md) (SEC-1, implemented and verified). It shipped `UserViewSet`/`RoleViewSet`, `RoleAdminSerializer`, `frontend/src/features/accounts/` (types, api, components, locales), and the `/users`/`/roles` routes and nav — all with `Role.permissions` held **read-only**. This story's own dependency line says so: *"Dependencies: SEC-1."*
- **Story 09 completed:** [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md). `apps/core/permissions.py`'s `Permissions`/`ALL_PERMISSIONS`/`permissions_for`/`HasPermission`, `accounts.Role.clean()`, and `CONVENTIONS.md` § 22 are all unchanged prerequisites this story builds directly on top of.
- **This is the boundary Story 48 deliberately left open.** `apps/accounts/serializers.py:20-25` (`RoleAdminSerializer`'s docstring, current): *"`permissions` and `is_system` stay read-only — editing the permission bundle is SEC-2... `RoleAdmin`'s raw JSON textarea remains the only write path for `permissions` until then."* This story is SEC-2. It makes `permissions` writable; `is_system` and `slug`-on-a-system-role stay exactly as SEC-1 left them — **not** in scope here.
- **`CONVENTIONS.md` § 22 already named the exact validation gap this story fills**, at the time it was only a promise: *"A future `RoleSerializer` that **writes** `permissions` must validate them itself"* (line 798-799, inside the *"`Role.clean()` guards forms, not programmatic writes"* paragraph). Task 1 is that validation.
- Verified backend baseline: `RoleAdminSerializer.Meta.read_only_fields` currently includes `"permissions"` (`apps/accounts/serializers.py:39-42`). `RoleViewSet.permission_map` (`apps/accounts/views.py:114-121`) already gates `update`/`partial_update` on `Permissions.ROLES_MANAGE` — **no viewset change is needed for permission editing to be enforced correctly**; only the serializer needs to stop blocking the field.
- Verified: `Permissions` (`apps/core/permissions.py:18-35`) holds exactly ten constants today: `USERS_VIEW`, `USERS_MANAGE`, `ROLES_MANAGE`, `CUSTOMERS_VIEW`, `CUSTOMERS_MANAGE`, `TICKETS_VIEW`, `TICKETS_MANAGE`, `KNOWLEDGE_BASE_VIEW`, `KNOWLEDGE_BASE_MANAGE`, `PORTAL_ACCESS` — every one shaped `<area>.<action>`. This story adds **no new constant**.
- Verified: no endpoint anywhere exposes the permission vocabulary itself (`ALL_PERMISSIONS`) — grepped `apps/*/views.py` and `apps/*/urls.py`. The role-editing checklist has nothing to render its options from until task 2 adds one.
- Verified live against the running dev server (Story 48's own verification session): `RoleAdminSerializer.validate_slug` and `RoleViewSet.destroy`'s `is_system` guard both work exactly as designed — confirming the pattern task 1's `validate_permissions` follows (a `validate_<field>` method raising `serializers.ValidationError`, landing as a clean `validation_error` field error, not a 500) is proven, not theoretical.

---

## Story Goal

Let an admin change what a role grants — check/uncheck permissions on any role, including the four seeded system roles — through the same `RoleFormPage` Story 48 already shipped, with **no new backend mechanism**: `HasPermission`, `permission_map`, and `Role.clean()`'s validation logic are all reused, not replaced.

1. `RoleAdminSerializer.permissions` becomes writable, validated against `ALL_PERMISSIONS` the same way `Role.clean()` already validates it for the Django-admin path — because DRF does not call model `clean()` (`CONVENTIONS.md` § 22, verified).
2. A new read-only endpoint, `GET /api/permissions/`, returning the full permission vocabulary — what the checklist's options come from. Gated on `roles.manage`: nobody can see the vocabulary without also being able to act on it.
3. `RoleFormPage` gains a grouped checkbox list bound to `permissions: string[]`, on **both** create and edit — a new role can be given permissions immediately, not created empty and edited a second time.

### Editing a system role's permissions is the point, not an exception

**`is_system` continues to protect only `slug` and `destroy`** (Story 48's `validate_slug` and `RoleViewSet.destroy`) — it does **not** extend to `permissions`. The seeded roles' whole reason for existing with a *starting* permission set (`admin`: 3, `manager`: 1, `agent`: 0 at Story 09; more added since by every feature story's grant migration) is so this story's UI can tune them without touching Python. Locking `permissions` on `is_system` roles would make this story's own checklist useless on the four accounts that most need it.

### Two verified risks this story makes real, and deliberately does not guard against

**1. Removing `portal.access` from the `customer` role locks out every portal customer, immediately.** `permissions_for` (`apps/core/permissions.py:45-60`) reads `role.permissions` fresh on every request — there is no caching to delay the effect. This is not a bug; it is the same *"an unmapped action grants; a granted string is real"* philosophy `CONVENTIONS.md` § 22 already applies everywhere else (grant-on-omission is a deliberate risk acceptance, not an oversight). No special-case guard is added for this or any other single permission — the intake does not ask for one, and the project's standing pattern is admin discretion, not the API second-guessing it.

**2. A misconfigured `admin` role that no longer grants `roles.manage` to anyone is recoverable only through a superuser (or Django admin) — the same bootstrap dependency the project has had since Story 09.** `is_superuser` short-circuits `permissions_for` to `ALL_PERMISSIONS` regardless of role (verified, Story 09), so `ziad@email.com`-style superuser accounts can always re-grant `roles.manage` through this same API even after every role loses it. Not a new gap; stated here because this story is what makes it reachable through the UI instead of only through `manage.py shell`.

### The forward constraint `CONVENTIONS.md` § 22 named becomes partly reachable

§ 22's closing paragraph (lines 824-830) says the query-cache-is-not-permission-aware constraint *"is not reachable today, because a role change requires Django admin plus a reload."* This story removes half of that precondition: a role's **permission content** can now change through the UI with no Django admin involved. It does **not** remove the "plus a reload" half — an already-signed-in user holding the edited role still carries a stale `user.permissions` in memory (fetched once at boot/login, per `frontend/src/shared/auth/AuthProvider.tsx`) until their next `/auth/me/` fetch. `queryClient.clear()`-on-role-change is still the named fix and is still not built — this story does not build it either; task 5 updates § 22's wording to describe the mechanism accurately (`## Documentation Tasks`).

### Explicitly out of scope

- **Bulk actions** (select-all-in-area, copy-permissions-from-another-role). The intake does not ask for either; `RoleListPage`/`UserListPage` already carry the project's "no bulk actions" precedent (Story 48).
- **A live push when a role's permissions change.** See the forward-constraint note above.
- **Any change to `UserViewSet`, `UserAdminSerializer`, or the Users screens.** This story is the Role half of `AUTHZ` administration only.
- **Any change to `RoleViewSet`'s `permission_map` or `RoleAdminSerializer.validate_slug`/`is_system` handling.** Both are already correct for this story's needs — verified in `## Prerequisites`.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-73/intake.md` — one task block, **no attachments, no acceptance criteria**. Done Criteria derive from *"Permission config API + UI — Implement role→permission mapping UI enforced by AUTHZ"* and *"Outcome: granular access control."*
2. `backend/apps/accounts/serializers.py` (146 lines) — `RoleAdminSerializer` (lines 20-53), specifically `Meta.read_only_fields` (39-42, task 1 removes `"permissions"` from it) and `validate_slug` (44-53, the exact pattern task 1's `validate_permissions` copies: a `validate_<field>` method, `self.instance` for edit-vs-create, `serializers.ValidationError`).
3. `backend/apps/accounts/models.py` — `Role.clean()` (lines 69-86, read in full): `isinstance(self.permissions, list)` check, then `set(self.permissions) - ALL_PERMISSIONS`, then a translated `ValidationError` naming the unknown strings. Task 1's `validate_permissions` is this logic, verbatim, moved to where DRF actually calls it.
4. `backend/apps/core/permissions.py` — `Permissions` (18-35, all ten constants — this story reads them, adds none), `ALL_PERMISSIONS` (38-42, a `frozenset[str]`), `permissions_for` (45-60, the function that makes permission edits take effect immediately with no cache to invalidate server-side).
5. `backend/apps/core/views.py` (109 lines) — `HealthView` (65-87) and `ApiNotFoundView` (90-109): the two existing plain `APIView`s with no `permission_map` key collision to worry about. Task 2's `PermissionCatalogView` goes between them, following `HealthView`'s shape (a `GET`-only `APIView`, no other HTTP method defined, so anything else 405s via Django's own `http_method_not_allowed` — no `http_method_names` override needed, unlike Story 48's `UserViewSet`).
6. `backend/apps/knowledge_base/views.py:94-111` (`KnowledgeBaseSearchView`) — the existing precedent for a plain `APIView` whose `permission_map` is keyed by lowercased HTTP method (`{"get": Permissions.KNOWLEDGE_BASE_VIEW}`) rather than a DRF `action`. Task 2 copies this exactly, keyed on `Permissions.ROLES_MANAGE`.
7. `backend/apps/accounts/views.py` — `RoleViewSet` (100-134, all of it). **No line in this file changes.** Confirm before starting that `update`/`partial_update` are already mapped to `Permissions.ROLES_MANAGE` (114-121) — that mapping is what enforces this story's whole feature; task 1 only has to stop the serializer from refusing the field.
8. `backend/apps/accounts/admin.py` — `RoleAdmin`'s docstring (lines 7-14): *"`permissions` is still edited here as a raw JSON textarea: a checkbox list over `ALL_PERMISSIONS` is what SEC-2 is for."* Task 4 updates this now that SEC-2 has shipped the checklist elsewhere; the raw JSON textarea itself (`list_display`, `get_readonly_fields`, etc.) is unchanged.
9. `frontend/src/features/accounts/types/role.ts` (19 lines) — `Role.permissions`'s current comment (*"Read-only here — editing this list is SEC-2"*, line 7) is now stale; `RoleInput` (14-18) has no `permissions` field yet. Task 6 fixes both.
10. `frontend/src/features/accounts/components/RoleFormPage.tsx` (131 lines) — the exact file task 8 rewrites. Read all of it: `schema`/`FormValues` (22-33), `EMPTY_DEFAULTS`/`toDefaults`/`toRoleInput` (35-43), the outer `RoleFormPage`/inner `RoleForm` split (47-131), and the `slugDisabled` note (97-100) — the pattern (`is_system` gates one thing, not everything) task 8's checklist explicitly does **not** extend to `permissions`.
11. `frontend/src/features/accounts/components/RoleListPage.tsx` (all of it, ~95 lines) — **no change needed**; its `permissions` column (`t('roles.permissionCount', { count: row.permissions.length })`) already reads live data and needs no edit once the field is writable elsewhere.
12. `frontend/src/features/tickets/api/getAssignableAgents.ts` and `useAssignableAgents.ts` — the precedent for a plain-array (non-`Page<T>`) lookup endpoint consumed from one feature: `api.get<T[]>(url)`, cached under the *consuming* feature's own key factory (`ticketKeys.resource('assignableAgents')`) even though the underlying data is about a different domain. Task 7's `getPermissionCatalog.ts`/`usePermissionCatalog.ts` copy this shape exactly, cached under `roleKeys.resource('catalog')`.
13. `frontend/src/shared/ui/form/CheckboxField.tsx` (all 56 lines) — a **single boolean** field (`field.value: boolean`, `onCheckedChange(checked) => field.onChange(checked === true)`). This story's checklist is **not** built from `CheckboxField` — it binds many checkboxes to one `string[]` field, which `CheckboxField`'s contract cannot express. Task 8 composes `FormField`/`FormItem`/`FormLabel`/`FormMessage` (from `@/shared/ui/primitives/form`, the same primitives `CheckboxField` itself uses) directly with the raw `Checkbox` primitive (`@/shared/ui/primitives/checkbox.tsx`), the same "compose primitives instead of forcing an existing field component" reasoning `CONVENTIONS.md` § 23 already uses for `TicketConversation`.
14. `frontend/src/shared/validation/serverErrors.ts:28-53` (`applyServerErrors`) — note line 33's `known = new Set(Object.keys(form.getValues()))` and line 42's `if (!known.has(field))` fallback. A `validation_error` on `permissions` from task 1's `validate_permissions` **will** attach correctly, because `permissions` is a real key in the form's values (an array, not an object) — `Object.keys` on the form values includes it regardless of its value's shape.
15. `CONVENTIONS.md` § 22 (lines 735-833) — read all of it before task 1. In particular: line 741-751 (the vocabulary/mapping/assignment table, still accurate), line 794-799 (the promise this story keeps), and line 824-830 (the forward constraint task 5 updates).
16. `CONVENTIONS.md` § 23 (lines 834 onward) — the *"A component 'shared across channels/variants' is not automatically a `shared/` component"* entry (around line 1023-1033) is the direct precedent for task 8's checklist staying local to `RoleFormPage.tsx` rather than becoming a new `shared/ui/form/CheckboxListField.tsx`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Role→permission mapping UI enforced by `AUTHZ`.** | Intake | `RoleViewSet.update`/`partial_update` already require `roles.manage` (Story 48); this story only unblocks the serializer field they write through. No new authorization mechanism. |
| **Granular access control.** | Intake, description | Every one of the ten permission strings is independently checkable; there is no "select by area" shortcut that hides the granularity. |
| **The vocabulary is code; the mapping is data.** | § 22 | `ALL_PERMISSIONS` (code) is what the catalog endpoint serves and what `validate_permissions` checks against; `Role.permissions` (data) is what the checklist writes. Neither becomes the other. |
| **A serializer that writes `permissions` must validate it itself.** | § 22 line 798-799 | `RoleAdminSerializer.validate_permissions`, mirroring `Role.clean()` exactly. |
| **`is_system` protects `slug` and delete, not `permissions`.** | Story 48's own design | `validate_slug` and `RoleViewSet.destroy` are untouched; no equivalent guard is added for `permissions`. |
| **The backend owns authorization; the frontend check is UX only.** | § 12, § 22 | The checklist is reachable only via the already-`roles.manage`-gated `/roles/:id/edit` route (Story 48); the API independently re-validates and re-authorizes every write. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — Make `Role.permissions` writable, validated

**File: `backend/apps/accounts/serializers.py`** — two changes to `RoleAdminSerializer`.

Remove `"permissions"` from `read_only_fields`:

```python
class RoleAdminSerializer(BaseModelSerializer):
    """CRUD over `Role` for SEC-1/SEC-2's admin screen. `permissions` is
    writable here — validated against `ALL_PERMISSIONS` the same way
    `Role.clean()` validates it for the Django-admin path (DRF does not call
    model `clean()`, so this serializer must repeat the check; see
    CONVENTIONS.md §22). `is_system` stays read-only — it protects `slug`
    and `destroy` only (see `validate_slug` below and `RoleViewSet.destroy`),
    never `permissions`: editing a system role's grants is this story's
    whole point.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Role
        fields = (
            "id",
            "slug",
            "name",
            "description",
            "permissions",
            "is_system",
            "created_at",
            "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("is_system",)
```

Add `validate_permissions`, right beside the existing `validate_slug`:

```python
    def validate_permissions(self, value):
        """Mirrors `Role.clean()` (apps/accounts/models.py:69-86) for the API
        path — DRF does not call model `clean()`, so a bare `partial_update`
        would otherwise let `permissions` drift from `ALL_PERMISSIONS` with
        no check at all. Deliberately does NOT special-case `is_system`:
        editing a seeded role's permissions is this story's entire purpose.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError(_("Permissions must be a list."))
        unknown = sorted(set(value) - ALL_PERMISSIONS)
        if unknown:
            raise serializers.ValidationError(
                _("Unknown permissions: %(names)s") % {"names": ", ".join(unknown)}
            )
        return value
```

Add `ALL_PERMISSIONS` to the existing import line:

```python
from apps.core.permissions import ALL_PERMISSIONS, permissions_for
```

**No explicit field declaration for `permissions` is needed.** `Role.permissions` is a `models.JSONField(default=list, blank=True)`; DRF's `ModelSerializer` maps `JSONField` → `serializers.JSONField()` automatically and derives `required=False` from `blank=True` — the same "no explicit declaration" derivation already relied on for `role`/`category` elsewhere in this codebase. `validate_permissions` is picked up automatically because DRF's `to_internal_value` looks up `validate_<field_name>` for every field name present, exactly how `validate_slug` already works today (verified live in Story 48's own verification session).

---

### 2 — The permission catalog endpoint

**File: `backend/apps/core/views.py`** — add one view between `HealthView` and `ApiNotFoundView`.

```python
class PermissionCatalogView(APIView):
    """The full permission vocabulary — what SEC-2's role-editing checklist
    renders its options from. Read-only: the mapping itself is written
    through `RoleViewSet.update`/`partial_update` (apps/accounts/views.py),
    never here.

    Gated on `roles.manage`, the same permission that already gates writing
    `Role.permissions` — nobody can see the vocabulary without also being
    able to act on it. Keyed by lowercased HTTP method rather than a DRF
    `action`, the same pattern `KnowledgeBaseSearchView`
    (apps/knowledge_base/views.py:94-111) already established for a plain
    `APIView`. Only `GET` is defined, so any other verb 405s via Django's
    own `http_method_not_allowed` — no `http_method_names` override needed,
    unlike `UserViewSet` (Story 48), which had an action to actively
    disable rather than simply never define.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.ROLES_MANAGE}

    def get(self, request):
        return Response(sorted(ALL_PERMISSIONS))
```

Extend the existing import from `.permissions`:

```python
from .permissions import ALL_PERMISSIONS, HasPermission, Permissions
```

`sorted(...)` — a `frozenset` has no stable iteration order; the checklist's grouping (task 8) depends on a deterministic list so its rendering does not visibly reshuffle between requests.

**File: `backend/apps/core/urls.py`** — one new `path()`, alongside the existing `health/`:

```python
from django.urls import path

from .views import HealthView, PermissionCatalogView

app_name = "core"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("permissions/", PermissionCatalogView.as_view(), name="permissions"),
]
```

`apps/core/urls.py` is already included at `path("", include("apps.core.urls"))` in `config/api_urls.py` — no change there. Endpoint: `GET /api/permissions/`.

---

### 3 — No change to `RoleViewSet`

Confirm and leave untouched: `apps/accounts/views.py:114-121`'s `permission_map` already maps `update`/`partial_update` to `Permissions.ROLES_MANAGE`. That is the entire enforcement mechanism for this story — task 1 only stops the serializer from refusing the field before that permission check would ever matter.

---

### 4 — Tidy the now-outdated admin docstring

**File: `backend/apps/accounts/admin.py`** — `RoleAdmin`'s docstring (lines 7-14) currently frames the raw JSON textarea as the reason SEC-2 exists. Update it to describe SEC-2 as shipped and the textarea as the remaining low-level fallback:

```python
class RoleAdmin(admin.ModelAdmin):
    """`RoleViewSet` (apps.accounts.views) covers create/rename/delete
    (SEC-1) and permission editing through `RoleFormPage`'s checklist
    (SEC-2). `permissions` is still additionally editable here as a raw
    JSON textarea — a lower-level fallback for a value the checklist UI
    cannot yet express (an unknown-but-not-yet-registered string, for
    instance) — and `Role.clean()` still rejects an invalid one with a
    field error either way. See CONVENTIONS.md §22.
    """
```

No behavioural change to any method on the class.

---

## Frontend Tasks

### 5 — Types

**File: `frontend/src/features/accounts/types/role.ts`** — update the stale comment and add the write field:

```ts
/** Mirrors `apps.accounts.serializers.RoleAdminSerializer` verbatim. */
export type Role = {
  id: number
  slug: string
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

/** The write shape. `is_system` is server-managed; `permissions` is
 * writable here as of SEC-2 (Story 49). */
export type RoleInput = {
  slug: string
  name: string
  description: string
  permissions: string[]
}
```

---

### 6 — The permission catalog hook

**Create file: `frontend/src/features/accounts/api/getPermissionCatalog.ts`**

```ts
import { api } from '@/shared/lib/api/client'

// A plain array, not a paginated `Page<T>` — the same shape
// `features/tickets/api/getAssignableAgents.ts` uses for a short, curated,
// non-resource lookup list.
export function getPermissionCatalog(): Promise<string[]> {
  return api.get<string[]>('/permissions/')
}
```

**Create file: `frontend/src/features/accounts/api/usePermissionCatalog.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPermissionCatalog } from './getPermissionCatalog'
import { roleKeys } from './roleKeys'

// Cached under `roleKeys`, not a new key prefix: the catalog exists only to
// serve `RoleFormPage`'s checklist, the same reasoning
// `useAssignableAgents` caches under `ticketKeys` for a lookup that is
// really about users.
export function usePermissionCatalog() {
  return useQuery({
    queryKey: roleKeys.resource('catalog'),
    queryFn: getPermissionCatalog,
  })
}
```

---

### 7 — Locale additions

**File: `frontend/src/features/accounts/locales/en.json`** — `roles.fields.permissions` already exists (Story 48, used by `RoleListPage`'s column header); reuse it as the checklist's field label. Add one new key:

```json
    "permissionsHint": "Changes take effect immediately for anyone holding this role.",
```

placed inside the existing `"roles"` object, alongside `"fields"`.

**File: `frontend/src/features/accounts/locales/ar.json`** — add the matching `"permissionsHint"` key, translated, in the same position.

No other locale keys are needed: the checklist's per-permission labels are the raw permission strings themselves (`"customers.manage"`, etc.) and the area-group headings are computed from those strings (task 8) — both are code identifiers, the same category of content `RoleListPage`'s `slug` column already shows untranslated, not application copy requiring translation. This also means a future story appending a new `Permissions` constant needs **no** matching locale-key addition on either side, preserving `apps/core/permissions.py`'s own *"adding a permission is a two-line change here plus the view that declares it"* low-ceremony promise.

---

### 8 — The permissions checklist in `RoleFormPage`

**File: `frontend/src/features/accounts/components/RoleFormPage.tsx`** — extend the schema, defaults, and payload shaping, and add the checklist section. The create/edit-in-one-component structure (lines 47-63, 65-131) is unchanged; only the pieces below change.

Schema, defaults, and mapping (replaces lines 22-43):

```ts
const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[-a-zA-Z0-9_]+$/),
  name: requiredString(100),
  description: optionalString(255),
  permissions: z.array(z.string()),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { slug: '', name: '', description: undefined, permissions: [] }

function toDefaults(role: Role): FormValues {
  return {
    slug: role.slug,
    name: role.name,
    description: role.description || undefined,
    permissions: role.permissions,
  }
}

function toRoleInput(values: FormValues): RoleInput {
  return {
    slug: values.slug,
    name: values.name,
    description: values.description ?? '',
    permissions: values.permissions,
  }
}

/** `permission.split('.', 1)[0]` for every entry in `catalog`, grouped in
 * catalog order (already sorted server-side) so groups render in a stable
 * order across requests. Assumes every entry is `<area>.<action>` shaped —
 * true for all ten of today's `Permissions` constants. */
function groupByArea(catalog: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const permission of catalog) {
    const area = permission.split('.')[0]
    const existing = groups.get(area)
    if (existing) {
      existing.push(permission)
    } else {
      groups.set(area, [permission])
    }
  }
  return [...groups.entries()]
}

/** "knowledge_base" -> "Knowledge base". A computed transform of a code
 * identifier, not translated copy — see task 7's note on why this and the
 * raw permission strings below need no locale keys. */
function areaLabel(area: string): string {
  const spaced = area.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
```

Inside `RoleForm`, fetch the catalog and gate rendering on it (mirrors `ArticleFormPage`'s `categoriesQuery.isPending ? <Loading /> : <Form>`):

```tsx
  const catalogQuery = usePermissionCatalog()
```

Add the import: `import { usePermissionCatalog } from '../api/usePermissionCatalog'` and `import { Loading } from '@/shared/ui/Loading'`, `import { Checkbox } from '@/shared/ui/primitives/checkbox'`, and `import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/primitives/form'` (the same primitives `CheckboxField.tsx` itself imports).

Wrap the existing `return (...)` JSX so it renders `<Loading />` while the catalog is pending, exactly like `ArticleFormPage`:

```tsx
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'roles.new' : 'roles.edit')}</h1>
      {catalogQuery.isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col gap-4">
                {/* existing slug/name/description TextFields, unchanged */}
              </CardContent>
            </Card>
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('roles.fields.permissions')}</FormLabel>
                  <FormDescription>{t('roles.permissionsHint')}</FormDescription>
                  <div className="flex flex-col gap-4">
                    {groupByArea(catalogQuery.data ?? []).map(([area, permissions]) => (
                      <div key={area} className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">{areaLabel(area)}</h3>
                        {permissions.map((permission) => (
                          <div key={permission} className="flex items-center gap-2">
                            <Checkbox
                              checked={field.value.includes(permission)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked === true
                                    ? [...field.value, permission]
                                    : field.value.filter((p: string) => p !== permission),
                                )
                              }
                            />
                            <span className="font-mono text-sm">{permission}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormErrorSummary errors={formErrors} />
            <Button type="submit" disabled={mutation.isPending}>
              {t('roles.actions.save')}
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
```

**Why `FormField` and not `CheckboxField`, and why local to this file, not a new `shared/ui/form/CheckboxListField.tsx`.** `CheckboxField` binds one boolean; this binds many checkboxes to one `string[]`. `FormField`'s render prop gives `field.value`/`field.onChange` directly, the same primitive `CheckboxField` itself is built on — composing it here is not a shortcut, it is what `CheckboxField` already does, generalised for a list. This has exactly one consumer (`RoleFormPage`), the same reasoning `CONVENTIONS.md` § 23 already applies to `TicketConversation` staying inside `tickets/`: a reuse axis of *handling every permission uniformly on one screen* is not the same as *appearing on multiple screens*.

**A duplicate/typo'd permission string sent by a hand-crafted request is a field error, not a 500.** `validate_permissions` (task 1) returns `validation_error` with `fields: {"permissions": [...]}`, which `applyServerErrors` attaches to the `permissions` field key — `FormMessage` inside this `FormField` renders it, because `permissions` is a real key in `form.getValues()` regardless of its array shape (`serverErrors.ts:33`'s `known` set check).

---

## Documentation Tasks

### 9 — Update `CONVENTIONS.md` § 22's forward constraint

**File: `CONVENTIONS.md`** — the closing paragraph of § 22 (lines 824-830, *"Forward constraint: the query cache is not permission-aware"*) currently says a role change *"is not reachable today, because a role change requires Django admin plus a reload."* That is no longer accurate for permission-content edits. Replace the second sentence:

```markdown
**Forward constraint: the query cache is not permission-aware.** TanStack
Query keys include neither the user nor their role, so if an account's role
— or a role's own permission set — changes while the app is open, cached
results computed under the old permissions persist until refetched — the
same class of constraint § 18 records for language. `queryClient.clear()`
on such an event is the fix; it is not built. A role's permission content
can now change through `RoleFormPage` (Story 49, `SEC-2`) with no Django
admin involved, which makes the "plus a reload" half of this constraint the
only thing still standing between an edit and a stale in-session user.
```

Also update line 798-799's promise (*"A future `RoleSerializer` that **writes** `permissions` must validate them itself"*) to say it is now fulfilled:

```markdown
**`Role.clean()` guards forms, not programmatic writes.** Django runs
`clean()` from `full_clean()`, which `ModelForm` (and so the admin) calls. A
bare `Role.objects.create(permissions=["bogus"])` in a shell or a migration
bypasses it entirely, and DRF serializers do not call model `clean()`
either. `RoleAdminSerializer.validate_permissions` (Story 49, `SEC-2`) is
that independent check for the API path — it repeats `Role.clean()`'s
logic rather than calling it, because the two paths (admin form, API
serializer) have no shared validation entry point in DRF.
```

Do not renumber § 0-§ 26; both edits are in place, within the existing § 22 body.

**File: `CONVENTIONS.md`** § 23 — append one entry after the current last one (the `TicketConversation` "not automatically a `shared/` component" note), documenting the new checklist composition as a worked example for the next feature that needs a multi-select bound to an array field:

```markdown
**A multi-select checklist bound to a `string[]` field composes `FormField`
directly, not a new shared field component, when there is exactly one
consumer.** `RoleFormPage`'s permissions checklist (Story 49, `SEC-2`) binds
many `Checkbox` primitives to one `permissions: string[]` value via
`FormField`'s own render prop — the same primitive `CheckboxField` (a
single-boolean field) is built on, generalised for a list instead of
extracted into a new `shared/ui/form/CheckboxListField.tsx`. The options
themselves are grouped by a computed transform of a code identifier (the
permission string's area prefix), not translated copy — the same category
of content `RoleListPage`'s `slug` column already shows untranslated.
```

**File: `frontend/src/README.md`** — extend § Forms & validation (the section naming `nullableString`/`nullableEmail`, added by Story 48) with one sentence: `RoleFormPage`'s permissions checklist is the project's first form field bound to a `string[]` array via a hand-rolled `FormField` composition rather than one of the shared field components, and points at `CONVENTIONS.md` § 23's new entry.

No change to root `README.md` — no new environment variable, no new error code, no new dependency.

---

## Edge Cases & Failure Modes

- **Editing a system role's permissions is allowed, and is the feature.** `is_system` gates only `slug` (`validate_slug`) and `destroy` (`RoleViewSet.destroy`) — both untouched by this story. Do not add an `is_system` guard to `validate_permissions`; that would make the checklist non-functional on all four seeded roles, the exact accounts this story most needs to tune.
- **Removing `portal.access` from the `customer` role locks out every portal customer immediately, with no confirmation dialog.** Verified: `permissions_for` reads live, no cache. Deliberately unguarded — see `## Story Goal`. If this proves too easy to do by accident in practice, a future story's fix is a confirmation step in the UI, not a backend restriction; not built here because the intake does not ask for it.
- **A role that loses `roles.manage` entirely (held by no account, superusers aside) is recoverable only through a superuser or Django admin.** Not a new gap — the same bootstrap dependency the project has had since Story 09's own admin-account seeding. Verified: `is_superuser` bypasses `permissions_for` unconditionally.
- **`validate_permissions` runs on every write, including a `PATCH` that omits `permissions` entirely** — DRF's partial-update semantics mean an omitted key is simply not validated and the stored value is untouched, the same "omission ≠ clearing" rule `CONVENTIONS.md` § 23 already documents for nullable fields. Clearing every permission from a role means sending `"permissions": []` explicitly, not omitting the key.
- **An already-signed-in user holding the edited role does not see the change until their next `/auth/me/` fetch** (page reload or re-login) — `AuthProvider.tsx` fetches `/auth/me/` only at boot and right after login (Story 09), and this story adds no new fetch trigger. See `## Story Goal`'s forward-constraint note and task 9's `CONVENTIONS.md` § 22 update.
- **The catalog endpoint and the checklist's grouping both assume every permission string is `<area>.<action>`-shaped.** True for all ten constants today (verified by reading `apps/core/permissions.py:18-35` in full). A permission added later with no `.` in it would render as its own single-entry "area" (the whole string) rather than crash — `groupByArea`'s `.split('.')[0]` degrades gracefully, but such a string would also be a naming-convention violation worth catching in code review, not something this story adds a runtime guard for.
- **A hand-crafted request with a `permissions` value that is not a JSON array** (e.g. a single string) — DRF's own `JSONField`/list coercion behaviour aside, `validate_permissions`'s `isinstance(value, list)` check is the backstop, returning a field error rather than an unhandled exception. Mirrors `Role.clean()`'s identical check.
- **The permissions checklist has no search/filter.** Fine at ten entries; worth revisiting once `Permissions` grows enough that scrolling a flat grouped list becomes the bottleneck — not this story's problem to solve pre-emptively, per the project's own "no speculative UI" discipline (Story 10's `## Story Goal`, "Not here, and why").
- **`RoleListPage`'s existing permission-count column needs no code change**, but its *meaning* changes: the count is no longer a fixed number set once at seed time, it is live, admin-editable data as of this story. No `Done Criteria` item exists for "the column looks different" because it does not — only the data behind it now moves.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. This story ships no migration and no model change.
2. `ruff format --check .` / `ruff check .` on the changed Python.
3. `npm run build` — typechecks the extended `RoleInput`, the new `FormValues` shape (with `permissions: string[]`), `groupByArea`'s return type, and the new `t('roles.permissionsHint')` key.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison for the `accounts` namespace, re-run after adding `permissionsHint`.
6. Real HTTP: `validate_permissions` rejecting an unknown string and accepting a valid list; the catalog endpoint's permission gate; a full round trip (check boxes, save, reload the form, confirm persisted) against a system role; and — the story's actual claim — that an `agent@`-role account's *effective* API access changes the moment an admin edits the `agent` role's permissions, with no restart and no cache to clear server-side. See `## Verification Steps`.

---

## Migration / Rollback

**No migration in this story.** `Role.permissions` already exists as a column (Story 09); this is a validation and UI change only.

**Rollback of the code:** revert the commits. No `npm install`/`pip install` — no new dependency.

**Half-applied states to avoid:**

- **Task 1 (serializer) before task 3's confirmation that `RoleViewSet` needs no change** → not actually a risk, since task 3 is a read-only confirmation step, not an edit — listed for completeness only.
- **Task 2 (catalog endpoint) before task 6/8 (frontend hook and checklist)** → `RoleFormPage` would have no options to render; the checklist would sit permanently on `<Loading />`. Ship the endpoint first regardless, since it is harmless with no consumer yet — the same "arm before the first consumer" pattern `BaseModelViewSet` itself followed between Story 02 and Story 09.
- **Task 8 (checklist) before task 7 (locale key)** → `t('roles.permissionsHint')` renders the raw key string instead of failing a build (i18next does not typecheck a missing key the way `AppResources` catches a missing *namespace*) — a runtime-visible but non-fatal gap. Verification Step 12 catches it visually; add the locale key first regardless.
- **Task 1's `read_only_fields` edit removing `"is_system"` by mistake instead of narrowing to it** → would make `is_system` writable through the API, letting a client mark an arbitrary role as system-protected (or worse, unmark a seeded one). Double-check the diff removes only `"permissions"` from the tuple, not the whole line.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **`en`/`ar` key sets match** for the `accounts` namespace, including the new `permissionsHint` key.
4. **The catalog endpoint is gated correctly.** Using accounts from prior verification (`admin@`/`ziad@` — a superuser — and an account holding `users.view` but not `roles.manage`, e.g. `mgr@supportos.local`):

   | Request | no token | account without `roles.manage` | account with `roles.manage` |
   |---|---|---|---|
   | `GET /api/permissions/` | 401 `not_authenticated` | 403 `permission_denied` | 200, a sorted JSON array of all ten strings |

5. **`validate_permissions` rejects an unknown string and accepts a real one.**

   ```powershell
   curl.exe -s -X PATCH http://127.0.0.1:8000/api/roles/<a-non-system-role-id>/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"permissions\":[\"bogus.permission\"]}'
   ```

   Expect `validation_error` naming `bogus.permission` under `fields.permissions`. Then repeat with a real subset (e.g. `["customers.view"]`) — expect 200 and the stored value to match on a follow-up `GET`.
6. **A system role's permissions can be edited; its slug and existence cannot.** `PATCH` a seeded role (e.g. `manager`, id verified live in Story 48's own session) with `{"permissions": ["users.view", "customers.view"]}` — expect 200. Then in the same request set also attempt `{"slug": "renamed"}` — expect the slug-specific `validation_error` from Story 48's `validate_slug`, independent of the permissions change succeeding or not in the same payload (test each separately to isolate).
7. **The actual claim: effective access changes immediately, with no cache to clear.** Using the `agent@supportos.local` account (Story 09/48's test account) and its `agent` role:
   - Confirm current effective access: `GET /api/customers/` as `agent@` — note the response code given `agent`'s current `permissions`.
   - As `admin@`, `PATCH` the `agent` role to remove (or add) `customers.view`.
   - Immediately, with the **same, already-issued** `agent@` access token (no re-login), repeat `GET /api/customers/` — the response code must reflect the **new** permission set. This is the proof that `permissions_for` has no server-side cache to invalidate.
   - Restore `agent`'s original permission set afterward.
8. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as an account with `roles.manage`:
   - `/roles/new` shows the checklist grouped by area, all unchecked; check a few, save; the new role's row in `/roles` shows the right permission count.
   - `/roles/:id/edit` on a seeded role (e.g. `agent`) pre-checks exactly its current permissions; toggling and saving persists (reload the page to confirm, not just the in-memory form state).
   - Switch to Arabic: the field label and hint are translated; the area headings and permission strings are **not** translated (expected — they are code identifiers) and render left-to-right within the RTL layout without breaking it.
9. **No hardcoded application strings introduced.** From `frontend/`:

   ```powershell
   Select-String -Path src\features\accounts\components\RoleFormPage.tsx -Pattern "'[A-Z][a-z]{3,}"
   ```

   Any hit must be inside a comment or a non-JSX context, not a JSX text node.
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `RoleAdminSerializer.permissions` is writable; `is_system` remains the only field still in `read_only_fields` beyond the `BaseModelSerializer` defaults.
- [ ] `RoleAdminSerializer.validate_permissions` rejects a non-list value and any string outside `ALL_PERMISSIONS`, mirroring `Role.clean()`'s logic, and is **not** gated on `is_system`.
- [ ] `GET /api/permissions/` exists (`apps/core/views.py`'s `PermissionCatalogView`, registered in `apps/core/urls.py`), returns a sorted array of all `ALL_PERMISSIONS` strings, and is gated on `roles.manage` (Verification Step 4).
- [ ] `RoleViewSet` and `apps/accounts/views.py` are otherwise **unchanged** — no new permission constant, no migration.
- [ ] `frontend/src/features/accounts/types/role.ts`'s `RoleInput` gains `permissions: string[]`; `Role.permissions`'s stale "Read-only here" comment is removed.
- [ ] `getPermissionCatalog.ts`/`usePermissionCatalog.ts` exist, cached under `roleKeys.resource('catalog')`.
- [ ] `RoleFormPage.tsx`'s schema, defaults, and submit mapping all carry `permissions: string[]`; the checklist renders on **both** create and edit, grouped by area, gated on the catalog query's `isPending` state the same way `ArticleFormPage` gates on its categories query.
- [ ] The checklist is a local `FormField` composition in `RoleFormPage.tsx`, not a new `shared/ui/form/` component, and not built from `CheckboxField`.
- [ ] No new locale keys beyond `roles.permissionsHint` in both `en.json`/`ar.json` — permission strings and area headings are rendered untranslated, by design.
- [ ] Verified by real HTTP: the permission gate table (Step 4); unknown-permission rejection and valid-permission acceptance (Step 5); a system role's permissions editable while its slug/existence stay protected (Step 6); and the load-bearing proof that an already-issued token's effective access changes immediately after an admin edits that account's role, with no restart (Step 7).
- [ ] Both languages walk through cleanly in the UI, including the deliberately-untranslated area/permission labels rendering correctly inside RTL (Step 8).
- [ ] `CONVENTIONS.md` § 22 updated in two places (the `Role.clean()` promise now marked fulfilled; the forward-constraint paragraph reflecting partial reachability) and § 23 gains one appended entry for the `FormField`-based checklist pattern — **appended/edited in place, § 0-§ 26 unrenumbered**.
- [ ] `apps/accounts/admin.py`'s `RoleAdmin` docstring updated to describe the checklist as the primary path and the raw JSON textarea as the remaining fallback.
- [ ] `frontend/src/README.md` § Forms & validation gains one sentence naming the new checklist pattern.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 50 (SEC-3, `SUPPORTOS-74`, Audit Logs — traceability over the exact kind of sensitive change this story just made self-service).**
