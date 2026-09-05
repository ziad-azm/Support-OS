/** `as const` array, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const CONTACT_CHANNELS = ['email', 'phone', 'whatsapp'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

/** Mirrors `apps.customers.serializers.ContactDetailSerializer` verbatim. A
 * second, separate `ContactDetail` from `features/customers/types/contactDetail.ts`
 * — different feature folder, no import between them (CONVENTIONS.md §15's
 * no-cross-feature-deep-import rule). Read-only here: `ReplyForm` only
 * lists a customer's known addresses to build `target_address` options,
 * never creates/edits one — that stays `features/customers`' job. */
export type ContactDetail = {
  id: number
  channel: ContactChannel
  value: string
}
