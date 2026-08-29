import { useState } from 'react'
import { CheckCircle2Icon, MessageCircleIcon, SendIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as z from 'zod'

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
import { SelectField, TextField, TextareaField, useAppForm } from '@/shared/ui/form'

import { submitWebForm } from '../api/submitWebForm'
import { useWebFormCategories } from '../api/useWebFormCategories'

// Radix's `Select.Item` requires a non-empty `value` — mirrors
// `TicketFormPage`'s own `CATEGORY_NONE` sentinel (Story 18), duplicated
// locally rather than imported: this feature cannot import
// `@/features/tickets` (CONVENTIONS.md §15).
const CATEGORY_NONE = 'none'

const webFormSchema = z.object({
  name: requiredString(200),
  email: optionalEmail(),
  subject: requiredString(200),
  description: requiredString(5000),
  category: z.string().min(1),
})
type FormValues = z.output<typeof webFormSchema>

export function WebFormPage() {
  const { t } = useTranslation('webForm')
  const [ticketId, setTicketId] = useState<number | null>(null)

  if (ticketId !== null) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CheckCircle2Icon className="size-10 text-success" />
          <CardTitle asChild className="text-xl">
            <h1>{t('success.title')}</h1>
          </CardTitle>
          <CardDescription className="text-base">
            {t('success.description', { id: ticketId })}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <WebForm onSubmitted={setTicketId} />
}

function WebForm({ onSubmitted }: { onSubmitted: (ticketId: number) => void }) {
  const { t } = useTranslation('webForm')
  const [pending, setPending] = useState(false)
  const categoriesQuery = useWebFormCategories()
  const form = useAppForm({
    schema: webFormSchema,
    defaultValues: { name: '', email: '', subject: '', description: '', category: CATEGORY_NONE },
  })

  const categoryOptions =
    categoriesQuery.data?.map((category) => ({
      value: String(category.id),
      label: category.name,
    })) ?? []

  async function onSubmit(values: FormValues) {
    setPending(true)
    try {
      const result = await submitWebForm({
        name: values.name,
        email: values.email,
        subject: values.subject,
        description: values.description,
        category: values.category === CATEGORY_NONE ? null : Number(values.category),
      })
      onSubmitted(result.ticket_id)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MessageCircleIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Card>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={form.control} name="name" label={t('fields.name')} />
                <TextField
                  control={form.control}
                  name="email"
                  label={t('fields.email')}
                  type="email"
                />
              </div>
              <TextField control={form.control} name="subject" label={t('fields.subject')} />
              <TextareaField
                control={form.control}
                name="description"
                label={t('fields.description')}
              />
              <SelectField
                control={form.control}
                name="category"
                label={t('fields.category')}
                options={[
                  { value: CATEGORY_NONE, label: t('fields.noCategory') },
                  ...categoryOptions,
                ]}
              />
              <Button type="submit" size="lg" disabled={pending} className="w-full">
                <SendIcon />
                {t('action')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        {t('links.chatPrompt')}{' '}
        <Link to="/chat" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('links.chat')}
        </Link>
      </p>
    </div>
  )
}
