/**
 * A minimal local mirror of `apps.tickets.serializers.CategorySerializer`
 * — this feature cannot import `@/features/tickets` (CONVENTIONS.md §15),
 * and needs only these two fields to render the selector.
 */
export type WebFormCategory = {
  id: number
  name: string
}
