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
import { BarChart, ChartDataTable, ChartFrame } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { DateRangePresets } from './DateRangePresets'
import { exportReport } from '../api/exportReport'
import { useAgentPerformance } from '../api/useAgentPerformance'
import { AGENT_METRICS } from '../types/agent'
import type { AgentMetric } from '../types/agent'

export function AgentReportsPage() {
  const { t } = useTranslation('reports')
  const { number } = useFormatters()
  const { toast } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [metric, setMetric] = useState<AgentMetric>('handled')

  function formatMetricValue(value: number): string {
    if (metric === 'csat') return number(value, { style: 'percent', maximumFractionDigits: 1 })
    if (metric === 'resolution') {
      return `${number(value, { maximumFractionDigits: 1 })} ${t('trend.minutes').toLowerCase()}`
    }
    return String(value)
  }

  const params = { ...(from ? { from } : {}), ...(to ? { to } : {}), metric }
  const query = useAgentPerformance(params)

  async function handleExport() {
    try {
      await exportReport('/reports/agents/performance/', `agent-performance-${metric}`, params)
    } catch {
      toast({ tone: 'error', message: t('actions.exportFailed') })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('sidebarAgents')} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="agent-report-from" className="text-sm">
            {t('filters.from')}
          </Label>
          <Input
            id="agent-report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="agent-report-to" className="text-sm">
            {t('filters.to')}
          </Label>
          <Input
            id="agent-report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            min={from || undefined}
          />
        </div>
        <Select value={metric} onValueChange={(value) => setMetric(value as AgentMetric)}>
          <SelectTrigger aria-label={t('agents.filters.metric')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_METRICS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`agents.metrics.${value}`)}
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
        title={t('agents.title')}
        description={t('agents.description')}
        query={query}
        isEmpty={(rows) => rows.length === 0}
        action={
          <Button variant="outline" size="sm" onClick={() => void handleExport()}>
            <DownloadIcon />
            {t('actions.exportCsv')}
          </Button>
        }
        table={(rows) => (
          <ChartDataTable
            caption={t('chart.dataTableCaption', { ns: 'common', title: t('agents.title') })}
            columns={[t('agents.fields.agent'), t('agents.fields.value')]}
            rows={rows.map((row) => [row.label, formatMetricValue(row.value)])}
          />
        )}
      >
        {(rows) => (
          <BarChart orientation="horizontal" categories={rows} formatValue={formatMetricValue} />
        )}
      </ChartFrame>
    </div>
  )
}
