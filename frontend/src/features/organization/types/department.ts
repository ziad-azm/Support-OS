import type { Department } from '@/shared/departments'

export type { Department }

/** The write shape — no `id`/`created_at`/`updated_at`, all
 * server-managed. `description` is always sent (`''` to clear), never
 * omitted (CONVENTIONS.md §23, "PATCH for edits"). */
export type DepartmentInput = {
  name: string
  description: string
}
