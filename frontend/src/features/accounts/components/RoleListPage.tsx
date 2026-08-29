import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'

import { useDeleteRole } from '../api/useRoleMutations'
import { useRoles } from '../api/useRoles'
import type { Role } from '../types/role'

export function RoleListPage() {
  const { t } = useTranslation('accounts')
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const query = useRoles(params)
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
      cell: (row) => <Link to={`/roles/${row.id}/edit`}>{row.name}</Link>,
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
      id: 'is_system',
      header: '',
      cell: (row) =>
        row.is_system ? <Badge variant="outline">{t('roles.systemBadge')}</Badge> : null,
    },
    {
      id: 'actions',
      header: t('roles.fields.actions'),
      cell: (row) =>
        row.is_system ? null : (
          <Can permission="roles.manage">
            <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
              {t('roles.actions.delete')}
            </Button>
          </Can>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('roles.title')}</h1>
        <Can permission="roles.manage">
          <Button asChild>
            <Link to="/roles/new">{t('roles.new')}</Link>
          </Button>
        </Can>
      </div>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('roles.title')}
        empty={<Empty title={t('roles.empty')} description={t('roles.emptyDescription')} />}
      />
    </div>
  )
}
