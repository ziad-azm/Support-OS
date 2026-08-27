/** Mirrors `apps.customers.serializers.AttachmentSerializer` verbatim.
 * `file` is write-only on the backend and never appears in a response. */
export type Attachment = {
  id: number
  customer: number
  uploaded_by: number | null
  uploaded_by_name: string | null
  original_filename: string
  size: number
  created_at: string
  updated_at: string
}

export type UploadAttachmentInput = { customer: number; file: File }
