import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { cn } from '@/shared/lib/cn'

import { Sidebar } from './Sidebar'

/** Story 06 owned the header shell; Story 51 replaced it with a sidebar
 * shell (`Sidebar.tsx`) — this file is now just the flex frame around it.
 * MOTION-0 (Story 97) added the route-change fade on `<main>`. */
export function RootLayout() {
  const { pathname } = useLocation()
  // Re-trigger the entrance animation on every route change WITHOUT
  // remounting the routed subtree. A `key={pathname}` on this wrapper
  // would be three characters shorter and wrong: changing a key remounts
  // everything below it, and React Router deliberately KEEPS a component
  // mounted across a param change (`/tickets/1` -> `/tickets/2`). A motion
  // story must not change mount semantics.
  //
  // The reset to `animating = false` happens DURING RENDER (comparing
  // `renderedPathname` against the latest `pathname`), not inside an
  // effect — the React-recommended way to adjust state in response to a
  // prop/derived-value change, and it avoids an extra commit versus
  // calling `setAnimating(false)` synchronously inside a `useEffect`.
  // Flipping it back to `true` genuinely needs an effect, because it must
  // happen on the FOLLOWING frame (restarting the CSS animation), not
  // synchronously.
  //
  // Zero perceived latency: the incoming content is already rendered when
  // this runs — it fades in, it is never delayed. `.animate-in` means
  // `index.css`'s reduced-motion rule already collapses it, with no extra
  // CSS here.
  const [renderedPathname, setRenderedPathname] = useState(pathname)
  const [animating, setAnimating] = useState(false)
  if (renderedPathname !== pathname) {
    setRenderedPathname(pathname)
    setAnimating(false)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimating(true))
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <main
        className={cn(
          'flex-1 overflow-x-hidden overflow-y-auto px-4 py-6',
          animating && 'animate-in fade-in duration-(--motion-base) ease-entrance',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
