# Story 54 — Category Management UI (Story: SUPPORTOS-96)

## Prerequisites

- **Story 18 completed** (Categories & Priorities, `SUPPORTOS-33`, [18-story-categories-priorities-SUPPORTOS-33.md](18-story-categories-priorities-SUPPORTOS-33.md)): the `Category` model, `CategoryViewSet` (full CRUD at `/api/categories/`), and permission wiring already exist and ship unchanged. Story 18's own `## Story Goal` explicitly deferred this exact screen: *"No frontend category-management screen ... Categories are managed via `POST/PATCH/DELETE /api/categories/` directly, or Django admin ... the same 'admin handles it until a UI is explicitly asked for' boundary."* This story is that ask.
- No backend model, serializer, or URL changes. One backend docstring is now stale and is corrected in Task 8.

---

## Story Goal

Add a staff-facing CRUD screen so `tickets.manage` users can create, rename, and delete ticket categories without touching Django admin:

1. A list screen at `/categories` showing every category (paginated, sortable by name/created date).
2. A create screen at `/categories/new`.
3. An edit screen at `/categories/:id/edit` (rename only — `Category` has no other editable field).
4. Delete from the list, behind the shared confirm dialog.

**Out of scope**: category descriptions/colors/icons (the `Category` model has only `name` — `backend/apps/tickets/models.py:8-23`), reordering, merging, per-category ticket counts, and any change to `TicketFormPage`'s existing category selector or `TicketListPage`'s existing category filter (both already work against the same `/api/categories/` endpoint and are untouched by this story).

**Access model**: the whole screen (list included) is gated on `tickets.manage`, not `tickets.view`. This mirrors `RoleListPage`/`RoleFormPage` (accounts feature), which gate their entire list+form screens on `roles.manage` alone with no separate "view" tier — there is no precedent in this codebase for a management screen that is readable-but-not-writable by a lesser permission. `TicketListPage`'s and `TicketFormPage`'s read-only use of categories (via `useCategories`, already gated only by whatever gates those pages) is unaffected.

---

## Context — Read These Files First

1. `backend/apps/tickets/models.py:8-23` — `Category` model: only field is `name` (`CharField`, `unique=True`, max 100). Confirms there is nothing else to expose in the form.
2. `backend/apps/tickets/serializers.py:8-11` — `CategorySerializer(BaseModelSerializer)`, `fields = ("id", "name", "created_at", "updated_at")`. Combined with `backend/apps/core/serializers.py:19-20` (`BaseModelSerializer.Meta.read_only_fields = ("id", "created_at", "updated_at")`), `name` is the only writable field — DRF's `ModelSerializer` derives a `UniqueValidator` from `name`'s `unique=True` automatically, so a duplicate name returns `400 {"name": ["category with this name already exists."]}` with no extra backend work.
3. `backend/apps/tickets/views.py:24-45` — `CategoryViewSet`: `permission_map` requires `Permissions.TICKETS_VIEW` (`backend/apps/core/permissions.py:31`) for `list`/`retrieve` and `Permissions.TICKETS_MANAGE` (`backend/apps/core/permissions.py:32`) for `create`/`update`/`partial_update`/`destroy`; `ordering_fields = ("name", "created_at")`; `search_fields = ("name",)`.
4. `backend/apps/tickets/urls.py:14-18` — `router.register("categories", CategoryViewSet, basename="category")` on a `SimpleRouter`. Endpoint is already live at `/api/categories/`; nothing to add here.
5. `backend/apps/tickets/admin.py:15-19` — `CategoryAdmin`'s docstring says *"Also the de facto category-management UI for now — this story ships no frontend CRUD screen for categories."* This is the sentence Task 8 corrects.
6. `frontend/src/features/tickets/types/category.ts:1-11` — current `Category` type (`id`, `name`, `created_at`, `updated_at`), no write-shape type yet. Task 1 adds `CategoryInput`.
7. `frontend/src/features/tickets/api/getCategories.ts:1-11` and `useCategories.ts:1-12` — the existing **unpaginated, fixed `page_size: 100`** fetch used only by `TicketFormPage`'s selector and `TicketListPage`'s filter dropdown (query key `ticketKeys.resource('categories')`, i.e. `['tickets', 'categories']`). Leave both files unchanged; the new list screen gets its own paginated fetch (Task 2) so the dropdown's cache and the admin list's cache stay independent while still sharing an invalidation prefix (see Task 2).
8. `frontend/src/features/tickets/api/ticketKeys.ts:1-3` — `export const ticketKeys = featureKey('tickets')`.
9. `frontend/src/shared/lib/api/queryKeys.ts:1-13` — `featureKey`: `resource(name, ...rest)` builds `[feature, resource, ...rest]`. React Query's `invalidateQueries({ queryKey })` matches by array **prefix**, so invalidating `['tickets', 'categories']` also invalidates `['tickets', 'categories', 'list', {...}]` and `['tickets', 'categories', 'detail', id]` — this is how Task 2's mutations refresh the existing dropdown query too.
10. **Precedent — read the whole Role CRUD slice, the closest existing analog (a simple named resource, full CRUD, permission-gated, no "view-only" tier):**
    - `frontend/src/features/accounts/components/RoleListPage.tsx:1-102` — `DataTable` + `useServerTable` + `useConfirm` + `Can`/`PageHeader`/`Empty` wiring. Category's list is simpler: no `is_system` distinction, no permissions-count column.
    - `frontend/src/features/accounts/components/RoleFormPage.tsx:1-218` — one component for create+edit (`RoleFormPage` dispatches on `useParams().id`), `useAppForm`+`zod` schema, `applyServerErrors`/`isValidationError`/`FormErrorSummary` for server-side field errors, `toast` + `navigate` on success. Category's form is simpler still: one `TextField`, no `usePermissionCatalog`/checkbox-group section, no `slugDisabled`-style conditional.
    - `frontend/src/features/accounts/api/createRole.ts`, `updateRole.ts` (PATCH, not PUT), `deleteRole.ts`, `getRoles.ts` (`RoleListParams = ServerTableParams & { search?: string }`), `getRole.ts`, `useRole.ts`, `useRoles.ts`, `useRoleMutations.ts` (one `useInvalidateRoles()` helper reused by all three mutations), `roleKeys.ts`.
    - `frontend/src/features/accounts/types/role.ts:1-21` — the `Role`/`RoleInput` split this story mirrors as `Category`/`CategoryInput`.
