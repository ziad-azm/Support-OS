import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormDialog,
  FormDialogClose,
  FormDialogFooter,
  FormErrorSummary,
  SubmitButton,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCategory } from '../api/useCategory'
import { useCreateCategory, useUpdateCategory } from '../api/useCategoryMutations'
import type { Category, CategoryInput } from '../types/category'

const LIST_PATH = '/categories'

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

/** Nested under `CategoryListPage`'s own route (`frontend/src/app/
 *  router.tsx`) — the list renders `<Outlet />`, this mounts only for
 *  `new`/`:id/edit`. `DSN-15` (Story 112) — see CONVENTIONS.md's entry. */
export function CategoryFormDialog() {
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
        navigate(LIST_PATH)
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(LIST_PATH)
      }}
      title={t(mode === 'create' ? 'categories.new' : 'categories.edit')}
      isDirty={form.formState.isDirty}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="name" label={t('categories.fields.name')} />
          <FormErrorSummary errors={formErrors} />
          <FormDialogFooter>
            <SubmitButton pending={mutation.isPending}>{t('categories.actions.save')}</SubmitButton>
            <FormDialogClose asChild>
              <Button type="button" variant="outline">
                {t('actions.cancel', { ns: 'common' })}
              </Button>
            </FormDialogClose>
          </FormDialogFooter>
        </form>
      </Form>
    </FormDialog>
  )
}
