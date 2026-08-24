import type { PushToastInput } from './types'

/**
 * The one sanctioned escape from React context: the QueryClient is constructed
 * in `useState` inside `AppProviders`, outside the component tree, so its
 * `onError` closure cannot call `useToast()`. `ToastProvider` registers itself
 * here on mount; non-React code calls `pushToast` instead of the hook.
 *
 * If no provider has mounted yet, `pushToast` no-ops rather than throwing —
 * a toast that arrives before mount is dropped, not a crash.
 */
type ToastSink = (toast: PushToastInput) => void

let sink: ToastSink | null = null

export function setToastSink(next: ToastSink | null): void {
  sink = next
}

export function pushToast(toast: PushToastInput): void {
  sink?.(toast)
}
