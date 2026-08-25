import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { THEMES } from '@/shared/theme'
import { useTheme } from '@/shared/theme/useTheme'
import { Button } from '@/shared/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu'

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const

/**
 * Minimal theme switcher. Touches neither `localStorage` nor
 * `document.documentElement` itself — `setTheme` does both. Two writers of
 * the same state is how they drift. See CONVENTIONS.md §19.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const ActiveIcon = THEME_ICONS[theme]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme.label')}>
          <ActiveIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((value) => {
          const Icon = THEME_ICONS[value]
          return (
            <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
              <Icon />
              {t(`theme.${value}`)}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
