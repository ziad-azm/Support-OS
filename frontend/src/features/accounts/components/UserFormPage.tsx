import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { useBranches } from '@/shared/branches'
import { useDepartments } from '@/shared/departments'
import { email, optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  SwitchField,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useRoles } from '../api/useRoles'
import { useUser } from '../api/useUser'
import { useCreateUser, useUpdateUser } from '../api/useUserMutations'
import type { AdminUser, UserCreateInput, UserUpdateInput } from '../types/user'

// Radix's `Select.Item` requires a non-empty `value` — this sentinel stands
// in for "no role", the same role `ArticleFormPage`'s `CATEGORY_NONE` plays
// for its own optional `category`.
const ROLE_NONE = 'none'
// Same sentinel shape as `ROLE_NONE` above, for the same Radix reason —
// "no department" (ORG-1).
const DEPARTMENT_NONE = 'none'
// Same sentinel shape as `DEPARTMENT_NONE` above, for the same Radix
// reason — "no branch" (ORG-2).
const BRANCH_NONE = 'none'

const baseShape = {
  email: email(),
  first_name: optionalString(150),
  last_name: optionalString(150),
  role: z.string(),
  department: z.string(),
  branch: z.string(),
}

const createSchema = z.object(baseShape)
const editSchema = z.object({ ...baseShape, is_active: z.boolean() })

type CreateFormValues = z.output<typeof createSchema>
type EditFormValues = z.output<typeof editSchema>

function useRoleOptions(noRoleLabel: string) {
  const rolesQuery = useRoles({ page: 1, page_size: 100 })
  const options = [
    { value: ROLE_NONE, label: noRoleLabel },
    ...(rolesQuery.data?.items.map((role) => ({ value: String(role.id), label: role.name })) ?? []),
  ]
  return { options, isPending: rolesQuery.isPending }
}

function useDepartmentOptions(noDepartmentLabel: string) {
  const departmentsQuery = useDepartments()
  const options = [
    { value: DEPARTMENT_NONE, label: noDepartmentLabel },
    ...(departmentsQuery.data?.items.map((department) => ({
      value: String(department.id),
      label: department.name,
    })) ?? []),
  ]
  return { options, isPending: departmentsQuery.isPending }
}

function useBranchOptions(noBranchLabel: string) {
  const branchesQuery = useBranches()
  const options = [
    { value: BRANCH_NONE, label: noBranchLabel },
    ...(branchesQuery.data?.items.map((branch) => ({
      value: String(branch.id),
      label: branch.name,
    })) ?? []),
  ]
  return { options, isPending: branchesQuery.isPending }
}

/**
 * Not the single-schema pattern `ArticleFormPage`/`CustomerFormPage` use —
 * create and edit have genuinely different fields here (`is_active` exists
 * only on edit; a new account is always pending until its owner accepts
 * the emailed invite, SEC-5). The outer component still picks the mode the
 * same way `ArticleFormPage` does; each mode owns its own schema and its
 * own `useAppForm` call.
 */
export function UserFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const userQuery = useUser(id, { enabled: isEdit })

  if (!isEdit) {
    return <UserCreateForm />
  }

  return (
    <QueryBoundary query={userQuery}>
      {(user) => <UserEditForm user={user} id={id} />}
    </QueryBoundary>
  )
}

