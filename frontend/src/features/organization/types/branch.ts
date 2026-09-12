import type { Branch } from '@/shared/branches'

export type { Branch }

/** The write shape — no `id`/`created_at`/`updated_at`, all
 * server-managed. `description` is always sent (`''` to clear), never
 * omitted (CONVENTIONS.md §23, "PATCH for edits"). `calendar` is
 * nullable — SLA-5 (Story 111): `null` means no business calendar, i.e.
 * this branch's tickets keep 24/7 wall-clock SLA arithmetic. */
export type BranchInput = {
  name: string
  description: string
  calendar: number | null
}
