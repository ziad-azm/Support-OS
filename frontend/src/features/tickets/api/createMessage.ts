import { api } from '@/shared/lib/api/client'

import type { Message, MessageInput } from '../types/message'

export function createMessage(input: MessageInput): Promise<Message> {
  return api.post<Message>('/messages/', input)
}
