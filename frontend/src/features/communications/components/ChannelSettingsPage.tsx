import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { optionalEmail, optionalString, positiveInt } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SubmitButton,
  SwitchField,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useEmailProviderConfig } from '../api/useEmailProviderConfig'
import { useSmsProviderConfig } from '../api/useSmsProviderConfig'
import { useUpdateEmailProviderConfig } from '../api/useUpdateEmailProviderConfig'
import { useUpdateSmsProviderConfig } from '../api/useUpdateSmsProviderConfig'
import { useUpdateWhatsAppProviderConfig } from '../api/useUpdateWhatsAppProviderConfig'
import { useWhatsAppProviderConfig } from '../api/useWhatsAppProviderConfig'
import type {
  EmailProviderConfig,
  SmsProviderConfig,
  WhatsAppProviderConfig,
} from '../types/providers'

// Same non-empty-only `z.url()` check `ErpSettingsPage.tsx` (Story 81)
// applies to `base_url`, reused here for every provider's own API base
// URL field.
function urlBaseRefine(data: { api_base_url: string }, ctx: z.RefinementCtx) {
  if (data.api_base_url === '') return
  const result = z.url().safeParse(data.api_base_url)
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: ['api_base_url'] })
    }
  }
}

export function ChannelSettingsPage() {
  const { t } = useTranslation('communications')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('channels.title')} />
      <EmailProviderSection />
      <WhatsAppProviderSection />
      <SmsProviderSection />
    </div>
  )
}

const emailSchema = z.object({
  host: optionalString(255).transform((value) => value ?? ''),
  port: positiveInt(65535),
  host_user: optionalString(255).transform((value) => value ?? ''),
  host_password: optionalString(255).transform((value) => value ?? ''),
  use_tls: z.boolean(),
  default_from_email: optionalEmail().transform((value) => value ?? ''),
})
type EmailFormValues = z.output<typeof emailSchema>

function emailDefaults(config: EmailProviderConfig): EmailFormValues {
  return {
    host: config.host,
    port: config.port,
    host_user: config.host_user,
    // Never prefilled — the API does not return it (write-only).
    host_password: '',
    use_tls: config.use_tls,
    default_from_email: config.default_from_email,
  }
}

function EmailProviderSection() {
  const query = useEmailProviderConfig()
  return (
    <QueryBoundary query={query}>{(config) => <EmailProviderForm config={config} />}</QueryBoundary>
  )
}

