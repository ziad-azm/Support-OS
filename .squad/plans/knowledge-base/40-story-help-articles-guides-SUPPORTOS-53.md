# Story 40 — Help Articles & Guides (Story: SUPPORTOS-53)

## Prerequisites

- **Story 39 (FAQs, `KB-1`) completed and implemented** —
  [39-story-faqs-SUPPORTOS-51.md](39-story-faqs-SUPPORTOS-51.md). Verified
  live in this codebase: `apps/knowledge_base/` already has `models.py`
  (`FAQ`), `serializers.py` (`FAQSerializer`), `views.py` (`FAQViewSet`),
  `urls.py` (a `SimpleRouter` registering `"faqs"`), and `admin.py`
  (`FAQAdmin`). `Permissions.KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE`
  already exist (`backend/apps/core/permissions.py:33-34`) and are already
  granted to `admin`/`manager`/`agent` by
  `apps/knowledge_base/migrations/0002_grant_knowledge_base_permissions.py`.
  **This story adds no new permission constant and no new grant migration** —
  `Article`/`Category` reuse `knowledge_base.*` as a second resource in the
  same domain, the same call `CONVENTIONS.md` §23 already documents for
  `tickets.Category`/`QuickReply` reusing `tickets.*`.
- Frontend precedent already in place:
  `frontend/src/features/knowledge-base/` has `types/faq.ts`, `api/`
  (`faqKeys`, five call modules, `useFaqs`/`useFaq`/`useFaqMutations`),
  `components/{FaqBrowsePage,FaqListPage,FaqFormPage}.tsx`, and
  `locales/{en,ar}.json` registered as `knowledgeBase` in
  `frontend/src/shared/i18n/resources.ts`. `frontend/src/app/router.tsx`
  already has one `knowledge_base.view`-gated block (`knowledge-base` →
  `FaqBrowsePage`) and one `knowledge_base.manage`-gated block
  (`knowledge-base/manage`, `/new`, `/:id/edit` → `FaqListPage`/
  `FaqFormPage`). `RootLayout.tsx` already has a `knowledge_base.view`-gated
  nav link to `/knowledge-base`.
- **Backlog scope boundary.** `SupportOs backlog.MD` **lines 540–550**: KB-2
  (this story) is `Article` + editor/reader UI; KB-3 (**lines 545–550**,
  depends on KB-1 **and** KB-2) owns Postgres full-text search across FAQs
  **and** articles together. This story adds no search ranking — see
  `## Story Goal`.
- **No rich-text/Markdown library exists yet** — verified: neither
  `react-markdown` nor `@tailwindcss/typography` (nor any WYSIWYG editor
  package) appears in `frontend/package.json`. **Decision (confirmed with
  the user): Markdown source + `react-markdown` for rendering**, not a true
  WYSIWYG/HTML editor. Verified current registry versions:
  `react-markdown@10.1.0` (peer `react: >=18`, `@types/react: >=18` — this
  project is on `react@19.2.8`, compatible) and
  `@tailwindcss/typography@0.5.20`. Both are added by this story; see task 8.
- Verified: `frontend/src/shared/ui/primitives/tabs.tsx` (`Tabs`/
  `TabsList`/`TabsTrigger`/`TabsContent`) and `badge.tsx` (`Badge`) already
  exist and need no changes — this story's Write/Preview toggle and
  draft/published indicator reuse them as-is.
- Verified: `apps/tickets/models.py` **lines 8–23** (`Category`) and
  `apps/tickets/admin.py` **lines 15–23** (`CategoryAdmin`, "de facto
  category-management UI") are the shape this story's own `Category` copies
  — a second, app-scoped `Category` model in `apps.knowledge_base`, not a
  shared cross-app one. `apps/tickets/views.py` **lines 24–44**
  (`CategoryViewSet`, reusing `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`) is
  the permission-reuse precedent this story's own `CategoryViewSet` follows
  for `knowledge_base.*`.
- Verified: `frontend/src/features/tickets/api/{getCategories,useCategories}.ts`
  and `frontend/src/features/tickets/types/category.ts` are the exact
  category-picker shape task 11 copies (`page_size: 100`, `ordering: 'name'`,
  a plain `Category` type, no search-as-you-type).
- Verified: `frontend/src/features/tickets/components/TicketFormPage.tsx`
  **lines 28–31, 43–44, 53, 62, 72, 146–150, 172–180** — the `CATEGORY_NONE`
  sentinel pattern (Radix `Select.Item` cannot take an empty `value`) this
  story's `ArticleFormPage` copies verbatim for its own optional `category`.

---

## Story Goal

Ship `Article`: a second knowledge-base resource with its own category,
a draft/published lifecycle, and genuinely bilingual Markdown content —
reusing `FAQ`'s admin/display route-tree split (`CONVENTIONS.md` §23) but
extending it with a per-article detail page, since an article (unlike an
FAQ) is too long to read as one whole-list page.

1. An `Article` model — `title_en`/`title_ar`, `body_en`/`body_ar`
   (Markdown source), an optional `category` (a new, app-scoped `Category`
   model), and a `status` (`draft`/`published`) — with DRR CRUD through
   `BaseModelViewSet`, reusing the existing `knowledge_base.view`/
   `knowledge_base.manage` permissions.
2. A **reader** (`ArticleBrowsePage` at `/knowledge-base/articles`,
   `ArticleReaderPage` at `/knowledge-base/articles/:id`) showing only
   **published** articles to a `knowledge_base.view`-only caller — the
   "outcome: publish/read guides" half of read.
3. An **editor** (`ArticleListPage` at `/knowledge-base/articles/manage`,
   `ArticleFormPage` at `/knowledge-base/articles/manage/new` and
   `/manage/:id/edit`) — a `DataTable`-based admin surface, gated
   `knowledge_base.manage`, seeing every status. A Markdown Write/Preview
   toggle (`Tabs` + `react-markdown`) for each language's body — the
   "outcome: publish/read guides" half of write.
4. Nav entries: `/knowledge-base/articles` reachable from a new
   `RootLayout` link and from `FaqBrowsePage`, so the two knowledge-base
   resources cross-link.

### Why a genuine detail page here, unlike `FAQ`'s single browse screen

`CONVENTIONS.md` §23's own addendum (from Story 39) frames the choice as
"is a table/whole-list read the right shape for this resource." An FAQ's
whole content is a two-line Q&A — reading the whole list at once is the
natural shape. An article is long-form Markdown; showing every article's
full body on one scrolling page is not "browse," it is an unusable wall of
text. So the reader here is the more common **list of titles → click into
one record** shape (matching `CustomerListPage`/`CustomerProfilePage`), just
split across the same `knowledge_base.view`/`knowledge_base.manage`
permission boundary `FAQ` established rather than one shared list.

### Why `Article`/`Category` add no new permission constant

`CONVENTIONS.md` §23: *"A child resource of an existing feature reuses the
parent's permissions... Add a new constant only when the sub-resource is a
genuinely separate authorization concern."* `Article` and its `Category` are
a second and third resource in the **same** `knowledge_base` domain `FAQ`
already established — not a separate concern — so both reuse
`Permissions.KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE` exactly as
`tickets.CategoryViewSet` already reuses `Permissions.TICKETS_VIEW`/
`TICKETS_MANAGE` rather than minting `categories.view`. **This means no
grant migration is needed in this story at all** — every role that can see/
manage FAQs today can already see/manage articles the moment this story's
code ships.

### Why a permission-scoped `get_queryset`, not a second endpoint

An FAQ has no draft state, so `FaqViewSet` never needed to hide a row from
anyone who could reach `list`/`retrieve` at all. `Article` does have one, so
`ArticleViewSet.get_queryset` (task 3) returns every row to a caller holding
`knowledge_base.manage` and only `status="published"` rows to everyone else
— for **both** `list` and `retrieve`, so a view-only caller who guesses a
draft's numeric id gets a 404, not a 403 (which would confirm the draft
exists). This is the project's first queryset filter keyed on the caller's
**permission level** rather than a request parameter (contrast
`TicketViewSet.get_queryset`'s `category`/`priority`/`assigned_to_me`
filters, Story 18/22/29, which narrow the same visible set identically for
every caller).

