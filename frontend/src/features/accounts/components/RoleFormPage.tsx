import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useRole } from '../api/useRole'
import { useCreateRole, useUpdateRole } from '../api/useRoleMutations'
import type { Role, RoleInput } from '../types/role'

// Django's own SlugField validation regex (django.core.validators.slug_re
// pattern, `^[-a-zA-Z0-9_]+$`) — matched client-side so a bad slug is a form
// error, not a round trip to the server.
const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[-a-zA-Z0-9_]+$/),
  name: requiredString(100),
  description: optionalString(255),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { slug: '', name: '', description: undefined }

function toDefaults(role: Role): FormValues {
  return { slug: role.slug, name: role.name, description: role.description || undefined }
}

function toRoleInput(values: FormValues): RoleInput {
  return { slug: values.slug, name: values.name, description: values.description ?? '' }
}

/** One component for both create and edit, per CONVENTIONS.md §20 — the
 * field set here is identical between modes, unlike `UserFormPage`. */
export function RoleFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const roleQuery = useRole(id, { enabled: isEdit })

  if (!isEdit) {
    return <RoleForm mode="create" />
  }

  return (
    <QueryBoundary query={roleQuery}>
      {(role) => <RoleForm mode="edit" id={id} role={role} />}
    </QueryBoundary>
  )
}

function RoleForm({ mode, id, role }: { mode: 'create' | 'edit'; id?: number; role?: Role }) {
  const { t } = useTranslation('accounts')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: role ? toDefaults(role) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toRoleInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'roles.created' : 'roles.updated'),
        })
        navigate('/roles')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  // A system role's slug is code-referenced (seed migrations key on it) and
  // rejected server-side by `RoleAdminSerializer.validate_slug` — disabling
  // it here makes that visible, not just enforced on submit.
  const slugDisabled = mode === 'edit' && role?.is_system === true

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'roles.new' : 'roles.edit')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField
                control={form.control}
                name="slug"
                label={t('roles.fields.slug')}
                disabled={slugDisabled}
              />
              <TextField control={form.control} name="name" label={t('roles.fields.name')} />
              <TextField
                control={form.control}
                name="description"
                label={t('roles.fields.description')}
              />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('roles.actions.save')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
