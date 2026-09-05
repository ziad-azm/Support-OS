import { useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/primitives/alert'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextareaField,
  useAppForm,
} from '@/shared/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateMessage } from '../api/useMessageMutations'
import { useMessages } from '../api/useMessages'
import { useQuickReplies } from '../api/useQuickReplies'
import { useCustomerContactDetails } from '../api/useCustomerContactDetails'
import { useSuggestTicketReply, useSummarizeTicket } from '../api/useTicketMutations'
import { useTicketChatSocket } from '../api/useTicketChatSocket'
import { useTicketContext } from '../api/useTicketContext'
import { MESSAGE_CHANNELS } from '../types/message'
import type { Message, MessageChannel, MessageInput } from '../types/message'

const replySchema = z.object({
  channel: choice(MESSAGE_CHANNELS),
  body: requiredString(5000),
  // No sentinel/"auto" value — whenever a choice is shown at all, it is
  // always a real, concrete address (defaulted to the customer's primary
  // one), so the agent sees exactly where a reply is going rather than an
  // opaque "default" placeholder. Blank only while the dropdown itself is
  // hidden (a single or no known address for the channel) — see the
  // `useEffect` in `ReplyForm` that keeps this in sync with `channel`.
  target_address: z.string().default(''),
})

type ReplyFormValues = z.output<typeof replySchema>

const EMPTY_REPLY: ReplyFormValues = { channel: 'email', body: '', target_address: '' }

// `direction` has no default (mirrors the backend model) and is never a
// field the user picks — a reply composed through this form is always
// outbound. See Story 13 `## Story Goal`.
function toMessageInput(ticketId: number, values: ReplyFormValues): MessageInput {
  return {
    ticket: ticketId,
    direction: 'outbound',
    channel: values.channel,
    body: values.body,
    target_address: values.target_address,
  }
}

/** Which `ContactDetail.channel` a `Message.channel` draws `target_address`
 * candidates from — mirrors `backend/apps/communications/serializers.py`'s
 * `_CONTACT_CHANNEL_FOR_MESSAGE_CHANNEL`. `chat`/`web_form` have no
 * addressable destination, hence no entry — `null` from this map means
 * "this channel never shows a target-address choice." */
const CONTACT_CHANNEL_FOR_MESSAGE_CHANNEL: Partial<
  Record<MessageChannel, 'email' | 'phone' | 'whatsapp'>
> = {
  email: 'email',
  sms: 'phone',
  whatsapp: 'whatsapp',
}

