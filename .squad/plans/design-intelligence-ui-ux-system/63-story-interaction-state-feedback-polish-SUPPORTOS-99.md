# Story 63 — (DSN-8) Interaction, State & Feedback Polish (Story: SUPPORTOS-99)

## Prerequisites

- **`DSN-6` (Story 61) is complete** and **`DSN-7` (Story 62) is complete.** `design-system/supportos/UX-AUDIT.md` exists with 66 rows; this story consumes the 18 rows whose **Category** column is `interaction` (fixed mapping: `interaction`→`DSN-8`): `UX-004, UX-005, UX-006, UX-007, UX-009, UX-016, UX-017, UX-025, UX-028, UX-039, UX-040, UX-043, UX-046, UX-049, UX-052, UX-053, UX-055, UX-062`.
- **The `DSN-6`–`DSN-13` thread guardrail is binding** (`SupportOs backlog.MD:556`): frontend-only, no data-flow/API/route-logic changes. Verified during planning, three of the 18 findings' literal recommended fixes cannot be implemented as written:
  - **`UX-007`** (fetch prior chat history on session resume) — `MessageViewSet` (`backend/apps/communications/views.py:32-48`) is gated behind `Permissions.TICKETS_VIEW` for `list`/`retrieve`, a staff-only permission. No public, session-token-scoped message-read endpoint exists anywhere in `backend/apps/communications/` (confirmed via `urls.py:1-37` — only `live-chat/start/`, `web-form/categories/`, `web-form/submit/`, and the staff-gated `messages/` router are registered). Fetching history requires a new backend endpoint. **Deferred.**
  - **`UX-039`**'s literal "fetch/display a usage count" needs a new backend field or endpoint — neither `Role` (`frontend/src/features/accounts/types/role.ts:2-11`) nor `Category` (`frontend/src/features/tickets/types/category.ts:5-10`) serializer returns one. **Corrected**: implemented as a copy-only fix instead (see task 9).
  - **`UX-040`** is a **verified false positive**. `backend`... no — this is frontend: `shared/lib/api/queryClient.ts:46-49` configures `mutationCache: new MutationCache({ onError: handle })` with the comment "Mutations always toast: they are user-initiated, so silence reads as success" — every `useMutation` failure is toasted globally, with or without a local `onError`. Confirmed `useDeleteRole`/`useDeleteCategory`/`useDeleteTask` (`frontend/src/features/accounts/api/useRoleMutations.ts:34-40` and siblings) are all real `useMutation` calls, not bare async functions — they already get this treatment. No code change.
- **`UX-016` and `UX-028` (bulk row actions) are out of this story's scope, by choice, not by guardrail.** Both are frontend-feasible (a bulk delete can loop the existing per-row delete mutation client-side, no new backend endpoint required), but `DSN-2` (Story 37, `CONVENTIONS.md` § 25) and `DSN-6` (Story 61) both already characterized bulk row actions as "a feature addition, not a fix" — they fit none of `DSN-8`'s four named sub-categories (`SupportOs backlog.MD:577`: hover/focus/active/disabled states, transitions, spinner-vs-skeleton, toast/confirm-dialog consistency). Building a shared bulk-selection `DataTable` capability across 5 list screens is a scope unto itself. Left `Open` in the register with this reasoning recorded (task 15), not silently dropped.
- **Intake Task 1's primitive-level goal is already met — verified, not assumed.** `frontend/src/shared/ui/primitives/button.tsx:8` already carries `hover:-translate-y-px active:translate-y-0` (default/destructive/secondary variants), `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`, and `disabled:pointer-events-none disabled:opacity-50`, all inside a `transition-all duration-200` base class (Story 51/`DSN-5`'s primitive-polish pass, `CONVENTIONS.md` § 25). `input.tsx:11-13` and `select.tsx` (lines 37, 62) carry the identical `focus-visible`/`disabled`/hover pattern. No register finding flags a primitive-level gap here — `DSN-1`/`DSN-2`/`DSN-5` already closed it. No task in this plan re-touches `button.tsx`/`input.tsx`/`select.tsx`.
- **`design-system/supportos/UX-AUDIT.md` gains further Status updates and one register-bookkeeping addendum** (task 15) recording the `UX-016`/`UX-028` scope decision, per the same pattern `DSN-7` established.

---

## Story Goal

Resolve 14 of the 18 `interaction`-category rows, confirm 1 verified false positive (`UX-040`, no code change), defer 1 for a real backend gap (`UX-007`), and record 2 as explicitly out of this story's scope by product judgment (`UX-016`, `UX-028`). Every fix lands at the shared-component or single-file level per the `DSN-6`–`DSN-13` guardrail.

**Disposition table:**

