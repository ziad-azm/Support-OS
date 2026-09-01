import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCategory } from '../api/useCategory'
import { useCreateCategory, useUpdateCategory } from '../api/useCategoryMutations'
import type { Category, CategoryInput } from '../types/category'

const schema = z.object({
  name: requiredString(100),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { name: '' }

function toDefaults(category: Category): FormValues {
  return { name: category.name }
}

function toCategoryInput(values: FormValues): CategoryInput {
  return { name: values.name }
}

/** One component for both create and edit, per `RoleFormPage`'s pattern
 * (CONVENTIONS.md §20) — the field set is identical between modes. */
export function CategoryFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const categoryQuery = useCategory(id, { enabled: isEdit })

  if (!isEdit) {
    return <CategoryForm mode="create" />
  }

  return (
    <QueryBoundary query={categoryQuery}>
      {(category) => <CategoryForm mode="edit" id={id} category={category} />}
    </QueryBoundary>
  )
}

function CategoryForm({
  mode,
  id,
  category,
}: {
  mode: 'create' | 'edit'
  id?: number
  category?: Category
}) {
  const { t } = useTranslation('tickets')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: category ? toDefaults(category) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toCategoryInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'categories.created' : 'categories.updated'),
        })
        navigate('/categories')
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
        {t(mode === 'create' ? 'categories.new' : 'categories.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField control={form.control} name="name" label={t('categories.fields.name')} />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending}>{t('categories.actions.save')}</SubmitButton>
            <Button type="button" variant="outline" onClick={() => navigate('/categories')}>
              {t('actions.cancel', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