### What `Article` holds, and what it deliberately does not

| Field | Why it is here |
|---|---|
| `title_en` / `title_ar` | Both required. An article with only one language's title is an incomplete record for a bilingual product, not a valid draft — see the note below on why this story does not track per-language completeness. |
| `body_en` / `body_ar` | Markdown source, `TextField` (no length cap, matches `QuickReply.body`). Rendered via `react-markdown`, never `dangerouslySetInnerHTML` — see task 8. |
| `category` | Optional, `SET_NULL` — a classification tag, the exact same reasoning `Ticket.category` already uses (Story 18): deleting a category must not delete or hide the articles that had it. |
| `status` | `draft` / `published`, default `draft`. A plain writable field via the normal update endpoint — **not** a dedicated `/publish/` action, unlike `Ticket.status` (which has a real transition graph and an audit log, `TicketActivity`, neither of which this story's two-value field needs). |

**Not here, and why:**

- **No per-language completeness tracking** (e.g. "English draft, Arabic
  pending"). Both language pairs are required together — an editor writes
  both before saving at all. A partial-language workflow is a real feature
  with its own rules (which language blocks publish? does the reader fall
  back?) that this story's intake does not ask for; inventing one now would
  be scope creep. If a future story needs staged bilingual authoring, this
  is the field to revisit.
- **No slug, no dedicated public URL.** Every other feature routes a detail
  page by numeric id (`/customers/:id`, `/tickets/:id`); `/knowledge-base/
  articles/:id` follows the same convention. A slug is a `PORTAL-4`/SEO
  concern for the customer-facing portal, not this agent-facing story.
- **No image/attachment upload in the body.** `body_en`/`body_ar` are text
  columns; embedding an image would need multipart upload
  (`apps/customers/models.py::Attachment`, Story 21, is the only precedent,
  and it is a separate file, not inline body content). Out of scope.
- **No full-text search, no ranking.** KB-3 owns this across FAQs and
  articles together; `search_fields` here is the same basic DRF
  `SearchFilter` substring match `FAQ` already has, not real ranking.
- **No transition graph, no publish/unpublish audit log.** `status` is a
  plain field; re-saving the same status is not rejected the way
  `Ticket.set_status`/`escalate` reject a no-op (Story 23) — there is no
  history to protect here yet.
- **No customer-portal reader.** `PORTAL-4` depends on `KB-1`/`KB-2` and
  reuses this API — out of scope, same as `FAQ`'s own boundary.

### Explicitly out of scope

- **Per-language draft/completeness tracking.**
- **Slugs, SEO-friendly URLs, image embeds.**
- **Full-text search, ranking → KB-3.**
- **Publish/unpublish audit log, status transition rules.**
- **Customer-portal reader → `PORTAL-4`.**
- **A frontend category-management screen** — `CategoryAdmin` is the de
  facto management UI, the same call `tickets.CategoryAdmin` already makes.
- **Automated tests.** Standing policy (`CONVENTIONS.md` §16).

---

## Context — Read These Files First

1. `.squad/stories/knowledge-base/SUPPORTOS-53/intake.md` — two task blocks,
   no attachments, no acceptance criteria. Done Criteria derive from the two
   **Outcome** lines ("article store" / "publish/read guides").
2. [39-story-faqs-SUPPORTOS-51.md](39-story-faqs-SUPPORTOS-51.md) in full —
   this story's `FAQ` sibling. Every backend file this story creates sits
   beside the ones that story created; every frontend file sits beside
   `FaqBrowsePage.tsx`/`FaqListPage.tsx`/`FaqFormPage.tsx`.
3. `backend/apps/knowledge_base/models.py` (current, 27 lines — `FAQ` only)
   — this story appends `Category` and `Article` below it, in the same
   file.
4. `backend/apps/knowledge_base/views.py` (current, 30 lines — `FAQViewSet`
   only) — appends `CategoryViewSet`/`ArticleViewSet`.
5. `backend/apps/knowledge_base/urls.py` (current, 13 lines) — one
   `SimpleRouter`; this story adds two more `router.register(...)` calls to
   the **same** router instance, not a second router.
6. `backend/apps/knowledge_base/admin.py` (current, 16 lines — `FAQAdmin`
   only) — appends `CategoryAdmin`/`ArticleAdmin`.
7. `backend/apps/core/permissions.py` **lines 26–34** — confirm
   `KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE` already exist; **no edit to
   this file in this story**.
8. `backend/apps/tickets/models.py` **lines 8–23** (`Category`) and
   `apps/tickets/serializers.py` **lines 8–11** (`CategorySerializer`) — the
   exact shape this story's own `Category`/`CategorySerializer` copy.
9. `backend/apps/tickets/views.py` **lines 24–44** (`CategoryViewSet`) — the
   permission-reuse precedent (`Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`
   on a sub-resource), copied here as `Permissions.KNOWLEDGE_BASE_VIEW`/
   `KNOWLEDGE_BASE_MANAGE`.
10. `backend/apps/tickets/admin.py` **lines 15–23** (`CategoryAdmin`) — "also
    the de facto category-management UI" docstring, copied verbatim in
    spirit for this story's own `CategoryAdmin`.
11. `backend/apps/agents/admin.py` **lines 6–17** (`TaskAdmin`) — the
    "read-only ops visibility" shape this story's `ArticleAdmin` follows
    (a real frontend editor exists), contrasted with `CategoryAdmin` above
    (no frontend CRUD, so it stays the de facto UI).
12. `backend/apps/tickets/models.py` **lines 59–72** (`Ticket.category`,
    `SET_NULL`) — the exact FK shape `Article.category` copies.
13. `frontend/src/features/knowledge-base/types/faq.ts`,
    `api/{faqKeys,getFaqs,getFaq,createFaq,updateFaq,deleteFaq,useFaqs,useFaq,
    useFaqMutations}.ts`, `components/{FaqBrowsePage,FaqListPage,FaqFormPage}.tsx`
    — every new frontend file in this story is a near-verbatim structural
    copy of one of these, with `Article`/`article` substituted for
    `Faq`/`faq`.
14. `frontend/src/features/tickets/types/category.ts`,
    `api/{getCategories,useCategories}.ts` — the category-picker shape task
    11 copies (`page_size: 100`, `ordering: 'name'`).
15. `frontend/src/features/tickets/components/TicketFormPage.tsx`
    **lines 28–31, 43–44, 53, 62, 72, 146–150, 172–180** — the
    `CATEGORY_NONE` sentinel, copied verbatim.
16. `frontend/src/features/tickets/types/ticket.ts` **lines 1–6**
    (`TICKET_STATUSES`/`TICKET_PRIORITIES` `as const` arrays) — the pattern
    `ARTICLE_STATUSES` follows (`CONVENTIONS.md` §3, `erasableSyntaxOnly`
    forbids `enum`).
17. `frontend/src/shared/ui/primitives/tabs.tsx` (all 84 lines) — `Tabs`/
    `TabsList`/`TabsTrigger`/`TabsContent`, the Write/Preview toggle's
    building blocks.
18. `frontend/src/shared/ui/primitives/badge.tsx` (all 47 lines) — `Badge`,
    the draft-status indicator on the manage table and the reader page.
19. `frontend/src/shared/ui/form/index.ts` (all 9 lines) — confirm
    `TextField`/`TextareaField`/`SelectField`/`FormErrorSummary`/
    `useAppForm` barrel exports; no new shared field component is added.
20. `frontend/src/app/router.tsx` (current, 207 lines) — the existing
    `knowledge_base.view` block (lines 130–142) and `knowledge_base.manage`
    block (lines 143–171). Task 13 **reorders these two blocks** (manage
    block first) and adds this story's routes to each — see
    `## Backend Tasks`/`## Frontend Tasks` task 13 for why.
21. `frontend/src/app/RootLayout.tsx` (current, 65 lines) — the
    `knowledge_base.view`-gated nav link (lines 38–42). Task 13 adds a
    second link beside it.
22. `frontend/src/shared/i18n/resources.ts` (current, 67 lines) — the
    `knowledgeBase` namespace already registered (lines 7–8, 48, 62); task
    12 only edits the feature's own `locales/{en,ar}.json`, not this file
    again.
23. `frontend/package.json` (current, 47 lines) — task 8 adds
    `react-markdown` (`^10.1.0`) to `dependencies` and
    `@tailwindcss/typography` (`^0.5.20`) to `devDependencies` (a build-time
    Tailwind plugin, not a runtime import).
24. `frontend/src/index.css` **lines 1–2** (`@import 'tailwindcss'`,
    `@import 'tw-animate-css'`) — task 8 adds one `@plugin` line for
    `@tailwindcss/typography` (Tailwind v4's CSS-first plugin registration,
    not a `tailwind.config.js` — none exists, per `CONVENTIONS.md` §19).
25. `CONVENTIONS.md` §16, §19, §20, and all of §23 (especially the FAQ
    addendum this story's own two new addenda sit beside) — the template
    every task below follows.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`Article` model + API, rich-text, category, status, bilingual.** | Intake, task 1 | `Article` (task 1), `Category` (task 1), `ArticleViewSet`/`CategoryViewSet` (task 3). Rich text = Markdown source + `react-markdown` rendering (confirmed direction). |
| **Editor (admin) + reader, reusing primitives.** | Intake, task 2 | `ArticleListPage`/`ArticleFormPage` (editor) and `ArticleBrowsePage`/`ArticleReaderPage` (reader) compose `DataTable`, `useAppForm`, `Tabs`, `Badge`, `QueryBoundary` — no new shared component beyond the two new dependencies. |
| Reuse `AUTHZ` — no new permission. | `## Story Goal` | `Article`/`Category` reuse `Permissions.KNOWLEDGE_BASE_VIEW`/`KNOWLEDGE_BASE_MANAGE`. |
| Wire format is `snake_case` end to end. | §12 | `Article`/`Category` TS types mirror their serializers verbatim. |
| Config from `ENV`; dependency additions are deliberate and justified. | §17 | Two new frontend packages, both justified in `## Prerequisites` with verified registry versions; no backend dependency added. |

---

## Backend Tasks

### 1 — The `Category` and `Article` models

**File: `backend/apps/knowledge_base/models.py`** — append below `FAQ`.

```python
class Category(TimeStampedModel):
    """An article classification tag, scoped to `apps.knowledge_base` —
    deliberately a second, separate model from `apps.tickets.models.Category`
    (different domain, different app, different table). Copies that
    model's exact shape. See Story 40 `## Prerequisites`.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Article(TimeStampedModel):
    """A bilingual, Markdown-authored help article — KB-2. The first model
    in this project with genuinely translated CONTENT (not just UI chrome
    translated around a single-language value). See Story 40
    `## Story Goal`.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        PUBLISHED = "published", _("Published")

    title_en = models.CharField(_("title (English)"), max_length=200)
    title_ar = models.CharField(_("title (Arabic)"), max_length=200)
    # Markdown source, rendered client-side via react-markdown — never
    # dangerouslySetInnerHTML. No max_length: matches QuickReply.body
    # (apps/agents/models.py) — a long-form text column, deliberately
    # uncapped. See Story 40 `## Prerequisites`.
    body_en = models.TextField(_("body (English)"))
    body_ar = models.TextField(_("body (Arabic)"))
    # SET_NULL, nullable: the same classification-tag reasoning
    # `Ticket.category` already uses (Story 18) — deleting a category must
    # not delete or hide the articles that had it.
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="articles",
        verbose_name=_("category"),
    )
    status = models.CharField(
        _("status"), max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    class Meta:
        verbose_name = _("article")
        verbose_name_plural = _("articles")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title_en
```

**Both title/body pairs are required** (no `blank=True`) — a partial-language
article is not a valid record in this story's scope; see `## Story Goal`.

**File: `backend/apps/knowledge_base/admin.py`** — append.

```python
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Also the de facto category-management UI for now — this story ships
    no frontend CRUD screen for categories, the same call
    `apps.tickets.admin.CategoryAdmin` already makes. See Story 40
    `## Story Goal`.
    """

    list_display = ("name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — the same call
    `TaskAdmin`/`FAQAdmin` already make: an `Article` is authored and
    edited through the app's own `ArticleListPage`/`ArticleFormPage`, not
    through `/admin/`.
    """

    list_display = ("title_en", "category", "status", "created_at", "updated_at")
    list_filter = ("status", "category")
    search_fields = ("title_en", "title_ar", "body_en", "body_ar")
    readonly_fields = ("created_at", "updated_at")
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations knowledge_base
```

Expect one file (Django names it after the models it creates, e.g.
`apps/knowledge_base/migrations/0003_category_article.py`) containing
`CreateModel(Category)` then `CreateModel(Article)` — record the actual
generated filename. **Commit it** —
`MigrationStateTests.test_no_pending_migrations` fails the build otherwise.
**No grant migration in this story** — see `## Story Goal`.

---

### 2 — Serializers

**File: `backend/apps/knowledge_base/serializers.py`** — append. Add
`from rest_framework import serializers` to the existing import block and
`from .models import Article, Category, FAQ` (extending the existing `FAQ`
import).

```python
class CategorySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = Category
        fields = ("id", "name", "created_at", "updated_at")


class ArticleSerializer(BaseModelSerializer):
    # Same verified-safe dotted-source pattern as `TicketSerializer.category_name`
    # (Story 18) — `allow_null=True` is what makes this return `None` instead
    # of erroring when `category` is unset.
    category_name = serializers.CharField(
        source="category.name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Article
        fields = (
            "id",
            "title_en",
            "title_ar",
            "body_en",
            "body_ar",
            "category",
            "category_name",
            "status",
            "created_at",
            "updated_at",
        )
```

`status` is **not** in `read_only_fields` — unlike `Ticket.status` (written
only through `set_status`), this story's `status` is a plain writable field;
see `## Story Goal` for why no transition action exists.

---

### 3 — Viewsets and routing

**File: `backend/apps/knowledge_base/views.py`** — append. Add
`from apps.core.permissions import permissions_for` to the existing import
and extend the model/serializer imports.

```python
class CategoryViewSet(BaseModelViewSet):
    """Article-category CRUD. Reuses `knowledge_base.*` — a category is
    part of the knowledge-base domain, not a separate permission concern,
    mirroring `apps.tickets.views.CategoryViewSet`'s identical reuse of
    `tickets.*`. See Story 40 `## Story Goal`.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    permission_map = {
        "list": Permissions.KNOWLEDGE_BASE_VIEW,
        "retrieve": Permissions.KNOWLEDGE_BASE_VIEW,
        "create": Permissions.KNOWLEDGE_BASE_MANAGE,
        "update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "partial_update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "destroy": Permissions.KNOWLEDGE_BASE_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)


class ArticleViewSet(BaseModelViewSet):
    """Article CRUD, with a draft/published visibility split. See Story 40
    `## Story Goal` for why `get_queryset` branches on the caller's own
    `knowledge_base.manage` permission rather than on the action name.
    """

    queryset = Article.objects.select_related("category").all()
    serializer_class = ArticleSerializer

    permission_map = {
        "list": Permissions.KNOWLEDGE_BASE_VIEW,
        "retrieve": Permissions.KNOWLEDGE_BASE_VIEW,
        "create": Permissions.KNOWLEDGE_BASE_MANAGE,
        "update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "partial_update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "destroy": Permissions.KNOWLEDGE_BASE_MANAGE,
    }

    ordering_fields = ("title_en", "status", "created_at")
    search_fields = ("title_en", "title_ar", "body_en", "body_ar")

    def get_queryset(self):
        queryset = super().get_queryset()
        if Permissions.KNOWLEDGE_BASE_MANAGE in permissions_for(self.request.user):
            return queryset
        # A view-only caller sees only published rows on BOTH list and
        # retrieve — a draft's direct id returns 404, not 403, so its
        # existence is not confirmed to a caller who cannot manage it.
        return queryset.filter(status=Article.Status.PUBLISHED)
```

**Create file: `backend/apps/knowledge_base/urls.py`** — add two more
registrations to the **existing** router (do not create a second router):

```python
from rest_framework.routers import SimpleRouter

from .views import ArticleViewSet, CategoryViewSet, FAQViewSet

app_name = "knowledge_base"

router = SimpleRouter()
router.register("faqs", FAQViewSet, basename="faq")
router.register("articles", ArticleViewSet, basename="article")
# "article-categories", not "categories" — apps.tickets.urls already claims
# /api/categories/ on the same router-mounted prefix; a second registration
# there would shadow it. See Story 40 `## Prerequisites`.
router.register("article-categories", CategoryViewSet, basename="article-category")

urlpatterns = router.urls
```

Endpoints: `GET/POST /api/articles/`,
`GET/PUT/PATCH/DELETE /api/articles/<pk>/`,
`GET/POST /api/article-categories/`,
`GET/PUT/PATCH/DELETE /api/article-categories/<pk>/`. **No change to
`backend/config/api_urls.py`** — the existing
`path("", include("apps.knowledge_base.urls"))` line already covers these.

---

## Frontend Tasks

### 4 — Types

**Create file: `frontend/src/features/knowledge-base/types/category.ts`**

```ts
/** Mirrors `apps.knowledge_base.serializers.CategorySerializer` verbatim.
 * A second, separate `Category` from `frontend/src/features/tickets/types/category.ts`
 * — different domain, different feature folder, no import between them
 * (CONVENTIONS.md §15's no-cross-feature-deep-import rule). */
export type Category = {
  id: number
  name: string
  created_at: string
  updated_at: string
}
```

**Create file: `frontend/src/features/knowledge-base/types/article.ts`**

```ts
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
```

---

### 5 — Category API layer

**Create file: `frontend/src/features/knowledge-base/api/getCategories.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Category } from '../types/category'

// page_size: 100 (the server's max) — no search-as-you-type combobox exists
// yet, the same simplification `tickets/api/getCategories.ts` accepted.
export function getCategories(): Promise<Page<Category>> {
  return api.getPage<Category>('/article-categories/', {
    params: { page_size: 100, ordering: 'name' },
  })
}
```

**Create file: `frontend/src/features/knowledge-base/api/useCategories.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getCategories } from './getCategories'
import { articleKeys } from './articleKeys'

export function useCategories() {
  return useQuery({
    queryKey: articleKeys.resource('categories'),
    queryFn: getCategories,
  })
}
```

`articleKeys.resource('categories')`, not a separate `featureKey` — the same
choice `tickets/api/useCategories.ts` already makes (`ticketKeys.resource('categories')`):
categories exist to populate the article editor's picker, not as their own
managed screen.

---

### 6 — Article API layer and query keys

**Create file: `frontend/src/features/knowledge-base/api/articleKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const articleKeys = featureKey('articles')
```

**Create file: `frontend/src/features/knowledge-base/api/getArticles.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Article } from '../types/article'

export type ArticleListParams = ServerTableParams & { search?: string }

export function getArticles(params: ArticleListParams): Promise<Page<Article>> {
  return api.getPage<Article>('/articles/', { params })
}
```

**Create file: `frontend/src/features/knowledge-base/api/getArticle.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Article } from '../types/article'

