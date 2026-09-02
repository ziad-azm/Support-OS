import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SubmitButton,
  SwitchField,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { FieldMapField } from './FieldMapField'
import { useErpConnection } from '../api/useErpConnection'
import { useErpOrders } from '../api/useErpOrders'
import { useErpSyncRuns } from '../api/useErpSyncRuns'
import { useTriggerErpSync } from '../api/useTriggerErpSync'
import { useUpdateErpConnection } from '../api/useUpdateErpConnection'
import { CUSTOMER_MAP_TARGETS, ORDER_MAP_TARGETS } from '../types/erp'
import type {
  ErpConnection,
  ErpConnectionInput,
  ErpOrder,
  ErpSyncRun,
  MapTarget,
  SyncState,
} from '../types/erp'

const schema = z
  .object({
    enabled: z.boolean(),
    // Same non-empty-only `z.url()` check `SettingsPage.tsx` applies to
    // `logo_url`, reused verbatim including the reason: `.superRefine`
    // below, not a `z.url()` field type directly, so the field stays
    // optional and reuses `z.url()`'s own translated message.
    base_url: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value ?? ''),
    auth_token: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value ?? ''),
    export_enabled: z.boolean(),
    customer_external_id_field: requiredString(100),
    order_external_id_field: requiredString(100),
    order_customer_ref_field: requiredString(100),
    customer_field_map: z.record(z.string(), z.string()),
    order_field_map: z.record(z.string(), z.string()),
  })
  .superRefine((data, ctx) => {
    if (data.base_url === '') return
    const result = z.url().safeParse(data.base_url)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['base_url'] })
      }
    }
  })

type FormValues = z.output<typeof schema>

function toDefaults(connection: ErpConnection): FormValues {
  return {
    enabled: connection.enabled,
    base_url: connection.base_url,
    // Never prefilled — the API does not return it (write-only).
    auth_token: '',
    export_enabled: connection.export_enabled,
    customer_external_id_field: connection.customer_external_id_field,
    order_external_id_field: connection.order_external_id_field,
    order_customer_ref_field: connection.order_customer_ref_field,
    customer_field_map: connection.customer_field_map,
    order_field_map: connection.order_field_map,
  }
}

function toInput(values: FormValues): ErpConnectionInput {
  const { auth_token, ...rest } = values
  // A blank token means "leave the stored one alone" — omit the key
  // entirely rather than sending '' (the backend treats both the same,
  // but omitting is the more honest "unchanged" signal on the wire).
  return { ...rest, ...(auth_token ? { auth_token } : {}) }
}

export function ErpSettingsPage() {
  const query = useErpConnection()
  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary query={query}>
        {(connection) => <ErpSettingsView connection={connection} />}
      </QueryBoundary>
    </div>
  )
}

