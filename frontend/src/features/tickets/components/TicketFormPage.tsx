import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { SelectField, TextField, TextareaField, useAppForm } from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCustomerOptions } from '../api/useCustomerOptions'
import { useTicket } from '../api/useTicket'
import { useCreateTicket, useUpdateTicket } from '../api/useTicketMutations'
import { TICKET_PRIORITIES } from '../types/ticket'
import type { Ticket, TicketInput } from '../types/ticket'

const ticketSchema = z.object({
  subject: requiredString(200),
  // No backend max_length mirrored here — `Ticket.description` is a plain
  // `TextField()` with no database cap. 5000 is a practical frontend-only
  // sanity ceiling, not a mirror of a server constraint.
  description: requiredString(5000),
  // Kept as a string, not `positiveInt()` — Select's value/onValueChange are
  // string-typed (Radix), and RHF's field.value must match. Converted to a
  // number only in `toTicketInput`. See Story 12 `## Prerequisites`.
  customer: z.string().min(1),
  priority: choice(TICKET_PRIORITIES),
})

type FormValues = z.output<typeof ticketSchema>

const EMPTY_DEFAULTS: FormValues = {
  subject: '',
  description: '',
  customer: '',
  priority: 'medium',
}

function toDefaults(ticket: Ticket): FormValues {
  return {
    subject: ticket.subject,
    description: ticket.description,
    customer: String(ticket.customer),
    priority: ticket.priority,
  }
}

function toTicketInput(values: FormValues): TicketInput {
  return {
    subject: values.subject,
    description: values.description,
    customer: Number(values.customer),
    priority: values.priority,
  }
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function TicketFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const ticketQuery = useTicket(id, { enabled: isEdit })

  if (!isEdit) {
    return <TicketForm mode="create" />
  }

  // `useAppForm`'s `defaultValues` are read once at mount, so the form must
  // not mount until the real ticket has loaded.
  return (
    <QueryBoundary query={ticketQuery}>
      {(ticket) => <TicketForm mode="edit" id={id} ticket={ticket} />}
    </QueryBoundary>
  )
}

function TicketForm({
  mode,
  id,
  ticket,
}: {
  mode: 'create' | 'edit'
  id?: number
  ticket?: Ticket
}) {
  const { t } = useTranslation('tickets')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const customerOptionsQuery = useCustomerOptions()

  const form = useAppForm({
    schema: ticketSchema,
    defaultValues: ticket ? toDefaults(ticket) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateTicket()
  const updateMutation = useUpdateTicket(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toTicketInput(values), {
      onSuccess: (saved) => {
        toast({ tone: 'success', message: t(mode === 'create' ? 'created' : 'updated') })
        navigate(`/tickets/${saved.id}`)
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
        // A non-validation failure is already toasted by the shared
        // mutation error handler. See CONVENTIONS.md §21.
      },
    })
  }

  const customerOptions =
    customerOptionsQuery.data?.items.map((customer) => ({
      value: String(customer.id),
      label: customer.name,
    })) ?? []

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'new' : 'edit')}</h1>
      {customerOptionsQuery.isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField control={form.control} name="subject" label={t('fields.subject')} />
            <TextareaField
              control={form.control}
              name="description"
              label={t('fields.description')}
            />
            <SelectField
              control={form.control}
              name="customer"
              label={t('fields.customer')}
              options={customerOptions}
            />
            <SelectField
              control={form.control}
              name="priority"
              label={t('fields.priority')}
              options={TICKET_PRIORITIES.map((value) => ({
                value,
                label: t(`priorities.${value}`),
              }))}
            />
            {formErrors.length > 0 ? (
              <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              {t('actions.save')}
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
}
