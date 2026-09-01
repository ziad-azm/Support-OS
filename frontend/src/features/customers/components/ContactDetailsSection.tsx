import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import * as z from 'zod'

import { choice, email, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import {
  useCreateContactDetail,
  useDeleteContactDetail,
  useUpdateContactDetail,
} from '../api/useContactDetailMutations'
import { useContactDetails } from '../api/useContactDetails'
import { CONTACT_CHANNELS } from '../types/contactDetail'
import type { ContactDetail } from '../types/contactDetail'

// `value`'s format depends on `channel`: email-channel contacts must parse as
// an email address (mirrors `ContactDetailSerializer.validate` on the
// backend), phone/whatsapp stay plain text. `superRefine` re-raises `email()`'s
// OWN issue (code `invalid_format`, format `email`) at the `value` path
// instead of a hand-written message, so it still routes through the shared
// error map by code — verified against zod@4.4.3: `ctx.addIssue({...issue,
// path: ['value']})` preserves `code`/`format` and the map resolves
// `invalid_format.email` exactly as `email()`'s own callers do. See
// CONVENTIONS.md §20's "custom issue keeps its own message" rule — this is
// the sibling case, an issue with a STANDARD code re-pathed, not a literal.
const contactSchema = z
  .object({
    channel: choice(CONTACT_CHANNELS),
    value: requiredString(254),
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'email') {
      const result = email().safeParse(data.value)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: ['value'] })
        }
      }
    }
  })

type ContactFormValues = z.output<typeof contactSchema>

function channelOptions(t: TFunction<'customers'>) {
  return CONTACT_CHANNELS.map((value) => ({ value, label: t(`contacts.channels.${value}`) }))
}

export function ContactDetailsSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useContactDetails(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('contacts.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('contacts.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((contact) => (
                <ContactDetailRow key={contact.id} customerId={customerId} contact={contact} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="customers.manage">
          <ContactDetailAddForm customerId={customerId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function ContactDetailRow({ customerId, contact }: { customerId: number; contact: ContactDetail }) {
  const { t } = useTranslation('customers')
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteContactDetail(customerId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('contacts.delete.title'),
      description: t('contacts.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(contact.id)
  }

  if (isEditing) {
    return (
      <ContactDetailEditForm
        customerId={customerId}
        contact={contact}
        onDone={() => setIsEditing(false)}
      />
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{t(`contacts.channels.${contact.channel}`)}</Badge>
        {/* Latin-script value (an email, a phone number) inside an Arabic
            document needs an explicit LTR wrap — CONVENTIONS.md §18. */}
        <span dir="ltr">{contact.value}</span>
      </div>
      <Can permission="customers.manage">
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            {t('contacts.actions.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => void handleDelete()}
          >
            {t('contacts.actions.remove')}
          </Button>
        </div>
      </Can>
    </li>
  )
}

function ContactDetailAddForm({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: contactSchema, defaultValues: { channel: 'email', value: '' } })
  const mutation = useCreateContactDetail(customerId)

  function onSubmit(values: ContactFormValues) {
    mutation.mutate(
      { customer: customerId, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('contacts.created') })
          form.reset({ channel: 'email', value: '' })
          setFormErrors([])
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
          // A non-validation failure is already toasted by the shared
          // mutation error handler — CONVENTIONS.md §21.
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <div className="flex gap-2">
          <SelectField
            control={form.control}
            name="channel"
            label={t('contacts.fields.channel')}
            options={channelOptions(t)}
          />
          <TextField control={form.control} name="value" label={t('contacts.fields.value')} />
        </div>
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('contacts.actions.add')}
        </SubmitButton>
      </form>
    </Form>
  )
}

function ContactDetailEditForm({
  customerId,
  contact,
  onDone,
}: {
  customerId: number
  contact: ContactDetail
  onDone: () => void
}) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema: contactSchema,
    defaultValues: { channel: contact.channel, value: contact.value },
  })
  const mutation = useUpdateContactDetail(customerId, contact.id)

  function onSubmit(values: ContactFormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('contacts.updated') })
        onDone()
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <SelectField
              control={form.control}
              name="channel"
              label={t('contacts.fields.channel')}
              options={channelOptions(t)}
            />
            <TextField control={form.control} name="value" label={t('contacts.fields.value')} />
          </div>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending} size="sm">
              {t('contacts.actions.save')}
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('contacts.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
