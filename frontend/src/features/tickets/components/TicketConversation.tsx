import { useState } from 'react'
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
import { useSummarizeTicket } from '../api/useTicketMutations'
import { useTicketChatSocket } from '../api/useTicketChatSocket'
import { MESSAGE_CHANNELS } from '../types/message'
import type { Message, MessageInput } from '../types/message'

const replySchema = z.object({
  channel: choice(MESSAGE_CHANNELS),
  body: requiredString(5000),
})

type ReplyFormValues = z.output<typeof replySchema>

const EMPTY_REPLY: ReplyFormValues = { channel: 'email', body: '' }

// `direction` has no default (mirrors the backend model) and is never a
// field the user picks — a reply composed through this form is always
// outbound. See Story 13 `## Story Goal`.
function toMessageInput(ticketId: number, values: ReplyFormValues): MessageInput {
  return { ticket: ticketId, direction: 'outbound', channel: values.channel, body: values.body }
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
        <SelectField
          control={form.control}
          name="channel"
          label={t('conversation.fields.channel')}
          options={MESSAGE_CHANNELS.map((value) => ({
            value,
            label: t(`conversation.channels.${value}`),
          }))}
        />
        <TextareaField control={form.control} name="body" label={t('conversation.fields.body')} />
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('conversation.actions.send')}
        </SubmitButton>
      </form>
    </Form>
  )
}
