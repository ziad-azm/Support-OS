import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'

import { Can } from '@/shared/auth'
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { LandingSocialIcon, isSocialPlatform } from '@/shared/landing'
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

import { useDeleteLandingSocialLink } from '../api/useLandingSocialLinkMutations'
import { useLandingSocialLinkList } from '../api/useLandingSocialLinkList'
import type { LandingSocialLinkRow } from '../types/landing'

/**
 * The social/contact link management screen — LAND-3. `LandingHighlightListPage`'s
 * shape, ordered by `order` rather than alphabetically.
 *
 * One permission: nothing in the staff app reads these except this screen,
 * and the one caller that needs them without `settings.manage` is the
 * anonymous landing page, which reads them through the public payload
 * instead of this list.
 */
export function LandingSocialLinkListPage() {
  const { t } = useTranslation('organization')
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'order', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useLandingSocialLinkList({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteLandingSocialLink()

  async function handleDelete(link: LandingSocialLinkRow) {
    const confirmed = await confirm({
      title: t('landingSocial.delete.title'),
      description: t('landingSocial.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(link.id)
  }

  const columns: readonly ColumnDef<LandingSocialLinkRow>[] = [
    {
      id: 'order',
      header: t('landingSocial.fields.order'),
      sortable: true,
      cell: (row) => row.order,
    },
    {
      id: 'platform',
      header: t('landingSocial.fields.platform'),
      sortable: true,
      cell: (row) => (
        <TableLink to={`/settings/landing/social/${String(row.id)}/edit`}>
          <span className="flex items-center gap-2">
            <LandingSocialIcon platform={row.platform} className="size-4" />
            {/* `row.platform` is plain `string` from the API — a value this
                bundle does not recognise (a backend-first deploy) falls
                back to the raw stored value rather than a missing-key
                placeholder. */}
            {isSocialPlatform(row.platform)
              ? t(`landingSocial.platforms.${row.platform}`)
              : row.platform}
          </span>
        </TableLink>
      ),
    },
    {
      id: 'value',
      // Not sortable: absent from `LandingSocialLinkViewSet.ordering_fields`,
      // the same rule every secondary column in this codebase follows.
      header: t('landingSocial.fields.value'),
      cell: (row) => row.value,
      priority: 'sm',
    },
    {
      id: 'is_enabled',
      header: t('landingSocial.fields.isEnabled'),
      cell: (row) => (
        <Badge variant={row.is_enabled ? 'success' : 'outline'}>
          {t(row.is_enabled ? 'landingSocial.enabled' : 'landingSocial.disabled')}
        </Badge>
      ),
      priority: 'sm',
    },
    {
      id: 'actions',
      header: t('landingSocial.fields.actions'),
      cell: (row) => (
        <Can permission="settings.manage">
          <DeleteRowButton onClick={() => void handleDelete(row)}>
            {t('landingSocial.actions.delete')}
          </DeleteRowButton>
        </Can>
      ),
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t('landingSocial.title')}
          action={
            <Can permission="settings.manage">
              <Button asChild>
                <Link to="/settings/landing/social/new">
                  <PlusIcon />
                  {t('landingSocial.new')}
                </Link>
              </Button>
            </Can>
          }
        />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t('landingSocial.searchPlaceholder')}
          aria-label={t('landingSocial.search')}
        />
        <DataTable
          columns={columns}
          query={query}
          rowKey={(row) => String(row.id)}
          sort={sort}
          onSortChange={setSort}
          onPageChange={setPage}
          caption={t('landingSocial.title')}
          empty={
            search ? (
              <Empty title={t('landingSocial.noSearchResults')} />
            ) : (
              // The empty description MUST say no social row renders on the
              // public page at all — same "explain what empty means" duty
              // `LandingHighlightListPage`'s empty state carries.
              <Empty
                title={t('landingSocial.empty')}
                description={t('landingSocial.emptyDescription')}
              />
            )
          }
        />
      </div>
      <Outlet />
    </>
  )
}
