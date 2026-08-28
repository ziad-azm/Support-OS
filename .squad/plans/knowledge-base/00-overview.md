# knowledge-base — plan overview

Entry point for the **knowledge-base** feature (EPIC 9). Stories execute in
order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 39 | [39-story-faqs-SUPPORTOS-51.md](39-story-faqs-SUPPORTOS-51.md) | FAQs (KB-1) | SUPPORTOS-51 | EPIC 0–8 (foundations, `AUTHZ`, `DSN`) |
| 40 | [40-story-help-articles-guides-SUPPORTOS-53.md](40-story-help-articles-guides-SUPPORTOS-53.md) | Help Articles & Guides (KB-2) | SUPPORTOS-53 | Story 39 (reuses `knowledge_base.*` permissions, the FAQ admin/display route-tree pattern) |
| 41 | [41-story-knowledge-base-search-SUPPORTOS-54.md](41-story-knowledge-base-search-SUPPORTOS-54.md) | Knowledge Base Search (KB-3) | SUPPORTOS-54 | Stories 39 and 40 (searches `FAQ` and `Article` together; no new model, permission, or migration) |

## Dependency notes

- **KB-1 (Story 39, this feature's first story)** ships the `FAQ` model, its
  own `knowledge_base.view`/`knowledge_base.manage` permission pair, and two
  screens: `FaqBrowsePage` (display) and `FaqListPage`/`FaqFormPage`
  (admin CRUD). No category, status, bilingual fields, or search — those are
  KB-2/KB-3.
- **KB-2 (Story 40)** adds `Article` (category, status, bilingual
  Markdown content) as a **second resource in the same permission domain**
  — no new permission constant, no new grant migration; it reuses
  `knowledge_base.view`/`knowledge_base.manage` exactly as
  `tickets.CategoryViewSet` reuses `tickets.*`. It extends (not just
  reuses) KB-1's admin/display route-tree split with a genuine per-record
  reader page, since an article's Markdown body is too long to browse as a
  whole list the way an FAQ's Q&A is. Introduces this feature's first two
  frontend dependencies (`react-markdown`, `@tailwindcss/typography`) and
  its first genuinely bilingual content fields (`title_en`/`title_ar`,
  `body_en`/`body_ar` — picked by `i18n.language` client-side, not
  server-side content negotiation).
- **KB-3 (Story 41)** is a read-only aggregation over the two existing
  models — no new Django model, permission, or migration.
  `apps/knowledge_base/search.py::search_knowledge_base` is the 🔑 reusable
  piece (a plain function, not a view) that the still-unplanned `AI-0`
  story will call directly for KB grounding
  (`SupportOs backlog.MD:646`). It replaces neither `FAQViewSet`/
  `ArticleViewSet`'s existing basic `SearchFilter` (still used by their own
  manage-table search boxes) nor KB-1's `FaqBrowsePage` `page_size=100`
  read — those are unrelated to the new `/api/search/` endpoint, which adds
  Postgres full-text ranking/stemming on top rather than replacing anything.
  `SearchPage` (`/knowledge-base/search`) completes the three-way cross-link
  Story 40 started between just `FaqBrowsePage`/`ArticleBrowsePage`.
- **`PORTAL-4` (Access FAQs, EPIC 10)** depends on KB-1/KB-2 and reuses this
  feature's API for the customer-facing portal — out of scope for this
  feature's own stories, which are all agent-facing (`RequireAuth`).
