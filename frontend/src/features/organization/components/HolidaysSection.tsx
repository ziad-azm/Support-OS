import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'
import { optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'

import { useCreateHoliday, useDeleteHoliday, useUpdateHoliday } from '../api/useHolidayMutations'
import { useHolidays } from '../api/useHolidays'
import type { Holiday, HolidayInput } from '../types/holiday'

// A native `<input type="date">` reports/accepts `"YYYY-MM-DD"` directly
// — the same shape the server's `DateField` round-trips, so no
// conversion is needed at the API boundary (unlike `WorkingWindowsSection`'s
// time fields).
const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // `.transform(… ?? '')` because `label` is `blank=True` and NOT
  // nullable on the server (CONVENTIONS.md §23's `optionalString` table).
  label: optionalString(100).transform((value) => value ?? ''),
})

type HolidayFormValues = z.output<typeof holidaySchema>

const EMPTY_HOLIDAY: HolidayFormValues = { date: '', label: '' }

function toHolidayInput(calendarId: number, values: HolidayFormValues): HolidayInput {
  return { calendar: calendarId, date: values.date, label: values.label }
}

/**
 * The inline holidays editor on a calendar's edit form — SLA-5
 * (Story 111). `ContactDetailsSection.tsx`'s exact list + inline
 * add-form + inline edit-form shape.
 */
export function HolidaysSection({ calendarId }: { calendarId: number }) {
  const { t } = useTranslation('organization')
  const query = useHolidays(calendarId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('calendars.holidays.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('calendars.holidays.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((holiday) => (
                <HolidayRow key={holiday.id} calendarId={calendarId} holiday={holiday} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <HolidayAddForm calendarId={calendarId} />
      </CardContent>
    </Card>
  )
}

function HolidayRow({ calendarId, holiday }: { calendarId: number; holiday: Holiday }) {
  const { t } = useTranslation('organization')
  const { date: formatDate } = useFormatters()
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteHoliday(calendarId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('calendars.holidays.delete.title'),
      description: t('calendars.holidays.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(holiday.id)
  }

  if (isEditing) {
    return (
      <HolidayEditForm
        calendarId={calendarId}
        holiday={holiday}
        onDone={() => setIsEditing(false)}
      />
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span dir="ltr">{formatDate(holiday.date)}</span>
        {holiday.label ? (
          <span className="text-sm text-muted-foreground">{holiday.label}</span>
        ) : null}
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          {t('calendars.holidays.actions.edit')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => void handleDelete()}
        >
          {t('calendars.holidays.actions.remove')}
        </Button>
      </div>
    </li>
  )
}

function HolidayAddForm({ calendarId }: { calendarId: number }) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: holidaySchema, defaultValues: EMPTY_HOLIDAY })
  const mutation = useCreateHoliday(calendarId)

  function onSubmit(values: HolidayFormValues) {
    mutation.mutate(toHolidayInput(calendarId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('calendars.holidays.created') })
        form.reset(EMPTY_HOLIDAY)
        setFormErrors([])
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <TextField
            control={form.control}
            name="date"
            type="date"
            label={t('calendars.holidays.fields.date')}
          />
          <TextField
            control={form.control}
            name="label"
            label={t('calendars.holidays.fields.label')}
          />
        </div>
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('calendars.holidays.actions.add')}
        </SubmitButton>
      </form>
    </Form>
  )
}

function HolidayEditForm({
  calendarId,
  holiday,
  onDone,
}: {
  calendarId: number
  holiday: Holiday
  onDone: () => void
}) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema: holidaySchema,
    defaultValues: { date: holiday.date, label: holiday.label },
  })
  const mutation = useUpdateHoliday(calendarId, holiday.id)

  function onSubmit(values: HolidayFormValues) {
    mutation.mutate(toHolidayInput(calendarId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('calendars.holidays.updated') })
        onDone()
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <TextField
              control={form.control}
              name="date"
              type="date"
              label={t('calendars.holidays.fields.date')}
            />
            <TextField
              control={form.control}
              name="label"
              label={t('calendars.holidays.fields.label')}
            />
          </div>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending} size="sm">
              {t('calendars.holidays.actions.save')}
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('calendars.holidays.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