export function getArticle(id: number): Promise<Article> {
  return api.get<Article>(`/articles/${id}/`)
}
```

**Create files: `createArticle.ts`, `updateArticle.ts`, `deleteArticle.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Article, ArticleInput } from '../types/article'

export function createArticle(input: ArticleInput): Promise<Article> {
  return api.post<Article>('/articles/', input)
}
```

```ts
import { api } from '@/shared/lib/api/client'

import type { Article, ArticleInput } from '../types/article'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateArticle(id: number, input: ArticleInput): Promise<Article> {
  return api.patch<Article>(`/articles/${id}/`, input)
}
```

```ts
import { api } from '@/shared/lib/api/client'

export function deleteArticle(id: number): Promise<void> {
  return api.delete(`/articles/${id}/`)
}
```

**Create file: `frontend/src/features/knowledge-base/api/useArticles.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getArticles } from './getArticles'
import type { ArticleListParams } from './getArticles'
import { articleKeys } from './articleKeys'

export function useArticles(params: ArticleListParams) {
  return useQuery({
    queryKey: articleKeys.resource('list', params),
    queryFn: () => getArticles(params),
  })
}
```

**Create file: `frontend/src/features/knowledge-base/api/useArticle.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getArticle } from './getArticle'
import { articleKeys } from './articleKeys'

