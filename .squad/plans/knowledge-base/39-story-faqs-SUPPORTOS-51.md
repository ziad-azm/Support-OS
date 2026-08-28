# Story 39 — FAQs (Story: SUPPORTOS-51)

## Prerequisites

- **EPIC 0–8 complete.** This is EPIC 9's first story — the first consumer of
  `BaseModelViewSet` / `DataTable` / `useAppForm` / `can()`/`<Can>` in the
  `knowledge_base` app, following the template `CONVENTIONS.md` §23 already
  established (worked example:
  [../customer-management/10-story-customer-profiles-SUPPORTOS-28.md](../customer-management/10-story-customer-profiles-SUPPORTOS-28.md)).
  The closest-shaped precedent is Story 32
  ([../agent-workspace/32-story-tasks-reminders-SUPPORTOS-47.md](../agent-workspace/32-story-tasks-reminders-SUPPORTOS-47.md))
  — a single-model feature with its own list/form screens and a fresh
  permission pair, not a child resource reusing another domain's permissions.
- Verified backend baseline: `apps/knowledge_base/` is untouched `startapp`
  scaffolding — `models.py` and `views.py` both contain only `# Create your
  ... here.`, `admin.py` contains only `# Register your models here.`, and
  `migrations/` holds only `__init__.py`. `apps.knowledge_base` is already in
  `LOCAL_APPS` (`backend/config/settings/base.py:65`, between
  `apps.notifications` and `apps.portal`) and `KnowledgeBaseConfig.name` is
  already the correct dotted `apps.knowledge_base` (`backend/apps/knowledge_base/apps.py:6`).
- Verified: `Permissions` (`backend/apps/core/permissions.py:18-33`) holds
  `USERS_VIEW`/`USERS_MANAGE`/`ROLES_MANAGE`/`CUSTOMERS_VIEW`/
  `CUSTOMERS_MANAGE`/`TICKETS_VIEW`/`TICKETS_MANAGE` — no `knowledge_base.*`
  constant exists yet.
- Verified: `backend/config/api_urls.py` registers six `include()`s (`core`,
  `accounts`, `customers`, `tickets`, `communications`, `notifications`,
  `agents`), all above the catch-all `re_path`, which stays last.
- **Backlog scope boundary — read before adding any field.**
  `SupportOs backlog.MD` **lines 535–550** give EPIC 9's own story split:
  KB-1 (this story) is FAQs only; KB-2 adds `Article` with **category,
  status, bilingual fields**; KB-3 adds **Postgres full-text search**. None
  of those three things belong in this story's model or screens — see
  `## Story Goal` for exactly what that excludes.
- **`backend/apps/README.md` line 73** — `knowledge_base` owns "Articles,
  categories, search." This story ships only the FAQ slice of that app.

---

## Story Goal

Ship the project's first FAQ record end to end: an admin-manageable model
behind its own permission pair, and two independently-gated screens matching
the intake's two outcomes.

1. An `FAQ` model, its DRF CRUD endpoints through `BaseModelViewSet`, with
   new `knowledge_base.view` / `knowledge_base.manage` permissions enforced
   by the existing `HasPermission`.
2. A **browse screen** (`FaqBrowsePage`, `/knowledge-base`) — every FAQ,
   ordered for reading, gated on `knowledge_base.view`. This is the
   "outcome: browse FAQs" the intake names.
3. A **manage screen** (`FaqListPage` + `FaqFormPage`, under
   `/knowledge-base/manage`) — a `DataTable`-based CRUD surface gated on
   `knowledge_base.manage`. This is the "outcome: FAQ management" the intake
   names.
4. A first nav entry point (gated `knowledge_base.view`) plus a "Manage
   FAQs" link inside the browse screen (gated `knowledge_base.manage`,
   `<Can>`), so the two permission levels are independently reachable.

**Why two route trees instead of one gated list page (contrast Story 10's
`CustomerListPage`).** Every prior CRUD feature (`Customer`, `Ticket`,
`Task`) is a table an agent works from — sort, filter, open a record. An FAQ
is read whole; there is no per-record detail page to link to, and a
paginated/sortable table is the wrong shape for "read every FAQ" the way
§23's "a heterogeneous feed is a `<ul>`, not a `DataTable`" rule already
argues for a different kind of list. Splitting the two screens onto separate
URLs also lets a future story narrow `knowledge_base.view` away from
`knowledge_base.manage` independently (e.g. a future portal-scoped role) with
no route change — a single gated-button list page would still expose the
manage list's existence (an empty table) to a view-only caller.

### What `FAQ` holds, and what it deliberately does not

| Field | Why it is here |
|---|---|
| `question` | The prompt text. Required — an FAQ with no question is not one. |
| `answer` | The answer body. Required, `TextField` (no length cap), matching `QuickReply.body`'s shape (`backend/apps/agents/models.py:72`) — a template/answer's text is not a fixed-width field. |
| `order` | A plain integer the admin sets to control browse-screen position. `PositiveIntegerField(default=0)`, ties broken alphabetically by `question` (`Meta.ordering`). No drag-and-drop — a number in the edit form is the whole UI for this. |

**Not here, and why:**

- **No `category` FK.** KB-2's `Article` gets category, status, and bilingual
  fields (`SupportOs backlog.MD:542`) — none of that is pre-empted here. A
  future KB-2 or later story that wants FAQ categorisation makes that call
  explicitly.
