import { httpClient } from '@/shared/lib/api/client'

/**
 * Cannot be a plain `<a href>` link — the API is Bearer-token
 * authenticated, and a browser navigation carries no `Authorization`
 * header. Fetches the file as a blob through the same authenticated
 * `httpClient` instance instead (not `api.get()` — the response body is a
 * raw file stream, not the JSON envelope `unwrap()` expects), then
 * triggers the browser's own save flow via a temporary object-URL link.
 * See Story 21 `## Prerequisites`.
 */
export async function downloadAttachment(id: number, filename: string): Promise<void> {
  const response = await httpClient.get(`/attachments/${id}/download/`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
