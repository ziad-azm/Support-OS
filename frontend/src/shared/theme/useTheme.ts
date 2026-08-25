import { useSyncExternalStore } from 'react'

import { getTheme, setTheme, subscribeTheme } from './theme'
import type { Theme } from './config'

export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme)
  return { theme, setTheme }
}