export function useArticle(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: articleKeys.resource('detail', id),
    queryFn: () => getArticle(id),
    enabled: options?.enabled,
  })
}
```

**Create file: `frontend/src/features/knowledge-base/api/useArticleMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createArticle } from './createArticle'
import { deleteArticle } from './deleteArticle'
import { articleKeys } from './articleKeys'
import { updateArticle } from './updateArticle'
import type { ArticleInput } from '../types/article'

// Every mutation invalidates the whole `articles` key prefix — a status
// change or edit can move an article on/off the reader list and shift
// sort/page position on the manage table. CONVENTIONS.md §23.
function useInvalidateArticles() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: articleKeys.all })
}

export function useCreateArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (input: ArticleInput) => createArticle(input),
    onSuccess: invalidate,
  })
}

export function useUpdateArticle(id: number) {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (input: ArticleInput) => updateArticle(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (id: number) => deleteArticle(id),
    onSuccess: invalidate,
  })
}
```

---

### 7 — Locale namespace

**File: `frontend/src/features/knowledge-base/locales/en.json`** — add an
`articles` top-level key beside the existing `title`/`manage`/`browse` keys:

```json
{
  "articles": {
    "title": "Help articles",
    "manage": {
      "title": "Manage articles",
      "new": "New article",
      "edit": "Edit article",
      "empty": "No articles yet",
      "emptyDescription": "Create the first article to get started.",
      "fields": {
        "titleEn": "Title (English)",
        "titleAr": "Title (Arabic)",
        "bodyEn": "Body (English)",
        "bodyAr": "Body (Arabic)",
        "category": "Category",
        "noCategory": "No category",
        "status": "Status",
        "actions": "Actions"
      },
      "statuses": {
        "draft": "Draft",
        "published": "Published"
      },
      "editorTabs": {
        "write": "Write",
        "preview": "Preview",
        "previewEmpty": "Nothing to preview yet."
      },
      "actions": {
        "save": "Save",
        "delete": "Delete"
      },
      "delete": {
        "title": "Delete this article?",
        "description": "This permanently removes the article. This cannot be undone."
      },
      "created": "Article created.",
      "updated": "Article updated.",
      "deleted": "Article deleted."
    },
    "browse": {
      "empty": "No articles yet",
      "emptyDescription": "Check back later.",
      "readMore": "Read more"
    },
    "reader": {
      "backToList": "Back to help articles",
      "notFound": "That article could not be found."
    }
  }
}
```

**Update `frontend/src/features/knowledge-base/locales/ar.json`** with the
identical `articles` key set, translated. No other existing key changes.

**No edit to `frontend/src/shared/i18n/resources.ts`** — the `knowledgeBase`
namespace is already registered; this story only adds keys inside the two
existing JSON files.

---

### 8 — New dependencies: `react-markdown` and `@tailwindcss/typography`

**From `frontend/`:**

```powershell
npm install react-markdown@^10.1.0
npm install -D @tailwindcss/typography@^0.5.20
```

`react-markdown` is a runtime dependency (imported by the reader/preview
components); `@tailwindcss/typography` is a build-time Tailwind plugin, so
it goes in `devDependencies` — the same split `tailwindcss`/`@tailwindcss/vite`
already have relative to `tw-animate-css`. Record the exact resolved
versions `package-lock.json` produces.

**File: `frontend/src/index.css`** — add one line after the existing two
`@import`s (line 2):

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@plugin '@tailwindcss/typography';
```

