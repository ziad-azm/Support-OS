/**
 * Minimal shape for the ticket form's customer selector. This feature calls
 * `/customers/` directly (see `../api/getCustomerOptions.ts`) rather than
 * importing `@/features/customers` — `no-restricted-imports`
 * (`frontend/.oxlintrc.json`) forbids any `@/features/*` import from
 * another feature. See CONVENTIONS.md §15 and Story 12 `## Product rules`.
 */
export type CustomerOption = {
  id: number
  name: string
}
