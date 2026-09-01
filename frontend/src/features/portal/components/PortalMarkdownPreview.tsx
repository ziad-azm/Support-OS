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
    <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto" dir="auto">
      <Markdown>{children}</Markdown>
    </div>
  )
}
