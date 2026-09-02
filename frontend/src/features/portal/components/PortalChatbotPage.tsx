import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as z from 'zod'

import { cn } from '@/shared/lib/cn'
import { requiredString } from '@/shared/validation/schemas'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/primitives/alert'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { usePortalChatbot } from '../api/usePortalChatbot'
import {
  useHandOffPortalChatbot,
  useSendPortalChatbotMessage,
} from '../api/usePortalChatbotMutations'
import type { PortalChatbotState } from '../types/portalChatbot'

const messageSchema = z.object({ body: requiredString(2000) })
type MessageFormValues = z.output<typeof messageSchema>

export function PortalChatbotPage() {
  const { t } = useTranslation('portal')
  const query = usePortalChatbot()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('chatbot.title')}</h1>
      <QueryBoundary query={query}>{(state) => <ChatPane state={state} />}</QueryBoundary>
    </div>
  )
}

function ChatPane({ state }: { state: PortalChatbotState }) {
  const { t } = useTranslation('portal')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const form = useAppForm({ schema: messageSchema, defaultValues: { body: '' } })
  const sendMutation = useSendPortalChatbotMessage()
  const handOffMutation = useHandOffPortalChatbot()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [state.messages])

  function onSubmit(values: MessageFormValues) {
    sendMutation.mutate(values.body, { onSuccess: () => form.reset({ body: '' }) })
  }

  return (
    <Card className="flex h-[min(36rem,calc(100dvh-12rem))] flex-col">
      <CardHeader className="border-b pb-4">
        <CardTitle asChild>
          <h2>{t('chatbot.paneTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        {state.handed_off ? (
          <Alert>
            <AlertTitle>{t('chatbot.handedOff.title')}</AlertTitle>
            <AlertDescription>
              {t('chatbot.handedOff.description')}{' '}
              <Link to={`/portal/tickets/${state.ticket}`} className="font-medium hover:underline">
                {t('chatbot.handedOff.viewTicket')}
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {state.messages.length === 0 ? (
            <li className="m-auto text-center text-sm text-muted-foreground">
              {t('chatbot.empty')}
            </li>
          ) : (
            state.messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  'flex',
                  message.author === 'customer' ? 'justify-end' : 'justify-start',
                )}
              >
                {/* No forced `dir` — free-form prose that may itself be
                    Arabic, the same reasoning `MessageRow` applies. */}
                <p
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                    message.author === 'customer'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {message.body}
                </p>
              </li>
            ))
          )}
          <div ref={bottomRef} />
        </ul>
        {state.handed_off ? null : (
          <>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField control={form.control} name="body" label={t('chatbot.placeholder')} />
                </div>
                <SubmitButton pending={sendMutation.isPending}>{t('chatbot.send')}</SubmitButton>
              </form>
            </Form>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={handOffMutation.isPending}
              onClick={() => handOffMutation.mutate()}
            >
              {t('chatbot.talkToHuman')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
