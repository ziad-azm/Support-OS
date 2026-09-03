import type { Branch } from '@/shared/branches'

export type { Branch }

/** The write shape — no `id`/`created_at`/`updated_at`, all
 * server-managed. `description` is always sent (`''` to clear), never
 * omitted (CONVENTIONS.md §23, "PATCH for edits"). */
export type BranchInput = {
  name: string
  description: string
}
