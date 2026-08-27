import { api } from '@/shared/lib/api/client'

import type { Note, NoteUpdateInput } from '../types/note'

export function updateNote(id: number, input: NoteUpdateInput): Promise<Note> {
  return api.patch<Note>(`/notes/${id}/`, input)
}