function UserCreateForm() {
  const { t } = useTranslation('accounts')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const { options: roleOptions, isPending: rolesPending } = useRoleOptions(t('users.noRole'))
  const { options: departmentOptions, isPending: departmentsPending } = useDepartmentOptions(
    t('users.noDepartment'),
  )
  const { options: branchOptions, isPending: branchesPending } = useBranchOptions(
    t('users.noBranch'),
  )

  const form = useAppForm({
    schema: createSchema,
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      role: ROLE_NONE,
      department: DEPARTMENT_NONE,
      branch: BRANCH_NONE,
    } satisfies CreateFormValues,
  })

  const createMutation = useCreateUser()

  function onSubmit(values: CreateFormValues) {
    const input: UserCreateInput = {
      email: values.email,
      first_name: values.first_name ?? '',
      last_name: values.last_name ?? '',
      role: values.role === ROLE_NONE ? null : Number(values.role),
      department: values.department === DEPARTMENT_NONE ? null : Number(values.department),
      branch: values.branch === BRANCH_NONE ? null : Number(values.branch),
    }
    createMutation.mutate(input, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('users.inviteSent') })
        navigate('/users')
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
      <h1 className="text-lg font-semibold">{t('users.new')}</h1>
      {rolesPending || departmentsPending || branchesPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{t('users.inviteHint')}</p>
                <TextField
                  control={form.control}
                  name="email"
                  label={t('users.fields.email')}
                  type="email"
                />
                <TextField
                  control={form.control}
                  name="first_name"
                  label={t('users.fields.firstName')}
                />
                <TextField
                  control={form.control}
                  name="last_name"
                  label={t('users.fields.lastName')}
                />
                <SelectField
                  control={form.control}
                  name="role"
                  label={t('users.fields.role')}
                  options={roleOptions}
                />
                <SelectField
                  control={form.control}
                  name="department"
                  label={t('users.fields.department')}
                  options={departmentOptions}
                />
                <SelectField
                  control={form.control}
                  name="branch"
                  label={t('users.fields.branch')}
                  options={branchOptions}
                />
              </CardContent>
            </Card>
            <FormErrorSummary errors={formErrors} />
            <div className="flex gap-2">
              <SubmitButton pending={createMutation.isPending}>
                {t('users.actions.save')}
              </SubmitButton>
              <Button type="button" variant="outline" onClick={() => navigate('/users')}>
                {t('actions.cancel', { ns: 'common' })}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}

function UserEditForm({ user, id }: { user: AdminUser; id: number }) {
  const { t } = useTranslation('accounts')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const { options: roleOptions, isPending: rolesPending } = useRoleOptions(t('users.noRole'))
  const { options: departmentOptions, isPending: departmentsPending } = useDepartmentOptions(
    t('users.noDepartment'),
  )
  const { options: branchOptions, isPending: branchesPending } = useBranchOptions(
    t('users.noBranch'),
  )

  const form = useAppForm({
    schema: editSchema,
    defaultValues: {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role === null ? ROLE_NONE : String(user.role),
      department: user.department === null ? DEPARTMENT_NONE : String(user.department),
      branch: user.branch === null ? BRANCH_NONE : String(user.branch),
      is_active: user.is_active,
    } satisfies EditFormValues,
  })

  const updateMutation = useUpdateUser(id)

  function onSubmit(values: EditFormValues) {
    const input: UserUpdateInput = {
      email: values.email,
      first_name: values.first_name ?? '',
      last_name: values.last_name ?? '',
      is_active: values.is_active,
      role: values.role === ROLE_NONE ? null : Number(values.role),
      department: values.department === DEPARTMENT_NONE ? null : Number(values.department),
      branch: values.branch === BRANCH_NONE ? null : Number(values.branch),
    }
    updateMutation.mutate(input, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('users.updated') })
        navigate('/users')
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
      <h1 className="text-lg font-semibold">{t('users.edit')}</h1>
      {rolesPending || departmentsPending || branchesPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="email"
                  label={t('users.fields.email')}
                  type="email"
                />
                <TextField
                  control={form.control}
                  name="first_name"
                  label={t('users.fields.firstName')}
                />
                <TextField
                  control={form.control}
                  name="last_name"
                  label={t('users.fields.lastName')}
                />
                <SelectField
                  control={form.control}
                  name="role"
                  label={t('users.fields.role')}
                  options={roleOptions}
                />
                <SelectField
                  control={form.control}
                  name="department"
                  label={t('users.fields.department')}
                  options={departmentOptions}
                />
                <SelectField
                  control={form.control}
                  name="branch"
                  label={t('users.fields.branch')}
                  options={branchOptions}
                />
                <SwitchField
                  control={form.control}
                  name="is_active"
                  label={t('users.fields.status')}
                />
              </CardContent>
            </Card>
            <FormErrorSummary errors={formErrors} />
            <div className="flex gap-2">
              <SubmitButton pending={updateMutation.isPending}>
                {t('users.actions.save')}
              </SubmitButton>
              <Button type="button" variant="outline" onClick={() => navigate('/users')}>
                {t('actions.cancel', { ns: 'common' })}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
