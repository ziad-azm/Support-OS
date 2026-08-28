# knowledge-base — plan overview

Entry point for the **knowledge-base** feature (EPIC 9). Stories execute in
order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 39 | [39-story-faqs-SUPPORTOS-51.md](39-story-faqs-SUPPORTOS-51.md) | FAQs (KB-1) | SUPPORTOS-51 | EPIC 0–8 (foundations, `AUTHZ`, `DSN`) |

## Dependency notes

- **KB-1 (Story 39, this feature's first story)** ships the `FAQ` model, its
  own `knowledge_base.view`/`knowledge_base.manage` permission pair, and two
  screens: `FaqBrowsePage` (display) and `FaqListPage`/`FaqFormPage`
  (admin CRUD). No category, status, bilingual fields, or search — those are
  KB-2/KB-3.
- **KB-2 (Help Articles & Guides)** extends the pattern with an `Article`
  model (category, status, bilingual fields) and an editor/reader UI. It
  should reuse KB-1's admin/display route-tree split
  (`CONVENTIONS.md` §23 addendum from Story 39) but adds its own permissions
  — an article is not a sub-resource of `FAQ`.
- **KB-3 (Knowledge Base Search)** depends on both KB-1 and KB-2: Postgres
  full-text search across FAQs and articles together, plus a search UI. This
  is what replaces KB-1's `FaqBrowsePage`'s fixed `page_size=100` read with
  real ranked retrieval.
- **`PORTAL-4` (Access FAQs, EPIC 10)** depends on KB-1/KB-2 and reuses this
  feature's API for the customer-facing portal — out of scope for this
  feature's own stories, which are all agent-facing (`RequireAuth`).
