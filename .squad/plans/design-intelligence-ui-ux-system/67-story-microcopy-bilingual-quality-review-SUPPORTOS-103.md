# Story 67 — (DSN-12) Microcopy & Bilingual (AR/EN) Quality Review (Story: SUPPORTOS-103)

## Prerequisites

- **`DSN-6` (Story 61) is complete.** `design-system/supportos/UX-AUDIT.md` has 69 rows; this story consumes the 12 rows whose **Category** column is `content` or `bilingual` (fixed mapping: both → `DSN-12`): `UX-012, UX-015, UX-023, UX-024, UX-027, UX-031, UX-032, UX-035, UX-042, UX-045, UX-048, UX-056`.
- **One finding needs a real backend change and is deferred, verified against current code, not assumed:**
  - **`UX-024`** (FAQs have no bilingual model split, unlike Articles) — `backend/apps/knowledge_base/models.py`'s `FAQ` model (lines 7-27) has exactly two content fields, `question`/`answer`, both single-language `CharField`/`TextField`, with a doc comment stating this is deliberate ("Deliberately minimal: no category, no status, no per-locale content"). `Article` (lines 48-89), by contrast, has `title_en`/`title_ar`/`body_en`/`body_ar`. Adding `question_ar`/`answer_ar` needs a new model field pair + migration — a backend/data-model change the `DSN-6`–`DSN-13` guardrail (`SupportOs backlog.MD:556`) forbids. Same category of deferral as `UX-019`/`UX-057` (Story 66), `UX-030`/`UX-007` (Stories 62/63).
- **Two findings are verified false positives — no code change:**
  - **`UX-035`** (search-result highlights allegedly lost because `MarkdownPreview` escapes embedded HTML) — `backend/apps/knowledge_base/search.py:19-28`'s `_HEADLINE_KWARGS` sets `start_sel: "**"`, `stop_sel: "**"` — Postgres's `SearchHeadline` wraps matched terms in **Markdown bold syntax**, not HTML tags, and the module's own comment confirms this is deliberate: "Markdown's own bold syntax as the highlight marker: the returned headline renders through the EXISTING `MarkdownPreview` component with zero new HTML-safety surface — verified." `MarkdownPreview.tsx` renders CommonMark bold (`**text**`) correctly out of the box (no plugin needed for basic emphasis) — the register's premise (headline highlights are HTML `<b>`/`<mark>` tags that get escaped) does not hold; there is no HTML in `headline`/`headline_en`/`headline_ar` to escape. No code change.
  - **`UX-056`** (`RouteErrorBoundary.tsx` renders raw, untranslated `error.statusText`) — the current file (`frontend/src/app/RouteErrorBoundary.tsx:29-38`) no longer reads `error.statusText` at all: `{error.status} {t('states.error.route')}` — the numeric HTTP status is shown alongside the same translated fallback string used by the two other branches. This is already exactly the register's own suggested fix ("drop `statusText`"). `git blame`-equivalent context: Story 63 (`DSN-8`, `UX-055`, "add a 'Go home' `Button`/`Link` common to all 3 branches") touched this same file and evidently dropped `statusText` as part of that rewrite, without the register being updated to reflect it. The register's cited lines (20-22) are stale — current line numbers are 29-38. No code change.
- **One finding's literal recommended fix is corrected during planning, in the opposite direction from what the register suggests:**
  - **`UX-031`** (FAQ answers render as plain text on `FaqBrowsePage.tsx` but as Markdown on `SearchPage.tsx`) — the register suggests resolving this by making `SearchPage.tsx` render FAQ text as plain text too. Read `backend/apps/knowledge_base/search.py:19-28` again: FAQ search headlines are deliberately wrapped in `**...**` Markdown bold markers specifically so `MarkdownPreview` renders them as bold, highlighted text (see `UX-035` above) — switching `SearchPage.tsx`'s FAQ branch to plain text would make every search match show literal, un-rendered `**asterisks**` around the matched term, a regression to the exact bug `UX-035`'s backend design was built to avoid. Implemented in the opposite direction instead: `FaqBrowsePage.tsx` (which has no headline/highlight concept — it lists the full `answer` with no search context) is changed to render `faq.answer` through the same `MarkdownPreview` component `SearchPage.tsx`/`ArticleReaderPage.tsx` already use, converging both screens on Markdown rendering rather than both on plain text.
- **One finding is fixed with a new npm dependency added — verified as a different risk category than `UX-018`'s deferred combobox, not assumed:**
  - **`UX-027`** (`MarkdownPreview.tsx` imports plain `react-markdown` with no `remark-gfm` plugin, so GFM syntax — tables, strikethrough, task lists, autolinked URLs — renders as literal text) — `frontend/package.json`'s `dependencies`/`devDependencies` (both read in full) confirm `remark-gfm` is genuinely absent today. Unlike `UX-018`'s deferred searchable combobox (Story 65), which needed a whole new interaction primitive (`Popover`/`Command`) plus the `cmdk` library — the kind of addition the guardrail's "no new component library" clause is aimed at — `remark-gfm` is a plugin for a renderer this codebase already depends on and already renders through in three places (`ArticleFormPage.tsx`'s preview tab, `ArticleReaderPage.tsx`, `SearchPage.tsx`), not a new UI component or interaction pattern. It is added as a new dependency of `frontend/package.json`, not deferred.
- **One finding's cited line numbers don't fully match the actual dialectal content, and one extra instance was found beyond what the register cites — corrected during verification, not assumed:**
  - **`UX-012`** (dialectal Arabic in 3 public-facing `ar.json` files) — all three files were read in full. `features/auth/locales/ar.json:9` matches the register's own citation exactly ("مش من فريق العمل؟"). `features/live-chat/locales/ar.json`'s register citation ("lines 4/13/15") is partly stale: line 15 (`"placeholder": "اكتب رسالة"`) is already standard MSA, not dialectal; the actual dialectal line the citation likely meant is line 16 (`"empty": "لسه مفيش رسايل — ابدأ بالسلام!"`), and a fourth dialectal phrase not cited at all exists at line 8 (`"contactPrompt": "تفضّل التواصل بالإيميل؟"`, missing the interrogative `هل` and using the informal transliteration `بالإيميل` instead of `البريد الإلكتروني`, the term this app's own `auth`/`web-form` namespaces already use). `features/web-form/locales/ar.json` has only one borderline-informal phrase (`links.chatPrompt`, line 5, the same `تفضّل` construction as `live-chat`'s line 8) — the rest of the file is already properly formal MSA, so this story's edit to that file is narrower than the register implies.

