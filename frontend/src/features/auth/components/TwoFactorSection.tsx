import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { useAuth } from '@/shared/auth'
import { downloadTextFile } from '@/shared/lib/download'
import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { confirmTwoFactor } from '../api/confirmTwoFactor'
import { disableTwoFactor } from '../api/disableTwoFactor'
import { enrollTwoFactor } from '../api/enrollTwoFactor'
import type { EnrollTwoFactorResponse } from '../api/enrollTwoFactor'

const confirmSchema = z.object({ code: requiredString(10) })
const disableSchema = z.object({ current_password: requiredString(128) })

/** Three states: not enrolled, mid-enrolment (QR shown, awaiting
 * confirmation), enabled. Recovery codes are shown exactly once, right
 * after a successful confirm — there is no later screen that can retrieve
 * them, matching `TwoFactorConfirmView`'s own backend guarantee. */
export function TwoFactorSection() {
  const { t } = useTranslation('auth')
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [pending, setPending] = useState<EnrollTwoFactorResponse | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [confirmErrors, setConfirmErrors] = useState<string[]>([])
  const [disableErrors, setDisableErrors] = useState<string[]>([])
  const [disabling, setDisabling] = useState(false)

  const confirmForm = useAppForm({ schema: confirmSchema, defaultValues: { code: '' } })
  const disableForm = useAppForm({ schema: disableSchema, defaultValues: { current_password: '' } })

  const enrollMutation = useMutation({
    mutationFn: enrollTwoFactor,
    onSuccess: (data) => setPending(data),
  })

  const confirmMutation = useMutation({
    mutationFn: (values: z.output<typeof confirmSchema>) => confirmTwoFactor(values),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recovery_codes)
      setPending(null)
      confirmForm.reset()
      setConfirmErrors([])
      await refreshUser()
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setConfirmErrors(applyServerErrors(confirmForm, error))
      }
    },
  })

  const disableMutation = useMutation({
    mutationFn: (values: z.output<typeof disableSchema>) => disableTwoFactor(values),
    onSuccess: async () => {
      toast({ tone: 'success', message: t('twoFactor.disabled') })
      setDisabling(false)
      disableForm.reset()
      setDisableErrors([])
      await refreshUser()
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setDisableErrors(applyServerErrors(disableForm, error))
      }
    },
  })

  if (recoveryCodes !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('twoFactor.recoveryCodesTitle')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('twoFactor.recoveryCodesHint')}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadTextFile('supportos-recovery-codes.txt', recoveryCodes.join('\n'))
              }
            >
              {t('twoFactor.downloadButton')}
            </Button>
            <Button type="button" onClick={() => setRecoveryCodes(null)}>
              {t('twoFactor.doneButton')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (user?.mfa_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('twoFactor.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{t('twoFactor.enabledLabel')}</p>
          {disabling ? (
            <Form {...disableForm}>
              <form
                onSubmit={disableForm.handleSubmit((values) => disableMutation.mutate(values))}
                className="flex flex-col gap-4"
              >
                <p className="text-sm text-muted-foreground">
                  {t('twoFactor.disableConfirmDescription')}
                </p>
                <TextField
                  control={disableForm.control}
                  name="current_password"
                  label={t('twoFactor.currentPassword')}
                  type="password"
                  autoComplete="current-password"
                />
                <FormErrorSummary errors={disableErrors} />
                <div className="flex gap-2">
                  <SubmitButton pending={disableMutation.isPending} variant="destructive">
                    {t('twoFactor.disableButton')}
                  </SubmitButton>
                  <Button type="button" variant="outline" onClick={() => setDisabling(false)}>
                    {t('actions.cancel', { ns: 'common' })}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Button type="button" variant="outline" onClick={() => setDisabling(true)}>
              {t('twoFactor.disableButton')}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (pending !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('twoFactor.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('twoFactor.scanQr')}</p>
          <QRCodeSVG value={pending.provisioning_uri} marginSize={4} className="h-40 w-40" />
          <p className="text-sm text-muted-foreground">{t('twoFactor.manualEntryHint')}</p>
          <code className="font-mono text-sm">{pending.secret}</code>
          <Form {...confirmForm}>
            <form
              onSubmit={confirmForm.handleSubmit((values) => confirmMutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <TextField
                control={confirmForm.control}
                name="code"
                label={t('twoFactor.codeLabel')}
                autoComplete="one-time-code"
                autoFocus
              />
              <FormErrorSummary errors={confirmErrors} />
              <SubmitButton pending={confirmMutation.isPending}>
                {t('twoFactor.confirmButton')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('twoFactor.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('twoFactor.disabledDescription')}</p>
        <Button
          type="button"
          onClick={() => enrollMutation.mutate()}
          disabled={enrollMutation.isPending}
        >
          {t('twoFactor.enableButton')}
        </Button>
      </CardContent>
    </Card>
  )
}
