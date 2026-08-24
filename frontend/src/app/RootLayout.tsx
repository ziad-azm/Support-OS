import { Outlet } from 'react-router'

/** No navigation chrome here — UI-1 owns layout. */
export function RootLayout() {
  return (
    <main>
      <Outlet />
    </main>
  )
}
