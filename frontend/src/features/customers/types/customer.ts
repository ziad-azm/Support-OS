/** Mirrors `apps.customers.serializers.CustomerSerializer` verbatim —
 * snake_case, per CONVENTIONS.md §12. */
export type Customer = {
  id: number
  name: string
  email: string | null
  email_contact_enabled: boolean
  phone: string
  phone_contact_enabled: boolean
  whatsapp_enabled: boolean
  company: string
  portal_access_enabled: boolean
  branch: number | null
  branch_name: string | null
  created_at: string
  updated_at: string
}

/** The write shape. `id` and the timestamps are read-only server-side. */
export type CustomerInput = {
  name: string
  email: string | null
  email_contact_enabled: boolean
  phone: string
  phone_contact_enabled: boolean
  whatsapp_enabled: boolean
  company: string
  branch: number | null
}
