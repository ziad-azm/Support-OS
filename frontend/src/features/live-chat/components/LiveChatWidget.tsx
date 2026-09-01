import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageCircleIcon, SendIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as z from 'zod'

import { cn } from '@/shared/lib/cn'
import { optionalEmail, requiredString } from '@/shared/validation/schemas'
import { Button } from '@/shared/ui/primitives/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { TextField, useAppForm } from '@/shared/ui/form'
import { getWebSocketUrl } from '@/shared/lib/ws'

import { startLiveChat } from '../api/startLiveChat'
import { loadSession, saveSession } from '../lib/session'
import type { ChatMessage } from '../types/message'
import type { LiveChatSession } from '../types/session'

const startSchema = z.object({
  name: requiredString(200),
  email: optionalEmail(),
})
type StartFormValues = z.output<typeof startSchema>

const messageSchema = z.object({ body: requiredString(2000) })
type MessageFormValues = z.output<typeof messageSchema>

export function LiveChatWidget() {
  const [session, setSession] = useState<LiveChatSession | null>(() => loadSession())

  if (!session) {
    return <StartForm onStarted={setSession} />
  }
  return <ChatPane session={session} />
}

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
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MessageCircleIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('start.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('start.subtitle')}</p>
      </div>
      <Card>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <TextField control={form.control} name="name" label={t('start.name')} />
              <TextField
                control={form.control}
                name="email"
                label={t('start.email')}
                type="email"
              />
              <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full">
                <MessageCircleIcon />
                {t('start.action')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        {t('start.contactPrompt')}{' '}
        <Link to="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('start.contactLink')}
        </Link>
      </p>
    </div>
  )
}

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function onSubmit(values: MessageFormValues) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ body: values.body }))
    form.reset({ body: '' })
  }

  return (
    <Card className="flex h-[min(32rem,calc(100dvh-3rem))] w-full max-w-sm flex-col">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <MessageCircleIcon className="size-5 text-primary" />
          <CardTitle asChild>
            <h1>{t('chat.title')}</h1>
          </CardTitle>
        </div>
        <CardDescription>{connected ? t('chat.subtitle') : t('chat.disconnected')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {messages.length === 0 ? (
            <li className="m-auto text-center text-sm text-muted-foreground">{t('chat.empty')}</li>
          ) : (
            messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  'flex',
                  message.direction === 'outbound' ? 'justify-end' : 'justify-start',
                )}
              >
                <p
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                    message.direction === 'outbound'
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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void form.handleSubmit(onSubmit)()
              }
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <TextField control={form.control} name="body" label={t('chat.placeholder')} />
            </div>
            <Button type="submit" size="icon" disabled={!connected}>
              <SendIcon />
              <span className="sr-only">{t('chat.send')}</span>
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