function ErpSettingsView({ connection }: { connection: ErpConnection }) {
  const { t } = useTranslation('integrations')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const mutation = useUpdateErpConnection()
  const syncMutation = useTriggerErpSync()

  const form = useAppForm({ schema, defaultValues: toDefaults(connection) })

  function onSubmit(values: FormValues) {
    mutation.mutate(toInput(values), {
      onSuccess: (updated) => {
        toast({ tone: 'success', message: t('erp.saved') })
        setFormErrors([])
        form.reset(toDefaults(updated))
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  function handleSyncNow() {
    syncMutation.mutate('import', {
      onSuccess: () => toast({ tone: 'success', message: t('erp.syncQueued') }),
      onError: (error) => {
        if (isValidationError(error)) {
          toast({ tone: 'error', message: error.nonFieldErrors.join(' ') })
        }
      },
    })
  }

  return (
    <>
      <PageHeader
        title={t('erp.title')}
        action={
          <Button
            type="button"
            onClick={handleSyncNow}
            disabled={!connection.enabled || syncMutation.isPending}
          >
            {t('erp.syncNow')}
          </Button>
        }
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t('erp.fields.connectionTitle')}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SwitchField control={form.control} name="enabled" label={t('erp.fields.enabled')} />
              <TextField control={form.control} name="base_url" label={t('erp.fields.baseUrl')} />
              <TextField
                control={form.control}
                name="auth_token"
                type="password"
                autoComplete="off"
                label={t('erp.fields.authToken')}
                description={
                  connection.has_auth_token
                    ? `${t('erp.tokenSet')} ${t('erp.tokenKeepHint')}`
                    : `${t('erp.tokenUnset')} ${t('erp.tokenKeepHint')}`
                }
              />
              <SwitchField
                control={form.control}
                name="export_enabled"
                label={t('erp.fields.exportEnabled')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t('erp.fields.idFieldsTitle')}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TextField
                control={form.control}
                name="customer_external_id_field"
                label={t('erp.fields.customerExternalIdField')}
              />
              <TextField
                control={form.control}
                name="order_external_id_field"
                label={t('erp.fields.orderExternalIdField')}
              />
              <TextField
                control={form.control}
                name="order_customer_ref_field"
                label={t('erp.fields.orderCustomerRefField')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t('erp.maps.title')}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <FieldMapFieldConnected
                name="customer_field_map"
                label={t('erp.maps.customerLabel')}
                allowedTargets={CUSTOMER_MAP_TARGETS}
                form={form}
              />
              <FieldMapFieldConnected
                name="order_field_map"
                label={t('erp.maps.orderLabel')}
                allowedTargets={ORDER_MAP_TARGETS}
                form={form}
              />
            </CardContent>
          </Card>

          <FormErrorSummary errors={formErrors} />
          <SubmitButton pending={mutation.isPending}>{t('erp.actions.save')}</SubmitButton>
        </form>
      </Form>

      <SyncHistorySection />
      <OrdersPreviewSection />
    </>
  )
}

/**
 * Thin adapter binding `FieldMapField` to `useAppForm`'s controlled
 * `watch`/`setValue` — the same wiring `StringListField` uses via
 * `FormField`'s render prop in `SettingsPage.tsx`, factored out here
 * because this page needs it twice (customer map, order map).
 */
function FieldMapFieldConnected({
  name,
  label,
  allowedTargets,
  form,
}: {
  name: 'customer_field_map' | 'order_field_map'
  label: string
  allowedTargets: readonly MapTarget[]
  form: UseFormReturn<FormValues>
}) {
  const { t } = useTranslation('integrations')
  const value = form.watch(name)
  return (
    <FieldMapField
      label={label}
      value={value}
      onChange={(next) => form.setValue(name, next, { shouldDirty: true })}
      allowedTargets={allowedTargets}
      addLabel={t('erp.maps.add')}
      sourcePlaceholder={t('erp.maps.sourcePlaceholder')}
    />
  )
}

const STATE_BADGE_VARIANT: Record<SyncState, 'success' | 'destructive' | 'outline'> = {
  success: 'success',
  failed: 'destructive',
  running: 'outline',
}

function SyncHistorySection() {
  const { t } = useTranslation('integrations')
  const { dateTime } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'started_at', direction: 'desc' },
  })
  const query = useErpSyncRuns(params)

  const columns: readonly ColumnDef<ErpSyncRun>[] = [
    {
      id: 'started_at',
      header: t('erp.fields.startedAt'),
      sortable: true,
      cell: (row) => dateTime(row.started_at),
    },
    {
      id: 'direction',
      header: t('erp.fields.direction'),
      sortable: true,
      cell: (row) => row.direction_display,
    },
    {
      id: 'state',
      header: t('erp.fields.state'),
      sortable: true,
      cell: (row) => <Badge variant={STATE_BADGE_VARIANT[row.state]}>{row.state_display}</Badge>,
    },
    {
      id: 'counts',
      header: t('erp.fields.counts'),
      cell: (row) =>
        t('erp.counts', {
          created: row.created_count,
          updated: row.updated_count,
          skipped: row.skipped_count,
          failed: row.failed_count,
        }),
    },
    {
      id: 'triggered_by_name',
      header: t('erp.fields.triggeredBy'),
      cell: (row) => row.triggered_by_name ?? t('erp.scheduled'),
    },
    {
      id: 'error_message',
      header: t('erp.fields.errorMessage'),
      cell: (row) => row.error_message || null,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('erp.historyTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          query={query}
          rowKey={(row) => String(row.id)}
          sort={sort}
          onSortChange={setSort}
          onPageChange={setPage}
          caption={t('erp.historyTitle')}
          empty={<Empty title={t('erp.historyEmpty')} />}
        />
      </CardContent>
    </Card>
  )
}

function OrdersPreviewSection() {
  const { t } = useTranslation('integrations')
  const { dateTime, currency } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'synced_at', direction: 'desc' },
  })
  const query = useErpOrders(params)

  const columns: readonly ColumnDef<ErpOrder>[] = [
    { id: 'order_number', header: t('erp.fields.orderNumber'), cell: (row) => row.order_number },
    {
      id: 'customer_name',
      header: t('erp.fields.customer'),
      cell: (row) => row.customer_name,
    },
    { id: 'status', header: t('erp.fields.status'), sortable: true, cell: (row) => row.status },
    {
      id: 'total_amount',
      header: t('erp.fields.totalAmount'),
      align: 'end',
      cell: (row) =>
        row.total_amount !== null && row.currency
          ? currency(Number(row.total_amount), row.currency)
          : null,
    },
    {
      id: 'placed_at',
      header: t('erp.fields.placedAt'),
      sortable: true,
      cell: (row) => (row.placed_at ? dateTime(row.placed_at) : null),
    },
    {
      id: 'synced_at',
      header: t('erp.fields.syncedAt'),
      sortable: true,
      cell: (row) => dateTime(row.synced_at),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('erp.ordersTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          query={query}
          rowKey={(row) => String(row.id)}
          sort={sort}
          onSortChange={setSort}
          onPageChange={setPage}
          caption={t('erp.ordersTitle')}
          empty={<Empty title={t('erp.ordersEmpty')} />}
        />
      </CardContent>
    </Card>
  )
}
