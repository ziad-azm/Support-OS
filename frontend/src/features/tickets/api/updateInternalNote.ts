import { api } from '@/shared/lib/api/client'

import type { InternalNote, InternalNoteUpdateInput } from '../types/internalNote'

export function updateInternalNote(
  id: number,
  input: InternalNoteUpdateInput,
): Promise<InternalNote> {
  return api.patch<InternalNote>(`/internal-notes/${id}/`, input)
}