| ID | Severity | Disposition |
|---|---|---|
| `UX-004` | minor | Fixed — add a support-contact line to `LoginPage` |
| `UX-005` | critical | Fixed — `StartForm` converted to `useMutation`, gets the global error toast |
| `UX-006` | major | Fixed — `ChatPane` tracks socket connection state, shows disconnected UI, guards send |
| `UX-007` | major | **Deferred** — needs a new session-token-scoped backend endpoint |
| `UX-009` | critical | Fixed — `WebForm` converted to `useMutation`, gets the global error toast |
| `UX-016` | minor | **Out of scope** — feature addition, not state/feedback polish (see `## Prerequisites`) |
| `UX-017` | major | Fixed — transitions to a terminal status (no outgoing transitions) route through `useConfirm()` |
| `UX-025` | major | Fixed — shared unsaved-changes navigation guard on `FaqFormPage`/`ArticleFormPage` |
| `UX-028` | minor | **Out of scope** — same reasoning as `UX-016` |
| `UX-039` | major | Fixed with a corrected approach — `roles.delete.description` copy now names the consequence, matching `categories.delete.description`'s existing pattern; no live count (no API source) |
| `UX-040` | major | **Verified false positive** — global `MutationCache.onError` already toasts every mutation failure; no code change |
| `UX-043` | minor | Fixed — "select all in group" added to `RoleFormPage`'s permission checklist |
| `UX-046` | minor | Fixed — Cancel button added to `UserFormPage`, `RoleFormPage`, `CategoryFormPage`, `TaskFormPage` |
| `UX-049` | major | Fixed — `ChartFrame`'s export action is gated on `query.isSuccess && !isEmpty`, fixing all 5 report pages at once |
| `UX-052` | minor | Fixed — a shared date-range preset control added to all 5 report pages' filter bars |
| `UX-053` | major | Fixed — `StringListField`'s remove control gets an `aria-label` and the shared `Button` primitive |
| `UX-055` | critical | Fixed — all 3 `RouteErrorBoundary` branches gain a "Go home" action; `ErrorState` branch gets `onRetry` |
| `UX-062` | minor | Fixed — `PortalTicketFormPage`/`PortalFeedbackFormPage` submit buttons show a spinner + "Submitting…" label while pending, reusing `Loading.tsx`'s existing `Loader2Icon`/`animate-spin` pattern |

**Not in scope:** anything outside these 18 rows; any backend/API change; a shared bulk-selection `DataTable` capability (deliberately deferred, see above); re-touching `button.tsx`/`input.tsx`/`select.tsx` (already compliant).

---

## Context — Read These Files First

