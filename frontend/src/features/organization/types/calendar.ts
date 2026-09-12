import type { Calendar } from '@/shared/calendars'

export type { Calendar }

/** The write shape — no `id`/`created_at`/`updated_at`, all
 * server-managed. `description` is always sent (`''` to clear), never
 * omitted (CONVENTIONS.md §23, "PATCH for edits"). */
export type CalendarInput = {
  name: string
  description: string
}
