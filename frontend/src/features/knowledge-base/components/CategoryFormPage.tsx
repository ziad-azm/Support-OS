import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { HEX_COLOR_RE } from '@/shared/branding/config'
import { foregroundFor } from '@/shared/branding/contrast'
import { i18next } from '@/shared/i18n'
import { optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Badge } from '@/shared/ui/primitives/badge'
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

const LIST_PATH = '/knowledge-base/categories'

const schema = z
  .object({
    name: requiredString(100),
    color: optionalString(7).transform((value) => value ?? ''),
  })
  // Same hand-written custom issue `organization:settings.invalidColor`
  // already uses (CONVENTIONS.md §20) — Zod has no hex-colour primitive,
  // and this field stays optional (blank = fall back to the badge's
  // default style), so the check only runs when non-empty.
  .superRefine((data, ctx) => {
    if (data.color !== '' && !HEX_COLOR_RE.test(data.color)) {
      ctx.addIssue({
        code: 'custom',
        path: ['color'],
        message: i18next.t('knowledgeBase:categories.invalidColor'),
      })
    }
  })

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { name: '', color: '' }

function toDefaults(category: Category): FormValues {
  return { name: category.name, color: category.color }
}

function toCategoryInput(values: FormValues): CategoryInput {
  return { name: values.name, color: values.color }
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
  const { t } = useTranslation('knowledgeBase')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: category ? toDefaults(category) : EMPTY_DEFAULTS,
  })
  // Drives the live badge preview below, the same `form.watch(name)` pattern
  // `organization/SettingsPage.tsx`'s brand-colour preview already uses —
  // repaints only this preview on keystroke, never the real category badges
  // elsewhere, which only pick up the saved value after submit.
  const colorDraft = form.watch('color')
  const nameDraft = form.watch('name')

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
          <TextField
            control={form.control}
            name="color"
            label={t('categories.fields.color')}
            description={t('categories.colorHint')}
          />
          {HEX_COLOR_RE.test(colorDraft) ? (
            // F-32 (QA-REPORT-1): `role="group"` is required for
            // `aria-label` to apply — a bare `<div>` is
            // `role="generic"`, which ARIA prohibits naming.
            <div
              role="group"
              className="flex items-center gap-2"
              aria-label={t('categories.colorPreview')}
            >
              <span
                className="size-8 shrink-0 rounded border"
                style={{ backgroundColor: colorDraft }}
              />
              <Badge style={{ backgroundColor: colorDraft, color: foregroundFor(colorDraft) }}>
                {nameDraft || t('categories.fields.name')}
              </Badge>
            </div>
          ) : null}
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
