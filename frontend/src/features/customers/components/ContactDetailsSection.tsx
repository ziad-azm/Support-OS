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
  CheckboxField,
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
// Used by `ContactDetailEditForm` — editing an existing contact has no
// "also create a second one" action; see `addContactSchema` below for that.
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

// Same shape as `contactSchema` plus one extra checkbox — ADD-only (see
// `ContactDetailAddForm`). Duplicates the `superRefine` body rather than
// `.extend()`ing `contactSchema` — a `ZodEffects` (what `.superRefine`
// returns) has no `.extend()`; re-deriving from a plain object is simpler
// than un-wrapping it.
const addContactSchema = z
  .object({
    channel: choice(CONTACT_CHANNELS),
    value: requiredString(254),
    // Only meaningful (and only shown) when `channel === 'phone'`. Creates
    // a second `ContactDetail` row (`channel: 'whatsapp'`, same value)
    // right after the create itself succeeds, so a number that serves as
    // both never has to be typed twice.
    also_whatsapp: z.boolean().default(false),
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

type AddContactFormValues = z.output<typeof addContactSchema>

const EMPTY_ADD_CONTACT: AddContactFormValues = {
  channel: 'email',
  value: '',
  also_whatsapp: false,
}

function channelOptions(t: TFunction<'customers'>) {
  return CONTACT_CHANNELS.map((value) => ({ value, label: t(`contacts.channels.${value}`) }))
}

/** Whether this customer already has a `whatsapp`-channel contact with this
 * exact value — checked BEFORE attempting to create the "also_whatsapp"
 * duplicate, so an already-satisfied case (e.g. someone else already added
 * it, or it's left over from a prior save) is a silent no-op instead of a
 * raw "must make a unique set" database-constraint error reaching the
 * agent. Message-matching that error instead would be fragile — the
 * backend localises it through `Accept-Language`, so its exact English
 * text is not guaranteed. */
function hasWhatsappContact(contacts: ContactDetail[] | undefined, value: string): boolean {
  return (contacts ?? []).some(
    (contact) => contact.channel === 'whatsapp' && contact.value === value,
  )
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
        <Badge variant="outline">{t(`contacts.channels.${contact.channel}`)}</Badge>
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
  const form = useAppForm({ schema: addContactSchema, defaultValues: EMPTY_ADD_CONTACT })
  const mutation = useCreateContactDetail(customerId)
  const channel = form.watch('channel')
  // Same query `ContactDetailsSection` already fetches for this customer —
  // an extra call here is a cache read, not a network request, since
  // React Query dedupes by this identical key.
  const contactsQuery = useContactDetails(customerId)

  function handleSuccess() {
    toast({ tone: 'success', message: t('contacts.created') })
    form.reset(EMPTY_ADD_CONTACT)
    setFormErrors([])
  }

  function handleError(error: unknown) {
    if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
    // A non-validation failure is already toasted by the shared mutation
    // error handler — CONVENTIONS.md §21.
  }

  function onSubmit(values: AddContactFormValues) {
    mutation.mutate(
      { customer: customerId, channel: values.channel, value: values.value },
      {
        onSuccess: () => {
          const needsWhatsapp = values.channel === 'phone' && values.also_whatsapp
          if (!needsWhatsapp || hasWhatsappContact(contactsQuery.data?.items, values.value)) {
            handleSuccess()
            return
          }
          // One typed number, two `ContactDetail` rows — see
          // `also_whatsapp`'s own docstring on `addContactSchema`.
          mutation.mutate(
            { customer: customerId, channel: 'whatsapp', value: values.value },
            { onSuccess: handleSuccess, onError: handleError },
          )
        },
        onError: handleError,
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
        {channel === 'phone' ? (
          <CheckboxField
            control={form.control}
            name="also_whatsapp"
            label={t('contacts.fields.alsoWhatsapp')}
          />
        ) : null}
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
  // Plain `channel`/`value` only — no "also_whatsapp" shortcut here. That
  // checkbox is a CREATE-time convenience (`ContactDetailAddForm`) for a
  // number that doesn't have a WhatsApp row yet; once a contact already
  // exists, adding WhatsApp for it means adding a new entry with that
  // channel directly, not re-editing an unrelated existing row.
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
