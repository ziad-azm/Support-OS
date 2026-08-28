import type { ArticleStatus } from './article'

export type FaqSearchResult = {
  kind: 'faq'
  id: number
  question: string
  answer: string
  headline: string
  rank: number
}

export type ArticleSearchResult = {
  kind: 'article'
  id: number
  title_en: string
  title_ar: string
  headline_en: string
  headline_ar: string
  status: ArticleStatus
  rank: number
}

/** Mirrors `apps.knowledge_base.search.search_knowledge_base`'s per-item
 * shape verbatim. The `kind` discriminator is what makes this a
 * discriminated union — narrow on it before reading kind-specific fields,
 * the same pattern a merged `build_timeline`/`build_history` feed already
 * needs on the frontend. */
export type SearchResult = FaqSearchResult | ArticleSearchResult
