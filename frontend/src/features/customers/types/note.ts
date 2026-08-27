/** Mirrors `apps.customers.serializers.NoteSerializer` verbatim. */
export type Note = {
  id: number
  customer: number
  author: number | null
  author_name: string | null
  body: string
  created_at: string
  updated_at: string
}

export type NoteInput = { customer: number; body: string }
export type NoteUpdateInput = Pick<NoteInput, 'body'>
