/** Mirrors `apps.agents.serializers.TaskSerializer` verbatim. */
export type Task = {
  id: number
  ticket: number | null
  ticket_subject: string
  title: string
  description: string
  due_at: string
  completed_at: string | null
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

/** The write shape. `completed_at`/`reminder_sent_at` are absent — both
 * are read-only on the serializer, written only through their own
 * `POST /tasks/<id>/{complete,reopen}/` action or the background job,
 * so a full-payload create/edit can never move either as a side
 * effect. Mirrors `TicketInput`'s own reasoning (Story 23). */
export type TaskInput = {
  ticket: number | null
  title: string
  description: string
  due_at: string
}
