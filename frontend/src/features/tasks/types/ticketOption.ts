/**
 * Minimal shape for the task form's optional ticket-link selector. This
 * feature calls `/tickets/` directly (see `../api/getTicketOptions.ts`)
 * rather than importing `@/features/tickets` — `no-restricted-imports`
 * (`frontend/.oxlintrc.json`) forbids any `@/features/*` import from
 * another feature, the same reason `features/tickets/types/customerOption.ts`
 * duplicates `Customer`'s minimal shape instead of importing it.
 */
export type TicketOption = {
  id: number
  subject: string
}
