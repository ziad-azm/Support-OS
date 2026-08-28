import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import * as z from 'zod'

import { useAuth } from '@/shared/auth'
import { email, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, useAppForm } from '@/shared/ui/form'

const schema = z.object({
  email: email(),
  password: requiredString(),
})

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: { email: '', password: '' },
  })

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) => login(values.email, values.password),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
      // A wrong-credentials failure (code: authentication_failed) sets no
      // field errors — the global toast in AppProviders already shows the
      // translated message. See CONVENTIONS.md §21.
    },
  })

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('login.title')}</h1>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <TextField
            control={form.control}
            name="email"
            label={t('login.email')}
            type="email"
            autoComplete="email"
          />
          <TextField
            control={form.control}
            name="password"
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('login.submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