Tailwind v4 is CSS-first (`CONVENTIONS.md` §19) — `@plugin` is the v4
registration mechanism; there is no `tailwind.config.js` to add a `plugins:
[]` entry to, and creating one would be a second source of truth.

**Create file: `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx`**

```tsx
import Markdown from 'react-markdown'

/**
 * The one place `react-markdown` is imported. No `rehype-raw` / no
 * `dangerouslySetInnerHTML` — react-markdown does not execute embedded HTML
 * by default, which is what makes user-authored Markdown safe to render
 * with zero extra sanitization. `prose`/`prose-invert` (from
 * `@tailwindcss/typography`) style the output; `dir="auto"` lets the
 * browser pick per-paragraph direction for mixed English/Arabic content.
 */
export function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none" dir="auto">
      <Markdown>{children}</Markdown>
    </div>
  )
}
```

---

### 9 — The editor's Write/Preview field

**Create file: `frontend/src/features/knowledge-base/components/MarkdownField.tsx`**

Local to this feature (`CONVENTIONS.md` §8 — one consumer today; promote to
`shared/ui/form/` only if a second feature needs it):

```tsx
import { useTranslation } from 'react-i18next'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { useWatch } from 'react-hook-form'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs'
import { TextareaField } from '@/shared/ui/form'

import { MarkdownPreview } from './MarkdownPreview'

export function MarkdownField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<TFieldValues>
  name: Path<TFieldValues>
  label: string
}) {
  const { t } = useTranslation('knowledgeBase')
  const value = useWatch({ control, name }) as string

  return (
    <Tabs defaultValue="write">
      <TabsList>
        <TabsTrigger value="write">{t('articles.manage.editorTabs.write')}</TabsTrigger>
        <TabsTrigger value="preview">{t('articles.manage.editorTabs.preview')}</TabsTrigger>
      </TabsList>
      <TabsContent value="write">
        <TextareaField control={control} name={name} label={label} />
      </TabsContent>
      <TabsContent value="preview">
        {value ? (
          <MarkdownPreview>{value}</MarkdownPreview>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('articles.manage.editorTabs.previewEmpty')}
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
```

---

### 10 — The editor screens

**Create file: `frontend/src/features/knowledge-base/components/ArticleListPage.tsx`**

Composition, following `FaqListPage.tsx` exactly: `useServerTable({
initialSort: { field: 'created_at', direction: 'desc' } })`, `useArticles(params)`,
`useConfirm()` + `useDeleteArticle()`. Columns:

| `id` | header | sortable | notes |
|---|---|---|---|
| `title_en` | `t('articles:manage.fields.titleEn')` | yes | `cell` renders `<Link to={\`/knowledge-base/articles/manage/${row.id}/edit\`}>{row.title_en}</Link>` |
| `category_name` | `t('articles:manage.fields.category')` | no | `row.category_name ?? '—'` — not sortable, same reasoning `TicketViewSet`'s `category_name` column uses |
| `status` | `t('articles:manage.fields.status')` | yes | `<Badge variant={row.status === 'published' ? 'default' : 'secondary'}>{t(\`articles:manage.statuses.${row.status}\`)}</Badge>` |
| `created_at` | `t('articles:manage.fields.actions')`… | yes | `useFormatters().date(row.created_at)` |
| `actions` | `t('articles:manage.fields.actions')` | no | Delete button through `useConfirm()`, same shape as `FaqListPage` |

`caption={t('articles:manage.title')}`; `empty` prop with
`articles:manage.empty`/`emptyDescription`; a **New article** button to
`/knowledge-base/articles/manage/new`; a back link to
`/knowledge-base/articles`.

**Create file: `frontend/src/features/knowledge-base/components/ArticleFormPage.tsx`**

One component for both create and edit, following `TicketFormPage.tsx`'s
category-select shape and `FaqFormPage.tsx`'s create/edit split:

```tsx
const CATEGORY_NONE = 'none'

const schema = z.object({
  title_en: requiredString(200),
  title_ar: requiredString(200),
  body_en: requiredString(20000),
  body_ar: requiredString(20000),
  category: z.string(),
  status: choice(ARTICLE_STATUSES),
})
```

