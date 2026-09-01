import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * The one place `react-markdown` is imported. No `rehype-raw` / no
 * `dangerouslySetInnerHTML` — react-markdown does not execute embedded HTML
 * by default, which is what makes user-authored Markdown safe to render
 * with zero extra sanitization. `prose`/`prose-invert` (from
 * `@tailwindcss/typography`) style the output; `dir="auto"` lets the
 * browser pick per-paragraph direction for mixed English/Arabic content.
 * `remark-gfm` adds GitHub-Flavored-Markdown syntax (tables, strikethrough,
 * task lists, autolinked URLs) — without it these render as literal text
 * (`UX-027`).
 */
export function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none" dir="auto">
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  )
}
