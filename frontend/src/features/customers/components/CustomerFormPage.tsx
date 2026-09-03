import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { useBranches } from '@/shared/branches'
import { nullableEmail, optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCustomer } from '../api/useCustomer'
import { useCreateCustomer, useUpdateCustomer } from '../api/useCustomerMutations'
import type { Customer, CustomerInput } from '../types/customer'

// Radix's `Select.Item` requires a non-empty `value` — this sentinel stands
// in for "no branch" (ORG-2), the same role `DEPARTMENT_NONE` plays on the
// user and ticket forms.
const BRANCH_NONE = 'none'

const schema = z.object({
  name: requiredString(200),
  // Only `email` is a nullable database column — see Story 10 `## Edge
  // Cases`. `phone`/`company` are `blank=True` without `null=True`, so they
  // use `optionalString` (their serializer fields accept an absent key, and
  // an empty value is coalesced back to `''` in `toCustomerInput` below so a
  // cleared field is still sent explicitly, rather than silently dropped).
  email: nullableEmail(),
  phone: optionalString(40),
  company: optionalString(200),
  branch: z.string(),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = {
  name: '',
  email: '',
  phone: '',
  company: '',
  branch: BRANCH_NONE,
}

function toDefaults(customer: Customer): FormValues {
  return {
    name: customer.name,
    email: customer.email ?? '',
    phone: customer.phone,
    company: customer.company,
    branch: customer.branch === null ? BRANCH_NONE : String(customer.branch),
  }
}

// `optionalString` transforms a cleared input to `undefined` so `JSON.stringify`
// drops it from a hand-built payload — the right behaviour for a value that is
// genuinely absent. Here it would wrongly leave a cleared phone/company
// unchanged on the server, so it is coalesced back to `''` before the request
// is sent — `''` is a valid value for these `blank=True` columns.
function toCustomerInput(values: FormValues): CustomerInput {
  return {
    name: values.name,
    email: values.email,
    phone: values.phone ?? '',
    company: values.company ?? '',
    branch: values.branch === BRANCH_NONE ? null : Number(values.branch),
  }
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function CustomerFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const customerQuery = useCustomer(id, { enabled: isEdit })

  if (!isEdit) {
    return <CustomerForm mode="create" />
  }

  // `useAppForm`'s `defaultValues` are read once at mount, so the form must
  // not mount until the real customer has loaded — otherwise it mounts with
  // empty defaults and silently blanks every field the user does not touch.
  return (
    <QueryBoundary query={customerQuery}>
      {(customer) => <CustomerForm mode="edit" id={id} customer={customer} />}
    </QueryBoundary>
  )
}

function CustomerForm({
  mode,
  id,
  customer,
}: {
  mode: 'create' | 'edit'
  id?: number
  customer?: Customer
}) {
  const { t } = useTranslation('customers')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  // No second loading gate: the options query is independent of the
  // customer query this form already waits on via `QueryBoundary`, and
  // `UserFormPage` renders its own pickers the same way.
  const branchesQuery = useBranches()
  const branchOptions = [
    { value: BRANCH_NONE, label: t('fields.noBranch') },
    ...(branchesQuery.data?.items.map((branch) => ({
      value: String(branch.id),
      label: branch.name,
    })) ?? []),
  ]

  const form = useAppForm({
    schema,
    defaultValues: customer ? toDefaults(customer) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toCustomerInput(values), {
      onSuccess: (saved) => {
        toast({ tone: 'success', message: t(mode === 'create' ? 'created' : 'updated') })
        navigate(`/customers/${saved.id}`)
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
        // A non-validation failure is already toasted by the shared mutation
        // error handler. See CONVENTIONS.md §21.
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'new' : 'edit')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="name" label={t('fields.name')} />
          <TextField control={form.control} name="email" label={t('fields.email')} type="email" />
          <TextField control={form.control} name="phone" label={t('fields.phone')} />
          <TextField control={form.control} name="company" label={t('fields.company')} />
          <SelectField
            control={form.control}
            name="branch"
            label={t('fields.branch')}
            options={branchOptions}
          />
          <FormErrorSummary errors={formErrors} />
          <SubmitButton pending={mutation.isPending}>{t('actions.save')}</SubmitButton>
        </form>
      </Form>
    </div>
  )
}
