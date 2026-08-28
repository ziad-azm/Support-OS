import { api } from '@/shared/lib/api/client'

import type { InternalNote, InternalNoteInput } from '../types/internalNote'

export function createInternalNote(input: InternalNoteInput): Promise<InternalNote> {
  return api.post<InternalNote>('/internal-notes/', input)
}
