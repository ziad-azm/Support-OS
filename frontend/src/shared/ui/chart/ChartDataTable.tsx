import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table'

type ChartDataTableProps = {
  /** Already-translated column headers, in order. */
  columns: readonly string[]
  /** Already-formatted cell text, row-major. */
  rows: readonly (readonly string[])[]
  /** Visually-hidden <caption>, same requirement as DataTable's. */
  caption: string
}

/**
 * The accessibility fallback every `ChartFrame` requires (CONVENTIONS.md
 * § 25 lines 1638-1642) — a plain, unpaginated, unsorted table. Not
 * `DataTable`: that component is bound to `Page<T>`/server pagination and
 * would need a fake pagination block to satisfy its props.
 *
 * Does no formatting and no translation — every consumer builds `rows`
 * through `useFormatters()` first, which is what keeps this trivially
 * correct in both languages.
 */
export function ChartDataTable({ columns, rows, caption }: ChartDataTableProps) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
