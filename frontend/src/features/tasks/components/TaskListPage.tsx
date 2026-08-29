import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useCompleteTask, useDeleteTask, useReopenTask } from '../api/useTaskMutations'
import { useTasks } from '../api/useTasks'
import type { Task } from '../types/task'

// Sentinel values, the same role `MyTicketsPage`'s `"all"` plays
// (CONVENTIONS.md §19) — "pending"/"completed" map to the boolean
// `completed` query param, `"all"` omits it.
type CompletedFilter = 'all' | 'pending' | 'completed'

export function TaskListPage() {
  const { t } = useTranslation('tasks')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'due_at', direction: 'asc' },
  })

  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('pending')

  useEffect(() => {
    setPage(1)
  }, [completedFilter, setPage])

  const query = useTasks({
    ...params,
    ...(completedFilter === 'all'
      ? {}
      : { completed: completedFilter === 'completed' ? 'true' : 'false' }),
  })

  const completeMutation = useCompleteTask()
  const reopenMutation = useReopenTask()
  const deleteMutation = useDeleteTask()

  async function handleDelete(task: Task) {
    const confirmed = await confirm({
      title: t('delete.title'),
      description: t('delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(task.id)
  }

  const columns: readonly ColumnDef<Task>[] = [
    {
      id: 'title',
      header: t('fields.title'),
      sortable: true,
      cell: (row) => <Link to={`/tasks/${row.id}/edit`}>{row.title}</Link>,
    },
    {
      id: 'ticket_subject',
      header: t('fields.ticket'),
      cell: (row) =>
        row.ticket === null ? '—' : <Link to={`/tickets/${row.ticket}`}>{row.ticket_subject}</Link>,
    },
    {
      id: 'due_at',
      header: t('fields.dueAt'),
      sortable: true,
      cell: (row) => {
        const overdue = row.completed_at === null && new Date(row.due_at) < new Date()
        return (
          <span className={overdue ? 'font-medium text-destructive' : undefined}>
            {dateTime(row.due_at)}
          </span>
        )
      },
    },
    {
      id: 'status',
      header: t('fields.status'),
      cell: (row) => (
        <Badge variant={row.completed_at === null ? 'warning' : 'success'}>
          {t(row.completed_at === null ? 'statuses.pending' : 'statuses.completed')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('fields.actions'),
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.completed_at === null ? (
            <Button size="sm" variant="outline" onClick={() => completeMutation.mutate(row.id)}>
              {t('actions.complete')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate(row.id)}>
              {t('actions.reopen')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
            {t('actions.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        action={
          <Button asChild>
            <Link to="/tasks/new">
              <PlusIcon />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <Select
        value={completedFilter}
        onValueChange={(value) => setCompletedFilter(value as CompletedFilter)}
      >
        <SelectTrigger aria-label={t('filters.completed')} size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">{t('filters.pending')}</SelectItem>
          <SelectItem value="completed">{t('filters.completedOnly')}</SelectItem>
          <SelectItem value="all">{t('filters.all')}</SelectItem>
        </SelectContent>
      </Select>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('title')}
        empty={<Empty title={t('empty')} description={t('emptyDescription')} />}
      />
    </div>
  )
}
