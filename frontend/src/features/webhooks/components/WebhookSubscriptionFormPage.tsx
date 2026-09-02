import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'
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
import { Loading } from '@/shared/ui/Loading'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useWebhookDeliveries } from '../api/useWebhookDeliveries'
import { useWebhookEventCatalog } from '../api/useWebhookEventCatalog'
import { useWebhookSubscription } from '../api/useWebhookSubscription'
import {
  useCreateWebhookSubscription,
  useUpdateWebhookSubscription,
} from '../api/useWebhookSubscriptionMutations'
import type {
  WebhookDelivery,
  WebhookDeliveryState,
  WebhookSubscription,
  WebhookSubscriptionInput,
} from '../types/webhook'

const schema = z
  .object({
    name: requiredString(100),
    target_url: requiredString(500),
    secret: z
      .string()
      .trim()
      .max(255)
      .transform((value) => (value === '' ? undefined : value))
      .optional(),
    events: z.array(z.string()),
    enabled: z.boolean(),
  })
  // `target_url` is required here (unlike ErpSettingsPage.tsx's optional
  // `base_url`) — a subscription with no target makes no sense — so this
  // refine always runs, never gated on "only when non-empty".
  .superRefine((data, ctx) => {
    const result = z.url().safeParse(data.target_url)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['target_url'] })
      }
    }
  })

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = {
  name: '',
  target_url: '',
  secret: undefined,
  events: [],
  enabled: true,
}

function toDefaults(subscription: WebhookSubscription): FormValues {
  return {
    name: subscription.name,
    target_url: subscription.target_url,
    // Never prefilled — the API does not return it (write-only).
    secret: undefined,
    events: subscription.events,
    enabled: subscription.enabled,
  }
}

function toInput(values: FormValues): WebhookSubscriptionInput {
  const { secret, ...rest } = values
  return { ...rest, ...(secret ? { secret } : {}) }
}

/** `event.split('.')[0]` for every entry in `catalog`, grouped in catalog
 *  order — the same `groupByArea` helper `RoleFormPage.tsx` uses for
 *  `<area>.<action>` permission strings, copied here rather than
 *  imported: this is a ~10-line pure function local to one feature until
 *  a second consumer exists (CONVENTIONS.md §8). */
function groupByArea(catalog: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const event of catalog) {
    const area = event.split('.')[0]
    const existing = groups.get(area)
    if (existing) {
      existing.push(event)
    } else {
      groups.set(area, [event])
    }
  }
  return [...groups.entries()]
}

/** "ticket" -> "Ticket". A computed transform of a code identifier, not
 *  translated copy. */
function areaLabel(area: string): string {
  return area.charAt(0).toUpperCase() + area.slice(1)
}

/** One component for both create and edit, per CONVENTIONS.md §20. */
export function WebhookSubscriptionFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const subscriptionQuery = useWebhookSubscription(id, { enabled: isEdit })

  if (!isEdit) {
    return <WebhookSubscriptionForm mode="create" />
  }

  return (
    <QueryBoundary query={subscriptionQuery}>
      {(subscription) => (
        <WebhookSubscriptionForm mode="edit" id={id} subscription={subscription} />
      )}
    </QueryBoundary>
  )
}

function WebhookSubscriptionForm({
  mode,
  id,
  subscription,
}: {
  mode: 'create' | 'edit'
  id?: number
  subscription?: WebhookSubscription
}) {
  const { t } = useTranslation('webhooks')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const catalogQuery = useWebhookEventCatalog()

  const form = useAppForm({
    schema,
    defaultValues: subscription ? toDefaults(subscription) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateWebhookSubscription()
  const updateMutation = useUpdateWebhookSubscription(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  function onSubmit(values: FormValues) {
    mutation.mutate(toInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'form.created' : 'form.updated'),
        })
        navigate('/settings/webhooks')
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">{t(mode === 'create' ? 'form.new' : 'form.edit')}</h1>
      {catalogQuery.isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col gap-4">
                <TextField control={form.control} name="name" label={t('form.fields.name')} />
                <TextField
                  control={form.control}
                  name="target_url"
                  label={t('form.fields.targetUrl')}
                />
                <TextField
                  control={form.control}
                  name="secret"
                  type="password"
                  autoComplete="off"
                  label={t('form.fields.secret')}
                  description={
                    subscription?.has_secret
                      ? `${t('form.secretHint.set')} ${t('form.secretHint.keep')}`
                      : `${t('form.secretHint.unset')} ${t('form.secretHint.keep')}`
                  }
                />
                <SwitchField
                  control={form.control}
                  name="enabled"
                  label={t('form.fields.enabled')}
                />
              </CardContent>
            </Card>
            <FormField
              control={form.control}
              name="events"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.events')}</FormLabel>
                  <FormDescription>{t('form.eventsHint')}</FormDescription>
                  <div className="flex flex-col gap-4">
                    {groupByArea(catalogQuery.data ?? []).map(([area, events]) => (
                      <div key={area} className="flex flex-col gap-2">
                        <h2 className="text-sm font-medium">
                          {t(`form.eventGroups.${area}`, { defaultValue: areaLabel(area) })}
                        </h2>
                        {events.map((event) => (
                          <div key={event} className="flex items-center gap-2">
                            <Checkbox
                              checked={field.value.includes(event)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked === true
                                    ? [...field.value, event]
                                    : field.value.filter((e: string) => e !== event),
                                )
                              }
                            />
                            <span className="font-mono text-sm">{event}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormErrorSummary errors={formErrors} />
            <div className="flex gap-2">
              <SubmitButton pending={mutation.isPending}>{t('form.actions.save')}</SubmitButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/settings/webhooks')}
              >
                {t('actions.cancel', { ns: 'common' })}
              </Button>
            </div>
          </form>
        </Form>
      )}
      {mode === 'edit' && id !== undefined ? <WebhookDeliveryHistory subscriptionId={id} /> : null}
    </div>
  )
}

const STATE_BADGE_VARIANT: Record<WebhookDeliveryState, 'success' | 'destructive' | 'outline'> = {
  success: 'success',
  failed: 'destructive',
  retrying: 'outline',
}

function WebhookDeliveryHistory({ subscriptionId }: { subscriptionId: number }) {
  const { t } = useTranslation('webhooks')
  const { dateTime } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })
  const query = useWebhookDeliveries({ ...params, subscription: subscriptionId })

  const columns: readonly ColumnDef<WebhookDelivery>[] = [
    {
      id: 'created_at',
      header: t('deliveries.fields.createdAt'),
      sortable: true,
      cell: (row) => dateTime(row.created_at),
    },
    { id: 'event', header: t('deliveries.fields.event'), cell: (row) => row.event },
    {
      id: 'state',
      header: t('deliveries.fields.state'),
      sortable: true,
      cell: (row) => <Badge variant={STATE_BADGE_VARIANT[row.state]}>{row.state_display}</Badge>,
    },
    { id: 'attempt', header: t('deliveries.fields.attempt'), cell: (row) => row.attempt },
    {
      id: 'response_status_code',
      header: t('deliveries.fields.responseStatusCode'),
      cell: (row) => row.response_status_code,
    },
    {
      id: 'error_message',
      header: t('deliveries.fields.errorMessage'),
      cell: (row) => row.error_message || null,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('deliveries.title')}</h2>
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
          caption={t('deliveries.title')}
          empty={<Empty title={t('deliveries.empty')} />}
        />
      </CardContent>
    </Card>
  )
}
