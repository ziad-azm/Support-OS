import { useState } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { nullablePositiveInt, optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Input } from '@/shared/ui/primitives/input'
import { Form, FormField, FormItem, FormLabel } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, useAppForm } from '@/shared/ui/form'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSettings } from '../api/useSettings'
import { useUpdateSettings } from '../api/useUpdateSettings'
import type { OrganizationSettings, SettingsInput } from '../types/settings'

const schema = z.object({
  name: optionalString(150).transform((value) => value ?? ''),
  logo_url: optionalString(500).transform((value) => value ?? ''),
  departments: z.array(z.string()),
  branches: z.array(z.string()),
  default_response_target_minutes: nullablePositiveInt(),
  default_resolution_target_minutes: nullablePositiveInt(),
})

type FormValues = z.output<typeof schema>

function toDefaults(settings: OrganizationSettings): FormValues {
  return {
    name: settings.name,
    logo_url: settings.logo_url,
    departments: settings.departments,
    branches: settings.branches,
    default_response_target_minutes: settings.default_response_target_minutes,
    default_resolution_target_minutes: settings.default_resolution_target_minutes,
  }
}

function toSettingsInput(values: FormValues): SettingsInput {
  return { ...values }
}

/**
 * A local, single-consumer "string list" editor — bound directly via
 * `FormField`'s render prop, the same "compose primitives, do not reach for
 * `useFieldArray`" convention `RoleFormPage`'s permissions checklist
 * (Story 49) already established, since `useFieldArray` appears nowhere in
 * this codebase. Not a new `shared/ui/form/` component: this has exactly
 * one consumer today (`SettingsPage`), the same reasoning CONVENTIONS.md
 * § 23 already applies to `TicketConversation` and Story 49's checklist.
 */
function StringListField({
  label,
  addLabel,
  placeholder,
  value,
  onChange,
}: {
  label: string
  addLabel: string
  placeholder: string
  value: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation('organization')
  const [draft, setDraft] = useState('')

  function addItem() {
    const trimmed = draft.trim()
    if (trimmed === '') return
    onChange([...value, trimmed])
    setDraft('')
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <Badge key={`${item}-${index}`} variant="secondary" className="gap-1">
            {item}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('settings.removeItem', { item })}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <XIcon className="size-3" />
            </Button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addItem()
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
    </FormItem>
  )
}

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
          <FormField
            control={form.control}
            name="departments"
            render={({ field }) => (
              <StringListField
                label={t('settings.fields.departments')}
                addLabel={t('settings.addDepartment')}
                placeholder={t('settings.newItemPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="branches"
            render={({ field }) => (
              <StringListField
                label={t('settings.fields.branches')}
                addLabel={t('settings.addBranch')}
                placeholder={t('settings.newItemPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('settings.actions.save')}
          </Button>
        </form>
      </Form>
    </>
  )
}