- **No `status`/`is_published` flag.** Nothing in this story's scope creates
  a draft state — every FAQ a `knowledge_base.manage` holder creates is
  immediately visible to every `knowledge_base.view` holder. KB-2 is where a
  draft/published distinction is a real, motivated feature (long-form
  articles get written over multiple sessions); a two-line Q&A does not need
  one yet.
- **No per-locale content fields.** The backlog explicitly calls out
  "bilingual fields" as a KB-2 (`Article`) feature, not a KB-1 one — `en`ing/
  `ar`ing this record now would be scope creep into KB-2's own decision.
  `I18N` here governs the UI chrome (labels, buttons, empty states), not the
  FAQ content itself, the same split every other feature's content fields
  already make (a `Customer.name` is not translated either).
- **No full-text search, no ranking.** KB-3 (`SupportOs backlog.MD:545-550`)
  owns Postgres full-text search across FAQs **and** articles together — a
  per-feature search now would be thrown away the moment KB-3 lands. The
  browse screen requests a single `page_size=100` page instead (see
  `## Edge Cases`).
- **No customer-portal-facing screen.** `PORTAL-4` (`SupportOs
  backlog.MD:584-586`) explicitly depends on `KB-1`/`KB-2` and reuses this
  story's API — it does not ship here. Both of this story's screens are
  behind `RequireAuth` like every other feature so far.

### Explicitly out of scope

