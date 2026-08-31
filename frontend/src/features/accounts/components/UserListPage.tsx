import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useUsers } from '../api/useUsers'
import type { AdminUser } from '../types/user'

/**
 * The staff user-admin list screen. No delete action anywhere here —
 * `UserViewSet` has no `destroy` action (see the plan's `## Story Goal` for
 * the verified CASCADE finding); deactivation via the edit form is the
 * sanctioned way to remove someone's access.
 */
export function UserListPage() {
  const { t } = useTranslation('accounts')
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'email', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useUsers({ ...params, ...(search ? { search } : {}) })

  const columns: readonly ColumnDef<AdminUser>[] = [
    {
      id: 'email',
      header: t('users.fields.email'),
      sortable: true,
      cell: (row) => <Link to={`/users/${row.id}/edit`}>{row.email}</Link>,
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
