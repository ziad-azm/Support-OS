import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { email, optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SelectField, SwitchField, TextField, useAppForm } from '@/shared/ui/form'
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

const baseShape = {
  email: email(),
  first_name: optionalString(150),
  last_name: optionalString(150),
  role: z.string(),
  is_active: z.boolean(),
}

const createSchema = z.object({ ...baseShape, password: requiredString(128) })
const editSchema = z.object(baseShape)

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

/**
 * Not the single-schema pattern `ArticleFormPage`/`CustomerFormPage` use —
 * create and edit have genuinely different fields here (`password` exists
 * only on create). The outer component still picks the mode the same way
 * `ArticleFormPage` does; each mode owns its own schema and its own
 * `useAppForm` call.
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

  const form = useAppForm({
    schema: createSchema,
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      role: ROLE_NONE,
      is_active: true,
      password: '',
    } satisfies CreateFormValues,
  })

  const createMutation = useCreateUser()

  function onSubmit(values: CreateFormValues) {
    const input: UserCreateInput = {
      email: values.email,
      first_name: values.first_name ?? '',
      last_name: values.last_name ?? '',
      is_active: values.is_active,
      role: values.role === ROLE_NONE ? null : Number(values.role),
      password: values.password,
    }
    createMutation.mutate(input, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('users.created') })
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
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('users.new')}</h1>
      {rolesPending ? (
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
                <SwitchField
                  control={form.control}
                  name="is_active"
                  label={t('users.fields.status')}
                />
                <TextField
                  control={form.control}
                  name="password"
                  label={t('users.fields.password')}
                  type="password"
                  autoComplete="new-password"
                />
              </CardContent>
            </Card>
            <FormErrorSummary errors={formErrors} />
            <Button type="submit" disabled={createMutation.isPending}>
              {t('users.actions.save')}
            </Button>
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

  const form = useAppForm({
    schema: editSchema,
    defaultValues: {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role === null ? ROLE_NONE : String(user.role),
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
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('users.edit')}</h1>
      {rolesPending ? (
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
                <SwitchField
                  control={form.control}
                  name="is_active"
                  label={t('users.fields.status')}
                />
              </CardContent>
            </Card>
            <FormErrorSummary errors={formErrors} />
            <Button type="submit" disabled={updateMutation.isPending}>
              {t('users.actions.save')}
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
}
