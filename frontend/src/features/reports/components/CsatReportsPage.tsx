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
import { ChartDataTable, ChartFrame, LineChart, WaffleChart } from '@/shared/ui/chart'
import type { ChartSeries } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { exportReport } from '../api/exportReport'
import { useCsatBreakdown } from '../api/useCsatBreakdown'
import { useCsatTrend } from '../api/useCsatTrend'
import { formatBucket } from '../lib/formatBucket'
import type { CsatRating, CsatTrendPoint } from '../types/csat'

const BUCKETS = ['day', 'week', 'month'] as const
type Bucket = (typeof BUCKETS)[number]

function toChartSeries(
  rows: CsatTrendPoint[],
  labelFor: (rating: CsatRating) => string,
): ChartSeries[] {
  const bySeries = new Map<CsatRating, CsatTrendPoint[]>()
  for (const row of rows) {
    const existing = bySeries.get(row.series)
    if (existing) {
      existing.push(row)
    } else {
      bySeries.set(row.series, [row])
    }
  }
  return [...bySeries.entries()].map(([key, points]) => ({ key, label: labelFor(key), points }))
}

export function CsatReportsPage() {
  const { t } = useTranslation('reports')
  const { date, number } = useFormatters()
  const { toast } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bucket, setBucket] = useState<Bucket>('day')

  function labelForRating(rating: CsatRating): string {
    return t(`csat.ratings.${rating}`)
  }

  const trendParams = { ...(from ? { from } : {}), ...(to ? { to } : {}), bucket }
  const trendQuery = useCsatTrend(trendParams)

  const breakdownParams = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
  const breakdownQuery = useCsatBreakdown(breakdownParams)

  async function handleExportTrend() {
    try {
      await exportReport('/reports/csat/trend/', 'csat-trend', trendParams)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  async function handleExportBreakdown() {
    try {
      await exportReport('/reports/csat/breakdown/', 'csat-breakdown', breakdownParams)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('sidebarCsat')} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="csat-report-from" className="text-sm">
            {t('filters.from')}
          </Label>
          <Input
            id="csat-report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="csat-report-to" className="text-sm">
            {t('filters.to')}
          </Label>
          <Input
            id="csat-report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
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
      </div>

      <ChartFrame
        title={t('csat.trend.title')}
        description={t('csat.trend.description')}
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
            caption={t('chart.dataTableCaption', { ns: 'common', title: t('csat.trend.title') })}
            columns={[t('fields.period'), t('csat.fields.rating'), t('csat.fields.count')]}
            rows={rows.map((row) => [
              formatBucket(date, row.bucket),
              labelForRating(row.series),
              String(row.value),
            ])}
          />
        )}
      >
        {(rows) => (
          <LineChart
            series={toChartSeries(rows, labelForRating)}
            formatBucket={(b) => formatBucket(date, b)}
          />
        )}
      </ChartFrame>

      <ChartFrame
        title={t('csat.breakdown.title')}
        description={t('csat.breakdown.description')}
        query={breakdownQuery}
        isEmpty={(rows) => rows.length === 0}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExportBreakdown()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', {
              ns: 'common',
              title: t('csat.breakdown.title'),
            })}
            columns={[t('csat.fields.rating'), t('csat.fields.count')]}
            rows={rows.map((row) => [labelForRating(row.key), String(row.value)])}
          />
        )}
      >
        {(rows) => (
          <WaffleChart
            categories={rows.map((row) => ({
              key: row.key,
              label: labelForRating(row.key),
              value: row.value,
            }))}
            formatValue={(v) => number(v, { style: 'percent', maximumFractionDigits: 0 })}
          />
        )}
      </ChartFrame>
    </div>
  )
}
