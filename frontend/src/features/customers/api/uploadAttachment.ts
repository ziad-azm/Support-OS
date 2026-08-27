import { api } from '@/shared/lib/api/client'

import type { Attachment, UploadAttachmentInput } from '../types/attachment'

/**
 * `Content-Type: undefined` overrides `httpClient`'s default
 * `application/json` header for this one request — without it, axios
 * would `JSON.stringify` the `FormData` instead of sending it as
 * `multipart/form-data`, silently corrupting the upload. Verified against
 * the installed axios; see Story 21 `## Prerequisites`.
 */
export function uploadAttachment(input: UploadAttachmentInput): Promise<Attachment> {
  const formData = new FormData()
  formData.append('customer', String(input.customer))
  formData.append('file', input.file)
  return api.post<Attachment>('/attachments/', formData, {
    headers: { 'Content-Type': undefined },
  })
}
