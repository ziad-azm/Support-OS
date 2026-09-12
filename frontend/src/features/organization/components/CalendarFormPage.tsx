import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCalendar } from '../api/useCalendar'
import { useCreateCalendar, useUpdateCalendar } from '../api/useCalendarMutations'
import type { Calendar, CalendarInput } from '../types/calendar'
import { HolidaysSection } from './HolidaysSection'
import { WorkingWindowsSection } from './WorkingWindowsSection'

const schema = z.object({
  name: requiredString(100),
  // `.transform(… ?? '')` because `description` is `blank=True` and NOT
  // nullable on the server — a cleared field must round-trip as `''`, not
  // `null` (CONVENTIONS.md §23's `optionalString`/`nullableString` table).
  description: optionalString(255).transform((value) => value ?? ''),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = { name: '', description: '' }

function toDefaults(calendar: Calendar): FormValues {
  return { name: calendar.name, description: calendar.description }
}

function toCalendarInput(values: FormValues): CalendarInput {
  return { name: values.name, description: values.description }
}

/** One component for both create and edit, per `BranchFormPage`'s
 * pattern (CONVENTIONS.md §20) — SLA-5 (Story 111). The working-window
 * and holiday editors render only in edit mode: both are scoped by a
 * saved `calendar.id`, so they have nothing to manage until the
 * calendar itself exists — the same "children only make sense once the
 * parent exists" constraint `ContactDetailsSection` accepts implicitly
 * by living on `CustomerProfilePage`, not the create form. */
export function CalendarFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const calendarQuery = useCalendar(id, { enabled: isEdit })

  if (!isEdit) {
    return <CalendarForm mode="create" />
  }

  return (
    <QueryBoundary query={calendarQuery}>
      {(calendar) => <CalendarForm mode="edit" id={id} calendar={calendar} />}
    </QueryBoundary>
  )
}

function CalendarForm({
  mode,
  id,
  calendar,
}: {
  mode: 'create' | 'edit'
  id?: number
  calendar?: Calendar
}) {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: calendar ? toDefaults(calendar) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateCalendar()
  const updateMutation = useUpdateCalendar(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toCalendarInput(values), {
      onSuccess: (saved) => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'calendars.created' : 'calendars.updated'),
        })
        if (mode === 'create') {
          // A freshly created calendar has no working windows/holidays
          // yet — land on its edit form so the manager can add them
          // immediately, rather than back on the list.
          navigate(`/settings/calendars/${saved.id}/edit`)
          return
        }
        navigate('/settings/calendars')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {t(mode === 'create' ? 'calendars.new' : 'calendars.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField control={form.control} name="name" label={t('calendars.fields.name')} />
              <TextField
                control={form.control}
                name="description"
                label={t('calendars.fields.description')}
              />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending}>{t('calendars.actions.save')}</SubmitButton>
            <Button type="button" variant="outline" onClick={() => navigate('/settings/calendars')}>
              {t('actions.cancel', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </Form>
      {mode === 'edit' && id !== undefined ? (
        <>
          <WorkingWindowsSection calendarId={id} />
          <HolidaysSection calendarId={id} />
        </>
      ) : null}
    </div>
  )
}
