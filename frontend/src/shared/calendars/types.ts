/** Mirrors `apps.organization.serializers.CalendarSerializer`'s read shape.
 * Lives in `shared/`, not `features/organization/`, because
 * `features/organization`'s `BranchFormPage` needs it for its calendar
 * picker and `no-restricted-imports` forbids a cross-feature import
 * (CONVENTIONS.md §15/§33) — SLA-5 (Story 111). */
export type Calendar = {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
}
