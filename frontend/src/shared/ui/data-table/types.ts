import type { ReactNode } from 'react'

export type SortDirection = 'asc' | 'desc'

/** `null` means "server default order". */
export type SortState = { field: string; direction: SortDirection } | null

export type ColumnDef<T> = {
  /**
   * Stable identity. When `sortable` is true this is also the field name sent
   * as `?ordering=`, so it must match the backend serializer field exactly.
   */
  id: string
  /** Header copy, already translated by the caller. */
  header: string
  cell: (row: T) => ReactNode
  /** Opt into server-side sorting. Default: false. */
  sortable?: boolean
  /**
   * Logical alignment. `'end'` for numeric columns. Rendered with the
   * logical start/end text-alignment utility — never a physical one.
   */
  align?: 'start' | 'end'
  /** Hide this column below the `sm` breakpoint (640px). Omit (default:
   *  always visible) for columns essential at every width. Purely a
   *  presentation hint — the column's data is still in `query.data`,
   *  still exportable, still reachable via the row's own detail page. */
  priority?: 'always' | 'sm'
}

/** Multi-select wiring for `DataTable` — opt-in per screen (TKT-7).
 * Row identity is `rowKey(row)`, the SAME string `DataTableProps.rowKey`
 * already computes, so selection needs no separate per-`T` id type.
 */
export type DataTableSelection = {
  /** Currently-selected row keys. The CALLER owns clearing this on
   * sort/filter/page changes — `DataTable` itself never clears it. See
   * CONVENTIONS.md §19's "Bulk selection" paragraph. */
  selectedIds: ReadonlySet<string>
  onSelectionChange: (next: ReadonlySet<string>) => void
}
