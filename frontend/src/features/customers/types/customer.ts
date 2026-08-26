/** Mirrors `apps.customers.serializers.CustomerSerializer` verbatim —
 * snake_case, per CONVENTIONS.md §12. */
export type Customer = {
  id: number
  name: string
  email: string | null
  phone: string
  company: string
  created_at: string
  updated_at: string
}

/** The write shape. `id` and the timestamps are read-only server-side. */
export type CustomerInput = {
  name: string
  email: string | null
  phone: string
  company: string
}
