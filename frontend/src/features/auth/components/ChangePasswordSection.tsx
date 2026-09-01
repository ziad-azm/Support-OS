import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { changePassword } from '../api/changePassword'

const schema = z.object({
  current_password: requiredString(128),
  new_password: requiredString(128),
})
type FormValues = z.output<typeof schema>

export function ChangePasswordSection() {
  const { t } = useTranslation('auth')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema,
    defaultValues: { current_password: '', new_password: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => changePassword(values),
    onSuccess: () => {
      toast({ tone: 'success', message: t('changePassword.success') })
      form.reset()
      setFormErrors([])
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('changePassword.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <TextField
              control={form.control}
              name="current_password"
              label={t('changePassword.currentPassword')}
              type="password"
              autoComplete="current-password"
            />
            <TextField
              control={form.control}
              name="new_password"
              label={t('changePassword.newPassword')}
              type="password"
              autoComplete="new-password"
            />
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>{t('changePassword.submit')}</SubmitButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
