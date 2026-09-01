import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoStartOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function DateRangePresets({
  onSelect,
}: {
  onSelect: (range: { from: string; to: string }) => void
}) {
  const { t } = useTranslation('reports')
  const today = new Date().toISOString().slice(0, 10)
  const presets = [
    // `days - 1`, not `days`: paired with `to: today`, this is an
    // inclusive range (today counts as one of the N days). `isoDaysAgo(7)`
    // with `to: today` actually spans 8 calendar days, not 7 — matches the
    // backend's own default-range computation (`aggregation.py`'s
    // `today - (N - 1)`), confirmed live: the unfixed version returned 31
    // buckets for "Last 30 days", one more than the backend's own no-params
    // default returns for the same nominal window.
    { key: 'last7', label: t('presets.last7'), from: isoDaysAgo(7 - 1) },
    { key: 'last30', label: t('presets.last30'), from: isoDaysAgo(30 - 1) },
    { key: 'thisMonth', label: t('presets.thisMonth'), from: isoStartOfMonth() },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect({ from: preset.from, to: today })}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}
