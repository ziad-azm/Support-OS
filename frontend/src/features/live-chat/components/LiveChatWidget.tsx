import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { optionalEmail, requiredString } from '@/shared/validation/schemas'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
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
  const [pending, setPending] = useState(false)
  const form = useAppForm({ schema: startSchema, defaultValues: { name: '', email: '' } })

  async function onSubmit(values: StartFormValues) {
    setPending(true)
    try {
      const result = await startLiveChat({ name: values.name, email: values.email })
      const session = { ticketId: result.ticket_id, sessionToken: result.session_token }
      saveSession(session)
      onStarted(session)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-sm">
      <CardHeader>
        <CardTitle asChild>
          <h1>{t('start.title')}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <TextField control={form.control} name="name" label={t('start.name')} />
            <TextField control={form.control} name="email" label={t('start.email')} type="email" />
            <Button type="submit" disabled={pending}>
              {t('start.action')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function ChatPane({ session }: { session: LiveChatSession }) {
  const { t } = useTranslation('liveChat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const form = useAppForm({ schema: messageSchema, defaultValues: { body: '' } })

  useEffect(() => {
    const socket = new WebSocket(
      getWebSocketUrl(`/ws/tickets/${session.ticketId}/?customer_token=${session.sessionToken}`),
    )
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ChatMessage
      setMessages((prev) => [...prev, message])
    }
    socketRef.current = socket
    return () => socket.close()
  }, [session])

  function onSubmit(values: MessageFormValues) {
    socketRef.current?.send(JSON.stringify({ body: values.body }))
    form.reset({ body: '' })
  }

  return (
    <Card className="mx-auto mt-10 flex max-w-sm flex-col" style={{ height: '32rem' }}>
      <CardHeader>
        <CardTitle asChild>
          <h1>{t('chat.title')}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {messages.map((message) => (
            <li
              key={message.id}
              className={message.direction === 'outbound' ? 'self-end text-end' : 'self-start'}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
            </li>
          ))}
        </ul>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
            <TextField control={form.control} name="body" label={t('chat.placeholder')} />
            <Button type="submit">{t('chat.send')}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