---

## Story Goal

Resolve 9 of the 12 `content`/`bilingual`-category register rows (one, `UX-031`, with a corrected — reversed-direction — approach; one, `UX-027`, by adding a new npm dependency), close 2 as verified false positives requiring no code change (`UX-035`, `UX-056`), and defer 1 that genuinely needs a backend model change (`UX-024`). Every in-scope fix is a translation-resource edit or a small, already-precedented component-level fix per the `DSN-6`–`DSN-13` guardrail (`SupportOs backlog.MD:556`) — no data-flow, API, or route-logic change; no permission gate or i18n key removed; `remark-gfm` is the one new dependency, justified above as a plugin, not a new component library.

**Disposition table:**

| ID | Severity | Disposition |
|---|---|---|
| `UX-012` | major | Fixed — 6 dialectal Arabic phrases across `auth/ar.json` (1), `live-chat/ar.json` (4, one not cited by the register), `web-form/ar.json` (1) rewritten to formal MSA |
| `UX-015` | minor | Fixed — `AttachmentsSection.tsx`'s `formatSize` unit suffixes moved into the `customers` locale namespace, interpolated via `t(...)` |
| `UX-023` | minor | Fixed — `InternalNotesSection.tsx`'s delete-confirm title/description changed from "Delete this note?" to "Remove this note?", matching its own "Remove" action label and every other delete-confirm flow's "Remove ⇄ Remove this X?" pairing |
| `UX-024` | major | Deferred — FAQs have no `question_ar`/`answer_ar` fields; adding them needs a backend model change + migration, forbidden by the guardrail |
| `UX-027` | major | Fixed — `remark-gfm` added as a new `frontend/package.json` dependency and wired into `MarkdownPreview.tsx`'s `<Markdown remarkPlugins={[remarkGfm]}>` |
| `UX-031` | major | Fixed with a corrected (reversed) approach — `FaqBrowsePage.tsx` converged onto `MarkdownPreview` (matching `SearchPage.tsx`), not the other way around, since `SearchPage.tsx`'s Markdown rendering is required by the backend's own `**bold**` search-highlight design (`UX-035`) |
| `UX-032` | minor | Fixed — `ArticleListPage.tsx`'s manage-table title column now switches on `i18n.language`, matching `ArticleBrowsePage.tsx`'s existing pattern; sort still keys on `title_en` (a pre-existing backend `ordering_fields` limitation, unrelated to this fix) |
| `UX-035` | major | Resolved — verified false positive, no code change; search headlines are wrapped in Markdown `**bold**`, not HTML, so `MarkdownPreview` already renders them correctly |
| `UX-042` | major | Fixed — a static, exhaustive 13-slug permission→description lookup added (sourced from `backend/apps/core/permissions.py`'s `Permissions` class), rendered as secondary text beside each permission's raw slug in `RoleFormPage.tsx` |
| `UX-045` | minor | Fixed — `TaskListPage.tsx`'s status-filter `SelectTrigger` gets `title={completedFilterLabel}`, matching the `title={displayValue}` pattern `DSN-7` (Story 62, `UX-020`) already established for the same class of finding |
| `UX-048` | major | Fixed — `TicketReportsPage.tsx`'s `toChartSeries` now also returns a series `totalCount`; a "Showing top 5 of N" note renders via `ChartFrame`'s `description` prop only when `totalCount > MAX_SERIES` |
| `UX-056` | minor | Resolved — verified false positive, no code change; `RouteErrorBoundary.tsx` already dropped `error.statusText` as a side effect of Story 63 (`DSN-8`, `UX-055`)'s rewrite of the same file |

**Not in scope:** anything outside these 12 items; a backend FAQ bilingual-model migration for `UX-024` (deferred); making `SearchPage.tsx`'s FAQ branch plain text (would regress the backend's own search-highlight design); any change to `error.status`'s numeric display in `RouteErrorBoundary.tsx` (already fine, only `statusText` was ever the concern and it's already gone).

---

## Context — Read These Files First

