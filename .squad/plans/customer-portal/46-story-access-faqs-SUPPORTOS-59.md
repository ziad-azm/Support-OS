# Story 46 — Access FAQs (Story: SUPPORTOS-59)

## Prerequisites

- **PORTAL-0 complete:** [42-story-portal-access-customer-auth-SUPPORTOS-55.md](42-story-portal-access-customer-auth-SUPPORTOS-55.md) — the seeded `customer` role, `Permissions.PORTAL_ACCESS`, the sibling `path: 'portal'` route tree.
- **KB-1/KB-2 complete** (`.squad/plans/knowledge-base/39-story-faqs-SUPPORTOS-51.md`, `40-story-help-articles-guides-SUPPORTOS-53.md`) — `apps/knowledge_base/models.py`'s `FAQ` and `Article` models, `FAQSerializer`/`ArticleSerializer`, and `FAQViewSet`/`ArticleViewSet` (`apps/knowledge_base/views.py`). Verified today, read in full: neither model nor either viewset has any per-customer scoping — FAQs and published articles are shared, org-wide content, gated only by `Permissions.KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE`, not by `CustomerScopedModelViewSet`. This is the finding that shapes the whole story — see `## Story Goal`.
- **`SupportOs backlog.MD` line 584–588** — `### STORY (PORTAL-4) — Access FAQs`, dependencies `PORTAL-0, KB-1/2` (line 586) — **not** `KB-3` (search). One task: *"KB in portal — Surface KB content within the portal shell. Outcome: self-service answers."* (line 588). See `## Story Goal`'s scope note for why the missing `KB-3` dependency is read as a deliberate scope boundary, not an oversight.
- Verified: `backend/apps/knowledge_base/views.py`'s `ArticleViewSet.get_queryset` (84–91) **already** filters to `status=Article.Status.PUBLISHED` for any caller lacking `Permissions.KNOWLEDGE_BASE_MANAGE`, on **both** `list` and `retrieve` — a draft's direct id already 404s for a view-only caller, per the method's own docstring. A portal customer, who will hold `KNOWLEDGE_BASE_VIEW` but never `KNOWLEDGE_BASE_MANAGE` (see task 1), gets this exact behaviour for free — no new filtering logic needed anywhere.
- Verified: `backend/apps/knowledge_base/migrations/0002_grant_knowledge_base_permissions.py` is the exact cross-app grant-migration pattern (`CONVENTIONS.md` §23's worked example) task 1 copies — granting `KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE` to `admin`/`manager`/`agent` by set union. `apps/knowledge_base/migrations/` currently ends at `0003_category_article.py`.
- Verified frontend baseline: `frontend/src/features/portal/` has no `faqs`/`articles`-related files of any kind. `frontend/src/features/knowledge-base/` already has the exact shape this story's portal versions mirror — `FaqBrowsePage.tsx`, `ArticleBrowsePage.tsx`, `ArticleReaderPage.tsx`, `MarkdownPreview.tsx` — all read in full (see `## Context`).
- Verified: `frontend/.oxlintrc.json`'s `no-restricted-imports` rule (lines 8–18) forbids `features/portal/` from importing `features/knowledge-base/` — the same boundary every prior portal story already works within. This story cannot reuse `FaqBrowsePage`/`ArticleBrowsePage`/`ArticleReaderPage`/`MarkdownPreview` directly; it duplicates thin, portal-shaped versions instead, the same tradeoff `PortalTicket*` already made for `features/tickets/`.

---

## Story Goal

Let a logged-in customer browse FAQs and published help articles from inside the portal shell — reusing the exact `FAQViewSet`/`ArticleViewSet` endpoints staff already use, with **one small permission grant** as the only backend change.

1. **Backend:** grant `Permissions.KNOWLEDGE_BASE_VIEW` (not `KNOWLEDGE_BASE_MANAGE`) to the `customer` role, via a data migration that copies `apps/knowledge_base/migrations/0002_grant_knowledge_base_permissions.py`'s exact pattern. No new endpoint, no new serializer, no new permission constant — `FAQViewSet.list` and `ArticleViewSet.list`/`retrieve` already exist, are already correctly gated, and `ArticleViewSet` already filters non-manage callers to published-only.
2. **Frontend:** `PortalFaqPage` (browse), `PortalArticleListPage` (browse), `PortalArticleReaderPage` (read one), all under `features/portal/`, calling the **same** `/api/faqs/`/`/api/articles/` endpoints staff pages call — just through portal-local types/API files, per the `no-restricted-imports` boundary every prior portal story already works within.
3. **Search (KB-3) is explicitly out of scope.** The intake's own dependency line names `KB-1/2`, not `KB-3` — unlike every other named dependency in this epic's intakes, which the plans so far have taken literally (e.g. PORTAL-1 naming `TKT-1`, PORTAL-2 naming nothing beyond `PORTAL-0`). See `## Explicitly out of scope`.

### Why this story needs almost no backend code

`FAQViewSet`/`ArticleViewSet`/`CategoryViewSet` (`apps/knowledge_base/views.py`) hold **no customer-scoping logic of any kind** — verified by reading all three in full. FAQs and articles are organization-wide content, not per-customer data, so there is nothing here for `CustomerScopedModelViewSet` to do and no reason to build a `PortalFaq`/`PortalArticle` viewset the way `PortalTicketViewSet` was necessary for tickets. The **entire** backend task is one data migration granting an already-defined permission to an already-seeded role — the same "reuse, don't rebuild" pattern PORTAL-3 (View History) already demonstrated needs zero backend changes at all; this story needs exactly one.

### Explicitly out of scope

- **Full-text search (`KnowledgeBaseSearchView`, KB-3).** Not named as a dependency in the intake (`PORTAL-0, KB-1/2` only) — the one deliberate omission this plan treats as a scope boundary, not an oversight. A future portal story can grant `Permissions.KNOWLEDGE_BASE_VIEW` (already granted by this story) is all `KnowledgeBaseSearchView.permission_map` needs — reaching it is then a small, self-contained frontend addition, not named here.
- **Article/FAQ categories as a filter.** Verified: staff's own `ArticleBrowsePage`/`FaqBrowsePage` have no category filter either (both are simple, unpaginated browse screens) — this story does not add one where the staff precedent it is copying does not have one.
- **`KNOWLEDGE_BASE_MANAGE` for customers, in any form.** Only `KNOWLEDGE_BASE_VIEW` is granted. A customer can never create, edit, or delete a FAQ or article — `FAQViewSet`/`ArticleViewSet`'s `create`/`update`/`partial_update`/`destroy` all require `KNOWLEDGE_BASE_MANAGE`, which the customer role never holds.
- **A draft-status indicator anywhere in the portal.** Staff's `ArticleBrowsePage`/`ArticleReaderPage`/`SearchPage` show a "Draft" badge when the caller can manage KB content and is viewing one. A portal customer never sees a draft article at all (`ArticleViewSet.get_queryset` excludes them entirely) — the badge's condition is always false for a portal caller, so the portal components omit the dead branch rather than porting unreachable code.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/SUPPORTOS-59/intake.md` — one task block (*"KB in portal — Surface KB content within the portal shell"*), **no attachments, no acceptance criteria**. Done Criteria derive from the one **Outcome** line: *"self-service answers."*
2. `SupportOs backlog.MD` lines 584–588 — `PORTAL-4`'s dependency line (`PORTAL-0, KB-1/2`) is what `## Story Goal` reads as excluding `KB-3` (search).
3. `backend/apps/knowledge_base/models.py` — `FAQ` (7–27) and `Article` (48–89), especially the `Status` choices (55–58) and the `title_en`/`title_ar`/`body_en`/`body_ar` bilingual fields (59–66) task 4's reader page renders by active language.
4. `backend/apps/knowledge_base/views.py` — `FAQViewSet.permission_map` (25–32) and `ArticleViewSet.permission_map`/`get_queryset` (72–91, especially the published-only filter at 84–91) — the exact enforcement this story's one migration activates for the `customer` role; nothing here changes.
5. `backend/apps/knowledge_base/urls.py` — full file (21 lines). `router.register("faqs", ...)`/`router.register("articles", ...)` (12–13) — confirms the endpoints are `/api/faqs/` and `/api/articles/`, already mounted, already public within the org (no portal-specific path).
6. `backend/apps/knowledge_base/migrations/0002_grant_knowledge_base_permissions.py` — the full grant-migration pattern (41 lines) task 1's new migration copies verbatim, granting to `"customer"` instead of `admin`/`manager`/`agent`, and `KNOWLEDGE_BASE_VIEW` only (not `KNOWLEDGE_BASE_MANAGE`).
7. `backend/apps/accounts/migrations/0004_seed_customer_role.py` — confirms the exact migration name (`"accounts", "0004_seed_customer_role"`) task 1's `dependencies` must reference so the `customer` role exists before this migration grants to it.
8. `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx` — full file (61 lines). Task 5's `PortalFaqPage` copies the `useFaqs`-style query (`page: 1, page_size: 100, ordering: 'order'`) and the `QueryBoundary`/`Card` list shape, omitting the `Can permission="knowledge_base.manage"` "Manage" link (18–36) and the "Articles"/"Search" nav buttons (26–31, replaced with a link to `/portal/articles` only).
9. `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx` — full file (67 lines). Task 6's `PortalArticleListPage` copies the shape, omitting the "Search" link (26–28) and the draft `Badge` (54–56, unreachable for a portal caller — see `## Explicitly out of scope`).
10. `frontend/src/features/knowledge-base/components/ArticleReaderPage.tsx` — full file (50 lines). Task 7's `PortalArticleReaderPage` copies the `Number.isNaN` guard (19–21) and the bilingual `isArabic ? ... : ...` rendering (38–39, 44), omitting the draft `Badge` (40–43).
11. `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx` — full file (18 lines). Task 4 duplicates this verbatim as `PortalMarkdownPreview.tsx` — trivial (one `react-markdown` wrapper), and `no-restricted-imports` forbids importing the original.
12. `frontend/src/features/knowledge-base/types/{faq.ts,article.ts}` and `api/{faqKeys.ts,getFaqs.ts,useFaqs.ts,articleKeys.ts,getArticles.ts,useArticles.ts,getArticle.ts,useArticle.ts}` — the exact shapes and `api.getPage`/`api.get` + `useQuery` + `featureKey` patterns tasks 2–3 duplicate into `features/portal/`, the same tradeoff `PortalTicket`/`portalTicketKeys` already made for tickets (PORTAL-1/2).
13. `frontend/src/app/router.tsx` — the `path: 'portal'` tree (257–326, post-PORTAL-3). Task 8 adds three sibling routes (`faqs`, `articles`, `articles/:id`) inside the existing `RequirePermission permission="portal.access"` block.
14. `frontend/src/features/portal/components/{PortalLayout.tsx,PortalHomePage.tsx}` (post-PORTAL-3) — task 9 adds two nav links and one home-page call to action.
15. `package.json` — confirm `react-markdown` is already a dependency (it is, used by `features/knowledge-base/components/MarkdownPreview.tsx`) — task 4 adds no new package.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Surface KB content within the portal shell.** | Intake | `PortalFaqPage`/`PortalArticleListPage`/`PortalArticleReaderPage` under `frontend/src/features/portal/components/`, routed inside the existing portal shell (`PortalLayout`) — not a separate surface. |
| **Self-service answers.** | Intake | Reuses the exact `/api/faqs/`/`/api/articles/` endpoints and their existing published-only filtering — a customer sees the same content an agent would show them, with zero duplication of business logic. |
| **A customer never manages KB content.** | `CONVENTIONS.md` §22 (grant-on-omission does not apply here — every action is explicitly mapped on both viewsets) | Only `Permissions.KNOWLEDGE_BASE_VIEW` is granted to `customer`; `create`/`update`/`partial_update`/`destroy` still require `KNOWLEDGE_BASE_MANAGE`, which the migration does not grant. |
| **A feature must not import from another feature.** | `frontend/.oxlintrc.json` §15 | `features/portal/` gets its own `types/portalFaq.ts`/`types/portalArticle.ts`, its own `api/` files, and its own `PortalMarkdownPreview.tsx` — none imported from `features/knowledge-base/`. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — Grant `knowledge_base.view` to the `customer` role

**Create file: `backend/apps/knowledge_base/migrations/0004_grant_customer_knowledge_base_view.py`**

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning and shape as 0002_grant_knowledge_base_permissions: a
# customer may read FAQs/published articles for self-service, never manage
# them — only KNOWLEDGE_BASE_VIEW is granted, never KNOWLEDGE_BASE_MANAGE.
GRANTS = {
    "customer": [Permissions.KNOWLEDGE_BASE_VIEW],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) | set(permissions))
        role.save(update_fields=["permissions"])


