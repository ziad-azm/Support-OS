import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2Icon, KeyRoundIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'

import { confirmPasswordReset } from '../api/confirmPasswordReset'

const schema = z.object({ password: requiredString(128) })
type FormValues = z.output<typeof schema>

export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild className="text-xl">
            <h1>{t('resetPassword.invalidTitle')}</h1>
          </CardTitle>
          <CardDescription>{t('resetPassword.invalidDescription')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CheckCircle2Icon className="size-10 text-success" />
          <CardTitle asChild className="text-xl">
            <h1>{t('resetPassword.successTitle')}</h1>
          </CardTitle>
          <CardDescription>
            {t('resetPassword.successDescription')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('resetPassword.signIn')}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <ResetPasswordForm token={token} onDone={() => setDone(true)} />
}

function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useTranslation('auth')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema, defaultValues: { password: '' } })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => confirmPasswordReset({ token, password: values.password }),
    onSuccess: onDone,
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
    },
  })

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRoundIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('resetPassword.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('resetPassword.subtitle')}</p>
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
                name="password"
                label={t('resetPassword.password')}
                type="password"
                autoComplete="new-password"
                autoFocus
              />
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('resetPassword.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
