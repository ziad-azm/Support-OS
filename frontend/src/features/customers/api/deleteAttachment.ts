import { api } from '@/shared/lib/api/client'

export function deleteAttachment(id: number): Promise<void> {
  return api.delete(`/attachments/${id}/`)
}
