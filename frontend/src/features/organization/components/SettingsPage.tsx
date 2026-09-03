import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { HEX_COLOR_RE } from '@/shared/branding/config'
import { foregroundFor } from '@/shared/branding/contrast'
import { i18next } from '@/shared/i18n'
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
    primary_color: optionalString(7).transform((value) => value ?? ''),
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
  //
  // `primary_color` gets the same non-empty-only treatment, but Zod has no
  // hex-colour primitive to borrow from the way `z.url()` exists for
  // `logo_url` — so this is a hand-written custom issue with its own
  // translated message, which CONVENTIONS.md §20's "a custom issue keeps
  // its own message" rule says the shared error map will not touch.
  .superRefine((data, ctx) => {
    if (data.logo_url !== '') {
      const result = z.url().safeParse(data.logo_url)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: ['logo_url'] })
        }
      }
    }
    if (data.primary_color !== '' && !HEX_COLOR_RE.test(data.primary_color)) {
      ctx.addIssue({
        code: 'custom',
        path: ['primary_color'],
        message: i18next.t('organization:settings.invalidColor'),
      })
    }
  })

type FormValues = z.output<typeof schema>

function toDefaults(settings: OrganizationSettings): FormValues {
  return {
    name: settings.name,
    logo_url: settings.logo_url,
    primary_color: settings.primary_color,
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
  // Drives the live swatch/preview below — re-renders this component on
  // every keystroke, the same `form.watch(name)` pattern
  // `ErpSettingsPage.tsx`'s `FieldMapField` already uses. Does NOT call
  // `setBranding` — repainting the whole app on every keystroke is how a
  // colour picker becomes a strobe; the app repaints on save instead, via
  // `useUpdateSettings`'s branding-key invalidation.
  const primaryColorDraft = form.watch('primary_color')

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
                name="primary_color"
                label={t('settings.fields.primaryColor')}
                description={t('settings.colorHint')}
              />
              {HEX_COLOR_RE.test(primaryColorDraft) ? (
                // Inline styles with a literal hex value, deliberately: this
                // previews an admin-TYPED value before it becomes anything —
                // it never writes a design token itself (shared/branding/ is
                // the only module that does that, CONVENTIONS.md §19), and
                // there is no token that can stand in for an arbitrary
                // not-yet-saved colour.
                <div className="flex items-center gap-2" aria-label={t('settings.colorPreview')}>
                  <span
                    className="size-8 shrink-0 rounded border"
                    style={{ backgroundColor: primaryColorDraft }}
                  />
                  <span
                    className="rounded px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: primaryColorDraft,
                      color: foregroundFor(primaryColorDraft),
                    }}
                  >
                    {t('settings.actions.save')}
                  </span>
                </div>
              ) : null}
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