- **`Article`, categories, status, bilingual fields → KB-2.**
- **Full-text search, ranking → KB-3.**
- **Customer-portal FAQ access → `PORTAL-4`.**
- **Drag-and-drop reordering.** `order` is a plain number field.
- **Automated tests.** Standing policy (`CONVENTIONS.md` §16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/knowledge-base/SUPPORTOS-51/intake.md` — two task blocks,
   no attachments, no acceptance criteria. Done Criteria derive from the two
   **Outcome** lines ("FAQ management" / "browse FAQs") and the constraint
   lines ("reusing `AUTHZ`" / "reusing primitives/`I18N`").
2. `SupportOs backlog.MD` **lines 530–551** — all of EPIC 9. Read KB-2/KB-3
   before adding anything beyond `question`/`answer`/`order` to `FAQ`.
3. `backend/apps/core/views.py` (all 78 lines) — `BaseModelViewSet`:
   `permission_classes = [IsAuthenticated, HasPermission]`,
   `permission_map: dict[str, str] = {}`, unmapped action = authenticated-only.
4. `backend/apps/core/permissions.py` (all 102 lines) — `Permissions` (the
   seven existing constants, lines 26–32), `ALL_PERMISSIONS` (reflection over
   `vars(Permissions)`, picks up new string constants automatically),
   `HasPermission._required_permission`.
5. `backend/apps/core/serializers.py` (all 20 lines) — `BaseModelSerializer`;
   `class Meta(BaseModelSerializer.Meta)` inheritance requirement.
6. `backend/apps/core/models.py` (all 15 lines) — `TimeStampedModel`.
7. `backend/apps/tickets/models.py` **lines 8–23** (`Category`) — the
   closest existing "simple admin-manageable record" model shape: a
   `TimeStampedModel` subclass, one text field, `Meta.ordering`, `__str__`.
8. `backend/apps/tickets/migrations/0002_grant_ticket_permissions.py` (all 43
   lines) — the cross-app grant-migration pattern this story's own grant
   copies verbatim (set union, set difference, `Role.objects.filter(slug=...)`
   with a `continue` on a missing role).
9. `backend/apps/tickets/urls.py` (all 18 lines) — `SimpleRouter`, not
   `DefaultRouter`: `apps.customers.urls` already owns the auto-generated
   API-root view at `path("")`, so every later app's router must be a
   `SimpleRouter` to avoid a second, dead root view.
10. `backend/config/api_urls.py` (all 22 lines) — the `include()` list; this
    story adds one line above the catch-all `re_path`, which must stay last.
11. `backend/config/settings/base.py` **line 65** — `LOCAL_APPS` already has
    `"apps.knowledge_base"`; no settings change needed.
12. `backend/apps/agents/admin.py` **lines 6–17** (`TaskAdmin`) — the
    "read-only ops visibility, not a config UI" admin shape to copy: a
    resource with a real frontend CRUD surface gets a plain, searchable
    `ModelAdmin` (no `list_editable`), not the "de facto management UI"
    treatment `CategoryAdmin`/`QuickReplyAdmin` use for resources with no
    frontend screen.
13. `frontend/src/shared/ui/data-table/types.ts` (all 25 lines) — `ColumnDef<T>`.
14. `frontend/src/shared/ui/data-table/useServerTable.ts` (all 42 lines) —
    `ServerTableParams`, `setSort` resets page to 1.
15. `frontend/src/shared/ui/data-table/DataTable.tsx` (all 174 lines) — full
    props contract; renders its own loading/empty/error rows, so the manage
    list must **not** wrap it in `QueryBoundary`.
16. `frontend/src/shared/ui/QueryBoundary.tsx` (all 49 lines) — the browse
    screen's own boundary: `query: UseQueryResult<T>`, `isEmpty`, `children`.
17. `frontend/src/shared/ui/primitives/card.tsx` (all 82 lines) —
    `Card`/`CardHeader`/`CardTitle`/`CardContent`, the browse screen's
    building blocks (no accordion primitive exists or is needed here).
18. `frontend/src/features/tasks/` in full — the freshest single-model CRUD
    feature (post design-system refresh): `types/task.ts`,
    `api/{taskKeys,getTasks,getTask,createTask,updateTask,deleteTask,
    useTasks,useTask,useTaskMutations}.ts`,
    `components/{TaskListPage,TaskFormPage}.tsx`, `locales/en.json`. This
    story's `api/` and `types/` files are near-verbatim copies of this shape
    with `Faq`/`faq` substituted for `Task`/`task` and no `ticket`/`completed`
    filter machinery.
19. `frontend/src/shared/validation/schemas.ts` (all 72 lines) —
    `requiredString`. This story adds no new shared helper: `order`'s
    `min(0)` schema is written inline in the feature (see task 8), because no
    other feature needs a nullable-at-zero integer field yet (§8 — one
    consumer stays local).
20. `frontend/src/shared/auth/RequirePermission.tsx` (all 30 lines) — nest
    inside `RequireAuth`; a permission miss redirects to `/`, not a 403 page.
21. `frontend/src/shared/auth/Can.tsx` (all 22 lines) — the "Manage FAQs"
    link's gate.
22. `frontend/src/app/router.tsx` (all 164 lines) — the existing
    `RequirePermission`-per-feature nesting under `RequireAuth`; task 12 adds
    two more such blocks (`knowledge_base.view`, `knowledge_base.manage`).
23. `frontend/src/app/RootLayout.tsx` (all 59 lines) — the nav `<Can>` list;
    task 12 adds the first `knowledge_base.view` entry and extends the
    `useTranslation` namespace array.
24. `frontend/src/shared/i18n/resources.ts` (all 62 lines) — the explicit
    resource map; task 11 adds two imports plus one line per language,
    following the `webForm`/`liveChat` camelCase-key-for-kebab-folder pattern.
25. `CONVENTIONS.md` §16, §18, §19, §20, and all of §23 (especially the
    "backend shape of a feature" / "frontend shape of a feature" / cross-app
    grant-migration / `ordering_fields` contract paragraphs) — the template
    every task below follows.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **CRUD via base viewset / envelope / permissions.** | Intake, task 1 | `FAQViewSet(BaseModelViewSet)` with a full `permission_map`. No `permission_classes` override, no hand-built envelope. |
| **Reuse `AUTHZ`; new domain, own permissions.** | Intake, task 1 constraints | `knowledge_base.view` / `knowledge_base.manage` in `Permissions`, granted to roles by data migration — not a reuse of `tickets.*`/`customers.*`, because an FAQ is not a sub-resource of either domain. |
| **Admin + display views, reusing primitives/`I18N`.** | Intake, task 2 | `FaqListPage`/`FaqFormPage` (admin) reuse `DataTable`/`useAppForm`; `FaqBrowsePage` (display) reuses `QueryBoundary`/`Card`. No hardcoded strings — a `knowledgeBase` i18n namespace, `en`/`ar` in step. |
| Wire format is `snake_case` end to end. | §12 | `Faq` TS type mirrors the serializer verbatim. |
| Config from `ENV`; no new secrets, no new dependency. | Story 01 `ENV` contract | This story adds no environment variable and no package (no accordion primitive is installed — `Card` already covers the browse layout). |

---

## Backend Tasks

### 1 — The `FAQ` model

**File: `backend/apps/knowledge_base/models.py`** — replace the placeholder.

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class FAQ(TimeStampedModel):
    """A frequently-asked question and its answer — KB-1. Deliberately
    minimal: no category, no status, no per-locale content. `Article`
    (KB-2) gets all three; none of them are pre-empted here. See Story 39
    `## Story Goal`.
    """

    question = models.CharField(_("question"), max_length=300)
    answer = models.TextField(_("answer"))
    # Manual display order for the browse screen. Ties broken alphabetically
    # by `question` below — no drag-and-drop, a number in the edit form is
    # the whole UI for this. See Story 39 `## Story Goal`.
    order = models.PositiveIntegerField(_("order"), default=0)

    class Meta:
        verbose_name = _("FAQ")
        verbose_name_plural = _("FAQs")
        ordering = ("order", "question")

    def __str__(self) -> str:
        return self.question
```

`ordering = ("order", "question")` is what makes pagination deterministic —
the same reason `Customer.Meta.ordering = ("name",)` exists (Story 10) — and
gives a stable, predictable tiebreak when two FAQs share an `order` value.

**File: `backend/apps/knowledge_base/admin.py`** — replace the placeholder.

```python
from django.contrib import admin

from .models import FAQ


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — the same call
    `TaskAdmin` (`apps.agents`) already makes: an `FAQ` is authored and
    edited through the app's own `FaqListPage`/`FaqFormPage`, not through
    `/admin/`. See Story 39 `## Prerequisites`.
    """

    list_display = ("question", "order", "created_at", "updated_at")
    search_fields = ("question", "answer")
    readonly_fields = ("created_at", "updated_at")
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations knowledge_base
```

Expect one file, `apps/knowledge_base/migrations/0001_initial.py`. **Commit
it** — `MigrationStateTests.test_no_pending_migrations`
(`config/tests/test_settings.py`) fails the build otherwise.

---

### 2 — Permissions, serializer, viewset, routing

**File: `backend/apps/core/permissions.py`** — add two constants to
`Permissions`, after `TICKETS_MANAGE` (line 32). `ALL_PERMISSIONS` picks them
up automatically:

```python
    KNOWLEDGE_BASE_VIEW = "knowledge_base.view"
    KNOWLEDGE_BASE_MANAGE = "knowledge_base.manage"
```

**Create file: `backend/apps/knowledge_base/serializers.py`**

```python
from apps.core.serializers import BaseModelSerializer

from .models import FAQ


class FAQSerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = FAQ
        fields = ("id", "question", "answer", "order", "created_at", "updated_at")
```

No field needs an explicit declaration here — unlike `CustomerSerializer.email`
(Story 10), nothing on `FAQ` is nullable or unique, so `ModelSerializer`'s
defaults (`required=True` for `question`/`answer`/`order`, since none of the
three is `blank=True`/`null=True`) are already correct.

**Create file: `backend/apps/knowledge_base/views.py`** — replacing the placeholder.

```python
from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import FAQ
from .serializers import FAQSerializer


class FAQViewSet(BaseModelViewSet):
    """FAQ CRUD — the first consumer of `BaseModelViewSet` in
    `apps.knowledge_base`. Every action is mapped: an unmapped action would
    fall through to authenticated-only, which for a write endpoint is not
    what we want. See CONVENTIONS.md §22.
    """

    queryset = FAQ.objects.all()
    serializer_class = FAQSerializer

    permission_map = {
        "list": Permissions.KNOWLEDGE_BASE_VIEW,
        "retrieve": Permissions.KNOWLEDGE_BASE_VIEW,
        "create": Permissions.KNOWLEDGE_BASE_MANAGE,
        "update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "partial_update": Permissions.KNOWLEDGE_BASE_MANAGE,
        "destroy": Permissions.KNOWLEDGE_BASE_MANAGE,
    }

    # Matches `ColumnDef.id` on the manage screen, exactly like every prior
    # feature's `ordering_fields` contract (CONVENTIONS.md §23).
    ordering_fields = ("order", "question", "created_at")
    search_fields = ("question", "answer")
```

**All six actions are mapped deliberately** — the same reason `CustomerViewSet`
maps all six (Story 10): an omitted `destroy` would let any signed-in user
delete an FAQ.

**Create file: `backend/apps/knowledge_base/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import FAQViewSet

app_name = "knowledge_base"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). See Story 12 `## Prerequisites`
# and this story's own `## Context` item 9.
router = SimpleRouter()
router.register("faqs", FAQViewSet, basename="faq")

