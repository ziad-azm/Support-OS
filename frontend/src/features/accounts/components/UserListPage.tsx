import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can, useAuth } from '@/shared/auth'
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

import { useDeleteUser } from '../api/useUserMutations'
import { useUsers } from '../api/useUsers'
import type { AdminUser } from '../types/user'

/**
 * The staff user-admin list screen. A `users.manage`-gated destructive
 * delete per row (SEC-6) — never rendered on the signed-in admin's own
 * row (see the plan's `## Story Goal` finding 2; the backend refuses a
 * self-delete independently either way). Deactivation via the edit form
 * remains the reversible alternative for every other row.
 */
export function UserListPage() {
  const { t } = useTranslation('accounts')
  const { user: currentUser } = useAuth()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'email', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useUsers({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteUser()

  async function handleDelete(user: AdminUser) {
    const confirmed = await confirm({
      title: t('users.delete.title'),
      description: t('users.delete.description', { email: user.email }),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(user.id)
  }

  const columns: readonly ColumnDef<AdminUser>[] = [
    {
      id: 'email',
      header: t('users.fields.email'),
      sortable: true,
      cell: (row) => <TableLink to={`/users/${row.id}/edit`}>{row.email}</TableLink>,
    },
    {
      id: 'first_name',
      header: t('users.fields.firstName'),
      sortable: true,
      cell: (row) => row.first_name,
    },
    {
      id: 'last_name',
      header: t('users.fields.lastName'),
      sortable: true,
      cell: (row) => row.last_name,
    },
    {
      id: 'role_name',
      header: t('users.fields.role'),
      // Not sortable: `role_name` is not in the viewset's `ordering_fields`.
      cell: (row) => row.role_name ?? (row.is_superuser ? t('users.superuser') : t('users.noRole')),
    },
    {
      id: 'is_active',
      header: t('users.fields.status'),
      sortable: true,
      cell: (row) => (
        <Badge
          variant={row.is_active ? 'success' : 'destructive'}
          className={row.is_active ? 'text-white' : undefined}
        >
          {row.is_active ? t('users.status.active') : t('users.status.inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('users.fields.actions'),
      cell: (row) =>
        row.id === currentUser?.id ? null : (
          <Can permission="users.manage">
            <DeleteRowButton onClick={() => void handleDelete(row)}>
              {t('users.actions.delete')}
            </DeleteRowButton>
          </Can>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('users.title')}
        action={
          <Can permission="users.manage">
            <Button asChild>
              <Link to="/users/new">
                <PlusIcon />
                {t('users.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('users.searchPlaceholder')}
        aria-label={t('users.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('users.title')}
        empty={
          search ? (
            <Empty title={t('users.noSearchResults')} />
          ) : (
            <Empty title={t('users.empty')} description={t('users.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
