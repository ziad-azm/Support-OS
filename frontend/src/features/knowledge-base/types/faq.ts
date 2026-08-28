/** Mirrors `apps.knowledge_base.serializers.FAQSerializer` verbatim. */
export type Faq = {
  id: number
  question: string
  answer: string
  order: number
  created_at: string
  updated_at: string
}

/** The write shape. `id` and the timestamps are read-only server-side. */
export type FaqInput = {
  question: string
  answer: string
  order: number
}
