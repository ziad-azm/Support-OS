import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { nullablePositiveInt, optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSettings } from '../api/useSettings'
import { useUpdateSettings } from '../api/useUpdateSettings'
import type { OrganizationSettings, SettingsInput } from '../types/settings'

const schema = z
  .object({
    name: optionalString(150).transform((value) => value ?? ''),
    logo_url: optionalString(500).transform((value) => value ?? ''),
    default_response_target_minutes: nullablePositiveInt(),
    default_resolution_target_minutes: nullablePositiveInt(),
  })
  // `logo_url` had no format check client-side — any string passed
  // validation and round-tripped to the server before failing on the
  // backend's `URLField` ("Enter a valid URL."). Reuses `z.url()`'s own
  // translated error (`invalid_format.url` in `validation.json`, the same
  // mechanism `ContactDetailsSection.tsx`'s email `superRefine` already
  // uses) rather than writing a new message, and only runs when non-empty
  // — this field stays optional.
  .superRefine((data, ctx) => {
    if (data.logo_url === '') return
    const result = z.url().safeParse(data.logo_url)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['logo_url'] })
      }
    }
  })

type FormValues = z.output<typeof schema>

function toDefaults(settings: OrganizationSettings): FormValues {
  return {
    name: settings.name,
    logo_url: settings.logo_url,
    default_response_target_minutes: settings.default_response_target_minutes,
    default_resolution_target_minutes: settings.default_resolution_target_minutes,
  }
}

function toSettingsInput(values: FormValues): SettingsInput {
  return { ...values }
}

/** Branding and the two org-wide SLA defaults — scalars only. The
 * `departments` and `branches` string-list editors this screen used to
 * carry became the `Department` (ORG-1, Story 87) and `Branch` (ORG-2,
 * Story 89) models, each with its own `/settings/<unit>` management screen,
 * so the local `StringListField` component went with the second of them. */
export function SettingsPage() {
  const query = useSettings()
  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary query={query}>
        {(settings) => <SettingsForm settings={settings} />}
      </QueryBoundary>
    </div>
  )
}

function SettingsForm({ settings }: { settings: OrganizationSettings }) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const mutation = useUpdateSettings()

  const form = useAppForm({ schema, defaultValues: toDefaults(settings) })

  function onSubmit(values: FormValues) {
    mutation.mutate(toSettingsInput(values), {
      onSuccess: () => toast({ tone: 'success', message: t('settings.saved') }),
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField control={form.control} name="name" label={t('settings.fields.name')} />
              <TextField
                control={form.control}
                name="logo_url"
                label={t('settings.fields.logoUrl')}
              />
              <TextField
                control={form.control}
                name="default_response_target_minutes"
                type="number"
                label={t('settings.fields.defaultResponseMinutes')}
              />
              <TextField
                control={form.control}
                name="default_resolution_target_minutes"
                type="number"
                label={t('settings.fields.defaultResolutionMinutes')}
              />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <SubmitButton pending={mutation.isPending}>{t('settings.actions.save')}</SubmitButton>
        </form>
      </Form>
    </>
  )
}
