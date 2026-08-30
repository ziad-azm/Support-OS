import { downloadFile } from '@/shared/lib/download'

/** See `shared/lib/download.ts` for why this cannot be a plain `<a href>`.
 * The mechanism moved there in Story 55 (RPT-0); this file keeps the
 * attachment-specific URL. */
export function downloadAttachment(id: number, filename: string): Promise<void> {
  return downloadFile(`/attachments/${id}/download/`, filename)
}
