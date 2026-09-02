import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { useDepartments } from '@/shared/departments'
import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
  useAppForm,
} from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCategories } from '../api/useCategories'
import { useCustomerOptions } from '../api/useCustomerOptions'
import { useTicket } from '../api/useTicket'
import { useCreateTicket, useUpdateTicket } from '../api/useTicketMutations'
import { TICKET_PRIORITIES } from '../types/ticket'
import type { Ticket, TicketInput } from '../types/ticket'

// Radix's `Select.Item` requires a non-empty `value` — this sentinel stands
// in for "no category" the same way the list filters' `"all"` sentinel
// stands in for "no filter" (TicketListPage). See CONVENTIONS.md §19.
const CATEGORY_NONE = 'none'
// Same sentinel shape as `CATEGORY_NONE` above, for the same Radix reason
// — "no department" (ORG-1).
const DEPARTMENT_NONE = 'none'

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
  category: z.string().min(1),
  department: z.string().min(1),
  priority: choice(TICKET_PRIORITIES),
})

type FormValues = z.output<typeof ticketSchema>

const EMPTY_DEFAULTS: FormValues = {
  subject: '',
  description: '',
  customer: '',
  category: CATEGORY_NONE,
  department: DEPARTMENT_NONE,
  priority: 'medium',
}

function toDefaults(ticket: Ticket): FormValues {
  return {
    subject: ticket.subject,
    description: ticket.description,
    customer: String(ticket.customer),
    category: ticket.category === null ? CATEGORY_NONE : String(ticket.category),
    department: ticket.department === null ? DEPARTMENT_NONE : String(ticket.department),
    priority: ticket.priority,
  }
}

function toTicketInput(values: FormValues): TicketInput {
  return {
    subject: values.subject,
    description: values.description,
    customer: Number(values.customer),
    category: values.category === CATEGORY_NONE ? null : Number(values.category),
    department: values.department === DEPARTMENT_NONE ? null : Number(values.department),
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
  const categoriesQuery = useCategories()
  const departmentsQuery = useDepartments()

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

  const categoryOptions =
    categoriesQuery.data?.items.map((category) => ({
      value: String(category.id),
      label: category.name,
    })) ?? []

  const departmentOptions =
    departmentsQuery.data?.items.map((department) => ({
      value: String(department.id),
      label: department.name,
    })) ?? []

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'new' : 'edit')}</h1>
      {customerOptionsQuery.isPending || categoriesQuery.isPending || departmentsQuery.isPending ? (
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
              description={t('fields.customerSearchHint')}
              options={customerOptions}
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
            <SelectField
              control={form.control}
              name="department"
              label={t('fields.department')}
              options={[
                { value: DEPARTMENT_NONE, label: t('fields.noDepartment') },
                ...departmentOptions,
              ]}
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
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>{t('actions.save')}</SubmitButton>
          </form>
        </Form>
      )}
    </div>
  )
}
