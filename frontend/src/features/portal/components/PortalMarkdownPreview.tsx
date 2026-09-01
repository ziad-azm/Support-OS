import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Duplicated verbatim from `features/knowledge-base/components/
 * MarkdownPreview.tsx` — `no-restricted-imports` forbids importing it
 * across the feature boundary. No `rehype-raw` / no
 * `dangerouslySetInnerHTML` — react-markdown does not execute embedded
 * HTML by default. `remarkGfm` kept in sync with the staff version
 * (SUPPORTOS-105 `UX-027`) — without it, the same article's GFM tables/
 * strikethrough/task lists rendered correctly for staff but as literal
 * Markdown text for portal customers.
 */
export function PortalMarkdownPreview({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto" dir="auto">
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  )
}
