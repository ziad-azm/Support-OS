import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { DeleteRowButton } from '@/shared/ui/data-table/DeleteRowButton'
import { TableLink } from '@/shared/ui/data-table/TableLink'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useDeleteWebhookSubscription } from '../api/useWebhookSubscriptionMutations'
import { useWebhookSubscriptions } from '../api/useWebhookSubscriptions'
import type { WebhookSubscription } from '../types/webhook'

export function WebhookSubscriptionListPage() {
  const { t } = useTranslation('webhooks')
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useWebhookSubscriptions({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteWebhookSubscription()

  async function handleDelete(subscription: WebhookSubscription) {
    const confirmed = await confirm({
      title: t('list.delete.title'),
      description: t('list.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(subscription.id)
  }

  const columns: readonly ColumnDef<WebhookSubscription>[] = [
    {
      id: 'name',
      header: t('list.fields.name'),
      sortable: true,
      cell: (row) => <TableLink to={`/settings/webhooks/${row.id}/edit`}>{row.name}</TableLink>,
    },
    {
      id: 'target_url',
      header: t('list.fields.targetUrl'),
      cell: (row) => row.target_url,
    },
    {
      id: 'events',
      header: t('list.fields.events'),
      // Not sortable: same "no ordering over a JSON array's length"
      // reasoning RoleListPage.tsx's own `permissions` column carries.
      cell: (row) => t('list.eventCount', { count: row.events.length }),
    },
    {
      id: 'enabled',
      header: t('list.fields.enabled'),
      sortable: true,
      cell: (row) => (
        <Badge variant={row.enabled ? 'secondary' : 'outline'}>
          {row.enabled ? t('list.enabledBadge') : t('list.disabledBadge')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('list.fields.actions'),
      cell: (row) => (
        <Can permission="webhooks.manage">
          <DeleteRowButton onClick={() => void handleDelete(row)}>
            {t('list.actions.delete')}
          </DeleteRowButton>
        </Can>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('list.title')}
        action={
          <Can permission="webhooks.manage">
            <Button asChild>
              <Link to="/settings/webhooks/new">
                <PlusIcon />
                {t('list.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('list.searchPlaceholder')}
        aria-label={t('list.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('list.title')}
        empty={
          search ? (
            <Empty title={t('list.noSearchResults')} />
          ) : (
            <Empty title={t('list.empty')} description={t('list.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
