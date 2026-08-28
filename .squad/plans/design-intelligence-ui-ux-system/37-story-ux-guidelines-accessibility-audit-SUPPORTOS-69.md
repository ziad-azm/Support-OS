# Story 37 — (DSN-2) UX Guidelines & Accessibility Audit (Story: SUPPORTOS-69)

## Prerequisites

- **`DSN-0` (Story 35) is complete.** `CONVENTIONS.md` § 25 (lines 1395-1494) already lists the "UX & accessibility guidance" this story is scoped to apply (lines 1452-1476), explicitly stating "Applied by `DSN-2`... against already-built screens — nothing here is applied yet." This story is that application.
- **`DSN-1` (Story 36) is complete** — token/font/radius retint. Unrelated to this story's scope (this story touches semantics/ARIA/behavior, not color tokens), but confirms `frontend/src/index.css` and the primitives this story also touches (`button.tsx`, `card.tsx`) are in their post-Story-36 state (verified by reading them fresh for this plan, not from memory of Story 36).
- **This is an audit-then-fix story, not a redesign.** Every finding below was verified against real code (`grep`/`Read`), not inferred from the guideline catalog alone. Two independent passes were run — a full-tree `Explore` sweep (images, icon buttons, `div`/`span onClick`, `aria-live`, truncation, RTL script scope) plus a manual pass (heading hierarchy, cursor affordance, autocomplete, motion, touch target size) — and cross-checked against `CONVENTIONS.md` § 25's own flagged list so nothing already covered gets re-litigated.
- **Several guideline categories are already fully compliant — verified, not assumed — and this story makes zero changes to them:**
  - **Alt text:** zero `<img>` tags exist anywhere in `frontend/src` (the app renders no raster images; icons are `lucide-react` SVG components).
  - **Icon-only buttons:** all 5 `size="icon"`/`"icon-sm"` button sites (`NotificationBell.tsx:72`, `ThemeToggle.tsx:33`, `DataTablePagination.tsx:38-40` and `:48-50`, `ToastProvider.tsx:80-82`) already carry a translated `aria-label`.
  - **`div`/`span onClick` anti-pattern:** zero instances anywhere in `frontend/src` — every one of the 28 `onClick` handlers in the app is on a real `<button>`, a shadcn `Button`, or a Radix primitive (`DropdownMenuItem`, `AlertDialogAction`, etc.).
  - **RTL (`check-rtl.mjs`):** wired into CI (`.github/workflows/lint.yml:49-50`, its own step, not bundled into `npm run lint`), scoped to all of `src/**/*.{ts,tsx,css}` with no exclusions, and currently reports zero violations (`npm run check:rtl` → `check:rtl — no physical direction utilities in src/.`).
  - **Wide tables:** `frontend/src/shared/ui/primitives/table.tsx:10` already wraps every table in an `overflow-x-auto` container — the exact fix `CONVENTIONS.md` § 25's "Table Handling" line asks for.
  - **Sortable table headers:** `frontend/src/shared/ui/data-table/DataTable.tsx:76-104` already renders a real `<Button>` (not a bare clickable `<th>`) with `aria-sort` on the header cell and a dynamic `aria-label` describing the next sort direction — a model implementation, nothing to fix.
  - **Field-level ARIA wiring:** `FormControl` (`frontend/src/shared/ui/primitives/form.tsx:98-106`) already sets `aria-describedby` (pointing at the field's description + `FormMessage` id) and `aria-invalid` correctly.
  - **Focus-on-error:** react-hook-form's default `shouldFocusError` (unmodified in `useAppForm.ts`) focuses the first invalid field after a failed client-side submit; `applyServerErrors` (`frontend/src/shared/validation/serverErrors.ts:47`, `form.setFocus(firstField)`) does the same for server-rejected field errors. Both paths already work.
  - **Touch target size:** the smallest interactive control, `size="icon-xs"` (`button.tsx:27`, `size-6` = 24px), meets WCAG 2.2's 24×24 CSS px minimum exactly.
- **One category was deliberately investigated and NOT changed, with reasoning recorded so it isn't re-litigated:** adding `role="alert"` to the shared per-field `FormMessage` (`form.tsx:125-142`) was considered and rejected — react-hook-form's default `reValidateMode: 'onChange'` re-renders that element on every keystroke while a user is actively fixing a field they already submitted once, and an assertive live region firing on every keystroke is a known screen-reader-fatigue anti-pattern, not an improvement. The field is already correctly discoverable via `aria-describedby` (read when the field receives focus) plus the focus-management above. This story fixes the actually-broken, actually-safe-to-fix case instead (see task 3).

---

## Story Goal

Eight concrete, verified fixes, each traced to a specific `ux-guidelines.csv` row and/or a `CONVENTIONS.md` § 25 line:

1. **Heading hierarchy** — `CardTitle` (`card.tsx`) renders a `<div>`, never a real heading. `TicketDetailPage` and `CustomerProfilePage` — the two busiest screens in the app — currently have **zero** semantic headings anywhere on the page. Fix: give `CardTitle` `asChild` support (matching the existing `Button`/`Badge` Radix `Slot` pattern) and promote all 16 usages to real `<h1>`/`<h2>` elements.
2. **Unannounced form-level errors** — the exact same `{formErrors.length > 0 ? <p className="text-sm text-destructive">...</p> : null}` block, with no `role`/`aria-live`, is duplicated **11 times across 8 files**. Extract one shared `FormErrorSummary` component with `role="alert"`.
3. **Missing cursor affordance** — Tailwind v4's Preflight no longer sets `cursor: pointer` on `<button>` by default (a documented v4 behavior change), and nothing in this codebase replaces it. Every button in the app currently shows the OS-default arrow cursor on hover. One-line fix in `button.tsx`'s shared `buttonVariants` base classes — directly resolves the anti-pattern `CONVENTIONS.md:1474` already names.
4. **Accessible authentication** — the login form has no `autoComplete` attribute on either field (WCAG 2.2 "Accessible Authentication (Minimum)", `ux-guidelines.csv` row 107, **Critical**). Paste is already not blocked (verified — no `onPaste`/`preventDefault` anywhere), so this is the one remaining piece.
5. **Truncated text with no way to see the full value** — 3 verified sites (`AlertTitle` via `ErrorState.tsx`, `SelectField`'s `SelectTrigger`, `CustomerContextPanel`'s timeline entry body) clip dynamic text with `line-clamp-*` and expose no `title`/tooltip.
6. **Toast error severity** — error-toned toasts currently share `role="status"`/`aria-live="polite"` with success/info toasts; give the error tone `role="alert"` for an assertive announcement.
7. **Reduced motion** — zero handling of `prefers-reduced-motion` anywhere in the codebase (`ux-guidelines.csv` row 9, High). Add one scoped global CSS rule for the Radix dialog/alert-dialog entrance/exit animations — not a blanket rule (that would also freeze the loading spinner/skeleton pulse, which should keep running per row 12/"Continuous Animation").
8. **`CONVENTIONS.md` § 25 updated** to record what was audited, fixed, confirmed-clean, or deliberately deferred — mirroring how Story 36 updated the token table's Decision column.

**Explicitly out of scope, named so it isn't silently dropped:**
- **Bulk row actions** (`ux-guidelines.csv` row 91, Low severity) — a feature addition (checkbox column + action bar on 3 list screens), not a fix; the intake's own examples (contrast, text resilience, focus states, RTL) don't include it.
- **6 standalone `SelectTrigger`/`SelectValue` usages outside `SelectField`** (`TicketAssigneeControl.tsx`, `TicketStatusControl.tsx`, filter selects in `TicketListPage.tsx`/`MyTicketsPage.tsx`/`TaskListPage.tsx`, the quick-reply picker in `TicketConversation.tsx`) — task 5 fixes the one shared form entry point (`SelectField.tsx`); these 6 are each a standalone inline control with their own local state, not routed through it. `TicketAssigneeControl.tsx` is the one with real unbounded text (agent names) and the most worth a follow-up.

---

## Context — Read These Files First

1. `.squad/stories/design-intelligence-ui-ux-system/SUPPORTOS-69/intake.md` — one task, no attachments, no acceptance criteria.
2. `SupportOs backlog.MD` lines 514-518 (`STORY (DSN-2)`) — `Dependencies: DSN-0`.
3. `CONVENTIONS.md` lines 1452-1476 (`### UX & accessibility guidance`) — the exact guideline list this story applies; task 8 edits this subsection in place.
4. `frontend/src/shared/ui/primitives/card.tsx` (76 lines) — `CardTitle` (lines 31-39), the primitive task 1 edits. `frontend/src/shared/ui/primitives/button.tsx` lines 39-60 (`Button`) for the exact `asChild`/`Slot.Root` pattern to mirror (`const Comp = asChild ? Slot.Root : 'button'`).
5. All 16 `<CardTitle` call sites (task 1's edit list): `frontend/src/features/web-form/components/WebFormPage.tsx:37,83`; `frontend/src/features/customers/components/ContactDetailsSection.tsx:66`, `AttachmentsSection.tsx:48`, `CustomerProfilePage.tsx:56`, `NotesSection.tsx:31`, `InteractionTimelineSection.tsx:30`; `frontend/src/features/live-chat/components/LiveChatWidget.tsx:55,98`; `frontend/src/features/tickets/components/InternalNotesSection.tsx:38`, `TicketDetailPage.tsx:83`, `CustomerContextPanel.tsx:33,60`, `TicketConversation.tsx:55`, `TicketHistorySection.tsx:32`, `TicketSlaSection.tsx:30`.
6. All 11 `{formErrors.length > 0 ? ...}` sites (task 2's edit list, byte-identical block at each): `frontend/src/features/auth/components/LoginPage.tsx:61`; `frontend/src/features/tasks/components/TaskFormPage.tsx:159`; `frontend/src/features/customers/components/NotesSection.tsx:133,176`, `CustomerFormPage.tsx:127`, `ContactDetailsSection.tsx:181,235`; `frontend/src/features/tickets/components/InternalNotesSection.tsx:195,247`, `TicketFormPage.tsx:184`, `TicketConversation.tsx:169`.
7. `frontend/src/shared/ui/primitives/button.tsx` line 8 (`buttonVariants`'s base class string, the exact string task 3 appends `cursor-pointer` to).
8. `frontend/src/features/auth/components/LoginPage.tsx` lines 54-60 and `frontend/src/shared/ui/form/TextField.tsx` (51 lines, full file) — task 4's edit sites; `TextField` currently has no `autoComplete` prop at all.
9. `frontend/src/shared/ui/ErrorState.tsx` line 25 (`<AlertTitle>{message}</AlertTitle>`); `frontend/src/shared/ui/form/SelectField.tsx` (full file, 58 lines) — the `SelectTrigger` at line ~46 task 5 adds a `title` to; `frontend/src/features/tickets/components/CustomerContextPanel.tsx` line 124 (`<p className="line-clamp-2 whitespace-pre-wrap">{entry.body}</p>`).
10. `frontend/src/shared/ui/toast/ToastProvider.tsx` lines 61-90 — the toast container (`role="status" aria-live="polite" aria-atomic="true"`, line 61-65) and each toast's `data-tone={toastItem.tone}` (line 67) task 6 reads to conditionally set `role`.
11. `frontend/src/index.css` — `@layer base` block (lines 130-149 as of Story 36) task 7 appends a `@media (prefers-reduced-motion: reduce)` rule to; `frontend/src/shared/ui/primitives/dialog.tsx` line 65 and `alert-dialog.tsx` line 57 for the exact `animate-in`/`animate-out`/`zoom-in-95`/`zoom-out-95`/`fade-in-0`/`fade-out-0` class names (from `tw-animate-css`) the rule targets.
12. `frontend/src/shared/ui/form/` directory listing — confirms this is the correct home for the new `FormErrorSummary.tsx` (task 2), sitting alongside `TextField.tsx`/`SelectField.tsx`/`useAppForm.ts`.

---

## Frontend Tasks

### 1 — `CardTitle` gains real heading semantics

**File: `frontend/src/shared/ui/primitives/card.tsx`** — add `Slot` import (matching `button.tsx`'s `import { Slot } from 'radix-ui'`) and `asChild` support to `CardTitle`, mirroring `Button`'s exact pattern:

```tsx
import { Slot } from 'radix-ui'

function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'
  return (
    <Comp
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  )
}
```

Default (`asChild` omitted) is unchanged — still a `<div>` — so this is additive, zero risk to any usage not touched below.

**16 call sites**, each wraps its existing text in a real heading and adds `asChild` — the `className` stays on `CardTitle` itself (Radix `Slot` merges it onto the child), so **no visual change**:

**4 page-level titles → `<h1>`** (each page currently has no other heading):
- `frontend/src/features/tickets/components/TicketDetailPage.tsx:83` — `<CardTitle asChild className="text-lg"><h1>{ticket.subject}</h1></CardTitle>`
- `frontend/src/features/customers/components/CustomerProfilePage.tsx:56` — `<CardTitle asChild className="text-lg"><h1>{customer.name}</h1></CardTitle>`
- `frontend/src/features/web-form/components/WebFormPage.tsx:37` (success state) and `:83` (form state) — each `<CardTitle asChild><h1>{t(...)}</h1></CardTitle>` (mutually exclusive states, never both render, so no duplicate-`h1` risk)
- `frontend/src/features/live-chat/components/LiveChatWidget.tsx:55` (start state) and `:98` (chat state) — same pattern, `<h1>`

**12 section-level titles → `<h2>`** (each sits inside a page that now has exactly one `<h1>` from the list above):
- `frontend/src/features/customers/components/ContactDetailsSection.tsx:66`, `AttachmentsSection.tsx:48`, `NotesSection.tsx:31`, `InteractionTimelineSection.tsx:30` (all render inside `CustomerProfilePage`)
- `frontend/src/features/tickets/components/InternalNotesSection.tsx:38`, `CustomerContextPanel.tsx:33` and `:60` (two sibling sections in one panel), `TicketConversation.tsx:55`, `TicketHistorySection.tsx:32`, `TicketSlaSection.tsx:30` (all render inside `TicketDetailPage`)

Each follows the same shape, e.g. `frontend/src/features/tickets/components/TicketSlaSection.tsx:30`:
```tsx
<CardTitle asChild className="text-lg"><h2>{t('sla.title')}</h2></CardTitle>
```

---

### 2 — Shared `FormErrorSummary` replaces 11 duplicated, unannounced error blocks

**Create file: `frontend/src/shared/ui/form/FormErrorSummary.tsx`**:

```tsx
/**
 * Form-level (unattached) server/client errors — messages `applyServerErrors`
 * could not map to a specific field (`shared/validation/serverErrors.ts`).
 * `role="alert"` (implicit assertive live region) is what the 11 duplicated
 * call sites this replaces were missing — a screen-reader user gets no
 * signal at all from a plain `<p>` that appears without a focus change.
 * See CONVENTIONS.md §25, Story 37.
 */
export function FormErrorSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors.join(' ')}
    </p>
  )
}
```

**11 call sites** — replace the block (identical at every site) with `<FormErrorSummary errors={formErrors} />` and add the import (`import { FormErrorSummary } from '@/shared/ui/form/FormErrorSummary'` — or via the `shared/ui/form` barrel if one exists, matching how each file currently imports `TextField`/`SelectField`):

`frontend/src/features/auth/components/LoginPage.tsx:61-63`; `frontend/src/features/tasks/components/TaskFormPage.tsx:159-161`; `frontend/src/features/customers/components/NotesSection.tsx:133-135,176-178`, `CustomerFormPage.tsx:127-129`, `ContactDetailsSection.tsx:181-183,235-237`; `frontend/src/features/tickets/components/InternalNotesSection.tsx:195-197,247-249`, `TicketFormPage.tsx:184-186`, `TicketConversation.tsx:169-171`.

Each replacement:
```tsx
// Before
{formErrors.length > 0 ? (
  <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
) : null}

// After
<FormErrorSummary errors={formErrors} />
```

---

### 3 — Restore `cursor-pointer` on every button

**File: `frontend/src/shared/ui/primitives/button.tsx`** line 8 — append `cursor-pointer` to `buttonVariants`'s base class string (placed with the other base interaction classes, before `disabled:pointer-events-none`):

```tsx
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ...
```

`disabled:pointer-events-none` (already present) means a disabled button never shows the pointer cursor regardless — no extra `disabled:cursor-not-allowed` needed. This one line fixes every `<Button>` usage in the app (52 occurrences) — no other file changes.

---

### 4 — Accessible authentication: `autoComplete` on the login form

**File: `frontend/src/shared/ui/form/TextField.tsx`** — add an optional `autoComplete` prop, passed through to `Input`:

```tsx
type TextFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local'
  autoComplete?: string
}

export function TextField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  type = 'text',
  autoComplete,
}: TextFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete={autoComplete}
              {...field}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

**File: `frontend/src/features/auth/components/LoginPage.tsx`** lines 54-60 — set it on both fields:

```tsx
<TextField
  control={form.control}
  name="email"
  label={t('login.email')}
  type="email"
  autoComplete="email"
/>
<TextField
  control={form.control}
  name="password"
  label={t('login.password')}
  type="password"
  autoComplete="current-password"
/>
```

No other `TextField` usage is changed — the prop is optional and every other call site keeps browser-default autocomplete behavior, unaffected.

---

### 5 — Expose full text behind truncated content

**File: `frontend/src/shared/ui/ErrorState.tsx`** line 25:
```tsx
<AlertTitle title={message}>{message}</AlertTitle>
```
(`AlertTitle` already forwards `...props` — `React.ComponentProps<'div'>` includes `title` — no primitive change needed.)

**File: `frontend/src/shared/ui/form/SelectField.tsx`** — compute the selected option's label and pass it as `title` on `SelectTrigger`:
```tsx
const selectedLabel = options.find((option) => option.value === field.value)?.label

// ...
<FormControl>
  <SelectTrigger title={selectedLabel}>
    <SelectValue placeholder={placeholder} />
  </SelectTrigger>
</FormControl>
```

**File: `frontend/src/features/tickets/components/CustomerContextPanel.tsx`** line 124:
```tsx
<p className="line-clamp-2 whitespace-pre-wrap" title={entry.body}>{entry.body}</p>
```

---

### 6 — Error toasts get an assertive announcement

**File: `frontend/src/shared/ui/toast/ToastProvider.tsx`** — the container's static `role="status" aria-live="polite"` (lines 61-65) applies to all toasts uniformly today. Since tone is per-toast (not per-container), move the live-region attributes onto each toast item instead of the container, keyed by `toastItem.tone`:

```tsx
<div className="fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2">
  {toasts.map((toastItem) => (
    <div
      key={toastItem.id}
      role={toastItem.tone === 'error' ? 'alert' : 'status'}
      aria-live={toastItem.tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-tone={toastItem.tone}
      className={cn(
        'flex items-start gap-2 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-lg',
        'data-[tone=error]:border-destructive data-[tone=error]:text-destructive',
      )}
    >
```

(Removes `role="status" aria-live="polite" aria-atomic="true"` from the outer container div, since it moves per-toast.)

---

### 7 — Respect `prefers-reduced-motion` for entrance/exit animations

**File: `frontend/src/index.css`** — append inside the existing `@layer base` block (after the `html[lang='ar'] body` rule), scoped to `tw-animate-css`'s entrance/exit utility classes only — **not** a blanket `*` rule, which would also stop `animate-spin` (`Loading.tsx:17`) and `animate-pulse` (`skeleton.tsx:7`), both legitimate continuous loading indicators per `ux-guidelines.csv` row 12 ("Continuous Animation... Use for loading indicators only"):

```css
  /* Dialog/AlertDialog/Select/DropdownMenu entrance-exit animations
     (tw-animate-css's .animate-in/.animate-out/.fade-*/.zoom-*) are the
     only non-essential motion in this app — collapse them for users who
     ask for reduced motion. animate-spin/animate-pulse (loading feedback)
     are deliberately NOT touched. See CONVENTIONS.md §25, Story 37. */
  @media (prefers-reduced-motion: reduce) {
    .animate-in,
    .animate-out {
      animation-duration: 0.01ms !important;
    }
  }
```

---

### 8 — Record the audit in `CONVENTIONS.md` § 25

**File: `CONVENTIONS.md`** — replace the "UX & accessibility guidance" subsection (lines 1452-1476) with an audited version. Keep the same heading; change the intro sentence from "nothing here is applied yet" to reflect completion, and annotate each bullet with what was found:

```markdown
### UX & accessibility guidance (from `design-system/supportos/MASTER.md` and the `ux-guidelines.csv` catalog)

Audited and applied by `DSN-2` (Story 37, `SupportOs backlog.MD:514`) against
every already-built screen:

- **Contrast:** minimum 4.5:1 for normal text (MASTER.md Pre-Delivery
  Checklist; `ux-guidelines.csv` "Color Contrast", severity High) — verified
  in Story 36 for the tokens it changed; untouched shadcn defaults were
  already compliant.
- **Error messages must be announced, not shown by color alone**
  (`ux-guidelines.csv` "Error Messages", severity High) — **fixed**: 11
  duplicated unattached-error `<p>` blocks replaced by
  `shared/ui/form/FormErrorSummary.tsx` (`role="alert"`); toast error tone
  now `role="alert"`/`aria-live="assertive"` instead of sharing `status`/
  `polite` with success toasts. Per-field `FormMessage` deliberately left
  as-is — already discoverable via `aria-describedby` + focus-on-error, and
  adding `role="alert"` there risks re-announcing on every keystroke during
  re-validation.
- **Focus states visible for keyboard navigation**, `prefers-reduced-motion`
  respected, no emoji used as icons (SVG icon set only) — focus states
  already shadcn-default-compliant across all primitives (unaudited change);
  **fixed**: reduced-motion now respected for dialog/alert-dialog/select
  entrance-exit animations (`index.css`); loading spinners/skeletons
  deliberately keep animating (`ux-guidelines.csv` "Continuous Animation").
- **Wide tables get a horizontal-scroll wrapper or card layout on mobile** —
  **confirmed already compliant**, `shared/ui/primitives/table.tsx:10`.
- **Bulk row actions** (checkbox column + action bar) — **not implemented**,
  Low severity; a feature addition, not a fix — out of scope for this story.
- **Anti-patterns to avoid:** poor navigation, no search entry point, missing
  `cursor: pointer` on clickable elements, instant (non-transitioned) state
  changes, layout-shifting hover transforms — **fixed**: `cursor-pointer`
  added to the shared `Button` base classes (Tailwind v4 Preflight no longer
  sets this by default); the rest were already compliant.

**Also audited and fixed, beyond the original bullet list above:**
- **Heading hierarchy** — `CardTitle` (`shared/ui/primitives/card.tsx`) now
  supports `asChild`; `TicketDetailPage` and `CustomerProfilePage` (and
  10 more section-level titles) render real `<h1>`/`<h2>` elements instead
  of a styled `<div>`.
- **Accessible authentication** (WCAG 2.2, `ux-guidelines.csv` row 107,
  Critical) — login form now sets `autoComplete="email"`/
  `"current-password"`; paste was already not blocked.
- **Truncated text with no full-value access** — `AlertTitle` (via
  `ErrorState`), `SelectField`'s `SelectTrigger`, and
  `CustomerContextPanel`'s timeline entry body now carry a `title` attribute.
  6 standalone `SelectTrigger` usages outside `SelectField` (ticket
  assignee/status controls, list-page filters, the quick-reply picker) are
  **not** covered — noted as a follow-up, `TicketAssigneeControl.tsx` being
  the one with real unbounded text (agent names).

**Also confirmed already compliant, no change needed:** alt text (no `<img>`
anywhere), icon-only buttons (all 5 already have `aria-label`), no bare
`div`/`span onClick` anywhere, RTL (`check-rtl.mjs`, CI-wired, zero
violations), sortable table headers (`DataTable.tsx`, already a model
implementation), field `aria-describedby`/`aria-invalid` wiring, and
touch target size (`icon-xs` = 24px, meets WCAG 2.2's minimum exactly).
```

---

## Edge Cases & Failure Modes

- **A future `shadcn add card` overwrites `CardTitle`'s `asChild` addition.** `card.tsx` lives in `shared/ui/primitives/`, the CLI-managed set (`CONVENTIONS.md` § 19); any `shadcn add card` re-run must be followed by re-applying the `asChild` change and `npm run check:rtl` (same rule already governing every other patched primitive in this project).
- **A 17th `CardTitle` usage added later without `asChild`** silently renders a `<div>` again — acceptable for a genuinely decorative label, but a page-level or section-level title added later should follow the same `asChild` + heading pattern task 1 establishes; nothing enforces this automatically (no lint rule exists for it, and adding one is out of scope).
- **`FormErrorSummary` rendering `role="alert"` on every submit retry** — if a user submits the same invalid form twice in a row, the browser/screen-reader may not re-announce identical text on a second identical render (a known, generally accepted ARIA live-region limitation, not specific to this fix) — acceptable, matches how `role="alert"` behaves everywhere else in this codebase (`Alert` primitive, `alert.tsx:30`, already has this same characteristic).
- **`autoComplete="current-password"` combined with a password manager auto-filling on page load** — no code in `LoginPage.tsx` prevents this; it is the intended, accessible behavior (WCAG 2.2 row 107's own "Do").
- **The `prefers-reduced-motion` rule targets class names (`.animate-in`/`.animate-out`), not component boundaries** — if a future component uses `tw-animate-css` utilities under different class names (e.g. a raw `fade-in-0` without the paired `animate-in`), it won't be caught; the two class names chosen are the ones `dialog.tsx`/`alert-dialog.tsx` (and Radix's own generated `data-[state=open]:animate-in` pattern used by `select.tsx`/dropdown menus, which share the same `tw-animate-css` classes) already use everywhere in this codebase — verified, not assumed.
- **Toast `role="alert"` interrupting a screen reader mid-sentence for a non-critical error** — acceptable per `ux-guidelines.csv` row 44's own explicit guidance ("Use aria-live or role=alert for errors"); success/info toasts are unaffected (`role="status"`/`polite`, unchanged).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend impact — this story touches only `frontend/` and `CONVENTIONS.md`; `python manage.py test` (from `backend/`) is unaffected. Re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass. `check:rtl` matters here specifically — task 6's toast edit and task 1's 16 JSX changes are exactly the kind of change that could accidentally introduce a physical-direction class; the script must still report zero violations.
3. Manual verification only, per `## Verification Steps` below.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **No visual regression:** `git diff` shows only `className`/attribute/JSX-wrapping changes and one new file (`FormErrorSummary.tsx`) — no token, color, or layout class removed or altered. Spot-check `TicketDetailPage`, `CustomerProfilePage`, and one create-ticket form in the running app (`npm run dev`) — visually identical to pre-Story-37.
3. **Headings are real, in the browser's own accessibility tree or DevTools Elements panel:** `TicketDetailPage` shows exactly one `<h1>` (the ticket subject) and multiple `<h2>`s (Conversation, SLA, History, Internal Notes, Customer Context ×2); `CustomerProfilePage` shows one `<h1>` (customer name) and `<h2>`s for Contacts/Attachments/Notes/Timeline; `WebFormPage` and `LiveChatWidget` each show exactly one `<h1>` regardless of which state is rendered.
4. **Cursor affordance:** hover any button anywhere in the app (light or dark mode) — cursor is a pointer/hand, not the OS-default arrow.
5. **Form-level error announcement:** trigger a form-level (non-field) error — e.g. submit `LoginPage` with a wrong password (a `non_field_errors` response) — confirm the rendered `<p>` has `role="alert"` in DevTools, and confirm visually it looks identical to before (same `text-sm text-destructive` styling).
6. **Login autocomplete:** DevTools Elements panel on `/login` shows `autocomplete="email"` and `autocomplete="current-password"` on the two inputs; a saved browser credential still offers to autofill.
7. **Truncated text has a tooltip:** hover a long error message (`ErrorState`), a select with a long selected value, and a long ticket-conversation reply in `CustomerContextPanel` — each shows the full text as a native browser tooltip.
8. **Toast severity:** trigger a success toast and an error toast (e.g. a failed mutation) — DevTools shows `role="status"`/`aria-live="polite"` on the success one and `role="alert"`/`aria-live="assertive"` on the error one.
9. **Reduced motion:** in DevTools, enable "Emulate CSS media feature prefers-reduced-motion: reduce" (Rendering tab), then open a `Dialog` and an `AlertDialog` — the zoom/fade entrance is now near-instant. With emulation off, both animate normally as before. A `Loading` spinner and a `Skeleton` still animate continuously in both cases.
10. **`CONVENTIONS.md` § 25 reads correctly:** the "UX & accessibility guidance" subsection reflects task 8's audited version — every bullet is marked fixed/confirmed-compliant/deferred, none still say "nothing here is applied yet."

---

## Done Criteria

- [ ] `card.tsx` — `CardTitle` supports `asChild`; all 16 call sites render a real `<h1>` (4 page-level) or `<h2>` (12 section-level), visually unchanged.
- [ ] `frontend/src/shared/ui/form/FormErrorSummary.tsx` created (`role="alert"`); all 11 duplicated `formErrors` blocks across 8 files replaced by it.
- [ ] `button.tsx` — `cursor-pointer` added to `buttonVariants` base classes.
- [ ] `TextField.tsx` — `autoComplete` prop added; `LoginPage.tsx` sets `autoComplete="email"`/`"current-password"` on its two fields.
- [ ] `ErrorState.tsx`, `SelectField.tsx`, `CustomerContextPanel.tsx` — `title` attribute added at each of the 3 truncation sites.
- [ ] `ToastProvider.tsx` — error-toned toasts render `role="alert"`/`aria-live="assertive"`; success/info toasts unchanged.
- [ ] `index.css` — scoped `prefers-reduced-motion` rule added for `.animate-in`/`.animate-out`; `animate-spin`/`animate-pulse` untouched.
- [ ] `CONVENTIONS.md` § 25's "UX & accessibility guidance" subsection updated to the audited version (task 8), recording fixed/confirmed-compliant/deferred status per item.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) all exit 0.
- [ ] `python manage.py test` (from `backend/`) unaffected — no backend file changed.
- [ ] Verified live in the browser per `## Verification Steps` 3-9 (headings, cursor, error announcement, autocomplete, tooltips, toast roles, reduced-motion emulation).
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-3` (Dashboard Chart Design Guidance) depends only on `DSN-0` (already complete), not on this story, and is not yet planned — it needs its own intake.
