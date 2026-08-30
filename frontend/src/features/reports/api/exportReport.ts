import { downloadFile } from '@/shared/lib/download'

/** `?export=csv` on the same URL and params the chart already reads, so the
 * file and the chart can never disagree (CONVENTIONS.md § 27 point 5). The
 * param is `export`, NOT `format` — § 27 point 4. */
export function exportReport(
  path: string,
  filename: string,
  params: Record<string, unknown>,
): Promise<void> {
  return downloadFile(path, `${filename}.csv`, { ...params, export: 'csv' })
}
