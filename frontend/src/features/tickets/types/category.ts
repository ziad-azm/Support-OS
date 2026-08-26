/** Mirrors `apps.tickets.serializers.CategorySerializer` verbatim. Owned by
 * this feature — `Category` is a `tickets`-domain concept
 * (`backend/apps/README.md`), not a cross-feature boundary the way
 * `CustomerOption` is. */
export type Category = {
  id: number
  name: string
  created_at: string
  updated_at: string
}
