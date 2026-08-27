import { api } from '@/shared/lib/api/client'

export type SubmitWebFormInput = {
  name: string
  email?: string
  subject: string
  description: string
  category: number | null
}
type SubmitWebFormResponse = { ticket_id: number }

export function submitWebForm(input: SubmitWebFormInput): Promise<SubmitWebFormResponse> {
  return api.post<SubmitWebFormResponse>('/web-form/submit/', input)
}
