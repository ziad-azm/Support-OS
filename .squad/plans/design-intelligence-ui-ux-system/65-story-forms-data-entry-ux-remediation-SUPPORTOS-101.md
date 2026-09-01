# Story 65 — (DSN-10) Forms & Data-Entry UX Remediation (Story: SUPPORTOS-101)

## Prerequisites

- **`DSN-6` (Story 61) is complete.** `design-system/supportos/UX-AUDIT.md` exists with 68 rows; this story consumes the 6 rows whose **Category** column is `form` (fixed mapping: `form`→`DSN-10`): `UX-010, UX-011, UX-018, UX-026, UX-051, UX-060`.
- **Three of intake Task 1's four named sub-goals are already met — verified, not assumed, no code touched for them:**
  - **Validation trigger timing.** `frontend/src/shared/ui/form/useAppForm.ts:44-47` passes no `mode` to `useForm`, so react-hook-form's own defaults apply: `mode: 'onSubmit'` (nothing validates before a first submit attempt — never "aggressive on-change") and `reValidateMode: 'onChange'` (once a field has failed, it re-checks as the user retypes — immediate confirmation the fix worked). This already matches "on-blur/submit, not aggressive on-change"; switching `reValidateMode` to `'onBlur'` would make fixing an error *slower* to confirm, not more forgiving. Not changed.
  - **Localized inline messages.** `frontend/src/shared/validation/errorMap.ts` is a complete `zodErrorMap` reading every message through `i18next.getFixedT(null, 'validation')` (line 23), covering `required`/`too_small`/`too_big`/`invalid_type`/`invalid_format`/`invalid_value`/`not_multiple_of`, with `useAppForm.ts:52-60` re-triggering validation on a language change so a switch retranslates already-shown errors. Fully built; not touched.
  - **Error summary + focus-first-error.** Both already shipped by `DSN-2` (Story 37): `shared/ui/form/FormErrorSummary.tsx` (`role="alert"`) and react-hook-form's default `shouldFocusError` plus `shared/validation/serverErrors.ts`'s `applyServerErrors` (`form.setFocus`). Not touched.