- `defaultValues`: `{ title_en: '', title_ar: '', body_en: '', body_ar: '',
  category: CATEGORY_NONE, status: 'draft' }` for create; from `useArticle(id)`
  for edit (`category: article.category === null ? CATEGORY_NONE :
  String(article.category)`).
- `toArticleInput`: `category: values.category === CATEGORY_NONE ? null :
  Number(values.category)`, mirroring `TicketFormPage.toTicketInput` exactly.
- Layout: an **English content** `Card` (`TextField` for `title_en`,
  `MarkdownField` for `body_en`) and an **Arabic content** `Card`
  (`TextField` for `title_ar`, `MarkdownField` for `body_ar`), then a
  `SelectField` for `category` (options prefixed with
  `{ value: CATEGORY_NONE, label: t('articles:manage.fields.noCategory') }`,
  from `useCategories()`) and a `SelectField` for `status`
  (`ARTICLE_STATUSES.map((value) => ({ value, label:
  t(\`articles:manage.statuses.${value}\`) }))`).
- Submit → `useCreateArticle()`/`useUpdateArticle(id)`; `onError` →
  `isValidationError` → `applyServerErrors`; `onSuccess` → toast
  `articles:manage.created`/`updated` → `navigate('/knowledge-base/articles/manage')`.

---

### 11 — The reader screens

**Create file: `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx`**

Following `FaqBrowsePage.tsx`'s shape: `useArticles({ page: 1, page_size: 100,
ordering: '-created_at' })` inside `QueryBoundary`, rendered as a list of
`Card`s — but each card shows only the **title in the current UI language**
plus category/status, linking to the detail page (not the full body inline,
unlike `FaqBrowsePage`, because an article's body is too long to browse in a
list — see `## Story Goal`):

```tsx
const { i18n, t } = useTranslation('knowledgeBase')
const isArabic = i18n.language.startsWith('ar')
// ...
{data.items.map((article) => (
  <Card key={article.id}>
    <CardHeader>
      <CardTitle>
        <Link to={`/knowledge-base/articles/${article.id}`}>
          {isArabic ? article.title_ar : article.title_en}
        </Link>
      </CardTitle>
      {article.category_name ? (
        <Badge variant="secondary">{article.category_name}</Badge>
      ) : null}
      {article.status !== 'published' ? (
        <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
      ) : null}
    </CardHeader>
  </Card>
))}
```

**A manager previewing this list also sees drafts** (`ArticleViewSet.get_queryset`
returns every row to anyone holding `knowledge_base.manage`, and every seeded
role holds both permissions) — the `Badge` above is what makes an unpublished
row visually distinct rather than indistinguishable from a published one.
See `## Edge Cases`.

**Create file: `frontend/src/features/knowledge-base/components/ArticleReaderPage.tsx`**

```tsx
export function ArticleReaderPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')

  if (Number.isNaN(id)) {
    return <Empty title={t('articles.reader.notFound')} />
  }

  const query = useArticle(id)

  return (
    <QueryBoundary query={query}>
      {(article) => (
        <div className="flex flex-col gap-4">
          <Link to="/knowledge-base/articles">{t('articles.reader.backToList')}</Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {isArabic ? article.title_ar : article.title_en}
            </h1>
            {article.status !== 'published' ? (
              <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
            ) : null}
          </div>
          <MarkdownPreview>{isArabic ? article.body_ar : article.body_en}</MarkdownPreview>
        </div>
      )}
    </QueryBoundary>
  )
}
```

**Guard `Number.isNaN` before firing the query** — the same rule
`CustomerProfilePage` established (Story 10) — a hand-typed or stale URL
must not request `/articles/NaN/`.

---

### 12 — Locale additions

Covered in task 7 — no separate step; listed here only so the task numbering
matches `## Done Criteria`'s references.

---

### 13 — Routes and navigation

**File: `frontend/src/app/router.tsx`** — **reorder** the existing two
`knowledge_base.*` blocks (`knowledge_base.manage` first, `knowledge_base.view`
second) and add this story's routes to each. This mirrors every prior
`.../new` before `.../:id` precedent in this same file
(`customers/new`, `tickets/new`, `tasks/new`) — `knowledge-base/articles/manage`
must be checked before `knowledge-base/articles/:id`, or a literal `manage`
would be read as the `:id` param.

```tsx
          {
            element: <RequirePermission permission="knowledge_base.manage" />,
            children: [
              {
                path: 'knowledge-base/manage',
                lazy: async () => {
                  const { FaqListPage } =
                    await import('@/features/knowledge-base/components/FaqListPage')
                  return { element: <FaqListPage /> }
                },
              },
              {
                path: 'knowledge-base/manage/new',
                lazy: async () => {
                  const { FaqFormPage } =
                    await import('@/features/knowledge-base/components/FaqFormPage')
                  return { element: <FaqFormPage /> }
                },
              },
              {
                path: 'knowledge-base/manage/:id/edit',
                lazy: async () => {
                  const { FaqFormPage } =
                    await import('@/features/knowledge-base/components/FaqFormPage')
                  return { element: <FaqFormPage /> }
                },
              },
              {
                // Must stay before `knowledge-base/articles/:id` (in the
                // sibling knowledge_base.view block below) — see above.
                path: 'knowledge-base/articles/manage',
                lazy: async () => {
                  const { ArticleListPage } =
                    await import('@/features/knowledge-base/components/ArticleListPage')
                  return { element: <ArticleListPage /> }
                },
              },
              {
                path: 'knowledge-base/articles/manage/new',
                lazy: async () => {
                  const { ArticleFormPage } =
                    await import('@/features/knowledge-base/components/ArticleFormPage')
                  return { element: <ArticleFormPage /> }
                },
              },
              {
                path: 'knowledge-base/articles/manage/:id/edit',
                lazy: async () => {
                  const { ArticleFormPage } =
                    await import('@/features/knowledge-base/components/ArticleFormPage')
                  return { element: <ArticleFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="knowledge_base.view" />,
            children: [
              {
                path: 'knowledge-base',
                lazy: async () => {
                  const { FaqBrowsePage } =
                    await import('@/features/knowledge-base/components/FaqBrowsePage')
                  return { element: <FaqBrowsePage /> }
                },
              },
              {
                path: 'knowledge-base/articles',
                lazy: async () => {
                  const { ArticleBrowsePage } =
                    await import('@/features/knowledge-base/components/ArticleBrowsePage')
                  return { element: <ArticleBrowsePage /> }
                },
              },
              {
                path: 'knowledge-base/articles/:id',
                lazy: async () => {
                  const { ArticleReaderPage } =
                    await import('@/features/knowledge-base/components/ArticleReaderPage')
                  return { element: <ArticleReaderPage /> }
                },
              },
            ],
          },
```

**File: `frontend/src/app/RootLayout.tsx`** — add a second
`knowledge_base.view`-gated link beside the existing one (after line 42):

```tsx
            <Can permission="knowledge_base.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/knowledge-base/articles">{t('knowledgeBase:articles.title')}</Link>
              </Button>
            </Can>
```

**File: `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx`**
— add a cross-link to the article list beside the existing "Manage FAQs"
button, so the two knowledge-base resources are reachable from each other:

```tsx
<Button asChild variant="ghost" size="sm">
  <Link to="/knowledge-base/articles">{t('articles.title')}</Link>
</Button>
```

