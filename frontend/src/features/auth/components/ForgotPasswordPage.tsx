import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2Icon, MailQuestionIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as z from 'zod'

import { email } from '@/shared/validation/schemas'
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

import { requestPasswordReset } from '../api/requestPasswordReset'

const schema = z.object({ email: email() })
type FormValues = z.output<typeof schema>

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CheckCircle2Icon className="size-10 text-success" />
          <CardTitle asChild className="text-xl">
            <h1>{t('forgotPassword.successTitle')}</h1>
          </CardTitle>
          <CardDescription>
            {t('forgotPassword.successDescription')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('forgotPassword.backToSignIn')}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <ForgotPasswordForm onDone={() => setSubmitted(true)} />
}

function ForgotPasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('auth')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema, defaultValues: { email: '' } })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => requestPasswordReset(values),
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
          <MailQuestionIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('forgotPassword.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgotPassword.subtitle')}</p>
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
                label={t('forgotPassword.email')}
                type="email"
                autoComplete="email"
                autoFocus
              />
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('forgotPassword.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('forgotPassword.backToSignIn')}
        </Link>
      </p>
    </div>
  )
}
