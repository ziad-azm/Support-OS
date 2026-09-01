import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextareaField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useAssignableAgents } from '../api/useAssignableAgents'
import {
  useCreateInternalNote,
  useDeleteInternalNote,
  useUpdateInternalNote,
} from '../api/useInternalNoteMutations'
import { useInternalNotes } from '../api/useInternalNotes'
import type { InternalNote } from '../types/internalNote'

const noteSchema = z.object({ body: requiredString(5000) })
type NoteFormValues = z.output<typeof noteSchema>

export function InternalNotesSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useInternalNotes(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('internalNotes.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('internalNotes.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((note) => (
                <NoteRow key={note.id} ticketId={ticketId} note={note} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="tickets.manage">
          <NoteAddForm ticketId={ticketId} />
        </Can>
      </CardContent>
    </Card>
  )
}

/**
 * Not an RHF-submitted field — an ancillary picker beside the form, the
 * same pattern `ReplyForm`'s quick-reply `Select` already established
 * (Story 33). Reuses `assignable-agents`, the exact candidate list
 * `TicketAssigneeControl` already uses — no new endpoint.
 */
function MentionPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}) {
  const { t } = useTranslation('tickets')
  const agentsQuery = useAssignableAgents()
  const agents = agentsQuery.data ?? []

  if (agents.length === 0) return null

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{t('internalNotes.fields.mention')}</span>
      <div className="flex flex-wrap gap-3">
        {agents.map((agent) => (
          <label key={agent.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selectedIds.includes(agent.id)}
              onCheckedChange={() => toggle(agent.id)}
            />
            {agent.name}
          </label>
        ))}
      </div>
    </div>
  )
}

function NoteRow({ ticketId, note }: { ticketId: number; note: InternalNote }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteInternalNote(ticketId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('internalNotes.delete.title'),
      description: t('internalNotes.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(note.id)
  }

  if (isEditing) {
    return <NoteEditForm ticketId={ticketId} note={note} onDone={() => setIsEditing(false)} />
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {note.author_name ?? t('internalNotes.unknownAuthor')}
          {' · '}
          {dateTime(note.created_at)}
        </span>
        <Can permission="tickets.manage">
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              {t('internalNotes.actions.edit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {t('internalNotes.actions.remove')}
            </Button>
          </div>
        </Can>
      </div>
      {/* No forced `dir="ltr"` — same reasoning every other free-text
          render in this feature uses. */}
      <p className="whitespace-pre-wrap">{note.body}</p>
      {note.mentioned_user_names.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {note.mentioned_user_names.map((name) => (
            <Badge key={name} variant="outline">
              @{name}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  )
}

function NoteAddForm({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [mentionedIds, setMentionedIds] = useState<number[]>([])
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: '' } })
  const mutation = useCreateInternalNote(ticketId)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(
      { ticket: ticketId, mentioned_users: mentionedIds, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('internalNotes.created') })
          form.reset({ body: '' })
          setMentionedIds([])
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
        <TextareaField control={form.control} name="body" label={t('internalNotes.fields.body')} />
        <MentionPicker selectedIds={mentionedIds} onChange={setMentionedIds} />
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('internalNotes.actions.add')}
        </SubmitButton>
      </form>
    </Form>
  )
}

function NoteEditForm({
  ticketId,
  note,
  onDone,
}: {
  ticketId: number
  note: InternalNote
  onDone: () => void
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [mentionedIds, setMentionedIds] = useState<number[]>(note.mentioned_users)
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: note.body } })
  const mutation = useUpdateInternalNote(ticketId, note.id)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(
      { mentioned_users: mentionedIds, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('internalNotes.updated') })
          onDone()
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        },
      },
    )
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <TextareaField
            control={form.control}
            name="body"
            label={t('internalNotes.fields.body')}
          />
          <MentionPicker selectedIds={mentionedIds} onChange={setMentionedIds} />
          <FormErrorSummary errors={formErrors} />
          <div className="flex gap-2">
            <SubmitButton pending={mutation.isPending} size="sm">
              {t('internalNotes.actions.save')}
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('internalNotes.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
