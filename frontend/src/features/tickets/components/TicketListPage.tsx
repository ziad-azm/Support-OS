import { useEffect, useRef, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can, useAuth } from '@/shared/auth'
import { useBranches } from '@/shared/branches'
import { useDepartments } from '@/shared/departments'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Label } from '@/shared/ui/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { Switch } from '@/shared/ui/primitives/switch'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { TableLink } from '@/shared/ui/data-table/TableLink'
import type { ColumnDef, SortState } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useCategories } from '../api/useCategories'
import { useSavedViews } from '../api/useSavedViews'
import { useTickets } from '../api/useTickets'
import { slaStatusVariant, ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'
import { SavedViewBar } from './SavedViewBar'
import { TicketBulkActionBar } from './TicketBulkActionBar'
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types/ticket'
import type { Ticket } from '../types/ticket'

const SEARCH_DEBOUNCE_MS = 300

/**
 * The list screen. Copies `CustomerListPage`'s shape exactly — see Story 12
 * `## Context — Read These Files First`.
 *
 * Not wrapped in `QueryBoundary` — `DataTable` renders its own loading/empty
 * /error rows. See `DataTable`'s docstring.
 */
export function TicketListPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { user, can } = useAuth()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // "all" is the sentinel for "no filter" — Radix's Select.Item requires a
  // non-empty value, mirroring the form's CATEGORY_NONE sentinel.
  const [categoryFilter, setCategoryFilter] = useState('all')
  // F-8: the backend has validated `?status=` since TKT-4
  // (`apps/tickets/views.py`), but nothing ever sent it — "show me the
  // open tickets" was the one filter a support queue could not do.
  // Same `'all'` sentinel contract as the four filters around it.
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  // ORG-4: these two filters START on the caller's own department/branch
  // instead of 'all', so the default view is the INTERSECTION of both —
  // `apply_scope_filters` chains a `.filter()` per param, so sending both
  // ANDs them (CONVENTIONS.md §33). An agent holding department 6 and
  // branch 6 sees the 6 tickets that are actually theirs, not the 12 in
  // their department or the 17 in their branch.
  //
  // A DEFAULT, NOT A BOUNDARY. The `Select`s below still offer "All
  // departments"/"All branches", and the backend is untouched — any
  // caller with `tickets.view` can still list everything, exactly as
  // §33's "a scope filter is not an access boundary" paragraph says.
  // Uniform across roles by design: a manager with no department set
  // gets 'all' from this same rule, with no role check. See §33's
  // "Default list scope (ORG-4)" subsection for the full decision.
  //
  // "all" is "no filter"; the literal "none" is a real, distinct filter
  // value — the backend's own `?department=none` sentinel for "no
  // department" (`apps.core.scoping.UNSCOPED`) — so it needs no
  // client-side translation before it reaches `useTickets`.
  const [departmentFilter, setDepartmentFilter] = useState(
    user?.department ? String(user.department.id) : 'all',
  )
  // Same two-sentinel contract as `departmentFilter` above (ORG-2).
  const [branchFilter, setBranchFilter] = useState(user?.branch ? String(user.branch.id) : 'all')
  const [onlyMine, setOnlyMine] = useState(false)
  // TKT-7: page-scoped only — cleared on every sort/filter/page change
  // below, never carried forward silently. See CONVENTIONS.md §19's
  // "Bulk selection" paragraph.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const canBulkAct = can('tickets.manage')
  // TKT-8: which saved view (if any) the current filters were last applied
  // from. Purely a "what did I start from" pointer for the switcher's own
  // rename/delete/set-default targeting — NOT a live binding. Changing a
  // filter afterward does not clear this, because a saved view is a
  // starting point the agent can still change, never a lock (ORG-4's own
  // "default, not a boundary" rule, reused verbatim here).
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null)
  const savedViewsQuery = useSavedViews()
  const appliedDefaultRef = useRef(false)
  const categoriesQuery = useCategories()
  const departmentsQuery = useDepartments()
  const branchesQuery = useBranches()

  function applyFilters(filters: Record<string, string>) {
    setSearchInput(filters.search ?? '')
    setSearch(filters.search ?? '')
    setCategoryFilter(filters.category ?? 'all')
    setStatusFilter(filters.status ?? 'all')
    setPriorityFilter(filters.priority ?? 'all')
    setDepartmentFilter(filters.department ?? 'all')
    setBranchFilter(filters.branch ?? 'all')
    setOnlyMine(filters.assigned_to_me === 'true')
    if (filters.ordering) {
      const desc = filters.ordering.startsWith('-')
      setSort({
        field: desc ? filters.ordering.slice(1) : filters.ordering,
        direction: desc ? 'desc' : 'asc',
      })
    } else {
      setSort(null)
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // A filter change narrows the result set the same way a search does —
  // reset to page 1, or the user can land on a now-nonexistent page. A
  // narrowed/reordered result set could also silently no longer contain a
  // selected row, so selection is cleared here too — TKT-7.
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [
    search,
    categoryFilter,
    statusFilter,
    priorityFilter,
    departmentFilter,
    branchFilter,
    onlyMine,
    setPage,
  ])

  // TKT-8: applies the caller's OWN default saved view (if any) ONCE,
  // after `useSavedViews()` resolves — it cannot run any earlier, since
  // the saved-views list is genuinely async (unlike `user.department`,
  // which `useAuth()` already resolves synchronously by the time this
  // page mounts, see ORG-4 `## Prerequisites`). This means the list can
  // paint ONE extra request under ORG-4's own department/branch defaults
  // before this effect fires and re-applies the saved default — a known,
  // accepted cost (see Story 108 `## Edge Cases`), not a regression of
  // ORG-4's own synchronous guarantee for a caller with NO default view,
  // who is fully unaffected by this effect (the `find` below returns
  // `undefined` and nothing happens).
  useEffect(() => {
    if (appliedDefaultRef.current) return
    if (!savedViewsQuery.isSuccess) return
    appliedDefaultRef.current = true
    const defaultView = savedViewsQuery.data.items.find(
      (view) => view.owner === user?.id && view.is_default,
    )
    if (defaultView) {
      applyFilters(defaultView.filters)
      setSelectedViewId(defaultView.id)
    }
  }, [savedViewsQuery.isSuccess, savedViewsQuery.data, user])

  // Clears the switcher's selection whenever the currently-selected view
  // disappears from a refetched list (deleted by its owner or, for a
  // shared view, by a manager).
  useEffect(() => {
    if (selectedViewId === null || !savedViewsQuery.isSuccess) return
    const stillExists = savedViewsQuery.data.items.some((view) => view.id === selectedViewId)
    if (!stillExists) setSelectedViewId(null)
  }, [selectedViewId, savedViewsQuery.isSuccess, savedViewsQuery.data])

  function handleSortChange(next: SortState) {
    setSelectedIds(new Set())
    setSort(next)
  }

  function handlePageChange(next: number) {
    setSelectedIds(new Set())
    setPage(next)
  }

  const filterParams: Record<string, string> = {
    ...(search ? { search } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter } : {}),
    ...(departmentFilter !== 'all' ? { department: departmentFilter } : {}),
    ...(branchFilter !== 'all' ? { branch: branchFilter } : {}),
    ...(onlyMine ? { assigned_to_me: 'true' } : {}),
    ...(sort ? { ordering: `${sort.direction === 'desc' ? '-' : ''}${sort.field}` } : {}),
  }
  const query = useTickets({ ...params, ...filterParams })

  const columns: readonly ColumnDef<Ticket>[] = [
    {
      id: 'subject',
      header: t('fields.subject'),
      sortable: true,
      cell: (row) => <TableLink to={`/tickets/${row.id}`}>{row.subject}</TableLink>,
    },
    {
      id: 'customer_name',
      header: t('fields.customer'),
      // Not sortable: `customer_name` is not in the viewset's `ordering_fields`
      // — the same choice Story 10 made for `Customer.phone`.
      cell: (row) => row.customer_name,
    },
    {
      id: 'category_name',
      header: t('fields.category'),
      // Not sortable: mirrors `customer_name`'s precedent (Story 12) — a
      // joined/derived display column, not in the viewset's
      // `ordering_fields`. See Story 18 `## Prerequisites`.
      cell: (row) => row.category_name ?? t('fields.noCategory'),
      priority: 'sm',
    },
    {
      id: 'department_name',
      header: t('fields.department'),
      // Not sortable: mirrors `category_name`'s precedent — a
      // joined/derived display column, not in the viewset's
      // `ordering_fields` (ORG-1).
      cell: (row) => row.department_name ?? t('fields.noDepartment'),
      priority: 'sm',
    },
    {
      id: 'branch_name',
      header: t('fields.branch'),
      // Not sortable: mirrors `department_name`'s precedent — a
      // joined/derived display column, not in the viewset's
      // `ordering_fields` (ORG-2).
      cell: (row) => row.branch_name ?? t('fields.noBranch'),
      priority: 'sm',
    },
    {
      id: 'assigned_agent_name',
      header: t('fields.assignedAgent'),
      // Not sortable: a joined display column absent from the viewset's
      // `ordering_fields`, same as `customer_name`/`category_name`.
      cell: (row) => row.assigned_agent_name ?? t('fields.unassigned'),
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      cell: (row) => (
        <Badge variant={ticketStatusVariant(row.status)}>{t(`statuses.${row.status}`)}</Badge>
      ),
    },
    {
      // F-9: the queue's whole point is spotting what is breaching. Not
      // `sortable` — `sla_status` is computed per row from annotations, not
      // a database column, so `?ordering=sla_status` cannot work; the
      // backend deliberately omits it from `ordering_fields`.
      id: 'sla_status',
      header: t('fields.slaStatus'),
      priority: 'sm',
      cell: (row) =>
        row.sla_status === null ? (
          <span className="text-muted-foreground">{'—'}</span>
        ) : (
          <Badge variant={slaStatusVariant(row.sla_status)}>
            {t(`slaStatuses.${row.sla_status}`)}
          </Badge>
        ),
    },
    {
      id: 'priority',
      header: t('fields.priority'),
      sortable: true,
      cell: (row) => (
        <Badge variant={ticketPriorityVariant(row.priority)}>
          {t(`priorities.${row.priority}`)}
        </Badge>
      ),
    },
    {
      id: 'created_at',
      header: t('fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
      priority: 'sm',
    },
  ]

  const selectedCategoryLabel =
    categoryFilter === 'all'
      ? t('filters.allCategories')
      : (categoriesQuery.data?.items ?? []).find(
          (category) => String(category.id) === categoryFilter,
        )?.name

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        action={
          <Can permission="tickets.manage">
            <Button asChild>
              <Link to="/tickets/new">
                <PlusIcon />
                {t('new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
      />
      <SavedViewBar
        filters={filterParams}
        selectedViewId={selectedViewId}
        onSelectView={setSelectedViewId}
        onApply={applyFilters}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger aria-label={t('filters.category')} title={selectedCategoryLabel} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {(categoriesQuery.data?.items ?? []).map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label={t('filters.status')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            {TICKET_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`statuses.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger aria-label={t('filters.priority')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allPriorities')}</SelectItem>
            {TICKET_PRIORITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`priorities.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger aria-label={t('filters.department')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allDepartments')}</SelectItem>
            <SelectItem value="none">{t('fields.noDepartment')}</SelectItem>
            {(departmentsQuery.data?.items ?? []).map((department) => (
              <SelectItem key={department.id} value={String(department.id)}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger aria-label={t('filters.branch')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allBranches')}</SelectItem>
            <SelectItem value="none">{t('fields.noBranch')}</SelectItem>
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <SelectItem key={branch.id} value={String(branch.id)}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="only-mine"
            checked={onlyMine}
            onCheckedChange={setOnlyMine}
            aria-label={t('filters.onlyMine')}
          />
          <Label htmlFor="only-mine" className="text-sm">
            {t('filters.onlyMine')}
          </Label>
        </div>
      </div>
      <TicketBulkActionBar selectedIds={selectedIds} onDone={() => setSelectedIds(new Set())} />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        caption={t('title')}
        selection={canBulkAct ? { selectedIds, onSelectionChange: setSelectedIds } : undefined}
        empty={
          search ? (
            <Empty title={t('noSearchResults')} />
          ) : (
            <Empty title={t('empty')} description={t('emptyDescription')} />
          )
        }
      />
    </div>
  )
}
