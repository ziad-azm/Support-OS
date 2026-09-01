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
        <p className="mt-1 text-xs text-muted-foreground">
          {t('articles.manage.editorTabs.markdownSupported')}{' '}
          <a
            href="https://commonmark.org/help/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {t('articles.manage.editorTabs.markdownGuide')}
          </a>
        </p>
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