11. `frontend/src/shared/ui/data-table/useServerTable.ts:1-41` — `ServerTableParams = { page, page_size?, ordering? }`; `useServerTable({ initialSort })` returns `{ sort, setSort, setPage, params }`.
12. `frontend/src/shared/ui/data-table/types.ts:1-25` — `ColumnDef<T>` shape (`id`, `header`, `cell`, `sortable?`, `align?`); `id` must match the backend field name when `sortable: true`.
13. `frontend/src/shared/lib/api/types.ts:70-73` — `Page<T> = { items: T[]; pagination: ApiPagination }`, returned by `api.getPage<T>(url, { params })`.
14. `frontend/src/shared/validation/schemas.ts:11-13` — `requiredString(max = 255)`: `z.string().trim().min(1).max(max)`.
15. `frontend/src/shared/hooks/useFormatters.ts:7-23` — `useFormatters().date(value)` for the `created_at` column, same call `TicketListPage.tsx:43` and `:127` already make.
16. `frontend/src/shared/auth/RequirePermission.tsx:1-31` — a permission miss redirects to `/` (`replace`), there is no dedicated "403" page; verify this behavior rather than assuming a different one.
17. `frontend/src/shared/auth/Can.tsx:1-23` — `<Can permission="..."> children </Can>`, renders nothing (or `fallback`) when the permission is absent.
18. `frontend/src/app/router.tsx:96-142` — the `tickets.view`-gated route block (list/new/detail/edit ordering: `tickets/new` and `tickets/my-tickets` are registered **before** `tickets/:id` so the literal segment isn't swallowed by the param route). `frontend/src/app/router.tsx:266-295` — the `roles.manage`-gated block, the closest structural precedent for this story's new block (list + `new` before `:id/edit`, single permission gate for all three routes).
19. `frontend/src/app/Sidebar.tsx:1-17` (icon imports from `lucide-react`), `:74-84` (`useTranslation` namespace array — must add `'tickets'`'s already-included, no new namespace needed), `:128-141` (`<Can permission="tickets.view">` wrapping the two existing ticket links), `:176-183` (`<Can permission="roles.manage">` block — the pattern to copy for a new `tickets.manage`-gated block).
20. `frontend/src/features/tickets/locales/en.json` and `ar.json` (both 161 lines) — existing `fields.category`/`filters.category`/`filters.allCategories` keys already there; add a new top-level `categories` object to both, same key set, keeping en/ar in lockstep (project has no automated i18n key-parity script — verify by manual diff, per Task 7).

---

## Frontend Tasks

### 1 — `Category`/`CategoryInput` types

**File: `frontend/src/features/tickets/types/category.ts`**

Add the write shape next to the existing read shape:

```ts
/** The write shape. `id`/`created_at`/`updated_at` are server-managed
 * (`BaseModelSerializer.Meta.read_only_fields`) — the only writable field
 * is `name`. */
export type CategoryInput = {
  name: string
}
```

### 2 — Category management API layer

Leave `getCategories.ts`/`useCategories.ts` untouched. Add six new files.

**Create file: `frontend/src/features/tickets/api/getCategoryList.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Category } from '../types/category'

export type CategoryListParams = ServerTableParams

export function getCategoryList(params: CategoryListParams): Promise<Page<Category>> {
  return api.getPage<Category>('/categories/', { params })
}
```

**Create file: `frontend/src/features/tickets/api/useCategoryList.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getCategoryList } from './getCategoryList'
import type { CategoryListParams } from './getCategoryList'
import { ticketKeys } from './ticketKeys'

export function useCategoryList(params: CategoryListParams) {
  return useQuery({
    queryKey: ticketKeys.resource('categories', 'list', params),
    queryFn: () => getCategoryList(params),
  })
}
```

**Create file: `frontend/src/features/tickets/api/getCategory.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Category } from '../types/category'

export function getCategory(id: number): Promise<Category> {
  return api.get<Category>(`/categories/${id}/`)
}
```

**Create file: `frontend/src/features/tickets/api/useCategory.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getCategory } from './getCategory'
import { ticketKeys } from './ticketKeys'

export function useCategory(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.resource('categories', 'detail', id),
    queryFn: () => getCategory(id),
    enabled: options?.enabled,
  })
}
```

**Create file: `frontend/src/features/tickets/api/createCategory.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Category, CategoryInput } from '../types/category'

export function createCategory(input: CategoryInput): Promise<Category> {
  return api.post<Category>('/categories/', input)
}
```

**Create file: `frontend/src/features/tickets/api/updateCategory.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Category, CategoryInput } from '../types/category'

// PATCH, not PUT — matches `updateRole.ts`.
export function updateCategory(id: number, input: CategoryInput): Promise<Category> {
  return api.patch<Category>(`/categories/${id}/`, input)
}
```

**Create file: `frontend/src/features/tickets/api/deleteCategory.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function deleteCategory(id: number): Promise<void> {
  return api.delete(`/categories/${id}/`)
}
```

**Create file: `frontend/src/features/tickets/api/useCategoryMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCategory } from './createCategory'
import { deleteCategory } from './deleteCategory'
import { updateCategory } from './updateCategory'
import { ticketKeys } from './ticketKeys'
import type { CategoryInput } from '../types/category'

// Invalidating the bare `ticketKeys.resource('categories')` prefix (see
// Context #9) refreshes the admin list, any open detail query, AND the
// unrelated `useCategories()` dropdown query in one call.
function useInvalidateCategories() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ticketKeys.resource('categories') })
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory(id: number) {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (input: CategoryInput) => updateCategory(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
  })
}
```

### 3 — `CategoryListPage`

**Create file: `frontend/src/features/tickets/components/CategoryListPage.tsx`**

Mirror `RoleListPage.tsx` structure exactly, dropped to Category's single field. No `is_system`-style badge branch (every category is deletable) and no inner `<Can>` on the actions column (the whole page is already gated at the route level, per `## Story Goal`):

```tsx
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useDeleteCategory } from '../api/useCategoryMutations'
import { useCategoryList } from '../api/useCategoryList'
import type { Category } from '../types/category'

export function CategoryListPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const query = useCategoryList(params)
  const deleteMutation = useDeleteCategory()

  async function handleDelete(category: Category) {
    const confirmed = await confirm({
      title: t('categories.delete.title'),
      description: t('categories.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(category.id)
  }

  const columns: readonly ColumnDef<Category>[] = [
    {
      id: 'name',
      header: t('categories.fields.name'),
      sortable: true,
      cell: (row) => <Link to={`/categories/${row.id}/edit`}>{row.name}</Link>,
    },
    {
      id: 'created_at',
      header: t('categories.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'actions',
      header: t('categories.fields.actions'),
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
          {t('categories.actions.delete')}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('categories.title')}
        action={
          <Button asChild>
            <Link to="/categories/new">
              <PlusIcon />
              {t('categories.new')}
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('categories.title')}
        empty={<Empty title={t('categories.empty')} description={t('categories.emptyDescription')} />}
      />
    </div>
  )
}
```

### 4 — `CategoryFormPage`

**Create file: `frontend/src/features/tickets/components/CategoryFormPage.tsx`**

Mirror `RoleFormPage.tsx`'s create/edit-dispatch shape, dropped to one field and no `usePermissionCatalog`/checkbox section:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCategory } from '../api/useCategory'
import { useCreateCategory, useUpdateCategory } from '../api/useCategoryMutations'
import type { Category, CategoryInput } from '../types/category'

const schema = z.object({
  name: requiredString(100),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { name: '' }

function toDefaults(category: Category): FormValues {
  return { name: category.name }
}

function toCategoryInput(values: FormValues): CategoryInput {
  return { name: values.name }
}

/** One component for both create and edit, per `RoleFormPage`'s pattern
 * (CONVENTIONS.md §20) — the field set is identical between modes. */
export function CategoryFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const categoryQuery = useCategory(id, { enabled: isEdit })

  if (!isEdit) {
    return <CategoryForm mode="create" />
  }

  return (
    <QueryBoundary query={categoryQuery}>
      {(category) => <CategoryForm mode="edit" id={id} category={category} />}
    </QueryBoundary>
  )
}

function CategoryForm({
  mode,
  id,
  category,
}: {
  mode: 'create' | 'edit'
  id?: number
  category?: Category
}) {
  const { t } = useTranslation('tickets')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: category ? toDefaults(category) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toCategoryInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'categories.created' : 'categories.updated'),
        })
        navigate('/categories')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {t(mode === 'create' ? 'categories.new' : 'categories.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField control={form.control} name="name" label={t('categories.fields.name')} />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('categories.actions.save')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
```

Verify `useAppForm`/`TextField`/`FormErrorSummary`'s exact export names from `frontend/src/shared/ui/form` before wiring the import — `RoleFormPage.tsx:19` imports all three from that one module; use the same import line.

### 5 — Routing

**File: `frontend/src/app/router.tsx`** — add a new block. Insert it as a sibling of the `roles.manage` block (after `frontend/src/app/router.tsx:295`'s closing `},` and before the `audit_log.view` block at `:296-308`), matching that block's exact shape (list, then `new` before `:id/edit`):

```tsx
{
  element: <RequirePermission permission="tickets.manage" />,
  children: [
    {
      path: 'categories',
      lazy: async () => {
        const { CategoryListPage } =
          await import('@/features/tickets/components/CategoryListPage')
        return { element: <CategoryListPage /> }
      },
    },
    {
      // Must stay before `categories/:id`, same reason as `roles/new`.
      path: 'categories/new',
      lazy: async () => {
        const { CategoryFormPage } =
          await import('@/features/tickets/components/CategoryFormPage')
        return { element: <CategoryFormPage /> }
      },
    },
    {
      path: 'categories/:id/edit',
      lazy: async () => {
        const { CategoryFormPage } =
          await import('@/features/tickets/components/CategoryFormPage')
        return { element: <CategoryFormPage /> }
      },
    },
  ],
},
```

### 6 — Sidebar nav link

**File: `frontend/src/app/Sidebar.tsx`** — add a `TagIcon` import to the `lucide-react` import block (`:2-17`, alphabetical among the existing names), and a new `<Can permission="tickets.manage">` block immediately after the existing `<Can permission="tickets.view">` block (`:128-141`), mirroring the `roles.manage` block's shape (`:176-183`):

```tsx
<Can permission="tickets.manage">
  <SidebarLink
    to="/categories"
    icon={TagIcon}
    label={t('tickets:categories.title')}
    collapsed={collapsed}
  />
</Can>
```

The `useTranslation` namespace array at `Sidebar.tsx:75-84` already includes `'tickets'` — no change needed there.

### 7 — Locale keys

**Files: `frontend/src/features/tickets/locales/en.json` and `ar.json`** — add a new top-level `categories` key (sibling of the existing `fields`/`filters`/`actions` keys) to both files, keeping the key set identical. English:

```json
"categories": {
  "title": "Categories",
  "new": "New category",
  "edit": "Edit category",
  "empty": "No categories yet",
  "emptyDescription": "Create the first category to get started.",
  "fields": {
    "name": "Name",
    "createdAt": "Created",
    "actions": "Actions"
  },
  "actions": {
    "save": "Save",
    "delete": "Delete"
  },
  "delete": {
    "title": "Delete this category?",
    "description": "Tickets using this category become uncategorized. This cannot be undone."
  },
  "created": "Category created.",
  "updated": "Category updated."
}
```

Arabic (insert the equivalent object into `ar.json`, same key paths):

```json
"categories": {
  "title": "الفئات",
  "new": "فئة جديدة",
  "edit": "تعديل الفئة",
  "empty": "لا توجد فئات بعد",
  "emptyDescription": "أنشئ أول فئة للبدء.",
  "fields": {
    "name": "الاسم",
    "createdAt": "تاريخ الإنشاء",
    "actions": "الإجراءات"
  },
  "actions": {
    "save": "حفظ",
    "delete": "حذف"
  },
  "delete": {
    "title": "هل تريد حذف هذه الفئة؟",
    "description": "ستصبح التذاكر التي تستخدم هذه الفئة بدون فئة. لا يمكن التراجع عن هذا الإجراء."
  },
  "created": "تم إنشاء الفئة.",
  "updated": "تم تحديث الفئة."
}
```

The delete-confirm copy deliberately says tickets become uncategorized, not that they are affected/deleted — this must match `SET_NULL` behaviour (`backend/apps/tickets/models.py:65-72`), not imply data loss.

### 8 — Backend: correct the stale `CategoryAdmin` docstring

**File: `backend/apps/tickets/admin.py:15-19`** — this story makes the docstring's claim false. Replace:

```python
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Also the de facto category-management UI for now — this story ships
    no frontend CRUD screen for categories. See Story 18 `## Story Goal`.
    """
```

with:

```python
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Retained alongside the frontend CRUD screen (`/categories`, Story 54)
    as a superuser-only fallback — not the only management path anymore.
    """
```

No other change to this file; `list_display`/`search_fields`/`readonly_fields` (`:21-23`) are unaffected.

---

## Edge Cases & Failure Modes

- **Duplicate category name.** `POST`/`PATCH /api/categories/` with a `name` that already exists (case-sensitive, matching `unique=True` on `models.py:15`) returns `400 {"name": [...]}`. `applyServerErrors`/`isValidationError` (imported in Task 4, same as `RoleFormPage.tsx:7`) map this onto the `name` field's error state automatically — no bespoke handling needed, but verify it live (see `## Verification Steps`).
- **Empty or whitespace-only name.** Blocked client-side before any request by `requiredString(100)`'s `.trim().min(1)` (`schemas.ts:11-13`).
- **Deleting a category currently assigned to tickets.** `Ticket.category` is `on_delete=models.SET_NULL` (`models.py:65-72`) — affected tickets become uncategorized, they are not deleted and the delete request still returns `204`. The confirm-dialog copy in Task 7 must say this, not "removes it" alone.
- **Navigating to `/categories` (or `/categories/new`, `/categories/:id/edit`) with `tickets.view` but not `tickets.manage`.** `RequirePermission` (`RequirePermission.tsx:28`) redirects to `/` — verify this is the actual behavior (not a blank page or error) rather than assuming.
- **`GET /categories/<id>/` for an id that does not exist or belongs to nothing (already deleted).** `CategoryFormPage` in edit mode passes the query through `QueryBoundary`, the same component `RoleFormPage.tsx:106` uses for its 404/error state — verify it renders a sane not-found state rather than a blank screen or unhandled error.
- **Rapid double-submit on create/delete.** `mutation.isPending` already disables the submit button (`Button ... disabled={mutation.isPending}`, mirrors `RoleFormPage.tsx:210`); the list's delete button has no such guard (neither does `RoleListPage`'s) — matches existing precedent, not a new gap introduced here.

---

## Test Plan

Per standing project policy, this project authors no automated tests (see Story 12's `## Test Plan` note). This story adds none. Verification is manual, via `## Verification Steps` below plus real HTTP against the existing `CategoryViewSet` across permission states.

---

## Verification Steps

1. **Backend unaffected, sanity check:** from `backend/`, `python manage.py check` — no errors (confirms the docstring-only edit in Task 8 didn't break anything).
2. **Frontend builds:** from `frontend/`, `npm run build` — no TypeScript errors.
3. **Lint and format:** from `frontend/`, `npm run lint` and `npm run format:check` — clean.
4. **RTL check:** from `frontend/`, `npm run check:rtl` — clean.
5. **Locale key parity:** manually diff the key structure of `frontend/src/features/tickets/locales/en.json` against `ar.json` — the new `categories` object must have identical key paths in both (no automated script for this, per Context #20).
6. **Category CRUD, permission-gated, real HTTP against `/api/categories/`** (already covered once in Story 18's own verification; re-confirm here since this story is the first UI consumer of the write endpoints): with a `tickets.manage` token, `POST /api/categories/ {"name": "Billing"}` → `201`; `PATCH /api/categories/<id>/ {"name": "Billing & Payments"}` → `200`; repeat the `POST` with the same name → `400` with a `name` field error; `DELETE /api/categories/<id>/` on a category referenced by an existing ticket → `204`, and `GET` that ticket confirms `category` is now `null`. With a `tickets.view`-only token (no `tickets.manage`) → `403` on all four write verbs, `200` on `list`/`retrieve`.
7. **Bilingual UI walkthrough**, `npm run dev` with the backend up, signed in as a `tickets.manage` user: open `/categories` from the new sidebar link → list renders, sortable by name and created date. Click "New category", submit a duplicate name → the field-level error renders inline (no toast, no crash). Submit a unique name → success toast, redirected to `/categories`, new row visible. Click the name to edit → rename it → success toast → list reflects the new name. Delete a category that is assigned to at least one existing ticket → confirm dialog appears with the "becomes uncategorized" copy → confirm → row disappears, and that ticket's `TicketDetailPage` now shows "No category" (`t('fields.noCategory')`, already existing copy at `tickets/locales/en.json:15`). Switch language to Arabic and repeat the walkthrough once, confirming every new string renders (no raw `categories.*` keys visible) and RTL layout looks correct.
8. **Permission boundary in the browser:** sign in as a user with `tickets.view` but not `tickets.manage` (or temporarily edit a role to drop `tickets.manage`) → the "Categories" sidebar link is absent (`Can`, Task 6) → navigating to `/categories` directly redirects to `/`.

---

## Done Criteria

- [ ] `CategoryInput` type added to `frontend/src/features/tickets/types/category.ts`.
- [ ] New API layer: `getCategoryList`/`useCategoryList`, `getCategory`/`useCategory`, `createCategory`/`updateCategory`/`deleteCategory`, `useCategoryMutations` (create/update/delete), all invalidating the shared `ticketKeys.resource('categories')` prefix. Existing `getCategories.ts`/`useCategories.ts` unchanged.
- [ ] `CategoryListPage` — sortable, paginated list with name/created-date/actions columns and a delete-with-confirm flow.
- [ ] `CategoryFormPage` — single component for create and edit, one `name` field, server-side duplicate-name error surfaced inline.
- [ ] Routes `categories`, `categories/new`, `categories/:id/edit` added to `router.tsx`, gated on `tickets.manage`, `new` ordered before `:id/edit`.
- [ ] Sidebar link added, gated on `tickets.manage`, using the new `categories.title` locale key.
- [ ] `categories` locale section added to both `tickets/locales/en.json` and `ar.json` with an identical key set.
- [ ] `backend/apps/tickets/admin.py`'s `CategoryAdmin` docstring no longer claims to be the only management path.
- [ ] Verified by real HTTP across permission states (Step 6: duplicate-name `400`, `tickets.manage` vs `tickets.view`-only) and a bilingual UI walkthrough including the `SET_NULL`-on-delete behavior (Step 7).
- [ ] Overview `00-overview.md` updated with this story.
