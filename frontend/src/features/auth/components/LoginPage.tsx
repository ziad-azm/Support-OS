import { useMutation } from '@tanstack/react-query'
import { LogInIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import * as z from 'zod'

import { useAuth } from '@/shared/auth'
import { email, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'

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
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <LogInIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
      </div>
      <Card>
        <CardContent>
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
                autoFocus
              />
              <TextField
                control={form.control}
                name="password"
                label={t('login.password')}
                type="password"
                autoComplete="current-password"
              />
              <div className="text-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('login.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="flex flex-col items-center gap-1 text-center text-sm text-muted-foreground">
        <span>{t('help.prompt')}</span>
        <div className="flex items-center gap-3">
          <Link
            to="/contact"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('help.contact')}
          </Link>
          <Link to="/chat" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('help.chat')}
          </Link>
        </div>
      </div>
    </div>
  )
}
