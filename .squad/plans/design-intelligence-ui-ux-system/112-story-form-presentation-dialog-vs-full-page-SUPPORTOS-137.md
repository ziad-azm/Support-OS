# Story 112 — (DSN-15) Form Presentation: Dialog vs Full Page (Story: SUPPORTOS-137)

## Prerequisites

- **Intake correction (read this before anything else).** `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-137/intake.md`'s title is correctly `(DSN-15) — Form Presentation: Dialog vs Full Page`, but its **Description** section is not DSN-15's content — it is DSN-16's ("Motion Completion & Micro-Interaction Craft") content, verbatim-identical to `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-138/intake.md` (which is correctly titled `(DSN-16) — Motion Completion & Micro-Interaction Craft`). This plan is built from `SupportOs backlog.MD:707-716`, the verified, distinct `STORY (DSN-15) — Form Presentation: Dialog vs Full Page` section — not from the intake's mismatched Description field. `SupportOs backlog.MD:1146` (Foundation Map) independently confirms DSN-15's real subject: "Form presentation rule + shared `FormDialog` (DSN-15) → EPIC 8, extends `UI`/`FORM`". DSN-16 (the motion work) is `SUPPORTOS-138`, already correctly intaken, and is a separate, unplanned story — not this one.
- **`DSN-10` (Story 65) and `DSN-11` (Story 66) are complete** — both audited form UX and navigation/IA but explicitly left form *presentation* (dialog vs. full page) untouched; this story is that uncovered half, per `SupportOs backlog.MD:710`'s own framing.
- **`UI`/`FORM` are complete** (`shared/ui/primitives/dialog.tsx`, `shared/ui/form/`) — this story extends both, forks neither.
- **Verified against current code, not the backlog's stale count:** the backlog's "17 full-page form routes" is now **18** — a `CalendarFormPage` route pair (`settings/calendars/new` / `settings/calendars/:id/edit`) was added by `SLA-5` (Story 111, `SUPPORTOS-133`) after the backlog text was written. It is accounted for in this plan's own disposition table below.

---

## Story Goal

Verified against current code: the app has **18 full-page form routes** (`frontend/src/app/router.tsx`) and **zero** dialog-based forms anywhere in `features/` — `shared/ui/primitives/dialog.tsx` is fully built but its only consumer in the whole codebase is `shared/ui/confirm/ConfirmProvider.tsx`. A two-field form (Department: name + description) costs a full route swap and loses the list's filters/scroll position, the same cost as editing a whole ticket.

This story:

1. **Decides and documents** a presentation rule — dialog vs. full page vs. no third ("sheet") tier — in `CONVENTIONS.md`, with a full disposition table covering all 18 current form routes (not just worked examples).
2. **Builds one shared `FormDialog` component** (`shared/ui/form/FormDialog.tsx`) over the existing `dialog.tsx` primitive, composing with `FORM` (`useAppForm`) and inheriting `DSN-10`'s validation/error-summary/submit-state behavior, so a dialog form is not a second, weaker form implementation.
3. **Migrates the 9 forms the rule classifies as dialogs** — `Department`, `Branch`, `Category` (knowledge-base), `Category` (tickets), `Faq`, `LandingHighlight`, `LandingSocialLink`, `Task`, `Customer` — to open in place over their list screen, while every existing route (`/settings/departments/new`, `/categories/:id/edit`, etc.) keeps working exactly as before: still bookmarkable, still reachable from `DSN-11`'s navigation, and closing the dialog restores the list URL instead of pushing a dead history entry.
4. **Verifies** the migrated screens against `DSN-9`'s mobile constraints, keyboard-only operation, and screen-reader announcement, reusing `DSN-13`'s verification route set.

**Not in scope:**

