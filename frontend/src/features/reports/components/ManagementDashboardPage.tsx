import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Label } from '@/shared/ui/primitives/label'
import { ChartDataTable, ChartFrame, GaugeChart } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { exportReport } from '../api/exportReport'
import { useDashboardKpis } from '../api/useDashboardKpis'
import type { DashboardKpi } from '../types/dashboard'

export function ManagementDashboardPage() {
  const { t } = useTranslation('reports')
  const { number } = useFormatters()
  const { toast } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  function labelForKpi(key: DashboardKpi): string {
    return t(`dashboard.kpis.${key}`)
  }

  const params = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
  const query = useDashboardKpis(params)

  async function handleExport() {
    try {
      await exportReport('/reports/dashboard/kpis/', 'dashboard-kpis', params)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('dashboard.title')} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="dashboard-report-from" className="text-sm">
            {t('filters.from')}
          </Label>
          <Input
            id="dashboard-report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="dashboard-report-to" className="text-sm">
            {t('filters.to')}
          </Label>
          <Input
            id="dashboard-report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      <ChartFrame
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        query={query}
        isEmpty={(rows) => rows.every((row) => row.value === null)}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExport()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', { ns: 'common', title: t('dashboard.title') })}
            columns={[t('dashboard.fields.kpi'), t('dashboard.fields.value')]}
            rows={rows.map((row) => [
              labelForKpi(row.key),
              row.value === null
                ? t('dashboard.noData')
                : number(row.value, { style: 'percent', maximumFractionDigits: 1 }),
            ])}
          />
        )}
      >
        {(rows) => (
          <GaugeChart
            gauges={rows
              .filter((row) => row.value !== null)
              .map((row) => ({
                key: row.key,
                label: labelForKpi(row.key),
                value: row.value as number,
              }))}
            formatValue={(v) => number(v, { style: 'percent', maximumFractionDigits: 1 })}
          />
        )}
      </ChartFrame>
    </div>
  )
}
