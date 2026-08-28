/** Mirrors `apps.agents.serializers.InternalNoteSerializer` verbatim. */
export type InternalNote = {
  id: number
  ticket: number
  author: number | null
  author_name: string | null
  body: string
  mentioned_users: number[]
  mentioned_user_names: string[]
  created_at: string
  updated_at: string
}

export type InternalNoteInput = { ticket: number; body: string; mentioned_users: number[] }
export type InternalNoteUpdateInput = Pick<InternalNoteInput, 'body' | 'mentioned_users'>
