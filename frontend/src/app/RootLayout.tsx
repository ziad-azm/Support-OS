import { Outlet } from 'react-router'

import { Sidebar } from './Sidebar'

/** Story 06 owned the header shell; Story 51 replaced it with a sidebar
 * shell (`Sidebar.tsx`) — this file is now just the flex frame around it. */
export function RootLayout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
