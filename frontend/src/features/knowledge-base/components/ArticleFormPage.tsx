import { useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { MarkdownField } from './MarkdownField'
import { useCategories } from '../api/useCategories'
import { useCreateArticle, useUpdateArticle } from '../api/useArticleMutations'
import { useArticle } from '../api/useArticle'
import { ARTICLE_STATUSES } from '../types/article'
import type { Article, ArticleInput } from '../types/article'

// Radix's `Select.Item` requires a non-empty `value` — this sentinel stands
// in for "no category", the same role `TicketFormPage`'s `CATEGORY_NONE`
// plays for its own optional `category`.
const CATEGORY_NONE = 'none'

const schema = z.object({
  title_en: requiredString(200),
  title_ar: requiredString(200),
  // No backend max_length mirrored here — `Article.body_*` are plain
  // `TextField()`s with no database cap, the same reasoning
  // `TicketFormPage`'s `description` schema already documents.
  body_en: requiredString(20000),
  body_ar: requiredString(20000),
  category: z.string(),
  status: choice(ARTICLE_STATUSES),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = {
  title_en: '',
  title_ar: '',
  body_en: '',
  body_ar: '',
  category: CATEGORY_NONE,
  status: 'draft',
}

function toDefaults(article: Article): FormValues {
  return {
    title_en: article.title_en,
    title_ar: article.title_ar,
    body_en: article.body_en,
    body_ar: article.body_ar,
    category: article.category === null ? CATEGORY_NONE : String(article.category),
    status: article.status,
  }
}

function toArticleInput(values: FormValues): ArticleInput {
  return {
    title_en: values.title_en,
    title_ar: values.title_ar,
    body_en: values.body_en,
    body_ar: values.body_ar,
    category: values.category === CATEGORY_NONE ? null : Number(values.category),
    status: values.status,
  }
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function ArticleFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const articleQuery = useArticle(id, { enabled: isEdit })

  if (!isEdit) {
    return <ArticleForm mode="create" />
  }

  return (
    <QueryBoundary query={articleQuery}>
      {(article) => <ArticleForm mode="edit" id={id} article={article} />}
    </QueryBoundary>
  )
}

function ArticleForm({
  mode,
  id,
  article,
}: {
  mode: 'create' | 'edit'
  id?: number
  article?: Article
}) {
  const { t } = useTranslation('knowledgeBase')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const categoriesQuery = useCategories()

  const form = useAppForm({
    schema,
    defaultValues: article ? toDefaults(article) : EMPTY_DEFAULTS,
  })
  useUnsavedChangesGuard(form.formState.isDirty)

  const createMutation = useCreateArticle()
  const updateMutation = useUpdateArticle(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toArticleInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'articles.manage.created' : 'articles.manage.updated'),
        })
        // `flushSync`, not a bare call: `form.reset` schedules a state
        // update but does not itself commit before this function returns,
        // so `navigate()` on the next line would run against `useBlocker`'s
        // still-stale `isDirty=true` closure from before the reset — the
        // guard would block this very navigation right after a successful
        // save. Forcing the commit first is what actually clears it in time.
        flushSync(() => form.reset(values))
        navigate('/knowledge-base/articles/manage')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  const categoryOptions =
    categoriesQuery.data?.items.map((category) => ({
      value: String(category.id),
      label: category.name,
    })) ?? []

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {t(mode === 'create' ? 'articles.manage.new' : 'articles.manage.edit')}
      </h1>
      {categoriesQuery.isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('articles.manage.sections.english')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="title_en"
                  label={t('articles.manage.fields.titleEn')}
                />
                <MarkdownField
                  control={form.control}
                  name="body_en"
                  label={t('articles.manage.fields.bodyEn')}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('articles.manage.sections.arabic')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="title_ar"
                  label={t('articles.manage.fields.titleAr')}
                  dir="auto"
                />
                <MarkdownField
                  control={form.control}
                  name="body_ar"
                  label={t('articles.manage.fields.bodyAr')}
                  dir="auto"
                />
              </CardContent>
            </Card>
            <SelectField
              control={form.control}
              name="category"
              label={t('articles.manage.fields.category')}
              options={[
                { value: CATEGORY_NONE, label: t('articles.manage.fields.noCategory') },
                ...categoryOptions,
              ]}
            />
            <SelectField
              control={form.control}
              name="status"
              label={t('articles.manage.fields.status')}
              options={ARTICLE_STATUSES.map((value) => ({
                value,
                label: t(`articles.manage.statuses.${value}`),
              }))}
            />
            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>
              {t('articles.manage.actions.save')}
            </SubmitButton>
          </form>
        </Form>
      )}
    </div>
  )
}
