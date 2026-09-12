import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'

import {
  useCreateWorkingWindow,
  useDeleteWorkingWindow,
  useUpdateWorkingWindow,
} from '../api/useWorkingWindowMutations'
import { useWorkingWindows } from '../api/useWorkingWindows'
import { WEEKDAYS } from '../types/workingWindow'
import type { WorkingWindow, WorkingWindowInput } from '../types/workingWindow'

// Kept as strings, not numbers — `SelectField`'s value/onValueChange are
// string-typed (Radix), the same `category`/`branch` reasoning
// `TicketFormPage.tsx` records for its own FK selects. Converted to a
// number only when building the API payload.
const windowSchema = z.object({
  weekday: z.string().min(1),
  // Native `<input type="time">` reports/accepts `"HH:MM"`. The server's
  // own `end_time > start_time` check (`WorkingWindowSerializer.validate`)
  // is the single source of truth for that cross-field rule — not
  // duplicated here, so its translated message reaches the form through
  // the normal `applyServerErrors` 400 path instead of an untranslated
  // client-only string (CONVENTIONS.md §20's error-map convention).
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
})

type WindowFormValues = z.output<typeof windowSchema>

const EMPTY_WINDOW: WindowFormValues = { weekday: '0', start_time: '', end_time: '' }

function toWorkingWindowInput(calendarId: number, values: WindowFormValues): WorkingWindowInput {
  return {
    calendar: calendarId,
    weekday: Number(values.weekday) as WorkingWindowInput['weekday'],
    // The server's `TimeField` round-trips `"HH:MM:SS"`; a native
    // `<input type="time">` only ever produces `"HH:MM"`.
    start_time: `${values.start_time}:00`,
    end_time: `${values.end_time}:00`,
  }
}

function toTimeInputValue(value: string): string {
  // Strip the trailing `:00` seconds the server always includes, so a
  // native `<input type="time">` shows a clean value on edit.
  return value.slice(0, 5)
}

/**
 * The inline working-hours editor on a calendar's edit form — SLA-5
 * (Story 111). `ContactDetailsSection.tsx`'s exact list + inline
 * add-form + inline edit-form shape (`frontend/src/features/customers/
 * components/ContactDetailsSection.tsx`).
 */
export function WorkingWindowsSection({ calendarId }: { calendarId: number }) {
  const { t } = useTranslation('organization')
  const query = useWorkingWindows(calendarId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('calendars.workingWindows.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={
            <p className="text-sm text-muted-foreground">{t('calendars.workingWindows.empty')}</p>
          }
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((window) => (
                <WorkingWindowRow key={window.id} calendarId={calendarId} window={window} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <WorkingWindowAddForm calendarId={calendarId} />
      </CardContent>
    </Card>
  )
}

function WorkingWindowRow({ calendarId, window }: { calendarId: number; window: WorkingWindow }) {
  const { t } = useTranslation('organization')
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteWorkingWindow(calendarId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('calendars.workingWindows.delete.title'),
      description: t('calendars.workingWindows.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(window.id)
  }

  if (isEditing) {
    return (
      <WorkingWindowEditForm
        calendarId={calendarId}
        window={window}
        onDone={() => setIsEditing(false)}
      />
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{t(`calendars.workingWindows.weekdays.${window.weekday}`)}</Badge>
        <span dir="ltr">
          {toTimeInputValue(window.start_time)}
          {'–'}
          {toTimeInputValue(window.end_time)}
        </span>
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          {t('calendars.workingWindows.actions.edit')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => void handleDelete()}
        >
          {t('calendars.workingWindows.actions.remove')}
        </Button>
      </div>
    </li>
  )
}

function WorkingWindowAddForm({ calendarId }: { calendarId: number }) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: windowSchema, defaultValues: EMPTY_WINDOW })
  const mutation = useCreateWorkingWindow(calendarId)

  function onSubmit(values: WindowFormValues) {
    mutation.mutate(toWorkingWindowInput(calendarId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('calendars.workingWindows.created') })
        form.reset(EMPTY_WINDOW)
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
          <SelectField
            control={form.control}
            name="weekday"
            label={t('calendars.workingWindows.fields.weekday')}
            options={WEEKDAYS.map((weekday) => ({
              value: String(weekday),
              label: t(`calendars.workingWindows.weekdays.${weekday}`),
            }))}
          />
          <TextField
            control={form.control}
            name="start_time"
            type="time"
            label={t('calendars.workingWindows.fields.startTime')}
          />
          <TextField
            control={form.control}
            name="end_time"
            type="time"
            label={t('calendars.workingWindows.fields.endTime')}
          />
        </div>
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('calendars.workingWindows.actions.add')}
        </SubmitButton>
      </form>
    </Form>
  )
}

function WorkingWindowEditForm({
  calendarId,
  window,
  onDone,
}: {
  calendarId: number
  window: WorkingWindow
  onDone: () => void
}) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema: windowSchema,
    defaultValues: {
      weekday: String(window.weekday),
      start_time: toTimeInputValue(window.start_time),
      end_time: toTimeInputValue(window.end_time),
    },
  })
  const mutation = useUpdateWorkingWindow(calendarId, window.id)

  function onSubmit(values: WindowFormValues) {
    mutation.mutate(toWorkingWindowInput(calendarId, values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t('calendars.workingWindows.updated') })
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
            <SelectField
              control={form.control}
              name="weekday"
              label={t('calendars.workingWindows.fields.weekday')}
              options={WEEKDAYS.map((weekday) => ({
                value: String(weekday),
                label: t(`calendars.workingWindows.weekdays.${weekday}`),
              }))}
            />
            <TextField
              control={form.control}
              name="start_time"
              type="time"
              label={t('calendars.workingWindows.fields.startTime')}
            />
            <TextField
              control={form.control}
              name="end_time"
              type="time"
              label={t('calendars.workingWindows.fields.endTime')}
            />
          </div>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending} size="sm">
              {t('calendars.workingWindows.actions.save')}
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('calendars.workingWindows.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
