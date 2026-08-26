import { api } from '@/shared/lib/api/client'

export function deleteTicket(id: number): Promise<void> {
  return api.delete(`/tickets/${id}/`)
}
