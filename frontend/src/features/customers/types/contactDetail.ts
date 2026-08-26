/** `as const` array, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const CONTACT_CHANNELS = ['email', 'phone', 'whatsapp'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

/** Mirrors `apps.customers.serializers.ContactDetailSerializer` verbatim. */
export type ContactDetail = {
  id: number
  customer: number
  channel: ContactChannel
  value: string
  created_at: string
  updated_at: string
}

/** The create shape — `customer` attaches the contact; see `ContactDetailUpdateInput`. */
export type ContactDetailInput = {
  customer: number
  channel: ContactChannel
  value: string
}

/** The edit shape. `customer` is excluded: the serializer's `update()` ignores
 * it even if sent — see `backend/apps/customers/serializers.py`. */
export type ContactDetailUpdateInput = Pick<ContactDetailInput, 'channel' | 'value'>
