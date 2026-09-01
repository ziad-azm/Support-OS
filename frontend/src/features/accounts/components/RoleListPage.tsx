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

import { useDeleteRole } from '../api/useRoleMutations'
import { useRoles } from '../api/useRoles'
import type { Role } from '../types/role'

export function RoleListPage() {
  const { t } = useTranslation('accounts')
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useRoles({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteRole()

  async function handleDelete(role: Role) {
    const confirmed = await confirm({
      title: t('roles.delete.title'),
      description: t('roles.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(role.id)
  }

  const columns: readonly ColumnDef<Role>[] = [
    {
      id: 'name',
      header: t('roles.fields.name'),
      sortable: true,
      cell: (row) => <TableLink to={`/roles/${row.id}/edit`}>{row.name}</TableLink>,
    },
    {
      id: 'slug',
      header: t('roles.fields.slug'),
      sortable: true,
      cell: (row) => row.slug,
    },
    {
      id: 'permissions',
      header: t('roles.fields.permissions'),
      // Not sortable: server-side sorting has no ordering over a JSON
      // array's length.
      cell: (row) => t('roles.permissionCount', { count: row.permissions.length }),
    },
    {
      id: 'actions',
      header: t('roles.fields.actions'),
      cell: (row) =>
        row.is_system ? (
          <Badge variant="outline">{t('roles.systemBadge')}</Badge>
        ) : (
          <Can permission="roles.manage">
            <DeleteRowButton onClick={() => void handleDelete(row)}>
              {t('roles.actions.delete')}
            </DeleteRowButton>
          </Can>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('roles.title')}
        action={
          <Can permission="roles.manage">
            <Button asChild>
              <Link to="/roles/new">
                <PlusIcon />
                {t('roles.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('roles.searchPlaceholder')}
        aria-label={t('roles.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('roles.title')}
        empty={
          search ? (
            <Empty title={t('roles.noSearchResults')} />
          ) : (
            <Empty title={t('roles.empty')} description={t('roles.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
