import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { SelectField, TextareaField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateMessage } from '../api/useMessageMutations'
import { useMessages } from '../api/useMessages'
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('conversation.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
        {formErrors.length > 0 ? (
          <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('conversation.actions.send')}
        </Button>
      </form>
    </Form>
  )
}
