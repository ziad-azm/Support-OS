import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { logger } from '@/shared/lib/logger'
import { captureError } from '@/shared/lib/monitoring'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * The crash fallback, as a function component so it can call
 * useTranslation() — a class component cannot use hooks. AppErrorBoundary
 * stays a class for componentDidCatch; only this child needs the hook.
 */
function ErrorBoundaryFallback() {
  const { t } = useTranslation()
  return (
    <div role="alert">
      <p>{t('states.error.render')}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t('actions.reload')}
      </button>
    </div>
  )
}

/**
 * Catches render-time crashes anywhere below it in the tree — NOT query
 * errors, which `QueryBoundary` handles as data, not as a crash. React has no
 * hook equivalent to `componentDidCatch`, so this stays a class component.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Unhandled render error:', error, info.componentStack)
    captureError(error, { componentStack: info.componentStack })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback />
    }
    return this.props.children
  }
}
