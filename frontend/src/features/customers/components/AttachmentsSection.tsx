import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FileField, SubmitButton, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { downloadAttachment } from '../api/downloadAttachment'
import { useDeleteAttachment, useUploadAttachment } from '../api/useAttachmentMutations'
import { useAttachments } from '../api/useAttachments'
import type { Attachment } from '../types/attachment'

// No `.max()`/`.mime()` — no size or type restriction, an accepted scope
// gap (see Story 21 `## Edge Cases`). A bare `z.file()` already gets a
// translated "required" message via the shared error map's `isBlank`
// fallback.
const attachmentSchema = z.object({ file: z.file() })
type AttachmentFormValues = z.output<typeof attachmentSchema>

// No natural "empty" File value — RHF's DefaultValues<T> wants the
// schema's real output type, but the field starts genuinely unset until
// the user picks a file. A documented, deliberate cast at a real
// type-system seam, the same class of friction TicketFormPage's own
// string-to-number conversions accept, just with no valid placeholder
// value at all here.
const EMPTY_DEFAULTS = { file: null } as unknown as AttachmentFormValues

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useAttachments(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('attachments.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('attachments.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  customerId={customerId}
                  attachment={attachment}
                />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="customers.manage">
          <AttachmentUploadForm customerId={customerId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function AttachmentRow({ customerId, attachment }: { customerId: number; attachment: Attachment }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const deleteMutation = useDeleteAttachment(customerId)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadAttachment(attachment.id, attachment.original_filename)
    } catch {
      toast({ tone: 'error', message: t('attachments.downloadFailed') })
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('attachments.delete.title'),
      description: t('attachments.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(attachment.id)
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex flex-col">
        {/* Latin-script or mixed-script filename inside an Arabic document
            — the same LTR-wrap call `ContactDetailRow` makes for an email
            or phone value (CONVENTIONS.md §18). */}
        <span dir="ltr">{attachment.original_filename}</span>
        <span className="text-sm text-muted-foreground">
          {formatSize(attachment.size)}
          {' · '}
          {attachment.uploaded_by_name ?? t('notes.unknownAuthor')}
          {' · '}
          {dateTime(attachment.created_at)}
        </span>
      </div>
      <Can permission="customers.view">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {t('attachments.actions.download')}
          </Button>
          <Can permission="customers.manage">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {t('attachments.actions.remove')}
            </Button>
          </Can>
        </div>
      </Can>
    </li>
  )
}

function AttachmentUploadForm({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const form = useAppForm({ schema: attachmentSchema, defaultValues: EMPTY_DEFAULTS })
  const mutation = useUploadAttachment(customerId)

  function onSubmit(values: AttachmentFormValues) {
    mutation.mutate(
      { customer: customerId, file: values.file },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('attachments.uploaded') })
          form.reset(EMPTY_DEFAULTS)
        },
        // A non-validation failure is already toasted by the shared
        // mutation error handler — CONVENTIONS.md §21.
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <FileField control={form.control} name="file" label={t('attachments.fields.file')} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('attachments.actions.upload')}
        </SubmitButton>
      </form>
    </Form>
  )
}