urlpatterns = router.urls
```

**File: `backend/config/api_urls.py`** — one `include()`, above the catch-all,
added after the existing `apps.agents.urls` line:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.agents.urls")),
    path("", include("apps.knowledge_base.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoints: `GET/POST /api/faqs/`, `GET/PUT/PATCH/DELETE /api/faqs/<pk>/`.

---

### 3 — Grant the new permissions to the seeded roles

**Create file: `backend/apps/knowledge_base/migrations/0002_grant_knowledge_base_permissions.py`**

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning as customers/0002 and tickets/0002: agents/managers/admin
# all work with FAQs day to day; a superuser bypasses roles entirely
# (CONVENTIONS.md §22).
GRANTS = {
    "admin": [Permissions.KNOWLEDGE_BASE_VIEW, Permissions.KNOWLEDGE_BASE_MANAGE],
    "manager": [Permissions.KNOWLEDGE_BASE_VIEW, Permissions.KNOWLEDGE_BASE_MANAGE],
    "agent": [Permissions.KNOWLEDGE_BASE_VIEW, Permissions.KNOWLEDGE_BASE_MANAGE],
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
    dependencies = [
        ("knowledge_base", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

**All three roles get both permissions**, the same call Story 10/18 already
made: with no draft/publish distinction in this story, there is no
meaningful "can view but not manage" FAQ workflow yet. A future story can
narrow `agent`'s grant as a data change requiring no code.

---

## Frontend Tasks

### 4 — Types

**Create file: `frontend/src/features/knowledge-base/types/faq.ts`**

```ts
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
```

`Faq`, not `FAQ` — matching this codebase's existing acronym-as-word
convention for TypeScript types (`TicketSla`, `SlaDimensionStatus` in
`frontend/src/features/tickets/types/ticketSla.ts`), even though the backend
model is `FAQ` (matching `SLAPolicy`'s Python-side convention instead). Both
sides are internally consistent with their own language's existing
precedent.

---

### 5 — API layer and query keys

**Create file: `frontend/src/features/knowledge-base/api/faqKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const faqKeys = featureKey('faqs')
```

**Create file: `frontend/src/features/knowledge-base/api/getFaqs.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Faq } from '../types/faq'

export type FaqListParams = ServerTableParams & { search?: string }

export function getFaqs(params: FaqListParams): Promise<Page<Faq>> {
  return api.getPage<Faq>('/faqs/', { params })
}
```

**Create file: `frontend/src/features/knowledge-base/api/getFaq.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Faq } from '../types/faq'

export function getFaq(id: number): Promise<Faq> {
  return api.get<Faq>(`/faqs/${id}/`)
}
```

**Create files: `createFaq.ts`, `updateFaq.ts`, `deleteFaq.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Faq, FaqInput } from '../types/faq'

