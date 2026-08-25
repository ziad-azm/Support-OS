import { initTheme } from './theme'

initTheme()

export { getTheme, setTheme, subscribeTheme } from './theme'
export { useTheme } from './useTheme'
export { THEMES } from './config'
export type { Theme } from './config'
