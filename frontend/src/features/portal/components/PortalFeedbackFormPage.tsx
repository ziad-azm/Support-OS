import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { choice, optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, RadioGroupField, TextareaField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreatePortalFeedback } from '../api/usePortalFeedbackMutations'
import { PORTAL_FEEDBACK_RATINGS } from '../types/portalFeedback'

const schema = z.object({
  rating: choice(PORTAL_FEEDBACK_RATINGS),
  comment: optionalString(2000),
})

type FormValues = z.output<typeof schema>

/**
 * Reached only from `PortalTicketDetailPage`'s "Rate this ticket" link
 * (task 9) — no data is fetched here (no GET call), so unlike
 * `PortalTicketDetailPage` there is no `Number.isNaN` guard: a bad or
 * tampered `:id` simply produces a server validation error on submit
 * ("That ticket does not belong to you." / not resolved/closed), surfaced
 * by `FormErrorSummary` exactly like any other server-side rejection.
 */
export function PortalFeedbackFormPage() {
  const { t } = useTranslation('portal')
  const navigate = useNavigate()
  const { toast } = useToast()
  const { id: idParam } = useParams()
  const ticketId = Number(idParam)
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    // 'satisfied' as the initial radio selection, matching the precedent
    // `TicketFormPage`'s own priority Select sets (a concrete default, not
    // an empty one) — see Story 47 `## Explicitly out of scope`'s note
    // that a real product might prefer no pre-selection to avoid biasing
    // responses; not built here, since no story asks for it.
    defaultValues: { rating: 'satisfied', comment: '' },
  })

  const mutation = useCreatePortalFeedback()

  function onSubmit(values: FormValues) {
    mutation.mutate(
      { ticket: ticketId, rating: values.rating, comment: values.comment ?? '' },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('tickets.feedback.created') })
          navigate(`/portal/tickets/${ticketId}`, { replace: true })
        },
        onError: (error) => {
          if (isValidationError(error)) {
            setFormErrors(applyServerErrors(form, error))
          }
        },
      },
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('tickets.feedback.title')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <RadioGroupField
            control={form.control}
            name="rating"
            label={t('tickets.feedback.fields.rating')}
            options={PORTAL_FEEDBACK_RATINGS.map((value) => ({
              value,
              label: t(`tickets.feedback.ratings.${value}`),
            }))}
          />
          <TextareaField
            control={form.control}
            name="comment"
            label={t('tickets.feedback.fields.comment')}
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('tickets.feedback.actions.submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
