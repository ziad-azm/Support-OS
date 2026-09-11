import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { LandingSocialIcon, SOCIAL_PLATFORMS, isSocialPlatform } from '@/shared/landing'
import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  SwitchField,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import {
  useCreateLandingSocialLink,
  useUpdateLandingSocialLink,
} from '../api/useLandingSocialLinkMutations'
import { useLandingSocialLink } from '../api/useLandingSocialLink'
import type { LandingSocialLinkInput, LandingSocialLinkRow } from '../types/landing'

const schema = z.object({
  // A fixed set, mirroring `LandingSocialLink.Platform` — an admin cannot
  // type a name that renders no mark and no label on the public page.
  platform: choice(SOCIAL_PLATFORMS),
  value: requiredString(254),
  is_enabled: z.boolean(),
  // NOT `positiveInt()`: that helper floors at 1, and `order`'s default is 0
  // — the same call `LandingHighlightFormPage.tsx` records for its own
  // `order` field.
  order: z.coerce.number().int().min(0).max(9999),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = {
  platform: 'website',
  value: '',
  is_enabled: true,
  order: 0,
}

function toDefaults(link: LandingSocialLinkRow): FormValues {
  return {
    // Plain `string` from the API — narrow, falling back to a real
    // platform, so a row written through Django admin with a value this
    // bundle does not know still opens the form.
    platform: isSocialPlatform(link.platform) ? link.platform : 'website',
    value: link.value,
    is_enabled: link.is_enabled,
    order: link.order,
  }
}

function toSocialLinkInput(values: FormValues): LandingSocialLinkInput {
  return { ...values }
}

/** One component for both create and edit, per `LandingHighlightFormPage`'s
 * pattern (CONVENTIONS.md §20) — the field set is identical between modes. */
export function LandingSocialLinkFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const linkQuery = useLandingSocialLink(id, { enabled: isEdit })

  if (!isEdit) {
    return <LandingSocialLinkForm mode="create" />
  }

  return (
    <QueryBoundary query={linkQuery}>
      {(link) => <LandingSocialLinkForm mode="edit" id={id} link={link} />}
    </QueryBoundary>
  )
}

function LandingSocialLinkForm({
  mode,
  id,
  link,
}: {
  mode: 'create' | 'edit'
  id?: number
  link?: LandingSocialLinkRow
}) {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: link ? toDefaults(link) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateLandingSocialLink()
  const updateMutation = useUpdateLandingSocialLink(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  const platformDraft = form.watch('platform')

  const platformOptions = SOCIAL_PLATFORMS.map((value) => ({
    value,
    label: t(`landingSocial.platforms.${value}`),
  }))

  // The `value` field means something different per platform — a profile
  // URL, an email address, a phone number — so its hint changes with the
  // picked platform. Without this, an admin types a Facebook handle into
  // what looks like a plain text box and only learns it was wrong from a
  // 400 after submitting.
  const valueHintKey =
    platformDraft === 'email'
      ? 'landingSocial.valueHint.email'
      : platformDraft === 'phone' || platformDraft === 'whatsapp'
        ? 'landingSocial.valueHint.phone'
        : 'landingSocial.valueHint.url'

  function onSubmit(values: FormValues) {
    mutation.mutate(toSocialLinkInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'landingSocial.created' : 'landingSocial.updated'),
        })
        navigate('/settings/landing/social')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {t(mode === 'create' ? 'landingSocial.new' : 'landingSocial.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <SelectField
                control={form.control}
                name="platform"
                label={t('landingSocial.fields.platform')}
                options={platformOptions}
              />
              {/* F-32 (QA-REPORT-1): `role="group"` is required for
                  `aria-label` to apply — a bare `<div>` is
                  `role="generic"`, which ARIA prohibits naming. */}
              <div
                role="group"
                className="flex items-center gap-2 text-muted-foreground"
                aria-label={t('landingSocial.iconPreview')}
              >
                <LandingSocialIcon platform={platformDraft} className="size-6 text-primary" />
                <span className="text-sm">{t(`landingSocial.platforms.${platformDraft}`)}</span>
              </div>
              <TextField
                control={form.control}
                name="value"
                label={t('landingSocial.fields.value')}
                description={t(valueHintKey)}
              />
              <SwitchField
                control={form.control}
                name="is_enabled"
                label={t('landingSocial.fields.isEnabled')}
              />
              <TextField
                control={form.control}
                name="order"
                type="number"
                label={t('landingSocial.fields.order')}
                description={t('landingSocial.orderHint')}
              />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending}>
              {t('landingSocial.actions.save')}
            </SubmitButton>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/settings/landing/social')}
            >
              {t('actions.cancel', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
