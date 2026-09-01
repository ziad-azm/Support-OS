import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
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
import { ChartDataTable, ChartFrame, GaugeChart, LineChart } from '@/shared/ui/chart'
import type { ChartSeries } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { DateRangePresets } from './DateRangePresets'
import { exportReport } from '../api/exportReport'
import { useSlaBreachRate } from '../api/useSlaBreachRate'
import { useSlaTrend } from '../api/useSlaTrend'
import { formatBucket } from '../lib/formatBucket'
import type { SlaTrendPoint } from '../types/sla'

const BUCKETS = ['day', 'week', 'month'] as const
type Bucket = (typeof BUCKETS)[number]

function toChartSeries(
  rows: SlaTrendPoint[],
  labelFor: (series: 'response' | 'resolution') => string,
): ChartSeries[] {
  const bySeries = new Map<'response' | 'resolution', SlaTrendPoint[]>()
  for (const row of rows) {
    const existing = bySeries.get(row.series)
    if (existing) {
      existing.push(row)
    } else {
      bySeries.set(row.series, [row])
    }
  }
  return [...bySeries.entries()].map(([key, points]) => ({
    key,
    label: labelFor(key),
    points,
  }))
}

export function SlaReportsPage() {
  const { t } = useTranslation('reports')
  const { date, number } = useFormatters()
  const { toast } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bucket, setBucket] = useState<Bucket>('day')

  function labelForSeries(series: 'response' | 'resolution'): string {
    return t(`trend.series.${series}`)
  }

  const trendParams = { ...(from ? { from } : {}), ...(to ? { to } : {}), bucket }
  const trendQuery = useSlaTrend(trendParams)

  const breachRateParams = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
  const breachRateQuery = useSlaBreachRate(breachRateParams)

  async function handleExportTrend() {
    try {
      await exportReport('/reports/sla/trend/', 'sla-trend', trendParams)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  async function handleExportBreachRate() {
    try {
      await exportReport('/reports/sla/breach-rate/', 'sla-breach-rate', breachRateParams)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('sidebarSla')} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sla-report-from" className="text-sm">
            {t('filters.from')}
          </Label>
          <Input
            id="sla-report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            max={to || undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sla-report-to" className="text-sm">
            {t('filters.to')}
          </Label>
          <Input
            id="sla-report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            min={from || undefined}
          />
        </div>
        <Select value={bucket} onValueChange={(value) => setBucket(value as Bucket)}>
          <SelectTrigger aria-label={t('filters.bucket')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUCKETS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`buckets.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePresets
          onSelect={({ from: presetFrom, to: presetTo }) => {
            setFrom(presetFrom)
            setTo(presetTo)
          }}
        />
      </div>

      <ChartFrame
        title={t('trend.title')}
        description={t('trend.description')}
        query={trendQuery}
        isEmpty={(rows) => rows.length === 0}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExportTrend()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', { ns: 'common', title: t('trend.title') })}
            columns={[t('fields.period'), t('fields.dimension'), t('trend.minutes')]}
            rows={rows.map((row) => [
              formatBucket(date, row.bucket),
              labelForSeries(row.series),
              String(row.value),
            ])}
          />
        )}
      >
        {(rows) => (
          <LineChart
            series={toChartSeries(rows, labelForSeries)}
            formatBucket={(b) => formatBucket(date, b)}
          />
        )}
      </ChartFrame>

      <ChartFrame
        title={t('breachRate.title')}
        description={t('breachRate.description')}
        query={breachRateQuery}
        isEmpty={(rows) => rows.every((row) => row.rate === null)}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExportBreachRate()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', { ns: 'common', title: t('breachRate.title') })}
            columns={[
              t('fields.dimension'),
              t('breachRate.met'),
              t('breachRate.breached'),
              t('breachRate.pending'),
              t('breachRate.rate'),
            ]}
            rows={rows.map((row) => [
              labelForSeries(row.key),
              String(row.met),
              String(row.breached),
              String(row.pending),
              row.rate === null
                ? t('breachRate.noData')
                : number(row.rate, { style: 'percent', maximumFractionDigits: 1 }),
            ])}
          />
        )}
      >
        {(rows) => (
          <GaugeChart
            gauges={rows
              .filter((row) => row.rate !== null)
              .map((row) => ({
                key: row.key,
                label: labelForSeries(row.key),
                value: row.rate as number,
              }))}
            formatValue={(v) => number(v, { style: 'percent', maximumFractionDigits: 1 })}
          />
        )}
      </ChartFrame>
    </div>
  )
}
