/** Mirrors `apps.knowledge_base.serializers.FAQSerializer` — read-only for
 * the portal, which never writes a FAQ. Duplicated from
 * `features/knowledge-base/types/faq.ts`'s `Faq` rather than imported —
 * `no-restricted-imports` (frontend/.oxlintrc.json) forbids the
 * cross-feature import, the same tradeoff `PortalTicket` already made. */
export type PortalFaq = {
  id: number
  question: string
  answer: string
  order: number
  created_at: string
  updated_at: string
}
