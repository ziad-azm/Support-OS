import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, TextareaField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateFaq, useUpdateFaq } from '../api/useFaqMutations'
import { useFaq } from '../api/useFaq'
import type { Faq, FaqInput } from '../types/faq'

const schema = z.object({
  question: requiredString(300),
  answer: requiredString(5000),
  // Inline, not a shared schemas.ts helper (CONVENTIONS.md §8) — no other
  // feature needs a min-at-zero integer yet. `positiveInt()` does not fit:
  // it floors at 1, and `order`'s default is 0.
  order: z.coerce.number().int().min(0).max(9999),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { question: '', answer: '', order: 0 }

function toDefaults(faq: Faq): FormValues {
  return { question: faq.question, answer: faq.answer, order: faq.order }
}

function toFaqInput(values: FormValues): FaqInput {
  return { question: values.question, answer: values.answer, order: values.order }
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function FaqFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const faqQuery = useFaq(id, { enabled: isEdit })

  if (!isEdit) {
    return <FaqForm mode="create" />
  }

  return (
    <QueryBoundary query={faqQuery}>
      {(faq) => <FaqForm mode="edit" id={id} faq={faq} />}
    </QueryBoundary>
  )
}

function FaqForm({ mode, id, faq }: { mode: 'create' | 'edit'; id?: number; faq?: Faq }) {
  const { t } = useTranslation('knowledgeBase')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: faq ? toDefaults(faq) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateFaq()
  const updateMutation = useUpdateFaq(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toFaqInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'manage.created' : 'manage.updated'),
        })
        navigate('/knowledge-base/manage')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {t(mode === 'create' ? 'manage.new' : 'manage.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="question" label={t('manage.fields.question')} />
          <TextareaField control={form.control} name="answer" label={t('manage.fields.answer')} />
          <TextField
            control={form.control}
            name="order"
            type="number"
            label={t('manage.fields.order')}
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('manage.actions.save')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
