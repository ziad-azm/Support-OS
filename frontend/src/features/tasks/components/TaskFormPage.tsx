import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  TextField,
  TextareaField,
  useAppForm,
} from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateTask, useUpdateTask } from '../api/useTaskMutations'
import { useTask } from '../api/useTask'
import { useTicketOptions } from '../api/useTicketOptions'
import type { Task, TaskInput } from '../types/task'

// Radix's `Select.Item` requires a non-empty `value` — this sentinel
// stands in for "no ticket", the same role `TicketFormPage`'s own
// `CATEGORY_NONE` plays for an optional `category`.
const TICKET_NONE = 'none'

const taskSchema = z.object({
  title: requiredString(255),
  // `blank=True`, not nullable — the same `optionalString` + explicit
  // `?? ''` coalescing pattern `CustomerFormPage` uses for `phone`/
  // `company` (CONVENTIONS.md §23), not `requiredString`.
  description: optionalString(1000),
  // The raw `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm");
  // converted to/from an ISO instant in `toDefaults`/`toTaskInput` below.
  due_at: requiredString(),
  ticket: z.string().min(1),
})

type FormValues = z.output<typeof taskSchema>

const EMPTY_DEFAULTS: FormValues = { title: '', description: '', due_at: '', ticket: TICKET_NONE }

// `datetime-local`'s value has no timezone — per the WHATWG/ECMA-262 date
// string grammar, `new Date(value)` on such a string parses it as the
// BROWSER's local time (only a bare date-only string like "2026-08-30"
// is treated as UTC), and `new Date(iso)` on the server's UTC-offset ISO
// string parses correctly regardless. Reading the `Date`'s own local
// getters (`getFullYear`/etc.) and writing back via `.toISOString()`
// therefore round-trips correctly through the browser's local zone with
// no new dependency — see `## Edge Cases & Failure Modes`.
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

function toDefaults(task: Task): FormValues {
  return {
    title: task.title,
    description: task.description,
    due_at: toDatetimeLocalValue(task.due_at),
    ticket: task.ticket === null ? TICKET_NONE : String(task.ticket),
  }
}

function toTaskInput(values: FormValues): TaskInput {
  return {
    title: values.title,
    description: values.description ?? '',
    due_at: fromDatetimeLocalValue(values.due_at),
    ticket: values.ticket === TICKET_NONE ? null : Number(values.ticket),
  }
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function TaskFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const taskQuery = useTask(id, { enabled: isEdit })

  if (!isEdit) {
    return <TaskForm mode="create" />
  }

  return (
    <QueryBoundary query={taskQuery}>
      {(task) => <TaskForm mode="edit" id={id} task={task} />}
    </QueryBoundary>
  )
}

function TaskForm({ mode, id, task }: { mode: 'create' | 'edit'; id?: number; task?: Task }) {
  const { t } = useTranslation('tasks')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const ticketOptionsQuery = useTicketOptions()

  const form = useAppForm({
    schema: taskSchema,
    defaultValues: task ? toDefaults(task) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toTaskInput(values), {
      onSuccess: () => {
        toast({ tone: 'success', message: t(mode === 'create' ? 'created' : 'updated') })
        navigate('/tasks')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  const ticketOptions =
    ticketOptionsQuery.data?.items.map((ticket) => ({
      value: String(ticket.id),
      label: ticket.subject,
    })) ?? []

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'new' : 'edit')}</h1>
      {ticketOptionsQuery.isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField control={form.control} name="title" label={t('fields.title')} />
            <TextareaField
              control={form.control}
              name="description"
              label={t('fields.description')}
            />
            <TextField
              control={form.control}
              name="due_at"
              type="datetime-local"
              label={t('fields.dueAt')}
            />
            <SelectField
              control={form.control}
              name="ticket"
              label={t('fields.ticket')}
              options={[{ value: TICKET_NONE, label: t('fields.noTicket') }, ...ticketOptions]}
            />
            <FormErrorSummary errors={formErrors} />
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {t('actions.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/tasks')}>
                {t('actions.cancel', { ns: 'common' })}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