- **The fourth sub-goal — "consistent submit/pending/disabled states" — is genuinely broken and is this story's largest task, logged as a new finding (`UX-069`).** `grep -rn 'type="submit".*disabled=\{.*[Pp]ending\}' frontend/src` finds **23** submit buttons across the app. `DSN-8` (Story 63, `UX-062`) added a spinner + "Submitting…" label to exactly 2 of them (`PortalTicketFormPage.tsx`, `PortalFeedbackFormPage.tsx`) — leaving those 2 visibly different from the other 21, a new inconsistency `DSN-8` itself introduced. No shared `SubmitButton` component exists; every site hand-writes `<Button type="submit" disabled={mutation.isPending}>`. This is exactly intake Task 1's "consistent submit/pending/disabled states in the shared... field components... Outcome: every form in the app gets consistent... data-entry UX from one change" — implemented here as a genuinely shared, low-risk, mechanical fix (not a new feature, unlike `DSN-9`'s bulk-row-actions scope-out), so it is applied to all 23 sites, not a narrowed subset.
- **`UX-018`'s literal recommended fix is corrected during planning.** The register's primary suggestion — a searchable combobox — requires a `Popover`/`Command` primitive pair this codebase does not have (`Glob frontend/src/shared/ui/primitives/{command,popover}.tsx` → no matches) and the `cmdk` library shadcn's combobox recipe is built on (`grep cmdk frontend/package.json` → no match). Adding it would break this codebase's own established "no new dependency" bias (`CONVENTIONS.md`, cited repeatedly for prior stories, e.g. Story 53's singleton-model reasoning). The register's own fallback — "at minimum show a 'showing first 100, search by name' hint" — is implemented instead; the full combobox is named as a deferred follow-up requiring an explicit dependency decision, not attempted here.
- **Field grouping/order review (intake Task 2) found no defect to fix.** A spot-check of every form named in this story's other tasks (`WebFormPage`, `TicketFormPage`, `PortalFeedbackFormPage`, `LoginPage`) shows fields already flow in a logical order (identity → contact → subject/details → category, or equivalent) — no register finding names a field-order problem, and none is invented here. **Autofocus, which the intake does name explicitly, has zero existing usage anywhere in the app** (`grep -rn "autoFocus" frontend/src` → no matches) — added to the one highest-value, lowest-risk target: `LoginPage.tsx`'s email field, the very first interaction of an authenticated session. This is a value-add the intake names directly, not a catalogued defect, so no new register ID is created for it.

---

## Story Goal

Resolve all 6 `form`-category register rows (one, `UX-018`, with a corrected fix), plus one new finding (`UX-069`) that directly implements intake Task 1's "consistent submit/pending/disabled states," plus one intake-named value-add (`LoginPage` autofocus, no register ID). Every fix lands at the shared-component level per the `DSN-6`–`DSN-13` guardrail (frontend-only, no data-flow changes, no new dependency).

**Disposition table:**

| ID | Severity | Disposition |
|---|---|---|
| `UX-010` | minor | Fixed — `WebFormPage`'s category `SelectField` gets `disabled` while loading and an inline error description, both via `SelectField`'s existing props (no shared-component change needed) |
| `UX-011` | minor | Fixed — shared `TextareaField` gains an optional `maxLength` prop (sets the native HTML attribute + a live character counter); wired into `WebFormPage`'s description field |
| `UX-018` | major | Fixed with a corrected approach — a "showing first 100, search by name" hint via `SelectField`'s existing `description` prop; full searchable combobox deferred (needs a new dependency) |
| `UX-026` | minor | Fixed — `MarkdownField` gains a "Markdown supported" helper line with a link to CommonMark's reference |
| `UX-051` | minor | Fixed — all 5 report pages' "to" date input gets `min={from \|\| undefined}` |
| `UX-060` | minor | Fixed — `PortalFeedbackFormPage` ships with no pre-selected rating; submitting without a choice is now a real validation error |
| `UX-069` (new) | major | Fixed — new shared `SubmitButton` component (spinner + optional pending-label swap, forwards `Button` props); applied to all 23 submit-button sites app-wide, including simplifying the 2 `DSN-8` sites onto the same shared component |

**Not in scope:** anything outside these 7 items; a full searchable combobox for `UX-018` (deferred, needs a dependency decision); any backend/API change; re-deriving already-compliant validation timing/localization/error-summary behavior.

---

## Context — Read These Files First

1. `design-system/supportos/UX-AUDIT.md` — the 6 `form` rows this story implements; task 9 adds `UX-069`.
2. `SupportOs backlog.MD` lines 556, 594-600 (guardrail + `DSN-10` story text).
3. `frontend/src/shared/ui/form/useAppForm.ts` (63 lines, full file) and `frontend/src/shared/validation/errorMap.ts` (67 lines, full file) — the already-compliant validation-timing/localization behavior cited in `## Prerequisites`, not touched.
4. `frontend/src/shared/ui/form/index.ts` (9 lines, full file) — task 1's barrel-export edit site.
5. `frontend/src/shared/ui/form/TextareaField.tsx` (40 lines, full file) and `frontend/src/shared/ui/primitives/textarea.tsx` (18 lines) — task 2's edit site.
6. `frontend/src/features/web-form/components/WebFormPage.tsx` lines 103-130 — tasks 2 and 3's edit sites.
7. `frontend/src/features/knowledge-base/components/MarkdownField.tsx` (42 lines, full file) — task 4's edit site.
8. `frontend/src/features/tickets/components/TicketFormPage.tsx` lines 155-179 — task 5's edit site.
9. `frontend/src/features/reports/components/TicketReportsPage.tsx` line 129, `SlaReportsPage.tsx` line 106, `AgentReportsPage.tsx` line 74, `CsatReportsPage.tsx` line 102, `ManagementDashboardPage.tsx` line 61 — task 6's 5 edit sites (each a `to` date `Input`; `from` is already in scope at each file).
10. `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx` line 46 (`defaultValues`) — task 7's edit site.
11. `frontend/src/features/auth/components/LoginPage.tsx` lines 63-69 (the email `TextField`) — task 8's edit site.
12. `frontend/src/shared/ui/Loading.tsx` lines 1, 17 (`Loader2Icon` + `animate-spin`, the pattern to reuse) — task 9's new-component source pattern; the 23 call sites listed in task 9's table.

---

## Frontend Tasks

### 1 — `WebFormPage`'s category select shows loading/error state (`UX-010`)

**File: `frontend/src/features/web-form/components/WebFormPage.tsx`** lines 118-126 — both fixes use `SelectField`'s existing `disabled`/`description` props, already supported by the shared component (`shared/ui/form/SelectField.tsx:38,64`) with no change needed there:

```tsx
<SelectField
  control={form.control}
  name="category"
  label={t('fields.category')}
  disabled={categoriesQuery.isLoading}
  description={categoriesQuery.isError ? t('fields.categoryLoadError') : undefined}
  options={[
    { value: CATEGORY_NONE, label: t('fields.noCategory') },
    ...categoryOptions,
  ]}
/>
```

Add `fields.categoryLoadError` to `frontend/src/features/web-form/locales/en.json`/`ar.json` (alongside the existing `fields.category`/`fields.noCategory` keys): `"Could not load categories. You can still submit without one."`.

---

### 2 — `TextareaField` gains an optional `maxLength` + counter (`UX-011`)

**File: `frontend/src/shared/ui/form/TextareaField.tsx`** — add an optional `maxLength` prop, passed to the native `Textarea` and rendered as a live counter:

```tsx
import type { FieldValues } from 'react-hook-form'

import { Textarea } from '@/shared/ui/primitives/textarea'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

/** `Textarea` is a real DOM element, so `{...field}` composes directly. */
export function TextareaField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  maxLength,
}: FieldProps<TFieldValues> & { maxLength?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea placeholder={placeholder} disabled={disabled} maxLength={maxLength} {...field} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          {maxLength ? (
            <p className="text-end text-xs text-muted-foreground">
              {String(field.value ?? '').length}/{maxLength}
            </p>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

`maxLength` is optional and additive — every other `TextareaField` call site (no `maxLength` passed) renders identically to today, no visual change. `text-end` (logical, not physical) for RTL correctness, matching every other alignment utility in this codebase.

**File: `frontend/src/features/web-form/components/WebFormPage.tsx`** lines 113-117 — wire the one call site the register names, matching the schema's own cap (`webFormSchema`'s `description: requiredString(5000)`):

```tsx
<TextareaField
  control={form.control}
  name="description"
  label={t('fields.description')}
  maxLength={5000}
/>
```

---

### 3 — `MarkdownField` gets a syntax-reference helper line (`UX-026`)

**File: `frontend/src/features/knowledge-base/components/MarkdownField.tsx`** — inside the `"write"` `TabsContent` (lines 28-30), add a helper line below the textarea:

```tsx
<TabsContent value="write">
  <TextareaField control={control} name={name} label={label} />
  <p className="mt-1 text-xs text-muted-foreground">
    {t('articles.manage.editorTabs.markdownSupported')}{' '}
    <a
      href="https://commonmark.org/help/"
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {t('articles.manage.editorTabs.markdownGuide')}
    </a>
  </p>
</TabsContent>
```

Add `articles.manage.editorTabs.markdownSupported`/`markdownGuide` to `frontend/src/features/knowledge-base/locales/en.json`/`ar.json` (alongside the existing `editorTabs.write`/`preview`/`previewEmpty` keys): `"Markdown is supported."` / `"Syntax guide"`. `react-markdown` (already used by `MarkdownPreview.tsx`) is CommonMark-based, so CommonMark's own reference is the exact match for what this editor actually renders — not an arbitrary external link.

---

### 4 — `TicketFormPage`'s customer select gets a truncation hint (`UX-018`, corrected)

**File: `frontend/src/features/tickets/components/TicketFormPage.tsx`** lines 166-171:

```tsx
<SelectField
  control={form.control}
  name="customer"
  label={t('fields.customer')}
  description={t('fields.customerSearchHint')}
  options={customerOptions}
/>
```

Add `fields.customerSearchHint` to `frontend/src/features/tickets/locales/en.json`/`ar.json` (alongside the existing `fields.customer` key): `"Showing the first 100 customers. If you don't see the one you need, ask an admin or check the customer list."`. A full searchable combobox is **not** built — see `## Prerequisites`.

---

### 5 — Report date-range "to" inputs enforce `min` (`UX-051`)

**Files, one identical change each:**

- `frontend/src/features/reports/components/TicketReportsPage.tsx` line 129
- `frontend/src/features/reports/components/SlaReportsPage.tsx` line 106
- `frontend/src/features/reports/components/AgentReportsPage.tsx` line 74
- `frontend/src/features/reports/components/CsatReportsPage.tsx` line 102
- `frontend/src/features/reports/components/ManagementDashboardPage.tsx` line 61

Each is a `<Input id="...-to" type="date" value={to} onChange={...} />` — add `min={from || undefined}` (each file already has `from` in scope, confirmed by reading all 5 for this plan):

```diff
  <Input
    id="report-to"
    type="date"
    value={to}
    onChange={(event) => setTo(event.target.value)}
+   min={from || undefined}
  />
```

---

### 6 — `PortalFeedbackFormPage` ships with no pre-selected rating (`UX-060`)

**File: `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx`** line 46:

```diff
  const form = useAppForm({
    schema,
-   defaultValues: { rating: 'satisfied', comment: '' },
+   defaultValues: { rating: undefined, comment: '' },
  })
```

`useAppForm`'s `defaultValues` type is react-hook-form's `DefaultValues<z.output<TSchema>>` (a deep-partial), so `rating: undefined` type-checks with no cast needed. `RadioGroup value={field.value}` (`RadioGroupField.tsx:45`) already handles an `undefined` value correctly — no item renders checked. Submitting with `rating` still `undefined` fails `choice(PORTAL_FEEDBACK_RATINGS)`'s required-enum validation, surfacing the existing `FormMessage` error and forcing an explicit choice.

---

### 7 — `LoginPage`'s email field autofocuses (intake Task 2, no register ID)

**File: `frontend/src/features/auth/components/LoginPage.tsx`** lines 63-69 — add `autoFocus` to the email `TextField`:

```tsx
<TextField
  control={form.control}
  name="email"
  label={t('login.email')}
  type="email"
  autoComplete="email"
  autoFocus
/>
```

`TextField`'s underlying `Input` is a real DOM element (`{...field}` composes directly, per `TextField.tsx`'s own pattern) — `autoFocus` passes straight through as a native HTML attribute, no shared-component change needed.

---

### 8 — Shared `SubmitButton`: consistent pending state on every submit button (`UX-069`)

**Create file: `frontend/src/shared/ui/form/SubmitButton.tsx`**:

```tsx
import type { ComponentProps, ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'

import { Button } from '@/shared/ui/primitives/button'

type SubmitButtonProps = {
  pending: boolean
  /** Shown instead of `children` while `pending` is true. Omit to keep the
   *  same label and rely on the spinner + disabled state alone. */
  pendingLabel?: ReactNode
  /** A leading icon shown when NOT pending — replaced by the spinner while
   *  pending, never shown alongside it. */
  icon?: ReactNode
  children: ReactNode
} & Omit<ComponentProps<typeof Button>, 'type' | 'disabled' | 'children'>

/** The one submit-button pattern for every form in the app — spinner +
 *  disabled while a mutation is pending, reusing the same `Loader2Icon`/
 *  `animate-spin` pattern `shared/ui/Loading.tsx` already established.
 *  See CONVENTIONS.md's DSN-10 entry. */
export function SubmitButton({
  pending,
  pendingLabel,
  icon,
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <Loader2Icon className="animate-spin" /> : icon}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}
```

**File: `frontend/src/shared/ui/form/index.ts`** — add the export:

```diff
  export { FileField } from './FileField'
+ export { SubmitButton } from './SubmitButton'
```

**Apply to all 23 sites.** Each becomes `<SubmitButton pending={<mutation>.isPending} ...same-other-props>{<same label>}</SubmitButton>`, importing `SubmitButton` from `@/shared/ui/form`. Two sites (`WebFormPage`, `LiveChatWidget`) pass their existing leading icon via the new `icon` prop instead of as a JSX child; two sites (the `DSN-8`-added ones) drop their bespoke inline spinner JSX in favor of `pendingLabel`:

| File | Line | Pending source | `icon` | `pendingLabel` | Label (unchanged) |
|---|---|---|---|---|---|
| `features/auth/components/LoginPage.tsx` | 78 | `mutation.isPending` | — | — | `t('login.submit')` |
| `features/web-form/components/WebFormPage.tsx` | 127 | `mutation.isPending` | `<SendIcon />` | — | `t('action')` |
| `features/live-chat/components/LiveChatWidget.tsx` | 82 | `mutation.isPending` | `<MessageCircleIcon />` | — | `t('start.action')` |
| `features/accounts/components/UserFormPage.tsx` | 165 | `createMutation.isPending` | — | — | `t('users.actions.save')` |
| `features/accounts/components/UserFormPage.tsx` | 261 | `updateMutation.isPending` | — | — | `t('users.actions.save')` |
| `features/accounts/components/RoleFormPage.tsx` | 230 | `mutation.isPending` | — | — | `t('roles.actions.save')` |
| `features/customers/components/NotesSection.tsx` | 136 | `mutation.isPending` | — | — | `t('notes.actions.add')` |
| `features/customers/components/NotesSection.tsx` | 178 | `mutation.isPending` | — | — | `t('notes.actions.save')` |
| `features/customers/components/CustomerFormPage.tsx` | 128 | `mutation.isPending` | — | — | `t('actions.save')` |
| `features/customers/components/ContactDetailsSection.tsx` | 184 | `mutation.isPending` | — | — | `t('contacts.actions.add')` |
| `features/customers/components/ContactDetailsSection.tsx` | 237 | `mutation.isPending` | — | — | `t('contacts.actions.save')` |
| `features/customers/components/AttachmentsSection.tsx` | 174 | `mutation.isPending` | — | — | `t('attachments.actions.upload')` |
| `features/portal/components/PortalTicketFormPage.tsx` | 67 | `mutation.isPending` | — | `t('tickets.submitting')` | `t('tickets.actions.submit')` |
| `features/portal/components/PortalFeedbackFormPage.tsx` | 89 | `mutation.isPending` | — | `t('tickets.feedback.submitting')` | `t('tickets.feedback.actions.submit')` |
| `features/tickets/components/CategoryFormPage.tsx` | 109 | `mutation.isPending` | — | — | `t('categories.actions.save')` |
| `features/tickets/components/InternalNotesSection.tsx` | 198 | `mutation.isPending` | — | — | `t('internalNotes.actions.add')` |
| `features/tickets/components/InternalNotesSection.tsx` | 249 | `mutation.isPending` | — | — | `t('internalNotes.actions.save')` |
| `features/tickets/components/TicketConversation.tsx` | 172 | `mutation.isPending` | — | — | `t('conversation.actions.send')` |
| `features/tickets/components/TicketFormPage.tsx` | 191 | `mutation.isPending` | — | — | `t('actions.save')` |
| `features/organization/components/SettingsPage.tsx` | 204 | `mutation.isPending` | — | — | `t('settings.actions.save')` |
| `features/tasks/components/TaskFormPage.tsx` | 167 | `mutation.isPending` | — | — | `t('actions.save')` |
| `features/knowledge-base/components/ArticleFormPage.tsx` | 209 | `mutation.isPending` | — | — | `t('articles.manage.actions.save')` |
| `features/knowledge-base/components/FaqFormPage.tsx` | 112 | `mutation.isPending` | — | — | `t('manage.actions.save')` |

Example (a plain site, `CategoryFormPage.tsx:109`):

```diff
- <Button type="submit" disabled={mutation.isPending}>
-   {t('categories.actions.save')}
- </Button>
+ <SubmitButton pending={mutation.isPending}>
+   {t('categories.actions.save')}
+ </SubmitButton>
```

Example (an icon + `className`/`size` site, `WebFormPage.tsx:127`):

```diff
- <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full">
-   <SendIcon />
-   {t('action')}
- </Button>
+ <SubmitButton pending={mutation.isPending} size="lg" className="w-full" icon={<SendIcon />}>
+   {t('action')}
+ </SubmitButton>
```

Example (a `DSN-8`-added pending-label site, `PortalTicketFormPage.tsx:66-69`):

```diff
- <Button type="submit" disabled={mutation.isPending}>
-   {mutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
-   {mutation.isPending ? t('tickets.submitting') : t('tickets.actions.submit')}
- </Button>
+ <SubmitButton pending={mutation.isPending} pendingLabel={t('tickets.submitting')}>
+   {t('tickets.actions.submit')}
+ </SubmitButton>
```

(Remove the now-unused `Loader2Icon` import from `PortalTicketFormPage.tsx`/`PortalFeedbackFormPage.tsx` — it was added solely for this inline pattern in `DSN-8`.)

**At each of the other 21 sites**, after swapping, check whether the file's `Button` import is still used elsewhere (a Cancel button from `DSN-8`, a `PageHeader` action, a delete button) — remove the import only if this was its sole usage. `tsconfig.app.json`'s `noUnusedLocals: true` fails the build on an unused import, so this is self-checking at `npm run build` time, not something to guess at per file.

---

### 9 — Register bookkeeping

**File: `design-system/supportos/UX-AUDIT.md`** — set Status for the 6 existing `form` rows to `Resolved (Story 65)` (`UX-018` gets the note "corrected — hint-only, full combobox deferred (needs a new dependency), see reasoning" appended to its Finding column). Append one new row after `UX-068`:

```markdown
| UX-069 | App-wide — 23 submit-button sites (see Story 65's own task 8 table) | form | major | Discovered during Story 65 (`DSN-10`) planning: `grep -rn 'type="submit".*disabled=\{.*[Pp]ending\}' frontend/src` finds 23 submit buttons; `DSN-8` (`UX-062`) added a spinner + label swap to only 2 of them (`PortalTicketFormPage.tsx`, `PortalFeedbackFormPage.tsx`), leaving those 2 visibly inconsistent with the other 21 — an inconsistency `DSN-8` itself introduced. No shared `SubmitButton` component existed. | Add `shared/ui/form/SubmitButton.tsx` (spinner + optional pending-label swap, forwards `Button` props); apply to all 23 sites app-wide, including refactoring the 2 `DSN-8` sites onto the same shared component. | DSN-10 | Resolved (Story 65) |
```

Update the header summary (`**Totals: 68 findings**...`) to `**Totals: 69 findings**` with the new severity/owning-story tallies (`DSN-10` goes from 6 to 7; 1 more `major`), and add a `**Story 65 (DSN-10)...**` line matching the prior stories' summary-line format.

---

## Edge Cases & Failure Modes

- **`UX-069`'s `SubmitButton` disables the button while `pending` is true, same as every site already did** — no behavior change to the disabled state itself, only the addition of a spinner/label. A mutation that resolves in well under a second (most of these) will show the spinner only briefly; this is expected and matches how `Loading.tsx`'s spinner already behaves elsewhere.
- **`icon` is only shown when NOT pending** — a site passing `icon` but no distinct pending visual would otherwise show its icon AND a spinner simultaneously; the component's own `{pending ? <Loader2Icon .../> : icon}` branch prevents this by construction. Do not add an icon inline inside `children` for a site that also wants pending-aware icon behavior — pass it via `icon`.
- **`TextareaField`'s new `maxLength` sets the native HTML attribute, which prevents typing past the limit** — this is stronger than Zod's own `too_big` check (which would only fire after the fact); for `WebFormPage`'s `description` field this means the Zod `too_big` branch becomes unreachable in practice, which is the intended, stronger prevention-over-detection behavior, not a redundancy to clean up.
- **`PortalFeedbackFormPage`'s `rating: undefined` default interacts with `RadioGroupField`'s `FormMessage`** — confirm the "required" error message reads sensibly for a radio group (not just text-field phrasing); the shared `zodErrorMap`'s `required` copy (`errorMap.ts:28-31`) is generic ("This field is required") and already used for every other required-field type in the app, so no new copy is needed.
- **A future form adds a new submit button without discovering `SubmitButton`** — nothing enforces this automatically (no lint rule forbids a bare `<Button type="submit">`); this is the same category of drift risk every other `DSN` shared-component fix in this project carries, not a gap unique to this task.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend impact — every task is frontend-only or a documentation edit (`UX-AUDIT.md`). `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — `npm run build` specifically catches any unused `Button` import left behind by task 8's 23-site refactor (`noUnusedLocals: true`).
3. Manual verification only beyond that, per `## Verification Steps` below.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Category select loading/error state:** on `/contact`, throttle the network so `useWebFormCategories()` stays pending briefly — the category select is disabled during that window; simulate a failed categories fetch — the inline "could not load" description appears, the form remains submittable.
3. **Description counter:** on `/contact`, type into the description field — a live `N/5000` counter appears below it, and typing stops accepting new characters at exactly 5000.
4. **Markdown helper:** on `/knowledge-base/articles/manage/new`, the "Write" tab shows a "Markdown is supported" line with a working link to `https://commonmark.org/help/`.
5. **Customer select hint:** on `/tickets/new`, the customer field shows the "showing first 100" hint text beneath it.
6. **Report date validation:** on any of the 5 report pages, pick a "from" date, then try to pick an earlier "to" date — the date picker's own `min` constraint prevents it.
7. **Feedback rating:** open a portal ticket's feedback form — no rating is pre-selected; submitting without picking one shows a validation error instead of silently succeeding with "Satisfied."
8. **Login autofocus:** load `/login` fresh — the email field has visible keyboard focus with no click needed.
9. **Submit-button consistency:** spot-check at least 5 of the 23 sites across different features (e.g. `/login`, `/contact`, `/tickets/new`, `/categories/new`, `/portal/tickets/new`) with a throttled network — every one shows a spinner (and, for the 2 portal forms, the "Submitting…" label) while pending, and is disabled during that window.
10. **`UX-AUDIT.md` register:** all 6 original `form` rows show `Resolved (Story 65)`; `UX-069` is present as a new row; the header summary reflects 69 total findings.

---

## Done Criteria

- [ ] `WebFormPage.tsx` — category `SelectField` gets `disabled`/`description`; `fields.categoryLoadError` key added (`en`/`ar`).
- [ ] `TextareaField.tsx` — optional `maxLength` prop + counter added; `WebFormPage.tsx`'s description field wired with `maxLength={5000}`.
- [ ] `MarkdownField.tsx` — syntax-reference helper line added; new locale keys added (`en`/`ar`).
- [ ] `TicketFormPage.tsx` — customer `SelectField` gets the truncation-hint `description`; `fields.customerSearchHint` key added (`en`/`ar`).
- [ ] All 5 report pages' "to" date input has `min={from || undefined}`.
- [ ] `PortalFeedbackFormPage.tsx` — `rating` default is `undefined`, not `'satisfied'`.
- [ ] `LoginPage.tsx` — email field has `autoFocus`.
- [ ] `shared/ui/form/SubmitButton.tsx` created and exported from `shared/ui/form/index.ts`; all 23 sites listed in task 8's table use it; no leftover unused `Button`/`Loader2Icon` imports.
- [ ] `design-system/supportos/UX-AUDIT.md` — all 6 original `form` rows `Resolved (Story 65)`; `UX-069` added; header summary updated to 69 total findings.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `design-system/supportos/UX-AUDIT.md` only (plus this plan's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-9, in both `en`/LTR and `ar`/RTL.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-11` through `DSN-13` (`SupportOs backlog.MD:602-630`) remain unplanned — each consumes a different category of `UX-AUDIT.md` findings and needs its own intake. `UX-018`'s full searchable-combobox alternative still needs a product decision on adding a `Popover`/`Command`/`cmdk` dependency before it can be attempted.