1. `design-system/supportos/UX-AUDIT.md` — the 12 `content`/`bilingual` rows this story implements (currently at lines 100, 103, 111-112, 115, 119-120, 123, 130, 133, 136, 144); task 13 updates their Status and appends narrative notes for the 5 rows needing one (`UX-024`, `UX-027`, `UX-031`, `UX-035`, `UX-056`).
2. `SupportOs backlog.MD` line 556 (guardrail — "no data-flow, API, or route-logic changes; no new component library; permission gates and i18n keys preserved exactly") and lines 611-618 (`DSN-12` story text, both named tasks).
3. `frontend/src/features/auth/locales/ar.json` (full file, 14 lines), `frontend/src/features/live-chat/locales/ar.json` (full file, 19 lines), `frontend/src/features/web-form/locales/ar.json` (full file, 22 lines) — task 1's 3 edit sites; the corresponding `en.json` files' `help.prompt`/`start.contactPrompt`/`links.chatPrompt` keys (for the English text each Arabic string must keep meaning-parity with) were also checked.
4. `frontend/src/features/customers/components/AttachmentsSection.tsx` lines 35-39 (`formatSize`) — task 2's edit site; `frontend/src/features/customers/locales/en.json`/`ar.json` lines 78-95 (the `attachments` block) — where the new `units` keys are added; `frontend/src/features/customers/components/ContactDetailsSection.tsx` lines 1-3, 61-63 — the precedent for a standalone function taking a typed `t: TFunction<'customers'>` parameter, reused for `formatSize`.
5. `frontend/src/features/tickets/components/InternalNotesSection.tsx` lines 112-120, 139-147 — task 3's edit site (confirmed unchanged from the register's cited lines 114/146, despite `DSN-8` having touched this same file for a different finding); `frontend/src/features/tickets/locales/en.json`/`ar.json` lines 141-159 (`internalNotes` block) and lines 42-52 (`customers` namespace's own `contacts.delete` "Remove this X?" pattern, cross-checked in `frontend/src/features/customers/locales/en.json`/`ar.json`) — the established "Remove ⇄ Remove this X?" pairing to match.
6. `backend/apps/knowledge_base/models.py` (full file, 89 lines) — task 4's verification that `FAQ` genuinely has no bilingual fields (deferred, no file edited).
7. `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx` (full file, 17 lines) and `frontend/package.json` (full file, 49 lines) — task 5's edit sites; confirms `remark-gfm` is absent today.
8. `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx` (full file, 65 lines), `frontend/src/features/knowledge-base/components/SearchPage.tsx` (full file, 94 lines), `backend/apps/knowledge_base/search.py` (full file, 126 lines, especially `_HEADLINE_KWARGS` at lines 19-28) — task 6's edit site and the evidence for the reversed-direction correction.
9. `frontend/src/features/knowledge-base/components/ArticleListPage.tsx` (full file, 128 lines, re-read fresh post-`DSN-11`) and `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx` lines 106-113 (the `isArabic ? article.title_ar : article.title_en` pattern to copy) — task 7's edit site; `frontend/src/features/knowledge-base/locales/en.json`/`ar.json` lines 49-59 (`articles.manage.fields`) — where the new `title` key is added.
10. `frontend/src/features/knowledge-base/types/searchResult.ts` (full file, 28 lines) and `backend/apps/knowledge_base/views.py` (full file, 111 lines, especially `KnowledgeBaseSearchView` at lines 94-111) — the evidence `UX-035` is a false positive; no file edited.
11. `frontend/src/features/accounts/components/RoleFormPage.tsx` (full file, 240 lines, re-read fresh post-`DSN-11`'s `<h3>`→`<h2>` change at line 198) and `backend/apps/core/permissions.py` (full file, 141 lines, the exhaustive `Permissions` class at lines 18-38) — task 8's edit site and the real, complete 13-slug permission list. `frontend/src/features/accounts/locales/en.json`/`ar.json` lines 27-63 (the `roles` block) — where the new `permissionDescriptions` keys are added.
12. `frontend/src/features/tasks/components/TaskListPage.tsx` (full file, 163 lines) — task 9's edit site; `frontend/src/features/tickets/components/TicketAssigneeControl.tsx` line 59 and `frontend/src/features/tickets/components/TicketListPage.tsx` lines 133-138, 163 — the `title={displayValue}` precedent from `DSN-7` (Story 62, `UX-020`) to copy.
13. `frontend/src/features/reports/components/TicketReportsPage.tsx` (full file, 258 lines, especially `toChartSeries` at lines 37-56 and the volume `ChartFrame` at lines 172-203) and `frontend/src/shared/ui/chart/ChartFrame.tsx` (full file, 101 lines, especially the `description` prop rendering at line 57 and the `role="img"` wrapper at line 82) — task 10's edit site and why the truncation note must go through `description`, not inside `children`. `frontend/src/features/reports/locales/en.json`/`ar.json` lines 63-67 (the `volume` block) — where the new `seriesTruncated` key is added.
14. `frontend/src/app/RouteErrorBoundary.tsx` (full file, 46 lines) — the evidence `UX-056` is already resolved; no file edited.

---

## Frontend Tasks

### 1 — Rewrite dialectal Arabic in 3 public-facing locale files to formal MSA (`UX-012`)

**File: `frontend/src/features/auth/locales/ar.json`** line 9:

```diff
-    "prompt": "مش من فريق العمل؟",
+    "prompt": "ألست من فريق العمل؟",
```

**File: `frontend/src/features/live-chat/locales/ar.json`** — 4 phrases, not the register's cited 3 (see `## Prerequisites`):

```diff
   "start": {
     "title": "ابدأ محادثة",
-    "subtitle": "أخبرنا باسمك وهنوصلك بأحد ممثلي الدعم فورًا.",
+    "subtitle": "أخبرنا باسمك وسنوصلك بأحد ممثلي الدعم فورًا.",
     "name": "اسمك",
     "email": "البريد الإلكتروني (اختياري)",
     "action": "بدء المحادثة",
-    "contactPrompt": "تفضّل التواصل بالإيميل؟",
+    "contactPrompt": "هل تفضّل التواصل عبر البريد الإلكتروني؟",
     "contactLink": "أرسل طلبًا"
   },
   "chat": {
     "title": "الدردشة المباشرة",
-    "subtitle": "هيرد عليك أحد ممثلي الدعم هنا قريبًا.",
+    "subtitle": "سيرد عليك أحد ممثلي الدعم هنا قريبًا.",
     "disconnected": "جارٍ إعادة الاتصال…",
     "placeholder": "اكتب رسالة",
-    "empty": "لسه مفيش رسايل — ابدأ بالسلام!",
+    "empty": "لا توجد رسائل بعد — ابدأ بالتحية!",
     "send": "إرسال"
   }
```

**File: `frontend/src/features/web-form/locales/ar.json`** line 5:

```diff
   "links": {
-    "chatPrompt": "تفضّل التحدث الآن؟",
+    "chatPrompt": "هل تفضّل التحدث الآن؟",
     "chat": "ابدأ محادثة مباشرة"
   },
```

No English (`en.json`) files change — this task is Arabic-content-only, matching intake Task 1's "edit translation resources only" constraint. No key is added, removed, or renamed in any of the 3 files — every `t(...)` call site is unaffected.

---

### 2 — `AttachmentsSection.tsx`'s `formatSize` moves units into the locale namespace (`UX-015`)

**File: `frontend/src/features/customers/components/AttachmentsSection.tsx`** lines 35-39 — `formatSize` becomes a plain helper taking a typed `t`, matching `ContactDetailsSection.tsx`'s own `channelOptions(t: TFunction<'customers'>)` precedent:

```diff
+import type { TFunction } from 'i18next'
+
 ...
-function formatSize(bytes: number): string {
-  if (bytes < 1024) return `${bytes} B`
-  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
-  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
-}
+function formatSize(bytes: number, t: TFunction<'customers'>): string {
+  if (bytes < 1024) return t('attachments.units.bytes', { value: bytes })
+  if (bytes < 1024 * 1024) {
+    return t('attachments.units.kilobytes', { value: (bytes / 1024).toFixed(1) })
+  }
+  return t('attachments.units.megabytes', { value: (bytes / (1024 * 1024)).toFixed(1) })
+}
```

The one call site, inside `AttachmentRow` (which already has `const { t } = useTranslation('customers')` at line 79):

```diff
-          {formatSize(attachment.size)}
+          {formatSize(attachment.size, t)}
```

Add `units` to `frontend/src/features/customers/locales/en.json`/`ar.json`, inside `attachments` (alongside the existing `fields`/`actions` keys):

```diff
     "fields": {
       "file": "File"
     },
+    "units": {
+      "bytes": "{{value}} B",
+      "kilobytes": "{{value}} KB",
+      "megabytes": "{{value}} MB"
+    },
     "actions": {
```

(`en.json`) and

```diff
     "fields": {
       "file": "الملف"
     },
+    "units": {
+      "bytes": "{{value}} بايت",
+      "kilobytes": "{{value}} كيلوبايت",
+      "megabytes": "{{value}} ميغابايت"
+    },
     "actions": {
```

(`ar.json` — the `fields` block's existing key is `"file": "الملف"`, shown above only to anchor the insertion point; do not actually change that line). `{{value}}` interpolation, not i18next's `{{count}}`-based plural forms, is used deliberately — a decimal size value ("1.5 KB") is not a countable plural, and Arabic's 6-way plural system (`_zero`/`_one`/`_two`/`_few`/`_many`/`_other`) does not apply meaningfully to a formatted decimal.

---

### 3 — `InternalNotesSection.tsx`'s delete-confirm copy matches its own "Remove" action (`UX-023`)

**File: `frontend/src/features/tickets/locales/en.json`** lines 156-159:

```diff
     "delete": {
-      "title": "Delete this note?",
+      "title": "Remove this note?",
       "description": "This permanently removes the note. This cannot be undone."
     },
```

**File: `frontend/src/features/tickets/locales/ar.json`** lines 156-159:

```diff
     "delete": {
-      "title": "حذف هذه الملاحظة؟",
+      "title": "هل تريد إزالة هذه الملاحظة؟",
       "description": "سيؤدي هذا إلى إزالة الملاحظة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
     },
```

The `ar.json` title gains the `هل تريد` ("do you want to") prefix, matching the exact pattern `customers/ar.json`'s own "Remove this X?" rows already use (`attachments.delete.title`: `"هل تريد إزالة هذا المرفق؟"`, `contacts.delete.title`: `"هل تريد إزالة قناة التواصل هذه؟"`) — not just a literal word-swap. No `.tsx` file changes; `InternalNotesSection.tsx` already reads both keys via `t('internalNotes.delete.title')`/`t('internalNotes.delete.description')` at lines 114-115, unchanged.

---

### 4 — FAQ bilingual model split (`UX-024`) — deferred, no task

See `## Prerequisites`. `backend/apps/knowledge_base/models.py`'s `FAQ` model has no `question_ar`/`answer_ar` fields; adding them needs a new migration, forbidden by the guardrail. Not attempted.

---

### 5 — `MarkdownPreview.tsx` gains `remark-gfm` (`UX-027`)

**File: `frontend/package.json`** — add a new dependency (run `npm install remark-gfm` from `frontend/` to resolve and pin the actual installed version; do not hand-write a version number):

```diff
     "react-markdown": "^10.1.0",
     "react-router": "^8.3.0",
+    "remark-gfm": "^4.0.0",
     "tailwind-merge": "^3.6.0",
```

(the `^4.0.0` above is a placeholder for whatever `npm install` actually resolves and writes — verify the real installed version in `package-lock.json` after running the install, and use that value here instead if it differs).

**File: `frontend/src/features/knowledge-base/components/MarkdownPreview.tsx`**:

```diff
 import Markdown from 'react-markdown'
+import remarkGfm from 'remark-gfm'

 /**
  * The one place `react-markdown` is imported. No `rehype-raw` / no
  * `dangerouslySetInnerHTML` — react-markdown does not execute embedded HTML
  * by default, which is what makes user-authored Markdown safe to render
  * with zero extra sanitization. `prose`/`prose-invert` (from
  * `@tailwindcss/typography`) style the output; `dir="auto"` lets the
  * browser pick per-paragraph direction for mixed English/Arabic content.
+ * `remark-gfm` adds GitHub-Flavored-Markdown syntax (tables, strikethrough,
+ * task lists, autolinked URLs) — without it these render as literal text
+ * (`UX-027`).
  */
 export function MarkdownPreview({ children }: { children: string }) {
   return (
     <div className="prose prose-sm dark:prose-invert max-w-none" dir="auto">
-      <Markdown>{children}</Markdown>
+      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
     </div>
   )
 }
```

This is the one component every Markdown consumer already goes through (`ArticleFormPage.tsx`'s preview tab via `MarkdownField.tsx`, `ArticleReaderPage.tsx`, `SearchPage.tsx`, and this story's own new `FaqBrowsePage.tsx` consumer added in task 6) — the fix lands once, at the shared-component level, per the guardrail's "fixes land at the shared-component/foundation level wherever possible" clause.

---

### 6 — `FaqBrowsePage.tsx` converges onto `MarkdownPreview`, matching `SearchPage.tsx` (`UX-031`, corrected/reversed)

**File: `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx`**:

```diff
 import { useTranslation } from 'react-i18next'
 import { Link } from 'react-router'

 import { Can } from '@/shared/auth'
 import { Button } from '@/shared/ui/primitives/button'
 import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
 import { QueryBoundary } from '@/shared/ui/QueryBoundary'
 import { Empty } from '@/shared/ui/Empty'
 import { PageHeader } from '@/shared/ui/PageHeader'

+import { MarkdownPreview } from './MarkdownPreview'
 import { useFaqs } from '../api/useFaqs'
 import type { Faq } from '../types/faq'
```

```diff
                 <CardHeader>
                   <CardTitle>{faq.question}</CardTitle>
                 </CardHeader>
-                <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
-                  {faq.answer}
-                </CardContent>
+                <CardContent>
+                  <MarkdownPreview>{faq.answer}</MarkdownPreview>
+                </CardContent>
```

Matches `ArticleReaderPage.tsx:44`'s own unwrapped `<MarkdownPreview>{...}</MarkdownPreview>` usage exactly — no extra wrapper classes; `MarkdownPreview`'s own `prose prose-sm dark:prose-invert max-w-none` classes replace the removed `whitespace-pre-wrap text-sm text-muted-foreground` (Markdown's own paragraph/line-break handling supersedes `whitespace-pre-wrap`). `SearchPage.tsx` is **not** changed — its FAQ branch already renders through `MarkdownPreview` correctly (see `## Prerequisites` for why switching it to plain text would regress the backend's `**bold**` search-highlight design).

---

### 7 — `ArticleListPage.tsx`'s manage-table title switches on UI language (`UX-032`)

**File: `frontend/src/features/knowledge-base/components/ArticleListPage.tsx`** line 22 and lines 43-51:

```diff
 export function ArticleListPage() {
-  const { t } = useTranslation('knowledgeBase')
+  const { t, i18n } = useTranslation('knowledgeBase')
+  const isArabic = i18n.language.startsWith('ar')
   const { date } = useFormatters()
```

```diff
   const columns: readonly ColumnDef<Article>[] = [
     {
       id: 'title_en',
-      header: t('articles.manage.fields.titleEn'),
+      header: t('articles.manage.fields.title'),
       sortable: true,
       cell: (row) => (
-        <Link to={`/knowledge-base/articles/manage/${row.id}/edit`}>{row.title_en}</Link>
+        <Link to={`/knowledge-base/articles/manage/${row.id}/edit`}>
+          {isArabic ? row.title_ar : row.title_en}
+        </Link>
       ),
     },
```

`id: 'title_en'` is **not** renamed — `ArticleViewSet.ordering_fields` (`backend/apps/knowledge_base/views.py:81`) only declares `title_en`, not `title_ar`, so the column's sort request must keep targeting `title_en` server-side even though its displayed text now switches with the UI language (see `## Edge Cases & Failure Modes`). Add `title` to `frontend/src/features/knowledge-base/locales/en.json`/`ar.json`, inside `articles.manage.fields` (alongside the existing `titleEn`/`titleAr` keys, which stay — they're still used by `ArticleFormPage.tsx`'s two-language section labels):

```diff
       "fields": {
+        "title": "Title",
         "titleEn": "Title (English)",
         "titleAr": "Title (Arabic)",
```

(`en.json`) and

```diff
       "fields": {
+        "title": "العنوان",
         "titleEn": "العنوان (بالإنجليزية)",
         "titleAr": "العنوان (بالعربية)",
```

(`ar.json`).

---

### 8 — Search-result highlighting (`UX-035`) — verified false positive, no task

See `## Prerequisites`. `backend/apps/knowledge_base/search.py`'s `SearchHeadline` already wraps matches in Markdown `**bold**`, not HTML — `MarkdownPreview` already renders this correctly. No file edited.

---

### 9 — `RoleFormPage.tsx`'s permission checklist gains human-readable descriptions (`UX-042`)

**File: `frontend/src/features/accounts/components/RoleFormPage.tsx`** — add a description-key helper near the existing `areaLabel` helper (lines 84-90):

```tsx
/** `<area>.<action>` → `roles.permissionDescriptions.<area>.<action>`, a
 * nested locale key mirroring the permission string's own shape — avoids
 * i18next treating a literal `.` inside a flat key as a path separator. */
function permissionDescriptionKey(permission: string): string {
  const [area, action] = permission.split('.')
  return `roles.permissionDescriptions.${area}.${action}`
}
```

Render it beside each permission's raw slug (lines 205-219):

```diff
                           {permissions.map((permission) => (
                             <div key={permission} className="flex items-center gap-2">
                               <Checkbox
                                 checked={field.value.includes(permission)}
                                 onCheckedChange={(checked) =>
                                   field.onChange(
                                     checked === true
                                       ? [...field.value, permission]
                                       : field.value.filter((p: string) => p !== permission),
                                   )
                                 }
                               />
-                              <span className="font-mono text-sm">{permission}</span>
+                              <div className="flex flex-col">
+                                <span className="font-mono text-sm">{permission}</span>
+                                <span className="text-xs text-muted-foreground">
+                                  {t(permissionDescriptionKey(permission))}
+                                </span>
+                              </div>
                             </div>
                           ))}
```

The raw slug itself stays untranslated and unstyled beyond its existing `font-mono text-sm`, per `CONVENTIONS.md` §23 (cited directly by the register's own suggested fix) — only the new secondary description line is translated. Add `permissionDescriptions` to `frontend/src/features/accounts/locales/en.json`, inside `roles` (alongside the existing `selectAllInGroup`/`deselectAllInGroup` keys), covering all 13 slugs from `backend/apps/core/permissions.py`'s `Permissions` class (lines 26-38) — the real, exhaustive list, not a guess:

```json
    "permissionDescriptions": {
      "users": {
        "view": "View staff user accounts",
        "manage": "Create, edit, and deactivate staff user accounts"
      },
      "roles": {
        "manage": "Create and edit roles and their permissions"
      },
      "customers": {
        "view": "View customer profiles and records",
        "manage": "Create, edit, and delete customer profiles"
      },
      "tickets": {
        "view": "View tickets and their details",
        "manage": "Create, edit, assign, and reply to tickets"
      },
      "knowledge_base": {
        "view": "View FAQs and help articles",
        "manage": "Create, edit, and publish FAQs and help articles"
      },
      "portal": {
        "access": "Access the customer self-service portal"
      },
      "audit_log": {
        "view": "View the system audit log"
      },
      "settings": {
        "manage": "Edit organization settings"
      },
      "reports": {
        "view": "View reports and analytics dashboards"
      }
    },
```

and the matching `frontend/src/features/accounts/locales/ar.json`:

```json
    "permissionDescriptions": {
      "users": {
        "view": "عرض حسابات المستخدمين الموظفين",
        "manage": "إنشاء حسابات المستخدمين الموظفين وتعديلها وإيقافها"
      },
      "roles": {
        "manage": "إنشاء الأدوار وتعديل صلاحياتها"
      },
      "customers": {
        "view": "عرض ملفات العملاء وسجلاتهم",
        "manage": "إنشاء ملفات العملاء وتعديلها وحذفها"
      },
      "tickets": {
        "view": "عرض التذاكر وتفاصيلها",
        "manage": "إنشاء التذاكر وتعديلها وإسنادها والرد عليها"
      },
      "knowledge_base": {
        "view": "عرض الأسئلة الشائعة والمقالات المساعدة",
        "manage": "إنشاء الأسئلة الشائعة والمقالات المساعدة وتعديلها ونشرها"
      },
      "portal": {
        "access": "الدخول إلى بوابة خدمة العملاء الذاتية"
      },
      "audit_log": {
        "view": "عرض سجل التدقيق"
      },
      "settings": {
        "manage": "تعديل إعدادات المؤسسة"
      },
      "reports": {
        "view": "عرض التقارير ولوحات التحليلات"
      }
    },
```

Every one of the 13 permission slugs `ALL_PERMISSIONS` (`backend/apps/core/permissions.py:41-45`) enumerates has a matching entry — `groupByArea`'s existing `permission.split('.')[0]` grouping guarantees every catalog entry served by `usePermissionCatalog()` is one of these 13, so no permission renders with a missing translation key.

---

### 10 — `TaskListPage.tsx`'s status filter gets a `title` (`UX-045`)

**File: `frontend/src/features/tasks/components/TaskListPage.tsx`** — compute the selected filter's label, matching `TicketListPage.tsx:133-138`'s `selectedCategoryLabel` pattern, then pass it as `title`:

```diff
   const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('pending')

+  const completedFilterLabel = {
+    pending: t('filters.pending'),
+    completed: t('filters.completedOnly'),
+    all: t('filters.all'),
+  }[completedFilter]
+
   useEffect(() => {
     setPage(1)
   }, [completedFilter, setPage])
```

```diff
       <Select
         value={completedFilter}
         onValueChange={(value) => setCompletedFilter(value as CompletedFilter)}
       >
-        <SelectTrigger aria-label={t('filters.completed')} size="sm" className="w-40">
+        <SelectTrigger
+          aria-label={t('filters.completed')}
+          title={completedFilterLabel}
+          size="sm"
+          className="w-40"
+        >
           <SelectValue />
         </SelectTrigger>
```

Matches `TicketAssigneeControl.tsx:59`'s `title={selectedAgentLabel}` and `TicketListPage.tsx:163`'s `title={selectedCategoryLabel}` — the exact fix `DSN-7` (Story 62) already applied to this same class of standalone `SelectTrigger` for `UX-020`. `w-40` stays unchanged (the register's alternative suggestion, relaxing to `min-w-40 w-auto`, is not applied — matching the precedent's own choice of `title` over a width change). No new locale keys — `filters.pending`/`filters.completedOnly`/`filters.all` already exist and are already used by the `SelectItem`s below.

---

### 11 — `TicketReportsPage.tsx`'s volume chart shows a truncation note (`UX-048`)

**File: `frontend/src/features/reports/components/TicketReportsPage.tsx`** lines 39-56 — `toChartSeries` returns the series count alongside the (still-capped) series list:

```diff
-function toChartSeries(rows: VolumePoint[], allTicketsLabel: string): ChartSeries[] {
+function toChartSeries(
+  rows: VolumePoint[],
+  allTicketsLabel: string,
+): { series: ChartSeries[]; totalCount: number } {
   if (rows.length === 0 || rows[0].series === undefined) {
-    return [{ key: 'total', label: allTicketsLabel, points: rows }]
+    return { series: [{ key: 'total', label: allTicketsLabel, points: rows }], totalCount: 1 }
   }
   const bySeries = new Map<string, VolumePoint[]>()
   for (const row of rows) {
     const key = row.series ?? 'total'
     const existing = bySeries.get(key)
     if (existing) {
       existing.push(row)
     } else {
       bySeries.set(key, [row])
     }
   }
-  return [...bySeries.entries()]
-    .slice(0, MAX_SERIES)
-    .map(([key, points]) => ({ key, label: key, points }))
+  return {
+    series: [...bySeries.entries()]
+      .slice(0, MAX_SERIES)
+      .map(([key, points]) => ({ key, label: key, points })),
+    totalCount: bySeries.size,
+  }
 }
```

Compute it once in the component body (not inside `ChartFrame`'s `children` render-prop — `ChartFrame.tsx:82` wraps `children` in a `<div role="img">`, which is the wrong place for a text note meant to be independently readable by assistive tech; `description` renders in `CardHeader`, outside that wrapper, at `ChartFrame.tsx:57`) and feed it to both the `description` prop and the chart itself:

```diff
   const volumeQuery = useTicketVolume(volumeParams)
+  const { series: volumeSeries, totalCount: volumeSeriesCount } = toChartSeries(
+    volumeQuery.data ?? [],
+    t('volume.allTickets'),
+  )
```

```diff
       <ChartFrame
         title={t('volume.title')}
-        description={t('volume.description')}
+        description={
+          volumeSeriesCount > MAX_SERIES
+            ? t('volume.seriesTruncated', { shown: MAX_SERIES, total: volumeSeriesCount })
+            : t('volume.description')
+        }
         query={volumeQuery}
         isEmpty={(rows) => rows.every((row) => row.value === 0)}
```

```diff
       >
-        {(rows) => (
-          <LineChart
-            series={toChartSeries(rows, t('volume.allTickets'))}
-            formatBucket={(b) => formatBucket(date, b)}
-          />
-        )}
+        {() => <LineChart series={volumeSeries} formatBucket={(b) => formatBucket(date, b)} />}
       </ChartFrame>
```

`toChartSeries` is called once, from `volumeQuery.data ?? []` (the same data the `children` render-prop would otherwise receive as `rows` — `ChartFrame` only calls `children` after `query.isSuccess`, so by the time it renders, `volumeQuery.data` is already the same non-empty array), so `volumeSeries`/`volumeSeriesCount` and what the chart renders are always in sync. Add `seriesTruncated` to `frontend/src/features/reports/locales/en.json`/`ar.json`, inside `volume` (alongside the existing `title`/`description`/`allTickets` keys):

```diff
   "volume": {
     "title": "Ticket volume over time",
     "description": "Tickets created in the selected period.",
+    "seriesTruncated": "Showing top {{shown}} of {{total}} series.",
     "allTickets": "All tickets"
   },
```

(`en.json`) and

```diff
   "volume": {
     "title": "حجم التذاكر عبر الزمن",
     "description": "التذاكر التي أُنشئت خلال الفترة المحددة.",
+    "seriesTruncated": "يعرض أفضل {{shown}} من أصل {{total}} سلسلة.",
     "allTickets": "كل التذاكر"
   },
```

(`ar.json`). Only the volume chart's `toChartSeries`/`MAX_SERIES` truncation is addressed — the breakdown chart below it (lines 220-255) has no equivalent cap (`BarChart`'s `categories` prop receives every row unsliced), so it needs no note.

---

### 12 — `RouteErrorBoundary.tsx` (`UX-056`) — verified false positive, no task

See `## Prerequisites`. `frontend/src/app/RouteErrorBoundary.tsx` already dropped `error.statusText`; the current fallback (`{error.status} {t('states.error.route')}`) is fully translated except the raw numeric HTTP status, which the register never objected to. No file edited.

---

### 13 — Register bookkeeping

**File: `design-system/supportos/UX-AUDIT.md`** — update the Status column for all 12 `content`/`bilingual` rows:

- `UX-012`, `UX-015`, `UX-023`, `UX-027`, `UX-032`, `UX-042`, `UX-045`, `UX-048` → `Resolved (Story 67)`
- `UX-024` → `Deferred — needs a backend FAQ model field (question_ar/answer_ar) + migration; outside DSN-6–DSN-13's frontend-only guardrail` (append "**Verified during Story 67:** `backend/apps/knowledge_base/models.py`'s `FAQ` model has only `question`/`answer`, no per-locale split, confirmed deliberate by its own doc comment. Same category of gap as `UX-019`/`UX-057`/`UX-030`/`UX-007`." to the Finding column)
- `UX-027` → append "**Corrected during Story 67 implementation:** confirmed `remark-gfm` was genuinely absent from `frontend/package.json`; added as a new dependency rather than deferred, since it is a plugin for an already-present renderer (`react-markdown`), not a new UI component/interaction primitive of the kind `UX-018` (Story 65) deferred." to the Finding column
- `UX-031` → `Resolved (Story 67) — corrected, opposite direction from the suggested fix` (append "**Corrected during Story 67 implementation:** making `SearchPage.tsx` plain-text (the register's suggestion) would have regressed `backend/apps/knowledge_base/search.py`'s deliberate `**bold**` search-highlight markup (verified via that file's own doc comment). `FaqBrowsePage.tsx` was converged onto `MarkdownPreview` instead, matching `SearchPage.tsx`, not the reverse." to the Finding column)
- `UX-035` → `Resolved (Story 67) — verified false positive, no code change needed` (append "**Verified during Story 67:** `backend/apps/knowledge_base/search.py`'s `SearchHeadline` wraps matches in Markdown `**bold**`, not HTML — confirmed by the module's own doc comment ('zero new HTML-safety surface'). There is no HTML for `MarkdownPreview` to escape; the finding's premise doesn't hold." to the Finding column)
- `UX-056` → `Resolved (Story 67) — verified false positive; already fixed as a side effect of Story 63's UX-055 remediation` (append "**Verified during Story 67:** `frontend/src/app/RouteErrorBoundary.tsx` no longer reads `error.statusText` at all (current lines 29-38) — already exactly the register's own suggested fix, evidently landed when Story 63 (`DSN-8`) rewrote this file for `UX-055` without the register being updated to match." to the Finding column)

Add a new summary paragraph after the `Story 66 (DSN-11)` paragraph:

```markdown
**Story 67 (`DSN-12`), content/bilingual findings:** 8 resolved as
recommended (`UX-012, UX-015, UX-023, UX-027, UX-032, UX-042, UX-045,
UX-048`; `UX-012` with a wider scope than cited — an extra dialectal
phrase found beyond the register's own citation, and one cited line
number corrected; `UX-027` by adding `remark-gfm`, a new dependency
justified as a plugin, not a new component library), 1 resolved with a
corrected, reversed-direction approach (`UX-031` — `FaqBrowsePage.tsx`
converged onto `MarkdownPreview`, not `SearchPage.tsx` converged to
plain text, since the backend's own search-highlight design depends on
Markdown rendering), 2 closed as verified false positives requiring no
code change (`UX-035` — search headlines are Markdown-bold, not HTML;
`UX-056` — already fixed as an uncredited side effect of Story 63's
`UX-055`), and 1 deferred (`UX-024`, needing a backend FAQ model field +
migration) — of the 12 findings originally catalogued as `content`/
`bilingual`. No new finding was discovered during this story's
implementation.
```

The header **Totals** line (`**Totals: 69 findings**...`) stays at 69 — no new row is added this story; only Status values change.

---

## Edge Cases & Failure Modes

- **`ArticleListPage.tsx`'s sort still targets `title_en` even though the displayed text now switches to Arabic** — `ArticleViewSet.ordering_fields` (`backend/apps/knowledge_base/views.py:81`) has no `title_ar` entry; sorting by the displayed (Arabic) title isn't possible without a backend change, out of scope here. Clicking the column header in `ar` UI still sorts alphabetically by the English title underneath — a pre-existing limitation this fix does not introduce or worsen, since the column previously always showed (and implicitly sorted by) `title_en` anyway.
- **`FaqBrowsePage.tsx`'s FAQ answers can now contain incidental Markdown syntax** — staff-authored FAQ `answer` text that happens to include a literal `*`, `_`, `#`, or backtick will now render as Markdown emphasis/heading/code instead of literal punctuation, the same tradeoff `ArticleReaderPage.tsx`/`SearchPage.tsx` already accept for their own Markdown-rendered content. `MarkdownPreview`'s own "no `rehype-raw`/no `dangerouslySetInnerHTML`" design (`MarkdownPreview.tsx:3-6`) means this introduces no XSS surface — worst case is a staff-authored FAQ rendering slightly differently than typed, not a security issue.
- **`remark-gfm`'s exact resolved version is not knowable without running `npm install` in this planning session** — the `^4.0.0` placeholder in task 5 must be replaced with whatever `package-lock.json` actually records after the install; do not hand-edit a version number without running the installer.
- **`RoleFormPage.tsx`'s new `permissionDescriptions` lookup silently renders nothing if a permission slug's area/action isn't a key in the locale JSON** — every one of `ALL_PERMISSIONS`'s 13 current entries has a matching key (verified against `backend/apps/core/permissions.py:26-38`), but a **future** permission added to that Python class without a matching locale-key pair added here would render an empty (i18next's own missing-key fallback, typically the raw key string) description line, not a crash. Not a risk today; worth a comment if this pattern is copied elsewhere.
- **`TicketReportsPage.tsx`'s new `volumeSeriesCount > MAX_SERIES` check only guards the "series by" grouped case** — when `series` is `'none'` (no dimension selected), `toChartSeries` always returns `totalCount: 1`, so the truncation note never renders in that state, correctly matching the fact that there's only ever 1 series ("All tickets") to show.
- **`InternalNotesSection.tsx`'s title-only copy change (`UX-023`) does not touch `description`** — `"This permanently removes the note. This cannot be undone."` already matches the "Remove" pairing's phrasing (`removes`, not `deletes`); only `title` needed the swap.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend file is changed by this story — `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — `npm run build` specifically catches a missing `remark-gfm` type declaration or an unused import left behind by task 11's `toChartSeries` return-shape change.
3. After `npm install remark-gfm` (task 5), confirm `frontend/package-lock.json` records the resolved version and `frontend/node_modules/remark-gfm` exists before running the build.
4. Manual verification only beyond that, per `## Verification Steps` below.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Dialectal Arabic replaced:** load `/login`, `/chat`, `/contact` in `ar` — the "Not a staff member?" link, the live-chat start/empty-state copy, and the web-form chat-prompt link all read in formal MSA (no `مش`/`هيرد`/`هنوصلك`/`لسه`/`مفيش`/`رسايل`/`بالإيميل` anywhere in those 3 screens).
3. **Attachment sizes localized:** on `/customers/:id`, upload a file — its size renders as "N B"/"N.N KB"/"N.N MB" in `en`, and with the Arabic unit words in `ar`.
4. **Internal note delete copy:** on `/tickets/:id`, click "Remove" under an internal note — the confirm dialog now reads "Remove this note?" in `en` / "هل تريد إزالة هذه الملاحظة؟" in `ar`, matching the button's own "Remove" label.
5. **Markdown GFM rendering:** on `/knowledge-base/articles/manage/new`, type a GFM table or a `~~strikethrough~~` into the body and switch to the Preview tab — it renders as a real table/strikethrough, not literal `|`/`~~` characters. Repeat on a published article's `/knowledge-base/articles/:id` reader view.
6. **FAQ browse/search consistency:** on `/knowledge-base`, an FAQ answer containing `**bold**` renders bold (not literal asterisks); on `/knowledge-base/search`, searching for a term inside that same FAQ shows the matched term in bold in both the browse and search views.
7. **Article manage table title language:** on `/knowledge-base/articles/manage` in `ar`, the title column shows each article's Arabic title, not English; switch to `en` — it shows the English title again.
8. **Permission descriptions:** on `/roles/new`, each permission checkbox now shows a short description beneath its raw slug, in both `en` and `ar`; every one of the ~13 listed permissions has a non-empty description (no raw untranslated key visible).
9. **Task status filter title:** on `/tasks`, hover the status filter with a value selected — a native tooltip shows the full selected option's label.
10. **Report series truncation note:** on `/reports/tickets`, pick a "series by" dimension with more than 5 distinct values in the selected date range — a "Showing top 5 of N" note appears above the volume chart; pick "No series" or a dimension with ≤5 values — the note disappears and the normal description text returns.
11. **Route error boundary:** trigger a 404 (visit an unknown route) — confirm no raw English HTTP reason phrase appears in the `ar` UI (already expected to pass, since this is a verified false positive, not a new fix).
12. **`UX-AUDIT.md` register:** all 12 `content`/`bilingual` rows show an updated Status (8 `Resolved (Story 67)` variants, `UX-031`'s corrected note, `UX-035`/`UX-056`'s false-positive notes, `UX-024`'s `Deferred` note); the new `Story 67 (DSN-12)` summary paragraph is present; the header **Totals** line still reads 69.
13. Repeat steps 2-10 in **both** `en`/LTR and `ar`/RTL to confirm no layout regression (permission-description text wrapping, the truncation note's placement, the new `MarkdownPreview` FAQ rendering all still read correctly mirrored in RTL). **Live browser verification may not be possible depending on available tooling** — Story 66 (the immediately prior story in this thread) explicitly recorded that no Playwright/browser-automation tool was available in its session; if the same is true here, perform these checks manually in a running dev server instead, and note explicitly in the implementation report whether live verification was actually completed or remains outstanding — do not claim it was done if it wasn't.

---

## Done Criteria

- [ ] `auth/ar.json`, `live-chat/ar.json`, `web-form/ar.json` — all 6 dialectal phrases rewritten to formal MSA; no key added/removed/renamed; no `en.json` file changed.
- [ ] `AttachmentsSection.tsx` — `formatSize` takes a `t: TFunction<'customers'>` param and reads unit strings from `attachments.units.*`; new locale keys added (`en`/`ar`).
- [ ] `tickets/en.json`/`ar.json` — `internalNotes.delete.title` changed to "Remove this note?" / "هل تريد إزالة هذه الملاحظة؟"; no `.tsx` file touched.
- [ ] No backend file changed for `UX-024` — confirmed deferred in the register.
- [ ] `frontend/package.json` — `remark-gfm` added as a dependency with its actual resolved version (not a placeholder); `MarkdownPreview.tsx` passes `remarkPlugins={[remarkGfm]}`.
- [ ] `FaqBrowsePage.tsx` — FAQ answers render through `MarkdownPreview`; `SearchPage.tsx` unchanged.
- [ ] `ArticleListPage.tsx` — title column switches on `i18n.language`; `id: 'title_en'` unchanged for sorting; new `articles.manage.fields.title` locale key added (`en`/`ar`).
- [ ] No code change for `UX-035` — confirmed verified false positive in the register.
- [ ] `RoleFormPage.tsx` — each permission renders a secondary description line via the new `permissionDescriptionKey` helper; all 13 `Permissions` slugs have a matching `roles.permissionDescriptions.*` key (`en`/`ar`).
- [ ] `TaskListPage.tsx` — status filter `SelectTrigger` gets `title={completedFilterLabel}`; no new locale keys.
- [ ] `TicketReportsPage.tsx` — `toChartSeries` returns `{ series, totalCount }`; the volume `ChartFrame`'s `description` shows a truncation note only when `totalCount > MAX_SERIES`; new `volume.seriesTruncated` locale key added (`en`/`ar`).
- [ ] No code change for `UX-056` — confirmed verified false positive in the register.
- [ ] `design-system/supportos/UX-AUDIT.md` — all 12 rows' Status updated; 5 rows (`UX-024`, `UX-027`, `UX-031`, `UX-035`, `UX-056`) get an appended Finding-column note; new `Story 67 (DSN-12)` summary paragraph added; header **Totals** line confirmed still 69.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `design-system/supportos/UX-AUDIT.md` only (plus this plan's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-13, in both `en`/LTR and `ar`/RTL, if browser-automation tooling is available in the implementation session; otherwise explicitly reported as outstanding, not silently skipped.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-13` (`SupportOs backlog.MD:620-626`) remains unplanned — the closing verification pass, re-walking the full 69-row register across both languages/directions and both color modes, confirming every critical/major item resolved with no regressions, before the epic's EPIC 9 (Knowledge Base) dependency is considered safe to build on. `UX-024` remains deferred pending a decision on a dedicated non-`DSN` backend story or an explicit guardrail exception, alongside the other still-deferred items from Stories 62/63/66 (`UX-030`, the `Task` portion of `UX-038`, `UX-007`, `UX-019`, `UX-057`) and the still-open bulk-row-action items (`UX-016`/`UX-028`) and `UX-018`'s full-combobox alternative.
