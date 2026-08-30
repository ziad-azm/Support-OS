import { httpClient } from '@/shared/lib/api/client'

/**
 * Fetch a URL as a blob through the authenticated `httpClient` and hand it
 * to the browser's own save flow.
 *
 * Cannot be a plain `<a href>` link — the API is Bearer-token authenticated
 * and a browser navigation carries no `Authorization` header. Not
 * `api.get()` either: the body is a raw file, not the JSON envelope
 * `unwrap()` expects (`shared/lib/api/client.ts:102-127`).
 *
 * Promoted verbatim from `features/customers/api/downloadAttachment.ts`
 * (Story 21) by RPT-0, which needs the same mechanism for CSV export and
 * cannot import across a feature boundary (`.oxlintrc.json`
 * no-restricted-imports). Attachments is its first caller; a report
 * screen's export button is the second.
 */
export async function downloadFile(
  url: string,
  filename: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const response = await httpClient.get(url, { responseType: 'blob', params })
  const objectUrl = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}