---

## Documentation Tasks

### 14 — Conventions addenda

**File: `CONVENTIONS.md`** — append two paragraphs to the end of §23 (after
the FAQ addendum Story 39 added):

> **A resource with its own draft/published split filters `get_queryset` by
> whether the caller holds the resource's `manage` permission, not by action
> name.** `ArticleViewSet.get_queryset` (Story 40, `KB-2`) returns every row
> when the caller holds `knowledge_base.manage`, and only `status="published"`
> rows otherwise — for `list` **and** `retrieve` alike, so a view-only
> caller gets a 404, not a 403, on a draft's direct id (its existence is not
> confirmed to someone who cannot manage it). Contrast `TicketViewSet.get_queryset`'s
> `category`/`priority`/`assigned_to_me` filters (Story 18/22/29), which
> narrow the same visible set identically for every caller — this is the
> project's first queryset filter keyed on the caller's permission level
> rather than a request parameter.
>
> **A bilingual CONTENT field is returned in both languages by the API, and
> the reader picks which one to render by `i18n.language` client-side, never
> by `Accept-Language` server-side content negotiation.** `Article`
> (Story 40, `KB-2`) is the first model with genuinely translated content —
> every prior model's content is single-language, with only its surrounding
> UI chrome translated (`Customer.name` is never translated). Returning
> both `title_en`/`title_ar` and `body_en`/`body_ar` together means an
> editor sees and edits both language sections on one screen regardless of
> their own UI language, and a reader's language switch re-renders instantly
> with no refetch.

---

## Edge Cases & Failure Modes