export function createFaq(input: FaqInput): Promise<Faq> {
  return api.post<Faq>('/faqs/', input)
}
```

```ts
import { api } from '@/shared/lib/api/client'

import type { Faq, FaqInput } from '../types/faq'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateFaq(id: number, input: FaqInput): Promise<Faq> {
  return api.patch<Faq>(`/faqs/${id}/`, input)
}
```

```ts
import { api } from '@/shared/lib/api/client'

export function deleteFaq(id: number): Promise<void> {
  return api.delete(`/faqs/${id}/`)
}
```

**Create file: `frontend/src/features/knowledge-base/api/useFaqs.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getFaqs } from './getFaqs'
import type { FaqListParams } from './getFaqs'
import { faqKeys } from './faqKeys'

export function useFaqs(params: FaqListParams) {
  return useQuery({
    queryKey: faqKeys.resource('list', params),
    queryFn: () => getFaqs(params),
  })
}
```

**Create file: `frontend/src/features/knowledge-base/api/useFaq.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getFaq } from './getFaq'
import { faqKeys } from './faqKeys'

export function useFaq(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: faqKeys.resource('detail', id),
    queryFn: () => getFaq(id),
    enabled: options?.enabled,
  })
}
```

**Create file: `frontend/src/features/knowledge-base/api/useFaqMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createFaq } from './createFaq'
import { deleteFaq } from './deleteFaq'
import { faqKeys } from './faqKeys'
import { updateFaq } from './updateFaq'
import type { FaqInput } from '../types/faq'

// Every mutation invalidates the whole `faqs` key prefix — a create/edit
// changes ordering position and a delete shifts every later page, the same
// reasoning `useTaskMutations.ts` documents. CONVENTIONS.md §23.
function useInvalidateFaqs() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: faqKeys.all })
}

export function useCreateFaq() {
  const invalidate = useInvalidateFaqs()
  return useMutation({
    mutationFn: (input: FaqInput) => createFaq(input),
    onSuccess: invalidate,
  })
}

