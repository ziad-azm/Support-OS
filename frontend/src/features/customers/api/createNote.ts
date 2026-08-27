import { api } from '@/shared/lib/api/client'

import type { Note, NoteInput } from '../types/note'

export function createNote(input: NoteInput): Promise<Note> {
  return api.post<Note>('/notes/', input)
}