- **A manager sees drafts on the "public" reader screens.** Every seeded
  role holds both `knowledge_base.view` and `knowledge_base.manage`
  together (Story 39's grant), so `ArticleViewSet.get_queryset`'s elevation
  applies regardless of which screen a manager is on — `ArticleBrowsePage`/
  `ArticleReaderPage` can show a draft to them too. The draft `Badge` (task
  11) is what keeps this from being mistaken for a published article.
  Accepted, not a bug: a role that should never preview drafts does not
  exist yet in this project's role set.
- **Both bilingual pairs are required together — there is no way to save an
  English-only draft.** `title_en`/`title_ar`/`body_en`/`body_ar` are all
  non-`blank` on the model and `requiredString(...)` on the frontend
  schema; an editor who has only written the English half cannot save at
  all. Documented in `## Story Goal` as a deliberate simplification, not an
  oversight.
- **`react-markdown` renders no raw HTML by default.** A `<script>` tag or
  any inline HTML typed into `body_en`/`body_ar` is escaped as literal text
  in the rendered output, not executed — verified by `react-markdown`'s own
  documented default behaviour (no `rehype-raw` plugin is installed). This
  is what makes storing untrusted Markdown safe with zero extra
  sanitisation; installing `rehype-raw` in a future story would reopen this
  and require a sanitizer (e.g. `DOMPurify`) alongside it.
- **`ArticleViewSet.ordering_fields` does not include `category_name`.**
  `?ordering=category_name` is silently ignored — `OrderingFilter` has no
  `category__name` mapping declared, the same limitation
  `TicketViewSet.category_name` already has (Story 18). The manage table's
  `category_name` column is deliberately not `sortable`.
- **`article-categories`, not `categories`, is the URL segment.** Both this
  app's router and `apps.tickets.urls`'s router mount at the same
  `path("")` prefix in `config/api_urls.py`; registering `"categories"` a
  second time would shadow `apps.tickets`'s existing `/api/categories/`
  route (whichever `include()` line runs first wins the collision). Task 3
  avoids this entirely by choosing a different segment.
- **A category deleted while articles reference it does not delete or hide
  those articles.** `Article.category` is `SET_NULL` — the same verified
  behaviour `Ticket.category` already has (Story 18); no `ProtectedError`
  handling is needed because this is not a `PROTECT` relation.
- **`Number.isNaN` guard on `ArticleReaderPage`.** A hand-typed or stale
  `/knowledge-base/articles/abc` must render "not found" locally, not fire
  `GET /api/articles/NaN/` — the same rule `CustomerProfilePage` established
  (Story 10).
- **`knowledge-base/articles/manage` must be declared before
  `knowledge-base/articles/:id`.** These are now in two different
  `RequirePermission` blocks (`knowledge_base.manage` vs `knowledge_base.view`)
  rather than siblings in one block like `customers/new` vs `customers/:id`
  — task 13 orders the **whole manage block** before the **whole view
  block** in `router.tsx`'s top-level children array for exactly this
  reason.
- **A duplicate category name is a field error, not a 500.**
  `Category.name` is `unique=True`; `ModelSerializer` derives a
  `UniqueValidator` automatically (this field is not explicitly redeclared
  on `CategorySerializer`, unlike `CustomerSerializer.email`'s Story-10 trap
  — the auto-derivation applies cleanly here).
- **`delete` returns 204 with an empty body** for both `Article` and
  `Category` — the same already-verified `EnvelopeJSONRenderer`/`api.delete`
  behaviour every prior feature relies on.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No
test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing
   backend test suite must still pass with no change in count.
   `MigrationStateTests.test_no_pending_migrations` catches a model shipped
   without its migration.
2. `ruff format --check .` / `ruff check .` over the new Python.
3. `npm run build` — typechecks `Article`/`ArticleInput`/`Category`, every
   `ColumnDef<Article>`, the `useAppForm<typeof schema>` instantiation, the
   new `react-markdown` import, and every new `t('knowledgeBase:articles…')`
   key through `CustomTypeOptions`.
4. `npm run lint` (`react/jsx-no-literals` over the six new components),
   `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison for the extended `knowledgeBase`
   namespace (Verification Step 4).
6. Real HTTP + Django-shell permission checks across the seeded roles, plus
   a real browser walkthrough in both languages (Verification Steps 5–11).

---

## Migration / Rollback

**One migration, additive.** `knowledge_base/000N_category_article` (task 1)
creates two tables. **No grant migration, no existing-table schema change,
no data migration.**

**Rollback of the code:** revert the commits. `npm uninstall react-markdown
@tailwindcss/typography` and remove the `@plugin` line from `index.css` if
the two new dependencies are being rolled back too (independent of the
Python/model rollback below).

**Rollback of the schema:**

```powershell
python manage.py migrate knowledge_base <the FAQ migration's number>
```

(i.e. back to `0002_grant_knowledge_base_permissions`, the last migration
before this story's). Clean — nothing outside `apps.knowledge_base`
references `Category`/`Article`.

**Half-applied states to avoid:**

- **Task 3's viewsets/urls before task 1's migration is applied** → every
  `Article`/`Category` endpoint 500s on a missing table. Ship together, in
  migration-then-code order like every prior story.
- **Task 13's routes before tasks 9–11's components exist** → the lazy
  imports resolve to modules that do not exist; the build fails on the
  import, not the route.
- **Task 8's `@plugin` line without the package installed** (or vice versa)
  → `npm run build`'s Tailwind step fails to resolve the plugin, or the
  `prose` classes render unstyled. Install and register together.
- **Task 7's locale keys before task 10/11's components** → every
  `t('knowledgeBase:articles…')` key fails `tsc -b`.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py
   check`, `ruff format --check .`, `ruff check .`.
2. **Migration applies forward, no reset:** `python manage.py migrate`;
   `python manage.py showmigrations knowledge_base` shows the new migration
   applied alongside `0001`/`0002`.
3. **No permission drift:** `python manage.py shell -c "from apps.accounts.models
   import Role; [print(r.slug, sorted(r.permissions)) for r in Role.objects.all()]"`
   — every role's permission list is **byte-for-byte identical** to before
   this story (no new grant ran).
4. **`en`/`ar` key sets match** for the extended `knowledgeBase` namespace —
   the same node-script check Story 39's Verification Step 4 uses.
5. **Backend regression:** `python manage.py test` reports the same passing
   count as before this story.
6. **Draft visibility, by permission.** Using a Django-shell `APIClient`
   (`override_settings(ALLOWED_HOSTS=["*"])`, `force_authenticate`) or real
   HTTP with the seeded `agent@supportos.local`/`mgr@supportos.local`
   accounts:
   - Create one `draft` and one `published` article.
   - A caller holding `knowledge_base.manage` (every seeded role today):
     `GET /api/articles/` returns both; `GET /api/articles/<draft-id>/`
     returns 200.
   - Temporarily strip `knowledge_base.manage` from one role (keep
     `knowledge_base.view`): `GET /api/articles/` returns only the
     published one; `GET /api/articles/<draft-id>/` returns **404**, not
     403. Restore the permission afterward.
7. **CRUD + validation.** `POST /api/articles/` with all six fields → 201;
   `PATCH` changing `status` from `draft` to `published` → 200 and the row
   now appears for a view-only caller; `POST` with `title_ar` omitted →
   `validation_error` with `fields: {"title_ar": [...]}`, not a 500;
   `DELETE` → 204.
8. **Category CRUD and the URL-collision check.** `POST /api/article-categories/`
   → 201; confirm `GET /api/categories/` (tickets) and
   `GET /api/article-categories/` (this story) return **independent** sets
   — creating one does not appear in the other.
9. **The editor walkthrough.** `npm run dev` with the backend up, signed in
   as `agent@`: `/knowledge-base/articles/manage` lists articles with a
   status badge; "New article" opens the form; typing Markdown into the
   English body and switching to the "Preview" tab renders it (headings,
   bold, lists) with no raw `#`/`**` visible; saving as `draft` then editing
   to `published` moves the row's badge; delete asks for confirmation via
   `useConfirm()`.
10. **The reader walkthrough.** `/knowledge-base/articles` lists only
    published articles for a view-only account; opening one shows the
    rendered Markdown body in the current UI language; switching the app
    language re-renders the same article in the other language with no
    network refetch (confirm via the browser's network panel — no new
    request fires on a pure language switch).
11. **Both languages, RTL included.** Switch to Arabic on every new screen:
    UI chrome is translated, `dir="rtl"` on the page, and the Markdown
    preview's `dir="auto"` still lets an embedded English code block or
    link render left-to-right within the Arabic body.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`,
    `npm run format:check`, `npm run check:rtl`, `npm run build`. All four
    exit 0.

---

## Done Criteria

- [ ] `knowledge_base.Category` mirrors `tickets.Category`'s shape exactly
      (`name`, unique, `Meta.ordering = ("name",)`).
- [ ] `knowledge_base.Article` has `title_en`/`title_ar`/`body_en`/`body_ar`
      (all required), `category` (`SET_NULL`, nullable), `status`
      (`draft`/`published`, default `draft`), `Meta.ordering = ("-created_at",)`.
- [ ] **No new permission constant, no new grant migration** —
      `Article`/`Category` reuse `Permissions.KNOWLEDGE_BASE_VIEW`/
      `KNOWLEDGE_BASE_MANAGE`; every role's permission list is unchanged by
      this story (Verification Step 3).
- [ ] One migration committed creating both tables; no pending migrations.
- [ ] `ArticleSerializer`/`CategorySerializer` extend `BaseModelSerializer`
      with `class Meta(BaseModelSerializer.Meta)`; `status` is **writable**
      (not in `read_only_fields`).
- [ ] `ArticleViewSet`/`CategoryViewSet` extend `BaseModelViewSet` with all
      six actions mapped; `ArticleViewSet.get_queryset` filters to
      `status=published` for any caller lacking `knowledge_base.manage`, on
      both `list` and `retrieve`.
- [ ] `apps/knowledge_base/urls.py`'s single `SimpleRouter` registers
      `"faqs"`, `"articles"`, and `"article-categories"` (**not**
      `"categories"` — collision-checked against `apps.tickets.urls`,
      Verification Step 8).
- [ ] `features/knowledge-base/` gains `types/{article,category}.ts`,
      `api/` (`articleKeys`, five `Article` call modules, `useArticles`,
      `useArticle`, `useArticleMutations`, `getCategories`, `useCategories`),
      `components/` (`ArticleListPage`, `ArticleFormPage`,
      `ArticleBrowsePage`, `ArticleReaderPage`, `MarkdownField`,
      `MarkdownPreview`), and an extended `articles` key in
      `locales/{en,ar}.json`.
- [ ] `react-markdown` (`dependencies`) and `@tailwindcss/typography`
      (`devDependencies`) installed; `index.css` gains one `@plugin` line;
      `MarkdownPreview.tsx` is the **only** file importing `react-markdown`.
- [ ] No `dangerouslySetInnerHTML`, no `rehype-raw`, anywhere in the new
      code.
- [ ] Edits use `api.patch`; every mutation invalidates `articleKeys.all`.
- [ ] The editor uses `DataTable` + `useServerTable` (list) and
      `useAppForm` + `MarkdownField` (form); the reader uses `QueryBoundary`
      and `MarkdownPreview`, never a table.
- [ ] Routes: `knowledge-base/articles/manage(/new|/:id/edit)` gated
      `knowledge_base.manage` and declared **before**
      `knowledge-base/articles`/`knowledge-base/articles/:id` (gated
      `knowledge_base.view`) in `router.tsx`'s children array.
- [ ] `RootLayout` gains a second `knowledge_base.view`-gated nav link;
      `FaqBrowsePage` gains a cross-link to `/knowledge-base/articles`.
- [ ] Verified: draft visibility differs by permission exactly per
      Verification Step 6, including the 404-not-403 detail on a draft.
- [ ] Verified: a duplicate category name is a field error (Verification
      Step 8-adjacent check); an incomplete bilingual submission is a field
      error, not a 500 (Step 7).
- [ ] Both languages walk through cleanly on all four new screens, RTL
      included, and a language switch re-renders the reader with no
      network refetch (Step 10).
- [ ] `CONVENTIONS.md` §23 gains both new addenda (permission-scoped
      `get_queryset`; bilingual content selection by `i18n.language`).
- [ ] `python manage.py test` count unchanged; `ruff format --check .`,
      `ruff check .`, `npm run lint`, `npm run format:check`,
      `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/knowledge-base/00-overview.md` updated with this
      story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding
to Story 41 (KB-3, Knowledge Base Search), which depends on both this story
and Story 39 — full-text search across `FAQ.question`/`answer` and
`Article.title_en`/`title_ar`/`body_en`/`body_ar` together, replacing both
features' current basic `SearchFilter` substring match with Postgres
full-text ranking.**
