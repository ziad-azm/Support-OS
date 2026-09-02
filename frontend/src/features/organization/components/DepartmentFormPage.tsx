import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useDepartment } from '../api/useDepartment'
import { useCreateDepartment, useUpdateDepartment } from '../api/useDepartmentMutations'
import type { Department, DepartmentInput } from '../types/department'

const schema = z.object({
  name: requiredString(100),
  // `.transform(… ?? '')` because `description` is `blank=True` and NOT
  // nullable on the server — a cleared field must round-trip as `''`, not
  // `null` (CONVENTIONS.md §23's `optionalString`/`nullableString` table).
  description: optionalString(255).transform((value) => value ?? ''),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { name: '', description: '' }

function toDefaults(department: Department): FormValues {
  return { name: department.name, description: department.description }
}

function toDepartmentInput(values: FormValues): DepartmentInput {
  return { name: values.name, description: values.description }
}

/** One component for both create and edit, per `RoleFormPage`'s pattern
 * (CONVENTIONS.md §20) — the field set is identical between modes, the
 * same as `CategoryFormPage`. */
export function DepartmentFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const departmentQuery = useDepartment(id, { enabled: isEdit })

  if (!isEdit) {
    return <DepartmentForm mode="create" />
  }

  return (
    <QueryBoundary query={departmentQuery}>
      {(department) => <DepartmentForm mode="edit" id={id} department={department} />}
    </QueryBoundary>
  )
}

function DepartmentForm({
  mode,
  id,
  department,
}: {
  mode: 'create' | 'edit'
  id?: number
  department?: Department
}) {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: department ? toDefaults(department) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateDepartment()
  const updateMutation = useUpdateDepartment(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toDepartmentInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'departments.created' : 'departments.updated'),
        })
        navigate('/settings/departments')
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
        {t(mode === 'create' ? 'departments.new' : 'departments.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField control={form.control} name="name" label={t('departments.fields.name')} />
              <TextField
                control={form.control}
                name="description"
                label={t('departments.fields.description')}
              />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending}>
              {t('departments.actions.save')}
            </SubmitButton>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/settings/departments')}
            >
              {t('actions.cancel', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
