import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useBranches } from '@/shared/branches'
import { useDepartments } from '@/shared/departments'
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
import { BarChart, ChartDataTable, ChartFrame, LineChart } from '@/shared/ui/chart'
import type { ChartSeries } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { DateRangePresets } from './DateRangePresets'
import { exportReport } from '../api/exportReport'
import { useTicketBreakdown } from '../api/useTicketBreakdown'
import { useTicketVolume } from '../api/useTicketVolume'
import type { TicketVolumeParams } from '../api/getTicketVolume'
import { formatBucket } from '../lib/formatBucket'
import { REPORT_DIMENSIONS } from '../types/report'
import type { BreakdownRow, ReportDimension, VolumePoint } from '../types/report'

const BUCKETS = ['day', 'week', 'month'] as const
type Bucket = (typeof BUCKETS)[number]

// LineChart's SERIES_DASH and --chart-1..5 both have exactly 5 entries — a
// 6th series would silently repeat one of each and violate CONVENTIONS.md
// § 25's "never color alone". Capped here, not in the chart component,
// since only a volume split can produce more than 5 series in this screen.
const MAX_SERIES = 5

function toChartSeries(
  rows: VolumePoint[],
  allTicketsLabel: string,
): { series: ChartSeries[]; totalCount: number } {
  if (rows.length === 0 || rows[0].series === undefined) {
    return { series: [{ key: 'total', label: allTicketsLabel, points: rows }], totalCount: 1 }
  }
  const bySeries = new Map<string, VolumePoint[]>()
  for (const row of rows) {
    const key = row.series ?? 'total'
    const existing = bySeries.get(key)
    if (existing) {
      existing.push(row)
    } else {
      bySeries.set(key, [row])
    }
  }
  return {
    series: [...bySeries.entries()]
      .slice(0, MAX_SERIES)
      .map(([key, points]) => ({ key, label: key, points })),
    totalCount: bySeries.size,
  }
}

export function TicketReportsPage() {
  const { t } = useTranslation('reports')
  const { date } = useFormatters()
  const { toast } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bucket, setBucket] = useState<Bucket>('day')
  const [series, setSeries] = useState<'none' | ReportDimension>('none')
  const [dimension, setDimension] = useState<ReportDimension>('status')
  const [department, setDepartment] = useState('all')
  const departmentsQuery = useDepartments()
  const [branch, setBranch] = useState('all')
  const branchesQuery = useBranches()

  function labelForDimensionValue(dim: ReportDimension, key: string): string {
    if (dim === 'status') return t(`statuses.${key}`, { defaultValue: key })
    if (dim === 'priority') return t(`priorities.${key}`, { defaultValue: key })
    if (dim === 'channel') return t(`channels.${key}`, { defaultValue: key })
    // category/department/branch: a category, department, or branch name
    // is user data,
    // not a translatable key, except the server's own "Uncategorized"
    // fallback label.
    return key
  }

  const volumeParams: TicketVolumeParams = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    bucket,
    ...(series !== 'none' ? { series } : {}),
    ...(department !== 'all' ? { department } : {}),
    ...(branch !== 'all' ? { branch } : {}),
  }
  const volumeQuery = useTicketVolume(volumeParams)
  const { series: volumeSeries, totalCount: volumeSeriesCount } = toChartSeries(
    volumeQuery.data ?? [],
    t('volume.allTickets'),
  )

  const breakdownParams = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    dimension,
    ...(department !== 'all' ? { department } : {}),
    ...(branch !== 'all' ? { branch } : {}),
  }
  const breakdownQuery = useTicketBreakdown(breakdownParams)

  async function handleExportVolume() {
    try {
      await exportReport('/reports/tickets/volume/', 'ticket-volume', volumeParams)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  async function handleExportBreakdown() {
    try {
      await exportReport('/reports/tickets/breakdown/', 'ticket-breakdown', breakdownParams)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-from" className="text-sm">
            {t('filters.from')}
          </Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            max={to || undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-to" className="text-sm">
            {t('filters.to')}
          </Label>
          <Input
            id="report-to"
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
        <Select
          value={series}
          onValueChange={(value) => setSeries(value as 'none' | ReportDimension)}
        >
          <SelectTrigger aria-label={t('filters.series')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('filters.noSeries')}</SelectItem>
            {REPORT_DIMENSIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`dimensions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger aria-label={t('filters.department')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allDepartments')}</SelectItem>
            <SelectItem value="none">{t('filters.noDepartment')}</SelectItem>
            {(departmentsQuery.data?.items ?? []).map((dept) => (
              <SelectItem key={dept.id} value={String(dept.id)}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger aria-label={t('filters.branch')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allBranches')}</SelectItem>
            <SelectItem value="none">{t('filters.noBranch')}</SelectItem>
            {(branchesQuery.data?.items ?? []).map((br) => (
              <SelectItem key={br.id} value={String(br.id)}>
                {br.name}
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
        title={t('volume.title')}
        description={
          volumeSeriesCount > MAX_SERIES
            ? t('volume.seriesTruncated', { shown: MAX_SERIES, total: volumeSeriesCount })
            : t('volume.description')
        }
        query={volumeQuery}
        isEmpty={(rows) => rows.every((row) => row.value === 0)}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExportVolume()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', { ns: 'common', title: t('volume.title') })}
            columns={[t('fields.period'), t('fields.series'), t('fields.value')]}
            rows={rows.map((row) => [
              formatBucket(date, row.bucket),
              row.series !== undefined
                ? labelForDimensionValue(series as ReportDimension, row.series)
                : t('volume.allTickets'),
              String(row.value),
            ])}
          />
        )}
      >
        {() => <LineChart series={volumeSeries} formatBucket={(b) => formatBucket(date, b)} />}
      </ChartFrame>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={dimension} onValueChange={(value) => setDimension(value as ReportDimension)}>
          <SelectTrigger aria-label={t('filters.dimension')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_DIMENSIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`dimensions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ChartFrame
        title={t('breakdown.title', { dimension: t(`dimensions.${dimension}`) })}
        description={t('breakdown.description')}
        query={breakdownQuery}
        isEmpty={(rows) => rows.length === 0}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExportBreakdown()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows: BreakdownRow[]) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', {
              ns: 'common',
              title: t('breakdown.title', { dimension: t(`dimensions.${dimension}`) }),
            })}
            columns={[t(`dimensions.${dimension}`), t('fields.value')]}
            rows={rows.map((row) => [
              labelForDimensionValue(dimension, row.key),
              String(row.value),
            ])}
          />
        )}
      >
        {(rows: BreakdownRow[]) => (
          <BarChart
            orientation="vertical"
            categories={rows.map((row) => ({
              key: row.key,
              label: labelForDimensionValue(dimension, row.key),
              value: row.value,
            }))}
          />
        )}
      </ChartFrame>
    </div>
  )
}
