import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { logger } from '@/shared/lib/logger'

type Props = { children: ReactNode }
type State = { hasError: boolean }

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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <p>Something went wrong. Please reload the page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