- The other 9 form routes stay full pages (multi-section, file upload, permission-grid, or a form a user deep-links/shares): `Ticket`, `Article`, `Role`, `User`, `WebhookSubscription`, `Calendar`, `WebForm` (public `/contact`), `PortalTicket`, `PortalFeedback` (both `features/portal/`, out of scope the same way Story 51 scoped every portal screen out).
- No backend/API change — every task is frontend-only.
- No new dependency — the whole mechanism is built from the existing `dialog.tsx` primitive and React Router's existing nested-route/`Outlet` support (`react-router` `^8.3.0`, already in `frontend/package.json`).
- "Quick Reply" (`SupportOs backlog.MD:713`'s own worked example) has no management UI at all yet (`features/tickets/api/getQuickReplies.ts` is read-only) — it is used only as a worked example in the presentation-rule doc, not migrated.

---

## Context — Read These Files First

1. `SupportOs backlog.MD` lines 707-716 — DSN-15's real story text (the authoritative source for this plan; see `## Prerequisites`' intake-correction note).
2. `frontend/src/shared/ui/primitives/dialog.tsx` (156 lines, full file) — the `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`/`DialogClose` primitives `FormDialog` composes over. Note line 65's `sm:max-w-lg` default width and line 71-79's built-in close button.
3. `frontend/src/shared/ui/confirm/ConfirmProvider.tsx` (full file, 83 lines) — the only existing `dialog`-family consumer; note how it resolves a promise from confirm/cancel/Escape/overlay-dismiss alike (`onOpenChange`), the same "every dismiss path is one path" shape `FormDialog` needs for its own dirty-guard.
4. `frontend/src/shared/hooks/useUnsavedChangesGuard.ts` (full file, 46 lines) — the `useBlocker` + `useConfirm()` pattern for route-navigation guarding. **Not reused as-is inside a dialog** — see task 2's own note on why, and task 3's Faq-specific removal step.
5. `frontend/src/shared/ui/confirm/useConfirm.ts` (full file, 13 lines) — `FormDialog` calls this directly for its own close-confirmation, not through `useUnsavedChangesGuard`.
6. `frontend/src/features/organization/components/DepartmentFormPage.tsx` (full file, 135 lines) — the worked full-migration example in task 3 (name + description, split `departments.view`/`departments.manage` permission gate — the most complex gating case among the 9).
7. `frontend/src/features/organization/components/DepartmentListPage.tsx` (full file, 127 lines) — the paired list page; note the `<Link to="/settings/departments/new">` (line 94) and `<TableLink to={.../${row.id}/edit}>` (line 58) — both keep working unchanged.
8. `frontend/src/features/tasks/components/TaskFormPage.tsx` (full file, 178 lines) and `frontend/src/features/tasks/components/TaskListPage.tsx` (full file, 179 lines) — the second worked example: an **ungated** route pair (no `RequirePermission` wrapper at all), the simplest nesting case.
9. `frontend/src/app/router.tsx` lines 120-425 (customers, tickets, knowledge-base categories/manage, users, roles, tickets/categories) and lines 495-773 (landing highlights/social, departments, branches, calendars, tasks) — every route block this story restructures. Exact target line ranges are given per-file in task 3's table.
10. `frontend/src/shared/ui/form/index.ts` (10 lines, full file) — task 2's barrel-export edit site.
11. `frontend/src/features/knowledge-base/components/FaqFormPage.tsx` (full file, 127 lines) — the one dialog-migration target that already calls `useUnsavedChangesGuard` (line 75) and uses a `flushSync(() => form.reset(values))` workaround (lines 88-94) purely to unstick that hook's stale `isDirty` closure before its own `navigate()`. Both are removed in this migration — see task 3.
12. `frontend/src/features/organization/components/LandingHighlightFormPage.tsx` (full file, 227 lines) and `LandingSocialLinkFormPage.tsx` (full file, 210 lines) — the two dialog-migration targets whose current container is `max-w-2xl`, wider than `dialog.tsx`'s `sm:max-w-lg` default; both need a `DialogContent` width override (task 3).
13. `CONVENTIONS.md` lines 1778-1789 (§ 25 intro) and lines 2034-2078 (the `MOTION-0`/Story 97 subsection, the last one in § 25) — task 1's insertion point (immediately before line 2079's `---`) and the section's established tone/heading pattern (`### <topic> (`<DSN-id>`, Story <NN>)`).
14. `.squad/plans/design-intelligence-ui-ux-system/65-story-forms-data-entry-ux-remediation-SUPPORTOS-101.md` — sibling plan to match tone; note its own "one full worked example + a table for every other site" structure (task 8), reused here for task 3.

---

## Product rules (from story)

**Disposition table — all 18 current full-page form routes, classified against the rule task 1 documents** (single entity + few fields + no nested navigation → dialog; multi-section, file upload, permission-grid, or deep-linked/shared → stays a full page):