export function TicketConversation({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useMessages(ticketId)
  useTicketChatSocket(ticketId)

  const [summary, setSummary] = useState<string | null>(null)
  const summarizeMutation = useSummarizeTicket(ticketId)

  function handleSummarize() {
    summarizeMutation.mutate(undefined, {
      onSuccess: (data) => setSummary(data.summary),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('conversation.title')}</h2>
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={summarizeMutation.isPending}
            onClick={handleSummarize}
          >
            {t('conversation.actions.summarize')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary ? (
          <Alert>
            <AlertTitle>{t('conversation.summary.title')}</AlertTitle>
            {/* No forced `dir` — AI-generated prose may itself be Arabic,
                the same "free-form prose, not a Latin-script identifier"
                reasoning `MessageRow` already applies to `message.body`
                below. */}
            <AlertDescription className="whitespace-pre-wrap text-foreground">
              {summary}
            </AlertDescription>
          </Alert>
        ) : null}
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('conversation.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="tickets.manage">
          <ReplyForm ticketId={ticketId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function MessageRow({ message }: { message: Message }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={message.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`conversation.directions.${message.direction}`)}
        </Badge>
        <Badge variant="outline">{t(`conversation.channels.${message.channel}`)}</Badge>
        <span>{date(message.created_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — unlike a contact's email/phone value
          (Story 11), a message body is free-form prose that may itself be
          Arabic, not a Latin-script identifier. */}
      <p className="whitespace-pre-wrap">{message.body}</p>
    </li>
  )
}

function ReplyForm({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: replySchema, defaultValues: EMPTY_REPLY })
  const mutation = useCreateMessage(ticketId)
  const quickRepliesQuery = useQuickReplies()

  // Not a submitted field — a "fill" action. Resets to '' after each pick
  // so the trigger falls back to its placeholder rather than staying
  // stuck on the last-chosen template's title. Overwrites `body` outright
  // (does not append/merge) — see Story 33 `## Prerequisites`.
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState('')
  const quickReplies = quickRepliesQuery.data?.items ?? []

  const suggestReplyMutation = useSuggestTicketReply(ticketId)

  // Candidate `target_address` values for the currently selected channel —
  // this customer's primary email/phone (`Customer.email`/`Customer.phone`)
  // plus any secondary `ContactDetail` rows. Both queries are read-only and
  // share their cache with `CustomerContextPanel`/the customer's own
  // Contact channels section (`ticketKeys`/`customerKeys` query keys), so
  // this rarely fires an extra request in practice.
  const channel = form.watch('channel')
  const contactChannel = CONTACT_CHANNEL_FOR_MESSAGE_CHANNEL[channel]
  const contextQuery = useTicketContext(ticketId)
  const customerId = contextQuery.data?.customer.id
  const contactDetailsQuery = useCustomerContactDetails(customerId ?? 0, {
    enabled: customerId !== undefined && contactChannel !== undefined,
  })

  const { options: addressCandidates, primary: primaryAddress } = useMemo(() => {
    if (contactChannel === undefined) {
      return { options: [] as string[], primary: null as string | null }
    }
    // Mirrors `MessageSerializer.validate`'s identical resolution on the
    // backend. The primary email/phone counts only when its own opt-in/
    // opt-out flag allows it — `email_contact_enabled`/`phone_contact_enabled`
    // default to on (matches this project's behavior before those flags
    // existed), `whatsapp_enabled` defaults to off (WhatsApp has always
    // been opt-in). A dedicated `ContactDetail` row for this channel is
    // always a candidate regardless of these flags — they govern only the
    // customer's PRIMARY fields, never a separately-added secondary contact.
    const customer = contextQuery.data?.customer
    const primary =
      channel === 'email'
        ? customer?.email_contact_enabled
          ? (customer.email ?? null)
          : null
        : channel === 'sms'
          ? customer?.phone_contact_enabled
            ? customer.phone || null
            : null
          : channel === 'whatsapp'
            ? customer?.whatsapp_enabled
              ? customer.phone || null
              : null
            : null
    const values = new Set<string>()
    if (primary) values.add(primary)
    for (const contact of contactDetailsQuery.data?.items ?? []) {
      if (contact.channel === contactChannel) values.add(contact.value)
    }
    return { options: [...values], primary }
  }, [channel, contactChannel, contextQuery.data, contactDetailsQuery.data])

  // Keeps `target_address` in sync whenever the channel changes or the
  // candidate list resolves: defaults to the customer's PRIMARY address
  // (shown explicitly, never an opaque "auto" placeholder) so the agent
  // always sees a concrete destination; falls back to whichever address
  // happens to be the only one on file if there's no primary. Blank
  // (meaning "let the adapter's own default resolution decide" — unchanged
  // from before this field existed) only when there's nothing to choose
  // from.
  //
  // Depends on the `<SelectField name="target_address">` below staying
  // MOUNTED at all times (see its own comment) — `form.setValue` here is
  // an imperative call from a sibling scope, and a `Controller`'s own
  // subscription setup can lag slightly behind a component that just
  // mounted, so a `setValue` landing in the very render a field first
  // mounts can be silently missed. `useLayoutEffect`, not `useEffect`, so
  // this still runs before paint on every relevant change.
  useLayoutEffect(() => {
    if (addressCandidates.length === 0) {
      form.setValue('target_address', '')
    } else {
      form.setValue('target_address', primaryAddress ?? addressCandidates[0])
    }
  }, [addressCandidates, primaryAddress, form])

  function handleSuggestReply() {
    suggestReplyMutation.mutate(undefined, {
      onSuccess: (data) => {
        form.setValue('body', data.reply, { shouldValidate: true, shouldDirty: true })
      },
    })
  }

  function handleQuickReplySelect(value: string) {
    const reply = quickReplies.find((candidate) => String(candidate.id) === value)
    if (reply) {
      form.setValue('body', reply.body, { shouldValidate: true, shouldDirty: true })
    }
    setSelectedQuickReplyId('')
  }

  function onSubmit(values: ReplyFormValues) {
    mutation.mutate(toMessageInput(ticketId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('conversation.sent') })
        form.reset(EMPTY_REPLY)
        setFormErrors([])
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        // A non-validation failure is already toasted by the shared
        // mutation error handler — CONVENTIONS.md §21.
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {quickReplies.length > 0 ? (
            <Select value={selectedQuickReplyId} onValueChange={handleQuickReplySelect}>
              <SelectTrigger
                size="sm"
                className="self-start"
                aria-label={t('conversation.quickReply.label')}
              >
                <SelectValue placeholder={t('conversation.quickReply.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {quickReplies.map((reply) => (
                  <SelectItem key={reply.id} value={String(reply.id)}>
                    {reply.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={suggestReplyMutation.isPending}
            onClick={handleSuggestReply}
          >
            {t('conversation.actions.suggestReply')}
          </Button>
        </div>
        <SelectField
          control={form.control}
          name="channel"
          label={t('conversation.fields.channel')}
          options={MESSAGE_CHANNELS.map((value) => ({
            value,
            label: t(`conversation.channels.${value}`),
          }))}
        />
        {/* Always mounted — visually hidden via the `hidden` attribute
            instead of conditionally unmounted — when there's nothing to
            choose from (the common case: one email, or none). Unmounting
            and remounting this in the SAME render the candidate list first
            grows past one is what caused a real bug: `Controller`'s own
            subscription setup lags slightly behind a component that just
            mounted, so the very `form.setValue` call meant to
            default-select it landed before the newly-mounted field had
            subscribed and was silently missed — the dropdown then showed
            permanently blank until the agent manually picked something,
            confirmed live with Playwright. Keeping it mounted from the
            start means it is always already subscribed by the time the
            candidate list changes, so `setValue` reliably reaches it. */}
        <div hidden={addressCandidates.length <= 1}>
          <SelectField
            control={form.control}
            name="target_address"
            label={t('conversation.fields.targetAddress')}
            options={addressCandidates.map((value) => ({
              value,
              label:
                value === primaryAddress
                  ? t('conversation.targetAddress.primaryOption', { value })
                  : value,
            }))}
          />
        </div>
        <TextareaField control={form.control} name="body" label={t('conversation.fields.body')} />
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('conversation.actions.send')}
        </SubmitButton>
      </form>
    </Form>
  )
}
