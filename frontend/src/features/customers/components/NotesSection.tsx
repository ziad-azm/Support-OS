import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { TextareaField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateNote, useDeleteNote, useUpdateNote } from '../api/useNoteMutations'
import { useNotes } from '../api/useNotes'
import type { Note } from '../types/note'

const noteSchema = z.object({ body: requiredString(5000) })
type NoteFormValues = z.output<typeof noteSchema>

export function NotesSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useNotes(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('notes.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('notes.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((note) => (
                <NoteRow key={note.id} customerId={customerId} note={note} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="customers.manage">
          <NoteAddForm customerId={customerId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function NoteRow({ customerId, note }: { customerId: number; note: Note }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteNote(customerId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('notes.delete.title'),
      description: t('notes.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(note.id)
  }

  if (isEditing) {
    return <NoteEditForm customerId={customerId} note={note} onDone={() => setIsEditing(false)} />
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {note.author_name ?? t('notes.unknownAuthor')}
          {' · '}
          {dateTime(note.created_at)}
        </span>
        <Can permission="customers.manage">
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              {t('notes.actions.edit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {t('notes.actions.remove')}
            </Button>
          </div>
        </Can>
      </div>
      <p className="whitespace-pre-wrap">{note.body}</p>
    </li>
  )
}

function NoteAddForm({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: '' } })
  const mutation = useCreateNote(customerId)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(
      { customer: customerId, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('notes.created') })
          form.reset({ body: '' })
          setFormErrors([])
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <TextareaField control={form.control} name="body" label={t('notes.fields.body')} />
        {formErrors.length > 0 ? (
          <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('notes.actions.add')}
        </Button>
      </form>
    </Form>
  )
}

function NoteEditForm({
  customerId,
  note,
  onDone,
}: {
  customerId: number
  note: Note
  onDone: () => void
}) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: note.body } })
  const mutation = useUpdateNote(customerId, note.id)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('notes.updated') })
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
          <TextareaField control={form.control} name="body" label={t('notes.fields.body')} />
          {formErrors.length > 0 ? (
            <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {t('notes.actions.save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('notes.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
