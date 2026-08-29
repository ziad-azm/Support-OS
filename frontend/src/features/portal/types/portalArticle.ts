/** Mirrors `apps.knowledge_base.serializers.ArticleSerializer` — read-only.
 * `status` is always `"published"` in practice for a portal caller
 * (`ArticleViewSet.get_queryset` excludes drafts entirely for anyone
 * lacking `knowledge_base.manage`), so the portal components never branch
 * on it — see Story 46 `## Explicitly out of scope`. */
export type PortalArticle = {
  id: number
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  category: number | null
  category_name: string | null
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}
