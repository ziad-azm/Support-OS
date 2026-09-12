import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { optionalString, requiredString } from '@/shared/validation/schemas'
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

import { useDepartment } from '../api/useDepartment'
import { useCreateDepartment, useUpdateDepartment } from '../api/useDepartmentMutations'
import type { Department, DepartmentInput } from '../types/department'

const LIST_PATH = '/settings/departments'

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

/** Nested under `DepartmentListPage`'s own route (`frontend/src/app/
 *  router.tsx`) — the list renders `<Outlet />`, this mounts only for
 *  `new`/`:id/edit`. `DSN-15` (Story 112) — see CONVENTIONS.md's entry. */
export function DepartmentFormDialog() {
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
      title={t(mode === 'create' ? 'departments.new' : 'departments.edit')}
      isDirty={form.formState.isDirty}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="name" label={t('departments.fields.name')} />
          <TextField
            control={form.control}
            name="description"
            label={t('departments.fields.description')}
          />
          <FormErrorSummary errors={formErrors} />
          <FormDialogFooter>
            <SubmitButton pending={mutation.isPending}>
              {t('departments.actions.save')}
            </SubmitButton>
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
