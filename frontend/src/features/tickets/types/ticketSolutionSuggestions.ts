/** Mirrors `apps.knowledge_base.search.search_knowledge_base`'s two
 * per-item shapes, independently declared here — this feature does not
 * import `features/knowledge-base`'s own `SearchResult` type
 * (`no-restricted-imports`, `CONVENTIONS.md` §15). `headline`/
 * `headline_en`/`headline_ar` are present on the wire (the backend
 * returns `search_knowledge_base`'s dicts unmodified) but intentionally
 * not declared — this panel never renders the highlighted snippet. */
export type FaqSolutionMatch = {
  kind: 'faq'
  id: number
  question: string
  answer: string
  rank: number
}

export type ArticleSolutionMatch = {
  kind: 'article'
  id: number
  title_en: string
  title_ar: string
  status: 'draft' | 'published'
  rank: number
}

export type SolutionMatch = FaqSolutionMatch | ArticleSolutionMatch

/** Mirrors `TicketViewSet.suggest_solutions`'s response shape verbatim. */
export type TicketSolutionSuggestions = {
  query: string
  results: SolutionMatch[]
}