def revoke(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) - set(permissions))
        role.save(update_fields=["permissions"])


class Migration(migrations.Migration):
    # Cross-app: the row lives in `accounts`, the grant belongs to the
    # feature whose permission is being granted (knowledge_base) — the
    # same reasoning 0002_grant_knowledge_base_permissions.py already uses.
    dependencies = [
        ("knowledge_base", "0003_category_article"),
        ("accounts", "0004_seed_customer_role"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

No change to `apps/knowledge_base/views.py`, `serializers.py`, or `urls.py` — see `## Story Goal`.

---

### 1b — Fix a latent bug in `HasPermission.has_object_permission`, found live by this story

**Verified during implementation, not anticipated by the original plan.** After task 1's migration, `GET /api/articles/<id>/` for a *published* article returned `403 permission_denied` for a portal customer, not `200`. Root cause: `HasPermission.has_object_permission` (`apps/core/permissions.py`, added by Story 42) read:

```python
customer_field = getattr(view, "customer_field", "customer")
return getattr(obj, f"{customer_field}_id", None) == customer.id
```

— defaulting `customer_field` to `"customer"` for **any** view once the caller has a `customer_profile`, not only for `CustomerScopedModelViewSet` subclasses that actually declare it. `ArticleViewSet` is a plain `BaseModelViewSet` with no `customer` relation on `Article` at all, so `getattr(obj, "customer_id", None)` was always `None`, which never equals `customer.id` — a false, permanent `403` on `retrieve` for every portal customer, on every plain `BaseModelViewSet` endpoint they can reach. This was latent since Story 42 and unreachable until this story gave a portal customer real `retrieve` access to a non-`CustomerScopedModelViewSet` endpoint for the first time.

**File: `backend/apps/core/permissions.py`** — `HasPermission.has_object_permission` gains one guard, checked before reading `customer_field`:

```python
        customer = getattr(request.user, "customer_profile", None)
        if customer is None:
            return True
        if not hasattr(view, "customer_field"):
            return True
        customer_field = view.customer_field
        return getattr(obj, f"{customer_field}_id", None) == customer.id
```

`hasattr(view, "customer_field")` is `True` only for `CustomerScopedModelViewSet` subclasses (which declare the attribute as a class member) — `ArticleViewSet`, `FAQViewSet`, and every staff `BaseModelViewSet` subclass never define it, so they now correctly no-op. Verified this does not loosen `PortalTicketViewSet`'s own scoping: a customer retrieving their own ticket still `200`s, and retrieving another customer's ticket id still `404`s (via `get_queryset()`, unaffected by this change) — see `## Verification Steps`.

`CONVENTIONS.md` — the `has_object_permission` paragraph in `## 26.` is updated to describe the corrected condition and cite this story as the fix.

---

## Frontend Tasks

### 2 — `features/portal/types/`: FAQ and article read shapes

**Create file: `frontend/src/features/portal/types/portalFaq.ts`**

```ts
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
```

**Create file: `frontend/src/features/portal/types/portalArticle.ts`**

```ts
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
```

---

### 3 — `features/portal/api/`: FAQ and article reads

**Create file: `frontend/src/features/portal/api/portalFaqKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const portalFaqKeys = featureKey('portal-faqs')
```

**Create file: `frontend/src/features/portal/api/getPortalFaqs.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { PortalFaq } from '../types/portalFaq'

export type PortalFaqListParams = ServerTableParams

export function getPortalFaqs(params: PortalFaqListParams): Promise<Page<PortalFaq>> {
  return api.getPage<PortalFaq>('/faqs/', { params })
}
```

**Create file: `frontend/src/features/portal/api/usePortalFaqs.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalFaqs } from './getPortalFaqs'
import type { PortalFaqListParams } from './getPortalFaqs'
import { portalFaqKeys } from './portalFaqKeys'

export function usePortalFaqs(params: PortalFaqListParams) {
  return useQuery({
    queryKey: portalFaqKeys.resource('list', params),
    queryFn: () => getPortalFaqs(params),
  })
}
```

**Create file: `frontend/src/features/portal/api/portalArticleKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const portalArticleKeys = featureKey('portal-articles')
```

**Create file: `frontend/src/features/portal/api/getPortalArticles.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { PortalArticle } from '../types/portalArticle'

export type PortalArticleListParams = ServerTableParams

export function getPortalArticles(
  params: PortalArticleListParams,
): Promise<Page<PortalArticle>> {
  return api.getPage<PortalArticle>('/articles/', { params })
}
```

**Create file: `frontend/src/features/portal/api/usePortalArticles.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalArticles } from './getPortalArticles'
import type { PortalArticleListParams } from './getPortalArticles'
import { portalArticleKeys } from './portalArticleKeys'

export function usePortalArticles(params: PortalArticleListParams) {
  return useQuery({
    queryKey: portalArticleKeys.resource('list', params),
    queryFn: () => getPortalArticles(params),
  })
}
```

**Create file: `frontend/src/features/portal/api/getPortalArticle.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalArticle } from '../types/portalArticle'

export function getPortalArticle(id: number): Promise<PortalArticle> {
  return api.get<PortalArticle>(`/articles/${id}/`)
}
```

**Create file: `frontend/src/features/portal/api/usePortalArticle.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalArticle } from './getPortalArticle'
import { portalArticleKeys } from './portalArticleKeys'

export function usePortalArticle(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: portalArticleKeys.resource('detail', id),
    queryFn: () => getPortalArticle(id),
    enabled: options?.enabled,
  })
}
```

---

### 4 — `PortalMarkdownPreview`

**Create file: `frontend/src/features/portal/components/PortalMarkdownPreview.tsx`**

```tsx
import Markdown from 'react-markdown'

/**
 * Duplicated verbatim from `features/knowledge-base/components/
 * MarkdownPreview.tsx` — `no-restricted-imports` forbids importing it
 * across the feature boundary. No `rehype-raw` / no
 * `dangerouslySetInnerHTML` — react-markdown does not execute embedded
 * HTML by default.
 */
export function PortalMarkdownPreview({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none" dir="auto">
      <Markdown>{children}</Markdown>
    </div>
  )
}
```

---

### 5 — `PortalFaqPage`

**Create file: `frontend/src/features/portal/components/PortalFaqPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'

import { usePortalFaqs } from '../api/usePortalFaqs'
import type { PortalFaq } from '../types/portalFaq'

/**
 * FAQ browse — PORTAL-4. Shape copied from the staff `FaqBrowsePage`
 * (features/knowledge-base/components/FaqBrowsePage.tsx), minus the
 * `Can permission="knowledge_base.manage"` "Manage" link (a customer never
 * holds that permission) and the "Search" nav button (KB-3 search is out
 * of scope — see Story 46 `## Story Goal`).
 */
export function PortalFaqPage() {
  const { t } = useTranslation('portal')
  // Single page, ordered for reading — same fixed-size-read simplification
  // FaqBrowsePage itself accepted (real search/ranking is KB-3's job).
  const query = usePortalFaqs({ page: 1, page_size: 100, ordering: 'order' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('faqs.title')}</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/articles">{t('articles.title')}</Link>
        </Button>
      </div>
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<Empty title={t('faqs.empty')} description={t('faqs.emptyDescription')} />}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((faq: PortalFaq) => (
              <Card key={faq.id}>
                <CardHeader>
                  <CardTitle>{faq.question}</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {faq.answer}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
```

---

### 6 — `PortalArticleListPage`

**Create file: `frontend/src/features/portal/components/PortalArticleListPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'

import { usePortalArticles } from '../api/usePortalArticles'
import type { PortalArticle } from '../types/portalArticle'

/**
 * Article browse — PORTAL-4. Shape copied from the staff `ArticleBrowsePage`
 * (features/knowledge-base/components/ArticleBrowsePage.tsx), minus the
 * "Search" link (out of scope) and the draft `Badge` — unreachable here,
 * `ArticleViewSet.get_queryset` already excludes every draft for a portal
 * caller. See Story 46 `## Explicitly out of scope`.
 */
export function PortalArticleListPage() {
  const { t, i18n } = useTranslation('portal')
  const isArabic = i18n.language.startsWith('ar')
  const query = usePortalArticles({ page: 1, page_size: 100, ordering: '-created_at' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('articles.title')}</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/faqs">{t('faqs.title')}</Link>
        </Button>
      </div>
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<Empty title={t('articles.empty')} description={t('articles.emptyDescription')} />}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((article: PortalArticle) => (
              <Card key={article.id}>
                <CardHeader>
                  <CardTitle>
                    <Link to={`/portal/articles/${article.id}`}>
                      {isArabic ? article.title_ar : article.title_en}
                    </Link>
                  </CardTitle>
                  {article.category_name ? (
                    <Badge variant="secondary">{article.category_name}</Badge>
                  ) : null}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
```

---

### 7 — `PortalArticleReaderPage`

**Create file: `frontend/src/features/portal/components/PortalArticleReaderPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Empty } from '@/shared/ui/Empty'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { PortalMarkdownPreview } from './PortalMarkdownPreview'
import { usePortalArticle } from '../api/usePortalArticle'

/**
 * A single published article — PORTAL-4. Shape copied from the staff
 * `ArticleReaderPage`, minus the draft `Badge` (unreachable — see Story 46
 * `## Explicitly out of scope`).
 */
export function PortalArticleReaderPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const { t } = useTranslation('portal')

  if (Number.isNaN(id)) {
    return <Empty title={t('articles.notFound')} />
  }

  return <PortalArticleReaderContent id={id} />
}

function PortalArticleReaderContent({ id }: { id: number }) {
  const { t, i18n } = useTranslation('portal')
  const isArabic = i18n.language.startsWith('ar')
  const query = usePortalArticle(id)

  return (
    <QueryBoundary query={query}>
      {(article) => (
        <div className="flex flex-col gap-4">
          <Link to="/portal/articles" className="text-sm text-muted-foreground hover:underline">
            {t('articles.backToList')}
          </Link>
          <h1 className="text-xl font-semibold">
            {isArabic ? article.title_ar : article.title_en}
          </h1>
          <PortalMarkdownPreview>
            {isArabic ? article.body_ar : article.body_en}
          </PortalMarkdownPreview>
        </div>
      )}
    </QueryBoundary>
  )
}
```

---

### 8 — Wire `/portal/faqs`, `/portal/articles`, `/portal/articles/:id`

**File: `frontend/src/app/router.tsx`** — add three sibling entries inside the existing `RequirePermission permission="portal.access"` block, alongside the existing `tickets*` entries. No ordering constraint between `articles` and `articles/:id` and any `tickets*` path (different top segment); `articles` and `articles/:id` themselves need no relative ordering comment either — unlike `tickets/new` vs `tickets/:id`, there is no third static segment under `articles/` that could collide:

```tsx
              {
                path: 'faqs',
                lazy: async () => {
                  const { PortalFaqPage } = await import('@/features/portal/components/PortalFaqPage')
                  return { element: <PortalFaqPage /> }
                },
              },
              {
                path: 'articles',
                lazy: async () => {
                  const { PortalArticleListPage } =
                    await import('@/features/portal/components/PortalArticleListPage')
                  return { element: <PortalArticleListPage /> }
                },
              },
              {
                path: 'articles/:id',
                lazy: async () => {
                  const { PortalArticleReaderPage } =
                    await import('@/features/portal/components/PortalArticleReaderPage')
                  return { element: <PortalArticleReaderPage /> }
                },
              },
```

Full paths: `/portal/faqs`, `/portal/articles`, `/portal/articles/:id`.

**No second `RequirePermission` layer for `knowledge_base.view`.** The `customer` role always holds both `portal.access` and (after task 1) `knowledge_base.view` together — there is no path to being a portal customer with one but not the other, so the existing outer `RequirePermission permission="portal.access"` gate is sufficient on the frontend. The backend's own `FAQViewSet`/`ArticleViewSet` independently enforce `knowledge_base.view` regardless of what the frontend gates on (`CONVENTIONS.md` §12) — this is not a shortcut on security, only on frontend redundancy.

---

### 9 — Nav and home-page links

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — add two nav links, directly after the existing "Home" link and before "My tickets":

```tsx
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal">{t('nav.home')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/faqs">{t('nav.faqs')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/articles">{t('nav.articles')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
            </Button>
```

**File: `frontend/src/features/portal/components/PortalHomePage.tsx`** — add a third button alongside the existing two:

```tsx
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/faqs">{t('nav.faqs')}</Link>
        </Button>
      </div>
```

---

### 10 — Locale keys

**File: `frontend/src/features/portal/locales/en.json`** — add `nav.faqs`/`nav.articles`, and two new top-level keys, `faqs` and `articles`, alongside the existing `shell`/`home`/`nav`/`tickets` keys:

```json
{
  "nav": {
    "home": "Home",
    "faqs": "FAQs",
    "articles": "Articles",
    "myTickets": "My tickets",
    "history": "History",
    "newTicket": "New ticket"
  },
  "faqs": {
    "title": "Frequently asked questions",
    "empty": "No FAQs yet",
    "emptyDescription": "Check back soon."
  },
  "articles": {
    "title": "Help articles",
    "empty": "No articles yet",
    "emptyDescription": "Check back soon.",
    "notFound": "That article could not be found.",
    "backToList": "Back to articles"
  }
}
```

(Shown as a diff against the existing file's structure — `shell`/`home`/`tickets` keys are unchanged; only `nav` gains two entries and `faqs`/`articles` are new top-level siblings of `tickets`.)

**File: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated. Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

---

## Edge Cases & Failure Modes

- **A customer requesting a draft article's id directly gets 404, not 403 or the article.** `ArticleViewSet.get_queryset` (unchanged) filters to published-only for anyone lacking `knowledge_base.manage`, on both `list` and `retrieve` — verified in `## Prerequisites`. This story activates that existing protection for the `customer` role; it does not add new protection.
- **A hand-typed non-numeric `/portal/articles/abc` does not crash the reader page.** Same `Number.isNaN` guard `ArticleReaderPage` already uses, copied verbatim into `PortalArticleReaderPage`.
- **The FAQ/article browse pages are unpaginated, fixed-size reads (`page_size: 100`), matching staff's own accepted simplification.** If FAQ or published-article counts ever exceed 100, the extra rows are silently absent from the browse screen — the same limitation `FaqBrowsePage`/`ArticleBrowsePage` already carry today; this story does not fix or worsen it.
- **No search means a customer cannot find a specific FAQ/article by keyword from the portal — only by scrolling the browse list.** Deliberate, see `## Story Goal`'s scope note on `KB-3`. Not a regression: no portal search existed before this story either.
- **`react-markdown` renders the exact same Markdown a staff-authored article contains, with no additional sanitization step.** Verified safe (`MarkdownPreview`'s own comment): react-markdown does not execute embedded HTML by default, and `PortalMarkdownPreview` adds no `rehype-raw`/`dangerouslySetInnerHTML` either — the same safety property, unmodified.
- **Category names appear on portal article cards with no way to filter by them.** A category is shown (existing information, harmless), but there is no category picker — see `## Explicitly out of scope`. Not a broken feature, a feature not built.
- **Revoking `knowledge_base.view` from the `customer` role (the reverse migration) does not touch `Role.permissions` for any other role.** `GRANTS` in task 1's migration names only `"customer"` — `admin`/`manager`/`agent`'s own grants (from `0002_grant_knowledge_base_permissions.py`) are a separate migration, untouched.
- **`HasPermission.has_object_permission`'s pre-fix default would have broken `retrieve` on every plain `BaseModelViewSet` a portal customer could reach, not just `Article`.** Verified live (task 1b) — the bug was in the shared permission class, not anything knowledge-base-specific, so the same false `403` would have hit `FAQViewSet.retrieve` (had it routed one — it does not) or any future `BaseModelViewSet`-based endpoint a later portal story exposes read access to. The fix (`hasattr(view, "customer_field")`) generalizes correctly to all of them, not just `Article`.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — clean, and the existing suite reports the same passing count as before this change.
2. `ruff format --check .` / `ruff check .` on the new migration.
3. `npm run build` — typechecks `PortalFaqPage`/`PortalArticleListPage`/`PortalArticleReaderPage`, the new types/API files, and the new router entries.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files; lint is also what proves `features/portal/` still imports nothing from `features/knowledge-base/`.
5. Real HTTP checks proving the grant actually works, and that a draft article stays hidden from a customer — Verification Steps 3–6. This is where the story's actual claim gets tested; nothing static can see it.

---

## Migration / Rollback

**One data migration, no schema change.** `apps/knowledge_base/migrations/0004_grant_customer_knowledge_base_view.py` grants `KNOWLEDGE_BASE_VIEW` to the `customer` role by set union — additive, safe to re-run.

**Rollback of the code:** revert the commits. No `npm install`/`pip install` needed — `react-markdown` is already a dependency; no new package in either app.

**Rollback of the migration:** `python manage.py migrate knowledge_base 0003_category_article` runs `revoke`, removing `KNOWLEDGE_BASE_VIEW` from the `customer` role's `permissions` list by set difference. Safe at any time — no FK, no `PROTECT`, nothing else references this grant.

**Half-applied states to avoid:**

- **Frontend routes/nav shipped before task 1's migration runs** → every FAQ/article request from the portal 403s with `permission_denied` until the migration is applied. Run `python manage.py migrate` before testing the frontend.
- **Task 8's router entries before tasks 5–7's components exist** → `npm run build` fails on the missing lazy imports. Ship tasks 4–7 before task 8.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **Migration applies forward, additively:** `python manage.py migrate` — `knowledge_base.0004_grant_customer_knowledge_base_view` applies; `python manage.py shell -c "from apps.accounts.models import Role; print(Role.objects.get(slug='customer').permissions)"` shows `['knowledge_base.view', 'portal.access']` (sorted).
3. **A customer can list FAQs and published articles, and read one article:**

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   curl.exe -s "http://127.0.0.1:8000/api/faqs/?page=1&page_size=100&ordering=order" -H "Authorization: Bearer $t"
   curl.exe -s "http://127.0.0.1:8000/api/articles/?page=1&page_size=100" -H "Authorization: Bearer $t"
   ```

   Expect `200` for both. If any FAQ/published article exists in the dev database, `GET /api/articles/<id>/` with that id returns `200` with its body — **this specific check is what surfaced task 1b's bug**; if it 403s instead, `HasPermission.has_object_permission`'s fix did not apply.
4. **A draft article stays hidden from the customer.** Create or find a draft article (`Article.Status.DRAFT`) via `manage.py shell`, then request it as the customer: expect `404 not_found`, not `403` and not the article body — confirms the existing `ArticleViewSet.get_queryset` filter (unchanged by this story) still applies to the newly-granted role exactly as it does to any other view-only caller.
5. **A staff account without `knowledge_base.view` (a hypothetical role-less account, or the plain `staffcheck@supportos.local` fixture from earlier stories) is still denied**, confirming this migration touched only the `customer` role: `GET /api/faqs/` with that account's token → `403 permission_denied`.
6. **`create`/`update`/`destroy` on either endpoint remain denied for a customer:** `POST /api/faqs/` with the customer token and a body → `403 permission_denied` (requires `knowledge_base.manage`, never granted).
6b. **The `has_object_permission` fix did not loosen `PortalTicketViewSet`'s own scoping.** With the customer token: `GET /api/portal/tickets/<own-ticket-id>/` → `200`; `GET /api/portal/tickets/<other-customer's-ticket-id>/` → `404`. Both must still hold exactly as PORTAL-0/PORTAL-2 verified.
7. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
8. **The FAQ and article pages render and cross-link correctly, in both languages.** With the backend running: `npm run dev`, log in as `cust1@example.com`, navigate to `/portal/faqs` and `/portal/articles` via the new nav links. Confirm an article's title links to `/portal/articles/:id` and renders its Markdown body; the "FAQs"/"Articles" cross-links between the two browse pages work. Switch to Arabic: FAQ/article titles and body render in Arabic where a translation exists (`title_ar`/`body_ar`), and all portal-authored copy (page titles, empty states, nav labels) is Arabic.

---

## Done Criteria

- [ ] `apps/knowledge_base/migrations/0004_grant_customer_knowledge_base_view.py` grants exactly `Permissions.KNOWLEDGE_BASE_VIEW` (not `KNOWLEDGE_BASE_MANAGE`) to the `customer` role, by set union, re-runnable.
- [ ] No change to `apps/knowledge_base/{models.py,serializers.py,views.py,urls.py}` — verified via `git status`/diff showing only the one new migration file under `backend/knowledge_base`.
- [ ] `HasPermission.has_object_permission` (`apps/core/permissions.py`) fixed to no-op unless the view declares `customer_field` — the one backend file outside `apps/knowledge_base/` this story had to touch, discovered live (task 1b). `CONVENTIONS.md` §26 updated to match.
- [ ] Verified by real HTTP (Steps 3–6b): a customer lists FAQs and published articles and can read one (**200, not the pre-fix 403**); a draft article 404s for the customer; a staff account without `knowledge_base.view` is still denied; `create`/`update`/`destroy` remain denied for the customer; `PortalTicketViewSet`'s own scoping (own ticket 200, another customer's ticket 404) is unaffected by the fix.
- [ ] `frontend/src/features/portal/types/{portalFaq.ts,portalArticle.ts}` and `api/{portalFaqKeys.ts,getPortalFaqs.ts,usePortalFaqs.ts,portalArticleKeys.ts,getPortalArticles.ts,usePortalArticles.ts,getPortalArticle.ts,usePortalArticle.ts}` all exist; none imports from `features/knowledge-base/` (lint-verified).
- [ ] `PortalMarkdownPreview.tsx`, `PortalFaqPage.tsx`, `PortalArticleListPage.tsx`, `PortalArticleReaderPage.tsx` all exist under `frontend/src/features/portal/components/`.
- [ ] `frontend/src/app/router.tsx` routes `/portal/faqs`, `/portal/articles`, `/portal/articles/:id`, all inside the existing `RequirePermission permission="portal.access"` group — no new guard component.
- [ ] `PortalLayout` nav includes "FAQs" and "Articles"; `PortalHomePage` links to FAQs alongside the existing ticket buttons.
- [ ] `features/portal/locales/{en,ar}.json` both have `nav.faqs`/`nav.articles` and the new `faqs`/`articles` top-level blocks, with identical key sets.
- [ ] No draft-status UI anywhere in the portal FAQ/article pages (verified absent, not just unused).
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/customer-portal/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to PORTAL-5 (Submit Feedback/CSAT), the last story in EPIC 10.**