| Component | Route(s) | Permission gate | Fields/shape | Disposition |
|---|---|---|---|---|
| `DepartmentFormPage` | `settings/departments/new`, `settings/departments/:id/edit` | split: `departments.view` (list) / `departments.manage` (new, edit) | 2 fields, 1 card | **Dialog** — task 3's full worked example |
| `BranchFormPage` | `settings/branches/new`, `settings/branches/:id/edit` | split: `branches.view` / `branches.manage` | 3 fields, 1 card | **Dialog** |
| `CategoryFormPage` (knowledge-base) | `knowledge-base/categories/new`, `.../:id/edit` | single: `knowledge_base.manage` | 2 fields, 1 card, live badge preview | **Dialog** |
| `CategoryFormPage` (tickets) | `categories/new`, `categories/:id/edit` | single: `tickets.manage` | 1 field, 1 card | **Dialog** |
| `FaqFormPage` | `knowledge-base/manage/new`, `.../:id/edit` | single: `knowledge_base.manage` | 3 fields, no card wrapper | **Dialog** |
| `LandingHighlightFormPage` | `settings/landing/highlights/new`, `.../:id/edit` | single: `settings.manage` | 6 fields across 3 cards (EN/AR/icon), bilingual | **Dialog** — needs `sm:max-w-2xl` override (current container is `max-w-2xl`, wider than `dialog.tsx`'s `sm:max-w-lg` default) |
| `LandingSocialLinkFormPage` | `settings/landing/social/new`, `.../:id/edit` | single: `settings.manage` | 4 fields, 1 card | **Dialog** — same `sm:max-w-2xl` override |
| `TaskFormPage` | `tasks/new`, `tasks/:id/edit` | **none** (ungated for any authenticated user) | 4 fields, no card wrapper | **Dialog** — task 3's second worked example (simplest gating case) |
| `CustomerFormPage` | `customers/new`, `customers/:id/edit` | single: `customers.view` | 8 fields (name/email/phone/company/branch + 3 contact-channel checkboxes), no card wrapper | **Dialog** — single entity, no nested navigation, despite the field count; matches the rule, not the backlog's non-exhaustive "e.g." list |
| `TicketFormPage` | `tickets/new`, `tickets/:id/edit` | single: `tickets.view` | multi-section (customer/category/branch/priority/subject/description), 246 lines | **Full page** (backlog's own explicit example) |
| `ArticleFormPage` | `knowledge-base/articles/manage/new`, `.../:id/edit` | single: `knowledge_base.manage` | dual-language, Markdown write/preview tabs, 228 lines | **Full page** (backlog's own explicit example) |
| `RoleFormPage` | `roles/new`, `roles/:id/edit` | single: `roles.manage` | permission grid, 274 lines | **Full page** |
| `UserFormPage` | `users/new`, `users/:id/edit` | split: `users.view` / `users.manage` | role/department/branch assignment, 367 lines | **Full page** (backlog's own explicit example) |
| `WebhookSubscriptionFormPage` | `settings/webhooks/new`, `.../:id/edit` | single: `webhooks.manage` | event-type selection, 339 lines | **Full page** (backlog's own explicit example) |
| `CalendarFormPage` | `settings/calendars/new`, `.../:id/edit` | split: `calendars.view` / `calendars.manage` | edit mode nests `WorkingWindowsSection`/`HolidaysSection` — real nested navigation | **Full page** — not in the backlog's original 17 (added by `SLA-5`/Story 111 afterward); disqualified by the rule's own "no nested navigation" clause, not by precedent |
| `WebFormPage` | `contact` (public) | none (`AllowAny`) | own bookmarkable/shareable public URL | **Full page** (rule's own "a form a user deep-links and shares" clause) |
| `PortalTicketFormPage` | `portal/tickets/new` | portal auth | reached directly, not opened from a list the customer is browsing | **Full page, out of scope** — `features/portal/` untouched, matching Story 51/64/66's own portal-scope-out precedent |
| `PortalFeedbackFormPage` | `portal/tickets/:id/feedback` | portal auth | reached via a link from ticket detail, not a list | **Full page, out of scope** — same portal precedent |

---

## Frontend Tasks

### 1 — Decide and document the presentation rule

**File: `CONVENTIONS.md`** — insert a new subsection immediately before line 2079's `---` (the divider that currently closes § 25, right after the `MOTION-0`/Story 97 subsection ending at line 2077):

```markdown
### Form presentation: dialog vs. full page (`DSN-15`, Story 112)

**The rule.** A form is a **dialog** — `shared/ui/form/FormDialog.tsx` over
`shared/ui/primitives/dialog.tsx` — when it is a single entity, has no
nested navigation of its own (no child sections that only make sense once
the entity is saved), and its field count fits comfortably in
`dialog.tsx`'s `sm:max-w-lg` default (or `sm:max-w-2xl` for a bilingual
pair). Examples: Department, Branch, Category, FAQ, Task, Customer, Landing
highlight/social link, and (a worked example with no live consumer yet)
Quick Reply.

A form stays a **full page** when it is multi-section (Ticket, Article,
Calendar's working-windows/holidays), has a permission grid or
role/department/branch assignment (Role, User), needs file upload or
event-type selection (WebhookSubscription), or is deep-linked/shared as its
own bookmarkable destination — a public form (`WebForm`) or a customer
portal form reached directly rather than from a list the customer is
browsing (`PortalTicketForm`, `PortalFeedbackForm`).

**No third ("sheet") tier.** `sheet`/`popover` do not exist as primitives in
this codebase (`MOTION-0`/Story 97 already noted this) and this story does
not add one — a boundary nobody can define is worse than two clear ones,
per this story's own constraint. A future form that feels "too big for a
dialog, too small for a page" is a full page until a sheet primitive is
deliberately added as its own decision.

**Mechanism.** A dialog form's route (`new`/`:id/edit`) is nested as a
**child route** of its list route in `frontend/src/app/router.tsx`, and the
list page renders `<Outlet />` (Radix portals the dialog to
`document.body` regardless of where in the tree it mounts, so `Outlet`'s
position in the list page's JSX does not affect layout). A permission gate
that already splits view/manage (Department, Branch, Calendar) keeps both
`RequirePermission` layers, nested the same way; a single-gate group
(Category, Faq, Landing highlights/social, Customer) nests with no second
layer; an ungated route (Task) nests with none at all. See Story 112's own
plan file for the full per-route table.

**Escape/overlay-dismiss vs. Cancel.** `FormDialog`'s Cancel button is a
`DialogClose asChild` wrapper, not a separate `onClick` handler — Radix
calls the same `onOpenChange(false)` for Escape, overlay click, the
built-in close button, and `DialogClose`, so all four dismiss paths run
through `FormDialog`'s one dirty-check, by construction, not by keeping two
paths in sync by hand.
```

---

### 2 — Shared `FormDialog` component

**Create file: `frontend/src/shared/ui/form/FormDialog.tsx`**:

```tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'

type FormDialogProps = {
  open: boolean
  /** Called with `false` once the close is confirmed (or there was nothing
   *  to confirm) — never called with `true` from inside; opening is driven
   *  by the route itself mounting this component. */
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** `form.formState.isDirty` — gates the confirm prompt on every dismiss
   *  path (Escape, overlay click, the built-in close button, and the
   *  Cancel button below, all via the same Radix `onOpenChange`). */
  isDirty: boolean
  /** Widens beyond `dialog.tsx`'s `sm:max-w-lg` default for a bilingual
   *  form — pass `'sm:max-w-2xl'`, matching the form's pre-migration
   *  container width. */
  contentClassName?: string
  children: ReactNode
}

/** The one dialog-form wrapper every migrated form uses — composes
 *  `dialog.tsx` with `FORM`'s existing validation/error-summary/
 *  submit-state behavior (inherited for free: the caller's own `<Form>` +
 *  field components render unchanged inside `children`). See
 *  CONVENTIONS.md's `DSN-15` entry. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  isDirty,
  contentClassName,
  children,
}: FormDialogProps) {
  const { t } = useTranslation()
  const { confirm } = useConfirm()

  async function handleOpenChange(next: boolean) {
    if (next) return
    if (isDirty) {
      const confirmed = await confirm({
        title: t('unsavedChanges.title'),
        description: t('unsavedChanges.description'),
        destructive: true,
      })
      if (!confirmed) return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export { DialogClose as FormDialogClose, DialogFooter as FormDialogFooter }
```

`FormDialogClose`/`FormDialogFooter` are re-exported so a migrated form's
Cancel button is `<FormDialogClose asChild><Button variant="outline">…`,
composing with the footer layout `dialog.tsx`'s `DialogFooter` already
provides (`flex-col-reverse sm:flex-row sm:justify-end`, RTL-correct by the
same logical-flex reasoning `ConfirmProvider.tsx`'s footer already relies
on) — no new footer layout is invented.

**File: `frontend/src/shared/ui/form/index.ts`** — add the export:

```diff
  export { FileField } from './FileField'
  export { SubmitButton } from './SubmitButton'
+ export { FormDialog, FormDialogClose, FormDialogFooter } from './FormDialog'
```

**Why this does not reuse `useUnsavedChangesGuard` (`shared/hooks/useUnsavedChangesGuard.ts`):** that hook drives `react-router`'s `useBlocker`, which intercepts *any* location change while dirty. Once a dialog form's close action itself navigates to the parent list path (task 3), wiring both `useUnsavedChangesGuard` and `FormDialog`'s own dirty-check on the same component would fire **two** confirm prompts back to back for the identical dismissal. `FormDialog`'s `handleOpenChange` is the single guard for these forms; `useUnsavedChangesGuard` stays exactly as-is for every full-page form that keeps its own direct `navigate()` cancel button (Ticket, Article, Role, User, WebhookSubscription, Calendar, WebForm, PortalTicket, PortalFeedback).

---

### 3 — Migrate the 9 qualifying forms

**Full worked example — `Department` (split `departments.view`/`departments.manage` gate, the most complex gating case):**

**File: `frontend/src/features/organization/components/DepartmentFormPage.tsx`** — rename the exported route component to `DepartmentFormDialog` and replace its outer JSX (the `<div className="mx-auto max-w-lg">` / `<h1>` / raw `<div className="flex gap-2">` footer) with `FormDialog`. The inner form logic (schema, defaults, mutation, `onSubmit`) is unchanged:

```tsx
import { useNavigate, useParams } from 'react-router'
// ...existing imports...
import { Form } from '@/shared/ui/primitives/form'
import { FormDialog, FormDialogClose, FormDialogFooter, FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { Button } from '@/shared/ui/primitives/button'

const LIST_PATH = '/settings/departments'

/** Nested under `DepartmentListPage`'s own route (see `router.tsx`) — the
 *  list renders `<Outlet />`, this mounts only for `new`/`:id/edit`. */
export function DepartmentFormDialog() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const departmentQuery = useDepartment(id, { enabled: isEdit })

  if (!isEdit) {
    return <DepartmentForm mode="create" />
  }

  return (
    <QueryBoundary query={departmentQuery}>
      {(department) => <DepartmentForm mode="edit" id={id} department={department} />}
    </QueryBoundary>
  )
}

function DepartmentForm({ mode, id, department }: { mode: 'create' | 'edit'; id?: number; department?: Department }) {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: department ? toDefaults(department) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateDepartment()
  const updateMutation = useUpdateDepartment(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toDepartmentInput(values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t(mode === 'create' ? 'departments.created' : 'departments.updated') })
        navigate(LIST_PATH)
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => { if (!open) navigate(LIST_PATH) }}
      title={t(mode === 'create' ? 'departments.new' : 'departments.edit')}
      isDirty={form.formState.isDirty}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="name" label={t('departments.fields.name')} />
          <TextField control={form.control} name="description" label={t('departments.fields.description')} />
          <FormErrorSummary errors={formErrors} />
          <FormDialogFooter>
            <SubmitButton pending={mutation.isPending}>{t('departments.actions.save')}</SubmitButton>
            <FormDialogClose asChild>
              <Button type="button" variant="outline">{t('actions.cancel', { ns: 'common' })}</Button>
            </FormDialogClose>
          </FormDialogFooter>
        </form>
      </Form>
    </FormDialog>
  )
}
```

The `Card`/`CardContent` wrapper and the standalone `<h1>` are dropped —
`DialogContent`'s own `rounded-xl border bg-background p-6 shadow-lg`
(`dialog.tsx` line 65) already supplies the card-like surface, and
`DialogTitle` (line 121-129) replaces the `<h1>`.

**File: `frontend/src/features/organization/components/DepartmentListPage.tsx`** — add `<Outlet />`, imported from `react-router`, as a sibling of the existing wrapping `<div>` (Radix's portal makes its position irrelevant to layout):

```diff
- import { Link } from 'react-router'
+ import { Link, Outlet } from 'react-router'
  ...
  return (
-   <div className="flex flex-col gap-4">
-     ...
-   </div>
+   <>
+     <div className="flex flex-col gap-4">
+       ...
+     </div>
+     <Outlet />
+   </>
  )
```

**File: `frontend/src/app/router.tsx`** lines 622-661 — nest `settings/departments/new` and `settings/departments/:id/edit` as **children of** the `settings/departments` list route, keeping the inner `departments.manage` gate as a nested `RequirePermission` layer exactly as it already is today (only the nesting depth changes, not which permission gates which route):

```diff
  {
    element: <RequirePermission permission="departments.view" />,
    children: [
      {
        path: 'settings/departments',
        lazy: async () => {
          const { DepartmentListPage } =
            await import('@/features/organization/components/DepartmentListPage')
          return { element: <DepartmentListPage /> }
        },
+       children: [
+         {
+           element: <RequirePermission permission="departments.manage" />,
+           children: [
+             {
+               path: 'new',
+               lazy: async () => {
+                 const { DepartmentFormDialog } =
+                   await import('@/features/organization/components/DepartmentFormPage')
+                 return { element: <DepartmentFormDialog /> }
+               },
+             },
+             {
+               path: ':id/edit',
+               lazy: async () => {
+                 const { DepartmentFormDialog } =
+                   await import('@/features/organization/components/DepartmentFormPage')
+                 return { element: <DepartmentFormDialog /> }
+               },
+             },
+           ],
+         },
+       ],
      },
    ],
  },
- {
-   element: <RequirePermission permission="departments.manage" />,
-   children: [
-     { path: 'settings/departments/new', lazy: ... },
-     { path: 'settings/departments/:id/edit', lazy: ... },
-   ],
- },
```

A React Router nested route's child `path` is **relative** to its parent
(`new`, not `settings/departments/new`; `:id/edit`, not
`settings/departments/:id/edit`) — the resulting matched URLs are
unchanged (`/settings/departments/new` still matches), so every existing
`<Link to="/settings/departments/new">` / `<TableLink to={...}/edit}>` in
`DepartmentListPage.tsx` keeps working with no edit needed there beyond the
`<Outlet />` addition above.

**Second worked example — `Task` (no permission gate at all, the simplest nesting case):**

**File: `frontend/src/app/router.tsx`** lines 744-766 — same nesting pattern, no `RequirePermission` layer to preserve:

```diff
  {
    path: 'tasks',
    lazy: async () => {
      const { TaskListPage } = await import('@/features/tasks/components/TaskListPage')
      return { element: <TaskListPage /> }
    },
+   children: [
+     {
+       path: 'new',
+       lazy: async () => {
+         const { TaskFormDialog } = await import('@/features/tasks/components/TaskFormPage')
+         return { element: <TaskFormDialog /> }
+       },
+     },
+     {
+       path: ':id/edit',
+       lazy: async () => {
+         const { TaskFormDialog } = await import('@/features/tasks/components/TaskFormPage')
+         return { element: <TaskFormDialog /> }
+       },
+     },
+   ],
  },
- { path: 'tasks/new', lazy: ... },
- { path: 'tasks/:id/edit', lazy: ... },
```

`TaskFormPage.tsx`: rename the exported component to `TaskFormDialog`, apply
the identical `FormDialog` restructuring shown for Department (schema/
mutation/`onSubmit` unchanged; `LIST_PATH = '/tasks'`; the `Loading`
fallback for `ticketOptionsQuery.isPending` stays, rendered inside
`FormDialog`'s children rather than replacing the whole dialog body).
`TaskListPage.tsx`: add `<Outlet />` the same way as `DepartmentListPage.tsx`.

**The remaining 7 sites — identical mechanical pattern, applied per this table:**

| Component → rename to | List page (add `<Outlet />`) | Router lines (nest under) | Gate structure | `LIST_PATH` | `contentClassName` |
|---|---|---|---|---|---|
| `BranchFormPage` → `BranchFormDialog` | `BranchListPage.tsx` | 662-702 | split `branches.view`/`branches.manage` — same two-layer nesting as Department | `/settings/branches` | — |
| `knowledge-base/CategoryFormPage` → `CategoryFormDialog` | `knowledge-base/CategoryListPage.tsx` | 260-286 | single `knowledge_base.manage` — no second layer, nest directly under the list route | `/knowledge-base/categories` | — |
| `tickets/CategoryFormPage` → `CategoryFormDialog` | `tickets/CategoryListPage.tsx` | 397-425 | single `tickets.manage` — no second layer | `/categories` | — |
| `FaqFormPage` → `FaqFormDialog` | `knowledge-base/FaqListPage.tsx` | 206-232 | single `knowledge_base.manage` — no second layer | `/knowledge-base/manage` | — |
| `LandingHighlightFormPage` → `LandingHighlightFormDialog` | `LandingHighlightListPage.tsx` | 508-534 | single `settings.manage` — no second layer | `/settings/landing/highlights` | `'sm:max-w-2xl'` |
| `LandingSocialLinkFormPage` → `LandingSocialLinkFormDialog` | `LandingSocialLinkListPage.tsx` | 535-563 | single `settings.manage` — no second layer | `/settings/landing/social` | `'sm:max-w-2xl'` |
| `CustomerFormPage` → `CustomerFormDialog` | `CustomerListPage.tsx` | 120-157 | single `customers.view` — no second layer | `/customers` | — |

For each: rename the exported route component (`<Thing>FormPage` →
`<Thing>FormDialog`), apply the `FormDialog` restructuring shown in the
Department example (drop the outer `<div>`/`<h1>`/raw footer `<div>`, wrap
in `FormDialog` with the listed `LIST_PATH` and `contentClassName`, footer
buttons become `FormDialogFooter`/`FormDialogClose`), add `<Outlet />` to
the paired list page, and nest the router entries per the listed line
range and gate structure — one or two `RequirePermission` layers exactly
matching what task 3's Department/Task examples show for each shape.

**`FaqFormDialog`-specific step, in addition to the above:** remove the
`useUnsavedChangesGuard(form.formState.isDirty)` call (line 75) and its
import, and remove the `flushSync(() => form.reset(values))` call in
`onSuccess` (lines 88-94), replacing it with a plain `form.reset(values)`
call (or dropping the reset entirely, since `FormDialog`'s own
`onOpenChange(false)` — invoked by the same `onSuccess`'s subsequent
`navigate(LIST_PATH)` — is not itself gated on dirty state; only the
**cancel/Escape/overlay** paths are). Both existed solely to unstick
`useBlocker`'s stale `isDirty` closure ahead of a route-navigating
`useBlocker`; once `useBlocker` (via `useUnsavedChangesGuard`) is gone from
this component, `navigate(LIST_PATH)` runs uninterrupted the same way every
other migrated dialog's success path already does.

**`LandingHighlightFormDialog`/`LandingSocialLinkFormDialog`-specific
step:** each currently renders 2-3 `Card`s (English section / Arabic
section / icon-and-order, or platform/value/order) as visual grouping
inside the single-page layout. Keep those `Card`s as internal grouping
inside `FormDialog`'s children — only the outer page-level `<div>`/`<h1>`/
footer `<div>` is replaced, not the `Card` sections themselves, since they
still provide useful visual separation between the EN/AR/icon groups
inside the wider `sm:max-w-2xl` dialog.

---

### 4 — Verify against the surfaces this affects

No new code — a verification pass reusing existing route/tooling
infrastructure, per the story's own fourth task:

- **Mobile (`DSN-9`):** at a 375px viewport, confirm each of the 9 migrated
  dialogs still renders within `dialog.tsx`'s existing
  `w-full max-w-[calc(100%-2rem)]` mobile-width rule (line 65) — already
  built into the primitive, not something this story adds, but not
  previously exercised by any form dialog.
- **Keyboard-only:** Tab through each dialog's fields, confirm Radix's
  built-in focus trap keeps focus inside `DialogContent`, and that
  `Escape` triggers `FormDialog`'s dirty-check exactly like the Cancel
  button (task 2's "one dismiss path" design) rather than closing silently.
- **Screen-reader announcement:** confirm each dialog's opening announces
  `DialogTitle`'s text (Radix wires `aria-labelledby` to it automatically)
  — no manual ARIA wiring needed beyond what `dialog.tsx` already provides.
- Reuse `DSN-13`'s verification route set (`.squad/plans/design-intelligence-ui-ux-system/68-story-final-ux-verification-sign-off-SUPPORTOS-104.md`) for the route list; no new audit register entry (this story is outside the closed `UX-AUDIT.md` register, the same "not part of the register" status `DSN-14`/Story 69 already established for post-sign-off work).

---

## Edge Cases & Failure Modes

- **A direct hit on a dialog route with no prior list-page visit in history** (e.g. a bookmarked `/settings/departments/5/edit`) — React Router still resolves the full parent chain (`RequirePermission` → `DepartmentListPage` → the nested `RequirePermission` → `DepartmentFormDialog`) on a fresh load, so the list renders with the dialog open over it, standalone, exactly as `SupportOs backlog.MD:715`'s own "over its list, or standalone" allowance describes. Closing navigates to `LIST_PATH`, which is always a valid destination regardless of prior history — never a `navigate(-1)` that could land somewhere unrelated or off-app.
- **Radix's `DialogContent` has no `DialogDescription`** in any of the 9 migrated forms — Radix logs a dev-only console warning about a missing `aria-describedby` target, matching the same un-described-content shape shadcn's own upstream `dialog` recipe ships with when no description is passed; not a new regression, not fixed here (out of scope — no finding names it).
- **A permission a viewer lacks (`departments.manage` etc.) on a direct hit to `.../new`** — the nested `RequirePermission` layer still redirects/blocks exactly as it does today; nesting under the list route does not change *which* permission gates *which* path, only the route tree's shape (verified per-route in task 3's table).
- **Submitting successfully while the dialog is "dirty"** — `onSuccess`'s own `navigate(LIST_PATH)` call does not go through `FormDialog`'s `onOpenChange` (it's a direct `useNavigate()` call, same as every non-migrated form's existing success path), so no unsaved-changes prompt ever fires on a successful save — only on a genuine cancel/Escape/overlay dismiss while dirty.
- **Two dialogs never stack** — every dialog route is a leaf (`new` or `:id/edit`), never nested under another dialog route, so `Dialog`'s single-instance-per-`FormDialog`-call assumption always holds.
- **`LandingHighlightFormDialog`/`LandingSocialLinkFormDialog`'s wider `sm:max-w-2xl` dialog on a 375px mobile viewport** — `dialog.tsx`'s own mobile rule (`w-full max-w-[calc(100%-2rem)]`) takes precedence below the `sm:` breakpoint regardless of the `sm:max-w-2xl` override, so mobile width is unaffected; the override only changes the ≥640px desktop cap.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16 / verified by Story 65's own Test Plan for the same reason). No test file is added.

1. No backend impact — every task is frontend-only. `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — `npm run build` specifically catches a stale import (e.g. a router `lazy` block still importing a renamed `<Thing>FormPage` export) via `noUnusedLocals`/module-resolution failure.
3. Manual verification only beyond that, per `## Verification Steps` below.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Every migrated route still resolves standalone:** paste each of the 9 forms' `new`/`:id/edit` URLs directly into the address bar (fresh load, no prior navigation) — each renders its list page with the dialog open over it, not a blank page or a 404.
3. **Dialog open-in-place:** from each of the 9 list pages, click "New" — the dialog opens over the current list (filters/search/scroll position untouched underneath), not a full navigation away.
4. **Close paths all guard consistently:** on a dirty (edited) dialog, trigger each of Escape, an overlay click, the built-in `X` close button, and the Cancel button in turn (across at least 3 of the 9 forms) — all four prompt the same unsaved-changes confirm; confirming closes and returns to the list URL, cancelling the confirm leaves the dialog open with the edit intact.
5. **Clean-close, no prompt:** on a pristine (untouched) dialog, each of the same four dismiss paths closes immediately with no prompt.
6. **Successful save closes without a prompt:** submit a valid change on a dirty dialog — no unsaved-changes prompt fires; the dialog closes and the list shows the update (toast + row change).
7. **Existing routes preserved:** `TableLink`s on each of the 9 list pages (e.g. `DepartmentListPage`'s name column) still open the corresponding edit dialog at the same URL as before.
8. **Bilingual dialogs render correctly:** `LandingHighlightFormDialog`/`LandingSocialLinkFormDialog` render their full width (not clipped) at desktop width, and correctly at a 375px mobile viewport per `dialog.tsx`'s own responsive rule.
9. **RTL:** open at least 3 of the 9 dialogs under `ar`/RTL — title, fields, and footer button order (Cancel/Save) read correctly mirrored, matching `dialog.tsx`/`DialogFooter`'s existing logical-flex behavior.
10. **Full-page forms unaffected:** spot-check 2 of the 9 non-migrated forms (e.g. `TicketFormPage`, `RoleFormPage`) still render as full pages, unchanged.

---

## Done Criteria

- [ ] `CONVENTIONS.md` § 25 — new "Form presentation: dialog vs. full page (`DSN-15`, Story 112)" subsection added before the section's closing `---`, with the rule, the no-third-tier decision, and the nesting mechanism.
- [ ] `shared/ui/form/FormDialog.tsx` created and exported from `shared/ui/form/index.ts` (`FormDialog`, `FormDialogClose`, `FormDialogFooter`).
- [ ] All 9 forms (`Department`, `Branch`, `Category`×2, `Faq`, `LandingHighlight`, `LandingSocialLink`, `Task`, `Customer`) migrated to `FormDialog`, each renamed to `<Thing>FormDialog`, each paired list page rendering `<Outlet />`.
- [ ] `frontend/src/app/router.tsx` — all 9 route pairs nested as children of their list route, preserving each route's existing permission-gate structure (split or single) and exact matched URL.
- [ ] `FaqFormDialog` — `useUnsavedChangesGuard` call and import removed; `flushSync(() => form.reset(values))` simplified to a plain `form.reset(values)` (or removed).
- [ ] The other 9 form routes (`Ticket`, `Article`, `Role`, `User`, `WebhookSubscription`, `Calendar`, `WebForm`, `PortalTicket`, `PortalFeedback`) unchanged.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `CONVENTIONS.md` only (plus this feature's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-10, in both `en`/LTR and `ar`/RTL.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-16` (Motion Completion & Micro-Interaction Craft, correctly intaken as `SUPPORTOS-138`) and `DSN-17` (Measured Colour & Contrast Audit, `SUPPORTOS-139`) remain unplanned — each needs its own `/squad-plan` run.