1. `design-system/supportos/UX-AUDIT.md` — the 18 `interaction` rows this story implements.
2. `SupportOs backlog.MD` lines 556, 574-580 (guardrail + `DSN-8` story text).
3. `frontend/src/shared/lib/api/queryClient.ts` (56 lines, full file) — the `MutationCache` global-toast contract task-by-task fixes rely on (and that makes `UX-040` a false positive).
4. `frontend/src/features/auth/components/LoginPage.tsx` lines 85-98 (the existing "contact/chat" footer block) — task 1's edit site; mirror its exact `Link` styling.
5. `frontend/src/features/live-chat/components/LiveChatWidget.tsx` (full file, 189 lines) — tasks 2 and 3's edit site (`StartForm.onSubmit` lines 49-59; `ChatPane`'s `WebSocket` effect lines 106-116 and `onSubmit` lines 122-125).
6. `frontend/src/features/web-form/components/WebFormPage.tsx` (full file, 144 lines) — task 4's edit site (`WebForm.onSubmit` lines 75-89).
7. `frontend/src/features/tickets/components/TicketStatusControl.tsx` (full file, 61 lines) and `frontend/src/features/tickets/types/ticket.ts` lines 15-20 (`TICKET_STATUS_TRANSITIONS`, confirms `closed: []`) — task 5's edit site; `frontend/src/features/tickets/components/TicketDetailPage.tsx` lines 42-70 (`handleDelete`/`handleToggleEscalation`) — the exact `useConfirm()` pattern to mirror.
8. `frontend/src/features/knowledge-base/components/FaqFormPage.tsx` (full file, 113 lines) and `frontend/src/features/knowledge-base/components/ArticleFormPage.tsx` (full file, 211 lines) — task 6's edit sites.
9. `frontend/src/features/accounts/components/RoleListPage.tsx` lines 27-37 and `frontend/src/features/tickets/locales/en.json`/`ar.json` `categories.delete.description` (already informative) vs `frontend/src/features/accounts/locales/en.json`/`ar.json` `roles.delete.description` (generic) — task 9's edit site.
10. `frontend/src/features/accounts/components/RoleFormPage.tsx` (full file, 218 lines, specifically the `groupByArea`/permission-checklist block lines 176-208) — task 10's edit site.
11. `frontend/src/features/accounts/components/UserFormPage.tsx` (both `UserCreateForm`/`UserEditForm`), `frontend/src/features/accounts/components/RoleFormPage.tsx`, `frontend/src/features/tickets/components/CategoryFormPage.tsx`, `frontend/src/features/tasks/components/TaskFormPage.tsx` — task 11's 4 edit sites (each form's submit-button block).
12. `frontend/src/shared/ui/chart/ChartFrame.tsx` (full file, 101 lines, specifically lines 39-49's props contract and lines 80-97's success branch) — task 12's edit site.
13. `frontend/src/features/reports/components/TicketReportsPage.tsx`, `SlaReportsPage.tsx`, `AgentReportsPage.tsx`, `CsatReportsPage.tsx`, `ManagementDashboardPage.tsx` — all 5 already read in full for this plan; each has an identical `from`/`to` `Input type="date"` filter block. Task 13's 5 edit sites.
14. `frontend/src/features/organization/components/SettingsPage.tsx` lines 79-90 (`StringListField`'s remove `<button>`) — task 14's edit site.
15. `frontend/src/app/RouteErrorBoundary.tsx` (full file, 31 lines) and `frontend/src/shared/ui/ErrorState.tsx` (full file, 48 lines, specifically the `onRetry` prop lines 19, 27-31) — task 16's edit site.
16. `frontend/src/features/portal/components/PortalTicketFormPage.tsx` (full file, 73 lines) and `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx` (full file, 95 lines) and `frontend/src/shared/ui/Loading.tsx` (full file, 21 lines, the `Loader2Icon`/`animate-spin` pattern to reuse) — task 17's edit sites.

---

## Frontend Tasks

### 1 — `LoginPage` gains a support-contact line (`UX-004`)

**File: `frontend/src/features/auth/components/LoginPage.tsx`** — the footer block (lines 85-98) already has a "help" section with `contact`/`chat` links; add a third line specifically for authentication failures, reusing the existing `help.prompt` pattern:

```tsx
<div className="flex flex-col items-center gap-1 text-center text-sm text-muted-foreground">
  <span>{t('help.prompt')}</span>
  <div className="flex items-center gap-3">
    <Link to="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
      {t('help.contact')}
    </Link>
    <Link to="/chat" className="font-medium text-primary underline-offset-4 hover:underline">
      {t('help.chat')}
    </Link>
  </div>
  <span>{t('help.lockedOut')}</span>
</div>
```

Add `help.lockedOut` to `frontend/src/features/auth/locales/en.json`/`ar.json` (alongside the existing `help.prompt`/`help.contact`/`help.chat` keys): `"Locked out or forgot your password? Ask an admin to reset it."` — this system has no self-service reset (`UserFormPage.tsx` shows password is admin-set only), so the copy names the actual path, not an unbuilt "forgot password" flow.

---

### 2 — `LiveChatWidget`'s `StartForm` gets a real mutation (`UX-005`)

**File: `frontend/src/features/live-chat/components/LiveChatWidget.tsx`** — replace the bare `try/finally` (lines 44-59) with `useMutation`, so a failure reaches the global toast (`queryClient.ts:46-49`) instead of being swallowed:

```tsx
import { useMutation } from '@tanstack/react-query'
// ...

function StartForm({ onStarted }: { onStarted: (session: LiveChatSession) => void }) {
  const { t } = useTranslation('liveChat')
  const form = useAppForm({ schema: startSchema, defaultValues: { name: '', email: '' } })

  const mutation = useMutation({
    mutationFn: (values: StartFormValues) =>
      startLiveChat({ name: values.name, email: values.email }),
    onSuccess: (result) => {
      const session = { ticketId: result.ticket_id, sessionToken: result.session_token }
      saveSession(session)
      onStarted(session)
    },
  })

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* ...unchanged header... */}
      <Card>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <TextField control={form.control} name="name" label={t('start.name')} />
              <TextField control={form.control} name="email" label={t('start.email')} type="email" />
              <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full">
                <MessageCircleIcon />
                {t('start.action')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      {/* ...unchanged footer... */}
    </div>
  )
}
```

Remove the now-unused `useState` import for `pending` if `StartForm` no longer needs it (`ChatPane` in the same file does not use `pending` either — check `useState` is still needed for `LiveChatWidget`'s own `session` state at line 36 before removing the import entirely).

---

### 3 — `ChatPane` tracks WebSocket connection state (`UX-006`)

**File: `frontend/src/features/live-chat/components/LiveChatWidget.tsx`** — add connection-state tracking to the existing effect (lines 106-116), a disconnected indicator, and guard `onSubmit` (lines 122-125) on the socket actually being open:

```tsx
function ChatPane({ session }: { session: LiveChatSession }) {
  const { t } = useTranslation('liveChat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const form = useAppForm({ schema: messageSchema, defaultValues: { body: '' } })

  useEffect(() => {
    const socket = new WebSocket(
      getWebSocketUrl(`/ws/tickets/${session.ticketId}/?customer_token=${session.sessionToken}`),
    )
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onerror = () => setConnected(false)
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ChatMessage
      setMessages((prev) => [...prev, message])
    }
    socketRef.current = socket
    return () => socket.close()
  }, [session])

  // ...unchanged scroll effect...

  function onSubmit(values: MessageFormValues) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ body: values.body }))
    form.reset({ body: '' })
  }

  return (
    <Card className="flex w-full max-w-sm flex-col" style={{ height: '32rem' }}>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <MessageCircleIcon className="size-5 text-primary" />
          <CardTitle asChild>
            <h1>{t('chat.title')}</h1>
          </CardTitle>
        </div>
        <CardDescription>
          {connected ? t('chat.subtitle') : t('chat.disconnected')}
        </CardDescription>
      </CardHeader>
      {/* ...unchanged message list... */}
      <Form {...form}>
        <form /* ...unchanged... */>
          <div className="flex-1">
            <TextField control={form.control} name="body" label={t('chat.placeholder')} />
          </div>
          <Button type="submit" size="icon" disabled={!connected}>
            <SendIcon />
            <span className="sr-only">{t('chat.send')}</span>
          </Button>
        </form>
      </Form>
    </Card>
  )
}
```

Add `chat.disconnected` to `frontend/src/features/live-chat/locales/en.json`/`ar.json` (alongside the existing `chat.title`/`chat.subtitle`/`chat.empty`/`chat.placeholder`/`chat.send` keys): `"Reconnecting…"`.

**`UX-007` is not implemented** — no history refetch on resume. See `## Prerequisites`.

---

### 4 — `WebFormPage`'s `WebForm` gets a real mutation (`UX-009`)

**File: `frontend/src/features/web-form/components/WebFormPage.tsx`** — identical pattern to task 2, applied to `WebForm.onSubmit` (lines 60-89):

```tsx
import { useMutation } from '@tanstack/react-query'
// ...

function WebForm({ onSubmitted }: { onSubmitted: (ticketId: number) => void }) {
  const { t } = useTranslation('webForm')
  const categoriesQuery = useWebFormCategories()
  const form = useAppForm({
    schema: webFormSchema,
    defaultValues: { name: '', email: '', subject: '', description: '', category: CATEGORY_NONE },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      submitWebForm({
        name: values.name,
        email: values.email,
        subject: values.subject,
        description: values.description,
        category: values.category === CATEGORY_NONE ? null : Number(values.category),
      }),
    onSuccess: (result) => onSubmitted(result.ticket_id),
  })

  // ...category options unchanged...

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      {/* ...unchanged header... */}
      <Card>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              {/* ...unchanged fields... */}
              <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full">
                <SendIcon />
                {t('action')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      {/* ...unchanged footer... */}
    </div>
  )
}
```

---

### 5 — `TicketStatusControl` confirms a terminal-status transition (`UX-017`)

**File: `frontend/src/features/tickets/components/TicketStatusControl.tsx`** — route a transition into a status with zero outgoing transitions (`TICKET_STATUS_TRANSITIONS[next].length === 0` — today only `closed`, but computed from the map rather than hardcoded so a future status change stays correct) through `useConfirm()`, mirroring `TicketDetailPage.tsx:42-51`'s `handleDelete`:

```tsx
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
// ...

export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: number
  status: TicketStatus
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const mutation = useSetTicketStatus(ticketId)

  const options: readonly TicketStatus[] = [status, ...TICKET_STATUS_TRANSITIONS[status]]

  async function onValueChange(next: string) {
    if (next === status) return
    const nextStatus = next as TicketStatus
    if (TICKET_STATUS_TRANSITIONS[nextStatus].length === 0) {
      const confirmed = await confirm({
        title: t('status.terminalConfirmTitle', { status: t(`statuses.${nextStatus}`) }),
        description: t('status.terminalConfirmDescription'),
        destructive: true,
      })
      if (!confirmed) return
    }
    mutation.mutate(nextStatus, {
      onSuccess: () => toast({ tone: 'success', message: t('status.updated') }),
    })
  }

  return (
    <Select value={status} onValueChange={(value) => void onValueChange(value)} disabled={mutation.isPending}>
      {/* ...unchanged... */}
```

Add `status.terminalConfirmTitle`/`status.terminalConfirmDescription` to `frontend/src/features/tickets/locales/en.json`/`ar.json` (alongside the existing `status.updated` key): `"Move to {{status}}?"` / `"This status has no further transitions — you won't be able to reopen this ticket from here."`.

---

### 6 — Unsaved-changes guard on `FaqFormPage`/`ArticleFormPage` (`UX-025`)

**Create file: `frontend/src/shared/hooks/useUnsavedChangesGuard.ts`** — a small shared hook wrapping react-router's navigation blocking plus `beforeunload`, reusable by both forms (and any future form that wants it):

```tsx
import { useEffect } from 'react'
import { useBlocker } from 'react-router'

/** Warns before navigating away (in-app or tab close) while `isDirty` is
 *  true. `useBlocker` handles in-app route changes; `beforeunload` covers
 *  tab close/refresh, which react-router cannot intercept. */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useBlocker(({ currentLocation, nextLocation }) => {
    return isDirty && currentLocation.pathname !== nextLocation.pathname
  })

  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
```

Confirm `useBlocker` is exported by the installed `react-router` version (`frontend/package.json`'s `react-router` dependency) before using it — it requires a data router (this app's `createBrowserRouter`, `frontend/src/app/router.tsx:8`, qualifies). If `useBlocker` is unavailable in the installed version, fall back to `beforeunload` only (tab-close protection) and note in-app navigation isn't guarded, rather than adding a routing library dependency.

**File: `frontend/src/features/knowledge-base/components/FaqFormPage.tsx`** — in `FaqForm`, call the guard with `form.formState.isDirty`:

```tsx
const form = useAppForm({ schema, defaultValues: faq ? toDefaults(faq) : EMPTY_DEFAULTS })
useUnsavedChangesGuard(form.formState.isDirty)
```

**File: `frontend/src/features/knowledge-base/components/ArticleFormPage.tsx`** — same one-line addition in `ArticleForm`, right after its `useAppForm` call (line 108-111).

---

### 7 — Move the "select all in group" affordance into `RoleFormPage`'s permission checklist (`UX-043`)

**File: `frontend/src/features/accounts/components/RoleFormPage.tsx`** — inside the `groupByArea(...)` map (lines 184-203), add a group-level toggle next to each area heading:

```tsx
{groupByArea(catalogQuery.data ?? []).map(([area, permissions]) => {
  const allSelected = permissions.every((permission) => field.value.includes(permission))
  function toggleGroup() {
    field.onChange(
      allSelected
        ? field.value.filter((p: string) => !permissions.includes(p))
        : [...new Set([...field.value, ...permissions])],
    )
  }
  return (
    <div key={area} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{areaLabel(area)}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={toggleGroup}>
          {t(allSelected ? 'roles.deselectAllInGroup' : 'roles.selectAllInGroup')}
        </Button>
      </div>
      {permissions.map((permission) => (
        /* ...unchanged Checkbox row... */
      ))}
    </div>
  )
})}
```

Import `Button` from `@/shared/ui/primitives/button` (not currently imported in this file — `RoleFormPage.tsx`'s only `Button` usage today is the submit button at line 210, check whether it's already imported at the top before adding a duplicate import). Add `roles.selectAllInGroup`/`roles.deselectAllInGroup` to `frontend/src/features/accounts/locales/en.json`/`ar.json`: `"Select all"` / `"Deselect all"`.

---

### 8 — `roles.delete.description` names the consequence (`UX-039`, corrected)

**File: `frontend/src/features/accounts/locales/en.json`** — change `roles.delete.description` from the generic `"This permanently removes the role. This cannot be undone."` to name the actual consequence, matching `categories.delete.description`'s existing pattern (`frontend/src/features/tickets/locales/en.json`, `"Tickets using this category become uncategorized. This cannot be undone."`):

```diff
- "description": "This permanently removes the role. This cannot be undone."
+ "description": "Users holding this role lose its permissions immediately. This permanently removes the role and cannot be undone."
```

**File: `frontend/src/features/accounts/locales/ar.json`** — matching Arabic translation at the same path, formal MSA.

No live usage count is added — see `## Prerequisites` for why.

---

### 9 — Cancel button on 4 single-record forms (`UX-046`)

**Files: `frontend/src/features/accounts/components/UserFormPage.tsx`** (both `UserCreateForm` and `UserEditForm`), **`frontend/src/features/accounts/components/RoleFormPage.tsx`**, **`frontend/src/features/tickets/components/CategoryFormPage.tsx`**, **`frontend/src/features/tasks/components/TaskFormPage.tsx`** — each form's submit-button row gains a secondary Cancel `Button` navigating back to the list route, using `useNavigate` (already imported in every one of these files):

```tsx
<div className="flex gap-2">
  <Button type="submit" disabled={mutation.isPending}>
    {t('...actions.save')}
  </Button>
  <Button type="button" variant="outline" onClick={() => navigate('/roles')}>
    {t('actions.cancel', { ns: 'common' })}
  </Button>
</div>
```

Use each file's own list route (`/users`, `/roles`, `/categories`, `/tasks`) and its own existing save-button `t(...)` call — do not change the save button itself. `common.json`'s `actions.cancel` already exists (`frontend/src/shared/i18n/locales/en/common.json:10`, `"Cancel"`) — reused via the `common` namespace, no new key. `TaskFormPage.tsx` and `CategoryFormPage.tsx` already call `useNavigate` (confirm at each file's top-level imports); `RoleFormPage.tsx`/`UserFormPage.tsx` do too.

---

### 10 — `ChartFrame`'s export action is gated on real data (`UX-049`)

**File: `frontend/src/shared/ui/chart/ChartFrame.tsx`** — the `action` prop (line 58) currently renders unconditionally in `CardHeader`. Since every one of the 5 report pages passes the same `<Button ...>Export CSV</Button>` as `action`, gate rendering inside `ChartFrame` itself so all 5 fix at once:

```tsx
<CardHeader>
  <CardTitle asChild>
    <h2>{title}</h2>
  </CardTitle>
  {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
  {query.isSuccess && !isEmpty?.(query.data) ? action : null}
</CardHeader>
```

No change to any of the 5 report pages — they keep passing `action` unconditionally; `ChartFrame` now decides when it's actually shown.

---

### 11 — Shared date-range presets on all 5 report pages (`UX-052`)

**Create file: `frontend/src/features/reports/components/DateRangePresets.tsx`** — a small shared control, feature-local (all 5 consumers are in `features/reports`, so this doesn't need to be `shared/ui`):

```tsx
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoStartOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function DateRangePresets({
  onSelect,
}: {
  onSelect: (range: { from: string; to: string }) => void
}) {
  const { t } = useTranslation('reports')
  const today = new Date().toISOString().slice(0, 10)
  const presets = [
    { key: 'last7', label: t('presets.last7'), from: isoDaysAgo(7) },
    { key: 'last30', label: t('presets.last30'), from: isoDaysAgo(30) },
    { key: 'thisMonth', label: t('presets.thisMonth'), from: isoStartOfMonth() },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect({ from: preset.from, to: today })}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}
```

Add a `presets` object to `frontend/src/features/reports/locales/en.json`/`ar.json`: `{"last7": "Last 7 days", "last30": "Last 30 days", "thisMonth": "This month"}` (translate to formal MSA in `ar.json`).

**Each of the 5 report pages** (`TicketReportsPage.tsx`, `SlaReportsPage.tsx`, `AgentReportsPage.tsx`, `CsatReportsPage.tsx`, `ManagementDashboardPage.tsx`) — add `<DateRangePresets onSelect={({ from, to }) => { setFrom(from); setTo(to) }} />` next to its existing `from`/`to` `Input` block. Each file already has `setFrom`/`setTo` state setters in scope (confirmed in every one of the 5 files read for this plan) — no new state needed.

---

### 12 — `StringListField`'s remove control gets an `aria-label` and the shared `Button` (`UX-053`)

**File: `frontend/src/features/organization/components/SettingsPage.tsx`** lines 86-88 — replace the bare `<button>`:

```tsx
{value.map((item, index) => (
  <Badge key={`${item}-${index}`} variant="secondary" className="gap-1">
    {item}
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={t('settings.removeItem', { item })}
      onClick={() => onChange(value.filter((_, i) => i !== index))}
    >
      <XIcon className="size-3" />
    </Button>
  </Badge>
))}
```

`Button` is already imported in this file (line 9). Add `settings.removeItem` to `frontend/src/features/organization/locales/en.json`/`ar.json`: `"Remove {{item}}"`.

---

### 13 — `RouteErrorBoundary` gains recovery navigation on all 3 branches (`UX-055`)

**File: `frontend/src/app/RouteErrorBoundary.tsx`** — add a "Go home" action to every branch, and pass `onRetry` to the `ErrorState` branch (the only branch not currently offering one):

```tsx
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useRouteError, useNavigate } from 'react-router'

import { ApiRequestError } from '@/shared/lib/api/errors'
import { Button } from '@/shared/ui/primitives/button'
import { ErrorState } from '@/shared/ui/ErrorState'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const goHome = (
    <Button type="button" variant="outline" size="sm" onClick={() => navigate('/')}>
      {t('actions.goHome')}
    </Button>
  )

  if (error instanceof ApiRequestError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <ErrorState error={error} onRetry={() => window.location.reload()} />
        {goHome}
      </div>
    )
  }

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p>
          {error.status} {t('states.error.route')}
        </p>
        {goHome}
      </div>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p>{t('states.error.route')}</p>
      {goHome}
    </div>
  )
}
```

`ErrorState`'s `onRetry` is typed `() => void` (`ErrorState.tsx:19`) with no assumption about what "retry" does — `query.refetch()` is `DataTable`'s/`ChartFrame`'s own usage; there is no query object here (`useRouteError` is a thrown error, not a query result), so `window.location.reload()` is the correct retry semantic for a route-level crash — it re-runs the route's loader/render from scratch, the same effect a manual refresh has.

**`error.statusText` (previously shown raw, untranslated) is dropped** in the `isRouteErrorResponse` branch, replaced with the already-translated generic message — this also resolves `UX-056` (a `bilingual` finding, owned by `DSN-12`, not this story) as an incidental side effect of this edit; do not treat it as a task of this story, but do not revert it either, since restoring the untranslated `statusText` would be a regression.

---

### 14 — Portal submit buttons show a pending spinner + label (`UX-062`)

**File: `frontend/src/features/portal/components/PortalTicketFormPage.tsx`** — replace the submit `Button` (lines 66-68):

```tsx
import { Loader2Icon } from 'lucide-react'
// ...
<Button type="submit" disabled={mutation.isPending}>
  {mutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
  {mutation.isPending ? t('tickets.submitting') : t('tickets.actions.submit')}
</Button>
```

**File: `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx`** — same pattern on its submit `Button` (lines 88-90), using a new `tickets.feedback.submitting` key.

Add `tickets.submitting` and `tickets.feedback.submitting` to `frontend/src/features/portal/locales/en.json`/`ar.json` (alongside the existing `tickets.actions.submit`/`tickets.feedback.actions.submit` keys): `"Submitting…"`.

---

### 15 — Register bookkeeping

**File: `design-system/supportos/UX-AUDIT.md`** — set Status for the 18 `interaction` rows:

- `UX-004, UX-005, UX-006, UX-009, UX-017, UX-025, UX-043, UX-046, UX-049, UX-052, UX-053, UX-055, UX-062` → `Resolved (Story 63)`
- `UX-039` → `Resolved (Story 63) — corrected: copy-only fix (roles.delete.description), no live usage count (no API source)`
- `UX-040` → `Resolved (Story 63) — verified false positive: global MutationCache.onError already toasts every mutation failure`
- `UX-007` → `Deferred — needs a new session-token-scoped backend endpoint; outside DSN-6–13's frontend-only guardrail`
- `UX-016`, `UX-028` → stay `Open`, append to each row's Finding column: `"Out of Story 63 (DSN-8)'s scope by product judgment — a feature addition (per DSN-2's and DSN-6's own characterization), not interaction-state/feedback polish. Technically buildable frontend-only (loop the existing per-row delete mutation), but deliberately not attempted here."`

Update the header summary (`**Totals: 66 findings**...` and the per-story tally line below it) to add a `**Story 63 (DSN-8)...**` line matching `DSN-7`'s own summary-line format: resolved / corrected / false-positive / deferred / left-open counts.

---

## Edge Cases & Failure Modes

- **`useBlocker` (task 6) may not exist in the installed `react-router` version** — check `frontend/package.json` before writing the hook; if it's unavailable, ship the `beforeunload`-only fallback explicitly (do not add a new routing dependency to get in-app blocking).
- **`RoleFormPage`'s group toggle (task 7) computed inside a `.map()` callback** — the `function toggleGroup()` declaration inside the callback is a fresh closure per render per group, which is correct here (each group's toggle must close over that group's own `permissions` array) but should not be hoisted out as a single shared function without also parameterizing it by `permissions`.
- **`ChartFrame`'s export-gating (task 10) changes visible behavior on all 5 report pages simultaneously** — verify each one manually (an empty state, a loading state, and a populated state) since this is a single shared-component change with 5 consumers; a mistake here regresses every report page at once, not just one.
- **`RouteErrorBoundary`'s `window.location.reload()` (task 13) is a full page reload, not a React-level retry** — appropriate for a route-level crash boundary (there's no query object to `refetch()`), but note this is a different retry semantic than `ErrorState`'s usual `DataTable`/`ChartFrame` callers; do not assume `onRetry` always means "refetch a query."
- **`TicketStatusControl`'s terminal-transition check (task 5) is computed from `TICKET_STATUS_TRANSITIONS[nextStatus].length === 0`, not hardcoded to `'closed'`** — if a future story adds a new status with its own zero-outgoing-transition state, this confirm fires automatically; if `closed` ever gains an outgoing transition, the confirm stops firing for it. This is intentional — the check should track the data, not a literal string.
- **The Cancel buttons (task 9) discard unsaved edits with no confirmation** — acceptable per the intake's own framing ("abandon an in-progress edit"), and consistent with every other "Cancel" affordance already in this codebase (e.g., `useConfirm`'s own dialog has a Cancel button with no further confirmation). Do not add a nested confirm-before-cancel; that would be a new pattern, not a fix.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend impact — every task is frontend-only or a documentation edit (`UX-AUDIT.md`). `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass.
3. Manual verification only beyond that, per `## Verification Steps` below — several of these tasks (WebSocket reconnect UI, mutation-failure toasts, unsaved-changes navigation blocking) cannot be meaningfully verified by a static check alone.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Silent-failure fixes:** on `/chat`, submit the start form with the backend temporarily unreachable (or a network-throttled DevTools failure) — an error toast now appears instead of a silent re-enable. Same test on `/contact`'s form.
3. **Chat disconnected state:** open `/chat`, start a session, then simulate a socket drop (DevTools → Network → offline, or stop the backend's ASGI server) — the subtitle switches to "Reconnecting…" and the send button disables; messages typed before the drop are not silently discarded into a dead socket.
4. **Terminal status confirm:** on a ticket's status control, select "Closed" — a confirm dialog appears before the mutation fires; canceling leaves the status unchanged.
5. **Unsaved-changes guard:** edit a field on `/knowledge-base/manage/new` or `/knowledge-base/articles/manage/new`, then click a sidebar nav link — a browser-native confirm (react-router's blocker) interrupts navigation. Reload the tab directly (Ctrl+R) with a dirty form — the browser's native "leave site?" prompt appears.
6. **Role select-all-in-group:** on `/roles/new`, click a permission group's "Select all" — every checkbox in that group toggles on; click again — "Deselect all" clears them.
7. **Role delete copy:** open the delete-role confirm on `/roles` — description now names the actual consequence (users losing permissions), not just "cannot be undone."
8. **Cancel buttons:** each of `/users/new`, `/roles/new`, `/categories/new`, `/tasks/new` now shows a Cancel button next to Save, returning to the list route without submitting.
9. **Chart export gating:** on any report page, load a date range with zero data (or watch during initial load) — the "Export CSV" button is absent; once real data renders, it reappears.
10. **Date presets:** on any of the 5 report pages, click "Last 7 days"/"Last 30 days"/"This month" — the `from`/`to` inputs populate and the report refetches accordingly.
11. **Settings remove-item button:** on `/settings`, inspect a department/branch chip's remove button in DevTools — it's a real `<button data-slot="button">` with a non-empty `aria-label`.
12. **Route crash recovery:** trigger a route-level error (e.g., temporarily throw in a component, or navigate to a route with a malformed state) — every branch of the resulting error page shows a working "Go home" button.
13. **Portal submit spinners:** on `/portal/tickets/new` and a ticket's feedback form, submit with a throttled network — the button shows a spinning icon and "Submitting…" text during the pending state.
14. **`UX-AUDIT.md` register:** all 18 `interaction` rows carry the dispositions from `## Story Goal`'s table; `UX-016`/`UX-028` remain `Open` with the scope-decision note appended; the header summary line is updated.

---

## Done Criteria

- [ ] `LoginPage.tsx` — support-contact line added; `help.lockedOut` key added (`en`/`ar`).
- [ ] `LiveChatWidget.tsx` — `StartForm` and `WebFormPage.tsx`'s `WebForm` both converted to `useMutation`; `ChatPane` tracks connection state, shows a disconnected indicator, and guards `send()` on `readyState === OPEN`.
- [ ] `TicketStatusControl.tsx` — terminal-status transitions route through `useConfirm()`; new locale keys added (`en`/`ar`).
- [ ] `useUnsavedChangesGuard.ts` created; wired into `FaqFormPage.tsx` and `ArticleFormPage.tsx`.
- [ ] `RoleFormPage.tsx` — "select all in group" added to the permission checklist; new locale keys added (`en`/`ar`).
- [ ] `roles.delete.description` (`en`/`ar`) rewritten to name the actual consequence.
- [ ] `UserFormPage.tsx`, `RoleFormPage.tsx`, `CategoryFormPage.tsx`, `TaskFormPage.tsx` — each gains a Cancel button next to Save.
- [ ] `ChartFrame.tsx` — export `action` gated on `query.isSuccess && !isEmpty`; no report page itself changed.
- [ ] `DateRangePresets.tsx` created; wired into all 5 report pages; `presets` locale keys added (`en`/`ar`).
- [ ] `SettingsPage.tsx` — `StringListField`'s remove control uses the shared `Button` with an `aria-label`; `settings.removeItem` key added (`en`/`ar`).
- [ ] `RouteErrorBoundary.tsx` — all 3 branches show a "Go home" action; the `ErrorState` branch gets `onRetry`.
- [ ] `PortalTicketFormPage.tsx`/`PortalFeedbackFormPage.tsx` — submit buttons show a spinner + "Submitting…" label while pending; new locale keys added (`en`/`ar`).
- [ ] No `UX-016`/`UX-028` bulk-action UI added — confirmed out of scope, noted in the register.
- [ ] No `UX-007` chat-history-fetch code added — confirmed deferred, noted in the register.
- [ ] `design-system/supportos/UX-AUDIT.md` — all 18 `interaction` rows' Status set per `## Story Goal`; header summary updated.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `design-system/supportos/UX-AUDIT.md` only (plus this plan's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-13.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-9` through `DSN-13` (`SupportOs backlog.MD:585-630`) remain unplanned. `UX-007` and a future bulk-row-actions decision (`UX-016`/`UX-028`) both need product input — a dedicated non-`DSN` backend story, or an explicit guardrail exception — before they can close.
