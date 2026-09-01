import { api } from '@/shared/lib/api/client'

export type ConfirmInviteInput = {
  token: string
  password: string
}

export function confirmInvite(input: ConfirmInviteInput): Promise<void> {
  return api.post<void>('/auth/invite/confirm/', input)
}