function EmailProviderForm({ config }: { config: EmailProviderConfig }) {
  const { t } = useTranslation('communications')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const mutation = useUpdateEmailProviderConfig()
  const form = useAppForm({ schema: emailSchema, defaultValues: emailDefaults(config) })

  function onSubmit(values: EmailFormValues) {
    const { host_password, ...rest } = values
    mutation.mutate(
      { ...rest, ...(host_password ? { host_password } : {}) },
      {
        onSuccess: (updated) => {
          toast({ tone: 'success', message: t('channels.saved') })
          setFormErrors([])
          form.reset(emailDefaults(updated))
        },
        onError: (error) => {
          if (isValidationError(error)) {
            setFormErrors(applyServerErrors(form, error))
          }
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('channels.email.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField control={form.control} name="host" label={t('channels.email.host')} />
            <TextField
              control={form.control}
              name="port"
              type="number"
              label={t('channels.email.port')}
            />
            <TextField
              control={form.control}
              name="host_user"
              label={t('channels.email.hostUser')}
            />
            <TextField
              control={form.control}
              name="host_password"
              type="password"
              autoComplete="off"
              label={t('channels.email.hostPassword')}
              description={
                config.has_host_password
                  ? `${t('channels.tokenSet')} ${t('channels.tokenKeepHint')}`
                  : `${t('channels.tokenUnset')} ${t('channels.tokenKeepHint')}`
              }
            />
            <SwitchField control={form.control} name="use_tls" label={t('channels.email.useTls')} />
            <TextField
              control={form.control}
              name="default_from_email"
              type="email"
              label={t('channels.email.defaultFromEmail')}
            />
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>{t('channels.actions.save')}</SubmitButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

const whatsappSchema = z
  .object({
    api_base_url: optionalString(500).transform((value) => value ?? ''),
    phone_number_id: optionalString(100).transform((value) => value ?? ''),
    access_token: optionalString(500).transform((value) => value ?? ''),
  })
  .superRefine(urlBaseRefine)
type WhatsAppFormValues = z.output<typeof whatsappSchema>

function whatsappDefaults(config: WhatsAppProviderConfig): WhatsAppFormValues {
  return {
    api_base_url: config.api_base_url,
    phone_number_id: config.phone_number_id,
    access_token: '',
  }
}

function WhatsAppProviderSection() {
  const query = useWhatsAppProviderConfig()
  return (
    <QueryBoundary query={query}>
      {(config) => <WhatsAppProviderForm config={config} />}
    </QueryBoundary>
  )
}

function WhatsAppProviderForm({ config }: { config: WhatsAppProviderConfig }) {
  const { t } = useTranslation('communications')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const mutation = useUpdateWhatsAppProviderConfig()
  const form = useAppForm({ schema: whatsappSchema, defaultValues: whatsappDefaults(config) })

  function onSubmit(values: WhatsAppFormValues) {
    const { access_token, ...rest } = values
    mutation.mutate(
      { ...rest, ...(access_token ? { access_token } : {}) },
      {
        onSuccess: (updated) => {
          toast({ tone: 'success', message: t('channels.saved') })
          setFormErrors([])
          form.reset(whatsappDefaults(updated))
        },
        onError: (error) => {
          if (isValidationError(error)) {
            setFormErrors(applyServerErrors(form, error))
          }
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('channels.whatsapp.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField
              control={form.control}
              name="api_base_url"
              label={t('channels.whatsapp.apiBaseUrl')}
            />
            <TextField
              control={form.control}
              name="phone_number_id"
              label={t('channels.whatsapp.phoneNumberId')}
            />
            <TextField
              control={form.control}
              name="access_token"
              type="password"
              autoComplete="off"
              label={t('channels.whatsapp.accessToken')}
              description={
                config.has_access_token
                  ? `${t('channels.tokenSet')} ${t('channels.tokenKeepHint')}`
                  : `${t('channels.tokenUnset')} ${t('channels.tokenKeepHint')}`
              }
            />
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>{t('channels.actions.save')}</SubmitButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

const smsSchema = z
  .object({
    api_base_url: optionalString(500).transform((value) => value ?? ''),
    account_sid: optionalString(100).transform((value) => value ?? ''),
    auth_token: optionalString(500).transform((value) => value ?? ''),
    from_number: optionalString(40).transform((value) => value ?? ''),
  })
  .superRefine(urlBaseRefine)
type SmsFormValues = z.output<typeof smsSchema>

function smsDefaults(config: SmsProviderConfig): SmsFormValues {
  return {
    api_base_url: config.api_base_url,
    account_sid: config.account_sid,
    auth_token: '',
    from_number: config.from_number,
  }
}

function SmsProviderSection() {
  const query = useSmsProviderConfig()
  return (
    <QueryBoundary query={query}>{(config) => <SmsProviderForm config={config} />}</QueryBoundary>
  )
}

function SmsProviderForm({ config }: { config: SmsProviderConfig }) {
  const { t } = useTranslation('communications')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const mutation = useUpdateSmsProviderConfig()
  const form = useAppForm({ schema: smsSchema, defaultValues: smsDefaults(config) })

  function onSubmit(values: SmsFormValues) {
    const { auth_token, ...rest } = values
    mutation.mutate(
      { ...rest, ...(auth_token ? { auth_token } : {}) },
      {
        onSuccess: (updated) => {
          toast({ tone: 'success', message: t('channels.saved') })
          setFormErrors([])
          form.reset(smsDefaults(updated))
        },
        onError: (error) => {
          if (isValidationError(error)) {
            setFormErrors(applyServerErrors(form, error))
          }
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('channels.sms.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField
              control={form.control}
              name="api_base_url"
              label={t('channels.sms.apiBaseUrl')}
            />
            <TextField
              control={form.control}
              name="account_sid"
              label={t('channels.sms.accountSid')}
            />
            <TextField
              control={form.control}
              name="auth_token"
              type="password"
              autoComplete="off"
              label={t('channels.sms.authToken')}
              description={
                config.has_auth_token
                  ? `${t('channels.tokenSet')} ${t('channels.tokenKeepHint')}`
                  : `${t('channels.tokenUnset')} ${t('channels.tokenKeepHint')}`
              }
            />
            <TextField
              control={form.control}
              name="from_number"
              label={t('channels.sms.fromNumber')}
            />
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>{t('channels.actions.save')}</SubmitButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
