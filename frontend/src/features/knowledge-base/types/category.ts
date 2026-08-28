/** Mirrors `apps.knowledge_base.serializers.CategorySerializer` verbatim.
 * A second, separate `Category` from `frontend/src/features/tickets/types/category.ts`
 * — different domain, different feature folder, no import between them
 * (CONVENTIONS.md §15's no-cross-feature-deep-import rule). */
export type Category = {
  id: number
  name: string
  created_at: string
  updated_at: string
}