export function useUpdateFaq(id: number) {
  const invalidate = useInvalidateFaqs()
  return useMutation({
    mutationFn: (input: FaqInput) => updateFaq(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteFaq() {
  const invalidate = useInvalidateFaqs()
  return useMutation({
    mutationFn: (id: number) => deleteFaq(id),
    onSuccess: invalidate,
  })
}
```

---

### 6 — Locale namespace

**Create file: `frontend/src/features/knowledge-base/locales/en.json`**

```json
{
  "title": "Knowledge base",
  "manage": {
    "title": "Manage FAQs",
    "new": "New FAQ",
    "edit": "Edit FAQ",
    "empty": "No FAQs yet",
    "emptyDescription": "Create the first FAQ to get started.",
    "fields": {
      "question": "Question",
      "answer": "Answer",
      "order": "Order",
      "actions": "Actions"
    },
    "actions": {
      "save": "Save",
      "delete": "Delete",
      "backToManage": "Back to manage FAQs"
    },
    "delete": {
      "title": "Delete this FAQ?",
      "description": "This permanently removes the FAQ. This cannot be undone."
    },
    "created": "FAQ created.",
    "updated": "FAQ updated.",
    "deleted": "FAQ deleted."
  },
  "browse": {
    "empty": "No FAQs yet",
    "emptyDescription": "Check back later."
  }
}
```

**Create `frontend/src/features/knowledge-base/locales/ar.json`** with the
identical key set, translated.

**File: `frontend/src/shared/i18n/resources.ts`** — register the
`knowledgeBase` namespace, two imports plus one entry per language, following
the `webForm`/`liveChat` camelCase-key-for-kebab-case-folder pattern already
used at lines 15–16/42–43 and 7–8/41/55.

---

### 7 — The manage list screen

**Create file: `frontend/src/features/knowledge-base/components/FaqListPage.tsx`**

Composition, following `TaskListPage.tsx` (`frontend/src/features/tasks/components/TaskListPage.tsx`):

- `useServerTable({ initialSort: { field: 'order', direction: 'asc' } })`.
- `useFaqs(params)`.
- `useConfirm()` + `useDeleteFaq()` for row delete, same shape as
  `TaskListPage`'s `handleDelete`.
- `<DataTable>` columns:

  | `id` | header | sortable | notes |
  |---|---|---|---|
  | `question` | `t('knowledgeBase:manage.fields.question')` | yes | `cell` renders a `<Link to={\`/knowledge-base/manage/${row.id}/edit\`}>{row.question}</Link>` |
  | `order` | `t('knowledgeBase:manage.fields.order')` | yes | `align="end"` |
  | `actions` | `t('knowledgeBase:manage.fields.actions')` | no | a **Delete** button through `useConfirm()`, same shape as `TaskListPage`'s |

- `caption={t('knowledgeBase:manage.title')}`.
- `empty` prop: `<Empty title={t('knowledgeBase:manage.empty')}
  description={t('knowledgeBase:manage.emptyDescription')} />`.
- A **New FAQ** button linking to `/knowledge-base/manage/new`.
- A back link to `/knowledge-base` (`t('knowledgeBase:manage.actions.backToManage')`
  reversed — link text is the browse screen's own title).

**Do not wrap `DataTable` in `QueryBoundary`** — same rule as every prior
list screen (`CONVENTIONS.md` §5/§19).

---

### 8 — The form screen

**Create file: `frontend/src/features/knowledge-base/components/FaqFormPage.tsx`**

One component for both create and edit, following `TaskFormPage.tsx`'s shape
exactly (route param present = edit, `QueryBoundary` around `useFaq` in edit
mode):

```tsx
const schema = z.object({
  question: requiredString(300),
  answer: requiredString(5000),
  // Inline, not a shared schemas.ts helper (CONVENTIONS.md §8) — no other
  // feature needs a min-at-zero integer yet. `positiveInt()` does not fit:
  // it floors at 1, and `order`'s default is 0.
  order: z.coerce.number().int().min(0).max(9999),
})
```

- `defaultValues`: `{ question: '', answer: '', order: 0 }` for create; from
  `useFaq(id)` for edit.
- Two `<TextField>`/`<TextareaField>`s: `question` as `TextField`, `answer`
  as `TextareaField`, `order` as `TextField` (its raw string value coerced
  by `z.coerce.number()`, matching `positiveInt`'s own coercion pattern in
  `shared/validation/schemas.ts`).
- Submit → `useCreateFaq()` / `useUpdateFaq(id)`; `onError` →
  `isValidationError(error)` → `applyServerErrors(form, error)`; `onSuccess`
  → toast `t('knowledgeBase:manage.created')` /
  `t('knowledgeBase:manage.updated')` then `navigate('/knowledge-base/manage')`.

---

### 9 — The browse screen

**Create file: `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import { Can } from '@/shared/auth'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'
import { Link } from 'react-router'

import { useFaqs } from '../api/useFaqs'
import type { Faq } from '../types/faq'

export function FaqBrowsePage() {
  const { t } = useTranslation('knowledgeBase')
  // Single page, ordered for reading. `page_size: 100` (this project's
  // `DRF_MAX_PAGE_SIZE` default) — real search/ranking is KB-3's job; this
  // screen is a fixed-size read, not a paginated table. See `## Edge Cases`.
  const query = useFaqs({ page: 1, page_size: 100, ordering: 'order' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <Can permission="knowledge_base.manage">
          <Button asChild variant="outline" size="sm">
            <Link to="/knowledge-base/manage">{t('manage.title')}</Link>
          </Button>
        </Can>
      </div>
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Empty title={t('browse.empty')} description={t('browse.emptyDescription')} />
        }
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((faq: Faq) => (
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

`whitespace-pre-wrap` preserves an answer's own line breaks (a `TextField`
answer typed with paragraphs) without introducing a rich-text renderer —
that is KB-2's `Article` editor's job, not this story's.

---

### 10 — Routes and navigation

**File: `frontend/src/app/router.tsx`** — two new `RequirePermission`
blocks nested inside the existing `RequireAuth` element, alongside
`customers.view`/`tickets.view`:

```tsx
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
            ],
          },
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
            ],
          },
```

Unlike `customers/new` vs `customers/:id` (Story 10), **no route-order
hazard exists here** — `knowledge-base/manage/new` (3 segments) and
`knowledge-base/manage/:id/edit` (4 segments) never collide regardless of
declaration order, because there is no bare `knowledge-base/manage/:id`
route for `new` to be mistaken for.

**File: `frontend/src/app/RootLayout.tsx`** — add the nav link, and extend
the `useTranslation` namespace array (line 13) with `'knowledgeBase'`:

```tsx
            <Can permission="knowledge_base.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/knowledge-base">{t('knowledgeBase:title')}</Link>
              </Button>
            </Can>
```

Placed beside the existing `customers.view`/`tickets.view` entries (after
line 34, before the unconditional `tasks` link).

---

## Documentation Tasks

### 11 — Conventions addendum

**File: `CONVENTIONS.md`** — append one paragraph to the end of §23 (after
the `PROTECT`/`ProtectedError` paragraph that currently closes it), covering
the pattern this story introduces:

> **A resource that is read as a whole (not worked from row to row) splits
> into two independently permission-gated route trees, not one gated-button
> list page.** `FAQ` (Story 39, `KB-1`) is the first such case: `FaqBrowsePage`
> (`knowledge_base.view`) is a fixed, unpaginated read of every row, and
> `FaqListPage`/`FaqFormPage` (`knowledge_base.manage`, under
> `/knowledge-base/manage`) are the `DataTable`-based CRUD surface every
> prior feature already has. Contrast `CustomerListPage`/`TaskListPage`,
> where the same table serves both browsing and management because the
> resource is genuinely worked row by row — the deciding factor is whether a
> table is the right reading shape at all, not whether the resource has an
> admin/non-admin split in permissions (every feature already has that).

---

## Edge Cases & Failure Modes

- **`FaqBrowsePage` caps at 100 rows (`DRF_MAX_PAGE_SIZE` default).** A
  knowledge base that grows past 100 FAQs silently truncates the browse
  screen to the first page in `order` sequence — accepted for this story
  (see `## Story Goal`); KB-3's search/ranking is the intended replacement
  for "read every FAQ on one screen," not a pagination control added here.
- **Two FAQs with the same `order` value sort by `question` alphabetically**
  (`FAQ.Meta.ordering = ("order", "question")`) — not by insertion order or
  id, so re-editing one FAQ's `order` to match another's produces a
  deterministic, not undefined, tiebreak.
- **An unmapped `FAQViewSet` action grants; it does not deny** — the same
  §22 rule every `permission_map` follows. All six actions are mapped
  explicitly (task 2), so this is a verification point (Verification Step
  6), not a live gap.
- **`?ordering=` on a field not in `ordering_fields` is silently ignored,**
  not an error — `OrderingFilter`'s documented behaviour, the same contract
  `CustomerViewSet`/`TicketViewSet` already rely on. `question`/`order`/
  `created_at` are the only three that do anything.
- **`DataTable` must not be wrapped in `QueryBoundary`** on the manage
  screen — its own docstring's `<div>`-inside-`<tbody>` reasoning
  (`CONVENTIONS.md` §5/§19) — while `FaqBrowsePage` **must** use
  `QueryBoundary`, since it renders a plain `<div>` of cards, not a table.
  Mixing the two up on either screen is a real regression, not a style
  preference.
- **A `knowledge_base.view`-only account cannot reach `/knowledge-base/manage`
  by typing the URL** — `RequirePermission` redirects to `/`
  (`frontend/src/shared/auth/RequirePermission.tsx:28`), the same behaviour
  every other permission-gated route tree already has. The "Manage FAQs"
  link is additionally hidden via `<Can>`, so the two mechanisms agree.
- **An empty `question`/`answer` is rejected server-side independent of the
  frontend schema** — unlike `Customer.email` (Story 10), nothing on `FAQ`
  is `blank=True`, so DRF's generated `required=True`/`allow_blank=False`
  already reject an empty string with a `validation_error`, with no
  serializer-level normalisation needed (contrast the unique-nullable-column
  handling Story 10 needed for `email`).
- **A role without `knowledge_base.manage` gets 403 on write, and the button
  that would have triggered it is hidden — which must agree.** Same
  `<Can>`/API-permission-string-match reasoning as every prior feature
  (`CONVENTIONS.md` §22).
- **`delete` returns 204 with an empty body** — `EnvelopeJSONRenderer`'s
  existing 204 special-case and `api.delete`'s early return already handle
  this; `deleteFaq` needs no special handling (verified precedent: Story 10
  `## Edge Cases`).

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
3. `npm run build` — typechecks `Faq`/`FaqInput`, every `ColumnDef<Faq>`, the
   `useAppForm<typeof schema>` instantiation, and every new
   `t('knowledgeBase:…')` key through `CustomTypeOptions`.
4. `npm run lint` (`react/jsx-no-literals` over the three new components),
   `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison for the `knowledgeBase` namespace
   (Verification Step 4).
6. Real HTTP across the three seeded role accounts plus a real browser
   walkthrough in both languages (Verification Steps 6–11).

---

## Migration / Rollback

**Two migrations, both additive.** `knowledge_base/0001_initial` creates one
table; `knowledge_base/0002_grant_knowledge_base_permissions` updates three
existing `Role` rows. **No reset, no data loss, no schema change to an
existing table.**

**Rollback of the code:** revert the commits. **No `npm install` and no
`pip install`** — this story adds no dependency.

**Rollback of the schema:**

```powershell
python manage.py migrate knowledge_base zero
```

`0002`'s reverse (`revoke`) removes only the two `knowledge_base.*` strings
via set difference, leaving every other grant intact; `0001`'s reverse drops
the table. Both are clean — nothing references `FAQ` from another app.

**Half-applied states to avoid:**

- **Task 2's permission constants without task 3's grant** → every FAQ
  endpoint returns 403 for every non-superuser, and both screens redirect to
  `/`. Ship them together.
- **Task 3's grant without task 2's constants** → `Role.clean()` rejects the
  unknown string on the next admin save of any granted role.
- **Task 10's routes before tasks 7/8/9** → the lazy imports resolve to
  modules that do not exist; the build fails on the import, not the route.
- **Task 6 before task 7/9** → every `t('knowledgeBase:…')` key fails
  `tsc -b`, because `AppResources` has no `knowledgeBase` namespace.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv
   active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations apply forward, no reset:** `python manage.py migrate`;
   `python manage.py showmigrations knowledge_base` shows `0001` and `0002`
   applied.
3. **The grant landed additively, without wiping earlier grants:**

   ```powershell
   python manage.py shell -c "from apps.accounts.models import Role; [print(r.slug, sorted(r.permissions)) for r in Role.objects.all()]"
   ```

   Every role must still hold its prior permissions **plus** the two
   `knowledge_base.*`.
4. **`en` and `ar` key sets match** for the new namespace — the same
   node-script check Story 10's Verification Step 4 uses, pointed at
   `frontend/src/features/knowledge-base/locales/{en,ar}.json`.
5. **Backend regression:** `python manage.py test` reports the same passing
   count as before this story's migrations were applied.
6. **Every action enforces its own permission.** Using the three seeded
   accounts (`admin@`, `mgr@`, `agent@`, password `Sup3rSecret!`) plus no
   token:

   | Request | no token | a role **without** `knowledge_base.manage` | `agent@` |
   |---|---|---|---|
   | `GET /api/faqs/` | 401 `not_authenticated` | 200 (has `knowledge_base.view`) | 200 |
   | `POST /api/faqs/` | 401 | 403 `permission_denied` | 201 |
   | `PATCH /api/faqs/<id>/` | 401 | 403 | 200 |
   | `DELETE /api/faqs/<id>/` | 401 | 403 | 204 |

   For the middle column, temporarily strip `knowledge_base.manage` from one
   role, run the four requests, then restore it.
7. **A blank question or answer is a field error, not a 500.** `POST`
   `{"question": "", "answer": "x", "order": 0}` returns `validation_error`
   with `fields: {"question": [...]}`.
8. **Ordering and search behave as declared.** `?ordering=order`,
   `?ordering=-order`, `?ordering=question`, `?ordering=created_at` each
   change the order; `?ordering=answer` is **ignored** (not in
   `ordering_fields`). `?search=` against a question fragment and an answer
   fragment each narrow the set.
9. **The manage screen walkthrough.** `npm run dev` with the backend up,
   signed in as `agent@`: `/knowledge-base/manage` lists FAQs; sortable
   headers toggle asc → desc → default; "New FAQ" creates one and lands back
   on the manage list with no manual refresh (the invalidation check); edit
   changes a field and the list reflects it; delete asks for confirmation via
   `useConfirm()` then removes the row.
10. **The browse screen walkthrough.** `/knowledge-base` shows every FAQ as a
    question/answer card, ordered by `order`; the "Manage FAQs" button is
    visible for `agent@` (has `knowledge_base.manage`) and absent for an
    account that only has `knowledge_base.view`; that same view-only account
    is redirected to `/` if it navigates directly to `/knowledge-base/manage`.
11. **Both languages, RTL included.** Switch to Arabic on both screens: every
    string is translated, `dir="rtl"`, dates use Western digits
    (`useFormatters`), and no layout is mirrored wrongly.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`,
    `npm run format:check`, `npm run check:rtl`, `npm run build`. All four
    exit 0.

---

## Done Criteria

- [ ] `knowledge_base.FAQ` extends `TimeStampedModel` with `question`
      (`max_length=300`), `answer` (`TextField`), `order`
      (`PositiveIntegerField(default=0)`), and `Meta.ordering = ("order", "question")`.
- [ ] **No `category`, no `status`/`is_published`, no per-locale fields** —
      KB-2 boundary respected.
- [ ] `apps/knowledge_base/migrations/0001_initial.py` committed; no pending
      migrations.
- [ ] `Permissions` gains `KNOWLEDGE_BASE_VIEW` and `KNOWLEDGE_BASE_MANAGE`;
      `ALL_PERMISSIONS` picks them up with no other change.
- [ ] `knowledge_base/0002_grant_knowledge_base_permissions.py` is a
      cross-app data migration depending on `("accounts", "0003_seed_roles")`,
      grants by set union, reverses by set difference.
- [ ] `FAQSerializer` extends `BaseModelSerializer` with
      `class Meta(BaseModelSerializer.Meta)`.
- [ ] `FAQViewSet` extends `BaseModelViewSet` with **all six actions
      mapped**, plus `ordering_fields`/`search_fields`. No
      `permission_classes` override.
- [ ] `apps/knowledge_base/urls.py` uses `SimpleRouter`;
      `config/api_urls.py` registers it above the catch-all `re_path`, which
      stays last.
- [ ] `features/knowledge-base/` contains `types/faq.ts`, `api/` (keys, five
      call modules, `useFaqs`, `useFaq`, `useFaqMutations`), `components/`
      (`FaqListPage`, `FaqFormPage`, `FaqBrowsePage`), and
      `locales/{en,ar}.json` registered in `resources.ts` as `knowledgeBase`.
- [ ] `Faq` TS type mirrors the serializer verbatim.
- [ ] Edits use **`api.patch`**, not `api.put`.
- [ ] **Every mutation invalidates `faqKeys.all`.**
- [ ] The manage screen uses `DataTable` + `useServerTable`, is **not**
      wrapped in `QueryBoundary`; the browse screen uses `QueryBoundary` and
      is **not** a `DataTable`.
- [ ] Routes: `knowledge-base` gated `knowledge_base.view`;
      `knowledge-base/manage`, `knowledge-base/manage/new`,
      `knowledge-base/manage/:id/edit` gated `knowledge_base.manage`.
- [ ] `RootLayout` gains a `knowledge_base.view`-gated nav link; the browse
      screen gains a `knowledge_base.manage`-gated "Manage FAQs" link.
- [ ] Verified by real HTTP: all four verbs × three permission states behave
      per Verification Step 6's table, including `DELETE`.
- [ ] Verified: a blank `question`/`answer` is a field error, not a 500
      (Step 7); ordering/search behave per Step 8.
- [ ] Both languages walk through cleanly on both screens, RTL included
      (Step 11).
- [ ] `CONVENTIONS.md` §23 gains the "read-as-a-whole splits into two route
      trees" addendum.
- [ ] `python manage.py test` count unchanged from baseline; `ruff format
      --check .`, `ruff check .`, `npm run lint`, `npm run format:check`,
      `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/knowledge-base/00-overview.md` filled in and
      `.squad/plans/00-index.md` gains a `knowledge-base` row.

**STOP HERE. Report to the user and wait for confirmation before proceeding
to Story 40 (KB-2, Help Articles & Guides), which depends on this story's
`FAQ` model existing as the pattern to extend, not copy verbatim — `Article`
adds category, status, and bilingual fields this story deliberately left
out.**
