import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SubmitButton,
  TextField,
  TextareaField,
  useAppForm,
} from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreatePortalTicket } from '../api/usePortalTicketMutations'

// Same field caps as the staff TicketFormPage's own schema
// (features/tickets/components/TicketFormPage.tsx:33-38) — frontend-only
// sanity ceilings, not a mirror of a server constraint.
const schema = z.object({
  subject: requiredString(200),
  description: requiredString(5000),
})

type FormValues = z.output<typeof schema>

export function PortalTicketFormPage() {
  const { t } = useTranslation('portal')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: { subject: '', description: '' },
  })

  const mutation = useCreatePortalTicket()

  function onSubmit(values: FormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('tickets.created') })
        navigate('/portal', { replace: true })
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

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('tickets.new')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="subject" label={t('tickets.fields.subject')} />
          <TextareaField
            control={form.control}
            name="description"
            label={t('tickets.fields.description')}
          />
          <FormErrorSummary errors={formErrors} />
          <SubmitButton pending={mutation.isPending} pendingLabel={t('tickets.submitting')}>
            {t('tickets.actions.submit')}
          </SubmitButton>
        </form>
      </Form>
    </div>
  )
}
