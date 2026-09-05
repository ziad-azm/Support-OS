/** `as const` array, not `enum` — CONVENTIONS.md §3. */
export const ARTICLE_STATUSES = ['draft', 'published'] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

/** Mirrors `apps.knowledge_base.serializers.ArticleSerializer` verbatim. */
export type Article = {
  id: number
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  category: number | null
  category_name: string | null
  category_color: string | null
  status: ArticleStatus
  created_at: string
  updated_at: string
}

/** The write shape. `category` is nullable — the form always sends this
 * key explicitly (`null` to clear), never omits it, the same rule
 * `TicketInput.category` follows (Story 18). */
export type ArticleInput = {
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  category: number | null
  status: ArticleStatus
}
