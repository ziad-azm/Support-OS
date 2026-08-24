import { useHealth } from '../api/useHealth'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

/**
 * Reference feature: the whole stack, end to end. No `axios`, no `fetch` here
 * — every future feature should look this shallow.
 */
export function HealthPage() {
  const query = useHealth()
  const { toast } = useToast()

  return (
    <div>
      <h1>System health</h1>
      <QueryBoundary query={query}>
        {(health) => (
          <ul>
            <li>status: {health.status}</li>
            <li>database: {health.database}</li>
          </ul>
        )}
      </QueryBoundary>
      <button
        type="button"
        onClick={() => toast({ tone: 'info', message: 'Toast system is wired up.' })}
      >
        Test toast
      </button>
    </div>
  )
}
