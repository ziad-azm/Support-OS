import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Label } from '@/shared/ui/primitives/label'
import { ChartDataTable, ChartFrame, GaugeChart } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { DateRangePresets } from './DateRangePresets'
import { exportReport } from '../api/exportReport'
import { useDashboardKpis } from '../api/useDashboardKpis'
import { DASHBOARD_KPIS } from '../types/dashboard'
import type { DashboardKpi } from '../types/dashboard'

// F-14's default window. Computed once at module load: these feed
// `useState` initialisers, so recomputing per render would be wasted work
// and could straddle midnight mid-session.
const DEFAULT_TO = new Date().toISOString().slice(0, 10)
const DEFAULT_FROM = (() => {
  const d = new Date()
  d.setDate(d.getDate() - (30 - 1))
  return d.toISOString().slice(0, 10)
})()

// `UX-050`: each KPI drills into its own report. `GaugeChart` itself is
// reused unchanged by other report pages (see its own doc comment), so the
// drill-down links live here instead of inside the shared chart.
const KPI_REPORT_ROUTES: Record<DashboardKpi, string> = {
  open_rate: '/reports/tickets',
  sla_health: '/reports/sla',
  csat_risk: '/reports/csat',
  agent_load: '/reports/agents',
}

export function ManagementDashboardPage() {
  const { t } = useTranslation('reports')
  const { number } = useFormatters()
  const { toast } = useToast()

  // F-14: default to the last 30 days rather than an empty range. An empty
  // range left the dashboard showing *some* period the user could not
  // identify from the controls. 30 days matches the backend's own no-params
  // default (`aggregation.py`), so the first paint and the first explicit
  // preset click return the same data. `- 1` for the same inclusive-range
  // reason `DateRangePresets` documents.
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)

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
            max={to || undefined}
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
            min={from || undefined}
          />
        </div>
        <DateRangePresets
          from={from}
          to={to}
          onSelect={({ from: presetFrom, to: presetTo }) => {
            setFrom(presetFrom)
            setTo(presetTo)
          }}
        />
      </div>

      <ChartFrame
        // F-12: was `dashboard.title`, rendering the same string as the
        // PageHeader directly above it. The card keeps a title rather than
        // dropping one — it is the card's accessible name.
        title={t('dashboard.chartTitle')}
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

      <div className="flex flex-wrap gap-2">
        {DASHBOARD_KPIS.map((kpi) => (
          // F-13: `ghost` rendered these as unstyled plain text, so four
          // real drill-down links read as a caption under the chart.
          <Button key={kpi} asChild variant="outline" size="sm">
            <Link to={KPI_REPORT_ROUTES[kpi]}>{t(`dashboard.kpis.${kpi}`)}</Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
