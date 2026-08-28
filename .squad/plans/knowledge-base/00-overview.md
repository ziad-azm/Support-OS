# knowledge-base — plan overview

Entry point for the **knowledge-base** feature (EPIC 9). Stories execute in
order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 39 | [39-story-faqs-SUPPORTOS-51.md](39-story-faqs-SUPPORTOS-51.md) | FAQs (KB-1) | SUPPORTOS-51 | EPIC 0–8 (foundations, `AUTHZ`, `DSN`) |
| 40 | [40-story-help-articles-guides-SUPPORTOS-53.md](40-story-help-articles-guides-SUPPORTOS-53.md) | Help Articles & Guides (KB-2) | SUPPORTOS-53 | Story 39 (reuses `knowledge_base.*` permissions, the FAQ admin/display route-tree pattern) |

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
- **KB-3 (Knowledge Base Search)** depends on both KB-1 and KB-2: Postgres
  full-text search across FAQs and articles together, plus a search UI. This
  is what replaces both features' current basic `SearchFilter` substring
  match — and KB-1's `FaqBrowsePage`'s fixed `page_size=100` read — with
  real ranked retrieval.
- **`PORTAL-4` (Access FAQs, EPIC 10)** depends on KB-1/KB-2 and reuses this
  feature's API for the customer-facing portal — out of scope for this
  feature's own stories, which are all agent-facing (`RequireAuth`).
