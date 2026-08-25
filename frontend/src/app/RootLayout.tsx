import { Outlet } from 'react-router'

import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'

/** No navigation chrome here — UI-1 owns layout. LanguageSwitcher is this
 * story's only chrome; UI-1 will move it into a real header. */
export function RootLayout() {
  return (
    <main>
      <LanguageSwitcher />
      <Outlet />
    </main>
  )
}
